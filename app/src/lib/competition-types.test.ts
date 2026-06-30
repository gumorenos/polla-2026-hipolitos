import { describe, expect, it } from 'vitest';
import {
  getCompetitionTypeLabel,
  getCompetitionTypeSubtitle,
  getDefaultCompetitionShowOdds,
  isCompetitionType,
} from './competition-types';

describe('competition type presentation', () => {
  it('uses the Match Pool product name and subtitle', () => {
    expect(getCompetitionTypeLabel('match_pool')).toBe('Retos por Partido');
    expect(getCompetitionTypeSubtitle('match_pool')).toBe('Bolsa entre amigos por cada partido');
  });

  it('keeps existing competition labels', () => {
    expect(getCompetitionTypeLabel('full_prediction')).toBe('Polla completa');
    expect(getCompetitionTypeLabel('champion_survivor')).toBe('Champion Survivor');
  });

  it('recognizes all supported query values', () => {
    expect(isCompetitionType('full_prediction')).toBe(true);
    expect(isCompetitionType('champion_survivor')).toBe(true);
    expect(isCompetitionType('match_pool')).toBe(true);
    expect(isCompetitionType('other')).toBe(false);
  });

  it('keeps Match Pool odds hidden by default', () => {
    expect(getDefaultCompetitionShowOdds('match_pool')).toBe(false);
  });
});
