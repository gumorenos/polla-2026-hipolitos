'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { MatchCard } from '../../components/match/MatchCard';
import { MOCK_MATCHES, MOCK_PREDICTIONS } from '../../lib/mockData';
import { Prediction } from '../../types/domain';
import { CheckSquare } from 'lucide-react';

export default function PronosticosPage() {
  const [selectedPhase, setSelectedPhase] = useState<'all' | 'groups' | 'knockout'>('all');
  const [predictions, setPredictions] = useState<Record<string, Prediction>>(MOCK_PREDICTIONS);

  // Filter matches based on selected category
  const filteredMatches = MOCK_MATCHES.filter((m) => {
    if (selectedPhase === 'all') return true;
    if (selectedPhase === 'groups') return m.phase === 'groups';
    if (selectedPhase === 'knockout') return m.phase !== 'groups';
    return true;
  });

  const handleSavePrediction = (matchId: string, home: number, away: number) => {
    const existing = predictions[matchId];
    const updated: Prediction = {
      id: existing?.id ?? `p-new-${matchId}`,
      userId: 'u-1',
      matchId,
      homePrediction: home,
      awayPrediction: away,
      updatedAt: new Date().toISOString(),
    };

    setPredictions({
      ...predictions,
      [matchId]: updated,
    });
  };

  // Stats: predicted vs total matches
  const totalMatches = MOCK_MATCHES.length;
  const predictedCount = MOCK_MATCHES.filter((m) => !!predictions[m.id]).length;
  const progressPercent = totalMatches > 0 ? Math.round((predictedCount / totalMatches) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          <div>
            <h2 className="font-display text-3xl tracking-wide text-text-primary">PRONÓSTICOS</h2>
            <p className="text-text-secondary text-sm">Registra tus marcadores. Se bloquean al inicio del partido.</p>
          </div>

          {/* Progress Widget */}
          <div className="card-base px-4 py-2 bg-bg-secondary/40 flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-gold-400" />
            <div className="min-w-[120px]">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-text-secondary">Pronosticados</span>
                <span className="text-text-primary font-mono">{predictedCount}/{totalMatches}</span>
              </div>
              <div className="w-full bg-border-default h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-gold-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tab Chips */}
        <div className="flex gap-2 border-b border-border-subtle pb-3 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedPhase('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              selectedPhase === 'all'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Todos los Partidos
          </button>
          <button
            type="button"
            onClick={() => setSelectedPhase('groups')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              selectedPhase === 'groups'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Fase de Grupos
          </button>
          <button
            type="button"
            onClick={() => setSelectedPhase('knockout')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              selectedPhase === 'knockout'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Fases Eliminatorias
          </button>
        </div>

        {/* Matches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictions[match.id] ?? null}
              onSavePrediction={(home, away) => handleSavePrediction(match.id, home, away)}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
