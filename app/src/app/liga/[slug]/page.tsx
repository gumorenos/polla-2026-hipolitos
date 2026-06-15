import React from 'react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
export const dynamic = "force-dynamic";
import { redirect, notFound } from 'next/navigation';
import { LigaDetalleClient } from '../../../components/league/LigaDetalleClient';

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

  if (!membership && !isSuperadmin) {
    // Redirect unauthorized users to the main leagues dashboard
    redirect('/liga');
  }

  const currentUserRole = membership ? membership.role : null;

  // Query all members
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId: league.id,
      user: {
        status: showDisabled ? { in: ['approved', 'disabled'] } : 'approved',
      }
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
  };

  const serializedMembers = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      displayName: m.user.displayName,
      whatsapp: m.user.whatsapp,
    },
  }));

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
      : serializedMembers.map((m, index) => ({
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

  return (
    <LigaDetalleClient
      league={serializedLeague}
      currentUserRole={currentUserRole}
      isSuperadmin={isSuperadmin}
      currentUserId={userId}
      members={serializedMembers}
      standings={finalStandings}
    />
  );
}


