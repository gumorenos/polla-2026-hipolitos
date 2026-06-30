import { describe, expect, it } from 'vitest';
import { parseResultFetchMatchId } from './result-fetch-cli';

describe('result fetch CLI arguments', () => {
  it('reads a named match id', () => {
    expect(parseResultFetchMatchId(['--matchId=r32_04', '--dryRun'])).toBe('r32_04');
  });

  it('reads a positional match id', () => {
    expect(parseResultFetchMatchId(['r32_04', '--dryRun', '--provider=auto'])).toBe('r32_04');
  });

  it('prefers the named match id', () => {
    expect(parseResultFetchMatchId(['r32_03', '--matchId=r32_04'])).toBe('r32_04');
  });
});
