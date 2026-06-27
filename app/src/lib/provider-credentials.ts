import { prisma } from './db';
import {
  decryptProviderApiKey,
  isProviderEncryptionConfigured,
} from './provider-secrets';
import { readProviderQuota } from './provider-diagnostics';

export const PROVIDER_IDS = [
  'the-odds-api',
  'odds-api-io',
  'football-data',
  'api-football',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type ProviderCredentialSource = 'db' | 'env' | 'not_configured';

type ProviderDefinition = {
  name: string;
  envKey: string;
  envEnabled: string;
};

export const PROVIDER_DEFINITIONS: Record<ProviderId, ProviderDefinition> = {
  'the-odds-api': {
    name: 'The Odds API',
    envKey: 'THE_ODDS_API_KEY',
    envEnabled: 'THE_ODDS_API_ENABLED',
  },
  'odds-api-io': {
    name: 'Odds-API.io',
    envKey: 'ODDS_API_IO_KEY',
    envEnabled: 'ODDS_API_IO_ENABLED',
  },
  'football-data': {
    name: 'Football-Data',
    envKey: 'FOOTBALL_DATA_API_KEY',
    envEnabled: 'FOOTBALL_DATA_ENABLED',
  },
  'api-football': {
    name: 'API-Football',
    envKey: 'API_FOOTBALL_KEY',
    envEnabled: 'API_FOOTBALL_ENABLED',
  },
};

export type ResolvedProviderCredential = {
  apiKey: string | null;
  source: ProviderCredentialSource;
  configured: boolean;
};

export type ProviderAdminSummary = {
  provider: ProviderId;
  name: string;
  configured: boolean;
  maskedApiKey: string | null;
  source: ProviderCredentialSource;
  isActive: boolean;
  hasStoredCredential: boolean;
  lastStatus: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  lastRequestsRemaining: number | null;
  lastRequestsUsed: number | null;
  lastRequestCost: number | null;
  lastResetAt: string | null;
  lastResetInSeconds: number | null;
};

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_IDS.includes(value as ProviderId);
}

function getEnabledEnvironmentKey(provider: ProviderId): string | null {
  const definition = PROVIDER_DEFINITIONS[provider];
  if (process.env[definition.envEnabled] !== 'true') {
    return null;
  }
  const value = process.env[definition.envKey]?.trim();
  return value || null;
}

export async function resolveProviderApiKey(
  provider: ProviderId,
): Promise<ResolvedProviderCredential> {
  const stored = await prisma.providerCredential.findUnique({ where: { provider } });

  if (stored?.isActive && stored.encryptedApiKey) {
    try {
      const apiKey = decryptProviderApiKey(stored.encryptedApiKey);
      return { apiKey, source: 'db', configured: true };
    } catch {
      // A missing/rotated encryption secret must not block the existing env fallback.
    }
  }

  const environmentKey = getEnabledEnvironmentKey(provider);
  if (environmentKey) {
    return { apiKey: environmentKey, source: 'env', configured: true };
  }

  return { apiKey: null, source: 'not_configured', configured: false };
}

export async function getProviderAdminSummaries(): Promise<{
  encryptionConfigured: boolean;
  providers: ProviderAdminSummary[];
}> {
  const credentials = await prisma.providerCredential.findMany();
  const byProvider = new Map(credentials.map((credential) => [credential.provider, credential]));

  const providers = await Promise.all(PROVIDER_IDS.map(async (provider) => {
    const stored = byProvider.get(provider);
    const resolved = await resolveProviderApiKey(provider);
    const definition = PROVIDER_DEFINITIONS[provider];

    return {
      provider,
      name: definition.name,
      configured: resolved.configured,
      maskedApiKey: resolved.source === 'db'
        ? stored?.maskedApiKey ?? null
        : resolved.apiKey
          ? `...${resolved.apiKey.slice(-4)}`
          : null,
      source: resolved.source,
      isActive: stored?.encryptedApiKey ? stored.isActive : resolved.configured,
      hasStoredCredential: Boolean(stored?.encryptedApiKey),
      lastStatus: stored?.lastStatus ?? null,
      lastCheckedAt: stored?.lastCheckedAt?.toISOString() ?? null,
      lastError: stored?.lastError ?? null,
      lastRequestsRemaining: stored?.lastRequestsRemaining ?? null,
      lastRequestsUsed: stored?.lastRequestsUsed ?? null,
      lastRequestCost: stored?.lastRequestCost ?? null,
      lastResetAt: stored?.lastResetAt?.toISOString() ?? null,
      lastResetInSeconds: stored?.lastResetInSeconds ?? null,
    } satisfies ProviderAdminSummary;
  }));

  return {
    encryptionConfigured: isProviderEncryptionConfigured(),
    providers,
  };
}

export async function recordProviderResponseDiagnostic(
  provider: ProviderId,
  response: Response,
): Promise<void> {
  const quota = readProviderQuota(provider, response.headers);
  const checkedAt = new Date();

  try {
    await prisma.providerCredential.upsert({
      where: { provider },
      create: {
        provider,
        isActive: false,
        lastStatus: response.ok ? 'ok' : `http_${response.status}`,
        lastCheckedAt: checkedAt,
        lastError: response.ok ? null : `HTTP ${response.status}`,
        lastRequestsRemaining: quota.requestsRemaining,
        lastRequestsUsed: quota.requestsUsed,
        lastRequestCost: quota.lastRequestCost,
        lastResetAt: quota.resetAt,
        lastResetInSeconds: quota.resetInSeconds,
      },
      update: {
        lastStatus: response.ok ? 'ok' : `http_${response.status}`,
        lastCheckedAt: checkedAt,
        lastError: response.ok ? null : `HTTP ${response.status}`,
        lastRequestsRemaining: quota.requestsRemaining,
        lastRequestsUsed: quota.requestsUsed,
        lastRequestCost: quota.lastRequestCost,
        lastResetAt: quota.resetAt,
        lastResetInSeconds: quota.resetInSeconds,
      },
    });
  } catch {
    // Diagnostic persistence must never interrupt the provider request itself.
  }
}
