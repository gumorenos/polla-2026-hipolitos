import { redirect } from 'next/navigation';
import { prisma } from '../../../lib/db';
import { getCurrentSession } from '../../../lib/auth-helpers';
export const dynamic = "force-dynamic";
import MatchesAdminClient from './MatchesAdminClient';
import Link from 'next/link';
import { calculateWorldCupQualification } from '../../../lib/fifa-qualification';

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
    redirect('/competencia');
  }

  const [matches, teams] = await Promise.all([
    prisma.match.findMany({
      orderBy: { kickoffUtc: 'asc' },
    }),
    prisma.team.findMany({
      orderBy: { name: 'asc' },
      select: { code: true, name: true },
    }),
  ]);

  const qualification = calculateWorldCupQualification(matches, teams);

  return (
    <div className="w-full space-y-6">
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

        <MatchesAdminClient matches={matches} qualification={qualification} />
      </div>
    </div>
  );
}
