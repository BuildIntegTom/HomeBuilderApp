# frameloop-perf — the hidden canvas that never stopped drawing

Measures the idle main-thread cost of `BuildingSummaryRender`'s off-screen
react-three-fiber canvas, and checks that the Project Summary's captured PNG
is **current** rather than merely present.

Full write-up — what the bug was, which fix shape was chosen, what was
rejected, and the canvas audit as a table — is in the spec under
**"The hidden canvas that never stopped drawing (2026-10-03)"**.

## Why a browser harness and not a unit test

Nothing in a test file can see a render loop. The claim here is *"this canvas
redraws the whole building 60 times a second, forever, for a picture it has
already taken"*, and the only place that is true or false is a running app.
Same reason the Smearforn harnesses are in this repo.

## What it measures

1. Draws a footprint and reads the **app's own** panel count off the Project
   Summary, rather than deriving one.
2. Sits in **plan view** doing nothing — the idle window. Plan view is the
   fixture on purpose: the editor's own `Building3DView` mounts only on a 3D
   view stop, so in plan view the off-screen summary canvas is the *only*
   WebGL surface on the page and anything three.js burns is attributable to
   it by construction.
3. Samples the V8 CPU profiler (`Profiler` domain, 200µs interval) over that
   window and reports **`busyMs`** — wall time minus V8's own `(idle)`
   samples.
4. Counts **WebGL draw calls** over the same window, by patching
   `drawElements`/`drawArrays` on both WebGL prototypes before any app script
   runs.
5. Reads the longest `longtask` PerformanceObserver entry.
6. Captures the summary PNG, makes a real design change (wall height, typed
   and committed through the Settings note's own field), captures again, and
   compares by **SHA-256**.

### ⚠ Which numbers to trust

Headless Chrome rasterises WebGL in **software** (SwiftShader), so the
millisecond figures are an upper bound against a real machine with a real
GPU. The **draw-call count carries no such caveat** — it is a direct,
hardware-independent statement of whether a render loop is running, which is
exactly why it is instrumented. And the before/after *ratio* is the robust
part of the millisecond figures, not their absolute size.

### ⚠ `busyMs` does NOT attribute time to `three` by script URL

A production build bundles `three` into a Next.js chunk, so bucketing the
profile by script URL cannot separate three.js from app code — the first
version of `summarizeProfile` tried, and reported a flat **0 ms** for three
while `renderBufferDirect` sat in the app bucket. `busyMs` sidesteps that:
in plan view, idle busy time *is* the render loop, and the before/after
difference measures it without having to name it. `topSelfFunctions` is
reported alongside as the qualitative evidence of what the busy time was.

## How to run

Against a **production** build — dev-mode numbers are worthless here.

```
cd apps/web && npx next build && npx next start -p 3304
chrome --headless=new --remote-debugging-port=9473 --window-size=1600,1000 \
  --user-data-dir=<unique temp> about:blank
FRAMELOOP_APP_URL=http://localhost:3304/ FRAMELOOP_CDP_PORT=9473 \
  FRAMELOOP_LABEL=after-small node apps/web/harness/frameloop-perf/run.mjs
```

**Use `localhost`, not `127.0.0.1`** — see the Stage 0/1 harness's note: the
dynamic-import chunks never arrive over 127.0.0.1 and the canvas silently
never appears.

**The first headless Chrome launch of a session draws a different footprint
than later ones.** The run therefore takes *two* consecutive idle passes and
labels pass 2 as the one to believe, and each configuration here was run
twice.

### Knobs

| env | effect |
|---|---|
| `FRAMELOOP_FOOTPRINT_PX=WxH` | the draw gesture, in screen px. Omit for the largest drag that fits. |
| `FRAMELOOP_SECOND_STORY=1` | adds a second storey — roughly doubles the scene. |
| `FRAMELOOP_WALL_HEIGHT_FT=16` | taller than `maxPanelHeightIn` (120in) stacks panels into two vertical bands, roughly doubling the **meshes** without changing the panel count. |
| `FRAMELOOP_STANDARD_WIDTH_IN=24` | more panels on the same walls. ⚠ 24in is `fabricationMinPanelWidthIn`, the shop's floor — never drive it below. |
| `FRAMELOOP_ZOOM_OUT=N` | clicks the plan view's Zoom out button. **Measured to have no effect on the drawn footprint** — see below. Kept so the finding stays reproducible. |
| `FRAMELOOP_IDLE_MS` | idle window, default 2500. |
| `FRAMELOOP_LABEL` | names the evidence file and the screenshots. |

## ⚠ The ceiling on panel count, measured

This work was briefed to measure at ~60 and ~300 panels. **~300 is not
reachable through the drawing UI.** `FootprintCanvas` hard-codes
`CANVAS_WIDTH/CANVAS_HEIGHT = 720/480` and converts the drag at a fixed
`SCALE_PX_PER_FT = 12`, so the largest footprint anybody can draw is about
59×39ft — **55 ground-floor panels**. Zooming out first does **not** help:
the same 500×340px drag produced **41 panels at zoom 0, 41 at zoom 3 and 41
at zoom 5**. A second storey is the only lever that doubles it, which is why
the configurations here are 55 and 110. Raised as an Open Item in the spec;
it is a question for Tommy, not a finding.

It matters less than it looks, because **the "after" column is flat rather
than proportional**: the fix stops the loop rather than making it cheaper, so
the after figure is zero at every panel count.

## What is checked in here

| file | what it is |
|---|---|
| `evidence-before-{small,large}-r{1,2}.json` | `main` @ `2422fbd`, production build. Idle busy ~93–100%, 46k–70k draw calls/idle second, **summary PNG byte-identical across a design change in all four runs**. |
| `evidence-after-{small,large}-r{1,2}.json` | this branch. Idle busy 0.0–0.1%, **0 draw calls**, summary PNG byte-different across the same change in all four runs. |
| `evidence-calib-220b.json` + its screenshots | the 19-panel run where the **stale PNG** was first found. The two screenshots are the exhibit: the summary's own totals move (5223.0 lb → 8114.3 lb, $28031.66 → $44651.02) and the rendering image does not. |
| `evidence-after-smoke.json` + its screenshots | the same 19-panel fixture on the fixed build — a short building becomes a tall two-band one. |

`small` = one storey, 10ft walls, largest drag (55 panels).
`large` = two storeys, 16ft walls, largest drag (110 panels).

`record()` refuses to run without an expectation and the process exits
non-zero if any is false. ⚠ `writeEvidence()` runs on `exit`, which is
**before** a caller's exit-code check — so `git status` after every run.
