# Browser harness — Project Smearforn, Stage 3 (a wall that simply ends)

A CDP session against a real dev server in a real browser. Screenshots and
`evidence.json` are checked in, same as the Stage 0/1 and Stage 2 harnesses
next door.

Stage 3 is almost entirely a **drawing** change, and none of what changed
visually had ever been looked at before this script existed.

## Run it

From the repo root, in three terminals:

```
npm run dev --workspace=apps/web -- -p 3214
chrome --headless=new --remote-debugging-port=9448 --user-data-dir=<temp> about:blank
node apps/web/harness/smearforn-stage-3/run.mjs
```

Override with `SMEARFORN_APP_URL` / `SMEARFORN_CDP_PORT`.

**Use `localhost`, not `127.0.0.1`** — over `127.0.0.1` the dynamic-import
chunks never arrive and the canvas silently never appears. Same note the
Stage 0/1 harness carries.

## It can fail, and that was verified rather than assumed

- `record()` **throws** if given no expectation. A check that cannot fail is
  not a check.
- The process exits **non-zero** if any expectation is false, and an
  uncaught throw mid-run is itself recorded as a failure rather than exiting
  silently.
- **Measured both ways on 2026-09-25:** exit `0` on a clean run; exit `1`
  with a single expectation deliberately inverted.

## How the 3D assertions can be exact

The 3D view is WebGL, so there is no DOM to query, and a pixel diff cannot
tell "the truss plate is stale" from "the panels moved". But **`Export as
OBJ` builds its geometry from the same memos the scene renders**, so the
harness monkey-patches `URL.createObjectURL`, clicks the button, and reads
the blob — a precise textual model of the scene, every member as world-space
vertices. Nothing is downloaded.

⚠ **Ground-floor wall panels carry no prefix in that file**
(`${wallId}_${slotIndex}_${memberId}`); everything else does (`story2_`,
`gable_`, `roofbearing_`, `balefoundation_`). Assuming a `wall_` prefix made
every 3D check match nothing on the first pass — silently passing vacuous
checks. The baseline step now asserts it found walls at all.

## What it covers

| Step | Check |
|---|---|
| 3 | Roof is in scope (otherwise every truss-plate claim is vacuous) |
| 4 | Baseline: the wall has panels and a truss plate |
| 6 | A 60in stop shortens the run and conserves the wall **exactly, in eighths** |
| 6 | The span draws as a dashed, **unfilled** NO PANELS boundary with its own dimension |
| 7 | The panel-boundary drag still hit-tests after `yPx` moved by the conditional bottom margin — it grabs, and the run total is conserved |
| 8 | The live plan canvas gains the boundary grey; the printable Plan View sheet carries a NO PANELS dimension |
| 9 | 3D draws **nothing** across the unbuilt span, and the truss plate shrinks with the run |
| 10 | **The memo pin.** Forcing the roof-bearing memo to recompute (Roof off, Roof on) must not change the scene. If it does, the scene was stale — the exact defect the Stage 3 review caught. |
| 11 | Clearing the stop restores the elevation total, the plan, and the plate |
| 12 | A stop leaving a run under the 24in fabrication minimum is **refused**, and the wall is untouched |
| 13 | A stop that **reaches a corner the wall owns** is **accepted**, and a neighbour really does grow by a wall thickness — the orphan corner, end to end. The neighbour is measured off the 3D scene, because the elevation only shows one wall. |
| 15 | **Openings in the unbuilt span are dropped, remembered and restored** (Tommy, 2026-09-29: "Drop them, and remember"). Sweeps the stop along the wall: the "does not add back up" sentence never appears again, every accepted stop still conserves the wall to the eighth, at least one really does swallow an opening and the app says so, and clearing the stop gives the wall back panel for panel with nothing withheld. |
| — | No uncaught exception anywhere in the run |

## Two real defects this found that unit tests had not

1. **The refusal was stated against the wrong length.** It compared each
   wall's tiled total against its *unstopped* length plus the stops. The
   orphan-corner rule deliberately makes a neighbour a wall-thickness
   longer, so that form **refused every legitimate stop that reached a
   corner** — which is the main case the feature exists for. Restated
   against each wall's own tiled length under the candidate (step 13 is its
   regression pin).
2. **The refusal reported a downstream symptom.** Asking for a stop that
   left a 10in run produced "the panels do not add back up to that wall"
   (openings anchored into a budget too small for them) instead of saying
   the run was too short. The too-short band is now checked directly and up
   front.

## The third defect, found in the field rather than here — 2026-09-29

Tommy, building the Rogers-Sehorn ADU: *"whenever i stop wall over a certain
amount, for one wall this boundary was 174", it says that the panel wall
doesnt add up and will not let me edit the layout how i need to"*.

The same downstream message as (2) above, but reached from a direction the
harness was not driving: **not a run that is too short in itself, but a run
that is too short for the openings still reserved on it.** Every opening on
the wall was kept at full width no matter how much the stop removed, because
an `OpeningAnchor` carries an ordinal and not a position. His 174in is that
wall's own `Σ opening widths + Σ corner panel widths`, and below it the slots
summed to more than the wall.

Step 15 is the regression pin, and it exists because steps 6-13 could all pass
on a wall the user could not actually stop.

⚠ **What step 15 does NOT cover, and where that is covered instead.** Its wall
carries **one** opening, so ordering cannot be observed on it — and the defect a
code review found in this same work, the day it was written, was an **ordering**
defect: a start stop that dropped one of two openings could restore them in each
other's places, because a survivor's ordinal is re-derived against the shortened
run while the remembered one still carries its long-run ordinal. Measured on a
47ft wall with a window and a door, every whole-inch start stop from 0 to 532in:
**116 of 533 came back swapped.** A door where a window was, on a shop drawing,
is worse than a refusal.

That is fixed (the memory now carries the pre-stop order, not just the withheld
anchors — see `packages/geometry/src/runStopOpenings.ts`) and it is pinned in
unit tests rather than here: `retile.test.ts` drives `start stop -> clear` with
two openings of different types through the same function page.tsx calls, and
`runStopOpenings.test.ts` pins the merge itself. **Giving step 15 a second
opening would be a strict improvement and is not done here**, because the
sweep's cost is already the largest step in this file and the unit sweep covers
the same ground at every eighth rather than every inch.

**The record this file should not lose: a browser harness that drives a feature
end to end can still miss an ordering defect in it**, because it asserted the
count and the sum — the things the field report was about — and nothing about
which opening was which.

## ⚠ Step 15’s numbers are NOT reproducible run to run, and that is the app

`seedDefaultOpenings` picks each default opening’s ordinal with
`randomFn()`, and page.tsx passes `openingSeed = {}` — so it falls back to
`Math.random`. **The wall’s window lands on a different panel every run.**

So in step 15’s checked-in evidence, `basePanelCount`, which of the five swept
stops report `withheldOpenings`, whether the 0.6 stop is accepted or refused,
and the `boundaryGrey*` pixel counts all move between runs with no code change
at all. Observed directly on 2026-09-29: three runs of the same commit gave
15/16 base panels and withheld at two, three or four of the five stops.

**Every ASSERTION in the step is written to survive that** — it requires that
the sum is conserved at every accepted stop, that the old “does not add back
up” sentence never appears, that *at least one* stop swallows an opening, and
that clearing gives the wall back panel for panel. None of them names a
particular stop. **Read the numbers in `evidence.json` as one sample, not as a
fixture**, and do not “fix” a diff in them. If a deterministic fixture is ever
wanted here, the hook already exists: `OpeningSeed.randomFn`.
