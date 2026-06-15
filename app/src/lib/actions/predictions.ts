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
    if (isMatchLocked(match.kickoffUtc, match.status)) {
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

    // Check if user already submitted a champion prediction (locked after first submission)
    const existing = await prisma.winnerPrediction.findUnique({
      where: {
        userId_leagueId: { userId, leagueId }
      }
    });
    if (existing) {
      return { error: 'Ya has registrado tu predicción de campeón y no puedes cambiarla.' };
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

    if (deadline && new Date() > deadline) {
      return { error: 'El plazo para elegir campeón ya cerró.' };
    }

    const membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } }
    });
    if (!membership) {
      return { error: 'No eres miembro de esta polla.' };
    }

    const winnerPrediction = await prisma.winnerPrediction.create({
      data: {
        userId,
        leagueId,
        teamCode,
      }
    });

    revalidatePath('/pronosticos');
    revalidatePath('/liga');

    return { success: true, data: winnerPrediction };
  } catch (error) {
    console.error('Error saving winner prediction:', error);
    return { error: 'Error al guardar la predicción de campeón de la polla.' };
  }
}
