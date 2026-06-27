import { setProviderCooldown } from './providers';
import { recordProviderResponseDiagnostic, resolveProviderApiKey } from '../provider-credentials';

function redactApiKey(msg: string, keys: string[]): string {
  let redacted = msg;
  for (const k of keys) {
    if (k && k.length > 5) {
      redacted = redacted.split(k).join('REDACTED');
    }
  }
  return redacted;
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

export interface TheOddsApiSport {
  key: string;
  active: boolean;
  group: string;
  description: string;
  title: string;
  has_outrights: boolean;
}

export async function listTheOddsApiOutrightSports(): Promise<{ success: boolean; sports: TheOddsApiSport[]; error?: string }> {
  try {
    const cred = await resolveProviderApiKey('the-odds-api');
    if (!cred.apiKey) {
      return { success: false, sports: [], error: 'The Odds API key is missing.' };
    }

    const url = `https://api.the-odds-api.com/v4/sports/?all=true&apiKey=${cred.apiKey}`;
    const res = await fetchWithTimeout(url, {}, 8000);
    await recordProviderResponseDiagnostic('the-odds-api', res);

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let msg = `The Odds API responded with status ${res.status}: ${errorText}`;
      msg = redactApiKey(msg, [cred.apiKey]);
      
      if (res.status === 429) {
        await setProviderCooldown('the-odds-api', 3600, 429, redactApiKey(errorText || 'Rate limit exceeded', [cred.apiKey]));
      }
      return { success: false, sports: [], error: msg };
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return { success: false, sports: [], error: 'Invalid format received from API' };
    }

    const sports = data as TheOddsApiSport[];
    return { success: true, sports: sports.filter(s => s.has_outrights) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, sports: [], error: msg };
  }
}

export function identifyCandidateSports(sports: TheOddsApiSport[]): TheOddsApiSport[] {
  const keywords = ['world cup', 'fifa', 'soccer', 'winner', 'outright'];
  return sports.filter(s => {
    const searchString = `${s.title} ${s.description} ${s.key}`.toLowerCase();
    return keywords.some(kw => searchString.includes(kw));
  });
}

export interface OutrightOutcome {
  name: string;
  price: number;
}

export interface OutrightMarket {
  key: string;
  last_update: string;
  outcomes: OutrightOutcome[];
}

export interface OutrightBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OutrightMarket[];
}

export interface OutrightEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string | null;
  away_team: string | null;
  bookmakers: OutrightBookmaker[];
}

export interface NormalizedChampionOdds {
  provider: string;
  sportKey: string;
  bookmakerKey: string;
  bookmakerTitle: string;
  marketKey: string;
  outcomeName: string;
  decimalOdds: number;
  lastUpdate: Date;
  raw: any;
}

export async function fetchChampionOutrights(
  sportKey: string,
  regions: string = 'eu,uk,us',
  bookmakers?: string
): Promise<{ success: boolean; outcomes: NormalizedChampionOdds[]; error?: string }> {
  try {
    const cred = await resolveProviderApiKey('the-odds-api');
    if (!cred.apiKey) {
      return { success: false, outcomes: [], error: 'The Odds API key is missing.' };
    }

    let url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${cred.apiKey}&regions=${regions}&markets=outrights&oddsFormat=decimal`;
    if (bookmakers) {
      url += `&bookmakers=${bookmakers}`;
    }

    const res = await fetchWithTimeout(url, {}, 8000);
    await recordProviderResponseDiagnostic('the-odds-api', res);

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let msg = `The Odds API responded with status ${res.status}: ${errorText}`;
      msg = redactApiKey(msg, [cred.apiKey]);
      
      if (res.status === 429) {
        await setProviderCooldown('the-odds-api', 3600, 429, redactApiKey(errorText || 'Rate limit exceeded', [cred.apiKey]));
      }
      return { success: false, outcomes: [], error: msg };
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return { success: false, outcomes: [], error: 'Invalid format received from API' };
    }

    const events = data as OutrightEvent[];
    const normalizedOutcomes: NormalizedChampionOdds[] = [];

    for (const event of events) {
      for (const bookmaker of event.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          if (market.key !== 'outrights') continue;
          for (const outcome of market.outcomes || []) {
            normalizedOutcomes.push({
              provider: 'the-odds-api',
              sportKey: event.sport_key,
              bookmakerKey: bookmaker.key,
              bookmakerTitle: bookmaker.title,
              marketKey: 'outrights',
              outcomeName: outcome.name,
              decimalOdds: outcome.price,
              lastUpdate: new Date(market.last_update || bookmaker.last_update || event.commence_time),
              raw: outcome,
            });
          }
        }
      }
    }

    return { success: true, outcomes: normalizedOutcomes };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, outcomes: [], error: msg };
  }
}
