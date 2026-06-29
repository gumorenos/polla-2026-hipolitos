# Results and knockout bracket

## Result consistency

A final match is valid only when `status = result`, `resultStatus = final`, and both scores are present. Group draws have no `winnerTeamCode`; knockout draws require a non-tied penalty shoot-out. Manual admin results use `resultSource = manual_admin`, record the verifying admin, update predictions, and write `AdminActionLog`.

Scheduling edits cannot mark an incomplete match as `result`. Provider lookup failures do not modify the match. Postponed, cancelled, or pending matches remain non-final and do not retain final scores.

## Provider diagnostics

`/admin/resultados` can explicitly diagnose API-Football and football-data lookups without saving a result. The report includes local teams and kickoff, normalized query criteria, candidate count, matched fixture ID, and a classified failure reason. Credentials and raw secrets are never returned to the browser.

Both providers search a one-day UTC margin around kickoff to handle adjacent-date classification. Matching still requires the expected teams and a kickoff within 24 hours.

## Manual fallback

When providers cannot locate a fixture, a superadmin can enter the final score in `/admin/resultados`. This also repairs legacy rows that currently have `status = result` but null scores.

## Round of 32 resolver

The resolver uses local final group results and the existing FIFA qualification engine. It reports blocking matches, resolves `1A`/`2A` placeholders, and proposes Round-of-32 updates without changing match IDs or predictions.

Best-third allocation uses the complete 495-row Annex C table from the [official FIFA World Cup 2026 regulations](https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf). The resolver canonicalizes the eight qualifying third-place groups, looks up the exact official allocation, and assigns each third-place team by its group-winner slot (`vs1A`, `vs1B`, etc.). It never chooses a team merely because its group appears in a placeholder.

`/admin/resultados` previews current and resolved team codes, the Annex C reason, and whether each match changes. Applying the bracket remains an explicit superadmin action. It updates only changed Round-of-32 matches by ID, preserves predictions, and writes `AdminActionLog`. Missing group results or a missing Annex C key block the entire apply operation.

## FIFA tiebreak diagnostics

The best-third table distinguishes an unresolved exact order from an unresolved qualification cutoff. Equal points, goal difference, and goals scored are reported together with missing fair-play and FIFA-ranking data. Head-to-head is not applicable between third-placed teams from different groups. A tie wholly inside the top eight does not replace `third_place_qualified` with a pending status; a tie crossing positions 8 and 9 remains blocked and requires reviewed source data or an explicit future override workflow.

## Knockout propagation

Later rounds keep `Wxx` and `RUxx` placeholders until the referenced knockout match has a consistent final result. The shared result-save path used by provider refresh, CSV import, and manual fallback propagates winners from r32 through the final and semifinal losers into the third-place match. A superadmin can also preview and apply the same plan explicitly in `/admin/resultados`.

Propagation updates match participants by existing match ID. It never deletes matches or predictions, and it refuses to overwrite a different already-materialized team. Knockout draws without a valid winner remain pending. The repair/sync panel previews bracket and Survivor changes with current value, proposed value, reason, and safe/blocked status before an explicit apply.

The public Team & Market Analysis defaults to active teams. `Todos` and `Eliminados` remain available. When a persisted status is missing, completed group qualification supplies a read-only fallback so group-stage eliminations are not mislabeled as pending while the database backfill is awaiting execution.

Public market labels avoid internal shorthand: `saturated` is displayed as **Alta concentración de picks**, unknown tournament state is **Sin estado confirmado**, and an inline legend explains active/eliminated status, missing champion odds, and estimated EV. Match-odds bulk refresh remains an explicit admin operation and does not run from this public view.

The production database remains `/var/lib/la-polla-2026/prod.db` on Raspberry Pi and is never committed to GitHub.
