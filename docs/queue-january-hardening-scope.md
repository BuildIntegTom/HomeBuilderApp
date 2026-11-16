# Scope to end of January — Tommy, 2026-11-15

> *"Hardening off for strawpanels.com should start January and hopefully be in
> a good spot by the end of January. We will still be making pretty much most
> of the updates that are queued up until then. Basically scope until then make
> all the pre-designs presentable by then. Major work on courtyard roofs.
> Unnoticed, there's still some glitches happening with Gable end panels."*

## What this changes

**The readiness assessment's date moved.** It was written against a February
opening. The new shape is: **hardening starts January, in good shape by the end
of January**, with queued feature work continuing until then. So the assessment
is not a February document — it is the thing that has to be **true before
January starts**, which means it wants doing in December at the latest, and its
"needs work / weeks" items have to fit inside January.

See `docs/queue-external-readiness-assessment.md` for the eight questions.

## The three named items

### 1. Make all the pre-designs presentable

The eight Home tiles (`apps/web/app/starterTemplates.ts`): Tiny House, The
Tank, Octagon, The Cindy, Square Courtyard, Octagon Courtyard, Draw your own,
and the sign-in tile. **"Presentable" is the acceptance bar for a stranger's
first thirty seconds** — a template is the first building most new people will
ever see, and it is drawn, not loaded, so every defect in the app shows up in
it immediately.

⚠ **Two of the eight are courtyards, and the courtyard ROOF is unmodelled** —
so item 1 and item 2 are not independent. A courtyard template cannot be
presentable while its roof is a scope statement.

### 2. Major work on courtyard roofs

This is **R5** in the spec's Concentric Wall Ring Buildings section
(`building_integrity_app_spec.md`), and the spec already calls it *"the largest
single stage in this workstream, larger than R1"* and recommends it get its own
plan rather than being built off that section. Both forms are wanted, his
words, 2026-09-25:

> *"I imagine most scenarios would be some kind of truss that spans from north
> inner to north outer and around the building giving it a two sloped roof all
> the way around. I can also see the benefit of having a 'shed roof'
> exclusively sloped towards the exterior that goes all the way around the
> building."*

⚠ The ring gable's ridge **runs around the annulus** — a concept the current
gable model does not have. And the roof decision is coupled to a question of
his that is still open: **whether the inner ring wall bears on a foundation**.
A truss spanning inner-to-outer makes the inner ring load-bearing, which looks
like it forces that answer rather than leaving it free.

### 3. Gable end panel glitches

**One found and fixed 2026-11-15** — see the commit. A gable window seeded on a
previous building survived onto the next one and stood through its roof plane.
A second finding came out of it: the elevation and the 3D view **disagree**
about such a window, because one measures against the roof plane and the other
against the gable's own top. That disagreement is now reported rather than
picked between.

⚠ **He said "glitches", plural, and one fix is not a clean bill of health.**
That sweep has now been done — `apps/web/app/gableTemplateSweep.test.ts`, which
walks every Home tile through the real draw pipeline. It found **two more**, and
one fault it could not fix.

#### The two it fixed, both the same symptom from different directions

Both were in `seedGableWindowsForFootprint`, which tiles the gable row a
**second** time to decide which tile may hold a window — and in both cases it
judged a different row than the app builds, so a 48in window ended up on a tile
too short to carry it.

- **Every SHED** (Tiny House, both Octagons). It built its roof-profile point
  without `isExplicitPosition`, so a point stored at x = 0 — which is exactly
  how this app stores a shed — was not recognised as one. Its row grew a
  spurious 1in tile rising 0 to 64in and every ordinal shifted by one. On the
  Tiny House, ordinal 2 was judged at 59.14in and built at **42.83in: 5.17in of
  window standing through its own roofline.** Roughly **one draw in two**.
- **Every PEAK** (The Tank, The Cindy). It counted the ridge column as an
  ordinal, which `seedGableWindows` documents as excluded *"by construction"* —
  an assumption about its caller that the caller broke. On the Cindy every
  ordinal from the column rightward landed one tile late (judged 51.66in, built
  **37.60in: 10.4in proud**) and the **last ordinal was dropped entirely**, so a
  window the seeder promised was never built at all.

⚠ **Neither was reproducible on demand, which is exactly why they read as
"glitches"**: which ordinal gets a window is random. The test therefore does not
draw — it forces a window onto every ordinal that could ever hold one.

#### ⚠ The one it did NOT fix: an octagon's roof does not meet its walls

**Reported, not resolved, because it is a building decision and not a code
question.** `gableEndWallIdsFor` returns the walls facing exactly E/W (or N/S) —
**two of an octagon's eight**. Of the other six, five have roof above them and
**no gable row under it**: open wall of up to **64in on the 16ft Octagon and
128in — 10ft 8in — on the 32ft one.** And the two that do get a row have it
anchored at the eave at both ends, while the roof over those corners is already
45in / 90in up the slope, because an octagon's E facet spans only the middle
third of the building's depth.

The same assumption misfeeds `decideRoofForm`: the app hands it the gable
WALL's length, which on a box is the across-the-ridge span and on an octagon is
one facet. At 32ft across it is asked about **13.25ft**, answers **"shed"**, and
the app builds a shed that would need a **33.7ft roof panel against the 17.1ft
one reaches at 4:12** — a roof his own rule refuses.

⚠ **Both Octagon tiles are Home tiles**, so this lands squarely on item 1 above.
It is pinned by the test's last section so it stays visible and cannot change
unnoticed.

#### ⚠ HIS ANSWER, 2026-11-15 — the shed stays, and the gables get strange

> *"Octagon roofs does not meet, correct. I like the shed style on the octagon
> though as an option. I think octagon shed is possible, there's just going to
> be some very unique gable panels."*

**He is right that it is possible**, and the measurement says what "unique"
means. On a 16ft octagon with a shed falling south, the roof's height above the
eave at each wall's two corners is:

| wall | roof above eave | what the row over it is |
|------|-----------------|-------------------------|
| N    | 64in -> 64in    | a **rectangle** 64in tall — level top, no slope at all |
| NE   | 64in -> 45.2in  | a trapezoid, raked **across** the roof's fall |
| E    | 45.2in -> 18.8in | a trapezoid — **today the app draws this one from 27in down to 0** |
| SE   | 18.8in -> 0in   | a trapezoid running out to nothing |
| S    | 0in -> 0in      | nothing, correctly |
| SW, W, NW | mirrors of SE, E, NE | |

So **seven of the eight walls carry a row**, not two, and **not one of them
starts at the eave**. That is the whole fault in one line: `computeGableTiledRow`
hard-anchors both ends at `eaveHeightIn`, which is true for a box and false for
every octagon wall.

⚠ **The panels themselves are not new geometry.** `buildGablePanelMembers`
already takes an arbitrary left and right height, equal heights included, so the
N wall's rectangle and the NE wall's skew trapezoid are both panels it can
already make. What is missing is **per-wall end heights sampled off the roof
plane** and **a row on every wall under the roof**, not a new kind of panel.
The "unique" part he means is real but it is in the CUT, not in the type: a NE
wall's top edge is a straight line lying in the roof plane while the wall runs
at 45 degrees to the fall, so its rake is neither the pitch nor level.

#### ⚠ The 32ft Octagon cannot be a shed at any pitch — measured

A shed must carry one run of panels clear across. An 18ft roof panel reaches:

| pitch | ground run reached |
|-------|--------------------|
| 2:12  | 17.76 ft |
| 4:12  | 17.08 ft |
| 6:12  | 16.10 ft |
| 8:12  | 14.98 ft |

The **16ft Octagon needs 16.00ft, so its shed works** up to about 6:12 — his
option is already physically available there, and at the 4:12 default. The
**32ft Octagon needs 32.00ft, which no pitch reaches**; `decideRoofForm` puts it
on a peak (16ft a side, comfortably inside) and its own refusal text for the
impossible case names the reason: *"this roof needs a bearing line between the
wall and the ridge, which nothing models yet."*

⚠ So "shed on an octagon" is a 16ft-tile answer. The 32ft tile is a peaked
octagon — **which needs the same per-wall rows**, since a peak over an octagon
leaves the NE/SE/SW/NW facets just as unroofed. The work below serves both
forms; only which form each tile gets differs.

#### ✅ BUILT 2026-11-15 — both octagons' roofs now meet their walls

Measured: **every row on both tiles meets the roof at both ends and at
mid-span, to 0.00in.** Three things did it, and the third is the one that
matters:

1. **`roofSpanFt`** — the building's dimension across the ridge. Two call
   sites measured a gable WALL instead, equal on a box and one facet on an
   octagon. Fixing it makes the 32ft tile peaked (by his own panel-reach rule)
   and the 16ft tile's rise 5.33ft instead of 2.25ft.
2. **Every wall under the roof carries a row** on a mitered shape, not just
   the two facing E/W — six on an octagon. ⚠ The shed's **tall wall is
   excluded**: the cross-tilt row already closes it, so a gable row there would
   build the same wall twice.
3. **`wallRoofTopsFor` / `roofHeightFtAt`** — each wall's roofline taken from
   the roof above **its own two corners**, plus the ridge where one crosses it.
   This is the assumption that was only ever true for a box.

⚠ **No new panel TYPE was needed**, which is the happy part of his "very unique
gable panels": `buildGablePanelMembers` already takes an arbitrary left and
right height, equal heights included. What is unique is the CUT — a NE facet's
top edge lies in the roof plane while the wall runs 45 degrees to the fall, so
its rake is neither the pitch nor level and both ends are up in the air.

⚠ **It also exposed a distinction worth keeping**: "walls carrying a gable row"
and "the two walls the RIDGE runs between" had been the same set, and four
things meant the second — the peak dimension handle (which picked a diagonal
facet), the ridge beam and the plan's ridge line (both of which bail on
`size !== 2` and so vanished on a peaked octagon), and the "only 2 are allowed"
toggle message. `trueGableEndWallIds` is now the pair.

⚠ **Still open, and NOT caused by this** (verified against the diff): the Width
and Depth dimension handles on an octagon read one **facet** (6'-7½" on the
16ft tile) rather than the building's 16ft. `dimensionHandles` was not touched.
