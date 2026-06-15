'use client';

import { useState } from 'react';
import { updateMatchResultAction, manuallyRecalculateStandingsAction } from '../../../lib/actions/admin';
import { Match } from '@prisma/client';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { FlagDisc } from '../../../components/ui/FlagDisc';

export default function MatchesAdminClient({ matches }: { matches: Match[] }) {
  const [loading, setLoading] = useState<string | null>(null);
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

  const handleUpdate = async (matchId: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(matchId);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const homeScoreStr = formData.get('homeScore') as string;
    const awayScoreStr = formData.get('awayScore') as string;

    if (!homeScoreStr || !awayScoreStr) {
      setError('Debes ingresar ambos marcadores');
      setLoading(null);
      return;
    }

    const homeScore = parseInt(homeScoreStr, 10);
    const awayScore = parseInt(awayScoreStr, 10);

    const result = await updateMatchResultAction(matchId, homeScore, awayScore);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Resultado guardado exitosamente');
    }
    
    setLoading(null);
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
          <thead className="bg-surface border-b border-border text-text-muted">
            <tr>
              <th className="p-3">ID / Kickoff</th>
              <th className="p-3">Equipos</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Resultado</th>
              <th className="p-3">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {matches.map(match => (
              <tr key={match.id} className="hover:bg-surface transition-colors">
                <td className="p-3">
                  <div>{match.id.substring(0, 8)}</div>
                  <div className="text-xs text-text-muted">{new Date(match.kickoffUtc).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5 font-sans font-semibold">
                    <FlagDisc code={match.homeTeamCode} size={20} />
                    <span>{match.homeTeamCode}</span>
                    <span className="text-text-muted font-normal text-xs">vs</span>
                    <FlagDisc code={match.awayTeamCode} size={20} />
                    <span>{match.awayTeamCode}</span>
                  </div>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${match.status === 'result' ? 'bg-gold/20 text-gold' : 'bg-surface border border-border text-text-muted'}`}>
                    {match.status}
                  </span>
                </td>
                <td className="p-3">
                  <form id={`form-${match.id}`} onSubmit={(e) => handleUpdate(match.id, e)} className="flex items-center gap-2">
                    <input 
                      name="homeScore" 
                      type="number" 
                      min="0"
                      defaultValue={match.homeScore ?? ''} 
                      className="w-16 bg-background border border-border rounded px-2 py-1 text-center"
                    />
                    <span>-</span>
                    <input 
                      name="awayScore" 
                      type="number" 
                      min="0"
                      defaultValue={match.awayScore ?? ''} 
                      className="w-16 bg-background border border-border rounded px-2 py-1 text-center"
                    />
                  </form>
                </td>
                <td className="p-3">
                  <button 
                    form={`form-${match.id}`}
                    type="submit" 
                    disabled={loading === match.id}
                    className="px-3 py-1 bg-gold text-background font-medium rounded hover:bg-gold-light disabled:opacity-50 transition-colors"
                  >
                    {loading === match.id ? 'Guardando...' : 'Guardar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
