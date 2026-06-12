# Project Instructions for Antigravity Agents

This is a standalone web application called **La Polla 2026** (a private World Cup 2026 prediction pool).

---

## ⚠️ Critical Hard Rules

- **Unrelated to Oraculo:** This project is completely independent of the "Oraculo" project. Under no circumstances should you access, import, depend on, or modify any Oraculo code, directories, or environment configurations.
- **No Supabase:** Do NOT use Supabase (database, auth, client SDK, or hosting) in any form.
- **Database Stack:** Use **SQLite** through **Prisma ORM**.
  - Local Windows Development path: `file:./prisma/dev.db` (inside the `app` directory).
  - Production Raspberry Pi 5 path: `/var/lib/la-polla-2026/prod.db` (outside the repo directory).
- **Authentication:** Use **Better Auth** with the Prisma adapter. Do NOT use Auth.js / NextAuth.
- **Node.js Version:** Use Node.js 22 both locally during development and on production.
- **Windows Local Development:** Development tasks are executed on a Windows host using Antigravity. Ensure all terminal commands run are Windows-compatible (e.g., PowerShell syntax, escaping quotes correctly, avoiding bash-specific syntax).
- **No Direct Deployment Execution:** Raspberry Pi 5 deployment steps must be documented in documentation files and repository configurations (like PM2), but never executed directly from the Windows development sandbox. Production deployment happens via `git pull` from GitHub on the RPi5.
- **Never Commit Sensitive/Database Files:** Never commit credentials, keys, `.env`, `.env.local`, or any SQLite database or transaction files (`.db`, `.sqlite`, `.sqlite3`, `.db-journal`, `.db-wal`, `.db-shm`).
- **Commit `.env.example`:** Maintain and commit `.env.example` when new configuration keys are added.

---

## Code Quality and Version Control

- **Pre-commit Validation:** Before proposing any commit, you must run validation commands if available:
  - Linting (`npm run lint`)
  - Type checking (`npm run typecheck` or similar compiler check)
  - Production build testing (`npm run build`)
- **Incremental Commits:** Keep commits small, focused, and meaningful. Propose separate commits for separate logical changes.
- **Architecture Integrity:** Document all new design decisions in `docs/DECISIONS.md`. Update `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` as the implementation evolves.

---

## Implementation Strategy: Phase-Based Delivery

Work sequentially through the following phases. At the end of each phase:
1. Explain what has changed.
2. List the modified and new files.
3. Run project validation commands (lint, build).
4. Commit the changes with descriptive messages.

### Phase Roadmap
1. **Phase 0 — Scaffold and Foundation:** Clean Next.js 16 app in `app/` with Prisma + SQLite schemas, Better Auth configurations, and basic CSS styling and UI layout shell.
2. **Phase 1 — Data Model and Seed:** Real match schedules (72 matches) and team metadata (48 teams) loaded into SQLite via seed script.
3. **Phase 2 — Authentication:** Registration and persistent login using Better Auth email+password provider.
4. **Phase 3 — League Join Flow:** Create leagues and join them using uniquely generated invite codes.
5. **Phase 4 — Predictions:** User prediction scores for matches with strict server-side kickoff time cutoff locking.
6. **Phase 5 — Ranking and Scoring:** Leaderboard and ranking table calculation when match results are updated.
7. **Phase 6 — Admin Panel:** Match results entry interface and league/user administration restricted to superadmins.
8. **Phase 7 — PWA and Mobile Polish:** Responsive mobile enhancements, manifest setup, and offline-compatible configurations.
9. **Phase 8 — RPi5 Deployment Setup:** Configuration of PM2 setup, Cloudflare Tunnel specifications, backup crons, and deployment instructions.