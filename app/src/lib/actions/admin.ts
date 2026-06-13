'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { calculatePoints } from '../scoring/calculatePoints';
import { revalidatePath } from 'next/cache';
import { auth } from '../auth';

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
      include: { league: true },
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
        { homeScore, awayScore },
        {
          pointsExactScore: pred.league.pointsExactScore,
          pointsWinner: pred.league.pointsWinner,
          pointsDraw: pred.league.pointsDraw,
          pointsConsolation: pred.league.pointsConsolation,
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
 * Handles league-specific rules (points per result) and winner predictions.
 */
export async function recalculateAllStandings() {
  const leagues = await prisma.league.findMany();

  for (const league of leagues) {
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: league.id },
      include: {
        user: true,
      }
    });

    const userMetadata: Record<string, {
      predictionsSubmitted: number;
      lastSuccessfulPredictionAt: Date | null;
      name: string;
    }> = {};

    const standingUpdates = [];

    for (const member of members) {
      const user = member.user;

      // Fetch predictions for this user in this league
      const predictions = await prisma.prediction.findMany({
        where: { userId: user.id, leagueId: league.id },
        include: { match: true }
      });

      // Fetch winner prediction for this user in this league
      const winnerPred = await prisma.winnerPrediction.findUnique({
        where: {
          userId_leagueId: {
            userId: user.id,
            leagueId: league.id,
          }
        }
      });

      const predictionsSubmitted = predictions.length;
      let lastSuccessfulPredictionAt: Date | null = null;
      for (const pred of predictions) {
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

      const stats = {
        global: { points: 0, exacts: 0, tendencies: 0, consolations: 0, misses: 0 },
        groups: { points: 0, exacts: 0, tendencies: 0, consolations: 0, misses: 0 },
        knockout: { points: 0, exacts: 0, tendencies: 0, consolations: 0, misses: 0 },
      };

      for (const pred of predictions) {
        if (pred.scoreType === null) continue;

        const block = pred.match.phase === 'groups' ? 'groups' : 'knockout';
        const pts = pred.pointsEarned || 0;
        const t = pred.scoreType;

        const increment = (s: typeof stats.global) => {
          s.points += pts;
          if (t === 'exact') s.exacts += 1;
          if (t === 'tendency') s.tendencies += 1;
          if (t === 'consolation') s.consolations += 1;
          if (t === 'miss') s.misses += 1;
        };

        increment(stats.global);
        increment(stats[block]);
      }

      // Add points for tournament winner prediction if champion is set and matches
      if (league.championTeamCode && winnerPred && winnerPred.teamCode === league.championTeamCode) {
        stats.global.points += league.championPoints;
        if (winnerPred.pointsEarned !== league.championPoints) {
          await prisma.winnerPrediction.update({
            where: { id: winnerPred.id },
            data: { pointsEarned: league.championPoints }
          });
        }
      } else if (winnerPred && winnerPred.pointsEarned !== null) {
        await prisma.winnerPrediction.update({
          where: { id: winnerPred.id },
          data: { pointsEarned: null }
        });
      }

      for (const block of ['global', 'groups', 'knockout'] as const) {
        standingUpdates.push(prisma.standing.upsert({
          where: {
            leagueId_userId_block: {
              leagueId: league.id,
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
          },
          create: {
            leagueId: league.id,
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

    if (standingUpdates.length > 0) {
      await prisma.$transaction(standingUpdates);
    }

    // Now calculate ranks for this league
    const rankUpdates = [];
    for (const block of ['global', 'groups', 'knockout']) {
      const standingsInLeague = await prisma.standing.findMany({
        where: { leagueId: league.id, block },
      });

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

      enrichedStandings.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.exacts !== b.exacts) return b.exacts - a.exacts;
        if (a.tendencies !== b.tendencies) return b.tendencies - a.tendencies;
        if (a.predictionsSubmitted !== b.predictionsSubmitted) {
          return b.predictionsSubmitted - a.predictionsSubmitted;
        }
        const aTime = a.lastSuccessfulPredictionAt ? a.lastSuccessfulPredictionAt.getTime() : Infinity;
        const bTime = b.lastSuccessfulPredictionAt ? b.lastSuccessfulPredictionAt.getTime() : Infinity;
        if (aTime !== bTime) return aTime - bTime;
        return a.name.localeCompare(b.name);
      });

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

export async function updateUserStatusAction(targetUserId: string, status: string) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      return { error: 'No autorizado' };
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser?.isSuperadmin) {
      return { error: 'No tienes permisos de superadministrador' };
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'disabled'];
    if (!validStatuses.includes(status)) {
      return { error: 'Estado inválido' };
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { status },
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
        details: JSON.stringify({ status }),
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

    const existingUser = await prisma.user.findUnique({
      where: { username: usernameLower },
    });
    if (existingUser) {
      return { error: 'El nombre de usuario ya está registrado' };
    }

    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(data.passwordText);
    const email = data.email?.trim() || `${usernameLower}@polla.local`;

    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return { error: 'El correo electrónico ya está registrado' };
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: data.name.trim(),
          username: usernameLower,
          displayUsername: data.name.trim(),
          email: email,
          emailVerified: true,
          whatsapp: data.whatsapp?.trim() || null,
          status: data.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await tx.account.create({
        data: {
          id: `acc-admin-${Math.random().toString(36).substring(2, 11)}`,
          accountId: email,
          providerId: 'email',
          userId: u.id,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return u;
    });

    // Auto-join to pools if approved
    if (data.status === 'approved') {
      const autoJoinLeagues = await prisma.league.findMany({
        where: { autoJoin: true, isActive: true },
      });
      for (const lg of autoJoinLeagues) {
        await prisma.leagueMember.create({
          data: {
            leagueId: lg.id,
            userId: newUser.id,
            role: 'member',
          }
        });
      }
      if (autoJoinLeagues.length > 0) {
        await recalculateAllStandings();
      }
    }

    await prisma.adminActionLog.create({
      data: {
        userId: adminUser.id,
        action: 'user_created_by_admin',
        target: `user:${newUser.id}`,
        details: JSON.stringify({ username: usernameLower, status: data.status }),
      },
    });

    revalidatePath('/admin/usuarios');
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Error in adminCreateUserAction:', error);
    return { error: 'Ocurrió un error al crear el usuario administrativamente' };
  }
}

