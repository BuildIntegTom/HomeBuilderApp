# Browser harness — Top Bar & Navigation Reorganisation, U1 REBUILT

Two things, in one script: it **measures the bar Tommy re-drew on 2026-09-28**,
and it **asserts that bar behaves**. Same plumbing and the same `record()`
discipline as `../ui-reorg-u0` and the four `../smearforn-stage-*` harnesses —
every step carries an expectation, `record()` throws without one, and the
process exits non-zero if any expectation is false.

**The measurement is the deliverable, not a check on it.**

## What changed on 2026-09-28, and why U1's own figures are not comparable

U1 measured a bar that no longer exists. Tommy read its numbers and changed the
design twice the same day:

1. `Design` and `View` became **bare words** — no caption, no value. (The built
   labelled `DESIGN 2D Floor Plan ▼` measured **176.8px**; bare it is **87px** at
   ≥768px and **53.4px** below.)
2. The **view dial was removed entirely**, so these two menus are the only way
   to reach any view, at any width. Scroll-wheel cycling and `useRustleSound()`
   went with it, on his word, and nothing replaces the wheel.
3. The **wordmark was dropped** (~142px, ≥1200px only).
4. In the interview that followed, the **four `Wall / Foundation / Floor / Roof`
   tab items left the bar** and became subject groups inside the Design menu.

So this file measures the bar that ships (**option B**) and, projected onto the
real row, **option A** — the same bar with the four tab items back — plus
`Summary` and `Print` on top of each, because those are U4 and U5 and whether
they will fit is worth knowing before they are built.

## Run it

```
npm run dev --workspace=apps/web -- -p 3218
chrome --headless=new --remote-debugging-port=9458 --user-data-dir=<a temp dir> --window-size=1600,1000 about:blank
node apps/web/harness/ui-reorg-u1/run.mjs
```

Override with `UI_REORG_U1_APP_URL` / `UI_REORG_U1_CDP_PORT`.

**Use `localhost`, not `127.0.0.1`.** Over `127.0.0.1` the client chunks for the
`next/dynamic` canvas never arrive and the page renders its chrome with no
canvas at all, silently.

**Prove it can fail:** `UI_REORG_U1_PROVE_FAILURE=1 node apps/web/harness/ui-reorg-u1/run.mjs`
appends one deliberately false check; the run must then exit 1. A harness nobody
has watched fail is not evidence.

## THE PER-CONTROL WIDTHS — measured one control at a time

Four companies simulated, the widest reading across all four roles. ⚠ The
previous record carried **~104px each for Account, Projects and Settings**,
derived by subtracting measured parts from a measured total. That was inference
sitting in a table of measurements, and it is what made 1280px look like it had
~17px of margin. These are read out of the real layout.

| control | ≥768px | <768px |
|---|---|---|
| acting-as chip | **354.7** (at its 280px select cap) | 187.5 at 768 → **12.0** at 360 |
| Account (`Sign in`) | **86.3** | 52.7 |
| Project | **87.0** | 53.4 |
| **Design** | **87.0** | 53.4 |
| **View** | **74.5** | 41.8 |
| Role | **139.0** (`Fabricator`; 115.9–132.5 for the others) | 80.0–101.4 |
| ⚙ Settings | **34.0** | 30.0 |

So Account / Projects / Settings are **86.3 / 87.0 / 34.0**, not ~104 each: the
inference was ~18px high on two of them and ~70px high on Settings, and the
three together are **207.3px**, not ~312px.

**Natural row content** (nothing squeezed, measured at 1600px):

| bar | row content | ≈ viewport |
|---|---|---|
| **built — option B** | **922.5px** | **~962.5px** |
| option A (four tab items back) | 1216.8px | ~1256.8px |
| option B + Summary + Print | 1084.8px | ~1124.8px |
| option A + Summary + Print | 1379.1px | ~1419.1px |

**Folding the tabs into Design saved 294.3px** — measured, against the plan's
~264px estimate. **Summary and Print cost 162.3px** as bare buttons.

## Does it fit? — 360 / 710 / 768 / 1200 / 1280 / 1366 / 1440 / 1600

Option B, four companies, worst role. `chars` is how much of
`The Seed Collaborative (platform admin)` (39 characters) really renders.

| viewport | row has | row wants | fits | chars of the company name |
|---|---|---|---|---|
| 360 | 344 | 368.7 | no (−24.7) | **0 — the name is gone** |
| 710 | 694 | 588.7 | **yes, 105px spare** | 31 of 39 |
| 768 | 728 | 732.2 | no (−4.2) | 6 of 39 (`The Se`) |
| 1200 | 1160 | 922.5 | yes, 237px spare | **39 — whole** |
| 1280 | 1240 | 922.5 | yes, 317px spare | **39 — whole** |
| 1366 | 1326 | 922.5 | yes, 403px spare | **39 — whole** |
| 1440 | 1400 | 922.5 | yes, 477px spare | **39 — whole** |
| 1600 | 1560 | 922.5 | yes, 637px spare | **39 — whole** |

**No control is ever pushed off screen and nothing scrolls horizontally, at any
of these widths** — when the row runs short the acting-as select is the only
thing that gives, exactly as the stylesheet says it should. "Does not fit" above
means *the row wants more than it has and the name is being cut*, not *a control
fell off*.

⚠ **768px is worse than 710px, and that is not a typo.** At 768 the `ACTING AS`
caption comes back and every control grows (12px → 13px type, wider padding),
which costs more than the extra 58px of viewport brings. It is the narrowest
width at which the name is cut to single figures.

### The declared supported range

- **≥1200px — everything, comfortably.** Every control present, the company name
  whole, 237px+ to spare. This is where the work gets done.
- **425px–1199px — the working range.** Every destination reachable, no control
  off screen, the company name **truncated but present** (31 of 39 characters at
  Tommy's own 710px; 6 at its worst, around 768–823px). **Tommy's 710px works
  with room to spare.**
- **below 425px — demo only, and the company name is gone.** The bar still
  carries every control and every view is still reachable (asserted with a real
  mouse at 360px), but the acting-as select is crushed to 12px and renders **no
  characters of the company name**. The chip, its caret and the switcher are all
  still there and still on screen; it is the NAME that is absent.

### ⚠ Every width at which the company name is FULLY ABSENT

Bisected in the browser at the widest role label, per breakpoint band:

| bar | name absent below | of the sampled widths |
|---|---|---|
| **built — option B** | **425px** | 360 |
| option A (tabs on the bar) | 695px (and again 768–1023px) | 360, 768 |
| option B + Summary + Print | 541px (and again 768–891px) | 360, 768 |
| option A + Summary + Print | never visible below 768; 768–1185px | 360, 710, 768 |

**This is a documented safety property being spent, and it is the one number to
put in front of Tommy.** The acting-as company is on the bar because a
wrong-company save is *silent, plausible, and noticed later by someone else*,
and `AccountControl.module.css` records that the original bug was the name
truncated while its caption still showed — the principle drawn from it being
**truncated-but-present beats absent**. Below 425px this bar does not keep that
promise. It is the price of removing the dial: with no dial to catch the view
stops, `Design` and `View` cannot shed, so at the narrow end the name is the
only thing left that can give. Nothing here shrinks type or invents a breakpoint
to hide it.

Two things that soften it and neither is an excuse: **option B is far better
than option A at every width** (the tabs' 294px were coming out of the name), and
**the name is whole from 1200px up**, where Tommy says the work happens.

## What it asserts about the bar Tommy drew

- **Bare words at every width.** `Design` and `View` carry the word and the
  caret and nothing else, and are present at 360 through 1600. With no dial,
  a width where these are hidden is a width where the plan, every wall
  elevation and the three 3D views cannot be reached at all.
- **The removals are real at EVERY width** — the dial, `nav[aria-label="Editor"]`,
  the four `nav-*` bar buttons, the wordmark, and any `LABEL`+`Value` treatment
  on a view menu. Each of those had a width-keyed life, so a sweep at 1600 alone
  would have called them gone while two of them were alive at 710.
- **Level one of the highlight** — the bar marks the OWNING menu with
  `aria-pressed` **and** an inset underline (not colour alone), Design owns the
  Roof editor, and the two buttons' widths do not move between states, so
  ownership changing can never reflow the row.
- **Level two of the highlight** — the open menu marks the current entry with
  `aria-current="true"` **and** a heavier weight and a left edge bar. Exactly one
  entry is marked, in the owning menu only; on the Roof editor the marked entry
  is the SUBJECT and no stop is marked at all.
- **The cold-load state Tommy described**: with no footprint, Design is
  highlighted and View is disabled with its reason in the title.
- **Every destination reachable and counted** — the plan, one entry per wall, the
  three 3D representations by name, and the three non-wall subjects, which appear
  only because they were checked on in the Panelizer.
- **A real mouse reaches Membranes from the bar at 360, 710 and 1280** — pressed
  and released at the control's own coordinates, not an element dispatch.

## The single-writer test, and how it survived the dial's removal

`viewMode`, `simplified3D`, `showWraps` and `elevationViewWallId` are four flags
encoding five stops, and sidebar Region 3 keys off exactly those. So Region 3
rendering identically is the direct test that `handleViewerStopChange` stayed the
only writer.

U1 proved it two ways. **One of them is impossible now** — it compared the dial
against the menus within a single run, and there is no second control left. So:

- **Across the change** — the eight stops' Region 3 signatures, recorded off the
  **dial** in `region3-baseline.json` before any of this, and re-derived off the
  **menus** now. Compared on `shape`, digits normalised, because two runs draw
  two slightly different buildings by a pixel of mouse drag. ⚠ **That baseline
  can never be re-made**: it is the only recording of Region 3 as a control other
  than these menus produced it.
- **Two paths, one run** — the replacement for the lost half. Every stop is
  reached twice: directly, and again after a detour through a stop of the other
  kind. Region 3 must be **byte-for-byte identical** both times, digits included.
  The detour is what writes `showWraps` / `simplified3D` / `elevationViewWallId`
  in the first place, so this is precisely the test for `showWraps` left true on
  a plan view arrived at from 3D — the failure the plan names as most likely.

Neither is enough alone: the second would pass if `handleViewerStopChange` itself
were broken, since every path calls it; the first catches that but has to
normalise away the fine detail the second keeps.

## Measurement discipline, kept

**Four companies are SIMULATED, and every cell says so.** Signing in needs
Supabase and nothing in this workstream may touch it, so the signed-out acting-as
span is swapped for a real `<select>` carrying `switcherLabels`' real output for
four real entitlements, built with the app's own hashed `.actingAsSelect` class
read out of the live stylesheet. **It is validated before any width is judged by
it**: the longest real label must render within 12px of the 270px a real browser
produced for it on 2026-09-13. It measured **exactly 270px** on this run.

**The company name is measured on its own terms** — the select's own width and
its visible character count — never the chip's bounding box. U1's original
assertion was *"nothing is pushed off screen"*, which was **true with a 16px
select showing nothing**. The character count was validated against screenshots
on 2026-09-28 and **errs downward by at most one character**, where Chrome clips
the ellipsis, which is the safe direction.

**Thresholds are bisected out of the shipped CSS**, never transcribed, and
**per breakpoint band**, because fit is not monotonic in width: at 1200 the name's
own cap rises from 220px to 280px.

**⚠ The one projection not built from a live class.** The `.navTab` rule was
deleted along with the tabs it styled, so option A's four tab items are projected
with the declarations that rule carried, quoted from the commit that removed
them (14px/400/20px, `padding: 0 12px`, transparent 2px top and bottom borders).
Every other projected control is built from a class read out of the live
stylesheet. The evidence records which controls came from deleted CSS
(`projectedFromDeletedCss`), because a figure built on remembered CSS is weaker
than one built on live CSS.

**A run that records nothing never overwrites a run that did** — an exit handler
once wrote a two-line evidence file over a committed 5,700-line measurement.

## The evidence files

| file | what it records |
|---|---|
| `evidence.json` | **this bar** — bare Design/View, no dial, no wordmark, no tab items. Every assertion passes. |
| `evidence-u1-labelled-bar.json` | ⚠ **KEPT, NOT REGENERATED.** U1's built bar: labelled Design/View at 1454px, the dial, the wordmark, the four tab items. The "before" for everything above, and the only recording of a bar that no longer exists. |
| `evidence-u1-as-built.json` | U1's first shipped form, menus at 1200px, where the company-name assertion **fails** — the kept failing "before" for the shed-order fix. |
| `evidence-projection.json` | the pre-U1 bar with all four of Tommy's new controls projected onto it. Not re-runnable. |
| `region3-baseline.json` | Region 3's signature at every stop, **driven by the dial**. Cannot be re-made. |

## Locators

Nothing is keyed to an incidental element. Controls by `data-bar-control`, the
menus by `data-view-menu` / `-owner` / `-word` / `-current-stop`, entries by
`data-view-stop` and `data-design-subject`, groups by `data-menu-group`, Region 3
by `data-sidebar-region-3`. CSS-module class names are hashed build artefacts and
are never written down: they are found by the **stem** the source file uses.

The bare word is read from its own `data-view-menu-word` span rather than off
`textContent`, which also carries the caret — a reader comparing `textContent` to
`"View"` fails on `"View ▼"` and reads exactly like a rename that never happened.

`data-view-menu-current-stop` is a **harness-only** attribute on the owning
button: the bar deliberately shows the current stop nowhere, so there is nothing
visible left to read. It renders from the same `viewerStopLabel(currentViewerStop)`
call the open menu marks with `aria-current`, and the run asserts the two agree —
otherwise this harness would be reading a second, private truth.
