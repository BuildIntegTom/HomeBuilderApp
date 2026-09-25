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
| 13 | A stop that **reaches a corner the wall owns** is **accepted** — the orphan-corner case |
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
