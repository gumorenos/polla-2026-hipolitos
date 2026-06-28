export type MatchResultStateLike = {
  status?: string | null;
  resultStatus?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

export type FinalMatchResultInput = {
  phase: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number;
  awayScore: number;
  wentToExtraTime?: boolean;
  wentToPenalties?: boolean;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
};

export type NormalizedFinalMatchResult = {
  status: 'result';
  resultStatus: 'final';
  homeScore: number;
  awayScore: number;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  winnerTeamCode: string | null;
};

export type FinalMatchResultValidation =
  | { valid: true; result: NormalizedFinalMatchResult }
  | { valid: false; error: string };

function isValidScore(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

export function normalizeFinalMatchResult(input: FinalMatchResultInput): FinalMatchResultValidation {
  if (!isValidScore(input.homeScore) || !isValidScore(input.awayScore)) {
    return { valid: false, error: 'Los marcadores deben ser números enteros mayores o iguales a cero.' };
  }

  const isKnockout = input.phase !== 'groups';
  const isDraw = input.homeScore === input.awayScore;
  const wentToPenalties = Boolean(input.wentToPenalties);
  const wentToExtraTime = Boolean(input.wentToExtraTime) || wentToPenalties;
  let homePenaltyScore: number | null = null;
  let awayPenaltyScore: number | null = null;
  let winnerTeamCode: string | null = null;

  if (wentToPenalties) {
    if (!isKnockout || !isDraw) {
      return { valid: false, error: 'La tanda de penales solo aplica a un partido eliminatorio empatado.' };
    }
    if (
      input.homePenaltyScore === null
      || input.homePenaltyScore === undefined
      || input.awayPenaltyScore === null
      || input.awayPenaltyScore === undefined
      || !isValidScore(input.homePenaltyScore)
      || !isValidScore(input.awayPenaltyScore)
    ) {
      return { valid: false, error: 'Los marcadores de la tanda de penales son obligatorios y deben ser válidos.' };
    }
    if (input.homePenaltyScore === input.awayPenaltyScore) {
      return { valid: false, error: 'La tanda de penales debe tener un ganador.' };
    }
    homePenaltyScore = input.homePenaltyScore;
    awayPenaltyScore = input.awayPenaltyScore;
    winnerTeamCode = homePenaltyScore > awayPenaltyScore
      ? input.homeTeamCode
      : input.awayTeamCode;
  } else if (isKnockout && isDraw) {
    return { valid: false, error: 'Los partidos eliminatorios no pueden finalizar empatados sin definir ganador por penales.' };
  } else if (input.homeScore > input.awayScore) {
    winnerTeamCode = input.homeTeamCode;
  } else if (input.awayScore > input.homeScore) {
    winnerTeamCode = input.awayTeamCode;
  }

  return {
    valid: true,
    result: {
      status: 'result',
      resultStatus: 'final',
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      wentToExtraTime,
      wentToPenalties,
      homePenaltyScore,
      awayPenaltyScore,
      winnerTeamCode,
    },
  };
}

export function isConsistentFinalMatchResult(match: MatchResultStateLike): boolean {
  return (
    match.status === 'result'
    && match.resultStatus === 'final'
    && match.homeScore !== null
    && match.homeScore !== undefined
    && match.awayScore !== null
    && match.awayScore !== undefined
  );
}

export function getMatchResultConsistencyIssue(match: MatchResultStateLike): string | null {
  if (match.status === 'result' && !isConsistentFinalMatchResult(match)) {
    return 'El partido figura como resultado, pero no tiene marcador final completo.';
  }
  if (match.resultStatus === 'final' && !isConsistentFinalMatchResult(match)) {
    return 'El partido figura como final, pero su estado o marcador no es consistente.';
  }
  return null;
}
