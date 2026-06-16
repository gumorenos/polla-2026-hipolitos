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

export const ISO_MAP: Record<string, string> = {
  ARG: 'ar', BRA: 'br', FRA: 'fr', ESP: 'es', GER: 'de',
  ENG: 'gb-eng', POR: 'pt', NED: 'nl', BEL: 'be', CRO: 'hr',
  URU: 'uy', COL: 'co', USA: 'us', MEX: 'mx', CAN: 'ca',
  JPN: 'jp', SEN: 'sn', MAR: 'ma', ECU: 'ec', PAR: 'py',
  PAN: 'pa', CPV: 'cv', CUR: 'cw', JOR: 'jo', NZL: 'nz',
  HAI: 'ht', UZB: 'uz', QAT: 'qa', KOR: 'kr', KSA: 'sa',
  AUS: 'au', EGY: 'eg', CIV: 'ci', GHA: 'gh', TUN: 'tn',
  ALG: 'dz', SUI: 'ch', AUT: 'at', TUR: 'tr', SWE: 'se',
  NOR: 'no', CZE: 'cz', SCO: 'gb-sct', IRI: 'ir', IRN: 'ir',
  IRQ: 'iq', COD: 'cd', BIH: 'ba', RSA: 'za'
};

interface FlagDiscProps {
  code: string;
  size?: number;
}

export const FlagDisc: React.FC<FlagDiscProps> = ({ code, size = 38 }) => {
  const upperCode = code.toUpperCase().trim();
  const isoCode = ISO_MAP[upperCode];

  if (isoCode) {
    return (
      <div
        className="relative flex-shrink-0 overflow-hidden rounded-full border border-white/10 shadow-sm flex items-center justify-center bg-bg-secondary"
        style={{
          width: size,
          height: size,
        }}
        title={code}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://flagcdn.com/w80/${isoCode}.png`}
          alt={code}
          className="w-full h-full object-cover select-none"
        />
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

