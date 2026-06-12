# Architecture — La Polla 2026

> Last updated: 2026-06-12

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

## 5. Authentication Design

### Library: Better Auth

Configuration (`lib/auth.ts`):
```ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  session: { cookieCache: { enabled: true, maxAge: 60 * 60 * 24 * 30 } },
  trustedOrigins: [process.env.APP_URL!],
});
```

### Session Strategy
- Server-side session stored in SQLite `Session` table.
- HttpOnly cookie — never exposed to JavaScript.
- 30-day session with sliding expiry.
- On RPi5: runs completely self-contained, no external auth service dependency.

### Authorization Model

| Role | Access |
|------|--------|
| Unauthenticated | Login/register page only |
| Authenticated user | Own predictions, league ranking (if member), own profile |
| League admin | Manage their own league (invite, remove members) |
| Superadmin | All: match results, all leagues, all users |

Superadmin flag: `User.is_superadmin` — set manually in DB or via seed.

---

## 6. Application Flow

### Prediction Flow

```
User opens /pronosticos
  → Server component loads matches from DB for current user's league
  → Client renders MatchCards with user's existing predictions
  → User inputs score via Stepper widget
  → Server Action called: upsertPrediction(matchId, home, away)
    → Validate: session exists
    → Validate: match.kickoff_utc > now() (HARD CUTOFF)
    → Validate: user is member of league
    → Upsert Prediction row
  → Client updates savedMap state
```

### Scoring Flow

```
Admin enters result for a match
  → Server Action: setMatchResult(matchId, homeScore, awayScore)
    → Validate: superadmin session
    → Update Match row (home_score, away_score, status=FINISHED)
    → Recompute scores: for all Prediction rows matching this matchId
      → calculatePoints(prediction, result)
      → Update Prediction.points_earned and Prediction.score_type
    → Recompute Standing rows for all leagues with this match
```

### League Join Flow

```
User visits /liga/join?code=XXXX
  → Validate: code matches a League.invite_code
  → Validate: user not already a member
  → Create LeagueMember row
  → Redirect to /liga
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
│  │  port 3000   │   │  la-polla-2026/│  │
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
      PORT: 3000,
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
APP_URL="http://localhost:3000"
```

### Raspberry Pi 5 Production (`.env` or `.env.local` - NOT committed)
```env
DATABASE_URL="file:/var/lib/la-polla-2026/prod.db?connection_limit=1&socket_timeout=20"
BETTER_AUTH_SECRET="<production-random-32-byte-hex-secret>"
APP_URL="https://lapolla.example.com"
NODE_ENV=production
PORT=3000
```
