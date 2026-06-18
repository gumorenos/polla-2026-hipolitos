import React from 'react';
import { prisma } from '../../lib/db';
import { getCurrentSession } from '../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { PronosticosClient } from '../../components/match/PronosticosClient';
import { ScoreType, PhaseId, MatchStatus } from '../../types/domain';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { getLimaDateKey, getLimaTimeUntilMidnight } from '../../lib/actions/odds';
import { calculatePrizePool, getChampionPickStatus } from '../../lib/champion-survivor';


export const dynamic = 'force-dynamic';

export default async function PronosticosPage() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Check user status
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'approved') {
    redirect('/');
  }

  // Check league membership — predictions only make sense within a league
  const memberships = await prisma.leagueMember.findMany({
    where: { userId, league: { isActive: true } },
    include: {
      league: true,
    },
  });

  if (memberships.length === 0) {
    return (
      <>
        <div className="max-w-md mx-auto text-center space-y-4 py-12 animate-[fadeIn_0.3s_ease-out]">
          <div className="w-14 h-14 rounded-full bg-gold-400/10 border border-gold-500/30 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-gold-400" />
          </div>
          <h2 className="font-display text-2xl text-text-primary uppercase tracking-wide">Sin Polla Activa</h2>
          <p className="text-text-secondary text-sm">
            Únete a una polla existente usando un código de invitación o contacta con el administrador para que te asigne a una.
          </p>
          <div className="pt-2">
            <Link href="/" className="btn-gold text-xs py-2 px-6 inline-flex font-mono uppercase tracking-wider">
              Ir al Inicio
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Fetch all matches in tournament order
  const matches = await prisma.match.findMany({
    orderBy: {
      kickoffUtc: 'asc',
    },
  });

  // Fetch all user predictions
  const predictions = await prisma.prediction.findMany({
    where: {
      userId,
    },
  });

  // Fetch winner predictions for champion pick
  const winnerPredictions = await prisma.winnerPrediction.findMany({
    where: { userId },
  });

  const championPicks = await prisma.championPick.findMany({
    where: { userId },
  });

  // Fetch winner prediction histories for user's leagues
  const histories = await prisma.winnerPredictionHistory.findMany({
    where: {
      leagueId: { in: memberships.map(m => m.leagueId) },
      visibleToParticipants: true,
    },
    include: {
      user: {
        select: {
          name: true,
          displayName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });


  // Fetch all teams
  const teams = await prisma.team.findMany({
    select: {
      code: true,
      name: true,
    },
  });

  // Fetch all odds snapshots for this user or global
  const oddsSnapshots = await prisma.oddsSnapshot.findMany({
    where: {
      provider: { not: 'simulator' },
      OR: [
        { visibility: 'global' },
        { visibility: 'user_private', userId },
      ],
    },
    orderBy: { capturedAt: 'desc' },
  });

  interface FormattedOdds {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    homeProb: number;
    drawProb: number;
    awayProb: number;
    bookmaker: string;
    capturedAt: string;
  }

  const globalOddsMap: Record<string, FormattedOdds> = {};
  const userOddsMap: Record<string, FormattedOdds> = {};

  // Group outcome records by matchId + visibility + capturedAt
  const groupedSnapshots: Record<string, Record<string, (typeof oddsSnapshots)>> = {};
  
  for (const o of oddsSnapshots) {
    if (!groupedSnapshots[o.matchId]) {
      groupedSnapshots[o.matchId] = {};
    }
    if (!groupedSnapshots[o.matchId][o.visibility]) {
      groupedSnapshots[o.matchId][o.visibility] = [];
    }
    const currentList = groupedSnapshots[o.matchId][o.visibility];
    if (currentList.length === 0 || currentList[0].capturedAt.getTime() === o.capturedAt.getTime()) {
      currentList.push(o);
    }
  }

  for (const [matchId, visibilities] of Object.entries(groupedSnapshots)) {
    for (const [visibility, outcomes] of Object.entries(visibilities)) {
      const home = outcomes.find(o => o.outcomeType === 'home');
      const draw = outcomes.find(o => o.outcomeType === 'draw');
      const away = outcomes.find(o => o.outcomeType === 'away');

      if (home && draw && away) {
        const formatted = {
          homeOdds: home.decimalOdds,
          drawOdds: draw.decimalOdds,
          awayOdds: away.decimalOdds,
          homeProb: home.normalizedProbability ?? home.impliedProbability,
          drawProb: draw.normalizedProbability ?? draw.impliedProbability,
          awayProb: away.normalizedProbability ?? away.impliedProbability,
          bookmaker: home.bookmaker,
          capturedAt: home.capturedAt.toISOString(),
        };

        if (visibility === 'global') {
          globalOddsMap[matchId] = formatted;
        } else {
          userOddsMap[matchId] = formatted;
        }
      }
    }
  }

  // Fetch H2H snapshots
  const h2hSnapshots = await prisma.headToHeadSnapshot.findMany({
    where: {
      provider: { not: 'simulator' },
    },
  });
  interface FormattedH2H {
    totalMatches: number;
    homeWins: number;
    draws: number;
    awayWins: number;
    homeGoals: number;
    awayGoals: number;
    lastMatches: {
      date: string;
      competition: string;
      homeScore: number;
      awayScore: number;
      homeTeam: string;
      awayTeam: string;
    }[];
  }

  const h2hMap: Record<string, FormattedH2H> = {};
  for (const h of h2hSnapshots) {
    h2hMap[h.matchId] = {
      totalMatches: h.totalMatches,
      homeWins: h.homeWins,
      draws: h.draws,
      awayWins: h.awayWins,
      homeGoals: h.homeGoals,
      awayGoals: h.awayGoals,
      lastMatches: h.lastMatchesJson ? JSON.parse(h.lastMatchesJson) : [],
    };
  }

  const championSurvivorMemberships = memberships.filter(m => m.league.competitionType === 'champion_survivor');
  const championSurvivorLeagueIds = championSurvivorMemberships.map(m => m.leagueId);

  const [
    championTeamStatuses,
    championOddsSnapshots,
    championParticipants,
    championLeaguePicks,
  ] = championSurvivorLeagueIds.length > 0
    ? await Promise.all([
        prisma.teamTournamentStatus.findMany({
          where: { leagueId: { in: championSurvivorLeagueIds } },
        }),
        prisma.championOddsSnapshot.findMany({
          where: {
            leagueId: { in: championSurvivorLeagueIds },
            sourceMarket: 'outright_winner',
          },
          orderBy: { capturedAt: 'desc' },
        }),
        prisma.leagueMember.findMany({
          where: {
            leagueId: { in: championSurvivorLeagueIds },
            isParticipant: true,
            user: { status: 'approved' },
          },
          select: {
            leagueId: true,
            userId: true,
          },
        }),
        prisma.championPick.findMany({
          where: { leagueId: { in: championSurvivorLeagueIds } },
        }),
      ])
    : [[], [], [], []];

  type ChampionInfoPayload = {
    teamStatuses: Record<string, {
      status: string;
      eliminatedAt: string | null;
    }>;
    championOdds: Record<string, {
      decimalOdds: number;
      impliedProbability: number;
      expectedValue: number | null;
      provider: string;
      bookmaker: string;
      capturedAt: string;
    }>;
    summary: {
      totalParticipants: number;
      alive: number;
      eliminated: number;
      pending: number;
      winners: number;
      prizePool: {
        amount: number;
        estimated: boolean;
        currency: string;
      };
    };
  };

  const championInfoByLeague: Record<string, ChampionInfoPayload> = {};

  for (const membership of championSurvivorMemberships) {
    const leagueId = membership.leagueId;
    const participants = championParticipants.filter(member => member.leagueId === leagueId);
    const picks = championLeaguePicks.filter(pick => pick.leagueId === leagueId);
    const statuses = championTeamStatuses.filter(status => status.leagueId === leagueId);
    const statusByTeam = new Map(statuses.map(status => [status.teamCode, status]));
    const pickByUser = new Map(picks.map(pick => [pick.userId, pick]));
    const prizePool = calculatePrizePool(membership.league, participants.length);
    const statusCounts = {
      alive: 0,
      eliminated: 0,
      pending: 0,
      winners: 0,
    };

    for (const participant of participants) {
      const pick = pickByUser.get(participant.userId) || null;
      const teamStatus = pick ? statusByTeam.get(pick.teamCode) : null;
      const status = getChampionPickStatus(pick, teamStatus);
      if (status === 'alive') statusCounts.alive++;
      if (status === 'eliminated') statusCounts.eliminated++;
      if (status === 'pending') statusCounts.pending++;
      if (status === 'winner') statusCounts.winners++;
    }

    const teamStatusesPayload: ChampionInfoPayload['teamStatuses'] = {};
    for (const status of statuses) {
      teamStatusesPayload[status.teamCode] = {
        status: status.status,
        eliminatedAt: status.eliminatedAt ? status.eliminatedAt.toISOString() : null,
      };
    }

    const championOddsPayload: ChampionInfoPayload['championOdds'] = {};
    if (membership.league.showOdds && process.env.ODDS_DISPLAY_ENABLED === 'true') {
      for (const snapshot of championOddsSnapshots) {
        if (snapshot.leagueId !== leagueId || championOddsPayload[snapshot.teamCode]) continue;
        const impliedProbability = snapshot.impliedProbability || 1 / snapshot.decimalOdds;
        championOddsPayload[snapshot.teamCode] = {
          decimalOdds: snapshot.decimalOdds,
          impliedProbability,
          expectedValue: prizePool.amount * impliedProbability,
          provider: snapshot.provider,
          bookmaker: snapshot.bookmaker,
          capturedAt: snapshot.capturedAt.toISOString(),
        };
      }
    }

    championInfoByLeague[leagueId] = {
      teamStatuses: teamStatusesPayload,
      championOdds: championOddsPayload,
      summary: {
        totalParticipants: participants.length,
        alive: statusCounts.alive,
        eliminated: statusCounts.eliminated,
        pending: statusCounts.pending,
        winners: statusCounts.winners,
        prizePool,
      },
    };
  }

  // Rate Limiting checks
  const dateKey = await getLimaDateKey(new Date());
  const todayUsage = await prisma.userOddsRefreshUsage.findUnique({
    where: {
      userId_dateKey: {
        userId,
        dateKey,
      },
    },
  });

  const canRefreshToday = !todayUsage;
  const timeLeftToday = await getLimaTimeUntilMidnight();
  const manualRefreshEnabled = process.env.ODDS_MANUAL_USER_REFRESH_ENABLED === 'true';

  // Serialize Date fields to plain strings for the Client Component boundaries
  const serializedMatches = matches.map((m) => ({
    id: m.id,
    phase: m.phase as PhaseId,
    group: m.group ?? undefined,
    jornada: m.jornada,
    homeTeamCode: m.homeTeamCode,
    awayTeamCode: m.awayTeamCode,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    kickoffUtc: m.kickoffUtc.toISOString(),
    status: m.status as MatchStatus,
    venue: m.venue,
    city: m.city,
  }));

  const serializedPredictions = predictions.map((p) => ({
    id: p.id,
    userId: p.userId,
    leagueId: p.leagueId,
    matchId: p.matchId,
    homePrediction: p.homePrediction,
    awayPrediction: p.awayPrediction,
    pointsEarned: p.pointsEarned,
    scoreType: p.scoreType as ScoreType | null,
    updatedAt: p.updatedAt.toISOString(),
  }));

  const serializedLeagues = memberships.map(m => ({
    id: m.league.id,
    name: m.league.name,
    slug: m.league.slug,
    isDefault: m.league.isDefault,
    championDeadline: m.league.championDeadline ? m.league.championDeadline.toISOString() : null,
    championPoints: m.league.championPoints,
    showOdds: m.league.showOdds && process.env.ODDS_DISPLAY_ENABLED === 'true',
    showH2H: m.league.showH2H,
    competitionType: m.league.competitionType,
    isParticipant: m.isParticipant,
  }));

  const serializedWinnerPredictions = winnerPredictions.map(wp => ({
    leagueId: wp.leagueId,
    teamCode: wp.teamCode,
    createdAt: wp.createdAt.toISOString(),
    correctionAllowed: wp.correctionAllowed,
    correctionAllowedUntil: wp.correctionAllowedUntil ? wp.correctionAllowedUntil.toISOString() : null,
    correctionReason: wp.correctionReason,
  }));

  const serializedChampionPicks = championPicks.map((pick) => ({
    leagueId: pick.leagueId,
    teamCode: pick.teamCode,
    createdAt: pick.submittedAt.toISOString(),
    correctionAllowed: false,
    correctionAllowedUntil: null,
    correctionReason: null,
  }));

  const serializedHistories = histories.map(h => ({
    id: h.id,
    leagueId: h.leagueId,
    userId: h.userId,
    userName: h.user.displayName || h.user.name,
    oldTeamCode: h.oldTeamCode,
    newTeamCode: h.newTeamCode,
    actionType: h.actionType,
    authorizedById: h.authorizedById,
    changedById: h.changedById,
    reason: h.reason,
    createdAt: h.createdAt.toISOString(),
  }));

  return (
    <>
      <PronosticosClient
        matches={serializedMatches}
        predictions={serializedPredictions}
        leagues={serializedLeagues}
        teams={teams}
        winnerPredictions={[...serializedWinnerPredictions, ...serializedChampionPicks]}
        winnerPredictionHistories={serializedHistories}
        globalOdds={globalOddsMap}
        userOdds={userOddsMap}
        h2hData={h2hMap}
        championInfoByLeague={championInfoByLeague}
        canRefreshToday={canRefreshToday}
        timeLeftToday={timeLeftToday}
        manualRefreshEnabled={manualRefreshEnabled}
      />
    </>
  );
}
