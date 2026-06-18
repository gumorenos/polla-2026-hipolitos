# Champion Survivor Simulation

This document describes the simulation approaches for Champion Survivor. The current implementation is intentionally lightweight and uses only champion outright market data already stored in the application.

## Implemented Now: Outright Odds Simulation

Status: Implemented.

The current method uses `ChampionOddsSnapshot` rows where `sourceMarket = "outright_winner"`.

Process:

1. Read the latest champion outright odds per team.
2. Exclude teams marked as eliminated in `TeamTournamentStatus`.
3. If a team is marked as champion, return a resolved deterministic result.
4. Convert decimal odds into raw implied probability:

```text
impliedProbability = 1 / decimalOdds
```

5. Normalize the probabilities across teams still eligible in the simulation:

```text
normalizedProbability = impliedProbability / sum(impliedProbability of included teams)
```

6. Run a lightweight Monte Carlo simulation with the normalized probabilities. The default iteration count is `10000`.

The output exposes:

- Team code
- Decimal odds
- Raw implied probability
- Normalized market probability
- Simulated wins
- Simulated probability
- Tournament status
- Provider, bookmaker, and capture timestamp

Important boundaries:

- It does not use match odds.
- It does not use `OddsSnapshot`.
- It does not fetch external odds.
- It does not create background jobs.
- It does not persist simulation snapshots.
- It does not replace `WinnerPrediction`.
- It does not use match prediction points.

If no champion outright odds exist, the simulation is unavailable and shows:

```text
Simulación no disponible porque no hay cuotas de campeón cargadas.
```

## Future: Match-by-Match Tournament Simulation

Status: Not implemented yet.

This approach would simulate the tournament from scheduled matches instead of champion outright odds.

Concept:

- Use match odds for scheduled matches.
- Simulate group stage points.
- Apply group tiebreakers.
- Generate knockout bracket paths.
- Simulate knockout outcomes.

Open complexity:

- Placeholder teams in knockout fixtures.
- Draw handling during group stage.
- Extra time and penalties during knockout matches.
- Missing odds for some matches.
- Tiebreaker fidelity versus FIFA rules.
- Performance and caching once simulations become heavier.

## Future: Hybrid Simulation

Status: Not implemented yet.

This approach would combine several signals:

- Champion outright odds.
- Match odds.
- Expected tournament path.
- H2H and recent form signals.
- Optional Elo or internal model scores.

The UI should label bookmaker market probabilities separately from model estimates. A possible comparison layout:

- Mercado campeón
- Simulación por partido
- Simulación híbrida

The hybrid method must not present model estimates as bookmaker probabilities.

## Future Comparison UI

Status: Not implemented yet.

Future Champion Survivor screens may compare methods side by side:

```text
Comparar métodos:
- Cuotas campeón
- Partido por partido
- Híbrido
```

This should help admins and participants understand how much each method changes the perceived risk of a champion pick.
