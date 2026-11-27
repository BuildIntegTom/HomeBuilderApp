# The mismatch indicator — build spec

**Queued 2026-11-26.** Tommy: *"I like the mismatch indicator!"*, approving the
split I proposed when he asked about dragging floor and roof panel widths from
the elevation views:

> *"The goal here would be to make it user-friendly to hand edit things to be
> snapped perfectly above and below each other regarding floors, walls and
> roof cohesivity."*

## Why this is the half worth building first

**The drag gesture he described already exists — for wall panels.**
`WallElevationDiagram.tsx` has it, built 2026-10-11 from his own words quoted
in the file: a translucent gold body wash to drag a whole panel, a gold edge
highlight within a few pixels of a boundary, landing on the **1/8 in** grid,
a **24 in floor snap** with a **±2 in** window, and the *"switches spots"*
handoff to the next pair. The maths is `resolvePanelBoundaryDrag` in
`packages/geometry/src/panelWidthEdit.ts`, pure and tested.

What does **not** exist is any awareness of floors and roofs in that view:

```
grep -E "floorPanel|roofPanel|deck" apps/web/app/WallElevationDiagram.tsx
→ no matches
```

So the ask decomposes into two very different jobs, and **they should not be
built together**:

| | job | size |
|---|---|---|
| **A** | Draw floor and roof panel rows in the wall elevation, and mark where their seams do and do not stack with the wall joints | medium, read-only, no new editing |
| **B** | Wire the existing boundary drag to those new rows | smaller, but only meaningful after A |

**A is this document.** It delivers the stated goal — making misalignment
*visible* — without introducing a single new way to change the model.
Dragging without A just moves the problem around by eye.

## What it draws

Three seam sets, projected onto the one horizontal axis the elevation already
uses (position along the wall, in inches from the wall start):

1. **Floor deck seams** — panel boundaries of the floor run beneath this wall.
2. **Wall joints** — the panel boundaries already drawn.
3. **Roof deck seams** — panel boundaries of the roof run above this wall.

For each position where two or more sets have a seam **within a tolerance**,
draw an alignment mark. Where a seam in one set has no partner in another,
draw a mismatch mark.

### The tolerance is the whole design question

⚠ **Do not invent this number.** The modules differ by design —
**24 in for floors and roofs, 48 in for walls**
([[panel_module_2ft_4ft]]) — so a 48 in wall module aligns with every *second*
floor seam and that is correct, not a mismatch. The indicator must therefore
compare **"is there a seam at this position"**, not **"do the seam counts
match"**.

Proposed, and needing Tommy's confirmation before it is a catalog value:

- **Aligned:** within **1/8 in** — the grid the drag already lands on, so
  anything the editor can produce is either exactly aligned or visibly not.
- **Near miss:** within **2 in** — the same window as the existing drag snap.
  This is the interesting category: close enough to look deliberate, far
  enough to be a site problem.
- **Unmatched:** a seam in one set with nothing within 2 in in another set.

A near miss is the one worth shouting about. An exact alignment needs no mark
at all beyond a quiet tick, and an unmatched seam is usually just the module
difference doing its job.

## Where it goes

`WallElevationDiagram.tsx`, as a band above and a band below the wall
elevation — not overlaid on the panels, which are already carrying the gold
drag affordances, the opening dimensions and the girt overlay.

⚠ **Read-only.** No pointer handlers in this stride.

## Build order

1. **A pure function first**, in `packages/geometry/`, e.g.
   `seamAlignment.ts`: takes three arrays of seam positions (inches along the
   wall) and a tolerance, returns aligned / near-miss / unmatched groups.
   Fully testable without a browser, which is this repo's standing preference
   and the reason `resolvePanelBoundaryDrag` is shaped the way it is.
2. **Get the floor and roof seam positions** for a given wall. The deck
   takeoff already computes the runs — `computeDeckPanelTakeoff` and
   `floorRoofPanelRun` in panel-catalog. ⚠ Project them onto the wall's own
   axis; a floor run beneath a wall is not necessarily parallel to it on a
   non-rectangular plan, and on an octagon it certainly is not.
3. **Draw the two bands**, read-only.
4. **Then, separately, B** — and only if he still wants it once the picture
   exists. He may not: seeing the mismatch may be enough.

## Open questions for Tommy

1. **The 2 in near-miss window** — confirm, or give a number. It is currently
   borrowed from the drag snap, which is an ergonomics value, not a building
   one.
2. **Should a near miss reach the Review Log?** It is exactly the kind of
   thing [[overlaps_in_review_log]] exists for, and a proposal that silently
   draws a 1.5 in offset between a floor seam and a wall joint is the quiet
   kind of wrong. My recommendation: yes, once the indicator proves accurate,
   but not in the first stride.
3. **Second story.** The same bands apply between a ground wall's top and the
   second-story floor deck. Worth doing in the same pass, or later?

## Sequencing

⚠ **This must not displace the January pre-design templates**
([[template_readiness_january]]), which is his stated first big goal. This is
editor work and the templates come first.
