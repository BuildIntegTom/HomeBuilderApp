# Browser harness — Top Bar & Navigation Reorganisation, stage U0

Drives the **left-bar icon cluster** and **Single Wall Run in Settings**
against a real dev server in a real browser over CDP, and asserts. Same shape
and same plumbing as `../smearforn-stage-2`, including its rule that **every
step carries an expectation** — `record()` throws without one, and the process
exits non-zero if any expectation is false.

**Why a browser harness for a layout change at all:** the failure mode of a
navigation change is that something silently stops being reachable. No error,
no wrong number, no failing unit test. This is the only kind of check that can
see it, which is why the plan calls the harness not optional.

## Run it

Three things, from the repo root:

```
npm run dev --workspace=apps/web -- -p 3217
chrome --headless=new --remote-debugging-port=9457 --user-data-dir=<a temp dir> --window-size=1400,1000 about:blank
node apps/web/harness/ui-reorg-u0/run.mjs
```

Override with `UI_REORG_APP_URL` / `UI_REORG_CDP_PORT`.

**Use `localhost`, not `127.0.0.1`.** Over `127.0.0.1` the client chunks for the
`next/dynamic` canvas never arrive and the page renders its chrome with no
canvas at all, silently — the Stage 0/1 harness's README explains it at length.

**Prove it can fail:** `UI_REORG_PROVE_FAILURE=1 node apps/web/harness/ui-reorg-u0/run.mjs`
adds one deliberately false expectation, and the run must then print `1 FAILED`
and exit **1**. Both outcomes are measured; a harness that has never been seen
to fail is not evidence.

## What it checks

| step | what it asserts |
|---|---|
| `cluster-is-four-named-icons` | four icons, each with a real `aria-label` **and** the same `title` — the icon-only rule |
| `cluster-fits-at-240px` | one row, nothing outside the sidebar, nothing overlapping, bottom-pinned, no scrolling to reach it |
| `review-icon-opens-the-review-log` | **absent before the click, present after** — the Review Log's permanent front door |
| `review-icon-closes-it-again` | it is a toggle, not a one-way door |
| `bug-icon-opens-a-note` | a note, not a navigation (an unsaved design survives it) |
| `bug-note-carries-the-route-wording-verbatim` | every `<section>` of `/report-bug`, fetched from the route itself, appears in the note character for character |
| `bug-note-introduces-no-new-address` | exactly one `mailto:` in the note, and it is the route's own |
| `the-bug-notes-review-log-link-opens-the-same-note` | the link inside the note opens the Review Log note (twice in a row — it opens, it never toggles shut) |
| `bug-note-is-context-not-telemetry` | no user agent, no version string, no viewport figures anywhere in it |
| `context-line-*` (4 steps) | the context line names `Wall` before a footprint, `Wall — 2D Floor Plan`, `Wall — «the dial's own elevation label»`, `Wall — Membranes`, and on the Roof tab **only** `Roof` |
| `read-me-icon-opens-a-note-with-the-route-wording` | the route's sections verbatim, and the liability statement asserted by its own exact words |
| `read-me-note-qr-is-still-scannable` | the Venmo QR renders ≥200px wide in the note, and the PDF link is still there |
| `single-wall-run-moved-into-settings` | **zero** `/sandbox` links in the document until Settings opens, **one** inside it, the label unchanged, styled as a menu item, and `/sandbox` still 200 |
| `cluster-fits-at-every-width-including-64px` | 1600/1280/1200/710/601/600/400/360: four icons, no overlap, nothing outside the sidebar's real content box, still inside the scroll box |
| `cluster-reads-as-a-cluster-at-240px-and-at-64px` | one row at 240px with no scrolling; one flush-left column at 64px |
| `a-panel-was-selected-to-dock-its-note` | a panel really got selected (candidates are tried in turn; not every clickable group is selectable) |
| `docked-note-and-an-icon-note-coexist…` | the docked Selected Panel note and an icon's note at once, with the cluster below the docked note and still inside the rail |
| `openNote-deep-link-still-opens-the-review-log` | `?openNote=review-log`, with **no clicks** — the link `/report-bug`'s own page depends on |
| `routes-still-exist-behind-the-notes` | `/read-me`, `/report-bug`, `/sandbox` all still 200: the notes are an extra door, not a replacement |
| `no-uncaught-exceptions` | nothing threw in the page all run |

Screenshots land in `./screenshots`, measurements in `./evidence.json`.

## Four things this run got wrong first, written down

- **Fetching `/report-bug` mid-run broke the next click.** The dev server
  compiled a route that shares a module with the editor page, the HMR update
  remounted the app, and the click after it landed on a page that had just
  thrown its state away. The symptom was "the bug icon does not open its note",
  which would have been debugged in entirely the wrong file. The routes are now
  fetched once in step 0 and the editor is reloaded before anything is touched.
- **The sidebar's content box is not its bounding rect minus its padding.** The
  first reader reported 56px of usable width in the 64px rail. The real figure
  is **40px**: the rail scrolls and a classic scrollbar takes ~15px that the
  bounding rect still counts. That one wrong number made an icon which really
  did stick 2px out of the sidebar look contained. `clientWidth` is the honest
  measure.
- **Stepping the view dial has to be verified.** Opening an icon's note scrolls
  the sidebar (icons at the bottom, dial at the top), which put the dial's rect
  above the sidebar's visible box; six clicks in a row landed on the top bar and
  the run reported "Membranes unreachable" — a locator problem wearing a feature
  problem's clothes, which is this repo's own recorded lesson. `stepDialDown()`
  now scrolls the dial in and asserts the label moved.
- **"Click the middle panel" selected nothing on the second run.** Not every
  clickable group on an elevation is a selectable panel, and which one sits in
  the middle depends on how the wall tiled. The step now tries candidates in
  turn and asserts that a selection actually happened.

## What the numbers say about the 64px rail

At ≤600px the sidebar is 64px wide and its usable content box is **40px**, so
**two icons cannot share a row on any scrollbar** and the cluster becomes a
single flush-left column of four. That column is ~113px tall, and at a 900px
viewport height it ends **30px below the sidebar's visible bottom** — reaching
the last icon uses the same vertical scroll that rail already needs. Nothing is
clipped or unreachable (`withinScrollBox` is asserted), but it is a real cost of
the cluster at that width and it is measured here rather than left to be found.
Making it fit without scrolling would mean widening the 64px rail or shrinking
the icons below 26px; both are design decisions, not implementation ones.

**Tommy was shown this measurement and both alternatives on 2026-09-27 and
decided: "Leave it — scrolling is fine."** So the 30px is a settled trade, not
an outstanding defect, and these assertions are asserting the agreed outcome.
(The column is 4×26 + 3×3 = **113px**.)
