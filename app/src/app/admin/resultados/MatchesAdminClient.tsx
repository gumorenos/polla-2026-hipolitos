'use client';

import { useState } from 'react';
import { updateMatchResultAction, manuallyRecalculateStandingsAction } from '../../../lib/actions/admin';
import { Match } from '@prisma/client';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { FlagDisc } from '../../../components/ui/FlagDisc';

export interface MatchUpdateDetails {
  wentToExtraTime?: boolean;
  wentToPenalties?: boolean;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
  winnerTeamCode?: string | null;
  resultStatus?: string | null;
  resultNotes?: string | null;
}

interface MatchRowProps {
  match: Match;
  loading: boolean;
  onUpdate: (matchId: string, homeScore: number, awayScore: number, details: MatchUpdateDetails) => Promise<void>;
}

function MatchRow({ match, loading, onUpdate }: MatchRowProps) {
  const [homeScore, setHomeScore] = useState<string>(match.homeScore !== null ? String(match.homeScore) : '');
  const [awayScore, setAwayScore] = useState<string>(match.awayScore !== null ? String(match.awayScore) : '');
  const [wentToExtraTime, setWentToExtraTime] = useState<boolean>(match.wentToExtraTime);
  const [wentToPenalties, setWentToPenalties] = useState<boolean>(match.wentToPenalties);
  const [homePenalty, setHomePenalty] = useState<string>(match.homePenaltyScore !== null ? String(match.homePenaltyScore) : '');
  const [awayPenalty, setAwayPenalty] = useState<string>(match.awayPenaltyScore !== null ? String(match.awayPenaltyScore) : '');

  const isKnockout = match.phase !== 'groups';
  const isDraw = homeScore !== '' && awayScore !== '' && parseInt(homeScore, 10) === parseInt(awayScore, 10);
  const showPenaltiesInput = isKnockout && (wentToPenalties || isDraw);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const hScore = parseInt(homeScore, 10);
    const aScore = parseInt(awayScore, 10);

    if (isNaN(hScore) || isNaN(aScore)) {
      return;
    }

    const details: MatchUpdateDetails = {
      wentToExtraTime,
      wentToPenalties: showPenaltiesInput,
      homePenaltyScore: showPenaltiesInput && homePenalty !== '' ? parseInt(homePenalty, 10) : null,
      awayPenaltyScore: showPenaltiesInput && awayPenalty !== '' ? parseInt(awayPenalty, 10) : null,
      resultStatus: 'final',
    };

    onUpdate(match.id, hScore, aScore, details);
  };

  return (
    <tr className="hover:bg-surface transition-colors align-top">
      <td className="p-3 font-mono">
        <div className="font-bold text-text-primary">{match.id.substring(0, 8)}</div>
        <div className="text-[10px] text-text-muted">
          {new Date(match.kickoffUtc).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
        </div>
        <div className="text-[9px] text-gold uppercase tracking-wider mt-0.5">{match.phase} {match.group ? `(Grupo ${match.group})` : ''}</div>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1.5 font-sans font-semibold text-text-primary">
          <FlagDisc code={match.homeTeamCode} size={20} />
          <span>{match.homeTeamCode}</span>
          <span className="text-text-muted font-normal text-xs px-0.5">vs</span>
          <FlagDisc code={match.awayTeamCode} size={20} />
          <span>{match.awayTeamCode}</span>
        </div>
      </td>
      <td className="p-3">
        <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold border ${
          match.status === 'result' 
            ? 'bg-gold/15 text-gold border-gold/30' 
            : 'bg-surface border border-border text-text-muted'
        }`}>
          {match.status}
        </span>
      </td>
      <td className="p-3">
        <form id={`form-${match.id}`} onSubmit={handleSubmit} className="space-y-3">
          {/* Main Score inputs */}
          <div className="flex items-center gap-2">
            <input 
              name="homeScore" 
              type="number" 
              min="0"
              placeholder="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="w-14 bg-background text-text-primary border border-border rounded px-2 py-1 text-center font-mono text-sm focus:outline-none focus:border-gold/60"
            />
            <span className="text-text-muted">-</span>
            <input 
              name="awayScore" 
              type="number" 
              min="0"
              placeholder="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="w-14 bg-background text-text-primary border border-border rounded px-2 py-1 text-center font-mono text-sm focus:outline-none focus:border-gold/60"
            />
          </div>

          {/* Knockout Options */}
          {isKnockout && (
            <div className="space-y-1.5 text-xs border-l border-border/80 pl-2 mt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary select-none">
                <input 
                  type="checkbox"
                  checked={wentToExtraTime}
                  onChange={(e) => setWentToExtraTime(e.target.checked)}
                  className="rounded border-border text-gold bg-background accent-gold w-3.5 h-3.5"
                />
                <span>Tiempos Extra</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary select-none">
                <input 
                  type="checkbox"
                  checked={wentToPenalties}
                  disabled={!isDraw && homeScore !== '' && awayScore !== ''}
                  onChange={(e) => setWentToPenalties(e.target.checked)}
                  className="rounded border-border text-gold bg-background accent-gold w-3.5 h-3.5"
                />
                <span>Definido por Penales</span>
              </label>

              {/* Penalty shootout scores inputs */}
              {showPenaltiesInput && (
                <div className="flex items-center gap-1.5 mt-1 animate-[fadeIn_0.15s_ease-out]">
                  <span className="text-[10px] text-text-muted font-bold font-mono">Penales:</span>
                  <input 
                    name="homePenaltyScore" 
                    type="number" 
                    min="0"
                    placeholder="0"
                    value={homePenalty}
                    onChange={(e) => setHomePenalty(e.target.value)}
                    className="w-10 bg-background text-text-primary border border-border rounded px-1.5 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-gold/60"
                  />
                  <span className="text-text-muted">-</span>
                  <input 
                    name="awayPenaltyScore" 
                    type="number" 
                    min="0"
                    placeholder="0"
                    value={awayPenalty}
                    onChange={(e) => setAwayPenalty(e.target.value)}
                    className="w-10 bg-background text-text-primary border border-border rounded px-1.5 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-gold/60"
                  />
                </div>
              )}
            </div>
          )}
        </form>
      </td>
      <td className="p-3">
        <button 
          form={`form-${match.id}`}
          type="submit" 
          disabled={loading}
          className="px-3 py-1.5 bg-gold text-background font-medium rounded hover:bg-gold-light disabled:opacity-50 transition-colors text-xs font-mono uppercase tracking-wider"
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </td>
    </tr>
  );
}

export default function MatchesAdminClient({ matches }: { matches: Match[] }) {
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRecalculate = async () => {
    setRecalculating(true);
    setError(null);
    setSuccess(null);
    const res = await manuallyRecalculateStandingsAction();
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Clasificaciones recalculadas exitosamente');
    }
    setRecalculating(false);
  };

  const handleUpdateMatchResult = async (
    matchId: string,
    homeScore: number,
    awayScore: number,
    details: MatchUpdateDetails
  ) => {
    setLoadingMatchId(matchId);
    setError(null);
    setSuccess(null);

    const result = await updateMatchResultAction(matchId, homeScore, awayScore, details);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Resultado guardado y clasificaciones actualizadas exitosamente');
    }
    
    setLoadingMatchId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-4 py-2 bg-background border border-gold/45 text-gold hover:bg-gold/10 disabled:opacity-50 transition-colors rounded font-medium text-xs uppercase tracking-wider"
        >
          {recalculating ? 'Recalculando...' : 'Recalcular Clasificaciones'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2 animate-[slideUp_0.2s_ease-out]">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="text-xs text-green-400 bg-green-400/15 border border-green-500/30 p-3 rounded-lg flex items-start gap-2 animate-[slideUp_0.2s_ease-out]">
          <CheckCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-surface border-b border-border text-text-muted font-mono uppercase tracking-wider text-xs">
            <tr>
              <th className="p-3">ID / Kickoff</th>
              <th className="p-3">Equipos</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Resultado / Detalles</th>
              <th className="p-3">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {matches.map(match => (
              <MatchRow 
                key={match.id} 
                match={match} 
                loading={loadingMatchId === match.id} 
                onUpdate={handleUpdateMatchResult} 
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
