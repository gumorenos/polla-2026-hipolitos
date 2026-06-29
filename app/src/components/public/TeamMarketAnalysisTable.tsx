'use client';

import { useMemo, useState } from 'react';
import {
  DEFAULT_TEAM_MARKET_FILTER,
  filterTeamMarketRows,
  sortTeamMarketRows,
  TEAM_MARKET_FILTER_OPTIONS,
  type SortDirection,
  type TeamMarketAnalysisRow,
  type TeamMarketFilter,
  type TeamMarketSortKey,
} from '../../lib/public-team-market-analysis';
import { formatLeagueCurrency } from '../../lib/utils/currency';

type TeamMarketAnalysisTableProps = {
  teamsReport: TeamMarketAnalysisRow[];
  currency: string;
  showOdds: boolean;
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function getTournamentStatusLabel(status?: string | null): string {
  if (status === 'champion') return 'Campeón';
  if (status === 'runner_up') return 'Subcampeón';
  if (status === 'eliminated') return 'Eliminado';
  if (status === 'active') return 'Vivo';
  return 'Sin estado confirmado';
}

function statusTone(status?: string | null): string {
  if (status === 'champion') return 'border-gold-500/50 bg-gold-400/10 text-gold-400';
  if (status === 'eliminated' || status === 'runner_up') {
    return 'border-red-500/30 bg-red-500/10 text-red-400 opacity-70';
  }
  if (status === 'active') return 'border-green-500/30 bg-green-500/10 text-green-400';
  return 'border-border-subtle bg-bg-secondary/30 text-text-secondary';
}

function classificationTone(classificationKey: string): string {
  if (classificationKey === 'out') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (classificationKey === 'favorite_differential') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (classificationKey === 'favorite_shared') return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
  if (classificationKey === 'longshot_exclusive') return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
  if (classificationKey === 'longshot_shared') return 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300';
  if (classificationKey === 'medium_market_pick') return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  if (classificationKey === 'concentrated_pick') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  if (classificationKey === 'picked_no_odds') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
  return 'border-border-subtle bg-surface/50 text-text-muted';
}

function classificationDescription(classificationKey: string): string {
  const descriptions: Record<string, string> = {
    out: 'El equipo ya no puede ser campeón.',
    no_picks: 'Ningún participante eligió este equipo.',
    picked_no_odds: 'Hay picks, pero no existe una cuota de campeón disponible.',
    favorite_differential: 'Alta probabilidad de mercado y solo un participante lo eligió.',
    favorite_shared: 'Alta probabilidad de mercado, pero el premio se compartiría.',
    longshot_exclusive: 'Baja probabilidad de mercado y un único participante lo eligió.',
    longshot_shared: 'Baja probabilidad de mercado y el premio se compartiría.',
    medium_market_pick: 'Probabilidad de mercado intermedia.',
    concentrated_pick: 'Tiene más picks de lo esperable frente a su probabilidad de mercado.',
  };
  return descriptions[classificationKey] || 'Clasificación orientativa del pick.';
}

export function TeamMarketAnalysisTable({
  teamsReport,
  currency,
  showOdds,
}: TeamMarketAnalysisTableProps) {
  const [filter, setFilter] = useState<TeamMarketFilter>(DEFAULT_TEAM_MARKET_FILTER);
  const [sortKey, setSortKey] = useState<TeamMarketSortKey>('pickCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const visibleRows = useMemo(() => {
    const filtered = filterTeamMarketRows(teamsReport, filter);
    return sortTeamMarketRows(filtered, sortKey, sortDirection);
  }, [filter, sortDirection, sortKey, teamsReport]);

  const availableFilters = TEAM_MARKET_FILTER_OPTIONS.filter((option) => showOdds || !option.requiresOdds);
  const noChampionOddsLoaded = showOdds
    && teamsReport.length > 0
    && teamsReport.every((team) => team.decimalOdds === null);

  const toggleSort = (nextSortKey: TeamMarketSortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === 'teamName' ? 'asc' : 'desc');
  };

  const sortIndicator = (column: TeamMarketSortKey) => (
    sortKey === column ? (sortDirection === 'asc' ? '↑' : '↓') : null
  );

  const sortableHeader = (
    label: string,
    column: TeamMarketSortKey,
    className: string,
  ) => (
    <th className={className} aria-sort={sortKey === column ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className={`inline-flex w-full items-center gap-1 hover:text-gold-400 transition-colors ${
          column === 'teamName' ? 'justify-start' : 'justify-center'
        }`}
      >
        <span>{label}</span>
        <span className="w-3 text-gold-400" aria-hidden="true">{sortIndicator(column)}</span>
      </button>
    </th>
  );

  return (
    <div className="card-base overflow-hidden">
      <div className="px-4 py-3 bg-bg-secondary/60 border-b border-border-subtle space-y-3">
        <div>
          <h3 className="font-display text-lg uppercase tracking-wide text-text-primary">Análisis de Equipos y Mercado</h3>
          <p className="text-[10px] text-text-muted font-mono uppercase">Equipos relevantes detectados</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtros del análisis de equipos">
          {availableFilters.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-mono font-semibold transition-colors ${
                filter === option.value
                  ? 'border-gold-500 bg-gold-400/15 text-gold-400'
                  : 'border-border-default bg-bg-tertiary text-text-secondary hover:border-border-active hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {noChampionOddsLoaded && (
        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-xs">
          Aún no hay cuotas de campeón cargadas. Un administrador puede importarlas desde Admin &gt; Odds &gt; Cuotas de campeón.
        </div>
      )}

      <details className="border-b border-border-subtle bg-bg-secondary/20 px-4 py-2 text-xs text-text-secondary">
        <summary className="cursor-pointer font-semibold text-text-primary">Qué significan las etiquetas</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <p><strong>Favorito diferencial / compartido:</strong> alta probabilidad con uno o varios picks.</p>
          <p><strong>Longshot exclusivo / compartido:</strong> baja probabilidad con uno o varios picks.</p>
          <p><strong>Pick de mercado medio:</strong> probabilidad intermedia.</p>
          <p><strong>Pick concentrado:</strong> más picks de lo esperable frente a su probabilidad.</p>
          <p><strong>Sin picks / Pick sin cuota:</strong> nadie lo eligió, o fue elegido sin cuota disponible.</p>
          <p><strong>Fuera de carrera:</strong> el equipo ya no puede ser campeón.</p>
          <p><strong>Vivo / Eliminado:</strong> estado deportivo actual del equipo.</p>
          <p><strong>EV positivo:</strong> estimación mayor a cero; no representa un pago garantizado.</p>
        </div>
      </details>

      {visibleRows.length === 0 ? (
        <p className="p-6 text-sm text-text-secondary">No hay equipos reales que coincidan con este filtro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="text-[9px] font-mono uppercase text-text-muted bg-black/10 border-b border-border-subtle/50">
              <tr>
                {sortableHeader('Equipo', 'teamName', 'px-3 py-2 text-left min-w-44')}
                <th className="px-3 py-2 text-center w-24">Estado</th>
                {sortableHeader('Picks', 'pickCount', 'px-3 py-2 text-center w-24')}
                {sortableHeader('% Picks', 'pickPercentage', 'px-3 py-2 text-center w-24')}
                <th className="px-3 py-2">Tipo de Pick</th>
                {showOdds && (
                  <>
                    {sortableHeader('Prob. Mercado', 'marketProbability', 'px-3 py-2 text-center w-28')}
                    {sortableHeader('Cuota campeón', 'decimalOdds', 'px-3 py-2 text-center w-28')}
                    {sortableHeader('Prob. Simulada', 'simulatedProbability', 'px-3 py-2 text-center w-28')}
                    {sortableHeader('EV Estimado', 'expectedValue', 'px-3 py-2 text-center w-28')}
                    {sortableHeader('EV Indiv.', 'individualExpectedValue', 'px-3 py-2 text-center w-28')}
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/30">
              {visibleRows.map((team) => (
                <tr key={team.teamCode} className={`hover:bg-bg-hover/30 transition-colors ${team.status === 'eliminated' || team.status === 'runner_up' ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-text-primary">{team.teamName}</span>
                    <span className="ml-1 text-[10px] text-text-muted font-mono uppercase">({team.teamCode})</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase ${statusTone(team.status)}`}>
                      {getTournamentStatusLabel(team.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-text-primary">
                    {team.pickCount > 0 ? team.pickCount : <span className="text-text-muted">Sin picks</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-text-secondary">{formatPercent(team.pickPercentage)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      title={classificationDescription(team.classificationKey)}
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${classificationTone(team.classificationKey)}`}
                    >
                      {team.classificationLabel}
                    </span>
                  </td>
                  {showOdds && (
                    <>
                      <td className="px-3 py-2.5 text-center font-mono text-text-primary">
                        {team.marketProbability !== null ? formatPercent(team.marketProbability) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-text-primary">
                        {team.decimalOdds !== null ? team.decimalOdds.toFixed(2) : <span className="text-text-muted">Sin cuota</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-gold-400 font-semibold">
                        {team.simulatedProbability !== null ? formatPercent(team.simulatedProbability) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-text-secondary">
                        {team.expectedValue !== null ? formatLeagueCurrency(team.expectedValue, currency) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-text-secondary">
                        {team.individualExpectedValue !== null
                          ? formatLeagueCurrency(team.individualExpectedValue, currency)
                          : '—'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
