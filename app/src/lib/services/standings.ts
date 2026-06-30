import { prisma } from '../db';
import { calculatePoints } from '../scoring/calculatePoints';

/**
 * Re-calculates all standings for all users in all leagues.
 * Handles league-specific rules (points per result) and winner predictions.
 */
export async function recalculateAllStandings() {
  const leagues = await prisma.league.findMany();

  for (const league of leagues) {
    const members = await prisma.leagueMember.findMany({
      where: { leagueId: league.id, isParticipant: true },
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

      // Recalculate prediction scores for finished matches according to league scoring rules
      for (const pred of predictions) {
        if (pred.match.status === 'result' && pred.match.homeScore !== null && pred.match.awayScore !== null) {
          const result = calculatePoints(
            { homePrediction: pred.homePrediction, awayPrediction: pred.awayPrediction },
            {
              homeScore: pred.match.homeScore,
              awayScore: pred.match.awayScore,
              winnerTeamCode: pred.match.winnerTeamCode,
              homeTeamCode: pred.match.homeTeamCode,
              awayTeamCode: pred.match.awayTeamCode,
              isKnockout: pred.match.phase !== 'groups'
            },
            {
              pointsExactScore: league.pointsExactScore,
              pointsWinner: league.pointsWinner,
              pointsDraw: league.pointsDraw,
              pointsConsolation: league.pointsConsolation,
              knockoutOutcomeBasis: league.knockoutOutcomeBasis,
            }
          );
          if (pred.pointsEarned !== result.points || pred.scoreType !== result.type) {
            pred.pointsEarned = result.points;
            pred.scoreType = result.type;
            standingUpdates.push(prisma.prediction.update({
              where: { id: pred.id },
              data: {
                pointsEarned: result.points,
                scoreType: result.type,
              }
            }));
          }
        }
      }

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
