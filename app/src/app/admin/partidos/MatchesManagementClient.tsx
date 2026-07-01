'use client';

import React, { useState } from 'react';
import { Match } from '@prisma/client';
import {
  updateMatchDetailsAction,
  previewKickoffCorrectionsAction,
  applyKickoffCorrectionsAction,
} from '../../../lib/actions/admin';
import { type KickoffCorrectionProposal } from '../../../lib/actions/admin-helpers';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { parseLimaDateTimeToUtc } from '../../../lib/utils/dates';
import { FlagDisc } from '../../../components/ui/FlagDisc';
import { getComputedMatchStatus, getComputedStatusDisplay } from '../../../lib/utils/matchStatus';

type FilterType = 'all' | 'scheduled' | 'closed_pending' | 'final' | 'postponed' | 'cancelled';

export default function MatchesManagementClient({ matches }: { matches: Match[] }) {
  const router = useRouter();
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const [proposals, setProposals] = useState<KickoffCorrectionProposal[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [showCorrector, setShowCorrector] = useState(false);

  const handleToggleCorrector = () => {
    setShowCorrector(prev => !prev);
    setProposals(null);
  };

  const handlePreviewCorrections = async () => {
    setPreviewLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await previewKickoffCorrectionsAction();
      if ('error' in res) {
        setError(res.error);
      } else if (res.success) {
        setProposals(res.proposals);
      }
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error inesperado al obtener la vista previa.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplyCorrections = async () => {
    if (!confirm('¿Está seguro de que desea corregir las fechas de kickoff oficiales en la base de datos?')) {
      return;
    }
    setApplyLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await applyKickoffCorrectionsAction();
      if ('error' in res) {
        setError(res.error);
      } else if (res.success) {
        setSuccess(`Se corrigieron con éxito ${res.updatedCount} partidos de fase eliminatoria.`);
        setShowCorrector(false);
        setProposals(null);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error inesperado al aplicar las correcciones.');
    } finally {
      setApplyLoading(false);
    }
  };

  const filteredMatches = matches.filter(m => {
    if (filter === 'all') return true;
    return getComputedMatchStatus(m) === filter;
  });

  const filterCounts: Record<FilterType, number> = {
    all: matches.length,
    scheduled: matches.filter(m => getComputedMatchStatus(m) === 'scheduled').length,
    closed_pending: matches.filter(m => getComputedMatchStatus(m) === 'closed_pending').length,
    final: matches.filter(m => getComputedMatchStatus(m) === 'final').length,
    postponed: matches.filter(m => getComputedMatchStatus(m) === 'postponed').length,
    cancelled: matches.filter(m => getComputedMatchStatus(m) === 'cancelled').length,
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, matchId: string) => {
    e.preventDefault();
    setLoading(matchId);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const kickoffLocal = formData.get('kickoffUtc') as string;
    const kickoffUtc = kickoffLocal ? parseLimaDateTimeToUtc(kickoffLocal) : '';
    const venue = formData.get('venue') as string;
    const city = formData.get('city') as string;
    const status = formData.get('status') as string;
    const group = formData.get('group') as string;
    const jornada = formData.get('jornada') as string;
    const phase = formData.get('phase') as string;

    const res = await updateMatchDetailsAction(matchId, {
      kickoffUtc,
      venue,
      city,
      status,
      group: group || null,
      jornada,
      phase,
    });

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Partido actualizado exitosamente');
      setEditingMatchId(null);
      router.refresh();
    }
    setLoading(null);
  };

  const getLimaDateTimeLocalString = (utcDate: Date | string) => {
    const d = new Date(utcDate);
    const limaTime = new Date(d.getTime() - 5 * 60 * 60 * 1000);
    return limaTime.toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-6">
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

      {/* Schedule Correction Panel */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Corrección de Horarios Oficiales (Knockouts)</h3>
            <p className="text-xs text-text-muted">Compara la programación en BD con el calendario oficial de la FIFA 2026 y corrige kickoffUtc.</p>
          </div>
          <button
            type="button"
            onClick={handleToggleCorrector}
            className="px-3 py-1.5 bg-background border border-border rounded text-xs text-gold hover:text-white hover:border-gold transition-colors font-mono uppercase"
          >
            {showCorrector ? 'Ocultar Corrector' : 'Abrir Corrector'}
          </button>
        </div>

        {showCorrector && (
          <div className="space-y-4 pt-2 border-t border-border/50 animate-[slideDown_0.2s_ease-out]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreviewCorrections}
                disabled={previewLoading || applyLoading}
                className="px-3 py-1.5 bg-gold text-background rounded text-xs font-semibold hover:bg-gold/80 disabled:opacity-50 transition-colors"
              >
                {previewLoading ? 'Cargando propuesta...' : 'Ver propuesta de corrección'}
              </button>
              {proposals && proposals.some(p => p.status === 'pending') && (
                <button
                  type="button"
                  onClick={handleApplyCorrections}
                  disabled={applyLoading}
                  className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {applyLoading ? 'Aplicando...' : 'Aplicar correcciones'}
                </button>
              )}
            </div>

            {proposals && (
              <div className="overflow-x-auto max-h-[300px] border border-border rounded divide-y divide-border bg-background/50">
                {proposals.length === 0 ? (
                  <p className="p-4 text-xs text-text-muted">No hay partidos de fase eliminatoria detectados.</p>
                ) : (
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-surface text-text-muted">
                      <tr>
                        <th className="p-2">ID</th>
                        <th className="p-2">Partido</th>
                        <th className="p-2">Actual (UTC)</th>
                        <th className="p-2">Propuesto (UTC)</th>
                        <th className="p-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {proposals.map(p => (
                        <tr key={p.matchId} className="hover:bg-surface transition-colors">
                          <td className="p-2 font-bold text-gold">{p.matchId}</td>
                          <td className="p-2 font-sans">
                            {p.homeTeamCode} vs {p.awayTeamCode} ({p.phase === 'r32' ? '1/32 Final' : p.phase === 'r16' ? '1/16 Final' : p.phase === 'quarters' ? 'Cuartos' : p.phase === 'semis' ? 'Semis' : p.phase === 'final' ? 'Final' : p.phase} / {p.jornada})
                          </td>
                          <td className="p-2 text-red-400">{p.currentReadable}</td>
                          <td className="p-2 text-green-400">{p.proposedReadable}</td>
                          <td className="p-2">
                            {p.status === 'final_skipped' ? (
                              <span className="text-[10px] text-text-muted bg-surface border border-border px-1.5 py-0.5 rounded font-sans">Finalizado (Ignorado)</span>
                            ) : p.status === 'pending' ? (
                              <span className="text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded font-sans font-bold">Cambio pendiente</span>
                            ) : (
                              <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded font-sans">Alineado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-1.5">
        {([['all','Todos'],['scheduled','Próximos'],['closed_pending','Pendientes'],['final','Finalizados'],['postponed','Postergados'],['cancelled','Cancelados']] as [FilterType, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all ${
              filter === key
                ? 'bg-gold text-background border-gold'
                : 'bg-surface text-text-muted border-border hover:text-text-primary hover:border-border-hover'
            }`}
          >
            {label} <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${filter === key ? 'bg-background/20' : 'bg-background'}`}>{filterCounts[key]}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-surface border-b border-border text-text-muted">
            <tr>
              <th className="p-3">Partido</th>
              <th className="p-3">Kickoff (Perú)</th>
              <th className="p-3">Estadio / Ciudad</th>
              <th className="p-3">Fase / Jornada</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredMatches.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-text-muted text-sm">No hay partidos con el filtro seleccionado</td></tr>
            ) : filteredMatches.map((match) => {
              const isEditing = editingMatchId === match.id;
              return (
                <React.Fragment key={match.id}>
                  <tr className="hover:bg-surface transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-sans font-semibold">
                        <FlagDisc code={match.homeTeamCode} size={20} />
                        <span>{match.homeTeamCode}</span>
                        <span className="text-text-muted font-normal text-xs">vs</span>
                        <FlagDisc code={match.awayTeamCode} size={20} />
                        <span>{match.awayTeamCode}</span>
                        {match.group && <span className="ml-2 text-xs text-gold border border-gold/30 px-1.5 py-0.5 rounded font-mono">Grupo {match.group}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-xs font-mono">
                      {new Date(match.kickoffUtc).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
                    </td>
                    <td className="p-3 text-xs">
                      {match.venue}, {match.city}
                    </td>
                    <td className="p-3 text-xs">
                      {match.phase} / {match.jornada}
                    </td>
                    <td className="p-3">
                      {(() => {
                        const cs = getComputedMatchStatus(match);
                        const disp = getComputedStatusDisplay(cs);
                        return (
                          <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full uppercase border ${disp.bgClass} ${disp.colorClass} ${disp.borderClass}`}>
                            {disp.labelShort}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setEditingMatchId(isEditing ? null : match.id)}
                        className="text-xs text-gold hover:underline font-semibold"
                      >
                        {isEditing ? 'Cancelar' : 'Editar'}
                      </button>
                    </td>
                  </tr>

                  {isEditing && (
                    <tr>
                      <td colSpan={6} className="bg-bg-secondary p-4 border border-gold/20">
                        <form onSubmit={(e) => handleSubmit(e, match.id)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Kickoff (Hora Perú / Lima)</label>
                            <input
                              type="datetime-local"
                              name="kickoffUtc"
                              required
                              defaultValue={getLimaDateTimeLocalString(match.kickoffUtc)}
                              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary"
                            />
                            <span className="text-[10px] text-text-muted mt-1 block">
                              Almacenado UTC: <code className="bg-bg-primary border border-border-subtle px-1.5 py-0.5 rounded">{new Date(match.kickoffUtc).toISOString()}</code>
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Estadio</label>
                            <input
                              type="text"
                              name="venue"
                              required
                              defaultValue={match.venue}
                              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Ciudad</label>
                            <input
                              type="text"
                              name="city"
                              required
                              defaultValue={match.city}
                              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Fase</label>
                            <select
                              name="phase"
                              defaultValue={match.phase}
                              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary"
                            >
                              <option value="groups">groups</option>
                              <option value="r32">r32</option>
                              <option value="r16">r16</option>
                              <option value="quarters">quarters</option>
                              <option value="semis">semis</option>
                              <option value="final">final</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Jornada</label>
                            <input
                              type="text"
                              name="jornada"
                              required
                              defaultValue={match.jornada}
                              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Grupo</label>
                            <input
                              type="text"
                              name="group"
                              placeholder="e.g. A"
                              defaultValue={match.group || ''}
                              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Estado</label>
                            <select
                              name="status"
                              defaultValue={match.status}
                              className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm text-text-primary"
                            >
                              <option value="open">open</option>
                              <option value="soon">soon</option>
                              <option value="live">live</option>
                              <option value="result">result</option>
                            </select>
                          </div>

                          <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setEditingMatchId(null)}
                              className="px-4 py-2 bg-surface hover:bg-surface-hover text-text-secondary rounded text-xs font-semibold"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={loading === match.id}
                              className="px-4 py-2 bg-gold text-background hover:bg-gold-light rounded text-xs font-semibold disabled:opacity-50"
                            >
                              {loading === match.id ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
