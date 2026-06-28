# Champion Survivor tournament status

## Initialization

`/admin/supervivencia` initializes `TeamTournamentStatus` only for real teams that are both in the league's eligible roster and have a saved `ChampionOddsSnapshot` with `sourceMarket = outright_winner`. It does not use the complete `Team` catalog or create placeholder statuses. The action is idempotent and preserves existing rows.

## Group-stage sync

After all 72 group matches have consistent final results and FIFA tie-breaks are resolved, an explicit admin action marks non-qualified initialized teams as `eliminated` and qualified teams as `active`. Existing manual `eliminated`, `runner_up`, and `champion` statuses are preserved.

If a final result exists, the sync can mark the winner `champion` and the loser `runner_up`. Conflicting terminal manual states and multiple champions are rejected for review. `runner_up` counts as eliminated in Survivor summaries and simulations.

Automatic elimination for every intermediate knockout round is not included yet; administrators retain the existing manual status controls.

## Champion market display

Admin probability, decimal odds, expected value, individual expected value, and simulation read only league-scoped `ChampionOddsSnapshot` rows where `sourceMarket = outright_winner`. Match `OddsSnapshot` rows are not champion odds. Missing tournament-status rows are treated as unknown/active for simulation rather than hiding saved champion odds.

The production database remains on Raspberry Pi and is not stored in GitHub.
