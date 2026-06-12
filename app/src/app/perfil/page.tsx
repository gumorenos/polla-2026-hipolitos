'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { MOCK_STANDINGS } from '../../lib/mockData';
import { User, Mail, Phone, Calendar, Save, CheckCircle, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authClient } from '../../lib/auth-client';

const StatBlock = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="bg-bg-secondary border border-border-default rounded-xl p-3 text-center">
    <span className="text-[10px] text-text-secondary uppercase font-mono font-bold">{label}</span>
    <p className={`text-xl font-bold font-mono mt-1 ${color}`}>{value}</p>
  </div>
);

export default function PerfilPage() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  if (isPending) {
    return (
      <AppShell>
        <div className="min-h-[50vh] flex items-center justify-center">
          <p className="text-text-secondary animate-pulse uppercase tracking-wider font-mono text-sm">
            Cargando perfil...
          </p>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="min-h-[50vh] flex items-center justify-center">
          <p className="text-red-400 uppercase tracking-wider font-mono text-sm">
            Sesión no activa
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PerfilForm user={user} />
    </AppShell>
  );
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  displayName?: string | null;
  whatsapp?: string | null;
  isSuperadmin?: boolean;
}

function PerfilForm({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName || user.name || '');
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || '');
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch statistics from mock standings based on active user id
  const userStats = MOCK_STANDINGS.find((s) => s.userId === user?.id) ?? {
    points: 0,
    exacts: 0,
    tendencies: 0,
    consolations: 0,
    misses: 0,
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await authClient.updateUser({
        displayName,
        whatsapp,
      });

      if (error) {
        alert(error.message || 'Error al actualizar el perfil.');
      } else {
        setIsSaved(true);
        setTimeout(() => {
          setIsSaved(false);
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      alert('Error inesperado al actualizar el perfil.');
    } finally {
      setLoading(false);
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
        <h2 className="font-display text-3xl tracking-wide text-text-primary">MI PERFIL</h2>
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
              <span className="text-xs text-text-secondary">@{user.displayName || user.name}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-display text-sm uppercase tracking-wider text-text-primary">Tus Números</h4>
            <div className="grid grid-cols-2 gap-2">
              <StatBlock label="Puntos" value={userStats.points} color="text-text-primary" />
              <StatBlock label="Exactos" value={userStats.exacts} color="text-gold-400" />
              <StatBlock label="Tendencias" value={userStats.tendencies} color="text-blue-300" />
              <StatBlock label="Consol." value={userStats.consolations} color="text-amber-500" />
              <StatBlock label="Fallos" value={userStats.misses} color="text-text-muted" />
            </div>
          </div>
        </div>

        {/* Account Edit Form (Right / Bottom) */}
        <div className="lg:col-span-8 card-base p-5 space-y-5">
          <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Editar Información</h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Display Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  Nombre de usuario (Display Name)
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4.5 h-4.5 text-text-muted" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="field pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
                  WhatsApp (Notificaciones de cierre)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4.5 h-4.5 text-text-muted" />
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+57 300 123 4567"
                    className="field pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Read-only system inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Email (Readonly) */}
              <div className="space-y-1 opacity-60">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  Correo electrónico (No editable)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4.5 h-4.5 text-text-muted" />
                  <input
                    type="email"
                    value={user.email}
                    className="field pl-10 bg-bg-primary cursor-not-allowed"
                    disabled
                  />
                </div>
              </div>

              {/* Created Date (Readonly) */}
              <div className="space-y-1 opacity-60">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  Miembro desde
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-3 w-4.5 h-4.5 text-text-muted" />
                  <input
                    type="text"
                    value={new Date(user.createdAt).toLocaleDateString('es-ES')}
                    className="field pl-10 bg-bg-primary cursor-not-allowed"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 border border-red-500/30 bg-red-400/5 hover:bg-red-400/10 text-red-400 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" /> Cerrar Sesión
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs">
                  {isSaved && (
                    <span className="text-green-400 flex items-center gap-1 font-semibold animate-pulse">
                      <CheckCircle className="w-4 h-4" /> Cambios guardados
                    </span>
                  )}
                </span>
                <button
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
      </div>
    </div>
  );
}

