'use client';

import React from 'react';

interface StepperProps {
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export const Stepper: React.FC<StepperProps> = ({ value, onChange, disabled = false }) => {
  const hasValue = value !== null && value !== undefined;
  const current = value ?? 0;

  return (
    <div className="flex items-center gap-2 select-none">
      {/* Decrement Button */}
      <button
        type="button"
        onClick={() => onChange(Math.max(0, current - 1))}
        disabled={disabled || current <= 0}
        className="w-10 h-10 rounded-xl flex items-center justify-center font-mono text-xl border border-border-default bg-bg-tertiary text-text-primary active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        &minus;
      </button>

      {/* Score Value Display */}
      <div className="min-w-[36px] h-10 flex items-center justify-center font-mono text-2xl font-semibold text-text-primary">
        {hasValue ? value : '–'}
      </div>

      {/* Increment Button */}
      <button
        type="button"
        onClick={() => onChange(Math.min(9, current + 1))}
        disabled={disabled || current >= 9}
        className="w-10 h-10 rounded-xl flex items-center justify-center font-mono text-xl border border-border-default bg-bg-tertiary text-text-primary active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        +
      </button>
    </div>
  );
};
