'use client';

import React, { useState } from 'react';
import { RefreshCw, BarChart2, ShieldAlert, CheckCircle, Database, History, Trash2 } from 'lucide-react';
import { FlagDisc } from '../../../components/ui/FlagDisc';
import { fmtDate, fmtTime } from '../../../lib/utils/dates';
import {
  refreshGlobalOddsAction,
  refreshH2HAction,
  fetchMissingH2HAction,
  cleanupSimulatedDataAction,
} from '../../../lib/actions/odds';

interface MatchAdminInfo {
  id: string;
  homeTeamCode: string;
  homeTeamName: string;
  awayTeamCode: string;
  awayTeamName: string;
  kickoffUtc: string;
  status: string;
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
}) => {
  const [now] = useState(() => Date.now());
  const [loadingMap, setLoadingMap] = useState<Record<string, 'odds' | 'h2h' | null>>({});
  const [globalLoading, setGlobalLoading] = useState<'odds' | 'h2h' | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRefreshSingleOdds = async (matchId: string) => {
    setLoadingMap(prev => ({ ...prev, [matchId]: 'odds' }));
    setStatusMsg(null);
    const res = await refreshGlobalOddsAction(matchId);
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
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

  const handleRefreshAllOdds = async () => {
    setGlobalLoading('odds');
    setStatusMsg(null);
    const res = await refreshGlobalOddsAction();
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else {
      setStatusMsg({ type: 'success', text: 'Cuotas de todos los partidos activos actualizadas.' });
    }
    setGlobalLoading(null);
  };

  const handleFetchAllMissingH2H = async () => {
    setGlobalLoading('h2h');
    setStatusMsg(null);
    const res = await fetchMissingH2HAction();
    if (res.error) {
      setStatusMsg({ type: 'error', text: res.error });
    } else {
      setStatusMsg({ type: 'success', text: `Se poblaron ${res.count} enfrentamientos directos faltantes.` });
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

  return (
    <div className="space-y-6">
      {/* API Providers Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="card-base p-4 flex items-center justify-between border-border-default/60">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">Odds-API.io (Primary)</span>
            <p className="text-[11px] font-semibold text-text-primary">Proveedor Primario</p>
          </div>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            apiStatus.oddsApiIo 
              ? 'bg-green-500/10 text-green-400 border-green-500/30' 
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            {apiStatus.oddsApiIo ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>

        <div className="card-base p-4 flex items-center justify-between border-border-default/60">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">The Odds API (Fallback)</span>
            <p className="text-[11px] font-semibold text-text-primary">Proveedor Secundario</p>
          </div>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            apiStatus.theOddsApi 
              ? 'bg-green-500/10 text-green-400 border-green-500/30' 
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            {apiStatus.theOddsApi ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>

        <div className="card-base p-4 flex items-center justify-between border-border-default/60">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">API-Football (H2H)</span>
            <p className="text-[11px] font-semibold text-text-primary">Proveedor H2H</p>
          </div>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            apiStatus.apiFootball 
              ? 'bg-green-500/10 text-green-400 border-green-500/30' 
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            {apiStatus.apiFootball ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </div>

        <div className="card-base p-4 flex items-center justify-between border-border-default/60">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">Datos Simulados</span>
            <p className="text-[11px] font-semibold text-text-primary">Fallback Local</p>
          </div>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            apiStatus.simulatedAllowed 
              ? 'bg-green-500/10 text-green-400 border-green-500/30' 
              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
          }`}>
            {apiStatus.simulatedAllowed ? 'PERMITIDO' : 'BLOQUEADO'}
          </span>
        </div>

        <div className="card-base p-4 flex items-center justify-between border-border-default/60">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">Visualización</span>
            <p className="text-[11px] font-semibold text-text-primary">ODDS_DISPLAY</p>
          </div>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            oddsDisplayEnabled 
              ? 'bg-green-500/10 text-green-400 border-green-500/30' 
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            {oddsDisplayEnabled ? 'HABILITADO' : 'DESHABILITADO'}
          </span>
        </div>

        <div className="card-base p-4 flex items-center justify-between border-border-default/60">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">Act. Manual</span>
            <p className="text-[11px] font-semibold text-text-primary">MANUAL_REFRESH</p>
          </div>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            oddsManualUserRefreshEnabled 
              ? 'bg-green-500/10 text-green-400 border-green-500/30' 
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            {oddsManualUserRefreshEnabled ? 'HABILITADO' : 'DESHABILITADO'}
          </span>
        </div>
      </div>

      {/* Sync Status & Error Logs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-base p-4 border-border-default/60 space-y-2 text-sm">
          <h4 className="font-semibold text-text-primary">Últimas Sincronizaciones Exitosas (Reales)</h4>
          <div className="space-y-1 text-xs text-text-secondary font-mono">
            <p>Cuotas del Mercado: {lastSuccessfulOdds ? new Date(lastSuccessfulOdds).toLocaleString('es-PE', { timeZone: 'America/Lima' }) + ' (Hora Lima)' : 'Ninguna'}</p>
            <p>Historial H2H: {lastSuccessfulH2h ? new Date(lastSuccessfulH2h).toLocaleString('es-PE', { timeZone: 'America/Lima' }) + ' (Hora Lima)' : 'Ninguno'}</p>
          </div>
        </div>

        <div className="card-base p-4 border-border-default/60 space-y-2 text-sm">
          <h4 className="font-semibold text-text-primary">Conteo de Snapshots en BD</h4>
          <div className="space-y-1 text-xs text-text-secondary font-mono">
            <p>Cuotas Reales: <strong className="text-text-primary">{realSnapshotsCount.odds}</strong></p>
            <p>H2H Reales: <strong className="text-text-primary">{realSnapshotsCount.h2h}</strong></p>
            <p>Cuotas Simuladas: <strong className={simulatedSnapshotsCount.odds > 0 ? 'text-yellow-400 font-bold' : 'text-text-muted'}>{simulatedSnapshotsCount.odds}</strong></p>
            <p>H2H Simulados: <strong className={simulatedSnapshotsCount.h2h > 0 ? 'text-yellow-400 font-bold' : 'text-text-muted'}>{simulatedSnapshotsCount.h2h}</strong></p>
          </div>
        </div>

        {(lastOddsError || lastH2hError) ? (
          <div className="card-base p-4 border-red-500/20 bg-red-500/5 space-y-2 text-sm">
            <h4 className="font-semibold text-red-400">Últimos Errores de Proveedores</h4>
            <div className="space-y-1 text-xs text-red-400/90 font-mono">
              {lastOddsError && <p className="truncate">Cuotas: {lastOddsError}</p>}
              {lastH2hError && <p className="truncate">H2H: {lastH2hError}</p>}
            </div>
          </div>
        ) : (
          <div className="card-base p-4 border-border-default/60 flex items-center justify-center text-xs text-text-muted">
            Sin errores registrados recientemente.
          </div>
        )}
      </div>

      {hasNoRealData && (
        <div className="card-base p-6 border-yellow-500/20 bg-yellow-500/5 text-center space-y-2">
          <Database className="w-10 h-10 text-yellow-500/80 mx-auto" />
          <h3 className="font-semibold text-text-primary text-base">Sin datos reales guardados todavía</h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Aún no se han descargado datos reales de cuotas o H2H desde los proveedores externos. Puedes hacer una consulta global usando los botones de arriba.
          </p>
        </div>
      )}

      {/* Admin Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleRefreshAllOdds}
          disabled={globalLoading !== null}
          className="btn-gold py-2 px-4 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${globalLoading === 'odds' ? 'animate-spin' : ''}`} />
          Actualizar cuotas globales próximas
        </button>

        <button
          type="button"
          onClick={handleFetchAllMissingH2H}
          disabled={globalLoading !== null}
          className="px-4 py-2 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-xl text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all"
        >
          <Database className={`w-3.5 h-3.5 ${globalLoading === 'h2h' ? 'animate-spin' : ''}`} />
          Buscar H2H faltantes
        </button>

        <button
          type="button"
          onClick={handleCleanupSimulatedData}
          disabled={globalLoading !== null}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpiar datos simulados
        </button>
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
        <h3 className="font-display text-2xl tracking-wide text-text-primary">Estado por Partido</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((m) => {
            const isLoadingOdds = loadingMap[m.id] === 'odds';
            const isLoadingH2H = loadingMap[m.id] === 'h2h';
            
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

                {/* Odds Status Area */}
                {(() => {
                  const hasOdds = m.globalOdds && m.globalOdds.bookmaker !== 'LaPolla 2026 Simulator';
                  return (
                    <div className="mt-3 bg-black/15 p-2 rounded-lg border border-border-subtle/50 text-[11px] space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-text-secondary flex items-center gap-1">
                          <BarChart2 className="w-3.5 h-3.5 text-gold-400" />
                          Cuotas Globales:
                        </span>
                        {hasOdds ? (
                          <span className="text-[9px] text-text-muted font-mono">
                            Hace {Math.max(1, Math.round((now - new Date(m.globalOdds!.capturedAt).getTime()) / 60000))}m ({m.globalOdds!.bookmaker})
                          </span>
                        ) : (
                          <span className="text-[9px] text-red-400 font-mono">Falta Snapshot</span>
                        )}
                      </div>
                      {hasOdds ? (
                        <div className="font-mono flex gap-4 text-text-primary">
                          <span>L: <strong className="text-gold-400">{m.globalOdds!.homeOdds.toFixed(2)}</strong></span>
                          <span>E: <strong className="text-gold-400">{m.globalOdds!.drawOdds.toFixed(2)}</strong></span>
                          <span>V: <strong className="text-gold-400">{m.globalOdds!.awayOdds.toFixed(2)}</strong></span>
                        </div>
                      ) : (
                        <p className="text-text-muted text-[10px] italic">No hay registros globales para este partido.</p>
                      )}
                    </div>
                  );
                })()}

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
                <div className="mt-4 pt-3 border-t border-border-subtle/40 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleRefreshSingleOdds(m.id)}
                    disabled={isLoadingOdds || globalLoading !== null}
                    className="px-2.5 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-[10px] font-mono rounded transition-colors flex items-center gap-1 text-text-primary disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingOdds ? 'animate-spin' : ''}`} />
                    Actualizar cuotas de este partido
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRefreshSingleH2H(m.id)}
                    disabled={isLoadingH2H || globalLoading !== null}
                    className="px-2.5 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-[10px] font-mono rounded transition-colors flex items-center gap-1 text-text-primary disabled:opacity-50"
                  >
                    <History className={`w-3 h-3 ${isLoadingH2H ? 'animate-spin' : ''}`} />
                    Buscar H2H de este partido
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
