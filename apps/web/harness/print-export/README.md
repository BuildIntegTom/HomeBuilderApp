# Browser harness — the printed sheet is not blank

Drives the **real app in a real browser** over CDP, marks the Project Summary
for printing the way the app's own print button does, switches the page into
**print media**, and asks Chrome for a real PDF.

Same plumbing and the same discipline as the harnesses next door — every step
carries an expectation, `check()` throws without a boolean, and the process
exits non-zero if any expectation is false.

```
npm run dev --workspace=apps/web      # or whatever is serving the app
node apps/web/harness/print-export/run.mjs
```

It launches its own headless Chrome, so nothing else needs starting. Point it
elsewhere with `PRINT_EXPORT_APP_URL`, `PRINT_EXPORT_CDP_PORT` and
`PRINT_EXPORT_CHROME`.

## Why this exists

Tommy, 2026-11-10: *"i exported the summary sheet as a pdf and it looked
blank."* It was. **Every PDF the app had ever exported was an empty page**,
and nothing anywhere could have told us.

`.editorSection` — the editor shell, sidebar and canvas and all — has carried
`print-hidden-chrome` since the print system was built, which was correct
while the printable sticky notes lived outside it. **U4.2 ("Summary and Print
are full pages") moved them inside it**, into `.editorPageLayer`. Nothing in
the print CSS noticed, because `display: block !important` on the targeted
section cannot rescue a descendant of a `display: none` ancestor.

What makes it worth a harness is how well it hides:

- Every unit test passes. The React tree is correct; the DOM is correct.
- `getComputedStyle` on the section itself says `display: block`,
  `visibility: visible`. **The element reports as visible.** Only its *box* is
  wrong, and only in print media — it measured **0 × 0**.
- `innerText` still returns the whole sheet, so anything reading text sees a
  healthy document.
- Chrome emits a valid, well-formed, completely empty landscape PDF at about
  **1.2 KB**. The export "succeeds". No error, no warning, no console message.

So the assertion is not "printing happened". It is **"the document has a real
box in print media, nothing else is painting beside it, and the PDF is bigger
than an empty page"** — because the first two can each be satisfied by a
broken implementation and the third is the only one a person would notice.

## What it asserts

| | |
|---|---|
| the starter template draws a building | a real one — The Tank, 24 × 48, so the sheet has a rendering, a gable row and real totals |
| the Price page mounts the Project Summary | `#detail-summary` is a `.documentSection` where the print rules can reach it |
| the Summary can be marked as a print target | the exact two DOM writes `handlePrintNote` makes |
| the printed section has a real **width** in print media | > 200px. **This is the one that was 0.** |
| the printed section has a real **height** in print media | > 200px. Likewise. |
| and the price is the first thing on it | `PROJECT TOTALS` then `Price` — his 2026-11-10 ordering, pinned so a future table edit cannot quietly bury it again |
| no editor chrome prints beside the document | nothing visible that is neither the document nor an ancestor of it. Un-hiding the wrapper let `.editorPageIcons` through the first time |
| the PDF is not an empty page | > 20 KB. An empty one is ~1.2 KB; this sheet is ~183 KB |

## Proving it fails

Break the fix and the harness has to go red, or it is decoration. Point the
`:has()` in `globals.css` at an attribute nothing carries:

```
.print-hidden-chrome:has(.documentSection[data-print-target-DISABLED-FOR-PROOF])
```

Measured 2026-11-10 with that one edit in place:

```
FAIL  the printed section has a real WIDTH in print media   — w: 0, h: 0
FAIL  the printed section has a real HEIGHT in print media  — w: 0, h: 0
FAIL  and the price is the first thing on it
FAIL  the PDF is not an empty page                          — bytes: 1187
4 FAILED, exit 1
```

Restored, all eight pass and the same sheet prints at 183,017 bytes.

`evidence.json` is the last run's own record, and `screenshots/print-media.png`
is what print media actually rendered — worth looking at, since it is the only
view of the sheet as paper sees it.
