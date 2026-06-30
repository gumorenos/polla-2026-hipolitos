import React from 'react';
import { prisma } from '../../lib/db';
import { getCurrentSession } from '../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { LigasClient } from '../../components/league/LigasClient';
import { isCompetitionType, type CompetitionTypeValue } from '../../lib/competition-types';

export const dynamic = "force-dynamic";

export default async function LigasPage({
  searchParams,
}: {
  searchParams?: Promise<{ tipo?: string }>;
}) {
  const sParams = searchParams ? await searchParams : {};
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }



  // Fetch only active leagues where the current user is a member
  const [memberships, currentUser] = await Promise.all([
    prisma.leagueMember.findMany({
    where: {
      userId: session.user.id,
      league: {
        status: 'active',
      },
    },
    include: {
      league: {
        include: {
          members: {
            include: {
              user: {
                select: { status: true },
              },
            },
          },
        },
      },
    },
    orderBy: {
      joinedAt: 'desc',
    },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { status: true },
    }),
  ]);

  // Serialize Date objects to plain strings for the client component
  const serializedMemberships = memberships.map((m) => {
    const leagueMembers = m.league.members || [];
    const participantMembers = leagueMembers.filter(lm => lm.isParticipant);
    const isMatchPool = m.league.competitionType === 'match_pool';
    const activeMembersCount = isMatchPool ? 0 : participantMembers.filter(lm => lm.user?.status === 'approved').length;
    const inactiveMembersCount = isMatchPool ? 0 : participantMembers.filter(lm => lm.user?.status !== 'approved').length;
    const totalMembersCount = isMatchPool ? 0 : participantMembers.length;

    return {
      id: m.id,
      leagueId: m.leagueId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      league: {
        id: m.league.id,
        name: m.league.name,
        slug: m.league.slug,
        inviteCode: m.league.inviteCode,
        status: m.league.status,
        createdAt: m.league.createdAt.toISOString(),
        entryFee: m.league.entryFee,
        currency: m.league.currency,
        prizePoolOverride: m.league.prizePoolOverride ?? null,
        competitionType: m.league.competitionType,
        activeMembersCount,
        inactiveMembersCount,
        totalMembersCount,
        _count: {
          members: totalMembersCount,
        },
      },
    };
  });

  const existingLeagueIds = new Set(serializedMemberships.map((membership) => membership.leagueId));
  const openMatchPoolLeagues = currentUser?.status === 'approved'
    ? await prisma.league.findMany({
        where: {
          competitionType: 'match_pool',
          status: 'active',
          isActive: true,
          id: { notIn: [...existingLeagueIds] },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const visibleMemberships = [
    ...serializedMemberships,
    ...openMatchPoolLeagues.map((league) => ({
      id: `match-pool-lobby:${league.id}:${session.user.id}`,
      leagueId: league.id,
      userId: session.user.id,
      role: 'visitor',
      joinedAt: league.createdAt.toISOString(),
      league: {
        id: league.id,
        name: league.name,
        slug: league.slug,
        inviteCode: league.inviteCode,
        status: league.status,
        createdAt: league.createdAt.toISOString(),
        entryFee: league.entryFee,
        currency: league.currency,
        prizePoolOverride: null,
        competitionType: league.competitionType,
        activeMembersCount: 0,
        inactiveMembersCount: 0,
        totalMembersCount: 0,
        _count: { members: 0 },
      },
    })),
  ];

  const initialCompetitionType: CompetitionTypeValue = sParams.tipo && isCompetitionType(sParams.tipo)
    ? sParams.tipo
    : 'full_prediction';

  const openCreateModal = sParams.tipo === 'champion_survivor' || sParams.tipo === 'match_pool';

  return (
    <LigasClient
      memberships={visibleMemberships}
      initialCompetitionType={initialCompetitionType}
      openCreateModal={openCreateModal}
    />
  );
}


