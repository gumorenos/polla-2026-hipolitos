'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { revalidatePath } from 'next/cache';
import { isMatchLocked } from '../utils/dates';

/**
 * Saves or updates a prediction for a match.
 * Enforces server-side validations:
 * - Session authentication.
 * - Score validation (non-negative integers).
 * - Automatic kickoff locking.
 * - Match completion checks.
 */
export async function savePredictionAction(
  matchId: string,
  leagueId: string,
  homePrediction: number,
  awayPrediction: number
) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado. Inicia sesión primero.' };
  }

  const userId = session.user.id;

  // Validate user status
  try {
    const userStatusCheck = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!userStatusCheck || userStatusCheck.status !== 'approved') {
      return { error: 'Tu cuenta debe estar aprobada para realizar predicciones.' };
    }

    // Verify league membership
    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId,
        },
      },
    });
    if (!membership) {
      return { error: 'No eres miembro registrado en esta polla.' };
    }

    // Validate scores
    if (
      homePrediction < 0 ||
      awayPrediction < 0 ||
      !Number.isInteger(homePrediction) ||
      !Number.isInteger(awayPrediction)
    ) {
      return { error: 'Los marcadores deben ser números enteros no negativos.' };
    }

    // Retrieve match details to check locking rules
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return { error: 'El partido no existe.' };
    }

    // Server-side lock check
    if (isMatchLocked(match.kickoffUtc, match.status, match.resultStatus)) {
      return { error: 'Las predicciones para este partido están cerradas debido a que ya comenzó o finalizó.' };
    }

    // Upsert user prediction
    const prediction = await prisma.prediction.upsert({
      where: {
        userId_leagueId_matchId: {
          userId,
          leagueId,
          matchId,
        },
      },
      update: {
        homePrediction,
        awayPrediction,
        updatedAt: new Date(),
      },
      create: {
        userId,
        leagueId,
        matchId,
        homePrediction,
        awayPrediction,
      },
    });

    // Revalidate paths to update standings or predictions count
    revalidatePath('/pronosticos');
    revalidatePath('/liga');

    return { success: true, data: prediction };
  } catch (error) {
    console.error('Error saving prediction:', error);
    return { error: 'Error interno al guardar la predicción.' };
  }
}

/**
 * Fetches the list of all matches from the database.
 */
export async function listMatchesAction() {
  try {
    const matches = await prisma.match.findMany({
      orderBy: { kickoffUtc: 'asc' },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });
    return { data: matches };
  } catch (error) {
    console.error('Error fetching matches:', error);
    return { error: 'Error al cargar los partidos.' };
  }
}

/**
 * Fetches all predictions made by the authenticated user.
 */
export async function getUserPredictionsAction(leagueId?: string) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  try {
    const predictions = await prisma.prediction.findMany({
      where: {
        userId: session.user.id,
        ...(leagueId ? { leagueId } : {}),
      },
    });
    return { data: predictions };
  } catch (error) {
    console.error('Error fetching user predictions:', error);
    return { error: 'Error al cargar las predicciones.' };
  }
}

export async function saveWinnerPredictionAction(leagueId: string, teamCode: string) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const userId = session.user.id;
  const isSuperadmin = !!session.user.isSuperadmin;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user || user.status !== 'approved') {
      return { error: 'Tu cuenta debe estar aprobada para realizar predicciones.' };
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });
    if (!league) {
      return { error: 'La polla no existe.' };
    }

    // Determine deadline
    let deadline = league.championDeadline;
    if (!deadline) {
      const firstR32 = await prisma.match.findFirst({
        where: { phase: 'r32' },
        orderBy: { kickoffUtc: 'asc' },
      });
      if (firstR32) {
        deadline = firstR32.kickoffUtc;
      }
    }

    const isDeadlinePassed = deadline ? new Date() > deadline : false;

    // Normal users cannot submit after deadline
    if (isDeadlinePassed && !isSuperadmin) {
      return { error: 'El plazo para elegir campeón ya cerró.' };
    }

    const membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } }
    });
    if (!membership) {
      return { error: 'No eres miembro de esta polla.' };
    }

    // Check if user already submitted a champion prediction
    const existing = await prisma.winnerPrediction.findUnique({
      where: {
        userId_leagueId: { userId, leagueId }
      }
    });

    let winnerPrediction;

    if (existing) {
      // If it exists, they can only edit if correction is allowed (and not expired) OR if caller is superadmin
      const now = new Date();
      const isCorrectionActive = existing.correctionAllowed && existing.correctionAllowedUntil && existing.correctionAllowedUntil > now;

      if (!isCorrectionActive && !isSuperadmin) {
        return { error: 'Ya has registrado tu predicción de campeón y no puedes cambiarla sin autorización del administrador.' };
      }

      // Update existing prediction
      winnerPrediction = await prisma.winnerPrediction.update({
        where: { id: existing.id },
        data: {
          teamCode,
          correctionAllowed: false,
          correctionAllowedUntil: null,
          correctionReason: null,
          correctionAuthorizedById: null,
          updatedAt: new Date(),
        }
      });

      // Create history entry
      await prisma.winnerPredictionHistory.create({
        data: {
          leagueId,
          userId,
          oldTeamCode: existing.teamCode,
          newTeamCode: teamCode,
          actionType: isSuperadmin ? 'changed_by_admin' : 'changed_by_user',
          authorizedById: existing.correctionAuthorizedById || (isSuperadmin ? session.user.id : null),
          changedById: session.user.id,
          reason: existing.correctionReason || (isSuperadmin ? 'Corrección directa de superadmin' : 'Corrección autorizada de usuario'),
          createdAt: new Date(),
          visibleToParticipants: true,
        }
      });
    } else {
      // First submission
      winnerPrediction = await prisma.winnerPrediction.create({
        data: {
          userId,
          leagueId,
          teamCode,
        }
      });

      // Create history entry
      await prisma.winnerPredictionHistory.create({
        data: {
          leagueId,
          userId,
          oldTeamCode: null,
          newTeamCode: teamCode,
          actionType: 'created',
          changedById: session.user.id,
          reason: 'Elección inicial de campeón',
          createdAt: new Date(),
          visibleToParticipants: true,
        }
      });
    }

    revalidatePath('/pronosticos');
    revalidatePath('/liga');

    return { success: true, data: winnerPrediction };
  } catch (error) {
    console.error('Error saving winner prediction:', error);
    return { error: 'Error al guardar la predicción de campeón de la polla.' };
  }
}

export async function allowWinnerPredictionCorrectionAction(
  leagueId: string,
  targetUserId: string,
  durationMinutes: number,
  reason: string
) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const callerUserId = session.user.id;
  const isSuperadmin = !!session.user.isSuperadmin;

  if (!isSuperadmin) {
    return { error: 'Solo los superadministradores pueden autorizar correcciones.' };
  }

  if (!reason.trim()) {
    return { error: 'El motivo de la corrección es obligatorio.' };
  }

  try {
    const existing = await prisma.winnerPrediction.findUnique({
      where: {
        userId_leagueId: { userId: targetUserId, leagueId }
      }
    });

    if (!existing) {
      return { error: 'El usuario no tiene una predicción de campeón guardada para autorizar su corrección.' };
    }

    const expirationDate = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Update WinnerPrediction
    await prisma.winnerPrediction.update({
      where: { id: existing.id },
      data: {
        correctionAllowed: true,
        correctionAllowedUntil: expirationDate,
        correctionReason: reason,
        correctionAuthorizedById: callerUserId,
      }
    });

    // Create WinnerPredictionHistory
    await prisma.winnerPredictionHistory.create({
      data: {
        leagueId,
        userId: targetUserId,
        oldTeamCode: existing.teamCode,
        newTeamCode: existing.teamCode,
        actionType: 'correction_authorized',
        authorizedById: callerUserId,
        changedById: callerUserId,
        reason: reason,
        createdAt: new Date(),
        visibleToParticipants: true,
      }
    });

    revalidatePath('/pronosticos');
    revalidatePath('/liga');

    return { success: true };
  } catch (error) {
    console.error('Error authorizing winner prediction correction:', error);
    return { error: 'Error al autorizar la corrección de campeón.' };
  }
}

export async function directCorrectWinnerPredictionAction(
  leagueId: string,
  targetUserId: string,
  teamCode: string,
  reason: string
) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const callerUserId = session.user.id;
  const isSuperadmin = !!session.user.isSuperadmin;

  if (!isSuperadmin) {
    return { error: 'Solo los superadministradores pueden realizar correcciones directas.' };
  }

  if (!reason.trim()) {
    return { error: 'El motivo del cambio es obligatorio.' };
  }

  try {
    const existing = await prisma.winnerPrediction.findUnique({
      where: {
        userId_leagueId: { userId: targetUserId, leagueId }
      }
    });

    let oldTeamCode = null;
    let winnerPrediction;

    if (existing) {
      oldTeamCode = existing.teamCode;
      winnerPrediction = await prisma.winnerPrediction.update({
        where: { id: existing.id },
        data: {
          teamCode,
          correctionAllowed: false,
          correctionAllowedUntil: null,
          correctionReason: null,
          correctionAuthorizedById: null,
          updatedAt: new Date(),
        }
      });
    } else {
      winnerPrediction = await prisma.winnerPrediction.create({
        data: {
          userId: targetUserId,
          leagueId,
          teamCode,
        }
      });
    }

    // Create WinnerPredictionHistory
    await prisma.winnerPredictionHistory.create({
      data: {
        leagueId,
        userId: targetUserId,
        oldTeamCode,
        newTeamCode: teamCode,
        actionType: 'changed_by_admin',
        authorizedById: callerUserId,
        changedById: callerUserId,
        reason: reason,
        createdAt: new Date(),
        visibleToParticipants: true,
      }
    });

    revalidatePath('/pronosticos');
    revalidatePath('/liga');

    return { success: true, data: winnerPrediction };
  } catch (error) {
    console.error('Error performing direct winner prediction correction:', error);
    return { error: 'Error al cambiar la predicción de campeón.' };
  }
}

