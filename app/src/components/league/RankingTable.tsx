'use client';

import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface RankingTableProps {
  competitionType?: string;
  standings?: {
    userId: string;
    displayName: string;
    points: number;
    champPoints?: number;
    matchPoints?: number;
    exacts: number;
    tendencies: number;
    consolations: number;
    misses: number;
    rank: number;
    previousRank: number;
    predictionsSubmitted: number;
    lastUpdated: string;
  }[];
  survivalTable?: {
    userId: string;
    displayName: string;
    teamCode: string | null;
    teamName: string | null;
    position: number;
    statusLabel: string;
    roundLabel: string;
    eliminatedInMatchId: string | null;
  }[];
  currentUserId: string;
}

export const RankingTable: React.FC<RankingTableProps> = ({
  competitionType = 'full_prediction',
  standings = [],
  survivalTable = [],
  currentUserId,
}) => {
  const RankArrow: React.FC<{ rank: number; prev: number }> = ({ rank, prev }) => {
    if (prev > rank) {
      return (
        <span className="text-rank-up flex items-center justify-center">
          <ArrowUp className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono font-bold ml-0.5">+{prev - rank}</span>
        </span>
      );
    }
    if (prev < rank) {
      return (
        <span className="text-rank-down flex items-center justify-center">
          <ArrowDown className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono font-bold ml-0.5">-{rank - prev}</span>
        </span>
      );
    }
    return (
      <span className="text-text-muted flex items-center justify-center">
        <Minus className="w-3.5 h-3.5" />
      </span>
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  if (competitionType === 'champion_survivor') {
    return (
      <div className="card-base overflow-hidden">
        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 border-b border-border-subtle bg-bg-secondary/40 font-semibold text-xs tracking-wider uppercase text-text-secondary text-center">
          <span className="col-span-1">Pos.</span>
          <span className="col-span-3 text-left">Usuario</span>
          <span className="col-span-3 text-left">Equipo Elegido</span>
          <span className="col-span-2 text-center">Estado</span>
          <span className="col-span-3 text-right">Ronda / Eliminación</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border-subtle">
          {survivalTable.map((row) => {
            const isYou = row.userId === currentUserId;
            const statusColor =
              row.statusLabel === 'Campeón acertado' ? 'text-gold-400 font-bold' :
              row.statusLabel === 'Vivo' ? 'text-green-400 font-bold' :
              row.statusLabel === 'Subcampeón' ? 'text-amber-500 font-semibold' : 'text-text-muted';

            return (
              <div
                key={row.userId}
                className={`flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-2 px-4 py-3 sm:py-3.5 items-center transition-all ${
                  isYou ? 'bg-bg-hover/80 border-l-4 border-gold-400 pl-3 sm:pl-3' : 'border-l-4 border-transparent'
                }`}
              >
                {/* Mobile / Desktop Pos & User */}
                <div className="flex items-center justify-between w-full sm:col-span-4 sm:justify-start gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center font-mono text-base font-bold text-text-secondary">
                      {row.position > 0 ? row.position : '-'}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full border bg-bg-secondary flex items-center justify-center font-mono font-bold text-xs uppercase ${
                        isYou ? 'border-gold-400 text-gold-400' : 'border-border-default text-text-secondary'
                      }`}>
                        {row.displayName.slice(0, 2)}
                      </div>
                      <span className={`font-semibold text-sm ${isYou ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {row.displayName}
                        {isYou && <span className="text-[10px] text-gold-400 border border-gold-400/30 px-1.5 py-0.5 rounded-full ml-2 uppercase font-mono tracking-wider">TÚ</span>}
                      </span>
                    </div>
                  </div>
                  {/* Mobile Pick Details */}
                  <div className="sm:hidden flex flex-col items-end text-right">
                    <span className="text-xs font-semibold text-text-primary">
                      {row.teamName ? `${row.teamName} (${row.teamCode})` : 'Sin selección'}
                    </span>
                    <span className={`text-[10px] ${statusColor}`}>
                      {row.statusLabel}
                    </span>
                  </div>
                </div>

                {/* Desktop Pick */}
                <div className="hidden sm:block sm:col-span-3 text-left text-sm font-semibold text-text-primary">
                  {row.teamName ? `${row.teamName} (${row.teamCode})` : <span className="text-text-muted italic">Sin selección</span>}
                </div>

                {/* Desktop Status */}
                <div className={`hidden sm:block sm:col-span-2 text-center text-sm ${statusColor}`}>
                  {row.statusLabel}
                </div>

                {/* Desktop Round / Eliminated in match */}
                <div className="hidden sm:block sm:col-span-3 text-right text-xs text-text-secondary font-mono">
                  <div>{row.roundLabel}</div>
                  {(row.statusLabel === 'Eliminado' || row.statusLabel === 'Subcampeón') && (
                    <div className="text-[10px] text-text-muted">
                      Partido: {row.eliminatedInMatchId ? row.eliminatedInMatchId.toUpperCase() : '—'}
                    </div>
                  )}
                </div>

                {/* Mobile Round / Eliminated in match */}
                {row.teamCode && (
                  <div className="sm:hidden w-full flex justify-between items-center mt-1 pt-1 border-t border-border-subtle/30 text-[10px] text-text-secondary">
                    <span>Ronda: {row.roundLabel}</span>
                    {(row.statusLabel === 'Eliminado' || row.statusLabel === 'Subcampeón') && (
                      <span>
                        Partido: {row.eliminatedInMatchId ? row.eliminatedInMatchId.toUpperCase() : '—'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="card-base overflow-hidden">
      {/* Table Header */}
      <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 border-b border-border-subtle bg-bg-secondary/40 font-semibold text-xs tracking-wider uppercase text-text-secondary text-center">
        <span className="col-span-1">#</span>
        <span className="col-span-3 text-left">Jugador</span>
        <span className="col-span-1 text-gold-400">Exactos</span>
        <span className="col-span-1.5 text-blue-400">Tendencias</span>
        <span className="col-span-1 text-amber-500">Consol.</span>
        <span className="col-span-1 text-text-muted">Fallos</span>
        <span className="col-span-1 text-text-secondary">Preds.</span>
        <span className="col-span-1.5 text-text-muted">Últ. Act.</span>
        <span className="col-span-1 text-text-primary text-right">Puntos</span>
      </div>

      {/* Standings Rows */}
      <div className="divide-y divide-border-subtle">
        {standings.map((s) => {
          const isYou = s.userId === currentUserId;
          const rankColor =
            s.rank === 1 ? 'text-gold-400' :
            s.rank === 2 ? 'text-text-primary' :
            s.rank === 3 ? 'text-amber-500' : 'text-text-secondary';

          return (
            <div
              key={s.userId}
              className={`flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-2 px-4 py-3 sm:py-3.5 items-center transition-all ${
                isYou ? 'bg-bg-hover/80 border-l-4 border-gold-400 pl-3 sm:pl-3' : 'border-l-4 border-transparent'
              }`}
            >
              {/* Rank and Player info (Combined on Mobile) */}
              <div className="flex items-center justify-between w-full sm:col-span-4 sm:justify-start gap-3">
                <div className="flex items-center gap-2">
                  <span className={`w-6 text-center font-mono text-base font-bold ${rankColor}`}>
                    {s.rank}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* User Avatar Placeholder */}
                    <div className={`w-8 h-8 rounded-full border bg-bg-secondary flex items-center justify-center font-mono font-bold text-xs uppercase ${
                      isYou ? 'border-gold-400 text-gold-400' : 'border-border-default text-text-secondary'
                    }`}>
                      {s.displayName.slice(0, 2)}
                    </div>
                    <span className={`font-semibold text-sm ${isYou ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {s.displayName}
                      {isYou && <span className="text-[10px] text-gold-400 border border-gold-400/30 px-1.5 py-0.5 rounded-full ml-2 uppercase font-mono tracking-wider">TÚ</span>}
                    </span>
                  </div>
                </div>
                {/* Movement display on mobile */}
                <div className="sm:hidden flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-2">
                    <RankArrow rank={s.rank} prev={s.previousRank} />
                    <span className="font-mono text-base font-bold text-text-primary">{s.points} pts</span>
                  </div>
                  <span className="text-[9px] text-text-muted font-mono">
                    ⚽ {s.matchPoints ?? 0} partidos | 🏆 {s.champPoints ?? 0} campeón
                  </span>
                </div>
              </div>

              {/* Stats Breakdown (Hidden on Mobile, Grid on Desktop) */}
              <div className="hidden sm:grid sm:grid-cols-8 sm:col-span-8 gap-2 w-full text-center items-center">
                {/* Exacts */}
                <span className="col-span-1 font-mono text-sm text-gold-400 font-semibold">{s.exacts}</span>
                {/* Tendencies */}
                <span className="col-span-1.5 font-mono text-sm text-blue-300">{s.tendencies}</span>
                {/* Consolations */}
                <span className="col-span-1 font-mono text-sm text-amber-500">{s.consolations}</span>
                {/* Misses */}
                <span className="col-span-1 font-mono text-sm text-text-muted">{s.misses}</span>
                {/* Predictions Submitted */}
                <span className="col-span-1 font-mono text-sm text-text-secondary">{s.predictionsSubmitted ?? 0}</span>
                {/* Last Updated */}
                <span className="col-span-1.5 font-mono text-xs text-text-muted">{formatDate(s.lastUpdated)}</span>
                {/* Points & Movement */}
                <div className="col-span-1 flex flex-col items-end gap-0.5 justify-center">
                  <div className="flex items-center gap-3.5">
                    <span className="font-mono text-md font-bold text-text-primary">{s.points}</span>
                    <div className="w-8 flex justify-center">
                      <RankArrow rank={s.rank} prev={s.previousRank} />
                    </div>
                  </div>
                  <span className="text-[9px] text-text-muted font-mono leading-none">
                    ⚽ {s.matchPoints ?? 0} | 🏆 {s.champPoints ?? 0}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
