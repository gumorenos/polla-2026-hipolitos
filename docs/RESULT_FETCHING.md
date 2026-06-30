# Surgical result fetching

`npm run results:fetch-surgical` queries providers only for matches that are likely finished and still lack a complete final result.

## Scheduling rules

- Group stage: kickoff plus 125 minutes.
- Knockout: kickoff plus 195 minutes to cover extra time, penalties, and buffer.
- Retry grace: 15 minutes after the last attempted fetch.
- Default run limit: 8 matches, oldest due first.
- Cancelled and postponed matches are excluded.

All comparisons use JavaScript epoch milliseconds derived from Prisma `Date` values. The scheduler does not use SQLite `datetime('now')` against the millisecond-backed `kickoffUtc` column.

A group result is complete when status/resultStatus are final and both scores exist. A knockout result additionally requires `winnerTeamCode`; a final knockout without a winner remains diagnostic and eligible for repair.

## UX Display Windows vs. Fetching Windows

It is important to distinguish between **Surgical Result Fetching Windows** and **Public UI Display Windows**:
- **Surgical Fetching** is a backend operational scheduler (typically starting at kickoff + 125 min for groups / 195 min for knockouts) designed to call external APIs safely to retrieve final scores.
- **Public UI Display** classifies display states on the home dashboard (in-progress window of 135 min for groups / 210 min for knockouts). These are solely frontend UX thresholds. The public page does not trigger API requests and shows frozen pre-match odds while a match is ongoing or awaiting results.


## Idempotency and post-result pipeline

Before each provider request, the script reloads the match. It skips a complete final result, then atomically updates the existing `resultFetchedAt` field to claim the attempt. Concurrent or repeated runs therefore avoid duplicate calls, and failed/not-final attempts wait for the retry grace.

The script reuses `fetchAndSaveMatchResultInternal`. Successful final results continue through the existing central pipeline:

1. normalize and persist the final score;
2. score predictions and recalculate standings;
3. propagate knockout placeholders;
4. synchronize Champion Survivor statuses;
5. revalidate affected application pages when running inside Next.js.

Provider diagnostics in logs contain provider names and failure categories only. API keys are never logged.

## Operations

Manual preview without provider calls:

```bash
npm run results:fetch-surgical -- --dryRun
```

Manual execution:

```bash
npm run results:fetch-surgical
```

One-match diagnosis and save support both argument forms:

```bash
npm run results:fetch-match -- --matchId=r32_04 --dryRun --provider=auto --force
npm run results:fetch-match -- r32_04 --dryRun --provider=auto --force
```

Remove `--dryRun` only after reviewing the full score details, provider winner, penalty fields, fallback provider, and diagnostics printed by the command. When football-data reports a penalty winner but does not provide a usable shootout score, the app stores the trusted team winner, leaves penalty scores null, and records a note instead of inventing penalty values. A finished knockout result without a resolvable winner is rejected.

Recommended Raspberry Pi cron migration plan:

Replace the old broad results cron:
```cron
*/15 * * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run results:fetch-due >> /home/gumorenos/logs/results.log 2>&1
```

with the new surgical scheduler cron running every 5 minutes:
```cron
*/5 * * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run results:fetch-surgical >> /home/gumorenos/logs/results-surgical.log 2>&1
```

Keep the old `results:fetch-due` only as an emergency/manual fallback while the surgical scheduler is being observed. Validate runs with:

```bash
tail -n 80 /home/gumorenos/logs/results-surgical.log
```

The structured final JSON reports `due`, `skippedFinal`, `fetched`, `savedFinal`, `notFinalYet`, `failed`, and `stoppedEarly`.

## Knockout Fixture Schedule Correction Procedure

To ensure kickoff times match the official FIFA World Cup 2026 schedule, the application maintains a static schedule map `OFFICIAL_KNOCKOUT_SCHEDULE` in `app/src/lib/official-knockout-schedule.ts`.

- **Official Source**: Reviewed against the official FIFA World Cup 26™ match schedule.
- **No Runtime Dependency**: The app uses static dates/times in UTC and does not make external network requests to retrieve the tournament schedule during page load.
- **Admin Correction Tool**: Superadmins can visit `/admin/partidos` and use the "Corrección de Horarios Oficiales (Knockouts)" panel. This panel:
  1. Compares the database kickoff times against the official static schedule map.
  2. Previews all proposed changes (showing match ID, old/new dates and times).
  3. Skips matches that already have final scores.
  4. Applies changes atomically on admin confirmation and writes an `AdminActionLog` with details of the action.
- **Static Seed Integration**: The Prisma seed script in `app/prisma/seed.ts` has also been updated with the corrected official dates/times to prevent future overrides.

