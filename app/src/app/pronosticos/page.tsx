import React from 'react';
import { prisma } from '../../lib/db';
import { getCurrentSession } from '../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import { PronosticosClient } from '../../components/match/PronosticosClient';
import { ScoreType, PhaseId, MatchStatus } from '../../types/domain';
import Link from 'next/link';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PronosticosPage() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Check league membership — predictions only make sense within a league
  const membershipCount = await prisma.leagueMember.count({
    where: { userId },
  });

  if (membershipCount === 0) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center space-y-4 py-12">
          <div className="w-14 h-14 rounded-full bg-gold-400/10 border border-gold-500/30 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-gold-400" />
          </div>
          <h2 className="font-display text-2xl text-text-primary">Sin Liga Activa</h2>
          <p className="text-text-secondary text-sm">
            Únete o crea una liga para comenzar a hacer predicciones y competir con otros jugadores.
          </p>
          <div className="pt-2">
            <Link href="/liga" className="btn-gold text-sm py-2 px-6 inline-flex">
              Ir a Ligas
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  // Fetch all matches in tournament order
  const matches = await prisma.match.findMany({
    orderBy: {
      kickoffUtc: 'asc',
    },
  });

  // Fetch all user predictions
  const predictions = await prisma.prediction.findMany({
    where: {
      userId,
    },
  });

  // Serialize Date fields to plain strings for the Client Component boundaries
  const serializedMatches = matches.map((m) => ({
    id: m.id,
    phase: m.phase as PhaseId,
    group: m.group ?? undefined,
    jornada: m.jornada,
    homeTeamCode: m.homeTeamCode,
    awayTeamCode: m.awayTeamCode,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    kickoffUtc: m.kickoffUtc.toISOString(),
    status: m.status as MatchStatus,
    venue: m.venue,
    city: m.city,
  }));

  const serializedPredictions = predictions.map((p) => ({
    id: p.id,
    userId: p.userId,
    matchId: p.matchId,
    homePrediction: p.homePrediction,
    awayPrediction: p.awayPrediction,
    pointsEarned: p.pointsEarned,
    scoreType: p.scoreType as ScoreType | null,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <AppShell>
      <PronosticosClient
        matches={serializedMatches}
        predictions={serializedPredictions}
      />
    </AppShell>
  );
}

