/**
 * Computed match status utility.
 * Separates the display status (computed at render time) from the DB `status` field.
 */

import { isConsistentFinalMatchResult } from '../match-result';

export type ComputedMatchStatus =
  | 'scheduled'      // kickoff in the future
  | 'closed_pending' // past kickoff, no result yet
  | 'final'          // result entered
  | 'postponed'
  | 'cancelled';

export interface ComputedMatchStatusDisplay {
  label: string;
  labelShort: string;
  colorClass: string;       // tailwind text color
  bgClass: string;          // tailwind bg color
  borderClass: string;      // tailwind border color
}

export function getComputedMatchStatus(match: {
  kickoffUtc: Date | string | number;
  homeScore?: number | null;
  awayScore?: number | null;
  resultStatus?: string | null;
  status?: string | null;
}): ComputedMatchStatus {
  const { resultStatus } = match;

  if (resultStatus === 'postponed') return 'postponed';
  if (resultStatus === 'cancelled') return 'cancelled';
  if (isConsistentFinalMatchResult(match)) return 'final';

  const kickoff = new Date(match.kickoffUtc).getTime();
  const now = Date.now();

  if (kickoff > now) return 'scheduled';
  return 'closed_pending';
}

export function getComputedStatusDisplay(status: ComputedMatchStatus): ComputedMatchStatusDisplay {
  switch (status) {
    case 'scheduled':
      return {
        label: 'Próximo',
        labelShort: 'Próximo',
        colorClass: 'text-text-muted',
        bgClass: 'bg-surface',
        borderClass: 'border-border',
      };
    case 'closed_pending':
      return {
        label: 'Cerrado — resultado pendiente',
        labelShort: 'Pendiente',
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-400/10',
        borderClass: 'border-amber-400/30',
      };
    case 'final':
      return {
        label: 'Finalizado',
        labelShort: 'Final',
        colorClass: 'text-gold',
        bgClass: 'bg-gold/10',
        borderClass: 'border-gold/30',
      };
    case 'postponed':
      return {
        label: 'Postergado',
        labelShort: 'Postergado',
        colorClass: 'text-orange-400',
        bgClass: 'bg-orange-400/10',
        borderClass: 'border-orange-400/30',
      };
    case 'cancelled':
      return {
        label: 'Cancelado',
        labelShort: 'Cancelado',
        colorClass: 'text-red-400',
        bgClass: 'bg-red-400/10',
        borderClass: 'border-red-400/30',
      };
  }
}
