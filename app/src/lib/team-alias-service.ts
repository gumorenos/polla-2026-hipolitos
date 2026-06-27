import { prisma } from './db';
import {
  DEFAULT_TEAM_ALIASES,
  normalizeTeamAlias,
  resolveProviderTeamAliasFromData,
  type TeamAliasRecord,
  type TeamAliasResolution,
  type TeamAliasTeam,
} from './team-alias';

export type ProviderAliasLookup = Record<string, Record<string, string[]>>;

async function loadResolverData(): Promise<{
  teams: TeamAliasTeam[];
  aliases: TeamAliasRecord[];
}> {
  const [teams, aliases] = await Promise.all([
    prisma.team.findMany({ select: { code: true, name: true } }),
    prisma.teamAlias.findMany({
      select: {
        teamCode: true,
        provider: true,
        alias: true,
        normalizedAlias: true,
        confidence: true,
      },
    }),
  ]);
  return { teams, aliases };
}

export async function resolveProviderTeamAlias(
  provider: string,
  providerTeamName: string,
): Promise<TeamAliasResolution> {
  const data = await loadResolverData();
  return resolveProviderTeamAliasFromData(provider, providerTeamName, data.teams, data.aliases);
}

function addLookupAlias(
  lookup: ProviderAliasLookup,
  provider: string,
  teamCode: string,
  alias: string,
): void {
  lookup[provider] ??= {};
  lookup[provider][teamCode] ??= [];
  if (!lookup[provider][teamCode].includes(alias)) {
    lookup[provider][teamCode].push(alias);
  }
}

export async function getProviderAliasLookup(
  teamCodes: string[],
): Promise<ProviderAliasLookup> {
  const uniqueCodes = [...new Set(teamCodes)];
  const [teams, aliases] = await Promise.all([
    prisma.team.findMany({
      where: { code: { in: uniqueCodes } },
      select: { code: true },
    }),
    prisma.teamAlias.findMany({
      where: { teamCode: { in: uniqueCodes } },
      select: { teamCode: true, provider: true, alias: true },
    }),
  ]);

  const lookup: ProviderAliasLookup = {};
  const existingCodes = new Set(teams.map((team) => team.code));
  for (const [teamCode, names] of Object.entries(DEFAULT_TEAM_ALIASES)) {
    if (!existingCodes.has(teamCode)) continue;
    for (const alias of names) addLookupAlias(lookup, '*', teamCode, alias);
  }
  for (const alias of aliases) {
    addLookupAlias(lookup, alias.provider, alias.teamCode, alias.alias);
  }
  return lookup;
}

export async function recordProviderTeamNames(
  provider: string,
  marketType: string,
  rawNames: string[],
): Promise<void> {
  const data = await loadResolverData();
  const uniqueNames = [...new Set(rawNames.map((name) => name.trim()).filter(Boolean))];

  for (const rawName of uniqueNames) {
    const normalizedName = normalizeTeamAlias(rawName);
    if (!normalizedName || ['draw', 'empate', 'tie'].includes(normalizedName)) continue;

    const existing = await prisma.providerTeamOutcome.findUnique({
      where: {
        provider_marketType_normalizedName: { provider, marketType, normalizedName },
      },
      select: { status: true },
    });
    if (existing?.status === 'ignored') {
      await prisma.providerTeamOutcome.update({
        where: {
          provider_marketType_normalizedName: { provider, marketType, normalizedName },
        },
        data: { rawName, lastSeenAt: new Date() },
      });
      continue;
    }

    const resolution = resolveProviderTeamAliasFromData(
      provider,
      rawName,
      data.teams,
      data.aliases,
    );
    await prisma.providerTeamOutcome.upsert({
      where: {
        provider_marketType_normalizedName: { provider, marketType, normalizedName },
      },
      create: {
        provider,
        marketType,
        rawName,
        normalizedName,
        suggestedTeamCode: resolution.matched ? resolution.teamCode : null,
        confidence: resolution.confidence ?? null,
        reason: resolution.reason,
        status: resolution.status,
      },
      update: {
        rawName,
        lastSeenAt: new Date(),
        suggestedTeamCode: resolution.matched ? resolution.teamCode : null,
        confidence: resolution.confidence ?? null,
        reason: resolution.reason,
        status: resolution.status,
      },
    });
  }
}

export async function seedDefaultTeamAliases(createdByUserId: string): Promise<number> {
  const teams = await prisma.team.findMany({ select: { code: true } });
  const existingCodes = new Set(teams.map((team) => team.code));
  let created = 0;

  for (const [teamCode, names] of Object.entries(DEFAULT_TEAM_ALIASES)) {
    if (!existingCodes.has(teamCode)) continue;
    const aliasesByNormalized = new Map<string, string>();
    for (const alias of names) aliasesByNormalized.set(normalizeTeamAlias(alias), alias);

    for (const [normalizedAlias, alias] of aliasesByNormalized) {
      const existing = await prisma.teamAlias.findUnique({
        where: { provider_normalizedAlias: { provider: '*', normalizedAlias } },
        select: { teamCode: true },
      });
      if (existing) continue;
      await prisma.teamAlias.create({
        data: {
          teamCode,
          provider: '*',
          alias,
          normalizedAlias,
          confidence: 1,
          source: 'seed',
          createdByUserId,
        },
      });
      created++;
    }
  }
  return created;
}
