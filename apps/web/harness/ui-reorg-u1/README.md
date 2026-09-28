# Browser harness — Top Bar & Navigation Reorganisation, stage U1

Two things, in one script: it **measures whether Tommy's twelve-item top bar
fits**, and it asserts the **Design/View split** behaves. Same plumbing and
the same `record()` discipline as `../ui-reorg-u0` and the three
`../smearforn-stage-*` harnesses — every step carries an expectation,
`record()` throws without one, and the process exits non-zero if any
expectation is false.

**The measurement is the deliverable, not a check on it.** The plan's own
riskiest assumption was that the width budget is already spent: the bar needed
a third breakpoint to fit six controls, Tommy's list is twelve, his everyday
viewport is 710px, and the plan's estimate for the new group (~1550–1600px)
was explicitly marked *unmeasured*. The answer lives in `evidence-projection.json`,
checked in, rather than in a commit message.

## Run it

```
npm run dev --workspace=apps/web -- -p 3218
chrome --headless=new --remote-debugging-port=9458 --user-data-dir=<a temp dir> --window-size=1600,1000 about:blank
node apps/web/harness/ui-reorg-u1/run.mjs
```

Override with `UI_REORG_U1_APP_URL` / `UI_REORG_U1_CDP_PORT`.

**Use `localhost`, not `127.0.0.1`.** Over `127.0.0.1` the client chunks for
the `next/dynamic` canvas never arrive and the page renders its chrome with no
canvas at all, silently — the Stage 0/1 harness's README explains it at length.

**Prove it can fail:** `UI_REORG_U1_PROVE_FAILURE=1 node apps/web/harness/ui-reorg-u1/run.mjs`
appends one deliberately false check; the run must then exit 1. A harness
nobody has watched fail is not evidence.

## The two passes, and why one of them is not re-runnable

| | `UI_REORG_U1_PASS=projection` | (default) `built` |
|---|---|---|
| Runs against | the bar **before** Design/View exist | the finished bar |
| Design & View | projected: built from the bar's own real classes, inserted into the real row, measured, removed | real |
| Summary & Print | projected | projected — they are U4 and U5, and a control that opens nothing is forbidden |
| Writes | `evidence-projection.json`, `region3-baseline.json` | `evidence.json` |

**The projection pass refuses to run against the built code, and its artefacts
must not be regenerated.** They are a recording of a bar that no longer
exists. Once Design and View are real they are `display: none` below 1200px —
they have *shed* into the sidebar dial, which is the right answer — so a
projection there would skip them and then measure a row missing two of the
controls it claims to have measured. The checked-in files are from commit
`6ccdfff`, and they are the only "before" this stage has.

## What the measurement said

Natural row-content width, four companies, the widest role label:

| bar | row content | ≈ viewport |
|---|---|---|
| today, 6 controls | 1176.9px | ~1217px |
| + Design + View (what U1 ships) | 1415.2px projected / 1448.2px as built | ~1455 / ~1488px |
| + Summary + Print (Tommy's twelve) | 1577.5px | **~1618px** |

**Twelve fit at no width in the brief.** Forced onto the row anyway, at 360px
`Print` is pushed off screen and the acting-as chip is crushed to 12px; at 768
and 1200 the chip is 20px. The acting-as company keeps the width its own
stylesheet caps it to only from **1503px** up (twelve) and **1341px** up (U1's
ten) in the ≥1200 band.

That is a finding, not an obstacle that was engineered around. Nothing here
shrinks type, drops a label or adds an overflow menu to make an assertion
pass — those are design decisions and they are Tommy's, the same way 1200px
was in 2026-09-13.

## Two things worth knowing before trusting a number here

**Four companies are SIMULATED, and every cell says so.** Signing in needs
Supabase and nothing in this workstream may touch it, so the signed-out
acting-as span is swapped for a real `<select>` carrying `switcherLabels`'
real output for four real entitlements, built with the app's own hashed
`.actingAsSelect` class read out of the live stylesheet. **It is validated
before any width is judged by it**: the longest real label must render within
12px of the 270px a real browser produced for it on 2026-09-13. If the class
lookup ever fails the select renders unstyled and every "four companies"
figure would be a measurement of nothing — so that fails here rather than
downstream.

**Fit is not monotonic in width, and the first bisection assumed it was.** At
exactly 1200px the bar gains the wordmark and four nav tabs, ~380px arriving
in one step, so a configuration can fit at 1199 and fail at 1200. The naive
bisect reported "fits from 875px" for a bar that is crushed at 1200 — a true
number meaning the opposite of what it looks like. Bisected per breakpoint
band now (`<768`, `768–1199`, `≥1200`), each of which is monotonic on its own.

## The single-writer test, in two halves

`viewMode`, `simplified3D`, `showWraps` and `elevationViewWallId` are four
flags encoding five stops, and sidebar Region 3 keys off exactly those. So
Region 3 rendering identically is the direct test that
`handleViewerStopChange` stayed the only writer.

- **Across the change** — the eight stops' Region 3 signatures, recorded off
  the **dial** before U1 (`region3-baseline.json`) and re-derived off the
  **menus** after. Compared on `shape`, digits normalised, because two runs
  draw two slightly different buildings by a pixel of mouse drag and
  `8,147 lb` vs `8,103 lb` is a true reading of that rather than a leaked
  flag. *The first version of this failed for exactly that reason, and the
  test was what was wrong.*
- **Within one run** — the dial at 1199px vs the menus at 1200px, one design,
  compared byte for byte including digits.

Neither is enough alone: the second would pass if `handleViewerStopChange`
itself were broken, since both presentations call it; the first catches that
but has to normalise away the fine detail the second keeps.

## Locators

Nothing here is keyed to an incidental element. Controls by
`data-bar-control`, the menus by `data-view-menu` / `-owner` / `-caption` /
`-value` / `-word`, stops by `data-view-stop`, Region 3 by
`data-sidebar-region-3`. CSS-module class names are hashed build artefacts and
are never written down: they are found by the **stem** the source file uses,
preferentially by taking the hashed prefix off an element really in the DOM.

The bare word is read from its own `data-view-menu-word` span rather than off
`textContent`, which also carries the caret — a reader comparing `textContent`
to `"View"` fails on `"View ▼"` and reads exactly like a rename that never
happened.
