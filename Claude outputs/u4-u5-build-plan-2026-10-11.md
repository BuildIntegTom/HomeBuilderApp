# U4 + U5 — Summary and Print as full pages, then the tray dies

**Written 2026-10-11, for Tommy's Tuesday 2026-10-13 meeting.** He asked to
finish the UI queue — U4 and U5 — plus the shop-drawing updates, before it.

**This supersedes nothing.** The authority is still
`Claude outputs/ui-reorg-plan-2026-09-26.md` §13/§14 and its stage table.
This file is the *build* plan: the decisions that document left open, in the
order they have to be taken, with the gates.

## Where the code actually is (verified 2026-10-11, not remembered)

- **U0–U3 are shipped.** The bar has Design ▾ and View ▾ over one
  `handleViewerStopChange`; Settings absorbed Site and the Panelizer; the
  left-bar icon cluster exists; every dial was deleted on 2026-09-29.
- **Summary and Print are `BAR_PLACEHOLDERS` in `TopBar.tsx`** — two
  `disabled` buttons whose `title` says what is not built. **These two
  entries are what U4 and U5 replace.**
- **`editorSurface` does not exist yet** — zero matches in `app/`.
- **The tray is `SectionCarousel` at `page.tsx:12831`**, over
  `allNoteSections` (`page.tsx:7219`): `detail-summary` (Project Summary),
  `project-totals`, `review-log`, then `...relevantDetailPages`. Its header
  holds `Export PDF (n)`, `Choose sections ▾` and `Page size` — the three
  controls U5 relocates. `.editorRightSpacer` is at `page.tsx:11228`.
- **Every section is already a `StickyNote` rendered inline in `page.tsx`**,
  opened via `openNoteIds` / `handleToggleNote`, with `isFullscreen` and a
  per-note `🖶`.

## The one structural decision, and why

The sections are not a data list that a new page can re-render — they are ~27
`StickyNote` elements spread over 1,700 lines of `page.tsx`, each closing over
its own props. **So Summary-as-a-page must not re-implement them.**

**Decision: the full page is a HOST, and the notes that belong to it render
into that host.** Three candidates were considered:

1. **Move the JSX.** Rejected — a 1,700-line relocation of the most
   lint-saturated file in the repo, for a layout change.
2. **Re-render from data.** Rejected — there is no such data; it would mean
   writing 27 sections twice and letting them drift.
3. **Host + portal.** Taken. The Summary page renders a scroll column; the
   notes keep their place in the tree and `createPortal` into it when the
   surface owns them. One mechanism, no duplication, and the notes' own
   props, `isFullscreen` and `🖶` keep working untouched.

⚠ **Read `StickyNote.tsx`'s positioning before writing the host.** If a note
positions itself relative to the viewport rather than its parent, the host
needs a containing block, and that is a CSS fact to check rather than assume.

## The hazard U4 exists to prove against

§13, verbatim: **the drawing must be HIDDEN, not unmounted.**
`FootprintCanvas` holds `viewOffset`, `viewScale`, `showPanelLabels` and the
measuring-tool state in its own component state; `Building3DView` holds its
camera the same way. Unmounting silently resets a user's pan, zoom, label
toggle and 3D camera — **a "nothing is lost" failure no unit test catches and
that reads as a glitch, not a bug.** So: `display: none` on the drawing
region, plus `aria-hidden`, and **a harness check that pans/zooms, leaves to
Summary, returns, and asserts the pan and zoom survived.** That check is the
deliverable of U4, not a follow-up.

⚠ **And `frameloop="demand"` interacts with this.** A hidden `Building3DView`
must not keep rendering. `captureLive` already keys off
`openNoteIds.has("detail-summary")`; hiding the canvas while Summary is open
is exactly the case where a frame would be requested for a canvas nobody can
see. Check it, don't assume it.

## Build order

| Step | What | Gate |
|---|---|---|
| **U4.1** | `editorSurface` state + the bar: Summary stops being a placeholder, becomes the owner-rule control per §11 (`SUMMARY Project Summary`). Drawing hidden not unmounted. Edit tabs stay live and return you to the drawing. | Harness: pan + zoom + select a wall + switch story → Summary → back → all four survive. |
| **U4.2** | The host column, and the Summary sections portal into it: `detail-summary`, `project-totals`, `detail-material-totals`, plus the rest per §9. `review-log` keeps its icon front door from U0 either way. | Harness: each section is present and readable on the page, and the tray still shows them too (the tray is the safety net until U5). |
| **U5.1** | Print as a full page holding **exactly today's controls** — `Export PDF`, `Choose sections`, `Page size`, the per-sheet `🖶`, the card colour coding. **No customization editor; that is U6.** | Harness: `Export PDF (n)` still produces the same n, and the open-print-restore dance still restores what was open. |
| **U5.2** | **Only now** delete `SectionCarousel` and `.editorRightSpacer`; canvas gains 170px. | Nothing is unreachable: every id in `allNoteSections` is reachable from Summary, Print or an icon. **Assert that as a check over the list, not by eye.** |

**U5.2 is the point of no return** — the tray is the safety net in every
stage before it, which is why it is last.

## Open items this plan does NOT decide

- **Summary/Print label order on the bar.** `TopBar.tsx` already records it:
  his list said "Design, View, Print, Summary", his example said "Summary
  Print". Costs nothing either way (71.8px and 55.4px). **Still his.**
- **His right-bar idea, 2026-10-11:** *"perhaps simply by visiblizing the
  right bar when one clicks summary?"* — that is a **third** design, and it
  **conflicts with U5**, which deletes the right bar. Both cannot ship.
  **This plan builds the specced U4/U5 (full pages) and leaves the tray alive
  until U5.2**, so his idea remains buildable until the last step. It has to
  be settled before U5.2 and not after.
- **§13's keyhole collision (a)/(b).** Recommendation (a) stands: the bar
  shows only in-scope tabs. Unchanged by this plan.

## Not in scope, carried forward verbatim from the 2026-09-26 plan

Anything in `supabase/`, `app/auth/**` session logic, `app/cloud/**`;
`PROJECT_FILE_VERSION`; the Privacy Policy and Legal Disclaimer; any wording
in `viewerRole.ts`; any catalog value; the canvas and drawing semantics; the
member colours, panel legend or floor opacity bands; the report-bug backend;
the numbered continuation sheets; and the printing customization editor
beyond U5's relocation of today's controls.

---

## U4.1 design decisions (taken 2026-10-11, after reading the code)

**The editor's real structure**, `page.tsx:10467` and `page.module.css:117`:
`.editorSection` (absolute, inset 0, flex row) holds three flex children —
`.editorSidebar` (240px), `.editorCanvasLayer` (flex 1), and
`.editorRightSpacer` (170px, reserving the tray's width).

1. **The page replaces the CANVAS COLUMN, not the whole editor.** The left
   sidebar stays. Reason: U0 put the Review Log, Read Me, Bug and `?` icons
   in that sidebar precisely so safety-relevant output has *a permanent front
   door*; covering them whenever Summary opens would undo that. §13 says
   "fill the editor", which is ambiguous between the two — **this is the
   conservative reading, recorded as a reading and not as his decision.**
2. **Hiding is `display: none` on `.editorCanvasLayer`.** The alternatives
   were worse: `visibility: hidden` leaves it taking `flex: 1` and squeezes
   the page, and taking it out of flow with `position: absolute; inset: 0`
   changes its measured width by 410px, which is a resize the canvas would
   see. `display: none` changes no measured box, and pan, zoom, the label
   toggle and the 3D camera are all plain JS state that `display: none`
   cannot touch. **The residual risk is a ResizeObserver writing a 0 into
   state on the way down — which is exactly what the U4.1 harness check
   exists to catch, so it is a measured risk rather than an assumed one.**
3. **A new `.notePage` variant, NOT a widening of `docked`.** `docked` is
   `position: static; width: 100%` — already most of what a page needs — but
   it also carries `max-height: 45vh`, deliberately scoped to its single
   consumer (the Elevation view's Selected Panel note). A page must not
   inherit a 45vh cap, and widening `docked` would leak that cap or force its
   one consumer to change. Its own CSS comment anticipates this.
4. **The notes reach the page by CONTEXT, not by 27 new props.** A
   `StickyNote` reads a context mapping note id → host element; where the
   context names a host, the note portals into it and renders `.notePage`.
   One provider around the notes region, zero per-note edits. The rejected
   alternative was threading a `portalTo` prop through all ~27 call sites,
   which is 27 chances to miss one and no compiler to tell you.
5. **U4.1 ships a Summary page with REAL content** — the `detail-summary`
   "Project Summary" section — rather than an empty shell with the sections
   arriving in U4.2. A bar button that opens a blank page is a worse thing to
   ship than no bar button, and the staging gains nothing by it.

---

# AS BUILT — 2026-10-11

## Tommy's two decisions, both taken mid-build

1. **The right bar is deleted, conditionally.** His words: *"As long as
   everything is included in the tabs above, let's delete it."* This settles
   the three-way conflict (his "visiblize the right bar" idea vs. the plan's
   full pages) **in favour of the full pages**, and attaches a condition.
   **The condition is now code**, not a promise: `sectionSurfaces.ts`'s
   `unreachableSections`, computed from the live derived section list,
   published on the editor as `data-sections-unreachable`, unit-tested over
   both a rich and a sparse building, and asserted by the browser harness on a
   real one. If a future section belongs to no page, it is named there.
2. **Bar order: Summary then Print.** *"Order: Summary Print"* — which is what
   was already on the bar, so nothing changed. It had been open since
   2026-09-26, when his list read "Design, View, Print, Summary" and his
   example read "Summary Print". **Closed, not inferred.**

## What shipped

| Stage | As built |
|---|---|
| **U4.1** | `editorSurface` (local state, not `ProjectState`); Summary a real bar control with the owner treatment; the owner rule made four-way on the one line that derives it; the drawing `display: none` but mounted; Project Summary portalled onto the page. |
| **U4.2** | `SectionSurfaceContext` — one provider, zero per-note edits, all ~27 sections. `sectionSurfaces.ts` holds the partition (3 on Summary, every formal document on Print, Review Log by icon) with 10 tests. `.notePage` CSS variant. |
| **U5.1** | Print a real bar control; `BAR_PLACEHOLDERS` deleted entirely; the three tray-header controls lifted into one `printPageControls` definition serving both the page and (briefly) the tray. |
| **U5.2** | `SectionCarousel` usage, component and stylesheet deleted; `.editorRightSpacer` div and both its CSS rules deleted; the dead `next/link` import removed. The canvas gained 170px. |

## Measured, not asserted

- **`ui-reorg-u4`: 11/11.** On a live building: **3** sections on the Summary
  page, **21** on Print, `data-sections-unreachable` **empty**, the tray
  **absent**, `Export PDF` **present**, and the drawing's canvas still in the
  DOM at `display: none` through both pages.
- **Pan and zoom survived**, byte-identical, across a Summary round trip and
  again across Summary *and* Print — against a fingerprint **proved sensitive
  first** (100% → 156% moved it).
- **2,819 tests** pass (was 2,809); `tsc` clean in both projects.
- **Lint 168 / 120 / 48** against a 167 / 119 / 48 baseline. The +1 error is
  `react-hooks/preserve-manual-memoization` 61 → 62, from the two new
  `useMemo`s in `page.tsx` — a file AGENTS.md records as already saturated
  with that rule, which is the recorded exception, and it is named here rather
  than rounded down. **Warnings returned to baseline** (a `no-unused-vars` I
  introduced mid-build is gone, and so is the `next/link` one the deletion
  created). **No correctness rule moved**: `exhaustive-deps` 12, `refs` 29,
  `set-state-in-effect` 12, `purity` 1, `immutability` 1, all unchanged.

## What the harness caught that review would not have

The fingerprint's **calibration check went red first**: synthetic CDP wheel
events moved the view not at all, and the reader had grabbed the first canvas
in the document (720×480 — not the drawing) rather than the largest. Without
that check, the round-trip assertion would have compared a constant to itself
and passed. It now drives the canvas's own Zoom in and Pan buttons.

## Still open

- **U6 — the printing customization editor.** Deliberately deferred. The
  honest blocker is pagination, not the picker: Shipping, Plaster Master and
  Project Summary each run 1–2.5 pages over on any page size, and a
  customization editor built on unverified pagination would let a user arrange
  sheets that do not paginate.
- **§13's keyhole collision (a)/(b)** — recommendation (a) stands untouched.

## ⚠ The two real defects U4.2 introduced, and what found them

Neither was a layout problem, and neither would have survived a code review
looking for one. Both came from the same cause: **opening a section via a page
was a second channel that `openNoteIds` knew nothing about**, and two
behaviours were keyed on `openNoteIds`.

1. **The Summary page came up with no 3D rendering on it.** `captureLive` gates
   the render the Project Summary sheet shows, and it was still waiting for a
   note the tray had never opened. **`summary-capture` went 3/4 and named it.**
2. **`Export PDF` on the Print page would have exported nothing.**
   `effectiveExportIds` defaults to *"whatever is currently open"*, so it read
   `(0)` while the page displayed seventeen sheets — a button that silently
   does nothing. **The harness had only asserted the button was PRESENT**, so
   this one got through until the check was strengthened to compare the count
   against the sheets on screen. It now asserts
   `exportPdfCount === printHostSections`, measured at 17 = 17.

**The fix is one derived set, `effectivelyOpenNoteIds`**, read by the context,
the capture and the export default alike — so "is this section open" has a
single answer. It returns `openNoteIds` *itself* on the drawing surface rather
than a copy, because a fresh `Set` each render would change identity for every
memo downstream, which is the bug that once made one draw take two undos.

## Four harnesses had locators that died with the tray — all loudly

`smearforn-stage-2b`, `smearforn-stage-3` and `summary-capture` all opened
sheets by clicking the tray's button for them, and `ui-reorg-u1` asserted that
Summary and Print were disabled placeholders. **Every one of them failed with a
message that said what it could not find**, rather than quietly finding less —
which is the behaviour the repo's "a locator that has stopped working must go
RED, not quiet" rule exists to produce. They now read the sheets off the Print
page directly, which needs no clicking at all.

`ui-reorg-u1`'s check was **inverted rather than deleted**: Summary and Print
must now be enabled and must open something, still take no part in the view
machinery, and — the part that was always the point — still be `onScreen` at
every width including Tommy's own 710px.
