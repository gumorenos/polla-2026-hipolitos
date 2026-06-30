export type MatchResultStateLike = {
  status?: string | null;
  resultStatus?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

export type CompleteMatchResultStateLike = MatchResultStateLike & {
  phase: string;
  winnerTeamCode?: string | null;
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
  winnerTeamCode?: string | null;
  allowWinnerWithoutPenaltyScore?: boolean;
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

function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function normalizeFinalMatchResult(input: FinalMatchResultInput): FinalMatchResultValidation {
  if (!isValidScore(input.homeScore) || !isValidScore(input.awayScore)) {
    return { valid: false, error: 'Los marcadores deben ser números enteros mayores o iguales a cero.' };
  }

  const isKnockout = input.phase !== 'groups';
  const isDraw = input.homeScore === input.awayScore;
  const wentToPenalties = Boolean(input.wentToPenalties);
  const wentToExtraTime = Boolean(input.wentToExtraTime) || wentToPenalties;
  const explicitWinnerTeamCode = input.winnerTeamCode?.trim() || null;
  let homePenaltyScore: number | null = null;
  let awayPenaltyScore: number | null = null;
  let winnerTeamCode: string | null = null;

  if (
    explicitWinnerTeamCode !== null
    && explicitWinnerTeamCode !== input.homeTeamCode
    && explicitWinnerTeamCode !== input.awayTeamCode
  ) {
    return { valid: false, error: 'El ganador explícito no corresponde a ninguno de los equipos del partido.' };
  }

  if (wentToPenalties) {
    if (!isKnockout) {
      return { valid: false, error: 'La tanda de penales solo aplica a un partido eliminatorio empatado.' };
    }
    if (!isDraw && !input.allowWinnerWithoutPenaltyScore) {
      return { valid: false, error: 'La tanda de penales solo aplica a un partido eliminatorio empatado.' };
    }

    const homePenaltyScoreInput = input.homePenaltyScore;
    const awayPenaltyScoreInput = input.awayPenaltyScore;
    const penaltyScoresMissing = (
      homePenaltyScoreInput === null
      || homePenaltyScoreInput === undefined
      || awayPenaltyScoreInput === null
      || awayPenaltyScoreInput === undefined
    );
    const penaltyScoresValid = isValidScore(homePenaltyScoreInput) && isValidScore(awayPenaltyScoreInput);
    if (
      !penaltyScoresMissing
      && !penaltyScoresValid
    ) {
      return { valid: false, error: 'Los marcadores de la tanda de penales deben ser válidos.' };
    }

    const penaltyScoresTied = penaltyScoresValid && homePenaltyScoreInput === awayPenaltyScoreInput;
    if (penaltyScoresMissing || penaltyScoresTied) {
      if (!input.allowWinnerWithoutPenaltyScore || explicitWinnerTeamCode === null) {
        return {
          valid: false,
          error: penaltyScoresMissing
            ? 'Los marcadores de la tanda de penales son obligatorios y deben ser válidos.'
            : 'La tanda de penales debe tener un ganador.',
        };
      }
      winnerTeamCode = explicitWinnerTeamCode;
    } else if (penaltyScoresValid) {
      homePenaltyScore = homePenaltyScoreInput;
      awayPenaltyScore = awayPenaltyScoreInput;
      const penaltyWinnerTeamCode = homePenaltyScore > awayPenaltyScore
        ? input.homeTeamCode
        : input.awayTeamCode;
      if (explicitWinnerTeamCode !== null && explicitWinnerTeamCode !== penaltyWinnerTeamCode) {
        return { valid: false, error: 'El ganador informado no coincide con el resultado de la tanda de penales.' };
      }
      winnerTeamCode = penaltyWinnerTeamCode;
    } else {
      return { valid: false, error: 'Los marcadores de la tanda de penales deben ser válidos.' };
    }
  } else if (isKnockout && isDraw) {
    return { valid: false, error: 'Los partidos eliminatorios no pueden finalizar empatados sin definir ganador por penales.' };
  } else if (input.homeScore > input.awayScore) {
    winnerTeamCode = input.homeTeamCode;
  } else if (input.awayScore > input.homeScore) {
    winnerTeamCode = input.awayTeamCode;
  }

  if (explicitWinnerTeamCode !== null && explicitWinnerTeamCode !== winnerTeamCode) {
    return { valid: false, error: 'El ganador informado no coincide con el marcador final.' };
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

export function isCompleteFinalMatchResult(match: CompleteMatchResultStateLike): boolean {
  if (!isConsistentFinalMatchResult(match)) return false;
  return match.phase === 'groups' || Boolean(match.winnerTeamCode?.trim());
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
