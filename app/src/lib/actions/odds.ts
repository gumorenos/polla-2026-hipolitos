'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { getMatchWinnerOdds, saveOddsSnapshot, getProviderCooldown } from '../odds/providers';
import { getHeadToHeadStats, saveHeadToHeadSnapshot } from '../odds/h2h';
import { revalidatePath } from 'next/cache';
import {
  selectBulkMatchOddsCandidates,
  type BulkMatchOddsCandidate,
  type BulkMatchOddsMode,
  type BulkMatchOddsResult,
  type BulkMatchOddsSummary,
} from '../odds/bulk-match-odds';

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

type MatchOddsRefreshOutcome =
  | { status: 'updated'; provider: string; sourceType: 'api' | 'manual' }
  | { status: 'failed'; reason: string };

async function refreshGlobalMatchOdds(matchId: string): Promise<MatchOddsRefreshOutcome> {
  try {
    const odds = await getMatchWinnerOdds(matchId);
    if (!odds) {
      return {
        status: 'failed',
        reason: 'No se pudieron obtener cuotas reales para este partido.',
      };
    }

    await saveOddsSnapshot(matchId, odds, { visibility: 'global' });
    return { status: 'updated', provider: odds.provider, sourceType: odds.sourceType };
  } catch (error: unknown) {
    console.error(
      `Failed to refresh global odds for match ${matchId}:`,
      error instanceof Error ? error.name : 'UnknownError',
    );
    return {
      status: 'failed',
      reason: 'No se pudieron actualizar las cuotas de este partido.',
    };
  }
}

async function getActiveOddsProviderCooldowns(providerNames: string[]) {
  const uniqueProviders = Array.from(new Set(providerNames));
  const cooldowns = await Promise.all(
    uniqueProviders.map(async (provider) => ({
      provider,
      cooldownUntil: await getProviderCooldown(provider),
    })),
  );
  return cooldowns.filter(
    (item): item is { provider: string; cooldownUntil: Date } => item.cooldownUntil !== null,
  );
}

async function runBulkMatchOddsRefresh(options: {
  mode: BulkMatchOddsMode;
  limit?: number;
  lookaheadHours?: number;
}): Promise<BulkMatchOddsSummary> {
  const now = new Date();
  const matches = await prisma.match.findMany({
    where: { kickoffUtc: { gt: now } },
    orderBy: { kickoffUtc: 'asc' },
    select: {
      id: true,
      homeTeamCode: true,
      awayTeamCode: true,
      kickoffUtc: true,
      status: true,
      resultStatus: true,
      oddsSnapshots: {
        where: { visibility: 'global', marketType: 'match_winner' },
        select: { id: true },
        take: 1,
      },
    },
  });

  const candidates: BulkMatchOddsCandidate[] = matches.map((match) => ({
    id: match.id,
    homeTeamCode: match.homeTeamCode,
    awayTeamCode: match.awayTeamCode,
    kickoffUtc: match.kickoffUtc,
    status: match.status,
    resultStatus: match.resultStatus,
    hasGlobalMatchWinnerOdds: match.oddsSnapshots.length > 0,
  }));
  const allEligible = selectBulkMatchOddsCandidates(candidates, options.mode, now, {
    lookaheadHours: options.lookaheadHours,
  });
  const selected = options.limit ? allEligible.slice(0, options.limit) : allEligible;
  const results: BulkMatchOddsResult[] = [];
  const providersUsed = new Set<string>();
  const cooldownNotes = new Set<string>();
  const providerNames = Array.from(new Set([
    process.env.ODDS_PRIMARY_PROVIDER || 'odds-api-io',
    process.env.ODDS_FALLBACK_PROVIDER || 'the-odds-api',
  ]));
  let updated = 0;
  let failed = 0;
  let stoppedEarly = false;
  let skipped = Math.max(0, allEligible.length - selected.length);

  for (let index = 0; index < selected.length; index += 1) {
    const match = selected[index];
    if (!match) continue;
    const activeCooldowns = await getActiveOddsProviderCooldowns(providerNames);
    for (const cooldown of activeCooldowns) {
      cooldownNotes.add(`${cooldown.provider}: enfriamiento hasta ${cooldown.cooldownUntil.toISOString()}`);
    }
    if (activeCooldowns.length === providerNames.length) {
      stoppedEarly = true;
      const remaining = selected.slice(index);
      skipped += remaining.length;
      results.push(...remaining.map((pendingMatch) => ({
        matchId: pendingMatch.id,
        homeTeamCode: pendingMatch.homeTeamCode,
        awayTeamCode: pendingMatch.awayTeamCode,
        status: 'skipped' as const,
        reason: 'Actualización detenida porque los proveedores están en enfriamiento.',
      })));
      break;
    }

    const outcome = await refreshGlobalMatchOdds(match.id);
    if (outcome.status === 'updated') {
      updated += 1;
      providersUsed.add(outcome.provider);
      results.push({
        matchId: match.id,
        homeTeamCode: match.homeTeamCode,
        awayTeamCode: match.awayTeamCode,
        status: 'updated',
        provider: outcome.provider,
      });
      if (outcome.sourceType === 'api') {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      continue;
    }

    failed += 1;
    results.push({
      matchId: match.id,
      homeTeamCode: match.homeTeamCode,
      awayTeamCode: match.awayTeamCode,
      status: 'failed',
      reason: outcome.reason,
    });

    const cooldownsAfterFailure = await getActiveOddsProviderCooldowns(providerNames);
    if (cooldownsAfterFailure.length === providerNames.length) {
      stoppedEarly = true;
      for (const cooldown of cooldownsAfterFailure) {
        cooldownNotes.add(`${cooldown.provider}: enfriamiento hasta ${cooldown.cooldownUntil.toISOString()}`);
      }
    }
    if (stoppedEarly) {
      const remaining = selected.slice(index + 1);
      skipped += remaining.length;
      results.push(...remaining.map((pendingMatch) => ({
        matchId: pendingMatch.id,
        homeTeamCode: pendingMatch.homeTeamCode,
        awayTeamCode: pendingMatch.awayTeamCode,
        status: 'skipped' as const,
        reason: 'Actualización detenida por límite o enfriamiento del proveedor.',
      })));
      break;
    }
  }

  return {
    eligible: allEligible.length,
    processed: updated + failed,
    updated,
    skipped,
    failed,
    stoppedEarly,
    providersUsed: Array.from(providersUsed),
    cooldownNotes: Array.from(cooldownNotes),
    results,
  };
}

export async function adminRefreshMatchOddsBulkAction(options: {
  mode: BulkMatchOddsMode;
  limit?: number;
  lookaheadHours?: number;
}): Promise<
  | { success: true; summary: BulkMatchOddsSummary }
  | { success: false; error: string }
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
  if (options.mode !== 'future_missing' && options.mode !== 'future_all') {
    return { success: false, error: 'Modo de actualización de cuotas no válido.' };
  }

  try {
    const summary = await runBulkMatchOddsRefresh({
      mode: options.mode,
      limit: options.limit && options.limit > 0 ? Math.min(Math.floor(options.limit), 100) : undefined,
      lookaheadHours: options.lookaheadHours && options.lookaheadHours > 0
        ? Math.min(options.lookaheadHours, 24 * 30)
        : undefined,
    });
    revalidatePath('/pronosticos');
    revalidatePath('/admin/odds');
    revalidatePath('/');
    return { success: true, summary };
  } catch (error: unknown) {
    console.error(
      'Error in adminRefreshMatchOddsBulkAction:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return { success: false, error: 'Ocurrió un error al actualizar las cuotas globales.' };
  }
}

// Refresh global odds (Superadmin only). Keeps the existing single-match action contract.
export async function refreshGlobalOddsAction(options?: {
  matchId?: string;
  limit?: number;
  lookaheadHours?: number;
}) {
  const session = await getCurrentSession();
  if (!session?.user) return { error: 'No autorizado.' };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperadmin: true },
  });
  if (!user?.isSuperadmin) {
    return { error: 'Acción permitida solo para superadministradores.' };
  }

  try {
    if (options?.matchId) {
      const match = await prisma.match.findUnique({
        where: { id: options.matchId },
        select: { kickoffUtc: true },
      });
      if (!match) return { error: 'El partido no existe.' };
      if (match.kickoffUtc.getTime() <= new Date().getTime()) {
        return { error: 'El partido ya ha comenzado. No es posible actualizar probabilidades.' };
      }

      const outcome = await refreshGlobalMatchOdds(options.matchId);
      if (outcome.status === 'failed') return { error: outcome.reason };
      const fallbackProvider = process.env.ODDS_FALLBACK_PROVIDER || 'the-odds-api';
      const fallbackUsed = outcome.provider === fallbackProvider;

      revalidatePath('/pronosticos');
      revalidatePath('/admin/odds');
      revalidatePath('/');
      return {
        success: true,
        summary: {
          matchesConsidered: 1,
          matchesProcessed: 1,
          snapshotsCreated: 1,
          skipped: 0,
          primaryProviderErrors: fallbackUsed ? 1 : 0,
          fallbackSuccesses: fallbackUsed ? 1 : 0,
        },
      };
    }

    const summary = await runBulkMatchOddsRefresh({
      mode: 'future_all',
      limit: options?.limit ?? 5,
      lookaheadHours: options?.lookaheadHours,
    });
    revalidatePath('/pronosticos');
    revalidatePath('/admin/odds');
    revalidatePath('/');
    return {
      success: true,
      summary: {
        matchesConsidered: summary.eligible,
        matchesProcessed: summary.processed,
        snapshotsCreated: summary.updated,
        skipped: summary.skipped,
        primaryProviderErrors: summary.failed,
        fallbackSuccesses: summary.results.filter((result) => result.provider === 'the-odds-api').length,
      },
    };
  } catch (error: unknown) {
    console.error(
      'Error in refreshGlobalOddsAction:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return { error: 'Ocurrió un error al actualizar las cuotas globales.' };
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

