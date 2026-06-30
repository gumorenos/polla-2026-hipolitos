# Results and knockout bracket

## Result consistency

A final match is valid only when `status = result`, `resultStatus = final`, and both scores are present. Group draws have no `winnerTeamCode`; knockout draws require a non-tied penalty shoot-out. Manual admin results use `resultSource = manual_admin`, record the verifying admin, update predictions, and write `AdminActionLog`.

Scheduling edits cannot mark an incomplete match as `result`. Provider lookup failures do not modify the match. Postponed, cancelled, or pending matches remain non-final and do not retain final scores.

The production result cron uses the surgical scheduler documented in `docs/RESULT_FETCHING.md`: groups become due 125 minutes after kickoff, knockouts after 195 minutes, and complete DB finals are rechecked and skipped before any provider call. Successful provider saves use the same scoring, ranking, bracket propagation, Survivor synchronization, and cache revalidation pipeline as manual results.

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

The best-third table distinguishes an unresolved exact order from an unresolved qualification cutoff. Equal points, goal difference, and goals scored are reported together with missing fair-play and FIFA-ranking data. Head-to-head is not applicable between third-placed teams from different groups. 

- **Impacting ties**: A tie crossing positions 8 and 9 (the cutoff boundary) remains blocked, preventing automatic propagation and requiring reviewed source data or an explicit manual override.
- **Non-impacting ties**: A tie wholly inside the top eight (e.g. Ecuador and Ghana at positions 3 and 4) does not affect qualification and does not affect bracket allocation under Annex C (which only depends on the set of groups of the qualifying teams, not their rank). These are labeled as `Desempate pendiente — no afecta clasificación ni bracket` and allow bracket resolution to proceed normally.

## Knockout propagation

Later rounds keep `Wxx` and `RUxx` placeholders until the referenced knockout match has a consistent final result. The shared result-save path used by provider refresh, CSV import, and manual fallback propagates winners through the entire knockout flow:

- **Round of 32 -> Round of 16**: R32 winners (`r32_01` to `r32_16` / FIFA matches 73 to 88) map to `r16_01` to `r16_08` (`W73` to `W88`).
- **Round of 16 -> Quarter-finals**: R16 winners (`r16_01` to `r16_08` / FIFA matches 89 to 96) map to `qf_01` to `qf_04` (`W89` to `W96`).
- **Quarter-finals -> Semi-finals**: Quarter-final winners (`qf_01` to `qf_04` / FIFA matches 97 to 100) map to `sf_01` and `sf_02` (`W97` to `W100`).
- **Semi-finals -> Final / Third Place**: Semifinal winners (`sf_01` and `sf_02` / FIFA matches 101 and 102) map to `final` (`W101` and `W102`). Semifinal losers map to `3rd` (`RU101` and `RU102`).
- **Final -> Champion**: The final winner is synchronized as tournament champion, and the final loser as runner-up.

A superadmin can also preview and apply the same plan explicitly in `/admin/resultados`.

Propagation updates match participants by existing match ID. It never deletes matches or predictions, and it refuses to overwrite a different already-materialized team. Knockout draws without a valid winner remain pending. The repair/sync panel previews bracket and Survivor changes with current value, proposed value, reason, and safe/blocked status before an explicit apply.

The public Team & Market Analysis defaults to active teams. `Todos` and `Eliminados` remain available. When a persisted status is missing, completed group qualification supplies a read-only fallback so group-stage eliminations are not mislabeled as pending while the database backfill is awaiting execution.

The repair action scans existing final knockout results as a backfill. A final `r32_01` result resolving `W73` therefore updates the existing `r16_01` row by ID even if the result predates automatic propagation; predictions are untouched and repeated runs are idempotent. The same operation synchronizes the losing and winning teams in Champion Survivor and writes `AdminActionLog` when persisted state changes.

Public market labels use explicit favorite, longshot, medium, concentrated, no-pick, no-odds, and out-of-race categories. Popularity rank alone never turns a one-pick team into a popular/shared pick. The default `Vivos / activos` filter excludes persisted or safely derived knockout losers, while `Todos` and `Eliminados` remain available.

The production database remains `/var/lib/la-polla-2026/prod.db` on Raspberry Pi and is never committed to GitHub.

## Fixture Display & Odds during Match Play

During active match play (until a final result is officially saved), the fixture on the public dashboard remains visible under "Jugándose ahora" (or "Esperando resultado oficial" if the estimated play window expires but no final score has been saved in the DB). 

Match odds for ongoing or awaiting matches display the last stored pre-match odds, labeled as "Cuotas pre-partido congeladas", and no live odds are fetched or implied. Odds refresh actions for these matches are completely blocked after their kickoff time.


