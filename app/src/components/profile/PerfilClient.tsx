'use client';

import React, { useState } from 'react';
import { User, Mail, Phone, Calendar, Save, CheckCircle, LogOut, Key, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '../../lib/auth-client';
import { updateProfileSettingsAction } from '../../lib/actions/users';

interface UserData {
  id: string;
  name: string;
  email: string;
  username: string | null;
  createdAt: string;
  displayName: string | null;
  whatsapp: string | null;
  isSuperadmin: boolean;
  status: string;
}

interface UserStats {
  points: number;
  exacts: number;
  tendencies: number;
  consolations: number;
  misses: number;
}

const StatBlock = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="bg-bg-secondary border border-border-default rounded-xl p-3 text-center">
    <span className="text-[10px] text-text-secondary uppercase font-mono font-bold">{label}</span>
    <p className={`text-xl font-bold font-mono mt-1 ${color}`}>{value}</p>
  </div>
);

export function PerfilClient({ user, stats }: { user: UserData; stats: UserStats }) {
  const router = useRouter();
  
  // Profile edit states
  const [name, setName] = useState(user.name || '');
  const [username, setUsername] = useState(user.username || '');
  // If email is just placeholder, display empty, otherwise real email
  const isPlaceholderEmail = user.email.endsWith('@polla.local');
  const [email, setEmail] = useState(isPlaceholderEmail ? '' : user.email);
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || '');
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      alert('El nombre de usuario es requerido.');
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim() || `${cleanUsername}@polla.local`;

    try {
      const result = await updateProfileSettingsAction({
        name: name.trim(),
        username: cleanUsername,
        email: email.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
      });

      if (result.error) {
        alert(result.error);
      } else {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Error inesperado al actualizar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordError('Ambas contraseñas son requeridas.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        setPasswordError(error.message || 'Error al cambiar la contraseña.');
      } else {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
      setPasswordError('Ocurrió un error inesperado al cambiar la contraseña.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1.5 pt-2">
        <h2 className="font-display text-3xl tracking-wide text-text-primary">MI CUENTA</h2>
        <p className="text-text-secondary text-sm">Gestiona tus datos de acceso e información de contacto.</p>
      </div>

      {/* Profile Card & Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Stats Breakdown (Left / Top) */}
        <div className="lg:col-span-4 card-base p-5 space-y-4">
          <div className="flex flex-col items-center text-center gap-2 pb-4 border-b border-border-subtle">
            <div className="w-16 h-16 rounded-full bg-gold-400/10 border border-gold-500 flex items-center justify-center text-gold-400 font-mono text-2xl font-bold uppercase shadow-[0_0_20px_rgba(212,168,67,0.15)]">
              {user.name.slice(0, 2)}
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-base">{user.name}</h3>
              <span className="text-xs text-text-secondary">@{user.username}</span>
              <div className="mt-2">
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase ${
                  user.status === 'approved'
                    ? 'bg-green-500/10 text-green-400 border-green-500/30'
                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                }`}>
                  {user.status === 'approved' ? 'Aprobado' : 'Pendiente de aprobación'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-display text-sm uppercase tracking-wider text-text-primary">Tus Números</h4>
            <div className="grid grid-cols-2 gap-2">
              <StatBlock label="Puntos" value={stats.points} color="text-text-primary" />
              <StatBlock label="Exactos" value={stats.exacts} color="text-gold-400" />
              <StatBlock label="Tendencias" value={stats.tendencies} color="text-blue-300" />
              <StatBlock label="Consol." value={stats.consolations} color="text-amber-500" />
              <StatBlock label="Fallos" value={stats.misses} color="text-text-muted" />
            </div>
          </div>
        </div>

        {/* Account Edit Form (Right / Bottom) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="card-base p-5 space-y-5">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Editar Información</h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1">
                  <label
                    htmlFor="perfil-name"
                    className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                  >
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      id="perfil-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      className="field !pl-11"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <label
                    htmlFor="perfil-username"
                    className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                  >
                    Nombre de usuario
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      id="perfil-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      className="field !pl-11"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Email (Optional) */}
                <div className="space-y-1">
                  <label
                    htmlFor="perfil-email"
                    className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                  >
                    Correo electrónico (Opcional)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      id="perfil-email"
                      type="email"
                      placeholder="Ej. correo@ejemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="field !pl-11"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* WhatsApp (Optional) */}
                <div className="space-y-1">
                  <label
                    htmlFor="perfil-whatsapp"
                    className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                  >
                    WhatsApp (Opcional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      id="perfil-whatsapp"
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+51 999 999 999"
                      autoComplete="tel"
                      className="field !pl-11"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Miembro desde */}
              <div className="flex items-center gap-2 opacity-60 text-xs py-1">
                <Calendar className="w-4 h-4 text-text-muted" />
                <span>Miembro registrado desde el {new Date(user.createdAt).toLocaleDateString('es-ES')}</span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                <button
                  type="button"
                  id="perfil-logout"
                  onClick={handleLogout}
                  className="px-4 py-2 border border-red-500/30 bg-red-400/5 hover:bg-red-400/10 text-red-400 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" /> Cerrar Sesión
                </button>
                <div className="flex items-center gap-3">
                  {isSaved && (
                    <span className="text-green-400 text-xs flex items-center gap-1 font-semibold animate-pulse">
                      <CheckCircle className="w-4 h-4" /> Cambios guardados
                    </span>
                  )}
                  <button
                    id="perfil-save"
                    type="submit"
                    disabled={loading}
                    className="btn-gold py-2 px-6 flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="card-base p-5 space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary flex items-center gap-2">
              <Key className="w-5 h-5 text-gold-400" /> Cambiar Contraseña
            </h3>

            {passwordError && (
              <div className="text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="text-xs text-green-400 bg-green-400/15 border border-green-500/30 p-3 rounded-lg flex items-start gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Contraseña cambiada exitosamente.</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="current-pw" className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                    Contraseña Actual
                  </label>
                  <input
                    id="current-pw"
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="field text-sm"
                    disabled={passwordLoading}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="new-pw" className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                    Nueva Contraseña
                  </label>
                  <input
                    id="new-pw"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="field text-sm"
                    disabled={passwordLoading}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="btn-gold py-2 px-6"
                >
                  {passwordLoading ? 'Cambiando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
