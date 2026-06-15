'use client';

import React, { useState } from 'react';
import { toggleUserSuperadminAction, updateUserStatusAction, adminCreateUserAction } from '../../../lib/actions/admin';
import { useRouter } from 'next/navigation';
import { Plus, X, Search, UserCheck, Shield, AlertTriangle, Play, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface UserFromDB {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  status: string;
  whatsapp: string | null;
  isSuperadmin: boolean;
  createdAt: Date;
  memberships?: {
    league: {
      id: string;
      name: string;
    };
  }[];
}

export default function UsersAdminClient({ users, currentUserId }: { users: UserFromDB[], currentUserId: string }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'blocked'>('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newStatus, setNewStatus] = useState('approved');
  const [showPassword, setShowPassword] = useState(false);

  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleToggleSuperadmin = async (userId: string, currentVal: boolean) => {
    const actionLabel = currentVal ? 'quitar' : 'dar';
    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} el rol de Superadmin a este usuario?`)) {
      return;
    }

    setLoadingUserId(userId);
    setError(null);
    setSuccess(null);

    const res = await toggleUserSuperadminAction(userId, !currentVal);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Usuario actualizado exitosamente');
      router.refresh();
    }
    setLoadingUserId(null);
  };

  const handleUpdateStatus = async (userId: string, targetStatus: string) => {
    let actionLabel = 'actualizar';
    if (targetStatus === 'approved') actionLabel = 'aprobar';
    if (targetStatus === 'rejected') actionLabel = 'rechazar';
    if (targetStatus === 'disabled') actionLabel = 'deshabilitar';

    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} a este usuario?`)) {
      return;
    }

    setLoadingUserId(userId);
    setError(null);
    setSuccess(null);

    const res = await updateUserStatusAction(userId, targetStatus);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Usuario ${actionLabel}do correctamente`);
      router.refresh();
    }
    setLoadingUserId(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newName.trim() || !newPassword.trim()) {
      setError('Nombre completo, usuario y contraseña son requeridos');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await adminCreateUserAction({
      username: newUsername,
      name: newName,
      passwordText: newPassword,
      email: newEmail || undefined,
      whatsapp: newWhatsapp || undefined,
      status: newStatus,
    });

    if (res.error) {
      setError(res.error);
      setActionLoading(false);
    } else {
      setSuccess('Usuario creado exitosamente.');
      // Clean form
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      setNewEmail('');
      setNewWhatsapp('');
      setShowCreateModal(false);
      setActionLoading(false);
      router.refresh();
    }
  };

  // Filter logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.whatsapp && u.whatsapp.includes(searchTerm));

    if (!matchesSearch) return false;

    if (statusFilter === 'pending') return u.status === 'pending';
    if (statusFilter === 'approved') return u.status === 'approved';
    if (statusFilter === 'blocked') return u.status === 'rejected' || u.status === 'disabled';

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Messages Alerts */}
      {error && <div className="p-4 bg-red-900/50 text-red-200 border border-red-500 rounded-md text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-900/50 text-green-200 border border-green-500 rounded-md text-sm">{success}</div>}

      {/* Search and Filter Panel */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, etc..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field pl-11 text-xs"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-bg-tertiary p-1 border border-border-default rounded-xl w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'all' ? 'bg-gold-400 text-bg-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'pending' ? 'bg-yellow-500 text-bg-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'approved' ? 'bg-green-500 text-bg-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Aprobados
          </button>
          <button
            onClick={() => setStatusFilter('blocked')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'blocked' ? 'bg-red-500 text-bg-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Bloqueados
          </button>
        </div>

        {/* Manual Create Trigger */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-gold py-2 px-4 text-xs flex items-center gap-1.5 uppercase font-semibold tracking-wider w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Crear Usuario
        </button>
      </div>

      {/* Users List Table */}
      <div className="card-base overflow-hidden">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-surface border-b border-border text-text-muted">
            <tr className="uppercase font-mono tracking-wider font-bold">
              <th className="p-3">Nombre</th>
              <th className="p-3">Usuario</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3">Competencias</th>
              <th className="p-3 text-center">En Ranking?</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Rol</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-text-muted">
                  No se encontraron usuarios coincidentes.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isYou = user.id === currentUserId;
                const isLoading = loadingUserId === user.id;

                return (
                  <tr key={user.id} className="hover:bg-surface/50 transition-colors">
                    <td className="p-3 font-semibold">
                      {user.name}
                      {isYou && (
                        <span className="text-[9px] text-gold border border-gold/30 px-1.5 py-0.5 rounded ml-2 uppercase font-mono tracking-wider font-bold">
                          TÚ
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-gold-400">@{user.username}</td>
                    <td className="p-3 font-mono text-[11px]">
                      {user.whatsapp || <span className="text-text-muted italic">-</span>}
                    </td>
                    <td className="p-3 text-xs max-w-xs truncate">
                      {user.memberships && user.memberships.length > 0 ? (
                        user.memberships.map((m) => m.league.name).join(', ')
                      ) : (
                        <span className="text-text-muted italic">Ninguna</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-center font-bold">
                      {user.status === 'approved' ? (
                        <span className="text-green-400">Sí</span>
                      ) : (
                        <span className="text-text-muted">No</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full uppercase border font-semibold text-[10px] ${
                        user.status === 'approved'
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : user.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                          : user.status === 'disabled'
                          ? 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}>
                        {user.status === 'approved' ? 'Aprobado' :
                         user.status === 'pending' ? 'Pendiente' :
                         user.status === 'disabled' ? 'Desactivado' :
                         user.status === 'rejected' ? 'Rechazado' : user.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full uppercase border font-semibold text-[10px] ${
                        user.isSuperadmin ? 'bg-gold-400/10 text-gold-400 border-gold-400/30' : 'bg-surface border-border text-text-secondary'
                      }`}>
                        {user.isSuperadmin ? 'Superadmin' : 'Usuario'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {!isYou && (
                        <>
                          {/* Approval / Rejection controls */}
                          {user.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(user.id, 'approved')}
                                disabled={isLoading}
                                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(user.id, 'rejected')}
                                disabled={isLoading}
                                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                              >
                                Rechazar
                              </button>
                            </>
                          )}

                          {user.status === 'approved' && (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'disabled')}
                              disabled={isLoading}
                              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                            >
                              Deshabilitar
                            </button>
                          )}

                          {(user.status === 'disabled' || user.status === 'rejected') && (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'approved')}
                              disabled={isLoading}
                              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                            >
                              Re-Habilitar
                            </button>
                          )}

                          {/* Toggle Superadmin privileges */}
                          <button
                            onClick={() => handleToggleSuperadmin(user.id, user.isSuperadmin)}
                            disabled={isLoading}
                            className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-all ${
                              user.isSuperadmin
                                ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25'
                                : 'bg-gold-400/10 border-gold-400/30 text-gold-400 hover:bg-gold-400/20'
                            }`}
                          >
                            {user.isSuperadmin ? 'Quitar Admin' : 'Hacer Admin'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 max-w-md w-full border-border-active space-y-4 relative bg-bg-tertiary">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="font-display text-2xl tracking-wide uppercase text-text-primary">Crear Cuenta Manual</h3>
              <p className="text-xs text-text-secondary">El usuario se registrará directamente con las credenciales especificadas.</p>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Nombre Completo</label>
                <input
                  type="text"
                  placeholder="Ej. Carlos Fuentes"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="field py-1.5 px-3 text-xs"
                  required
                />
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Nombre de usuario</label>
                <input
                  type="text"
                  placeholder="Ej. carlosf"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="field py-1.5 px-3 text-xs"
                  required
                />
              </div>

              {/* Temporary Password */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Contraseña Temporal</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="field py-1.5 pl-3 pr-10 text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Email (Optional) */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Correo (Opcional)</label>
                <input
                  type="email"
                  placeholder="Ej. carlos@correo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="field py-1.5 px-3 text-xs"
                />
              </div>

              {/* Whatsapp (Optional) */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">WhatsApp (Opcional)</label>
                <input
                  type="tel"
                  placeholder="Ej. +51 999 999 999"
                  value={newWhatsapp}
                  onChange={(e) => setNewWhatsapp(e.target.value)}
                  className="field py-1.5 px-3 text-xs"
                />
              </div>

              {/* Initial Status */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Estado Inicial</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="field py-1.5 px-3 text-xs bg-bg-secondary text-text-primary"
                >
                  <option value="approved">Aprobado / Activo de inmediato</option>
                  <option value="pending">Pendiente de Aprobación</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-gold py-2 px-5 text-xs uppercase font-mono"
                >
                  {actionLoading ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
