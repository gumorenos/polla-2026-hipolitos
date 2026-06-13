import React, { useState } from 'react';
import { Match, Prediction } from '../../types/domain';
import { MatchCard } from './MatchCard';
import { savePredictionAction } from '../../lib/actions/predictions';
import { MatchStatusBadge, MatchVisualState } from '../ui/MatchStatusBadge';

interface MatchPredictionCardProps {
  match: Match;
  prediction?: Prediction | null;
  variant?: 'scoreboard' | 'solari' | 'ticket';
  onPredictionSaved?: (pred: Prediction) => void;
  leagueId: string;
  oddsSnapshot?: {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    homeProbability: number;
    drawProbability: number;
    awayProbability: number;
  } | null;
  showOdds?: boolean;
}

export const MatchPredictionCard: React.FC<MatchPredictionCardProps> = ({
  match,
  prediction,
  variant = 'scoreboard',
  onPredictionSaved,
  leagueId,
  oddsSnapshot,
  showOdds,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localPrediction, setLocalPrediction] = useState<Prediction | null>(prediction ?? null);
  const [prevPrediction, setPrevPrediction] = useState(prediction);

  // Sync state if prediction prop changes (during render)
  if (prediction !== prevPrediction) {
    setPrevPrediction(prediction);
    setLocalPrediction(prediction ?? null);
  }

  const getVisualState = (): MatchVisualState => {
    if (match.status === 'result') return 'finished';
    if (match.status === 'live') return 'live';
    if (new Date(match.kickoffUtc) <= new Date()) return 'locked';
    return 'open';
  };

  const handleSave = async (home: number, away: number) => {
    setLoading(true);
    setErrorMsg(null);

    const result = await savePredictionAction(match.id, leagueId, home, away);

    if (result.error) {
      setErrorMsg(result.error);
      setLoading(false);
    } else if (result.success && result.data) {
      const savedPred = {
        ...result.data,
        updatedAt: result.data.updatedAt.toISOString(),
      } as unknown as Prediction;
      setLocalPrediction(savedPred);
      setLoading(false);
      if (onPredictionSaved) {
        onPredictionSaved(savedPred);
      }
    }
  };

  const visualState = getVisualState();

  return (
    <div className="relative group pt-2">
      {/* Floated Status Badge */}
      <div className="absolute top-0 left-4 z-10">
        <MatchStatusBadge status={visualState} />
      </div>

      <MatchCard
        match={match}
        prediction={localPrediction}
        variant={variant}
        onSavePrediction={handleSave}
        oddsSnapshot={oddsSnapshot}
        showOdds={showOdds}
      />

      {errorMsg && (
        <div className="mt-2 text-[10px] text-red-400 bg-red-400/10 border border-red-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between animate-[slideUp_0.2s_ease-out]">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-text-muted hover:text-text-primary ml-1 font-bold">✕</button>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center rounded-xl z-20">
          <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
