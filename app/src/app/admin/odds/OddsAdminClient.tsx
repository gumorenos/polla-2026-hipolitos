'use client';

import React, { useState } from 'react';
import { RefreshCw, BarChart2, ShieldAlert, CheckCircle, Database, History } from 'lucide-react';
import { FlagDisc } from '../../../components/ui/FlagDisc';
import { fmtDate, fmtTime } from '../../../lib/utils/dates';
import {
  refreshGlobalOddsAction,
  refreshH2HAction,
  fetchMissingH2HAction,
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
  };
}

export const OddsAdminClient: React.FC<OddsAdminClientProps> = ({ matches, apiStatus }) => {
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

  return (
    <div className="space-y-6">
      {/* API Providers Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-base p-4 flex items-center justify-between border-border-default/60">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">Odds-API.io (Primary)</span>
            <p className="text-sm font-semibold text-text-primary">Proveedor Primario Cuotas</p>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
            apiStatus.oddsApiIo 
              ? 'bg-green-500/10 text-green-400 border-green-500/30' 
              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
          }`}>
            {apiStatus.oddsApiIo ? 'ACTIVO (REAL)' : 'SIMULADO'}
          </span>
        </div>

        <div className="card-base p-4 flex items-center justify-between border-border-default/60">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">The Odds API (Fallback)</span>
            <p className="text-sm font-semibold text-text-primary">Proveedor Secundario Cuotas</p>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
            apiStatus.theOddsApi 
              ? 'bg-green-500/10 text-green-400 border-green-500/30' 
              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
          }`}>
            {apiStatus.theOddsApi ? 'ACTIVO (REAL)' : 'SIMULADO'}
          </span>
        </div>

        <div className="card-base p-4 flex items-center justify-between border-border-default/60">
          <div className="space-y-1">
            <span className="text-[10px] text-text-secondary uppercase font-mono">API-Football (H2H)</span>
            <p className="text-sm font-semibold text-text-primary">Enfrentamientos Históricos</p>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
            apiStatus.apiFootball 
              ? 'bg-green-500/10 text-green-400 border-green-500/30' 
              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
          }`}>
            {apiStatus.apiFootball ? 'ACTIVO (REAL)' : 'SIMULADO'}
          </span>
        </div>
      </div>

      {/* Admin Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleRefreshAllOdds}
          disabled={globalLoading !== null}
          className="btn-gold py-2 px-4 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${globalLoading === 'odds' ? 'animate-spin' : ''}`} />
          Actualizar Todas las Cuotas Globales
        </button>

        <button
          type="button"
          onClick={handleFetchAllMissingH2H}
          disabled={globalLoading !== null}
          className="px-4 py-2 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-text-primary rounded-xl text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all"
        >
          <Database className={`w-3.5 h-3.5 ${globalLoading === 'h2h' ? 'animate-spin' : ''}`} />
          Buscar H2H Faltantes
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
                <div className="mt-3 bg-black/15 p-2 rounded-lg border border-border-subtle/50 text-[11px] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-text-secondary flex items-center gap-1">
                      <BarChart2 className="w-3.5 h-3.5 text-gold-400" />
                      Cuotas Globales:
                    </span>
                    {m.globalOdds ? (
                      <span className="text-[9px] text-text-muted font-mono">
                        Hace {Math.max(1, Math.round((now - new Date(m.globalOdds.capturedAt).getTime()) / 60000))}m ({m.globalOdds.bookmaker})
                      </span>
                    ) : (
                      <span className="text-[9px] text-red-400 font-mono">Falta Snapshot</span>
                    )}
                  </div>
                  {m.globalOdds ? (
                    <div className="font-mono flex gap-4 text-text-primary">
                      <span>L: <strong className="text-gold-400">{m.globalOdds.homeOdds.toFixed(2)}</strong></span>
                      <span>E: <strong className="text-gold-400">{m.globalOdds.drawOdds.toFixed(2)}</strong></span>
                      <span>V: <strong className="text-gold-400">{m.globalOdds.awayOdds.toFixed(2)}</strong></span>
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
                <div className="mt-4 pt-3 border-t border-border-subtle/40 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleRefreshSingleOdds(m.id)}
                    disabled={isLoadingOdds || globalLoading !== null}
                    className="px-2.5 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-[10px] font-mono rounded transition-colors flex items-center gap-1 text-text-primary disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingOdds ? 'animate-spin' : ''}`} />
                    Refrescar Cuotas
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRefreshSingleH2H(m.id)}
                    disabled={isLoadingH2H || globalLoading !== null}
                    className="px-2.5 py-1 bg-bg-secondary hover:bg-bg-hover border border-border-default hover:border-gold-500/40 text-[10px] font-mono rounded transition-colors flex items-center gap-1 text-text-primary disabled:opacity-50"
                  >
                    <History className={`w-3 h-3 ${isLoadingH2H ? 'animate-spin' : ''}`} />
                    Refrescar H2H
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
