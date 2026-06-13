import React from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import { getCurrentSession } from '../../lib/auth-helpers';
import { prisma } from '../../lib/db';
import { PerfilClient } from '../../components/profile/PerfilClient';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const user = session.user as {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    displayName?: string | null;
    whatsapp?: string | null;
    isSuperadmin?: boolean | null;
  };

  // Fetch the user's aggregated stats across all leagues
  const standings = await prisma.standing.findMany({
    where: { userId: user.id },
  });

  const stats = standings.reduce(
    (acc, s) => ({
      points: Math.max(acc.points, s.points),   // show best league points
      exacts: acc.exacts + s.exacts,
      tendencies: acc.tendencies + s.tendencies,
      consolations: acc.consolations + s.consolations,
      misses: acc.misses + s.misses,
    }),
    { points: 0, exacts: 0, tendencies: 0, consolations: 0, misses: 0 },
  );

  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: new Date(user.createdAt).toISOString(),
    displayName: user.displayName ?? null,
    whatsapp: user.whatsapp ?? null,
    isSuperadmin: user.isSuperadmin ?? false,
  };

  return (
    <AppShell>
      <PerfilClient user={serializedUser} stats={stats} />
    </AppShell>
  );
}
