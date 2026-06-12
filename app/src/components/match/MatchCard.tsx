'use client';

import React, { useState } from 'react';
import { Match, Prediction } from '../../types/domain';
import { TEAMS, PHASES } from '../../lib/mockData';
import { fmtDate, fmtTime } from '../../lib/utils/dates';
import { FlagDisc } from '../ui/FlagDisc';
import { Stepper } from '../ui/Stepper';
import { CountdownInline } from '../ui/Countdown';
import { PredictionStatusBadge } from '../ui/PredictionStatusBadge';
import { Calendar, MapPin, Check, Save } from 'lucide-react';

const Flap: React.FC<{ char: string | number }> = ({ char }) => (
  <span className="relative inline-flex items-center justify-center w-7 h-10 rounded-md bg-gradient-to-b from-[#15151e] to-[#0d0d14] border border-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] font-mono text-xl font-bold text-gold-400 overflow-hidden">
    {char}
    <span className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/70 shadow-[0_1px_0_rgba(255,255,255,0.03)]" />
  </span>
);

interface MatchCardProps {
  match: Match;
  prediction?: Prediction | null;
  mode?: 'predict' | 'display' | 'locked' | 'result';
  variant?: 'scoreboard' | 'solari' | 'ticket';
  onSavePrediction?: (home: number, away: number) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  prediction,
  mode,
  variant = 'scoreboard',
  onSavePrediction,
}) => {
  // Determine mode based on match status if not explicitly provided
  const cardMode = mode ?? (
    match.status === 'result' ? 'result' :
    match.status === 'live' || match.status === 'soon' ? 'locked' :
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

  const homeTeam = TEAMS[match.homeTeamCode] ?? { code: match.homeTeamCode, name: match.homeTeamCode, hue: 200 };
  const awayTeam = TEAMS[match.awayTeamCode] ?? { code: match.awayTeamCode, name: match.awayTeamCode, hue: 200 };
  const phaseInfo = PHASES[match.phase] ?? { label: match.phase.toUpperCase(), color: 'border-border-default bg-bg-secondary text-text-secondary' };

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

  const hasPred = homePred !== null && awayPred !== null;

  // 1. SCOREBOARD VARIANT
  if (variant === 'scoreboard') {
    return (
      <div className="card-base overflow-hidden flex flex-col justify-between">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-bg-secondary/40">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${phaseInfo.color}`}>
            {phaseInfo.label} {match.group ? `· Grupo ${match.group}` : ''} · {match.jornada}
          </span>
          {match.status === 'live' ? (
            <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-rank-down">
              <span className="live-dot" /> LIVE
            </span>
          ) : match.status === 'soon' ? (
            <div className="flex items-center gap-1">
              <CountdownInline targetIso={match.kickoffUtc} />
            </div>
          ) : (
            <span className="text-xs text-text-secondary font-mono flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {fmtDate(match.kickoffUtc)} · {fmtTime(match.kickoffUtc)}
            </span>
          )}
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
