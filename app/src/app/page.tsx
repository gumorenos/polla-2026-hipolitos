import React from 'react';
import { AppShell } from '../components/layout/AppShell';
import { StatCard } from '../components/ui/StatCard';
import { MatchCard } from '../components/match/MatchCard';
import { MOCK_MATCHES, MOCK_STANDINGS, MOCK_USER, MOCK_PREDICTIONS } from '../lib/mockData';
import { Trophy, Award, Target, Hash, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const userStanding = MOCK_STANDINGS.find((s) => s.userId === MOCK_USER.id) ?? {
    points: 10,
    exacts: 1,
    tendencies: 1,
    rank: 2,
    previousRank: 1,
  };

  // Calculate efficiency: (Exacts + Tendencies + Consolations) / total matches (mock 5)
  const totalPreds = Object.keys(MOCK_PREDICTIONS).length;
  const efficacy = totalPreds > 0 ? Math.round(((userStanding.exacts + userStanding.tendencies) / totalPreds) * 100) : 0;

  // Next upcoming match
  const nextMatch = MOCK_MATCHES.find((m) => m.status === 'soon' || m.status === 'live');
  const nextMatchPred = nextMatch ? MOCK_PREDICTIONS[nextMatch.id] : null;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col gap-1.5 pt-2">
          <h2 className="font-display text-3xl tracking-wide text-text-primary">
            ¡HOLA, {MOCK_USER.name.toUpperCase()}!
          </h2>
          <p className="text-text-secondary text-sm">
            Bienvenido al pozo oficial de la Copa del Mundo 2026. Revisa tus estadísticas y haz tus apuestas.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Puntos"
            value={userStanding.points}
            icon={<Trophy className="w-5 h-5" />}
            description="Acumulados global"
          />
          <StatCard
            title="Posición"
            value={`#${userStanding.rank}`}
            icon={<Hash className="w-5 h-5" />}
            trend={userStanding.previousRank > userStanding.rank ? 'up' : userStanding.previousRank < userStanding.rank ? 'down' : 'same'}
            trendValue={userStanding.previousRank !== userStanding.rank ? String(Math.abs(userStanding.previousRank - userStanding.rank)) : undefined}
            description="Liga Los Hipólitos"
          />
          <StatCard
            title="Exactos"
            value={userStanding.exacts}
            icon={<Award className="w-5 h-5" />}
            description="Marcadores clavados"
          />
          <StatCard
            title="Eficacia"
            value={`${efficacy}%`}
            icon={<Target className="w-5 h-5" />}
            description="Aciertos de predicción"
          />
        </div>

        {/* Main Columns Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Match Widget */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Siguiente Partido</h3>
              <Link href="/pronosticos" className="text-xs text-gold-400 font-semibold hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {nextMatch ? (
              <MatchCard
                match={nextMatch}
                prediction={nextMatchPred}
                variant="scoreboard"
              />
            ) : (
              <div className="card-base p-6 text-center text-text-muted text-sm">
                No hay partidos programados próximamente.
              </div>
            )}

            {/* Quick Actions Panel */}
            <div className="card-base p-4 bg-gradient-to-r from-bg-tertiary to-bg-secondary/40 border-border-active flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-text-primary text-sm">¿Tienes tus predicciones listas?</h4>
                <p className="text-xs text-text-secondary mt-0.5">
                  Los partidos se bloquean automáticamente en el momento del pitazo inicial.
                </p>
              </div>
              <Link href="/pronosticos" className="btn-gold whitespace-nowrap self-start md:self-auto text-sm py-2 px-4">
                Pronosticar ahora
              </Link>
            </div>
          </div>

          {/* Right Column: Mini Standing Table */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Top Ligas</h3>
              <Link href="/liga" className="text-xs text-gold-400 font-semibold hover:underline flex items-center gap-1">
                Ver ligas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="card-base overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-bg-secondary/40 border-b border-border-subtle font-mono text-[10px] text-text-secondary uppercase font-semibold">
                <span>Jugador</span>
                <span>PTS</span>
              </div>
              <div className="divide-y divide-border-subtle">
                {MOCK_STANDINGS.slice(0, 3).map((s) => {
                  const isYou = s.userId === MOCK_USER.id;
                  return (
                    <div
                      key={s.userId}
                      className={`flex items-center justify-between px-4 py-2.5 transition-all ${
                        isYou ? 'bg-bg-hover/50 text-text-primary font-medium border-l-2 border-gold-400 pl-3.5' : 'text-text-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-muted w-4">#{s.rank}</span>
                        <span className="text-sm truncate max-w-[150px]">{s.displayName}</span>
                        {isYou && (
                          <span className="text-[8px] border border-gold-400/30 text-gold-400 px-1 py-0.2 rounded-full font-mono scale-95">TÚ</span>
                        )}
                      </div>
                      <span className="font-mono text-sm font-bold text-text-primary">{s.points}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
