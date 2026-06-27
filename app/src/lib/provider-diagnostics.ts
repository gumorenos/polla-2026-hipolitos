import type { ProviderId } from './provider-credentials';

export type ProviderQuota = {
  requestsRemaining: number | null;
  requestsUsed: number | null;
  lastRequestCost: number | null;
  resetAt: Date | null;
  resetInSeconds: number | null;
};

export type ProviderConnectionDiagnostic = ProviderQuota & {
  success: boolean;
  statusCode: number | null;
  status: string;
  error: string | null;
};

function readInteger(headers: Headers, names: string[]): number | null {
  for (const name of names) {
    const raw = headers.get(name);
    if (raw === null) continue;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function readProviderQuota(provider: ProviderId, headers: Headers): ProviderQuota {
  if (provider === 'the-odds-api') {
    return {
      requestsRemaining: readInteger(headers, ['x-requests-remaining']),
      requestsUsed: readInteger(headers, ['x-requests-used']),
      lastRequestCost: readInteger(headers, ['x-requests-last']),
      resetAt: null,
      resetInSeconds: null,
    };
  }

  if (provider === 'football-data') {
    return {
      requestsRemaining: readInteger(headers, ['x-requestsavailable']),
      requestsUsed: null,
      lastRequestCost: null,
      resetAt: null,
      resetInSeconds: readInteger(headers, ['x-requestcounter-reset']),
    };
  }

  if (provider === 'api-football') {
    const requestsRemaining = readInteger(headers, [
      'x-ratelimit-requests-remaining',
      'x-ratelimit-remaining',
    ]);
    const requestLimit = readInteger(headers, [
      'x-ratelimit-requests-limit',
      'x-ratelimit-limit',
    ]);
    const resetValue = readInteger(headers, ['x-ratelimit-reset']);
    return {
      requestsRemaining,
      requestsUsed: requestLimit !== null && requestsRemaining !== null
        ? Math.max(0, requestLimit - requestsRemaining)
        : null,
      lastRequestCost: null,
      resetAt: resetValue !== null && resetValue > 1_000_000_000
        ? new Date(resetValue * 1000)
        : null,
      resetInSeconds: resetValue !== null && resetValue <= 1_000_000_000
        ? resetValue
        : null,
    };
  }

  return {
    requestsRemaining: null,
    requestsUsed: null,
    lastRequestCost: null,
    resetAt: null,
    resetInSeconds: null,
  };
}

function getProviderRequest(provider: ProviderId, apiKey: string): {
  url: string;
  headers: HeadersInit;
} {
  if (provider === 'the-odds-api') {
    const url = new URL('https://api.the-odds-api.com/v4/sports/');
    url.searchParams.set('apiKey', apiKey);
    return { url: url.toString(), headers: { Accept: 'application/json' } };
  }

  if (provider === 'odds-api-io') {
    const url = new URL('https://api.odds-api.io/v3/leagues');
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('sport', process.env.ODDS_API_IO_SPORT || 'football');
    return { url: url.toString(), headers: { Accept: 'application/json' } };
  }

  if (provider === 'football-data') {
    const baseUrl = process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org/v4';
    const competitionCode = process.env.FOOTBALL_DATA_COMPETITION_CODE ?? 'WC';
    return {
      url: `${baseUrl}/competitions/${competitionCode}`,
      headers: { Accept: 'application/json', 'X-Auth-Token': apiKey },
    };
  }

  return {
    url: 'https://v3.football.api-sports.io/status',
    headers: { Accept: 'application/json', 'x-apisports-key': apiKey },
  };
}

export async function testProviderConnection(
  provider: ProviderId,
  apiKey: string,
): Promise<ProviderConnectionDiagnostic> {
  const request = getProviderRequest(provider, apiKey);

  try {
    const response = await fetch(request.url, {
      headers: request.headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    const quota = readProviderQuota(provider, response.headers);
    let payloadValid = true;
    if (provider === 'api-football' && response.ok) {
      const payload = await response.clone().json().catch(() => null) as {
        errors?: unknown[] | Record<string, unknown>;
      } | null;
      payloadValid = !payload?.errors
        || (Array.isArray(payload.errors) && payload.errors.length === 0)
        || (!Array.isArray(payload.errors) && Object.keys(payload.errors).length === 0);
    }
    const success = response.ok && payloadValid;

    return {
      ...quota,
      success,
      statusCode: response.status,
      status: success ? 'ok' : response.ok ? 'invalid_key' : `http_${response.status}`,
      error: success ? null : 'La API key no pudo validarse.',
    };
  } catch {
    return {
      requestsRemaining: null,
      requestsUsed: null,
      lastRequestCost: null,
      resetAt: null,
      resetInSeconds: null,
      success: false,
      statusCode: null,
      status: 'connection_error',
      error: 'No se pudo conectar con el proveedor.',
    };
  }
}
