import { redirect } from 'next/navigation';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import MatchesManagementClient from './MatchesManagementClient';
import Link from 'next/link';

export const metadata = {
  title: 'Admin - Gestionar Partidos | La Polla 2026',
};

export default async function AdminPartidosPage() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isSuperadmin) {
    redirect('/liga');
  }

  const matches = await prisma.match.findMany({
    orderBy: { kickoffUtc: 'asc' },
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-gold">Gestionar Partidos</h1>
        <Link href="/admin" className="text-sm text-gold hover:underline">
          &larr; Volver a Panel
        </Link>
      </div>
      
      <div className="bg-surface border border-border rounded-lg p-6">
        <p className="text-text-muted mb-6">
          Modifica los detalles de programación, horarios de kickoff, estadios y fases de cada partido de la Copa Mundial 2026.
        </p>

        <MatchesManagementClient matches={matches} />
      </div>
    </div>
  );
}
