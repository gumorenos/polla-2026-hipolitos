/**
 * app/src/lib/services/match-pool-settlement.ts
 *
 * Service: settleMatchPoolsForFinalMatch(matchId)
 *
 * Called from runPostFinalResultPipeline after a final result is saved.
 * Idempotent — safe to call multiple times for the same matchId.
 * Failures are non-fatal to the result pipeline.
 *
 * Money safety: operates on referential amounts only. No real money is moved.
 */

import { prisma } from '../db';
import { calculateMatchPoolSettlement, resolveMatchPoolPick } from '../match-pool';
import type {
  MatchPoolMatchContext,
  MatchPoolPickType,
  MatchPoolSettlementInput,
} from '../match-pool';

export interface MatchPoolSettlementSummary {
  settled: number;
  voided: number;
  skipped: number;
  warnings: string[];
}

/**
 * Settles all open or locked match pools for a given match once the match
 * has a trusted final result in the database.
 *
 * A result is trusted when:
 *   - match.status = 'result'
 *   - match.resultStatus = 'final'
 *   - homeScore and awayScore are present
 *   - for knockout: winnerTeamCode is present
 *
 * Pools already in 'settled', 'void', or 'cancelled' are skipped (idempotent).
 */
export async function settleMatchPoolsForFinalMatch(
  matchId: string,
): Promise<MatchPoolSettlementSummary> {
  const summary: MatchPoolSettlementSummary = {
    settled: 0,
    voided: 0,
    skipped: 0,
    warnings: [],
  };

  // Load the match with required result fields
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      phase: true,
      homeTeamCode: true,
      awayTeamCode: true,
      kickoffUtc: true,
      status: true,
      resultStatus: true,
      homeScore: true,
      awayScore: true,
      winnerTeamCode: true,
    },
  });

  if (!match) {
    summary.warnings.push(`Partido ${matchId} no encontrado al liquidar bolsas.`);
    return summary;
  }

  // Verify result is trusted final
  if (match.status !== 'result' || match.resultStatus !== 'final') {
    summary.warnings.push(
      `Partido ${matchId} no tiene resultado final confiable. Liquidación omitida.`,
    );
    return summary;
  }

  const matchContext: MatchPoolMatchContext = {
    id: match.id,
    phase: match.phase,
    homeTeamCode: match.homeTeamCode,
    awayTeamCode: match.awayTeamCode,
    kickoffUtc: match.kickoffUtc,
    status: match.status,
    resultStatus: match.resultStatus,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    winnerTeamCode: match.winnerTeamCode,
  };

  const winningPick = resolveMatchPoolPick(matchContext);
  if (winningPick === null && match.phase !== 'groups') {
    summary.warnings.push(
      `Partido ${matchId} es eliminatorio sin ganador definido. Liquidación omitida.`,
    );
    return summary;
  }

  // Load pools for this match that are open or locked
  const pools = await prisma.matchPool.findMany({
    where: {
      matchId,
      status: { in: ['open', 'locked'] },
    },
    include: {
      entries: {
        select: {
          id: true,
          userId: true,
          pickType: true,
          pickValue: true,
          status: true,
        },
      },
    },
  });

  for (const pool of pools) {
    try {
      const settlementInput: MatchPoolSettlementInput = {
        poolId: pool.id,
        entries: pool.entries.map((e) => ({
          id: e.id,
          userId: e.userId,
          pickType: e.pickType as MatchPoolPickType,
          pickValue: e.pickValue,
        })),
        amount: pool.amount,
        match: matchContext,
      };

      const settlement = calculateMatchPoolSettlement(settlementInput);

      // Skip if settlement says the pool is still open (result not final per domain logic)
      if (settlement.poolStatus === 'open') {
        summary.skipped++;
        continue;
      }

      const now = new Date();

      await prisma.$transaction(async (tx) => {
        // Update pool status
        await tx.matchPool.update({
          where: { id: pool.id },
          data: {
            status: settlement.poolStatus,
            settledAt: now,
            settlementReason: settlement.settlementReason,
          },
        });

        // Update each entry
        for (const er of settlement.entryResults) {
          await tx.matchPoolEntry.update({
            where: { id: er.entryId },
            data: {
              status: er.status,
              netAmount: er.netAmount,
              resultNote: er.resultNote,
            },
          });
        }
      });

      if (settlement.poolStatus === 'settled') {
        summary.settled++;
      } else {
        summary.voided++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.warnings.push(`Error al liquidar bolsa ${pool.id}: ${msg}`);
    }
  }

  return summary;
}
