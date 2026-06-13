'use client';

import React, { useState } from 'react';
import { RankingTable } from './RankingTable';
import {
  Users,
  DollarSign,
  ArrowLeft,
  Share2,
  Settings,
  Award,
  Trash2,
  RefreshCw,
  Archive,
  UserCheck,
  UserX,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  regenerateInviteCodeAction,
  manageMemberAction,
  archiveLeagueAction,
  deleteLeagueAction,
} from '../../lib/actions/leagues';

interface MemberUser {
  id: string;
  name: string;
  email: string;
  displayName: string | null;
  whatsapp: string | null;
}

interface MemberData {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: MemberUser;
}

interface StandingData {
  userId: string;
  displayName: string;
  points: number;
  exacts: number;
  tendencies: number;
  consolations: number;
  misses: number;
  rank: number;
  previousRank: number;
}

interface LigaDetalleClientProps {
  league: {
    id: string;
    name: string;
    slug: string;
    inviteCode: string;
    status: string;
    createdBy: string;
  };
  currentUserRole: string | null;
  isSuperadmin: boolean;
  currentUserId: string;
  members: MemberData[];
  standings: StandingData[];
}

export const LigaDetalleClient: React.FC<LigaDetalleClientProps> = ({
  league,
  currentUserRole,
  isSuperadmin,
  currentUserId,
  members,
  standings,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'standings' | 'members' | 'settings'>('standings');
  const [copiedLink, setCopiedLink] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const canManage = isSuperadmin || currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = isSuperadmin || currentUserRole === 'owner';

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/join/${league.inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRegenerateCode = async () => {
    if (!confirm('¿Estás seguro de que deseas regenerar el código de invitación? El enlace anterior dejará de funcionar.')) {
      return;
    }
    setLoadingAction('regenerate');
    const res = await regenerateInviteCodeAction(league.id);
    setLoadingAction(null);
    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleManageMember = async (targetUserId: string, action: 'remove' | 'promote' | 'demote') => {
    const actionLabel =
      action === 'remove' ? 'eliminar' : action === 'promote' ? 'promover a Admin' : 'degradar a Miembro';
    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} a este usuario?`)) {
      return;
    }

    setLoadingAction(`${action}-${targetUserId}`);
    const res = await manageMemberAction(league.id, targetUserId, action);
    setLoadingAction(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleArchiveLeague = async () => {
    const isArchived = league.status === 'archived';
    const actionLabel = isArchived ? 'activar' : 'archivar';
    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} esta liga?`)) {
      return;
    }

    setLoadingAction('archive');
    const res = await archiveLeagueAction(league.id, !isArchived);
    setLoadingAction(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleDeleteLeague = async () => {
    if (!confirm('¡ADVERTENCIA! Esta acción eliminará permanentemente la liga y todos sus miembros/predicciones. ¿Estás seguro?')) {
      return;
    }

    setLoadingAction('delete');
    const res = await deleteLeagueAction(league.id);
    setLoadingAction(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.push('/liga');
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Back Link and Header */}
        <div className="space-y-4 pt-2">
          <Link href="/liga" className="text-xs text-text-secondary hover:text-gold-400 flex items-center gap-1.5 w-fit">
            <ArrowLeft className="w-4 h-4" /> Volver a ligas
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-3xl tracking-wide text-text-primary uppercase">
                  {league.name}
                </h2>
                {league.status === 'archived' && (
                  <span className="text-[10px] font-mono font-semibold bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full uppercase">
                    Archivada
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-text-secondary mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-gold-400" />
                  {members.length} miembros
                </span>
                <span className="flex items-center gap-0.5">
                  <DollarSign className="w-3.5 h-3.5 text-gold-400" />
                  Premio total: $0 USD
                </span>
                {league.status === 'active' && (
                  <span className="font-mono bg-bg-secondary px-2 py-0.5 rounded border border-border-default">
                    CÓDIGO: {league.inviteCode}
                  </span>
                )}
              </div>
            </div>

            {league.status === 'active' && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn-ghost flex items-center gap-1.5 text-xs py-2 px-4 self-start md:self-auto"
              >
                {copiedLink ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" /> Enlace Copiado
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" /> Compartir Enlace
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border-subtle gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('standings')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'standings'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4" /> Posiciones
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'members'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Miembros ({members.length})
            </span>
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'settings'
                  ? 'border-gold-400 text-gold-400'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Settings className="w-4 h-4" /> Configuración
              </span>
            </button>
          )}
        </div>

        {/* TAB CONTENTS */}

        {/* 1. STANDINGS */}
        {activeTab === 'standings' && (
          <div className="space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Tabla de Posiciones</h3>
            {standings.length === 0 ? (
              <div className="card-base p-8 text-center border-dashed border-border-default/60 flex flex-col items-center justify-center min-h-[180px]">
                <Users className="w-10 h-10 text-text-muted mb-2" />
                <h3 className="font-bold text-text-primary text-sm">No hay clasificaciones todavía</h3>
                <p className="text-xs text-text-secondary mt-1 max-w-xs">
                  Los rankings aparecerán aquí tan pronto como los partidos comiencen y sean puntuados por el administrador.
                </p>
              </div>
            ) : (
              <RankingTable standings={standings} currentUserId={currentUserId} />
            )}
          </div>
        )}

        {/* 2. MEMBERS LIST */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Miembros de la Liga</h3>
            <div className="card-base overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2.5 bg-bg-secondary/40 border-b border-border-subtle font-mono text-[10px] text-text-secondary uppercase font-semibold">
                <span className="col-span-5">Usuario</span>
                <span className="col-span-4 text-center">Unión</span>
                <span className="col-span-3 text-right">Rol</span>
              </div>
              <div className="divide-y divide-border-subtle">
                {members.map((member) => {
                  const isTargetYou = member.userId === currentUserId;
                  return (
                    <div key={member.id} className="grid grid-cols-12 px-4 py-3 items-center">
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold-400/10 border border-gold-500/30 flex items-center justify-center text-gold-400 font-mono font-bold text-xs uppercase">
                          {member.user.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">
                            {member.user.displayName || member.user.name}
                            {isTargetYou && <span className="text-[9px] text-gold-400 font-mono font-semibold ml-1.5 uppercase">TÚ</span>}
                          </p>
                          <p className="text-xs text-text-secondary truncate">{member.user.email}</p>
                        </div>
                      </div>
                      <span className="col-span-4 text-center text-xs text-text-secondary">
                        {new Date(member.joinedAt).toLocaleDateString('es-ES')}
                      </span>
                      <div className="col-span-3 flex justify-end items-center gap-1.5">
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase ${
                          member.role === 'owner' ? 'bg-gold-400/10 text-gold-400 border-gold-400/30' :
                          member.role === 'admin' ? 'bg-blue-400/10 text-blue-300 border-blue-400/30' :
                          'bg-bg-primary text-text-secondary border-border-default'
                        }`}>
                          {member.role === 'owner' ? 'Dueño' : member.role === 'admin' ? 'Admin' : 'Miembro'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. MANAGER SETTINGS */}
        {activeTab === 'settings' && canManage && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-[fadeIn_0.15s_ease-out]">
            {/* Members Management (Left 8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Administrar Miembros</h3>
              <div className="card-base overflow-hidden">
                <div className="divide-y divide-border-subtle">
                  {members.map((member) => {
                    const isTargetOwner = member.role === 'owner';
                    const isTargetAdmin = member.role === 'admin';
                    const isTargetYou = member.userId === currentUserId;

                    // Compute options available for the target based on role hierarchy
                    const canPromote = isOwner && !isTargetOwner && !isTargetAdmin;
                    const canDemote = isOwner && !isTargetOwner && isTargetAdmin;
                    const canRemove =
                      !isTargetYou &&
                      !isTargetOwner &&
                      (isOwner || (currentUserRole === 'admin' && member.role === 'member'));

                    return (
                      <div key={member.id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">
                            {member.user.displayName || member.user.name}
                            {isTargetYou && <span className="text-[9px] text-gold-400 font-mono font-semibold ml-1.5 uppercase">TÚ</span>}
                          </p>
                          <span className="text-xs text-text-secondary uppercase font-mono tracking-wider">
                            Rol: {member.role}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          {canPromote && (
                            <button
                              type="button"
                              onClick={() => handleManageMember(member.userId, 'promote')}
                              disabled={loadingAction !== null}
                              className="px-2.5 py-1 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 rounded text-xs border border-blue-500/20 font-semibold transition-all flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" /> Hacer Admin
                            </button>
                          )}
                          {canDemote && (
                            <button
                              type="button"
                              onClick={() => handleManageMember(member.userId, 'demote')}
                              disabled={loadingAction !== null}
                              className="px-2.5 py-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded text-xs border border-amber-500/20 font-semibold transition-all flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" /> Quitar Admin
                            </button>
                          )}
                          {canRemove && (
                            <button
                              type="button"
                              onClick={() => handleManageMember(member.userId, 'remove')}
                              disabled={loadingAction !== null}
                              className="px-2.5 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs border border-red-500/20 font-semibold transition-all flex items-center gap-1"
                            >
                              <UserX className="w-3 h-3" /> Expulsar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* League General Settings (Right 4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Administración General</h3>
              <div className="card-base p-5 space-y-4">
                {/* Invite code tools */}
                {league.status === 'active' && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Acceso de Invitados</p>
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      disabled={loadingAction !== null}
                      className="w-full btn-ghost py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingAction === 'regenerate' ? 'animate-spin' : ''}`} />
                      Regenerar Código
                    </button>
                  </div>
                )}

                {/* Archive / Delete tools */}
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Peligro / Estado</p>
                  <button
                    type="button"
                    onClick={handleArchiveLeague}
                    disabled={loadingAction !== null}
                    className="w-full px-4 py-2 bg-amber-500/10 hover:bg-amber-500/15 text-amber-500 rounded-xl text-xs font-semibold border border-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {league.status === 'archived' ? 'Reactivar Liga' : 'Archivar Liga'}
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={handleDeleteLeague}
                      disabled={loadingAction !== null}
                      className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/15 text-red-400 rounded-xl text-xs font-semibold border border-red-500/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar Liga
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};;
