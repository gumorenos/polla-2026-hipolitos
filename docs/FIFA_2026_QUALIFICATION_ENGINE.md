# FIFA 2026 qualification engine

This document describes the current qualification engine for the FIFA World Cup 2026 group stage.

## Implemented scope

The engine is implemented as pure TypeScript logic in:

```text
app/src/lib/fifa-qualification.ts
```

It calculates:

- group standings
- top two teams per group
- third-placed team ranking
- the eight best third-placed teams
- group-stage eliminated teams
- conservative `TeamTournamentStatus` suggestions for Champion Survivor

The official 2026 format used by this phase is:

- 48 teams
- 12 groups of 4
- top two teams from each group advance to the Round of 32
- the eight best third-placed teams also advance to the Round of 32

## Data requirements

The engine uses existing stored match data:

- `Match.phase`
- `Match.group`
- `Match.homeTeamCode`
- `Match.awayTeamCode`
- `Match.homeScore`
- `Match.awayScore`
- `Match.status`
- `Match.resultStatus`

Only group-stage matches with final/result scores are counted as played.

The engine also accepts optional team metadata:

- team name
- fair play score
- FIFA ranking

The current Prisma `Team` model does not store fair play score or FIFA ranking, so those criteria are treated as unavailable unless a caller supplies them later.

## Group tiebreakers

Within each group, this phase applies the requested FIFA-style criteria in this order:

1. points
2. head-to-head points among tied teams
3. head-to-head goal difference among tied teams
4. head-to-head goals scored among tied teams
5. overall goal difference
6. overall goals scored
7. team conduct / fair play score, if available
8. FIFA ranking, if available

If fair play score or FIFA ranking is required but unavailable, the engine does not invent a result. It marks the affected teams with:

```text
Desempate pendiente por criterio FIFA no disponible.
```

## Third-place ranking

Third-placed teams are ranked by:

1. points
2. goal difference
3. goals scored
4. team conduct / fair play score, if available
5. FIFA ranking, if available

When all groups are complete, the top eight third-placed teams are marked as qualified. If the cutoff between eighth and ninth is unresolved, those boundary statuses remain pending.

## Current standings vs clinched qualification

Before all group matches are complete, the engine shows live/current standings but keeps statuses as `pending`.

This phase does not implement full mathematical clinch scenarios. For example, it does not prove that a team has already qualified before all matches in its group or all third-place comparisons are complete.

## Champion Survivor integration

The engine produces conservative suggestions:

- qualified teams -> `active`
- eliminated teams -> `eliminated`
- unresolved or incomplete statuses -> `pending`

These are suggestions only. The admin override in `TeamTournamentStatus` remains the source of truth for Champion Survivor until an admin applies a status manually.

This phase does not auto-eliminate teams and does not write automatic status updates.

## UI

Current read-only UI surfaces:

- `/admin/resultados`: group tables, third-place table, unresolved tiebreaker indicators
- `/admin/supervivencia`: per-team FIFA suggestion beside the current manual Champion Survivor status

## Explicit non-goals

- Match odds are not qualification rules and are not used here.
- Champion outright odds are not qualification rules and are not used here.
- No external API fetch is triggered by this engine.
- No automatic post-match refresh scheduling is implemented.
- No public guest route work is implemented in this phase.
- No simulation changes are implemented in this phase.
- No database schema change or migration is required for this phase.

## Future improvements

- Store official fair play score when a reliable source is available.
- Store or import FIFA ranking if the product decides to use it for unresolved ties.
- Add full mathematical clinch detection before all group matches finish.
- Add audit-backed automatic `TeamTournamentStatus` updates only after the admin workflow for reviewing suggestions is proven safe.
