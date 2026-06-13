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

  // Check user status
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'approved') {
    redirect('/');
  }

  // Check league membership — predictions only make sense within a league
  const memberships = await prisma.leagueMember.findMany({
    where: { userId, league: { isActive: true } },
    include: {
      league: true,
    },
  });

  if (memberships.length === 0) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center space-y-4 py-12 animate-[fadeIn_0.3s_ease-out]">
          <div className="w-14 h-14 rounded-full bg-gold-400/10 border border-gold-500/30 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-gold-400" />
          </div>
          <h2 className="font-display text-2xl text-text-primary uppercase tracking-wide">Sin Polla Activa</h2>
          <p className="text-text-secondary text-sm">
            Únete a una polla existente usando un código de invitación o contacta con el administrador para que te asigne a una.
          </p>
          <div className="pt-2">
            <Link href="/" className="btn-gold text-xs py-2 px-6 inline-flex font-mono uppercase tracking-wider">
              Ir al Inicio
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

  // Fetch winner predictions for champion pick
  const winnerPredictions = await prisma.winnerPrediction.findMany({
    where: { userId },
  });

  // Fetch all teams
  const teams = await prisma.team.findMany({
    select: {
      code: true,
      name: true,
    },
  });

  // Fetch odds snapshots
  const odds = await prisma.oddsSnapshot.findMany({
    orderBy: { capturedAt: 'desc' },
  });
  const oddsSnapshotsMap: Record<
    string,
    {
      homeOdds: number;
      drawOdds: number;
      awayOdds: number;
      homeProbability: number;
      drawProbability: number;
      awayProbability: number;
    }
  > = {};
  for (const o of odds) {
    if (!oddsSnapshotsMap[o.matchId]) {
      oddsSnapshotsMap[o.matchId] = {
        homeOdds: o.homeOdds,
        drawOdds: o.drawOdds,
        awayOdds: o.awayOdds,
        homeProbability: o.homeProbability,
        drawProbability: o.drawProbability,
        awayProbability: o.awayProbability,
      };
    }
  }

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
    leagueId: p.leagueId,
    matchId: p.matchId,
    homePrediction: p.homePrediction,
    awayPrediction: p.awayPrediction,
    pointsEarned: p.pointsEarned,
    scoreType: p.scoreType as ScoreType | null,
    updatedAt: p.updatedAt.toISOString(),
  }));

  const serializedLeagues = memberships.map(m => ({
    id: m.league.id,
    name: m.league.name,
    slug: m.league.slug,
    isDefault: m.league.isDefault,
    championDeadline: m.league.championDeadline ? m.league.championDeadline.toISOString() : null,
    championPoints: m.league.championPoints,
    showOdds: m.league.showOdds,
  }));

  const serializedWinnerPredictions = winnerPredictions.map(wp => ({
    leagueId: wp.leagueId,
    teamCode: wp.teamCode,
  }));

  return (
    <AppShell>
      <PronosticosClient
        matches={serializedMatches}
        predictions={serializedPredictions}
        leagues={serializedLeagues}
        teams={teams}
        winnerPredictions={serializedWinnerPredictions}
        oddsSnapshots={oddsSnapshotsMap}
      />
    </AppShell>
  );
}

