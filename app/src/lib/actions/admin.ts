'use server';

import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { getCurrentSession } from '../auth-helpers';
import { calculatePoints } from '../scoring/calculatePoints';
import { revalidatePath } from 'next/cache';
import { auth } from '../auth';
import { randomUUID } from 'crypto';
import { isConsistentFinalMatchResult, normalizeFinalMatchResult } from '../match-result';
import { applyKnockoutProgressionAndSurvivorSync } from '../knockout-propagation-service';
import { recalculateAllStandings } from '../services/standings';
import { OFFICIAL_KNOCKOUT_SCHEDULE } from '../official-knockout-schedule';
import { settleMatchPoolsForFinalMatch } from '../services/match-pool-settlement';

type AdminUserType = 'participant' | 'admin' | 'superadmin';

const ownedLeagueSelect = {
  id: true,
  name: true,
  slug: true,
  competitionType: true,
} satisfies Prisma.LeagueSelect;

const adminUserInclude = Prisma.validator<Prisma.UserInclude>()({
  leaguesOwned: {
    select: ownedLeagueSelect,
  },
  memberships: {
    include: {
      league: {
        select: {
          id: true,
          name: true,
          competitionType: true,
        },
      },
    },
  },
  winnerPredictions: {
    include: {
      league: {
        select: {
          id: true,
          name: true,
          competitionType: true,
        },
      },
      team: {
        select: {
          name: true,
        },
      },
    },
  },
  winnerPredictionHistories: {
    include: {
      league: {
        select: {
          name: true,
          competitionType: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
  _count: {
    select: {
      predictions: true,
    },
  },
});

function getAdminUserTypeFlags(userType: AdminUserType) {
  if (userType === 'superadmin') {
    return { isSuperadmin: true, canCreateLeagues: true };
  }
  if (userType === 'admin') {
    return { isSuperadmin: false, canCreateLeagues: true };
  }
  return { isSuperadmin: false, canCreateLeagues: false };
}

function parseAdminUserType(userType: string | undefined): AdminUserType | null {
  if (!userType) return 'participant';
  if (userType === 'participant' || userType === 'admin' || userType === 'superadmin') {
    return userType;
  }
  return null;
}

async function upsertPasswordAccounts(
  tx: Prisma.TransactionClient,
  userId: string,
  email: string,
  hashedPassword: string
) {
  const now = new Date();
  const existingAccounts = await tx.account.findMany({
    where: {
      userId,
      providerId: { in: ['credential', 'email'] },
    },
  });

  const credentialAccount = existingAccounts.find((account) => account.providerId === 'credential');
  if (credentialAccount) {
    await tx.account.update({
      where: { id: credentialAccount.id },
      data: {
        accountId: userId,
        password: hashedPassword,
        updatedAt: now,
      },
    });
  } else {
    await tx.account.create({
      data: {
        id: `acc-credential-${randomUUID()}`,
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  const emailAccount = existingAccounts.find((account) => account.providerId === 'email');
  if (emailAccount) {
    await tx.account.update({
      where: { id: emailAccount.id },
      data: {
        accountId: email,
        password: hashedPassword,
        updatedAt: now,
      },
    });
  } else {
    await tx.account.create({
      data: {
        id: `acc-email-${randomUUID()}`,
        accountId: email,
        providerId: 'email',
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

async function syncEmailPasswordAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  email: string
) {
  await tx.account.updateMany({
    where: { userId, providerId: 'email' },
    data: { accountId: email, updatedAt: new Date() },
  });
}

async function ensureCredentialPasswordAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  email: string
) {
  const existingAccounts = await tx.account.findMany({
    where: {
      userId,
      providerId: { in: ['credential', 'email'] },
    },
  });
  const emailAccount = existingAccounts.find((account) => account.providerId === 'email');
  if (!emailAccount?.password) return;

  const credentialAccount = existingAccounts.find((account) => account.providerId === 'credential');
  if (credentialAccount) {
    await tx.account.update({
      where: { id: credentialAccount.id },
      data: {
        accountId: userId,
        password: emailAccount.password,
        updatedAt: new Date(),
      },
    });
  } else {
    await tx.account.create({
      data: {
        id: `acc-credential-${randomUUID()}`,
        accountId: userId,
        providerId: 'credential',
        userId,
        password: emailAccount.password,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  if (emailAccount.accountId !== email) {
    await tx.account.update({
      where: { id: emailAccount.id },
      data: { accountId: email, updatedAt: new Date() },
    });
  }
}

async function getAdminUserSnapshot(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: adminUserInclude,
  });
}

export async function updateMatchResultInternal(
  matchId: string,
  homeScore: number,
  awayScore: number,
  knockoutDetails?: {
    wentToExtraTime?: boolean;
    wentToPenalties?: boolean;
    homePenaltyScore?: number | null;
    awayPenaltyScore?: number | null;
    winnerTeamCode?: string | null;
    allowWinnerWithoutPenaltyScore?: boolean;
    resultStatus?: string | null;
    resultNotes?: string | null;
    resultSource?: string | null;
  },
  actingUserId?: string
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId }
  });

  if (!match) {
    return { error: 'Partido no encontrado' };
  }

  const isKnockout = match.phase !== 'groups';
  const normalizedResult = normalizeFinalMatchResult({
    phase: match.phase,
    homeTeamCode: match.homeTeamCode,
    awayTeamCode: match.awayTeamCode,
    homeScore,
    awayScore,
    wentToExtraTime: knockoutDetails?.wentToExtraTime,
    wentToPenalties: knockoutDetails?.wentToPenalties,
    homePenaltyScore: knockoutDetails?.homePenaltyScore,
    awayPenaltyScore: knockoutDetails?.awayPenaltyScore,
    winnerTeamCode: knockoutDetails?.winnerTeamCode,
    allowWinnerWithoutPenaltyScore: knockoutDetails?.allowWinnerWithoutPenaltyScore,
  });
  if (!normalizedResult.valid) {
    return { error: normalizedResult.error };
  }
  const finalResult = normalizedResult.result;

  let logUserId = actingUserId;
  if (!logUserId) {
    const superadmin = await prisma.user.findFirst({
      where: { isSuperadmin: true }
    });
    if (superadmin) {
      logUserId = superadmin.id;
    } else {
      const anyUser = await prisma.user.findFirst();
      if (anyUser) {
        logUserId = anyUser.id;
      }
    }
  }

  // Update the match
  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore,
      awayScore,
      status: finalResult.status,
      resultStatus: finalResult.resultStatus,
      wentToExtraTime: finalResult.wentToExtraTime,
      wentToPenalties: finalResult.wentToPenalties,
      homePenaltyScore: finalResult.homePenaltyScore,
      awayPenaltyScore: finalResult.awayPenaltyScore,
      winnerTeamCode: finalResult.winnerTeamCode,
      resultSource: knockoutDetails?.resultSource || null,
      resultNotes: knockoutDetails?.resultNotes || null,
      resultFetchedAt: knockoutDetails?.resultSource && knockoutDetails.resultSource !== 'manual_admin'
        ? new Date()
        : null,
      resultUpdatedAt: new Date(),
      resultVerifiedById: actingUserId || null,
    },
  });

  // Fetch all predictions for this match
  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    include: { league: true },
  });

  const transaction = [];

  if (logUserId) {
    transaction.push(prisma.adminActionLog.create({
      data: {
        userId: logUserId,
        action: actingUserId ? 'update_match_result' : 'system_update_match_result',
        target: `match:${matchId}`,
        details: JSON.stringify({ 
          homeScore, 
          awayScore, 
          wentToExtraTime: finalResult.wentToExtraTime,
          wentToPenalties: finalResult.wentToPenalties,
          homePenaltyScore: finalResult.homePenaltyScore,
          awayPenaltyScore: finalResult.awayPenaltyScore,
          winnerTeamCode: finalResult.winnerTeamCode,
          resultSource: knockoutDetails?.resultSource || null,
        }),
      }
    }));
  }

  // Update predictions
  for (const pred of predictions) {
    const result = calculatePoints(
      { homePrediction: pred.homePrediction, awayPrediction: pred.awayPrediction },
      { 
        homeScore, 
        awayScore,
        winnerTeamCode: finalResult.winnerTeamCode,
        homeTeamCode: match.homeTeamCode,
        awayTeamCode: match.awayTeamCode,
        isKnockout
      },
      {
        pointsExactScore: pred.league.pointsExactScore,
        pointsWinner: pred.league.pointsWinner,
        pointsDraw: pred.league.pointsDraw,
        pointsConsolation: pred.league.pointsConsolation,
        knockoutOutcomeBasis: pred.league.knockoutOutcomeBasis,
      }
    );

    transaction.push(prisma.prediction.update({
      where: { id: pred.id },
      data: {
        pointsEarned: result.points,
        scoreType: result.type,
      }
    }));
  }

  await prisma.$transaction(transaction);

  return await runPostFinalResultPipeline(matchId, logUserId);
}

export async function runPostFinalResultPipeline(matchId: string, actingUserId?: string) {
  // Now recalculate standings for all users
  await recalculateAllStandings();

  let logUserId = actingUserId;
  if (!logUserId) {
    const superadmin = await prisma.user.findFirst({
      where: { isSuperadmin: true }
    });
    if (superadmin) {
      logUserId = superadmin.id;
    } else {
      const anyUser = await prisma.user.findFirst();
      if (anyUser) {
        logUserId = anyUser.id;
      }
    }
  }

  let progressionWarning: string | null = null;
  try {
    const progression = await applyKnockoutProgressionAndSurvivorSync(logUserId);
    if (progression.conflicts.length > 0) {
      progressionWarning = progression.conflicts.join(' ');
    }
  } catch (error) {
    progressionWarning = error instanceof Error
      ? `El resultado se guardó, pero no se pudo sincronizar el torneo: ${error.message}`
      : 'El resultado se guardó, pero no se pudo sincronizar el torneo.';
  }

  // Settle match pools — non-fatal, failure appends to progressionWarning only
  try {
    const poolSettlement = await settleMatchPoolsForFinalMatch(matchId);
    if (poolSettlement.warnings.length > 0) {
      const poolWarning = poolSettlement.warnings.join(' ');
      progressionWarning = progressionWarning
        ? `${progressionWarning} ${poolWarning}`
        : poolWarning;
    }
  } catch (error) {
    const poolError = error instanceof Error ? error.message : 'Error desconocido';
    const warn = `Las bolsas se guardaron pero no se pudieron liquidar automáticamente: ${poolError}`;
    progressionWarning = progressionWarning ? `${progressionWarning} ${warn}` : warn;
  }

  try {
    revalidatePath('/admin/resultados');
    revalidatePath('/admin/partidos');
    revalidatePath('/pronosticos');
    revalidatePath('/ranking');
    revalidatePath('/admin/supervivencia');
    revalidatePath('/');
    revalidatePath('/invitado');
  } catch {
    // revalidatePath fails outside of requests, ignore in CLI
  }

  return { success: true, progressionWarning };
}

export async function updateMatchResultAction(
  matchId: string,
  homeScore: number,
  awayScore: number,
  knockoutDetails?: {
    wentToExtraTime?: boolean;
    wentToPenalties?: boolean;
    homePenaltyScore?: number | null;
    awayPenaltyScore?: number | null;
    winnerTeamCode?: string | null;
    resultStatus?: string | null;
    resultNotes?: string | null;
  }
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (homeScore < 0 || awayScore < 0) {
      return { error: 'Los marcadores deben ser números positivos' };
    }

    return await updateMatchResultInternal(matchId, homeScore, awayScore, {
      ...knockoutDetails,
      resultStatus: 'final',
      resultSource: 'manual_admin',
      resultNotes: knockoutDetails?.resultNotes || 'Resultado final ingresado manualmente por administrador.',
    }, user.id);
  } catch (error) {
    console.error('Error updating match result action:', error);
    return { error: 'Ocurrió un error al actualizar el resultado' };
  }
}


export async function manuallyRecalculateStandingsAction() {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    await recalculateAllStandings();

    await prisma.adminActionLog.create({
      data: {
        userId: user.id,
        action: 'ranking_recalculation',
        target: 'all_leagues',
        details: 'Manual standings recalculation triggered.',
      },
    });

    revalidatePath('/admin/resultados');
    revalidatePath('/admin/partidos');
    revalidatePath('/pronosticos');
    revalidatePath('/ranking');

    return { success: true };
  } catch (error) {
    console.error('Error in manuallyRecalculateStandingsAction:', error);
    return { error: 'Ocurrió un error al recalcular las clasificaciones' };
  }
}

export async function updateMatchDetailsAction(
  matchId: string,
  data: {
    kickoffUtc: string;
    venue: string;
    city: string;
    status: string;
    group: string | null;
    jornada: string;
    phase: string;
  }
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    // Validate inputs
    if (!data.venue.trim() || !data.city.trim() || !data.jornada.trim() || !data.phase.trim() || !data.status.trim()) {
      return { error: 'Todos los campos excepto grupo son obligatorios' };
    }

    const parsedDate = new Date(data.kickoffUtc);
    if (isNaN(parsedDate.getTime())) {
      return { error: 'Fecha de kickoff inválida' };
    }

    const existingMatch = await prisma.match.findUnique({ where: { id: matchId } });
    if (!existingMatch) {
      return { error: 'Partido no encontrado' };
    }
    if (data.status === 'result' && !isConsistentFinalMatchResult(existingMatch)) {
      return { error: 'No puedes marcar el partido como result sin guardar primero un marcador final completo.' };
    }
    if (data.status !== 'result' && isConsistentFinalMatchResult(existingMatch)) {
      return { error: 'Un resultado final debe modificarse desde Ingresar Resultados, no desde la programación del partido.' };
    }

    // Update match scheduling metadata without bypassing result invariants.
    await prisma.match.update({
      where: { id: matchId },
      data: {
        kickoffUtc: parsedDate,
        venue: data.venue.trim(),
        city: data.city.trim(),
        status: data.status,
        group: data.group ? data.group.trim() : null,
        jornada: data.jornada.trim(),
        phase: data.phase,
      },
    });

    // Write audit log
    await prisma.adminActionLog.create({
      data: {
        userId: user.id,
        action: 'edit_match',
        target: `match:${matchId}`,
        details: JSON.stringify(data),
      },
    });

    revalidatePath('/admin/partidos');
    revalidatePath('/admin/resultados');
    revalidatePath('/pronosticos');

    return { success: true };
  } catch (error) {
    console.error('Error updating match details:', error);
    return { error: 'Ocurrió un error al actualizar el partido' };
  }
}

export async function toggleUserSuperadminAction(targetUserId: string, isSuperadmin: boolean, reason?: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.status !== 'approved' || !user.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (targetUserId === user.id) {
      if (!isSuperadmin) {
        const otherActiveSuperadmins = await prisma.user.count({
          where: {
            isSuperadmin: true,
            status: 'approved',
            NOT: { id: user.id }
          }
        });
        if (otherActiveSuperadmins === 0) {
          return { error: 'No puedes quitarte el rol de superadministrador a ti mismo porque eres el único superadministrador activo.' };
        }
      }
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { isSuperadmin },
    });

    // Write audit log
    await prisma.adminActionLog.create({
      data: {
        userId: user.id,
        action: 'toggle_superadmin',
        target: `user:${targetUserId}`,
        details: JSON.stringify({ isSuperadmin, reason }),
      },
    });

    revalidatePath('/admin/usuarios');
    return { success: true };
  } catch (error) {
    console.error('Error toggling superadmin status:', error);
    return { error: 'Ocurrió un error al modificar los permisos del usuario' };
  }
}

export async function updateUserStatusAction(targetUserId: string, status: string, reason?: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser || adminUser.status !== 'approved' || !adminUser.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (targetUserId === adminUser.id) {
      if (status !== 'approved') {
        const otherActiveSuperadmins = await prisma.user.count({
          where: {
            isSuperadmin: true,
            status: 'approved',
            NOT: { id: adminUser.id }
          }
        });
        if (otherActiveSuperadmins === 0) {
          return { error: 'No puedes desactivar o rechazar tu propio usuario porque eres el único superadministrador activo.' };
        }
      }
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'disabled'];
    if (!validStatuses.includes(status)) {
      return { error: 'Estado inválido' };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true },
    });
    if (!targetUser) {
      return { error: 'Usuario no encontrado' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { status },
      });
      await ensureCredentialPasswordAccount(tx, targetUserId, targetUser.email);
    });

    // Audit action mapping
    let auditAction = 'user_status_update';
    if (status === 'approved') auditAction = 'user_approved';
    if (status === 'rejected') auditAction = 'user_rejected';
    if (status === 'disabled') auditAction = 'user_disabled';

    await prisma.adminActionLog.create({
      data: {
        userId: adminUser.id,
        action: auditAction,
        target: `user:${targetUserId}`,
        details: JSON.stringify({ status, reason }),
      },
    });

    // Auto-join to pools if approved
    if (status === 'approved') {
      const autoJoinLeagues = await prisma.league.findMany({
        where: { autoJoin: true, isActive: true },
      });
      for (const lg of autoJoinLeagues) {
        const existing = await prisma.leagueMember.findUnique({
          where: { leagueId_userId: { leagueId: lg.id, userId: targetUserId } }
        });
        if (!existing) {
          await prisma.leagueMember.create({
            data: {
              leagueId: lg.id,
              userId: targetUserId,
              role: 'member',
            }
          });
        }
      }
      if (autoJoinLeagues.length > 0) {
        await recalculateAllStandings();
      }
    }

    revalidatePath('/admin/usuarios');
    revalidatePath('/admin');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error in updateUserStatusAction:', error);
    return { error: 'Ocurrió un error al actualizar el estado del usuario' };
  }
}

export async function adminCreateUserAction(data: {
  username: string;
  name: string;
  passwordText: string;
  email?: string;
  whatsapp?: string;
  status: string;
  leagueIds?: string[];
  userType?: AdminUserType;
}) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    const usernameLower = data.username.trim().toLowerCase();
    if (!usernameLower) {
      return { error: 'El nombre de usuario es obligatorio' };
    }
    if (!/^[a-z0-9_.-]+$/.test(usernameLower)) {
      return { error: 'El nombre de usuario solo puede contener letras, números, guiones, puntos y guiones bajos' };
    }
    if (!data.name.trim()) {
      return { error: 'El nombre completo es obligatorio' };
    }
    if (!data.passwordText || data.passwordText.length < 6) {
      return { error: 'La contraseña temporal debe tener al menos 6 caracteres.' };
    }
    const validStatuses = ['pending', 'approved', 'rejected', 'disabled'];
    if (!validStatuses.includes(data.status)) {
      return { error: 'Estado inválido' };
    }
    const parsedUserType = parseAdminUserType(data.userType);
    if (!parsedUserType) {
      return { error: 'Selecciona un tipo de usuario válido.' };
    }
    const roleFlags = getAdminUserTypeFlags(parsedUserType);

    const existingUser = await prisma.user.findUnique({
      where: { username: usernameLower },
    });
    if (existingUser) {
      return { error: 'El nombre de usuario ya existe.' };
    }

    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(data.passwordText);
    const email = (data.email?.trim() || `${usernameLower}@polla.local`).toLowerCase();

    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return { error: 'El correo electrónico ya está registrado' };
    }

    const selectedLeagueIds = Array.from(new Set(data.leagueIds ?? []));
    if (selectedLeagueIds.length > 0) {
      const activeLeagues = await prisma.league.findMany({
        where: { id: { in: selectedLeagueIds }, isActive: true },
        select: { id: true },
      });
      if (activeLeagues.length !== selectedLeagueIds.length) {
        return { error: 'Una o más competencias seleccionadas no están disponibles.' };
      }
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: data.name.trim(),
          username: usernameLower,
          displayUsername: usernameLower,
          displayName: data.name.trim(),
          email: email,
          emailVerified: true,
          whatsapp: data.whatsapp?.trim() || null,
          status: data.status,
          isSuperadmin: roleFlags.isSuperadmin,
          canCreateLeagues: roleFlags.canCreateLeagues,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await upsertPasswordAccounts(tx, u.id, email, hashedPassword);

      for (const leagueId of selectedLeagueIds) {
        await tx.leagueMember.create({
          data: {
            leagueId,
            userId: u.id,
            role: 'member',
            isParticipant: true,
          }
        });

        for (const block of ['groups', 'knockout', 'global']) {
          await tx.standing.upsert({
            where: {
              leagueId_userId_block: {
                leagueId,
                userId: u.id,
                block,
              },
            },
            update: {},
            create: {
              leagueId,
              userId: u.id,
              block,
              points: 0,
              exacts: 0,
              tendencies: 0,
              consolations: 0,
              misses: 0,
              rank: 1,
              previousRank: 1,
            },
          });
        }
      }
      return u;
    });

    await prisma.adminActionLog.create({
      data: {
        userId: adminUser.id,
        action: 'user_created_by_admin',
        target: `user:${newUser.id}`,
        details: JSON.stringify({ username: usernameLower, status: data.status, userType: parsedUserType, leagueIds: selectedLeagueIds }),
      },
    });

    revalidatePath('/admin/usuarios');
    revalidatePath('/admin');
    const userSnapshot = await getAdminUserSnapshot(newUser.id);
    return { success: true, user: userSnapshot };
  } catch (error) {
    console.error('Error in adminCreateUserAction:', error);
    return { error: 'Ocurrió un error al crear el usuario administrativamente' };
  }
}

export async function updateAppSettingAction(key: string, value: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    await prisma.appSettings.upsert({
      where: { key },
      update: { value, updatedAt: new Date(), updatedById: user.id },
      create: { key, value, updatedById: user.id },
    });

    return { success: true };
  } catch (error) {
    console.error(`Error updating setting ${key}:`, error);
    return { error: 'Ocurrió un error al actualizar la configuración' };
  }
}

export async function adminUpdateUserAction(
  targetUserId: string,
  data: {
    name?: string;
    username?: string;
    email?: string;
    whatsapp?: string;
    status?: string;
    isSuperadmin?: boolean;
    canCreateLeagues?: boolean;
    passwordText?: string;
    remindersEnabled?: boolean;
    emailRemindersEnabled?: boolean;
    reminderEmail?: string;
    themeMode?: string;
    leagueIds?: string[];
  },
  reason?: string
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser || adminUser.status !== 'approved' || !adminUser.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (targetUserId === adminUser.id) {
      if (data.isSuperadmin === false) {
        const otherActiveSuperadmins = await prisma.user.count({
          where: {
            isSuperadmin: true,
            status: 'approved',
            NOT: { id: adminUser.id }
          }
        });
        if (otherActiveSuperadmins === 0) {
          return { error: 'No puedes quitarte el rol de superadministrador a ti mismo porque eres el único superadministrador activo.' };
        }
      }
      if (data.status && data.status !== 'approved') {
        const otherActiveSuperadmins = await prisma.user.count({
          where: {
            isSuperadmin: true,
            status: 'approved',
            NOT: { id: adminUser.id }
          }
        });
        if (otherActiveSuperadmins === 0) {
          return { error: 'No puedes desactivar tu propio usuario porque eres el único superadministrador activo.' };
        }
      }
    }

    const oldUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!oldUser) {
      return { error: 'Usuario no encontrado' };
    }

    const updateData: Prisma.UserUpdateInput = {};
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    let selectedLeagueIds: string[] | undefined;
    const validStatuses = ['pending', 'approved', 'rejected', 'disabled'];

    if (data.name !== undefined && data.name.trim() !== oldUser.name) {
      updateData.name = data.name.trim();
      updateData.displayName = data.name.trim();
      changes.name = { old: oldUser.name, new: data.name.trim() };
    }
    if (data.username !== undefined) {
      const usernameLower = data.username.trim().toLowerCase();
      if (usernameLower !== oldUser.username) {
        if (!/^[a-z0-9_.-]+$/.test(usernameLower)) {
          return { error: 'El nombre de usuario solo puede contener letras, números, guiones, puntos y guiones bajos' };
        }
        const existingUser = await prisma.user.findFirst({
          where: { username: usernameLower, NOT: { id: targetUserId } }
        });
        if (existingUser) {
          return { error: 'El nombre de usuario ya existe.' };
        }
        updateData.username = usernameLower;
        updateData.displayUsername = usernameLower;
        changes.username = { old: oldUser.username, new: usernameLower };
      }
    }
    if (data.email !== undefined && data.email.trim().toLowerCase() !== oldUser.email) {
      const emailLower = data.email.trim().toLowerCase();
      const existingEmail = await prisma.user.findFirst({
        where: { email: emailLower, NOT: { id: targetUserId } }
      });
      if (existingEmail) {
        return { error: 'El correo electrónico ya está registrado por otro usuario' };
      }
      updateData.email = emailLower;
      changes.email = { old: oldUser.email, new: emailLower };
    }
    if (data.whatsapp !== undefined && (data.whatsapp.trim() || null) !== oldUser.whatsapp) {
      const val = data.whatsapp.trim() || null;
      updateData.whatsapp = val;
      changes.whatsapp = { old: oldUser.whatsapp, new: val };
    }
    if (data.status !== undefined && data.status !== oldUser.status) {
      if (!validStatuses.includes(data.status)) {
        return { error: 'Estado inválido' };
      }
      updateData.status = data.status;
      changes.status = { old: oldUser.status, new: data.status };
    }
    if (data.isSuperadmin !== undefined && data.isSuperadmin !== oldUser.isSuperadmin) {
      updateData.isSuperadmin = data.isSuperadmin;
      changes.isSuperadmin = { old: oldUser.isSuperadmin, new: data.isSuperadmin };
    }
    if (data.canCreateLeagues !== undefined && data.canCreateLeagues !== oldUser.canCreateLeagues) {
      updateData.canCreateLeagues = data.canCreateLeagues;
      changes.canCreateLeagues = { old: oldUser.canCreateLeagues, new: data.canCreateLeagues };
    }
    if (data.themeMode !== undefined && data.themeMode !== oldUser.themeMode) {
      updateData.themeMode = data.themeMode;
      changes.themeMode = { old: oldUser.themeMode, new: data.themeMode };
    }
    if (data.remindersEnabled !== undefined && data.remindersEnabled !== oldUser.remindersEnabled) {
      updateData.remindersEnabled = data.remindersEnabled;
      changes.remindersEnabled = { old: oldUser.remindersEnabled, new: data.remindersEnabled };
    }
    if (data.emailRemindersEnabled !== undefined && data.emailRemindersEnabled !== oldUser.emailRemindersEnabled) {
      updateData.emailRemindersEnabled = data.emailRemindersEnabled;
      changes.emailRemindersEnabled = { old: oldUser.emailRemindersEnabled, new: data.emailRemindersEnabled };
    }
    if (data.reminderEmail !== undefined && (data.reminderEmail.trim() || null) !== oldUser.reminderEmail) {
      const val = data.reminderEmail.trim() || null;
      updateData.reminderEmail = val;
      changes.reminderEmail = { old: oldUser.reminderEmail, new: val };
    }
    if (data.passwordText !== undefined && data.passwordText.length < 6) {
      return { error: 'La contraseña temporal debe tener al menos 6 caracteres.' };
    }
    if (data.leagueIds !== undefined) {
      selectedLeagueIds = Array.from(new Set(data.leagueIds));
      const currentMemberships = await prisma.leagueMember.findMany({
        where: { userId: targetUserId },
        select: { leagueId: true },
      });
      const currentLeagueIds = currentMemberships.map((m) => m.leagueId);
      const activeLeagues = await prisma.league.findMany({
        where: { id: { in: selectedLeagueIds }, isActive: true },
        select: { id: true },
      });
      const allowedLeagueIds = new Set([
        ...currentLeagueIds,
        ...activeLeagues.map((league) => league.id),
      ]);
      if (selectedLeagueIds.some((leagueId) => !allowedLeagueIds.has(leagueId))) {
        return { error: 'Una o más competencias seleccionadas no están disponibles.' };
      }
      const currentSorted = [...currentLeagueIds].sort();
      const selectedSorted = [...selectedLeagueIds].sort();
      if (currentSorted.join('|') !== selectedSorted.join('|')) {
        changes.competencias = { old: currentSorted, new: selectedSorted };
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: targetUserId },
          data: updateData
        });
      }

      if (data.passwordText) {
        const ctx = await auth.$context;
        const hashedPassword = await ctx.password.hash(data.passwordText);
        await upsertPasswordAccounts(
          tx,
          targetUserId,
          typeof updateData.email === 'string' ? updateData.email : oldUser.email,
          hashedPassword
        );
      } else if (typeof updateData.email === 'string') {
        await syncEmailPasswordAccount(tx, targetUserId, updateData.email);
        await ensureCredentialPasswordAccount(tx, targetUserId, updateData.email);
      } else {
        await ensureCredentialPasswordAccount(tx, targetUserId, oldUser.email);
      }

      if (selectedLeagueIds !== undefined) {
        await tx.leagueMember.deleteMany({
          where: {
            userId: targetUserId,
            leagueId: { notIn: selectedLeagueIds },
          },
        });

        for (const leagueId of selectedLeagueIds) {
          await tx.leagueMember.upsert({
            where: { leagueId_userId: { leagueId, userId: targetUserId } },
            update: {},
            create: {
              leagueId,
              userId: targetUserId,
              role: 'member',
              isParticipant: true,
            },
          });

          for (const block of ['groups', 'knockout', 'global']) {
            await tx.standing.upsert({
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
                rank: 1,
                previousRank: 1,
              },
            });
          }
        }
      }
    });

    if (Object.keys(changes).length > 0 || data.passwordText) {
      await prisma.adminActionLog.create({
        data: {
          userId: adminUser.id,
          action: 'user_updated_by_admin',
          target: `user:${targetUserId}`,
          details: JSON.stringify({ changes, passwordChanged: !!data.passwordText, reason }),
        },
      });
    }

    revalidatePath('/admin/usuarios');
    const userSnapshot = await getAdminUserSnapshot(targetUserId);
    return { success: true, user: userSnapshot };
  } catch (error) {
    console.error('Error in adminUpdateUserAction:', error);
    return { error: 'Ocurrió un error al actualizar el usuario' };
  }
}

export async function adminResetUserPasswordAction(
  targetUserId: string,
  newPasswordOption: 'manual' | 'generate',
  customPasswordText: string,
  reason: string
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser || adminUser.status !== 'approved' || !adminUser.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (!reason.trim()) {
      return { error: 'El motivo es obligatorio para restablecer la contraseña.' };
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return { error: 'Usuario no encontrado' };
    }

    let passwordToSet = '';
    if (newPasswordOption === 'manual') {
      if (!customPasswordText || customPasswordText.length < 6) {
        return { error: 'La contraseña manual debe tener al menos 6 caracteres.' };
      }
      passwordToSet = customPasswordText;
    } else {
      // Generate secure temporary password
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
      for (let i = 0; i < 12; i++) {
        passwordToSet += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(passwordToSet);

    await prisma.$transaction(async (tx) => {
      await upsertPasswordAccounts(tx, targetUserId, targetUser.email, hashedPassword);
    });

    await prisma.adminActionLog.create({
      data: {
        userId: adminUser.id,
        action: 'user_password_reset',
        target: `user:${targetUserId}`,
        details: JSON.stringify({ newPasswordOption, reason }),
      },
    });

    return { success: true, temporaryPassword: passwordToSet };
  } catch (error) {
    console.error('Error in adminResetUserPasswordAction:', error);
    return { error: 'Ocurrió un error al restablecer la contraseña.' };
  }
}

export async function adminSoftDeleteUserAction(
  targetUserId: string,
  anonymize: boolean,
  reason: string
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser || adminUser.status !== 'approved' || !adminUser.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (!reason.trim()) {
      return { error: 'El motivo es obligatorio para desactivar/archivar al usuario.' };
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return { error: 'Usuario no encontrado' };
    }

    if (targetUserId === adminUser.id) {
      return { error: 'No puedes eliminar tu propio usuario.' };
    }

    if (targetUser.isSuperadmin && targetUser.status === 'approved') {
      const activeSuperadminCount = await prisma.user.count({
        where: {
          isSuperadmin: true,
          status: 'approved',
        },
      });
      if (activeSuperadminCount <= 1) {
        return { error: 'No puedes eliminar el último superadministrador.' };
      }
    }

    const updateData: Prisma.UserUpdateInput = {
      status: 'disabled'
    };

    if (anonymize) {
      updateData.displayName = 'Usuario Archivado';
      updateData.name = 'Usuario Archivado';
      updateData.whatsapp = null;
      updateData.reminderEmail = null;
      updateData.email = `deleted_${targetUserId}@polla.local`;
      updateData.username = `deleted_${targetUserId}`;
    }

    await prisma.$transaction(async (tx) => {
      // Update user status & data
      await tx.user.update({
        where: { id: targetUserId },
        data: updateData
      });

      // Invalidate sessions
      await tx.session.deleteMany({
        where: { userId: targetUserId }
      });
    });

    await prisma.adminActionLog.create({
      data: {
        userId: adminUser.id,
        action: 'user_soft_deleted',
        target: `user:${targetUserId}`,
        details: JSON.stringify({ anonymized: anonymize, reason }),
      },
    });

    revalidatePath('/admin/usuarios');
    return { success: true };
  } catch (error) {
    console.error('Error in adminSoftDeleteUserAction:', error);
    return { error: 'Ocurrió un error al archivar al usuario.' };
  }
}

export async function adminHardDeleteUserAction(
  targetUserId: string,
  reason: string,
  typedUsernameConfirmation: string
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser || adminUser.status !== 'approved' || !adminUser.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (targetUserId === adminUser.id) {
      return { error: 'No puedes eliminar tu propio usuario.' };
    }

    if (!reason.trim()) {
      return { error: 'El motivo es obligatorio para la eliminación definitiva.' };
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return { error: 'Usuario no encontrado' };
    }

    if (typedUsernameConfirmation.trim().toLowerCase() !== targetUser.username?.toLowerCase()) {
      return { error: 'El nombre de usuario ingresado no coincide con el del usuario a eliminar.' };
    }

    if (targetUser.isSuperadmin && targetUser.status === 'approved') {
      const activeSuperadminCount = await prisma.user.count({
        where: {
          isSuperadmin: true,
          status: 'approved',
        },
      });
      if (activeSuperadminCount <= 1) {
        return { error: 'No puedes eliminar el último superadministrador.' };
      }
    }

    const ownedLeagues = await prisma.league.findMany({
      where: { createdBy: targetUserId },
      select: ownedLeagueSelect,
      orderBy: { name: 'asc' },
    });
    if (ownedLeagues.length > 0) {
      const wasAlreadyDisabled = targetUser.status === 'disabled';

      if (!wasAlreadyDisabled) {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: targetUserId },
            data: { status: 'disabled' },
          });
          await tx.session.deleteMany({
            where: { userId: targetUserId },
          });
        });
      }

      await prisma.adminActionLog.create({
        data: {
          userId: adminUser.id,
          action: wasAlreadyDisabled ? 'user_delete_blocked_owner' : 'user_disabled_owner_block',
          target: `user:${targetUserId}`,
          details: JSON.stringify({
            ownedLeagues,
            reason,
            wasAlreadyDisabled,
          }),
        },
      });

      revalidatePath('/admin/usuarios');
      const userSnapshot = await getAdminUserSnapshot(targetUserId);
      const message = wasAlreadyDisabled
        ? 'El usuario ya está desactivado. No se puede eliminar porque es propietario de una competencia.'
        : 'Usuario desactivado. No se eliminó porque es propietario de una competencia.';

      return {
        success: true,
        mode: 'blocked_owner' as const,
        message,
        user: userSnapshot,
        ownedLeagues,
      };
    }

    // Check related records
    const predictionCount = await prisma.prediction.count({ where: { userId: targetUserId } });
    const winnerPredictionCount = await prisma.winnerPrediction.count({ where: { userId: targetUserId } });
    const championPickCount = await prisma.championPick.count({ where: { userId: targetUserId } });
    const winnerPredictionHistoryCount = await prisma.winnerPredictionHistory.count({ where: { userId: targetUserId } });
    const standingCount = await prisma.standing.count({ where: { userId: targetUserId } });
    const adminActionLogCount = await prisma.adminActionLog.count({ where: { userId: targetUserId } });

    if (
      predictionCount > 0 ||
      winnerPredictionCount > 0 ||
      championPickCount > 0 ||
      winnerPredictionHistoryCount > 0 ||
      standingCount > 0 ||
      adminActionLogCount > 0
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: targetUserId },
          data: { status: 'disabled' },
        });
        await tx.session.deleteMany({
          where: { userId: targetUserId },
        });
      });

      await prisma.adminActionLog.create({
        data: {
          userId: adminUser.id,
          action: 'user_disabled_for_history',
          target: `user:${targetUserId}`,
          details: JSON.stringify({
            predictionCount,
            winnerPredictionCount,
            championPickCount,
            winnerPredictionHistoryCount,
            standingCount,
            adminActionLogCount,
            reason,
          }),
        },
      });

      revalidatePath('/admin/usuarios');
      const userSnapshot = await getAdminUserSnapshot(targetUserId);
      return {
        success: true,
        mode: 'disabled' as const,
        message: 'Usuario desactivado porque tiene registros históricos.',
        user: userSnapshot,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminActionLog.create({
        data: {
          userId: adminUser.id,
          action: 'user_hard_deleted',
          target: `user:${targetUserId}`,
          details: JSON.stringify({ username: targetUser.username, email: targetUser.email, reason }),
        },
      });
      await tx.session.deleteMany({ where: { userId: targetUserId } });
      await tx.account.deleteMany({ where: { userId: targetUserId } });
      await tx.leagueMember.deleteMany({ where: { userId: targetUserId } });
      await tx.reminderLog.deleteMany({ where: { userId: targetUserId } });
      await tx.userOddsRefreshUsage.deleteMany({ where: { userId: targetUserId } });
      await tx.oddsSnapshot.deleteMany({ where: { userId: targetUserId } });
      await tx.user.delete({
        where: { id: targetUserId },
      });
    });

    revalidatePath('/admin/usuarios');
    return {
      success: true,
      mode: 'deleted' as const,
      message: 'Usuario eliminado con éxito.',
      userId: targetUserId,
    };
  } catch (error) {
    console.error('Error in adminHardDeleteUserAction:', error);
    return { error: 'Ocurrió un error al eliminar definitivamente al usuario.' };
  }
}

export async function adminTransferLeagueOwnershipAction(
  leagueId: string,
  newOwnerUserId: string,
  reason: string
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser || adminUser.status !== 'approved' || !adminUser.isSuperadmin) {
      return { error: 'No tienes permisos para realizar esta acción.' };
    }

    if (!reason.trim()) {
      return { error: 'El motivo de la transferencia es obligatorio.' };
    }

    if (!newOwnerUserId.trim()) {
      return { error: 'Selecciona un nuevo propietario.' };
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });
    if (!league) {
      return { error: 'Competencia no encontrada.' };
    }

    if (league.createdBy === newOwnerUserId) {
      return { error: 'El nuevo propietario debe ser distinto al propietario actual.' };
    }

    const newOwner = await prisma.user.findUnique({
      where: { id: newOwnerUserId },
      select: {
        id: true,
        username: true,
        name: true,
        status: true,
        isSuperadmin: true,
        canCreateLeagues: true,
      },
    });
    if (!newOwner) {
      return { error: 'Nuevo propietario no encontrado.' };
    }
    if (newOwner.status !== 'approved') {
      return { error: 'No se puede transferir la propiedad a un usuario desactivado, rechazado o pendiente.' };
    }
    if (!newOwner.isSuperadmin && !newOwner.canCreateLeagues) {
      return { error: 'El nuevo propietario debe ser administrador o superadministrador activo.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.league.update({
        where: { id: leagueId },
        data: { createdBy: newOwner.id },
      });
      await tx.leagueMember.updateMany({
        where: {
          leagueId,
          role: 'owner',
        },
        data: { role: 'member' },
      });
      await tx.leagueMember.upsert({
        where: {
          leagueId_userId: {
            leagueId,
            userId: newOwner.id,
          },
        },
        update: {
          role: 'owner',
          isParticipant: true,
        },
        create: {
          leagueId,
          userId: newOwner.id,
          role: 'owner',
          isParticipant: true,
        },
      });
      await tx.adminActionLog.create({
        data: {
          userId: adminUser.id,
          action: 'league_ownership_transfer',
          target: `league:${leagueId}`,
          details: JSON.stringify({
            previousOwnerId: league.createdBy,
            previousOwnerUsername: league.owner.username,
            newOwnerId: newOwner.id,
            newOwnerUsername: newOwner.username,
            reason,
          }),
        },
      });
    });

    revalidatePath('/admin/usuarios');
    revalidatePath('/admin/competencias');
    revalidatePath('/admin/ligas');
    revalidatePath(`/liga/${league.slug}`);
    revalidatePath(`/competencia/${league.slug}`);

    const previousOwnerUser = await getAdminUserSnapshot(league.createdBy);
    const newOwnerUser = await getAdminUserSnapshot(newOwner.id);
    return {
      success: true,
      message: 'Propiedad de la competencia transferida con éxito.',
      league: {
        id: league.id,
        name: league.name,
        slug: league.slug,
        competitionType: league.competitionType,
      },
      previousOwnerUser,
      newOwnerUser,
    };
  } catch (error) {
    console.error('Error in adminTransferLeagueOwnershipAction:', error);
    return { error: 'No se pudo transferir la propiedad de la competencia.' };
  }
}

export async function adminResetUserChampionAction(targetUserId: string, leagueId: string, reason: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    const winnerPred = await prisma.winnerPrediction.findUnique({
      where: {
        userId_leagueId: {
          userId: targetUserId,
          leagueId: leagueId,
        }
      }
    });

    if (!winnerPred) {
      return { error: 'El usuario no tiene una predicción de campeón registrada en esta competencia' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.winnerPredictionHistory.create({
        data: {
          leagueId,
          userId: targetUserId,
          oldTeamCode: winnerPred.teamCode,
          newTeamCode: '',
          actionType: 'changed_by_admin',
          changedById: adminUser.id,
          reason: reason || 'Restablecido por el administrador',
          visibleToParticipants: true,
        }
      });

      await tx.winnerPrediction.delete({
        where: {
          userId_leagueId: {
            userId: targetUserId,
            leagueId: leagueId,
          }
        }
      });
    });

    await prisma.adminActionLog.create({
      data: {
        userId: adminUser.id,
        action: 'champion_prediction_reset',
        target: `user:${targetUserId}:league:${leagueId}`,
        details: JSON.stringify({ oldTeamCode: winnerPred.teamCode, reason }),
      },
    });

    revalidatePath('/admin/usuarios');
    return { success: true };
  } catch (error) {
    console.error('Error resetting champion prediction:', error);
    return { error: 'Ocurrió un error al restablecer la predicción de campeón' };
  }
}

export async function adminUpdateLeagueMemberRoleAction(
  targetUserId: string,
  leagueId: string,
  role: string,
  reason: string
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (!reason.trim()) {
      return { error: 'El motivo es obligatorio' };
    }

    await prisma.leagueMember.update({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
      data: { role },
    });

    await prisma.adminActionLog.create({
      data: {
        userId: adminUser.id,
        action: 'admin_league_member_role_change',
        target: `user:${targetUserId}:league:${leagueId}`,
        details: JSON.stringify({ role, reason }),
      },
    });

    revalidatePath('/admin/usuarios');
    return { success: true };
  } catch (error) {
    console.error('Error updating member role:', error);
    return { error: 'Ocurrió un error al actualizar el rol de la membresía' };
  }
}

export async function adminRemoveFromLeagueAction(
  targetUserId: string,
  leagueId: string,
  reason: string
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (!reason.trim()) {
      return { error: 'El motivo es obligatorio' };
    }

    await prisma.leagueMember.delete({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    });

    await prisma.adminActionLog.create({
      data: {
        userId: adminUser.id,
        action: 'admin_league_member_remove',
        target: `user:${targetUserId}:league:${leagueId}`,
        details: JSON.stringify({ reason }),
      },
    });

    revalidatePath('/admin/usuarios');
    return { success: true };
  } catch (error) {
    console.error('Error removing user from league:', error);
    return { error: 'Ocurrió un error al remover al usuario de la competencia' };
  }
}

export async function adminAddToLeagueAction(
  targetUserId: string,
  leagueId: string
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    // Check if target user is approved
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
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
    await prisma.leagueMember.create({
      data: {
        leagueId,
        userId: targetUserId,
        role: 'member',
      },
    });

    // Create Standing rows for the user in this league for all blocks
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
          rank: 1,
          previousRank: 1,
        },
      });
    }

    await prisma.adminActionLog.create({
      data: {
        userId: adminUser.id,
        action: 'admin_league_member_add',
        target: `user:${targetUserId}:league:${leagueId}`,
        details: JSON.stringify({}),
      },
    });

    revalidatePath('/admin/usuarios');
    return { success: true };
  } catch (error) {
    console.error('Error adding user to league:', error);
    return { error: 'Ocurrió un error al agregar al usuario a la competencia' };
  }
}


export type KickoffCorrectionProposal = {
  matchId: string;
  homeTeamCode: string;
  awayTeamCode: string;
  phase: string;
  jornada: string;
  currentKickoffUtc: Date;
  proposedKickoffUtc: Date;
  currentReadable: string;
  proposedReadable: string;
  changed: boolean;
  status: string;
};

export async function previewKickoffCorrectionsAction(): Promise<
  { success: true; proposals: KickoffCorrectionProposal[] } | { success: false; error: string }
> {
  const session = await getCurrentSession();
  if (!session?.user) return { success: false, error: 'No autorizado.' };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperadmin: true },
  });
  if (!user?.isSuperadmin) {
    return { success: false, error: 'Acción permitida solo para superadministradores.' };
  }

  try {
    const matches = await prisma.match.findMany({
      orderBy: { id: 'asc' },
    });

    const proposals: KickoffCorrectionProposal[] = [];

    for (const match of matches) {
      const proposedTimeStr = OFFICIAL_KNOCKOUT_SCHEDULE[match.id];
      if (!proposedTimeStr) continue;

      const proposedKickoffUtc = new Date(proposedTimeStr);
      const currentKickoffTime = match.kickoffUtc.getTime();
      const proposedKickoffTime = proposedKickoffUtc.getTime();
      const changed = currentKickoffTime !== proposedKickoffTime;

      const isFinal = isConsistentFinalMatchResult(match);

      proposals.push({
        matchId: match.id,
        homeTeamCode: match.homeTeamCode,
        awayTeamCode: match.awayTeamCode,
        phase: match.phase,
        jornada: match.jornada,
        currentKickoffUtc: match.kickoffUtc,
        proposedKickoffUtc,
        currentReadable: match.kickoffUtc.toISOString(),
        proposedReadable: proposedTimeStr,
        changed,
        status: isFinal ? 'final_skipped' : changed ? 'pending' : 'aligned',
      });
    }

    return { success: true, proposals };
  } catch (error: unknown) {
    console.error('Error previewing kickoff corrections:', error);
    return { success: false, error: 'Ocurrió un error al obtener la vista previa.' };
  }
}

export async function applyKickoffCorrectionsAction(): Promise<
  { success: true; updatedCount: number } | { success: false; error: string }
> {
  const session = await getCurrentSession();
  if (!session?.user) return { success: false, error: 'No autorizado.' };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperadmin: true, name: true },
  });
  if (!user?.isSuperadmin) {
    return { success: false, error: 'Acción permitida solo para superadministradores.' };
  }

  try {
    const matches = await prisma.match.findMany({
      where: {
        id: { in: Object.keys(OFFICIAL_KNOCKOUT_SCHEDULE) },
      },
    });

    let updatedCount = 0;
    const logDetails: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const match of matches) {
        const proposedTimeStr = OFFICIAL_KNOCKOUT_SCHEDULE[match.id];
        if (!proposedTimeStr) continue;

        const proposedKickoffUtc = new Date(proposedTimeStr);
        const currentKickoffTime = match.kickoffUtc.getTime();
        const proposedKickoffTime = proposedKickoffUtc.getTime();

        const isFinal = isConsistentFinalMatchResult(match);

        if (currentKickoffTime !== proposedKickoffTime && !isFinal) {
          await tx.match.update({
            where: { id: match.id },
            data: { kickoffUtc: proposedKickoffUtc },
          });
          updatedCount++;
          logDetails.push(
            `Match ${match.id} (${match.homeTeamCode} vs ${match.awayTeamCode}) kickoff changed from ${match.kickoffUtc.toISOString()} to ${proposedTimeStr}`
          );
        }
      }

      if (updatedCount > 0) {
        await tx.adminActionLog.create({
          data: {
            userId: session.user.id,
            action: 'CORRECT_KICKOFF_SCHEDULE',
            target: 'matches:knockout',
            details: `Admin ${user.name || session.user.id} corrected kickoff times for ${updatedCount} knockout matches. Details: ${logDetails.join('; ')}`,
          },
        });
      }
    });

    revalidatePath('/admin/partidos');
    revalidatePath('/pronosticos');
    revalidatePath('/');

    return { success: true, updatedCount };
  } catch (error: unknown) {
    console.error('Error applying kickoff corrections:', error);
    return { success: false, error: 'Ocurrió un error al aplicar las correcciones de fecha y hora.' };
  }
}

