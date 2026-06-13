import React from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '../components/layout/AppShell';
import { getCurrentSession } from '../lib/auth-helpers';
import { prisma } from '../lib/db';
import { ArrowRight, Zap, Users, Trophy } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    redirect('/login');
  }

  const user = session.user;
  const displayName = (user as { displayName?: string | null }).displayName || user.name;

  // Fetch the user's league memberships count
  const membershipCount = await prisma.leagueMember.count({
    where: { userId: user.id },
  });

  // Fetch the user's best standing across all leagues (highest points)
  const topStanding = await prisma.standing.findFirst({
    where: { userId: user.id },
    orderBy: { points: 'desc' },
    include: { league: true },
  });

  // Count predictions made by this user
  const predictionCount = await prisma.prediction.count({
    where: { userId: user.id },
  });

  // Next upcoming match (status open or soon)
  const nextMatch = await prisma.match.findFirst({
    where: {
      status: { in: ['open', 'soon'] },
    },
    orderBy: { kickoffUtc: 'asc' },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col gap-1.5 pt-2">
          <h2 className="font-display text-3xl tracking-wide text-text-primary">
            ¡HOLA, {displayName.toUpperCase()}!
          </h2>
          <p className="text-text-secondary text-sm">
            Bienvenido al pozo oficial de la Copa del Mundo 2026.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card-base p-4 text-center">
            <p className="font-mono text-2xl font-bold text-gold-400">{topStanding?.points ?? 0}</p>
            <p className="text-[10px] text-text-muted uppercase font-mono mt-1">Puntos</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="font-mono text-2xl font-bold text-text-primary">{predictionCount}</p>
            <p className="text-[10px] text-text-muted uppercase font-mono mt-1">Predicciones</p>
          </div>
          <div className="card-base p-4 text-center">
            <p className="font-mono text-2xl font-bold text-text-primary">{membershipCount}</p>
            <p className="text-[10px] text-text-muted uppercase font-mono mt-1">Ligas</p>
          </div>
        </div>

        {/* Main action cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Predictions CTA */}
          <div className="lg:col-span-7 space-y-4">
            {nextMatch ? (
              <div className="card-base p-5 bg-gradient-to-r from-bg-tertiary to-bg-secondary/40 border-border-active space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">
                    Siguiente Partido
                  </h3>
                  <Link
                    href="/pronosticos"
                    className="text-xs text-gold-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    Ver todos <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono font-bold text-text-primary text-base">
                    {nextMatch.homeTeamCode} vs {nextMatch.awayTeamCode}
                  </span>
                  <span className="text-text-muted text-xs font-mono">
                    {new Date(nextMatch.kickoffUtc).toLocaleString('es-ES', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Bogota',
                    })}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{nextMatch.venue} · {nextMatch.city}</p>
              </div>
            ) : (
              <div className="card-base p-6 text-center text-text-muted text-sm">
                No hay partidos programados próximamente.
              </div>
            )}

            {/* Quick Actions Panel */}
            <div className="card-base p-4 bg-gradient-to-r from-bg-tertiary to-bg-secondary/40 border-border-active flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-gold-400" />
                  ¿Tienes tus predicciones listas?
                </h4>
                <p className="text-xs text-text-secondary mt-0.5">
                  Los partidos se bloquean automáticamente en el momento del pitazo inicial.
                </p>
              </div>
              <Link
                href="/pronosticos"
                className="btn-gold whitespace-nowrap self-start md:self-auto text-sm py-2 px-4"
              >
                Pronosticar ahora
              </Link>
            </div>
          </div>

          {/* Right: League CTA */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">
                Mis Ligas
              </h3>
              <Link
                href="/liga"
                className="text-xs text-gold-400 font-semibold hover:underline flex items-center gap-1"
              >
                Ver ligas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {membershipCount === 0 ? (
              <div className="card-base p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-gold-400/10 border border-gold-500/30 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6 text-gold-400" />
                </div>
                <p className="text-text-secondary text-sm">
                  Aún no perteneces a ninguna liga.
                </p>
                <Link href="/liga" className="btn-gold text-sm py-2 px-4 inline-flex">
                  Crear o unirse a una liga
                </Link>
              </div>
            ) : (
              <div className="card-base p-4 space-y-2">
                {topStanding && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gold-400/10 border border-gold-500/30 rounded-lg">
                      <Trophy className="w-4 h-4 text-gold-400" />
                    </div>
                    <div>
                      <p className="text-xs text-text-muted uppercase font-mono">Liga activa</p>
                      <p className="text-sm font-bold text-text-primary">{topStanding.league.name}</p>
                    </div>
                  </div>
                )}
                <Link
                  href="/ranking"
                  className="w-full text-center block text-xs text-gold-400 font-semibold hover:underline pt-2"
                >
                  Ver clasificación →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
