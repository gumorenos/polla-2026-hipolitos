import React from 'react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import { redirect, notFound } from 'next/navigation';
import { LigaDetalleClient } from '../../../components/league/LigaDetalleClient';

export default async function LigaDetallePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const isSuperadmin = !!session.user.isSuperadmin;

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
    where: { leagueId: league.id },
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
    },
    include: {
      user: true,
    },
    orderBy: {
      rank: 'asc',
    },
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

  const serializedStandings = standings.map((s) => ({
    userId: s.userId,
    displayName: s.user.displayName || s.user.name,
    points: s.points,
    exacts: s.exacts,
    tendencies: s.tendencies,
    consolations: s.consolations,
    misses: s.misses,
    rank: s.rank,
    previousRank: s.previousRank,
  }));

  // If there are no standing rows computed yet, generate a fallback standing layout
  // from our members list showing 0 points.
  const finalStandings =
    serializedStandings.length > 0
      ? serializedStandings
      : serializedMembers.map((m, index) => ({
          userId: m.userId,
          displayName: m.user.displayName || m.user.name,
          points: 0,
          exacts: 0,
          tendencies: 0,
          consolations: 0,
          misses: 0,
          rank: index + 1,
          previousRank: index + 1,
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

