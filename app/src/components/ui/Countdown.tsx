'use client';

import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

export function useCountdown(targetIso: string) {
  const targetTime = new Date(targetIso).getTime();
  const [ms, setMs] = useState(0);

  useEffect(() => {
    // Lazy initialize/update state in a microtask/setTimeout to prevent cascading renders
    const timer = setTimeout(() => {
      setMs(Math.max(0, targetTime - Date.now()));
    }, 0);

    const interval = setInterval(() => {
      setMs(Math.max(0, targetTime - Date.now()));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [targetTime]);

  const totalSeconds = Math.floor(ms / 1000);
  return {
    ms,
    expired: ms <= 0,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export const CountdownInline: React.FC<{ targetIso: string }> = ({ targetIso }) => {
  const countdown = useCountdown(targetIso);

  if (countdown.expired) {
    return <span className="text-text-muted font-mono text-xs">Cerrado</span>;
  }

  const timeStr = countdown.hours >= 1
    ? `${countdown.hours}h ${String(countdown.minutes).padStart(2, '0')}m`
    : `${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;

  const danger = countdown.hours < 1;

  return (
    <span
      className={`font-mono text-xs font-semibold ${
        danger ? 'text-rank-down animate-[softPulse_1s_ease-in-out_infinite]' : 'text-text-secondary'
      }`}
    >
      {timeStr}
    </span>
  );
};

export const CountdownBig: React.FC<{ targetIso: string }> = ({ targetIso }) => {
  const countdown = useCountdown(targetIso);
  const danger = countdown.hours < 1 && !countdown.expired;

  if (countdown.expired) {
    return (
      <div className="flex items-center gap-1.5 text-text-muted tracking-wider text-xs font-semibold uppercase">
        <Lock className="w-3.5 h-3.5" /> Cerrado
      </div>
    );
  }

  const segment = (val: number, label: string) => (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`min-w-[48px] p-2 rounded-lg bg-bg-secondary border border-border-default font-mono text-xl font-bold text-center ${
          danger ? 'text-rank-down animate-[softPulse_1s_ease-in-out_infinite]' : 'text-text-primary'
        }`}
      >
        {String(val).padStart(2, '0')}
      </div>
      <span className="text-[10px] tracking-wider text-text-muted font-bold">{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {segment(countdown.hours, 'HORAS')}
      <span className="font-mono text-lg text-text-muted mt-1">:</span>
      {segment(countdown.minutes, 'MIN')}
      <span className="font-mono text-lg text-text-muted mt-1">:</span>
      {segment(countdown.seconds, 'SEG')}
    </div>
  );
};
