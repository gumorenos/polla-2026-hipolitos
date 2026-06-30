'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { revalidatePath } from 'next/cache';
import { recalculateAllStandings } from '../services/standings';
import {
  getCompetitionParticipationUpdate,
  wouldRemoveLastCompetitionAdministrator,
} from '../competition-members';

/**
 * Creates a new private competition. The creator always becomes owner, but participant status is explicit.
 */
type CompetitionTypeInput = 'full_prediction' | 'champion_survivor' | 'match_pool';

interface CreateLeagueInput {
  name: string;
  competitionType?: string | null;
  championDeadline?: string | null;
  joinAsParticipant?: boolean;
  showOdds?: boolean;
  showH2H?: boolean;
}

function resolveCompetitionTypeInput(value?: string | null): CompetitionTypeInput | null {
  if (!value) return 'full_prediction';
  if (value === 'full_prediction' || value === 'champion_survivor' || value === 'match_pool') return value;
  return null;
}

export async function createLeagueAction(input: string | CreateLeagueInput) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado. Inicia sesión primero.' };
  }

  const userId = session.user.id;
  const payload: CreateLeagueInput = typeof input === 'string' ? { name: input } : input;
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperadmin: true, canCreateLeagues: true },
    });

    if (!user?.isSuperadmin && !user?.canCreateLeagues) {
      return { error: 'No tienes permiso para crear competencias.' };
    }

    if (typeof payload.name !== 'string') {
      return { error: 'El nombre de la competencia es obligatorio.' };
    }

    const trimmedName = payload.name.trim();
    if (!trimmedName || trimmedName.length < 3) {
      return { error: 'El nombre de la competencia debe tener al menos 3 caracteres.' };
    }

    const competitionType = resolveCompetitionTypeInput(payload.competitionType);
    if (!competitionType) {
      return { error: 'Tipo de competencia inválido.' };
    }
    if (payload.showOdds !== undefined && typeof payload.showOdds !== 'boolean') {
      return { error: 'Configuración de odds inválida.' };
    }
    if (payload.showH2H !== undefined && typeof payload.showH2H !== 'boolean') {
      return { error: 'Configuración de historial inválida.' };
    }
    const isMatchPool = competitionType === 'match_pool';
    // Match Pool starts without market aids. An admin may enable stored pre-match odds later.
    const showOdds = isMatchPool ? false : (payload.showOdds ?? true);
    const showH2H = payload.showH2H ?? true;

    let championDeadline: Date | null = null;
    if (!isMatchPool && payload.championDeadline) {
      championDeadline = new Date(payload.championDeadline);
      if (Number.isNaN(championDeadline.getTime())) {
        return { error: 'La fecha límite para elegir campeón no es válida.' };
      }
    }

    // Generate a unique URL slug
    const baseSlug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let suffix = 1;

    // Check slug uniqueness and append suffix if necessary
    while (await prisma.league.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    // Generate a unique invite code
    let inviteCode = '';
    let isCodeUnique = false;
    while (!isCodeUnique) {
      inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const existing = await prisma.league.findUnique({ where: { inviteCode } });
      if (!existing) {
        isCodeUnique = true;
      }
    }

    // Execute league creation and membership assignment in a transaction
    const league = await prisma.$transaction(async (tx) => {
      const newLeague = await tx.league.create({
        data: {
          name: trimmedName,
          slug,
          inviteCode,
          createdBy: userId,
          status: 'active',
          competitionType,
          championDeadline,
          showOdds,
          showH2H,
        },
      });

      await tx.leagueMember.create({
        data: {
          leagueId: newLeague.id,
          userId,
          role: 'owner',
          isParticipant: isMatchPool ? false : payload.joinAsParticipant === true,
        },
      });

      if (!isMatchPool && payload.joinAsParticipant === true) {
        for (const block of ['groups', 'knockout', 'global']) {
          await tx.standing.create({
            data: {
              leagueId: newLeague.id,
              userId,
              block,
              points: 0,
              exacts: 0,
              tendencies: 0,
              consolations: 0,
              misses: 0,
              rank: 0,
              previousRank: 0,
            },
          });
        }
      }

      return newLeague;
    });

    await prisma.adminActionLog.create({
      data: {
        userId,
        action: 'league_creation',
        target: `league:${league.id}`,
        details: JSON.stringify({
          name: league.name,
          competitionType,
          ownerJoinedAsParticipant: !isMatchPool && payload.joinAsParticipant === true,
          showOdds,
          showH2H,
        }),
      },
    });

    revalidatePath('/liga');
    revalidatePath('/competencia');
    if (!isMatchPool) {
      await recalculateAllStandings();
    }
    return { data: league };
  } catch (error) {
    console.error('Error in createLeagueAction:', error);
    return { error: 'Ocurrió un error al crear la competencia.' };
  }
}

/**
 * Joins a user to a league using a unique invite code.
 */
export async function joinLeagueAction(inviteCode: string) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado. Inicia sesión primero.' };
  }

  const userId = session.user.id;
  const cleanCode = inviteCode.trim().toUpperCase();

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!user || user.status !== 'approved') {
      return { error: 'Tu cuenta debe estar aprobada para unirte a una polla.' };
    }

    // Find active league matching code
    const league = await prisma.league.findUnique({
      where: { inviteCode: cleanCode },
    });

    if (!league || league.status !== 'active' || !league.isActive) {
      return { error: 'Código de invitación inválido o la polla está inactiva.' };
    }

    if (!league.inviteEnabled) {
      return { error: 'El registro por código de invitación está deshabilitado para esta polla.' };
    }

    if (league.competitionType === 'match_pool') {
      // Match Pool access is open to approved users; entering the lobby must not create membership.
      return { data: { lobbyAccess: true }, slug: league.slug };
    }

    // Verify user is not already a member
    const existingMembership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId: league.id,
          userId,
        },
      },
    });

    if (existingMembership) {
      return { error: 'Ya eres miembro de esta polla.', slug: league.slug };
    }

    // Create membership
    const membership = await prisma.leagueMember.create({
      data: {
        leagueId: league.id,
        userId,
        role: 'member',
      },
    });

    revalidatePath('/liga');
    revalidatePath('/competencia');
    revalidatePath(`/liga/${league.slug}`);
    revalidatePath(`/competencia/${league.slug}`);
    await recalculateAllStandings();
    return { data: membership, slug: league.slug };
  } catch (error) {
    console.error('Error in joinLeagueAction:', error);
    return { error: 'Ocurrió un error al unirse a la polla.' };
  }
}

/**
 * Regenerates a unique invite code for a league, invalidating the old one.
 */
export async function regenerateInviteCodeAction(leagueId: string) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const userId = session.user.id;

  try {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return { error: 'Liga no encontrada.' };
    }

    // Verify caller is owner or admin of the league, or global Superadmin
    const callerMember = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    const isAuthorized =
      session.user.isSuperadmin ||
      (callerMember && (callerMember.role === 'owner' || callerMember.role === 'admin'));

    if (!isAuthorized) {
      return { error: 'No tienes permisos para regenerar el código de invitación.' };
    }

    // Generate unique code
    let newCode = '';
    let isCodeUnique = false;
    while (!isCodeUnique) {
      newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const existing = await prisma.league.findUnique({ where: { inviteCode: newCode } });
      if (!existing) {
        isCodeUnique = true;
      }
    }

    const updatedLeague = await prisma.league.update({
      where: { id: leagueId },
      data: { inviteCode: newCode },
    });

    await prisma.adminActionLog.create({
      data: {
        userId,
        action: 'invite_regeneration',
        target: `league:${leagueId}`,
        details: JSON.stringify({ newCode }),
      },
    });

    revalidatePath(`/liga/${updatedLeague.slug}`);
    revalidatePath(`/competencia/${updatedLeague.slug}`);
    return { data: updatedLeague };
  } catch (error) {
    console.error('Error in regenerateInviteCodeAction:', error);
    return { error: 'Ocurrió un error al regenerar el código.' };
  }
}

/**
 * Manages league member roles (promoting to admin, demoting to member, or removing).
 */
export async function manageMemberAction(
  leagueId: string,
  targetUserId: string,
  action: 'remove' | 'promote' | 'demote',
  reason?: string
) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const userId = session.user.id;

  try {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return { error: 'Liga no encontrada.' };
    }

    // Fetch caller role
    const callerMember = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    const isCallerSuperadmin = session.user.isSuperadmin;
    const callerRole = callerMember?.role;

    const isAuthorizedCaller =
      isCallerSuperadmin || callerRole === 'owner' || callerRole === 'admin';

    if (!isAuthorizedCaller) {
      return { error: 'No tienes permisos para administrar miembros.' };
    }

    // Fetch target member
    const targetMember = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    if (!targetMember) {
      return { error: 'El usuario no es miembro de esta liga.' };
    }

    // Verify role hierarchy:
    // - Owners can manage admins and members.
    // - Admins can only manage members.
    // - No one (except Superadmin) can manage the owner.
    if (!isCallerSuperadmin) {
      if (targetMember.role === 'owner') {
        return { error: 'No puedes modificar al dueño de la liga.' };
      }
      if (callerRole === 'admin' && targetMember.role === 'admin') {
        return { error: 'Un administrador no puede modificar a otro administrador.' };
      }
    }

    if (action === 'remove' || action === 'demote') {
      const memberships = await prisma.leagueMember.findMany({
        where: { leagueId },
        select: { userId: true, role: true },
      });
      if (wouldRemoveLastCompetitionAdministrator(memberships, targetUserId, action)) {
        return { error: 'La competencia debe conservar al menos un owner o administrador.' };
      }
    }

    if (action === 'remove') {
      await prisma.leagueMember.delete({
        where: { leagueId_userId: { leagueId, userId: targetUserId } },
      });
      await prisma.adminActionLog.create({
        data: {
          userId,
          action: 'member_removal',
          target: `user:${targetUserId}`,
          details: JSON.stringify({ leagueId, reason }),
        },
      });
    } else if (action === 'promote') {
      await prisma.leagueMember.update({
        where: { leagueId_userId: { leagueId, userId: targetUserId } },
        data: { role: 'admin' },
      });
      await prisma.adminActionLog.create({
        data: {
          userId,
          action: 'member_role_change',
          target: `user:${targetUserId}`,
          details: JSON.stringify({ leagueId, newRole: 'admin', reason }),
        },
      });
    } else if (action === 'demote') {
      await prisma.leagueMember.update({
        where: { leagueId_userId: { leagueId, userId: targetUserId } },
        data: { role: 'member' },
      });
      await prisma.adminActionLog.create({
        data: {
          userId,
          action: 'member_role_change',
          target: `user:${targetUserId}`,
          details: JSON.stringify({ leagueId, newRole: 'member', reason }),
        },
      });
    }

    revalidatePath(`/liga/${league.slug}`);
    revalidatePath('/admin/competencias');
    revalidatePath('/admin/ligas');
    return { success: true };
  } catch (error) {
    console.error('Error in manageMemberAction:', error);
    return { error: 'Ocurrió un error al gestionar al miembro.' };
  }
}

/** Updates competition participation without changing the membership role or permissions. */
export async function updateMemberParticipationAction(
  leagueId: string,
  targetUserId: string,
  isParticipant: boolean,
) {
  const session = await getCurrentSession();
  if (!session?.user) return { error: 'No autorizado.' };
  if (typeof isParticipant !== 'boolean') return { error: 'Estado de participación inválido.' };

  const actorUserId = session.user.id;
  try {
    const [league, callerMember, targetMember, targetUser] = await Promise.all([
      prisma.league.findUnique({ where: { id: leagueId }, select: { id: true, slug: true } }),
      prisma.leagueMember.findUnique({
        where: { leagueId_userId: { leagueId, userId: actorUserId } },
        select: { role: true },
      }),
      prisma.leagueMember.findUnique({
        where: { leagueId_userId: { leagueId, userId: targetUserId } },
        select: { userId: true, role: true, isParticipant: true },
      }),
      prisma.user.findUnique({ where: { id: targetUserId }, select: { status: true } }),
    ]);

    if (!league) return { error: 'Competencia no encontrada.' };
    if (!targetMember) return { error: 'El usuario no es miembro de esta competencia.' };

    const isSuperadmin = session.user.isSuperadmin === true;
    const callerRole = callerMember?.role;
    if (!isSuperadmin && callerRole !== 'owner' && callerRole !== 'admin') {
      return { error: 'No tienes permisos para cambiar la participación.' };
    }
    if (
      !isSuperadmin
      && callerRole === 'admin'
      && targetUserId !== actorUserId
      && targetMember.role !== 'member'
    ) {
      return { error: 'Un administrador solo puede cambiar su participación o la de miembros regulares.' };
    }
    if (isParticipant && targetUser?.status !== 'approved') {
      return { error: 'Solo los usuarios aprobados pueden competir.' };
    }
    if (targetMember.isParticipant === isParticipant) {
      return { success: true, data: targetMember };
    }

    const participationUpdate = getCompetitionParticipationUpdate(isParticipant);
    const updated = await prisma.$transaction(async (tx) => {
      const membership = await tx.leagueMember.update({
        where: { leagueId_userId: { leagueId, userId: targetUserId } },
        data: participationUpdate,
        select: { userId: true, role: true, isParticipant: true },
      });

      if (isParticipant) {
        for (const block of ['groups', 'knockout', 'global']) {
          await tx.standing.upsert({
            where: { leagueId_userId_block: { leagueId, userId: targetUserId, block } },
            update: {},
            create: {
              leagueId,
              userId: targetUserId,
              block,
              points: 0,
              exacts: 0,
              tendencies: 0,
              consolations: 0,
              misses: 0,
              rank: 0,
              previousRank: 0,
            },
          });
        }
      }

      await tx.adminActionLog.create({
        data: {
          userId: actorUserId,
          action: 'member_participation_change',
          target: `user:${targetUserId}`,
          details: JSON.stringify({
            leagueId,
            role: targetMember.role,
            previousIsParticipant: targetMember.isParticipant,
            isParticipant,
          }),
        },
      });
      return membership;
    });

    revalidatePath(`/liga/${league.slug}`);
    revalidatePath(`/competencia/${league.slug}`);
    revalidatePath('/admin/competencias');
    revalidatePath('/admin/ligas');
    revalidatePath('/admin');
    revalidatePath('/pronosticos');
    revalidatePath('/ranking');
    revalidatePath('/');
    revalidatePath('/invitado');
    await recalculateAllStandings();
    return { success: true, data: updated };
  } catch (error) {
    console.error('Error in updateMemberParticipationAction:', error);
    return { error: 'No se pudo actualizar la participación del miembro.' };
  }
}

/**
 * Toggles a league's status between 'active' and 'archived' (Superadmin or Owner only).
 */
export async function archiveLeagueAction(leagueId: string, archive: boolean) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const userId = session.user.id;

  try {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return { error: 'Liga no encontrada.' };
    }

    // Fetch caller membership
    const callerMember = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    const isAuthorized =
      session.user.isSuperadmin || (callerMember && callerMember.role === 'owner');

    if (!isAuthorized) {
      return { error: 'Solo el dueño de la liga o un Superadmin pueden archivarla.' };
    }

    const updatedLeague = await prisma.league.update({
      where: { id: leagueId },
      data: { status: archive ? 'archived' : 'active' },
    });

    revalidatePath('/liga');
    revalidatePath('/competencia');
    revalidatePath(`/liga/${updatedLeague.slug}`);
    revalidatePath(`/competencia/${updatedLeague.slug}`);
    revalidatePath('/admin/competencias');
    revalidatePath('/admin/ligas');
    return { data: updatedLeague };
  } catch (error) {
    console.error('Error in archiveLeagueAction:', error);
    return { error: 'Ocurrió un error al archivar la liga.' };
  }
}

/**
 * Deletes a league entirely (Owner or Superadmin only).
 */
export async function deleteLeagueAction(leagueId: string) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const userId = session.user.id;

  try {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return { error: 'Liga no encontrada.' };
    }

    // Fetch caller membership
    const callerMember = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    const isAuthorized =
      session.user.isSuperadmin || (callerMember && callerMember.role === 'owner');

    if (!isAuthorized) {
      return { error: 'Solo el dueño de la liga o un Superadmin pueden eliminarla.' };
    }

    await prisma.league.delete({
      where: { id: leagueId },
    });

    revalidatePath('/liga');
    revalidatePath('/competencia');
    revalidatePath('/admin/competencias');
    revalidatePath('/admin/ligas');
    return { success: true };
  } catch (error) {
    console.error('Error in deleteLeagueAction:', error);
    return { error: 'Ocurrió un error al eliminar la liga.' };
  }
}

export async function updateLeagueSettingsAction(
  leagueId: string,
  data: {
    name: string;
    isDefault?: boolean;
    isActive?: boolean;
    entryFee: number;
    currency: string;
    prizePoolOverride?: number | null;
    payoutRules?: string | null;
    autoJoin?: boolean;
    inviteEnabled?: boolean;
    championDeadline?: string | null;
    championPoints?: number;
    pointsExactScore?: number;
    pointsWinner?: number;
    pointsDraw?: number;
    pointsConsolation?: number;
    showOdds?: boolean;
    showH2H?: boolean;
    championTeamCode?: string | null;
  }
) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const userId = session.user.id;

  try {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return { error: 'Polla no encontrada.' };
    }

    // Verify caller is owner or admin of the league, or global Superadmin
    const callerMember = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    const isAuthorized =
      session.user.isSuperadmin ||
      (callerMember && (callerMember.role === 'owner' || callerMember.role === 'admin'));

    if (!isAuthorized) {
      return { error: 'No tienes permisos para configurar esta polla.' };
    }
    if (data.showOdds !== undefined && typeof data.showOdds !== 'boolean') {
      return { error: 'Configuración de odds inválida.' };
    }
    if (data.showH2H !== undefined && typeof data.showH2H !== 'boolean') {
      return { error: 'Configuración de historial inválida.' };
    }

    // Update league
    const updated = await prisma.league.update({
      where: { id: leagueId },
      data: {
        name: data.name.trim(),
        isDefault: data.isDefault ?? league.isDefault,
        isActive: data.isActive ?? league.isActive,
        entryFee: data.entryFee,
        currency: data.currency,
        prizePoolOverride: data.prizePoolOverride,
        payoutRules: data.payoutRules,
        autoJoin: data.autoJoin ?? league.autoJoin,
        inviteEnabled: data.inviteEnabled ?? league.inviteEnabled,
        championDeadline: data.championDeadline ? new Date(data.championDeadline) : null,
        championPoints: data.championPoints ?? league.championPoints,
        pointsExactScore: data.pointsExactScore ?? league.pointsExactScore,
        pointsWinner: data.pointsWinner ?? league.pointsWinner,
        pointsDraw: data.pointsDraw ?? league.pointsDraw,
        pointsConsolation: data.pointsConsolation ?? league.pointsConsolation,
        showOdds: data.showOdds ?? league.showOdds,
        showH2H: data.showH2H ?? league.showH2H,
        championTeamCode: data.championTeamCode,
      },
    });

    // If isDefault is set to true, we must unset it for all other leagues
    if (data.isDefault) {
      await prisma.league.updateMany({
        where: { id: { not: leagueId } },
        data: { isDefault: false },
      });
    }

    // Recalculate standings because rules or champion pick might have changed
    await recalculateAllStandings();

    revalidatePath('/liga');
    revalidatePath('/competencia');
    revalidatePath(`/liga/${updated.slug}`);
    revalidatePath(`/competencia/${updated.slug}`);
    revalidatePath('/admin/competencias');
    revalidatePath('/admin/ligas');
    revalidatePath('/admin');

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating league settings:', error);
    return { error: 'Error al guardar la configuración de la polla.' };
  }
}

/**
 * Direct add of a user to a league by a Superadmin or League Owner/Admin.
 */
export async function addMemberAction(leagueId: string, targetUserId: string) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado. Inicia sesión primero.' };
  }

  const userId = session.user.id;

  try {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      return { error: 'Competencia no encontrada.' };
    }

    // Verify caller has permissions (Superadmin or Owner/Admin of league)
    const callerMember = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });

    const isAuthorized =
      session.user.isSuperadmin ||
      (callerMember && (callerMember.role === 'owner' || callerMember.role === 'admin'));

    if (!isAuthorized) {
      return { error: 'No tienes permisos para agregar miembros.' };
    }

    // Check if target user is approved
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { status: true },
    });

    if (!targetUser || targetUser.status !== 'approved') {
      return { error: 'Solo se pueden agregar usuarios aprobados.' };
    }

    // Verify user is not already a member
    const existingMembership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId: targetUserId,
        },
      },
    });

    if (existingMembership) {
      return { error: 'El usuario ya es miembro de esta competencia.' };
    }

    // Create membership
    const membership = await prisma.leagueMember.create({
      data: {
        leagueId,
        userId: targetUserId,
        role: 'member',
        isParticipant: true,
      },
    });

    // Create Standing rows for the user in this league for all blocks
    // to ensure they are ranked.
    const blocks = ['groups', 'knockout', 'global'];
    for (const block of blocks) {
      await prisma.standing.upsert({
        where: {
          leagueId_userId_block: {
            leagueId,
            userId: targetUserId,
            block,
          },
        },
        update: {},
        create: {
          leagueId,
          userId: targetUserId,
          block,
          points: 0,
          exacts: 0,
          tendencies: 0,
          consolations: 0,
          misses: 0,
          rank: 0,
          previousRank: 0,
        },
      });
    }

    revalidatePath('/liga');
    revalidatePath('/competencia');
    revalidatePath(`/liga/${league.slug}`);
    revalidatePath(`/competencia/${league.slug}`);
    revalidatePath('/admin/competencias');
    revalidatePath('/admin/ligas');
    await recalculateAllStandings();

    return { success: true, data: membership };
  } catch (error) {
    console.error('Error in addMemberAction:', error);
    return { error: 'Ocurrió un error al agregar al participante.' };
  }
}
