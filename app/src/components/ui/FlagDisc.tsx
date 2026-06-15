'use client';

import React from 'react';
import { TEAMS } from '../../lib/mockData';

export const FLAG_MAP: Record<string, string> = {
  USA: '🇺🇸',
  MEX: '🇲🇽',
  CAN: '🇨🇦',
  PAN: '🇵🇦',
  ARG: '🇦🇷',
  BRA: '🇧🇷',
  COL: '🇨🇴',
  URU: '🇺🇾',
  ECU: '🇪🇨',
  PAR: '🇵🇾',
  FRA: '🇫🇷',
  ESP: '🇪🇸',
  GER: '🇩🇪',
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  POR: '🇵🇹',
  NED: '🇳🇱',
  BEL: '🇧🇪',
  CRO: '🇭🇷',
  SUI: '🇨🇭',
  AUT: '🇦🇹',
  SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  TUR: '🇹🇷',
  SWE: '🇸🇪',
  NOR: '🇳🇴',
  CZE: '🇨🇿',
  BIH: '🇧🇦',
  MAR: '🇲🇦',
  SEN: '🇸🇳',
  EGY: '🇪🇬',
  CIV: '🇨🇮',
  ALG: '🇩🇿',
  TUN: '🇹🇳',
  RSA: '🇿🇦',
  GHA: '🇬🇭',
  COD: '🇨🇩',
  JPN: '🇯🇵',
  KOR: '🇰🇷',
  IRI: '🇮🇷',
  KSA: '🇸🇦',
  AUS: '🇦🇺',
  IRQ: '🇮🇶',
  UZB: '🇺🇿',
  QAT: '🇶🇦',
  JOR: '🇯🇴',
  NZL: '🇳🇿',
  HAI: '🇭🇹',
  CPV: '🇨🇻',
  CUR: '🇨🇼'
};

interface FlagDiscProps {
  code: string;
  size?: number;
}

export const FlagDisc: React.FC<FlagDiscProps> = ({ code, size = 38 }) => {
  const upperCode = code.toUpperCase();
  const flag = FLAG_MAP[upperCode];

  if (flag) {
    return (
      <div
        className="flex items-center justify-center flex-shrink-0 select-none"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.75,
          lineHeight: 1,
        }}
        title={code}
      >
        {flag}
      </div>
    );
  }

  // Fallback to team abbreviation circle
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

