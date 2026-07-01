/**
 * app/src/lib/match-pool.ts
 *
 * Pure domain logic for "Retos por Partido" (Match Pool) competition.
 *
 * IMPORTANT — Money safety:
 *   This module operates on REFERENTIAL amounts only. The app does NOT process,
 *   custody, transfer, or settle real money. All "amounts" and "netAmount" values
 *   are for private social tracking only. No payment processor is used.
 *
 * Terminology:
 *   monto referencial, reto, bolsa entre amigos, liquidación referencial,
 *   pendiente de coordinar fuera de la app.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MatchPoolPickType =
  | 'home_win'        // group matches only
  | 'draw'            // group matches only
  | 'away_win'        // group matches only
  | 'home_advances'   // knockout matches only
  | 'away_advances';  // knockout matches only

export type MatchPoolStatus =
  | 'open'       // accepting entries (before kickoff)
  | 'locked'     // kickoff passed, no new entries
  | 'void'       // < 2 entries, no winners, or admin-cancelled
  | 'settled'    // result applied, referential net amounts recorded
  | 'cancelled'; // admin cancelled explicitly

export type MatchPoolEntryStatus =
  | 'active'
  | 'winner'
  | 'loser'
  | 'void'
  | 'cancelled';

export type MatchPoolInviteStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired';

export interface MatchPoolMatchContext {
  id: string;
  phase: string;
  homeTeamCode: string;
  awayTeamCode: string;
  kickoffUtc: Date | string;
  status: string;
  resultStatus: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamCode: string | null;
}

export interface MatchPoolSettlementInput {
  poolId: string;
  entries: Array<{
    id: string;
    userId: string;
    pickType: MatchPoolPickType;
    pickValue: string;
  }>;
  amount: number;
  match: MatchPoolMatchContext;
}

export interface MatchPoolSettlementResult {
  poolStatus: MatchPoolStatus;
  settlementReason: string;
  entryResults: Array<{
    entryId: string;
    userId: string;
    status: MatchPoolEntryStatus;
    netAmount: number | null;
    resultNote: string;
  }>;
}

export interface MatchPoolMutationContext {
  status: MatchPoolStatus;
  createdByUserId: string;
  currentUserId: string;
  entryUserIds: string[];
  isSuperadmin: boolean;
  reason?: string | null;
}

export interface MatchPoolMutationDecision {
  allowed: boolean;
  requiresAudit: boolean;
  error: string | null;
}

export interface EditMatchPoolInput {
  poolId: string;
  matchId: string;
  amount: number;
  currency: string;
  note?: string;
  pickType: MatchPoolPickType;
  pickValue: string;
  reason?: string;
}

export interface MatchPoolLateEntryConfig {
  enabled: boolean;
  minutes: number;
}

// ─── Pick options ──────────────────────────────────────────────────────────────

/**
 * Returns the allowed pick options for a given match.
 * Group matches: 1X2 (home_win, draw, away_win).
 * Knockout matches: home_advances or away_advances.
 */
export function getAllowedMatchPoolPickOptions(
  match: Pick<MatchPoolMatchContext, 'phase'>,
): MatchPoolPickType[] {
  if (match.phase === 'groups') {
    return ['home_win', 'draw', 'away_win'];
  }
  return ['home_advances', 'away_advances'];
}

// ─── Access guards ─────────────────────────────────────────────────────────────

/**
 * Returns true if a pool can be created for this match (before kickoff).
 */
export function canCreateMatchPool(
  match: Pick<MatchPoolMatchContext, 'kickoffUtc'>,
  now: Date,
  lateEntry: MatchPoolLateEntryConfig = { enabled: false, minutes: 45 },
): boolean {
  return now.getTime() < getMatchPoolEntryDeadline(match, lateEntry).getTime();
}

export function getMatchPoolEntryDeadline(
  match: Pick<MatchPoolMatchContext, 'kickoffUtc'>,
  lateEntry: MatchPoolLateEntryConfig,
): Date {
  const kickoffMs = new Date(match.kickoffUtc).getTime();
  const extraMinutes = lateEntry.enabled ? Math.max(0, lateEntry.minutes) : 0;
  return new Date(kickoffMs + extraMinutes * 60_000);
}

/**
 * Returns true if a user can join an existing open pool (before kickoff).
 */
export function canJoinMatchPool(
  pool: { status: MatchPoolStatus },
  match: Pick<MatchPoolMatchContext, 'kickoffUtc'>,
  now: Date,
  lateEntry: MatchPoolLateEntryConfig = { enabled: false, minutes: 45 },
): boolean {
  return pool.status === 'open' && canCreateMatchPool(match, now, lateEntry);
}

/**
 * Returns true if invites can be sent to a pool (same window as joining).
 */
export function canInviteToMatchPool(
  pool: { status: MatchPoolStatus },
  match: Pick<MatchPoolMatchContext, 'kickoffUtc'>,
  now: Date,
  lateEntry: MatchPoolLateEntryConfig = { enabled: false, minutes: 45 },
): boolean {
  return canJoinMatchPool(pool, match, now, lateEntry);
}

export function isMatchPoolPickValid(
  match: Pick<MatchPoolMatchContext, 'phase' | 'homeTeamCode' | 'awayTeamCode'>,
  pickType: MatchPoolPickType,
  pickValue: string,
): boolean {
  if (!getAllowedMatchPoolPickOptions(match).includes(pickType)) return false;
  if (pickType === 'draw') return pickValue === 'draw';
  if (pickType === 'home_win' || pickType === 'home_advances') {
    return pickValue === match.homeTeamCode;
  }
  return pickValue === match.awayTeamCode;
}

export function creatorCanMutate(context: {
  status: string;
  createdByUserId: string;
  currentUserId: string;
  entryUserIds: string[];
}): boolean {
  const isCreator = context.createdByUserId === context.currentUserId;
  const isOpen = context.status === 'open';
  const hasOnlyCreatorEntry = context.entryUserIds.length === 1
    && context.entryUserIds[0] === context.currentUserId;
  return isCreator && isOpen && hasOnlyCreatorEntry;
}

export function adminMutationRequiresReason(context: {
  status: string;
  createdByUserId: string;
  currentUserId: string;
  entryUserIds: string[];
  isSuperadmin: boolean;
}): boolean {
  if (!context.isSuperadmin) return false;
  return !creatorCanMutate(context);
}

export function canMutate(context: MatchPoolMutationContext): MatchPoolMutationDecision {
  if (creatorCanMutate(context)) {
    return { allowed: true, requiresAudit: false, error: null };
  }
  if (context.isSuperadmin) {
    if (!context.reason?.trim()) {
      return {
        allowed: false,
        requiresAudit: true,
        error: 'El superadministrador debe indicar una razón.',
      };
    }
    return { allowed: true, requiresAudit: true, error: null };
  }

  const isCreator = context.createdByUserId === context.currentUserId;
  if (!isCreator) {
    return { allowed: false, requiresAudit: false, error: 'Solo el creador puede modificar este reto.' };
  }
  if (context.status !== 'open') {
    return { allowed: false, requiresAudit: false, error: 'Solo se pueden modificar retos abiertos.' };
  }
  const hasOnlyCreatorEntry = context.entryUserIds.length === 1
    && context.entryUserIds[0] === context.createdByUserId;
  if (!hasOnlyCreatorEntry) {
    return {
      allowed: false,
      requiresAudit: false,
      error: 'El reto ya tiene otras entradas y no puede modificarse.',
    };
  }

  return { allowed: true, requiresAudit: false, error: null };
}

/**
 * Authorizes logical edit/cancel operations. Kickoff is intentionally absent:
 * a creator may correct a one-person open reto without affecting a counterparty.
 */
export function authorizeMatchPoolMutation(
  context: MatchPoolMutationContext,
): MatchPoolMutationDecision {
  return canMutate(context);
}

// ─── Result resolution ────────────────────────────────────────────────────────

/**
 * Resolves the winning MatchPoolPickType from a trusted final match result.
 *
 * Trusted results must have:
 *   - status = 'result'  AND  resultStatus = 'final'
 *   - homeScore and awayScore present (group matches)
 *   - winnerTeamCode present (knockout matches)
 *
 * Returns null when result is not yet final/trustworthy.
 */
export function resolveMatchPoolPick(
  match: MatchPoolMatchContext,
): MatchPoolPickType | null {
  if (match.status !== 'result' || match.resultStatus !== 'final') return null;

  if (match.phase === 'groups') {
    if (match.homeScore === null || match.awayScore === null) return null;
    if (match.homeScore > match.awayScore) return 'home_win';
    if (match.awayScore > match.homeScore) return 'away_win';
    return 'draw';
  }

  // Knockout: use winnerTeamCode (handles penalties)
  if (!match.winnerTeamCode) return null;
  if (match.winnerTeamCode === match.homeTeamCode) return 'home_advances';
  if (match.winnerTeamCode === match.awayTeamCode) return 'away_advances';
  return null;
}

// ─── Settlement calculation ───────────────────────────────────────────────────

/**
 * Calculates referential settlement for a match pool.
 *
 * Settlement rules:
 *   1. Fewer than 2 entries → void.
 *   2. Match result not final → return 'open' (do not settle yet).
 *   3. No entry matches winning pick → void (no winners).
 *   4. Otherwise distribute:
 *        totalPool        = entries.length × amount
 *        grossPerWinner   = floor(totalPool / winners.length)
 *        remainder        = totalPool mod winners.length
 *
 *        Winners: netAmount = grossPerWinner - amount  (first winner gets extra remainder)
 *        Losers:  netAmount = -amount
 *
 * Rounding: integer floor division. Remainder assigned to the first winner
 * in the entry array order — deterministic and reproducible.
 *
 * NOTE: All amounts are REFERENTIAL only. Physical settlement happens
 * outside the app ("pendiente de coordinar fuera de la app").
 */
export function calculateMatchPoolSettlement(
  input: MatchPoolSettlementInput,
): MatchPoolSettlementResult {
  const { entries, amount, match } = input;

  if (entries.length < 2) {
    return {
      poolStatus: 'void',
      settlementReason: 'Reto anulado: se necesitan al menos 2 participantes.',
      entryResults: entries.map((e) => ({
        entryId: e.id,
        userId: e.userId,
        status: 'void',
        netAmount: null,
        resultNote: 'Reto anulado por participación insuficiente.',
      })),
    };
  }

  const winningPick = resolveMatchPoolPick(match);

  if (winningPick === null) {
    return {
      poolStatus: 'open',
      settlementReason: 'Resultado aún no definitivo. Liquidación pendiente.',
      entryResults: entries.map((e) => ({
        entryId: e.id,
        userId: e.userId,
        status: 'active',
        netAmount: null,
        resultNote: 'Pendiente de resultado definitivo.',
      })),
    };
  }

  const winnerEntries = entries.filter((e) => e.pickType === winningPick);

  if (winnerEntries.length === 0) {
    return {
      poolStatus: 'void',
      settlementReason: 'Bolsa anulada: ningún participante acertó el resultado.',
      entryResults: entries.map((e) => ({
        entryId: e.id,
        userId: e.userId,
        status: 'void',
        netAmount: null,
        resultNote: 'Bolsa anulada: nadie acertó el resultado.',
      })),
    };
  }

  const totalPool = entries.length * amount;
  const grossPerWinner = Math.floor(totalPool / winnerEntries.length);
  const remainder = totalPool - grossPerWinner * winnerEntries.length;

  const winnerSet = new Set(winnerEntries.map((w) => w.id));
  let winnerIndex = 0;

  const entryResults = entries.map((e) => {
    if (!winnerSet.has(e.id)) {
      return {
        entryId: e.id,
        userId: e.userId,
        status: 'loser' as MatchPoolEntryStatus,
        netAmount: -amount,
        resultNote: `Perdiste el reto. Monto referencial: ${amount} ${match.homeTeamCode} vs ${match.awayTeamCode}.`,
      };
    }

    const extra = winnerIndex === 0 ? remainder : 0;
    winnerIndex++;
    const gross = grossPerWinner + extra;
    const net = gross - amount;

    return {
      entryId: e.id,
      userId: e.userId,
      status: 'winner' as MatchPoolEntryStatus,
      netAmount: net,
      resultNote:
        `Ganaste el reto. Ganancia referencial neta: ${net >= 0 ? '+' : ''}${net}. ` +
        `(Bruto: ${gross}, bolsa total referencial: ${totalPool}). ` +
        `Pendiente de coordinar fuera de la app.`,
    };
  });

  return {
    poolStatus: 'settled',
    settlementReason:
      `Reto liquidado: ${winnerEntries.length} ganador(es) de ${entries.length} participantes. ` +
      `Bolsa referencial total: ${totalPool}.`,
    entryResults,
  };
}

// ─── Public serializer ─────────────────────────────────────────────────────────

export interface PublicMatchPoolEntry {
  userId: string;
  displayName: string;
  pickType: MatchPoolPickType;
  pickValue: string;
  status: MatchPoolEntryStatus;
  netAmount: number | null;
}

export interface PublicMatchPoolInvite {
  invitedUserId: string;
  invitedDisplayName: string;
  status: MatchPoolInviteStatus;
}

export interface PublicMatchPool {
  id: string;
  leagueId: string;
  matchId: string;
  amount: number;
  currency: string;
  note: string | null;
  status: MatchPoolStatus;
  settledAt: string | null;
  settlementReason: string | null;
  createdByUserId: string;
  createdByDisplayName: string;
  entries: PublicMatchPoolEntry[];
  invites: PublicMatchPoolInvite[];
  match?: {
    phase: string;
    homeTeamCode: string;
    awayTeamCode: string;
    homeTeamName: string;
    awayTeamName: string;
  } | null;
}

/**
 * Serializes a match pool for public/guest read-only display.
 * No private credentials or admin data are included.
 */
export function serializePublicMatchPool(pool: {
  id: string;
  leagueId: string;
  matchId: string;
  amount: number;
  currency: string;
  note: string | null;
  status: string;
  settledAt: Date | null;
  settlementReason: string | null;
  createdByUserId: string;
  createdBy: { name: string; displayName: string | null };
  entries: Array<{
    userId: string;
    pickType: string;
    pickValue: string;
    status: string;
    netAmount: number | null;
    user: { name: string; displayName: string | null };
  }>;
  invites: Array<{
    invitedUserId: string;
    status: string;
    invitedUser: { name: string; displayName: string | null };
  }>;
  match?: {
    phase?: string;
    homeTeamCode: string;
    awayTeamCode: string;
    homeTeam?: { name: string } | null;
    awayTeam?: { name: string } | null;
  } | null;
}): PublicMatchPool {
  return {
    id: pool.id,
    leagueId: pool.leagueId,
    matchId: pool.matchId,
    amount: pool.amount,
    currency: pool.currency,
    note: pool.note,
    status: pool.status as MatchPoolStatus,
    settledAt: pool.settledAt?.toISOString() ?? null,
    settlementReason: pool.settlementReason,
    createdByUserId: pool.createdByUserId,
    createdByDisplayName: pool.createdBy.displayName ?? pool.createdBy.name,
    entries: pool.entries.map((e) => ({
      userId: e.userId,
      displayName: e.user.displayName ?? e.user.name,
      pickType: e.pickType as MatchPoolPickType,
      pickValue: e.pickValue,
      status: e.status as MatchPoolEntryStatus,
      netAmount: e.netAmount,
    })),
    invites: pool.invites.map((i) => ({
      invitedUserId: i.invitedUserId,
      invitedDisplayName: i.invitedUser.displayName ?? i.invitedUser.name,
      status: i.status as MatchPoolInviteStatus,
    })),
    match: pool.match
      ? {
          phase: pool.match.phase ?? 'groups',
          homeTeamCode: pool.match.homeTeamCode,
          awayTeamCode: pool.match.awayTeamCode,
          homeTeamName: pool.match.homeTeam?.name ?? pool.match.homeTeamCode,
          awayTeamName: pool.match.awayTeam?.name ?? pool.match.awayTeamCode,
        }
      : null,
  };
}
