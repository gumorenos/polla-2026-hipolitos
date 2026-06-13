'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '../../lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Basic Input Validations
    if (!email.trim() || !password.trim()) {
      setErrorMsg('El correo y la contraseña son requeridos.');
      setLoading(false);
      return;
    }

    if (isRegister) {
      if (!name.trim()) {
        setErrorMsg('El nombre es requerido para registrarse.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
        setLoading(false);
        return;
      }

      try {
        const { error } = await authClient.signUp.email({
          email: email.trim(),
          password: password,
          name: name.trim(),
          displayName: displayName.trim() || name.trim(),
          whatsapp: whatsapp.trim(),
        });

        if (error) {
          setErrorMsg(error.message || 'Error al registrarse. Inténtalo de nuevo.');
          setLoading(false);
        } else {
          // After registration, go to leagues page to join or create a league
          router.push('/liga');
          router.refresh();
        }
      } catch (err) {
        console.error('Error de registro:', err);
        setErrorMsg('Ocurrió un error inesperado al registrarse.');
        setLoading(false);
      }
    } else {
      try {
        const { error } = await authClient.signIn.email({
          email: email.trim(),
          password: password,
        });

        if (error) {
          setErrorMsg(error.message || 'Credenciales incorrectas. Inténtalo de nuevo.');
          setLoading(false);
        } else {
          // After login, go to predictions
          router.push('/pronosticos');
          router.refresh();
        }
      } catch (err) {
        console.error('Error de login:', err);
        setErrorMsg('Ocurrió un error inesperado al iniciar sesión.');
        setLoading(false);
      }
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setErrorMsg(null);
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
            <h2 className="font-display text-3xl tracking-wide text-text-primary uppercase">
              {isRegister ? 'Registro de Cuenta' : 'La Polla 2026'}
            </h2>
            <p className="text-xs text-text-secondary uppercase tracking-widest font-mono mt-0.5">
              {isRegister ? 'Crear perfil privado' : 'Prediction Pool Acceso'}
            </p>
          </div>
        </div>

        {/* Error Message Alert */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-4 text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {isRegister && (
            <>
              {/* Full Name */}
              <div className="space-y-1">
                <label
                  htmlFor="auth-name"
                  className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                >
                  Nombre Completo
                </label>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="field text-sm py-2 px-3"
                  required={isRegister}
                  disabled={loading}
                />
              </div>

              {/* Username (Optional) */}
              <div className="space-y-1">
                <label
                  htmlFor="auth-displayname"
                  className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                >
                  Usuario / Apodo (Opcional)
                </label>
                <input
                  id="auth-displayname"
                  type="text"
                  placeholder="Ej. juanp10"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="nickname"
                  className="field text-sm py-2 px-3"
                  disabled={loading}
                />
              </div>

              {/* WhatsApp (Optional) */}
              <div className="space-y-1">
                <label
                  htmlFor="auth-whatsapp"
                  className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                >
                  WhatsApp (Opcional)
                </label>
                <input
                  id="auth-whatsapp"
                  type="tel"
                  placeholder="Ej. +573001234567"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  autoComplete="tel"
                  className="field text-sm py-2 px-3 font-mono"
                  disabled={loading}
                />
              </div>
            </>
          )}

          {/* Email */}
          <div className="space-y-1">
            <label
              htmlFor="auth-email"
              className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
            >
              Correo electrónico
            </label>
            <input
              id="auth-email"
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="field text-sm py-2 px-3"
              required
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label
              htmlFor="auth-password"
              className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
            >
              Contraseña
            </label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className="field text-sm py-2 px-3"
              required
              disabled={loading}
            />
          </div>

          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            className="w-full btn-gold py-2.5 text-md mt-4 transition-all text-sm uppercase tracking-wider"
          >
            {loading
              ? isRegister
                ? 'Registrando...'
                : 'Iniciando sesión...'
              : isRegister
              ? 'Registrarse'
              : 'Ingresar'}
          </button>
        </form>

        {/* Toggle Mode Link */}
        <div className="mt-5 text-center text-xs">
          <button
            id="auth-toggle"
            type="button"
            onClick={toggleMode}
            className="text-gold-400 hover:underline transition-all bg-transparent border-none cursor-pointer"
          >
            {isRegister
              ? '¿Ya tienes una cuenta? Inicia Sesión'
              : '¿No tienes cuenta? Regístrate'}
          </button>
        </div>
      </div>
    </div>
  );
}
