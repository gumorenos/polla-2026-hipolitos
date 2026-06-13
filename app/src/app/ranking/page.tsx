import React from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { RankingTable } from '../../components/league/RankingTable';
import { prisma } from '../../lib/db';
import { getCurrentSession } from '../../lib/auth-helpers';
import { redirect } from 'next/navigation';
import { Trophy, Shield, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const dynamic = "force-dynamic";

export const metadata = {
  title: 'Tabla de Clasificación | La Polla 2026',
};

interface SearchParams {
  league?: string;
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const userId = session.user.id;
  const sParams = await searchParams;

  // Fetch all leagues user is in
  const memberships = await prisma.leagueMember.findMany({
    where: { userId },
    include: {
      league: true,
      user: true,
    }
  });

  if (memberships.length === 0) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center space-y-4 py-12">
          <h2 className="font-display text-2xl text-gold">Sin Clasificación</h2>
          <p className="text-text-secondary text-sm">
            Aún no eres miembro de ninguna liga. Crea una nueva liga o únete a una existente con un código de invitación para competir.
          </p>
          <div className="pt-2">
            <Link href="/liga" className="px-6 py-2 bg-gold text-background rounded-lg font-medium hover:bg-gold-light transition-colors">
              Ir a Ligas
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  // Determine active league
  const defaultLeague = memberships[0].league;
  const selectedLeagueId = sParams.league || defaultLeague.id;
  const selectedLeague = memberships.find(m => m.league.id === selectedLeagueId)?.league || defaultLeague;

  // Fetch standings for selected league
  const standings = await prisma.standing.findMany({
    where: {
      leagueId: selectedLeague.id,
      block: 'global',
    },
    include: {
      user: {
        include: {
          predictions: {
            where: { leagueId: selectedLeague.id },
            orderBy: { updatedAt: 'desc' }
          }
        }
      }
    },
    orderBy: {
      rank: 'asc'
    }
  });

  const serializedStandings = standings.map((s) => {
    const predictionsCount = s.user.predictions.length;
    const lastPrediction = s.user.predictions[0];
    const lastUpdated = lastPrediction ? lastPrediction.updatedAt.toISOString() : s.user.createdAt.toISOString();

    return {
      userId: s.userId,
      displayName: s.user.displayName || s.user.name,
      points: s.points,
      exacts: s.exacts,
      tendencies: s.tendencies,
      consolations: s.consolations,
      misses: s.misses,
      rank: s.rank,
      previousRank: s.previousRank,
      predictionsSubmitted: predictionsCount,
      lastUpdated: lastUpdated,
    };
  });

  // Fallback standings if not computed yet
  const finalStandings = serializedStandings.length > 0 
    ? serializedStandings 
    : memberships
        .filter(m => m.leagueId === selectedLeague.id)
        .map((m, index) => ({
          userId: m.userId,
          displayName: m.user.displayName || m.user.name || '',
          points: 0,
          exacts: 0,
          tendencies: 0,
          consolations: 0,
          misses: 0,
          rank: index + 1,
          previousRank: index + 1,
          predictionsSubmitted: 0,
          lastUpdated: new Date().toISOString(),
        }));

  const currentStand = finalStandings.find(s => s.userId === userId) ?? finalStandings[0];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="space-y-1.5 pt-2">
          <h2 className="font-display text-3xl tracking-wide text-text-primary">TABLA DE CLASIFICACIÓN</h2>
          <p className="text-text-secondary text-sm">
            Compara tus puntos con los demás miembros de tus ligas.
          </p>
        </div>

        {/* League Selector Tabs */}
        <div className="flex gap-2 border-b border-border-subtle pb-3 overflow-x-auto">
          {memberships.map((m) => (
            <Link
              key={m.league.id}
              href={`/ranking?league=${m.league.id}`}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border shrink-0 ${
                selectedLeague.id === m.league.id
                  ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                  : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
              }`}
            >
              {m.league.name}
            </Link>
          ))}
        </div>

        {/* League Quick Stats Widget */}
        {finalStandings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-base p-4 flex items-center gap-3">
              <div className="p-2.5 bg-gold-400/10 border border-gold-500 rounded-lg text-gold-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-mono font-bold">Líder</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">{finalStandings[0].displayName}</p>
              </div>
            </div>

            <div className="card-base p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-mono font-bold">Tu Puesto</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">#{currentStand?.rank || '-'} de {finalStandings.length}</p>
              </div>
            </div>

            <div className="card-base p-4 flex items-center gap-3">
              <div className="p-2.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-mono font-bold">Tu Puntaje</span>
                <p className="text-sm font-bold text-text-primary mt-0.5">{currentStand?.points || 0} Puntos</p>
              </div>
            </div>
          </div>
        )}

        {/* Standings Table component */}
        <div className="space-y-3">
          <h3 className="font-display text-lg tracking-wide uppercase text-text-primary">Clasificación</h3>
          <RankingTable standings={finalStandings} currentUserId={userId} />
        </div>
      </div>
    </AppShell>
  );
}
