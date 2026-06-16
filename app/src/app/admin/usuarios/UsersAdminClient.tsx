'use client';

import React, { useState } from 'react';
import { 
  toggleUserSuperadminAction, 
  updateUserStatusAction, 
  adminCreateUserAction,
  adminUpdateUserAction,
  adminResetUserChampionAction,
  adminUpdateLeagueMemberRoleAction,
  adminRemoveFromLeagueAction,
  adminAddToLeagueAction
} from '../../../lib/actions/admin';
import {
  allowWinnerPredictionCorrectionAction,
  directCorrectWinnerPredictionAction
} from '../../../lib/actions/predictions';
import { useRouter } from 'next/navigation';
import { Plus, X, Search, Eye, EyeOff } from 'lucide-react';

interface UserFromDB {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  status: string;
  whatsapp: string | null;
  isSuperadmin: boolean;
  canCreateLeagues?: boolean;
  createdAt: Date;
  remindersEnabled?: boolean;
  emailRemindersEnabled?: boolean;
  reminderEmail?: string | null;
  memberships?: {
    league: {
      id: string;
      name: string;
    };
    role: string;
  }[];
  winnerPredictions?: {
    leagueId: string;
    teamCode: string;
    correctionAllowed: boolean;
    correctionAllowedUntil: Date | string | null;
    correctionReason: string | null;
    league: {
      id: string;
      name: string;
    };
    team: {
      name: string;
    };
  }[];
  winnerPredictionHistories?: {
    id: string;
    leagueId: string;
    userId: string;
    oldTeamCode: string | null;
    newTeamCode: string;
    actionType: string;
    authorizedById: string | null;
    changedById: string | null;
    reason: string | null;
    createdAt: string | Date;
    league: {
      name: string;
    };
  }[];
}

export default function UsersAdminClient({ 
  users, 
  leagues = [], 
  currentUserId 
}: { 
  users: UserFromDB[];
  leagues?: { id: string; name: string }[];
  currentUserId: string;
}) {
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

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserFromDB | null>(null);
  
  // Edit Form Fields
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editIsSuperadmin, setEditIsSuperadmin] = useState(false);
  const [editCanCreateLeagues, setEditCanCreateLeagues] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editReminders, setEditReminders] = useState(false);
  const [editEmailReminders, setEditEmailReminders] = useState(false);
  const [editReminderEmail, setEditReminderEmail] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Teams list used for champion pick corrections
  // Usually this is loaded dynamically or we can just fetch the static map keys
  const teams = [
    { code: 'ARG', name: 'Argentina' },
    { code: 'BRA', name: 'Brasil' },
    { code: 'FRA', name: 'Francia' },
    { code: 'ESP', name: 'España' },
    { code: 'GER', name: 'Alemania' },
    { code: 'ENG', name: 'Inglaterra' },
    { code: 'ITA', name: 'Italia' },
    { code: 'POR', name: 'Portugal' },
    { code: 'URU', name: 'Uruguay' },
    { code: 'MEX', name: 'México' },
    { code: 'USA', name: 'Estados Unidos' },
    { code: 'COL', name: 'Colombia' },
    { code: 'ECU', name: 'Ecuador' },
    { code: 'MAR', name: 'Marruecos' },
    { code: 'CRO', name: 'Croacia' },
    { code: 'NED', name: 'Países Bajos' },
    { code: 'JPN', name: 'Japón' },
    { code: 'SEN', name: 'Senegal' },
  ];

  const handleStartEditUser = (user: UserFromDB) => {
    setSelectedUser(user);
    setEditName(user.name || '');
    setEditUsername(user.username || '');
    setEditEmail(user.email || '');
    setEditWhatsapp(user.whatsapp || '');
    setEditStatus(user.status || 'pending');
    setEditIsSuperadmin(user.isSuperadmin || false);
    setEditCanCreateLeagues(user.canCreateLeagues || false);
    setEditPassword('');
    setEditReminders(user.remindersEnabled || false);
    setEditEmailReminders(user.emailRemindersEnabled || false);
    setEditReminderEmail(user.reminderEmail || '');
    setShowEditModal(true);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    // Detect sensitive edits
    const isSensitiveEdit = 
      editUsername !== selectedUser.username ||
      editStatus !== selectedUser.status ||
      editIsSuperadmin !== selectedUser.isSuperadmin ||
      !!editPassword;

    let reason: string | undefined;
    if (isSensitiveEdit) {
      const promptReason = prompt("Has modificado campos sensibles (usuario, estado, superadmin o contraseña). Por favor ingresa el motivo del cambio (obligatorio):");
      if (promptReason === null) {
        setActionLoading(false);
        return; // Cancelled
      }
      if (!promptReason.trim()) {
        alert("El motivo es obligatorio para realizar cambios sensibles.");
        setActionLoading(false);
        return;
      }
      reason = promptReason;
    }

    const res = await adminUpdateUserAction(selectedUser.id, {
      name: editName,
      username: editUsername,
      email: editEmail,
      whatsapp: editWhatsapp,
      status: editStatus,
      isSuperadmin: editIsSuperadmin,
      canCreateLeagues: editCanCreateLeagues,
      passwordText: editPassword || undefined,
      remindersEnabled: editReminders,
      emailRemindersEnabled: editEmailReminders,
      reminderEmail: editReminderEmail,
    }, reason);

    if (res.error) {
      setError(res.error);
      setActionLoading(false);
    } else {
      setSuccess('Usuario actualizado con éxito.');
      setShowEditModal(false);
      setActionLoading(false);
      router.refresh();
    }
  };

  const handleResetChampion = async (leagueId: string, leagueName: string) => {
    if (!selectedUser) return;
    const reason = prompt(`¿Estás seguro de restablecer la predicción de campeón de ${selectedUser.name} en la liga "${leagueName}"? Ingrese el motivo (se registrará en el historial):`);
    if (reason === null) return; // Cancelled
    if (!reason.trim()) {
      alert("El motivo es obligatorio.");
      return;
    }
    
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const res = await adminResetUserChampionAction(selectedUser.id, leagueId, reason);

    if (res.error) {
      setError(res.error);
      setActionLoading(false);
    } else {
      setSuccess('Predicción de campeón restablecida con éxito.');
      setShowEditModal(false);
      setActionLoading(false);
      router.refresh();
    }
  };

  const handleToggleSuperadmin = async (userId: string, currentVal: boolean) => {
    const actionLabel = currentVal ? 'quitar' : 'dar';
    const reason = prompt(`¿Estás seguro de que deseas ${actionLabel} el rol de Superadmin a este usuario? Ingrese el motivo (se registrará en la auditoría):`);
    if (reason === null) return;
    if (!reason.trim()) {
      alert("El motivo es obligatorio.");
      return;
    }

    setLoadingUserId(userId);
    setError(null);
    setSuccess(null);

    const res = await toggleUserSuperadminAction(userId, !currentVal, reason);

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

    const reason = prompt(`¿Estás seguro de que deseas ${actionLabel} a este usuario? Ingrese el motivo (se registrará en la auditoría):`);
    if (reason === null) return;
    if (!reason.trim()) {
      alert("El motivo es obligatorio.");
      return;
    }

    setLoadingUserId(userId);
    setError(null);
    setSuccess(null);

    const res = await updateUserStatusAction(userId, targetStatus, reason);

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
            className="field field-icon-left text-xs"
            style={{ paddingLeft: '2.75rem' }}
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
                      <button
                        onClick={() => handleStartEditUser(user)}
                        disabled={isLoading}
                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-bg-secondary border-border-default text-text-primary hover:bg-bg-hover transition-colors"
                      >
                        Editar
                      </button>

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

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card-base p-6 max-w-xl w-full border-border-active space-y-4 relative bg-bg-tertiary max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="font-display text-2xl tracking-wide uppercase text-text-primary">Editar Usuario</h3>
              <p className="text-xs text-text-secondary">Modifica los datos del usuario y gestiona su participación.</p>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Nombre Completo</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="field py-1.5 px-3 text-xs"
                    required
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Nombre de usuario</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="field py-1.5 px-3 text-xs"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Correo</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="field py-1.5 px-3 text-xs"
                    required
                  />
                </div>

                {/* WhatsApp */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">WhatsApp</label>
                  <input
                    type="tel"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="field py-1.5 px-3 text-xs"
                  />
                </div>

                {/* Status select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Estado</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="field py-1.5 px-3 text-xs bg-bg-secondary text-text-primary border border-border"
                  >
                    <option value="approved">Aprobado</option>
                    <option value="pending">Pendiente</option>
                    <option value="rejected">Rechazado</option>
                    <option value="disabled">Desactivado</option>
                  </select>
                </div>

                {/* Password Reset */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Restablecer Contraseña (Opcional)</label>
                  <div className="relative">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      placeholder="Nueva contraseña"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="field py-1.5 pl-3 pr-10 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-2 text-text-muted hover:text-text-primary"
                    >
                      {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Reminder Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Email para Recordatorios</label>
                  <input
                    type="email"
                    value={editReminderEmail}
                    onChange={(e) => setEditReminderEmail(e.target.value)}
                    className="field py-1.5 px-3 text-xs"
                    placeholder="Opcional. Si se deja en blanco se usará el correo principal"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-black/20 p-3 rounded-lg border border-border/80 space-y-2 text-xs">
                <span className="font-bold text-gold font-mono uppercase tracking-wider block text-[10px] mb-1">Permisos y Recordatorios</span>
                
                <label className="flex items-center gap-2 cursor-pointer select-none text-text-secondary">
                  <input
                    type="checkbox"
                    checked={editIsSuperadmin}
                    onChange={(e) => setEditIsSuperadmin(e.target.checked)}
                    className="rounded border-border text-gold bg-background accent-gold w-3.5 h-3.5"
                  />
                  <span>Es Superadministrador Global</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-text-secondary">
                  <input
                    type="checkbox"
                    checked={editCanCreateLeagues}
                    onChange={(e) => setEditCanCreateLeagues(e.target.checked)}
                    className="rounded border-border text-gold bg-background accent-gold w-3.5 h-3.5"
                  />
                  <span>Puede Crear Competencias / Ligas</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-text-secondary">
                  <input
                    type="checkbox"
                    checked={editReminders}
                    onChange={(e) => setEditReminders(e.target.checked)}
                    className="rounded border-border text-gold bg-background accent-gold w-3.5 h-3.5"
                  />
                  <span>Habilitar Recordatorios en su perfil</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-text-secondary">
                  <input
                    type="checkbox"
                    checked={editEmailReminders}
                    onChange={(e) => setEditEmailReminders(e.target.checked)}
                    className="rounded border-border text-gold bg-background accent-gold w-3.5 h-3.5"
                  />
                  <span>Habilitar Alertas por Email</span>
                </label>
              </div>

              {/* Competencia Memberships */}
              <div className="bg-black/20 p-3 rounded-lg border border-border/80 space-y-2 text-xs">
                <span className="font-bold text-gold font-mono uppercase tracking-wider block text-[10px] mb-1">Membresías de Competencias</span>
                <div className="space-y-2">
                  {selectedUser.memberships && selectedUser.memberships.length > 0 ? (
                    selectedUser.memberships.map((m) => (
                      <div key={m.league.id} className="flex justify-between items-center bg-bg-secondary p-2 rounded border border-border-default/60">
                        <div className="text-left font-mono">
                          <p className="font-semibold text-text-primary text-xs">{m.league.name}</p>
                          <p className="text-[9px] text-text-muted">Rol: <span className="text-gold font-semibold uppercase">{m.role === 'owner' ? 'Dueño' : m.role === 'admin' ? 'Admin' : 'Miembro'}</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={m.role}
                            onChange={async (e) => {
                              const newRole = e.target.value;
                              const reason = prompt(`¿Por qué deseas cambiar el rol a "${newRole}" en la competencia "${m.league.name}"? (Motivo obligatorio):`);
                              if (!reason || !reason.trim()) {
                                alert("El motivo es obligatorio.");
                                return;
                              }
                              setActionLoading(true);
                              const res = await adminUpdateLeagueMemberRoleAction(selectedUser.id, m.league.id, newRole, reason);
                              setActionLoading(false);
                              if (res.error) alert(res.error);
                              else {
                                alert("Rol de membresía actualizado.");
                                router.refresh();
                                setShowEditModal(false);
                              }
                            }}
                            className="bg-bg-primary text-text-primary text-[10px] border border-border rounded px-1 py-0.5"
                          >
                            <option value="member">Miembro</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Dueño</option>
                          </select>
                          <button
                            type="button"
                            onClick={async () => {
                              const reason = prompt(`¿Por qué deseas remover a este usuario de la competencia "${m.league.name}"? (Motivo obligatorio):`);
                              if (!reason || !reason.trim()) {
                                alert("El motivo es obligatorio.");
                                return;
                              }
                              setActionLoading(true);
                              const res = await adminRemoveFromLeagueAction(selectedUser.id, m.league.id, reason);
                              setActionLoading(false);
                              if (res.error) alert(res.error);
                              else {
                                alert("Membresía eliminada.");
                                router.refresh();
                                setShowEditModal(false);
                              }
                            }}
                            className="px-2 py-0.5 bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-400 text-[10px] rounded font-bold font-mono uppercase"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-text-muted italic text-[11px]">No pertenece a ninguna competencia.</p>
                  )}

                  {/* Add user to league dropdown */}
                  {leagues && leagues.length > 0 && (
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      <select
                        id="add-to-league-select"
                        defaultValue=""
                        className="flex-1 field py-1 px-2 text-xs bg-bg-secondary text-text-primary border border-border"
                      >
                        <option value="" disabled>Seleccionar competencia para unir...</option>
                        {leagues
                          .filter(l => !selectedUser.memberships?.some(m => m.league.id === l.id))
                          .map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          const selectEl = document.getElementById('add-to-league-select') as HTMLSelectElement;
                          const selectedLeagueId = selectEl?.value;
                          if (!selectedLeagueId) {
                            alert("Por favor selecciona una competencia.");
                            return;
                          }
                          setActionLoading(true);
                          const res = await adminAddToLeagueAction(selectedUser.id, selectedLeagueId);
                          setActionLoading(false);
                          if (res.error) alert(res.error);
                          else {
                            alert("Usuario agregado con éxito.");
                            router.refresh();
                            setShowEditModal(false);
                          }
                        }}
                        className="px-3 py-1 bg-gold-400/10 border border-gold-500/30 hover:bg-gold-400/20 text-gold-400 text-xs rounded font-bold font-mono uppercase"
                      >
                        Unir
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Winner Predictions / Champion Selection Reset */}
              {selectedUser.winnerPredictions && selectedUser.winnerPredictions.length > 0 && (
                <div className="bg-black/20 p-3 rounded-lg border border-border/80 space-y-2 text-xs">
                  <span className="font-bold text-gold font-mono uppercase tracking-wider block text-[10px] mb-1">Predicción de Campeón</span>
                  <div className="space-y-3">
                    {selectedUser.winnerPredictions.map((wp) => {
                      // Get status
                      const hasCorrectionAllowed = wp.correctionAllowed && (!wp.correctionAllowedUntil || new Date(wp.correctionAllowedUntil) > new Date());
                      const statusLabel = hasCorrectionAllowed ? "Corrección permitida" : "Bloqueado";
                      
                      // Get history
                      const historyList = selectedUser.winnerPredictionHistories?.filter(h => h.leagueId === wp.leagueId) || [];

                      return (
                        <div key={wp.leagueId} className="bg-bg-secondary p-3 rounded border border-border-default/60 space-y-3">
                          <div className="flex justify-between items-start font-mono">
                            <div className="text-left space-y-0.5">
                              <p className="font-semibold text-text-primary text-xs">{wp.league.name}</p>
                              <p className="text-[10px] text-text-muted">Selección actual: <strong className="text-gold">{wp.team.name} ({wp.teamCode})</strong></p>
                              <p className="text-[10px] text-text-muted">Estado: <span className={`font-semibold ${hasCorrectionAllowed ? 'text-green-400' : 'text-amber-400'}`}>{statusLabel}</span></p>
                            </div>
                          </div>

                          {/* Prediction actions grid */}
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/30">
                            {/* Habilitar correccion */}
                            <button
                              type="button"
                              onClick={async () => {
                                const durationStr = prompt("¿Por cuántos minutos deseas habilitar la corrección? (ej. 30):", "30");
                                if (!durationStr) return;
                                const duration = parseInt(durationStr, 10);
                                if (isNaN(duration) || duration <= 0) {
                                  alert("Duración inválida.");
                                  return;
                                }
                                const reason = prompt("Ingresa el motivo obligatorio para la corrección (se registrará en el historial):");
                                if (!reason || !reason.trim()) {
                                  alert("El motivo es obligatorio.");
                                  return;
                                }
                                setActionLoading(true);
                                const res = await allowWinnerPredictionCorrectionAction(wp.leagueId, selectedUser.id, duration, reason);
                                setActionLoading(false);
                                if (res.error) alert(res.error);
                                else {
                                  alert("Corrección habilitada.");
                                  router.refresh();
                                  setShowEditModal(false);
                                }
                              }}
                              className="px-2 py-1 text-[9px] font-mono uppercase font-bold text-green-400 hover:text-green-300 border border-green-500/25 bg-green-500/10 hover:bg-green-500/20 rounded transition-all"
                            >
                              Permitir Corrección
                            </button>

                            {/* Cambiar Seleccion */}
                            <select
                              defaultValue=""
                              onChange={async (e) => {
                                const newCode = e.target.value;
                                if (!newCode) return;
                                const reason = prompt(`¿Por qué deseas cambiar el campeón a ${newCode} directamente? (motivo obligatorio):`);
                                if (!reason || !reason.trim()) {
                                  alert("El motivo es obligatorio.");
                                  e.target.value = "";
                                  return;
                                }
                                setActionLoading(true);
                                const res = await directCorrectWinnerPredictionAction(wp.leagueId, selectedUser.id, newCode, reason);
                                setActionLoading(false);
                                if (res.error) alert(res.error);
                                else {
                                  alert("Campeón modificado directamente.");
                                  router.refresh();
                                  setShowEditModal(false);
                                }
                              }}
                              className="bg-bg-primary text-text-primary text-[10px] border border-border rounded px-1 py-0.5"
                            >
                              <option value="" disabled>Cambiar Selección...</option>
                              {teams.map(t => (
                                <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                              ))}
                            </select>

                            {/* Resetear Campeón */}
                            <button
                              type="button"
                              onClick={() => handleResetChampion(wp.leagueId, wp.league.name)}
                              className="px-2 py-1 text-[9px] font-mono uppercase font-bold text-red-400 hover:text-red-300 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 rounded transition-all"
                            >
                              Resetear
                            </button>
                          </div>

                          {/* History of changes */}
                          {historyList.length > 0 && (
                            <div className="pt-2 border-t border-border/30">
                              <details className="group">
                                <summary className="text-[10px] text-text-muted hover:text-text-primary cursor-pointer select-none font-bold uppercase tracking-wider flex items-center justify-between">
                                  <span>Historial de cambios ({historyList.length})</span>
                                  <span className="transition-transform group-open:rotate-180">▼</span>
                                </summary>
                                <div className="mt-1 space-y-1.5 pl-2 border-l border-border/50 max-h-32 overflow-y-auto">
                                  {historyList.map(h => (
                                    <div key={h.id} className="text-[9px] text-text-muted py-0.5 border-b border-border/10 pb-1">
                                      <p className="font-semibold text-text-secondary font-mono">
                                        {new Date(h.createdAt).toLocaleDateString('es-ES')} {new Date(h.createdAt).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'})}
                                      </p>
                                      <p>Cambio: <strong className="text-text-primary">{h.oldTeamCode || 'Ninguno'} &rarr; {h.newTeamCode}</strong></p>
                                      <p>Acción: {h.actionType === 'correction_authorized' ? 'Autorización' : h.actionType === 'changed_by_admin' ? 'Reset/Cambio Admin' : h.actionType} | Motivo: <span className="italic text-text-primary">{h.reason}</span></p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-gold py-2 px-5 text-xs uppercase font-mono"
                >
                  {actionLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
