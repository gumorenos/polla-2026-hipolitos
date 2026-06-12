'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { revalidatePath } from 'next/cache';

/**
 * Checks if a match is locked for predictions (i.e. kickoff has passed or match is live/finished).
 */
function isMatchLocked(kickoffUtc: Date | string, status: string): boolean {
  const kickoffDate = new Date(kickoffUtc);
  const now = new Date();
  return kickoffDate <= now || status === 'live' || status === 'result';
}

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
  homePrediction: number,
  awayPrediction: number
) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado. Inicia sesión primero.' };
  }

  const userId = session.user.id;

  // Validate scores
  if (
    homePrediction < 0 ||
    awayPrediction < 0 ||
    !Number.isInteger(homePrediction) ||
    !Number.isInteger(awayPrediction)
  ) {
    return { error: 'Los marcadores deben ser números enteros no negativos.' };
  }

  try {
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
        userId_matchId: {
          userId,
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
export async function getUserPredictionsAction() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  try {
    const predictions = await prisma.prediction.findMany({
      where: { userId: session.user.id },
    });
    return { data: predictions };
  } catch (error) {
    console.error('Error fetching user predictions:', error);
    return { error: 'Error al cargar las predicciones.' };
  }
}
