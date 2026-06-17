import React from 'react';
import { prisma } from '../../lib/db';
import { getCurrentSession } from '../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { LigasClient } from '../../components/league/LigasClient';

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
  const memberships = await prisma.leagueMember.findMany({
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
  });

  // Serialize Date objects to plain strings for the client component
  const serializedMemberships = memberships.map((m) => {
    const leagueMembers = m.league.members || [];
    const participantMembers = leagueMembers.filter(lm => lm.isParticipant);
    const activeMembersCount = participantMembers.filter(lm => lm.user?.status === 'approved').length;
    const inactiveMembersCount = participantMembers.filter(lm => lm.user?.status !== 'approved').length;
    const totalMembersCount = participantMembers.length;

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
        activeMembersCount,
        inactiveMembersCount,
        totalMembersCount,
        _count: {
          members: totalMembersCount,
        },
      },
    };
  });

  const initialCompetitionType = sParams.tipo === 'champion_survivor' ? 'champion_survivor' : 'full_prediction';

  return (
    <LigasClient
      memberships={serializedMemberships}
      initialCompetitionType={initialCompetitionType}
      openCreateModal={sParams.tipo === 'champion_survivor'}
    />
  );
}

