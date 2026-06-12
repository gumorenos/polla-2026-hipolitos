import React from 'react';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { AdminLigasClient } from '../../../components/league/AdminLigasClient';

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
    },
    orderBy: {
      createdAt: 'desc',
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
  }));

  return <AdminLigasClient leagues={serializedLeagues} />;
}
