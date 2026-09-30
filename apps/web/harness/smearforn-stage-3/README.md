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
| 15 | **Openings in the unbuilt span are dropped, remembered and restored** (Tommy, 2026-09-29: "Drop them, and remember"). The step **places its own opening** with the Stage 2 Window tool at a known boundary near the start end, and asserts the insert — relying on the random default seed instead made this step about a 1-in-5 flake on green code (see its own comment, and the third review of 2026-09-29). Then it sweeps the stop along the wall: the "does not add back up" sentence never appears again, every accepted stop still conserves the wall to the eighth, at least one really does swallow an opening and the app says so, and clearing the stop gives the wall back panel for panel with nothing withheld. |
| 16 | **A brand-new footprint does not inherit the old building's remembered openings.** Stops the wall until it really is holding one, draws a different rectangle over the top, and re-tiles the reused wall id once: the opening count on that wall must not move, and nothing may be withheld on the new building. |
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

## Why step 16 is here and not in a unit test

`handleDraw`'s memory reset — `setUnbuiltOpeningsByStoryAndWallId({ ground: {}, second: {} })`,
the third review's must-fix 1 — **had no test that could fail if it were deleted.**
The regression test it shipped with, `retile.test.ts`'s *"a leftover memory puts a
window on a wall nobody drew one on"*, is a **geometry** test: it never touches
`page.tsx`, so it passes identically with and without the line. That was stated
honestly at the time ("pinned at the level where it is provable"), and it still
left the fix unguarded.

Nothing below `handleDraw` can guard `handleDraw`. Every other path that
replaces the building — file load, cloud open — goes through
`applyProjectState`, and there is no undo and no separate New Project handler,
so the draw gesture was the one gap. Step 16 drives that gesture in the browser,
which is the only shape that can catch a regression here.

**And it was measured both ways, not assumed** (2026-09-30, the same standard
the rest of this file holds itself to):

- with the line in `handleDraw`: `openingSlotsAfterRedraw: 1`,
  `openingSlotsAfterRetile: 1`, exit `0`;
- with the line commented out and nothing else changed:
  `openingSlotsAfterRedraw: 1`, `openingSlotsAfterRetile: **3**` — both
  openings the old building was withholding came back onto a wall of the new
  one — step 16 `[FAIL]`, exit `1`.

Two other things that run taught, both now built into the step:

1. **The re-tile has to be an ACCEPTED stop.** A refused one changes nothing, so
   an unchecked stop would make the whole step pass for free. The step records
   every attempt with its refusal sentence and asserts one was taken.
2. **The stop does not have to be on the wall being checked, and it is better
   that it is not.** On the first redrawn footprint every start stop was refused
   with *"does not leave a run on wall BC whose panels add back up to that
   wall"* — the known pre-existing braced-combine residual on the NEIGHBOUR
   wall, nothing to do with this step.
   `retilePreservingOpeningsWithRunStopMemory` walks every wall on every call,
   so a stop accepted anywhere in the building re-tiles the reused wall id too;
   the step now walks the elevations until the app accepts one.

## ⚠ What step 15 stopped covering when it switched to REPLACE — and nothing else covers it

Step 15 places its opening by **replacing** a standard panel of the project's
own standard width, deliberately, so the panel count going into the stop is the
count coming out and expectation 4 ("panel for panel") means what it says. That
choice was right and it has a cost worth naming: **the harness no longer drives
the INSERT shape at all.**

The insert is where the hand-edit defect lives — a hand-placed panel is born at
the project's standard width, takes that width out of the automatic panels, and
a stop does not preserve it, so the wall comes back from a stop with one panel
FEWER than it went in with (measured on this very step before the switch: 17 in,
16 out, length still exact to the eighth and both openings restored). **That
defect is now described in two code comments and asserted nowhere.** It is not a
regression this file can catch if it widens, and it is Tommy's call whether a
stop should refuse on a hand-edited wall rather than silently revert it — see
the spec's Stage 3 second-pass section.

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

## ⚠ Two readers of the same wall, and only one of them is cropped — 2026-09-30

`panelWidths()` reads **every** pointer group in the document.
`panelBodies()` reads only the ones whose box is inside the window, because
every coordinate it returns is fed to a real mouse event and a click at an
off-screen coordinate hits nothing. **They agree only while the whole wall is
on screen**, and since the 2026-09-29 fit-height/scroll-width change a long
wall is not: measured on this fixture, `scrollWidth` 2904 against
`clientWidth` 1168.

Step 15 compared the two across that gap — `basePanelCount` (from
`panelWidths`) against `panelCountBeforePlacement` (from `panelBodies`) — and
failed **15 === 6** on a wall that had not lost a panel. The app was right and
said so on the same run: *"Replaced on wall AB: 15 panels → 15, 10 still
automatic."* Every other clause of that step passed, including conservation in
eighths and all four restore checks.

The count now comes off `panelWidths`. `panelBodies` is still what picks the
panel to click, which genuinely needs a hit-testable body; the run also
records `clickTargetsOnScreen` so the gap between the two is visible in the
artefact rather than inferred.

**`fitWholeWall()` does not fix this for the later steps.** It is called once,
before step 7. Steps 9–16 change the view repeatedly — gable, 3D, live plan,
plan sheet, a redrawn footprint — and each of those resets the fit, so a step
past that point which needs the whole wall on screen has to call it again
itself.

## ⚠ The notice reader could return a STALE sentence — 2026-09-30

`placementNotice()` used to scan every `<p>` in the document for
`/^(Inserted|Replaced|Deleted|Refused|Corner and safety-gap|That panel is
already)/`. That misses *"There is nowhere on this wall to put a panel
there."* — a real refusal in `apps/web/app/placementNotice.ts` — and because
the app's notice is one paragraph that lingers for 8s and is replaced in
place, a gesture refused with a sentence the regex could not match read back
as **the previous step's notice**, not as nothing.

It is now located structurally (the one optional `<p>` after the tool's help
text in the "Place a panel" section), so it returns whatever the app wrote and
**throws** if that section is missing or has a shape it does not recognise. The
run also clears the line before the gesture and records
`noticeBeforePlacement: null` in the evidence, so the sentence it asserts is
provably that click's own.
