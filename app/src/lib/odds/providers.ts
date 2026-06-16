import { prisma } from '../db';

export async function getProviderCooldown(provider: string): Promise<Date | null> {
  try {
    const status = await prisma.providerStatus.findUnique({
      where: { provider },
    });
    if (status && status.cooldownUntil > new Date()) {
      return status.cooldownUntil;
    }
  } catch (error) {
    console.error(`Error checking cooldown for ${provider}:`, error);
  }
  return null;
}

export async function setProviderCooldown(
  provider: string,
  cooldownSeconds: number,
  status: number,
  errorMessage: string | null
) {
  const cooldownUntil = new Date(Date.now() + cooldownSeconds * 1000);
  try {
    await prisma.providerStatus.upsert({
      where: { provider },
      update: {
        cooldownUntil,
        lastStatus: status,
        lastErrorMessage: errorMessage,
        updatedAt: new Date(),
      },
      create: {
        provider,
        cooldownUntil,
        lastStatus: status,
        lastErrorMessage: errorMessage,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`Error setting cooldown for ${provider}:`, error);
  }
}

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


export interface MatchOdds {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  bookmaker: string;
  provider: string;
  sourceType: 'api' | 'manual';
  rawPayload?: string;
}

interface ProviderEvent {
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    title: string;
    markets: {
      key: string;
      outcomes: {
        name: string;
        price: number;
      }[];
    }[];
  }[];
}

// Map of team codes to common English/Spanish names for matching API data
export const TEAM_NAMES_MAP: Record<string, string[]> = {
  ARG: ['Argentina'],
  BRA: ['Brazil', 'Brasil'],
  FRA: ['France', 'Francia'],
  ESP: ['Spain', 'España'],
  GER: ['Germany', 'Alemania'],
  ENG: ['England', 'Inglaterra'],
  POR: ['Portugal'],
  NED: ['Netherlands', 'Países Bajos', 'Holland'],
  BEL: ['Belgium', 'Bélgica'],
  CRO: ['Croatia', 'Croacia'],
  URU: ['Uruguay'],
  COL: ['Colombia'],
  USA: ['USA', 'United States', 'Estados Unidos'],
  MEX: ['Mexico', 'México'],
  CAN: ['Canada', 'Canadá'],
  ITA: ['Italy', 'Italia'],
  JPN: ['Japan', 'Japón'],
  SEN: ['Senegal'],
  MAR: ['Morocco', 'Marruecos'],
  ECU: ['Ecuador'],
  PAR: ['Paraguay'],
  PAN: ['Panama', 'Panamá'],
  CPV: ['Cape Verde', 'Cabo Verde'],
  CUR: ['Curacao', 'Curazao', 'Curaçao'],
  CUW: ['Curacao', 'Curazao', 'Curaçao'],
  JOR: ['Jordan', 'Jordania'],
  NZL: ['New Zealand', 'Nueva Zelanda'],
  HAI: ['Haiti', 'Haití'],
  UZB: ['Uzbekistan', 'Uzbekistán'],
  QAT: ['Qatar'],
  KOR: ['South Korea', 'Corea del Sur', 'Korea Republic'],
  KSA: ['Saudi Arabia', 'Arabia Saudita'],
  AUS: ['Australia'],
  EGY: ['Egypt', 'Egipto'],
  CIV: ['Ivory Coast', 'Costa de Marfil', "Côte d'Ivoire", "Cote d'Ivoire", 'Cote dIvoire'],
  GHA: ['Ghana'],
  TUN: ['Tunisia', 'Túnez'],
  ALG: ['Algeria', 'Argelia'],
  DZA: ['Algeria', 'Argelia'],
  SUI: ['Switzerland', 'Suiza'],
  AUT: ['Austria'],
  TUR: ['Turkey', 'Türkiye'],
  SWE: ['Sweden', 'Suecia'],
  NOR: ['Norway', 'Noruega'],
  CZE: ['Czech Republic', 'Chequia', 'Czechia'],
  SCO: ['Scotland', 'Escocia'],
  IRI: ['Iran', 'Irán'],
  IRN: ['Iran', 'Irán'],
  IRQ: ['Iraq', 'Irak'],
  COD: ['DR Congo', 'Congo DR', 'Congo Democrático', 'Congo, Democratic Republic of the', 'Democratic Republic of the Congo'],
  BIH: ['Bosnia', 'Bosnia and Herzegovina', 'Bosnia-Herzegovina', 'Bosnia & Herzegovina', 'Bosnia Herzegovina', 'Bosnia y Herzegovina'],
  RSA: ['South Africa', 'Sudáfrica']
};

// Normalize team name according to rules
export function normalizeTeamName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents/diacritics
    .replace(/&/g, 'and')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if a team name matches a team code
export function matchTeamName(teamName: string, code: string): boolean {
  if (!teamName || !code) return false;
  const normInput = normalizeTeamName(teamName);
  const normCode = normalizeTeamName(code);
  if (normInput === normCode) return true;

  const allowedNames = TEAM_NAMES_MAP[code] || [];
  return allowedNames.some(name => normalizeTeamName(name) === normInput);
}

// Generate mock odds for simulation fallback
export function generateSimulatedOdds(homeCode: string, awayCode: string): MatchOdds {
  // Simple strength rating for simulation
  const strength: Record<string, number> = {
    ARG: 95, BRA: 94, FRA: 93, ESP: 92, ENG: 91, GER: 90, POR: 89, NED: 88,
    BEL: 87, URU: 86, COL: 86, CRO: 85, ITA: 85, USA: 80, MEX: 78, CAN: 75,
    JPN: 82, SEN: 81, MAR: 83, SUI: 82, AUT: 80, ECU: 79, PAR: 76, PER: 75
  };

  const homeStrength = strength[homeCode] || 70;
  const awayStrength = strength[awayCode] || 70;

  const diff = homeStrength - awayStrength;
  let homeOdds = 2.3;
  let drawOdds = 3.2;
  let awayOdds = 2.9;

  if (diff > 20) {
    // Strong home favorite
    homeOdds = 1.35 + Math.random() * 0.1;
    drawOdds = 4.2 + Math.random() * 0.5;
    awayOdds = 7.5 + Math.random() * 1.5;
  } else if (diff > 10) {
    // Moderate home favorite
    homeOdds = 1.65 + Math.random() * 0.15;
    drawOdds = 3.6 + Math.random() * 0.3;
    awayOdds = 4.8 + Math.random() * 0.8;
  } else if (diff < -20) {
    // Strong away favorite
    homeOdds = 7.5 + Math.random() * 1.5;
    drawOdds = 4.2 + Math.random() * 0.5;
    awayOdds = 1.35 + Math.random() * 0.1;
  } else if (diff < -10) {
    // Moderate away favorite
    homeOdds = 4.8 + Math.random() * 0.8;
    drawOdds = 3.6 + Math.random() * 0.3;
    awayOdds = 1.65 + Math.random() * 0.15;
  } else {
    // Evenly matched
    homeOdds = 2.2 + Math.random() * 0.3;
    drawOdds = 3.0 + Math.random() * 0.2;
    awayOdds = 2.4 + Math.random() * 0.4;
  }

  // Round to 2 decimals
  return {
    homeOdds: Math.round(homeOdds * 100) / 100,
    drawOdds: Math.round(drawOdds * 100) / 100,
    awayOdds: Math.round(awayOdds * 100) / 100,
    bookmaker: 'LaPolla 2026 Simulator',
    provider: 'simulator',
    sourceType: 'manual',
    rawPayload: JSON.stringify({ simulated: true, generatedAt: new Date() }),
  };
}

// Track provider status/errors in-memory on the server
export let lastOddsError: string | null = null;
export function setLastOddsError(err: string | null) {
  lastOddsError = err;
}

function redactApiKey(msg: string, keys: string[]): string {
  let output = msg;
  for (const key of keys) {
    if (key && key.trim().length > 3) {
      output = output.split(key).join('REDACTED');
    }
  }
  return output;
}

// Caching active football leagues for Odds-API.io
let discoveredOddsApiIoLeaguesCache: string[] | null = null;

async function discoverOddsApiIoLeagues(apiKey: string, sport: string): Promise<string[]> {
  if (discoveredOddsApiIoLeaguesCache) return discoveredOddsApiIoLeaguesCache;
  try {
    const url = `https://api.odds-api.io/v3/leagues?apiKey=${apiKey}&sport=${sport}`;
    const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 8000);
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      const msg = `Odds-API.io leagues discovery failed with status ${res.status}: ${errorText}`;
      console.warn(redactApiKey(msg, [apiKey]));
      if (res.status === 429) {
        const match = errorText.match(/resets in (\d+) minutes/i);
        const minutes = match ? parseInt(match[1], 10) : 60;
        await setProviderCooldown('odds-api-io', minutes * 60, 429, redactApiKey(errorText || 'Rate limit exceeded', [apiKey]));
      }
      return [];
    }
    const data = await res.json();
    if (data && Array.isArray(data.data)) {
      const slugs = data.data.map((l: { slug: string }) => l.slug).filter(Boolean);
      discoveredOddsApiIoLeaguesCache = slugs;
      return slugs;
    }
  } catch (error) {
    const rawMsg = `Error in discoverOddsApiIoLeagues: ${error instanceof Error ? error.message : String(error)}`;
    console.error(redactApiKey(rawMsg, [apiKey]));
  }
  return [];
}

// Fetch odds from Odds-API.io (Primary)
async function fetchOddsApiIo(homeCode: string, awayCode: string, apiKey: string, matchId: string): Promise<MatchOdds | null> {
  const sport = process.env.ODDS_API_IO_SPORT || 'football';
  const leagueConf = process.env.ODDS_API_IO_LEAGUE || '';

  const leaguesToQuery: string[] = [];
  if (leagueConf) {
    leaguesToQuery.push(leagueConf);
  } else {
    const discovered = await discoverOddsApiIoLeagues(apiKey, sport);
    // Sort so cup, world cup, and international slugs are queried first
    const keywords = ['world-cup', 'worldcup', 'fifa', 'international', 'friendly', 'friendlies', 'cup', 'soccer'];
    const sorted = [...discovered].sort((a, b) => {
      const aVal = keywords.some(k => a.toLowerCase().includes(k)) ? 1 : 0;
      const bVal = keywords.some(k => b.toLowerCase().includes(k)) ? 1 : 0;
      return bVal - aVal;
    });
    leaguesToQuery.push(...sorted.slice(0, 5));
  }

  if (leaguesToQuery.length === 0) {
    setLastOddsError('No leagues found/configured for Odds-API.io.');
    return null;
  }

  const allProviderEventsChecked: string[] = [];

  for (const leagueSlug of leaguesToQuery) {
    try {
      const url = `https://api.odds-api.io/v3/odds?apiKey=${apiKey}&sport=${sport}&league=${leagueSlug}`;
      const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 8000);
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        const msg = `Odds-API.io responded with status ${res.status} for league ${leagueSlug}: ${errorText}`;
        console.warn(redactApiKey(msg, [apiKey]));
        setLastOddsError(redactApiKey(msg, [apiKey]));
        if (res.status === 429) {
          const match = errorText.match(/resets in (\d+) minutes/i);
          const minutes = match ? parseInt(match[1], 10) : 60;
          await setProviderCooldown('odds-api-io', minutes * 60, 429, redactApiKey(errorText || 'Rate limit exceeded', [apiKey]));
        }
        continue;
      }
      const data = await res.json();
      if (!data || !data.data || !Array.isArray(data.data)) {
        continue;
      }

      const events = data.data as ProviderEvent[];
      allProviderEventsChecked.push(...events.map(e => `${e.home_team} vs ${e.away_team}`));

      const event = events.find((e) => {
        const homeMatch = matchTeamName(e.home_team, homeCode) || matchTeamName(e.home_team, awayCode);
        const awayMatch = matchTeamName(e.away_team, homeCode) || matchTeamName(e.away_team, awayCode);
        return homeMatch && awayMatch;
      });

      if (!event || !event.bookmakers || event.bookmakers.length === 0) {
        continue;
      }

      const bookmaker = event.bookmakers[0];
      const market = bookmaker.markets?.find((m) => m.key === 'h2h' || m.key === '1x2');
      if (!market || !market.outcomes || market.outcomes.length < 3) {
        continue;
      }

      let homeOdds = 0;
      let drawOdds = 0;
      let awayOdds = 0;

      for (const outcome of market.outcomes) {
        if (matchTeamName(outcome.name, homeCode)) {
          homeOdds = outcome.price;
        } else if (matchTeamName(outcome.name, awayCode)) {
          awayOdds = outcome.price;
        } else if (outcome.name.toLowerCase() === 'draw' || outcome.name.toLowerCase() === 'empate') {
          drawOdds = outcome.price;
        }
      }

      if (homeOdds && drawOdds && awayOdds) {
        setLastOddsError(null);
        await setProviderCooldown('odds-api-io', 0, 200, null); // Clear cooldown
        return {
          homeOdds,
          drawOdds,
          awayOdds,
          bookmaker: bookmaker.title || bookmaker.key || 'Unknown Bookmaker',
          provider: 'odds-api-io',
          sourceType: 'api',
          rawPayload: JSON.stringify(event),
        };
      }
    } catch (error) {
      const rawMsg = `Error in fetchOddsApiIo for league ${leagueSlug}: ${error instanceof Error ? error.message : String(error)}`;
      const msg = redactApiKey(rawMsg, [apiKey]);
      console.error(msg);
      setLastOddsError(msg);
    }
  }

  // Diagnostic logging when matching fails across all checked leagues
  console.warn(`[DIAGNOSTIC] Odds matching failed for match ${matchId} (${homeCode} vs ${awayCode}).
    Provider: odds-api-io
    Local aliases for ${homeCode}: [${(TEAM_NAMES_MAP[homeCode] || []).join(', ')}]
    Local aliases for ${awayCode}: [${(TEAM_NAMES_MAP[awayCode] || []).join(', ')}]
    Provider events checked: [${allProviderEventsChecked.join(' | ')}]`);

  setLastOddsError(`Odds-API.io could not find matching event for ${homeCode} vs ${awayCode} in checked leagues.`);
  return null;
}

// Caching active sports keys for The Odds API
let discoveredTheOddsApiSportsCache: string[] | null = null;

async function verifyTheOddsApiSportKey(apiKey: string, sportKey: string): Promise<boolean> {
  if (discoveredTheOddsApiSportsCache) {
    return discoveredTheOddsApiSportsCache.includes(sportKey);
  }
  try {
    const url = `https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      const msg = `The Odds API sports list request failed with status ${res.status}: ${errorText}`;
      console.warn(redactApiKey(msg, [apiKey]));
      if (res.status === 429) {
        await setProviderCooldown('the-odds-api', 3600, 429, redactApiKey(errorText || 'Rate limit exceeded', [apiKey]));
      }
      return false;
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      const keys = data.map((s: { key: string }) => s.key).filter(Boolean);
      discoveredTheOddsApiSportsCache = keys;
      return keys.includes(sportKey);
    }
  } catch (error) {
    const rawMsg = `Error in verifyTheOddsApiSportKey: ${error instanceof Error ? error.message : String(error)}`;
    console.error(redactApiKey(rawMsg, [apiKey]));
  }
  return false;
}

// Fetch odds from The Odds API (Fallback)
async function fetchTheOddsApi(homeCode: string, awayCode: string, apiKey: string, matchId: string): Promise<MatchOdds | null> {
  const sportKey = process.env.THE_ODDS_API_SPORT_KEY || 'soccer_fifa_world_cup';
  const regions = process.env.THE_ODDS_API_REGIONS || 'eu,uk,us';
  const markets = process.env.THE_ODDS_API_MARKETS || 'h2h';

  try {
    // Verify sport availability first
    const isSportAvailable = await verifyTheOddsApiSportKey(apiKey, sportKey);
    if (!isSportAvailable) {
      const msg = `provider has no market data yet: Sport key ${sportKey} is not available.`;
      console.warn(msg);
      setLastOddsError(msg);
      return null;
    }

    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=${regions}&markets=${markets}`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      const msg = `The Odds API responded with status ${res.status}: ${errorText}`;
      console.warn(redactApiKey(msg, [apiKey]));
      setLastOddsError(redactApiKey(msg, [apiKey]));
      if (res.status === 429) {
        await setProviderCooldown('the-odds-api', 3600, 429, redactApiKey(errorText || 'Rate limit exceeded', [apiKey]));
      }
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      setLastOddsError('The Odds API response is not an array');
      return null;
    }

    const events = data as ProviderEvent[];
    const event = events.find((e) => {
      const homeMatch = matchTeamName(e.home_team, homeCode) || matchTeamName(e.home_team, awayCode);
      const awayMatch = matchTeamName(e.away_team, homeCode) || matchTeamName(e.away_team, awayCode);
      return homeMatch && awayMatch;
    });

    if (!event || !event.bookmakers || event.bookmakers.length === 0) {
      // Diagnostic logging when event matching fails
      const providerTeams = events.map(e => `${e.home_team} vs ${e.away_team}`);
      console.warn(`[DIAGNOSTIC] Odds matching failed for match ${matchId} (${homeCode} vs ${awayCode}).
        Provider: the-odds-api
        Local aliases for ${homeCode}: [${(TEAM_NAMES_MAP[homeCode] || []).join(', ')}]
        Local aliases for ${awayCode}: [${(TEAM_NAMES_MAP[awayCode] || []).join(', ')}]
        Provider events checked: [${providerTeams.join(' | ')}]`);

      setLastOddsError(`The Odds API event not found for ${homeCode} vs ${awayCode}`);
      return null;
    }

    const bookmaker = event.bookmakers[0];
    const market = bookmaker.markets?.find((m) => m.key === 'h2h');
    if (!market || !market.outcomes || market.outcomes.length < 3) {
      setLastOddsError(`The Odds API outcomes not found for ${homeCode} vs ${awayCode}`);
      return null;
    }

    let homeOdds = 0;
    let drawOdds = 0;
    let awayOdds = 0;

    for (const outcome of market.outcomes) {
      if (matchTeamName(outcome.name, homeCode)) {
        homeOdds = outcome.price;
      } else if (matchTeamName(outcome.name, awayCode)) {
        awayOdds = outcome.price;
      } else if (outcome.name.toLowerCase() === 'draw' || outcome.name.toLowerCase() === 'empate') {
        drawOdds = outcome.price;
      }
    }

    if (homeOdds && drawOdds && awayOdds) {
      setLastOddsError(null);
      await setProviderCooldown('the-odds-api', 0, 200, null); // Clear cooldown
      return {
        homeOdds,
        drawOdds,
        awayOdds,
        bookmaker: bookmaker.title || bookmaker.key || 'Unknown Bookmaker',
        provider: 'the-odds-api',
        sourceType: 'api',
        rawPayload: JSON.stringify(event),
      };
    } else {
      setLastOddsError(`The Odds API could not extract home, draw or away odds for ${homeCode} vs ${awayCode}`);
    }
  } catch (error) {
    const rawMsg = `Error in fetchTheOddsApi: ${error instanceof Error ? error.message : String(error)}`;
    const msg = redactApiKey(rawMsg, [apiKey]);
    console.error(msg);
    setLastOddsError(msg);
  }
  return null;
}


// Fetch odds using the configured settings and providers
export async function getMatchWinnerOdds(matchId: string, bypassCooldown = false): Promise<MatchOdds | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    throw new Error(`Match with ID ${matchId} not found`);
  }

  const primaryProvider = process.env.ODDS_PRIMARY_PROVIDER || 'odds-api-io';
  const fallbackProvider = process.env.ODDS_FALLBACK_PROVIDER || 'the-odds-api';

  const isPrimaryEnabled = process.env.ODDS_API_IO_ENABLED === 'true';
  const primaryKey = process.env.ODDS_API_IO_KEY;
  const isFallbackEnabled = process.env.THE_ODDS_API_ENABLED === 'true';
  const fallbackKey = process.env.THE_ODDS_API_KEY;

  let result: MatchOdds | null = null;
  let primaryFailed = false;

  const primaryCooldown = bypassCooldown ? null : await getProviderCooldown(primaryProvider);
  const fallbackCooldown = bypassCooldown ? null : await getProviderCooldown(fallbackProvider);

  // 1. Try Primary Provider if not cooling down
  if (primaryProvider === 'odds-api-io' && isPrimaryEnabled && primaryKey) {
    if (primaryCooldown) {
      console.log(`Bypassing Odds-API.io (primary) because it is cooling down until ${primaryCooldown.toISOString()}`);
      primaryFailed = true;
    } else {
      result = await fetchOddsApiIo(match.homeTeamCode, match.awayTeamCode, primaryKey, matchId);
      if (!result) primaryFailed = true;
    }
  } else if (primaryProvider === 'the-odds-api' && isFallbackEnabled && fallbackKey) {
    if (primaryCooldown) {
      console.log(`Bypassing The Odds API (primary) because it is cooling down until ${primaryCooldown.toISOString()}`);
      primaryFailed = true;
    } else {
      result = await fetchTheOddsApi(match.homeTeamCode, match.awayTeamCode, fallbackKey, matchId);
      if (!result) primaryFailed = true;
    }
  }

  // 2. Try Fallback Provider if primary failed
  if (!result && primaryFailed) {
    if (fallbackProvider === 'the-odds-api' && isFallbackEnabled && fallbackKey) {
      if (fallbackCooldown) {
        console.log(`Bypassing The Odds API (fallback) because it is cooling down until ${fallbackCooldown.toISOString()}`);
      } else {
        result = await fetchTheOddsApi(match.homeTeamCode, match.awayTeamCode, fallbackKey, matchId);
      }
    } else if (fallbackProvider === 'odds-api-io' && isPrimaryEnabled && primaryKey) {
      if (fallbackCooldown) {
        console.log(`Bypassing Odds-API.io (fallback) because it is cooling down until ${fallbackCooldown.toISOString()}`);
      } else {
        result = await fetchOddsApiIo(match.homeTeamCode, match.awayTeamCode, primaryKey, matchId);
      }
    }
  }

  // 3. Fallback to Simulation if both failed or if keys/enabled checks failed
  if (!result) {
    if (process.env.NODE_ENV !== 'production' && process.env.ODDS_ALLOW_SIMULATED_DATA === 'true') {
      result = generateSimulatedOdds(match.homeTeamCode, match.awayTeamCode);
    } else {
      if (!lastOddsError) {
        setLastOddsError('No hay proveedores reales configurados o todos fallaron. Datos simulados desactivados.');
      }
    }
  }

  return result;
}

// Normalize decimal odds and save snapshots to SQLite
export async function saveOddsSnapshot(
  matchId: string,
  oddsData: MatchOdds,
  options: { visibility: 'global' | 'user_private'; userId?: string }
) {
  const { homeOdds, drawOdds, awayOdds, bookmaker, provider, sourceType, rawPayload } = oddsData;

  // Implied probabilities (1 / decimalOdds)
  const impliedHome = 1 / homeOdds;
  const impliedDraw = 1 / drawOdds;
  const impliedAway = 1 / awayOdds;
  const sum = impliedHome + impliedDraw + impliedAway;

  // Normalized to 100%
  const normHome = impliedHome / sum;
  const normDraw = impliedDraw / sum;
  const normAway = impliedAway / sum;

  const capturedAt = new Date();

  // Find match to reference team codes
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  // We write three outcome records: home, draw, away
  const outcomes = [
    {
      outcomeType: 'home',
      teamCode: match.homeTeamCode,
      outcomeLabel: match.homeTeamCode, // Label can be the code or Spanish name (we use code for match)
      decimalOdds: homeOdds,
      impliedProbability: impliedHome,
      normalizedProbability: normHome,
    },
    {
      outcomeType: 'draw',
      teamCode: null,
      outcomeLabel: 'Empate',
      decimalOdds: drawOdds,
      impliedProbability: impliedDraw,
      normalizedProbability: normDraw,
    },
    {
      outcomeType: 'away',
      teamCode: match.awayTeamCode,
      outcomeLabel: match.awayTeamCode,
      decimalOdds: awayOdds,
      impliedProbability: impliedAway,
      normalizedProbability: normAway,
    },
  ];

  // We create them in a transaction or individually
  const createdSnapshots = await prisma.$transaction(
    outcomes.map((o) =>
      prisma.oddsSnapshot.create({
        data: {
          matchId,
          provider,
          bookmaker,
          marketType: 'match_winner',
          outcomeType: o.outcomeType,
          teamCode: o.teamCode,
          outcomeLabel: o.outcomeLabel,
          decimalOdds: o.decimalOdds,
          impliedProbability: o.impliedProbability,
          normalizedProbability: o.normalizedProbability,
          capturedAt,
          visibility: options.visibility,
          userId: options.userId || null,
          sourceType,
          rawPayload,
        },
      })
    )
  );

  return createdSnapshots;
}
