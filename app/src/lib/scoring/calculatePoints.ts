export type ScoreType = 'exact' | 'tendency' | 'consolation' | 'miss';

export interface ScoreResult {
  points: number;
  type: ScoreType;
}

export function calculatePoints(
  prediction: { homePrediction: number; awayPrediction: number },
  result: { homeScore: number; awayScore: number }
): ScoreResult {
  const { homePrediction, awayPrediction } = prediction;
  const { homeScore, awayScore } = result;

  // Exact match
  if (homePrediction === homeScore && awayPrediction === awayScore) {
    return { points: 5, type: 'exact' };
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

  const correctTendency =
    (isPredHomeWin && isResultHomeWin) ||
    (isPredAwayWin && isResultAwayWin) ||
    (isPredDraw && isResultDraw);

  if (correctTendency) {
    return { points: 3, type: 'tendency' };
  }

  // Consolation (One exact score correct)
  if (homePrediction === homeScore || awayPrediction === awayScore) {
    return { points: 1, type: 'consolation' };
  }

  // Miss
  return { points: 0, type: 'miss' };
}
