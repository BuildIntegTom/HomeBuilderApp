# Browser harness — Project Smearforn, Stage 2b (the spanning "triple" header)

A CDP session against a real dev server in a real browser. Screenshots and
`evidence.json` are checked in, same as the Stage 0/1, Stage 2 and Stage 3
harnesses next door.

Stage 2b's headline claim cannot be seen from a unit test: **a header sits on
top of two or more panels, shortens them, and adds no width to the wall.**
That is three systems agreeing at once — the elevation, the named instance
list, and the 3D scene — and the only place they are all true together is a
running app.

## Run it

From the repo root, in three terminals:

```
npm run dev --workspace=apps/web -- -p 3215
chrome --headless=new --remote-debugging-port=9449 --window-size=1578,902 --user-data-dir=<temp> about:blank
node apps/web/harness/smearforn-stage-2b/run.mjs
```

Override with `SMEARFORN_APP_URL` / `SMEARFORN_CDP_PORT`.

⚠ **`--window-size=1578,902` is part of the recipe, not decoration.** That is
the size of the checked-in screenshots, and it is the size the assertions were
measured at. At the default headless window the viewer dial never reaches
**3D Framed** — the run then dies several steps later on a locator that looks
broken, with nothing pointing at the window. The Stage 0/1 README carries its
own window-size note for exactly this reason.

The app is waited for by **polling for the canvas** (up to 120s), not by a
fixed sleep. The fixed 12s this used to wait was shorter than a cold
`next dev` compile of this route, so a cold server failed at step 2 with *"no
canvas — are you on localhost rather than 127.0.0.1?"* — a message naming the
wrong cause, which is worse than a timeout.

**Use `localhost`, not `127.0.0.1`** — over `127.0.0.1` the dynamic-import
chunks never arrive and the canvas silently never appears. Same note every
harness here carries.

⚠ **Check the port is really yours.** On the first run of this script, port
3215 was already occupied by ANOTHER checkout's dev server: `next dev` failed
with `EADDRINUSE`, and this harness cheerfully drove a build with no Stage 2b
in it — drawing a footprint, measuring walls, passing its first two checks —
before dying five steps later on a missing button, with a message that looked
like a broken locator. There is now a named check for exactly that
(`the-app-under-test-actually-has-stage-2b-in-it`), so a wrong server is one
loud failure instead of a puzzle. The checked-in evidence is from **port 3231**
for that reason — 3214, 3215 and 3219 were all occupied by other checkouts
when the review-fix pass re-ran it on 2026-09-26.

## Knobs, and why each is a real fixture

- `SMEARFORN_CPU_THROTTLE=8` — slows the page by that factor. A spanning
  header commits state AND reconciles the wall's zones in one gesture, which
  is the shape of edit that hides a race on a loaded machine.
- `SMEARFORN_FOOTPRINT_PX=WxH` — draws a smaller footprint. Not just a faster
  run: a wall of few, wide panels is where the 48in–144in span limits
  actually bite.
- `SMEARFORN_SELF_TEST_INVERT=1` — inverts one expectation, to demonstrate
  that this script can fail. See below.

## It can fail, and that was measured rather than assumed

- `record()` **throws** if given no expectation. A check that cannot fail is
  not a check.
- The process exits **non-zero** if any expectation is false; an uncaught
  throw mid-run is itself recorded as a failure rather than exiting quietly.
- **Measured, 2026-09-25:** exit **`1`** with `SMEARFORN_SELF_TEST_INVERT=1`,
  which inverts the cross-reference expectation only — the run reported `13 of
  14` and `FAILURES: both-halves-of-the-cross-reference-are-on-paper`.
- ⚠ **A clean run used to have no way to exit 0, and the reason first written
  here was wrong.** This file previously said the shell had swallowed the code
  on the clean runs. It had not: the script never closed its CDP WebSocket and
  never called `process.exit(0)`, so the open socket held the event loop open —
  a passing run printed `14 of 14` and then sat there until the browser was
  killed, at which point it exited **1**. The only exit code a passing run
  could reach was non-zero. Fixed at the foot of `run.mjs` (`ws.close()` then
  `process.exit(0)`), after the failure branch, and **measured, 2026-09-26: a
  clean run exits 0.**

## How the 3D assertions can be exact

The 3D view is WebGL, so there is no DOM and a pixel diff cannot tell "the
header is drawn" from "a panel is tall". **`Export as OBJ` builds its geometry
from the same memos the scene renders**, so the harness monkey-patches
`URL.createObjectURL`, clicks the button, and reads the blob — a precise
textual model, every member as world-space vertices. Nothing is downloaded.

⚠ Two inherited traps, both of which produced **vacuous passes** rather than
failures:

1. Ground-floor wall panels carry **no prefix** in that file
   (`${wallId}_${slotIndex}_${memberId}`); everything else does (`story2_`,
   `gable_`, `roofbearing_`, `midwallbeam_`, and now `spanningheader_`).
   Assuming a `wall_` prefix once made every 3D check match nothing while
   reporting green — so the baseline step here asserts it found walls, slots
   and real widths before anything else is measured.
2. Stage 2's harness rooted three locators on drag strips, which a wall with
   no two adjacent standard panels does not have. Nothing here is keyed to an
   incidental element: panels come from the OBJ by slot index, and a header's
   controls come from their `aria-label`s, which exist because the control
   exists.

## What it found

- **A 15.5in drift in 3D, fixed.** The header was anchored on `wallAxis` plus
  a slot offset — but a slot offset is measured from the panel RUN's origin
  while the axis starts at the wall's true corner, and on a wall that butts a
  longer neighbour the run begins a wall-thickness in. The header floated off
  the panels carrying it. It is now anchored on the first panel it spans, so
  it inherits the corner inset and the run stops for free. (The Mid-Wall Bond
  Beam loop next door has the same drift; that is pre-existing and left
  alone, the same call Stage 3 made about the roof-bearing anchor.)
- **A header's own cut width changing with nothing said.** Deleting a panel to
  the LEFT of the header moved its range correctly (2..4 → 1..3, the same two
  panels) while its fabricated width went **80" → 85¾"**, because the free
  run re-tiled flat and the panels beneath were now different widths. The app
  said only *"Deleted a panel on wall AB: 15 panels → 14, 12 still automatic."*
  A part already on a shop sheet, quietly re-cut. Fixed 2026-09-26: the commit
  notice names the header and both widths, and flags a width that has landed
  outside the range a placement would refuse. Step 8's expectation now covers
  it. ⚠ **THE SECOND NUMBER IS NOT REPRODUCIBLE — read it off `evidence.json`,
  never from a narrative.** Three runs of this script on the same checkout, the
  same window size and the same 549in wall (4392 eighths every time) produced
  **82⅜"**, **84¾"** and **85¾"**: the footprint is drawn in PIXELS, so the
  baseline free-run tiling lands slightly differently
  (`[…, 40, 40, 34.125, 34.125, 0.75, 40]` one run,
  `[…, 40, 37.125, 37, 34.125, 0.75, 40]` the next), and the redistribution
  after the delete follows it. What the step actually asserts is the invariant
  — the range moved by one AND, if the width moved, the notice named it — not
  any particular pair of numbers. A round of narrative copies previously quoted
  85.75in while the committed evidence said 84¾"; the fix is not a better
  number, it is not quoting one from memory.
- **A field ordering trap in this script.** Committing the far end of the
  range first turned a two-panel span into a four-panel one — 160in on a wall
  of 40in panels, over the 144in maximum — so it was refused and the move
  silently did not happen, and the script then measured the header it had
  failed to move. `moveHeaderTo` now steps one index at a time, alternating
  ends, so every intermediate state is legal.
- **A detail key that ate a step name.** `record()` spreads a step's detail
  into the step, so a detail called `name` overwrote the step's own name —
  the first artefact had two steps both called "H1". Found by reading
  `evidence.json` rather than the console.

## What it covers

| Step | Check |
|---|---|
| 3 | Baseline: the OBJ reader really found walls, slots and widths (otherwise every 3D claim is vacuous) |
| 4 | The build under test actually contains Stage 2b |
| 5 | The span is **exactly** the two panels beneath it (measured off the 3D model) and the wall's own total does not move by an eighth |
| 5 | The name is `H1` — no direction letter — and the wall is stated in words beside it |
| 6 | A header on a **different wall** is `H2`: one building-wide series, not a per-wall counter |
| 7 | A one-panel span is refused, in words, and changes nothing |
| 7 | A span past 12ft is refused with the number quoted and the range named as unconfirmed — **not** widened to fit the drawing |
| 8 | Deleting a panel to the left moves the header's range so it still covers the same panels (Stage 2's `shiftSlotCoverage`) — **and if that re-tile changed the header's own cut width, the notice says so, with both numbers** |
| 9 | A wall-run stop that would re-cut the header is refused **by name** (Stage 3) |
| 10 | 3D: the header exists as real geometry, spanning the same run as the panels beneath, aligned to within an eighth |
| 10 | Those panels stop exactly at the header's bottom face while their uncovered neighbour does not |
| 11 | Both halves of the cross-reference are on paper: the header's sheet states its wall in words; a panel's sheet names the header above it |
| 11 | No uncaught exception in the page across the whole run |
