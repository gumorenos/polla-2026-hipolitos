'use client';

import React, { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '../../lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message || 'Credenciales incorrectas. Inténtalo de nuevo.');
        setLoading(false);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      console.error('Error de login:', err);
      setErrorMsg('Ocurrió un error inesperado al iniciar sesión.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4 py-12 relative overflow-hidden">
      {/* Decorative Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gold-400/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm card-base p-6 border-border-active relative z-10 bg-bg-tertiary/90 backdrop-blur-md">
        {/* Branding Headers */}
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
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

        {/* Error Message Alert */}
        {errorMsg && (
          <div className="mb-4 text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2 animate-[slideUp_0.2s_ease-out]">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>

          {/* Dev credentials tips block */}
          <div className="text-[10px] text-text-muted leading-relaxed bg-bg-secondary p-2.5 rounded-lg border border-border-default flex flex-col gap-1.5">
            <div className="flex items-start gap-1.5">
              <Shield className="w-4 h-4 text-gold-500/80 flex-shrink-0 mt-0.5" />
              <span className="font-semibold text-text-secondary uppercase tracking-wider">Cuentas de Desarrollo:</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 font-mono">
              <li>Admin: gustavo@example.com / Admin123!</li>
              <li>User: carlos@example.com / User123!</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gold py-3 text-md mt-4 transition-all"
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

