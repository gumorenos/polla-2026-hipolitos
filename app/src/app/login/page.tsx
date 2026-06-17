'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '../../lib/auth-client';

function getAuthErrorMessage(message?: string | null) {
  const normalized = (message || '').toLowerCase();

  if (
    normalized.includes('invalid username or password') ||
    normalized.includes('invalid email or password') ||
    normalized.includes('invalid password') ||
    normalized.includes('user not found') ||
    normalized.includes('invalid credentials')
  ) {
    return 'Usuario o contraseña inválidos.';
  }
  if (normalized.includes('pending')) {
    return 'Tu cuenta aún está pendiente de aprobación.';
  }
  if (normalized.includes('disabled')) {
    return 'Tu cuenta ha sido deshabilitada.';
  }
  if (normalized.includes('rejected')) {
    return 'Tu cuenta fue rechazada.';
  }

  return message || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const cleanUsername = username.trim().toLowerCase();

    // Basic Input Validations
    if (!cleanUsername || !password.trim()) {
      setErrorMsg('El usuario y la contraseña son requeridos.');
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
        const placeholderEmail = `${cleanUsername}@polla.local`;
        const { error } = await authClient.signUp.email({
          email: placeholderEmail,
          password: password,
          name: name.trim(),
          username: cleanUsername,
          displayUsername: cleanUsername,
          displayName: name.trim(),
        });

        if (error) {
          setErrorMsg(error.message || 'Error al registrarse. Inténtalo de nuevo.');
          setLoading(false);
        } else {
          // After registration, go to Inicio/Home page
          router.push('/');
          router.refresh();
        }
      } catch (err) {
        console.error('Error de registro:', err);
        setErrorMsg('Ocurrió un error inesperado al registrarse.');
        setLoading(false);
      }
    } else {
      try {
        const { error } = await authClient.signIn.username({
          username: cleanUsername,
          password: password,
        });

        if (error) {
          setErrorMsg(getAuthErrorMessage(error.message));
          setLoading(false);
        } else {
          // After login, go to Inicio/Home page
          router.push('/');
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
              {isRegister ? 'Crear perfil privado' : 'Acceso a la Polla'}
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
            </>
          )}

          {/* Username */}
          <div className="space-y-1">
            <label
              htmlFor="auth-username"
              className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
            >
              Nombre de usuario
            </label>
            <input
              id="auth-username"
              type="text"
              placeholder="Ej. juanp10"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
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
