'use client';

import React, { useState } from 'react';
import { Shield, Settings, Archive, Trash2, ArrowLeft, Users, X, ArrowUp, ArrowDown, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  archiveLeagueAction,
  deleteLeagueAction,
  addMemberAction,
  manageMemberAction,
  updateLeagueSettingsAction,
  updateMemberParticipationAction,
} from '../../lib/actions/leagues';
import { summarizeCompetitionMembers } from '../../lib/competition-members';
import { parseLimaDateTimeToUtc, getLimaDateTimeLocalString } from '../../lib/utils/dates';

interface LeagueMemberData {
  userId: string;
  role: string;
  isParticipant: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    displayName: string | null;
    username: string | null;
    status: string | null;
  };
}

interface LeagueAdminData {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  competitionType: string;
  status: string;
  createdAt: string;
  owner: {
    name: string;
    email: string;
  };
  members: LeagueMemberData[];
  championDeadline: string | null;
  championPoints: number;
  pointsExactScore: number;
  pointsWinner: number;
  pointsDraw: number;
  pointsConsolation: number;
  entryFee: number;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  showOdds: boolean;
  showH2H: boolean;
}

interface ApprovedUserData {
  id: string;
  name: string;
  email: string;
  displayName: string | null;
  username: string | null;
}

interface AdminLigasClientProps {
  leagues: LeagueAdminData[];
  approvedUsers: ApprovedUserData[];
}

export const AdminLigasClient: React.FC<AdminLigasClientProps> = ({ leagues, approvedUsers }) => {
  const router = useRouter();
  const [loadingLeagueId, setLoadingLeagueId] = useState<string | null>(null);

  // Modal states
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const [settingsLeagueId, setSettingsLeagueId] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  const settingsLeague = leagues.find((l) => l.id === settingsLeagueId);
  const activeLeagueSummary = activeLeague
    ? summarizeCompetitionMembers(activeLeague.members.map((member) => ({
        role: member.role,
        isParticipant: member.isParticipant,
        userStatus: member.user.status,
      })))
    : null;

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settingsLeagueId) return;

    setIsSubmitting(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const isDefault = formData.get('isDefault') === 'true';
    const isActive = formData.get('isActive') === 'true';
    const entryFee = parseFloat(formData.get('entryFee') as string) || 0;
    const currency = formData.get('currency') as string;
    const showOdds = formData.get('showOdds') === 'true';
    const showH2H = formData.get('showH2H') === 'true';
    const championPoints = parseInt(formData.get('championPoints') as string) || 10;
    const pointsExactScore = parseInt(formData.get('pointsExactScore') as string) || 5;
    const pointsWinner = parseInt(formData.get('pointsWinner') as string) || 3;
    const pointsDraw = parseInt(formData.get('pointsDraw') as string) || 3;
    const pointsConsolation = parseInt(formData.get('pointsConsolation') as string) || 1;
    const localDeadline = formData.get('championDeadline') as string;
    const championDeadline = localDeadline ? parseLimaDateTimeToUtc(localDeadline) : null;

    const res = await updateLeagueSettingsAction(settingsLeagueId, {
      name,
      isDefault,
      isActive,
      entryFee,
      currency,
      showOdds,
      showH2H,
      championPoints,
      championDeadline,
      pointsExactScore,
      pointsWinner,
      pointsDraw,
      pointsConsolation,
    });

    setIsSubmitting(false);
    if (res.error) {
      setSettingsError(res.error);
    } else {
      setSettingsSuccess('Configuración guardada exitosamente.');
      setTimeout(() => {
        setSettingsLeagueId(null);
        setSettingsSuccess(null);
        router.refresh();
      }, 1000);
    }
  };

  const handleArchive = async (leagueId: string, currentStatus: string) => {
    const isArchived = currentStatus === 'archived';
    const actionLabel = isArchived ? 'reactivar' : 'archivar';
    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} esta competencia?`)) {
      return;
    }

    setLoadingLeagueId(leagueId);
    const res = await archiveLeagueAction(leagueId, !isArchived);
    setLoadingLeagueId(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleDelete = async (leagueId: string) => {
    if (!confirm('¡ADVERTENCIA CRÍTICA! Esto eliminará permanentemente la competencia y todas sus predicciones y membresías. ¿Continuar?')) {
      return;
    }

    setLoadingLeagueId(leagueId);
    const res = await deleteLeagueAction(leagueId);
    setLoadingLeagueId(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLeague || !selectedUserId) return;

    setIsSubmitting(true);
    setModalError(null);
    setModalSuccess(null);

    const res = await addMemberAction(activeLeague.id, selectedUserId);

    setIsSubmitting(false);
    if (res.error) {
      setModalError(res.error);
    } else {
      setModalSuccess('Participante agregado exitosamente');
      setSelectedUserId('');
      router.refresh();
    }
  };

  const handleManageMember = async (userId: string, action: 'remove' | 'promote' | 'demote') => {
    if (!activeLeague) return;

    let confirmMsg = '';
    if (action === 'remove') {
      confirmMsg = '¿Estás seguro de que deseas eliminar a este miembro de la competencia?';
    } else if (action === 'promote') {
      confirmMsg = '¿Estás seguro de que deseas promover a este miembro a administrador?';
    } else if (action === 'demote') {
      confirmMsg = '¿Estás seguro de que deseas degradar a este administrador a miembro regular?';
    }

    if (confirmMsg && !confirm(confirmMsg)) {
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    setModalSuccess(null);

    const res = await manageMemberAction(activeLeague.id, userId, action);

    setIsSubmitting(false);
    if (res.error) {
      setModalError(res.error);
    } else {
      setModalSuccess(`Operación realizada exitosamente`);
      router.refresh();
    }
  };

  const handleToggleParticipation = async (userId: string, currentValue: boolean) => {
    if (!activeLeague) return;

    setIsSubmitting(true);
    setModalError(null);
    setModalSuccess(null);
    const nextValue = !currentValue;
    const res = await updateMemberParticipationAction(activeLeague.id, userId, nextValue);
    setIsSubmitting(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }
    setModalSuccess(nextValue
      ? 'El miembro ahora participa en la competencia; su rol no cambió.'
      : 'El miembro dejó de competir; su rol y permisos se conservaron.');
    router.refresh();
  };

  const eligibleUsers = activeLeague
    ? approvedUsers.filter((u) => !activeLeague.members.some((m) => m.userId === u.id))
    : [];

  return (
    <>
      <div className="space-y-6">
        {/* Back Link and Page Header */}
        <div className="space-y-4 pt-2">
          <Link href="/admin" className="text-xs text-text-secondary hover:text-gold-400 flex items-center gap-1.5 w-fit">
            <ArrowLeft className="w-4 h-4" /> Volver a administración
          </Link>

          <div className="flex items-center gap-3 pb-1 border-b border-border-subtle">
            <div className="p-2 bg-gold-400/10 border border-gold-500 rounded-xl text-gold-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-3xl tracking-wide text-text-primary">ADMINISTRAR COMPETENCIAS</h2>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Shield className="w-3.5 h-3.5 text-rank-up" />
                <span>Superadmin Dashboard</span>
              </div>
            </div>
          </div>
        </div>

        {/* Leagues List Table */}
        <div className="card-base overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-4 py-2.5 bg-bg-secondary/40 border-b border-border-subtle font-mono text-[10px] text-text-secondary uppercase font-semibold text-center">
            <span className="col-span-3 text-left">Competencia</span>
            <span className="col-span-3 text-left">Creador</span>
            <span className="col-span-2">Participantes / miembros</span>
            <span className="col-span-2">Estado</span>
            <span className="col-span-2 text-right">Acciones</span>
          </div>

          <div className="divide-y divide-border-subtle">
            {leagues.length === 0 ? (
              <div className="p-8 text-center text-text-secondary flex flex-col items-center justify-center gap-2">
                <Users className="w-8 h-8 text-text-muted" />
                <span className="font-bold text-text-primary text-sm">No hay competencias creadas</span>
                <span className="text-xs text-text-muted">Las competencias registradas por los usuarios aparecerán aquí.</span>
              </div>
            ) : (
              leagues.map((l) => {
                const isArchived = l.status === 'archived';
                const isLoading = loadingLeagueId === l.id;
                const memberSummary = summarizeCompetitionMembers(l.members.map((member) => ({
                  role: member.role,
                  isParticipant: member.isParticipant,
                  userStatus: member.user.status,
                })));
                return (
                  <div
                    key={l.id}
                    className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-0 px-4 py-4 items-center"
                  >
                    {/* League Name */}
                    <div className="col-span-3 w-full text-left">
                      <p className="font-bold text-text-primary text-sm">{l.name}</p>
                      <span className="text-xs text-text-secondary font-mono">ID: {l.id} | Código: {l.inviteCode}</span>
                    </div>

                    {/* Owner Info */}
                    <div className="col-span-3 w-full text-left">
                      <p className="text-sm font-semibold text-text-secondary">{l.owner?.name || 'Sistema'}</p>
                      <span className="text-xs text-text-muted font-mono">{l.owner?.email || 'N/A'}</span>
                    </div>

                    {/* Participant and membership counts */}
                    <div className="col-span-2 flex items-center justify-center gap-1.5 text-sm text-text-primary">
                      <Users className="w-4 h-4 text-gold-400" />
                      <span className="text-center leading-tight">
                        <strong>{memberSummary.participants}</strong> participantes
                        <span className="block text-[10px] text-text-muted">
                          {memberSummary.totalMembers} miembros
                        </span>
                      </span>
                    </div>

                    {/* Status badge */}
                    <div className="col-span-2 flex items-center justify-center">
                      <span
                        className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase ${
                          isArchived
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-green-500/10 text-green-400 border-green-500/30'
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 w-full flex justify-end items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveLeagueId(l.id)}
                        title="Gestionar miembros y participantes"
                        className="p-1.5 bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-gold-400 border border-border-default rounded-lg transition-all"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettingsLeagueId(l.id)}
                        title="Configurar Competencia"
                        className="p-1.5 bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-gold-400 border border-border-default rounded-lg transition-all"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(l.id, l.status)}
                        disabled={isLoading}
                        title={isArchived ? 'Reactivar Competencia' : 'Archivar Competencia'}
                        className="p-1.5 bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-gold-400 border border-border-default rounded-lg transition-all"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(l.id)}
                        disabled={isLoading}
                        title="Eliminar Competencia"
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Participants Management Modal */}
      {activeLeague && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="card-base p-6 max-w-xl w-full border-border-active space-y-4 relative flex flex-col max-h-[90vh]">
            <button
              type="button"
              onClick={() => {
                setActiveLeagueId(null);
                setModalError(null);
                setModalSuccess(null);
              }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="font-display text-2xl tracking-wide text-text-primary uppercase">
                MIEMBROS Y PARTICIPANTES: {activeLeague.name}
              </h3>
              <p className="text-xs text-text-secondary">
                El rol controla permisos. La opción Participa define si el miembro compite, sin cambiar su rol.
              </p>
            </div>

            {activeLeagueSummary && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-gold-400">{activeLeagueSummary.participants}</p>
                  <p className="text-[9px] uppercase text-text-muted">Participantes</p>
                </div>
                <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-text-primary">{activeLeagueSummary.totalMembers}</p>
                  <p className="text-[9px] uppercase text-text-muted">Miembros totales</p>
                </div>
                <div className="bg-bg-secondary/40 border border-border-subtle rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-blue-400">{activeLeagueSummary.administrators}</p>
                  <p className="text-[9px] uppercase text-text-muted">Admins / owners</p>
                </div>
              </div>
            )}

            {/* Modal Alerts */}
            {modalError && (
              <div className="text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2">
                <Shield className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}
            {modalSuccess && (
              <div className="text-xs text-green-400 bg-green-400/15 border border-green-500/30 p-3 rounded-lg flex items-start gap-2">
                <Shield className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {/* Add Member Form */}
            <form onSubmit={handleAddMember} className="bg-bg-secondary/40 p-3.5 border border-border-subtle rounded-xl space-y-2">
              <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                Agregar miembro participante aprobado
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1 field text-xs py-1.5"
                >
                  <option value="">-- Selecciona un usuario aprobado --</option>
                  {eligibleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName || u.name} (@{u.username || 'sin-username'}) - {u.email}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedUserId}
                  className="btn-gold px-3 py-1.5 text-xs flex items-center gap-1 hover:brightness-110 disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </div>
            </form>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
              <div className="text-[10px] font-mono uppercase text-text-secondary border-b border-border-subtle pb-1">
                Miembros actuales ({activeLeague.members.length})
              </div>

              {activeLeague.members.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted">No hay miembros en esta competencia.</div>
              ) : (
                <div className="divide-y divide-border-subtle/50">
                  {activeLeague.members.map((m) => {
                    const isOwner = m.role === 'owner';
                    const isAdmin = m.role === 'admin';
                    const roleLabel = isOwner ? 'Owner' : isAdmin ? 'Administrador' : 'Miembro';
                    return (
                      <div key={m.userId} className="flex items-center justify-between py-2.5 gap-2">
                        <div>
                          <p className="text-sm font-bold text-text-primary">
                            {m.user.displayName || m.user.name}
                          </p>
                          <span className="text-[10px] text-text-secondary font-mono">
                            @{m.user.username || 'sin-username'} | {m.user.email}
                          </span>
                        </div>

                        <div className="flex items-end justify-end gap-3 flex-wrap">
                          <div className="space-y-1 text-center">
                            <span className="block text-[8px] font-mono uppercase text-text-muted">Rol</span>
                            <span
                              className={`block text-[8px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase ${
                                isOwner
                                  ? 'bg-gold-500/10 text-gold-400 border-gold-500/30'
                                  : isAdmin
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                  : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                              }`}
                            >
                              {roleLabel}
                            </span>
                          </div>

                          <label className="space-y-1 text-center cursor-pointer">
                            <span className="block text-[8px] font-mono uppercase text-text-muted">Participa</span>
                            <span className="flex items-center justify-center gap-1.5 min-h-5">
                              <input
                                type="checkbox"
                                checked={m.isParticipant}
                                onChange={() => handleToggleParticipation(m.userId, m.isParticipant)}
                                disabled={isSubmitting || m.user.status !== 'approved'}
                                aria-label={`Participa en la competencia: ${m.user.displayName || m.user.name}`}
                                className="h-4 w-4 accent-gold-400 disabled:opacity-50"
                              />
                              <span className={m.isParticipant ? 'text-[9px] text-green-400' : 'text-[9px] text-text-muted'}>
                                {m.isParticipant ? 'Sí' : 'No'}
                              </span>
                            </span>
                          </label>

                          {/* Member Operations */}
                          {!isOwner && (
                            <div className="flex items-center gap-1">
                              {isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => handleManageMember(m.userId, 'demote')}
                                  disabled={isSubmitting}
                                  title="Degradar a Miembro"
                                  className="p-1 hover:bg-bg-hover text-text-secondary hover:text-yellow-500 rounded transition-all"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleManageMember(m.userId, 'promote')}
                                  disabled={isSubmitting}
                                  title="Promover a Admin"
                                  className="p-1 hover:bg-bg-hover text-text-secondary hover:text-green-500 rounded transition-all"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleManageMember(m.userId, 'remove')}
                                disabled={isSubmitting}
                                title="Eliminar de Competencia"
                                className="p-1 hover:bg-red-500/10 text-text-secondary hover:text-red-400 rounded transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border-subtle pt-3 text-right">
              <button
                type="button"
                onClick={() => {
                  setActiveLeagueId(null);
                  setModalError(null);
                  setModalSuccess(null);
                }}
                className="btn-secondary text-xs px-4 py-2"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Configuration Modal */}
      {settingsLeague && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="card-base p-6 max-w-xl w-full border-border-active space-y-4 relative flex flex-col max-h-[90vh]">
            <button
              type="button"
              onClick={() => {
                setSettingsLeagueId(null);
                setSettingsError(null);
                setSettingsSuccess(null);
              }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="font-display text-2xl tracking-wide text-text-primary uppercase">
                CONFIGURAR: {settingsLeague.name}
              </h3>
              <p className="text-xs text-text-secondary">
                Modifica las reglas, deadlines y cuotas de la competencia.
              </p>
            </div>

            {settingsError && (
              <div className="text-xs text-red-400 bg-red-400/15 border border-red-500/30 p-3 rounded-lg flex items-start gap-2">
                <Shield className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}
            {settingsSuccess && (
              <div className="text-xs text-green-400 bg-green-400/15 border border-green-500/30 p-3 rounded-lg flex items-start gap-2">
                <Shield className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4 overflow-y-auto pr-1">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Nombre de la Competencia
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={settingsLeague.name}
                  className="field text-xs py-1.5 w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                    Competencia principal
                  </label>
                  <select
                    name="isDefault"
                    defaultValue={String(settingsLeague.isDefault)}
                    className="field text-xs py-1.5 w-full"
                  >
                    <option value="true">Sí (Principal)</option>
                    <option value="false">No (Secundaria)</option>
                  </select>
                  <p className="text-[10px] text-text-muted">
                    La competencia principal se muestra en la vista pública de invitado.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                    Estado de Actividad
                  </label>
                  <select
                    name="isActive"
                    defaultValue={String(settingsLeague.isActive)}
                    className="field text-xs py-1.5 w-full"
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva (Oculta)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Tipo de competencia
                </label>
                <div className="bg-bg-secondary border border-border-default rounded-lg p-3">
                  <p className="text-sm font-semibold text-text-primary">
                    {settingsLeague.competitionType === 'champion_survivor' ? 'Solo campeón' : 'Polla completa'}
                  </p>
                  <p className="text-[10px] text-text-muted mt-1">
                    El tipo de competencia no se puede cambiar después de crear la competencia.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                    Cuota de Inscripción (Fee)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="entryFee"
                    required
                    defaultValue={settingsLeague.entryFee}
                    className="field text-xs py-1.5 w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                    Moneda
                  </label>
                  <input
                    type="text"
                    name="currency"
                    required
                    defaultValue={settingsLeague.currency}
                    className="field text-xs py-1.5 w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                    Puntos por Acertar Campeón
                  </label>
                  <input
                    type="number"
                    name="championPoints"
                    required
                    defaultValue={settingsLeague.championPoints}
                    className="field text-xs py-1.5 w-full"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border-subtle bg-bg-secondary/30 p-3">
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Puedes desactivar estas ayudas para hacer la competencia más difícil.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                      Mostrar odds
                    </label>
                    <select
                      name="showOdds"
                      defaultValue={String(settingsLeague.showOdds)}
                      className="field text-xs py-1.5 w-full"
                    >
                      <option value="true">Mostrar</option>
                      <option value="false">Ocultar</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                      Mostrar historial / H2H
                    </label>
                    <select
                      name="showH2H"
                      defaultValue={String(settingsLeague.showH2H)}
                      className="field text-xs py-1.5 w-full"
                    >
                      <option value="true">Mostrar</option>
                      <option value="false">Ocultar</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                  Límite para elegir Campeón (Hora Lima)
                </label>
                <input
                  type="datetime-local"
                  name="championDeadline"
                  defaultValue={settingsLeague.championDeadline ? getLimaDateTimeLocalString(settingsLeague.championDeadline) : ''}
                  className="field text-xs py-1.5 w-full"
                />
                <p className="text-[10px] text-text-muted">
                  Si se deja vacío, vencerá automáticamente al inicio del primer partido de 16avos de final.
                </p>
                {settingsLeague.championDeadline && (
                  <p className="text-[10px] text-text-muted">
                    Valor almacenado actual (UTC): <code className="bg-bg-secondary px-1 py-0.5 rounded">{settingsLeague.championDeadline}</code>
                  </p>
                )}
              </div>

              <div className="border-t border-border-subtle pt-4 space-y-4">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-gold-400">
                  Reglas de Puntuación
                </h4>
                
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.querySelector('form') as HTMLFormElement | null;
                      if (form) {
                        form.championPoints.value = '10';
                        form.pointsExactScore.value = '5';
                        form.pointsWinner.value = '3';
                        form.pointsDraw.value = '3';
                        form.pointsConsolation.value = '1';
                      }
                    }}
                    className="py-1 px-3 text-[10px] rounded-lg bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-default font-mono cursor-pointer"
                  >
                    Por defecto (10, 5, 3, 3, 1)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.querySelector('form') as HTMLFormElement | null;
                      if (form) {
                        form.championPoints.value = '50';
                        form.pointsExactScore.value = '5';
                        form.pointsWinner.value = '2';
                        form.pointsDraw.value = '2';
                        form.pointsConsolation.value = '1';
                      }
                    }}
                    className="py-1 px-3 text-[10px] rounded-lg bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border-default font-mono cursor-pointer"
                  >
                    Campeón pesa más (50, 5, 2, 2, 1)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                      Resultado Exacto
                    </label>
                    <input
                      type="number"
                      name="pointsExactScore"
                      required
                      defaultValue={settingsLeague.pointsExactScore}
                      className="field text-xs py-1.5 w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                      Tendencia Ganador
                    </label>
                    <input
                      type="number"
                      name="pointsWinner"
                      required
                      defaultValue={settingsLeague.pointsWinner}
                      className="field text-xs py-1.5 w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                      Tendencia Empate
                    </label>
                    <input
                      type="number"
                      name="pointsDraw"
                      required
                      defaultValue={settingsLeague.pointsDraw}
                      className="field text-xs py-1.5 w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                      Consolación (1 equipo exacto)
                    </label>
                    <input
                      type="number"
                      name="pointsConsolation"
                      required
                      defaultValue={settingsLeague.pointsConsolation}
                      className="field text-xs py-1.5 w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsLeagueId(null);
                    setSettingsError(null);
                    setSettingsSuccess(null);
                  }}
                  className="btn-secondary px-4 py-2 text-xs font-mono uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-gold px-4 py-2 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
