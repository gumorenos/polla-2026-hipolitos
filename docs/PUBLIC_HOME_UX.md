# Public home UX

`/` and `/invitado` render the same read-only dashboard, so guests and authenticated users receive the same public competition layout.

## Champion Survivor order

The dashboard uses three screens:

1. **Supervivencia**: participant picks, Team & Market Analysis, then a compact survival summary.
2. **Fixture**: upcoming matches first and recent results second.
3. **Grupos FIFA**: final group-stage reference tables.

The public picks table intentionally omits submission timestamps. Team market filters are keyboard-accessible buttons, default to `Vivos / activos`, and keep eliminated teams available through `Todos` and `Eliminados`.

## Visual preferences

The appearance control is available without authentication and never writes to the database.

- Schemes: `default`, `light`, `dark`, `black`.
- Palettes: `gold`, `midnight`, `pitch`, `worldcup`, `premium`.
- Cookies: `polla_theme_scheme` and `polla_theme_palette`.
- Lifetime: one year, `SameSite=Lax`, path `/`.

The server validates cookie values before rendering the `<html>` data attributes. Missing or invalid values fall back to `default/gold`, which reproduces the previous design. The legacy `themeMode` cookie remains a fallback for existing profile preferences.

## In-Progress Fixture & Frozen Odds

To prevent matches from disappearing from the homepage during active play, the fixture section has been expanded:

1. **Jugándose ahora**: Shows matches that have kicked off but have no final score, within their estimated play window (135 min for groups, 210 min for knockouts/3rd place). Labelled clearly as "Partido en proceso".
2. **Esperando resultado oficial**: If the play window expires but no final score is stored in the database, the match remains visible in a separate block and is labelled "Esperando resultado oficial" until the admin enters the final score.
3. **Próximos partidos**: Matches before kickoff time (`now < kickoffUtc`).
4. **Resultados recientes**: Only matches with a final result.

### Odds Frozen Behavior
During active play (`in_progress`) and official result waiting states (`awaiting_result`), the public page displays the stored pre-match odds in the database with a clear label: **"Cuotas pre-partido congeladas"** to prevent live odds implication. No external API calls are made from the client during these states, and odds are hidden for finished (final) matches.


