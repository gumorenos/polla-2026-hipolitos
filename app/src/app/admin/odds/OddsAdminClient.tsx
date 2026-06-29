'use client';

import React, { useState } from 'react';
import { RefreshCw, BarChart2, ShieldAlert, CheckCircle, Database, History, Trash2, ShieldCheck, Play, KeyRound, PlugZap, Power, Tags, Link2, Ban, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FlagDisc } from '../../../components/ui/FlagDisc';
import { MatchOddsBar } from '../../../components/ui/MatchOddsBar';
import { fmtDate, fmtTime } from '../../../lib/utils/dates';
import {
  adminRefreshMatchOddsBulkAction,
  refreshGlobalOddsAction,
  refreshH2HAction,
  fetchMissingH2HAction,
  cleanupSimulatedDataAction,
} from '../../../lib/actions/odds';
import {
  type BulkMatchOddsMode,
  type BulkMatchOddsSummary,
} from '../../../lib/odds/bulk-match-odds';
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
import {
  adminDetectChampionMarkets,
  adminImportChampionOdds,
  adminPreviewChampionOdds,
} from '../../../lib/actions/champion-odds';
import type { TheOddsApiSport } from '../../../lib/odds/the-odds-api';
import {
  classifyChampionSport,
  INVALID_CHAMPION_SPORT_MESSAGE,
} from '../../../lib/odds/champion-sport-guardrails';

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

interface ChampionOddsPreview {
  sportKey: string;
  outcomeCount: number;
  sampleOutcomes: Array<{
    name: string;
    decimalOdds: number;
    bookmaker: string;
  }>;
}

interface SerializedTeamAlias {
  id: string;
  teamCode: string;
  provider: string;
  alias: string;
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
  teamAliases: SerializedTeamAlias[];
  championOddsSavedCount: number;
  matchedOutrightsCount: number;
  pendingOutrightsCount: number;
  matchedOutrightsWithoutSnapshot: string[];
  championSurvivorLeagues: Array<{ id: string; name: string }>;
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
  teamAliases,
  championOddsSavedCount,
  matchedOutrightsCount,
  pendingOutrightsCount,
  matchedOutrightsWithoutSnapshot,
  championSurvivorLeagues,
}) => {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<'all' | 'today' | 'future' | 'noOdds' | 'noH2H' | 'groups' | 'knockouts' | 'error'>('all');
  const [loadingMap, setLoadingMap] = useState<Record<string, 'odds' | 'h2h' | null>>({});
  const [globalLoading, setGlobalLoading] = useState<'odds' | 'h2h' | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkOddsSummary, setBulkOddsSummary] = useState<BulkMatchOddsSummary | null>(null);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const [aliasLoading, setAliasLoading] = useState<string | null>(null);
  const [mappingSelection, setMappingSelection] = useState<Record<string, string>>({});

  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [diagProvider, setDiagProvider] = useState<string>('the-odds-api');
  const [diagMarketType, setDiagMarketType] = useState<string>('outrights');
  const [diagStatus, setDiagStatus] = useState<string>('unmatched');

  const [championLoading, setChampionLoading] = useState<boolean>(false);
  const [championCandidates, setChampionCandidates] = useState<TheOddsApiSport[]>([]);
  const [championOtherSports, setChampionOtherSports] = useState<TheOddsApiSport[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [championPreview, setChampionPreview] = useState<ChampionOddsPreview | null>(null);
  const [selectedChampionLeagueId, setSelectedChampionLeagueId] = useState(
    championSurvivorLeagues[0]?.id || '',
  );

  const toggleTeamExpanded = (code: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const distinctTeamsCount = React.useMemo(() => {
    return new Set(teamAliases.map((a) => a.teamCode)).size;
  }, [teamAliases]);

  const globalAliasesCount = React.useMemo(() => {
    return teamAliases.filter((a) => a.provider === '*').length;
  }, [teamAliases]);

  const theOddsApiAliasesCount = React.useMemo(() => {
    return teamAliases.filter((a) => a.provider === 'the-odds-api').length;
  }, [teamAliases]);

  const footballDataAliasesCount = React.useMemo(() => {
    return teamAliases.filter((a) => a.provider === 'football-data').length;
  }, [teamAliases]);

  const apiFootballAliasesCount = React.useMemo(() => {
    return teamAliases.filter((a) => a.provider === 'api-football').length;
  }, [teamAliases]);

  const diagGroups = React.useMemo(() => {
    const groups: Record<string, number> = {};
    for (const outcome of providerTeamOutcomes) {
      const key = `${outcome.provider} | ${outcome.marketType} | ${outcome.status}`;
      groups[key] = (groups[key] || 0) + 1;
    }
    return Object.entries(groups).map(([name, count]) => ({ name, count }));
  }, [providerTeamOutcomes]);

  const groupedAliases = React.useMemo(() => {
    const map: Record<
      string,
      {
        teamCode: string;
        teamName: string;
        global: string[];
        byProvider: Record<string, string[]>;
        totalCount: number;
      }
    > = {};

    for (const team of mappingTeams) {
      map[team.code] = {
        teamCode: team.code,
        teamName: team.name,
        global: [],
        byProvider: {},
        totalCount: 0,
      };
    }

    for (const alias of teamAliases) {
      if (!map[alias.teamCode]) {
        map[alias.teamCode] = {
          teamCode: alias.teamCode,
          teamName: mappingTeams.find((t) => t.code === alias.teamCode)?.name || alias.teamCode,
          global: [],
          byProvider: {},
          totalCount: 0,
        };
      }
      map[alias.teamCode].totalCount++;
      if (alias.provider === '*') {
        map[alias.teamCode].global.push(alias.alias);
      } else {
        map[alias.teamCode].byProvider[alias.provider] ??= [];
        map[alias.teamCode].byProvider[alias.provider].push(alias.alias);
      }
    }

    return Object.values(map).filter((group) => group.totalCount > 0);
  }, [teamAliases, mappingTeams]);

  const filteredOutcomes = React.useMemo(() => {
    return providerTeamOutcomes.filter((outcome) => {
      if (diagProvider !== 'all' && outcome.provider !== diagProvider) return false;
      if (diagMarketType !== 'all' && outcome.marketType !== diagMarketType) return false;
      if (diagStatus !== 'all' && outcome.status !== diagStatus) return false;
      return true;
    });
  }, [providerTeamOutcomes, diagProvider, diagMarketType, diagStatus]);

  const normalizedSelectedSport = selectedSport.trim().toLowerCase();
  const selectedSportInfo = [...championCandidates, ...championOtherSports]
    .find((sport) => sport.key === normalizedSelectedSport);
  const selectedSportClassification = classifyChampionSport(selectedSportInfo ?? {
    key: normalizedSelectedSport,
    has_outrights: true,
  });
  const canPreviewChampionOdds = normalizedSelectedSport.length > 0
    && selectedSportClassification.recommended;
  const hasCurrentChampionPreview = championPreview?.sportKey === normalizedSelectedSport;

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

  const handleDetectChampionMarkets = async () => {
    setChampionLoading(true);
    setStatusMsg(null);
    try {
      const res = await adminDetectChampionMarkets();
      if ('error' in res) {
        setStatusMsg({ type: 'error', text: res.error ?? 'No se pudieron detectar mercados de campeón.' });
      } else {
        setChampionCandidates(res.candidates || []);
        setChampionOtherSports(res.otherSports || []);
        setChampionPreview(null);
        if (res.candidates && res.candidates.length > 0) {
          setSelectedSport(res.candidates[0].key);
        } else {
          setSelectedSport('');
        }
        setStatusMsg({
          type: 'success',
          text: `Detectados ${res.sports?.length ?? 0} mercados outright; ${res.candidates?.length ?? 0} recomendados para FIFA World Cup.`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMsg({ type: 'error', text: message });
    }
    setChampionLoading(false);
  };

  const handlePreviewChampionOdds = async () => {
    if (!canPreviewChampionOdds) {
      setChampionPreview(null);
      setStatusMsg({ type: 'error', text: INVALID_CHAMPION_SPORT_MESSAGE });
      return;
    }

    setChampionLoading(true);
    setStatusMsg(null);
    try {
      const res = await adminPreviewChampionOdds(normalizedSelectedSport);
      if ('error' in res) {
        setChampionPreview(null);
        setStatusMsg({ type: 'error', text: res.error ?? 'No se pudo previsualizar el mercado de campeón.' });
      } else {
        setChampionPreview({
          sportKey: res.sportKey,
          outcomeCount: res.outcomeCount,
          sampleOutcomes: res.sampleOutcomes,
        });
        setStatusMsg({
          type: 'success',
          text: `Previsualización lista: ${res.outcomeCount} cuotas encontradas. Todavía no se guardó ningún dato.`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setChampionPreview(null);
      setStatusMsg({ type: 'error', text: message });
    }
    setChampionLoading(false);
  };

  const handleImportChampionOdds = async () => {
    if (!selectedChampionLeagueId) {
      setStatusMsg({ type: 'error', text: 'Selecciona una competencia Champion Survivor activa.' });
      return;
    }
    if (!canPreviewChampionOdds) {
      setStatusMsg({ type: 'error', text: INVALID_CHAMPION_SPORT_MESSAGE });
      return;
    }
    if (!hasCurrentChampionPreview) {
      setStatusMsg({ type: 'error', text: 'Previsualiza este sport key antes de importar sus cuotas.' });
      return;
    }
    setChampionLoading(true);
    setStatusMsg(null);
    try {
      const res = await adminImportChampionOdds(selectedChampionLeagueId, normalizedSelectedSport);
      if ('error' in res) {
        setStatusMsg({ type: 'error', text: res.error ?? 'No se pudieron importar las cuotas de campeón.' });
      } else {
        setStatusMsg({ 
          type: 'success', 
          text: `Éxito. Coincidencias elegibles: ${res.matchedCount}, Sin coincidir: ${res.unmatchedCount}, Fuera del roster: ${res.skippedIneligibleCount}, Snapshots guardados: ${res.savedSnapshots}. ${res.unmatchedNames?.length ? `Nuevos sin coincidir: ${res.unmatchedNames.join(', ')}` : ''}`
        });
        router.refresh();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMsg({ type: 'error', text: message });
    }
    setChampionLoading(false);
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

  const handleBulkOddsRefresh = async (
    mode: BulkMatchOddsMode,
    options?: { limit?: number; lookaheadHours?: number },
  ) => {
    if (
      mode === 'future_all'
      && !window.confirm('Esta acción consultará nuevamente las cuotas de los partidos futuros seleccionados. ¿Continuar?')
    ) {
      return;
    }

    setGlobalLoading('odds');
    setStatusMsg(null);
    setBulkOddsSummary(null);
    try {
      const res = await adminRefreshMatchOddsBulkAction({ mode, ...options });
      if (!res.success) {
        setStatusMsg({ type: 'error', text: res.error });
        return;
      }

      const s = res.summary;
      setBulkOddsSummary(s);
      setStatusMsg({
        type: s.failed > 0 || s.stoppedEarly ? 'error' : 'success',
        text: `Elegibles: ${s.eligible}. Procesados: ${s.processed}. Actualizados: ${s.updated}. Omitidos: ${s.skipped}. Fallidos: ${s.failed}.`,
      });
      router.refresh();
    } catch {
      setStatusMsg({ type: 'error', text: 'No se pudo completar la actualización masiva de cuotas.' });
    } finally {
      setGlobalLoading(null);
    }
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

      <section className="space-y-6" aria-labelledby="team-mapping-title">
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border-subtle pb-2">
          <div>
            <h3 id="team-mapping-title" className="font-display text-2xl text-text-primary flex items-center gap-2">
              <Tags className="w-5 h-5 text-gold-400" />
              MAPEO DE EQUIPOS Y ALIASES
            </h3>
            <p className="text-xs text-text-secondary">
              Gestiona cómo se traducen los nombres de proveedores externos a códigos internos de equipos.
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

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card A: Alias Inventory */}
          <div className="card-base p-4 border-border-default/60 space-y-2">
            <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider font-mono text-gold-400">Inventario de Aliases</h4>
            <div className="space-y-1 text-xs text-text-secondary font-mono">
              <p>Aliases guardados: <strong className="text-text-primary">{teamAliasCount}</strong></p>
              <p>Equipos cubiertos: <strong className="text-text-primary">{distinctTeamsCount}</strong></p>
              <p className="pt-1 border-t border-border-subtle/50 text-[10px]">Desglose por proveedor:</p>
              <p className="text-[10px] pl-2">Globales (*): <span className="text-text-primary">{globalAliasesCount}</span></p>
              <p className="text-[10px] pl-2">The Odds API: <span className="text-text-primary">{theOddsApiAliasesCount}</span></p>
              <p className="text-[10px] pl-2">Football-Data: <span className="text-text-primary">{footballDataAliasesCount}</span></p>
              <p className="text-[10px] pl-2">API-Football: <span className="text-text-primary">{apiFootballAliasesCount}</span></p>
            </div>
          </div>

          {/* Card B: Champion Odds Coverage */}
          <div className="card-base p-4 border-border-default/60 space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider font-mono text-gold-400">Cobertura de Cuotas de Campeón</h4>
              <div className="space-y-1 text-xs text-text-secondary font-mono">
                <p>Cuotas guardadas: <strong className="text-text-primary">{championOddsSavedCount}</strong> equipos relevantes detectados</p>
                <p>Outrights matcheados: <strong className="text-text-primary">{matchedOutrightsCount}</strong></p>
                <p>Pendientes The Odds API: <strong className={pendingOutrightsCount > 0 ? "text-yellow-400 font-bold" : "text-text-muted"}>{pendingOutrightsCount}</strong></p>
              </div>
            </div>
            {matchedOutrightsWithoutSnapshot.length > 0 && (
              <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-[11px] rounded flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-yellow-400" />
                <div>
                  <p className="font-semibold">Equipos matcheados sin snapshot guardado</p>
                  <p className="text-[9px] text-text-secondary mt-0.5 leading-relaxed">
                    Hay {matchedOutrightsWithoutSnapshot.length} equipos matcheados sin snapshot. Reimporta cuotas de campeón para guardar snapshots con los aliases actuales.
                  </p>
                  <p className="text-[9px] text-text-muted font-bold truncate mt-0.5">
                    ({matchedOutrightsWithoutSnapshot.join(', ')})
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Card C: Observed Diagnostics Summary */}
          <div className="card-base p-4 border-border-default/60 space-y-2">
            <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider font-mono text-gold-400">Resumen de Diagnósticos</h4>
            <div className="max-h-[110px] overflow-y-auto pr-1 space-y-1 text-[10px] font-mono text-text-secondary">
              {diagGroups.length === 0 ? (
                <p className="text-text-muted italic">Sin diagnósticos registrados</p>
              ) : (
                diagGroups.map((g) => (
                  <div key={g.name} className="flex justify-between border-b border-border-subtle/30 py-0.5">
                    <span>{g.name}</span>
                    <strong className="text-text-primary">{g.count}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ALIASES BY TEAMCODE GROUPING */}
        <div className="space-y-2">
          <h4 className="font-display text-lg text-text-primary uppercase tracking-wide">
            Inventario de Aliases por Equipo
          </h4>
          <p className="text-xs text-text-secondary">
            Los aliases se agrupan por código de equipo. Los duplicados visuales se muestran consolidados bajo el equipo correspondiente.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {groupedAliases.map((group) => {
              const isExpanded = expandedTeams.has(group.teamCode);
              const providers = Object.keys(group.byProvider);
              return (
                <div key={group.teamCode} className="card-base p-3 border-border-default/70 space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlagDisc code={group.teamCode} size={20} />
                      <div>
                        <span className="font-bold text-xs text-text-primary">{group.teamCode}</span>
                        <span className="text-xs text-text-secondary ml-1">— {group.teamName}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono bg-bg-secondary border border-border-default/60 px-1.5 py-0.5 rounded text-text-secondary">
                      {group.totalCount} aliases
                    </span>
                  </div>

                  <div className="text-[10px] text-text-muted">
                    <p>Proveedores cubiertos: <span className="text-text-secondary font-mono">{providers.length > 0 ? providers.join(', ') : 'Ninguno (Solo global)'}</span></p>
                  </div>

                  {isExpanded && (
                    <div className="pt-2 border-t border-border-subtle/50 space-y-2 text-[10px]">
                      {group.global.length > 0 && (
                        <div>
                          <strong className="text-gold-400 font-mono block uppercase">Globales (*):</strong>
                          <ul className="list-disc pl-3 text-text-secondary">
                            {group.global.map((a, i) => <li key={i}>{a}</li>)}
                          </ul>
                        </div>
                      )}
                      {Object.entries(group.byProvider).map(([provider, list]) => (
                        <div key={provider}>
                          <strong className="text-text-primary font-mono block uppercase">{provider}:</strong>
                          <ul className="list-disc pl-3 text-text-secondary">
                            {list.map((a, i) => <li key={i}>{a}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleTeamExpanded(group.teamCode)}
                    className="text-center w-full text-[10px] text-gold-400 hover:text-gold-300 font-mono pt-1"
                  >
                    {isExpanded ? 'Ver menos ↑' : 'Ver aliases ↓'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* OBSERVED NAMES DIAGNOSTICS */}
        <div className="card-base p-4 border-border-default/60 space-y-4">
          <div className="border-b border-border-subtle pb-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-lg text-text-primary uppercase tracking-wide">
                Diagnóstico de Nombres Observados
              </h4>
              <p className="text-xs text-text-secondary">
                Nombres recibidos en las respuestas raw de los proveedores. Úsalos para vincular y crear nuevos aliases.
              </p>
            </div>
            {/* Quick Filter Info */}
            {diagProvider !== 'the-odds-api' || diagMarketType !== 'outrights' ? (
              <span className="text-[10px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2 py-0.5 rounded font-mono uppercase">
                Diagnóstico histórico / no necesariamente participante del torneo actual
              </span>
            ) : null}
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
              <span>Proveedor</span>
              <select
                value={diagProvider}
                onChange={(e) => setDiagProvider(e.target.value)}
                className="bg-bg-elevated border border-border-default rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
              >
                <option value="all">Todos</option>
                <option value="the-odds-api">the-odds-api</option>
                <option value="api-football">api-football</option>
                <option value="football-data">football-data</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
              <span>Tipo de Mercado</span>
              <select
                value={diagMarketType}
                onChange={(e) => setDiagMarketType(e.target.value)}
                className="bg-bg-elevated border border-border-default rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
              >
                <option value="all">Todos</option>
                <option value="outrights">outrights</option>
                <option value="h2h_fixture">h2h_fixture</option>
                <option value="match_winner">match_winner</option>
                <option value="result_fixture">result_fixture</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
              <span>Estado del Mapeo</span>
              <select
                value={diagStatus}
                onChange={(e) => setDiagStatus(e.target.value)}
                className="bg-bg-elevated border border-border-default rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
              >
                <option value="all">Todos</option>
                <option value="matched">Matched (Vinculado)</option>
                <option value="unmatched">Unmatched (Pendiente)</option>
                <option value="ignored">Ignored (Ignorado)</option>
              </select>
            </label>
          </div>

          {filteredOutcomes.length === 0 ? (
            <div className="border border-dashed border-border-default p-6 text-center text-xs text-text-muted italic">
              {diagProvider === 'the-odds-api' && diagMarketType === 'outrights' && diagStatus === 'unmatched' ? (
                <span>No hay nombres pendientes para The Odds API / cuotas de campeón.</span>
              ) : (
                <span>No se encontraron nombres observados para este filtro.</span>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredOutcomes.map((outcome) => {
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
        </div>
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
                onClick={() => handleBulkOddsRefresh('future_missing')}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Database className="w-3 h-3" /> Futuros sin cuotas
              </button>
              <button
                type="button"
                onClick={() => handleBulkOddsRefresh('future_all')}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${globalLoading === 'odds' ? 'animate-spin' : ''}`} /> Todos los futuros
              </button>
              <button
                type="button"
                onClick={() => handleBulkOddsRefresh('future_all', { limit: 10 })}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> Próximos 10
              </button>
              <button
                type="button"
                onClick={() => handleBulkOddsRefresh('future_all', { lookaheadHours: 168 })}
                disabled={globalLoading !== null}
                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> Próximos 7 días
              </button>
            </div>
            <p className="text-[10px] text-text-muted">
              Solo consulta partidos futuros no finalizados. Los límites y enfriamientos del proveedor pueden detener el proceso antes de completar la lista.
            </p>
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

        {bulkOddsSummary && (
          <div className="border-t border-border-subtle pt-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              {[
                ['Elegibles', bulkOddsSummary.eligible],
                ['Procesados', bulkOddsSummary.processed],
                ['Actualizados', bulkOddsSummary.updated],
                ['Omitidos', bulkOddsSummary.skipped],
                ['Fallidos', bulkOddsSummary.failed],
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-border-subtle bg-bg-secondary/40 px-2 py-2">
                  <span className="block text-lg font-semibold text-text-primary">{value}</span>
                  <span className="text-[9px] font-mono uppercase text-text-muted">{label}</span>
                </div>
              ))}
            </div>

            <div className="text-xs text-text-secondary space-y-1">
              <p>
                Proveedores usados: {bulkOddsSummary.providersUsed.length > 0
                  ? bulkOddsSummary.providersUsed.join(', ')
                  : 'Ninguno'}.
              </p>
              {bulkOddsSummary.stoppedEarly && (
                <p className="text-amber-400">La actualización se detuvo de forma segura por enfriamiento o límite del proveedor.</p>
              )}
              {bulkOddsSummary.cooldownNotes.map((note) => (
                <p key={note} className="text-amber-400">{note}</p>
              ))}
            </div>

            {bulkOddsSummary.results.length > 0 && (
              <details className="rounded border border-border-subtle bg-black/10 p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-text-primary">Detalle por partido</summary>
                <div className="mt-2 max-h-64 overflow-y-auto divide-y divide-border-subtle/50">
                  {bulkOddsSummary.results.map((result) => (
                    <div key={result.matchId} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="font-mono text-text-primary">
                        {result.matchId}: {result.homeTeamCode} vs {result.awayTeamCode}
                      </span>
                      <span className={result.status === 'updated' ? 'text-green-400' : result.status === 'failed' ? 'text-red-400' : 'text-amber-400'}>
                        {result.status === 'updated' ? `Actualizado${result.provider ? ` · ${result.provider}` : ''}` : result.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

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

      {/* Champion Odds Section */}
      <div className="card-base p-5 border-border-default/60 space-y-4">
        <h4 className="font-semibold text-sm text-gold-400 uppercase tracking-wider font-mono">Cuotas de Campeón (Outrights)</h4>
        <p className="text-xs text-text-secondary">
          Detecta mercados outright, previsualiza sus equipos y guarda únicamente cuotas del Mundial FIFA de fútbol para Champion Survivor.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleDetectChampionMarkets}
              disabled={championLoading}
              className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${championLoading ? 'animate-spin' : ''}`} /> Detectar Mercados
            </button>
            
            {championCandidates.length > 0 && (
              <div className="mt-2 space-y-2 p-2 border border-border-subtle rounded-lg bg-black/10 text-xs">
                <span className="font-semibold text-text-primary mb-1 block">Recomendados para FIFA World Cup:</span>
                {championCandidates.map(c => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setSelectedSport(c.key);
                      setChampionPreview(null);
                    }}
                    className={`w-full text-left p-2 rounded border transition-colors ${
                      normalizedSelectedSport === c.key
                        ? 'border-gold-500/50 bg-gold-500/10'
                        : 'border-border-subtle hover:border-gold-500/30'
                    }`}
                  >
                    <span className="text-gold-400 font-mono block">{c.key}</span>
                    <span className="text-text-muted block">{c.group} · {c.title}</span>
                    <span className="text-text-muted block">{c.description}</span>
                    <span className="text-green-400 block">Outrights: {c.has_outrights ? 'Sí' : 'No'}</span>
                  </button>
                ))}
              </div>
            )}

            {championOtherSports.length > 0 && (
              <details className="mt-2 border border-border-subtle rounded-lg bg-black/10 text-xs">
                <summary className="cursor-pointer p-2 text-yellow-300 font-semibold">
                  Otros mercados outright no recomendados ({championOtherSports.length})
                </summary>
                <div className="p-2 pt-0 space-y-2 max-h-56 overflow-y-auto">
                  {championOtherSports.map((sport) => (
                    <div key={sport.key} className="p-2 border border-red-500/20 rounded bg-red-500/5">
                      <span className="text-red-300 font-mono block">{sport.key}</span>
                      <span className="text-text-muted block">{sport.group} · {sport.title}</span>
                      <span className="text-text-muted block">{sport.description}</span>
                      <span className="text-red-300 block">No recomendado: {classifyChampionSport(sport).reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-text-secondary font-semibold block" htmlFor="champion-league-target">
              Competencia Champion Survivor destino
            </label>
            <select
              id="champion-league-target"
              value={selectedChampionLeagueId}
              onChange={(event) => setSelectedChampionLeagueId(event.target.value)}
              className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-default rounded-lg text-sm text-text-primary focus:outline-none focus:border-gold-500/50"
            >
              <option value="">-- Selecciona competencia activa --</option>
              {championSurvivorLeagues.map((league) => (
                <option key={league.id} value={league.id}>{league.name}</option>
              ))}
            </select>

            <span className="text-xs text-text-secondary font-semibold block">Sport key (ej. soccer_fifa_world_cup_winner)</span>
            <input
              type="text"
              value={selectedSport}
              onChange={(e) => {
                setSelectedSport(e.target.value);
                setChampionPreview(null);
              }}
              className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-default rounded-lg text-sm text-text-primary focus:outline-none focus:border-gold-500/50"
              placeholder="Ej: soccer_fifa_world_cup_winner"
            />

            {selectedSportInfo && (
              <div className="p-3 border border-border-subtle rounded-lg bg-bg-secondary/40 text-xs space-y-1">
                <p><span className="text-text-muted">Grupo:</span> {selectedSportInfo.group}</p>
                <p><span className="text-text-muted">Título:</span> {selectedSportInfo.title}</p>
                <p><span className="text-text-muted">Descripción:</span> {selectedSportInfo.description}</p>
                <p><span className="text-text-muted">Outrights:</span> {selectedSportInfo.has_outrights ? 'Sí' : 'No'}</p>
              </div>
            )}

            {normalizedSelectedSport && !canPreviewChampionOdds && (
              <p className="text-xs text-red-300 border border-red-500/20 bg-red-500/10 rounded-lg p-2">
                {INVALID_CHAMPION_SPORT_MESSAGE}
              </p>
            )}

            <button
              type="button"
              onClick={handlePreviewChampionOdds}
              disabled={championLoading || !canPreviewChampionOdds}
              className="px-3 py-1.5 w-full bg-bg-secondary hover:bg-bg-hover border border-border-default text-text-primary rounded-lg text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1 transition-all disabled:opacity-50"
            >
              <Play className="w-3 h-3" /> Previsualizar outcomes sin guardar
            </button>

            <button
              type="button"
              onClick={handleImportChampionOdds}
              disabled={championLoading || !selectedChampionLeagueId || !canPreviewChampionOdds || !hasCurrentChampionPreview}
              className="px-3 py-1.5 w-full bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/20 text-gold-400 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1 transition-all disabled:opacity-50 mt-2"
            >
              <Database className="w-3 h-3" /> Importar Cuotas de Campeón
            </button>

            <p className="text-[10px] text-text-muted">
              Si un equipo nacional queda sin coincidencia, crea su alias en el mapeo de proveedores y vuelve a importar.
            </p>
          </div>
        </div>

        {championPreview && (
          <div className="border border-green-500/25 bg-green-500/5 rounded-lg p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-mono text-green-300">{championPreview.sportKey}</span>
              <span className="text-text-secondary">{championPreview.outcomeCount} cuotas encontradas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {championPreview.sampleOutcomes.map((outcome, index) => (
                <div key={`${outcome.bookmaker}:${outcome.name}:${index}`} className="border border-border-subtle rounded p-2 text-xs">
                  <p className="font-semibold text-text-primary">{outcome.name}</p>
                  <p className="text-text-muted">{outcome.bookmaker} · cuota {outcome.decimalOdds}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-yellow-200">
              Verifica que la muestra contenga selecciones nacionales del Mundial antes de importar.
            </p>
          </div>
        )}
      </div>

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
