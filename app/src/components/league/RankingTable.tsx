'use client';

import React from 'react';
import { Standing } from '../../types/domain';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface RankingTableProps {
  standings: Standing[];
  currentUserId: string;
}

export const RankingTable: React.FC<RankingTableProps> = ({ standings, currentUserId }) => {
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

  return (
    <div className="card-base overflow-hidden">
      {/* Table Header */}
      <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 border-b border-border-subtle bg-bg-secondary/40 font-semibold text-xs tracking-wider uppercase text-text-secondary text-center">
        <span className="col-span-1">#</span>
        <span className="col-span-4 text-left">Jugador</span>
        <span className="col-span-1.5 text-gold-400">Exactos</span>
        <span className="col-span-1.5 text-blue-400">Tendencias</span>
        <span className="col-span-1.5 text-amber-500">Consol.</span>
        <span className="col-span-1 text-text-muted">Fallos</span>
        <span className="col-span-1.5 text-text-primary text-right">Puntos</span>
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
              <div className="flex items-center justify-between w-full sm:col-span-5 sm:justify-start gap-3">
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
                <div className="sm:hidden flex items-center gap-4">
                  <RankArrow rank={s.rank} prev={s.previousRank} />
                  <span className="font-mono text-base font-bold text-text-primary">{s.points} pts</span>
                </div>
              </div>

              {/* Stats Breakdown (Hidden on Mobile, Grid on Desktop) */}
              <div className="hidden sm:grid sm:grid-cols-6 sm:col-span-7 gap-2 w-full text-center items-center">
                {/* Exacts */}
                <span className="col-span-1.5 font-mono text-sm text-gold-400 font-semibold">{s.exacts}</span>
                {/* Tendencies */}
                <span className="col-span-1.5 font-mono text-sm text-blue-300">{s.tendencies}</span>
                {/* Consolations */}
                <span className="col-span-1.5 font-mono text-sm text-amber-500">{s.consolations}</span>
                {/* Misses */}
                <span className="col-span-1 font-mono text-sm text-text-muted">{s.misses}</span>
                {/* Points & Movement */}
                <div className="col-span-1.5 flex items-center justify-end gap-3.5">
                  <span className="font-mono text-md font-bold text-text-primary">{s.points}</span>
                  <div className="w-8 flex justify-center">
                    <RankArrow rank={s.rank} prev={s.previousRank} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
