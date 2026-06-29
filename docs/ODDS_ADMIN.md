# Odds administration

## Match odds bulk refresh

`/admin/odds` exposes explicit superadmin actions for match-winner odds:

- **Future matches without odds** selects future, non-final matches that do not have a global `OddsSnapshot` for `marketType = match_winner`.
- **All future matches** refreshes future, non-final matches whether or not a snapshot already exists.
- The UI also offers bounded variants for the next 10 matches and the next 7 days.

The bulk action reuses the same provider lookup and `saveOddsSnapshot` path as single-match refresh. It reports eligible, processed, updated, skipped, and failed matches, plus the provider used and safe per-match errors. Provider cooldowns are checked between requests; when every configured provider is cooling down, processing stops without continuing to consume quota.

No provider call runs during public page load. API keys and raw provider errors are never returned to the browser. Simulated odds remain controlled by the existing development-only flag; this feature does not enable that flag.

## Market separation

Match odds are stored in `OddsSnapshot` with `marketType = match_winner`. Champion outright odds are stored separately in `ChampionOddsSnapshot` with `sourceMarket = outright_winner`. Neither source can substitute for the other.

## Public labels

The public Team & Market Analysis defaults to **Vivos / activos** and keeps **Todos** and **Eliminados** filters. Pick labels distinguish favorite, longshot, medium-market, concentrated, no-pick, missing-odds, and eliminated cases using actual pick counts. **Pick sin cuota** means a selected team has no champion outright price. EV values are estimates, not guaranteed payouts.
