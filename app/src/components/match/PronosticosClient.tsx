'use client';

import React, { useState, useMemo } from 'react';
import { Match, Prediction } from '../../types/domain';
import { MatchPredictionCard } from './MatchPredictionCard';
import { CheckSquare, AlertCircle, Trophy, Sparkles } from 'lucide-react';
import { saveWinnerPredictionAction } from '../../lib/actions/predictions';
import { submitChampionPick } from '../../lib/actions/champion-survivor';
import { FLAG_MAP } from '../ui/FlagDisc';
import { formatLeagueCurrency } from '../../lib/utils/currency';
import { calculateIndividualExpectedValue, classifyChampionPick } from '../../lib/champion-survivor';

type OddsInfo = {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homeProb: number;
  drawProb: number;
  awayProb: number;
  bookmaker: string;
  provider?: string;
  capturedAt: string;
};

type H2HInfo = {
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
};

type ChampionInfoByLeague = Record<string, {
  teamStatuses: Record<string, {
    status: string;
    eliminatedAt: string | null;
  }>;
  championOdds: Record<string, {
    decimalOdds: number;
    impliedProbability: number;
    expectedValue: number | null;
    provider: string;
    bookmaker: string;
    capturedAt: string;
  }>;
  summary: {
    totalParticipants: number;
    alive: number;
    eliminated: number;
    pending: number;
    winners: number;
    combinedAliveProbability: number | null;
    combinedAliveProbabilityAvailable: boolean;
    prizePool: {
      amount: number;
      estimated: boolean;
      currency: string;
    };
  };
  distribution: {
    byTeam: {
      teamCode: string;
      count: number;
      percentage: number;
      status: string;
    }[];
    mostPickedTeam: {
      teamCode: string;
      count: number;
      percentage: number;
      status: string;
    } | null;
    exclusivePicks: {
      teamCode: string;
      count: number;
      percentage: number;
      status: string;
    }[];
  };
}>;

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
    showH2H: boolean;
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
  globalOdds: Record<string, OddsInfo>;
  userOdds: Record<string, OddsInfo>;
  h2hData: Record<string, H2HInfo>;
  championInfoByLeague: ChampionInfoByLeague;
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

function isFinishedMatch(match: Match): boolean {
  return (
    match.resultStatus === 'final' ||
    match.status === 'result' ||
    (match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined)
  );
}

function isUpcomingMatch(match: Match): boolean {
  return !isFinishedMatch(match) && new Date(match.kickoffUtc).getTime() > Date.now();
}

function includesTeam(match: Match, teamCode: string): boolean {
  return match.homeTeamCode === teamCode || match.awayTeamCode === teamCode;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMatchDate(value: Date | string | number): string {
  return new Date(value).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTournamentStatusLabel(status?: string | null): string {
  if (status === 'active') return 'Vivo';
  if (status === 'eliminated') return 'Eliminado';
  if (status === 'champion') return 'Campeón acertado';
  return 'Estado no definido';
}

function getStatusTone(status?: string | null): string {
  if (status === 'champion') return 'border-gold-500/50 bg-gold-400/10 text-gold-400';
  if (status === 'eliminated') return 'border-red-500/30 bg-red-500/10 text-red-400 opacity-70';
  if (status === 'active') return 'border-green-500/30 bg-green-500/10 text-green-400';
  return 'border-border-subtle bg-bg-secondary/30 text-text-secondary';
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
  championInfoByLeague,
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

  const activeChampionInfo = activeLeague ? championInfoByLeague[activeLeague.id] : undefined;


  const realTeams = useMemo(() => {
    return teams.filter(t => t.code.length === 3 && !/^\d/.test(t.code) && !/^[WR]/.test(t.code));
  }, [teams]);

  const recentFinishedMatches = useMemo(() => {
    return matches
      .filter(isFinishedMatch)
      .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())
      .slice(0, 4);
  }, [matches]);

  const upcomingMatches = useMemo(() => {
    return matches
      .filter(isUpcomingMatch)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())
      .slice(0, 4);
  }, [matches]);

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

  const getTeamName = (teamCode: string) => teams.find(t => t.code === teamCode)?.name || teamCode;

  const getMatchOdds = (matchId: string): OddsInfo | null => userOdds[matchId] || globalOdds[matchId] || null;

  const renderMatchOdds = (match: Match) => {
    if (!activeLeague?.showOdds) return null;

    const odds = getMatchOdds(match.id);
    if (!odds) return null;

    return (
      <div className="rounded-lg border border-border-subtle bg-black/10 p-2 text-[10px] font-mono text-text-secondary space-y-1">
        <p className="uppercase tracking-wider text-gold-400 font-bold">Odds del partido</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span>Local: <strong className="text-text-primary">{odds.homeOdds.toFixed(2)}</strong> ({formatPercent(odds.homeProb)})</span>
          <span>Empate: <strong className="text-text-primary">{odds.drawOdds.toFixed(2)}</strong> ({formatPercent(odds.drawProb)})</span>
          <span>Visita: <strong className="text-text-primary">{odds.awayOdds.toFixed(2)}</strong> ({formatPercent(odds.awayProb)})</span>
        </div>
        <p className="text-[9px] text-text-muted">Bookmaker: {odds.bookmaker}</p>
      </div>
    );
  };

  const renderH2HInfo = (match: Match) => {
    if (!activeLeague?.showH2H) return null;

    const h2h = h2hData[match.id];
    if (!h2h) return null;

    return (
      <div className="rounded-lg border border-border-subtle bg-black/10 p-2 text-[10px] font-mono text-text-secondary space-y-1">
        <p className="uppercase tracking-wider text-gold-400 font-bold">Historial H2H</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span>Partidos: <strong className="text-text-primary">{h2h.totalMatches}</strong></span>
          <span>{match.homeTeamCode}: <strong className="text-text-primary">{h2h.homeWins}</strong></span>
          <span>Empates: <strong className="text-text-primary">{h2h.draws}</strong></span>
          <span>{match.awayTeamCode}: <strong className="text-text-primary">{h2h.awayWins}</strong></span>
        </div>
      </div>
    );
  };

  const renderCompactMatch = (match: Match, options?: { showContext?: boolean }) => (
    <div key={match.id} className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            {getTeamName(match.homeTeamCode)} <span className="text-text-muted">vs</span> {getTeamName(match.awayTeamCode)}
          </p>
          <p className="text-[10px] text-text-muted font-mono">
            {match.phase.toUpperCase()} · {match.jornada} · {formatMatchDate(match.kickoffUtc)} (Hora Lima)
          </p>
          {options?.showContext && (
            <p className="text-[10px] text-text-secondary">{match.venue} · {match.city}</p>
          )}
        </div>
        {isFinishedMatch(match) ? (
          <span className="font-mono text-sm font-bold text-gold-400 whitespace-nowrap">
            {match.homeScore ?? '-'} - {match.awayScore ?? '-'}
          </span>
        ) : (
          <span className="text-[9px] font-mono uppercase text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
            Próximo
          </span>
        )}
      </div>
      {!isFinishedMatch(match) && renderMatchOdds(match)}
      {!isFinishedMatch(match) && renderH2HInfo(match)}
    </div>
  );

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
                        {isCorrectionActive
                          ? 'Guardar corrección'
                          : activeLeague.competitionType === 'champion_survivor'
                            ? 'Guardar selección'
                            : 'Guardar campeón'}
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

      {activeLeague?.competitionType === 'champion_survivor' && (() => {
        const consideredTeamCode = selectedWinners[activeLeagueId] || localWinners[activeLeagueId] || '';
        const consideredTeam = consideredTeamCode ? teams.find(t => t.code === consideredTeamCode) : null;
        const consideredTeamName = consideredTeam?.name || consideredTeamCode;
        const consideredTeamFlag = consideredTeamCode ? (FLAG_MAP[consideredTeamCode.toUpperCase()] || '') : '';
        const teamStatus = consideredTeamCode ? activeChampionInfo?.teamStatuses[consideredTeamCode] : undefined;
        const championOdds = consideredTeamCode ? activeChampionInfo?.championOdds[consideredTeamCode] : undefined;
        const distribution = activeChampionInfo?.distribution;
        const selectedDistributionItem = consideredTeamCode
          ? distribution?.byTeam.find(item => item.teamCode === consideredTeamCode) || null
          : null;
        const selectedPopularityRank = selectedDistributionItem && distribution
          ? distribution.byTeam.findIndex(item => item.teamCode === selectedDistributionItem.teamCode) + 1
          : null;
        const selectedSamePickCount = selectedDistributionItem?.count ?? 0;
        const selectedPickPercentage = selectedDistributionItem?.percentage ?? 0;
        const selectedIndividualEv = activeLeague.showOdds && championOdds && activeChampionInfo
          ? calculateIndividualExpectedValue(
              activeChampionInfo.summary.prizePool.amount,
              championOdds.impliedProbability,
              selectedSamePickCount
            )
          : null;
        const selectedClassification = activeLeague.showOdds && selectedDistributionItem
          ? classifyChampionPick({
              probability: championOdds?.impliedProbability ?? null,
              pickCount: selectedDistributionItem.count,
              pickPercentage: selectedDistributionItem.percentage,
              popularityRank: selectedPopularityRank,
              isExclusive: selectedDistributionItem.count === 1,
            })
          : null;
        const topPopularPicks = distribution?.byTeam.slice(0, 3) ?? [];
        const topDifferentialPicks = activeLeague.showOdds && distribution
          ? distribution.byTeam
              .map((item, index) => {
                const odds = activeChampionInfo?.championOdds[item.teamCode];
                return {
                  ...item,
                  probability: odds?.impliedProbability ?? null,
                  classification: classifyChampionPick({
                    probability: odds?.impliedProbability ?? null,
                    pickCount: item.count,
                    pickPercentage: item.percentage,
                    popularityRank: index + 1,
                    isExclusive: item.count === 1,
                  }),
                };
              })
              .filter(item => item.classification.key === 'attractive_differential')
              .slice(0, 3)
          : [];
        const teamUpcomingMatch = consideredTeamCode
          ? matches
              .filter(match => isUpcomingMatch(match) && includesTeam(match, consideredTeamCode))
              .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())[0]
          : null;
        const teamRecentResult = consideredTeamCode
          ? matches
              .filter(match => isFinishedMatch(match) && includesTeam(match, consideredTeamCode))
              .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())[0]
          : null;
        const summary = activeChampionInfo?.summary;

        return (
          <>
            <section className="card-base p-5 space-y-4">
              <div>
                <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Mi pick vs mercado</h3>
                <p className="text-xs text-text-secondary">Comparación de tu selección contra el mercado de campeón, sin usar odds de partidos.</p>
              </div>

              {!consideredTeamCode ? (
                <p className="text-sm text-text-secondary">Selecciona un equipo para comparar tu elección con el mercado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[10px] font-mono uppercase text-text-muted">Selección</p>
                    <p className="text-lg font-bold text-text-primary">{consideredTeamFlag} {consideredTeamName}</p>
                    <p className="text-[10px] font-mono text-text-muted">{consideredTeamCode}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[10px] font-mono uppercase text-text-muted">Estado</p>
                    <p className="text-lg font-bold text-gold-400">{getTournamentStatusLabel(teamStatus?.status)}</p>
                  </div>
                  {!activeLeague.showOdds ? (
                    <div className="md:col-span-2 rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                      <p className="text-xs text-text-muted italic">Las ayudas de mercado están desactivadas para esta competencia.</p>
                    </div>
                  ) : championOdds ? (
                    <>
                      <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                        <p className="text-[10px] font-mono uppercase text-text-muted">Probabilidad mercado campeón</p>
                        <p className="text-lg font-bold text-gold-400">{formatPercent(championOdds.impliedProbability)}</p>
                        <p className="text-[10px] font-mono text-text-secondary">Cuota decimal: {championOdds.decimalOdds.toFixed(2)}</p>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                        <p className="text-[10px] font-mono uppercase text-text-muted">Valor esperado estimado</p>
                        <p className="text-lg font-bold text-text-primary">
                          {championOdds.expectedValue !== null && summary
                            ? formatLeagueCurrency(championOdds.expectedValue, summary.prizePool.currency)
                            : 'No disponible'}
                        </p>
                        <p className="text-[9px] font-mono text-text-muted">
                          {championOdds.provider} · {championOdds.bookmaker} · {formatMatchDate(championOdds.capturedAt)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2 rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                      <p className="text-xs text-text-muted italic">Probabilidad de campeonar no disponible.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="card-base p-5 space-y-4">
              <div>
                <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Riesgo social</h3>
                <p className="text-xs text-text-secondary">Cuántos participantes comparten tu pick y cómo eso divide el valor esperado.</p>
              </div>

              {!consideredTeamCode ? (
                <p className="text-sm text-text-secondary">Selecciona un equipo para ver el riesgo social de ese pick.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[10px] font-mono uppercase text-text-muted">Participantes con el mismo pick</p>
                    <p className="text-lg font-bold text-text-primary">{selectedSamePickCount}</p>
                    <p className="text-[10px] font-mono text-text-secondary">{formatPercent(selectedPickPercentage)} del total</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[10px] font-mono uppercase text-text-muted">Pick exclusivo</p>
                    <p className="text-lg font-bold text-gold-400">{selectedSamePickCount === 1 ? 'Sí' : 'No'}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[10px] font-mono uppercase text-text-muted">Valor esperado individual estimado</p>
                    <p className="text-lg font-bold text-text-primary">
                      {activeLeague.showOdds && selectedIndividualEv !== null && summary
                        ? formatLeagueCurrency(selectedIndividualEv, summary.prizePool.currency)
                        : 'No disponible'}
                    </p>
                    <p className="text-[9px] text-text-muted">Estimación, no pago garantizado.</p>
                  </div>
                </div>
              )}
            </section>

            <section className="card-base p-5 space-y-4">
              <div>
                <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Pick popular vs pick diferencial</h3>
                <p className="text-xs text-text-secondary">Clasificación simple por probabilidad de mercado y concentración de picks.</p>
              </div>

              {!activeLeague.showOdds && (
                <p className="text-[10px] text-text-muted italic">Las ayudas de mercado están desactivadas para esta competencia.</p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                  <p className="text-[10px] font-mono uppercase text-text-muted">Tu clasificación</p>
                  {!consideredTeamCode ? (
                    <p className="text-sm text-text-secondary mt-1">Selecciona un equipo para clasificar tu pick.</p>
                  ) : activeLeague.showOdds && selectedClassification ? (
                    <>
                      <p className="text-lg font-bold text-gold-400">{selectedClassification.label}</p>
                      <p className="text-[10px] text-text-secondary">{selectedSamePickCount} pick(s) · {formatPercent(selectedPickPercentage)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-text-secondary mt-1">{selectedSamePickCount} pick(s) · {formatPercent(selectedPickPercentage)}</p>
                  )}
                </div>

                <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3 space-y-2">
                  <p className="text-[10px] font-mono uppercase text-text-muted">Top 3 populares</p>
                  {topPopularPicks.length > 0 ? topPopularPicks.map((item, index) => (
                    <div key={item.teamCode} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-text-primary">{index + 1}. {FLAG_MAP[item.teamCode] || ''} {getTeamName(item.teamCode)}</span>
                      <span className="font-mono text-text-secondary">{item.count} · {formatPercent(item.percentage)}</span>
                    </div>
                  )) : (
                    <p className="text-xs text-text-secondary">Todavía no hay picks registrados.</p>
                  )}
                </div>

                <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3 space-y-2">
                  <p className="text-[10px] font-mono uppercase text-text-muted">Top 3 diferenciales</p>
                  {activeLeague.showOdds ? (
                    topDifferentialPicks.length > 0 ? topDifferentialPicks.map((item) => (
                      <div key={item.teamCode} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-text-primary">{FLAG_MAP[item.teamCode] || ''} {getTeamName(item.teamCode)}</span>
                        <span className="font-mono text-text-secondary">{item.count} · {item.probability !== null ? formatPercent(item.probability) : 'S/P'}</span>
                      </div>
                    )) : (
                      <p className="text-xs text-text-secondary">No hay diferenciales atractivos con datos de mercado suficientes.</p>
                    )
                  ) : (
                    <p className="text-xs text-text-secondary">Clasificación de mercado oculta.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="card-base p-5 space-y-4">
              <div>
                <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Mapa de supervivencia</h3>
                <p className="text-xs text-text-secondary">Resumen agregado de picks y estado de supervivencia por selección.</p>
              </div>

              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Total participantes</p>
                    <p className="text-lg font-bold text-text-primary">{summary.totalParticipants}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Vivos</p>
                    <p className="text-lg font-bold text-green-400">{summary.alive}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Eliminados</p>
                    <p className="text-lg font-bold text-red-400">{summary.eliminated}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Sin selección</p>
                    <p className="text-lg font-bold text-text-primary">{summary.pending}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Ganadores</p>
                    <p className="text-lg font-bold text-gold-400">{summary.winners}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Pozo estimado</p>
                    <p className="text-lg font-bold text-text-primary">{formatLeagueCurrency(summary.prizePool.amount, summary.prizePool.currency)}</p>
                  </div>
                  {activeLeague.showOdds && (
                    <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                      <p className="text-[9px] font-mono uppercase text-text-muted">Prob. vivos</p>
                      <p className="text-lg font-bold text-gold-400">
                        {summary.combinedAliveProbabilityAvailable && summary.combinedAliveProbability !== null
                          ? formatPercent(summary.combinedAliveProbability)
                          : 'No disponible'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {distribution && distribution.byTeam.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-gold-400 font-bold">Distribución por selección</h4>
                    <div className="space-y-2">
                      {distribution.byTeam.map(item => (
                        <div key={item.teamCode} className={`rounded-xl border p-3 ${getStatusTone(item.status)}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-bold">{FLAG_MAP[item.teamCode] || ''} {getTeamName(item.teamCode)}</span>
                            <span className="font-mono text-xs">{item.count} · {formatPercent(item.percentage)}</span>
                          </div>
                          <p className="text-[10px] font-mono mt-1">{getTournamentStatusLabel(item.status)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-gold-400 font-bold">Picks exclusivos</h4>
                    {distribution.exclusivePicks.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {distribution.exclusivePicks.map(item => (
                          <span key={item.teamCode} className={`text-xs font-mono px-2 py-1 rounded-full border ${getStatusTone(item.status)}`}>
                            {FLAG_MAP[item.teamCode] || ''} {getTeamName(item.teamCode)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-text-secondary">No hay picks exclusivos por ahora.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3 text-xs text-text-secondary">
                  Todavía no hay picks registrados.
                </p>
              )}
            </section>

            <section className="card-base p-5 space-y-4">
              <div>
                <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Información de tu campeón</h3>
                <p className="text-xs text-text-secondary">Datos de solo lectura para evaluar tu selección antes o después de guardarla.</p>
              </div>

              {!consideredTeamCode ? (
                <p className="text-sm text-text-secondary">
                  Selecciona un equipo para ver información útil antes de guardar tu elección.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                      <p className="text-[10px] font-mono uppercase text-text-muted">Selección</p>
                      <p className="text-lg font-bold text-text-primary">
                        {consideredTeamFlag} {consideredTeamName} <span className="text-text-muted font-mono text-sm">({consideredTeamCode})</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                      <p className="text-[10px] font-mono uppercase text-text-muted">Estado en torneo</p>
                      <p className="text-lg font-bold text-gold-400">{getTournamentStatusLabel(teamStatus?.status)}</p>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                      <p className="text-[10px] font-mono uppercase text-text-muted">Probabilidad de mercado de campeón</p>
                      {!activeLeague.showOdds ? (
                        <p className="text-xs text-text-muted italic">Las ayudas de mercado están desactivadas para esta competencia.</p>
                      ) : championOdds ? (
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-gold-400">{formatPercent(championOdds.impliedProbability)}</p>
                          <p className="text-[10px] text-text-secondary font-mono">Cuota outright: {championOdds.decimalOdds.toFixed(2)}</p>
                          {championOdds.expectedValue !== null && summary && (
                            <p className="text-[10px] text-text-secondary font-mono">
                              Valor esperado estimado: {formatLeagueCurrency(championOdds.expectedValue, summary.prizePool.currency)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted italic">Probabilidad de campeonar no disponible.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-gold-400 font-bold">Próximo partido de la selección</h4>
                      {teamUpcomingMatch ? (
                        renderCompactMatch(teamUpcomingMatch, { showContext: true })
                      ) : (
                        <p className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3 text-xs text-text-secondary">
                          No hay próximos partidos disponibles para esta selección.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-gold-400 font-bold">Resultado reciente de la selección</h4>
                      {teamRecentResult ? (
                        renderCompactMatch(teamRecentResult, { showContext: true })
                      ) : (
                        <p className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3 text-xs text-text-secondary">
                          Todavía no hay resultados recientes para esta selección.
                        </p>
                      )}
                    </div>
                  </div>

                  {!activeLeague.showOdds && (
                    <p className="text-[10px] text-text-muted italic">Las ayudas de mercado están desactivadas para esta competencia.</p>
                  )}
                  {!activeLeague.showH2H && (
                    <p className="text-[10px] text-text-muted italic">El historial H2H está desactivado para esta competencia.</p>
                  )}
                </div>
              )}
            </section>

            <section className="card-base p-5 space-y-4">
              <div>
                <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Información de la competencia</h3>
                <p className="text-xs text-text-secondary">Contexto general de solo lectura para Champion Survivor.</p>
              </div>

              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Participantes</p>
                    <p className="text-lg font-bold text-text-primary">{summary.totalParticipants}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Vivos</p>
                    <p className="text-lg font-bold text-green-400">{summary.alive}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Eliminados</p>
                    <p className="text-lg font-bold text-red-400">{summary.eliminated}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Sin selección</p>
                    <p className="text-lg font-bold text-text-primary">{summary.pending}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Ganadores</p>
                    <p className="text-lg font-bold text-gold-400">{summary.winners}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                    <p className="text-[9px] font-mono uppercase text-text-muted">Pozo estimado</p>
                    <p className="text-lg font-bold text-text-primary">
                      {formatLeagueCurrency(summary.prizePool.amount, summary.prizePool.currency)}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-gold-400 font-bold">Resultados recientes</h4>
                  {recentFinishedMatches.length > 0 ? (
                    <div className="space-y-2">
                      {recentFinishedMatches.map(match => renderCompactMatch(match))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3 text-xs text-text-secondary">
                      Todavía no hay resultados recientes.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-gold-400 font-bold">Próximos partidos</h4>
                  {upcomingMatches.length > 0 ? (
                    <div className="space-y-2">
                      {upcomingMatches.map(match => renderCompactMatch(match))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-border-subtle bg-bg-secondary/30 p-3 text-xs text-text-secondary">
                      No hay próximos partidos disponibles.
                    </p>
                  )}
                </div>
              </div>

              {!activeLeague.showOdds && (
                <p className="text-[10px] text-text-muted italic">Las ayudas de mercado están desactivadas para esta competencia.</p>
              )}
              {!activeLeague.showH2H && (
                <p className="text-[10px] text-text-muted italic">El historial H2H está desactivado para esta competencia.</p>
              )}
            </section>
          </>
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
                showH2H={activeLeague?.showH2H}
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
