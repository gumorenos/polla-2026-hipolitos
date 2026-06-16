export type ScoreType = 'exact' | 'tendency' | 'consolation' | 'miss';

export interface ScoreResult {
  points: number;
  type: ScoreType;
}

export interface PointsConfig {
  pointsExactScore?: number;
  pointsWinner?: number;
  pointsDraw?: number;
  pointsConsolation?: number;
  knockoutOutcomeBasis?: string; // "qualified_team" | "score_result"
}

export function calculatePoints(
  prediction: { homePrediction: number; awayPrediction: number },
  result: { 
    homeScore: number; 
    awayScore: number;
    winnerTeamCode?: string | null;
    homeTeamCode?: string;
    awayTeamCode?: string;
    isKnockout?: boolean;
  },
  config?: PointsConfig
): ScoreResult {
  const pointsExactScore = config?.pointsExactScore ?? 5;
  const pointsWinner = config?.pointsWinner ?? 3;
  const pointsDraw = config?.pointsDraw ?? 3;
  const pointsConsolation = config?.pointsConsolation ?? 1;
  const knockoutOutcomeBasis = config?.knockoutOutcomeBasis ?? 'qualified_team';

  const { homePrediction, awayPrediction } = prediction;
  const { homeScore, awayScore } = result;

  // Exact match (compares score excluding penalty shootout goals)
  if (homePrediction === homeScore && awayPrediction === awayScore) {
    return { points: pointsExactScore, type: 'exact' };
  }

  const predDiff = homePrediction - awayPrediction;
  const resultDiff = homeScore - awayScore;

  // Tendency (Winner or Draw is correct)
  const isPredHomeWin = predDiff > 0;
  const isPredAwayWin = predDiff < 0;
  const isPredDraw = predDiff === 0;

  let isActualHomeWin = false;
  let isActualAwayWin = false;
  let isActualDraw = false;

  const isKnockout = result.isKnockout ?? false;

  if (isKnockout && knockoutOutcomeBasis === 'qualified_team') {
    // For knockout matches under qualified_team basis, outcome is based on winnerTeamCode (who qualified)
    if (result.winnerTeamCode) {
      if (result.winnerTeamCode === result.homeTeamCode) {
        isActualHomeWin = true;
      } else if (result.winnerTeamCode === result.awayTeamCode) {
        isActualAwayWin = true;
      }
    } else {
      // Fallback to score if winnerTeamCode is not set
      isActualHomeWin = resultDiff > 0;
      isActualAwayWin = resultDiff < 0;
      isActualDraw = resultDiff === 0;
    }
  } else {
    // Normal outcome based on score at end of regular/extra time
    isActualHomeWin = resultDiff > 0;
    isActualAwayWin = resultDiff < 0;
    isActualDraw = resultDiff === 0;
  }

  if (isPredDraw && isActualDraw) {
    return { points: pointsDraw, type: 'tendency' };
  }

  if ((isPredHomeWin && isActualHomeWin) || (isPredAwayWin && isActualAwayWin)) {
    return { points: pointsWinner, type: 'tendency' };
  }

  // Consolation (One exact score correct)
  if (homePrediction === homeScore || awayPrediction === awayScore) {
    return { points: pointsConsolation, type: 'consolation' };
  }

  // Miss
  return { points: 0, type: 'miss' };
}
