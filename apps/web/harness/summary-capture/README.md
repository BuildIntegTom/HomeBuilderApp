# Browser harness — the Project Summary's captured rendering

Drives the **real app in a real browser** over CDP and asserts the two halves
of Stage 0 (2026-10-06): the summary PNG is **not** captured while nobody is
looking at it, and it **is** current the moment somebody looks.

Same plumbing and the same discipline as the harnesses next door — every step
carries an expectation, `check()` throws without a boolean, and the process
exits non-zero if any expectation is false.

## Why this exists

**The same bug has nearly shipped twice**, from opposite directions, and it is
the kind that is invisible in review because the picture always looks like *a*
building.

1. **2026-10-03 — captured once, then never again.** `CaptureFrame`'s effect
   was keyed on `[gl, onCapture]`, both stable identities, so it fired exactly
   once per page load. Changing the wall height from 10ft to 16ft moved the
   summary's own totals (5,223 → 8,114 lb, $28,031 → $44,651) and left the
   image **byte-identical**, SHA-256 `813dfc105388b943` on both sides, 4 of 4
   runs. Fixed by hanging the capture off `useFrame` under
   `frameloop="demand"`, so *"a frame was rendered"* and *"the design changed"*
   became the same event and there was no dependency list left to go stale.

2. **2026-10-06 — nearly reintroduced by the Stage 0 optimisation itself.**
   Profiling found that capture was **2,526 ms of ~4,920 ms of real work** in a
   single edit on a 272-panel building — 51%, for a PNG that is on screen only
   when the Project Summary note is open. Gating it on "is anyone looking"
   removes that cost, but **re-opening the note changes nothing in that hidden
   scene**, so under `demand` no further frame renders, `useFrame` never runs,
   and the note opens showing the image from before the edits. Caught by
   reasoning through the open/close path *before* testing it; the fix is that
   going live forces a frame exactly the way an explicit capture request does.

So the asserted property is **not** "a capture happens". It is **"no capture
while closed, AND a current image when re-opened"** — both directions, because
either one alone can be satisfied by a broken implementation.

## What it asserts

| check | why it is there |
|---|---|
| a building exists to summarise | with no footprint there is no capture canvas at all, and every check below would pass vacuously |
| the note shows a rendering once opened | the baseline image, fingerprinted by SHA-256 of the data URL |
| opening it took at least one capture | proves the live path works, so the "0 while closed" check below means dormant and not broken |
| **no capture at all while the note was closed** | **the Stage 0 win.** `toDataURL` is counted by patching `HTMLCanvasElement.prototype`, so it catches the call wherever it comes from |
| re-opening took a capture | the forced frame landed |
| the summary's own numbers moved | ⚠ **non-vacuity.** Without this, an edit that silently failed to apply would make the image-unchanged check below pass for the wrong reason |
| **the re-opened image is NOT the one from before the edit** | **the stale-summary guard**, the property both bugs above violated |

## Run it

```
cd apps/web && npx next build && npx next start -p 3304
chrome --headless=new --remote-debugging-port=9476 --user-data-dir=<a temp dir> --window-size=1600,1000 about:blank
node apps/web/harness/summary-capture/run.mjs
```

⚠ **Use a production build.** In dev React double-renders and nothing is
minified, so neither the capture count nor the timings mean anything.

⚠ **Check what is actually serving the port.** A previous `next start` that
outlived its shell keeps the port and serves the OLD bundle; the run then
measures code you did not write. This happened on 2026-10-06 and was caught
only because the script failed for an unrelated reason. Free the port by its
listening PID, not by killing node by name.

Override with `SUMMARY_CAPTURE_APP_URL` / `SUMMARY_CAPTURE_CDP_PORT`.

**Prove it can fail:** `SUMMARY_CAPTURE_PROVE_FAILURE=1 node .../run.mjs`
appends one deliberately false check; the run must then exit 1 and must write
no evidence. A harness nobody has watched fail is not evidence.

## Known flake

The first footprint drag of a run sometimes does not land — the draw loop
retries up to four times and prints what each attempt saw. A run whose first
attempt reports `0 panels` and whose second reports a real count is normal and
is not a defect in the app; see `../smearforn-stage-0-1/README.md` for the same
behaviour and what it correlates with.
