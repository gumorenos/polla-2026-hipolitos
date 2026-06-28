import { recordProviderResponseDiagnostic, resolveProviderApiKey } from '../provider-credentials';
import { recordProviderTeamNames, resolveProviderTeamAlias } from '../team-alias-service';

/**
 * football-data.org result provider
 * Docs: https://www.football-data.org/documentation/quickstart
 *
 * Free plan covers: PL, BL1, ELC, PD, SA, FL1, CL, EC, WC (World Cup)
 * Header: X-Auth-Token
 */

export interface ProviderResultDetails {
  homeScore: number;
  awayScore: number;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  winnerTeamCode: string | null;
}

export interface ProviderDiagnostic {
  provider: string;
  matchId: string;
  date: string;
  localHomeTeamCode?: string;
  localAwayTeamCode?: string;
  localKickoffUtc?: string;
  querySummary?: string;
  responseCount?: number;
  candidateSummaries?: string[];
  matchedFixtureId?: string;
  failureCategory?: 'provider_disabled' | 'network' | 'rate_limit' | 'response_empty' | 'date_window_mismatch' | 'team_alias_mismatch' | 'not_final' | 'invalid_scores' | 'provider_error';
  statusCode?: number;
  errorMessage?: string;
  timestamp: string;
  success: boolean;
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: string; // TIMED, SCHEDULED, LIVE, IN_PLAY, PAUSED, FINISHED, SUSPENDED, POSTPONED, CANCELLED, AWARDED
  score: {
    winner: string | null; // HOME_TEAM, AWAY_TEAM, DRAW
    duration: string; // REGULAR, EXTRA_TIME, PENALTY_SHOOTOUT
    fullTime: { home: number | null; away: number | null };
    extraTime: { home: number | null; away: number | null };
    penalties: { home: number | null; away: number | null };
  };
  homeTeam: { name: string; shortName: string; tla: string };
  awayTeam: { name: string; shortName: string; tla: string };
}

// Map football-data.org TLA codes to our FIFA codes where they differ
const FD_TLA_TO_FIFA: Record<string, string> = {
  GER: 'GER',
  ENG: 'ENG',
  ESP: 'ESP',
  FRA: 'FRA',
  BRA: 'BRA',
  ARG: 'ARG',
  NED: 'NED',
  POR: 'POR',
  BEL: 'BEL',
  CRO: 'CRO',
  URU: 'URU',
  COL: 'COL',
  USA: 'USA',
  MEX: 'MEX',
  CAN: 'CAN',
  ITA: 'ITA',
  JPN: 'JPN',
  SEN: 'SEN',
  MAR: 'MAR',
  ECU: 'ECU',
  PAR: 'PAR',
  PAN: 'PAN',
  CPV: 'CPV',
  CUW: 'CUR', // Curaçao — FD uses CUW, we use CUR
  JOR: 'JOR',
  NZL: 'NZL',
  HAI: 'HAI',
  UZB: 'UZB',
  QAT: 'QAT',
  KOR: 'KOR',
  KSA: 'KSA',
  AUS: 'AUS',
  EGY: 'EGY',
  CIV: 'CIV',
  GHA: 'GHA',
  TUN: 'TUN',
  ALG: 'ALG',
  DZA: 'ALG', // Algeria alias
  SUI: 'SUI',
  AUT: 'AUT',
  TUR: 'TUR',
  SWE: 'SWE',
  NOR: 'NOR',
  CZE: 'CZE',
  SCO: 'SCO',
  IRN: 'IRI', // Iran — FD uses IRN, we use IRI
  IRI: 'IRI',
  RSA: 'RSA',
  BIH: 'BIH',
  COD: 'COD', // DR Congo
  DRC: 'COD', // DR Congo alias
};

function normalizeTla(tla: string): string {
  return FD_TLA_TO_FIFA[tla.toUpperCase()] ?? tla.toUpperCase();
}

export async function fetchMatchResultFromFootballData(
  match: {
    id: string;
    kickoffUtc: Date | string | number;
    homeTeamCode: string;
    awayTeamCode: string;
    phase: string;
  },
  options: { force?: boolean; dryRun?: boolean } = {}
): Promise<{ result?: ProviderResultDetails; error?: string; diagnostic: ProviderDiagnostic }> {
  const credential = await resolveProviderApiKey('football-data');
  const apiKey = credential.apiKey;
  const enabled = credential.configured;
  const baseUrl = process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org/v4';
  const competitionCode = process.env.FOOTBALL_DATA_COMPETITION_CODE ?? 'WC';

  const kickoffDate = new Date(match.kickoffUtc);
  const dateStr = kickoffDate.toISOString().slice(0, 10);
  const dateFrom = shiftUtcDate(kickoffDate, -1);
  const dateTo = shiftUtcDate(kickoffDate, 1);
  const timestamp = new Date().toISOString();

  const baseDiag: Omit<ProviderDiagnostic, 'success' | 'statusCode' | 'errorMessage'> = {
    provider: 'football-data',
    matchId: match.id,
    date: dateStr,
    localHomeTeamCode: match.homeTeamCode,
    localAwayTeamCode: match.awayTeamCode,
    localKickoffUtc: kickoffDate.toISOString(),
    querySummary: `competition=${competitionCode}; dateFrom=${dateFrom}; dateTo=${dateTo}`,
    timestamp,
  };

  if (!enabled) {
    return {
      error: 'football-data.org no está habilitado o no está configurado',
      diagnostic: { ...baseDiag, success: false, failureCategory: 'provider_disabled', errorMessage: 'Provider disabled' },
    };
  }

  if (!apiKey) {
    return {
      error: 'FOOTBALL_DATA_API_KEY no configurado',
      diagnostic: { ...baseDiag, success: false, failureCategory: 'provider_disabled', errorMessage: 'API key missing' },
    };
  }

  // A one-day margin catches providers that classify midnight UTC fixtures on an adjacent date.
  const url = `${baseUrl}/competitions/${competitionCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'X-Auth-Token': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    await recordProviderResponseDiagnostic('football-data', res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return {
      error: `Error de red al contactar football-data.org: ${msg}`,
      diagnostic: { ...baseDiag, success: false, failureCategory: 'network', errorMessage: `Network: ${msg}` },
    };
  }

  if (res.status === 403) {
    return {
      error: `football-data.org: Acceso denegado (403) — verifica tu plan o el código de competencia (${competitionCode})`,
      diagnostic: { ...baseDiag, success: false, statusCode: 403, failureCategory: 'provider_error', errorMessage: 'Access denied — check plan or competition code' },
    };
  }

  if (res.status === 429) {
    return {
      error: 'football-data.org: Límite de peticiones alcanzado (429)',
      diagnostic: { ...baseDiag, success: false, statusCode: 429, failureCategory: 'rate_limit', errorMessage: 'Rate limit' },
    };
  }

  if (!res.ok) {
    return {
      error: `football-data.org: Error HTTP ${res.status}`,
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, failureCategory: 'provider_error', errorMessage: `HTTP ${res.status}` },
    };
  }

  let data: { matches?: FDMatch[] };
  try {
    data = await res.json();
  } catch {
    return {
      error: 'football-data.org: Respuesta JSON inválida',
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, failureCategory: 'provider_error', errorMessage: 'Invalid JSON' },
    };
  }

  if (!data?.matches || !Array.isArray(data.matches)) {
    return {
      error: 'football-data.org: Respuesta vacía o formato inesperado',
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, failureCategory: 'response_empty', errorMessage: 'No matches array' },
    };
  }

  await recordProviderTeamNames(
    'football-data',
    'result_fixture',
    data.matches.flatMap((candidate) => [
      candidate.homeTeam.name,
      candidate.homeTeam.shortName,
      candidate.awayTeam.name,
      candidate.awayTeam.shortName,
    ]),
  ).catch(() => undefined);

  const responseContext = {
    responseCount: data.matches.length,
    candidateSummaries: data.matches.slice(0, 8).map((candidate) => (
      `${candidate.id}: ${candidate.homeTeam.tla || candidate.homeTeam.name} vs ${candidate.awayTeam.tla || candidate.awayTeam.name}; ${candidate.utcDate}; ${candidate.status}`
    )),
  };

  // Find the matching fixture by team codes
  let fdMatch = data.matches.find((m) => {
    const withinDateWindow = Math.abs(new Date(m.utcDate).getTime() - kickoffDate.getTime()) < 24 * 60 * 60 * 1000;
    const fdHome = normalizeTla(m.homeTeam.tla);
    const fdAway = normalizeTla(m.awayTeam.tla);
    return withinDateWindow && fdHome === match.homeTeamCode && fdAway === match.awayTeamCode;
  });

  if (!fdMatch) {
    for (const candidate of data.matches) {
      if (Math.abs(new Date(candidate.utcDate).getTime() - kickoffDate.getTime()) >= 24 * 60 * 60 * 1000) {
        continue;
      }
      const [homeResolution, awayResolution] = await Promise.all([
        resolveProviderTeamAlias('football-data', candidate.homeTeam.name),
        resolveProviderTeamAlias('football-data', candidate.awayTeam.name),
      ]);
      if (
        homeResolution.matched
        && awayResolution.matched
        && homeResolution.teamCode === match.homeTeamCode
        && awayResolution.teamCode === match.awayTeamCode
      ) {
        fdMatch = candidate;
        break;
      }
    }
  }

  if (!fdMatch) {
    const hasCandidateInsideDateWindow = data.matches.some((candidate) => (
      Math.abs(new Date(candidate.utcDate).getTime() - kickoffDate.getTime()) < 24 * 60 * 60 * 1000
    ));
    return {
      error: `football-data.org: No se encontró partido ${match.homeTeamCode} vs ${match.awayTeamCode} el ${dateStr}`,
      diagnostic: {
        ...baseDiag,
        ...responseContext,
        success: false,
        statusCode: res.status,
        failureCategory: data.matches.length === 0
          ? 'response_empty'
          : hasCandidateInsideDateWindow ? 'team_alias_mismatch' : 'date_window_mismatch',
        errorMessage: 'Match not found in response',
      },
    };
  }

  if (!['FINISHED', 'AWARDED'].includes(fdMatch.status)) {
    return {
      error: `football-data.org: Partido no finalizado. Estado: ${fdMatch.status}`,
      diagnostic: { ...baseDiag, ...responseContext, matchedFixtureId: String(fdMatch.id), success: false, statusCode: res.status, failureCategory: 'not_final', errorMessage: `Match status: ${fdMatch.status}` },
    };
  }

  const homeScore = fdMatch.score.fullTime.home;
  const awayScore = fdMatch.score.fullTime.away;

  if (homeScore === null || awayScore === null) {
    return {
      error: 'football-data.org: Marcadores no disponibles aún',
      diagnostic: { ...baseDiag, ...responseContext, matchedFixtureId: String(fdMatch.id), success: false, statusCode: res.status, failureCategory: 'invalid_scores', errorMessage: 'Null scores' },
    };
  }

  const duration = fdMatch.score.duration;
  const wentToExtraTime = duration === 'EXTRA_TIME' || duration === 'PENALTY_SHOOTOUT';
  const wentToPenalties = duration === 'PENALTY_SHOOTOUT';

  let homePenaltyScore: number | null = null;
  let awayPenaltyScore: number | null = null;
  let winnerTeamCode: string | null = null;

  if (wentToPenalties) {
    homePenaltyScore = fdMatch.score.penalties.home;
    awayPenaltyScore = fdMatch.score.penalties.away;
    if (fdMatch.score.winner === 'HOME_TEAM') winnerTeamCode = match.homeTeamCode;
    else if (fdMatch.score.winner === 'AWAY_TEAM') winnerTeamCode = match.awayTeamCode;
  } else {
    if (homeScore > awayScore) winnerTeamCode = match.homeTeamCode;
    else if (awayScore > homeScore) winnerTeamCode = match.awayTeamCode;
  }

  return {
    result: {
      homeScore,
      awayScore,
      wentToExtraTime,
      wentToPenalties,
      homePenaltyScore,
      awayPenaltyScore,
      winnerTeamCode,
    },
    diagnostic: { ...baseDiag, ...responseContext, matchedFixtureId: String(fdMatch.id), success: true, statusCode: res.status },
  };
}

function shiftUtcDate(value: Date, days: number): string {
  const shifted = new Date(value);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
