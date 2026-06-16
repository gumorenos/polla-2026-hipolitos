'use client';

import { useState, useRef, useCallback } from 'react';
import { updateMatchResultAction, manuallyRecalculateStandingsAction } from '../../../lib/actions/admin';
import { fetchAndSaveMatchResultAction, markMatchStatusAction, validateCSVRows, applyCSVResultsAction, CSVValidationResult, CSVResultRow } from '../../../lib/actions/results';
import { Match } from '@prisma/client';
import { AlertCircle, CheckCircle, RefreshCw, PauseCircle, XCircle, Upload, Download, ChevronDown } from 'lucide-react';
import { FlagDisc } from '../../../components/ui/FlagDisc';
import { getComputedMatchStatus, getComputedStatusDisplay } from '../../../lib/utils/matchStatus';
import * as XLSX from 'xlsx';

export interface MatchUpdateDetails {
  wentToExtraTime?: boolean;
  wentToPenalties?: boolean;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
  winnerTeamCode?: string | null;
  resultStatus?: string | null;
  resultNotes?: string | null;
}

type FilterType = 'all' | 'scheduled' | 'closed_pending' | 'final' | 'postponed' | 'cancelled';

interface MatchRowProps {
  match: Match;
  loading: boolean;
  actionLoading: boolean;
  onUpdate: (matchId: string, homeScore: number, awayScore: number, details: MatchUpdateDetails) => Promise<void>;
  onFetchFromApi: (matchId: string) => Promise<void>;
  onMarkStatus: (matchId: string, status: 'postponed' | 'cancelled') => Promise<void>;
}

function MatchRow({ match, loading, actionLoading, onUpdate, onFetchFromApi, onMarkStatus }: MatchRowProps) {
  const [homeScore, setHomeScore] = useState<string>(match.homeScore !== null ? String(match.homeScore) : '');
  const [awayScore, setAwayScore] = useState<string>(match.awayScore !== null ? String(match.awayScore) : '');
  const [wentToExtraTime, setWentToExtraTime] = useState<boolean>(match.wentToExtraTime);
  const [wentToPenalties, setWentToPenalties] = useState<boolean>(match.wentToPenalties);
  const [homePenalty, setHomePenalty] = useState<string>(match.homePenaltyScore !== null ? String(match.homePenaltyScore) : '');
  const [awayPenalty, setAwayPenalty] = useState<string>(match.awayPenaltyScore !== null ? String(match.awayPenaltyScore) : '');
  const [showActions, setShowActions] = useState(false);

  const isKnockout = match.phase !== 'groups';
  const isDraw = homeScore !== '' && awayScore !== '' && parseInt(homeScore, 10) === parseInt(awayScore, 10);
  const showPenaltiesInput = isKnockout && (wentToPenalties || isDraw);

  const computedStatus = getComputedMatchStatus(match);
  const statusDisplay = getComputedStatusDisplay(computedStatus);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const hScore = parseInt(homeScore, 10);
    const aScore = parseInt(awayScore, 10);
    if (isNaN(hScore) || isNaN(aScore)) return;

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
        <div className="text-[9px] text-gold uppercase tracking-wider mt-0.5">{match.phase} {match.group ? `(G${match.group})` : ''}</div>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1.5 font-sans font-semibold text-text-primary">
          <FlagDisc code={match.homeTeamCode} size={18} />
          <span>{match.homeTeamCode}</span>
          <span className="text-text-muted font-normal text-xs px-0.5">vs</span>
          <FlagDisc code={match.awayTeamCode} size={18} />
          <span>{match.awayTeamCode}</span>
        </div>
        {match.homeScore !== null && (
          <div className="text-xs font-mono text-text-secondary mt-0.5">
            Resultado: {match.homeScore}–{match.awayScore}
            {match.wentToPenalties && match.homePenaltyScore !== null && (
              <span className="text-gold ml-1">({match.homePenaltyScore}–{match.awayPenaltyScore} p.)</span>
            )}
          </div>
        )}
      </td>
      <td className="p-3">
        <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold border whitespace-nowrap ${statusDisplay.bgClass} ${statusDisplay.colorClass} ${statusDisplay.borderClass}`}>
          {statusDisplay.labelShort}
        </span>
        {match.resultSource && (
          <div className="text-[9px] text-text-muted mt-0.5">{match.resultSource}</div>
        )}
      </td>
      <td className="p-3">
        <form id={`form-${match.id}`} onSubmit={handleSubmit} className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              name="homeScore" type="number" min="0" placeholder="0" value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="w-14 bg-background text-text-primary border border-border rounded px-2 py-1 text-center font-mono text-sm focus:outline-none focus:border-gold/60"
            />
            <span className="text-text-muted">–</span>
            <input
              name="awayScore" type="number" min="0" placeholder="0" value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="w-14 bg-background text-text-primary border border-border rounded px-2 py-1 text-center font-mono text-sm focus:outline-none focus:border-gold/60"
            />
          </div>

          {isKnockout && (
            <div className="space-y-1 text-xs border-l border-border/80 pl-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary select-none">
                <input type="checkbox" checked={wentToExtraTime} onChange={(e) => setWentToExtraTime(e.target.checked)}
                  className="rounded border-border accent-gold w-3.5 h-3.5" />
                <span>Tiempos Extra</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary select-none">
                <input type="checkbox" checked={wentToPenalties}
                  disabled={!isDraw && homeScore !== '' && awayScore !== ''}
                  onChange={(e) => setWentToPenalties(e.target.checked)}
                  className="rounded border-border accent-gold w-3.5 h-3.5" />
                <span>Penales</span>
              </label>
              {showPenaltiesInput && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-text-muted font-mono">P:</span>
                  <input name="homePenaltyScore" type="number" min="0" placeholder="0" value={homePenalty}
                    onChange={(e) => setHomePenalty(e.target.value)}
                    className="w-10 bg-background text-text-primary border border-border rounded px-1.5 py-0.5 text-center font-mono text-xs focus:outline-none focus:border-gold/60"
                  />
                  <span className="text-text-muted">–</span>
                  <input name="awayPenaltyScore" type="number" min="0" placeholder="0" value={awayPenalty}
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
        <div className="flex flex-col gap-1.5">
          <button
            form={`form-${match.id}`}
            type="submit"
            disabled={loading || actionLoading}
            className="px-3 py-1.5 bg-gold text-background font-medium rounded hover:bg-gold-light disabled:opacity-50 transition-colors text-xs font-mono uppercase tracking-wider"
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>

          <div className="relative">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setShowActions(a => !a)}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover text-xs rounded transition-colors w-full disabled:opacity-50"
            >
              Más acciones <ChevronDown className="w-3 h-3 ml-auto" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-lg shadow-xl min-w-[170px] py-1">
                <button
                  type="button"
                  onClick={async () => { setShowActions(false); await onFetchFromApi(match.id); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gold" /> Actualizar desde API
                </button>
                <button
                  type="button"
                  onClick={async () => { setShowActions(false); await onMarkStatus(match.id, 'postponed'); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-orange-400" /> Marcar postergado
                </button>
                <button
                  type="button"
                  onClick={async () => { setShowActions(false); await onMarkStatus(match.id, 'cancelled'); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:text-red-400 hover:bg-background transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5 text-red-400" /> Marcar cancelado
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// CSV template columns
const CSV_COLUMNS = ['matchId', 'homeTeamCode', 'awayTeamCode', 'status', 'homeScore', 'awayScore', 'wentToExtraTime', 'wentToPenalties', 'homePenaltyScore', 'awayPenaltyScore', 'winnerTeamCode', 'resultNotes'];

export default function MatchesAdminClient({ matches }: { matches: Match[] }) {
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [actionLoadingMatchId, setActionLoadingMatchId] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  // CSV/Excel state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvValidationResults, setCsvValidationResults] = useState<CSVValidationResult[] | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvApplying, setCsvApplying] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);

  const filteredMatches = matches.filter((m) => {
    if (filter === 'all') return true;
    const status = getComputedMatchStatus(m);
    return status === filter;
  });

  const filterCounts: Record<FilterType, number> = {
    all: matches.length,
    scheduled: matches.filter(m => getComputedMatchStatus(m) === 'scheduled').length,
    closed_pending: matches.filter(m => getComputedMatchStatus(m) === 'closed_pending').length,
    final: matches.filter(m => getComputedMatchStatus(m) === 'final').length,
    postponed: matches.filter(m => getComputedMatchStatus(m) === 'postponed').length,
    cancelled: matches.filter(m => getComputedMatchStatus(m) === 'cancelled').length,
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    setError(null);
    setSuccess(null);
    const res = await manuallyRecalculateStandingsAction();
    if (res.error) setError(res.error);
    else setSuccess('Clasificaciones recalculadas exitosamente');
    setRecalculating(false);
  };

  const handleUpdateMatchResult = async (matchId: string, homeScore: number, awayScore: number, details: MatchUpdateDetails) => {
    setLoadingMatchId(matchId);
    setError(null);
    setSuccess(null);
    const result = await updateMatchResultAction(matchId, homeScore, awayScore, details);
    if (result.error) setError(result.error);
    else setSuccess('Resultado guardado y clasificaciones actualizadas');
    setLoadingMatchId(null);
  };

  const handleFetchFromApi = async (matchId: string) => {
    setActionLoadingMatchId(matchId);
    setError(null);
    setSuccess(null);
    const result = await fetchAndSaveMatchResultAction(matchId, false, 'auto');
    if (result.error) setError(`API: ${result.error}`);
    else setSuccess(`Resultado obtenido vía ${result.usedProvider ?? 'API'}${result.isFallback ? ' (fallback)' : ''}`);
    setActionLoadingMatchId(null);
  };

  const handleMarkStatus = async (matchId: string, status: 'postponed' | 'cancelled') => {
    setActionLoadingMatchId(matchId);
    setError(null);
    setSuccess(null);
    const result = await markMatchStatusAction(matchId, status);
    if (result.error) setError(result.error);
    else setSuccess(`Partido marcado como ${status === 'postponed' ? 'postergado' : 'cancelado'}`);
    setActionLoadingMatchId(null);
  };

  // CSV/Excel template download
  const handleDownloadTemplate = (format: 'csv' | 'xlsx') => {
    const ws = XLSX.utils.aoa_to_sheet([
      CSV_COLUMNS,
      ...matches.slice(0, 3).map(m => [
        m.id, m.homeTeamCode, m.awayTeamCode, 'final',
        m.homeScore ?? '', m.awayScore ?? '',
        'false', 'false', '', '', '', '',
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');

    if (format === 'xlsx') {
      XLSX.writeFile(wb, 'plantilla-resultados.xlsx');
    } else {
      XLSX.writeFile(wb, 'plantilla-resultados.csv', { bookType: 'csv' });
    }
  };

  // File upload + validation
  const handleFileUpload = useCallback(async (file: File) => {
    setCsvLoading(true);
    setCsvError(null);
    setCsvValidationResults(null);
    setCsvSuccess(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      if (rows.length === 0) {
        setCsvError('El archivo está vacío o sin datos');
        return;
      }

      const validations = await validateCSVRows(rows);
      setCsvValidationResults(validations);
    } catch (e) {
      setCsvError(`Error leyendo archivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCsvLoading(false);
    }
  }, []);

  const handleApplyCSV = async () => {
    if (!csvValidationResults) return;
    const validRows = csvValidationResults.filter(r => r.valid && r.data).map(r => r.data as CSVResultRow);
    if (validRows.length === 0) {
      setCsvError('No hay filas válidas para aplicar');
      return;
    }

    setCsvApplying(true);
    setCsvError(null);
    const res = await applyCSVResultsAction(validRows);
    if (res.error) {
      setCsvError(res.error);
    } else {
      setCsvSuccess(`Aplicados: ${res.applied} resultados${res.failed ? `, ${res.failed} fallidos` : ''}`);
      setCsvValidationResults(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setCsvApplying(false);
  };

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'scheduled', label: 'Próximos' },
    { key: 'closed_pending', label: 'Pendientes' },
    { key: 'final', label: 'Finalizados' },
    { key: 'postponed', label: 'Postergados' },
    { key: 'cancelled', label: 'Cancelados' },
  ];

  const validCount = csvValidationResults?.filter(r => r.valid).length ?? 0;
  const invalidCount = csvValidationResults?.filter(r => !r.valid).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-text-muted">
          Mostrando <span className="text-text-primary font-semibold">{filteredMatches.length}</span> de {matches.length} partidos
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-4 py-2 bg-background border border-gold/45 text-gold hover:bg-gold/10 disabled:opacity-50 transition-colors rounded font-medium text-xs uppercase tracking-wider"
        >
          {recalculating ? 'Recalculando…' : 'Recalcular Clasificaciones'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-1.5">
        {filterButtons.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all ${
              filter === key
                ? 'bg-gold text-background border-gold'
                : 'bg-surface text-text-muted border-border hover:text-text-primary hover:border-border-hover'
            }`}
          >
            {label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
              filter === key ? 'bg-background/20' : 'bg-background'
            }`}>
              {filterCounts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="text-xs text-green-400 bg-green-400/15 border border-green-500/30 p-3 rounded-lg flex items-start gap-2">
          <CheckCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Match Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-surface border-b border-border text-text-muted font-mono uppercase tracking-wider text-xs">
            <tr>
              <th className="p-3">ID / Kickoff</th>
              <th className="p-3">Equipos / Resultado</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Nuevo Resultado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredMatches.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-text-muted text-sm">
                  No hay partidos con el filtro seleccionado
                </td>
              </tr>
            ) : (
              filteredMatches.map(match => (
                <MatchRow
                  key={match.id}
                  match={match}
                  loading={loadingMatchId === match.id}
                  actionLoading={actionLoadingMatchId === match.id}
                  onUpdate={handleUpdateMatchResult}
                  onFetchFromApi={handleFetchFromApi}
                  onMarkStatus={handleMarkStatus}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CSV / Excel Import Section */}
      <div className="border-t border-border pt-6 space-y-4">
        <h3 className="font-display text-lg text-gold tracking-wide uppercase">Importar Resultados (CSV / Excel)</h3>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleDownloadTemplate('xlsx')}
            className="flex items-center gap-2 px-4 py-2 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover text-xs rounded transition-colors"
          >
            <Download className="w-4 h-4 text-gold" /> Plantilla Excel (.xlsx)
          </button>
          <button
            onClick={() => handleDownloadTemplate('csv')}
            className="flex items-center gap-2 px-4 py-2 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover text-xs rounded transition-colors"
          >
            <Download className="w-4 h-4 text-gold" /> Plantilla CSV
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Subir archivo de resultados</label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
              className="text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gold/20 file:text-gold hover:file:bg-gold/30 cursor-pointer"
            />
            {csvLoading && <span className="text-xs text-text-muted animate-pulse">Validando…</span>}
          </div>
        </div>

        {/* Validation errors */}
        {csvError && (
          <div className="text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{csvError}</span>
          </div>
        )}
        {csvSuccess && (
          <div className="text-xs text-green-400 bg-green-400/15 border border-green-500/30 p-3 rounded-lg flex items-start gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{csvSuccess}</span>
          </div>
        )}

        {/* Validation Preview */}
        {csvValidationResults && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-text-muted">Total: <strong className="text-text-primary">{csvValidationResults.length}</strong></span>
              <span className="text-green-400">Válidas: <strong>{validCount}</strong></span>
              {invalidCount > 0 && <span className="text-red-400">Con errores: <strong>{invalidCount}</strong></span>}
            </div>

            <div className="overflow-x-auto border border-border rounded-lg max-h-64">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-surface border-b border-border text-text-muted font-mono uppercase tracking-wider">
                  <tr>
                    <th className="p-2">Fila</th>
                    <th className="p-2">Match ID</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Resultado</th>
                    <th className="p-2">Errores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {csvValidationResults.map(r => (
                    <tr key={r.rowIndex} className={r.valid ? '' : 'bg-red-500/5'}>
                      <td className="p-2 font-mono">{r.rowIndex + 1}</td>
                      <td className="p-2 font-mono">{r.matchId?.substring(0, 10)}…</td>
                      <td className="p-2">
                        {r.valid
                          ? <span className="text-green-400 font-semibold">✓ Válida</span>
                          : <span className="text-red-400 font-semibold">✗ Error</span>
                        }
                      </td>
                      <td className="p-2 font-mono">
                        {r.data ? `${r.data.homeScore}–${r.data.awayScore}` : '—'}
                      </td>
                      <td className="p-2 text-red-400">{r.errors.join('; ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {validCount > 0 && (
              <button
                onClick={handleApplyCSV}
                disabled={csvApplying}
                className="flex items-center gap-2 px-5 py-2.5 bg-gold text-background font-bold rounded hover:bg-gold-light disabled:opacity-50 transition-colors text-xs uppercase tracking-wider"
              >
                <Upload className="w-4 h-4" />
                {csvApplying ? 'Aplicando…' : `Aplicar ${validCount} resultado${validCount !== 1 ? 's' : ''} válido${validCount !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
