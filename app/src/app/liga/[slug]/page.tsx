import React from 'react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
export const dynamic = "force-dynamic";
import { redirect, notFound } from 'next/navigation';
import { LigaDetalleClient } from '../../../components/league/LigaDetalleClient';
import { MatchPoolLeagueClient } from '../../../components/match-pool/MatchPoolLeagueClient';
import { serializePublicMatchPool } from '../../../lib/match-pool';

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  if (email.endsWith('@polla.local')) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return '***';
  return `${phone.slice(0, 3)}***${phone.slice(-3)}`;
}

interface SearchParams {
  showDisabled?: string;
}

export default async function LigaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sParams = await searchParams;

  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const isSuperadmin = !!session.user.isSuperadmin;
  const showDisabled = sParams.showDisabled === 'true' && isSuperadmin;

  // Query league detail
  const league = await prisma.league.findUnique({
    where: { slug },
  });

  if (!league) {
    notFound();
  }

  // Enforce private league visibility: Only members or global Superadmins can view the league
  const membership = await prisma.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId: league.id,
        userId,
      },
    },
  });

  if (league.competitionType === 'match_pool') {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (currentUser?.status !== 'approved') {
      redirect('/competencia');
    }
    if (!league.isActive || league.status !== 'active') {
      redirect('/competencia');
    }

    const [poolRecords, futureMatches, approvedUsers] = await Promise.all([
      prisma.matchPool.findMany({
        where: { leagueId: league.id },
        include: {
          match: {
            select: {
              id: true,
              homeTeamCode: true,
              awayTeamCode: true,
            },
          },
          createdBy: {
            select: { name: true, displayName: true },
          },
          entries: {
            include: {
              user: { select: { name: true, displayName: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          invites: {
            include: {
              invitedUser: { select: { name: true, displayName: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.match.findMany({
        where: {
          kickoffUtc: { gt: new Date() },
          status: { not: 'result' },
          OR: [
            { resultStatus: null },
            { resultStatus: { not: 'final' } },
          ],
        },
        select: {
          id: true,
          phase: true,
          homeTeamCode: true,
          awayTeamCode: true,
          kickoffUtc: true,
        },
        orderBy: { kickoffUtc: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          status: 'approved',
          id: { not: userId },
        },
        select: { id: true, name: true, displayName: true },
        orderBy: [{ displayName: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const canManage = isSuperadmin
      || league.createdBy === userId
      || membership?.role === 'owner'
      || membership?.role === 'admin';
    const matchLabels = Object.fromEntries(poolRecords.map((pool) => [
      pool.matchId,
      `${pool.match.homeTeamCode} vs ${pool.match.awayTeamCode}`,
    ]));

    return (
      <MatchPoolLeagueClient
        league={{
          id: league.id,
          name: league.name,
          slug: league.slug,
          currency: league.currency,
        }}
        pools={poolRecords.map(serializePublicMatchPool)}
        matches={futureMatches.map((match) => ({
          id: match.id,
          label: `${match.homeTeamCode} vs ${match.awayTeamCode}`,
          phase: match.phase,
          kickoffUtc: match.kickoffUtc.toISOString(),
          homeTeamCode: match.homeTeamCode,
          awayTeamCode: match.awayTeamCode,
        }))}
        matchLabels={matchLabels}
        approvedUsers={approvedUsers.map((user) => ({
          id: user.id,
          displayName: user.displayName ?? user.name,
        }))}
        currentUserId={userId}
        canManage={canManage}
      />
    );
  }

  if (!membership && !isSuperadmin) {
    // Redirect unauthorized users to the main leagues dashboard
    redirect('/competencia');
  }

  const currentUserRole = membership ? membership.role : null;

  // Query all members (both active/approved and inactive/disabled/blocked)
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: league.id,
    },
    include: {
      user: true,
    },
    orderBy: {
      joinedAt: 'asc',
    },
  });

  // Query standings
  const standings = await prisma.standing.findMany({
    where: {
      leagueId: league.id,
      block: 'global',
      user: {
        status: showDisabled ? { in: ['approved', 'disabled'] } : 'approved',
      }
    },
    include: {
      user: {
        include: {
          predictions: {
            where: { leagueId: league.id },
            orderBy: { updatedAt: 'desc' }
          }
        }
      },
    },
    orderBy: {
      rank: 'asc',
    },
  });

  // Fetch winner predictions to calculate match vs champion points breakdown
  const winnerPreds = await prisma.winnerPrediction.findMany({
    where: { leagueId: league.id },
  });

  // Fetch winner prediction histories
  const histories = await prisma.winnerPredictionHistory.findMany({
    where: {
      leagueId: league.id,
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

  // Fetch teams for the direct correction selection
  const teams = await prisma.team.findMany({
    select: {
      code: true,
      name: true,
    },
  });

  const championPointsMap: Record<string, number> = {};
  winnerPreds.forEach((wp) => {
    championPointsMap[wp.userId] = wp.pointsEarned || 0;
  });

  // Serialize records to plain JS structures for client boundary
  const serializedLeague = {
    id: league.id,
    name: league.name,
    slug: league.slug,
    inviteCode: league.inviteCode,
    status: league.status,
    createdBy: league.createdBy,
    competitionType: league.competitionType,
    entryFee: league.entryFee,
    currency: league.currency,
    prizePoolOverride: league.prizePoolOverride ?? null,
    memberCount: members.filter(m => m.isParticipant && m.user.status === 'approved').length,
  };

  const canSeeContactInfo = isSuperadmin || currentUserRole === 'admin' || currentUserRole === 'owner';

  const serializedMembers = members.map((m) => {
    const isSelf = m.userId === userId;
    return {
      id: m.id,
      userId: m.userId,
      role: m.role,
      isParticipant: m.isParticipant,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        id: m.user.id,
        name: m.user.name,
        email: isSelf
          ? m.user.email
          : canSeeContactInfo
            ? maskEmail(m.user.email)
            : null,
        displayName: m.user.displayName,
        status: m.user.status,
        whatsapp: isSelf
          ? m.user.whatsapp
          : canSeeContactInfo
            ? maskPhone(m.user.whatsapp)
            : null,
      },
    };
  });

  const serializedStandings = standings.map((s) => {
    const predictionsCount = s.user.predictions.length;
    const lastPrediction = s.user.predictions[0];
    const lastUpdated = lastPrediction ? lastPrediction.updatedAt.toISOString() : s.user.createdAt.toISOString();
    const champPoints = championPointsMap[s.userId] || 0;
    const matchPoints = s.points - champPoints;

    return {
      userId: s.userId,
      displayName: s.user.displayName || s.user.name,
      points: s.points,
      champPoints,
      matchPoints,
      exacts: s.exacts,
      tendencies: s.tendencies,
      consolations: s.consolations,
      misses: s.misses,
      rank: s.rank,
      previousRank: s.previousRank,
      predictionsSubmitted: predictionsCount,
      lastUpdated: lastUpdated,
    };
  });

  // If there are no standing rows computed yet, generate a fallback standing layout
  // from our members list showing 0 points.
  const finalStandings =
    serializedStandings.length > 0
      ? serializedStandings
      : serializedMembers
          .filter(m => showDisabled ? ['approved', 'disabled'].includes(m.user.status || '') : m.user.status === 'approved')
          .map((m, index) => ({
              userId: m.userId,
              displayName: m.user.displayName || m.user.name,
              points: 0,
              champPoints: 0,
              matchPoints: 0,
              exacts: 0,
              tendencies: 0,
              consolations: 0,
              misses: 0,
              rank: index + 1,
              previousRank: index + 1,
              predictionsSubmitted: 0,
              lastUpdated: new Date().toISOString(),
          }));

  const serializedWinnerPredictions = winnerPreds.map(wp => ({
    userId: wp.userId,
    teamCode: wp.teamCode,
    correctionAllowed: wp.correctionAllowed,
    correctionAllowedUntil: wp.correctionAllowedUntil ? wp.correctionAllowedUntil.toISOString() : null,
    correctionReason: wp.correctionReason,
  }));

  const serializedHistories = histories.map(h => ({
    id: h.id,
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
    <LigaDetalleClient
      league={serializedLeague}
      currentUserRole={currentUserRole}
      isSuperadmin={isSuperadmin}
      currentUserId={userId}
      members={serializedMembers}
      standings={finalStandings}
      winnerPredictions={serializedWinnerPredictions}
      winnerPredictionHistories={serializedHistories}
      teams={teams}
    />
  );
}


