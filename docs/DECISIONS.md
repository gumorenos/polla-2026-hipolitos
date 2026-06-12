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

