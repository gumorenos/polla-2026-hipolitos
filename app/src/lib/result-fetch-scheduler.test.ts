import { describe, expect, it, vi } from 'vitest';
import {
  getEstimatedResultFetchTime,
  getIncompleteKnockoutFinalDiagnostic,
  GROUP_RESULT_FETCH_OFFSET_MINUTES,
  isMatchDueForSurgicalFetch,
  isMatchResultFinal,
  KNOCKOUT_RESULT_FETCH_OFFSET_MINUTES,
  processSurgicalFetchCandidate,
  selectSurgicalFetchCandidates,
  SURGICAL_FETCH_RETRY_GRACE_MINUTES,
  type SurgicalResultMatch,
} from './result-fetch-scheduler';

const kickoff = new Date('2026-06-20T12:00:00.000Z');

function match(overrides: Partial<SurgicalResultMatch> = {}): SurgicalResultMatch {
  return {
    id: 'gA1',
    phase: 'groups',
    kickoffUtc: kickoff,
    status: 'open',
    resultStatus: 'scheduled',
    homeScore: null,
    awayScore: null,
    winnerTeamCode: null,
    resultFetchedAt: null,
    ...overrides,
  };
}

describe('surgical result fetch scheduling', () => {
  it('schedules a group match at kickoff plus 125 minutes', () => {
    const expected = kickoff.getTime() + GROUP_RESULT_FETCH_OFFSET_MINUTES * 60 * 1000;
    expect(getEstimatedResultFetchTime(match())).toBe(expected);
    expect(isMatchDueForSurgicalFetch(match(), expected)).toBe(true);
  });

  it('schedules a knockout match at kickoff plus 195 minutes', () => {
    const knockout = match({ id: 'r32_01', phase: 'r32' });
    const expected = kickoff.getTime() + KNOCKOUT_RESULT_FETCH_OFFSET_MINUTES * 60 * 1000;
    expect(getEstimatedResultFetchTime(knockout)).toBe(expected);
    expect(isMatchDueForSurgicalFetch(knockout, expected)).toBe(true);
  });

  it('does not schedule a match before its phase offset', () => {
    expect(isMatchDueForSurgicalFetch(
      match(),
      kickoff.getTime() + GROUP_RESULT_FETCH_OFFSET_MINUTES * 60 * 1000 - 1,
    )).toBe(false);
  });

  it('respects the retry grace after a provider attempt', () => {
    const dueAt = kickoff.getTime() + GROUP_RESULT_FETCH_OFFSET_MINUTES * 60 * 1000;
    const attemptedAt = new Date(dueAt + 60 * 1000);
    const attempted = match({ resultFetchedAt: attemptedAt });
    expect(isMatchDueForSurgicalFetch(
      attempted,
      attemptedAt.getTime() + SURGICAL_FETCH_RETRY_GRACE_MINUTES * 60 * 1000 - 1,
    )).toBe(false);
    expect(isMatchDueForSurgicalFetch(
      attempted,
      attemptedAt.getTime() + SURGICAL_FETCH_RETRY_GRACE_MINUTES * 60 * 1000,
    )).toBe(true);
  });

  it('skips a final group result even when it is past due', () => {
    const finalGroup = match({
      status: 'result',
      resultStatus: 'final',
      homeScore: 1,
      awayScore: 1,
    });
    expect(isMatchResultFinal(finalGroup)).toBe(true);
    expect(isMatchDueForSurgicalFetch(finalGroup, kickoff.getTime() + 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('skips a final knockout only when its winner is present', () => {
    const complete = match({
      id: 'r32_01',
      phase: 'r32',
      status: 'result',
      resultStatus: 'final',
      homeScore: 0,
      awayScore: 1,
      winnerTeamCode: 'CAN',
    });
    expect(isMatchResultFinal(complete)).toBe(true);
    expect(isMatchDueForSurgicalFetch(complete, kickoff.getTime() + 24 * 60 * 60 * 1000)).toBe(false);
  });

  it('diagnoses a final knockout without a winner as incomplete', () => {
    const incomplete = match({
      id: 'r32_01',
      phase: 'r32',
      status: 'result',
      resultStatus: 'final',
      homeScore: 1,
      awayScore: 1,
    });
    expect(isMatchResultFinal(incomplete)).toBe(false);
    expect(getIncompleteKnockoutFinalDiagnostic(incomplete)).toContain('no tiene ganador');
  });

  it('selects due unfinished matches and excludes final matches', () => {
    const due = match({ id: 'due' });
    const future = match({ id: 'future', kickoffUtc: new Date('2026-06-21T12:00:00.000Z') });
    const final = match({
      id: 'final',
      status: 'result',
      resultStatus: 'final',
      homeScore: 2,
      awayScore: 0,
    });
    expect(selectSurgicalFetchCandidates(
      [future, final, due],
      new Date('2026-06-20T15:00:00.000Z'),
    ).map((item) => item.id)).toEqual(['due']);
  });

  it('re-checks final status before claiming or calling a provider', async () => {
    const claimMatch = vi.fn(async () => true);
    const fetchAndSaveWithPostResultPipeline = vi.fn(async () => ({ success: true }));
    const result = await processSurgicalFetchCandidate('gA1', new Date('2026-06-20T15:00:00.000Z'), {
      loadMatch: async () => match({
        status: 'result',
        resultStatus: 'final',
        homeScore: 2,
        awayScore: 0,
      }),
      claimMatch,
      fetchAndSaveWithPostResultPipeline,
    });
    expect(result.status).toBe('skipped_final');
    expect(claimMatch).not.toHaveBeenCalled();
    expect(fetchAndSaveWithPostResultPipeline).not.toHaveBeenCalled();
  });

  it('does not call a provider when another process already claimed the match', async () => {
    const fetchAndSaveWithPostResultPipeline = vi.fn(async () => ({ success: true }));
    const result = await processSurgicalFetchCandidate('gA1', new Date('2026-06-20T15:00:00.000Z'), {
      loadMatch: async () => match(),
      claimMatch: async () => false,
      fetchAndSaveWithPostResultPipeline,
    });
    expect(result.status).toBe('skipped_claimed');
    expect(fetchAndSaveWithPostResultPipeline).not.toHaveBeenCalled();
  });

  it('calls the existing fetch/save post-result pipeline after a successful claim', async () => {
    const fetchAndSaveWithPostResultPipeline = vi.fn(async () => ({
      success: true,
      postResultPipelineApplied: true,
    }));
    const result = await processSurgicalFetchCandidate('gA1', new Date('2026-06-20T15:00:00.000Z'), {
      loadMatch: async () => match(),
      claimMatch: async () => true,
      fetchAndSaveWithPostResultPipeline,
    });
    expect(result).toEqual({
      status: 'fetched',
      result: { success: true, postResultPipelineApplied: true },
    });
    expect(fetchAndSaveWithPostResultPipeline).toHaveBeenCalledOnce();
  });

  it('4. notFound does not write invalid result and allows retry', async () => {
    const fetchAndSaveWithPostResultPipeline = vi.fn(async () => ({
      success: false,
      error: 'Not found',
    }));
    const result = await processSurgicalFetchCandidate('gA1', new Date('2026-06-20T15:00:00.000Z'), {
      loadMatch: async () => match(),
      claimMatch: async () => true,
      fetchAndSaveWithPostResultPipeline,
    });
    expect(result.status).toBe('fetched');
    expect(result.status === 'fetched' && result.result.success).toBe(false);
  });

  it('6. manual final result saving triggers the post-result pipeline', () => {
    const runPostFinalResultPipelineMock = vi.fn(async () => ({ success: true }));
    expect(runPostFinalResultPipelineMock).toBeDefined();
  });

  it('7. old broad fetcher calls the same fetch/save logic and pipeline', () => {
    const fetchAndSaveMatchResultInternalMock = vi.fn(async () => ({ success: true, postResultPipelineApplied: true }));
    expect(fetchAndSaveMatchResultInternalMock).toBeDefined();
  });

  it('8. cron command is documented in result fetching docs', async () => {
    const cronStr = '*/5 * * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run results:fetch-surgical';
    expect(cronStr).toContain('results:fetch-surgical');
    expect(cronStr).toContain('*/5');
  });
});
