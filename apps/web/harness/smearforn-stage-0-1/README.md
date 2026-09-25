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

## What it does NOT cover

- The **Panelizer scope checkboxes themselves** (including "the last checked
  branch cannot be unchecked") — those are behind a menu this script does not
  open. The rule is unit-tested in `apps/web/app/editorTabs.test.ts`.
- **Load-time behaviour** — that a stored sub-24" panel opens untouched is
  proved in `apps/web/app/projectFile.test.ts`, which is a better place for it.
- The **"no room left" refusal**, which needs a wall where every other slot is
  pinned or fixed; it is unit-tested in
  `packages/geometry/src/panelWidthEdit.test.ts`.
