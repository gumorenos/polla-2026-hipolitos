export type TeamAliasTeam = {
  code: string;
  name: string;
};

export type TeamAliasRecord = {
  teamCode: string;
  provider: string;
  alias: string;
  normalizedAlias?: string;
  confidence?: number | null;
};

export type TeamAliasResolution = {
  matched: boolean;
  status: 'matched' | 'unmatched' | 'ambiguous';
  teamId?: string;
  teamCode?: string;
  confidence?: number;
  reason: string;
};

export const DEFAULT_TEAM_ALIASES: Record<string, string[]> = {
  BIH: [
    'Bosnia and Herzegovina',
    'Bosnia & Herzegovina',
    'Bosnia-Herzegovina',
    'Bosnia Herzegovina',
    'Bosnia',
  ],
  USA: ['United States', 'United States of America', 'USA', 'U.S.A.'],
  KOR: ['Korea Republic', 'South Korea', 'Republic of Korea'],
  IRI: ['Iran', 'IR Iran', 'Islamic Republic of Iran'],
  IRN: ['Iran', 'IR Iran', 'Islamic Republic of Iran'],
  CIV: ["Côte d'Ivoire", "Cote d'Ivoire", 'Ivory Coast'],
  TUR: ['Türkiye', 'Turkey', 'Turkiye'],
};

export function normalizeTeamAlias(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/[’'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(and|y)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueTeamCodes(records: Array<{ teamCode: string }>): string[] {
  return [...new Set(records.map((record) => record.teamCode))];
}

function resultForCodes(
  codes: string[],
  confidence: number,
  reason: string,
): TeamAliasResolution | null {
  if (codes.length === 0) return null;
  if (codes.length > 1) {
    return {
      matched: false,
      status: 'ambiguous',
      confidence,
      reason: `Coincidencia ambigua: ${codes.join(', ')}.`,
    };
  }
  return {
    matched: true,
    status: 'matched',
    teamId: codes[0],
    teamCode: codes[0],
    confidence,
    reason,
  };
}

export function resolveProviderTeamAliasFromData(
  provider: string,
  providerTeamName: string,
  teams: TeamAliasTeam[],
  aliases: TeamAliasRecord[],
): TeamAliasResolution {
  const normalized = normalizeTeamAlias(providerTeamName);
  if (!normalized) {
    return { matched: false, status: 'unmatched', reason: 'Nombre vacío o no normalizable.' };
  }

  const existingCodes = new Set(teams.map((team) => team.code));
  const defaultAliases: TeamAliasRecord[] = Object.entries(DEFAULT_TEAM_ALIASES)
    .filter(([teamCode]) => existingCodes.has(teamCode))
    .flatMap(([teamCode, names]) => names.map((alias) => ({
      teamCode,
      provider: '*',
      alias,
      normalizedAlias: normalizeTeamAlias(alias),
      confidence: 1,
    })));
  const allAliases = [...aliases, ...defaultAliases];

  const providerMatches = allAliases.filter((alias) => (
    alias.provider === provider
    && (
      alias.alias === providerTeamName
      || (alias.normalizedAlias ?? normalizeTeamAlias(alias.alias)) === normalized
    )
  ));
  const providerResult = resultForCodes(
    uniqueTeamCodes(providerMatches),
    1,
    'Alias exacto del proveedor.',
  );
  if (providerResult) return providerResult;

  const globalMatches = allAliases.filter((alias) => (
    alias.provider === '*'
    && (alias.normalizedAlias ?? normalizeTeamAlias(alias.alias)) === normalized
  ));
  const globalResult = resultForCodes(
    uniqueTeamCodes(globalMatches),
    1,
    'Alias normalizado global.',
  );
  if (globalResult) return globalResult;

  const codeMatches = teams.filter((team) => normalizeTeamAlias(team.code) === normalized);
  const codeResult = resultForCodes(
    codeMatches.map((team) => team.code),
    1,
    'Código local exacto.',
  );
  if (codeResult) return codeResult;

  const nameMatches = teams.filter((team) => normalizeTeamAlias(team.name) === normalized);
  const nameResult = resultForCodes(
    nameMatches.map((team) => team.code),
    1,
    'Nombre local normalizado.',
  );
  if (nameResult) return nameResult;

  return {
    matched: false,
    status: 'unmatched',
    reason: 'Sin alias exacto; no se aplicó coincidencia difusa automática.',
  };
}
