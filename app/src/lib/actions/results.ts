'use server';

import { prisma } from '../db';
import { getCurrentSession } from '../auth-helpers';
import { updateMatchResultInternal } from './admin';
import { FIFA_TO_APIFOOTBALL_IDS, lookupTeamId } from '../odds/h2h';
import { getProviderCooldown } from '../odds/providers';
import { fetchMatchResultFromFootballData, ProviderDiagnostic, ProviderResultDetails } from '../odds/football-data';
import { recordProviderResponseDiagnostic, resolveProviderApiKey } from '../provider-credentials';
import { recordProviderTeamNames, resolveProviderTeamAlias } from '../team-alias-service';

interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
  teams?: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
}

// ─── Try API-Football ─────────────────────────────────────────────────────────

async function fetchFromApiFootball(
  match: {
    id: string;
    kickoffUtc: Date | string | number;
    homeTeamCode: string;
    awayTeamCode: string;
    phase: string;
    status: string;
  },
  options: { force?: boolean }
): Promise<{ result?: ProviderResultDetails; error?: string; diagnostic: ProviderDiagnostic }> {
  const credential = await resolveProviderApiKey('api-football');
  const apiKey = credential.apiKey;
  const isEnabled = credential.configured;
  const kickoffDate = new Date(match.kickoffUtc);
  const dateStr = kickoffDate.toISOString().slice(0, 10);
  const timestamp = new Date().toISOString();

  const baseDiag: Omit<ProviderDiagnostic, 'success' | 'statusCode' | 'errorMessage'> = {
    provider: 'api-football',
    matchId: match.id,
    date: dateStr,
    timestamp,
  };

  if (!isEnabled || !apiKey) {
    return {
      error: 'API-Football no está habilitado o no está configurado.',
      diagnostic: { ...baseDiag, success: false, errorMessage: 'Provider disabled or key missing' },
    };
  }

  const cooldown = options.force ? null : await getProviderCooldown('api-football');
  if (cooldown) {
    return {
      error: `API-Football está en cooldown hasta ${cooldown.toISOString()}`,
      diagnostic: { ...baseDiag, success: false, errorMessage: `Cooldown until ${cooldown.toISOString()}` },
    };
  }

  // Resolve team IDs
  let homeId = FIFA_TO_APIFOOTBALL_IDS[match.homeTeamCode];
  if (!homeId) homeId = (await lookupTeamId(match.homeTeamCode, apiKey)) || 0;
  let awayId = FIFA_TO_APIFOOTBALL_IDS[match.awayTeamCode];
  if (!awayId) awayId = (await lookupTeamId(match.awayTeamCode, apiKey)) || 0;

  if (!homeId || !awayId) {
    return {
      error: `No se pudieron resolver los IDs de equipos: ${match.homeTeamCode}=${homeId}, ${match.awayTeamCode}=${awayId}`,
      diagnostic: { ...baseDiag, success: false, errorMessage: 'Team ID resolution failed' },
    };
  }

  // Use fixtures by date + team filter (more reliable than H2H for recent matches)
  const url = `https://v3.football.api-sports.io/fixtures?date=${dateStr}&team=${homeId}&season=2026`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'x-apisports-key': apiKey, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    await recordProviderResponseDiagnostic('api-football', res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return {
      error: `Error de red con API-Football: ${msg}`,
      diagnostic: { ...baseDiag, success: false, errorMessage: `Network: ${msg}` },
    };
  }

  if (res.status === 429) {
    return {
      error: 'Límite de peticiones de API-Football (429)',
      diagnostic: { ...baseDiag, success: false, statusCode: 429, errorMessage: 'Rate limit' },
    };
  }

  if (!res.ok) {
    return {
      error: `API-Football falló con estado ${res.status}`,
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: `HTTP ${res.status}` },
    };
  }

  let data: { response?: ApiFootballFixture[] };
  try {
    data = await res.json();
  } catch {
    return {
      error: 'API-Football: Respuesta JSON inválida',
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: 'Invalid JSON' },
    };
  }

  if (!data?.response || !Array.isArray(data.response)) {
    return {
      error: 'Respuesta inválida de API-Football',
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: 'No response array' },
    };
  }

  await recordProviderTeamNames(
    'api-football',
    'result_fixture',
    data.response.flatMap((fixture) => fixture.teams
      ? [fixture.teams.home.name, fixture.teams.away.name]
      : []),
  ).catch(() => undefined);

  // Find fixture matching our kickoff (within 24h window)
  const matchKickoffDate = new Date(match.kickoffUtc);
  let targetFixture: ApiFootballFixture | undefined;
  let idFilteredDateFallback: ApiFootballFixture | undefined;
  for (const fixture of data.response) {
    const f = fixture as ApiFootballFixture;
    const fDate = new Date(f.fixture.date);
    const diffMs = Math.abs(fDate.getTime() - matchKickoffDate.getTime());
    if (diffMs >= 24 * 60 * 60 * 1000) continue;
    idFilteredDateFallback ??= f;
    if (!f.teams) {
      continue;
    }
    const [homeResolution, awayResolution] = await Promise.all([
      resolveProviderTeamAlias('api-football', f.teams.home.name),
      resolveProviderTeamAlias('api-football', f.teams.away.name),
    ]);
    if (
      homeResolution.matched
      && awayResolution.matched
      && homeResolution.teamCode === match.homeTeamCode
      && awayResolution.teamCode === match.awayTeamCode
    ) {
      targetFixture = f;
      break;
    }
  }
  targetFixture ??= idFilteredDateFallback;

  if (!targetFixture) {
    return {
      error: `API-Football: No fixture encontrado para ${match.homeTeamCode} vs ${match.awayTeamCode} el ${dateStr}`,
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: 'Fixture not found' },
    };
  }

  const statusShort = targetFixture.fixture.status.short;
  const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);

  if (!isFinished) {
    return {
      error: `API-Football: Partido no finalizado. Estado: ${statusShort}`,
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: `Status: ${statusShort}` },
    };
  }

  const homeScore = targetFixture.goals.home;
  const awayScore = targetFixture.goals.away;

  if (homeScore === null || awayScore === null) {
    return {
      error: 'API-Football: Marcadores no disponibles aún.',
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: 'Null scores' },
    };
  }

  const wentToExtraTime = statusShort === 'AET' || statusShort === 'PEN';
  const wentToPenalties = statusShort === 'PEN';

  let homePenaltyScore: number | null = null;
  let awayPenaltyScore: number | null = null;
  let winnerTeamCode: string | null = null;

  if (wentToPenalties) {
    homePenaltyScore = targetFixture.score.penalty.home;
    awayPenaltyScore = targetFixture.score.penalty.away;
    if (homePenaltyScore !== null && awayPenaltyScore !== null) {
      winnerTeamCode = homePenaltyScore > awayPenaltyScore ? match.homeTeamCode : match.awayTeamCode;
    }
  } else {
    if (homeScore > awayScore) winnerTeamCode = match.homeTeamCode;
    else if (awayScore > homeScore) winnerTeamCode = match.awayTeamCode;
    else winnerTeamCode = null;
  }

  return {
    result: { homeScore, awayScore, wentToExtraTime, wentToPenalties, homePenaltyScore, awayPenaltyScore, winnerTeamCode },
    diagnostic: { ...baseDiag, success: true, statusCode: res.status },
  };
}

// ─── Public: fetchAndSaveMatchResultInternal ─────────────────────────────────

export async function fetchAndSaveMatchResultInternal(
  matchId: string,
  options: { force?: boolean; dryRun?: boolean; provider?: string } = {}
) {
  const { force = false, dryRun = false, provider = 'auto' } = options;

  const match = await prisma.match.findUnique({ where: { id: matchId } });

  if (!match) {
    return { error: 'Partido no encontrado' };
  }

  if (match.status === 'result' && !force) {
    return { error: 'El partido ya tiene un resultado final. Usa force para re-consultar.' };
  }

  const providerChainEnv = process.env.RESULTS_PROVIDER_CHAIN ?? 'api-football,football-data';
  const providerChain = provider === 'auto'
    ? providerChainEnv.split(',').map(s => s.trim())
    : [provider];

  const diagnostics: ProviderDiagnostic[] = [];
  let result: ProviderResultDetails | undefined;
  let usedProvider: string | undefined;
  let isFallback = false;

  for (let i = 0; i < providerChain.length; i++) {
    const p = providerChain[i];
    if (i > 0) isFallback = true;

    let attempt: { result?: ProviderResultDetails; error?: string; diagnostic: ProviderDiagnostic };

    if (p === 'api-football') {
      attempt = await fetchFromApiFootball(match, { force });
    } else if (p === 'football-data') {
      attempt = await fetchMatchResultFromFootballData(match, { force });
    } else {
      attempt = {
        error: `Proveedor desconocido: ${p}`,
        diagnostic: {
          provider: p, matchId: match.id,
          date: new Date(match.kickoffUtc).toISOString().slice(0, 10),
          timestamp: new Date().toISOString(), success: false,
          errorMessage: 'Unknown provider',
        },
      };
    }

    diagnostics.push(attempt.diagnostic);

    if (attempt.result) {
      result = attempt.result;
      usedProvider = p;
      break;
    }
  }

  if (!result) {
    return {
      error: `Ningún proveedor devolvió resultado. Diagnósticos: ${diagnostics.map(d => `[${d.provider}: ${d.errorMessage}]`).join(', ')}`,
      diagnostics,
    };
  }

  if (dryRun) {
    return { success: true, dryRun: true, result, usedProvider, isFallback, diagnostics };
  }

  const updateRes = await updateMatchResultInternal(matchId, result.homeScore, result.awayScore, {
    wentToExtraTime: result.wentToExtraTime,
    wentToPenalties: result.wentToPenalties,
    homePenaltyScore: result.homePenaltyScore,
    awayPenaltyScore: result.awayPenaltyScore,
    winnerTeamCode: result.winnerTeamCode,
    resultStatus: 'final',
    resultSource: usedProvider,
    resultNotes: isFallback ? `Resultado obtenido vía fallback (${usedProvider})` : `Obtenido de ${usedProvider}`,
  });

  if (updateRes.error) {
    return { error: `Error al aplicar resultado: ${updateRes.error}`, diagnostics };
  }

  return { success: true, result, usedProvider, isFallback, diagnostics };
}

// ─── Server Action: fetch from admin UI ──────────────────────────────────────

export async function fetchAndSaveMatchResultAction(matchId: string, force = false, provider = 'auto') {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) return { error: 'No autorizado' };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.isSuperadmin) return { error: 'No tienes permisos de superadministrador' };

    return await fetchAndSaveMatchResultInternal(matchId, { force, provider });
  } catch (error) {
    console.error('Error fetching result action:', error);
    return { error: 'Ocurrió un error al consultar el resultado' };
  }
}

// ─── Server Action: mark match as postponed/cancelled ────────────────────────

export async function markMatchStatusAction(
  matchId: string,
  newStatus: 'postponed' | 'cancelled'
) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) return { error: 'No autorizado' };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.isSuperadmin) return { error: 'No tienes permisos de superadministrador' };

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return { error: 'Partido no encontrado' };

    await prisma.match.update({
      where: { id: matchId },
      data: {
        resultStatus: newStatus,
        resultUpdatedAt: new Date(),
        resultVerifiedById: user.id,
      },
    });

    await prisma.adminActionLog.create({
      data: {
        userId: user.id,
        action: `match_marked_${newStatus}`,
        target: `match:${matchId}`,
        details: JSON.stringify({ matchId, newStatus, homeTeamCode: match.homeTeamCode, awayTeamCode: match.awayTeamCode }),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error marking match status:', error);
    return { error: 'Ocurrió un error al actualizar el estado del partido' };
  }
}

// ─── Server Action: apply CSV results in bulk ────────────────────────────────

export interface CSVResultRow {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status: string;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  winnerTeamCode: string | null;
  resultNotes: string | null;
}

export interface CSVValidationResult {
  rowIndex: number;
  matchId: string;
  valid: boolean;
  errors: string[];
  data?: CSVResultRow;
}

export async function validateCSVRows(
  rows: Record<string, string>[]
): Promise<CSVValidationResult[]> {
  const results: CSVValidationResult[] = [];
  const validStatuses = ['final', 'postponed', 'cancelled', 'closed_pending_result'];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];
    const matchId = (row.matchId ?? '').trim();

    if (!matchId) {
      results.push({ rowIndex: i, matchId: '', valid: false, errors: ['matchId es requerido'] });
      continue;
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      results.push({ rowIndex: i, matchId, valid: false, errors: [`Partido ${matchId} no encontrado`] });
      continue;
    }

    // Validate home/away team codes match
    const rowHome = (row.homeTeamCode ?? '').trim().toUpperCase();
    const rowAway = (row.awayTeamCode ?? '').trim().toUpperCase();
    if (rowHome && rowHome !== match.homeTeamCode) {
      errors.push(`homeTeamCode no coincide: CSV=${rowHome}, DB=${match.homeTeamCode}`);
    }
    if (rowAway && rowAway !== match.awayTeamCode) {
      errors.push(`awayTeamCode no coincide: CSV=${rowAway}, DB=${match.awayTeamCode}`);
    }

    const status = (row.status ?? '').trim().toLowerCase();
    if (!validStatuses.includes(status)) {
      errors.push(`status inválido: "${status}". Valores válidos: ${validStatuses.join(', ')}`);
    }

    let homeScore: number | null = null;
    let awayScore: number | null = null;

    if (status === 'final') {
      homeScore = parseInt(row.homeScore ?? '', 10);
      awayScore = parseInt(row.awayScore ?? '', 10);
      if (isNaN(homeScore) || homeScore < 0) errors.push('homeScore debe ser número >= 0 cuando status=final');
      if (isNaN(awayScore) || awayScore < 0) errors.push('awayScore debe ser número >= 0 cuando status=final');
    }

    const wentToPenalties = row.wentToPenalties === 'true' || row.wentToPenalties === '1';
    const wentToExtraTime = row.wentToExtraTime === 'true' || row.wentToExtraTime === '1';

    let homePenaltyScore: number | null = null;
    let awayPenaltyScore: number | null = null;
    const winnerTeamCode: string | null = (row.winnerTeamCode ?? '').trim().toUpperCase() || null;

    if (wentToPenalties) {
      if (homeScore !== null && awayScore !== null && homeScore !== awayScore) {
        errors.push('Si wentToPenalties=true, homeScore debe ser igual a awayScore');
      }
      homePenaltyScore = parseInt(row.homePenaltyScore ?? '', 10);
      awayPenaltyScore = parseInt(row.awayPenaltyScore ?? '', 10);
      if (isNaN(homePenaltyScore)) errors.push('homePenaltyScore requerido cuando wentToPenalties=true');
      if (isNaN(awayPenaltyScore)) errors.push('awayPenaltyScore requerido cuando wentToPenalties=true');
      if (!winnerTeamCode) errors.push('winnerTeamCode requerido cuando wentToPenalties=true');
    } else if (status === 'final' && match.phase !== 'groups' && homeScore !== null && awayScore !== null) {
      // Knockout without penalties: winnerTeamCode must match score
      if (homeScore !== awayScore && winnerTeamCode) {
        const expectedWinner = homeScore > awayScore ? match.homeTeamCode : match.awayTeamCode;
        if (winnerTeamCode !== expectedWinner) {
          errors.push(`winnerTeamCode (${winnerTeamCode}) no coincide con el ganador por marcador (${expectedWinner})`);
        }
      }
    }

    results.push({
      rowIndex: i,
      matchId,
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? {
        matchId,
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status,
        wentToExtraTime,
        wentToPenalties,
        homePenaltyScore: isNaN(homePenaltyScore ?? NaN) ? null : homePenaltyScore,
        awayPenaltyScore: isNaN(awayPenaltyScore ?? NaN) ? null : awayPenaltyScore,
        winnerTeamCode,
        resultNotes: (row.resultNotes ?? '').trim() || null,
      } : undefined,
    });
  }

  return results;
}

export async function applyCSVResultsAction(validatedRows: CSVResultRow[]) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) return { error: 'No autorizado' };

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.isSuperadmin) return { error: 'No tienes permisos de superadministrador' };

    let applied = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of validatedRows) {
      const res = await updateMatchResultInternal(
        row.matchId,
        row.homeScore,
        row.awayScore,
        {
          wentToExtraTime: row.wentToExtraTime,
          wentToPenalties: row.wentToPenalties,
          homePenaltyScore: row.homePenaltyScore,
          awayPenaltyScore: row.awayPenaltyScore,
          winnerTeamCode: row.winnerTeamCode,
          resultStatus: row.status === 'final' ? 'final' : row.status,
          resultSource: 'csv_import',
          resultNotes: row.resultNotes ?? undefined,
        },
        user.id
      );

      if (res.error) {
        failed++;
        errors.push(`${row.matchId}: ${res.error}`);
      } else {
        applied++;
      }
    }

    await prisma.adminActionLog.create({
      data: {
        userId: user.id,
        action: 'csv_results_import',
        target: 'match:bulk',
        details: JSON.stringify({ applied, failed, total: validatedRows.length }),
      },
    });

    return { success: true, applied, failed, errors };
  } catch (error) {
    console.error('Error applying CSV results:', error);
    return { error: 'Error al aplicar resultados del CSV' };
  }
}
