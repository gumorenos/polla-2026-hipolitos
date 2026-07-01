# Retos por Partido — Match Pool

## Overview

**Retos por Partido** (`match_pool`) is the third competition type in La Polla 2026.

It is a match-level shared referential pool between friends — a challenge tied to a specific match within a league.

> [!IMPORTANT]
> **Money safety**: This app does NOT process, custody, transfer, or settle real money. All amounts are referential only ("monto referencial"). Physical settlement happens outside the app ("pendiente de coordinar fuera de la app").

---

## User-Facing Name

| Field | Value |
|---|---|
| Internal type | `match_pool` |
| User-facing name | Retos por Partido |
| Subtitle | Bolsa entre amigos por cada partido |

---

## How It Works

1. An approved user creates a competition of type `match_pool`, which acts only as a lobby/container.
2. Any authenticated, approved user creates a **reto** (challenge) for a specific upcoming match.
3. The creator sets:
   - The **referential amount** (`monto referencial`)
   - Their own **prediction** (pick)
4. Other approved users can:
   - **Join** the pool (before kickoff)
   - See the fixed amount (cannot change it)
   - Enter their own pick only
5. The creator can invite specific approved users.
6. After the match has a final trusted result:
   - The pool is automatically settled by the post-result pipeline.
   - Net referential amounts are recorded per participant.
   - Physical coordination happens outside the app.

---

## Pick Types

| Match Phase | Allowed Picks |
|---|---|
| Group stage | `home_win`, `draw`, `away_win` |
| Knockout (R32, R16, QF, SF, Final) | `home_advances`, `away_advances` |

Knockout picks use `winnerTeamCode` (not 90-minute score) to handle penalties correctly.

---

## Settlement Rules

Settlement depends on a **trusted final result** in the local database:
- `match.status = 'result'`
- `match.resultStatus = 'final'`
- `homeScore` and `awayScore` present
- `winnerTeamCode` present for knockout matches

### Settlement Logic

| Condition | Outcome |
|---|---|
| Fewer than 2 entries | Pool → `void` |
| No entries match winning pick | Pool → `void` |
| At least 1 winner | Pool → `settled` |

### Referential Net Calculation

```
totalPool        = entries.length × amount
grossPerWinner   = floor(totalPool / winners.length)
remainder        = totalPool mod winners.length  (→ first winner by entry order)

Winner net       = grossPerWinner - amount (+ remainder if first winner)
Loser net        = -amount
```

**Rounding**: integer floor division. Remainder is deterministically assigned to the first winner in entry array order.

All amounts are referential only. No real money is processed.

---

## Pool Lifecycle

```
open  →  locked  →  settled
  ↓                ↓
cancelled         void
```

| Status | Meaning |
|---|---|
| `open` | Accepting entries (before kickoff) |
| `locked` | Kickoff passed, no new entries (auto or admin action) |
| `settled` | Final result applied, referential amounts recorded |
| `void` | < 2 entries, no winners, or admin cancelled |
| `cancelled` | Admin explicitly cancelled |

---

## Money Safety — Legal Disclaimer

> [!CAUTION]
> This feature uses **referential amounts only**. The app:
> - Does NOT process payments
> - Does NOT custody funds
> - Does NOT transfer money between users
> - Does NOT charge rake or commission
> - Does NOT integrate any payment processor
> - Does NOT provide wallets, deposits, or withdrawals
>
> Any physical financial coordination between participants happens **outside the app** and is **the sole responsibility of participants**.
>
> **Legal review is required before any real-money automation is added.**

### Approved wording

Use: `monto referencial`, `reto`, `bolsa entre amigos`, `liquidación referencial`, `pendiente de coordinar fuera de la app`

Do NOT use: `casino`, `bookmaker`, `casa de apuestas`, `apuesta legal`, `saldo real`, `pago automático`, `depósito`, `retiro`

---

## Odds

- Default `showOdds = false` for `match_pool` leagues.
- Admin can enable odds display if desired.
- If odds are shown: stored pre-match odds only. No live odds fetched.
- After kickoff, odds are frozen (labeled "Cuotas pre-partido congeladas").

---

## Guest/Public Display

The component `PublicMatchPoolsSection` provides a read-only view at `/` and `/invitado` showing:
- Match and kickoff
- Pool status and referential amount
- All participants and their picks
- Invited users and invite status
- Settlement result when final
- Referential net result per participant

No authentication is required for this view.

---

## Open participation model

`match_pool` does not have competitive league membership, standings, global ranking, or a champion pick.
Participation exists only through `MatchPoolEntry`, one user and prediction per reto.

- Creating, joining, and receiving an invitation requires an authenticated user with `status = approved`.
- No `LeagueMember` row is required and joining a reto never creates one.
- The competition creator may retain an internal `LeagueMember` row with role `owner` and `isParticipant = false` for permissions.
- Internal owner/admin rows are hidden from Match Pool participant counts and screens.
- The dedicated competition detail never renders standings, champion history, or fixed-member management.

## Editing and cancellation

- A normal creator may edit or logically cancel an `open` reto only while its sole entry is the creator's own entry.
- This correction remains available after kickoff because no counterparty is affected.
- Once another entry exists, the creator can no longer alter or cancel the reto.
- A superadmin may intervene in any state only with a required reason. The before/after state and reason are written to `AdminActionLog`.
- Cancellation is logical: pool and entries move to `cancelled`; records are not deleted.
- Moving a reto to another match is blocked when an existing prediction would be invalid for the new match.

The public home queries all active `match_pool` lobbies independently of `League.isDefault` and renders them in the read-only **Retos por Partido** tab.

## Configurable late entry

Each Match Pool lobby stores `matchPoolLateEntryEnabled` (default `false`) and `matchPoolLateEntryMinutes` (default `45`). When disabled, create/join/invite closes at kickoff. When enabled, the same operations remain available only while the reto is `open` and until kickoff plus the configured minutes. The UI displays the Lima-time deadline and warns administrators that users may have partial match information.

---

## Database Models

Three new models added in migration `20260630080000_add_match_pools`:

- **`MatchPool`**: one pool per match per league, created by one user, fixed amount.
- **`MatchPoolEntry`**: one entry per user per pool. Pick + referential result.
- **`MatchPoolInvite`**: invite tracking. Pending invites do not count as entries.

---

## Post-Result Pipeline Integration

`settleMatchPoolsForFinalMatch(matchId)` is called from `runPostFinalResultPipeline`:
- Non-fatal: failure appends to `progressionWarning` only.
- Result save is NOT blocked by pool settlement failure.
- Idempotent: safe to call multiple times for the same match.
- Only settles pools in `open` or `locked` status.

---

## Files

| File | Purpose |
|---|---|
| `app/prisma/schema.prisma` | Schema with MatchPool, MatchPoolEntry, MatchPoolInvite |
| `app/prisma/migrations/20260630080000_add_match_pools/migration.sql` | Additive SQL migration |
| `app/src/lib/match-pool.ts` | Pure domain helpers (types, guards, settlement, serializer) |
| `app/src/lib/actions/match-pools.ts` | Server actions (create, join, invite, cancel) |
| `app/src/lib/services/match-pool-settlement.ts` | Settlement service for post-result pipeline |
| `app/src/lib/actions/admin.ts` | Wired settlement into `runPostFinalResultPipeline` |
| `app/src/lib/actions/leagues.ts` | Added `match_pool` to CompetitionTypeInput |
| `app/src/components/public/PublicMatchPoolsSection.tsx` | Read-only pool details |
| `app/src/components/match-pool/MatchPoolLeagueClient.tsx` | Approved-user lobby, create, join and invite UI |
| `app/src/lib/match-pool.test.ts` | 19-case test suite |
