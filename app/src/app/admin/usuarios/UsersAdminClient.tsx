'use client';

import React, { useState } from 'react';
import { 
  updateUserStatusAction, 
  adminCreateUserAction,
  adminUpdateUserAction,
  adminResetUserChampionAction,
  adminResetUserPasswordAction,
  adminSoftDeleteUserAction,
  adminHardDeleteUserAction,
  adminTransferLeagueOwnershipAction
} from '../../../lib/actions/admin';
import {
  allowWinnerPredictionCorrectionAction,
  directCorrectWinnerPredictionAction
} from '../../../lib/actions/predictions';
import { useRouter } from 'next/navigation';
import { Plus, X, Search, Eye, EyeOff, ShieldAlert, Ban, Info, Key } from 'lucide-react';
import { getCompetitionTypeLabel } from '../../../lib/competition-types';

interface OwnedLeague {
  id: string;
  name: string;
  slug: string;
  competitionType?: string | null;
}

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
  themeMode?: string;
  leaguesOwned?: OwnedLeague[];
  memberships?: {
    league: {
      id: string;
      name: string;
      competitionType?: string | null;
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
      competitionType?: string | null;
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
      competitionType?: string | null;
    };
  }[];
  _count?: {
    predictions: number;
  };
}

type LeagueOption = { id: string; name: string; competitionType?: string | null };
type AdminUserType = 'participant' | 'admin' | 'superadmin';

function CreateUserModal({
  leagues,
  onClose,
  onCreated,
}: {
  leagues: LeagueOption[];
  onClose: () => void;
  onCreated: (user: UserFromDB) => void;
}) {
  const [modalError, setModalError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newStatus, setNewStatus] = useState('approved');
  const [newUserType, setNewUserType] = useState<AdminUserType>('participant');
  const [newLeagueIds, setNewLeagueIds] = useState<string[]>([]);

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = String(formData.get('username') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const passwordText = String(formData.get('passwordText') ?? '');
    const email = String(formData.get('email') ?? '').trim();
    const whatsapp = String(formData.get('whatsapp') ?? '').trim();

    if (!name || !username) {
      setModalError('Nombre visible y nombre de usuario son requeridos.');
      return;
    }
    if (!passwordText.trim()) {
      setModalError('La contraseña es obligatoria.');
      return;
    }

    setActionLoading(true);
    setModalError(null);

    const res = await adminCreateUserAction({
      username,
      name,
      passwordText,
      email: email || undefined,
      whatsapp: whatsapp || undefined,
      status: newStatus,
      userType: newUserType,
      leagueIds: newLeagueIds,
    });

    setActionLoading(false);

    if ('error' in res) {
      setModalError(res.error ?? 'No se pudo crear el usuario.');
      return;
    }

    if (res.user) {
      onCreated(res.user);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card-base p-6 max-w-md w-full border border-border rounded-lg space-y-4 relative bg-bg-tertiary max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h3 className="font-display text-2xl tracking-wide uppercase text-text-primary">Crear Cuenta Manual</h3>
          <p className="text-xs text-text-secondary">El usuario se registrará directamente con las credenciales especificadas.</p>
        </div>

        {modalError && (
          <div className="p-3 bg-red-900/50 text-red-200 border border-red-500 rounded-md text-xs">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateUser} className="space-y-3" autoComplete="off">
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono text-text-secondary uppercase">Nombre visible</label>
            <input
              id="admin-create-name"
              name="name"
              type="text"
              placeholder="Ej. Carlos Fuentes"
              autoComplete="off"
              className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
              required
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono text-text-secondary uppercase">Nombre de usuario</label>
            <input
              id="admin-create-username"
              name="username"
              type="text"
              placeholder="Ej. carlosf"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
              required
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono text-text-secondary uppercase">Contraseña temporal</label>
            <div className="relative">
              <input
                id="admin-create-password"
                name="passwordText"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 pr-10 text-xs focus:ring-1 focus:ring-gold"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-2 text-text-muted hover:text-text-primary"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono text-text-secondary uppercase">Correo (opcional)</label>
            <input
              id="admin-create-email"
              name="email"
              type="email"
              placeholder="Ej. carlos@correo.com"
              autoComplete="off"
              className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono text-text-secondary uppercase">WhatsApp (opcional)</label>
            <input
              id="admin-create-whatsapp"
              name="whatsapp"
              type="tel"
              placeholder="Ej. +51 999 999 999"
              autoComplete="off"
              className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono text-text-secondary uppercase">Estado inicial</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
            >
              <option value="approved">Aprobado</option>
              <option value="pending">Pendiente</option>
              <option value="disabled">Desactivado</option>
            </select>
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-mono text-text-secondary uppercase">Tipo de usuario</label>
            <select
              value={newUserType}
              onChange={(e) => setNewUserType(e.target.value as AdminUserType)}
              className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
            >
              <option value="participant">Participante</option>
              <option value="admin">Administrador de competencias</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>

          <div className="space-y-2 text-left">
            <div>
              <label className="text-[10px] font-mono text-text-secondary uppercase">Competencias vigentes</label>
              <p className="text-[10px] text-text-muted mt-0.5">Selecciona las competencias a las que quieres agregar este usuario.</p>
            </div>
            {leagues.length > 0 ? (
              <div className="space-y-1.5 bg-bg-secondary border border-border rounded-lg p-2">
                {leagues.map((league) => (
                  <label key={league.id} className="flex items-center gap-2 text-xs text-text-primary">
                    <input
                      type="checkbox"
                      checked={newLeagueIds.includes(league.id)}
                      onChange={(e) => {
                        setNewLeagueIds((current) =>
                          e.target.checked
                            ? [...current, league.id]
                            : current.filter((leagueId) => leagueId !== league.id)
                        );
                      }}
                      className="w-4 h-4 rounded border-border-default bg-bg-primary text-gold-500 focus:ring-gold-500"
                    />
                    <span>{league.name} — {getCompetitionTypeLabel(league.competitionType)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-text-muted italic">No hay competencias vigentes disponibles.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono transition-all text-text-primary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="btn-gold py-2 px-5 text-xs uppercase font-mono"
            >
              {actionLoading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersAdminClient({ 
  users, 
  leagues = [], 
  currentUserId 
}: { 
  users: UserFromDB[];
  leagues?: { id: string; name: string; competitionType?: string | null }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [userList, setUserList] = useState<UserFromDB[]>(users);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'disabled' | 'superadmins'>('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserFromDB | null>(null);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  
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
  const [editThemeMode, setEditThemeMode] = useState('black');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editLeagueIds, setEditLeagueIds] = useState<string[]>([]);
  const [editAddLeagueId, setEditAddLeagueId] = useState('');
  const [editChangeReason, setEditChangeReason] = useState('');

  // New Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailUser, setDetailUser] = useState<UserFromDB | null>(null);

  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [resetUser, setResetUser] = useState<UserFromDB | null>(null);
  const [passwordResetOption, setPasswordResetOption] = useState<'manual' | 'generate'>('generate');
  const [passwordResetCustomText, setPasswordResetCustomText] = useState('');
  const [passwordResetReason, setPasswordResetReason] = useState('');
  const [passwordResetSuccessText, setPasswordResetSuccessText] = useState<string | null>(null);

  const [showSoftDeleteModal, setShowSoftDeleteModal] = useState(false);
  const [softDeleteUser, setSoftDeleteUser] = useState<UserFromDB | null>(null);
  const [softDeleteAnonymize, setSoftDeleteAnonymize] = useState(false);
  const [softDeleteReason, setSoftDeleteReason] = useState('');

  const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
  const [hardDeleteUser, setHardDeleteUser] = useState<UserFromDB | null>(null);
  const [hardDeleteReason, setHardDeleteReason] = useState('');
  const [hardDeleteConfirmation, setHardDeleteConfirmation] = useState('');
  const [ownerBlockMessage, setOwnerBlockMessage] = useState<string | null>(null);
  const [ownerBlockLeagues, setOwnerBlockLeagues] = useState<OwnedLeague[]>([]);
  const [transferLeague, setTransferLeague] = useState<OwnedLeague | null>(null);
  const [transferCurrentOwner, setTransferCurrentOwner] = useState<UserFromDB | null>(null);
  const [transferNewOwnerId, setTransferNewOwnerId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const renderClientDeleteBlock = false;

  // Teams list used for champion pick corrections
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

  const getSelectedUserLeagueOptions = () => {
    const options = new Map<string, { id: string; name: string; competitionType?: string | null }>();
    leagues.forEach((league) => options.set(league.id, league));
    selectedUser?.memberships?.forEach((membership) => options.set(membership.league.id, membership.league));
    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const hasLeagueSelectionChanged = (currentIds: string[], nextIds: string[]) => {
    const currentSorted = [...currentIds].sort().join('|');
    const nextSorted = [...nextIds].sort().join('|');
    return currentSorted !== nextSorted;
  };

  const transferOwnerOptions = (currentOwnerId: string) =>
    userList.filter((user) =>
      user.id !== currentOwnerId &&
      user.status === 'approved' &&
      (user.isSuperadmin || Boolean(user.canCreateLeagues))
    );

  const replaceUserInList = (updatedUser: UserFromDB | null | undefined) => {
    if (!updatedUser) return;
    setUserList((currentUsers) =>
      currentUsers.map((user) => user.id === updatedUser.id ? updatedUser : user)
    );
    setHardDeleteUser((currentUser) => currentUser?.id === updatedUser.id ? updatedUser : currentUser);
    setTransferCurrentOwner((currentUser) => currentUser?.id === updatedUser.id ? updatedUser : currentUser);
    setDetailUser((currentUser) => currentUser?.id === updatedUser.id ? updatedUser : currentUser);
  };

  const handleStartCreateUser = () => {
    setError(null);
    setSuccess(null);
    setShowCreateModal(true);
  };

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
    setEditThemeMode(user.themeMode || 'black');
    setEditLeagueIds(user.memberships?.map((membership) => membership.league.id) ?? []);
    setEditAddLeagueId('');
    setEditChangeReason('');
    setEditModalError(null);
    setError(null);
    setSuccess(null);
    setShowEditModal(true);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    setEditModalError(null);
    setSuccess(null);

    // Detect sensitive edits
    const isSensitiveEdit = 
      editUsername !== (selectedUser.username || '') ||
      editStatus !== selectedUser.status ||
      editIsSuperadmin !== selectedUser.isSuperadmin ||
      editCanCreateLeagues !== Boolean(selectedUser.canCreateLeagues) ||
      hasLeagueSelectionChanged(selectedUser.memberships?.map((membership) => membership.league.id) ?? [], editLeagueIds) ||
      !!editPassword;

    const reason = editChangeReason.trim();
    if (isSensitiveEdit && !reason) {
      setEditModalError('Ingresa el motivo del cambio.');
      setActionLoading(false);
      return;
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
      themeMode: editThemeMode,
      leagueIds: editLeagueIds,
    }, reason || 'Actualización administrativa.');

    if ('error' in res) {
      setEditModalError(res.error ?? 'No se pudo guardar el usuario.');
      setActionLoading(false);
    } else {
      setSuccess('Usuario actualizado con éxito.');
      const updatedUser = res.user;
      if (updatedUser) {
        setUserList((currentUsers) =>
          currentUsers.map((user) => user.id === updatedUser.id ? updatedUser : user)
        );
      }
      setShowEditModal(false);
      setActionLoading(false);
      router.refresh();
    }
  };

  const handleResetChampion = async (leagueId: string, leagueName: string) => {
    if (!selectedUser) return;
    const reason = prompt(`¿Estás seguro de restablecer la predicción de campeón de ${selectedUser.name} en la competencia "${leagueName}"? Ingrese el motivo (se registrará en el historial):`);
    if (reason === null) return; // Cancelled
    if (!reason.trim()) {
      alert("El motivo es obligatorio.");
      return;
    }
    
    setActionLoading(true);
    setEditModalError(null);
    setSuccess(null);

    const res = await adminResetUserChampionAction(selectedUser.id, leagueId, reason);

    if ('error' in res) {
      setEditModalError(res.error ?? 'No se pudo restablecer la predicción de campeón.');
      setActionLoading(false);
    } else {
      setSuccess('Predicción de campeón restablecida con éxito.');
      setShowEditModal(false);
      setActionLoading(false);
      router.refresh();
    }
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

    if ('error' in res) {
      setError(res.error ?? 'No se pudo actualizar el estado del usuario.');
    } else {
      setSuccess(`Usuario ${actionLabel}do correctamente`);
      setUserList((currentUsers) =>
        currentUsers.map((user) => user.id === userId ? { ...user, status: targetStatus } : user)
      );
      router.refresh();
    }
    setLoadingUserId(null);
  };

  // Password reset modal trigger
  const handleStartPasswordReset = (user: UserFromDB) => {
    setResetUser(user);
    setPasswordResetOption('generate');
    setPasswordResetCustomText('');
    setPasswordResetReason('');
    setPasswordResetSuccessText(null);
    setShowPasswordResetModal(true);
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    if (!passwordResetReason.trim()) {
      alert("El motivo es obligatorio.");
      return;
    }

    setActionLoading(true);
    const res = await adminResetUserPasswordAction(
      resetUser.id,
      passwordResetOption,
      passwordResetCustomText,
      passwordResetReason
    );
    setActionLoading(false);

    if ('error' in res) {
      alert(res.error ?? 'No se pudo restablecer la contraseña.');
    } else if (res.temporaryPassword) {
      setPasswordResetSuccessText(res.temporaryPassword);
      setSuccess("Contraseña restablecida con éxito.");
    }
  };

  // Soft delete modal trigger
  const handleStartSoftDelete = (user: UserFromDB) => {
    setSoftDeleteUser(user);
    setSoftDeleteAnonymize(false);
    setSoftDeleteReason('');
    setShowSoftDeleteModal(true);
  };

  const handleSoftDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!softDeleteUser) return;
    if (!softDeleteReason.trim()) {
      alert("El motivo es obligatorio.");
      return;
    }

    setActionLoading(true);
    const res = await adminSoftDeleteUserAction(
      softDeleteUser.id,
      softDeleteAnonymize,
      softDeleteReason
    );
    setActionLoading(false);

    if ('error' in res) {
      alert(res.error ?? 'No se pudo desactivar el usuario.');
    } else {
      setSuccess("Usuario desactivado y archivado correctamente.");
      setUserList((currentUsers) =>
        currentUsers.map((user) => user.id === softDeleteUser.id ? { ...user, status: 'disabled' } : user)
      );
      setShowSoftDeleteModal(false);
      router.refresh();
    }
  };

  // Hard delete modal trigger
  const handleStartHardDelete = (user: UserFromDB) => {
    setHardDeleteUser(user);
    setHardDeleteReason('');
    setHardDeleteConfirmation('');
    setOwnerBlockMessage(null);
    setOwnerBlockLeagues(user.leaguesOwned ?? []);
    setShowHardDeleteModal(true);
  };

  const handleHardDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hardDeleteUser) return;
    if (!hardDeleteReason.trim()) {
      alert("El motivo es obligatorio.");
      return;
    }
    if (hardDeleteConfirmation.trim().toLowerCase() !== hardDeleteUser.username?.toLowerCase()) {
      alert("El nombre de usuario no coincide.");
      return;
    }

    setActionLoading(true);
    const res = await adminHardDeleteUserAction(
      hardDeleteUser.id,
      hardDeleteReason,
      hardDeleteConfirmation
    );
    setActionLoading(false);

    if ('error' in res) {
      alert(res.error ?? "No se pudo eliminar el usuario.");
    } else {
      setSuccess(res.message ?? "Usuario eliminado con éxito.");
      if (res.mode === 'deleted') {
        setUserList((currentUsers) => currentUsers.filter((user) => user.id !== hardDeleteUser.id));
        setShowHardDeleteModal(false);
      } else if (res.mode === 'disabled' && 'user' in res && res.user) {
        replaceUserInList(res.user);
        setShowHardDeleteModal(false);
      } else if (res.mode === 'blocked_owner' && 'user' in res && res.user) {
        replaceUserInList(res.user);
        setOwnerBlockMessage(res.message ?? 'Este usuario es propietario de una o más competencias. Transfiere la propiedad antes de eliminarlo.');
        setOwnerBlockLeagues((('ownedLeagues' in res ? res.ownedLeagues : undefined) ?? res.user.leaguesOwned ?? []) as OwnedLeague[]);
      }
      router.refresh();
    }
  };

  const handleStartOwnershipTransfer = (league: OwnedLeague, owner: UserFromDB) => {
    setTransferLeague(league);
    setTransferCurrentOwner(owner);
    setTransferNewOwnerId('');
    setTransferReason('');
    setTransferError(null);
  };

  const handleTransferOwnershipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferLeague || !transferCurrentOwner) return;
    if (!transferNewOwnerId) {
      setTransferError('Selecciona un nuevo propietario.');
      return;
    }
    if (!transferReason.trim()) {
      setTransferError('El motivo de la transferencia es obligatorio.');
      return;
    }

    setActionLoading(true);
    setTransferError(null);
    const res = await adminTransferLeagueOwnershipAction(
      transferLeague.id,
      transferNewOwnerId,
      transferReason
    );
    setActionLoading(false);

    if ('error' in res) {
      setTransferError(res.error ?? 'No se pudo transferir la propiedad de la competencia.');
      return;
    }

    replaceUserInList(res.previousOwnerUser);
    replaceUserInList(res.newOwnerUser);
    const remainingOwnedLeagues = (res.previousOwnerUser?.leaguesOwned ?? []).filter((league) => league.id !== transferLeague.id);
    setOwnerBlockLeagues(remainingOwnedLeagues);
    setOwnerBlockMessage(
      remainingOwnedLeagues.length > 0
        ? 'Propiedad transferida con éxito. Este usuario todavía es propietario de otra competencia.'
        : 'Propiedad transferida con éxito. Este usuario ya no está bloqueado por propiedad.'
    );
    setSuccess(res.message ?? 'Propiedad de la competencia transferida con éxito.');
    setTransferLeague(null);
    setTransferCurrentOwner(null);
    setTransferNewOwnerId('');
    setTransferReason('');
    router.refresh();
  };

  // Detail Modal trigger
  const handleOpenDetailModal = (user: UserFromDB) => {
    setDetailUser(user);
    setShowDetailModal(true);
  };

  // Filter logic
  const filteredUsers = userList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.whatsapp && u.whatsapp.includes(searchTerm));

    if (!matchesSearch) return false;

    if (statusFilter === 'pending') return u.status === 'pending';
    if (statusFilter === 'approved') return u.status === 'approved';
    if (statusFilter === 'rejected') return u.status === 'rejected';
    if (statusFilter === 'disabled') return u.status === 'disabled';
    if (statusFilter === 'superadmins') return u.isSuperadmin === true;

    return true;
  });

  const hardDeleteOwnedLeagues = ownerBlockLeagues.length > 0
    ? ownerBlockLeagues
    : hardDeleteUser?.leaguesOwned ?? [];
  const hardDeleteOwnerMessage = ownerBlockMessage ?? (
    hardDeleteOwnedLeagues.length > 0
      ? 'Este usuario es propietario de una o más competencias. Transfiere la propiedad antes de eliminarlo.'
      : null
  );

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
            className="field field-icon-left text-xs text-text-primary bg-bg-secondary border border-border rounded-lg"
            style={{ paddingLeft: '2.75rem', height: '2.5rem' }}
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-bg-tertiary p-1 border border-border-default rounded-xl w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'all' ? 'bg-gold text-black' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'approved' ? 'bg-green-500 text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'pending' ? 'bg-yellow-500 text-black' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'rejected' ? 'bg-red-500 text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Rechazados
          </button>
          <button
            onClick={() => setStatusFilter('disabled')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'disabled' ? 'bg-gray-500 text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Desactivados
          </button>
          <button
            onClick={() => setStatusFilter('superadmins')}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold uppercase tracking-wider whitespace-nowrap transition-all ${
              statusFilter === 'superadmins' ? 'bg-gold text-black' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Superadmins
          </button>
        </div>

        {/* Manual Create Trigger */}
        <button
          onClick={handleStartCreateUser}
          className="btn-gold py-2 px-4 text-xs flex items-center gap-1.5 uppercase font-semibold tracking-wider w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Crear Usuario
        </button>
      </div>

      {/* Users List Table */}
      <div className="card-base overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-surface border-b border-border text-text-muted">
              <tr className="uppercase font-mono tracking-wider font-bold">
                <th className="p-3">Nombre</th>
                <th className="p-3">Usuario</th>
                <th className="p-3">WhatsApp</th>
                <th className="p-3">Competencias</th>
                <th className="p-3 text-center">Pronósticos</th>
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
                          user.memberships.map((m) => `${m.league.name} — ${getCompetitionTypeLabel(m.league.competitionType)}`).join(', ')
                        ) : (
                          <span className="text-text-muted italic">Ninguna</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-center font-bold">
                        {user._count?.predictions ?? 0}
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
                      <td className="p-3 text-right flex flex-wrap gap-1.5 justify-end whitespace-normal">
                        <button
                          onClick={() => handleOpenDetailModal(user)}
                          disabled={isLoading}
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-bg-secondary border-border-default text-text-primary hover:bg-bg-hover transition-colors"
                        >
                          Detalle
                        </button>
                        <button
                          onClick={() => handleStartEditUser(user)}
                          disabled={isLoading}
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-bg-secondary border-border-default text-text-primary hover:bg-bg-hover transition-colors"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => handleStartPasswordReset(user)}
                          disabled={isLoading}
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-bg-secondary border-border-default text-text-primary hover:bg-bg-hover transition-colors"
                          title="Restablecer Contraseña"
                        >
                          Clave
                        </button>

                        {!isYou && (
                          <>
                            {/* Explicit status management controls */}
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
                                onClick={() => handleStartSoftDelete(user)}
                                disabled={isLoading}
                                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                              >
                                Archivar
                              </button>
                            )}

                            {(user.status === 'disabled' || user.status === 'rejected') && (
                              <button
                                onClick={() => handleUpdateStatus(user.id, 'approved')}
                                disabled={isLoading}
                                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                              >
                                Reactivar
                              </button>
                            )}

                            {/* Hard Delete Trigger */}
                            <button
                              onClick={() => handleStartHardDelete(user)}
                              disabled={isLoading}
                              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-red-950 border-red-500/30 text-red-400 hover:bg-red-900"
                              title="Eliminar o desactivar según historial y propiedad"
                            >
                              Eliminar / desactivar
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
      </div>

      
      {/* Users List Mobile Cards */}
      <div className="block md:hidden space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="card-base p-6 text-center text-text-muted bg-bg-tertiary">
            No se encontraron usuarios coincidentes.
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isYou = user.id === currentUserId;
            const isLoading = loadingUserId === user.id;

            return (
              <div key={user.id} className="card-base p-4 border border-border rounded-xl space-y-3 bg-bg-tertiary">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5 text-left min-w-0">
                    <p className="font-semibold text-text-primary text-sm flex items-center gap-1.5 flex-wrap">
                      <span className="truncate max-w-[150px]">{user.name}</span>
                      {isYou && (
                        <span className="text-[8px] text-gold border border-gold/30 px-1.5 py-0.2 rounded uppercase font-mono tracking-wider font-bold">
                          TÚ
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] font-mono text-gold-400 truncate max-w-[150px]">@{user.username}</p>
                    <p className="text-[10px] text-text-secondary truncate max-w-[180px]">{user.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full uppercase border font-semibold text-[8px] ${
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
                    <span className={`px-2 py-0.5 rounded-full uppercase border font-semibold text-[8px] ${
                      user.isSuperadmin ? 'bg-gold-400/10 text-gold-400 border-gold-400/30' : 'bg-surface border-border text-text-secondary'
                    }`}>
                      {user.isSuperadmin ? 'Superadmin' : 'Usuario'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left text-[11px] pt-2 border-t border-border/40 font-mono">
                  <div>
                    <span className="text-text-muted block">WhatsApp:</span>
                    <span className="text-text-primary">{user.whatsapp || '-'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Pronósticos:</span>
                    <span className="text-text-primary font-bold">{user._count?.predictions ?? 0}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-text-muted block">Competencias:</span>
                    <span className="text-text-primary truncate block" title={user.memberships?.map(m => `${m.league.name} — ${getCompetitionTypeLabel(m.league.competitionType)}`).join(', ')}>
                      {user.memberships && user.memberships.length > 0 ? (
                        user.memberships.map((m) => `${m.league.name} — ${getCompetitionTypeLabel(m.league.competitionType)}`).join(', ')
                      ) : (
                        <span className="text-text-muted italic">Ninguna</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Mobile Actions Panel */}
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/40 justify-start">
                  <button
                    onClick={() => handleOpenDetailModal(user)}
                    disabled={isLoading}
                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-bg-secondary border-border-default text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    Detalle
                  </button>
                  <button
                    onClick={() => handleStartEditUser(user)}
                    disabled={isLoading}
                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-bg-secondary border-border-default text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleStartPasswordReset(user)}
                    disabled={isLoading}
                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-bg-secondary border-border-default text-text-primary hover:bg-bg-hover transition-colors"
                    title="Restablecer Contraseña"
                  >
                    Clave
                  </button>
                  {!isYou && (
                    <>
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
                          onClick={() => handleStartSoftDelete(user)}
                          disabled={isLoading}
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                        >
                          Archivar
                        </button>
                      )}
                      {(user.status === 'disabled' || user.status === 'rejected') && (
                        <button
                          onClick={() => handleUpdateStatus(user.id, 'approved')}
                          disabled={isLoading}
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                        >
                          Reactivar
                        </button>
                      )}
                      <button
                        onClick={() => handleStartHardDelete(user)}
                        disabled={isLoading}
                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-red-950 border-red-500/30 text-red-400 hover:bg-red-900"
                      >
                        Eliminar / desactivar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

{/* Detail View Modal */}
      {showDetailModal && detailUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 max-w-lg w-full border border-border rounded-lg space-y-6 relative bg-bg-tertiary max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="bg-gold/10 text-gold rounded-full p-3 border border-gold/30">
                <Info className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-display text-2xl tracking-wide uppercase text-text-primary">{detailUser.name}</h3>
                <p className="font-mono text-xs text-gold-400">@{detailUser.username}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono border-t border-b border-border py-4 text-left">
              <div>
                <p className="text-text-secondary">CORREO:</p>
                <p className="text-text-primary font-semibold">{detailUser.email}</p>
              </div>
              <div>
                <p className="text-text-secondary">WHATSAPP:</p>
                <p className="text-text-primary font-semibold">{detailUser.whatsapp || '-'}</p>
              </div>
              <div>
                <p className="text-text-secondary">ESTADO:</p>
                <p className="text-text-primary font-semibold uppercase">{detailUser.status}</p>
              </div>
              <div>
                <p className="text-text-secondary">ROL GLOBAL:</p>
                <p className="text-text-primary font-semibold uppercase">{detailUser.isSuperadmin ? 'Superadmin' : 'Usuario General'}</p>
              </div>
              <div>
                <p className="text-text-secondary">CREACIÓN:</p>
                <p className="text-text-primary font-semibold">{new Date(detailUser.createdAt).toLocaleString('es-ES')}</p>
              </div>
              <div>
                <p className="text-text-secondary">MODO DE TEMA:</p>
                <p className="text-text-primary font-semibold uppercase">{detailUser.themeMode || 'black'}</p>
              </div>
              <div>
                <p className="text-text-secondary">TOTAL PRONÓSTICOS:</p>
                <p className="text-text-primary font-semibold font-bold text-gold">{detailUser._count?.predictions ?? 0}</p>
              </div>
              <div>
                <p className="text-text-secondary">PUEDE CREAR COMPETENCIAS:</p>
                <p className="text-text-primary font-semibold">{detailUser.canCreateLeagues ? 'SÍ' : 'NO'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-text-secondary">ALERTAS DE RECORDATORIO:</p>
                <p className="text-text-primary font-semibold">
                  Habilitado: {detailUser.remindersEnabled ? 'SÍ' : 'NO'} | Email: {detailUser.emailRemindersEnabled ? 'SÍ' : 'NO'}
                  {detailUser.reminderEmail && ` (${detailUser.reminderEmail})`}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-left text-xs">
              <p className="font-bold font-mono text-gold uppercase tracking-wider text-[10px]">Competencias Participando:</p>
              {detailUser.memberships && detailUser.memberships.length > 0 ? (
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {detailUser.memberships.map((m) => (
                    <div key={m.league.id} className="bg-bg-secondary p-1.5 rounded border border-border/45 flex justify-between">
                      <span>{m.league.name} — {getCompetitionTypeLabel(m.league.competitionType)}</span>
                      <span className="text-gold font-bold uppercase text-[9px]">{m.role}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted italic">No está unido a ninguna competencia.</p>
              )}
            </div>

            <div className="space-y-2 text-left text-xs">
              <p className="font-bold font-mono text-gold uppercase tracking-wider text-[10px]">Competencias propias:</p>
              {detailUser.leaguesOwned && detailUser.leaguesOwned.length > 0 ? (
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {detailUser.leaguesOwned.map((league) => (
                    <div key={league.id} className="bg-bg-secondary p-2 rounded border border-border/45 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-text-primary font-semibold">{league.name}</p>
                        <p className="text-[10px] text-text-muted">{league.slug} — {getCompetitionTypeLabel(league.competitionType)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartOwnershipTransfer(league, detailUser)}
                        className="px-2 py-1 border border-gold/40 text-gold hover:bg-gold/10 rounded text-[9px] uppercase font-mono font-bold"
                      >
                        Transferir propiedad
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-muted italic">No es propietario de ninguna competencia.</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono text-text-primary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordResetModal && resetUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 max-w-md w-full border border-border rounded-lg space-y-4 relative bg-bg-tertiary max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowPasswordResetModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <Key className="w-6 h-6 text-gold" />
              <div className="text-left">
                <h3 className="font-display text-2xl tracking-wide uppercase text-text-primary">Restablecer Contraseña</h3>
                <p className="text-xs text-text-secondary">@{resetUser.username} ({resetUser.name})</p>
              </div>
            </div>

            {passwordResetSuccessText ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-950/40 border border-green-500/40 rounded-lg text-left space-y-2">
                  <p className="text-xs text-green-300 font-bold uppercase tracking-wider">¡Contraseña restablecida exitosamente!</p>
                  <p className="text-xs text-text-primary">Por favor, copia la siguiente contraseña temporal. **Solo se mostrará una vez**:</p>
                  <div className="bg-black/60 p-3 rounded border border-border font-mono text-center text-sm font-bold text-gold tracking-widest select-all">
                    {passwordResetSuccessText}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPasswordResetModal(false);
                    setResetUser(null);
                    setPasswordResetSuccessText(null);
                  }}
                  className="w-full btn-gold py-2 text-xs uppercase font-mono"
                >
                  Entendido, ya la copié
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4 text-left">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-text-secondary uppercase block">Opción de Contraseña</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPasswordResetOption('generate')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold uppercase tracking-wider text-center transition-all ${
                        passwordResetOption === 'generate'
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-border bg-bg-secondary text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Generar Temporal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPasswordResetOption('manual')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold uppercase tracking-wider text-center transition-all ${
                        passwordResetOption === 'manual'
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-border bg-bg-secondary text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                {passwordResetOption === 'manual' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-secondary uppercase">Contraseña Manual</label>
                    <input
                      type="text"
                      placeholder="Mínimo 6 caracteres"
                      value={passwordResetCustomText}
                      onChange={(e) => setPasswordResetCustomText(e.target.value)}
                      className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold focus:outline-none"
                      required
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Motivo del restablecimiento</label>
                  <textarea
                    placeholder="Escriba el motivo aquí (Obligatorio, se audita)"
                    value={passwordResetReason}
                    onChange={(e) => setPasswordResetReason(e.target.value)}
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold focus:outline-none h-16 resize-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordResetModal(false)}
                    className="px-4 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono text-text-primary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="btn-gold py-2 px-5 text-xs uppercase font-mono"
                  >
                    {actionLoading ? 'Guardando...' : 'Cambiar Clave'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Soft Delete Modal */}
      {showSoftDeleteModal && softDeleteUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 max-w-md w-full border border-border rounded-lg space-y-4 relative bg-bg-tertiary max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowSoftDeleteModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <Ban className="w-6 h-6 text-yellow-500" />
              <div className="text-left">
                <h3 className="font-display text-2xl tracking-wide uppercase text-text-primary">Archivar / Desactivar Usuario</h3>
                <p className="text-xs text-text-secondary">@{softDeleteUser.username} ({softDeleteUser.name})</p>
              </div>
            </div>

            <div className="text-xs text-text-secondary bg-black/20 p-3 rounded-lg border border-border/40 text-left space-y-1.5">
              <p>&bull; El estado del usuario pasará a **desactivado**.</p>
              <p>&bull; No se le eliminarán pronósticos, memberships ni logs.</p>
              <p>&bull; Se cerrarán de inmediato todas sus sesiones activas.</p>
              <p>&bull; Dejará de contar en los participantes activos y de recibir notificaciones.</p>
            </div>

            <form onSubmit={handleSoftDeleteSubmit} className="space-y-4 text-left">
              <label className="flex items-center gap-2 cursor-pointer select-none text-text-secondary text-xs">
                <input
                  type="checkbox"
                  checked={softDeleteAnonymize}
                  onChange={(e) => setSoftDeleteAnonymize(e.target.checked)}
                  className="rounded border-border text-gold bg-background accent-gold w-4 h-4"
                />
                <span>Anonimizar campos del perfil (Remover nombre, email y teléfono)</span>
              </label>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Motivo del archivo</label>
                <textarea
                  placeholder="Ingrese el motivo de la desactivación (Obligatorio, se audita)"
                  value={softDeleteReason}
                  onChange={(e) => setSoftDeleteReason(e.target.value)}
                  className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold focus:outline-none h-16 resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSoftDeleteModal(false)}
                  className="px-4 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-xs rounded-xl uppercase font-mono"
                >
                  {actionLoading ? 'Archivando...' : 'Desactivar Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hard Delete Modal */}
      {showHardDeleteModal && hardDeleteUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-base p-6 max-w-md w-full border border-border rounded-lg space-y-4 relative bg-bg-tertiary max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowHardDeleteModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-red-500" />
              <div className="text-left">
                <h3 className="font-display text-2xl tracking-wide uppercase text-text-primary">Eliminar / desactivar</h3>
                <p className="text-xs text-text-secondary">@{hardDeleteUser.username} ({hardDeleteUser.name})</p>
              </div>
            </div>

            {renderClientDeleteBlock && ((hardDeleteUser._count?.predictions ?? 0) > 0 || (hardDeleteUser.winnerPredictions?.length ?? 0) > 0) ? (
              <div className="space-y-4 text-left">
                <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-200 space-y-2">
                  <p className="font-bold uppercase text-red-400">Acción Bloqueada</p>
                  <p>Este usuario tiene historial de competencia en la base de datos ({hardDeleteUser._count?.predictions} pronósticos o predicción de campeón).</p>
                  <p className="font-semibold text-text-primary">Usa desactivar/archivar para conservar la auditoría de la competencia.</p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowHardDeleteModal(false)}
                    className="px-4 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono text-text-primary"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleHardDeleteSubmit} className="space-y-4 text-left">
                <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-lg text-[11px] text-red-200">
                  <p className="font-bold uppercase mb-1">¡Advertencia Peligrosa!</p>
                  <p>Si el usuario no tiene registros históricos, se eliminará. Si tiene pronósticos, picks o historial competitivo, será desactivado para conservar el historial.</p>
                </div>

                {hardDeleteOwnerMessage && (
                  <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs text-amber-100 space-y-3">
                    <p className="font-bold uppercase text-amber-300">{hardDeleteOwnerMessage}</p>
                    <div className="space-y-2">
                      {hardDeleteOwnedLeagues.map((league) => (
                        <div key={league.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-bg-secondary border border-border rounded-lg p-2">
                          <div>
                            <p className="font-semibold text-text-primary">{league.name}</p>
                            <p className="text-[10px] text-text-muted">
                              {league.slug} — {getCompetitionTypeLabel(league.competitionType)}
                            </p>
                            <p className="text-[10px] text-text-muted">Propietario actual: @{hardDeleteUser.username}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartOwnershipTransfer(league, hardDeleteUser)}
                            className="px-3 py-1.5 border border-gold/40 text-gold hover:bg-gold/10 rounded-lg text-[10px] uppercase font-mono font-bold"
                          >
                            Transferir propiedad
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Motivo de la eliminación</label>
                  <textarea
                    placeholder="Ingrese el motivo de la eliminación (Obligatorio, se audita)"
                    value={hardDeleteReason}
                    onChange={(e) => setHardDeleteReason(e.target.value)}
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold focus:outline-none h-16 resize-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Confirmar Nombre de Usuario</label>
                  <p className="text-[10px] text-text-muted mb-1">Escribe <strong className="text-gold">@{hardDeleteUser.username}</strong> para proceder:</p>
                  <input
                    type="text"
                    placeholder={`Escribe ${hardDeleteUser.username}`}
                    value={hardDeleteConfirmation}
                    onChange={(e) => setHardDeleteConfirmation(e.target.value)}
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold focus:outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHardDeleteModal(false)}
                    className="px-4 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono text-text-primary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || hardDeleteConfirmation.trim().toLowerCase() !== hardDeleteUser.username?.toLowerCase()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl uppercase font-mono"
                  >
                    {actionLoading ? 'Procesando...' : 'Eliminar / desactivar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {transferLeague && transferCurrentOwner && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="card-base p-6 max-w-md w-full border border-border rounded-lg space-y-4 relative bg-bg-tertiary">
            <button
              type="button"
              onClick={() => {
                setTransferLeague(null);
                setTransferCurrentOwner(null);
              }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-left">
              <h3 className="font-display text-2xl tracking-wide uppercase text-text-primary">Transferir propiedad</h3>
              <p className="text-xs text-text-secondary">Cambia el propietario de una competencia sin borrar historial.</p>
            </div>

            {transferError && (
              <div className="p-3 bg-red-900/50 text-red-200 border border-red-500 rounded-md text-xs">
                {transferError}
              </div>
            )}

            <form onSubmit={handleTransferOwnershipSubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Competencia</label>
                <div className="bg-bg-secondary border border-border rounded-lg p-2 text-xs text-text-primary">
                  <p className="font-semibold">{transferLeague.name}</p>
                  <p className="text-[10px] text-text-muted">{transferLeague.slug} — {getCompetitionTypeLabel(transferLeague.competitionType)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Propietario actual</label>
                <div className="bg-bg-secondary border border-border rounded-lg p-2 text-xs text-text-primary">
                  {transferCurrentOwner.name} @{transferCurrentOwner.username}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Nuevo propietario</label>
                <select
                  value={transferNewOwnerId}
                  onChange={(e) => setTransferNewOwnerId(e.target.value)}
                  className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
                  required
                >
                  <option value="">Seleccionar administrador...</option>
                  {transferOwnerOptions(transferCurrentOwner.id).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} @{user.username} {user.isSuperadmin ? '(Superadmin)' : '(Admin)'}
                    </option>
                  ))}
                </select>
                {transferOwnerOptions(transferCurrentOwner.id).length === 0 && (
                  <p className="text-[10px] text-amber-300">No hay administradores activos disponibles para recibir esta competencia.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Motivo de la transferencia</label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold focus:outline-none h-20 resize-none"
                  placeholder="Explica por qué se transfiere la propiedad."
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTransferLeague(null);
                    setTransferCurrentOwner(null);
                  }}
                  className="px-4 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !transferNewOwnerId}
                  className="btn-gold py-2 px-5 text-xs uppercase font-mono disabled:opacity-50"
                >
                  {actionLoading ? 'Transfiriendo...' : 'Transferir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          leagues={leagues}
          onClose={() => setShowCreateModal(false)}
          onCreated={(createdUser) => {
            setSuccess('Usuario creado con éxito.');
            setUserList((currentUsers) => [createdUser, ...currentUsers.filter((user) => user.id !== createdUser.id)]);
            setShowCreateModal(false);
            router.refresh();
          }}
        />
      )}
      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card-base p-6 max-w-xl w-full border border-border rounded-lg space-y-4 relative bg-bg-tertiary max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-left">
              <h3 className="font-display text-2xl tracking-wide uppercase text-text-primary">Editar Usuario</h3>
              <p className="text-xs text-text-secondary">Modifica los datos del usuario y gestiona su participación.</p>
            </div>

            {editModalError && (
              <div className="p-3 bg-red-900/50 text-red-200 border border-red-500 rounded-md text-xs">
                {editModalError}
              </div>
            )}

            <form onSubmit={handleEditUserSubmit} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-mono text-text-secondary uppercase">Motivo del cambio</label>
                <textarea
                  id="admin-edit-change-reason"
                  name="admin-edit-change-reason"
                  value={editChangeReason}
                  onChange={(e) => setEditChangeReason(e.target.value)}
                  rows={2}
                  placeholder="Actualización administrativa."
                  className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold resize-y"
                />
                <p className="text-[10px] text-text-muted">
                  Requerido para cambios sensibles como usuario, estado, contraseña o competencias.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Nombre visible</label>
                  <input
                    id="admin-edit-name"
                    name="admin-edit-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
                    required
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Nombre de usuario</label>
                  <input
                    id="admin-edit-username"
                    name="admin-edit-username"
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Correo</label>
                  <input
                    id="admin-edit-email"
                    name="admin-edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
                    required
                  />
                </div>

                {/* WhatsApp */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">WhatsApp</label>
                  <input
                    id="admin-edit-whatsapp"
                    name="admin-edit-whatsapp"
                    type="tel"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
                  />
                </div>

                {/* Status select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Estado</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
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
                      id="admin-edit-password"
                      name="admin-edit-password"
                      type={showEditPassword ? 'text' : 'password'}
                      placeholder="Nueva contraseña"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 pr-10 text-xs focus:ring-1 focus:ring-gold"
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
                    id="admin-edit-reminder-email"
                    name="admin-edit-reminder-email"
                    type="email"
                    value={editReminderEmail}
                    onChange={(e) => setEditReminderEmail(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
                    placeholder="Opcional. Si se deja en blanco se usará el correo principal"
                  />
                </div>

                {/* Theme Mode */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-text-secondary uppercase">Preferencia de Tema</label>
                  <select
                    value={editThemeMode}
                    onChange={(e) => setEditThemeMode(e.target.value)}
                    className="w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
                  >
                    <option value="black">Oscuro (Black)</option>
                    <option value="dark">Gris (Dark)</option>
                    <option value="light">Claro (Light)</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-black/20 p-3 rounded-lg border border-border/80 space-y-2 text-xs text-left">
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
                  <span>Puede crear competencias</span>
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
              <div className="bg-black/20 p-3 rounded-lg border border-border/80 space-y-2 text-xs text-left">
                <span className="font-bold text-gold font-mono uppercase tracking-wider block text-[10px] mb-1">Competencias del Participante</span>
                <div className="space-y-2">
                  {editLeagueIds.length > 0 ? (
                    editLeagueIds.map((leagueId) => {
                      const league = getSelectedUserLeagueOptions().find((option) => option.id === leagueId);
                      const membership = selectedUser.memberships?.find((m) => m.league.id === leagueId);
                      return (
                        <div key={leagueId} className="flex justify-between items-center bg-bg-secondary p-2 rounded border border-border-default/60">
                          <div className="text-left font-mono">
                            <p className="font-semibold text-text-primary text-xs">
                              {league ? `${league.name} — ${getCompetitionTypeLabel(league.competitionType)}` : 'Competencia'}
                            </p>
                            {membership && (
                              <p className="text-[9px] text-text-muted">Rol actual: <span className="text-gold font-semibold uppercase">{membership.role === 'owner' ? 'Dueño' : membership.role === 'admin' ? 'Admin' : 'Miembro'}</span></p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditLeagueIds((current) => current.filter((currentLeagueId) => currentLeagueId !== leagueId))}
                            className="px-2 py-0.5 bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-400 text-[10px] rounded font-bold font-mono uppercase"
                          >
                            Remover
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-text-muted italic text-[11px]">No pertenece a ninguna competencia.</p>
                  )}

                  {leagues.length > 0 && (
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      <select
                        value={editAddLeagueId}
                        onChange={(e) => setEditAddLeagueId(e.target.value)}
                        className="flex-1 w-full bg-bg-secondary text-text-primary border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-gold"
                      >
                        <option value="">Seleccionar competencia para unir...</option>
                        {leagues
                          .filter((league) => !editLeagueIds.includes(league.id))
                          .map((league) => (
                            <option key={league.id} value={league.id}>
                              {league.name} — {getCompetitionTypeLabel(league.competitionType)}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (!editAddLeagueId) {
                            alert("Por favor selecciona una competencia.");
                            return;
                          }
                          setEditLeagueIds((current) => [...current, editAddLeagueId]);
                          setEditAddLeagueId('');
                        }}
                        className="px-3 py-1 bg-gold text-black text-xs rounded-lg font-bold font-mono uppercase whitespace-nowrap hover:bg-gold-600 transition-colors"
                      >
                        Unir
                      </button>
                    </div>
                  )}
                  {hasLeagueSelectionChanged(selectedUser.memberships?.map((membership) => membership.league.id) ?? [], editLeagueIds) && (
                    <p className="text-[10px] text-yellow-300">Cambios pendientes. Se aplicarán al guardar.</p>
                  )}
                </div>
              </div>

              {/* Winner Predictions / Champion Selection Reset */}
              {selectedUser.winnerPredictions && selectedUser.winnerPredictions.length > 0 && (
                <div className="bg-black/20 p-3 rounded-lg border border-border/80 space-y-2 text-xs text-left">
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
                                if ('error' in res) alert(res.error ?? 'No se pudo habilitar la corrección.');
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
                                if ('error' in res) alert(res.error ?? 'No se pudo modificar el campeón.');
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
                                <div className="mt-1 space-y-1.5 pl-2 border-l border-border/50 max-h-32 overflow-y-auto text-left">
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
                  className="px-4 py-2 border border-border-default hover:bg-bg-hover rounded-xl text-xs uppercase font-mono transition-all text-text-primary"
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
