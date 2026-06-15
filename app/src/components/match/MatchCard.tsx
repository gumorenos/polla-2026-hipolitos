'use client';

import React, { useState } from 'react';
import { Match, Prediction } from '../../types/domain';
import { TEAMS, PHASES } from '../../lib/mockData';
import { fmtDate, fmtTime } from '../../lib/utils/dates';
import { FlagDisc } from '../ui/FlagDisc';
import { Stepper } from '../ui/Stepper';
import { CountdownInline } from '../ui/Countdown';
import { PredictionStatusBadge } from '../ui/PredictionStatusBadge';
import { MatchStatusBadge, MatchVisualState } from '../ui/MatchStatusBadge';
import { Calendar, MapPin, Check, Save, RefreshCw, BarChart2, ShieldAlert, ChevronDown, ChevronUp, History } from 'lucide-react';

interface OddsData {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homeProb: number;
  drawProb: number;
  awayProb: number;
  bookmaker: string;
  provider?: string;
  capturedAt: string;
}

interface H2HData {
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals: number;
  awayGoals: number;
  lastMatches: H2HMeeting[];
}

interface H2HMeeting {
  date: string;
  competition: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
}

interface MatchCardProps {
  match: Match;
  prediction?: Prediction | null;
  mode?: 'predict' | 'display' | 'locked' | 'result';
  variant?: 'scoreboard' | 'solari' | 'ticket';
  onSavePrediction?: (home: number, away: number) => void;
  
  // Odds & H2H features
  showOdds?: boolean;
  globalOdds?: OddsData | null;
  userOdds?: OddsData | null;
  h2h?: H2HData | null;
  canRefreshOddsToday?: boolean;
  timeLeftUntilMidnight?: { hours: number; minutes: number } | null;
  onRefreshUserOdds?: () => Promise<void>;
  refreshingOdds?: boolean;
  manualRefreshEnabled?: boolean;
}

const Flap: React.FC<{ char: string | number }> = ({ char }) => (
  <span className="relative inline-flex items-center justify-center w-7 h-10 rounded-md bg-gradient-to-b from-[#15151e] to-[#0d0d14] border border-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] font-mono text-xl font-bold text-gold-400 overflow-hidden">
    {char}
    <span className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/70 shadow-[0_1px_0_rgba(255,255,255,0.03)]" />
  </span>
);

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  prediction,
  mode,
  variant = 'scoreboard',
  onSavePrediction,
  showOdds = true,
  globalOdds,
  userOdds,
  h2h,
  canRefreshOddsToday = true,
  timeLeftUntilMidnight,
  onRefreshUserOdds,
  refreshingOdds = false,
  manualRefreshEnabled = false,
}) => {
  const cardMode = mode ?? (
    match.status === 'result' ? 'result' :
    match.status === 'live' || new Date(match.kickoffUtc) <= new Date() ? 'locked' :
    'predict'
  );

  // Home and Away local state for predictions
  const [homePred, setHomePred] = useState<number | null>(
    prediction ? prediction.homePrediction : null
  );
  const [awayPred, setAwayPred] = useState<number | null>(
    prediction ? prediction.awayPrediction : null
  );
  const [isSaved, setIsSaved] = useState<boolean>(!!prediction);
  const [showH2HPanel, setShowH2HPanel] = useState<boolean>(false);
  const [oddsTab, setOddsTab] = useState<'global' | 'user'>(userOdds ? 'user' : 'global');
  const [confirmRefresh, setConfirmRefresh] = useState<boolean>(false);

  // Sync state if prediction prop changes (during render)
  const [prevPrediction, setPrevPrediction] = useState(prediction);
  if (prediction !== prevPrediction) {
    setPrevPrediction(prediction);
    setHomePred(prediction ? prediction.homePrediction : null);
    setAwayPred(prediction ? prediction.awayPrediction : null);
    setIsSaved(!!prediction);
  }

  // Sync tab if user odds suddenly become available
  const [prevUserOdds, setPrevUserOdds] = useState(userOdds);
  if (userOdds !== prevUserOdds) {
    setPrevUserOdds(userOdds);
    if (userOdds) {
      setOddsTab('user');
    }
  }

  const homeTeam = TEAMS[match.homeTeamCode] ?? { code: match.homeTeamCode, name: match.homeTeamCode, hue: 200 };
  const awayTeam = TEAMS[match.awayTeamCode] ?? { code: match.awayTeamCode, name: match.awayTeamCode, hue: 200 };
  const phaseInfo = PHASES[match.phase] ?? { label: match.phase.toUpperCase(), color: 'border-border-default bg-bg-secondary text-text-secondary' };

  const getVisualState = (): MatchVisualState => {
    if (match.status === 'result') return 'finished';
    if (match.status === 'live') return 'live';
    const now = new Date();
    const kickoff = new Date(match.kickoffUtc);
    if (kickoff <= now) {
      const matchDurationMs = 2 * 60 * 60 * 1000;
      if (now.getTime() - kickoff.getTime() > matchDurationMs) {
        return 'pending_result';
      }
      return 'locked';
    }
    return 'open';
  };
  const visualState = getVisualState();

  const handleHomeChange = (val: number) => {
    setHomePred(val);
    setIsSaved(false);
  };

  const handleAwayChange = (val: number) => {
    setAwayPred(val);
    setIsSaved(false);
  };

  const handleSave = () => {
    if (homePred !== null && awayPred !== null && onSavePrediction) {
      onSavePrediction(homePred, awayPred);
      setIsSaved(true);
    }
  };

  const triggerRefresh = async () => {
    if (onRefreshUserOdds) {
      setConfirmRefresh(false);
      await onRefreshUserOdds();
    }
  };

  const hasPred = homePred !== null && awayPred !== null;
  const activeOdds = oddsTab === 'user' && userOdds ? userOdds : globalOdds;

  // Identify favorite selection based on probabilities
  const getFavoriteText = (odds: OddsData) => {
    const max = Math.max(odds.homeProb, odds.drawProb, odds.awayProb);
    if (max === odds.homeProb) return `${homeTeam.name} es favorito`;
    if (max === odds.awayProb) return `${awayTeam.name} es favorito`;
    return 'Empate es el resultado más probable';
  };

  // Visual Probability & Odds module
  const renderOddsModule = () => {
    if (!showOdds) return null;
    if (!globalOdds && !userOdds) {
      return (
        <div className="mt-4 pt-3.5 border-t border-border-subtle/50 text-[10px] text-text-muted italic">
          Probabilidades no disponibles
        </div>
      );
    }

    return (
      <div className="mt-4 pt-3.5 border-t border-border-subtle/50 space-y-3">
        {/* Tab headers if user private odds are present */}
        {userOdds && (
          <div className="flex gap-2 border-b border-border-subtle pb-1">
            <button
              type="button"
              onClick={() => setOddsTab('global')}
              className={`text-[9px] font-mono uppercase tracking-wider pb-1 px-1 border-b-2 transition-all ${
                oddsTab === 'global'
                  ? 'border-gold-400 text-gold-400 font-bold'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Mercado Global
            </button>
            <button
              type="button"
              onClick={() => setOddsTab('user')}
              className={`text-[9px] font-mono uppercase tracking-wider pb-1 px-1 border-b-2 transition-all ${
                oddsTab === 'user'
                  ? 'border-gold-400 text-gold-400 font-bold'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Tu Consulta Privada
            </button>
          </div>
        )}

        {activeOdds && (
          <div className="space-y-2.5">
            {/* Probabilities Percentage Bar */}
            <div>
              <div className="flex justify-between font-mono text-[9px] text-text-secondary mb-1">
                <span>Local: {Math.round(activeOdds.homeProb * 100)}%</span>
                <span>Empate: {Math.round(activeOdds.drawProb * 100)}%</span>
                <span>Visita: {Math.round(activeOdds.awayProb * 100)}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-border-subtle border border-black/30">
                <div
                  className="bg-gold-500 h-full transition-all duration-300"
                  style={{ width: `${activeOdds.homeProb * 100}%` }}
                  title={`Local: ${Math.round(activeOdds.homeProb * 100)}%`}
                />
                <div
                  className="bg-zinc-600 h-full transition-all duration-300"
                  style={{ width: `${activeOdds.drawProb * 100}%` }}
                  title={`Empate: ${Math.round(activeOdds.drawProb * 100)}%`}
                />
                <div
                  className="bg-slate-400 h-full transition-all duration-300"
                  style={{ width: `${activeOdds.awayProb * 100}%` }}
                  title={`Visita: ${Math.round(activeOdds.awayProb * 100)}%`}
                />
              </div>
            </div>

            {/* Detailed Decimal Odds & Info */}
            <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary bg-black/15 p-2 rounded-lg border border-border-subtle/40">
              <div className="flex gap-3">
                <span>L: <strong className="text-gold-400">{activeOdds.homeOdds.toFixed(2)}</strong></span>
                <span>E: <strong className="text-gold-400">{activeOdds.drawOdds.toFixed(2)}</strong></span>
                <span>V: <strong className="text-gold-400">{activeOdds.awayOdds.toFixed(2)}</strong></span>
              </div>
              <div className="text-[8px] text-text-muted text-right flex flex-col">
                <span>Proveedor: {activeOdds.provider || 'Desconocido'} ({activeOdds.bookmaker})</span>
                <span>Capturado: {new Date(activeOdds.capturedAt).toLocaleString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })} (Hora Lima)</span>
              </div>
            </div>

            {/* Favorito según cuotas */}
            <div className="flex items-center gap-1.5 text-[10px] font-sans font-medium text-gold-400/90 bg-gold-400/5 px-2.5 py-1 rounded-md border border-gold-400/10 w-fit">
              <BarChart2 className="w-3.5 h-3.5 text-gold-400/90" />
              <span>{getFavoriteText(activeOdds)}</span>
            </div>
          </div>
        )}

        {/* User manual refresh button */}
        {manualRefreshEnabled && showOdds && cardMode === 'predict' && onRefreshUserOdds && (
          <div className="pt-1">
            {confirmRefresh ? (
              <div className="bg-bg-tertiary p-2 rounded-lg border border-gold-500/30 text-center space-y-2 animate-[slideUp_0.15s_ease-out]">
                <p className="text-[10px] text-text-primary font-medium">Vas a usar tu única actualización manual del día para este partido. ¿Continuar?</p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={triggerRefresh}
                    disabled={refreshingOdds}
                    className="bg-gold-500 hover:bg-gold-600 text-black text-[10px] font-mono font-bold px-2.5 py-0.5 rounded transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRefresh(false)}
                    className="bg-bg-hover hover:bg-bg-tertiary text-text-secondary text-[10px] font-mono px-2.5 py-0.5 rounded border border-border-default transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : canRefreshOddsToday ? (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmRefresh(true)}
                  disabled={refreshingOdds}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-secondary hover:text-text-primary text-[10px] font-mono font-semibold rounded-lg transition-all duration-200"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingOdds ? 'animate-spin' : ''}`} />
                  Actualizar probabilidades para mí
                </button>
                <p className="text-[9px] text-text-muted text-center font-mono">
                  Tienes 1 actualización manual diaria. Solo se consume si se obtienen datos reales.
                </p>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center justify-center gap-1 py-1.5 px-3 bg-bg-secondary/40 border border-border-default/40 text-text-muted text-[9px] font-mono rounded-lg">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-text-muted" />
                  <span>Actualización diaria usada</span>
                </div>
                {timeLeftUntilMidnight && (
                  <span>Restablece en {timeLeftUntilMidnight.hours}h {timeLeftUntilMidnight.minutes}m (Hora Lima)</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Collapsible Head-to-Head history module
  const renderH2HModule = () => {
    if (!h2h) {
      return (
        <div className="mt-3 pt-2.5 border-t border-border-subtle/50 text-[10px] text-text-muted italic">
          Historial no disponible
        </div>
      );
    }

    const homePct = h2h.totalMatches > 0 ? (h2h.homeWins / h2h.totalMatches) * 100 : 0;
    const drawPct = h2h.totalMatches > 0 ? (h2h.draws / h2h.totalMatches) * 100 : 0;
    const awayPct = h2h.totalMatches > 0 ? (h2h.awayWins / h2h.totalMatches) * 100 : 0;

    return (
      <div className="mt-3 pt-2.5 border-t border-border-subtle/50">
        <button
          type="button"
          onClick={() => setShowH2HPanel(!showH2HPanel)}
          className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors py-1"
        >
          <span className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-gold-400" />
            Enfrentamientos Directos (H2H)
          </span>
          {showH2HPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showH2HPanel && (
          <div className="mt-2.5 space-y-3 animate-[fadeIn_0.15s_ease-out]">
            {/* History stats overview */}
            <div className="bg-black/15 p-2.5 rounded-lg border border-border-subtle/40 space-y-2">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-text-secondary">Partidos Jugados: <strong className="text-text-primary">{h2h.totalMatches}</strong></span>
                <span className="text-text-secondary">Goles: <strong className="text-text-primary">{h2h.homeGoals} - {h2h.awayGoals}</strong></span>
              </div>

              {/* Wins distribution bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-mono text-text-secondary">
                  <span>Ganó {match.homeTeamCode}: {h2h.homeWins}</span>
                  <span>Empates: {h2h.draws}</span>
                  <span>Ganó {match.awayTeamCode}: {h2h.awayWins}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-border-subtle">
                  <div className="bg-emerald-500/80 h-full" style={{ width: `${homePct}%` }} title={`Gana ${match.homeTeamCode}: ${h2h.homeWins}`} />
                  <div className="bg-zinc-600 h-full" style={{ width: `${drawPct}%` }} title={`Empates: ${h2h.draws}`} />
                  <div className="bg-rose-500/80 h-full" style={{ width: `${awayPct}%` }} title={`Gana ${match.awayTeamCode}: ${h2h.awayWins}`} />
                </div>
              </div>
            </div>

            {/* Last matches list */}
            {h2h.lastMatches && h2h.lastMatches.length > 0 && (
              <div className="space-y-1">
                <div className="text-[8px] font-mono uppercase tracking-wider text-text-muted px-1">Últimos encuentros</div>
                <div className="space-y-1 text-[9px] font-mono">
                  {h2h.lastMatches.map((m: H2HMeeting, idx: number) => (
                    <div key={idx} className="flex justify-between items-center py-1 px-2 bg-black/10 rounded border border-border-subtle/20 hover:border-border-default/40 transition-colors">
                      <span className="text-text-secondary">{m.date.split('-')[0]} · {m.competition}</span>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="text-text-primary">{m.homeTeam}</span>
                        <span className="text-gold-400 bg-black/25 px-1.5 py-0.5 rounded">{m.homeScore} - {m.awayScore}</span>
                        <span className="text-text-primary">{m.awayTeam}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 1. SCOREBOARD VARIANT
  if (variant === 'scoreboard') {
    return (
      <div className="card-base overflow-hidden flex flex-col justify-between">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 border-b border-border-subtle bg-bg-secondary/40">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${phaseInfo.color} w-fit`}>
            {phaseInfo.label} {match.group ? `· Grupo ${match.group}` : ''} · {match.jornada}
          </span>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end w-full sm:w-auto">
            <MatchStatusBadge status={visualState} />
            {match.status === 'soon' ? (
              <div className="flex items-center gap-1 text-xs text-text-secondary font-mono">
                <CountdownInline targetIso={match.kickoffUtc} />
              </div>
            ) : (
              match.status !== 'live' && match.status !== 'result' && new Date(match.kickoffUtc) > new Date() && (
                <span className="text-xs text-text-secondary font-mono flex items-center gap-1 whitespace-nowrap">
                  <Calendar className="w-3 h-3" />
                  {fmtDate(match.kickoffUtc)} · {fmtTime(match.kickoffUtc)} (Hora Lima)
                </span>
              )
            )}
          </div>
        </div>

        {/* Content Panel */}
        <div className="p-4 flex-1">
          {cardMode === 'predict' ? (
            // Predict Layout (Inputs)
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <FlagDisc code={match.homeTeamCode} size={38} />
                <span className="font-display text-md tracking-wide text-center text-text-primary truncate w-full">
                  {homeTeam.name}
                </span>
                <Stepper value={homePred} onChange={handleHomeChange} />
              </div>
              <span className="font-mono text-xl text-text-muted mt-16">:</span>
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <FlagDisc code={match.awayTeamCode} size={38} />
                <span className="font-display text-md tracking-wide text-center text-text-primary truncate w-full">
                  {awayTeam.name}
                </span>
                <Stepper value={awayPred} onChange={handleAwayChange} />
              </div>
            </div>
          ) : (
            // Display/Locked/Result Layout
            <div className="flex items-center justify-between gap-4 py-2">
              {/* Home Team */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <FlagDisc code={match.homeTeamCode} size={32} />
                <span className="font-display text-lg tracking-wide text-text-primary truncate">
                  {homeTeam.name}
                </span>
              </div>

              {/* Scores Display */}
              <div className="flex items-center gap-2 font-mono text-3xl font-bold text-text-primary flex-shrink-0">
                <span>{match.homeScore !== null && match.homeScore !== undefined ? match.homeScore : '–'}</span>
                <span className="text-text-muted text-xl">:</span>
                <span>{match.awayScore !== null && match.awayScore !== undefined ? match.awayScore : '–'}</span>
              </div>

              {/* Away Team */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-row-reverse text-right">
                <FlagDisc code={match.awayTeamCode} size={32} />
                <span className="font-display text-lg tracking-wide text-text-primary truncate">
                  {awayTeam.name}
                </span>
              </div>
            </div>
          )}

          {/* Market Odds module */}
          {renderOddsModule()}

          {/* H2H history module */}
          {renderH2HModule()}

          {/* User Prediction Line */}
          {(cardMode === 'locked' || cardMode === 'result') && prediction && (
            <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-center gap-2 text-xs text-text-secondary">
              <span>Tu pronóstico:</span>
              <span className="font-mono font-bold text-text-primary">
                {prediction.homePrediction} &minus; {prediction.awayPrediction}
              </span>
              {cardMode === 'result' && (
                <PredictionStatusBadge scoreType={prediction.scoreType} points={prediction.pointsEarned} className="ml-2" />
              )}
            </div>
          )}
        </div>

        {/* Footer/Save Area */}
        {cardMode === 'predict' && (
          <div className="border-t border-border-subtle px-4 py-2 flex items-center justify-between bg-bg-secondary/20">
            <span className="text-xs flex items-center gap-1">
              {isSaved ? (
                <span className="text-gold-400 flex items-center gap-1 font-semibold">
                  <Check className="w-3.5 h-3.5" /> Guardado
                </span>
              ) : (
                <span className="text-text-muted">Sin guardar</span>
              )}
            </span>
            {hasPred && !isSaved && (
              <button
                type="button"
                onClick={handleSave}
                className="btn-gold py-1 px-3 text-sm flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" /> Guardar
              </button>
            )}
          </div>
        )}

        {cardMode === 'display' && (
          <div className="px-4 py-2 text-xs text-text-muted border-t border-border-subtle bg-bg-secondary/10 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {match.venue} · {match.city}
          </div>
        )}
      </div>
    );
  }

  // 2. SOLARI VARIANT
  if (variant === 'solari') {
    return (
      <div className="card-base bg-bg-secondary/60 border border-border-default rounded-xl overflow-hidden shadow-lg">
        {/* Solari Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-border-subtle">
          <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase text-gold-400">
            <span className={`w-2 h-2 rounded-full bg-gold-400 ${match.status === 'live' ? 'animate-[softPulse_1s_ease-in-out_infinite]' : ''}`} />
            {phaseInfo.label} · {match.jornada}
          </span>
          <span className="font-mono text-[10px] text-text-secondary uppercase">
            {match.status === 'live' ? '● EN JUEGO' : match.status === 'soon' ? 'CERRANDO' : 'CERRADO'}
          </span>
        </div>

        {/* Solari Body */}
        <div className="p-3">
          <div className="flex items-center justify-between gap-3">
            {/* Home Code */}
            <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <FlagDisc code={match.homeTeamCode} size={24} />
                <span className="font-mono text-md font-bold text-text-primary tracking-wide">{match.homeTeamCode}</span>
              </div>
              <span className="text-[10px] text-text-muted uppercase truncate w-full">{homeTeam.name}</span>
            </div>

            {/* Score Flaps */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Flap char={match.homeScore !== null && match.homeScore !== undefined ? match.homeScore : '–'} />
              <span className="text-text-muted font-mono text-lg">:</span>
              <Flap char={match.awayScore !== null && match.awayScore !== undefined ? match.awayScore : '–'} />
            </div>

            {/* Away Code */}
            <div className="flex flex-col items-end gap-1 flex-1 min-w-0 text-right">
              <div className="flex items-center gap-1.5 flex-row-reverse">
                <FlagDisc code={match.awayTeamCode} size={24} />
                <span className="font-mono text-md font-bold text-text-primary tracking-wide">{match.awayTeamCode}</span>
              </div>
              <span className="text-[10px] text-text-muted uppercase truncate w-full">{awayTeam.name}</span>
            </div>
          </div>

          {/* Stepper inputs if predict */}
          {cardMode === 'predict' && (
            <div className="flex justify-between items-center gap-4 mt-3 pt-3 border-t border-border-subtle">
              <Stepper value={homePred} onChange={handleHomeChange} />
              {hasPred && !isSaved && (
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-gold py-1 px-3 text-xs flex items-center gap-1"
                >
                  <Save className="w-3 h-3" /> Guardar
                </button>
              )}
              <Stepper value={awayPred} onChange={handleAwayChange} />
            </div>
          )}

          {/* Market Odds module */}
          {renderOddsModule()}

          {/* H2H history module */}
          {renderH2HModule()}

          {/* Prediction summary */}
          {(cardMode === 'locked' || cardMode === 'result') && prediction && (
            <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between font-mono text-xs">
              <span className="text-text-muted uppercase">Tu Pron: {prediction.homePrediction} - {prediction.awayPrediction}</span>
              {cardMode === 'result' && prediction.scoreType && (
                <span className="text-gold-400 font-bold uppercase tracking-wider">
                  {prediction.scoreType} (+{prediction.pointsEarned} pts)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. TICKET VARIANT
  if (variant === 'ticket') {
    const isExact = cardMode === 'result' && prediction?.scoreType === 'exact';

    return (
      <div
        className={`card-base overflow-hidden relative border ${
          isExact
            ? 'bg-gradient-to-b from-gold-400/10 to-bg-tertiary border-gold-500 shadow-[0_4px_20px_rgba(212,168,67,0.15)]'
            : 'border-border-default'
        }`}
      >
        {/* Ticket Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-dashed border-border-active bg-bg-secondary/20">
          <span className="text-[10px] font-mono tracking-wider text-text-secondary uppercase">
            TICKET APUESTA · {phaseInfo.label}
          </span>
          <span className="text-[10px] font-mono text-text-muted uppercase">
            {match.status.toUpperCase()}
          </span>
        </div>

        {/* Ticket Content */}
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-4">
            {/* Home Team */}
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <FlagDisc code={match.homeTeamCode} size={40} />
              <span className="font-display text-md tracking-wide text-text-primary truncate w-full">
                {homeTeam.name}
              </span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center">
              {cardMode === 'predict' ? (
                <span className="font-display text-3xl text-text-muted leading-none">
                  {homePred !== null ? homePred : '–'}
                  <span className="text-text-muted mx-1">·</span>
                  {awayPred !== null ? awayPred : '–'}
                </span>
              ) : (
                <span className={`font-display text-4xl leading-none ${isExact ? 'text-gold-400 drop-shadow-[0_0_12px_rgba(212,168,67,0.3)]' : 'text-text-primary'}`}>
                  {match.homeScore !== null && match.homeScore !== undefined ? match.homeScore : '–'}
                  <span className="text-text-muted mx-1">·</span>
                  {match.awayScore !== null && match.awayScore !== undefined ? match.awayScore : '–'}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <FlagDisc code={match.awayTeamCode} size={40} />
              <span className="font-display text-md tracking-wide text-text-primary truncate w-full">
                {awayTeam.name}
              </span>
            </div>
          </div>

          {/* Steppers */}
          {cardMode === 'predict' && (
            <div className="flex justify-center gap-8 mt-4">
              <Stepper value={homePred} onChange={handleHomeChange} />
              <Stepper value={awayPred} onChange={handleAwayChange} />
            </div>
          )}

          {/* Market Odds module */}
          {renderOddsModule()}

          {/* H2H history module */}
          {renderH2HModule()}
        </div>

        {/* Ticket Result Area */}
        {cardMode === 'result' && prediction && (
          <div className="mx-4 p-3 border-t border-dashed border-border-active text-center bg-black/10 rounded-lg mb-4">
            <div className="font-display text-lg tracking-wider text-gold-400">
              {isExact ? '★ MARCADOR EXACTO ★' : prediction.scoreType?.toUpperCase()}
            </div>
            <div className="font-mono text-xs text-text-secondary mt-1">
              Tu apuesta: {prediction.homePrediction} · {prediction.awayPrediction} &rarr; +{prediction.pointsEarned ?? 0} pts
            </div>
          </div>
        )}

        {/* Ticket Footer */}
        {cardMode !== 'result' && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-dashed border-border-active bg-bg-secondary/10">
            {cardMode === 'predict' ? (
              <>
                <span className={`text-xs font-semibold ${isSaved ? 'text-gold-400' : 'text-text-muted'}`}>
                  {isSaved ? '✓ Apuesta registrada' : 'Ingresa tu marcador'}
                </span>
                {hasPred && !isSaved && (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="text-xs text-gold-400 font-bold hover:underline"
                  >
                    Guardar
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="font-mono text-xs text-text-secondary">
                  Tu apuesta: {prediction ? `${prediction.homePrediction}·${prediction.awayPrediction}` : 'Sin pronóstico'}
                </span>
                <span className="text-[10px] text-text-muted uppercase">LOCKED</span>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};
