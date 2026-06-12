'use client';

import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDemoLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      router.push('/');
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4 py-12 relative overflow-hidden">
      {/* Decorative Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gold-400/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm card-base p-6 border-border-active relative z-10 bg-bg-tertiary/90 backdrop-blur-md">
        {/* Branding Headers */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gold-400/10 border border-gold-500 flex items-center justify-center text-gold-400 font-bold font-display text-2xl tracking-wider shadow-[0_0_20px_rgba(212,168,67,0.15)] animate-[softPulse_2s_ease-in-out_infinite]">
            P
          </div>
          <div>
            <h2 className="font-display text-3xl tracking-wide text-text-primary uppercase">La Polla 2026</h2>
            <p className="text-xs text-text-secondary uppercase tracking-widest font-mono mt-0.5">
              Prediction Pool Acceso
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleDemoLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              Correo electrónico
            </label>
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              required
            />
          </div>

          {/* Tips block */}
          <div className="text-[10px] text-text-muted leading-relaxed bg-bg-secondary p-2.5 rounded-lg border border-border-default flex items-start gap-1.5">
            <Shield className="w-4 h-4 text-gold-500/80 flex-shrink-0 mt-0.5" />
            <span>
              Ingresa cualquier correo y contraseña para probar en modo demostración. La autenticación persistente con Better Auth será configurada en fases posteriores.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gold py-3 text-md mt-4 transition-all"
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar / Probar Demo'}
          </button>
        </form>
      </div>
    </div>
  );
}
