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
unnoticed. **What an octagon's roof should actually do is his call.**
