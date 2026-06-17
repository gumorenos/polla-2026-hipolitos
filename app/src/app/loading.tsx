import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-[320px] flex items-center justify-center p-6">
      <div className="card-base px-6 py-5 flex items-center gap-3 border-border-active">
        <div className="w-7 h-7 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-text-secondary uppercase font-mono tracking-widest animate-[pulse_1.5s_infinite]">
          Cargando...
        </span>
      </div>
    </div>
  );
}
