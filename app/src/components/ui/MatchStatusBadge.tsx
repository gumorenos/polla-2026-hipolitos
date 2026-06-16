import React from 'react';

export type MatchVisualState = 'scheduled' | 'open' | 'locked' | 'live' | 'finished' | 'pending_result' | 'postponed' | 'cancelled';

interface MatchStatusBadgeProps {
  status: MatchVisualState;
  className?: string;
}

export const MatchStatusBadge: React.FC<MatchStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const configs: Record<MatchVisualState, { label: string; style: string }> = {
    scheduled: {
      label: 'Programado',
      style: 'border-border-default bg-bg-secondary text-text-secondary',
    },
    open: {
      label: 'Abierto',
      style: 'border-green-500/30 bg-green-500/10 text-green-400',
    },
    locked: {
      label: 'Cerrado',
      style: 'border-red-500/30 bg-red-500/10 text-red-400',
    },
    live: {
      label: 'En Juego',
      style: 'border-rank-down/30 bg-rank-down/10 text-rank-down font-bold',
    },
    finished: {
      label: 'Finalizado',
      style: 'border-gold-500/30 bg-gold-500/10 text-gold-400',
    },
    pending_result: {
      label: 'Cerrado - resultado pendiente',
      style: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-semibold',
    },
    postponed: {
      label: 'Postergado',
      style: 'border-orange-400/30 bg-orange-400/10 text-orange-400 font-semibold',
    },
    cancelled: {
      label: 'Cancelado',
      style: 'border-red-400/30 bg-red-400/10 text-red-400 font-semibold',
    },
  };

  const { label, style } = configs[status] ?? configs.scheduled;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${style} ${className}`}>
      {status === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-rank-down animate-[softPulse_1.5s_ease-in-out_infinite]" />
      )}
      {label}
    </span>
  );
};
