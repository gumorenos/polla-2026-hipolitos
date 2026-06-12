'use client';

import React from 'react';
import { TEAMS } from '../../lib/mockData';

interface FlagDiscProps {
  code: string;
  size?: number;
}

export const FlagDisc: React.FC<FlagDiscProps> = ({ code, size = 38 }) => {
  const team = TEAMS[code] ?? { hue: 220, name: code };
  const bg = `hsl(${team.hue}, 40%, 15%)`;
  const ring = `hsl(${team.hue}, 50%, 35%)`;

  return (
    <div
      className="flex items-center justify-center flex-shrink-0 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_1px_2px_rgba(0,0,0,0.4)]"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${ring}, ${bg})`,
      }}
    >
      <span
        className="font-mono font-bold text-text-primary tracking-wide"
        style={{
          fontSize: size * 0.32,
        }}
      >
        {code}
      </span>
    </div>
  );
};
