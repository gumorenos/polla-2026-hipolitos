'use client';

import React, { useState, useMemo } from 'react';
import { Match, Prediction } from '../../types/domain';
import { MatchPredictionCard } from './MatchPredictionCard';
import { CheckSquare, AlertCircle } from 'lucide-react';

interface PronosticosClientProps {
  matches: Match[];
  predictions: Prediction[];
}

type PhaseFilter = 'all' | 'groups' | 'knockout';
type StateFilter = 'all' | 'pending' | 'predicted' | 'locked';

export const PronosticosClient: React.FC<PronosticosClientProps> = ({
  matches,
  predictions,
}) => {
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');

  // Maintain local map of predictions for instant reactive UI updates
  const [localPreds, setLocalPreds] = useState<Record<string, Prediction>>(() => {
    const map: Record<string, Prediction> = {};
    predictions.forEach((p) => {
      map[p.matchId] = p;
    });
    return map;
  });

  const handlePredictionSaved = (savedPred: Prediction) => {
    setLocalPreds((prev) => ({
      ...prev,
      [savedPred.matchId]: savedPred,
    }));
  };

  // Helper to check if match is locked (kickoff passed or status is live/result)
  const isMatchLocked = (match: Match): boolean => {
    const kickoffDate = new Date(match.kickoffUtc);
    return kickoffDate <= new Date() || match.status === 'live' || match.status === 'result';
  };

  // Filter matches based on phase and prediction state
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // 1. Phase Filter
      if (phaseFilter === 'groups' && m.phase !== 'groups') return false;
      if (phaseFilter === 'knockout' && m.phase === 'groups') return false;

      // 2. Prediction State Filter
      const hasPrediction = !!localPreds[m.id];
      const locked = isMatchLocked(m);

      if (stateFilter === 'pending') {
        // Only open matches that do not have predictions
        return !locked && !hasPrediction;
      }
      if (stateFilter === 'predicted') {
        // Only open matches that already have predictions
        return !locked && hasPrediction;
      }
      if (stateFilter === 'locked') {
        // Only locked/live/finished matches
        return locked;
      }

      return true;
    });
  }, [matches, phaseFilter, stateFilter, localPreds]);

  // Statistics
  const stats = useMemo(() => {
    const total = matches.length;
    const predicted = matches.filter((m) => !!localPreds[m.id]).length;
    const percent = total > 0 ? Math.round((predicted / total) * 100) : 0;
    return { total, predicted, percent };
  }, [matches, localPreds]);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-text-primary">PRONÓSTICOS</h2>
          <p className="text-text-secondary text-sm">Pronostica los marcadores. Se bloquean automáticamente al inicio de cada partido.</p>
        </div>

        {/* Live Progress Card */}
        <div className="card-base px-4 py-2 bg-bg-secondary/40 flex items-center gap-3 border border-border-default/60">
          <CheckSquare className="w-5 h-5 text-gold-400" />
          <div className="min-w-[140px]">
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-text-secondary">Pronosticados</span>
              <span className="text-text-primary font-mono">{stats.predicted} de {stats.total}</span>
            </div>
            <div className="w-full bg-border-default h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gold-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Options */}
      <div className="space-y-4">
        {/* Phase Filter Chips */}
        <div className="flex gap-2 border-b border-border-subtle pb-3 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setPhaseFilter('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              phaseFilter === 'all'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Todos los partidos
          </button>
          <button
            type="button"
            onClick={() => setPhaseFilter('groups')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              phaseFilter === 'groups'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Fase de Grupos
          </button>
          <button
            type="button"
            onClick={() => setPhaseFilter('knockout')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border ${
              phaseFilter === 'knockout'
                ? 'bg-gold-400/10 border-gold-400 text-gold-400'
                : 'bg-bg-tertiary border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Eliminatorias
          </button>
        </div>

        {/* State Filter Chips */}
        <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setStateFilter('all')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border ${
              stateFilter === 'all'
                ? 'bg-text-primary text-bg-primary border-text-primary'
                : 'bg-transparent border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setStateFilter('pending')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border ${
              stateFilter === 'pending'
                ? 'bg-text-primary text-bg-primary border-text-primary'
                : 'bg-transparent border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Pendientes
          </button>
          <button
            type="button"
            onClick={() => setStateFilter('predicted')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border ${
              stateFilter === 'predicted'
                ? 'bg-text-primary text-bg-primary border-text-primary'
                : 'bg-transparent border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Pronosticados
          </button>
          <button
            type="button"
            onClick={() => setStateFilter('locked')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border ${
              stateFilter === 'locked'
                ? 'bg-text-primary text-bg-primary border-text-primary'
                : 'bg-transparent border-border-default text-text-secondary hover:text-text-primary'
            }`}
          >
            Cerrados / En Juego
          </button>
        </div>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <div className="card-base p-10 text-center border-dashed border-border-default/60 flex flex-col items-center justify-center">
          <AlertCircle className="w-10 h-10 text-text-muted mb-2" />
          <h3 className="font-bold text-text-primary text-sm">No se encontraron partidos</h3>
          <p className="text-xs text-text-secondary mt-1">Intenta cambiar los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 pb-12">
          {filteredMatches.map((match) => {
            const pred = localPreds[match.id];
            return (
              <MatchPredictionCard
                key={match.id}
                match={match}
                prediction={pred}
                variant="scoreboard"
                onPredictionSaved={handlePredictionSaved}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
