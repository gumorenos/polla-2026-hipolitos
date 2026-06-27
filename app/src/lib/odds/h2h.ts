import { prisma } from '../db';
import { getProviderCooldown, setProviderCooldown } from './providers';
import { recordProviderResponseDiagnostic, resolveProviderApiKey } from '../provider-credentials';
import { recordProviderTeamNames } from '../team-alias-service';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}


export interface HeadToHeadStats {
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals: number;
  awayGoals: number;
  lastMatches: {
    date: string;
    competition: string;
    homeScore: number;
    awayScore: number;
    homeTeam: string;
    awayTeam: string;
  }[];
  provider: string;
}

interface ApiFootballFixture {
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  fixture: {
    date: string;
  };
  league: {
    name: string | null;
  };
}

// Static dictionary mapping FIFA 3-letter codes to API-Football team IDs
export const FIFA_TO_APIFOOTBALL_IDS: Record<string, number> = {
  ARG: 26,   // Argentina
  BRA: 6,    // Brazil
  FRA: 2,    // France
  GER: 25,   // Germany
  ENG: 10,   // England
  ESP: 9,    // Spain
  POR: 27,   // Portugal
  NED: 1118, // Netherlands
  BEL: 1,    // Belgium
  CRO: 3,    // Croatia
  URU: 7,    // Uruguay
  COL: 8,    // Colombia
  USA: 2384, // USA
  MEX: 16,   // Mexico
  CAN: 3326, // Canada
  ITA: 768,  // Italy
  JPN: 12,   // Japan
  SEN: 13,   // Senegal
  MAR: 31,   // Morocco
  ECU: 2382, // Ecuador
  PAR: 2386, // Paraguay
  PAN: 2385, // Panama
  CPV: 1515, // Cape Verde
  CUR: 3328, // Curacao
  JOR: 1530, // Jordan
  NZL: 2235, // New Zealand
  HAI: 3327, // Haiti
  UZB: 1533, // Uzbekistan
  QAT: 1562, // Qatar
  KOR: 17,   // South Korea / Korea Republic
  KSA: 23,   // Saudi Arabia
  AUS: 20,   // Australia
  EGY: 28,   // Egypt
  CIV: 29,   // Ivory Coast / Cote d'Ivoire
  GHA: 15,   // Ghana
  TUN: 24,   // Tunisia
  ALG: 32,   // Algeria
  SUI: 14,   // Switzerland
  AUT: 19,   // Austria
  TUR: 30,   // Turkey / Türkiye
  SWE: 11,   // Sweden
  NOR: 21,   // Norway
  CZE: 22,   // Czech Republic
  SCO: 282,  // Scotland
  IRI: 2324, // Iran (also IRN)
  IRN: 2324, // Iran alias
  RSA: 769,  // South Africa
  BIH: 1456, // Bosnia and Herzegovina
  COD: 1580, // DR Congo
  DRC: 1580, // DR Congo alias
  DZA: 32,   // Algeria alias (same as ALG)
};

// Generate simulated Head-to-Head stats for local testing
export function generateSimulatedH2H(homeCode: string, awayCode: string): HeadToHeadStats {
  const totalMatches = Math.floor(Math.random() * 8) + 3; // 3 to 10 historical matches
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let homeGoals = 0;
  let awayGoals = 0;

  const lastMatches = [];

  for (let i = 0; i < totalMatches; i++) {
    const year = 2026 - (i + 1) * 4 + Math.floor(Math.random() * 3); // realistic historical years
    const hScore = Math.floor(Math.random() * 4);
    const aScore = Math.floor(Math.random() * 4);

    homeGoals += hScore;
    awayGoals += aScore;

    if (hScore > aScore) homeWins++;
    else if (aScore > hScore) awayWins++;
    else draws++;

    lastMatches.push({
      date: `${year}-06-15`,
      competition: 'FIFA World Cup / Friendlies',
      homeScore: hScore,
      awayScore: aScore,
      homeTeam: homeCode,
      awayTeam: awayCode,
    });
  }

  return {
    totalMatches,
    homeWins,
    draws,
    awayWins,
    homeGoals,
    awayGoals,
    lastMatches,
    provider: 'simulator',
  };
}

// Dynamically look up an API-Football team ID using team code
export async function lookupTeamId(code: string, apiKey: string): Promise<number | null> {
  try {
    const url = `https://v3.football.api-sports.io/teams?code=${code}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'x-apisports-key': apiKey,
        'Accept': 'application/json',
      },
    }, 8000);
    await recordProviderResponseDiagnostic('api-football', res);
    if (res.status === 429) {
      await setProviderCooldown('api-football', 3600, 429, 'Rate limit exceeded');
      throw new Error('HTTP 429');
    }
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.errors) {
      const errStr = JSON.stringify(data.errors);
      if (errStr.toLowerCase().includes('rate limit') || errStr.toLowerCase().includes('429') || errStr.toLowerCase().includes('requests')) {
        await setProviderCooldown('api-football', 3600, 429, `Rate limit exceeded: ${errStr}`);
        throw new Error(`HTTP 429: ${errStr}`);
      }
    }
    if (data && data.response && data.response.length > 0) {
      await recordProviderTeamNames(
        'api-football',
        'team_lookup',
        data.response
          .map((entry: { team?: { name?: string } }) => entry.team?.name ?? '')
          .filter(Boolean),
      ).catch(() => undefined);
      await setProviderCooldown('api-football', 0, 200, null); // Clear cooldown
      return data.response[0].team.id;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('429')) {
      throw error;
    }
    console.error(`Error looking up API-Football team ID for ${code}:`, error);
  }
  return null;
}

// Track provider status/errors in-memory on the server
export let lastH2hError: string | null = null;
export function setLastH2hError(err: string | null) {
  lastH2hError = err;
}

function redactApiKey(msg: string, key?: string): string {
  if (!key) return msg;
  return msg.split(key).join('REDACTED');
}

// Get Head to Head stats for a match
export async function getHeadToHeadStats(matchId: string, bypassCooldown = false): Promise<HeadToHeadStats | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    throw new Error(`Match with ID ${matchId} not found`);
  }

  const credential = await resolveProviderApiKey('api-football');
  const isEnabled = credential.configured;
  const apiKey = credential.apiKey;
  const allowSimulation = process.env.NODE_ENV !== 'production' && process.env.ODDS_ALLOW_SIMULATED_DATA === 'true';

  if (!isEnabled || !apiKey) {
    if (allowSimulation) {
      return generateSimulatedH2H(match.homeTeamCode, match.awayTeamCode);
    }
    setLastH2hError('API-Football H2H no está habilitado o no está configurado.');
    return null;
  }

  // Cooldown check
  const cooldown = bypassCooldown ? null : await getProviderCooldown('api-football');
  if (cooldown) {
    const msg = `API-Football está en cooldown hasta ${cooldown.toLocaleString('es-PE', { timeZone: 'America/Lima' })}`;
    console.warn(msg);
    setLastH2hError(msg);
    if (allowSimulation) {
      return generateSimulatedH2H(match.homeTeamCode, match.awayTeamCode);
    }
    return null;
  }

  try {
    // 1. Resolve home team ID
    let homeId = FIFA_TO_APIFOOTBALL_IDS[match.homeTeamCode];
    if (!homeId) {
      const lookedUp = await lookupTeamId(match.homeTeamCode, apiKey);
      if (lookedUp) homeId = lookedUp;
    }

    // 2. Resolve away team ID
    let awayId = FIFA_TO_APIFOOTBALL_IDS[match.awayTeamCode];
    if (!awayId) {
      const lookedUp = await lookupTeamId(match.awayTeamCode, apiKey);
      if (lookedUp) awayId = lookedUp;
    }

    if (!homeId || !awayId) {
      const msg = `Could not resolve API-Football IDs for ${match.homeTeamCode} or ${match.awayTeamCode}`;
      console.warn(msg);
      if (allowSimulation) {
        return generateSimulatedH2H(match.homeTeamCode, match.awayTeamCode);
      }
      setLastH2hError(msg);
      return null;
    }

    // 3. Query H2H endpoint
    const url = `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeId}-${awayId}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'x-apisports-key': apiKey,
        'Accept': 'application/json',
      },
    }, 8000);
    await recordProviderResponseDiagnostic('api-football', res);

    if (res.status === 429) {
      await setProviderCooldown('api-football', 3600, 429, 'Rate limit exceeded');
      throw new Error('HTTP 429');
    }

    if (!res.ok) {
      const msg = `API-Football H2H request failed with status ${res.status}`;
      console.warn(msg);
      if (allowSimulation) {
        return generateSimulatedH2H(match.homeTeamCode, match.awayTeamCode);
      }
      setLastH2hError(msg);
      return null;
    }

    const data = await res.json();
    if (data && data.errors) {
      const errStr = JSON.stringify(data.errors);
      if (errStr.toLowerCase().includes('rate limit') || errStr.toLowerCase().includes('429') || errStr.toLowerCase().includes('requests')) {
        await setProviderCooldown('api-football', 3600, 429, `Rate limit exceeded: ${errStr}`);
        throw new Error(`HTTP 429: ${errStr}`);
      }
    }

    if (!data || !data.response || !Array.isArray(data.response)) {
      const msg = 'API-Football H2H response format invalid';
      console.warn(msg);
      if (allowSimulation) {
        return generateSimulatedH2H(match.homeTeamCode, match.awayTeamCode);
      }
      setLastH2hError(msg);
      return null;
    }

    const fixtures = data.response as ApiFootballFixture[];
    await recordProviderTeamNames(
      'api-football',
      'h2h_fixture',
      fixtures.flatMap((fixture) => [fixture.teams.home.name, fixture.teams.away.name]),
    ).catch(() => undefined);
    
    // Parse fixtures relative to homeId
    const parsedFixtures = fixtures.map((f) => {
      const isHomeTeamFixture = f.teams.home.id === homeId;
      const goalsHome = f.goals.home ?? 0;
      const goalsAway = f.goals.away ?? 0;
      const relativeHomeGoals = isHomeTeamFixture ? goalsHome : goalsAway;
      const relativeAwayGoals = isHomeTeamFixture ? goalsAway : goalsHome;
      
      const dateObj = new Date(f.fixture.date);
      const year = dateObj.getFullYear();

      return {
        date: f.fixture.date.split('T')[0],
        timestamp: dateObj.getTime(),
        year,
        competition: f.league.name || 'International',
        homeScore: relativeHomeGoals,
        awayScore: relativeAwayGoals,
        homeTeam: match.homeTeamCode,
        awayTeam: match.awayTeamCode,
      };
    });

    // Sort descending by date (latest first)
    parsedFixtures.sort((a, b) => b.timestamp - a.timestamp);

    // Apply H2H rules: prefer direct match history from 2010 onward (up to 5)
    // If fewer than 5 exist from 2010 onward, display latest 5 regardless of age.
    const matchesFrom2010 = parsedFixtures.filter((f) => f.year >= 2010);
    
    let selectedFixtures: typeof parsedFixtures = [];
    if (matchesFrom2010.length >= 5) {
      selectedFixtures = matchesFrom2010.slice(0, 5);
    } else {
      selectedFixtures = parsedFixtures.slice(0, 5);
    }

    const totalMatches = selectedFixtures.length;
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;
    let homeGoals = 0;
    let awayGoals = 0;

    selectedFixtures.forEach((f) => {
      homeGoals += f.homeScore;
      awayGoals += f.awayScore;
      if (f.homeScore > f.awayScore) homeWins++;
      else if (f.awayScore > f.homeScore) awayWins++;
      else draws++;
    });

    const lastMatches = selectedFixtures.map(f => ({
      date: f.date,
      competition: f.competition,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
    }));

    setLastH2hError(null);
    await setProviderCooldown('api-football', 0, 200, null); // Clear cooldown
    return {
      totalMatches,
      homeWins,
      draws,
      awayWins,
      homeGoals,
      awayGoals,
      lastMatches,
      provider: 'api-football',
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('429')) {
      throw error;
    }
    const rawMsg = `Error fetching Head-to-Head from API-Football: ${error instanceof Error ? error.message : String(error)}`;
    const msg = redactApiKey(rawMsg, apiKey);
    console.error(msg);
    if (allowSimulation) {
      return generateSimulatedH2H(match.homeTeamCode, match.awayTeamCode);
    }
    setLastH2hError(msg);
    return null;
  }
}

// Save Head-to-Head snapshot to the database
export async function saveHeadToHeadSnapshot(matchId: string, stats: HeadToHeadStats) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  const snapshot = await prisma.headToHeadSnapshot.upsert({
    where: { matchId },
    update: {
      provider: stats.provider,
      homeTeamCode: match.homeTeamCode,
      awayTeamCode: match.awayTeamCode,
      totalMatches: stats.totalMatches,
      homeWins: stats.homeWins,
      draws: stats.draws,
      awayWins: stats.awayWins,
      homeGoals: stats.homeGoals,
      awayGoals: stats.awayGoals,
      lastMatchesJson: JSON.stringify(stats.lastMatches),
      capturedAt: new Date(),
    },
    create: {
      matchId,
      provider: stats.provider,
      homeTeamCode: match.homeTeamCode,
      awayTeamCode: match.awayTeamCode,
      totalMatches: stats.totalMatches,
      homeWins: stats.homeWins,
      draws: stats.draws,
      awayWins: stats.awayWins,
      homeGoals: stats.homeGoals,
      awayGoals: stats.awayGoals,
      lastMatchesJson: JSON.stringify(stats.lastMatches),
    },
  });

  return snapshot;
}
