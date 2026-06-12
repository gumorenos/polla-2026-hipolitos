'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { RankingTable } from '../../components/league/RankingTable';
import { MOCK_STANDINGS, MOCK_USER } from '../../lib/mockData';
import { Trophy, Shield, Sparkles } from 'lucide-react';

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState<'l-1' | 'l-2'>('l-1');

  // Modify mock standings for l-2 to show a variation
  const standingsL2 = MOCK_STANDINGS.map((s, idx) => ({
    ...s,
    leagueId: 'l-2',
    points: Math.max(0, s.points - 3),
    rank: idx === 0 ? 2 : idx === 1 ? 1 : s.rank, // Swap 1 and 2
  })).sort((a, b) => b.points - a.points).map((s, idx) => ({ ...s, rank: idx + 1 }));

  const activeStandings = activeTab === 'l-1' ? MOCK_STANDINGS : standingsL2;
  const currentStand = activeStandings.find(s => s.userId === MOCK_USER.id) ?? activeStandings[0];

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
        <div className="flex gap-2 border-b border-border-subtle pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('l-1')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              activeTab === 'l-1'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Los Hipólitos F.C.
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('l-2')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              activeTab === 'l-2'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Oficina Central
          </button>
        </div>

        {/* League Quick Stats Widget */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-base p-4 flex items-center gap-3">
            <div className="p-2.5 bg-gold-400/10 border border-gold-500 rounded-lg text-gold-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono font-bold">Líder</span>
              <p className="text-sm font-bold text-text-primary mt-0.5">{activeStandings[0].displayName}</p>
            </div>
          </div>

          <div className="card-base p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono font-bold">Tu Puesto</span>
              <p className="text-sm font-bold text-text-primary mt-0.5">#{currentStand.rank} de {activeStandings.length}</p>
            </div>
          </div>

          <div className="card-base p-4 flex items-center gap-3">
            <div className="p-2.5 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase font-mono font-bold">Tu Puntaje</span>
              <p className="text-sm font-bold text-text-primary mt-0.5">{currentStand.points} Puntos</p>
            </div>
          </div>
        </div>

        {/* Standings Table component */}
        <div className="space-y-3">
          <h3 className="font-display text-lg tracking-wide uppercase text-text-primary">Clasificación</h3>
          <RankingTable standings={activeStandings} currentUserId={MOCK_USER.id} />
        </div>
      </div>
    </AppShell>
  );
}
