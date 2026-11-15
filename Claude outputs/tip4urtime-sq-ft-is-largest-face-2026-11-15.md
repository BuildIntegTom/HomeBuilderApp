# For the Tip4urTime coder: `Sq ft` is no longer width × height

**One sentence to pass on. Nothing about the file's FORMAT has changed — same
columns, same order, same headers. One column's MEANING has.**

---

## What changed

`Sq ft` is now **the piece's largest face**, not `Width × Height / 144`.

For a straw panel those are the same number, as they always were. For a **shop
item** — a safety gap, a box beam, a truss plate, a spanning header — they are
not, because those pieces are thin in elevation and wide through the wall.

Two real rows from an export of the 16 × 24 ft Tiny House:

```
P-0011,Gable Safety Gap,E13,0.75,37.76,4.06,0
P-0051,Truss Plate,Wall AB (N),288,2.25,31,0
```

- The safety gap is 3/4in wide and 37.76in tall. `0.75 × 37.76 / 144 = 0.20`.
  Its `Sq ft` says **4.06**, because the piece is a 15.5in-deep sheet of
  plywood: `15.5 × 37.76 / 144`.
- The truss plate is 288in long and 2.25in tall in elevation. Its `Sq ft` says
  **31**, which is `288 × 15.5 / 144`.

So **the three numbers on those rows do not multiply out, and are not meant
to.** The missing factor is the depth through the wall, and it is deliberately
**not** a column — the format was not changed.

## Why

Tommy, 2026-11-15:

> *"Square feet should be the piece's largest face ... for that same gap, the
> sheet: 15.5in × 120in = 12.9 sq ft."*

It is about what a crew is credited for. Someone claiming a safety gap handles
a full sheet of plywood, not a 3/4in sliver, and the old number paid them for
the sliver.

## What to do on your side

**Nothing, if you are reading `Sq ft` straight out of the file.** That is the
intended path and it is now correct.

⚠ **Something, if you recompute it.** If the import derives square footage from
`Width (in) × Height (in)` — as a validation check, a fallback for a blank
cell, or because it seemed redundant — that derivation is now wrong for every
shop item and will under-credit crews on exactly the pieces this change was
meant to fix. **Read the column.**

`Counts as panel` is unchanged and still 0 for every one of these rows: a crew
is credited the square footage and shows the work as claimed, it just does not
advance their panel count.

## Still true

- No prices in this file. Panel data only — no client, no address, no cost.
  That is enforced by the export function's input type, and it is what will let
  the same file be served from a sync link later.
- The sync link still does not exist. Upload remains the path; see
  `tip4urtime-sync-link-status-2026-11-15.md`.
