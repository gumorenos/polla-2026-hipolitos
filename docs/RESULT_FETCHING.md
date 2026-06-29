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

Recommended Raspberry Pi cron after validation:

```cron
*/5 * * * * cd /home/gumorenos/apps/polla-2026-hipolitos/app && npm run results:fetch-surgical >> /home/gumorenos/logs/results-surgical.log 2>&1
```

Replace the old broad result cron with this command. Keep `results:fetch-due` only as a manual fallback while the surgical scheduler is being observed. Validate runs with:

```bash
tail -n 80 /home/gumorenos/logs/results-surgical.log
```

The structured final JSON reports `due`, `skippedFinal`, `fetched`, `savedFinal`, `notFinalYet`, `failed`, and `stoppedEarly`.

An admin read-only scheduler dashboard is not implemented in this phase; logs remain the operational diagnostic source.
