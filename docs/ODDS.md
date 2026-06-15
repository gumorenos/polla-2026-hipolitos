# Informational Market Odds and H2H Module — La Polla 2026

This document describes the design, API providers, cache policies, rate-limit constraints, and background refresh tasks for the Informational Odds and Head-to-Head (H2H) stats module in **La Polla 2026**.

---

## 1. Core Principles

- **Strictly Informational:** Odds and probabilities are shown as predictions guides only. The application contains no betting features, gambling links, bookmaker referral widgets, or CTAs.
- **Cache-First / SQLite Only:** To avoid key depletion and dynamic runtime errors, matches are never queried against external APIs during page renders. All views pull from SQLite.
- **Simulation Stubs:** If API keys are missing or disabled (e.g. during local Windows development), simulated fallback adapters generate realistic, randomized odds and H2H statistics dynamically.

---

## 2. API Providers

The system integrates three API providers:

1. **Primary Odds:** [Odds-API.io](https://odds-api.io/) (`odds-api-io`)
   - Queries market odds for standard 1X2 outcomes.
   - Endpoint: `/v3/odds?apiKey=KEY&sport=football`.
2. **Fallback Odds:** [The Odds API](https://the-odds-api.com/) (`the-odds-api`)
   - Configured as fallback if the primary provider exceeds quota or fails.
   - Endpoint: `/v4/sports/soccer_fifa_world_cup/odds/?apiKey=KEY&regions=eu&markets=h2h`.
3. **Head-to-Head Stats:** [API-Football](https://api-sports.io/documentation/football/v3) (`api-football`)
   - Queries historical results between the teams.
   - Endpoint: `/fixtures/headtohead?h2h={team_1_id}-{team_2_id}`.
   - Team codes are resolved using a static mapping table (`FIFA_TO_APIFOOTBALL_IDS`), with a dynamic query to `/teams?code=XXX` as fallback.

---

## 3. Database Schema

The following tables handle probabilities and H2H caching:

### `OddsSnapshot`
Stores specific decimal odds and implied/normalized probabilities:
- `outcomeType`: `"home"` | `"draw"` | `"away"`
- `decimalOdds`: Decimal coefficient (e.g. `2.30`).
- `impliedProbability`: `1 / decimalOdds` (implied probability).
- `normalizedProbability`: Normalized probability so L + E + V sums to 1.00 (100%).
- `visibility`: `"global"` (visible to all) | `"user_private"` (visible to a specific user).

### `UserOddsRefreshUsage`
Restricts user-triggered manual refreshes to prevent race conditions and key quota depletion:
- `userId`: Reference to User.
- `dateKey`: `"YYYY-MM-DD"` (Date key calculated in `America/Lima` local timezone).
- Enforces `@unique([userId, dateKey])` constraint.

### `HeadToHeadSnapshot`
Caches historical direct meetings stats:
- Wins, draws, losses, total matches, and goals scored.
- `lastMatchesJson`: Structured JSON array containing date, scores, and competitions.

---

## 4. Rate-Limiting Policy (America/Lima)

To protect third-party API keys from depletion while giving users a way to query "live" probabilities close to kickoff:
1. **Global Snapshots:** Updated automatically or by admin (typically ~1 hour before kickoff).
2. **User Private Snapshots:** Users are allowed exactly **1 manual refresh per local day** (resets at midnight in the `America/Lima` timezone).
3. **Atomic Locks:** Check and registration happen in a single SQLite database transaction to block concurrent double-click attempts.
4. **Countdown:** If depleted, the UI displays a countdown in hours and minutes until midnight Lima time.

---

## 5. Background Automation (Cron)

Two scripts are mapped in `package.json` to be triggered on Raspberry Pi 5:
- **`npm run odds:refresh-upcoming`**: Scans matches kicking off in the next hour and fetches global snapshots.
- **`npm run h2h:fetch-missing`**: Populates historical H2H caches for matches missing H2H entries.

### Crontab Examples (Raspberry Pi 5)

We recommend setting up `cron` on the Raspberry Pi 5 to automate these refreshes:

```bash
# Refresh global odds for upcoming matches every 15 minutes
*/15 * * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run odds:refresh-upcoming >> /home/gumorenos/logs/odds-refresh.log 2>&1

# Fetch missing H2H data daily at 4:00 AM
0 4 * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run h2h:fetch-missing >> /home/gumorenos/logs/h2h-refresh.log 2>&1
```
