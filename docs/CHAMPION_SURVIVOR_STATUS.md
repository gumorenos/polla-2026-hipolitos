# Champion Survivor tournament status

## Initialization

`/admin/supervivencia` initializes `TeamTournamentStatus` only for real teams that are both in the league's eligible roster and have a saved `ChampionOddsSnapshot` with `sourceMarket = outright_winner`. It does not use the complete `Team` catalog or create placeholder statuses. The action is idempotent and preserves existing rows.

## Group-stage sync

After all 72 group matches have consistent final results, synchronization builds the 48-team roster from real group fixtures and compares it with the materialized r32 roster. Its 32 teams stay `active`; the other 16 receive idempotent `TeamTournamentStatus = eliminated` rows even when no status row existed before. This avoids blocking elimination sync on an exact-order tie between third-placed teams when that tie does not change the eight qualifying groups. Existing manual `eliminated`, `runner_up`, and `champion` statuses are preserved.

Every consistent knockout result eliminates the loser for Champion Survivor and keeps the winner active. Semifinal losers are eliminated immediately even though they are propagated to the third-place fixture. A final result marks the winner `champion`, the loser `runner_up`, and all remaining non-champions eliminated. Conflicting terminal manual states and multiple champions are rejected for review. `runner_up` counts as eliminated in Survivor summaries and simulations.

The provider, CSV, and manual result paths share the same automatic propagation/sync service. The repair action in `/admin/resultados` previews and applies bracket materialization, group elimination backfill, and knockout status updates; this supports results that were saved before automatic propagation existed. Administrators retain initialization, explicit sync, and manual status controls in `/admin/supervivencia`; all operations are idempotent and audited when they change persisted state.

## Champion market display

Admin probability, decimal odds, expected value, individual expected value, and simulation read only league-scoped `ChampionOddsSnapshot` rows where `sourceMarket = outright_winner`. Match `OddsSnapshot` rows are not champion odds. Missing tournament-status rows are treated as unknown/active for simulation rather than hiding saved champion odds.

The production database remains on Raspberry Pi and is not stored in GitHub.
