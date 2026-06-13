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
}

export function calculatePoints(
  prediction: { homePrediction: number; awayPrediction: number },
  result: { homeScore: number; awayScore: number },
  config?: PointsConfig
): ScoreResult {
  const pointsExactScore = config?.pointsExactScore ?? 5;
  const pointsWinner = config?.pointsWinner ?? 3;
  const pointsDraw = config?.pointsDraw ?? 3;
  const pointsConsolation = config?.pointsConsolation ?? 1;

  const { homePrediction, awayPrediction } = prediction;
  const { homeScore, awayScore } = result;

  // Exact match
  if (homePrediction === homeScore && awayPrediction === awayScore) {
    return { points: pointsExactScore, type: 'exact' };
  }

  const predDiff = homePrediction - awayPrediction;
  const resultDiff = homeScore - awayScore;

  // Tendency (Winner or Draw is correct)
  const isPredHomeWin = predDiff > 0;
  const isPredAwayWin = predDiff < 0;
  const isPredDraw = predDiff === 0;

  const isResultHomeWin = resultDiff > 0;
  const isResultAwayWin = resultDiff < 0;
  const isResultDraw = resultDiff === 0;

  if (isPredDraw && isResultDraw) {
    return { points: pointsDraw, type: 'tendency' };
  }

  if ((isPredHomeWin && isResultHomeWin) || (isPredAwayWin && isResultAwayWin)) {
    return { points: pointsWinner, type: 'tendency' };
  }

  // Consolation (One exact score correct)
  if (homePrediction === homeScore || awayPrediction === awayScore) {
    return { points: pointsConsolation, type: 'consolation' };
  }

  // Miss
  return { points: 0, type: 'miss' };
}
