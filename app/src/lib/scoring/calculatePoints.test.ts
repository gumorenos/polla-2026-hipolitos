import { describe, it, expect } from 'vitest';
import { calculatePoints } from './calculatePoints';

describe('calculatePoints', () => {
  it('should return exact points (5) when exact score matches', () => {
    // Exact home win
    expect(calculatePoints({ homePrediction: 2, awayPrediction: 1 }, { homeScore: 2, awayScore: 1 })).toEqual({ points: 5, type: 'exact' });
    // Exact away win
    expect(calculatePoints({ homePrediction: 0, awayPrediction: 3 }, { homeScore: 0, awayScore: 3 })).toEqual({ points: 5, type: 'exact' });
    // Exact draw
    expect(calculatePoints({ homePrediction: 1, awayPrediction: 1 }, { homeScore: 1, awayScore: 1 })).toEqual({ points: 5, type: 'exact' });
  });

  it('should return tendency points (3) when tendency matches but not exact score', () => {
    // Correct tendency home win
    expect(calculatePoints({ homePrediction: 2, awayPrediction: 0 }, { homeScore: 3, awayScore: 1 })).toEqual({ points: 3, type: 'tendency' });
    // Correct tendency away win
    expect(calculatePoints({ homePrediction: 0, awayPrediction: 2 }, { homeScore: 1, awayScore: 4 })).toEqual({ points: 3, type: 'tendency' });
    // Correct tendency draw
    expect(calculatePoints({ homePrediction: 1, awayPrediction: 1 }, { homeScore: 2, awayScore: 2 })).toEqual({ points: 3, type: 'tendency' });
  });

  it('should return consolation points (1) when one exact score matches but tendency misses', () => {
    // Consolation home score (predicted home 1 away 0 -> home win. Result home 1 away 2 -> away win)
    expect(calculatePoints({ homePrediction: 1, awayPrediction: 0 }, { homeScore: 1, awayScore: 2 })).toEqual({ points: 1, type: 'consolation' });
    // Consolation away score (predicted home 2 away 1 -> home win. Result home 0 away 1 -> away win)
    expect(calculatePoints({ homePrediction: 2, awayPrediction: 1 }, { homeScore: 0, awayScore: 1 })).toEqual({ points: 1, type: 'consolation' });
  });

  it('should return miss points (0) when neither exact score nor tendency matches', () => {
    // Miss completely
    expect(calculatePoints({ homePrediction: 2, awayPrediction: 0 }, { homeScore: 0, awayScore: 1 })).toEqual({ points: 0, type: 'miss' });
    // Another miss
    expect(calculatePoints({ homePrediction: 1, awayPrediction: 1 }, { homeScore: 3, awayScore: 0 })).toEqual({ points: 0, type: 'miss' });
  });
});
