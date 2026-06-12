import React from 'react';

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-[#0a0a0c] flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-gold-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-text-secondary uppercase font-mono tracking-widest animate-[pulse_1.5s_infinite]">Cargando...</span>
      </div>
    </div>
  );
}
