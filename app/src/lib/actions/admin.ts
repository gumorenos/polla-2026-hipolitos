'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { calculatePoints } from '../scoring/calculatePoints';
import { revalidatePath } from 'next/cache';

export async function updateMatchResultAction(matchId: string, homeScore: number, awayScore: number) {
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

    // Update the match
    await prisma.match.update({
      where: { id: matchId },
      data: {
        homeScore,
        awayScore,
        status: 'result',
      },
    });

    // Fetch all predictions for this match
    const predictions = await prisma.prediction.findMany({
      where: { matchId },
    });

    // We will do everything in a transaction for safety
    const transaction = [];

    // Log the admin action
    transaction.push(prisma.adminActionLog.create({
      data: {
        userId: user.id,
        action: 'update_match_result',
        target: `match:${matchId}`,
        details: JSON.stringify({ homeScore, awayScore }),
      }
    }));

    // Update predictions
    for (const pred of predictions) {
      const result = calculatePoints(
        { homePrediction: pred.homePrediction, awayPrediction: pred.awayPrediction },
        { homeScore, awayScore }
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

    // Now recalculate standings for all users
    await recalculateAllStandings();

    revalidatePath('/admin/resultados');
    revalidatePath('/admin/partidos');
    revalidatePath('/pronosticos');
    revalidatePath('/ranking');
    
    return { success: true };
  } catch (error) {
    console.error('Error updating match result:', error);
    return { error: 'Ocurrió un error al actualizar el resultado' };
  }
}

/**
 * Re-calculates all standings for all users in all leagues.
 * This is safe because the number of users is small (20-50).
 */
export async function recalculateAllStandings() {
  // Fetch all users with all their predictions
  const users = await prisma.user.findMany({
    include: {
      memberships: true,
      predictions: {
        include: { match: true }
      }
    }
  });

  const standingUpdates = [];
  const userMetadata: Record<string, {
    predictionsSubmitted: number;
    lastSuccessfulPredictionAt: Date | null;
    name: string;
  }> = {};

  for (const user of users) {
    if (user.memberships.length === 0) continue; // No leagues joined

    // 1. Calculate predictions submitted (all of them)
    const predictionsSubmitted = user.predictions.length;

    // 2. Find last successful prediction timestamp
    let lastSuccessfulPredictionAt: Date | null = null;
    for (const pred of user.predictions) {
      if (pred.pointsEarned !== null && pred.pointsEarned > 0) {
        if (!lastSuccessfulPredictionAt || pred.updatedAt > lastSuccessfulPredictionAt) {
          lastSuccessfulPredictionAt = pred.updatedAt;
        }
      }
    }

    userMetadata[user.id] = {
      predictionsSubmitted,
      lastSuccessfulPredictionAt,
      name: user.displayName || user.name || '',
    };

    // Aggregate stats by block (only for scored predictions)
    const stats = {
      global: { points: 0, exacts: 0, tendencies: 0, consolations: 0, misses: 0 },
      groups: { points: 0, exacts: 0, tendencies: 0, consolations: 0, misses: 0 },
      knockout: { points: 0, exacts: 0, tendencies: 0, consolations: 0, misses: 0 },
    };

    for (const pred of user.predictions) {
      if (pred.scoreType === null) continue; // Unscored prediction

      const block = pred.match.phase === 'groups' ? 'groups' : 'knockout';
      const pts = pred.pointsEarned || 0;
      const t = pred.scoreType;

      const increment = (s: { points: number; exacts: number; tendencies: number; consolations: number; misses: number }) => {
        s.points += pts;
        if (t === 'exact') s.exacts += 1;
        if (t === 'tendency') s.tendencies += 1;
        if (t === 'consolation') s.consolations += 1;
        if (t === 'miss') s.misses += 1;
      };

      increment(stats.global);
      increment(stats[block]);
    }

    // Update standings for each league this user is in
    for (const membership of user.memberships) {
      for (const block of ['global', 'groups', 'knockout'] as const) {
        standingUpdates.push(prisma.standing.upsert({
          where: {
            leagueId_userId_block: {
              leagueId: membership.leagueId,
              userId: user.id,
              block: block,
            }
          },
          update: {
            points: stats[block].points,
            exacts: stats[block].exacts,
            tendencies: stats[block].tendencies,
            consolations: stats[block].consolations,
            misses: stats[block].misses,
            // Ranks will be recalculated below
          },
          create: {
            leagueId: membership.leagueId,
            userId: user.id,
            block: block,
            points: stats[block].points,
            exacts: stats[block].exacts,
            tendencies: stats[block].tendencies,
            consolations: stats[block].consolations,
            misses: stats[block].misses,
            rank: 0,
            previousRank: 0,
          }
        }));
      }
    }
  }

  if (standingUpdates.length > 0) {
    // Run standing upserts
    await prisma.$transaction(standingUpdates);

    // Calculate ranks per league per block using advanced tie-breaker logic
    const leagues = await prisma.league.findMany({ select: { id: true } });
    const rankUpdates = [];

    for (const league of leagues) {
      for (const block of ['global', 'groups', 'knockout']) {
        const standingsInLeague = await prisma.standing.findMany({
          where: { leagueId: league.id, block },
        });

        // Enrich with metadata for sorting
        const enrichedStandings = standingsInLeague.map(s => {
          const meta = userMetadata[s.userId] || {
            predictionsSubmitted: 0,
            lastSuccessfulPredictionAt: null,
            name: '',
          };
          return {
            ...s,
            predictionsSubmitted: meta.predictionsSubmitted,
            lastSuccessfulPredictionAt: meta.lastSuccessfulPredictionAt,
            name: meta.name,
          };
        });

        // Sort based on the 6 tie-breaker rules
        enrichedStandings.sort((a, b) => {
          // 1. Total points (desc)
          if (a.points !== b.points) return b.points - a.points;
          // 2. More exact scores (desc)
          if (a.exacts !== b.exacts) return b.exacts - a.exacts;
          // 3. More correct tendencies (desc)
          if (a.tendencies !== b.tendencies) return b.tendencies - a.tendencies;
          // 4. More predictions submitted (desc)
          if (a.predictionsSubmitted !== b.predictionsSubmitted) {
            return b.predictionsSubmitted - a.predictionsSubmitted;
          }
          // 5. Earliest last successful prediction timestamp (asc, nulls last)
          const aTime = a.lastSuccessfulPredictionAt ? a.lastSuccessfulPredictionAt.getTime() : Infinity;
          const bTime = b.lastSuccessfulPredictionAt ? b.lastSuccessfulPredictionAt.getTime() : Infinity;
          if (aTime !== bTime) return aTime - bTime;
          // 6. User name as stable fallback (asc)
          return a.name.localeCompare(b.name);
        });

        // Assign rank based on index (unique because of name fallback)
        for (let i = 0; i < enrichedStandings.length; i++) {
          const s = enrichedStandings[i];
          const currentRank = i + 1;

          rankUpdates.push(prisma.standing.update({
            where: { id: s.id },
            data: {
              previousRank: s.rank > 0 ? s.rank : currentRank,
              rank: currentRank,
            }
          }));
        }
      }
    }

    if (rankUpdates.length > 0) {
      await prisma.$transaction(rankUpdates);
    }
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

    // Update match
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

export async function toggleUserSuperadminAction(targetUserId: string, isSuperadmin: boolean) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    if (targetUserId === user.id) {
      return { error: 'No puedes quitarte el rol de superadministrador a ti mismo' };
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
        details: JSON.stringify({ isSuperadmin }),
      },
    });

    revalidatePath('/admin/usuarios');
    return { success: true };
  } catch (error) {
    console.error('Error toggling superadmin status:', error);
    return { error: 'Ocurrió un error al modificar los permisos del usuario' };
  }
}

