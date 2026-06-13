'use client';

import React, { useState } from 'react';
import { Shield, Settings, Archive, Trash2, ArrowLeft, Users, X, ArrowUp, ArrowDown, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { archiveLeagueAction, deleteLeagueAction, addMemberAction, manageMemberAction } from '../../lib/actions/leagues';

interface LeagueMemberData {
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    displayName: string | null;
    username: string | null;
  };
}

interface LeagueAdminData {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  status: string;
  createdAt: string;
  owner: {
    name: string;
    email: string;
  };
  _count: {
    members: number;
  };
  members: LeagueMemberData[];
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

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);

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
      confirmMsg = '¿Estás seguro de que deseas eliminar a este participante de la competencia?';
    } else if (action === 'promote') {
      confirmMsg = '¿Estás seguro de que deseas promover a este participante a administrador?';
    } else if (action === 'demote') {
      confirmMsg = '¿Estás seguro de que deseas degradar a este administrador a participante regular?';
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
            <span className="col-span-2">Participantes</span>
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

                    {/* Members Count */}
                    <div className="col-span-2 flex items-center justify-center gap-1 text-sm text-text-primary">
                      <Users className="w-4 h-4 text-gold-400" />
                      <span>{l._count.members}</span>
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
                        title="Gestionar Participantes"
                        className="p-1.5 bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-gold-400 border border-border-default rounded-lg transition-all"
                      >
                        <Users className="w-4 h-4" />
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
                PARTICIPANTES: {activeLeague.name}
              </h3>
              <p className="text-xs text-text-secondary">
                Administra los miembros, roles e invitaciones de esta competencia.
              </p>
            </div>

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
                Agregar Participante Aprobado
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1 input-base text-xs py-1.5 bg-[#0a0a0c]"
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
                Miembros Actuales ({activeLeague.members.length})
              </div>

              {activeLeague.members.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted">No hay miembros en esta competencia.</div>
              ) : (
                <div className="divide-y divide-border-subtle/50">
                  {activeLeague.members.map((m) => {
                    const isOwner = m.role === 'owner';
                    const isAdmin = m.role === 'admin';
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

                        <div className="flex items-center gap-2">
                          {/* Role Badge */}
                          <span
                            className={`text-[8px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase ${
                              isOwner
                                ? 'bg-gold-500/10 text-gold-400 border-gold-500/30'
                                : isAdmin
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                            }`}
                          >
                            {m.role}
                          </span>

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
    </>
  );
};;
