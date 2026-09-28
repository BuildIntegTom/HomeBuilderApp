# Browser harness — Top Bar & Navigation Reorganisation, stage U1

Two things, in one script: it **measures whether Tommy's twelve-item top bar
fits**, and it asserts the **Design/View split** behaves. Same plumbing and
the same `record()` discipline as `../ui-reorg-u0` and the three
`../smearforn-stage-*` harnesses — every step carries an expectation,
`record()` throws without one, and the process exits non-zero if any
expectation is false.

**The measurement is the deliverable, not a check on it.** The plan's own
riskiest assumption was that the width budget is already spent: the bar needed
a third breakpoint to fit six controls, Tommy's list is twelve, his everyday
viewport is 710px, and the plan's estimate for the new group (~1550–1600px)
was explicitly marked *unmeasured*. The answer lives in `evidence-projection.json`,
checked in, rather than in a commit message.

## Run it

```
npm run dev --workspace=apps/web -- -p 3218
chrome --headless=new --remote-debugging-port=9458 --user-data-dir=<a temp dir> --window-size=1600,1000 about:blank
node apps/web/harness/ui-reorg-u1/run.mjs
```

Override with `UI_REORG_U1_APP_URL` / `UI_REORG_U1_CDP_PORT`.

**Use `localhost`, not `127.0.0.1`.** Over `127.0.0.1` the client chunks for
the `next/dynamic` canvas never arrive and the page renders its chrome with no
canvas at all, silently — the Stage 0/1 harness's README explains it at length.

**Prove it can fail:** `UI_REORG_U1_PROVE_FAILURE=1 node apps/web/harness/ui-reorg-u1/run.mjs`
appends one deliberately false check; the run must then exit 1. A harness
nobody has watched fail is not evidence.

## The two passes, and why one of them is not re-runnable

| | `UI_REORG_U1_PASS=projection` | (default) `built` |
|---|---|---|
| Runs against | the bar **before** Design/View exist | the finished bar |
| Design & View | projected: built from the bar's own real classes, inserted into the real row, measured, removed | real |
| Summary & Print | projected | projected — they are U4 and U5, and a control that opens nothing is forbidden |
| Writes | `evidence-projection.json`, `region3-baseline.json` | `evidence.json` |

(`evidence-u1-as-built.json` is a kept copy of a built run, not a third pass —
see "The three evidence files" below.)

**The projection pass refuses to run against the built code, and its artefacts
must not be regenerated.** They are a recording of a bar that no longer
exists. Once Design and View are real they are `display: none` below the
boundary they appear at (1200px as U1 shipped, 1454px since the shed-order
correction) — they have *shed* into the sidebar dial, which is the right
answer — so a
projection there would skip them and then measure a row missing two of the
controls it claims to have measured. The checked-in files are from commit
`6ccdfff`, and they are the only "before" this stage has.

## What the measurement said

⚠ **Three figures here were the PROJECTION pass's, not the built bar's, and
all three understated the cost in the same direction. Corrected 2026-09-28**
from `evidence-u1-as-built.json`. Where a projection figure is still quoted it
now says so in the same breath.

Natural row-content width, four companies, the widest role label:

| bar | row content | ≈ viewport |
|---|---|---|
| today, 6 controls | 1176.9px *(projection)* | ~1217px *(projection)* |
| + Design + View (what U1 ships) | 1415.2px *(projection)* / **1448.2px as built** | ~1455 *(projection)* / **~1488px as built** |
| + Summary + Print (Tommy's twelve) | **1594.2px as built** *(1577.5 projected)* | **~1634px as built** *(~1618 projected)* |

**Twelve fit at no width in the brief.** Forced onto the row anyway, at 360px
`Print` is pushed off screen and the acting-as chip is crushed to 12px; at 768
and 1200 the chip is 20px. The acting-as company keeps the width its own
stylesheet caps it to only from **1503px** up (twelve, *projection*) and
**1381px** up (U1's ten, **built** — 1341 was the projection figure, and it
was also bisected at the wrong role; see below).

That is a finding, not an obstacle that was engineered around. Nothing here
shrinks type, drops a label or adds an overflow menu to make an assertion
pass — those are design decisions and they are Tommy's, the same way 1200px
was in 2026-09-13.

## The shed order correction, 2026-09-28

U1 shipped Design and View at `min-width: 1200px`. Measured there on the built
bar with four companies, **the acting-as company name rendered zero characters
at all four roles** — a 16px select under a caption still reading `ACTING AS`.
The chip's bounding box was entirely on screen the whole time, which is why
`nothing-U1-ships-is-ever-pushed-off-screen` passed and why it was not enough.

So the name is now measured on its own terms at every cell — **the select's
own width and its visible character count** — and there is a new assertion,
`some-of-the-acting-as-company-name-is-visible-at-every-width-U1-ships`,
requiring at least one character everywhere. The bisection gained
`anyNameVisible` and `companyNameWhole` beside the chip-based
`companyNameIntact`, whose weakness (it reads the chip, which carries ~85px of
caption and padding) is now written down rather than assumed away.

Thresholds, built bar, four companies, the widest role label — `Fabricator`.
⚠ **The published thresholds used to be bisected at whatever role the matrix
loop left set, which was `Engineer`, so every one of them was 6–7px off in the
optimistic direction.** The role is now set explicitly, recorded in the
evidence as `firstFitsMeasuredAt`, and handed back afterwards, because Region
3's content is role-gated and leaving it changed broke the cross-run
comparison.

| | ≥1200 band, U1 as shipped on 2026-09-28 |
|---|---|
| some of the name visible at all | 1226px |
| the chip at the 280px cap its select is given | 1381px |
| the name **whole** | **1454px** |

**Design and View now appear at `min-width: 1454px`** — the last row — with
`.viewerDialSlot` hidden at the identical query. The name is whole at every
width from 1200 up on the shipped bar.

⚠ **Two things that belong in any summary of this harness.** First, 1454 is a
**fourth breakpoint on a bar whose own log says not to add one**; it is
measured rather than chosen, but it is Tommy's to confirm. Second, and more
important: **Tommy's viewport is 710px, and the menus are also absent at 1280
and 1366**, so for him and for most users the sidebar dial is the view control
and these menus are a wide-monitor affordance.

**The boundary is discovered, not written down.** `run.mjs` bisects the shipped
CSS by asking which control is on screen, and every step that needs the number
reads the answer — the "exactly one presentation" widths, the dial-vs-menus
Region 3 comparison, the shed-order assertion, and each step that drives a
menu. A harness carrying its own copy of a breakpoint tests the wrong boundary
the moment the stylesheet moves, and passes while doing it.

## The three evidence files

| file | what it records |
|---|---|
| `evidence-projection.json` | the bar **before** U1, with all four new controls projected onto it. Not re-runnable; see below. |
| `evidence-u1-as-built.json` | the **built** bar as U1 first shipped it, menus at 1200px — the run where the new name assertion **fails**, 0 characters at all four roles. The "before" for the shed-order correction. |
| `evidence.json` | the bar as it ships now, menus at 1454px. All assertions pass. |

## Two things worth knowing before trusting a number here

**Four companies are SIMULATED, and every cell says so.** Signing in needs
Supabase and nothing in this workstream may touch it, so the signed-out
acting-as span is swapped for a real `<select>` carrying `switcherLabels`'
real output for four real entitlements, built with the app's own hashed
`.actingAsSelect` class read out of the live stylesheet. **It is validated
before any width is judged by it**: the longest real label must render within
12px of the 270px a real browser produced for it on 2026-09-13. If the class
lookup ever fails the select renders unstyled and every "four companies"
figure would be a measurement of nothing — so that fails here rather than
downstream.

**Fit is not monotonic in width, and the first bisection assumed it was.** At
exactly 1200px the bar gains the wordmark and four nav tabs, ~380px arriving
in one step, so a configuration can fit at 1199 and fail at 1200. The naive
bisect reported "fits from 875px" for a bar that is crushed at 1200 — a true
number meaning the opposite of what it looks like. Bisected per breakpoint
band now (`<768`, `768–1199`, `≥1200`), each of which is monotonic on its own.

## The single-writer test, in two halves

`viewMode`, `simplified3D`, `showWraps` and `elevationViewWallId` are four
flags encoding five stops, and sidebar Region 3 keys off exactly those. So
Region 3 rendering identically is the direct test that
`handleViewerStopChange` stayed the only writer.

- **Across the change** — the eight stops' Region 3 signatures, recorded off
  the **dial** before U1 (`region3-baseline.json`) and re-derived off the
  **menus** after. Compared on `shape`, digits normalised, because two runs
  draw two slightly different buildings by a pixel of mouse drag and
  `8,147 lb` vs `8,103 lb` is a true reading of that rather than a leaked
  flag. *The first version of this failed for exactly that reason, and the
  test was what was wrong.*
- **Within one run** — the dial one pixel below the boundary vs the menus at
  it, one design, compared byte for byte including digits. Both widths follow
  the discovered boundary, so this cannot end up comparing one control twice.

Neither is enough alone: the second would pass if `handleViewerStopChange`
itself were broken, since both presentations call it; the first catches that
but has to normalise away the fine detail the second keeps.

## Locators

Nothing here is keyed to an incidental element. Controls by
`data-bar-control`, the menus by `data-view-menu` / `-owner` / `-caption` /
`-value` / `-word`, stops by `data-view-stop`, Region 3 by
`data-sidebar-region-3`. CSS-module class names are hashed build artefacts and
are never written down: they are found by the **stem** the source file uses,
preferentially by taking the hashed prefix off an element really in the DOM.

The bare word is read from its own `data-view-menu-word` span rather than off
`textContent`, which also carries the caret — a reader comparing `textContent`
to `"View"` fails on `"View ▼"` and reads exactly like a rename that never
happened.
