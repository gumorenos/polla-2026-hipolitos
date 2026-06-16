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
  starts_at?: string | number;
  commence_time?: string | number;
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

export interface OddsMatchInfo {
  id: string;
  kickoffUtc: Date | number;
  homeTeamCode: string;
  awayTeamCode: string;
  homeTeamName: string;
  awayTeamName: string;
  debugMatch?: boolean;
}

interface DiagnosticRecord {
  league?: string;
  eventHome: string;
  eventAway: string;
  eventHomeNorm: string;
  eventAwayNorm: string;
  eventTime: string;
  matches: boolean;
  isFuzzy?: boolean;
  isReverse?: boolean;
  scoreHome?: number;
  scoreAway?: number;
  reason: string;
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
  BIH: [
    'Bosnia and Herzegovina',
    'Bosnia & Herzegovina',
    'Bosnia-Herzegovina',
    'Bosnia Herzegovina',
    'Bosnia',
    'Bosnia and Herz.',
    'Bosnia Herz.',
    'Bosna i Hercegovina',
    'Bosnie-Herzégovine',
    'Bosnia y Herzegovina',
    'Bosnia y Herzeg.',
    'Bosnia-Herz.'
  ],
  RSA: ['South Africa', 'Sudáfrica']
};

// Normalize team name according to rules
export function normalizeTeamName(name: string): string {
  if (!name) return '';
  let normalized = name.toLowerCase().trim();
  
  // Remove accents/diacritics
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Replace & with and
  normalized = normalized.replace(/&/g, 'and');
  
  // Replace hyphens with spaces
  normalized = normalized.replace(/-/g, ' ');
  
  // Remove periods
  normalized = normalized.replace(/\./g, '');

  // Strip single quotes and apostrophes
  normalized = normalized.replace(/['`’]/g, '');

  // Normalize herzeg / herzeg. / herz to herzegovina
  normalized = normalized.replace(/\bherz\w*\b/g, 'herzegovina');

  // Normalize country articles/punctuation/common prefixes if present
  normalized = normalized.replace(/\b(democratic\s+)?republic\s+of\b/gi, '');
  normalized = normalized.replace(/\bde\s+la\b/gi, '');
  normalized = normalized.replace(/\bde\b/gi, '');
  normalized = normalized.replace(/\bthe\b/gi, '');
  normalized = normalized.replace(/\brep\b/gi, '');
  
  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized.trim();
}

// Check if a team name matches a team code using exact alias matching
export function matchTeamName(teamName: string, code: string): boolean {
  if (!teamName || !code) return false;
  const normInput = normalizeTeamName(teamName);
  const normCode = normalizeTeamName(code);
  if (normInput === normCode) return true;

  const allowedNames = TEAM_NAMES_MAP[code] || [];
  return allowedNames.some(name => normalizeTeamName(name) === normInput);
}

// Sørensen-Dice similarity score helper
export function getSimilarityScore(str1: string, str2: string): number {
  const s1 = normalizeTeamName(str1);
  const s2 = normalizeTeamName(str2);
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) {
      intersection++;
    }
  }

  return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}

// Parse event start time in ms
export function getEventTimeMs(e: ProviderEvent): number | null {
  const timeVal = e.starts_at ?? e.commence_time;
  if (!timeVal) return null;
  if (typeof timeVal === 'number') {
    return timeVal < 9999999999 ? timeVal * 1000 : timeVal;
  }
  if (typeof timeVal === 'string') {
    const parsed = Date.parse(timeVal);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

// Matches a provider event to our local match fixture
export function matchEventToFixture(
  event: ProviderEvent,
  homeCode: string,
  awayCode: string,
  matchKickoffUtc: Date | number,
  _debugMatch = false
): { 
  matches: boolean; 
  reason?: string; 
  isFuzzy?: boolean; 
  isReverse?: boolean;
  scoreHome?: number; 
  scoreAway?: number; 
} {
  const eventHome = event.home_team;
  const eventAway = event.away_team;

  // 1. Try Exact Alias Matching first
  const homeMatchesExactDirect = matchTeamName(eventHome, homeCode);
  const awayMatchesExactDirect = matchTeamName(eventAway, awayCode);

  const homeMatchesExactReverse = matchTeamName(eventHome, awayCode);
  const awayMatchesExactReverse = matchTeamName(eventAway, homeCode);

  if (homeMatchesExactDirect && awayMatchesExactDirect) {
    return { matches: true, isFuzzy: false, isReverse: false };
  }
  if (homeMatchesExactReverse && awayMatchesExactReverse) {
    return { matches: true, isFuzzy: false, isReverse: true };
  }

  // 2. Fuzzy Matching Fallback (only within same match window +/- 12 hours)
  const eventTimeMs = getEventTimeMs(event);
  const matchTimeMs = typeof matchKickoffUtc === 'number' ? matchKickoffUtc : matchKickoffUtc.getTime();

  if (!eventTimeMs) {
    return { matches: false, reason: "Event has no kickoff time/date for fallback validation" };
  }

  const timeDiffHours = Math.abs(eventTimeMs - matchTimeMs) / (1000 * 60 * 60);
  if (timeDiffHours > 12) {
    return { matches: false, reason: `Kickoff time difference is too large (${timeDiffHours.toFixed(1)} hours, max 12 hours)` };
  }

  const threshold = 0.65;

  const getMaxSimilarity = (name: string, code: string): number => {
    const normName = normalizeTeamName(name);
    const normCode = normalizeTeamName(code);
    let maxScore = getSimilarityScore(normName, normCode);

    const aliases = TEAM_NAMES_MAP[code] || [];
    for (const alias of aliases) {
      const score = getSimilarityScore(normName, normalizeTeamName(alias));
      if (score > maxScore) {
        maxScore = score;
      }
    }
    return maxScore;
  };

  const simHomeDirect = getMaxSimilarity(eventHome, homeCode);
  const simAwayDirect = getMaxSimilarity(eventAway, awayCode);

  const simHomeReverse = getMaxSimilarity(eventHome, awayCode);
  const simAwayReverse = getMaxSimilarity(eventAway, homeCode);

  const isDirectMatch = simHomeDirect >= threshold && simAwayDirect >= threshold;
  const isReverseMatch = simHomeReverse >= threshold && simAwayReverse >= threshold;

  if (isDirectMatch) {
    return {
      matches: true,
      isFuzzy: true,
      isReverse: false,
      scoreHome: simHomeDirect,
      scoreAway: simAwayDirect
    };
  }
  if (isReverseMatch) {
    return {
      matches: true,
      isFuzzy: true,
      isReverse: true,
      scoreHome: simHomeReverse,
      scoreAway: simAwayReverse
    };
  }

  const reason = `Fuzzy matching failed (threshold ${threshold}). Direct scores: Home=${simHomeDirect.toFixed(2)}, Away=${simAwayDirect.toFixed(2)}. Reverse scores: Home=${simHomeReverse.toFixed(2)}, Away=${simAwayReverse.toFixed(2)}`;
  return {
    matches: false,
    reason,
    scoreHome: Math.max(simHomeDirect, simHomeReverse),
    scoreAway: Math.max(simAwayDirect, simAwayReverse)
  };
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
async function fetchOddsApiIo(matchInfo: OddsMatchInfo, apiKey: string): Promise<MatchOdds | null> {
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

  // Accumulate diagnostics across all queried leagues
  const allProviderEventsChecked: string[] = [];
  const diagnostics: DiagnosticRecord[] = [];
  let foundMatchOdds: MatchOdds | null = null;

  for (const leagueSlug of leaguesToQuery) {
    if (foundMatchOdds) break;

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

      let matchedEvent: ProviderEvent | null = null;
      let matchedIsReverse = false;

      for (const e of events) {
        const matchResult = matchEventToFixture(
          e,
          matchInfo.homeTeamCode,
          matchInfo.awayTeamCode,
          matchInfo.kickoffUtc,
          matchInfo.debugMatch
        );

        if (matchInfo.debugMatch) {
          diagnostics.push({
            league: leagueSlug,
            eventHome: e.home_team,
            eventAway: e.away_team,
            eventHomeNorm: normalizeTeamName(e.home_team),
            eventAwayNorm: normalizeTeamName(e.away_team),
            eventTime: getEventTimeMs(e) ? new Date(getEventTimeMs(e)!).toISOString() : 'N/A',
            matches: matchResult.matches,
            isFuzzy: matchResult.isFuzzy,
            isReverse: matchResult.isReverse,
            scoreHome: matchResult.scoreHome,
            scoreAway: matchResult.scoreAway,
            reason: matchResult.reason || 'Matched!'
          });
        }

        if (matchResult.matches) {
          matchedEvent = e;
          matchedIsReverse = !!matchResult.isReverse;
          break;
        }
      }

      if (!matchedEvent || !matchedEvent.bookmakers || matchedEvent.bookmakers.length === 0) {
        continue;
      }

      const bookmaker = matchedEvent.bookmakers[0];
      const market = bookmaker.markets?.find((m) => m.key === 'h2h' || m.key === '1x2');
      if (!market || !market.outcomes || market.outcomes.length < 3) {
        continue;
      }

      let homeOdds = 0;
      let drawOdds = 0;
      let awayOdds = 0;

      for (const outcome of market.outcomes) {
        const isHome = matchedIsReverse
          ? (matchTeamName(outcome.name, matchInfo.homeTeamCode) || outcome.name === matchedEvent.away_team)
          : (matchTeamName(outcome.name, matchInfo.homeTeamCode) || outcome.name === matchedEvent.home_team);
        const isAway = matchedIsReverse
          ? (matchTeamName(outcome.name, matchInfo.awayTeamCode) || outcome.name === matchedEvent.home_team)
          : (matchTeamName(outcome.name, matchInfo.awayTeamCode) || outcome.name === matchedEvent.away_team);

        if (isHome) {
          homeOdds = outcome.price;
        } else if (isAway) {
          awayOdds = outcome.price;
        } else if (outcome.name.toLowerCase() === 'draw' || outcome.name.toLowerCase() === 'empate') {
          drawOdds = outcome.price;
        }
      }

      if (homeOdds && drawOdds && awayOdds) {
        setLastOddsError(null);
        await setProviderCooldown('odds-api-io', 0, 200, null); // Clear cooldown
        foundMatchOdds = {
          homeOdds,
          drawOdds,
          awayOdds,
          bookmaker: bookmaker.title || bookmaker.key || 'Unknown Bookmaker',
          provider: 'odds-api-io',
          sourceType: 'api',
          rawPayload: JSON.stringify(matchedEvent),
        };
      }
    } catch (error) {
      const rawMsg = `Error in fetchOddsApiIo for league ${leagueSlug}: ${error instanceof Error ? error.message : String(error)}`;
      const msg = redactApiKey(rawMsg, [apiKey]);
      console.error(msg);
      setLastOddsError(msg);
    }
  }

  // Print diagnostic logging if debugMatch is active
  if (matchInfo.debugMatch) {
    console.log(`\n=== DEBUG MATCH DIAGNOSTICS (Match ID: ${matchInfo.id}) ===`);
    console.log(`Canonical Teams:   ${matchInfo.homeTeamName} (${matchInfo.homeTeamCode}) vs ${matchInfo.awayTeamName} (${matchInfo.awayTeamCode})`);
    console.log(`Local aliases for ${matchInfo.homeTeamCode}: [${(TEAM_NAMES_MAP[matchInfo.homeTeamCode] || []).join(', ')}]`);
    console.log(`Local aliases for ${matchInfo.awayTeamCode}: [${(TEAM_NAMES_MAP[matchInfo.awayTeamCode] || []).join(', ')}]`);
    console.log(`Provider:          odds-api-io`);
    console.log(`Leagues queried:   [${leaguesToQuery.join(', ')}]`);
    console.log(`Events Considered:`);
    if (diagnostics.length === 0) {
      console.log(`  (No events found in response)`);
    } else {
      diagnostics.forEach((d, idx) => {
        console.log(`  [${idx + 1}] League: "${d.league}" | Event: "${d.eventHome}" vs "${d.eventAway}"`);
        console.log(`      Normalized: "${d.eventHomeNorm}" vs "${d.eventAwayNorm}"`);
        console.log(`      Event Time: ${d.eventTime}`);
        console.log(`      Match?      ${d.matches} (Fuzzy? ${d.isFuzzy}, Reverse? ${d.isReverse})`);
        if (d.scoreHome !== undefined || d.scoreAway !== undefined) {
          console.log(`      Similarity: Home=${d.scoreHome?.toFixed(2) ?? 'N/A'}, Away=${d.scoreAway?.toFixed(2) ?? 'N/A'}`);
        }
        console.log(`      Result/Reason: ${d.reason}`);
      });
    }
    console.log(`====================================================\n`);
  }

  if (foundMatchOdds) {
    return foundMatchOdds;
  }

  // Diagnostic logging when matching fails across all checked leagues
  console.warn(`[DIAGNOSTIC] Odds matching failed for match ${matchInfo.id} (${matchInfo.homeTeamCode} vs ${matchInfo.awayTeamCode}).
    Provider: odds-api-io
    Local aliases for ${matchInfo.homeTeamCode}: [${(TEAM_NAMES_MAP[matchInfo.homeTeamCode] || []).join(', ')}]
    Local aliases for ${matchInfo.awayTeamCode}: [${(TEAM_NAMES_MAP[matchInfo.awayTeamCode] || []).join(', ')}]
    Provider events checked: [${allProviderEventsChecked.join(' | ')}]`);

  setLastOddsError(`Odds-API.io could not find matching event for ${matchInfo.homeTeamCode} vs ${matchInfo.awayTeamCode} in checked leagues.`);
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
async function fetchTheOddsApi(matchInfo: OddsMatchInfo, apiKey: string): Promise<MatchOdds | null> {
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
    let matchedEvent: ProviderEvent | null = null;
    let matchedIsReverse = false;
    const diagnostics: DiagnosticRecord[] = [];

    for (const e of events) {
      const matchResult = matchEventToFixture(
        e,
        matchInfo.homeTeamCode,
        matchInfo.awayTeamCode,
        matchInfo.kickoffUtc,
        matchInfo.debugMatch
      );

      if (matchInfo.debugMatch) {
        diagnostics.push({
          eventHome: e.home_team,
          eventAway: e.away_team,
          eventHomeNorm: normalizeTeamName(e.home_team),
          eventAwayNorm: normalizeTeamName(e.away_team),
          eventTime: getEventTimeMs(e) ? new Date(getEventTimeMs(e)!).toISOString() : 'N/A',
          matches: matchResult.matches,
          isFuzzy: matchResult.isFuzzy,
          isReverse: matchResult.isReverse,
          scoreHome: matchResult.scoreHome,
          scoreAway: matchResult.scoreAway,
          reason: matchResult.reason || 'Matched!'
        });
      }

      if (matchResult.matches) {
        matchedEvent = e;
        matchedIsReverse = !!matchResult.isReverse;
        break;
      }
    }

    if (matchInfo.debugMatch) {
      console.log(`\n=== DEBUG MATCH DIAGNOSTICS (Match ID: ${matchInfo.id}) ===`);
      console.log(`Canonical Teams:   ${matchInfo.homeTeamName} (${matchInfo.homeTeamCode}) vs ${matchInfo.awayTeamName} (${matchInfo.awayTeamCode})`);
      console.log(`Local aliases for ${matchInfo.homeTeamCode}: [${(TEAM_NAMES_MAP[matchInfo.homeTeamCode] || []).join(', ')}]`);
      console.log(`Local aliases for ${matchInfo.awayTeamCode}: [${(TEAM_NAMES_MAP[matchInfo.awayTeamCode] || []).join(', ')}]`);
      console.log(`Provider:          the-odds-api`);
      console.log(`Sport Key:         ${sportKey}`);
      console.log(`Events Considered:`);
      if (diagnostics.length === 0) {
        console.log(`  (No events found in response)`);
      } else {
        diagnostics.forEach((d, idx) => {
          console.log(`  [${idx + 1}] Event: "${d.eventHome}" vs "${d.eventAway}"`);
          console.log(`      Normalized: "${d.eventHomeNorm}" vs "${d.eventAwayNorm}"`);
          console.log(`      Event Time: ${d.eventTime}`);
          console.log(`      Match?      ${d.matches} (Fuzzy? ${d.isFuzzy}, Reverse? ${d.isReverse})`);
          if (d.scoreHome !== undefined || d.scoreAway !== undefined) {
            console.log(`      Similarity: Home=${d.scoreHome?.toFixed(2) ?? 'N/A'}, Away=${d.scoreAway?.toFixed(2) ?? 'N/A'}`);
          }
          console.log(`      Result/Reason: ${d.reason}`);
        });
      }
      console.log(`====================================================\n`);
    }

    if (!matchedEvent || !matchedEvent.bookmakers || matchedEvent.bookmakers.length === 0) {
      // Diagnostic logging when event matching fails
      const providerTeams = events.map(e => `${e.home_team} vs ${e.away_team}`);
      console.warn(`[DIAGNOSTIC] Odds matching failed for match ${matchInfo.id} (${matchInfo.homeTeamCode} vs ${matchInfo.awayTeamCode}).
        Provider: the-odds-api
        Local aliases for ${matchInfo.homeTeamCode}: [${(TEAM_NAMES_MAP[matchInfo.homeTeamCode] || []).join(', ')}]
        Local aliases for ${matchInfo.awayTeamCode}: [${(TEAM_NAMES_MAP[matchInfo.awayTeamCode] || []).join(', ')}]
        Provider events checked: [${providerTeams.join(' | ')}]`);

      setLastOddsError(`The Odds API event not found for ${matchInfo.homeTeamCode} vs ${matchInfo.awayTeamCode}`);
      return null;
    }

    const bookmaker = matchedEvent.bookmakers[0];
    const market = bookmaker.markets?.find((m) => m.key === 'h2h');
    if (!market || !market.outcomes || market.outcomes.length < 3) {
      setLastOddsError(`The Odds API outcomes not found for ${matchInfo.homeTeamCode} vs ${matchInfo.awayTeamCode}`);
      return null;
    }

    let homeOdds = 0;
    let drawOdds = 0;
    let awayOdds = 0;

    for (const outcome of market.outcomes) {
      const isHome = matchedIsReverse
        ? (matchTeamName(outcome.name, matchInfo.homeTeamCode) || outcome.name === matchedEvent.away_team)
        : (matchTeamName(outcome.name, matchInfo.homeTeamCode) || outcome.name === matchedEvent.home_team);
      const isAway = matchedIsReverse
        ? (matchTeamName(outcome.name, matchInfo.awayTeamCode) || outcome.name === matchedEvent.home_team)
        : (matchTeamName(outcome.name, matchInfo.awayTeamCode) || outcome.name === matchedEvent.away_team);

      if (isHome) {
        homeOdds = outcome.price;
      } else if (isAway) {
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
        rawPayload: JSON.stringify(matchedEvent),
      };
    } else {
      setLastOddsError(`The Odds API could not extract home, draw or away odds for ${matchInfo.homeTeamCode} vs ${matchInfo.awayTeamCode}`);
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
export async function getMatchWinnerOdds(
  matchId: string,
  bypassCooldown = false,
  debugMatch = false
): Promise<MatchOdds | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
    }
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

  const matchInfo: OddsMatchInfo = {
    id: match.id,
    kickoffUtc: match.kickoffUtc,
    homeTeamCode: match.homeTeamCode,
    awayTeamCode: match.awayTeamCode,
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
    debugMatch,
  };

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
      result = await fetchOddsApiIo(matchInfo, primaryKey);
      if (!result) primaryFailed = true;
    }
  } else if (primaryProvider === 'the-odds-api' && isFallbackEnabled && fallbackKey) {
    if (primaryCooldown) {
      console.log(`Bypassing The Odds API (primary) because it is cooling down until ${primaryCooldown.toISOString()}`);
      primaryFailed = true;
    } else {
      result = await fetchTheOddsApi(matchInfo, fallbackKey);
      if (!result) primaryFailed = true;
    }
  }

  // 2. Try Fallback Provider if primary failed
  if (!result && primaryFailed) {
    if (fallbackProvider === 'the-odds-api' && isFallbackEnabled && fallbackKey) {
      if (fallbackCooldown) {
        console.log(`Bypassing The Odds API (fallback) because it is cooling down until ${fallbackCooldown.toISOString()}`);
      } else {
        result = await fetchTheOddsApi(matchInfo, fallbackKey);
      }
    } else if (fallbackProvider === 'odds-api-io' && isPrimaryEnabled && primaryKey) {
      if (fallbackCooldown) {
        console.log(`Bypassing Odds-API.io (fallback) because it is cooling down until ${fallbackCooldown.toISOString()}`);
      } else {
        result = await fetchOddsApiIo(matchInfo, primaryKey);
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
