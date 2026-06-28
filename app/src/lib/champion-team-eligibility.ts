import { prisma } from './db';
import { collectRealTeamCodesFromSources, filterRealTeams } from './public-team-market-analysis';

export type ChampionTeamUniverses = {
  visibleTeamCodes: Set<string>;
  eligibleTeamCodes: Set<string>;
};

export async function getChampionTeamUniverses(leagueId: string): Promise<ChampionTeamUniverses> {
  const [teams, statuses, outrightSnapshots, picks, winnerPredictions, matches] = await Promise.all([
    prisma.team.findMany({ select: { code: true, name: true } }),
    prisma.teamTournamentStatus.findMany({
      where: { leagueId },
      select: { teamCode: true },
    }),
    prisma.championOddsSnapshot.findMany({
      where: { leagueId, sourceMarket: 'outright_winner' },
      select: { teamCode: true },
    }),
    prisma.championPick.findMany({
      where: { leagueId },
      select: { teamCode: true },
    }),
    prisma.winnerPrediction.findMany({
      where: { leagueId },
      select: { teamCode: true },
    }),
    prisma.match.findMany({
      select: { homeTeamCode: true, awayTeamCode: true },
    }),
  ]);

  const fixtureTeamCodes = matches.flatMap((match) => [match.homeTeamCode, match.awayTeamCode]);
  const statusTeamCodes = statuses.map((status) => status.teamCode);
  const outrightTeamCodes = outrightSnapshots.map((snapshot) => snapshot.teamCode);

  const eligibleTeamCodes = collectRealTeamCodesFromSources(teams, [
    fixtureTeamCodes,
    statusTeamCodes,
    outrightTeamCodes,
  ]);
  const visibleTeamCodes = collectRealTeamCodesFromSources(teams, [
    eligibleTeamCodes,
    picks.map((pick) => pick.teamCode),
    winnerPredictions.map((prediction) => prediction.teamCode),
  ]);

  return { visibleTeamCodes, eligibleTeamCodes };
}

export async function getVisibleChampionTeamCodes(leagueId: string): Promise<Set<string>> {
  return (await getChampionTeamUniverses(leagueId)).visibleTeamCodes;
}

export async function getEligibleChampionPickTeamCodes(leagueId: string): Promise<Set<string>> {
  return (await getChampionTeamUniverses(leagueId)).eligibleTeamCodes;
}

export async function getEligibleChampionTeams(leagueId: string) {
  const eligibleTeamCodes = await getEligibleChampionPickTeamCodes(leagueId);
  const teams = await prisma.team.findMany({
    where: { code: { in: Array.from(eligibleTeamCodes) } },
    orderBy: { name: 'asc' },
  });
  return filterRealTeams(teams);
}

export async function assertEligibleChampionTeam(leagueId: string, teamCode: string) {
  const normalizedTeamCode = teamCode.trim().toUpperCase();
  const eligibleTeamCodes = await getEligibleChampionPickTeamCodes(leagueId);
  if (!eligibleTeamCodes.has(normalizedTeamCode)) {
    throw new Error('La selección elegida no está habilitada para Champion Survivor en esta competencia.');
  }

  const team = await prisma.team.findUnique({ where: { code: normalizedTeamCode } });
  if (!team || filterRealTeams([team]).length === 0) {
    throw new Error('La selección elegida no es un equipo real válido.');
  }

  return team;
}
