'use client';

import { useState, useRef, useCallback } from 'react';
import { updateMatchResultAction, manuallyRecalculateStandingsAction } from '../../../lib/actions/admin';
import { diagnoseMatchResultProvidersAction, fetchAndSaveMatchResultAction, markMatchStatusAction, validateCSVRows, applyCSVResultsAction, CSVValidationResult, CSVResultRow } from '../../../lib/actions/results';
import { applyKnockoutPropagationAction, applyRoundOf32ResolutionAction } from '../../../lib/actions/bracket';
import { Match } from '@prisma/client';
import { AlertCircle, CheckCircle, RefreshCw, PauseCircle, XCircle, Upload, Download, ChevronDown, Search } from 'lucide-react';
import { FlagDisc } from '../../../components/ui/FlagDisc';
import { getComputedMatchStatus, getComputedStatusDisplay } from '../../../lib/utils/matchStatus';
import type { QualificationStatus, WorldCupQualification } from '../../../lib/fifa-qualification';
import type { RoundOf32Resolution } from '../../../lib/knockout-bracket';
import type { KnockoutPropagationPlan, TournamentRepairPreview } from '../../../lib/knockout-propagation';
import type { ProviderDiagnostic } from '../../../lib/odds/football-data';
import { useRouter } from 'next/navigation';
function parseCSV(text: string): Record<string, string>[] {
  const result: Record<string, string>[] = [];
  const lines: string[][] = [];
  let row: string[] = [];
  let col = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          col += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        col += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(col.trim());
        col = '';
      } else if (char === '\r' || char === '\n') {
        row.push(col.trim());
        col = '';
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
          lines.push(row);
        }
        row = [];
        if (char === '\r' && next === '\n') {
          i++;
        }
      } else {
        col += char;
      }
    }
  }

  if (row.length > 0 || col !== '') {
    row.push(col.trim());
    if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
      lines.push(row);
    }
  }

  if (lines.length <= 1) return [];

  const headers = lines[0].map(h => h.trim());
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = line[index] !== undefined ? line[index] : '';
    });
    result.push(obj);
  }

  return result;
}

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
  onDiagnoseProviders: (matchId: string) => Promise<void>;
  onMarkStatus: (matchId: string, status: 'postponed' | 'cancelled') => Promise<void>;
}

function MatchRow({ match, loading, actionLoading, onUpdate, onFetchFromApi, onDiagnoseProviders, onMarkStatus }: MatchRowProps) {
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
                  onClick={async () => { setShowActions(false); await onDiagnoseProviders(match.id); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-blue-400" /> Diagnosticar proveedores
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

export default function MatchesAdminClient({
  matches,
  qualification,
  bracketResolution,
  knockoutPropagation,
  tournamentRepairPreview,
}: {
  matches: Match[];
  qualification: WorldCupQualification;
  bracketResolution: RoundOf32Resolution;
  knockoutPropagation: KnockoutPropagationPlan;
  tournamentRepairPreview: TournamentRepairPreview;
}) {
  const router = useRouter();
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [actionLoadingMatchId, setActionLoadingMatchId] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [providerDiagnostics, setProviderDiagnostics] = useState<ProviderDiagnostic[]>([]);
  const [diagnosticMatchId, setDiagnosticMatchId] = useState<string | null>(null);
  const [applyingBracket, setApplyingBracket] = useState(false);
  const [applyingPropagation, setApplyingPropagation] = useState(false);

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
    else {
      setSuccess('Resultado guardado y clasificaciones actualizadas');
      router.refresh();
    }
    setLoadingMatchId(null);
  };

  const handleFetchFromApi = async (matchId: string) => {
    setActionLoadingMatchId(matchId);
    setError(null);
    setSuccess(null);
    const result = await fetchAndSaveMatchResultAction(matchId, false, 'auto');
    if ('diagnostics' in result && result.diagnostics) {
      setProviderDiagnostics(result.diagnostics);
      setDiagnosticMatchId(matchId);
    }
    if ('error' in result) setError(`API: ${result.error}`);
    else {
      setSuccess(`Resultado obtenido vía ${result.usedProvider ?? 'API'}${result.isFallback ? ' (fallback)' : ''}`);
      router.refresh();
    }
    setActionLoadingMatchId(null);
  };

  const handleDiagnoseProviders = async (matchId: string) => {
    setActionLoadingMatchId(matchId);
    setError(null);
    setSuccess(null);
    const result = await diagnoseMatchResultProvidersAction(matchId);
    if ('diagnostics' in result && result.diagnostics) {
      setProviderDiagnostics(result.diagnostics);
      setDiagnosticMatchId(matchId);
    }
    if ('error' in result) setError(`Diagnóstico: ${result.error}`);
    else setSuccess('Diagnóstico completado sin modificar el resultado.');
    setActionLoadingMatchId(null);
  };

  const handleApplyBracket = async () => {
    setApplyingBracket(true);
    setError(null);
    setSuccess(null);
    const result = await applyRoundOf32ResolutionAction();
    if ('error' in result) setError(result.error);
    else {
      setSuccess(`Bracket actualizado: ${result.changed} cruce(s) modificados.`);
      router.refresh();
    }
    setApplyingBracket(false);
  };

  const handleApplyPropagation = async () => {
    setApplyingPropagation(true);
    setError(null);
    setSuccess(null);
    const result = await applyKnockoutPropagationAction();
    if ('error' in result) setError(result.error);
    else {
      const conflictSuffix = result.conflicts.length > 0
        ? ` Conflictos no aplicados: ${result.conflicts.join(' ')}`
        : '';
      setSuccess(`Reparación aplicada: ${result.propagatedSlots} cruce(s), ${result.groupStatusUpdates} estado(s) de grupos y ${result.statusUpdates} estado(s) eliminatorios actualizados.${conflictSuffix}`);
      router.refresh();
    }
    setApplyingPropagation(false);
  };

  const handleMarkStatus = async (matchId: string, status: 'postponed' | 'cancelled') => {
    setActionLoadingMatchId(matchId);
    setError(null);
    setSuccess(null);
    const result = await markMatchStatusAction(matchId, status);
    if (result.error) setError(result.error);
    else {
      setSuccess(`Partido marcado como ${status === 'postponed' ? 'postergado' : 'cancelado'}`);
      router.refresh();
    }
    setActionLoadingMatchId(null);
  };

  // CSV template download (Excel deshabilitado por seguridad)
  const handleDownloadTemplate = () => {
    const rows = [
      CSV_COLUMNS,
      ...matches.slice(0, 3).map(m => [
        m.id, m.homeTeamCode, m.awayTeamCode, 'final',
        m.homeScore ?? '', m.awayScore ?? '',
        'false', 'false', '', '', '', '',
      ]),
    ];

    const csvContent = rows
      .map(row => row.map(val => {
        const strVal = String(val);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n') || strVal.includes('\r')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(','))
      .join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla-resultados.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // File upload + validation (CSV Nativo)
  const handleFileUpload = useCallback(async (file: File) => {
    setCsvLoading(true);
    setCsvError(null);
    setCsvValidationResults(null);
    setCsvSuccess(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseCSV(text);

        if (rows.length === 0) {
          setCsvError('El archivo está vacío, no contiene filas o tiene formato inválido');
          return;
        }

        const validations = await validateCSVRows(rows);
        setCsvValidationResults(validations);
      } catch (e) {
        setCsvError(`Error leyendo archivo CSV: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setCsvLoading(false);
      }
    };

    reader.onerror = () => {
      setCsvError('Error al leer el archivo del disco.');
      setCsvLoading(false);
    };

    reader.readAsText(file, 'UTF-8');
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

      {diagnosticMatchId && providerDiagnostics.length > 0 && (
        <ProviderDiagnosticsPanel matchId={diagnosticMatchId} diagnostics={providerDiagnostics} />
      )}

      <QualificationPanel qualification={qualification} />
      <BracketResolutionPanel
        resolution={bracketResolution}
        applying={applyingBracket}
        onApply={handleApplyBracket}
      />
      <KnockoutPropagationPanel
        plan={knockoutPropagation}
        repairPreview={tournamentRepairPreview}
        applying={applyingPropagation}
        onApply={handleApplyPropagation}
      />

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
                  onDiagnoseProviders={handleDiagnoseProviders}
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
            type="button"
            className="flex items-center gap-2 px-4 py-2 border border-border/40 text-text-muted text-xs rounded bg-black/10 cursor-not-allowed"
            title="Excel temporalmente deshabilitado por seguridad; usa CSV"
            disabled
          >
            <span className="w-2 h-2 rounded-full bg-red-500"></span> Excel deshabilitado; usa CSV
          </button>
          <button
            onClick={() => handleDownloadTemplate()}
            className="flex items-center gap-2 px-4 py-2 border border-border text-text-secondary hover:text-text-primary hover:border-border-hover text-xs rounded transition-colors"
          >
            <Download className="w-4 h-4 text-gold" /> Plantilla CSV
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Subir archivo de resultados (.csv)</label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
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

function ProviderDiagnosticsPanel({
  matchId,
  diagnostics,
}: {
  matchId: string;
  diagnostics: ProviderDiagnostic[];
}) {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
      <div>
        <h3 className="font-display text-lg uppercase tracking-wide text-text-primary">Diagnóstico de proveedores</h3>
        <p className="text-xs text-text-secondary">Partido {matchId}. Esta consulta no guarda resultados.</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {diagnostics.map((diagnostic) => (
          <div key={`${diagnostic.provider}-${diagnostic.timestamp}`} className="rounded border border-border-subtle bg-background/40 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-text-primary">{diagnostic.provider}</span>
              <span className={diagnostic.success ? 'text-green-400' : 'text-amber-400'}>
                {diagnostic.success ? 'Fixture encontrado' : diagnostic.failureCategory || 'Sin coincidencia'}
              </span>
            </div>
            <p className="text-text-secondary">Local: {diagnostic.localHomeTeamCode} vs {diagnostic.localAwayTeamCode}</p>
            <p className="text-text-secondary">Kickoff UTC: {diagnostic.localKickoffUtc || diagnostic.date}</p>
            <p className="text-text-secondary">Consulta: {diagnostic.querySummary || 'No disponible'}</p>
            <p className="text-text-secondary">Candidatos: {diagnostic.responseCount ?? 'No disponible'}</p>
            {diagnostic.matchedFixtureId && <p className="text-green-400">Fixture: {diagnostic.matchedFixtureId}</p>}
            {diagnostic.errorMessage && <p className="text-amber-300">Motivo: {diagnostic.errorMessage}</p>}
            {diagnostic.candidateSummaries && diagnostic.candidateSummaries.length > 0 && (
              <details className="pt-1">
                <summary className="cursor-pointer text-blue-300">Ver candidatos normalizados</summary>
                <ul className="mt-1 space-y-1 text-[10px] text-text-muted">
                  {diagnostic.candidateSummaries.map((candidate) => <li key={candidate}>{candidate}</li>)}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketResolutionPanel({
  resolution,
  applying,
  onApply,
}: {
  resolution: RoundOf32Resolution;
  applying: boolean;
  onApply: () => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-background/35 p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="font-display text-lg uppercase tracking-wide text-text-primary">Resolver bracket de dieciseisavos</h3>
          <p className="text-xs text-text-secondary">Calculado únicamente con resultados finales locales de fase de grupos.</p>
        </div>
        <button
          type="button"
          disabled={!resolution.canApplySafeProposals || applying}
          onClick={onApply}
          className="px-4 py-2 rounded bg-gold text-background text-xs font-semibold disabled:opacity-40"
        >
          {applying ? 'Aplicando…' : 'Aplicar cruces resueltos'}
        </button>
      </div>
      {resolution.ready && resolution.applicableProposalCount === 0 ? (
        <p className="text-xs text-green-400">No se requieren cambios: los 16 cruces ya están resueltos.</p>
      ) : resolution.ready ? (
        <p className="text-xs text-green-400">
          Los 16 cruces están resueltos. {resolution.applicableProposalCount} cambio(s) listos para aplicar.
        </p>
      ) : (
        <div className="text-xs text-amber-300 space-y-1">
          {resolution.unresolvedReasons.map((reason) => <p key={reason}>{reason}</p>)}
          {resolution.blockingMatches.map((match) => (
            <p key={match.id} className="text-text-secondary">
              Bloquea {match.id}: {match.homeTeamCode} vs {match.awayTeamCode} ({match.resultStatus || 'sin estado final'})
            </p>
          ))}
        </div>
      )}
      {resolution.annexCKey && (
        <p className="text-xs text-blue-300">Combinación Annex C: {resolution.annexCKey}</p>
      )}
      {resolution.proposals.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-gold">Ver propuesta de cruces ({resolution.proposals.length})</summary>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-text-secondary">
            {resolution.proposals.map((proposal) => (
              <div key={proposal.matchId} className="rounded border border-border-subtle bg-surface/40 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-text-primary">{proposal.matchId}</span>
                  <span className={proposal.changed ? 'text-amber-300' : 'text-green-400'}>
                    {proposal.changed ? 'Cambiar' : 'Sin cambios'}
                  </span>
                </div>
                <p>
                  Actual: {proposal.currentHomeTeamCode} vs {proposal.currentAwayTeamCode}
                </p>
                <p>
                  Resuelto: {proposal.resolvedHomeTeamCode} vs {proposal.resolvedAwayTeamCode}
                </p>
                <p className="text-[10px] text-text-muted">{proposal.reason}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function KnockoutPropagationPanel({
  plan,
  repairPreview,
  applying,
  onApply,
}: {
  plan: KnockoutPropagationPlan;
  repairPreview: TournamentRepairPreview;
  applying: boolean;
  onApply: () => Promise<void>;
}) {
  const safeRepairChanges = repairPreview.changes.filter((change) => change.safe);
  return (
    <div className="rounded-lg border border-border-subtle bg-background/35 p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="font-display text-lg uppercase tracking-wide text-text-primary">Reparar / sincronizar estado del torneo</h3>
          <p className="text-xs text-text-secondary">
            Materializa Wxx/RUxx y sincroniza eliminaciones de grupos y fases eliminatorias con resultados locales.
          </p>
        </div>
        <button
          type="button"
          disabled={safeRepairChanges.length === 0 || applying}
          onClick={onApply}
          className="px-4 py-2 rounded bg-gold text-background text-xs font-semibold disabled:opacity-40"
        >
          {applying ? 'Aplicando…' : 'Aplicar reparación / sync'}
        </button>
      </div>
      {safeRepairChanges.length === 0 ? (
        <p className="text-xs text-text-secondary">No hay cambios seguros pendientes para reparar.</p>
      ) : (
        <p className="text-xs text-green-400">{safeRepairChanges.length} cambio(s) seguro(s) listos para aplicar.</p>
      )}
      {plan.conflicts.map((conflict) => (
        <p key={`${conflict.matchId}-${conflict.side}`} className="text-xs text-amber-300">
          Conflicto {conflict.matchId} ({conflict.side}): {conflict.currentTeamCode} no se reemplazará por {conflict.resolvedTeamCode}.
        </p>
      ))}
      {repairPreview.blocked.map((reason) => (
        <p key={reason} className="text-xs text-amber-300">Bloqueado: {reason}</p>
      ))}
      {repairPreview.changes.length > 0 && (
        <details open>
          <summary className="cursor-pointer text-xs text-gold">
            Vista previa completa ({repairPreview.changes.length} cambio(s))
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-text-muted">
                <tr>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Partido</th>
                  <th className="p-2">Equipo</th>
                  <th className="p-2">De</th>
                  <th className="p-2">A</th>
                  <th className="p-2">Motivo</th>
                  <th className="p-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {repairPreview.changes.map((change, index) => (
                  <tr key={`${change.changeType}-${change.leagueId}-${change.matchId}-${change.teamCode}-${index}`} className="border-t border-border-subtle">
                    <td className="p-2">{change.changeType}</td>
                    <td className="p-2 font-mono">{change.matchId || '—'}</td>
                    <td className="p-2 font-mono">{change.teamCode}</td>
                    <td className="p-2">{change.from}</td>
                    <td className="p-2">{change.to}</td>
                    <td className="p-2 text-text-secondary">{change.reason}</td>
                    <td className={`p-2 ${change.safe ? 'text-green-400' : 'text-amber-300'}`}>
                      {change.safe ? 'Seguro' : 'Bloqueado'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <details>
        <summary className="cursor-pointer text-xs text-gold">
          Ver diagnóstico ({plan.proposals.length} resueltos, {plan.pendingReferences.length} pendientes)
        </summary>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-text-secondary">
          {plan.proposals.map((proposal) => (
            <div key={`${proposal.matchId}-${proposal.side}`} className="rounded border border-border-subtle bg-surface/40 p-2">
              <p className="font-mono text-text-primary">{proposal.matchId} · {proposal.side}</p>
              <p>{proposal.placeholder}: {proposal.currentTeamCode} → {proposal.resolvedTeamCode}</p>
              <p className="text-[10px] text-text-muted">{proposal.reason}</p>
            </div>
          ))}
        </div>
        {plan.pendingReferences.length > 0 && (
          <p className="mt-2 text-[10px] text-text-muted">Pendientes: {plan.pendingReferences.join(', ')}</p>
        )}
      </details>
    </div>
  );
}

function QualificationPanel({ qualification }: { qualification: WorldCupQualification }) {
  if (qualification.groups.length === 0) {
    return (
      <div className="border border-border-subtle bg-background/35 rounded-lg p-4">
        <h3 className="font-display text-lg text-gold tracking-wide uppercase">Clasificación FIFA 2026</h3>
        <p className="text-xs text-text-muted mt-1">Todavía no hay partidos de fase de grupos para calcular tablas.</p>
      </div>
    );
  }

  return (
    <div className="border border-border-subtle bg-background/35 rounded-lg p-4 space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-display text-lg text-gold tracking-wide uppercase">Clasificación FIFA 2026</h3>
          <p className="text-xs text-text-muted">
            Tabla actual de grupos, mejores terceros y desempates pendientes según datos disponibles.
          </p>
        </div>
        <div className="text-[10px] text-text-muted font-mono uppercase">
          {qualification.qualifiedTeamCodes.length} clasificados calculados
        </div>
      </div>

      {qualification.unresolvedTies.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          {qualification.unresolvedTies[0]}
          {qualification.unresolvedTies.length > 1 ? ` +${qualification.unresolvedTies.length - 1} desempate(s) pendiente(s)` : ''}
        </div>
      )}

      {qualification.thirdPlaceTieDiagnostics.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {qualification.thirdPlaceTieDiagnostics.map((diagnostic) => (
            <div key={diagnostic.teamCodes.join('-')} className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3 text-xs space-y-1">
              <p className="font-semibold text-text-primary">Empate: {diagnostic.teamCodes.join(', ')}</p>
              <p className="text-text-secondary">Posiciones: {diagnostic.positions.join(', ')}</p>
              <p className="text-text-secondary">Puntos iguales: sí · DG igual: sí · GF igual: sí</p>
              <p className="text-text-secondary">Head-to-head aplicable: no, son equipos de grupos distintos.</p>
              <p className="text-text-secondary">Fair play faltante: {diagnostic.fairPlayPointsMissing ? 'sí' : 'no'}</p>
              <p className="text-text-secondary">Ranking FIFA faltante: {diagnostic.fifaRankingMissing ? 'sí' : 'no'}</p>
              <p className={diagnostic.affectsQualificationCutoff ? 'text-amber-300' : 'text-green-400'}>
                {diagnostic.affectsQualificationCutoff
                  ? 'Requiere resolución administrativa porque afecta el corte 8/9.'
                  : 'El orden exacto sigue pendiente, pero ambos lados conservan su estado de clasificación.'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {qualification.groups.map((group) => (
          <div key={group.group} className="rounded-lg border border-border-subtle overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-surface/60 border-b border-border-subtle">
              <p className="font-display text-sm uppercase tracking-wide text-text-primary">Grupo {group.group}</p>
              <p className="text-[10px] font-mono text-text-muted">
                {group.playedMatches}/{group.totalMatches} partidos
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="text-[10px] font-mono uppercase text-text-muted">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Equipo</th>
                    <th className="px-2 py-2 text-right">Pts</th>
                    <th className="px-2 py-2 text-right">DG</th>
                    <th className="px-2 py-2 text-right">GF</th>
                    <th className="px-2 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/40">
                  {group.entries.map((entry) => (
                    <tr key={entry.teamCode} className={entry.status === 'eliminated' ? 'opacity-60' : ''}>
                      <td className="px-2 py-2 font-mono text-text-muted">{entry.rank}</td>
                      <td className="px-2 py-2">
                        <span className="font-semibold text-text-primary">{entry.teamName}</span>
                        <span className="ml-1 text-[10px] text-text-muted font-mono">({entry.teamCode})</span>
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-text-primary">{entry.points}</td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">{entry.goalDifference}</td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">{entry.goalsFor}</td>
                      <td className="px-2 py-2">
                        <QualificationBadge status={entry.status} unresolved={entry.unresolvedTiebreaker} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border-subtle overflow-hidden">
        <div className="px-3 py-2 bg-surface/60 border-b border-border-subtle">
          <p className="font-display text-sm uppercase tracking-wide text-text-primary">Mejores terceros</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="text-[10px] font-mono uppercase text-text-muted">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Equipo</th>
                <th className="px-2 py-2 text-right">Pts</th>
                <th className="px-2 py-2 text-right">DG</th>
                <th className="px-2 py-2 text-right">GF</th>
                <th className="px-2 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/40">
              {qualification.thirdPlacedTeams.map((entry, index) => (
                <tr key={`${entry.group}-${entry.teamCode}`} className={index >= 8 ? 'opacity-60' : ''}>
                  <td className="px-2 py-2 font-mono text-text-muted">{index + 1}</td>
                  <td className="px-2 py-2">
                    <span className="font-semibold text-text-primary">{entry.teamName}</span>
                    <span className="ml-1 text-[10px] text-text-muted font-mono">({entry.teamCode})</span>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-text-primary">{entry.points}</td>
                  <td className="px-2 py-2 text-right font-mono text-text-secondary">{entry.goalDifference}</td>
                  <td className="px-2 py-2 text-right font-mono text-text-secondary">{entry.goalsFor}</td>
                  <td className="px-2 py-2">
                    <QualificationBadge status={entry.status} unresolved={entry.unresolvedTiebreaker} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QualificationBadge({
  status,
  unresolved,
}: {
  status: QualificationStatus;
  unresolved?: boolean;
}) {
  if (unresolved && (status === 'pending' || status === 'third_place_pending')) {
    return (
      <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono uppercase text-amber-200">
        Desempate pendiente
      </span>
    );
  }

  const styles: Record<QualificationStatus, string> = {
    group_winner: 'border-green-500/30 bg-green-500/10 text-green-300',
    group_runner_up: 'border-green-500/30 bg-green-500/10 text-green-300',
    third_place_qualified: 'border-gold/40 bg-gold/10 text-gold',
    third_place_pending: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    eliminated: 'border-red-500/30 bg-red-500/10 text-red-300',
    pending: 'border-border-subtle bg-surface/50 text-text-muted',
  };
  const labels: Record<QualificationStatus, string> = {
    group_winner: '1ro clasifica',
    group_runner_up: '2do clasifica',
    third_place_qualified: '3ro clasifica',
    third_place_pending: '3ro pendiente',
    eliminated: 'Eliminado',
    pending: 'Pendiente',
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
