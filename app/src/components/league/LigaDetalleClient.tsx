'use client';

import React, { useState } from 'react';
import { RankingTable } from './RankingTable';
import {
  Users,
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
import { formatLeagueCurrency } from '../../lib/utils/currency';
import { getCompetitionTypeLabel, getCompetitionTypeSubtitle } from '../../lib/competition-types';
import { useParticipantView } from '../../hooks/useParticipantView';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  regenerateInviteCodeAction,
  manageMemberAction,
  archiveLeagueAction,
  deleteLeagueAction,
} from '../../lib/actions/leagues';
import { FLAG_MAP } from '../ui/FlagDisc';
import {
  allowWinnerPredictionCorrectionAction,
  directCorrectWinnerPredictionAction,
} from '../../lib/actions/predictions';

interface MemberUser {
  id: string;
  name: string;
  email: string | null;
  displayName: string | null;
  whatsapp: string | null;
  status: string | null;
}

interface MemberData {
  id: string;
  userId: string;
  role: string;
  isParticipant: boolean;
  joinedAt: string;
  user: MemberUser;
}

interface StandingData {
  userId: string;
  displayName: string;
  points: number;
  champPoints?: number;
  matchPoints?: number;
  exacts: number;
  tendencies: number;
  consolations: number;
  misses: number;
  rank: number;
  previousRank: number;
  predictionsSubmitted: number;
  lastUpdated: string;
}

interface LigaDetalleClientProps {
  league: {
    id: string;
    name: string;
    slug: string;
    inviteCode: string;
    status: string;
    createdBy: string;
    competitionType: string;
    entryFee?: number;
    currency?: string;
    prizePoolOverride?: number | null;
    memberCount?: number;
  };
  survivalTable?: {
    userId: string;
    displayName: string;
    teamCode: string | null;
    teamName: string | null;
    position: number;
    statusLabel: string;
    roundLabel: string;
    eliminatedInMatchId: string | null;
  }[];
  currentUserRole: string | null;
  isSuperadmin: boolean;
  currentUserId: string;
  members: MemberData[];
  standings: StandingData[];
  winnerPredictions: {
    userId: string;
    teamCode: string;
    correctionAllowed: boolean;
    correctionAllowedUntil: string | null;
    correctionReason: string | null;
  }[];
  winnerPredictionHistories: {
    id: string;
    userId: string;
    userName: string;
    oldTeamCode: string | null;
    newTeamCode: string;
    actionType: string;
    authorizedById: string | null;
    changedById: string | null;
    reason: string | null;
    createdAt: string;
  }[];
  teams: {
    code: string;
    name: string;
  }[];
}

export const LigaDetalleClient: React.FC<LigaDetalleClientProps> = ({
  league,
  survivalTable = [],
  currentUserRole,
  isSuperadmin,
  currentUserId,
  members,
  standings,
  winnerPredictions = [],
  winnerPredictionHistories = [],
  teams = [],
}) => {
  const isParticipantPreview = useParticipantView();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'standings' | 'members' | 'settings' | 'history'>('standings');
  const [copiedLink, setCopiedLink] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Correction panel states
  const [activeCorrectionUserId, setActiveCorrectionUserId] = useState<string | null>(null);
  const [correctionType, setCorrectionType] = useState<'authorize' | 'direct' | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [mandatoryReason, setMandatoryReason] = useState<string>('');
  const [directTeamCode, setDirectTeamCode] = useState<string>('');

  const handleExecuteCorrection = async (userId: string) => {
    if (!mandatoryReason.trim()) {
      alert('El motivo es obligatorio.');
      return;
    }

    setLoadingAction('correction');

    let res;
    if (correctionType === 'authorize') {
      res = await allowWinnerPredictionCorrectionAction(league.id, userId, durationMinutes, mandatoryReason);
    } else if (correctionType === 'direct') {
      if (!directTeamCode) {
        alert('Por favor selecciona una selección.');
        setLoadingAction(null);
        return;
      }
      res = await directCorrectWinnerPredictionAction(league.id, userId, directTeamCode, mandatoryReason);
    }

    setLoadingAction(null);

    if (res?.error) {
      alert(res.error);
    } else {
      alert('Operación realizada con éxito.');
      setActiveCorrectionUserId(null);
      setCorrectionType(null);
      setMandatoryReason('');
      setDirectTeamCode('');
      router.refresh();
    }
  };

  const canManage = !isParticipantPreview && (isSuperadmin || currentUserRole === 'owner' || currentUserRole === 'admin');
  const isOwner = !isParticipantPreview && (isSuperadmin || currentUserRole === 'owner');

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
    if (!confirm(`¿Estás seguro de que deseas ${actionLabel} esta competencia?`)) {
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
    if (!confirm('¡ADVERTENCIA! Esta acción eliminará permanentemente la competencia y todos sus miembros/predicciones. ¿Estás seguro?')) {
      return;
    }

    setLoadingAction('delete');
    const res = await deleteLeagueAction(league.id);
    setLoadingAction(null);

    if (res.error) {
      alert(res.error);
    } else {
      router.push('/competencia');
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Back Link and Header */}
        <div className="space-y-4 pt-2">
          <Link href="/competencia" className="text-xs text-text-secondary hover:text-gold-400 flex items-center gap-1.5 w-fit">
            <ArrowLeft className="w-4 h-4" /> Volver a competencias
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
                  <span className="text-green-400 font-semibold">{members.filter(m => m.isParticipant && m.user.status === 'approved').length} participantes activos</span>
                  {members.filter(m => m.user.status !== 'approved').length > 0 && (
                    <span className="text-text-muted"> · {members.filter(m => m.user.status !== 'approved').length} inactivos/bloqueados</span>
                  )}
                  <span className="text-text-muted"> ({members.filter(m => m.isParticipant).length} participantes)</span>
                </span>
                {(league.entryFee ?? 0) > 0 && (
                  <span className="flex items-center gap-1 font-mono font-semibold text-gold-400">
                    {(() => {
                      const memberCount = league.memberCount ?? members.filter(
                        m => m.isParticipant && m.user.status === 'approved'
                      ).length;
                      const prize = league.prizePoolOverride ?? (memberCount * (league.entryFee ?? 0));
                      return `Premio total: ${formatLeagueCurrency(prize, league.currency ?? 'PEN')}`;
                    })()}
                  </span>
                )}
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
              <Users className="w-4 h-4" /> Miembros de la competencia ({members.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'history'
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" /> Historial
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
              <RankingTable
                competitionType={league.competitionType}
                standings={standings}
                survivalTable={survivalTable}
                currentUserId={currentUserId}
              />
            )}
          </div>
        )}

        {/* 2. MEMBERS LIST */}
        {activeTab === 'members' && (() => {
          const activeMembers = members.filter(m => m.isParticipant && m.user.status === 'approved');
          const inactiveMembers = members.filter(m => m.isParticipant && m.user.status !== 'approved');

          const renderUserStatusBadge = (status: string) => {
            switch (status) {
              case 'approved':
                return null;
              case 'pending':
                return (
                  <span className="text-[9px] font-mono font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full uppercase">
                    Pendiente
                  </span>
                );
              case 'disabled':
                return (
                  <span className="text-[9px] font-mono font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 px-2 py-0.5 rounded-full uppercase">
                    Inactivo/Deshabilitado
                  </span>
                );
              case 'rejected':
                return (
                  <span className="text-[9px] font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full uppercase">
                    Rechazado
                  </span>
                );
              case 'blocked':
                return (
                  <span className="text-[9px] font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full uppercase">
                    Bloqueado
                  </span>
                );
              default:
                return (
                  <span className="text-[9px] font-mono font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 px-2 py-0.5 rounded-full uppercase">
                    {status}
                  </span>
                );
            }
          };

          return (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Participantes activos ({activeMembers.length})</h3>
                <div className="card-base overflow-hidden">
                  <div className="grid grid-cols-12 px-4 py-2.5 bg-bg-secondary/40 border-b border-border-subtle font-mono text-[10px] text-text-secondary uppercase font-semibold">
                    <span className="col-span-5">Usuario</span>
                    <span className="col-span-4 text-center">Unión</span>
                    <span className="col-span-3 text-right">Rol</span>
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {activeMembers.map((member) => {
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
                              {member.user.email && <p className="text-xs text-text-secondary truncate">{member.user.email}</p>}
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

              {inactiveMembers.length > 0 && (
                <div className="space-y-4">
                  <details className="group border border-border-default rounded-xl overflow-hidden bg-bg-secondary/20" open={false}>
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface transition-colors select-none font-display text-md tracking-wide uppercase text-text-muted">
                      <span>Miembros Inactivos / Bloqueados ({inactiveMembers.length})</span>
                      <span className="transition-transform group-open:rotate-180">▼</span>
                    </summary>
                    <div className="border-t border-border-default">
                      <div className="grid grid-cols-12 px-4 py-2 bg-black/20 border-b border-border-subtle font-mono text-[10px] text-text-secondary uppercase font-semibold">
                        <span className="col-span-5">Usuario</span>
                        <span className="col-span-4 text-center">Unión</span>
                        <span className="col-span-3 text-right">Estado / Rol</span>
                      </div>
                      <div className="divide-y divide-border-subtle">
                        {inactiveMembers.map((member) => {
                          const isTargetYou = member.userId === currentUserId;
                          return (
                            <div key={member.id} className="grid grid-cols-12 px-4 py-3 items-center">
                              <div className="col-span-5 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-500/10 border border-zinc-500/30 flex items-center justify-center text-zinc-400 font-mono font-bold text-xs uppercase">
                                  {member.user.name.slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-text-muted truncate">
                                    {member.user.displayName || member.user.name}
                                    {isTargetYou && <span className="text-[9px] text-gold-400 font-mono font-semibold ml-1.5 uppercase">TÚ</span>}
                                  </p>
                                </div>
                              </div>
                              <span className="col-span-4 text-center text-xs text-text-muted">
                                {new Date(member.joinedAt).toLocaleDateString('es-ES')}
                              </span>
                              <div className="col-span-3 flex justify-end items-center gap-1.5 flex-wrap">
                                {renderUserStatusBadge(member.user.status || 'pending')}
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border border-border-default bg-bg-primary text-text-muted uppercase">
                                  {member.role === 'owner' ? 'Dueño' : member.role === 'admin' ? 'Admin' : 'Miembro'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>
          );
        })()}

        {/* 3. MANAGER SETTINGS */}
        {activeTab === 'settings' && canManage && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-[fadeIn_0.15s_ease-out]">
            {/* Members Management (Left 8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Miembros de la competencia</h3>
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

                    const wp = winnerPredictions.find(w => w.userId === member.userId);
                    const wpFlag = wp ? (FLAG_MAP[wp.teamCode.toUpperCase()] || '') : '';
                    const wpTeam = wp ? (teams.find(t => t.code === wp.teamCode)?.name || wp.teamCode) : null;

                    return (
                      <div key={member.id} className="flex flex-col px-4 py-3 gap-2 border-b border-border-subtle/30 last:border-0">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate">
                              {member.user.displayName || member.user.name}
                              {isTargetYou && <span className="text-[9px] text-gold-400 font-mono font-semibold ml-1.5 uppercase">TÚ</span>}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                              <span className="text-xs text-text-secondary uppercase font-mono tracking-wider">
                                Rol: {member.role}
                              </span>
                              <span className="text-text-muted text-xs">•</span>
                              <span className="text-xs text-text-secondary font-mono">
                                Campeón: {wp ? (
                                  <strong className="text-gold-400 font-bold uppercase">
                                    {wpFlag} {wpTeam} ({wp.teamCode})
                                  </strong>
                                ) : (
                                  <span className="text-red-400 font-bold">Sin selección</span>
                                )}
                              </span>
                              {wp?.correctionAllowed && wp?.correctionAllowedUntil && (
                                <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 rounded-full font-mono">
                                  Habilitado hasta {new Date(wp.correctionAllowedUntil).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 flex-wrap items-center">
                            {/* Superadmin correction tools */}
                            {isSuperadmin && !isParticipantPreview && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCorrectionUserId(member.userId);
                                    setCorrectionType('authorize');
                                    setDirectTeamCode('');
                                    setMandatoryReason('');
                                  }}
                                  disabled={loadingAction !== null}
                                  className="px-2.5 py-1 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 rounded text-xs border border-yellow-500/20 font-semibold transition-all flex items-center gap-1"
                                >
                                  Autorizar Corrección
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCorrectionUserId(member.userId);
                                    setCorrectionType('direct');
                                    setDirectTeamCode(wp?.teamCode || '');
                                    setMandatoryReason('');
                                  }}
                                  disabled={loadingAction !== null}
                                  className="px-2.5 py-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded text-xs border border-purple-500/20 font-semibold transition-all flex items-center gap-1"
                                >
                                  Corrección Directa
                                </button>
                              </>
                            )}

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

                        {/* Inline correction controls */}
                        {activeCorrectionUserId === member.userId && correctionType && (
                          <div className="mt-2 p-3 bg-bg-secondary/60 border border-gold-400/20 rounded-lg space-y-3 text-xs w-full">
                            <h4 className="font-semibold text-gold-400 uppercase font-mono tracking-wider">
                              {correctionType === 'authorize' ? 'Autorizar Corrección de Campeón' : 'Corrección Directa de Campeón'}
                            </h4>
                            
                            {correctionType === 'authorize' ? (
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-mono text-text-secondary">Plazo de Corrección:</label>
                                <select
                                  value={durationMinutes}
                                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                  className="field py-1.5 px-3 text-xs bg-bg-secondary text-text-primary border border-border-default rounded-lg w-full font-sans"
                                >
                                  <option value={30}>30 Minutos</option>
                                  <option value={60}>1 Hora</option>
                                  <option value={1440}>24 Horas (1 día)</option>
                                </select>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <label className="text-[10px] uppercase font-mono text-text-secondary">Nuevo Campeón:</label>
                                <select
                                  value={directTeamCode}
                                  onChange={(e) => setDirectTeamCode(e.target.value)}
                                  className="field py-1.5 px-3 text-xs bg-bg-secondary text-text-primary border border-border-default rounded-lg w-full font-sans"
                                >
                                  <option value="">-- Selecciona Selección --</option>
                                  {teams.map(t => (
                                    <option key={t.code} value={t.code}>
                                      {FLAG_MAP[t.code.toUpperCase()] || ''} {t.name} ({t.code})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-mono text-text-secondary">Motivo Obligatorio:</label>
                              <input
                                type="text"
                                value={mandatoryReason}
                                onChange={(e) => setMandatoryReason(e.target.value)}
                                placeholder="Ej. Error al seleccionar, cambio solicitado..."
                                className="field py-1.5 px-3 text-xs bg-bg-secondary text-text-primary border border-border-default rounded-lg w-full"
                              />
                            </div>

                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCorrectionUserId(null);
                                  setCorrectionType(null);
                                  setMandatoryReason('');
                                }}
                                className="px-3 py-1.5 bg-bg-hover hover:bg-bg-tertiary border border-border-default text-text-secondary rounded-lg font-semibold"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExecuteCorrection(member.userId)}
                                className="btn-gold px-3 py-1.5 font-mono uppercase tracking-wider text-[11px]"
                              >
                                Confirmar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* League General Settings (Right 4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Configuración de competencia</h3>
              <div className="card-base p-5 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Tipo de competencia</p>
                  <div className="bg-bg-secondary border border-border-default rounded-xl p-3">
                    <p className="text-sm font-semibold text-text-primary">
                      {getCompetitionTypeLabel(league.competitionType)}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1">
                      {getCompetitionTypeSubtitle(league.competitionType)}
                    </p>
                  </div>
                </div>
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
                    {league.status === 'archived' ? 'Reactivar competencia' : 'Archivar competencia'}
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={handleDeleteLeague}
                      disabled={loadingAction !== null}
                      className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/15 text-red-400 rounded-xl text-xs font-semibold border border-red-500/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar competencia
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="font-display text-xl tracking-wide uppercase text-text-primary">Historial de Cambios de Campeón</h3>
            {winnerPredictionHistories.length === 0 ? (
              <div className="card-base p-8 text-center border-dashed border-border-default/60 flex flex-col items-center justify-center min-h-[180px]">
                <Users className="w-10 h-10 text-text-muted mb-2" />
                <h3 className="font-bold text-text-primary text-sm">No hay cambios registrados</h3>
                <p className="text-xs text-text-secondary mt-1 max-w-xs">
                  Aquí aparecerá el registro de elecciones de campeón y cualquier corrección posterior.
                </p>
              </div>
            ) : (
              <div className="card-base overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2.5 bg-bg-secondary/40 border-b border-border-subtle font-mono text-[10px] text-text-secondary uppercase font-semibold">
                  <span className="col-span-3">Usuario</span>
                  <span className="col-span-6">Acción / Detalle</span>
                  <span className="col-span-3 text-right">Fecha</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {winnerPredictionHistories.map((h) => {
                    const dateStr = new Date(h.createdAt).toLocaleString('es-PE', {
                      timeZone: 'America/Lima',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    const oldTeamFlag = h.oldTeamCode ? (FLAG_MAP[h.oldTeamCode.toUpperCase()] || '') : '';
                    const oldTeamName = h.oldTeamCode ? (teams.find(t => t.code === h.oldTeamCode)?.name || h.oldTeamCode) : '';
                    const newTeamFlag = FLAG_MAP[h.newTeamCode.toUpperCase()] || '';
                    const newTeamName = teams.find(t => t.code === h.newTeamCode)?.name || h.newTeamCode;

                    let detailsText = '';
                    if (h.actionType === 'created') {
                      detailsText = `Eligió a ${newTeamFlag} ${newTeamName} como campeón`;
                    } else if (h.actionType === 'correction_authorized') {
                      detailsText = `Se autorizó corrección. Motivo: "${h.reason}"`;
                    } else if (h.actionType === 'changed_by_user') {
                      detailsText = `Corrigió su elección de ${oldTeamFlag ? `${oldTeamFlag} ${oldTeamName}` : 'sin elección'} a ${newTeamFlag} ${newTeamName}`;
                    } else if (h.actionType === 'changed_by_admin') {
                      detailsText = `Superadmin corrigió la elección de ${oldTeamFlag ? `${oldTeamFlag} ${oldTeamName}` : 'sin elección'} a ${newTeamFlag} ${newTeamName}. Motivo: "${h.reason}"`;
                    }

                    return (
                      <div key={h.id} className="grid grid-cols-12 px-4 py-3 items-center text-xs">
                        <span className="col-span-3 font-semibold text-text-primary">{h.userName}</span>
                        <span className="col-span-6 text-text-secondary">{detailsText}</span>
                        <span className="col-span-3 text-right text-text-muted font-mono">{dateStr}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};;
