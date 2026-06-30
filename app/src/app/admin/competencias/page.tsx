import React from 'react';
import { redirect } from 'next/navigation';
import { AdminLigasClient } from '../../../components/league/AdminLigasClient';
import { getCurrentSession } from '../../../lib/auth-helpers';
import { prisma } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminCompetenciasPage() {
  const session = await getCurrentSession();
  if (!session?.user?.isSuperadmin) {
    redirect('/');
  }

  const leagues = await prisma.league.findMany({
    include: {
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              username: true,
              status: true,
            },
          },
        },
      },
      _count: {
        select: { matchPools: true },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const approvedUsers = await prisma.user.findMany({
    where: {
      status: 'approved',
    },
    select: {
      id: true,
      name: true,
      email: true,
      displayName: true,
      username: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  const serializedLeagues = leagues.map((league) => ({
    id: league.id,
    name: league.name,
    slug: league.slug,
    inviteCode: league.inviteCode,
    competitionType: league.competitionType,
    status: league.status,
    createdAt: league.createdAt.toISOString(),
    owner: league.owner,
    championDeadline: league.championDeadline?.toISOString() ?? null,
    championPoints: league.championPoints,
    pointsExactScore: league.pointsExactScore,
    pointsWinner: league.pointsWinner,
    pointsDraw: league.pointsDraw,
    pointsConsolation: league.pointsConsolation,
    entryFee: league.entryFee,
    currency: league.currency,
    isDefault: league.isDefault,
    isActive: league.isActive,
    showOdds: league.showOdds,
    showH2H: league.showH2H,
    matchPoolsCount: league._count.matchPools,
    members: league.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      isParticipant: member.isParticipant,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        displayName: member.user.displayName,
        username: member.user.username,
        status: member.user.status,
      },
    })),
  }));

  return <AdminLigasClient leagues={serializedLeagues} approvedUsers={approvedUsers} />;
}
