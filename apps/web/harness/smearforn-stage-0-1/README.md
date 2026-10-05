# Browser harness — Project Smearforn, Stages 0 and 1

This drives the **real app in a real browser** and writes down what it saw. It
exists because unit tests cannot show that a field refuses an entry, keeps the
text you typed, and says why.

**It lives in the repo on purpose.** The Stage 4B and 4C harnesses sat in a
scratch directory outside it, so a reviewer could not read them and their
results had to be taken as a report rather than as evidence. Here the script,
its screenshots and its measurements are all checked in, and anyone can re-run
it.

## Running it

From the repo root, in two terminals:

```
npm run dev --workspace=apps/web -- -p 3210
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --remote-debugging-port=9444 --user-data-dir=<some temp dir> --window-size=1600,1000 about:blank
node apps/web/harness/smearforn-stage-0-1/run.mjs
```

Overridable with `SMEARFORN_APP_URL` and `SMEARFORN_CDP_PORT`.

## ⚠ A one-off seen 2026-10-05: `drag-lands-where-the-cursor-let-go-at-two-zooms`

Recorded so the next person does not chase it from zero. It failed **once**,
with `{"zoom":"zoomed 195%","reached":false}` and `theZoomsReallyDiffered:
false` — the elevation view's three "Zoom in" clicks did not take, so both
landings were measured at the same zoom and the second found no handle. The
check is working correctly when it reports this: that `theZoomsReallyDiffered`
guard exists precisely so "the same answer at two zooms" cannot pass when the
two zooms were one zoom.

**It did not reproduce in six controlled runs** — three on the committed
baseline and three with the 2026-10-05 zoom fix in place, same Chrome, all
six `ok` with `theZoomsReallyDiffered: true`. It was A/B'd that way because
the zoom fix touched `FootprintCanvas` and the suspicion had to be ruled out;
it is **not** caused by that change, and the elevation view's controls
("Reset the view", "Zoom in") are a different component from
`FootprintCanvas`'s ("Reset pan and zoom to the default view").

What it correlates with, unproven: it appeared only on re-runs **after five
other harnesses had driven the same Chrome instance**, never on the first run
in a fresh one. If it returns, suspect accumulated browser state and try
`SMEARFORN_CPU_THROTTLE` above before suspecting the app.

⚠ Seen in the same batch and unrelated: a run died writing
`screenshots/09d-ctrl-wheel-zoomed.png` with `errno -4094 UNKNOWN` — a
Windows file-lock on the screenshot, not a page fault. Re-running cleared it.

## `SMEARFORN_CPU_THROTTLE` — how to reproduce a "flaky" step on purpose

`SMEARFORN_CPU_THROTTLE=12` slows the page down by that factor (CDP's
`Emulation.setCPUThrottlingRate`). Unset, it is a no-op.

It was added because the wall-walk step failed **about one run in three on two
reviewers' machines and zero runs in five here**, including with the whole
vitest suite running alongside — and a timing fix you cannot demonstrate is a
guess. With `=12` the failure became deterministic, and the first thing it
proved was that **the retry budget was not the cause at all**: the step missed
a wall with a 4-attempt budget and missed it identically with a 20-attempt
one, having used exactly **1** attempt on every wall it did read.

The real cause was a brittle reader. `allElevationWidths` used to locate the
elevation via `svg rect[style*="ew-resize"]` — the panel-boundary drag strips
— and **a drag strip only exists between two ADJACENT standard/braced slots**,
so a wall whose middle is a single panel between two corners has none, and the
read returned nothing however long it waited. It looked like a timing flake
only because drawing the footprint is itself timing-sensitive: on a slow
machine the drag lands differently, so *which* wall comes out short varies
from run to run, and on a fast machine often none does. The reader now reads
the width labels directly.

`readAttemptsPerWall` and `readAttemptBudget` are in the evidence so the
margin is visible rather than trusted; `SMEARFORN_WALL_READ_BUDGET` and
`SMEARFORN_WALL_READ_PAUSE_MS` override them, which is what made the "is it
the budget?" question answerable in one run instead of an afternoon.

**Runs behind the fix:** 6 throttled runs at 12x/20x that reached the step
(4 of 4 walls every time), plus 2 unthrottled, plus the two pre-fix runs that
failed 3 of 4 on demand. The 20x run that died in setup before step 1 is
fixed too: the 9s post-navigate sleep is now scaled by the throttle, which is
what that failure actually was.

## `SMEARFORN_FOOTPRINT_PX` — the strip-less-wall fixture

`SMEARFORN_FOOTPRINT_PX=70x300` draws a narrow, long footprint instead of
filling the canvas. **This is the fixture the reader audit is proven on.**
Measured on this app:

| wall | drag strips | old reader | new reader |
|---|---|---|---|
| AB | **0** | **0** | **1** (a 45in panel) |
| BC | 2 | 5 | 5 |
| CD | **0** | **0** | **1** |
| DA | 2 | 5 | 5 |

A wall whose middle is a single standard panel between two corners has no two
ADJACENT standard panels, so it has no drag strip — and **three** readers in
this file used to root on one: the wall walk's, the panel-label reader that
drives steps 4-8, and the "have we reached an elevation?" check. They masked
each other: the readiness check never let the run settle on a strip-less
wall, so the label reader never met one. All three are fixed together.

On this fixture the run settles on BC, steps 4-8 pass there, and **step 10
reads 4 of 4 walls including the two the old reader returned nothing for** —
which is the whole fix in one run.

⚠ Two things about it, both measured rather than assumed: the height is
bounded by the **canvas** (720x480 at a 1600x1000 window), so `70x400` draws
nothing at all and looks like a dial failure; and **step 9 is expected to
fail** on this fixture, because its drag moves a fixed 4.31px that is "a
couple of inches" only at the default footprint's zoom. Expected result:
**steps 1-8 and 10 pass, step 9's two checks fail.**

## It asserts. It did not always.

**Read this before adding a step.** The first version of this script ended in
an unconditional `process.exit(0)`, and every measurement it took was just
written into `evidence.json`. A refused ADU width, or
`nothingBelowTheMinimum: false`, would have exited **green**, with the failure
sitting in a file waiting for a human to notice it. A reviewer named that as
the same shape as the `.value` bug — a check that cannot fail — and asked for
it fixed before any more harness code was written.

So now:

- `record(name, detail, expected)` takes an **expectation**, and the process
  **exits 1** if any of them is false, naming every one that failed.
- `record()` **throws if you give it no expectation.** A step that genuinely
  only observes must say so out loud, with a reason:
  `observationOnly("why this one cannot fail")`. The reason is written into
  `evidence.json`, so an unasserted step is a decision a reviewer can argue
  with rather than an omission they have to spot.
- A predicate that **throws** counts as a failure, never a pass.
- `evidence.json` is written on the way out **whatever happened**, including
  when a step dies part-way. A run that died at step 6 is still evidence about
  steps 1–5.

Verified both directions on 2026-09-24: 12 of 12 checks pass against the real
app, and raising the script's own `FABRICATION_MIN_IN` to 41 to simulate a
regression turned 5 of them red with exit code 1.

> **Use `localhost`, not `127.0.0.1`.** Next 16's dev server serves the HTML
> over either, but over `127.0.0.1` the client chunks for a `next/dynamic`
> component never arrive: the page renders its chrome and the Konva canvas
> never appears, leaving the suspense boundary in its errored state
> (`<!--$!-->`) with **no console exception at all**. Written down because it
> looks exactly like a broken build.

## What it proves, and where

`evidence.json` holds the measurements from the last run; `screenshots/` holds
the images. Both are regenerated on every run.

| Step | Screenshot | What it shows |
|---|---|---|
| Stage 0 default | `00-stage0-new-project-wall-only.png` | a brand-new project offers the **Wall tab only** — Foundation now defaults off |
| draw | `01-footprint-drawn.png`, `02-wall-elevation.png` | a 48ft wall, tiled, with the elevation open |
| select | `03-panel-selected.png` | a **standard** panel selected by clicking its width label |
| type a width | `04-typed-width-41-1-2.png` | `41 1/2` typed, committed as `41½`, the note reading "Hand-set at 41½"" |
| refusal | `05-refusal-below-24in.png` | `20` **refused**: red field, the limit stated, the draft kept, the stored 41½" untouched |
| the ADU | `06-adu-widths-last-48.png` | all eleven Rogers-Sehorn ADU widths typed in sequence, **none refused** |
| reset | `07-before-reset.png`, `08-after-reset-automatic.png` | per-panel reset puts one panel back under the tiler (40") and the control disappears |
| drag | `09-after-drag-snapped-to-eighths.png` | a deliberately fractional-pixel drag commits **44½" / 35½"** — on the eighth, pair total conserved exactly |
| drag floor | `10-drag-floors-at-24in.png` | dragging past the floor stops at the catalog minimum: **56" / 24"**, nothing below 24" |
| every wall | `11-every-wall-walked.png` | the viewer dial is walked through **all four** wall elevations and every panel on every one is **at or above 24"** — the Stage 1r acceptance check, and the step that would have been red before the absorb rule, on walls nobody touched |
| refused pin | `12-locked-width-refused.png` | **the locked-width refusal (2026-09-30).** Panels are pinned at 48" one after another on a 4-panel wall until the automatic run cannot pay for one; the third is **refused whole**, naming what is in the way and the widest legal value, and the wall's own total is identical after every attempt |
| cancelling pair | `12b-pinned-pairs-before-retile.png`, `12c-pinned-pairs-after-unrelated-retile.png` | **joint pin planning (2026-09-30).** Every boundary on a run is dragged, which pins **every** panel on it (the drag writes `lockedWidthIn` on both halves of each pair it moves); then one **unrelated** retile is taken from a different wall via a run stop. Every hand-set width survives it, and a second retile too — on the per-pin planner this branch shipped first, all of them were silently discarded |

### Step 12 and the wall it needs

It walks the dial to an elevation with **3 to 8 panel labels** and pins there, which is not fussiness:

- `panelWidthLabels` only returns labels **inside the window**, because a click at
  an off-screen coordinate hits nothing. On the 13-panel wall the rest of this run
  edits, the first version of step 12 pinned every label it could reach and then
  ran out of **candidates** rather than out of slack — it never reached a refusal,
  and failed for a reason that had nothing to do with the app. Running out of
  candidates is now recorded (`ranOutOfCandidates`) and fails the step explicitly.
- Four panels is also where the arithmetic bites: two pins at 48" leave one
  automatic panel with about 5" to spare, and the third pin needs 11".

On this fixture it refuses on the **third** pin, with:

> Refused: 48" is not a width this wall can hold — it needs 11" from the rest of
> the wall, and the 1 automatic panel here can only give up 8" before it drops
> below the 24" fabrication minimum. The widest this panel can be hand-set to
> right now is 45", and the narrowest is 24". Nothing was changed.

⚠ **Two refusals in this file put different things in the box, and both are
right.** Step 6's sub-minimum refusal is a `validate` refusal — the commit never
happens and the user's own text stays there to be corrected. Step 12's is refused
*inside* the commit, so `LengthInput` redisplays the stored width, which is itself
the evidence that nothing changed.

⚠ **This step IS red on `main` @ `f100bd3` — but not for the reason first written
here, and the real reason is the better story.** The claim was that the old shed
drove the neighbours to 16", then 6", then clamped one at 0", "with the wall's own
total moving every time", and that `totalNeverMoved` is the check that catches it.
That does not reproduce. What `main` actually records is **`totals:
[160,160,160,160,160]` and `totalNeverMoved: true`** — the check that fails is
**`narrowestAfter >= FABRICATION_MIN_IN`**.

**Why the total holds on `main` while a panel goes unbuildable.** `main`'s
`shedWidthToNearestUnlocked` hands the whole delta to one neighbour with
`Math.max(0, widthIn + deltaIn)` and no lower bound but zero, so the wall still
sums — it just sums with a panel no shop can build, and `retileWallAroundPins`'
"the wall must still sum" guard is perfectly happy with that. Measured on this
branch against `main`'s own `bracedPlacement.ts`, step 12's gesture on a 160"
four-panel wall at the 40" standard width with two corners:

| pin | `main`'s free run | total | what commits |
| --- | --- | --- | --- |
| 1st at 48" | `[48, 20¼, 40]` | 160" | a **20¼"** panel, committed, unbuildable |
| 2nd at 48" | `[48, 48, 12¼]` | 160" | a **12¼"** panel, committed, unbuildable |
| 3rd at 48" | `[48, 48, 48]` | **195¾"** | nothing — this one *does* move the total, so the sum guard refuses it before it reaches the drawing |

So the only attempt that would have moved the wall's length is the only attempt
`main` already refuses; everything that gets through sums exactly and is silently
unbuildable. The independent review's own browser run on `main` recorded the same
shape with a **16"** panel (a different wall — this run's earlier steps leave each
wall at different widths), and it failed on exactly that assertion.

⚠ **The 0" clamp is unreachable here**, and saying it was reachable overstated the
case. `Math.max(0, …)` only bites when the one neighbour it picks is NARROWER than
the delta, and a 40" automatic panel paying for an 11" pin never is. The clamp
needs a free panel under ~12"; the no-free-slot case the module was really built
for makes the shed a complete **no-op** instead, which is the one that moves the
wall's length by the whole delta (the named 150" wall, 362 of 8,004 fixture walls).
Neither of those shapes exists on a four-panel wall.

**What the step therefore proves**, on `main` and on this branch: `totalNeverMoved`
is true on both and is not the discriminator — `narrowestAfter`, `widestAfter` and
the fact that the third pin is refused *with a sentence* are.

### Step 12b — the residual-cancelling pair, which is the ordinary case and not an edge one

Step 12 proves a pin the wall cannot pay for is refused. **Step 12b proves the
opposite half, which the first version of this branch got wrong:** a pinned set
the wall *can* pay for is honoured, even when no automatic panel is left to pay
with.

The elevation boundary drag writes `lockedWidthIn` on **both** halves of the pair
it moves (`handleDragResizePanels`), each to a different width, with the pair's
total unchanged — so every drag leaves a **residual-cancelling pair**: two pins
that are unpayable one at a time and free when settled together. Dragging every
boundary on a run pins every panel on it and leaves **no automatic panel at all**,
which is exactly the state Tommy's 2026-09-30 "tile only on the first draw"
decision makes the ordinary state of a wall.

Then the step takes **one unrelated retile from a wall that shares no corner with
ours** — a run-stop change, because `retileAllForRunStops` re-reconciles *every*
wall in the building against its own stored slots, which is how `retile.ts`'s
preserving path makes an edit anywhere in the building re-force the pins
everywhere else. The wall under test is not touched: same length, same openings,
same panel count.

⚠ **"A different wall" was enough until 2026-10-01 and is not any more.** Corner
ownership now gives a convex corner to the LONGER of the two walls meeting there,
so the two long walls own all four corners — and a START stop on a wall that owns
its corner removes that corner panel, which makes the orphan-corner rule clear the
butting neighbour's inset and grow that neighbour by a wall thickness. Measured on
this fixture before the step was re-aimed: the wall under test went from 184⅛" to
199⅝", its pinned set could no longer possibly sum to it, and every pin was
correctly refused. **That is the refusal working, not the planner failing** — but
it is not what this step is about, so the step now picks the OPPOSITE side of the
rectangle, which cannot reach it through that rule.

⚠ **How "shares no corner" is decided, and the one assumption it rests on.**
`sharesACorner` is **character overlap on the two wall ids**, because a wall id in
this app is the concatenation of its two corner ids — `AB`, `CD` on a rectangle,
`01`..`67` on an octagon and on bump-out segments. That is exact **only while every
corner id is a single character**; the first footprint to carry a two-character
corner id (say `A1`) would make this report adjacency between walls that do not
touch, and the step would fall back to its second preference or throw. It is a
harness convenience, not a geometry rule — `cornerOwnership`'s own
`startCorner`/`endCorner` succession is the real answer and is not reachable from a
CDP session. (The id is pulled off the dial's label with `/^Elevation:\s*/`; that
pattern was missing its backslash until 2026-10-01 and worked only because of the
trailing `.trim()`, which is the sort of accident this repo's encoding-pitfall note
exists about.)

It asserts that every hand-set width is still there afterwards, that it is still
there after a **second** retile (the planner has to be a fixpoint), that the
wall's own total never moved, and that nothing ended outside [24", 48"].

⚠ **`automaticPanelsLeft === 0` is a load-bearing fixture check, not decoration.**
With even one automatic panel left, the pair can lean on it and the broken per-pin
planner passes too — the step would be green for the wrong reason. It is recorded
and asserted for the same reason `ranOutOfCandidates` is in step 12.

⚠ **This step was red on this branch's own first commit** (`b30e128`), where
`planLockedWidthReforce` paid for each pin out of the free run only: every
hand-set width on the wall was silently discarded by the unrelated retile and the
wall was left perfectly legal, so nothing else here would have seen it. It is
green on `main`, which is the whole point — the refusal must not cost hand edits
that the code it replaced kept.

### One thing it records without asserting

`drag-has-no-ceiling`. The panel-boundary drag floors the *shrinking* panel at
24" but puts no ceiling on the *growing* one, so a long drag takes a panel past
`panelWidthInRange.maxIn` (48") — which the typed width field clamps. That is
**pre-existing Stage 1 behaviour**, outside Stage 1r's scope, and it is
recorded with its reason rather than asserted so the harness does not go red on
a known gap somebody else has to decide about. It is in `evidence.json` under
`observationOnly`.

## What it does NOT cover

- The **Panelizer scope checkboxes themselves** (including "the last checked
  branch cannot be unchecked") — those are behind a menu this script does not
  open. The rule is unit-tested in `apps/web/app/editorTabs.test.ts`.
- **Load-time behaviour** — that a stored sub-24" panel opens untouched is
  proved in `apps/web/app/projectFile.test.ts`, which is a better place for it.
- The **"no room left" refusal**, which needs a wall where every other slot is
  pinned or fixed; it is unit-tested in
  `packages/geometry/src/panelWidthEdit.test.ts`.
