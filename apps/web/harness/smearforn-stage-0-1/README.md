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
failed 3 of 4 on demand. One 20x run died in setup before step 1 — extreme
throttling, unrelated to this step, and it did not recur in two repeats.

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
