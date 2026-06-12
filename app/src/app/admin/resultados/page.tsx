import { redirect } from 'next/navigation';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
import MatchesAdminClient from './MatchesAdminClient';
import Link from 'next/link';

export const metadata = {
  title: 'Admin - Resultados | La Polla 2026',
};

export default async function AdminResultadosPage() {
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
        <h1 className="font-display text-3xl text-gold">Ingresar Resultados</h1>
        <Link href="/admin" className="text-sm text-gold hover:underline">
          &larr; Volver a Panel
        </Link>
      </div>
      
      <div className="bg-surface border border-border rounded-lg p-6">
        <p className="text-text-muted mb-6">
          Ingresa los marcadores finales de los partidos. Al guardar un resultado, las predicciones de los usuarios serán calificadas automáticamente y las tablas de posiciones se recalcularán de forma global.
        </p>

        <MatchesAdminClient matches={matches} />
      </div>
    </div>
  );
}
