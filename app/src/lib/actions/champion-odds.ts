'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { fetchChampionOutrights, listTheOddsApiOutrightSports, identifyCandidateSports } from '../odds/the-odds-api';
import { resolveProviderTeamAlias, recordProviderTeamNames } from '../team-alias-service';
import { revalidatePath } from 'next/cache';

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
  return { sports: res.sports, candidates };
}

export async function adminImportChampionOdds(sportKey: string) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }
  checkSuperadmin(session);

  const res = await fetchChampionOutrights(sportKey);
  if (!res.success) {
    return { error: res.error };
  }

  const outcomes = res.outcomes;
  if (!outcomes.length) {
    return { error: 'No outright outcomes found.' };
  }

  // Record all raw names found to help with future alias resolution
  await recordProviderTeamNames('the-odds-api', 'outrights', outcomes.map(o => o.outcomeName));

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
  const teamOddsMap: Record<string, number[]> = {};
  const unmatchedNames = new Set<string>();

  for (const outcome of outcomes) {
    const aliasInfo = await resolveProviderTeamAlias('the-odds-api', outcome.outcomeName);
    
    // We only proceed if it was matched confidently
    if (aliasInfo.status === 'matched' && aliasInfo.teamCode) {
      matchedCount++;
      if (!teamOddsMap[aliasInfo.teamCode]) {
        teamOddsMap[aliasInfo.teamCode] = [];
      }
      teamOddsMap[aliasInfo.teamCode].push(outcome.decimalOdds);
    } else {
      unmatchedCount++;
      unmatchedNames.add(outcome.outcomeName);
    }
  }

  // Calculate median for each matched team
  for (const [teamCode, oddsList] of Object.entries(teamOddsMap)) {
    oddsList.sort((a, b) => a - b);
    const mid = Math.floor(oddsList.length / 2);
    const medianOdd = oddsList.length % 2 !== 0 ? oddsList[mid] : (oddsList[mid - 1] + oddsList[mid]) / 2;
    const impliedProbability = 1 / medianOdd;

    for (const league of csLeagues) {
      await prisma.championOddsSnapshot.create({
        data: {
          leagueId: league.id,
          teamCode: teamCode,
          provider: 'the-odds-api',
          bookmaker: 'median_aggregated',
          decimalOdds: medianOdd,
          impliedProbability: impliedProbability,
          sourceMarket: 'outright_winner',
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
