import { isConsistentFinalMatchResult } from './match-result';

export type PublicMatchDisplayStatus =
  | 'upcoming'
  | 'in_progress'
  | 'awaiting_result'
  | 'final';

export const GROUP_IN_PROGRESS_DISPLAY_MINUTES = 135;
export const KNOCKOUT_IN_PROGRESS_DISPLAY_MINUTES = 210;

export function getPublicMatchDisplayStatus(
  match: {
    id: string;
    phase: string;
    jornada: string;
    kickoffUtc: Date | string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    resultStatus: string | null;
  },
  now: Date | number
): PublicMatchDisplayStatus {
  // final if DB has final result: resultStatus === 'final', homeScore !== null, awayScore !== null
  if (
    match.resultStatus === 'final' &&
    match.homeScore !== null &&
    match.awayScore !== null
  ) {
    return 'final';
  }

  const kickoffTime = typeof match.kickoffUtc === 'string'
    ? new Date(match.kickoffUtc).getTime()
    : match.kickoffUtc.getTime();
  const nowTime = typeof now === 'number' ? now : now.getTime();

  if (nowTime < kickoffTime) {
    return 'upcoming';
  }

  const isKnockoutStyle =
    match.phase !== 'groups' ||
    match.id === '3rd' ||
    match.jornada === '3er Puesto' ||
    match.jornada.toLowerCase().includes('third') ||
    match.jornada.toLowerCase().includes('tercer');

  const displayWindowMinutes = isKnockoutStyle
    ? KNOCKOUT_IN_PROGRESS_DISPLAY_MINUTES
    : GROUP_IN_PROGRESS_DISPLAY_MINUTES;

  const displayWindowMs = displayWindowMinutes * 60 * 1000;

  if (nowTime >= kickoffTime && nowTime < kickoffTime + displayWindowMs) {
    return 'in_progress';
  }

  return 'awaiting_result';
}
