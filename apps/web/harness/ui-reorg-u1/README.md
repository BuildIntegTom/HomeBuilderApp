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

On **2026-09-29** he made two more decisions, and both are measured here:

5. **`EditorTabDial` was removed too** — the Wall/Foundation/Floor/Roof scroll
   dial in the sidebar, and the toolbar that held it. *"Remove it — Design is
   the only door."*
6. **`Summary` and `Print` are on the bar as DISABLED PLACEHOLDERS**, which
   breaks this section's own "no control that opens nothing" rule by his
   explicit choice: *"i like the add then now as disabled placeholders. that is
   okay for this instance because i want to get a feel for how this is going to
   be a user friendly experience."* **They are real controls now, so every
   "built" figure below includes them**, and the same bar before they arrived is
   kept as `evidence-seven-control-bar.json`.

So this file measures the bar that ships (**option B**) and, projected onto the
real row, **option A** — the same bar with the four tab items back, shedding
below 1200px exactly as the real nav did.

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
| **Summary** (placeholder) | **85.6** | 67.3 |
| **Print** (placeholder) | **56.7** | 40.7 |
| Role | **139.0** (`Fabricator`; 115.9–132.5 for the others) | 80.0–101.4 |
| ⚙ Settings | **34.0** | 30.0 |

So Account / Projects / Settings are **86.3 / 87.0 / 34.0**, not ~104 each: the
inference was ~18px high on two of them and ~70px high on Settings, and the
three together are **207.3px**, not ~312px.

**Natural row content** (nothing squeezed, measured at 1600px):

| bar | row content | ≈ viewport |
|---|---|---|
| **built — what ships today** | **1084.8px** | **~1124.8px** |
| the same bar before Summary and Print | 922.5px | ~962.5px |
| option A (four tab items back, at ≥1200px) | 1379.1px | ~1419.1px |

**Folding the tabs into Design saved 294.3px** — measured at 1600px, where the
tabs really did show, against the plan's ~264px estimate. **Summary and Print
cost 162.3px**, which is the difference between the two checked-in evidence
files rather than a projection: the projection had predicted 162.3px, and the
real controls cost exactly that.

## Does it fit? — 360 / 710 / 768 / 1200 / 1280 / 1366 / 1440 / 1600

The bar as it ships, four companies, worst role. `chars` is how much of
`The Seed Collaborative (platform admin)` (39 characters) really renders.

| viewport | row has | row wants | fits | chars of the company name |
|---|---|---|---|---|
| 360 | 344 | 484.7 | no (−140.7) | **0 — the name is gone** |
| 710 | 694 | 694.1 | no, by 0.1px | 30 of 39 |
| 768 | 728 | 750.1 | no (−22.1) | **0 — the name is gone** |
| 1200 | 1160 | 1084.8 | yes, 75px spare | **39 — whole** |
| 1280 | 1240 | 1084.8 | yes, 155px spare | **39 — whole** |
| 1366 | 1326 | 1084.8 | yes, 241px spare | **39 — whole** |
| 1440 | 1400 | 1084.8 | yes, 315px spare | **39 — whole** |
| 1600 | 1560 | 1084.8 | yes, 475px spare | **39 — whole** |

⚠ **WHAT THE TWO PLACEHOLDERS COST, MEASURED — this is the number Tommy should
see against his own decision.** The same bar the day before, without them:

| viewport | then | now |
|---|---|---|
| 710 (his own) | 31 chars, **105px of row to spare** | 30 chars, **0.1px short** |
| 768 | 6 chars (`The Se`) | **0 chars — the name is gone** |
| 1200 and up | whole | whole |

So Summary and Print took **all** the slack at his own width and **the whole
name** in the 768–891px band. They cost nothing from 1200px up, which is where
he says the work happens. That is the trade; it is his to keep or reverse, and
reversing it is deleting two array entries.

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
  whole, 75px+ to spare (and 155px at 1280). This is where the work gets done.
- **892px–1199px — the working range.** Every destination reachable, no control
  off screen, the company name **truncated but present**.
- **541px–891px — working, but the name is spent for part of it.** Every
  destination is still reachable and nothing is off screen, and Tommy's own
  **710px renders 30 of 39 characters** — but from **768px to 891px** the name
  renders **nothing** (the `ACTING AS` caption returns at 768 and every control
  grows). It reads as a band, not a floor, and that is the shape the two
  placeholders introduced.
- **below 541px — demo only, and the company name is gone.** The bar still
  carries every control and every view is still reachable (asserted with a real
  mouse at 360px), but the acting-as select is crushed to 12px and renders **no
  characters of the company name**. The chip, its caret and the switcher are all
  still there and still on screen; it is the NAME that is absent — and it is
  still on the element's `title` and in its selected `<option>`.

### ⚠ Every width at which the company name is FULLY ABSENT

Bisected in the browser at the widest role label, per breakpoint band:

| bar | name absent | of the sampled widths |
|---|---|---|
| **what ships today** | **below 541px, and again 768–891px** | 360, 768 |
| the same bar before Summary and Print | below 425px | 360 |
| option A | identical below 1200px; see the wide end below | 360, 768 |

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

⚠ **AND ONE THING THAT GENUINELY DOES SOFTEN IT, which an earlier version of
this record left out.** The name is **hidden, not lost**. At every width the
select still carries `title={label(actingAsCompanyId)}` and its selected
`<option>` holds the full string (`AccountControl.tsx`), so the company name
survives **on hover and to assistive technology**, and switching still works
because the native dropdown renders at OS size rather than at the select's
width. A sighted user at 360px cannot read the company at a glance; they can
still hover it, still open it, and still see which entry is ticked. That is a
materially different failure from "the app does not tell you", and leaving it
out overstated the cost.

**Why 768px was acceptable before the placeholders, and why 0 characters is
not** — the reasoning, not the measurement. At 6 characters the four real labels
read `Buildi` / `The Se` / `Rare F` / `Buildi`: **distinct companies stay
distinguishable**, and the only collision is between two `Building Integrity`
entitlements, which are the same company, so a wrong-COMPANY save is still
detectable at a glance. At 0 characters nothing is. That is the line, and the
placeholders moved 768px across it.

⚠ **The option A comparison, corrected.** An earlier version of this record said
option B was "better at every width", and that was an artefact of how option A
was measured: the projection injected the four tab items at **every** width, but
the real nav only ever rendered at ≥1200px. Below 1200 the tabs shed and cost
the name **nothing**, so the two are **identical there**. Option A's real cost is
wide-end only, and it is still substantial: the company name whole from
**1416px** instead of **1200px**, 2 characters at 1200 and 15 at 1280.

## What it asserts about the bar Tommy drew

- **Bare words at every width.** `Design` and `View` carry the word and the
  caret and nothing else, and are present at 360 through 1600. With no dial,
  a width where these are hidden is a width where the plan, every wall
  elevation and the three 3D views cannot be reached at all.
- **The removals are real at EVERY width** — the view dial, the
  Wall/Foundation/Floor/Roof **tab dial** and its toolbar,
  `nav[aria-label="Editor"]`, the four `nav-*` bar buttons, the wordmark, and any
  `LABEL`+`Value` treatment on a view menu. Each of those had a width-keyed
  life, so a sweep at 1600 alone would have called them gone while two of them
  were alive at 710. ⚠ The tab-dial reader is found by the dial's own real
  locators (`role="group" aria-label="Editor"`, and its "Scroll or use the
  arrows to switch between Wall…" title); the first version of it looked for an
  `aria-label` the control never had and would have reported it absent while it
  was on screen.
- **Summary and Print are disabled placeholders at every width** — two words,
  `disabled`, each with a title saying what is not built, and taking no part in
  the view machinery (no `aria-expanded`, no `data-view-menu`, so neither can
  own, be current, or open an empty note). That is the deliberate rule-break,
  checked on its own terms.
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
**And a `UI_REORG_U1_PROVE_FAILURE=1` run now writes no evidence at all**: it
records plenty and then fails on purpose, so it used to leave a deliberately
failing `evidence.json` in place of a passing one. It was marked
`proveFailureMode: true`, which is honest, but the checked-in artefact is what
people read.

**The cold-click retry has a ceiling, and the ceiling is asserted.** A first
click after a cold load can land before React has attached its handlers. The
budget is 3 attempts; the run FAILS if any click needs more than 2, so the net
can catch the known race without quietly becoming load-bearing. The counts are
in `coldClickAttempts`.

### ⚠ What happens to `region3-baseline.json` at U3 and U5 — decide now, not then

U3 moves Site Properties and the Panelizer into Settings; U5 deletes the right
sidebar. Neither touches the four view flags, but **U5 in particular will
legitimately change what Region 3 renders**, and at that point this baseline
will stop matching for an honest reason.

**The answer then is to RETIRE it, not to regenerate it.** It is a recording of
Region 3 as driven by the **view dial**, which no longer exists; regenerating it
off the menus would turn a two-control comparison into a self-comparison that
passes by construction and tests nothing — while still looking like the strongest
check in the file. The within-run two-path test survives any such change and is
the one to keep. Written down here because nobody will be deciding this calmly on
the day a red run blocks a merge.

## The evidence files

| file | what it records |
|---|---|
| `evidence.json` | **this bar** — bare Design/View, the two placeholders, no dial, no wordmark, no tab items, no tab dial. Every assertion passes. |
| `evidence-seven-control-bar.json` | the same bar **before Summary and Print**, 2026-09-28. The base of the 162.3px figure, and the only measurement of that bar there will be. |
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
