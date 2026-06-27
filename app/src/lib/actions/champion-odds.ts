'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { fetchChampionOutrights, listTheOddsApiOutrightSports, identifyCandidateSports } from '../odds/the-odds-api';
import { resolveProviderTeamAlias, recordProviderTeamNames } from '../team-alias-service';
import { revalidatePath } from 'next/cache';
import {
  INVALID_CHAMPION_SPORT_MESSAGE,
  isRecommendedChampionSportKey,
  THE_ODDS_API_PROVIDER,
} from '../odds/champion-sport-guardrails';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function checkSuperadmin(
  session: unknown,
): asserts session is { user: { id: string; isSuperadmin: true } } {
  if (
    !isRecord(session)
    || !isRecord(session.user)
    || typeof session.user.id !== 'string'
    || session.user.isSuperadmin !== true
  ) {
    throw new Error('Unauthorized');
  }
}

export async function adminDetectChampionMarkets() {
  const session = await getCurrentSession();
  checkSuperadmin(session);

  const res = await listTheOddsApiOutrightSports();
  if (!res.success) {
    return { error: res.error };
  }

  const candidates = identifyCandidateSports(res.sports);
  const otherSports = res.sports.filter((sport) => !candidates.some((candidate) => candidate.key === sport.key));
  return { sports: res.sports, candidates, otherSports };
}

function normalizeAndValidateSportKey(sportKey: string): string | null {
  const normalizedSportKey = sportKey.trim().toLowerCase();
  return isRecommendedChampionSportKey(normalizedSportKey) ? normalizedSportKey : null;
}

export async function adminPreviewChampionOdds(sportKey: string) {
  const session = await getCurrentSession();
  checkSuperadmin(session);

  const normalizedSportKey = normalizeAndValidateSportKey(sportKey);
  if (!normalizedSportKey) {
    return { error: INVALID_CHAMPION_SPORT_MESSAGE };
  }

  const res = await fetchChampionOutrights(normalizedSportKey);
  if (!res.success) {
    return { error: res.error };
  }

  const outcomes = res.outcomes;
  if (!outcomes.length) {
    return { error: 'No se encontraron cuotas outright para este sport key.' };
  }

  const sampleOutcomes = outcomes.slice(0, 12).map((outcome) => ({
    name: outcome.outcomeName,
    decimalOdds: outcome.decimalOdds,
    bookmaker: outcome.bookmakerTitle,
  }));

  return {
    success: true,
    sportKey: normalizedSportKey,
    outcomeCount: outcomes.length,
    sampleOutcomes,
  };
}

export async function adminImportChampionOdds(sportKey: string) {
  const session = await getCurrentSession();
  checkSuperadmin(session);

  const normalizedSportKey = normalizeAndValidateSportKey(sportKey);
  if (!normalizedSportKey) {
    return { error: INVALID_CHAMPION_SPORT_MESSAGE };
  }

  const res = await fetchChampionOutrights(normalizedSportKey);
  if (!res.success) {
    return { error: res.error };
  }

  const outcomes = res.outcomes.filter((outcome) => (
    Number.isFinite(outcome.decimalOdds) && outcome.decimalOdds > 1
  ));
  if (!outcomes.length) {
    return { error: 'No se encontraron cuotas outright válidas para este sport key.' };
  }

  // Record all raw names found to help with future alias resolution
  await recordProviderTeamNames(THE_ODDS_API_PROVIDER, 'outrights', outcomes.map(o => o.outcomeName));

  // Determine which leagues are Champion Survivor leagues to update
  const csLeagues = await prisma.league.findMany({
    where: {
      competitionType: 'champion_survivor'
    },
    select: { id: true }
  });

  if (csLeagues.length === 0) {
    return { error: 'No hay ligas de tipo champion_survivor creadas.' };
  }

  let matchedCount = 0;
  let unmatchedCount = 0;
  let savedSnapshots = 0;

  // We will aggregate bookmakers by computing the median odd for each team
  // Map of teamCode -> odds array
  const teamOddsMap: Record<string, { odds: number[]; capturedAt: Date }> = {};
  const unmatchedNames = new Set<string>();

  for (const outcome of outcomes) {
    const aliasInfo = await resolveProviderTeamAlias(THE_ODDS_API_PROVIDER, outcome.outcomeName);
    
    // We only proceed if it was matched confidently
    if (aliasInfo.status === 'matched' && aliasInfo.teamCode) {
      matchedCount++;
      if (!teamOddsMap[aliasInfo.teamCode]) {
        teamOddsMap[aliasInfo.teamCode] = { odds: [], capturedAt: outcome.lastUpdate };
      }
      teamOddsMap[aliasInfo.teamCode].odds.push(outcome.decimalOdds);
      if (outcome.lastUpdate > teamOddsMap[aliasInfo.teamCode].capturedAt) {
        teamOddsMap[aliasInfo.teamCode].capturedAt = outcome.lastUpdate;
      }
    } else {
      unmatchedCount++;
      unmatchedNames.add(outcome.outcomeName);
    }
  }

  // Calculate median for each matched team
  for (const [teamCode, aggregate] of Object.entries(teamOddsMap)) {
    const oddsList = aggregate.odds;
    oddsList.sort((a, b) => a - b);
    const mid = Math.floor(oddsList.length / 2);
    const medianOdd = oddsList.length % 2 !== 0 ? oddsList[mid] : (oddsList[mid - 1] + oddsList[mid]) / 2;
    const impliedProbability = 1 / medianOdd;

    for (const league of csLeagues) {
      await prisma.championOddsSnapshot.create({
        data: {
          leagueId: league.id,
          teamCode: teamCode,
          provider: THE_ODDS_API_PROVIDER,
          bookmaker: 'median_aggregated',
          decimalOdds: medianOdd,
          impliedProbability: impliedProbability,
          capturedAt: aggregate.capturedAt,
          sourceMarket: 'outright_winner',
          rawSourceRef: JSON.stringify({
            sportKey: normalizedSportKey,
            market: 'outrights',
            aggregation: 'median',
            samples: oddsList.length,
          }),
          userId: session.user.id
        }
      });
      savedSnapshots++;
    }
  }

  revalidatePath('/');
  revalidatePath('/admin/odds');

  return {
    success: true,
    matchedCount,
    unmatchedCount,
    savedSnapshots,
    unmatchedNames: Array.from(unmatchedNames)
  };
}
