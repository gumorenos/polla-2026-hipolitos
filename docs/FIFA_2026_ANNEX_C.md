# FIFA World Cup 2026 Annex C

Annex C assigns the eight best third-placed teams to the eight Round-of-32 group-winner slots. Relative third-place ranking determines which eight groups qualify, but it does not determine their opponents. The opponent mapping comes from the fixed Annex C row for that exact group combination.

## Source and verification

The static table in `app/src/lib/fifa-2026-annex-c.ts` contains all 495 combinations (`12 choose 8`). Its primary source is the [FIFA World Cup 26 Regulations, May 2026, Annexe C](https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf), options 1-495.

The group keys were transcribed from the complete secondary table on the [2026 FIFA World Cup knockout-stage reference page](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage#Combinations_of_matches_in_the_round_of_32). Every option's eight slot assignments were then compared mechanically with the official PDF: 495 rows matched and no differences were found.

Integrity checks verify:

- exactly 495 canonical keys;
- every possible eight-group combination from A-L;
- the eight expected winner slots;
- valid `3A`-`3L` assignments;
- no duplicate or out-of-key assignments.

## Resolver workflow

1. Confirm all 72 group matches have consistent final results.
2. Calculate the eight qualifying third-place groups.
3. Canonicalize the groups, for example `BDEFIJKL`.
4. Look up the Annex C allocation and resolve each slot by Round-of-32 match ID.
5. Preview current and proposed team codes in `/admin/resultados`.
6. Apply explicitly as superadmin.
7. Verify Round-of-32 matches and then sync Champion Survivor statuses.

For `BDEFIJKL`, option 67 assigns `3E, 3J, 3B, 3D, 3I, 3F, 3L, 3K` to `1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L` respectively.

The table is bundled with the application. Resolution performs no runtime web request and has no external website dependency.
