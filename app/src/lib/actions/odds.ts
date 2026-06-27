'use server';

import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { getCurrentSession } from '../auth-helpers';
import { getMatchWinnerOdds, saveOddsSnapshot, getProviderCooldown } from '../odds/providers';
import { getHeadToHeadStats, saveHeadToHeadSnapshot } from '../odds/h2h';
import { revalidatePath } from 'next/cache';

// Helper to get America/Lima date key (YYYY-MM-DD)
export async function getLimaDateKey(date: Date): Promise<string> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

// Helper to calculate hours and minutes left until midnight in America/Lima
export async function getLimaTimeUntilMidnight(): Promise<{ hours: number; minutes: number }> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());

  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);

  const totalSecondsToday = hour * 3600 + minute * 60 + second;
  const totalSecondsInDay = 24 * 3600;
  const secondsLeft = Math.max(0, totalSecondsInDay - totalSecondsToday);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);

  return { hours, minutes };
}

// Check if user is allowed to refresh odds today
export async function canUserRefreshOddsTodayAction() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { canRefresh: false, error: 'No autorizado' };
  }

  const userId = session.user.id;
  const dateKey = await getLimaDateKey(new Date());

  const usage = await prisma.userOddsRefreshUsage.findUnique({
    where: {
      userId_dateKey: {
        userId,
        dateKey,
      },
    },
  });

  if (usage) {
    const timeLeft = await getLimaTimeUntilMidnight();
    return {
      canRefresh: false,
      timeLeft,
      message: `Ya has utilizado tu actualización diaria de cuotas para el día de hoy. Podrás realizar una nueva consulta en ${timeLeft.hours}h ${timeLeft.minutes}m.`,
    };
  }

  return { canRefresh: true };
}

// Refresh odds requested by user (private snapshot, limit 1 per day)
export async function refreshUserOddsAction(matchId: string) {
  if (process.env.ODDS_MANUAL_USER_REFRESH_ENABLED !== 'true') {
    return { error: 'La actualización manual de probabilidades está desactivada.' };
  }

  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado. Por favor inicia sesión.' };
  }

  const userId = session.user.id;

  // Validate user is approved
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });

  if (!user || user.status !== 'approved') {
    return { error: 'Tu cuenta debe estar aprobada para usar esta funcionalidad.' };
  }

  // Validate match kickoff (cannot refresh if match has started or finished)
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    return { error: 'El partido no existe.' };
  }

  const now = new Date();
  if (match.kickoffUtc <= now || match.status === 'live' || match.status === 'result') {
    return { error: 'El partido ya ha comenzado o finalizado. No es posible actualizar probabilidades.' };
  }

  const dateKey = await getLimaDateKey(now);

  try {
    // Fetch odds from API or simulator
    const odds = await getMatchWinnerOdds(matchId);
    if (!odds || odds.provider === 'simulator' || odds.bookmaker === 'LaPolla 2026 Simulator') {
      return { error: 'No se pudieron obtener probabilidades reales. Los proveedores de datos no retornaron información.' };
    }

    // Save snapshot and log usage in an atomic transaction to avoid race conditions
    await prisma.$transaction(async (tx) => {
      // 1. Verify usage again inside transaction to prevent double clicks
      const usage = await tx.userOddsRefreshUsage.findUnique({
        where: {
          userId_dateKey: {
            userId,
            dateKey,
          },
        },
      });

      if (usage) {
        throw new Error('Ya has utilizado tu actualización diaria para el día de hoy.');
      }

      // Implied probabilities calculation
      const impliedHome = 1 / odds.homeOdds;
      const impliedDraw = 1 / odds.drawOdds;
      const impliedAway = 1 / odds.awayOdds;
      const sum = impliedHome + impliedDraw + impliedAway;

      // 2. Save outcome snapshots
      const outcomes = [
        { outcomeType: 'home', teamCode: match.homeTeamCode, outcomeLabel: match.homeTeamCode, decimalOdds: odds.homeOdds, implied: impliedHome, norm: impliedHome / sum },
        { outcomeType: 'draw', teamCode: null, outcomeLabel: 'Empate', decimalOdds: odds.drawOdds, implied: impliedDraw, norm: impliedDraw / sum },
        { outcomeType: 'away', teamCode: match.awayTeamCode, outcomeLabel: match.awayTeamCode, decimalOdds: odds.awayOdds, implied: impliedAway, norm: impliedAway / sum },
      ];

      const capturedAt = new Date();

      // Save snapshots
      for (const o of outcomes) {
        await tx.oddsSnapshot.create({
          data: {
            matchId,
            provider: odds.provider,
            bookmaker: odds.bookmaker,
            marketType: 'match_winner',
            outcomeType: o.outcomeType,
            teamCode: o.teamCode,
            outcomeLabel: o.outcomeLabel,
            decimalOdds: o.decimalOdds,
            impliedProbability: o.implied,
            normalizedProbability: o.norm,
            capturedAt,
            visibility: 'user_private',
            userId,
            sourceType: odds.sourceType,
            rawPayload: odds.rawPayload,
          },
        });
      }

      // 3. Log usage
      await tx.userOddsRefreshUsage.create({
        data: {
          userId,
          dateKey,
          timezone: 'America/Lima',
          matchId,
          provider: odds.provider,
        },
      });
    });

    revalidatePath('/pronosticos');
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error refreshing user odds:', error);
    const message = error instanceof Error ? error.message : 'Error al actualizar las probabilidades del partido.';
    return { error: message };
  }
}

// Refresh global odds (Superadmin only)
export async function refreshGlobalOddsAction(options?: {
  matchId?: string;
  limit?: number;
  lookaheadHours?: number;
}) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isSuperadmin) {
    return { error: 'Acción permitida solo para superadministradores.' };
  }

  try {
    const primaryProvider = process.env.ODDS_PRIMARY_PROVIDER || 'odds-api-io';
    const fallbackProvider = process.env.ODDS_FALLBACK_PROVIDER || 'the-odds-api';

    let matchesProcessed = 0;
    let snapshotsCreated = 0;
    let skipped = 0;
    let primaryProviderErrors = 0;
    let fallbackSuccesses = 0;

    const matchId = options?.matchId;

    if (matchId) {
      // Refresh single match
      const odds = await getMatchWinnerOdds(matchId);
      if (!odds) {
        return { error: 'No se pudieron obtener probabilidades del mercado reales para este partido.' };
      }
      const isFallbackUsed = odds.provider === fallbackProvider;
      if (isFallbackUsed) {
        fallbackSuccesses++;
        primaryProviderErrors++;
      }
      await saveOddsSnapshot(matchId, odds, { visibility: 'global' });
      snapshotsCreated++;
      matchesProcessed = 1;
    } else {
      // Scan matches
      const limit = options?.limit ?? 5;
      const lookaheadHours = options?.lookaheadHours;
      const now = new Date();

      const whereClause: Prisma.MatchWhereInput = {
        status: { in: ['open', 'soon'] },
        kickoffUtc: { gt: now }
      };

      if (lookaheadHours) {
        const maxKickoff = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);
        whereClause.kickoffUtc = {
          gt: now,
          lt: maxKickoff
        };
      }

      const matches = await prisma.match.findMany({
        where: whereClause,
        orderBy: { kickoffUtc: 'asc' },
        take: limit
      });

      for (const m of matches) {
        try {
          const odds = await getMatchWinnerOdds(m.id);
          if (odds) {
            const isFallbackUsed = odds.provider === fallbackProvider;
            if (isFallbackUsed) {
              fallbackSuccesses++;
              primaryProviderErrors++;
            }
            await saveOddsSnapshot(m.id, odds, { visibility: 'global' });
            snapshotsCreated++;
          } else {
            primaryProviderErrors++;
            skipped++;
          }
          matchesProcessed++;

          // Pace real provider calls regardless of whether the key came from DB or env.
          if (odds?.sourceType === 'api') {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (e) {
          console.error(`Failed to refresh global odds for match ${m.id}:`, e);
          primaryProviderErrors++;
          skipped++;
          matchesProcessed++;
        }
      }
    }

    revalidatePath('/pronosticos');
    revalidatePath('/admin/odds');
    revalidatePath('/');

    return {
      success: true,
      summary: {
        matchesConsidered: matchesProcessed,
        matchesProcessed,
        snapshotsCreated,
        skipped,
        primaryProviderErrors,
        fallbackSuccesses,
      }
    };
  } catch (error: unknown) {
    console.error('Error in refreshGlobalOddsAction:', error);
    const message = error instanceof Error ? error.message : 'Ocurrió un error al actualizar las cuotas globales.';
    return { error: message };
  }
}


// Refresh H2H for a match (Approved users or Admin)
export async function refreshH2HAction(matchId: string) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });

  if (!user || user.status !== 'approved') {
    return { error: 'Tu cuenta debe estar aprobada.' };
  }

  try {
    const stats = await getHeadToHeadStats(matchId);
    if (!stats) {
      return { error: 'No se pudieron obtener estadísticas H2H reales para este partido.' };
    }
    const snapshot = await saveHeadToHeadSnapshot(matchId, stats);
    revalidatePath('/pronosticos');
    revalidatePath('/');
    return { success: true, snapshot };
  } catch (error: unknown) {
    console.error('Error refreshing H2H:', error);
    const message = error instanceof Error ? error.message : 'Error al obtener estadísticas de enfrentamientos directos.';
    return { error: message };
  }
}

// Fetch all missing H2H for matches (Superadmin only)
export async function fetchMissingH2HAction(options?: {
  limit?: number;
  futureOnly?: boolean;
}) {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isSuperadmin) {
    return { error: 'Acción permitida solo para superadministradores.' };
  }

  try {
    const now = new Date();
    const limit = options?.limit ?? 5;
    
    // Prioritize future matches missing H2H
    const futureMatches = await prisma.match.findMany({
      where: {
        h2hSnapshot: null,
        kickoffUtc: { gt: now }
      },
      orderBy: { kickoffUtc: 'asc' }
    });

    let matchesToProcess = [...futureMatches];

    if (!options?.futureOnly || matchesToProcess.length < limit) {
      const pastMatches = await prisma.match.findMany({
        where: {
          h2hSnapshot: null,
          kickoffUtc: { lte: now }
        },
        orderBy: { kickoffUtc: 'desc' }
      });
      matchesToProcess = [...matchesToProcess, ...pastMatches];
    }

    const matches = matchesToProcess.slice(0, limit);

    const isConcreteTeamCode = (code: string): boolean => {
      if (!code) return false;
      const trimmed = code.trim();
      return trimmed.length === 3 && /^[A-Z]{3}$/.test(trimmed);
    };

    let processed = 0;
    let created = 0;
    let skipped = 0;
    let rateLimited = false;

    for (const m of matches) {
      if (!isConcreteTeamCode(m.homeTeamCode) || !isConcreteTeamCode(m.awayTeamCode)) {
        skipped++;
        continue;
      }

      // Check cooldown before calling API
      const cooldown = await getProviderCooldown('api-football');
      if (cooldown) {
        console.warn('API-Football is cooling down. Halting missing H2H fetch.');
        rateLimited = true;
        break;
      }

      try {
        processed++;
        const stats = await getHeadToHeadStats(m.id);
        if (stats) {
          await saveHeadToHeadSnapshot(m.id, stats);
          created++;
        } else {
          skipped++;
        }

        if (stats?.provider !== 'simulator') {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Failed to refresh H2H for match ${m.id}:`, err);
        if (err instanceof Error && err.message.includes('429')) {
          rateLimited = true;
          break;
        }
        skipped++;
      }
    }

    revalidatePath('/pronosticos');
    revalidatePath('/admin/odds');
    revalidatePath('/');

    return {
      success: true,
      count: created,
      summary: {
        matchesConsidered: matches.length,
        processed,
        created,
        skipped,
        rateLimited,
      }
    };
  } catch (error: unknown) {
    console.error('Error fetching missing H2H:', error);
    const message = error instanceof Error ? error.message : 'Ocurrió un error al buscar H2H faltantes.';
    return { error: message };
  }
}

// Cleanup simulated data (Superadmin only)
export async function cleanupSimulatedDataAction() {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return { error: 'No autorizado.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isSuperadmin) {
    return { error: 'Acción permitida solo para superadministradores.' };
  }

  try {
    const deletedOdds = await prisma.oddsSnapshot.deleteMany({
      where: {
        OR: [
          { provider: 'simulator' },
          { bookmaker: 'LaPolla 2026 Simulator' },
          { rawPayload: { contains: 'simulated=true' } },
          { rawPayload: { contains: '"simulated":true' } },
        ],
      },
    });

    const deletedH2h = await prisma.headToHeadSnapshot.deleteMany({
      where: {
        provider: 'simulator',
      },
    });

    revalidatePath('/admin/odds');
    revalidatePath('/pronosticos');
    revalidatePath('/');

    return {
      success: true,
      deletedOddsCount: deletedOdds.count,
      deletedH2hCount: deletedH2h.count,
    };
  } catch (error: unknown) {
    console.error('Error cleaning up simulated data:', error);
    const message = error instanceof Error ? error.message : 'Error al limpiar los datos simulados.';
    return { error: message };
  }
}

