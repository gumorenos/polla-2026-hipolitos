import React from 'react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { AdminLigasClient } from '../../../components/league/AdminLigasClient';
export const dynamic = "force-dynamic";

export default async function AdminLigasPage() {
  const session = await getCurrentSession();
  if (!session || !session.user || !session.user.isSuperadmin) {
    redirect('/');
  }

  // Fetch all leagues for superadmin auditing
  const leagues = await prisma.league.findMany({
    include: {
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      _count: {
        select: { members: true },
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
            },
          },
        },
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

  const serializedLeagues = leagues.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    inviteCode: l.inviteCode,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    owner: l.owner,
    _count: l._count,
    members: l.members.map((m) => ({
      userId: m.userId,
      role: m.role,
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        displayName: m.user.displayName,
        username: m.user.username,
      },
    })),
  }));

  return <AdminLigasClient leagues={serializedLeagues} approvedUsers={approvedUsers} />;
}
