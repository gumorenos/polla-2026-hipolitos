export type KnockoutPropagationMatch = {
  id: string;
  phase: string;
  jornada?: string | null;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number | null;
  awayScore: number | null;
  resultStatus?: string | null;
  winnerTeamCode?: string | null;
};

export type KnockoutPropagationProposal = {
  matchId: string;
  side: 'home' | 'away';
  sourceMatchId: string;
  placeholder: string;
  currentTeamCode: string;
  resolvedTeamCode: string;
  changed: boolean;
  reason: string;
};

export type KnockoutPropagationConflict = {
  matchId: string;
  side: 'home' | 'away';
  placeholder: string;
  currentTeamCode: string;
  resolvedTeamCode: string;
  reason: string;
};

export type KnockoutPropagationPlan = {
  proposals: KnockoutPropagationProposal[];
  conflicts: KnockoutPropagationConflict[];
  pendingReferences: string[];
  changedCount: number;
};

export type TournamentRepairChange = {
  changeType: 'bracket' | 'group_status' | 'knockout_status';
  leagueId: string | null;
  matchId: string | null;
  teamCode: string;
  from: string;
  to: string;
  reason: string;
  safe: boolean;
};

export type TournamentRepairPreview = {
  changes: TournamentRepairChange[];
  blocked: string[];
};

type TargetSlot = {
  matchId: string;
  home: string;
  away: string;
};

const TARGET_SLOTS: TargetSlot[] = [
  { matchId: 'r16_01', home: 'W73', away: 'W75' },
  { matchId: 'r16_02', home: 'W74', away: 'W77' },
  { matchId: 'r16_03', home: 'W76', away: 'W78' },
  { matchId: 'r16_04', home: 'W79', away: 'W80' },
  { matchId: 'r16_05', home: 'W83', away: 'W84' },
  { matchId: 'r16_06', home: 'W81', away: 'W82' },
  { matchId: 'r16_07', home: 'W86', away: 'W88' },
  { matchId: 'r16_08', home: 'W85', away: 'W87' },
  { matchId: 'qf_01', home: 'W89', away: 'W90' },
  { matchId: 'qf_02', home: 'W93', away: 'W94' },
  { matchId: 'qf_03', home: 'W91', away: 'W92' },
  { matchId: 'qf_04', home: 'W95', away: 'W96' },
  { matchId: 'sf_01', home: 'W97', away: 'W98' },
  { matchId: 'sf_02', home: 'W99', away: 'W100' },
  { matchId: '3rd', home: 'RU101', away: 'RU102' },
  { matchId: 'final', home: 'W101', away: 'W102' },
];

export function buildKnockoutPropagationPlan(
  matches: KnockoutPropagationMatch[],
): KnockoutPropagationPlan {
  const workingById = new Map(matches.map((match) => [match.id, { ...match }]));
  const sourceByReference = buildSourceReferenceMap(matches);
  const proposals: KnockoutPropagationProposal[] = [];
  const conflicts: KnockoutPropagationConflict[] = [];
  const pendingReferences = new Set<string>();

  for (const target of TARGET_SLOTS) {
    const targetMatch = workingById.get(target.matchId);
    if (!targetMatch) continue;

    for (const side of ['home', 'away'] as const) {
      const placeholder = target[side];
      const sourceMatch = sourceByReference.get(placeholder);
      if (!sourceMatch) {
        pendingReferences.add(placeholder);
        continue;
      }
      const resolvedTeamCode = resolveReferenceTeamCode(placeholder, sourceMatch);
      if (!resolvedTeamCode) {
        pendingReferences.add(placeholder);
        continue;
      }

      const field = side === 'home' ? 'homeTeamCode' : 'awayTeamCode';
      const currentTeamCode = targetMatch[field];
      if (currentTeamCode !== placeholder && currentTeamCode !== resolvedTeamCode) {
        conflicts.push({
          matchId: targetMatch.id,
          side,
          placeholder,
          currentTeamCode,
          resolvedTeamCode,
          reason: 'El cruce ya contiene otro equipo real y no se sobrescribió automáticamente.',
        });
        continue;
      }

      const changed = currentTeamCode !== resolvedTeamCode;
      proposals.push({
        matchId: targetMatch.id,
        side,
        sourceMatchId: sourceMatch.id,
        placeholder,
        currentTeamCode,
        resolvedTeamCode,
        changed,
        reason: `${placeholder} resuelto desde el resultado final de ${sourceMatch.id}.`,
      });
      if (changed) targetMatch[field] = resolvedTeamCode;
    }
  }

  return {
    proposals,
    conflicts,
    pendingReferences: Array.from(pendingReferences).sort(),
    changedCount: proposals.filter((proposal) => proposal.changed).length,
  };
}

export function getFinalKnockoutOutcome(
  match: KnockoutPropagationMatch,
): { winnerTeamCode: string; loserTeamCode: string } | null {
  if (
    match.phase === 'groups'
    || match.id === '3rd'
    || match.resultStatus !== 'final'
    || match.homeScore === null
    || match.awayScore === null
  ) {
    return null;
  }

  let winnerTeamCode = match.winnerTeamCode || null;
  if (!winnerTeamCode && match.homeScore !== match.awayScore) {
    winnerTeamCode = match.homeScore > match.awayScore
      ? match.homeTeamCode
      : match.awayTeamCode;
  }
  if (winnerTeamCode !== match.homeTeamCode && winnerTeamCode !== match.awayTeamCode) {
    return null;
  }

  return {
    winnerTeamCode,
    loserTeamCode: winnerTeamCode === match.homeTeamCode
      ? match.awayTeamCode
      : match.homeTeamCode,
  };
}

function buildSourceReferenceMap(
  matches: KnockoutPropagationMatch[],
): Map<string, KnockoutPropagationMatch> {
  const result = new Map<string, KnockoutPropagationMatch>();
  for (const match of matches) {
    const matchNumber = getFifaMatchNumber(match.id);
    if (!matchNumber) continue;
    result.set(`W${matchNumber}`, match);
    if (match.id === 'sf_01' || match.id === 'sf_02') {
      result.set(`RU${matchNumber}`, match);
    }
  }
  return result;
}

function resolveReferenceTeamCode(
  reference: string,
  sourceMatch: KnockoutPropagationMatch,
): string | null {
  const outcome = getFinalKnockoutOutcome(sourceMatch);
  if (!outcome) return null;
  return reference.startsWith('RU') ? outcome.loserTeamCode : outcome.winnerTeamCode;
}

function getFifaMatchNumber(matchId: string): number | null {
  const patterns: Array<[RegExp, number]> = [
    [/^r32_(\d{2})$/, 72],
    [/^r16_(\d{2})$/, 88],
    [/^qf_(\d{2})$/, 96],
    [/^sf_(\d{2})$/, 100],
  ];
  for (const [pattern, offset] of patterns) {
    const match = matchId.match(pattern);
    if (match) return offset + Number(match[1]);
  }
  if (matchId === '3rd') return 103;
  if (matchId === 'final') return 104;
  return null;
}
