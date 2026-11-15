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
The gable row is the most-edited geometry in the app (ten separate gable
entries in the memory index since 2026-10-29). What has NOT been done is a
systematic sweep of every template and every roof form looking for more. That
is the next piece of this item, not a closed one.
