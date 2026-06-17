'use client';

import React, { useState, useMemo } from 'react';
import { Match, Prediction } from '../../types/domain';
import { MatchPredictionCard } from './MatchPredictionCard';
import { CheckSquare, AlertCircle, Trophy, Sparkles } from 'lucide-react';
import { saveWinnerPredictionAction } from '../../lib/actions/predictions';
import { submitChampionPick } from '../../lib/actions/champion-survivor';
import { FLAG_MAP } from '../ui/FlagDisc';

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
    competitionType: string;
    isParticipant: boolean;
  }[];
  teams: {
    code: string;
    name: string;
  }[];
  winnerPredictions: {
    leagueId: string;
    teamCode: string;
    createdAt: string;
    correctionAllowed?: boolean;
    correctionAllowedUntil?: string | null;
    correctionReason?: string | null;
  }[];
  winnerPredictionHistories: {
    id: string;
    leagueId: string;
    userId: string;
    userName: string;
    oldTeamCode: string | null;
    newTeamCode: string;
    actionType: string;
    authorizedById: string | null;
    changedById: string | null;
    reason: string | null;
    createdAt: string;
  }[];
  globalOdds: Record<string, {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    homeProb: number;
    drawProb: number;
    awayProb: number;
    bookmaker: string;
    capturedAt: string;
  }>;
  userOdds: Record<string, {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    homeProb: number;
    drawProb: number;
    awayProb: number;
    bookmaker: string;
    capturedAt: string;
  }>;
  h2hData: Record<string, {
    totalMatches: number;
    homeWins: number;
    draws: number;
    awayWins: number;
    homeGoals: number;
    awayGoals: number;
    lastMatches: {
      date: string;
      competition: string;
      homeScore: number;
      awayScore: number;
      homeTeam: string;
      awayTeam: string;
    }[];
  }>;
  canRefreshToday: boolean;
  timeLeftToday: { hours: number; minutes: number };
  manualRefreshEnabled: boolean;
}

type PhaseFilter = 'all' | 'groups' | 'knockout';
type StateFilter = 'all' | 'pending' | 'predicted' | 'locked';

function getActionError(result: unknown): string | null {
  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    typeof (result as { error?: unknown }).error === 'string'
  ) {
    return (result as { error: string }).error;
  }
  return null;
}

export const PronosticosClient: React.FC<PronosticosClientProps> = ({
  matches,
  predictions,
  leagues,
  teams,
  winnerPredictions,
  winnerPredictionHistories,
  globalOdds,
  userOdds,
  h2hData,
  canRefreshToday,
  timeLeftToday,
  manualRefreshEnabled,
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

  const [selectedWinners, setSelectedWinners] = useState<Record<string, string>>(() => {
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

  const handleSelectWinnerChange = (teamCode: string) => {
    setSelectedWinners(prev => ({
      ...prev,
      [activeLeagueId]: teamCode
    }));
    setWinnerError(null);
    setWinnerSuccess(null);
  };

  const handleSaveWinnerSubmit = async () => {
    const teamCode = selectedWinners[activeLeagueId];
    if (!activeLeague?.isParticipant) {
      setWinnerError('Debes estar inscrito como participante para guardar una elección.');
      return;
    }
    if (!teamCode) {
      setWinnerError('Por favor selecciona un país.');
      return;
    }

    const wpRecord = winnerPredictions.find(wp => wp.leagueId === activeLeagueId);
    const isCorrectionActive = !!(wpRecord?.correctionAllowed && wpRecord?.correctionAllowedUntil && new Date(wpRecord.correctionAllowedUntil) > new Date());

    const confirmMsg = isCorrectionActive
      ? '¿Confirmas tu corrección de campeón? Esta elección quedará bloqueada nuevamente.'
      : '¿Confirmas tu campeón? Esta elección quedará bloqueada.';

    const confirmed = window.confirm(confirmMsg);
    if (!confirmed) return;

    setSavingWinner(true);
    setWinnerError(null);
    setWinnerSuccess(null);
    const isChampionSurvivor = activeLeague?.competitionType === 'champion_survivor';
    const res = isChampionSurvivor
      ? await submitChampionPick(activeLeagueId, teamCode)
      : await saveWinnerPredictionAction(activeLeagueId, teamCode);
    const actionError = getActionError(res);
    if (actionError) {
      setWinnerError(actionError);
    } else {
      setWinnerSuccess(isCorrectionActive ? 'Corrección de campeón guardada exitosamente.' : 'Campeón guardado exitosamente.');
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
          <h2 className="font-display text-3xl tracking-wide text-text-primary">
            {activeLeague?.competitionType === 'champion_survivor' ? 'ELIGE TU CAMPEÓN' : 'PRONÓSTICOS'}
          </h2>
          <p className="text-text-secondary text-sm">
            {activeLeague?.competitionType === 'champion_survivor'
              ? 'Selecciona una sola selección campeona para esta competencia.'
              : 'Pronostica los marcadores. Se bloquean automáticamente al inicio de cada partido.'}
          </p>
        </div>

        {/* Live Progress Card */}
        {activeLeague?.competitionType !== 'champion_survivor' && (
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
        )}
      </div>

      {/* Pool Selector (only visible if user has multiple memberships) */}
      {leagues.length > 1 && (
        <div className="flex items-center gap-2.5 bg-surface/50 border border-border/80 p-3 rounded-xl w-fit">
          <label className="text-[10px] font-mono uppercase text-text-secondary font-bold">Competencia activa:</label>
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
      {activeLeague && (() => {
        const wpRecord = winnerPredictions.find(wp => wp.leagueId === activeLeagueId);
        const isCorrectionActive = !!(wpRecord?.correctionAllowed && wpRecord?.correctionAllowedUntil && new Date(wpRecord.correctionAllowedUntil) > new Date());

        const hasSubmitted = !!localWinners[activeLeagueId];
        const submittedAtRaw = wpRecord?.createdAt || null;
        const submittedAtStr = submittedAtRaw 
          ? new Date(submittedAtRaw).toLocaleString('es-PE', { timeZone: 'America/Lima' }) + ' (Hora Lima)'
          : '';

        const code = localWinners[activeLeagueId];
        const teamObj = teams.find(t => t.code === code);
        const selectedTeamName = teamObj ? teamObj.name : (code || '');
        const selectedTeamFlag = code ? (FLAG_MAP[code.toUpperCase()] || '') : '';

        const selectedCode = selectedWinners[activeLeagueId] || '';

        let effectiveDeadline = activeLeague.championDeadline ? new Date(activeLeague.championDeadline) : null;
        if (!effectiveDeadline) {
          const r32Matches = matches.filter(m => m.phase === 'r32');
          if (r32Matches.length > 0) {
            const times = r32Matches.map(m => new Date(m.kickoffUtc).getTime());
            effectiveDeadline = new Date(Math.min(...times));
          }
        }
        const isDeadlinePassed = effectiveDeadline ? new Date() > effectiveDeadline : false;
        const canEdit = activeLeague.isParticipant && ((!hasSubmitted && !isDeadlinePassed) || isCorrectionActive);

        return (
          <div className="card-base p-5 bg-gradient-to-r from-bg-tertiary to-bg-secondary/40 border-border-active space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                  {activeLeague.competitionType === 'champion_survivor' ? 'Solo campeón' : 'Predicción principal'}
                </span>
                <h3 className="font-display text-lg tracking-wide uppercase text-gold-400 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-gold-400" /> {activeLeague.competitionType === 'champion_survivor' ? 'Elige tu campeón' : 'Campeón del Mundial'}
                </h3>
              </div>
              {isCorrectionActive ? (
                <span className="text-[10px] font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2.5 py-0.5 rounded-full uppercase font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Corrección Autorizada
                </span>
              ) : hasSubmitted ? (
                <span className="text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full uppercase font-bold">
                  Predicción bloqueada
                </span>
              ) : isDeadlinePassed ? (
                <span className="text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full uppercase font-bold">
                  Plazo Cerrado
                </span>
              ) : (
                <span className="text-[10px] font-mono bg-green-500/10 text-green-400 border border-green-500/30 px-2.5 py-0.5 rounded-full uppercase font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Abierto
                </span>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <p className="text-xs text-text-secondary">
                  {activeLeague.competitionType === 'champion_survivor'
                    ? 'Elige la selección nacional que se coronará campeona del mundo. En esta competencia no hay pronósticos de partidos.'
                    : <>Elige la selección nacional que se coronará campeona del mundo. Te otorgará <strong className="text-gold-400">{activeLeague.championPoints} puntos</strong> adicionales en la clasificación final de esta competencia si aciertas.</>}
                </p>
                {isCorrectionActive && wpRecord && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs space-y-1 text-yellow-400">
                    <p className="font-semibold uppercase tracking-wider text-[9px] font-mono">Corrección Autorizada por Administrador:</p>
                    <p className="italic">Motivo: &quot;{wpRecord.correctionReason}&quot;</p>
                    {wpRecord.correctionAllowedUntil && (
                      <p className="text-[10px] text-yellow-500/70 font-mono">
                        Vence: {new Date(wpRecord.correctionAllowedUntil).toLocaleString('es-PE', { timeZone: 'America/Lima' })} (Hora Lima)
                      </p>
                    )}
                  </div>
                )}
                {!hasSubmitted && !isDeadlinePassed && (
                  <p className="text-xs text-yellow-400 font-semibold">
                    Elige con cuidado. Una vez guardado, no podrás cambiar tu campeón.
                  </p>
                )}
                {!activeLeague.isParticipant && (
                  <p className="text-xs text-yellow-400 font-semibold">
                    Estás administrando esta competencia, pero no estás inscrito como participante.
                  </p>
                )}
                {effectiveDeadline && (
                  <p className="text-[10px] text-text-muted font-mono">
                    Límite de envío original: {effectiveDeadline.toLocaleString('es-PE', { timeZone: 'America/Lima' })} (Hora Lima)
                  </p>
                )}
                {hasSubmitted && submittedAtStr && (
                  <p className="text-[10px] text-text-muted font-mono">
                    Enviado el: {submittedAtStr}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                {canEdit ? (
                  <>
                    <select
                      disabled={savingWinner}
                      value={selectedCode}
                      onChange={(e) => handleSelectWinnerChange(e.target.value)}
                      className="field py-1.5 px-3 text-xs bg-bg-secondary text-text-primary border border-border-default rounded-lg w-full md:w-56 disabled:opacity-75 font-sans"
                    >
                      <option value="">-- Elige Campeón --</option>
                      {realTeams.map(t => {
                        const flag = FLAG_MAP[t.code.toUpperCase()] || '';
                        return (
                          <option key={t.code} value={t.code}>
                            {flag} {t.name} ({t.code})
                          </option>
                        );
                      })}
                    </select>

                    {selectedCode && (
                      <button
                        type="button"
                        onClick={handleSaveWinnerSubmit}
                        disabled={savingWinner}
                        className="btn-gold py-1.5 px-4 text-xs uppercase font-mono tracking-wider font-semibold whitespace-nowrap"
                      >
                        {isCorrectionActive ? 'Guardar corrección' : 'Guardar campeón'}
                      </button>
                    )}
                  </>
                ) : (
                  // Locked representation (Do not show an active dropdown)
                  <div className="flex items-center gap-2 bg-bg-secondary/60 border border-border-default px-4 py-2 rounded-lg text-xs font-mono">
                    <span className="text-text-secondary">Selección:</span>
                    {hasSubmitted ? (
                      <strong className="text-gold-400 font-bold uppercase">
                        {selectedTeamFlag} {selectedTeamName} ({code})
                      </strong>
                    ) : (
                      <strong className="text-red-400">Sin predicción</strong>
                    )}
                  </div>
                )}

                {savingWinner && (
                  <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin flex-shrink-0 self-center" />
                )}
              </div>
            </div>

            {hasSubmitted && !isCorrectionActive && (
              <p className="text-xs text-green-400 font-semibold mt-1">
                Predicción registrada: <strong className="text-gold-400 uppercase">{selectedTeamFlag} {selectedTeamName}</strong>. Predicción bloqueada.
              </p>
            )}
            {!hasSubmitted && isDeadlinePassed && (
              <p className="text-xs text-red-400 font-semibold mt-1">
                El plazo para elegir campeón ya cerró.
              </p>
            )}

            {winnerError && <p className="text-xs text-red-400 font-semibold mt-1">{winnerError}</p>}
            {winnerSuccess && <p className="text-xs text-green-400 font-semibold mt-1">{winnerSuccess}</p>}

            {/* Winner Prediction History Log */}
            {(() => {
              const historiesForLeague = winnerPredictionHistories.filter(h => h.leagueId === activeLeagueId);
              if (historiesForLeague.length === 0) return null;

              return (
                <div className="mt-4 pt-3 border-t border-border-subtle/50 space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-gold-400/90 font-bold flex items-center gap-1.5">
                    Historial de Cambios de Campeón
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {historiesForLeague.map((h) => {
                      const dateStr = new Date(h.createdAt).toLocaleString('es-PE', {
                        timeZone: 'America/Lima',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      
                      const oldTeamFlag = h.oldTeamCode ? (FLAG_MAP[h.oldTeamCode.toUpperCase()] || '') : '';
                      const oldTeamName = h.oldTeamCode ? (teams.find(t => t.code === h.oldTeamCode)?.name || h.oldTeamCode) : '';
                      const newTeamFlag = FLAG_MAP[h.newTeamCode.toUpperCase()] || '';
                      const newTeamName = teams.find(t => t.code === h.newTeamCode)?.name || h.newTeamCode;

                      let detailsText = '';
                      if (h.actionType === 'created') {
                        detailsText = `Eligió a ${newTeamFlag} ${newTeamName} como campeón`;
                      } else if (h.actionType === 'correction_authorized') {
                        detailsText = `Se autorizó corrección. Motivo: "${h.reason}"`;
                      } else if (h.actionType === 'changed_by_user') {
                        detailsText = `Corrigió su elección de ${oldTeamFlag ? `${oldTeamFlag} ${oldTeamName}` : 'sin elección'} a ${newTeamFlag} ${newTeamName}`;
                      } else if (h.actionType === 'changed_by_admin') {
                        detailsText = `Superadmin corrigió la elección de ${oldTeamFlag ? `${oldTeamFlag} ${oldTeamName}` : 'sin elección'} a ${newTeamFlag} ${newTeamName}. Motivo: "${h.reason}"`;
                      }

                      return (
                        <div key={h.id} className="text-[10px] font-mono bg-bg-secondary/30 p-2 rounded border border-border-default/40 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="text-text-secondary">
                            <strong className="text-text-primary">{h.userName}</strong>:{' '}
                            <span>{detailsText}</span>
                          </div>
                          <span className="text-text-muted text-[9px] whitespace-nowrap self-end sm:self-center">{dateStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}


      {activeLeague?.competitionType === 'champion_survivor' ? null : (
      <>
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
            const gOdds = globalOdds[match.id] || null;
            const uOdds = userOdds[match.id] || null;
            const h2h = h2hData[match.id] || null;
            return (
              <MatchPredictionCard
                key={match.id}
                match={match}
                prediction={pred}
                variant="scoreboard"
                onPredictionSaved={handlePredictionSaved}
                leagueId={activeLeagueId}
                showOdds={activeLeague?.showOdds}
                globalOdds={gOdds}
                userOdds={uOdds}
                h2h={h2h}
                canRefreshOddsToday={canRefreshToday}
                timeLeftUntilMidnight={timeLeftToday}
                manualRefreshEnabled={manualRefreshEnabled}
              />
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
};
