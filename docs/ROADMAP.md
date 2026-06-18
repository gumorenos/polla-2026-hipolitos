# Implementation Roadmap — La Polla 2026

> Last updated: 2026-06-16

---

## Implementation Strategy

**Recommendation: Option C — Hybrid Approach**

Rationale: The reference app has an excellent UI layer and correct match data, but zero backend. The correct strategy is to scaffold a clean Next.js 16 app, then selectively migrate the high-value UI assets from the reference rather than blindly copying or discarding everything.

- Do NOT adapt the original repo (Option A): it has Supabase baked in at every layer, missing auth, no tests, no seed script, no server routes.
- Do NOT rebuild everything from scratch (Option B): the reference's design system, MatchCard, scoring logic, and match data are production-quality and would take days to recreate.
- DO use Option C: new clean scaffold + cherry-pick the best assets.

---

## Phase 0 — Scaffold and Foundation

**Goal:** Working Next.js 16 app with SQLite, Better Auth, and migrated design system.

### Tasks

- [ ] Create Next.js 16 app in `app/` using `create-next-app` with TypeScript and Tailwind CSS 4.
- [ ] Configure Prisma for SQLite with WAL mode enabled.
- [ ] Define separate database URLs for local development (`file:./prisma/dev.db`) and production (`file:/var/lib/la-polla-2026/prod.db`).
- [ ] Write `prisma/schema.prisma` adapted from reference (SQLite-compatible enums).
- [ ] Install and configure Better Auth with Prisma adapter.
- [ ] Migrate `globals.css` design system (CSS tokens, utility classes, animations).
- [ ] Migrate typography: Bebas Neue + IBM Plex Mono + DM Sans.
- [ ] Migrate all UI atoms: Avatar, Countdown, FaseBadge, FlagDisc, Icon, PhaseDot, RankArrow, Stepper.
- [ ] Migrate layout shell: AppShell, BottomNav, Sidebar, ScreenShell.
- [ ] Set up PWA manifest and icons.
- [ ] Configure PM2 `ecosystem.config.js` for PM2 deployment.
- [ ] Write `.env.example` with SQLite + Better Auth variables.
- [ ] Run `prisma migrate dev` on Windows local machine and validate the schema.
- [ ] Commit: "feat: scaffold with SQLite + Better Auth + design system"

**Validation:** `npm run build` passes on Windows dev machine. `npm run dev` shows the layout shell.

---

## Phase 1 — Data Model and Seed

**Goal:** Real match data in SQLite. Admin can view matches.

### Tasks

- [ ] Write `prisma/seed.ts` migrating TEAMS and MATCHES from `mock.ts`.
- [ ] Seed Tournament row for FIFA World Cup 2026.
- [ ] Seed all 72 Match rows with correct UTC timestamps.
- [ ] Seed 48 Team metadata (store separately or embed in match data).
- [ ] Add `prisma db seed` script to `package.json`.
- [ ] Run seed, verify match count in SQLite.
- [ ] Write `lib/db.ts` Prisma singleton with WAL PRAGMA setup.
- [ ] Migrate `calculatePoints.ts` and `dates.ts` verbatim.
- [ ] Commit: "feat: seed 72 matches + scoring engine"

**Validation:** `npx prisma studio` shows 72 match rows.

---

## Phase 2 — Authentication

**Goal:** Users can register, log in, and have persistent sessions.

### Tasks

- [ ] Set up Better Auth config in `lib/auth.ts`.
- [ ] Add `api/auth/[...all]/route.ts` handler.
- [ ] Create login page (`app/(auth)/login/page.tsx`).
- [ ] Create register page (`app/(auth)/register/page.tsx`).
- [ ] Implement middleware for protected routes (`middleware.ts`).
- [ ] Build real AuthModal wired to Better Auth (email+password).
- [ ] Add session helper: `getSession()` server-side.
- [ ] Test: register → login → session persists → logout.
- [ ] Seed one superadmin user for testing.
- [ ] Commit: "feat: Better Auth email+password authentication"

**Validation:** Can register and log in. Session cookie set. Middleware redirects unauthenticated users.

---

## Phase 3 — League Join Flow

**Goal:** Users can create and join leagues via invite code.

### Tasks

- [x] Build league creation Server Action: generates unique invite code and slug.
- [x] Build league join page (`app/join/[inviteCode]/page.tsx`).
- [x] Build join Server Action: validates code, creates LeagueMember.
- [x] Display user's leagues on `/liga` page.
- [x] Migrate LigaScreen UI with real data.
- [x] Show invite code with copy functionality.
- [x] Validate: user cannot join same league twice.
- [x] Commit: "feat: implement private leagues"

**Validation:** Can join a league with invite code. League appears in /liga.

---

## Phase 4 — Predictions

**Goal:** Users can predict scores for open matches. Predictions lock at kickoff.

### Tasks

- [x] Build `/pronosticos` component: fetch matches, memberships, winner predictions, and odds.
- [x] Migrate MatchCard (Scoreboard/Solari/Ticket variants) with real data, pool switching, and odds snapshots.
- [x] Migrate Stepper, Countdown UI components.
- [x] Build `savePredictionAction` Server Action with strict kickoff locking.
- [x] Show prediction count progress bar.
- [x] Show saved/unsaved state per card.
- [ ] Build `/calendario` page with all matches grouped by day/phase.
- [x] Commit: "feat: predictions with server-side kickoff locking"

**Validation:** Can predict scores. Cannot edit after kickoff. Predictions persist across browser sessions.

---

## Phase 5 — Ranking and Scoring

**Goal:** Real-time standings computed from actual predictions and results.

### Tasks

- [x] Migrate Podio, RankingTable, Charts components with real data.
- [x] Build `/ranking` server component: query Standing table for user's league.
- [x] Build `/perfil` page: user stats, points history, breakdown.
- [x] Build `recalculateAllStandings` function using `calculatePoints` supporting custom points rules and winner predictions.
- [x] Wire ranking computation to admin result entry.
- [x] Add block-level standings (GROUPS, ROUND32_16, QUARTERS_FINAL, GLOBAL).
- [x] Commit: "feat: ranking and scoring with real predictions"

**Validation:** After admin enters a result, standings update for all league members.

---

## Phase 6 — Admin Panel

**Goal:** Superadmin can manage matches, enter results, manage leagues and users.

### Tasks

- [x] Build admin layout with superadmin guard (`isSuperadmin` check).
- [x] Admin match list: view all 72 matches, filter by phase/status.
- [x] Admin match result entry: enter home score, away score → triggers scoring recompute and standings recalculation.
- [x] Admin match edit: update kickoffUtc, venue, city, phase, status.
- [x] Admin league management: configure settings, view members, archive/delete.
- [x] Admin user management: view all users, toggle superadmin, approve/reject/disable users, create users manually.
- [x] Commit: "feat: admin panel with match results and league management"

**Validation:** Superadmin can enter results. Predictions are scored. Standings update.

### Champion Survivor backend checkpoint

- [x] Added reusable Champion Survivor business logic for competition type resolution, deadline checks, dynamic pick status, prize pool calculation, champion odds expected value, pick distribution, survival summary, ranking order, and CSV export.
- [x] Added Server Actions for user state, explicit champion pick save, admin pick management, team tournament status management, manual champion odds snapshots, latest odds listing, and CSV export.
- [x] Kept full prediction mode on `WinnerPrediction`; Champion Survivor uses `ChampionPick`.
- [x] Champion Survivor admin UI for picks, team statuses, manual champion odds, distribution, exclusive picks, and CSV export.
- [x] Added canonical `/competencia` route, competition type selection, champion deadline field, and explicit creator participant opt-in.
- [x] Added read-only Champion Survivor user information panels below the explicit pick form: selected champion context and competition context.
- [ ] Full Champion Survivor visual dashboard with simulations and social insights.

---

## Phase 7 — PWA and Mobile Polish

**Goal:** App is installable on iOS and Android. Works smoothly on mobile.

### Tasks

- [ ] Configure next-pwa with offline caching strategy.
- [ ] Add app icons (all sizes for iOS + Android).
- [ ] Test installation on iOS Safari and Android Chrome.
- [ ] Add touch targets: minimum 44x44px on all interactive elements.
- [ ] Test bottom nav, prediction flow, and ranking on mobile viewport.
- [ ] Add `prefers-reduced-motion` support (already in CSS).
- [ ] Verify viewport meta tags and no horizontal scroll.
- [ ] Commit: "feat: PWA installable + mobile polish"

**Validation:** Can install as PWA on iPhone. Core flow works offline (cached pages).

---

## Phase 8 — RPi5 Deployment

**Goal:** App running in production on Raspberry Pi 5 behind Cloudflare Tunnel.

> [!IMPORTANT]
> The RPi5 deployment steps must be documented in code/configs (such as `ecosystem.config.js`) and in the documentation, but NOT executed from the Windows environment. All setup operations must run directly on the Raspberry Pi 5 itself.

### Tasks

- [ ] Install Node.js 22 (LTS) ARM64 on Raspberry Pi 5.
- [ ] Install PM2 globally (`npm install -g pm2`).
- [ ] Create `/var/lib/la-polla-2026/` and `/var/lib/la-polla-2026/backups/` directories with write permissions.
- [ ] Clone code repository on RPi5, and pull updates using `git pull`.
- [ ] Setup production environment file `.env` or `.env.local` inside the repo on RPi5 pointing to `DATABASE_URL="file:/var/lib/la-polla-2026/prod.db"`.
- [ ] Run `npm install` on RPi5.
- [ ] Execute `npx prisma migrate deploy` on RPi5 to create/update tables in the production DB.
- [ ] Run seed script on RPi5 (`npx prisma db seed`) to initialize teams and matches.
- [ ] Run production build `npm run build` directly on RPi5.
- [ ] Start the application via PM2: `pm2 start ecosystem.config.js`.
- [ ] Configure cloudflared tunnel to proxy pollahipolitos.todoestaaca.com to the app on port 3030.
- [ ] Set up the daily cron job backup for `/var/lib/la-polla-2026/prod.db`.
- [ ] Enable PM2 startup: `pm2 startup` and `pm2 save`.
- [ ] Commit: "chore: RPi5 deployment configuration"

**Validation:** App accessible via Cloudflare Tunnel URL. Sessions persist. Backups run nightly.

---

## Milestone Summary

| Phase | Deliverable | Est. Effort |
|-------|------------|-------------|
| 0 — Scaffold | Working shell with design system | 1 day |
| 1 — Data Model | 72 matches seeded in SQLite | 0.5 day |
| 2 — Auth | Login/register with real sessions | 1 day |
| 3 — League Join | Invite-code join flow | 0.5 day |
| 4 — Predictions | Score input with kickoff locking | 1.5 days |
| 5 — Ranking | Real standings from real data | 1 day |
| 6 — Admin | Result entry + management panel | 1.5 days |
| 7 — PWA | Installable + mobile polish | 0.5 day |
| 8 — Deployment | RPi5 + Cloudflare Tunnel (Docs only) | 0.5 day |
| **Total** | | **~8 days** |

---

## Option Recommendation

**Choose Option C: Hybrid Approach**

| | Option A: Adapt original | Option B: Rebuild from scratch | Option C: Hybrid (RECOMMENDED) |
|-|--------------------------|-------------------------------|--------------------------------|
| Design system | Reuse | Recreate from scratch | Reuse |
| Match data / seed | Reuse | Recreate from scratch | Reuse |
| Scoring logic | Reuse | Recreate | Reuse |
| UI components (MatchCard, etc.) | Reuse with fixes | Recreate | Reuse with wiring changes |
| Auth | Remove Supabase + rebuild | Rebuild from scratch | Rebuild (Better Auth) |
| Backend / API | Add to existing structure | Build from scratch | Build from scratch in clean scaffold |
| Correctness risk | High (Supabase assumptions everywhere) | Medium (no reference) | Low (clean structure, proven UI) |
| Speed | Medium | Slow | Fast |
| Deployability | Requires heavy refactor | Clean from start | Clean from start |

The hybrid approach gives us the best of both: the reference's production-quality UI and correct FIFA data, combined with a clean, correct, fully server-backed architecture built for SQLite + RPi5.
```
