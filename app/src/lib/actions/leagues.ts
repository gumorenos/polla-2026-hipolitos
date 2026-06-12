'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { revalidatePath } from 'next/cache';
import { recalculateAllStandings } from './admin';

/**
 * Creates a new private league. The creator automatically becomes the 'owner' member.
 */
export async function createLeagueAction(name: string) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado. Inicia sesión primero.' };
  }

  const userId = session.user.id;
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length < 3) {
    return { error: 'El nombre de la liga debe tener al menos 3 caracteres.' };
  }

  try {
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
        },
      });

      await tx.leagueMember.create({
        data: {
          leagueId: newLeague.id,
          userId,
          role: 'owner',
        },
      });

      return newLeague;
    });

    await prisma.adminActionLog.create({
      data: {
        userId,
        action: 'league_creation',
        target: `league:${league.id}`,
        details: JSON.stringify({ name: league.name }),
      },
    });

    revalidatePath('/liga');
    await recalculateAllStandings();
    return { data: league };
  } catch (error) {
    console.error('Error in createLeagueAction:', error);
    return { error: 'Ocurrió un error al crear la liga.' };
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
    // Find active league matching code
    const league = await prisma.league.findUnique({
      where: { inviteCode: cleanCode },
    });

    if (!league || league.status !== 'active') {
      return { error: 'Código de invitación inválido o la liga está inactiva.' };
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
      return { error: 'Ya eres miembro de esta liga.', slug: league.slug };
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
    revalidatePath(`/liga/${league.slug}`);
    await recalculateAllStandings();
    return { data: membership, slug: league.slug };
  } catch (error) {
    console.error('Error in joinLeagueAction:', error);
    return { error: 'Ocurrió un error al unirse a la liga.' };
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
  action: 'remove' | 'promote' | 'demote'
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

    if (action === 'remove') {
      await prisma.leagueMember.delete({
        where: { leagueId_userId: { leagueId, userId: targetUserId } },
      });
      await prisma.adminActionLog.create({
        data: {
          userId,
          action: 'member_removal',
          target: `user:${targetUserId}`,
          details: JSON.stringify({ leagueId }),
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
          details: JSON.stringify({ leagueId, newRole: 'admin' }),
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
          details: JSON.stringify({ leagueId, newRole: 'member' }),
        },
      });
    }

    revalidatePath(`/liga/${league.slug}`);
    return { success: true };
  } catch (error) {
    console.error('Error in manageMemberAction:', error);
    return { error: 'Ocurrió un error al gestionar al miembro.' };
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
    revalidatePath(`/liga/${updatedLeague.slug}`);
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
    revalidatePath('/admin/ligas');
    return { success: true };
  } catch (error) {
    console.error('Error in deleteLeagueAction:', error);
    return { error: 'Ocurrió un error al eliminar la liga.' };
  }
}
