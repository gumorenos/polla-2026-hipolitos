# Architecture — La Polla 2026

> Last updated: 2026-06-16

---

## 1. Goals

La Polla 2026 is a private World Cup 2026 prediction pool for small groups (20-50 people). It must be:

- **Self-hosted** — runs entirely on a Raspberry Pi 5 at home.
- **Private** — invite-code-only, no public registration.
- **Mobile-first** — PWA installable on iOS and Android.
- **Offline-tolerant** — works behind Cloudflare Tunnel; no SaaS dependencies.
- **Simple to operate** — single SQLite file, PM2 process manager, daily backups.

---

## 2. Stack

| Layer | Technology | Rationale |
|-------|-----------|----------|
| Framework | Next.js 16 (App Router) | SSR + Server Actions + PWA support |
| Language | TypeScript 5 | Type safety across full stack |
| Styling | Tailwind CSS 4 | Utility-first, matches reference design system |
| Animations | Framer Motion 12 | Reference uses it; polished micro-interactions |
| Database | SQLite (via Prisma) | Zero-config, file-based, perfect for RPi5 single-instance |
| ORM | Prisma 7 | Type-safe queries, migration management |
| Auth | Better Auth | Native App Router support, Prisma adapter, email+password |
| Charts | Recharts 3 | Reference uses it; good React integration |
| Icons | Lucide React | Reference uses it; tree-shakeable |
| PWA | next-pwa or @ducanh2912/next-pwa | Manifest + service worker |
| Runtime | Node.js 22 (LTS) | ARM64 production builds, performance |
| Process manager | PM2 | Auto-restart, log management |
| Tunnel | Cloudflare Tunnel | HTTPS to LAN device without port forwarding |
| Backup | SQLite WAL + cron | Daily automated backup |

---

## 3. Repository Structure

```
lapolla2026/
├── app/                          # Next.js App (source of truth)
│   ├── src/
│   │   ├── app/                  # App Router pages and API routes
│   │   │   ├── (auth)/           # Login, register, invite pages
│   │   │   ├── (app)/            # Protected app pages
│   │   │   │   ├── pronosticos/
│   │   │   │   ├── ranking/
│   │   │   │   ├── liga/
│   │   │   │   ├── perfil/
│   │   │   │   └── calendario/
│   │   │   ├── admin/            # Admin panel (superadmin only)
│   │   │   │   ├── matches/
│   │   │   │   ├── leagues/
│   │   │   │   └── users/
│   │   │   ├── api/
│   │   │   │   └── auth/         # Better Auth handler
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/               # Atoms: Avatar, Countdown, FlagDisc, etc.
│   │   │   ├── match/            # MatchCard variants
│   │   │   ├── league/           # Charts, Podio, RankingTable
│   │   │   └── layout/           # AppShell, BottomNav, Sidebar
│   │   ├── lib/
│   │   │   ├── auth.ts           # Better Auth config
│   │   │   ├── db.ts             # Prisma client singleton
│   │   │   ├── scoring/          # calculatePoints.ts
│   │   │   └── utils/            # dates.ts, etc.
│   │   └── types/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts               # 72 matches + 48 teams seed
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   ├── next.config.ts
│   ├── ecosystem.config.js       # PM2 config
│   └── package.json
├── docs/
│   ├── REFERENCE_AUDIT.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── DECISIONS.md
├── .env.example                  # Environment template
├── .gitignore                    # Git exclusions (includes DB and secrets)
├── AGENTS.md                     # Strict instructions for agents
└── reference/
    └── LAPOLLA2026/              # Read-only reference
```

---

## 4. Database Design

### Provider and Storage Paths

SQLite via Prisma with WAL (Write-Ahead Logging) mode enabled. The file storage is environment-dependent:
- **Local Windows Development:** Local file inside the repository: `file:./prisma/dev.db` (under `app/prisma/dev.db`). This file must never be committed.
- **Raspberry Pi 5 Production:** Stored outside the repository directory: `/var/lib/la-polla-2026/prod.db`. This directory must have read/write permissions for the application user.

### Key Differences from Reference (PostgreSQL) Schema

| Reference (PostgreSQL) | Our Schema (SQLite) | Reason |
|------------------------|---------------------|--------|
| `enum TournamentStatus` | String with Prisma enum | SQLite has no native enum type; Prisma validates at ORM layer |
| `enum RoundType` | String with Prisma enum | Same |
| `enum MatchStatus` | String with Prisma enum | Same |
| `enum LeagueStatus` | String with Prisma enum | Same |
| `enum ScoreType` | String with Prisma enum | Same |
| `enum Block` | String with Prisma enum | Same |
| PostgreSQL `uuid` | CUID via `@default(cuid())` | Portable across providers |

### Better Auth Additional Tables

Better Auth with Prisma adapter adds these tables to the schema:
- `User` — extended with `is_superadmin`, `display_name`, `whatsapp`
- `Session` — active sessions (cookie-based)
- `Account` — provider accounts (email+password credential)
- `Verification` — email verification tokens

### WAL Mode

SQLite WAL mode dramatically improves concurrent write capacity. Enable WAL mode via database connection options in `.env`:
- **Development:** `DATABASE_URL="file:./prisma/dev.db?connection_limit=1&socket_timeout=20"`
- **Production:** `DATABASE_URL="file:/var/lib/la-polla-2026/prod.db?connection_limit=1&socket_timeout=20"`

And configure Prisma DB setup script/migrations to execute:
```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
```

---

## 5. Authentication and Authorization Design

### Library: Better Auth

Better Auth is configured with the `username()` plugin, allowing users to register and log in using usernames and passwords rather than emails. Internally, a placeholder email (`username@polla.local`) is generated to satisfy database constraints.

Configuration (`lib/auth.ts`):
```ts
import { betterAuth } from 'better-auth';
import { username } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  plugins: [username()],
  session: { cookieCache: { enabled: true, maxAge: 60 * 60 * 24 * 30 } },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? 'http://localhost:3030',
  ],
});
```

### Session Strategy
- Server-side session stored in SQLite `Session` table.
- HttpOnly cookie — never exposed to JavaScript.
- 30-day session with sliding expiry.
- On RPi5: runs completely self-contained, no external auth service dependency.

### User Status and Authorization Model

Users must undergo an approval workflow. When a user registers, their account is initialized as `pending`. An administrator must approve their account before they can join pollas or make predictions.

| State | Access |
|-------|--------|
| Unauthenticated | Login/register page only |
| `pending` | Blocked screen: account pending approval |
| `rejected` / `disabled` | Blocked screen: account blocked/deactivated |
| `approved` (Normal User) | View/submit predictions, view standings, account settings |
| `approved` + `isSuperadmin` | All the above + Admin Panel (approve users, edit matches, recalculate standings) |

---

## 6. Application Flow

### Prediction Flow (Per-Match Predictions)

Predictions are league-specific. Users submit their prediction associated with a specific `leagueId`.

```
User opens /pronosticos
  → Server component loads matches and user predictions for the active pool (leagueId)
  → Client renders MatchCards with user's existing predictions and optional implied probabilities (OddsSnapshot)
  → User inputs score via Stepper widget
  → Server Action called: savePredictionAction(matchId, leagueId, home, away)
    → Validate: session exists and user is 'approved'
    → Validate: user is a member of the league (leagueId)
    → Validate: match.kickoff_utc > now() (HARD CUTOFF)
    → Upsert Prediction row in DB mapping (userId, leagueId, matchId)
  → Client updates local state
```

### Tournament Champion Prediction Flow

Users submit their tournament winner pick for each league before the league's `championDeadline`.

```
User selects Champion Team Code in /pronosticos Champion Widget
  → Server Action called: saveWinnerPredictionAction(leagueId, teamCode)
    → Validate: session exists and user is 'approved'
    → Validate: now() < league.championDeadline
    → Validate: user is a member of the league
    → Upsert WinnerPrediction row mapping (userId, leagueId)
```

### Champion Survivor Backend Flow

Champion Survivor is a separate competition type from full prediction mode. It uses `ChampionPick`, `TeamTournamentStatus`, and `ChampionOddsSnapshot`; it does not replace `WinnerPrediction` or use match prediction points.

```
User requests Champion Survivor state
  → Server Action validates approved session and league membership
  → League.competitionType must be champion_survivor
  → Current ChampionPick is joined with TeamTournamentStatus
  → Status is computed dynamically:
    pending if no pick
    alive if active/unknown/no status row
    eliminated if team status is eliminated
    winner if team status is champion
  → Latest ChampionOddsSnapshot per picked team provides market probability and expected value
```

```
User explicitly saves one champion pick
  → Server Action validates approved session, membership, valid team, and deadline
  → league.championDeadline is the hard cutoff
  → Pick is created or updated only if not already locked
  → lockedAt is set on save
```

```
Admin or superadmin manages Champion Survivor
  → Server Action validates superadmin or league owner/admin role
  → Admin pick changes and resets require a non-empty reason
  → Team tournament statuses are updated separately from user records
  → Champion odds are manual outright_winner snapshots only
  → CSV export is generated as text/csv, not spreadsheet files
```

### Scoring and Recalculation Flow

```
Admin enters result for a match
  → Server Action: updateMatchResultAction(matchId, homeScore, awayScore)
    → Validate: superadmin session
    → Update Match row (homeScore, awayScore, status='result')
    → Grade predictions for this match (calculatePoints using league-specific points configurations)
    → Trigger standings recalculation per league
      → For each league, aggregate per-match prediction points
      → If league championTeamCode is defined, add championPoints to users who predicted the correct winner
      → Apply tie-breaker rules to sort standings and update rankings snapshot (Standing)
```

### League Join Flow

```
User visits /join/[code] (or inputs inviteCode in the UI)
  → Validate: session exists and user is 'approved'
  → Validate: code matches a League.inviteCode and league is active/inviteEnabled
  → Validate: user not already a member
  → Create LeagueMember row
  → Redirect to home page (/)
```

---

## 7. Deployment Architecture (Raspberry Pi 5)

```
┌─────────────────────────────────────────┐
│             Raspberry Pi 5              │
│                                         │
│  ┌──────────────┐   ┌────────────────┐  │
│  │  Next.js app │   │  SQLite DB     │  │
│  │  (PM2)       │──▶│  /var/lib/     │  │
│  │  port 3030   │   │  la-polla-2026/│  │
│  └──────┬───────┘   │  prod.db       │  │
│         │           └────────────────┘  │
│  ┌──────▼───────┐                       │
│  │  cloudflared │   ┌────────────────┐  │
│  │  tunnel      │   │  cron backup   │  │
│  └──────┬───────┘   │  (daily)       │  │
└─────────┼───────────└────────────────┘  │
          │ HTTPS                         │
          ▼                               │
   Cloudflare Edge                        │
          │ HTTPS                         │
          ▼                               │
     Users (mobile/desktop)               │
```

### PM2 Ecosystem Config

```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'lapolla2026',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/home/pi/lapolla2026/app',
    env: {
      NODE_ENV: 'production',
      PORT: 3030,
    },
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
```

### Backup Cron

```bash
# /etc/cron.d/lapolla-backup
0 3 * * * pi sqlite3 /var/lib/la-polla-2026/prod.db ".backup '/var/lib/la-polla-2026/backups/lapolla-$(date +\%Y\%m\%d).sqlite'" && find /var/lib/la-polla-2026/backups -name 'lapolla-*.sqlite' -mtime +30 -delete
```

### Build and Delivery Strategy

- Code is pushed from Windows development environment to GitHub.
- Raspberry Pi 5 pulls updates via `git pull`.
- Next.js production build (`npm run build`) is executed directly on the Raspberry Pi 5.
- PM2 manages process restarts.
- Node.js 22 is installed on both Windows development laptop and Raspberry Pi 5.

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Session hijacking | HttpOnly + Secure cookies; SameSite=Lax |
| CSRF on Server Actions | Next.js 16 Server Actions include built-in CSRF protection |
| Prediction after kickoff | Server-side cutoff check on every mutation |
| Admin privilege escalation | Superadmin flag checked server-side; not derived from request |
| SQLite injection | All queries via Prisma ORM — no raw SQL with user input |
| Secret exposure | .env and .env.local never committed; BETTER_AUTH_SECRET is server-only |
| DB file exposure | Stored outside webroot at `/var/lib/la-polla-2026/prod.db`; Cloudflare Tunnel does not expose filesystem |

---

## 9. Environment Variables

### Local Windows Development (`.env` or `.env.local` - NOT committed)
```env
DATABASE_URL="file:./prisma/dev.db?connection_limit=1&socket_timeout=20"
BETTER_AUTH_SECRET="<random-32-byte-hex-secret>"
APP_URL="http://localhost:3030"
```

### Raspberry Pi 5 Production (`.env` or `.env.local` - NOT committed)
```env
DATABASE_URL="file:/var/lib/la-polla-2026/prod.db?connection_limit=1&socket_timeout=20"
BETTER_AUTH_SECRET="<production-random-32-byte-hex-secret>"
APP_URL="https://lapolla.example.com"
NODE_ENV=production
PORT=3030
```
