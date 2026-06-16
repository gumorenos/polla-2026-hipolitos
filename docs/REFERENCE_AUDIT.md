# Reference App Audit — LAPOLLA2026

> Audited: 2026-06-12  
> Reference path: `reference/LAPOLLA2026/`  
> License: MIT (safe to selectively migrate)

---

## 1. Overview

The reference app is a **Phase 0 UI prototype** — fully functional from a visual/UX standpoint, but with **zero real backend**. All data (matches, players, standings, predictions) is served from a static `mock.ts` file in memory. Authentication is a fake modal that only toggles client-side state. There is no server-side logic, no API routes, and no actual Supabase integration despite it being declared as a dependency.

The reference was architecturally planned for Supabase (PostgreSQL) + Supabase Auth. We are replacing both with **SQLite + Prisma** and **Better Auth**.

---

## 2. Directory Structure Summary

The reference contains:
- `src/app/` — 5 App Router pages: root, liga, pronosticos, ranking, perfil
- `src/components/layout/` — AppShell, AppContext, AuthModal, BottomNav, Sidebar, ScreenShell, TweaksPanel
- `src/components/match/` — MatchCard with 3 variants (Scoreboard, Solari, Ticket)
- `src/components/league/` — Charts, Podio, RankingTable
- `src/components/screens/` — 5 full-screen components
- `src/components/ui/` — Avatar, Countdown, FaseBadge, FlagDisc, Icon, PhaseDot, RankArrow, Stepper
- `src/lib/data/mock.ts` — ALL data (72 matches, 48 teams, players, standings)
- `src/lib/scoring/calculatePoints.ts` — scoring engine
- `src/lib/utils/dates.ts` — Spanish UTC date formatters
- `src/types/index.ts` — TypeScript interfaces
- `prisma/schema.prisma` — PostgreSQL schema (needs SQLite adaptation)

---

## 3. What Is Worth Reusing

### HIGH VALUE — Migrate with minimal changes

| Asset | Location | Notes |
|-------|----------|-------|
| Design system (CSS tokens) | `globals.css` | Complete dark-gold theme, variables, animations, utility classes. Use verbatim. |
| `calculatePoints.ts` | `lib/scoring/` | Clean, pure, tested logic. Exact/tendency/consolation/miss scoring. Copy directly. |
| `dates.ts` | `lib/utils/` | Spanish-locale UTC date formatting helpers. Copy directly. |
| TEAMS record | `lib/data/mock.ts` | 48 qualified teams with codes, Spanish names, hue values. Verified against official FIFA 2026 draw. |
| MATCHES array | `lib/data/mock.ts` | 72 real matches (Groups A-L + knockout bracket) with correct UTC timestamps. Use as seed data. |
| PHASES, SCORE_META, venues | `lib/data/mock.ts` | Phase labels, colors, Spanish venue names/cities. Use verbatim. |
| TypeScript types | `src/types/index.ts` | Well-designed: ScoreType, PhaseId, CardVariant, CardMode, Match, Player, League, Team. Adapt to Prisma schema. |
| MatchCard.tsx | `components/match/` | Three polished card variants (Scoreboard, Solari, Ticket) with prediction steppers, score display. Migrate with API wiring changes. |
| Stepper.tsx | `components/ui/` | Score input stepper widget. Copy directly. |
| Countdown.tsx | `components/ui/` | Inline countdown to kickoff. Copy directly. |
| FaseBadge, FlagDisc, PhaseDot, RankArrow | `components/ui/` | Polished visual atoms. Copy directly. |
| Avatar, Icon | `components/ui/` | Simple, well-built. Copy directly. |
| Podio, RankingTable | `components/league/` | Animated podium and ranking table. Needs real data wiring. |
| Charts.tsx | `components/league/` | LineChart + BreakdownBar using Recharts. Good design. Wire to real data. |
| AppShell layout pattern | `components/layout/` | Responsive mobile/desktop layout switch (bottom nav / sidebar). Pattern is correct. |
| BottomNav, Sidebar | `components/layout/` | 5-tab mobile nav and desktop sidebar. Copy and adapt. |
| Font choices | `layout.tsx` | Bebas Neue (display) + IBM Plex Mono + DM Sans. Excellent typographic hierarchy. Keep. |
| PWA manifest setup | `layout.tsx` | appleWebApp, manifest, themeColor. Transfer to new app. |
| Prisma schema — data model | `prisma/schema.prisma` | Core models (Tournament, Match, Prediction, Standing, League, LeagueMember) well-designed. Adapt for SQLite. |

### MEDIUM VALUE — Reuse pattern, rewrite implementation

| Asset | Notes |
|-------|-------|
| AppContext.tsx | Client-state pattern is good (preds map, savedMap). Replace mock data with real server calls. |
| AuthModal.tsx | UI is nice but fake. Rebuild wired to Better Auth. |
| Screen components | Layout and structure excellent. All data must be replaced with real API/server components. |
| ScreenShell.tsx | Simple scroll container. Copy and keep. |

---

## 4. What Should Be Rebuilt from Scratch

| Item | Reason |
|------|--------|
| Supabase dependencies | Entirely replaced by SQLite + Prisma + Better Auth. Remove completely. |
| AppContext data layer | Currently reads from mock.ts. Replace with Server Actions or API routes. |
| Authentication flow | Fake modal must become real. Better Auth with email+password. |
| All Server Actions / API routes | None exist. Build: predict, save, rankings, admin CRUD, league join. |
| Admin panel | Not present in reference. Build from scratch. |
| League join flow | Not implemented. Build (invite code to join league). |
| Prediction locking | Not enforced server-side. Must enforce using kickoff_utc on server. |
| Real-time scoring computation | Static mock standings. Build on-demand recompute or background job. |
| next.config.ts | Minimal stub. Needs PWA config, output config for RPi5. |
| Environment config | New .env.example — no Supabase vars. Replace with SQLite path, Better Auth secret. |
| Seed script | Reference has none. Need prisma/seed.ts to populate 72 matches + 48 teams. |
| PM2 ecosystem config | Not present. Build for RPi5 deployment. |

---

## 5. Risk Register

### HIGH RISK

| Risk | Detail | Mitigation |
|------|--------|------------|
| SQLite enum support | Prisma enums map to TEXT in SQLite but don't enforce CHECK constraints. | Use Prisma enum validation. Add DB-level CHECK constraints in custom migration if needed. |
| SQLite write concurrency | Multiple concurrent writes can cause SQLITE_BUSY. | Enable WAL mode (PRAGMA journal_mode=WAL). For 20-50 users, WAL is sufficient. |
| SQLite file location | DB inside repo risks overwrite during git pull. | Store at /data/lapolla2026/db.sqlite (outside repo). Set DATABASE_URL in .env.local. |
| Prediction locking | Reference does not enforce cutoff server-side. | All prediction endpoints must check match.kickoff_utc < now(). Hard rule. |
| No auth in reference | AuthModal is entirely fake. | Better Auth with session cookies. Never trust userId in request body — derive from session. |

### MEDIUM RISK

| Risk | Detail | Mitigation |
|------|--------|------------|
| Next.js 16 + React 19 stability | Cutting-edge. Some packages lag. | Lock versions. Test build on RPi5 ARM64. |
| ARM64 build on RPi5 | First build may take 5-10 minutes. | Build on dev machine, ship artifact via rsync. |
| framer-motion + server components | Requires use client. | Mark all animated components use client. |
| FlagDisc CDN dependency | May fail offline on RPi5. | Switch to local SVG flags or unicode emoji flags. |
| Kickoff timestamps | Hardcoded — may be updated by FIFA. | Allow admin to update kickoff times per match. |
| Credits/wagering system | Present in schema but unimplemented. | Decide early: include or remove. |

### LOW RISK

| Risk | Detail | Mitigation |
|------|--------|------------|
| Cloudflare Tunnel | Requires cloudflared daemon on RPi5. | No Next.js changes needed. App listens on port 3030. |
| PM2 stability | Next.js in start mode is stable. | Use ecosystem.config.js with max_restarts and min_uptime. |
| SQLite backup | Daily backup needed. | Cron: sqlite3 db.sqlite ".backup 'db-YYYYMMDD.sqlite'". |

---

## 6. Auth Recommendation: Better Auth vs Auth.js

### Better Auth
- Purpose-built for Next.js App Router with native Server Action support
- Prisma adapter built-in — minimal boilerplate
- Email+password, magic link, social OAuth all built-in
- Session stored in DB via Prisma — no JWT secrets exposed client-side
- No NEXTAUTH_URL foot-guns or callback URL mismatches
- Active development, modern API surface

### Auth.js (NextAuth v5)
- Mature library, large community
- v5 App Router support still in RC/beta
- Prisma adapter available but requires manual session table setup
- More configuration for credential-based auth
- JWT-based by default adds complexity for self-hosted RPi5

### RECOMMENDATION: Use Better Auth

Rationale:
1. Prisma adapter maps session/user/account tables directly into our schema
2. Native Server Action support — auth checks and mutations happen server-side
3. Email+password works out of the box — no OAuth needed for a private league
4. Simpler env config: just BETTER_AUTH_SECRET + DATABASE_URL
5. No external service dependency — fully self-hosted on RPi5

---

## 7. Summary Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| UI/UX design | 5/5 | Exceptional dark-gold aesthetic, 3 card variants, animations |
| Match data completeness | 5/5 | 72 real matches, 48 teams, correct UTC timestamps |
| Scoring logic | 5/5 | Pure, correct, tested |
| TypeScript quality | 4/5 | Good types, minor gaps for server models |
| Backend / Auth | 1/5 | Non-existent — entirely mocked |
| Security | 1/5 | No auth, no server validation, no CSRF protection |
| Deployability | 2/5 | No PM2, no RPi5 considerations, Supabase-dependent |
| Test coverage | 1/5 | Vitest is a devDependency but no test files exist |
