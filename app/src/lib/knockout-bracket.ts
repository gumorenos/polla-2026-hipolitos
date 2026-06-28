import {
  calculateWorldCupQualification,
  type QualificationMatchLike,
  type QualificationTeamLike,
  type WorldCupQualification,
} from './fifa-qualification';
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
  proposals: RoundOf32Proposal[];
  qualification: WorldCupQualification;
};

export function buildRoundOf32Resolution(
  matches: BracketMatchLike[],
  teams: QualificationTeamLike[],
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
  const thirdPlaceholders = Array.from(new Set(
    r32Matches
      .flatMap((match) => [match.homeTeamCode, match.awayTeamCode])
      .filter(isThirdPlacePlaceholder),
  ));
  const thirdAssignment = resolveThirdPlacePlaceholderAssignments(
    thirdPlaceholders,
    qualifiedThirdByGroup,
  );
  if (!thirdAssignment.resolved) {
    unresolvedReasons.push(thirdAssignment.reason);
  }

  for (const match of r32Matches) {
    const resolvedHomeTeamCode = resolveRoundOf32TeamCode(
      match.homeTeamCode,
      directPlaceholderMap,
      thirdAssignment.assignments,
    );
    const resolvedAwayTeamCode = resolveRoundOf32TeamCode(
      match.awayTeamCode,
      directPlaceholderMap,
      thirdAssignment.assignments,
    );
    if (!resolvedHomeTeamCode) unresolvedPlaceholders.add(match.homeTeamCode);
    if (!resolvedAwayTeamCode) unresolvedPlaceholders.add(match.awayTeamCode);
    if (resolvedHomeTeamCode && resolvedAwayTeamCode) {
      proposals.push({
        matchId: match.id,
        currentHomeTeamCode: match.homeTeamCode,
        currentAwayTeamCode: match.awayTeamCode,
        resolvedHomeTeamCode,
        resolvedAwayTeamCode,
      });
    }
  }

  if (r32Matches.length !== 16) {
    unresolvedReasons.push(`Se esperaban 16 partidos de dieciseisavos y se encontraron ${r32Matches.length}.`);
  }
  if (unresolvedPlaceholders.size > 0) {
    unresolvedReasons.push(`No se pudieron resolver: ${Array.from(unresolvedPlaceholders).join(', ')}.`);
  }

  const applicableProposalCount = proposals.filter((proposal) => (
    proposal.currentHomeTeamCode !== proposal.resolvedHomeTeamCode
    || proposal.currentAwayTeamCode !== proposal.resolvedAwayTeamCode
  )).length;
  const groupStageResolved = (
    groupMatches.length === 72
    && blockingMatches.length === 0
    && qualification.unresolvedTies.length === 0
  );

  return {
    ready: (
      blockingMatches.length === 0
      && unresolvedReasons.length === 0
      && proposals.length === 16
    ),
    canApplySafeProposals: groupStageResolved && applicableProposalCount > 0,
    applicableProposalCount,
    blockingMatches,
    unresolvedReasons: Array.from(new Set(unresolvedReasons)),
    unresolvedPlaceholders: Array.from(unresolvedPlaceholders),
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

export function resolveThirdPlacePlaceholderAssignments(
  placeholders: string[],
  qualifiedThirdByGroup: Map<string, string>,
): { resolved: boolean; assignments: Map<string, string>; reason: string } {
  if (placeholders.length === 0) {
    return { resolved: true, assignments: new Map(), reason: '' };
  }
  if (qualifiedThirdByGroup.size !== placeholders.length) {
    return {
      resolved: false,
      assignments: new Map(),
      reason: `La asignación de terceros requiere ${placeholders.length} grupos clasificados y hay ${qualifiedThirdByGroup.size}.`,
    };
  }

  const ordered = [...placeholders].sort((left, right) => {
    const leftCount = eligibleGroupsForPlaceholder(left, qualifiedThirdByGroup).length;
    const rightCount = eligibleGroupsForPlaceholder(right, qualifiedThirdByGroup).length;
    return leftCount - rightCount || left.localeCompare(right);
  });
  const solutions: Array<Map<string, string>> = [];

  const search = (index: number, usedGroups: Set<string>, assignment: Map<string, string>) => {
    if (solutions.length > 1) return;
    if (index === ordered.length) {
      solutions.push(new Map(assignment));
      return;
    }
    const placeholder = ordered[index];
    for (const group of eligibleGroupsForPlaceholder(placeholder, qualifiedThirdByGroup)) {
      if (usedGroups.has(group)) continue;
      const teamCode = qualifiedThirdByGroup.get(group);
      if (!teamCode) continue;
      usedGroups.add(group);
      assignment.set(placeholder, teamCode);
      search(index + 1, usedGroups, assignment);
      assignment.delete(placeholder);
      usedGroups.delete(group);
    }
  };

  search(0, new Set(), new Map());
  if (solutions.length === 1) {
    return { resolved: true, assignments: solutions[0], reason: '' };
  }
  return {
    resolved: false,
    assignments: new Map(),
    reason: solutions.length === 0
      ? 'Los mejores terceros no encajan en los placeholders configurados.'
      : 'La asignación de mejores terceros no es única; se requiere confirmar el cruce oficial antes de aplicar.',
  };
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
  currentCode: string,
  directPlaceholderMap: Map<string, string>,
  thirdAssignments: Map<string, string>,
): string | null {
  const normalized = currentCode.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) return normalized;
  return directPlaceholderMap.get(normalized) || thirdAssignments.get(normalized) || null;
}

function isThirdPlacePlaceholder(value: string): boolean {
  return /^3[A-L]+$/.test(value.trim().toUpperCase());
}

function eligibleGroupsForPlaceholder(
  placeholder: string,
  qualifiedThirdByGroup: Map<string, string>,
): string[] {
  const allowedGroups = placeholder.trim().toUpperCase().slice(1).split('');
  return allowedGroups.filter((group) => qualifiedThirdByGroup.has(group));
}
