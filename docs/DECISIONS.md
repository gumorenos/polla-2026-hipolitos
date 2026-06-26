# Architecture Decision Record — La Polla 2026

> Format: Date · Decision · Rationale · Alternatives considered

---

## ADR-001 — SQLite instead of Supabase (PostgreSQL)

**Date:** 2026-06-12  
**Status:** Accepted

**Decision:** Use SQLite as the primary database, accessed via Prisma ORM.

**Rationale:**
- The app runs on a single Raspberry Pi 5 — no need for a distributed DB.
- SQLite with WAL mode handles 20–50 concurrent users without contention.
- Zero external service dependency — fully self-hosted, no SaaS accounts required.
- File-based DB makes backup trivial: copy one file.
- No network latency between app and DB (same process/host).

**Alternatives considered:**
- **Supabase (PostgreSQL):** Requires external cloud account, network round-trips, monthly cost risk, cannot run fully offline.
- **SQLite + better-sqlite3 (synchronous):** Incompatible with Next.js Server Actions async model; Prisma is preferable.
- **PostgreSQL self-hosted:** Overkill for single-instance RPi5 deployment; operational complexity with no benefit at this scale.

---

## ADR-002 — Better Auth instead of Auth.js (NextAuth)

**Date:** 2026-06-12  
**Status:** Accepted

**Decision:** Use Better Auth for authentication.

**Rationale Evaluation:**
1. **Compatibility with Next.js App Router:** Better Auth has native first-class support for Next.js App Router (15/16). It includes out-of-the-box helper handlers and client/server integrations designed specifically for Server Actions, middleware, and route handlers.
2. **Compatibility with Prisma:** It provides a built-in `prismaAdapter` that directly maps user, session, account, and verification tables into our Prisma schema.
3. **Compatibility with SQLite:** The Prisma adapter natively supports SQLite (`provider: 'sqlite'`). Session storage in database-backed tables is handled seamlessly.
4. **Simplicity for a small private app:** It contains a built-in email+password auth plugin. We do not need to configure third-party OAuth providers, developer accounts, or custom credentials callbacks.
5. **Security and maintainability:** Better Auth stores active sessions in HttpOnly cookies, protecting them from XSS. It handles hashing and session verification securely without exposing JWT secrets client-side. The library is actively maintained and designed with modern security practices.
6. **Ease of deployment on Raspberry Pi 5:** It runs entirely on the host machine. There is no external API or cloud dashboard dependency. Configuration is simple: just set a `BETTER_AUTH_SECRET` and `DATABASE_URL` in the environment.

**Alternatives considered:**
- **Auth.js v5 (NextAuth):** Still in Release Candidate (RC/beta) status for Next.js App Router. Credential-based auth is highly discouraged by the maintainers and requires complex manual configuration. Default JWT sessions add complexity when self-hosting on a single SQLite instance where DB sessions are trivial and robust.
- **Lucia Auth:** Deprecated by its creator in favor of building custom auth, making it unsuitable for a maintainable project.
- **Supabase Auth:** Requires Supabase cloud infrastructure which is out of scope.

---

## ADR-003 — Hybrid approach (new scaffold + reference UI migration)

**Date:** 2026-06-12  
**Status:** Accepted

**Decision:** Create a clean Next.js 16 scaffold in `app/`, then selectively migrate high-value assets from `reference/LAPOLLA2026/`.

**Assets migrated from reference:**
- CSS design system (`globals.css` tokens, animations, utility classes)
- All UI atom components (`MatchCard`, `Stepper`, `Countdown`, `FlagDisc`, etc.)
- Scoring logic (`calculatePoints.ts`)
- Date utilities (`dates.ts`)
- 72-match dataset and 48-team dataset (converted to Prisma seed)
- TypeScript types (adapted for Prisma models)
- Font choices (Bebas Neue, IBM Plex Mono, DM Sans)

**Assets rebuilt from scratch:**
- All server-side logic (Server Actions, API routes)
- Authentication (Better Auth replacing fake modal)
- Database layer (SQLite + Prisma replacing Supabase)
- Admin panel (not present in reference)
- Seed script (not present in reference)
- PM2 and deployment config (not present in reference)

**Rationale:**
- Adapting the original repo would require removing Supabase from every layer with high risk of breakage.
- Rebuilding from scratch wastes the excellent UI and correct FIFA data from the reference.
- Hybrid gives correctness, security, and deployability while preserving design quality.

---

## ADR-004 — Build on Raspberry Pi 5 via Git Pull Deployment

**Date:** 2026-06-12  
**Status:** Accepted

**Decision:** Development will happen on Windows. The code will be pushed to GitHub. The Raspberry Pi 5 will pull from GitHub using `git pull`. The production build (`npm run build`) will run directly on the Raspberry Pi 5, followed by database migrations and restarting the app via PM2.

**Rationale:**
- Utilizing `git pull` directly from GitHub on the RPi5 provides a clean, native, and standard delivery mechanism for self-hosted apps.
- Raspberry Pi 5 (ARM64 with Broadcom BCM2712 CPU) has significant CPU and memory improvements (4GB/8GB RAM) compared to older models, making it capable of executing Next.js production builds locally in about 1–2 minutes.
- Prevents cross-compilation/platform mismatch issues with Prisma engines or native binary dependencies (Windows dev host vs. ARM64 Linux production host).

**Alternatives considered:**
- **Build on Windows and rsync to RPi5:** Adds complexity to the Windows development environment (requires configuring SSH/rsync keys on Windows) and risks database/Prisma platform binary mismatches.

---

## ADR-005 — SQLite DB paths (Dev and Prod separation)

**Date:** 2026-06-12  
**Status:** Accepted

**Decision:** Store the SQLite database files in separate environments:
- **Local Windows Development:** The database will be a local file inside the project directory: `file:./prisma/dev.db` (under `app/prisma/dev.db`). This file must be excluded from Git commits via `.gitignore`.
- **Raspberry Pi 5 Production:** The database will be located outside the repository directory at: `/var/lib/la-polla-2026/prod.db`. This path will be set via the `DATABASE_URL` environment variable.

**Rationale:**
- Prevents the production database from being accidentally modified, deleted, or overwritten during a `git pull` or repository cleanup.
- Isolates persistent production state from volatile codebase changes.
- Keeps development database separate, simple, and self-contained.

---

## ADR-006 — Prediction locking is server-side hard cutoff

**Date:** 2026-06-12  
**Status:** Accepted

**Decision:** Predictions can only be submitted (via Server Action) when `match.kickoff_utc > Date.now()`. This check runs on the server, not the client.

**Rationale:**
- Client-side locking is trivially bypassable.
- Fairness of the pool depends on no predictions being accepted after match start.
- The check is a single line: `if (match.kickoff_utc <= new Date()) throw new Error('Match has started')`

**Note:** The reference app does not implement this at all — the UI changes state visually but any POST would be accepted. This is a critical security fix.

---

## ADR-007 — No credits/wagering system in initial implementation

**Date:** 2026-06-12  
**Status:** Accepted

**Decision:** Remove `credits_wagered` and `entry_credits` fields from the initial schema. The credits concept in the reference schema is undefined (no rules, no logic implemented).

**Rationale:**
- The reference includes schema fields but zero business logic for credits.
- Implementing a wagering system requires clear rules that are not yet defined.
- Simpler schema reduces attack surface and implementation complexity.
- Can be added in a future phase if rules are defined.

**Fields removed from schema:** `League.entry_credits`, `LeagueMember.credits_wagered`, `Player.credits`

---

## ADR-008 — Global Prediction Scope Per User/Match

**Date:** 2026-06-12  
**Status:** Accepted

**Decision:** Users submit a single prediction per match. This prediction is shared globally across all leagues the user belongs to.

**Rationale:**
- Prevents cognitive fatigue: World Cup contains 72 matches. Belonging to multiple leagues would require predicting hundreds of scores, leading to dropouts.
- Enforces pool integrity: Prevents hedging or split-betting strategies across different leagues.
- Simplifies standings: Leaderboard calculation queries are simple joins on a single global prediction row.

---

## ADR-009 — Snapshot-based League Standings with Tie-breakers

**Date:** 2026-06-12  
**Status:** Accepted

**Decision:** We store league standings in a dedicated `Standing` snapshot table in the SQLite database. Standings are recalculated:
1. Automatically when the admin enters/updates a match result.
2. Automatically when a user joins a league.
3. Manually by an admin via a trigger on the admin panel.

We implement the following 6 tie-breakers sequentially:
1. Total points (descending)
2. More exact scores (descending)
3. More correct tendencies (descending)
4. More predictions submitted (descending)
5. Earliest last successful prediction timestamp (ascending, nulls last)
6. User name as a stable final fallback (ascending)

**Rationale:**
- Snapshotting avoids heavy SQL aggregate query overhead on every leaderboard view.
- Provides a stable way to calculate `previousRank` and show movement (up/down rank indicators) between match scoring updates.
- Tie-breakers ensure that ranking is fully deterministic and no two players share a position on the leaderboard, keeping competition clear.
- Re-calculating standings on result entry and league join keeps the snapshots synchronized.

---

## ADR-010 — Approval-based Pool Administration and Credentials Refinement

**Date:** 2026-06-13  
**Status:** Accepted

**Decision:** Refine the product model of "La Polla 2026" from a SaaS model to a private pool model using username credentials, user approval workflows, and league-specific prediction spaces.

**Key Refinements:**
1. **Username Credentials:** Users register with a `username`, password, and display name. Better Auth email requirements are met by generating an internal placeholder (`username@polla.local`) when not provided. Login is performed via `username` + password credentials.
2. **User Approval Flow:** A user status state machine is introduced (`pending`, `approved`, `rejected`, `disabled`). Pending users are blocked with an informative message. Disabled or rejected users are shown a blocked screen. Only approved users can view predictions, submit results, or join/create pools.
3. **League-Specific Predictions:** Shifted prediction uniqueness constraint from `[userId, matchId]` to `[userId, leagueId, matchId]`. This allows users in multiple pools to have separate forecasts for each, with custom point configurations per league.
4. **Tournament Winner Pick:** Added a `WinnerPrediction` model locked at `championDeadline`. Recalculates standings by fetching the user's champion pick and adding the league's `championPoints` if it matches the league's final designated champion.
5. **Implied Probabilities & Odds:** Added an `OddsSnapshot` model to capture decimal bookmaker odds. If a league's `showOdds` settings is enabled, the UI displays implied probabilities (`1/odds` as %) next to matches to guide users.
6. **Terminology Standardization:** Renamed "Liga" / "Ligas" to "Polla" / "Pollas", "Members" to "Participantes", and "Prize Pool" to "Pozo" in all user-facing views to align with local terms.

---

## ADR-011 — Informational Odds and H2H Statistics Integration

**Date:** 2026-06-13  
**Status:** Accepted

**Decision:** Implement an informational odds and Head-to-Head (H2H) statistics module cached fully in SQLite database tables with simulation fallbacks and strict timezone-locked rate limits for manual user requests.

**Rationale:**
1. **Cache-First Caching:** Third-party sports and odds APIs charge per query and have limited quotas. To prevent depleting keys, we cache all odds snapshots and H2H records in SQLite and never execute live external API queries during page loads.
2. **Simulation Adapter Fallbacks:** If API keys are missing/disabled, the adapters transparently return realistic, strength-based odds and randomized H2H histories. This makes the system fully testable and functional during local Windows development without incurring key quota usage.
3. **Timezone-Locked Rate Limits:** Manual user-triggered refreshes are restricted to exactly **1 request per local day** (resets at midnight in the `America/Lima` timezone). This prevents spamming and key usage while allowing users to query updated odds closer to kickoff.
4. **SQLite Atomic Lock Transactions:** To prevent double-clicks or concurrent requests from bypassing the rate-limit checks, we check previous usage and write the new `UserOddsRefreshUsage` log within a single atomic database transaction. If the unique constraint on `userId_dateKey` is violated, the transaction rolls back immediately.
5. **Outcome-Based Odds Schema:** Modified `OddsSnapshot` to record individual outcome items (Home, Draw, Away) as independent rows. This allows storing outcomes separately and referencing selection keys easily.
6. **Competition-Level Visibility:** Each competition can disable user-facing market aids independently with `showOdds` and H2H history with `showH2H`. These flags only control participant display; cached `OddsSnapshot`, `ChampionOddsSnapshot`, and `HeadToHeadSnapshot` records remain available for admin maintenance.

---

## ADR-012 — Personal Theme Mode Cookie Sync & SSR Integration

**Date:** 2026-06-15  
**Status:** Accepted

**Decision:** Store `themeMode` in the user database table and synchronize it via a `'themeMode'` cookie, allowing SSR (`layout.tsx`) to apply the correct theme class (`theme-black`, `theme-dark`, `theme-light`) before sending HTML to the client.

**Rationale:**
- Toggling theme only on the client causes a jarring flash of default theme (dark/black) before loading user preferences.
- Server-side cookie reading allows injecting class name directly into `<html>` at SSR time, resolving the flash.
- Standard Server Actions update database and cookies atomically, keeping preferences in sync.

---

## ADR-013 — Hardened H2H Processing & API-Football Rate Limit Safeguards

**Date:** 2026-06-15  
**Status:** Accepted

**Decision:** Skip matches with knockout bracket placeholders (`1A`, `W101`, etc.) gracefully using `isConcreteTeamCode` matching during H2H fetch cycles, and halt execution immediately if API-Football returns `HTTP 429`.

**Rationale:**
- Knockout placeholders do not represent real countries and trigger failed API lookups. Skipping them avoids wasting quotas and error logs.
- Halt execution immediately on `HTTP 429` stops script loops from hammering the server and incurring bans.

---

## ADR-014 — Expose Configurable Scoring Rules & Dynamic Standings Recalculation

**Date:** 2026-06-15  
**Status:** Accepted

**Decision:** Expose competition scoring parameters in the UI league settings form and dynamically re-grade finished matches' predictions for the league's users whenever point configuration changes.

**Rationale:**
- Restructuring points rules (e.g. standard vs "champion weighs more") requires that all historical predictions are recomputed to keep leaderboards correct.
- Recalculating prediction scores directly inside `recalculateAllStandings` on league updates ensures data integrity.

---

## ADR-015 — Opt-in Email Reminder System via Resend & Masked Auditor Logs

**Date:** 2026-06-15  
**Status:** Accepted

**Decision:** Implement an opt-in email reminder worker utilizing Resend, running every 5 minutes in production to check for today's matches with kickoff in less than 30 minutes, auditing logs inside a `ReminderLog` table with unique constraint safety, and masking email logs in the admin auditing UI.

**Rationale:**
- Private prediction pool engagement benefits from alert hooks when predictions are missing, but user privacy dictates that opt-in must be disabled by default.
- Restricting email toggles to real emails (non-placeholder) prevents failures.
- Idempotency guard on `[userId, matchId, reminderType, channel]` protects users from receiving duplicate emails.
- Masking emails (`g***@domain.com`) in the admin dashboard complies with strict privacy rules preventing exposure of participant addresses.

---

## ADR-016 — Champion Survivor as Separate Backend Mode

**Date:** 2026-06-16
**Status:** Accepted

**Decision:** Implement Champion Survivor as a backend-only competition mode using `ChampionPick`, `TeamTournamentStatus`, and `ChampionOddsSnapshot`, separate from the existing full prediction `WinnerPrediction` flow.

**Rationale:**
- `full_prediction` keeps match predictions and tournament winner bonus scoring unchanged.
- `champion_survivor` ranking must not use match prediction points, so it needs separate ordering logic.
- User pick status is computed dynamically from the current pick plus team tournament status, avoiding stale participant status fields.
- Champion market probability uses only manual or imported `ChampionOddsSnapshot` rows for `sourceMarket = "outright_winner"`; match odds are not a valid substitute.
- Prize pool calculations must respect the league currency and count approved active members, including users whose picks are already eliminated.

**Reset Design:**
- `ChampionPick.teamCode` is required, so resetting a user pick deletes the active `ChampionPick` row.
- Auditability is preserved through `AdminActionLog` with the previous team code, admin user, timestamp, and required reason.

**Not Included In This Phase:**
- Full Champion Survivor admin pages.
- Full Champion Survivor user pages.
- Visual dashboard or navigation changes.
- Raspberry Pi deployment execution.

---

## ADR-017 — Competition Route and Explicit Creator Participation

**Date:** 2026-06-17
**Status:** Accepted

**Decision:** `/competencia` is the canonical visible route for competition creation and detail pages. `/liga` remains as a compatibility alias. New competitions validate `competitionType` server-side, default missing values to `full_prediction`, and allow `champion_survivor`. The creator is always stored as owner, while participant status is explicit through `LeagueMember.isParticipant`.

**Rationale:**
- User-facing terminology should be competition-first instead of league-first.
- Champion Survivor must be selectable at creation time without converting existing full prediction competitions.
- Creators need management access by default, but should not silently count as active players.

**Consequences:**
- Existing memberships keep `isParticipant = true` through the migration default.
- `/pronosticos` includes the explicit champion-pick flow plus read-only informational panels for the selected champion and competition context. Match odds/H2H are contextual aids only, champion odds remain separate from match odds, and `showOdds`/`showH2H` are respected for participant display.
- `/pronosticos` also includes aggregate Champion Survivor social and market insights: pick versus market, social risk, popular versus differential classification, survival map, pick distribution, exclusive picks, and combined alive probability when champion market odds are complete.
- `showOdds` controls champion probability, decimal odds, expected value, individual EV, combined alive probability, and probability-based classifications. Aggregate social counts remain available when market aids are disabled.

### Public Guest Access

- `/invitado` provides public read-only access to the main competition dashboard. It uses the existing `League.isDefault` principal competition setting instead of adding a second main-competition flag.
- Admin settings label this field as `Competencia principal` and explain that it is shown in the guest view. Existing update logic keeps only one principal competition enabled.
- The guest route links to `/login` with `Iniciar sesión`, does not require authentication, and does not expose write actions, prediction inputs, pick forms, admin actions, API keys, or user-management data.
- `showOdds` and `showH2H` continue to control public odds and H2H display.
- The advanced simulation dashboard, match-by-match model, hybrid model, and admin/participant visual mode remain pending.
