'use server';

/**
 * app/src/lib/actions/match-pools.ts
 *
 * Server actions for "Retos por Partido" (Match Pool) competition.
 *
 * IMPORTANT — Money safety:
 *   No real money is processed, moved, or settled by these actions.
 *   All amounts are referential only ("monto referencial").
 *   Physical settlement happens outside the app.
 *
 * Rule: this file has 'use server' — only async functions may be exported.
 */

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { revalidatePath } from 'next/cache';
import {
  canCreateMatchPool,
  canJoinMatchPool,
  canInviteToMatchPool,
  authorizeMatchPoolMutation,
  isMatchPoolPickValid,
} from '../match-pool';
import type { EditMatchPoolInput, MatchPoolPickType, MatchPoolStatus } from '../match-pool';

async function isApprovedUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  return user?.status === 'approved';
}

// ─── Action: createMatchPoolAction ────────────────────────────────────────────

interface CreateMatchPoolInput {
  leagueId: string;
  matchId: string;
  amount: number;
  currency?: string;
  note?: string;
  pickType: MatchPoolPickType;
  pickValue: string;
}

/**
 * Creates a new match pool and adds the creator's first entry.
 *
 * - Any approved user can create a pool in an active Match Pool competition.
 * - Cannot create after kickoff.
 * - Amount must be a positive integer (referential only).
 * - First entry (creator) is automatically added.
 */
export async function createMatchPoolAction(
  input: CreateMatchPoolInput,
): Promise<{ data: { poolId: string } } | { error: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { error: 'No autorizado. Inicia sesión primero.' };
  const userId = session.user.id;

  try {
    if (!(await isApprovedUser(userId))) {
      return { error: 'Tu usuario debe estar aprobado para crear retos.' };
    }

    // Verify league competition type
    const league = await prisma.league.findUnique({
      where: { id: input.leagueId },
      select: {
        competitionType: true,
        currency: true,
        status: true,
        isActive: true,
        slug: true,
        matchPoolLateEntryEnabled: true,
        matchPoolLateEntryMinutes: true,
      },
    });
    if (!league) return { error: 'Competencia no encontrada.' };
    if (league.competitionType !== 'match_pool') {
      return { error: 'Los retos por partido solo están disponibles en competencias de tipo "Retos por Partido".' };
    }
    if (!league.isActive || league.status !== 'active') {
      return { error: 'Esta competencia no está activa.' };
    }

    // Verify match and kickoff
    const match = await prisma.match.findUnique({
      where: { id: input.matchId },
      select: {
        id: true,
        phase: true,
        homeTeamCode: true,
        awayTeamCode: true,
        kickoffUtc: true,
        status: true,
        resultStatus: true,
        homeScore: true,
        awayScore: true,
        winnerTeamCode: true,
      },
    });
    if (!match) return { error: 'Partido no encontrado.' };

    const now = new Date();
    if (!canCreateMatchPool(match, now, {
      enabled: league.matchPoolLateEntryEnabled,
      minutes: league.matchPoolLateEntryMinutes,
    })) {
      return { error: 'El plazo para crear retos de este partido ya terminó.' };
    }

    // Validate amount
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      return { error: 'El monto referencial debe ser un número entero positivo.' };
    }

    // Validate pick
    if (!isMatchPoolPickValid(match, input.pickType, input.pickValue)) {
      return { error: `El tipo de predicción '${input.pickType}' no es válido para este partido.` };
    }

    const currency = input.currency ?? league.currency ?? 'PEN';

    // Create pool and first entry in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const pool = await tx.matchPool.create({
        data: {
          leagueId: input.leagueId,
          matchId: input.matchId,
          createdByUserId: userId,
          amount: input.amount,
          currency,
          note: input.note ?? null,
          status: 'open',
        },
      });

      await tx.matchPoolEntry.create({
        data: {
          poolId: pool.id,
          userId,
          pickType: input.pickType,
          pickValue: input.pickValue,
          status: 'active',
        },
      });

      return pool;
    });

    try {
      revalidatePath('/');
      revalidatePath('/invitado');
      revalidatePath(`/liga/${league.slug}`);
    } catch {
      // Ignore revalidation errors outside request context
    }

    return { data: { poolId: result.id } };
  } catch (err) {
    console.error('Error in createMatchPoolAction:', err);
    return { error: 'Ocurrió un error al crear el reto.' };
  }
}

// ─── Action: joinMatchPoolAction ──────────────────────────────────────────────

interface JoinMatchPoolInput {
  poolId: string;
  pickType: MatchPoolPickType;
  pickValue: string;
}

/**
 * Joins an existing open match pool with a pick.
 *
 * - Any approved user can join a pool in an active Match Pool competition.
 * - Cannot join after kickoff.
 * - Cannot join twice (unique per user per pool).
 * - Cannot modify pool amount — uses the pool's fixed amount.
 */
export async function joinMatchPoolAction(
  input: JoinMatchPoolInput,
): Promise<{ data: { entryId: string } } | { error: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { error: 'No autorizado. Inicia sesión primero.' };
  const userId = session.user.id;

  try {
    const pool = await prisma.matchPool.findUnique({
      where: { id: input.poolId },
      include: {
        league: {
          select: {
            competitionType: true,
            status: true,
            isActive: true,
            slug: true,
            matchPoolLateEntryEnabled: true,
            matchPoolLateEntryMinutes: true,
          },
        },
        match: {
          select: {
            id: true,
            phase: true,
            homeTeamCode: true,
            awayTeamCode: true,
            kickoffUtc: true,
            status: true,
            resultStatus: true,
            homeScore: true,
            awayScore: true,
            winnerTeamCode: true,
          },
        },
      },
    });

    if (!pool) return { error: 'Reto no encontrado.' };
    if (!pool.match) return { error: 'Partido del reto no encontrado.' };
    if (!(await isApprovedUser(userId))) {
      return { error: 'Tu usuario debe estar aprobado para unirte a retos.' };
    }
    if (pool.league.competitionType !== 'match_pool' || !pool.league.isActive || pool.league.status !== 'active') {
      return { error: 'Esta competencia de Retos por Partido no está activa.' };
    }

    const matchCtx = {
      ...pool.match,
      kickoffUtc: pool.match.kickoffUtc,
      resultStatus: pool.match.resultStatus,
      homeScore: pool.match.homeScore,
      awayScore: pool.match.awayScore,
      winnerTeamCode: pool.match.winnerTeamCode,
    };

    const now = new Date();
    if (!canJoinMatchPool({ status: pool.status as 'open' }, matchCtx, now, {
      enabled: pool.league.matchPoolLateEntryEnabled,
      minutes: pool.league.matchPoolLateEntryMinutes,
    })) {
      return { error: 'No puedes unirte a este reto. Puede estar cerrado o ya haber empezado el partido.' };
    }

    // Check existing entry
    const existingEntry = await prisma.matchPoolEntry.findUnique({
      where: { poolId_userId: { poolId: input.poolId, userId } },
    });
    if (existingEntry) {
      return { error: 'Ya tienes una predicción en este reto.' };
    }

    // Validate pick
    if (!isMatchPoolPickValid(matchCtx, input.pickType, input.pickValue)) {
      return { error: `El tipo de predicción '${input.pickType}' no es válido para este partido.` };
    }

    const entry = await prisma.$transaction(async (tx) => {
      const createdEntry = await tx.matchPoolEntry.create({
        data: {
          poolId: input.poolId,
          userId,
          pickType: input.pickType,
          pickValue: input.pickValue,
          status: 'active',
        },
      });
      await tx.matchPoolInvite.updateMany({
        where: { poolId: input.poolId, invitedUserId: userId, status: 'pending' },
        data: { status: 'accepted', respondedAt: new Date() },
      });
      return createdEntry;
    });

    try {
      revalidatePath('/');
      revalidatePath('/invitado');
      revalidatePath(`/liga/${pool.league.slug}`);
    } catch {
      // Ignore
    }

    return { data: { entryId: entry.id } };
  } catch (err) {
    console.error('Error in joinMatchPoolAction:', err);
    return { error: 'Ocurrió un error al unirte al reto.' };
  }
}

// ─── Action: inviteToMatchPoolAction ──────────────────────────────────────────

interface InviteToMatchPoolInput {
  poolId: string;
  invitedUserId: string;
  message?: string;
}

/**
 * Invites an approved user to join a match pool.
 *
 * - Inviter and invited user must be approved.
 * - Cannot invite after kickoff.
 * - Cannot invite someone already invited (unique constraint).
 * - Unaccepted invites do not count as entries.
 */
export async function inviteToMatchPoolAction(
  input: InviteToMatchPoolInput,
): Promise<{ data: { inviteId: string } } | { error: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { error: 'No autorizado. Inicia sesión primero.' };
  const userId = session.user.id;

  if (userId === input.invitedUserId) {
    return { error: 'No puedes invitarte a ti mismo.' };
  }

  try {
    const pool = await prisma.matchPool.findUnique({
      where: { id: input.poolId },
      include: {
        league: {
          select: {
            competitionType: true,
            status: true,
            isActive: true,
            slug: true,
            matchPoolLateEntryEnabled: true,
            matchPoolLateEntryMinutes: true,
          },
        },
        match: {
          select: {
            id: true,
            phase: true,
            homeTeamCode: true,
            awayTeamCode: true,
            kickoffUtc: true,
            status: true,
            resultStatus: true,
            homeScore: true,
            awayScore: true,
            winnerTeamCode: true,
          },
        },
      },
    });

    if (!pool) return { error: 'Reto no encontrado.' };
    if (!pool.match) return { error: 'Partido del reto no encontrado.' };
    if (pool.league.competitionType !== 'match_pool' || !pool.league.isActive || pool.league.status !== 'active') {
      return { error: 'Esta competencia de Retos por Partido no está activa.' };
    }

    const matchCtx = {
      ...pool.match,
      resultStatus: pool.match.resultStatus,
      homeScore: pool.match.homeScore,
      awayScore: pool.match.awayScore,
      winnerTeamCode: pool.match.winnerTeamCode,
    };

    const now = new Date();
    if (!canInviteToMatchPool({ status: pool.status as 'open' }, matchCtx, now, {
      enabled: pool.league.matchPoolLateEntryEnabled,
      minutes: pool.league.matchPoolLateEntryMinutes,
    })) {
      return { error: 'No se puede enviar invitaciones a este reto.' };
    }

    if (!(await isApprovedUser(userId))) {
      return { error: 'Tu usuario debe estar aprobado para enviar invitaciones.' };
    }

    if (!(await isApprovedUser(input.invitedUserId))) {
      return { error: 'El usuario invitado debe estar aprobado.' };
    }

    // Upsert invite (idempotent re-invite resets to pending)
    const existing = await prisma.matchPoolInvite.findUnique({
      where: { poolId_invitedUserId: { poolId: input.poolId, invitedUserId: input.invitedUserId } },
    });

    let invite;
    if (existing) {
      if (existing.status === 'accepted') {
        return { error: 'El usuario ya aceptó la invitación.' };
      }
      invite = await prisma.matchPoolInvite.update({
        where: { id: existing.id },
        data: {
          invitedByUserId: userId,
          status: 'pending',
          message: input.message ?? existing.message,
          respondedAt: null,
        },
      });
    } else {
      invite = await prisma.matchPoolInvite.create({
        data: {
          poolId: input.poolId,
          invitedUserId: input.invitedUserId,
          invitedByUserId: userId,
          status: 'pending',
          message: input.message ?? null,
        },
      });
    }

    try {
      revalidatePath(`/liga/${pool.league.slug}`);
    } catch {
      // Ignore revalidation errors outside request context
    }

    return { data: { inviteId: invite.id } };
  } catch (err) {
    console.error('Error in inviteToMatchPoolAction:', err);
    return { error: 'Ocurrió un error al enviar la invitación.' };
  }
}

// ─── Action: cancelMatchPoolAction ────────────────────────────────────────────

interface CancelMatchPoolInput {
  poolId: string;
  reason?: string;
}

/**
 * Updates a reto while preserving its identity and entries.
 */
export async function updateMatchPoolAction(
  input: EditMatchPoolInput,
): Promise<{ data: { poolId: string } } | { error: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { error: 'No autorizado. Inicia sesión primero.' };
  const userId = session.user.id;

  try {
    const [user, pool, match] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, isSuperadmin: true },
      }),
      prisma.matchPool.findUnique({
        where: { id: input.poolId },
        include: {
          league: { select: { slug: true, competitionType: true, status: true, isActive: true } },
          entries: { select: { id: true, userId: true, pickType: true, pickValue: true } },
        },
      }),
      prisma.match.findUnique({
        where: { id: input.matchId },
        select: {
          id: true,
          phase: true,
          homeTeamCode: true,
          awayTeamCode: true,
        },
      }),
    ]);

    if (!pool) return { error: 'Reto no encontrado.' };
    if (!match) return { error: 'Partido no encontrado.' };
    if (!user || (user.status !== 'approved' && !user.isSuperadmin)) {
      return { error: 'Tu usuario debe estar aprobado para editar retos.' };
    }
    if (pool.league.competitionType !== 'match_pool' || !pool.league.isActive || pool.league.status !== 'active') {
      return { error: 'Esta competencia de Retos por Partido no está activa.' };
    }

    const decision = authorizeMatchPoolMutation({
      status: pool.status as MatchPoolStatus,
      createdByUserId: pool.createdByUserId,
      currentUserId: userId,
      entryUserIds: pool.entries.map((entry) => entry.userId),
      isSuperadmin: user.isSuperadmin,
      reason: input.reason,
    });
    if (!decision.allowed) return { error: decision.error ?? 'No puedes editar este reto.' };

    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      return { error: 'El monto referencial debe ser un número entero positivo.' };
    }
    const currency = input.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      return { error: 'La moneda debe usar un código de tres letras, por ejemplo PEN.' };
    }
    if (!isMatchPoolPickValid(match, input.pickType, input.pickValue)) {
      return { error: 'La predicción del creador no es válida para el partido seleccionado.' };
    }
    const incompatibleEntry = pool.entries.find((entry) => (
      entry.userId !== pool.createdByUserId
      && !isMatchPoolPickValid(
        match,
        entry.pickType as MatchPoolPickType,
        entry.pickValue,
      )
    ));
    if (incompatibleEntry) {
      return { error: 'El nuevo partido no es compatible con las predicciones ya registradas.' };
    }

    const creatorEntry = pool.entries.find((entry) => entry.userId === pool.createdByUserId);
    if (!creatorEntry) return { error: 'No se encontró la predicción del creador.' };

    const before = {
      matchId: pool.matchId,
      amount: pool.amount,
      currency: pool.currency,
      note: pool.note,
      creatorPickType: creatorEntry.pickType,
      creatorPickValue: creatorEntry.pickValue,
    };
    const after = {
      matchId: match.id,
      amount: input.amount,
      currency,
      note: input.note?.trim() || null,
      creatorPickType: input.pickType,
      creatorPickValue: input.pickValue,
    };

    await prisma.$transaction(async (tx) => {
      await tx.matchPool.update({
        where: { id: pool.id },
        data: {
          matchId: match.id,
          amount: input.amount,
          currency,
          note: after.note,
        },
      });
      await tx.matchPoolEntry.update({
        where: { id: creatorEntry.id },
        data: { pickType: input.pickType, pickValue: input.pickValue },
      });
      if (decision.requiresAudit) {
        await tx.adminActionLog.create({
          data: {
            userId,
            action: 'match_pool_edit',
            target: `match_pool:${pool.id}`,
            details: JSON.stringify({ before, after, reason: input.reason?.trim() }),
          },
        });
      }
    });

    revalidatePath('/');
    revalidatePath('/invitado');
    revalidatePath(`/liga/${pool.league.slug}`);
    revalidatePath(`/competencia/${pool.league.slug}`);
    return { data: { poolId: pool.id } };
  } catch (err) {
    console.error('Error in updateMatchPoolAction:', err);
    return { error: 'Ocurrió un error al editar el reto.' };
  }
}

/** Logically cancels a reto. Normal creators may only cancel their one-entry open reto. */
export async function cancelMatchPoolAction(
  input: CancelMatchPoolInput,
): Promise<{ data: { poolId: string } } | { error: string }> {
  const session = await getCurrentSession();
  if (!session?.user) return { error: 'No autorizado. Inicia sesión primero.' };
  const userId = session.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, isSuperadmin: true },
    });

    const pool = await prisma.matchPool.findUnique({
      where: { id: input.poolId },
      include: {
        league: {
          select: { slug: true, competitionType: true, status: true, isActive: true },
        },
        entries: { select: { userId: true } },
      },
    });

    if (!pool) return { error: 'Reto no encontrado.' };

    if (!user || (user.status !== 'approved' && !user.isSuperadmin)) {
      return { error: 'Tu usuario debe estar aprobado para cancelar retos.' };
    }
    if (pool.league.competitionType !== 'match_pool' || !pool.league.isActive || pool.league.status !== 'active') {
      return { error: 'Esta competencia de Retos por Partido no está activa.' };
    }

    const decision = authorizeMatchPoolMutation({
      status: pool.status as MatchPoolStatus,
      createdByUserId: pool.createdByUserId,
      currentUserId: userId,
      entryUserIds: pool.entries.map((entry) => entry.userId),
      isSuperadmin: user.isSuperadmin,
      reason: input.reason,
    });
    if (!decision.allowed) return { error: decision.error ?? 'No puedes cancelar este reto.' };

    const reason = input.reason?.trim() || 'Cancelado por el creador antes de recibir otras entradas.';
    await prisma.$transaction(async (tx) => {
      await tx.matchPool.update({
        where: { id: pool.id },
        data: {
          status: 'cancelled',
          settlementReason: reason,
          settledAt: new Date(),
        },
      });
      await tx.matchPoolEntry.updateMany({
        where: { poolId: pool.id },
        data: { status: 'cancelled' },
      });
      if (decision.requiresAudit) {
        await tx.adminActionLog.create({
          data: {
            userId,
            action: 'match_pool_cancel',
            target: `match_pool:${pool.id}`,
            details: JSON.stringify({
              before: { status: pool.status, entryCount: pool.entries.length },
              after: { status: 'cancelled' },
              reason,
            }),
          },
        });
      }
    });

    try {
      revalidatePath('/');
      revalidatePath('/invitado');
      revalidatePath(`/liga/${pool.league.slug}`);
      revalidatePath(`/competencia/${pool.league.slug}`);
    } catch {
      // Ignore
    }

    return { data: { poolId: pool.id } };
  } catch (err) {
    console.error('Error in cancelMatchPoolAction:', err);
    return { error: 'Ocurrió un error al cancelar el reto.' };
  }
}
