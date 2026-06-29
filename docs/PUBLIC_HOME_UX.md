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
