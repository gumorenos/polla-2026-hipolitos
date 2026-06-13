import React from 'react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { JoinLeagueClient } from '../../../components/league/JoinLeagueClient';

export const dynamic = "force-dynamic";

export default async function JoinLeaguePage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;

  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const cleanCode = inviteCode.trim().toUpperCase();

  // Find active league matching code
  const league = await prisma.league.findUnique({
    where: { inviteCode: cleanCode },
    include: {
      _count: {
        select: { members: true },
      },
    },
  });

  if (!league || league.status !== 'active') {
    // League code is invalid or archived
    return (
      <JoinLeagueClient
        league={null}
        isAlreadyMember={false}
        inviteCode={cleanCode}
      />
    );
  }

  // Check if current user is already a member of this league
  const membership = await prisma.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId: league.id,
        userId,
      },
    },
  });

  const serializedLeague = {
    id: league.id,
    name: league.name,
    slug: league.slug,
    inviteCode: league.inviteCode,
    memberCount: league._count.members,
  };

  return (
    <JoinLeagueClient
      league={serializedLeague}
      isAlreadyMember={!!membership}
      inviteCode={cleanCode}
    />
  );
}

