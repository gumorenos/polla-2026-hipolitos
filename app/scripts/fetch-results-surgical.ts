import './load-env';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/db';
import { fetchAndSaveMatchResultInternal } from '../src/lib/actions/results';
import {
  DEFAULT_SURGICAL_FETCH_LIMIT,
  GROUP_RESULT_FETCH_OFFSET_MINUTES,
  isMatchResultFinal,
  processSurgicalFetchCandidate,
  selectSurgicalFetchCandidates,
  type SurgicalResultMatch,
} from '../src/lib/result-fetch-scheduler';

const MINUTE_MS = 60 * 1000;

type Summary = {
  due: number;
  skippedFinal: number;
  fetched: number;
  savedFinal: number;
  notFinalYet: number;
  failed: number;
  stoppedEarly: boolean;
};

function readPositiveIntegerArg(name: string, fallback: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getNow(): Date {
  const raw = process.argv.find((arg) => arg.startsWith('--now='))?.split('=')[1];
  if (!raw) return new Date();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    console.warn(`[WARN] --now inválido: ${raw}. Se usará la hora del sistema.`);
    return new Date();
  }
  return parsed;
}

function isConcreteTeamCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code.trim());
}

function diagnosticSummary(result: {
  diagnostics?: Array<{ provider: string; success: boolean; failureCategory?: string }>;
}): string {
  if (!result.diagnostics?.length) return 'sin diagnóstico de proveedor';
  return result.diagnostics
    .map((item) => `${item.provider}:${item.success ? 'ok' : item.failureCategory || 'failed'}`)
    .join(', ');
}

async function claimMatchForFetch(match: SurgicalResultMatch, attemptedAt: Date): Promise<boolean> {
  const incompleteConditions: Prisma.MatchWhereInput[] = [
    { status: { not: 'result' } },
    { resultStatus: { not: 'final' } },
    { homeScore: null },
    { awayScore: null },
    ...(match.phase === 'groups' ? [] : [{ winnerTeamCode: null }]),
  ];
  const claimed = await prisma.match.updateMany({
    where: {
      id: match.id,
      resultFetchedAt: match.resultFetchedAt
        ? match.resultFetchedAt instanceof Date
          ? match.resultFetchedAt
          : new Date(match.resultFetchedAt)
        : null,
      OR: incompleteConditions,
    },
    data: { resultFetchedAt: attemptedAt },
  });
  return claimed.count === 1;
}

async function main() {
  const now = getNow();
  const configuredLimit = Number.parseInt(
    process.env.SURGICAL_RESULT_FETCH_LIMIT || String(DEFAULT_SURGICAL_FETCH_LIMIT),
    10,
  );
  const limit = readPositiveIntegerArg(
    'limit',
    Number.isInteger(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : DEFAULT_SURGICAL_FETCH_LIMIT,
  );
  const delayMs = readPositiveIntegerArg('delayMs', 3000);
  const provider = process.argv.find((arg) => arg.startsWith('--provider='))?.split('=')[1] || 'auto';
  const dryRun = process.argv.includes('--dryRun') || process.argv.includes('--dry-run');
  const enabled = process.env.RESULTS_FETCH_ENABLED !== 'false';

  console.log('=== Surgical result fetch ===');
  console.log(`now=${now.toISOString()} limit=${limit} provider=${provider} dryRun=${dryRun}`);
  if (!enabled && !dryRun) {
    console.log('RESULTS_FETCH_ENABLED=false; no se consultarán proveedores.');
    return;
  }

  const earliestPossibleDue = new Date(
    now.getTime() - GROUP_RESULT_FETCH_OFFSET_MINUTES * MINUTE_MS,
  );
  const candidates = await prisma.match.findMany({
    where: {
      kickoffUtc: { lte: earliestPossibleDue },
      OR: [
        { status: { not: 'result' } },
        { resultStatus: { not: 'final' } },
        { homeScore: null },
        { awayScore: null },
        { AND: [{ phase: { not: 'groups' } }, { winnerTeamCode: null }] },
      ],
    },
    orderBy: { kickoffUtc: 'asc' },
  });
  const concreteCandidates = candidates.filter((match) => (
    isConcreteTeamCode(match.homeTeamCode) && isConcreteTeamCode(match.awayTeamCode)
  ));
  const allDue = selectSurgicalFetchCandidates(concreteCandidates, now, concreteCandidates.length || 1);
  const dueMatches = allDue.slice(0, limit);
  const summary: Summary = {
    due: allDue.length,
    skippedFinal: 0,
    fetched: 0,
    savedFinal: 0,
    notFinalYet: 0,
    failed: 0,
    stoppedEarly: false,
  };

  console.log(`due=${summary.due} processing=${dueMatches.length} candidates=${candidates.length}`);
  if (dryRun) {
    for (const match of dueMatches) {
      console.log(`[DUE] ${match.id} ${match.homeTeamCode}-${match.awayTeamCode}`);
    }
    console.log(JSON.stringify(summary));
    return;
  }

  for (let index = 0; index < dueMatches.length; index++) {
    const candidate = dueMatches[index];
    const processed = await processSurgicalFetchCandidate(candidate.id, new Date(), {
      loadMatch: (matchId) => prisma.match.findUnique({ where: { id: matchId } }),
      claimMatch: claimMatchForFetch,
      fetchAndSaveWithPostResultPipeline: (matchId) => (
        fetchAndSaveMatchResultInternal(matchId, { provider })
      ),
    });

    if (processed.status === 'skipped_final') {
      summary.skippedFinal++;
      console.log(`[SKIP FINAL] ${candidate.id}`);
      continue;
    }
    if (processed.status !== 'fetched') {
      console.log(`[SKIP ${processed.status.toUpperCase()}] ${candidate.id}`);
      continue;
    }

    summary.fetched++;
    const result = processed.result;
    if ('success' in result && result.success) {
      summary.savedFinal++;
      console.log(`[SAVED FINAL] ${candidate.id} provider=${result.usedProvider || 'unknown'} pipeline=yes`);
    } else {
      const current = await prisma.match.findUnique({ where: { id: candidate.id } });
      if (current && isMatchResultFinal(current)) {
        summary.skippedFinal++;
        console.log(`[SKIP FINAL AFTER RECHECK] ${candidate.id}`);
      } else {
        const diagnostics = 'diagnostics' in result ? result.diagnostics : undefined;
        const categories = diagnostics?.map((item) => item.failureCategory).filter(Boolean) || [];
        if (categories.includes('not_final') || categories.includes('invalid_scores')) {
          summary.notFinalYet++;
          console.log(`[NOT FINAL] ${candidate.id} ${diagnosticSummary({ diagnostics })}`);
        } else {
          summary.failed++;
          console.log(`[FAILED] ${candidate.id} ${diagnosticSummary({ diagnostics })}`);
        }
        if (categories.includes('rate_limit')) {
          summary.stoppedEarly = true;
          console.log('[STOP] El proveedor informó cooldown/rate limit.');
          break;
        }
      }
    }

    if (index < dueMatches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log('=== Summary ===');
  console.log(JSON.stringify(summary));
}

main()
  .catch((error) => {
    console.error('Surgical result fetch failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
