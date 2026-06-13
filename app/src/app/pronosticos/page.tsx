import React from 'react';
import { prisma } from '../../lib/db';
import { getCurrentSession } from '../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import { PronosticosClient } from '../../components/match/PronosticosClient';
import { ScoreType, PhaseId, MatchStatus } from '../../types/domain';

export const dynamic = "force-dynamic";

export default async function PronosticosPage() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
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
      userId: session.user.id,
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
