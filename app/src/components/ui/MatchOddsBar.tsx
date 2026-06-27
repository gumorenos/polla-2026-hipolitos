'use client';

import React from 'react';

interface MatchOddsBarProps {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  bookmaker?: string | null;
}

export const MatchOddsBar: React.FC<MatchOddsBarProps> = ({
  homeOdds,
  drawOdds,
  awayOdds,
  homeProbability,
  drawProbability,
  awayProbability,
  bookmaker,
}) => {
  const homeProb = homeProbability * 100;
  const drawProb = drawProbability * 100;
  const awayProb = awayProbability * 100;

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex justify-between text-[11px] font-mono text-text-secondary">
        <span>L: <strong className="text-text-primary">{homeOdds.toFixed(2)}</strong> ({homeProb.toFixed(0)}%)</span>
        <span>E: <strong className="text-text-primary">{drawOdds.toFixed(2)}</strong> ({drawProb.toFixed(0)}%)</span>
        <span>V: <strong className="text-text-primary">{awayOdds.toFixed(2)}</strong> ({awayProb.toFixed(0)}%)</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden flex bg-black/40 border border-border-subtle/20">
        <div 
          className="h-full bg-blue-500 transition-all duration-300" 
          style={{ width: `${homeProb}%` }} 
          title={`Local: ${homeProb.toFixed(1)}%`} 
        />
        <div 
          className="h-full bg-yellow-500 transition-all duration-300" 
          style={{ width: `${drawProb}%` }} 
          title={`Empate: ${drawProb.toFixed(1)}%`} 
        />
        <div 
          className="h-full bg-red-500 transition-all duration-300" 
          style={{ width: `${awayProb}%` }} 
          title={`Visitante: ${awayProb.toFixed(1)}%`} 
        />
      </div>
      {bookmaker && (
        <p className="text-[9px] text-text-muted text-right">Proveedor: {bookmaker}</p>
      )}
    </div>
  );
};
