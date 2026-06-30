# Champion Survivor tournament status

## Initialization

`/admin/supervivencia` initializes `TeamTournamentStatus` only for real teams that are both in the league's eligible roster and have a saved `ChampionOddsSnapshot` with `sourceMarket = outright_winner`. It does not use the complete `Team` catalog or create placeholder statuses. The action is idempotent and preserves existing rows.

## Group-stage sync

After all 72 group matches have consistent final results, synchronization builds the 48-team roster from real group fixtures and compares it with the materialized r32 roster. Its 32 teams stay `active`; the other 16 receive idempotent `TeamTournamentStatus = eliminated` rows even when no status row existed before. This avoids blocking elimination sync on an exact-order tie between third-placed teams when that tie does not change the eight qualifying groups. Existing manual `eliminated`, `runner_up`, and `champion` statuses are preserved.

## Knockout and final synchronization

Every consistent knockout result synchronizes team statuses automatically:
- **Knockout losers**: Losers of any knockout match (R32, R16, Quarters) are marked as `eliminated`.
- **Semifinal losers**: Semifinal losers are immediately marked as `eliminated` for Champion Survivor, even though they advance to play in the third-place match. The third-place match itself (`3rd`) is excluded from Survivor status progression.
- **Finalists**: A final match result marks the winner as `champion` and the loser as `runner_up`.
- **Tournament end**: After the final, all remaining non-champion teams are marked as `eliminated`.
- **Safety checks**: Conflicting terminal manual states and multiple champions are rejected for review. `runner_up` counts as eliminated in Survivor summaries and simulations.

The provider, CSV, and manual result paths share the same automatic propagation/sync service. The repair action in `/admin/resultados` previews and applies bracket materialization, group elimination backfill, and knockout status updates; this supports results that were saved before automatic propagation existed. Administrators retain initialization, explicit sync, and manual status controls in `/admin/supervivencia;` all operations are idempotent and audited when they change persisted state.

### Completed-result backfill

The explicit repair action scans all locally finalized knockout matches, not only results saved after propagation was introduced. For example, a stored `r32_01` result with Canada over South Africa resolves `W73` to `CAN`, updates `r16_01.homeTeamCode`, keeps Canada active, and marks `RSA` eliminated. Re-running the action produces no duplicate matches or status changes. Public display also derives a conservative elimination fallback from finalized knockout results so a stale `active` row cannot expose a known loser while the admin backfill is pending.

## Public pick taxonomy

Pick type is separate from tournament status. The public taxonomy uses actual pick counts and champion-market probability, never popularity rank by itself:

- `Favorito diferencial` / `Favorito compartido`: probability at least 10%, with one or multiple picks.
- `Longshot exclusivo` / `Longshot compartido`: probability below 5%, with one or multiple picks.
- `Pick de mercado medio`: probability from 5% to below 10%.
- `Pick concentrado`: multiple picks materially above the medium-band market probability.
- `Sin picks`, `Pick sin cuota`, and `Fuera de carrera` cover explicit empty, missing-market, and eliminated states.

## Champion market display

Admin probability, decimal odds, expected value, individual expected value, and simulation read only league-scoped `ChampionOddsSnapshot` rows where `sourceMarket = outright_winner`. Match `OddsSnapshot` rows are not champion odds. Missing tournament-status rows are treated as unknown/active for simulation rather than hiding saved champion odds.

The production database remains on Raspberry Pi and is not stored in GitHub.
