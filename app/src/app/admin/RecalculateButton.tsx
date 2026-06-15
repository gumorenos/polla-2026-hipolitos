'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function RecalculateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRecalculate = async () => {
    if (loading) return;
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/recalculate', {
        method: 'POST',
      });

      if (res.ok) {
        setSuccess('¡Posiciones recalculadas con éxito!');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        const message = data.error || 'Error desconocido';
        setError(`Error al recalcular posiciones: ${message}`);
      }
    } catch (err) {
      console.error(err);
      setError('Error de red al intentar recalcular posiciones.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleRecalculate}
        disabled={loading}
        className="px-4 py-2 border border-gold-500/30 bg-gold-400/10 hover:bg-gold-400/20 text-gold-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all uppercase font-mono disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Recalculando...' : 'Recalcular Posiciones'}
      </button>

      {success && (
        <div className="text-[10px] text-green-400 bg-green-400/10 border border-green-500/20 p-2 rounded-lg flex items-center gap-1.5 animate-[fadeIn_0.2s_ease-out]">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="text-[10px] text-red-400 bg-red-400/10 border border-red-500/20 p-2 rounded-lg flex items-center gap-1.5 animate-[fadeIn_0.2s_ease-out]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

