'use client';

import React, { useState } from 'react';
import { User, Mail, Phone, Calendar, Save, CheckCircle, LogOut, Key, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '../../lib/auth-client';
import { updateProfileSettingsAction, updateThemeAction, updateReminderPreferencesAction } from '../../lib/actions/users';

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
  themeMode: string;
  remindersEnabled: boolean;
  emailRemindersEnabled: boolean;
  reminderMinutesBeforeDeadline: number;
  reminderEmail: string | null;
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
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || '');
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Theme preference state
  const [themeMode, setThemeMode] = useState<'black' | 'dark' | 'light'>(
    (user.themeMode as 'black' | 'dark' | 'light') || 'black'
  );
  const [themeSaving, setThemeSaving] = useState(false);

  // Reminders preferences state
  const [emailReminders, setEmailReminders] = useState<boolean>(user.emailRemindersEnabled);
  const [reminderEmail, setReminderEmail] = useState<string>(user.reminderEmail || '');
  const [reminderEmailConfirm, setReminderEmailConfirm] = useState<string>(user.reminderEmail || '');
  const [remindersSaving, setRemindersSaving] = useState<boolean>(false);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [remindersSuccess, setRemindersSuccess] = useState<string | null>(null);

  const handleSaveReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    setRemindersSaving(true);
    setRemindersError(null);
    setRemindersSuccess(null);

    const cleanEmail = reminderEmail.trim();
    const cleanConfirm = reminderEmailConfirm.trim();

    if (emailReminders) {
      if (!cleanEmail) {
        setRemindersError('El correo electrónico para recordatorios es requerido.');
        setRemindersSaving(false);
        return;
      }
      if (cleanEmail !== cleanConfirm) {
        setRemindersError('Los correos no coinciden.');
        setRemindersSaving(false);
        return;
      }
      if (!cleanEmail.includes('@')) {
        setRemindersError('El correo electrónico no es válido.');
        setRemindersSaving(false);
        return;
      }
    }

    try {
      const res = await updateReminderPreferencesAction(
        emailReminders,
        cleanEmail || null,
        cleanConfirm || null
      );
      if (res.error) {
        setRemindersError(res.error);
      } else {
        setRemindersSuccess('Preferencias de recordatorios guardadas.');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setRemindersError('Error al guardar preferencias de recordatorios.');
    } finally {
      setRemindersSaving(false);
    }
  };

  const handleThemeChange = async (newTheme: 'black' | 'dark' | 'light') => {
    const oldTheme = themeMode;
    setThemeMode(newTheme);
    setThemeSaving(true);
    
    // Apply class immediately on document element to avoid flash
    document.documentElement.classList.remove('theme-black', 'theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${newTheme}`);

    try {
      const res = await updateThemeAction(newTheme);
      if (res.error) {
        alert(res.error);
        // Rollback
        document.documentElement.classList.remove(`theme-${newTheme}`);
        document.documentElement.classList.add(`theme-${oldTheme}`);
        setThemeMode(oldTheme);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Error al actualizar el tema.');
      // Rollback
      document.documentElement.classList.remove(`theme-${newTheme}`);
      document.documentElement.classList.add(`theme-${oldTheme}`);
      setThemeMode(oldTheme);
    } finally {
      setThemeSaving(false);
    }
  };

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

    try {
      const result = await updateProfileSettingsAction({
        name: name.trim(),
        username: cleanUsername,
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
      router.push('/');
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
                      className="field field-icon-left"
                      style={{ paddingLeft: '2.75rem' }}
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
                      className="field field-icon-left"
                      style={{ paddingLeft: '2.75rem' }}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Email (Read-only login info) */}
                <div className="space-y-1">
                  <label
                    className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                  >
                    Correo de Inicio de Sesión
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="text"
                      value={isPlaceholderEmail ? 'No configurado' : user.email}
                      disabled
                      className="field field-icon-left opacity-60 cursor-not-allowed"
                      style={{ paddingLeft: '2.75rem' }}
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
                      className="field field-icon-left"
                      style={{ paddingLeft: '2.75rem' }}
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

          {/* Visual Theme Selection */}
          <div className="card-base p-5 space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">
              Apariencia
            </h3>
            <p className="text-xs text-text-secondary">
              Personaliza el tema visual de la aplicación. Se aplicará de forma privada a tu cuenta.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(['black', 'dark', 'light'] as const).map((t) => {
                const label = t === 'black' ? 'Negro' : t === 'dark' ? 'Oscuro' : 'Claro';
                const isActive = themeMode === t;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={themeSaving}
                    onClick={() => handleThemeChange(t)}
                    className={`py-2.5 px-4 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all border cursor-pointer ${
                      isActive
                        ? 'bg-gold-400 border-gold-400 text-[#0A0A0F] shadow-[0_4px_12px_rgba(212,168,67,0.2)]'
                        : 'bg-bg-secondary hover:bg-bg-hover border-border-default text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email Reminders Opt-in Preferences */}
          <div className="card-base p-5 space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">
              Recordatorios por email
            </h3>
            <p className="text-xs text-text-secondary">
              Te enviaremos un recordatorio 30 minutos antes del cierre solo si aún no enviaste tu predicción para un partido de hoy.
            </p>

            <form onSubmit={handleSaveReminders} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email para recordatorios */}
                <div className="space-y-1">
                  <label
                    htmlFor="perfil-reminder-email"
                    className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                  >
                    Email para recordatorios
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      id="perfil-reminder-email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={reminderEmail}
                      onChange={(e) => {
                        setReminderEmail(e.target.value);
                        setRemindersSuccess(null);
                        setRemindersError(null);
                      }}
                      className="field field-icon-left text-sm"
                      style={{ paddingLeft: '2.75rem' }}
                      disabled={remindersSaving}
                    />
                  </div>
                </div>

                {/* Confirmar email */}
                <div className="space-y-1">
                  <label
                    htmlFor="perfil-reminder-email-confirm"
                    className="text-xs font-semibold text-text-secondary uppercase tracking-wider block"
                  >
                    Confirmar email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      id="perfil-reminder-email-confirm"
                      type="email"
                      placeholder="Repite el correo"
                      value={reminderEmailConfirm}
                      onChange={(e) => {
                        setReminderEmailConfirm(e.target.value);
                        setRemindersSuccess(null);
                        setRemindersError(null);
                      }}
                      className="field field-icon-left text-sm"
                      style={{ paddingLeft: '2.75rem' }}
                      disabled={remindersSaving}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 py-1">
                <input
                  id="emailRemindersEnabled"
                  type="checkbox"
                  checked={emailReminders}
                  disabled={remindersSaving}
                  onChange={(e) => {
                    setEmailReminders(e.target.checked);
                    setRemindersSuccess(null);
                    setRemindersError(null);
                  }}
                  className="w-4 h-4 rounded border-border-default bg-bg-secondary text-gold-500 focus:ring-gold-500 cursor-pointer disabled:cursor-not-allowed"
                />
                <label
                  htmlFor="emailRemindersEnabled"
                  className="text-xs font-semibold uppercase tracking-wider cursor-pointer text-text-secondary hover:text-text-primary"
                >
                  Recibir recordatorios por email
                </label>
              </div>

              {remindersError && (
                <p className="text-xs text-red-400 font-mono flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {remindersError}
                </p>
              )}

              {remindersSuccess && (
                <p className="text-xs text-green-400 font-mono flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> {remindersSuccess}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={remindersSaving}
                  className="btn-gold py-2 px-6 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" /> {remindersSaving ? 'Guardando...' : 'Guardar preferencias'}
                </button>
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
