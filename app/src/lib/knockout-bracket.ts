import {
  calculateWorldCupQualification,
  type QualificationMatchLike,
  type QualificationTeamLike,
  type WorldCupQualification,
} from './fifa-qualification';
import {
  canonicalThirdPlaceGroups,
  getAnnexCAllocationForGroups,
  resolveThirdPlacePlaceholder,
  type AnnexCAllocation,
  type AnnexCSlot,
} from './fifa-2026-annex-c';
import { isConsistentFinalMatchResult } from './match-result';

export type BracketMatchLike = QualificationMatchLike & {
  jornada?: string | null;
};

export type RoundOf32Proposal = {
  matchId: string;
  currentHomeTeamCode: string;
  currentAwayTeamCode: string;
  resolvedHomeTeamCode: string;
  resolvedAwayTeamCode: string;
  reason: string;
  changed: boolean;
};

export type RoundOf32Resolution = {
  ready: boolean;
  canApplySafeProposals: boolean;
  applicableProposalCount: number;
  blockingMatches: Array<{
    id: string;
    homeTeamCode: string;
    awayTeamCode: string;
    resultStatus: string | null;
  }>;
  unresolvedReasons: string[];
  unresolvedPlaceholders: string[];
  annexCKey: string | null;
  proposals: RoundOf32Proposal[];
  qualification: WorldCupQualification;
};

export type RoundOf32ResolutionOptions = {
  annexCAllocations?: Readonly<Record<string, AnnexCAllocation>>;
};

const THIRD_PLACE_SLOT_BY_R32_MATCH_ID: Record<
  string,
  { slot: AnnexCSlot; side: 'home' | 'away' }
> = {
  r32_03: { slot: 'vs1E', side: 'away' },
  r32_06: { slot: 'vs1I', side: 'away' },
  r32_07: { slot: 'vs1A', side: 'away' },
  r32_08: { slot: 'vs1L', side: 'away' },
  r32_09: { slot: 'vs1G', side: 'away' },
  r32_10: { slot: 'vs1D', side: 'away' },
  r32_13: { slot: 'vs1B', side: 'away' },
  r32_16: { slot: 'vs1K', side: 'away' },
};

export function buildRoundOf32Resolution(
  matches: BracketMatchLike[],
  teams: QualificationTeamLike[],
  options: RoundOf32ResolutionOptions = {},
): RoundOf32Resolution {
  const groupMatches = matches.filter((match) => match.phase === 'groups');
  const blockingMatches = groupMatches
    .filter((match) => !isConsistentFinalMatchResult(match))
    .map((match) => ({
      id: match.id,
      homeTeamCode: match.homeTeamCode,
      awayTeamCode: match.awayTeamCode,
      resultStatus: match.resultStatus || null,
    }));
  const qualification = calculateWorldCupQualification(matches, teams);
  const unresolvedReasons = [...qualification.unresolvedTies];
  const unresolvedPlaceholders = new Set<string>();
  const proposals: RoundOf32Proposal[] = [];

  if (groupMatches.length !== 72) {
    unresolvedReasons.push(`Se esperaban 72 partidos de grupos y se encontraron ${groupMatches.length}.`);
  }
  if (blockingMatches.length > 0) {
    unresolvedReasons.push(`${blockingMatches.length} partido(s) de grupos todavía no tienen resultado final consistente.`);
  }

  const directPlaceholderMap = buildDirectGroupPlaceholderMap(qualification);
  const qualifiedThirdByGroup = new Map(
    qualification.thirdPlacedTeams
      .filter((entry) => entry.status === 'third_place_qualified')
      .map((entry) => [entry.group, entry.teamCode]),
  );
  const r32Matches = matches.filter((match) => match.phase === 'r32');
  const qualifiedThirdGroups = [...qualifiedThirdByGroup.keys()];
  let annexCKey: string | null = null;
  let annexCAllocation: AnnexCAllocation | null = null;

  if (qualifiedThirdGroups.length === 8) {
    annexCKey = canonicalThirdPlaceGroups(qualifiedThirdGroups);
    annexCAllocation = getAnnexCAllocationForGroups(
      qualifiedThirdGroups,
      options.annexCAllocations,
    );
    if (!annexCAllocation) {
      unresolvedReasons.push(`No existe una asignación Annex C para la combinación ${annexCKey}.`);
    }
  } else {
    unresolvedReasons.push(
      `Annex C requiere ocho grupos de terceros clasificados y se encontraron ${qualifiedThirdGroups.length}.`,
    );
  }

  for (const match of r32Matches) {
    const resolvedHomeTeamCode = resolveRoundOf32TeamCode(
      match.id,
      'home',
      match.homeTeamCode,
      directPlaceholderMap,
      qualifiedThirdByGroup,
      annexCAllocation,
    );
    const resolvedAwayTeamCode = resolveRoundOf32TeamCode(
      match.id,
      'away',
      match.awayTeamCode,
      directPlaceholderMap,
      qualifiedThirdByGroup,
      annexCAllocation,
    );
    if (!resolvedHomeTeamCode) unresolvedPlaceholders.add(match.homeTeamCode);
    if (!resolvedAwayTeamCode) unresolvedPlaceholders.add(match.awayTeamCode);
    if (resolvedHomeTeamCode && resolvedAwayTeamCode) {
      const changed = (
        match.homeTeamCode !== resolvedHomeTeamCode
        || match.awayTeamCode !== resolvedAwayTeamCode
      );
      const thirdPlaceSlot = THIRD_PLACE_SLOT_BY_R32_MATCH_ID[match.id];
      proposals.push({
        matchId: match.id,
        currentHomeTeamCode: match.homeTeamCode,
        currentAwayTeamCode: match.awayTeamCode,
        resolvedHomeTeamCode,
        resolvedAwayTeamCode,
        reason: thirdPlaceSlot && annexCKey && annexCAllocation
          ? `Annex C ${annexCKey}: ${thirdPlaceSlot.slot} -> ${annexCAllocation[thirdPlaceSlot.slot]}.`
          : 'Posiciones directas de grupo o equipos ya materializados.',
        changed,
      });
    }
  }

  if (r32Matches.length !== 16) {
    unresolvedReasons.push(`Se esperaban 16 partidos de dieciseisavos y se encontraron ${r32Matches.length}.`);
  }
  if (unresolvedPlaceholders.size > 0) {
    unresolvedReasons.push(`No se pudieron resolver: ${Array.from(unresolvedPlaceholders).join(', ')}.`);
  }

  const applicableProposalCount = proposals.filter((proposal) => proposal.changed).length;
  const groupStageResolved = (
    groupMatches.length === 72
    && blockingMatches.length === 0
    && qualification.unresolvedTies.length === 0
  );

  const ready = (
    blockingMatches.length === 0
    && unresolvedReasons.length === 0
    && proposals.length === 16
  );

  return {
    ready,
    canApplySafeProposals: groupStageResolved && ready && applicableProposalCount > 0,
    applicableProposalCount,
    blockingMatches,
    unresolvedReasons: Array.from(new Set(unresolvedReasons)),
    unresolvedPlaceholders: Array.from(unresolvedPlaceholders),
    annexCKey,
    proposals,
    qualification,
  };
}

export function resolveDirectGroupPlaceholder(
  placeholder: string,
  qualification: WorldCupQualification,
): string | null {
  return buildDirectGroupPlaceholderMap(qualification).get(placeholder.toUpperCase()) || null;
}

function buildDirectGroupPlaceholderMap(qualification: WorldCupQualification): Map<string, string> {
  const result = new Map<string, string>();
  for (const group of qualification.groups) {
    const winner = group.entries.find((entry) => entry.rank === 1 && entry.status === 'group_winner');
    const runnerUp = group.entries.find((entry) => entry.rank === 2 && entry.status === 'group_runner_up');
    if (winner) result.set(`1${group.group}`, winner.teamCode);
    if (runnerUp) result.set(`2${group.group}`, runnerUp.teamCode);
  }
  return result;
}

function resolveRoundOf32TeamCode(
  matchId: string,
  side: 'home' | 'away',
  currentCode: string,
  directPlaceholderMap: Map<string, string>,
  qualifiedThirdByGroup: Map<string, string>,
  annexCAllocation: AnnexCAllocation | null,
): string | null {
  const normalized = currentCode.trim().toUpperCase();
  const thirdPlaceSlot = THIRD_PLACE_SLOT_BY_R32_MATCH_ID[matchId];
  if (thirdPlaceSlot?.side === side) {
    if (!annexCAllocation) return null;
    const assignedPlaceholder = isThirdPlacePlaceholder(normalized)
      ? resolveThirdPlacePlaceholder(normalized, thirdPlaceSlot.slot, annexCAllocation)
      : annexCAllocation[thirdPlaceSlot.slot];
    if (!assignedPlaceholder) return null;
    return qualifiedThirdByGroup.get(assignedPlaceholder.slice(1)) || null;
  }
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  return directPlaceholderMap.get(normalized) || null;
}

function isThirdPlacePlaceholder(value: string): boolean {
  return /^3[A-L]+$/.test(value.trim().toUpperCase());
}
