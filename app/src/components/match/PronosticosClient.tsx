'use client';

import React, { useState, useMemo } from 'react';
import { Match, Prediction } from '../../types/domain';
import { MatchPredictionCard } from './MatchPredictionCard';
import { CheckSquare, AlertCircle, Trophy, Sparkles } from 'lucide-react';
import { saveWinnerPredictionAction } from '../../lib/actions/predictions';

interface PronosticosClientProps {
  matches: Match[];
  predictions: (Prediction & { leagueId: string })[];
  leagues: {
    id: string;
    name: string;
    slug: string;
    isDefault: boolean;
    championDeadline: string | null;
    championPoints: number;
    showOdds: boolean;
  }[];
  teams: {
    code: string;
    name: string;
  }[];
  winnerPredictions: {
    leagueId: string;
    teamCode: string;
  }[];
  oddsSnapshots: Record<string, {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    homeProbability: number;
    drawProbability: number;
    awayProbability: number;
  }>;
}

type PhaseFilter = 'all' | 'groups' | 'knockout';
type StateFilter = 'all' | 'pending' | 'predicted' | 'locked';

export const PronosticosClient: React.FC<PronosticosClientProps> = ({
  matches,
  predictions,
  leagues,
  teams,
  winnerPredictions,
  oddsSnapshots,
}) => {
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');

  const [activeLeagueId, setActiveLeagueId] = useState<string>(() => {
    const def = leagues.find(l => l.isDefault);
    return def ? def.id : (leagues[0]?.id || '');
  });

  // Maintain local map of predictions per league for instant reactive UI updates
  const [localPreds, setLocalPreds] = useState<Record<string, Record<string, Prediction>>>(() => {
    const map: Record<string, Record<string, Prediction>> = {};
    predictions.forEach((p) => {
      if (!map[p.leagueId]) map[p.leagueId] = {};
      map[p.leagueId][p.matchId] = p;
    });
    return map;
  });

  const [localWinners, setLocalWinners] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    winnerPredictions.forEach((wp) => {
      map[wp.leagueId] = wp.teamCode;
    });
    return map;
  });

  const [savingWinner, setSavingWinner] = useState(false);
  const [winnerError, setWinnerError] = useState<string | null>(null);
  const [winnerSuccess, setWinnerSuccess] = useState<string | null>(null);

  const activePreds = useMemo(() => {
    return localPreds[activeLeagueId] || {};
  }, [localPreds, activeLeagueId]);

  const activeLeague = useMemo(() => {
    return leagues.find(l => l.id === activeLeagueId);
  }, [leagues, activeLeagueId]);

  const isWinnerLocked = useMemo(() => {
    if (!activeLeague?.championDeadline) return false;
    return new Date(activeLeague.championDeadline) <= new Date();
  }, [activeLeague]);

  const realTeams = useMemo(() => {
    return teams.filter(t => t.code.length === 3 && !/^\d/.test(t.code) && !/^[WR]/.test(t.code));
  }, [teams]);

  const handlePredictionSaved = (savedPred: Prediction) => {
    setLocalPreds((prev) => ({
      ...prev,
      [activeLeagueId]: {
        ...(prev[activeLeagueId] || {}),
        [savedPred.matchId]: savedPred,
      }
    }));
  };

  const handleSaveWinner = async (teamCode: string) => {
    setSavingWinner(true);
    setWinnerError(null);
    setWinnerSuccess(null);
    const res = await saveWinnerPredictionAction(activeLeagueId, teamCode);
    if (res.error) {
      setWinnerError(res.error);
    } else {
      setWinnerSuccess('Campeón guardado exitosamente.');
      setLocalWinners(prev => ({
        ...prev,
        [activeLeagueId]: teamCode
      }));
    }
    setSavingWinner(false);
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
      const hasPrediction = !!activePreds[m.id];
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
  }, [matches, phaseFilter, stateFilter, activePreds]);

  // Statistics
  const stats = useMemo(() => {
    const total = matches.length;
    const predicted = matches.filter((m) => !!activePreds[m.id]).length;
    const percent = total > 0 ? Math.round((predicted / total) * 100) : 0;
    return { total, predicted, percent };
  }, [matches, activePreds]);

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

      {/* Pool Selector (only visible if user has multiple memberships) */}
      {leagues.length > 1 && (
        <div className="flex items-center gap-2.5 bg-surface/50 border border-border/80 p-3 rounded-xl w-fit">
          <label className="text-[10px] font-mono uppercase text-text-secondary font-bold">Polla Activa:</label>
          <select
            value={activeLeagueId}
            onChange={(e) => {
              setActiveLeagueId(e.target.value);
              setWinnerError(null);
              setWinnerSuccess(null);
            }}
            className="field py-1 px-3 text-xs bg-bg-secondary text-text-primary border border-border-default rounded-lg w-fit font-semibold"
          >
            {leagues.map(l => (
              <option key={l.id} value={l.id}>{l.name} {l.isDefault ? '(Principal)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tournament Winner Prediction Widget */}
      {activeLeague && (
        <div className="card-base p-5 bg-gradient-to-r from-bg-tertiary to-bg-secondary/40 border-border-active space-y-4">
          <div className="flex justify-between items-center border-b border-border-subtle pb-2">
            <h3 className="font-display text-lg tracking-wide uppercase text-gold-400 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold-400" /> Campeón de la Copa Mundial 2026
            </h3>
            {isWinnerLocked ? (
              <span className="text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full uppercase font-bold">
                Bloqueado
              </span>
            ) : (
              <span className="text-[10px] font-mono bg-green-500/10 text-green-400 border border-green-500/30 px-2.5 py-0.5 rounded-full uppercase font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Abierto
              </span>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-text-secondary">
                Elige la selección nacional que se coronará campeona del mundo. Te otorgará <strong className="text-gold-400">{activeLeague.championPoints} puntos</strong> adicionales en la clasificación final de esta polla si aciertas.
              </p>
              {activeLeague.championDeadline && (
                <p className="text-[10px] text-text-muted font-mono">
                  Límite de envío: {new Date(activeLeague.championDeadline).toLocaleString('es-PE', { timeZone: 'America/Lima' })} (Hora Perú)
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                disabled={isWinnerLocked || savingWinner}
                value={localWinners[activeLeagueId] || ''}
                onChange={(e) => handleSaveWinner(e.target.value)}
                className="field py-1.5 px-3 text-xs bg-bg-secondary text-text-primary border border-border-default rounded-lg w-full md:w-56 disabled:opacity-50"
              >
                <option value="">-- Elige Campeón --</option>
                {realTeams.map(t => (
                  <option key={t.code} value={t.code}>{t.name} (@{t.code})</option>
                ))}
              </select>

              {savingWinner && (
                <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
            </div>
          </div>

          {winnerError && <p className="text-xs text-red-400 font-semibold mt-1">{winnerError}</p>}
          {winnerSuccess && <p className="text-xs text-green-400 font-semibold mt-1">{winnerSuccess}</p>}
        </div>
      )}

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
            const pred = activePreds[match.id];
            const odds = oddsSnapshots[match.id] || null;
            return (
              <MatchPredictionCard
                key={match.id}
                match={match}
                prediction={pred}
                variant="scoreboard"
                onPredictionSaved={handlePredictionSaved}
                leagueId={activeLeagueId}
                oddsSnapshot={odds}
                showOdds={activeLeague?.showOdds}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
