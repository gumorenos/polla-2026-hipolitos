import { describe, it, expect } from 'vitest';
import { matchTeamName, normalizeTeamName, matchEventToFixture } from './providers';

describe('Team Name Normalization', () => {
  it('should convert to lowercase', () => {
    expect(normalizeTeamName('BOSNIA')).toBe('bosnia');
  });

  it('should trim leading/trailing spaces', () => {
    expect(normalizeTeamName('  Bosnia  ')).toBe('bosnia');
  });

  it('should remove accents and diacritics', () => {
    expect(normalizeTeamName('Curaçao')).toBe('curacao');
    expect(normalizeTeamName('Côte d\'Ivoire')).toBe('cote divoire');
    expect(normalizeTeamName('Sudáfrica')).toBe('sudafrica');
  });

  it('should replace & with and', () => {
    expect(normalizeTeamName('Bosnia & Herzegovina')).toBe('bosnia and herzegovina');
  });

  it('should normalize hyphens to spaces', () => {
    expect(normalizeTeamName('Bosnia-Herzegovina')).toBe('bosnia herzegovina');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizeTeamName('Bosnia    Herzegovina')).toBe('bosnia herzegovina');
  });
});

describe('Odds Team Matcher - BIH and Problematic Countries', () => {
  it('should match BIH (Bosnia) correctly with all common aliases', () => {
    expect(matchTeamName('Bosnia and Herzegovina', 'BIH')).toBe(true);
    expect(matchTeamName('Bosnia-Herzegovina', 'BIH')).toBe(true);
    expect(matchTeamName('Bosnia & Herzegovina', 'BIH')).toBe(true);
    expect(matchTeamName('Bosnia Herzegovina', 'BIH')).toBe(true);
    expect(matchTeamName('Bosnia', 'BIH')).toBe(true);
    expect(matchTeamName('Bosnia y Herzegovina', 'BIH')).toBe(true);
  });

  it('should match COD (DR Congo) correctly with all common aliases', () => {
    expect(matchTeamName('DR Congo', 'COD')).toBe(true);
    expect(matchTeamName('Congo DR', 'COD')).toBe(true);
    expect(matchTeamName('Democratic Republic of the Congo', 'COD')).toBe(true);
    expect(matchTeamName('Congo, Democratic Republic of the', 'COD')).toBe(true);
  });

  it('should match CIV (Ivory Coast) correctly with all common aliases', () => {
    expect(matchTeamName('Ivory Coast', 'CIV')).toBe(true);
    expect(matchTeamName('Côte d\'Ivoire', 'CIV')).toBe(true);
    expect(matchTeamName('Cote d\'Ivoire', 'CIV')).toBe(true);
    expect(matchTeamName('Cote dIvoire', 'CIV')).toBe(true);
    expect(matchTeamName('Costa de Marfil', 'CIV')).toBe(true);
  });

  it('should match KOR (South Korea) correctly', () => {
    expect(matchTeamName('South Korea', 'KOR')).toBe(true);
    expect(matchTeamName('Korea Republic', 'KOR')).toBe(true);
    expect(matchTeamName('Corea del Sur', 'KOR')).toBe(true);
  });

  it('should match CZE (Czechia) correctly', () => {
    expect(matchTeamName('Czechia', 'CZE')).toBe(true);
    expect(matchTeamName('Czech Republic', 'CZE')).toBe(true);
    expect(matchTeamName('Chequia', 'CZE')).toBe(true);
  });

  it('should match CUR/CUW (Curaçao) correctly', () => {
    expect(matchTeamName('Curaçao', 'CUR')).toBe(true);
    expect(matchTeamName('Curacao', 'CUR')).toBe(true);
    expect(matchTeamName('Curazao', 'CUR')).toBe(true);
    expect(matchTeamName('Curaçao', 'CUW')).toBe(true);
    expect(matchTeamName('Curacao', 'CUW')).toBe(true);
  });

  it('should match CPV (Cape Verde) correctly', () => {
    expect(matchTeamName('Cape Verde', 'CPV')).toBe(true);
    expect(matchTeamName('Cabo Verde', 'CPV')).toBe(true);
  });

  it('should match IRI/IRN (Iran) correctly', () => {
    expect(matchTeamName('Iran', 'IRI')).toBe(true);
    expect(matchTeamName('Iran', 'IRN')).toBe(true);
    expect(matchTeamName('Irán', 'IRI')).toBe(true);
    expect(matchTeamName('Irán', 'IRN')).toBe(true);
  });

  it('should match DZA/ALG (Algeria) correctly', () => {
    expect(matchTeamName('Algeria', 'DZA')).toBe(true);
    expect(matchTeamName('Algeria', 'ALG')).toBe(true);
    expect(matchTeamName('Argelia', 'DZA')).toBe(true);
  });

  it('should match RSA (South Africa) correctly', () => {
    expect(matchTeamName('South Africa', 'RSA')).toBe(true);
    expect(matchTeamName('Sudáfrica', 'RSA')).toBe(true);
  });

  it('should match SCO (Scotland) correctly', () => {
    expect(matchTeamName('Scotland', 'SCO')).toBe(true);
    expect(matchTeamName('Escocia', 'SCO')).toBe(true);
  });

  it('should match ENG (England) correctly', () => {
    expect(matchTeamName('England', 'ENG')).toBe(true);
    expect(matchTeamName('Inglaterra', 'ENG')).toBe(true);
  });
});

describe('matchEventToFixture smoke test', () => {
  const kickoff = new Date('2026-06-15T18:00:00Z');

  it('should match BIH vs SUI / SUI vs BIH with various formats and time windows', () => {
    // Exact matching direct
    const res1 = matchEventToFixture(
      { home_team: 'Bosnia and Herzegovina', away_team: 'Switzerland', bookmakers: [] },
      'BIH', 'SUI', kickoff
    );
    expect(res1.matches).toBe(true);
    expect(res1.isReverse).toBe(false);

    // Exact matching reverse
    const res2 = matchEventToFixture(
      { home_team: 'Suiza', away_team: 'Bosnia-Herzegovina', bookmakers: [] },
      'BIH', 'SUI', kickoff
    );
    expect(res2.matches).toBe(true);
    expect(res2.isReverse).toBe(true);

    // Fuzzy matching within 12 hours (direct)
    const res3 = matchEventToFixture(
      { home_team: 'Bosnia Herzegovina Football', away_team: 'Switzerland FC', commence_time: '2026-06-15T22:00:00Z', bookmakers: [] },
      'BIH', 'SUI', kickoff
    );
    expect(res3.matches).toBe(true);
    expect(res3.isFuzzy).toBe(true);
    expect(res3.isReverse).toBe(false);

    // Fuzzy matching outside 12 hours (should fail)
    const res4 = matchEventToFixture(
      { home_team: 'Bosnia Herzegovina Football', away_team: 'Switzerland FC', commence_time: '2026-06-16T08:00:00Z', bookmakers: [] },
      'BIH', 'SUI', kickoff
    );
    expect(res4.matches).toBe(false);
  });

  it('should match CAN vs BIH', () => {
    const res = matchEventToFixture(
      { home_team: 'Canada', away_team: 'Bosnia Herzegovina', bookmakers: [] },
      'CAN', 'BIH', kickoff
    );
    expect(res.matches).toBe(true);
    expect(res.isReverse).toBe(false);
  });

  it('should match BIH vs QAT', () => {
    const res = matchEventToFixture(
      { home_team: 'Bosnia y Herzeg.', away_team: 'Qatar', bookmakers: [] },
      'BIH', 'QAT', kickoff
    );
    expect(res.matches).toBe(true);
    expect(res.isReverse).toBe(false);
  });
});
