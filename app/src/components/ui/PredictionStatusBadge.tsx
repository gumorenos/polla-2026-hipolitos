import React from 'react';
import { ScoreType } from '../../types/domain';

interface PredictionStatusBadgeProps {
  scoreType?: ScoreType | null;
  points?: number | null;
  className?: string;
}

export const PredictionStatusBadge: React.FC<PredictionStatusBadgeProps> = ({
  scoreType,
  points,
  className = '',
}) => {
  if (scoreType === undefined || scoreType === null) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-border-default bg-bg-secondary text-text-secondary ${className}`}>
        Pendiente
      </span>
    );
  }

  const configs: Record<ScoreType, { label: string; style: string }> = {
    exact: {
      label: `Exacto (+${points ?? 5} pts)`,
      style: 'border-gold-400 bg-gold-400/10 text-gold-400',
    },
    tendency: {
      label: `Tendencia (+${points ?? 3} pts)`,
      style: 'border-blue-400 bg-blue-400/10 text-blue-300',
    },
    consolation: {
      label: `Consolación (+${points ?? 1} pt)`,
      style: 'border-amber-600 bg-amber-600/10 text-amber-500',
    },
    miss: {
      label: `Fallo (+0 pts)`,
      style: 'border-border-default bg-bg-primary text-text-muted',
    },
  };

  const { label, style } = configs[scoreType];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${style} ${className}`}>
      {label}
    </span>
  );
};
