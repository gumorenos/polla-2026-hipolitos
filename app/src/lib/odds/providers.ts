import { prisma } from '../db';

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

// Map of team codes to common English names for matching API data
const TEAM_NAMES_MAP: Record<string, string[]> = {
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
  CUR: ['Curacao', 'Curazao'],
  JOR: ['Jordan', 'Jordania'],
  NZL: ['New Zealand', 'Nueva Zelanda'],
  HAI: ['Haiti', 'Haití'],
  UZB: ['Uzbekistan', 'Uzbekistán'],
  QAT: ['Qatar'],
  KOR: ['South Korea', 'Corea del Sur', 'Korea Republic'],
  KSA: ['Saudi Arabia', 'Arabia Saudita'],
  AUS: ['Australia'],
  EGY: ['Egypt', 'Egipto'],
  CIV: ['Ivory Coast', 'Costa de Marfil'],
  GHA: ['Ghana'],
  TUN: ['Tunisia', 'Túnez'],
  ALG: ['Algeria', 'Argelia'],
  SUI: ['Switzerland', 'Suiza'],
  AUT: ['Austria'],
  TUR: ['Turkey', 'Türkiye'],
  SWE: ['Sweden', 'Suecia'],
  NOR: ['Norway', 'Noruega'],
  CZE: ['Czech Republic', 'Chequia'],
  SCO: ['Scotland', 'Escocia'],
};

// Check if a team name matches a team code
function matchTeamName(teamName: string, code: string): boolean {
  const normalized = teamName.toLowerCase().trim();
  const allowedNames = TEAM_NAMES_MAP[code] || [];
  return (
    code.toLowerCase() === normalized ||
    allowedNames.some(name => name.toLowerCase() === normalized)
  );
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

function redactApiKey(msg: string, key?: string): string {
  if (!key) return msg;
  return msg.split(key).join('REDACTED');
}

// Fetch odds from Odds-API.io (Primary)
async function fetchOddsApiIo(homeCode: string, awayCode: string, apiKey: string): Promise<MatchOdds | null> {
  try {
    const url = `https://api.odds-api.io/v3/odds?apiKey=${apiKey}&sport=football`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      const msg = `Odds-API.io responded with status ${res.status}`;
      console.warn(msg);
      setLastOddsError(msg);
      return null;
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.data)) {
      setLastOddsError('Odds-API.io response does not contain data array');
      return null;
    }

    const events = data.data as ProviderEvent[];
    // Try to find the matching event
    const event = events.find((e) => {
      const homeMatch = matchTeamName(e.home_team, homeCode) || matchTeamName(e.home_team, awayCode);
      const awayMatch = matchTeamName(e.away_team, homeCode) || matchTeamName(e.away_team, awayCode);
      return homeMatch && awayMatch;
    });

    if (!event || !event.bookmakers || event.bookmakers.length === 0) {
      setLastOddsError(`Odds-API.io event not found for ${homeCode} vs ${awayCode}`);
      return null;
    }

    // Use the first available bookmaker (e.g. Betsson, Bet365) or fallback to 1X2 market
    const bookmaker = event.bookmakers[0];
    const market = bookmaker.markets?.find((m) => m.key === 'h2h' || m.key === '1x2');
    if (!market || !market.outcomes || market.outcomes.length < 3) {
      setLastOddsError(`Odds-API.io outcomes not found for ${homeCode} vs ${awayCode}`);
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
      return {
        homeOdds,
        drawOdds,
        awayOdds,
        bookmaker: bookmaker.title || bookmaker.key || 'Unknown Bookmaker',
        provider: 'odds-api-io',
        sourceType: 'api',
        rawPayload: JSON.stringify(event),
      };
    } else {
      setLastOddsError(`Odds-API.io could not extract home, draw or away odds for ${homeCode} vs ${awayCode}`);
    }
  } catch (error) {
    const rawMsg = `Error in fetchOddsApiIo: ${error instanceof Error ? error.message : String(error)}`;
    const msg = redactApiKey(rawMsg, apiKey);
    console.error(msg);
    setLastOddsError(msg);
  }
  return null;
}

// Fetch odds from The Odds API (Fallback)
async function fetchTheOddsApi(homeCode: string, awayCode: string, apiKey: string): Promise<MatchOdds | null> {
  try {
    const sportKey = 'soccer_fifa_world_cup';
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h`;
    const res = await fetch(url);
    if (!res.ok) {
      const msg = `The Odds API responded with status ${res.status}`;
      console.warn(msg);
      setLastOddsError(msg);
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
    const msg = redactApiKey(rawMsg, apiKey);
    console.error(msg);
    setLastOddsError(msg);
  }
  return null;
}

// Fetch odds using the configured settings and providers
export async function getMatchWinnerOdds(matchId: string): Promise<MatchOdds | null> {
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

  // 1. Try Primary Provider
  if (primaryProvider === 'odds-api-io' && isPrimaryEnabled && primaryKey) {
    result = await fetchOddsApiIo(match.homeTeamCode, match.awayTeamCode, primaryKey);
  } else if (primaryProvider === 'the-odds-api' && isFallbackEnabled && fallbackKey) {
    result = await fetchTheOddsApi(match.homeTeamCode, match.awayTeamCode, fallbackKey);
  }

  // 2. Try Fallback Provider if primary failed
  if (!result) {
    if (fallbackProvider === 'the-odds-api' && isFallbackEnabled && fallbackKey) {
      result = await fetchTheOddsApi(match.homeTeamCode, match.awayTeamCode, fallbackKey);
    } else if (fallbackProvider === 'odds-api-io' && isPrimaryEnabled && primaryKey) {
      result = await fetchOddsApiIo(match.homeTeamCode, match.awayTeamCode, primaryKey);
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
