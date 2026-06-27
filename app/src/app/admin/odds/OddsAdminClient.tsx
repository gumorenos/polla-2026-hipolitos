'use client';

import React, { useState } from 'react';
import { RefreshCw, BarChart2, ShieldAlert, CheckCircle, Database, History, Trash2, ShieldCheck, Play, KeyRound, PlugZap, Power, Tags, Link2, Ban } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FlagDisc } from '../../../components/ui/FlagDisc';
import { MatchOddsBar } from '../../../components/ui/MatchOddsBar';
import { fmtDate, fmtTime } from '../../../lib/utils/dates';
import {
  refreshGlobalOddsAction,
  refreshH2HAction,
  fetchMissingH2HAction,
  cleanupSimulatedDataAction,
} from '../../../lib/actions/odds';
import {
  deactivateProviderCredentialAction,
  deleteProviderCredentialAction,
  saveProviderCredentialAction,
  testProviderConnectionAction,
} from '../../../lib/actions/provider-credentials';
import {
  ignoreProviderTeamOutcomeAction,
  linkProviderTeamOutcomeAction,
  seedSuggestedTeamAliasesAction,
} from '../../../lib/actions/team-aliases';

interface ProviderAdminInfo {
  provider: 'the-odds-api' | 'odds-api-io' | 'football-data' | 'api-football';
  name: string;
  configured: boolean;
  maskedApiKey: string | null;
  source: 'db' | 'env' | 'not_configured';
  isActive: boolean;
  hasStoredCredential: boolean;
  lastStatus: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  lastRequestsRemaining: number | null;
  lastRequestsUsed: number | null;
  lastRequestCost: number | null;
  lastResetAt: string | null;
  lastResetInSeconds: number | null;
}

interface MappingTeamInfo {
  code: string;
  name: string;
}

interface ProviderTeamOutcomeInfo {
  id: string;
  provider: string;
  marketType: string;
  rawName: string;
  normalizedName: string;
  status: string;
  confidence: number | null;
  reason: string | null;
  suggestedTeamCode: string | null;
  suggestedTeamName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface MatchAdminInfo {
  id: string;
  homeTeamCode: string;
  homeTeamName: string;
  awayTeamCode: string;
  awayTeamName: string;
  kickoffUtc: string;
  status: string;
  group?: string | null;
  phase?: string;
  globalOdds: {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    bookmaker: string;
    capturedAt: string;
  } | null;
  h2h: {
    totalMatches: number;
    homeWins: number;
    draws: number;
    awayWins: number;
  } | null;
}

interface OddsAdminClientProps {
  matches: MatchAdminInfo[];
  apiStatus: {
    oddsApiIo: boolean;
    theOddsApi: boolean;
    apiFootball: boolean;
    simulatedAllowed: boolean;
  };
  lastSuccessfulOdds: string | null;
  lastSuccessfulH2h: string | null;
  lastOddsError: string | null;
  lastH2hError: string | null;
  realSnapshotsCount: { odds: number; h2h: number };
  simulatedSnapshotsCount: { odds: number; h2h: number };
  oddsDisplayEnabled: boolean;
  oddsManualUserRefreshEnabled: boolean;
  futureMatchesCount: number;
  nextFutureMatch: {
    id: string;
    homeTeamCode: string;
    homeTeamName: string;
    awayTeamCode: string;
    awayTeamName: string;
    kickoffUtc: string;
  } | null;
  globalOddsCount: number;
  privateOddsCount: number;
  futureMatchesWithoutGlobalOddsCount: number;
  futureMatchesWithoutH2HCount: number;
  cooldownMap: Record<string, {
    cooldownUntil: string;
    lastStatus: number | null;
    lastErrorMessage: string | null;
    updatedAt: string;
  }>;
  lastFallbackSuccessTime: string | null;
  providerConfigs: ProviderAdminInfo[];
  encryptionConfigured: boolean;
  mappingTeams: MappingTeamInfo[];
  teamAliasCount: number;
  providerTeamOutcomes: ProviderTeamOutcomeInfo[];
}

export const OddsAdminClient: React.FC<OddsAdminClientProps> = ({
  matches,
  apiStatus,
  lastSuccessfulOdds,
  lastSuccessfulH2h,
  lastOddsError,
  lastH2hError,
  realSnapshotsCount,
  simulatedSnapshotsCount,
  oddsDisplayEnabled,
  oddsManualUserRefreshEnabled,
  futureMatchesCount,
  nextFutureMatch,
  globalOddsCount,
  privateOddsCount,
  futureMatchesWithoutGlobalOddsCount,
  futureMatchesWithoutH2HCount,
  cooldownMap,
  lastFallbackSuccessTime,
  providerConfigs,
  encryptionConfigured,
  mappingTeams,
  teamAliasCount,
  providerTeamOutcomes,
}) => {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<'all' | 'today' | 'future' | 'noOdds' | 'noH2H' | 'groups' | 'knockouts' | 'error'>('all');
  const [loadingMap, setLoadingMap] = useState<Record<string, 'odds' | 'h2h' | null>>({});
  const [globalLoading, setGlobalLoading] = useState<'odds' | 'h2h' | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const [aliasLoading, setAliasLoading] = useState<string | null>(null);
  const [mappingSelection, setMappingSelection] = useState<Record<string, string>>({});

  const runProviderAction = async (
    provider: ProviderAdminInfo,
    action: 'save' | 'test' | 'deactivate' | 'delete',
  ) => {
    if (action === 'delete' && !confirm(`¿Eliminar la API key almacenada de ${provider.name}?`)) {
      return;
    }

    setProviderLoading(`${provider.provider}:${action}`);
    setStatusMsg(null);
    const result = action === 'save'
      ? await saveProviderCredentialAction(provider.provider, providerKeys[provider.provider] ?? '')
      : action === 'test'
        ? await testProviderConnectionAction(provider.provider)
        : action === 'deactivate'
          ? await deactivateProviderCredentialAction(provider.provider)
          : await deleteProviderCredentialAction(provider.provider);

    setStatusMsg({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) {
      if (action === 'save') {
        setProviderKeys((current) => ({ ...current, [provider.provider]: '' }));
      }
      router.refresh();
    }
    setProviderLoading(null);
  };

  const handleSeedAliases = async () => {
    setAliasLoading('seed');
    setStatusMsg(null);
    const result = await seedSuggestedTeamAliasesAction();
    setStatusMsg({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) router.refresh();
    setAliasLoading(null);
  };

  const handleLinkOutcome = async (outcome: ProviderTeamOutcomeInfo) => {
    const teamCode = mappingSelection[outcome.id] ?? outcome.suggestedTeamCode ?? '';
    if (!teamCode) {
      setStatusMsg({ type: 'error', text: 'Selecciona un equipo local.' });
      return;
    }
    setAliasLoading(outcome.id);
    setStatusMsg(null);
    const result = await linkProviderTeamOutcomeAction(outcome.id, teamCode);
    setStatusMsg({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) router.refresh();
    setAliasLoading(null);
  };

  const handleIgnoreOutcome = async (outcomeId: string) => {
    setAliasLoading(outcomeId);
    setStatusMsg(null);
    const result = await ignoreProviderTeamOutcomeAction(outcomeId);
    setStatusMsg({ type: result.success ? 'success' : 'error', text: result.message });
    if (result.success) router.refresh();
    setAliasLoading(null);
  };

  const filteredMatches = matches.filter((m) => {
    if (filter === 'all') return true;
    if (filter === 'today') {
      const matchDateStr = new Date(m.kickoffUtc).toDateString();
      const todayStr = new Date(now).toDateString();
      return matchDateStr === todayStr;
    }
    if (filter === 'future') {
      return new Date(m.kickoffUtc).getTime() > now;
    }
    if (filter === 'noOdds') {
      const hasOdds = m.globalOdds && m.globalOdds.bookmaker !== 'LaPolla 2026 Simulator';
      return !hasOdds;
    }
    if (filter === 'noH2H') {
      return !m.h2h;
    }
    if (filter === 'groups') {
      return m.phase === 'groups';
    }
    if (filter === 'knockouts') {
      return m.phase !== 'groups';
    }
    if (filter === 'error') {
      const hasOdds = m.globalOdds && m.globalOdds.bookmaker !== 'LaPolla 2026 Simulator';
      return !hasOdds || !m.h2h;
    }
    return true;
  });

  const handleRefreshSingleOdds = async (matchId: string) => {
    setLoadingMap(prev => ({ ...prev, [matchId]: 'odds' }));
    setStatusMsg(null);
    const res = await refreshGlobalOddsAction({ matchId });
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else if (res.summary) {
      setStatusMsg({
        type: 'success',
        text: `Cuotas actualizadas para este partido usando: ${res.summary.primaryProviderErrors > 0 ? 'fallback (the-odds-api)' : 'proveedor principal'}.`
      });
    } else {
      setStatusMsg({ type: 'success', text: 'Cuotas globales actualizadas correctamente.' });
    }
    setLoadingMap(prev => ({ ...prev, [matchId]: null }));
  };

  const handleRefreshSingleH2H = async (matchId: string) => {
    setLoadingMap(prev => ({ ...prev, [matchId]: 'h2h' }));
    setStatusMsg(null);
    const res = await refreshH2HAction(matchId);
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else {
      setStatusMsg({ type: 'success', text: 'Estadísticas H2H actualizadas correctamente.' });
    }
    setLoadingMap(prev => ({ ...prev, [matchId]: null }));
  };

  const handleRefreshGlobalOdds = async (limit?: number, lookaheadHours?: number) => {
    setGlobalLoading('odds');
    setStatusMsg(null);
    const res = await refreshGlobalOddsAction({ limit, lookaheadHours });
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else if (res.summary) {
      const s = res.summary;
      setStatusMsg({
        type: 'success',
        text: `Procesados: ${s.matchesProcessed}. Snapshots creados: ${s.snapshotsCreated}. Errores proveedor principal: ${s.primaryProviderErrors}. Éxitos fallback: ${s.fallbackSuccesses}. Omitidos: ${s.skipped}.`
      });
    } else {
      setStatusMsg({ type: 'success', text: 'Cuotas globales actualizadas.' });
    }
    setGlobalLoading(null);
  };

  const handleFetchMissingH2H = async (limit?: number, futureOnly?: boolean) => {
    setGlobalLoading('h2h');
    setStatusMsg(null);
    const res = await fetchMissingH2HAction({ limit, futureOnly });
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else if (res.summary) {
      const s = res.summary;
      setStatusMsg({
        type: 'success',
        text: `Buscar H2H finalizado. Creados: ${s.created}. Omitidos: ${s.skipped}. Procesados: ${s.processed}.${s.rateLimited ? ' [ALERTA: Proveedor en Cooldown/Rate-limited]' : ''}`
      });
    } else {
      setStatusMsg({ type: 'success', text: `Se poblaron estadísticas H2H.` });
    }
    setGlobalLoading(null);
  };

  const handleCleanupSimulatedData = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar TODOS los datos simulados de la base de datos?')) {
      return;
    }
    setGlobalLoading('h2h');
    setStatusMsg(null);
    const res = await cleanupSimulatedDataAction();
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else {
      setStatusMsg({
        type: 'success',
        text: `Datos simulados eliminados correctamente (${res.deletedOddsCount} cuotas, ${res.deletedH2hCount} H2H).`,
      });
    }
    setGlobalLoading(null);
  };

  const hasRealOdds = matches.some(m => m.globalOdds && m.globalOdds.bookmaker !== 'LaPolla 2026 Simulator');
  const hasRealH2h = matches.some(m => m.h2h !== null);
  const hasNoRealData = !hasRealOdds && !hasRealH2h;

  const renderProviderStatus = (name: string, isConfigured: boolean, key: string) => {
    const cooldownInfo = cooldownMap[key];
    const isCoolingDown = cooldownInfo && new Date(cooldownInfo.cooldownUntil) > new Date();
    
    let badgeText = 'INACTIVO';
    let badgeColor = 'bg-red-500/10 text-red-400 border-red-500/30';
    
    if (isConfigured) {
      if (isCoolingDown) {
        badgeText = 'COOLDOWN';
        badgeColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      } else {
        badgeText = 'ACTIVO';
        badgeColor = 'bg-green-500/10 text-green-400 border-green-500/30';
      }
    }

    return (
      <div className="card-base p-4 flex flex-col justify-between border-border-default/60 space-y-2">
        <div className="flex justify-between items-start flex-wrap gap-1">
          <span className="text-[10px] text-text-secondary uppercase font-mono">{name}</span>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
            {badgeText}
          </span>
        </div>
        <div className="text-[10px] text-text-secondary font-mono space-y-0.5">
          {isCoolingDown && cooldownInfo && (
            <p className="text-yellow-400/90 font-semibold truncate">
              Cooldown hasta: {new Date(cooldownInfo.cooldownUntil).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {cooldownInfo && cooldownInfo.lastStatus && (
            <p>Status: {cooldownInfo.lastStatus}</p>
          )}
          {cooldownInfo && cooldownInfo.lastErrorMessage && (
            <details className="mt-1 text-[10px] cursor-pointer">
              <summary className="hover:text-text-primary text-[9px] text-red-400/90 font-mono font-semibold">Ver error</summary>
              <div className="mt-1 p-1 bg-black/35 rounded border border-border-default/45 font-mono text-[9px] break-words whitespace-pre-wrap max-h-20 overflow-y-auto">
                <p><strong>Msg:</strong> {cooldownInfo.lastErrorMessage}</p>
                <p><strong>Hora:</strong> {new Date(cooldownInfo.updatedAt).toLocaleTimeString('es-PE')}</p>
              </div>
            </details>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="provider-configuration-title">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 id="provider-configuration-title" className="font-display text-xl text-text-primary flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-gold-400" />
              CONFIGURACIÓN DE PROVEEDORES
            </h3>
            <p className="text-xs text-text-secondary">Credenciales cifradas, estado y consumo de API.</p>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded border ${
            encryptionConfigured
              ? 'bg-green-500/10 text-green-400 border-green-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            CIFRADO {encryptionConfigured ? 'ACTIVO' : 'NO CONFIGURADO'}
          </span>
        </div>

        {!encryptionConfigured && (
          <div className="border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2 rounded">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Configura API_KEYS_ENCRYPTION_SECRET en el servidor para guardar o reemplazar API keys.</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {providerConfigs.map((provider) => {
            const sourceLabel = provider.source === 'db'
              ? 'Base de datos cifrada'
              : provider.source === 'env'
                ? 'Variable de entorno'
                : 'No configurado';
            const isBusy = providerLoading?.startsWith(`${provider.provider}:`) ?? false;
            const hasQuota = provider.lastRequestsRemaining !== null
              || provider.lastRequestsUsed !== null
              || provider.lastRequestCost !== null
              || provider.lastResetInSeconds !== null
              || provider.lastResetAt !== null;

            return (
              <article key={provider.provider} className="card-base p-4 border-border-default/70 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">{provider.name}</h4>
                    <p className="text-[11px] text-text-secondary font-mono">{sourceLabel}</p>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-1 rounded border ${
                    provider.configured
                      ? 'bg-green-500/10 text-green-400 border-green-500/30'
                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}>
                    {provider.configured ? 'CONFIGURADO' : 'SIN CONFIGURAR'}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                  <div>
                    <dt className="text-text-secondary">Estado efectivo</dt>
                    <dd className="font-mono text-text-primary">{provider.isActive ? 'Activo' : 'Inactivo'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">API key</dt>
                    <dd className="font-mono text-text-primary">{provider.maskedApiKey ?? 'No disponible'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Último estado</dt>
                    <dd className="font-mono text-text-primary">{provider.lastStatus ?? 'Sin comprobar'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Peticiones restantes</dt>
                    <dd className="font-mono text-text-primary">{provider.lastRequestsRemaining ?? 'No disponible'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Peticiones usadas</dt>
                    <dd className="font-mono text-text-primary">{provider.lastRequestsUsed ?? 'No disponible'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Costo última petición</dt>
                    <dd className="font-mono text-text-primary">{provider.lastRequestCost ?? 'No disponible'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Reinicio</dt>
                    <dd className="font-mono text-text-primary">
                      {provider.lastResetInSeconds !== null
                        ? `${provider.lastResetInSeconds} s`
                        : provider.lastResetAt
                          ? new Date(provider.lastResetAt).toLocaleString('es-PE')
                          : 'No disponible'}
                    </dd>
                  </div>
                </dl>

                {!hasQuota && provider.lastCheckedAt && (
                  <p className="text-[10px] text-text-secondary">No disponible por este proveedor.</p>
                )}
                {provider.lastCheckedAt && (
                  <p className="text-[10px] text-text-secondary">
                    Última comprobación: {new Date(provider.lastCheckedAt).toLocaleString('es-PE')}
                  </p>
                )}
                {provider.lastError && (
                  <p className="text-[10px] text-red-300 border-l-2 border-red-500/50 pl-2 break-words">
                    {provider.lastError}
                  </p>
                )}

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={providerKeys[provider.provider] ?? ''}
                    onChange={(event) => setProviderKeys((current) => ({
                      ...current,
                      [provider.provider]: event.target.value,
                    }))}
                    placeholder="Nueva API key"
                    aria-label={`API key de ${provider.name}`}
                    autoComplete="new-password"
                    disabled={!encryptionConfigured || isBusy}
                    className="min-w-0 flex-1 bg-bg-elevated border border-border-default rounded px-3 py-2 text-xs text-text-primary disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => runProviderAction(provider, 'save')}
                    disabled={!encryptionConfigured || !(providerKeys[provider.provider] ?? '').trim() || isBusy}
                    className="btn-primary px-3 py-2 text-xs disabled:opacity-50"
                  >
                    {provider.hasStoredCredential ? 'Reemplazar' : 'Configurar'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runProviderAction(provider, 'test')}
                    disabled={!provider.configured || isBusy}
                    className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <PlugZap className="w-3.5 h-3.5" />
                    Probar conexión
                  </button>
                  {provider.hasStoredCredential && (
                    <>
                      <button
                        type="button"
                        onClick={() => runProviderAction(provider, 'deactivate')}
                        disabled={isBusy || !provider.isActive}
                        className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Desactivar
                      </button>
                      <button
                        type="button"
                        onClick={() => runProviderAction(provider, 'delete')}
                        disabled={isBusy}
                        className="px-3 py-2 text-xs text-red-300 border border-red-500/30 rounded hover:bg-red-500/10 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar key
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="team-mapping-title">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 id="team-mapping-title" className="font-display text-xl text-text-primary flex items-center gap-2">
              <Tags className="w-5 h-5 text-gold-400" />
              MAPEO DE EQUIPOS POR PROVEEDOR
            </h3>
            <p className="text-xs text-text-secondary">
              {teamAliasCount} aliases guardados · {providerTeamOutcomes.length} nombres observados
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeedAliases}
            disabled={aliasLoading !== null}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-2 disabled:opacity-50"
          >
            <Tags className="w-4 h-4" />
            Crear aliases sugeridos
          </button>
        </div>

        {providerTeamOutcomes.length === 0 ? (
          <div className="border border-border-default bg-bg-elevated p-4 rounded text-xs text-text-secondary">
            Todavía no hay nombres de equipos observados en respuestas de proveedores.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {providerTeamOutcomes.map((outcome) => {
              const statusClass = outcome.status === 'matched'
                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                : outcome.status === 'ambiguous'
                  ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
                  : outcome.status === 'ignored'
                    ? 'bg-slate-500/10 text-slate-300 border-slate-500/30'
                    : 'bg-red-500/10 text-red-300 border-red-500/30';
              const selectedTeam = mappingSelection[outcome.id] ?? outcome.suggestedTeamCode ?? '';
              const busy = aliasLoading === outcome.id;

              return (
                <article key={outcome.id} className="card-base p-4 border-border-default/70 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary break-words">{outcome.rawName}</p>
                      <p className="text-[10px] text-text-secondary font-mono break-words">{outcome.normalizedName}</p>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-2 py-1 rounded border ${statusClass}`}>
                      {outcome.status.toUpperCase()}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <dt className="text-text-secondary">Proveedor</dt>
                      <dd className="font-mono text-text-primary">{outcome.provider}</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Contexto</dt>
                      <dd className="font-mono text-text-primary">{outcome.marketType}</dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Equipo local</dt>
                      <dd className="font-mono text-text-primary">
                        {outcome.suggestedTeamCode
                          ? `${outcome.suggestedTeamCode} · ${outcome.suggestedTeamName ?? ''}`
                          : 'Sin vincular'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Confianza</dt>
                      <dd className="font-mono text-text-primary">
                        {outcome.confidence !== null ? `${Math.round(outcome.confidence * 100)}%` : 'No disponible'}
                      </dd>
                    </div>
                  </dl>

                  {outcome.reason && (
                    <p className="text-[10px] text-text-secondary border-l-2 border-border-default pl-2">
                      {outcome.reason}
                    </p>
                  )}

                  {outcome.status !== 'ignored' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedTeam}
                        onChange={(event) => setMappingSelection((current) => ({
                          ...current,
                          [outcome.id]: event.target.value,
                        }))}
                        disabled={busy}
                        aria-label={`Equipo local para ${outcome.rawName}`}
                        className="min-w-0 flex-1 bg-bg-elevated border border-border-default rounded px-3 py-2 text-xs text-text-primary disabled:opacity-50"
                      >
                        <option value="">Seleccionar equipo</option>
                        {mappingTeams.map((team) => (
                          <option key={team.code} value={team.code}>{team.code} · {team.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleLinkOutcome(outcome)}
                        disabled={busy || !selectedTeam}
                        className="btn-primary px-3 py-2 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Vincular / crear alias
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIgnoreOutcome(outcome.id)}
                        disabled={busy}
                        className="btn-secondary px-3 py-2 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Ignorar
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* API Providers Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderProviderStatus('Odds-API.io (Primary)', apiStatus.oddsApiIo, 'odds-api-io')}
        {renderProviderStatus('The Odds API (Fallback)', apiStatus.theOddsApi, 'the-odds-api')}
        {renderProviderStatus('API-Football (H2H)', apiStatus.apiFootball, 'api-football')}

        <div className="card-base p-4 flex flex-col justify-between border-border-default/60 space-y-2">
          <div className="flex justify-between items-start flex-wrap gap-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">Datos simulados en Prod</span>
            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              apiStatus.simulatedAllowed 
                ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {apiStatus.simulatedAllowed ? 'HABILITADO' : 'BLOQUEADO'}
            </span>
          </div>
          <div className="text-[10px] text-text-secondary font-mono space-y-0.5">
            <p>Simulación: {apiStatus.simulatedAllowed ? 'Permitida (Desarrollo)' : 'Desactivada en producción'}</p>
            <p>Ref. manual: {oddsManualUserRefreshEnabled ? 'Permitida' : 'Bloqueada'}</p>
          </div>
        </div>
      </div>

      {/* Sync Status & Error Logs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-base p-4 border-border-default/60 space-y-2 text-sm">
          <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider font-mono text-gold-400">Sincronización (Reales)</h4>
          <div className="space-y-1 text-xs text-text-secondary font-mono">
            <p>Cuotas: {lastSuccessfulOdds ? new Date(lastSuccessfulOdds).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Ninguna'}</p>
            <p>H2H: {lastSuccessfulH2h ? new Date(lastSuccessfulH2h).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Ninguno'}</p>
            <p>Fallback OK: {lastFallbackSuccessTime ? new Date(lastFallbackSuccessTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}</p>
          </div>
        </div>

        <div className="card-base p-4 border-border-default/60 space-y-2 text-sm">
          <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider font-mono text-gold-400">BD Snapshot Counts</h4>
          <div className="space-y-1 text-xs text-text-secondary font-mono">
            <p>Globales: <strong className="text-text-primary">{globalOddsCount}</strong> · Privadas: <strong className="text-text-primary">{privateOddsCount}</strong></p>
            <p>Total Cuotas Reales: <strong className="text-text-primary">{realSnapshotsCount.odds}</strong></p>
            <p>H2H snapshots: <strong className="text-text-primary">{realSnapshotsCount.h2h}</strong></p>
            <p>Simuladas (cuotas/H2H): <strong className="text-text-primary">{simulatedSnapshotsCount.odds} / {simulatedSnapshotsCount.h2h}</strong></p>
          </div>
        </div>

        <div className="card-base p-4 border-border-default/60 space-y-2 text-sm">
          <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider font-mono text-gold-400">Partidos Restantes</h4>
          <div className="space-y-1 text-xs text-text-secondary font-mono">
            <p>Partidos Futuros: <strong className="text-text-primary">{futureMatchesCount}</strong></p>
            <p>Futuros sin Cuota Global: <strong className={futureMatchesWithoutGlobalOddsCount > 0 ? "text-yellow-400 font-bold" : "text-text-muted"}>{futureMatchesWithoutGlobalOddsCount}</strong></p>
            <p>Futuros sin H2H: <strong className={futureMatchesWithoutH2HCount > 0 ? "text-yellow-400 font-bold" : "text-text-muted"}>{futureMatchesWithoutH2HCount}</strong></p>
          </div>
        </div>

        <div className="card-base p-4 border-border-default/60 space-y-2 text-sm">
          <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider font-mono text-gold-400">Diagnóstico de Tiempos</h4>
          <div className="space-y-1 text-xs text-text-secondary font-mono">
            {nextFutureMatch ? (
              <div className="space-y-0.5 text-[10px]">
                <p className="font-bold text-gold-400">Próximo partido:</p>
                <p className="truncate">{nextFutureMatch.homeTeamCode} vs {nextFutureMatch.awayTeamCode} ({nextFutureMatch.id.substring(0, 8)})</p>
                <p>UTC: {new Date(nextFutureMatch.kickoffUtc).toISOString()}</p>
                <p>Lima: {new Date(nextFutureMatch.kickoffUtc).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</p>
              </div>
            ) : (
              <p className="text-[10px] text-text-muted italic">No hay partidos futuros detectados.</p>
            )}
          </div>
        </div>
      </div>

      {(lastOddsError || lastH2hError) && (
        <details className="card-base p-4 border-red-500/20 bg-red-500/5 text-sm cursor-pointer group">
          <summary className="font-semibold text-red-400 text-xs uppercase tracking-wider font-mono flex items-center justify-between">
            <span>Últimos Errores de Sincronización</span>
            <span className="text-[10px] text-text-muted group-open:hidden">Expandir para ver</span>
            <span className="text-[10px] text-text-muted hidden group-open:inline">Colapsar</span>
          </summary>
          <div className="mt-2 space-y-2 text-xs text-red-400/90 font-mono border-t border-red-500/10 pt-2 break-all">
            {lastOddsError && (
              <div>
                <span className="font-bold block text-red-300">Error de Cuotas:</span>
                <p className="pl-2 bg-black/20 p-1.5 rounded">{lastOddsError}</p>
              </div>
            )}
            {lastH2hError && (
              <div>
                <span className="font-bold block text-red-300">Error de H2H:</span>
                <p className="pl-2 bg-black/20 p-1.5 rounded">{lastH2hError}</p>
              </div>
            )}
          </div>
        </details>
      )}

      {hasNoRealData && (
        <div className="card-base p-6 border-yellow-500/20 bg-yellow-500/5 text-center space-y-2">
          <Database className="w-10 h-10 text-yellow-500/80 mx-auto" />
          <h3 className="font-semibold text-text-primary text-base">Sin datos reales guardados todavía</h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Aún no se han descargado datos reales de cuotas o H2H desde los proveedores externos. Puedes hacer una consulta global usando los botones de abajo.
          </p>
        </div>
      )}

      {/* Admin Action Buttons */}
      <div className="card-base p-5 border-border-default/60 space-y-4">
        <h4 className="font-semibold text-sm text-gold-400 uppercase tracking-wider font-mono">Controles de Actualización Global</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-xs text-text-secondary font-semibold uppercase tracking-wider block">Probabilidades (Odds)</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRefreshGlobalOdds(1, undefined)}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> Próximo Partido
              </button>
              <button
                type="button"
                onClick={() => handleRefreshGlobalOdds(5, undefined)}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> Próximos 5
              </button>
              <button
                type="button"
                onClick={() => handleRefreshGlobalOdds(10, undefined)}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> Próximos 10
              </button>
              <button
                type="button"
                onClick={() => handleRefreshGlobalOdds(20, 24)}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> Próximas 24 Horas
              </button>
              <button
                type="button"
                onClick={() => handleRefreshGlobalOdds(30, 48)}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> Próximas 48 Horas
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-text-secondary font-semibold uppercase tracking-wider block">Historial Enfrentamientos (H2H)</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleFetchMissingH2H(5, true)}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Database className="w-3 h-3" /> H2H Próximos 5 Faltantes
              </button>
              <button
                type="button"
                onClick={() => handleFetchMissingH2H(10, true)}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Database className="w-3 h-3" /> H2H Próximos 10 Faltantes
              </button>
              <button
                type="button"
                onClick={() => handleFetchMissingH2H(99, false)}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Database className="w-3 h-3 text-red-400" /> Buscar Todos los Faltantes (Lento)
              </button>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border-subtle flex justify-end">
          <button
            type="button"
            onClick={handleCleanupSimulatedData}
            disabled={globalLoading !== null}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar todos los datos simulados
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 animate-[slideUp_0.2s_ease-out] ${
          statusMsg.type === 'success' 
            ? 'bg-green-400/10 border-green-500/20 text-green-400' 
            : 'bg-red-400/10 border-red-500/20 text-red-400'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <ShieldAlert className="w-4 h-4 flex-shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Matches Grid */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-3">
          <h3 className="font-display text-2xl tracking-wide text-text-primary">Estado por Partido</h3>
          
          {/* Client-side Filters */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'today', label: 'Hoy' },
              { id: 'future', label: 'Futuros' },
              { id: 'noOdds', label: 'Sin Cuota' },
              { id: 'noH2H', label: 'Sin H2H' },
              { id: 'groups', label: 'Grupos' },
              { id: 'knockouts', label: 'Eliminatorias' },
              { id: 'error', label: 'Faltantes' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id as 'all' | 'today' | 'future' | 'noOdds' | 'noH2H' | 'groups' | 'knockouts' | 'error')}
                className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all border ${
                  filter === f.id
                    ? 'bg-gold-500/10 text-gold-400 border-gold-500/40 font-bold'
                    : 'bg-bg-secondary hover:bg-bg-hover text-text-secondary border-border-default/60 hover:border-gold-500/20'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        
        {filteredMatches.length === 0 ? (
          <div className="card-base p-8 text-center text-text-muted text-xs italic border-dashed border-border-default/60">
            No se encontraron partidos para el filtro seleccionado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMatches.map((m) => {
              const isLoadingOdds = loadingMap[m.id] === 'odds';
              const isLoadingH2H = loadingMap[m.id] === 'h2h';
              const hasOdds = m.globalOdds && m.globalOdds.bookmaker !== 'LaPolla 2026 Simulator';

              // Calculate implied probabilities if odds exist
              let homeProb = 0, drawProb = 0, awayProb = 0;
              if (hasOdds && m.globalOdds) {
                const homeImplied = 1 / m.globalOdds.homeOdds;
                const drawImplied = 1 / m.globalOdds.drawOdds;
                const awayImplied = 1 / m.globalOdds.awayOdds;
                const sumImplied = homeImplied + drawImplied + awayImplied;
                if (sumImplied > 0) {
                  homeProb = (homeImplied / sumImplied) * 100;
                  drawProb = (drawImplied / sumImplied) * 100;
                  awayProb = (awayImplied / sumImplied) * 100;
                }
              }

              return (
                <div key={m.id} className="card-base p-4 flex flex-col justify-between border-border-default/80 hover:border-border-active transition-all">
                  {/* Header */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-text-secondary border-b border-border-subtle pb-2 mb-3">
                    <span>ID: {m.id} · status: {m.status}</span>
                    <span>{fmtDate(m.kickoffUtc)} · {fmtTime(m.kickoffUtc)}</span>
                  </div>

                  {/* Team Info Row */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <FlagDisc code={m.homeTeamCode} size={24} />
                      <span className="font-bold text-sm text-text-primary">{m.homeTeamCode}</span>
                    </div>
                    <span className="text-xs text-text-muted font-bold font-mono">VS</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-text-primary">{m.awayTeamCode}</span>
                      <FlagDisc code={m.awayTeamCode} size={24} />
                    </div>
                  </div>

                  {/* Diagnostics Block */}
                  <div className="mt-3 bg-black/25 p-2 rounded-lg border border-border-default/60 text-[10px] font-mono text-text-secondary space-y-1">
                    <span className="font-semibold text-text-primary text-[11px] block border-b border-border-subtle pb-0.5">Diagnóstico de Tiempo (Admin)</span>
                    <p>Raw: <span className="text-text-primary">{new Date(m.kickoffUtc).getTime()} (ms)</span></p>
                    <p>UTC: <span className="text-text-primary">{new Date(m.kickoffUtc).toUTCString()}</span></p>
                    <p>Lima: <span className="text-text-primary">{new Date(m.kickoffUtc).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</span></p>
                    <p>Estado: <span className={new Date(m.kickoffUtc).getTime() > now ? "text-green-400 font-bold" : "text-red-400"}>{new Date(m.kickoffUtc).getTime() > now ? "Futuro (Abierto)" : "Pasado (Cerrado)"}</span></p>
                  </div>

                  {/* Odds Status Area */}
                  <div className="mt-3 bg-black/15 p-2 rounded-lg border border-border-subtle/50 text-[11px] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-text-secondary flex items-center gap-1">
                        <BarChart2 className="w-3.5 h-3.5 text-gold-400" />
                        Cuotas Globales:
                      </span>
                      {hasOdds && m.globalOdds ? (
                        <span className="text-[9px] text-text-muted font-mono">
                          Hace {Math.max(1, Math.round((now - new Date(m.globalOdds.capturedAt).getTime()) / 60000))}m ({m.globalOdds.bookmaker})
                        </span>
                      ) : (
                        <span className="text-[9px] text-red-400 font-mono">Falta Snapshot</span>
                      )}
                    </div>
                    {hasOdds && m.globalOdds ? (
                      <div className="pt-2">
                        <MatchOddsBar
                          homeOdds={m.globalOdds.homeOdds}
                          drawOdds={m.globalOdds.drawOdds}
                          awayOdds={m.globalOdds.awayOdds}
                          homeProbability={homeProb / 100}
                          drawProbability={drawProb / 100}
                          awayProbability={awayProb / 100}
                        />
                      </div>
                    ) : (
                      <p className="text-text-muted text-[10px] italic">No hay registros globales para este partido.</p>
                    )}
                  </div>

                  {/* H2H Status Area */}
                  <div className="mt-2 bg-black/15 p-2 rounded-lg border border-border-subtle/50 text-[11px] space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-text-secondary flex items-center gap-1">
                        <History className="w-3.5 h-3.5 text-gold-400" />
                        Estadísticas Históricas:
                      </span>
                      {!m.h2h && (
                        <span className="text-[9px] text-red-400 font-mono">Falta Snapshot</span>
                      )}
                    </div>
                    {m.h2h ? (
                      <p className="font-mono text-text-primary">
                        Jugados: <strong className="text-text-primary">{m.h2h.totalMatches}</strong> (L: {m.h2h.homeWins} - E: {m.h2h.draws} - V: {m.h2h.awayWins})
                      </p>
                    ) : (
                      <p className="text-text-muted text-[10px] italic">No hay registros H2H para este partido.</p>
                    )}
                  </div>

                  {/* Single Match Actions */}
                  <div className="mt-4 pt-3 border-t border-border-subtle/40 flex justify-end gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleRefreshSingleOdds(m.id)}
                      disabled={isLoadingOdds || globalLoading !== null}
                      className="px-2.5 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-[10px] font-mono rounded transition-colors flex items-center gap-1 text-text-primary disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingOdds ? 'animate-spin' : ''}`} />
                      {m.globalOdds ? 'Refrescar cuotas' : 'Buscar cuotas'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRefreshSingleH2H(m.id)}
                      disabled={isLoadingH2H || globalLoading !== null}
                      className="px-2.5 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-[10px] font-mono rounded transition-colors flex items-center gap-1 text-text-primary disabled:opacity-50"
                    >
                      <History className={`w-3 h-3 ${isLoadingH2H ? 'animate-spin' : ''}`} />
                      {m.h2h ? 'Refrescar H2H' : 'Buscar H2H'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
