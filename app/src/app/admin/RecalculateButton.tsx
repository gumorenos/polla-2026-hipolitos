'use client';

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function RecalculateButton() {
  const [loading, setLoading] = useState(false);

  const handleRecalculate = async () => {
    if (loading) return;
    if (!confirm('¿Estás seguro de que deseas recalcular las posiciones de todas las competencias? Esto puede tardar unos segundos.')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/recalculate', {
        method: 'POST',
      });

      if (res.ok) {
        alert('¡Posiciones recalculadas con éxito!');
        window.location.reload();
      } else {
        const text = await res.text();
        alert(`Error al recalcular posiciones: ${text}`);
      }
    } catch (error) {
      console.error(error);
      alert('Error de red al intentar recalcular posiciones.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRecalculate}
      disabled={loading}
      className="px-4 py-2 border border-gold-500/30 bg-gold-400/10 hover:bg-gold-400/20 text-gold-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all uppercase font-mono disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Recalculando...' : 'Recalcular Posiciones'}
    </button>
  );
}
