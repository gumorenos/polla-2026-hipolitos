# Champion Survivor correctness hotfix

## Team universes

The master `Team` table is not the writable Champion Survivor roster. It also contains fixture placeholders such as `1A`, `3CEFHI`, and `W100`, and it may contain real national teams that are not part of the active tournament.

The server therefore maintains two derived sets:

- **Visible teams:** the union of eligible teams plus existing `ChampionPick` and `WinnerPrediction` references. This keeps old data inspectable.
- **Eligible writable teams:** real teams found in the tournament fixture, explicit `TeamTournamentStatus` rows, or `ChampionOddsSnapshot` rows whose `sourceMarket` is `outright_winner`.

Both sets are intersected with real `Team.code` records through `filterRealTeams`. Existing picks do not make a team eligible for future writes.

## Survivor status rules

`runner_up` is terminal for a champion-only game. It is treated as eliminated in pick status, rankings, survival counts, and odds simulation. A known `champion` remains the deterministic winner.

Only one `TeamTournamentStatus.status = champion` may be assigned per league through the admin action. A conflicting second champion is rejected.

## Champion odds import

The admin import requires an explicit active `champion_survivor` league. Outright snapshots are written only to that league and only for its eligible team codes. The importer continues to use `sourceMarket = outright_winner`; match odds are never used as champion odds.

## Production boundary

The production SQLite database lives on the Raspberry Pi at `/var/lib/la-polla-2026/prod.db` and is not stored in GitHub. Validate and back up that database on the Raspberry Pi before applying migrations or restarting PM2.
