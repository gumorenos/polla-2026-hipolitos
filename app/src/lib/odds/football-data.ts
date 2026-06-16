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
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const enabled = process.env.FOOTBALL_DATA_ENABLED === 'true';
  const baseUrl = process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org/v4';
  const competitionCode = process.env.FOOTBALL_DATA_COMPETITION_CODE ?? 'WC';

  const kickoffDate = new Date(match.kickoffUtc);
  const dateStr = kickoffDate.toISOString().slice(0, 10);
  const timestamp = new Date().toISOString();

  const baseDiag: Omit<ProviderDiagnostic, 'success' | 'statusCode' | 'errorMessage'> = {
    provider: 'football-data',
    matchId: match.id,
    date: dateStr,
    timestamp,
  };

  if (!enabled) {
    return {
      error: 'football-data.org no está habilitado (FOOTBALL_DATA_ENABLED != true)',
      diagnostic: { ...baseDiag, success: false, errorMessage: 'Provider disabled' },
    };
  }

  if (!apiKey) {
    return {
      error: 'FOOTBALL_DATA_API_KEY no configurado',
      diagnostic: { ...baseDiag, success: false, errorMessage: 'API key missing' },
    };
  }

  // Query matches by date range (same day)
  const url = `${baseUrl}/competitions/${competitionCode}/matches?dateFrom=${dateStr}&dateTo=${dateStr}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'X-Auth-Token': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return {
      error: `Error de red al contactar football-data.org: ${msg}`,
      diagnostic: { ...baseDiag, success: false, errorMessage: `Network: ${msg}` },
    };
  }

  if (res.status === 403) {
    return {
      error: `football-data.org: Acceso denegado (403) — verifica tu plan o el código de competencia (${competitionCode})`,
      diagnostic: { ...baseDiag, success: false, statusCode: 403, errorMessage: 'Access denied — check plan or competition code' },
    };
  }

  if (res.status === 429) {
    return {
      error: 'football-data.org: Límite de peticiones alcanzado (429)',
      diagnostic: { ...baseDiag, success: false, statusCode: 429, errorMessage: 'Rate limit' },
    };
  }

  if (!res.ok) {
    return {
      error: `football-data.org: Error HTTP ${res.status}`,
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: `HTTP ${res.status}` },
    };
  }

  let data: { matches?: FDMatch[] };
  try {
    data = await res.json();
  } catch {
    return {
      error: 'football-data.org: Respuesta JSON inválida',
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: 'Invalid JSON' },
    };
  }

  if (!data?.matches || !Array.isArray(data.matches)) {
    return {
      error: 'football-data.org: Respuesta vacía o formato inesperado',
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: 'No matches array' },
    };
  }

  // Find the matching fixture by team codes
  const fdMatch = data.matches.find((m) => {
    const fdHome = normalizeTla(m.homeTeam.tla);
    const fdAway = normalizeTla(m.awayTeam.tla);
    return fdHome === match.homeTeamCode && fdAway === match.awayTeamCode;
  });

  if (!fdMatch) {
    return {
      error: `football-data.org: No se encontró partido ${match.homeTeamCode} vs ${match.awayTeamCode} el ${dateStr}`,
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: 'Match not found in response' },
    };
  }

  if (!['FINISHED', 'AWARDED'].includes(fdMatch.status)) {
    return {
      error: `football-data.org: Partido no finalizado. Estado: ${fdMatch.status}`,
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: `Match status: ${fdMatch.status}` },
    };
  }

  const homeScore = fdMatch.score.fullTime.home;
  const awayScore = fdMatch.score.fullTime.away;

  if (homeScore === null || awayScore === null) {
    return {
      error: 'football-data.org: Marcadores no disponibles aún',
      diagnostic: { ...baseDiag, success: false, statusCode: res.status, errorMessage: 'Null scores' },
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
    diagnostic: { ...baseDiag, success: true, statusCode: res.status },
  };
}
