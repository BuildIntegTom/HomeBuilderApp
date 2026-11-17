# B34 — Multiplex: a home-page pre-draw with a load-bearing centre wall

Queued 2026-11-16. Not started. **Nothing here is designed yet** — this is his
ask written down with the decisions he made, the ones he explicitly deferred,
and the one thing that has to be answered before any of it can be drawn.

> *"i want to be able to have a home page option that says multiplex, with the
> first image going towards a 36x36' square with a straw wall running down the
> center and acting as the ridge beam. all the loads of everything transfer
> down the center row of diving wall panels. this dividing straw wall would
> make for two rectngle studio apartments in this large building. on this
> homepage predraw button, similar to octagon sizes, there should be at least
> the two options for duplex and four plex where its the same drawing, except
> with another story. stairs/decks are gonna be a thing i suppose and maybe
> thats a whole nother strucral commerical thing im not ready for yet... i
> feel like the single story duplex studios is cool tho. heck as steep as the
> roof could be, there could be a loft above each space too."*
> — Tommy, 2026-11-16

---

## What he decided

| | |
| --- | --- |
| **Shape** | A **36 × 36 ft square**. |
| **The centre wall** | A **straw wall running down the middle**, of the same panel system as the rest. |
| **What it does** | It **acts as the ridge beam**. *"All the loads of everything transfer down the centre row of dividing wall panels."* |
| **What it makes** | **Two rectangular studio apartments**, one either side. |
| **The tile** | A Home pre-draw button called **Multiplex**, with sub-options **exactly like the Octagon's two sizes**. |
| **The sub-options** | At least **duplex** and **four-plex**. *"The same drawing, except with another story."* |
| **His favourite** | *"I feel like the single story duplex studios is cool."* So the **duplex is the one that has to be right**; the four-plex is the same thing stacked. |

## What he explicitly deferred

- **Stairs and decks.** *"Gonna be a thing I suppose and maybe that's a whole
  nother structural commercial thing I'm not ready for yet."* ⚠ Which means
  **the four-plex ships with no way to the upper floor**, and that has to be
  said on the tile rather than discovered. A two-storey building with no
  stair is a drawing, not a plan.
- **The loft.** *"Heck as steep as the roof could be, there could be a loft
  above each space too."* A thought, not a decision — and it is coupled to the
  roof pitch, which is why it is listed here rather than built in.

---

## ⚠ THE ONE THING THAT BLOCKS IT: the app has no interior wall

This is not a template. A template is a recipe over `buildRectangleFootprint`
and `addCourtyard`, and **neither can express a wall that ends inside the
building.**

```ts
export interface Footprint {
  corners: Corner[];
  walls: Wall[];
}
```

Every wall in that array is an edge of a **closed loop**. The courtyard, which
is the only multi-loop shape the app has, is a second closed ring with its own
`i`-prefixed corners wound the opposite way (`addCourtyard`) — still loops. A
dividing wall is neither: it is a single run whose two ends are **T-junctions
into other walls**, not corners of anything.

Everything downstream assumes the loop:

- `wallEndIsMitered` / `cornerRakeRad` ask what the *next* wall around the ring
  is. A T-junction has two;
- `outwardNormal` takes its sense from the loop's winding, so "which side is
  outside" has no answer for a wall with building on both sides;
- `wallCompassDirection`, the gap/safety-corner rules, `isMiteredShape`, the
  roof planes (`simpleRoofPlanes` works off the footprint outline), the deck
  cut to the footprint, and the panel namer all read the ring.

**So B34's real content is "a wall can be interior", and the 36 × 36 duplex is
its first customer.** Sizing that honestly is the first task, not writing the
tile.

⚠ And the structural half is just as new: *the centre wall acts as the ridge
beam*. Today a ridge is carried by a **ridge beam on a gable column panel**
([[ridge-beam-bears-on-column]], [[gable-ridge-column-on-peak]]). A
load-bearing centre wall **replaces** that, which means the roof over a
Multiplex has no ridge beam and no column at all — a third roof-bearing
arrangement beside the shed and the peak.

---

## ✅ ANSWERED 2026-11-16 — four of six, including both that move the geometry

| asked | his answer | what it fixes |
| --- | --- | --- |
| Is 36 ft the OUTSIDE dimension? | **Yes, 36 ft outside.** | Each studio is **17'-4¼" clear**, not 18 ft. The tile says 36 ft, like every other template's stated size. |
| Which way does the centre wall run? | **N–S.** | The ridge runs N–S, so the **EAST and WEST walls are the gable ends** and the long roof faces look north and south. |
| Roof pitch? | **8:12**, not the 4:12 default. | ~12 ft of rise over the 17'-4¼" half-span — real loft headroom, which is what his loft remark was reaching for. The loft itself stays deferred, but the pitch no longer blocks it. |
| Four-plex: centre wall full height? | **Upper bears on the lower.** | Two storeys of centre-wall panels, the upper stacking on the lower — the way the app already stacks every wall, and what the 48in module with its centre nailer is designed for (load straight down). No panel taller than anything the app builds, and per-story editing survives. |

⚠ **8:12 is a departure from every other template and is HIS number, not a
default carried over.** Worth saying on the tile, because it changes the price:
a steeper roof is more roof area at the one flat rate.

⚠ **And a fifth, asked and answered the same day: how the centre wall's two
ENDS meet the north and south walls — he chose BUTTS, SQUARE.** The end panels
are square-cut against the inside face of the N and S walls: no corner panel,
no mitre, and **the exterior walls take no new cut and do not re-tile**. That
matters more than it looks — the alternative (corner panels at both ends) would
have made every panel in the N and S walls re-tile around the junction, and a
safety gap at each end would have put a framed void exactly where the ridge
load lands.

## Still open — neither moves the geometry

5. **Does each studio get its own front door, and on which wall?** ⚠ My reading,
   to be corrected rather than asked again: two separate apartments each need
   their own entrance, and with the centre wall running N–S each unit's own
   outer long wall is the natural place — so **one door on the EAST wall for
   the east unit and one on the WEST wall for the west unit**. That is also the
   only arrangement where neither unit's door opens into the other's half.
   ⚠ **Corrected after stride 3:** I wrote here that both of those walls are
   gable ends. They are the opposite — the ridge runs along the centre wall, so
   the gable ends are the **north and south** walls and the east and west ones
   are the **eaves**. A door in an eave wall is a plain ground-storey opening
   with no gable row above it at all, which makes the reading simpler rather
   than harder.
6. **The tile's labels.** Taking the Octagon's shape — button **Multiplex**,
   sub-options **"Duplex"** and **"Four-plex"**, each with its own one-line
   description the way the Octagon's say *"16 ft across"*.

## The original questions, for the record

1. **Is the 36 ft the OUTSIDE dimension, with the centre wall eating into it?**
   At 15½in that gives two studios of **17'-4¼"** clear, not 18 ft. Or is each
   studio a true 18 ft, making the building 37'-3½" across?
2. **Does the centre wall run N–S or E–W?** On a square it is a free choice,
   but the ridge follows it, so it decides which two walls are gable ends.
3. **Roof pitch.** The default is 4:12. His loft remark implies he may want the
   Multiplex steeper than that — and the loft question cannot be answered
   until this is.
4. **Does each studio get its own front door**, and on which wall?
5. **Four-plex**: two storeys of two units, confirmed? And does the centre wall
   run full height through both, or does the upper storey bear on the lower?
6. **The name on the tile** — "Multiplex" is the button; are the sub-options
   labelled "Duplex" and "Four-plex", the way the Octagon's say "16 ft across"?

---

## The build, as strides — scoped 2026-11-17

⚠ **Measured first, because it decides the shape of everything else:**
`footprint.walls` is read **82 times in geometry and 72 times in apps/web**,
and **nothing in the codebase models a wall that is not on the outline** (one
comment in `floorRoofPanelMembers` mentions the idea; no code).

### ⚠ So the centre wall is a SEPARATE COLLECTION, not another entry in `walls`

Putting it in `walls` means auditing all 154 of those reads, every one of which
assumes a closed ring. A separate `interiorWalls` list means **none of them
changes**, and each consumer opts in deliberately. The split falls out cleanly:

| must EXCLUDE it (outline geometry) | must INCLUDE it (per-wall work) |
| --- | --- |
| `footprintLoops`, `offsetFootprint`, `perimeterRing`, `bumpOut`, `ringRoof`, `wallRoofPlane`, `wallCompassDirection`, the deck cut, the plan mitre | the tiler and `retile`, `wallJoints`, `panelSlotBoxes3D`, `panelWidthEdit`, `upperRowWidths`, the elevation view, the fabrication groups, the price, every export |

The first column is *"what shape is this building"*. The second is *"what
panels does this wall need"*. An interior wall is a real wall to the second and
no part of the first — which is exactly what *"a wall can be interior"* means,
and why the new collection is honest rather than a workaround.

### Strides

1. **`interiorWalls` on `Footprint`** — the type, the quantizer, and a
   `MULTIPLEX` template that builds a 36×36 with one N–S centre wall. Every
   existing building byte-identical (an empty list), pinned by a test.
2. **Panelize it** — it tiles like any wall, on his 48in module. ⚠ Its ends
   **butt square** against the N and S walls (his call), so those walls take no
   new cut and do not re-tile. It has no compass direction, so it needs a label
   (`C`, his pick) and its own colour on the B35 chip.
3. **Carry the roof** — *the centre wall acts as the ridge beam*. A third
   roof-bearing case beside shed and peak: the ridge lands on the wall rather
   than on a beam over a column. This is the stride that needs the most care,
   because `ridgeBeamForPlan` and the gable rows both assume a beam.
4. **The Home tile** — Multiplex, with Duplex and Four-plex, at **8:12**.
5. **The rest of the app** — price, takeoff, elevation tab, 3D, exports, and
   B35's own sequence (the centre wall is a ring of its own for *"out to in"*).

⚠ **Not in scope, and he deferred both himself:** stairs and the loft. The
four-plex ships with no way to the upper floor, which has to be **said on the
tile** rather than discovered.

## ⚠ THE SAFETY-GAP QUESTION IS CLOSED — and my measurement was wrong

**What this section used to say:** that the centre wall's 401in cornerless run
gets **two** 3/4in safety gaps where the same 401in run WITH corner panels gets
**one**, and that this made "how many gaps does a butted wall get" an open
building question.

**Re-measured: both get two.** The figure was wrong, and the question it raised
was therefore not a real one. What is true is narrower and worth keeping:

- Swept at every half inch from 48in to 600in, a cornerless run and a cornered
  run of the same length get the **same number of gaps, at the same threshold
  width**, except in **two bands: 48-55in and 385-400in**.
- Both bands are the 24ft rule working as written, not a cornerless defect. A
  further gap lands on **a joint the run already has**, and taking 15.5in of
  corner out of each end moves every joint. (In the 48-55in band the OUTLINE
  run is the odd one: it is too short to hold two corners and a legal middle,
  so they merge into one slot and there is nowhere to put a gap at all.)
- **401in, his own centre wall, is just past the second band.**

**His answer, 2026-11-17:**

> *"Center wall should get a safety gap, not necessarily both ends but a
> similar amount to the threshold we have for all other walls."*

Which is what the tiler already did: one gap one panel in from the far end,
another at the nearest joint to 24ft from it, every one of them exactly the
width `safetyGapWidthForRunIn` gives the run (1/2in at or under 144in, 3/4in
over). Never one at each end.

### ⚠ The one real thing his answer exposed: WHICH end

The first gap's end was a hard-coded `"end"`. Everywhere else in the app that
is his **least-accessible-corner** rule — the gap goes to the end FARTHER
from the corner you cannot reach, so you work toward it and take up the error
at the end you can get to. An interior wall was simply not asked.

It is now `gapEndFarthestFrom`, the same rule, lifted out of `computeGapEnd` so
it can be asked with three points instead of three corner IDs (an interior wall
has no corner IDs at all). **On his 36x36 nothing moves** — A is at `(0,0)`
and the far end of the centre wall is the high-y one, so the constant was
accidentally right. Move the marker to D and the gap swaps ends, which is the
only way anyone would ever have found this.

---

## Stride 3 — the centre wall IS the ridge beam. BUILT 2026-11-17

### ⚠ The ridge did not run over the wall, and now it does

`roofRidgeAxis` puts the ridge along the building's longer dimension and ties a
square to X. So on his 36x36 the ridge ran **east-west, `(0,18)` to `(36,18)`**
— square across a centre wall running north-south, at 90 degrees, with a roof
plane passing straight through it. The wall he described as *"acting as the
ridge beam"* carried nothing at all. Measured before the change.

A wall under the ridge now wins over that rule and over the south-facing
preference, because a roof has to land on something. The **gable ends move with
it to the north and south walls** — they are the ends of the ridge — and
the orientation note names the WALL as the reason rather than claiming the
building is "longer north-to-south", which on a square is a lie a user could
act on by turning the building.

### ⚠ And no ridge beam

His own shed argument from the other direction: *"No catcher beam for the shed
roof, all the load goes down the walls."* A beam catches panel ends that are
over nothing; a wall under the ridge already catches them. A beam there is a
**second load path and a part nobody builds** — priced, weighed, on a shop
sheet, shipped to a site with no gap for it, with ridge posts standing inside a
wall that already runs to the foundation.

`roofNeedsRidgeBeam` is the function that has always answered this, and it had
**no production caller at all** — only its own tests, while the plan view's
derivation kept its own `form === "peaked"` copy of half the rule. It is now
the one gate, so no beam segments, no fabrication group, no price, no posts and
none of the load path or floor girts under them.

Verified in the browser: the Multiplex's shop items are **safety gaps and jack
studs only**, where The Tank's still include its beam and columns.

### ⚠ It refuses rather than guessing

Two conditions, and the second does the work: the wall must be **axis-aligned**
and **centred on the building's own midline**. `simpleRoofPlanes` puts the ridge
at the midline and nowhere else, so an off-centre wall would be drawn with the
planes meeting where the load path is not — worse than having no wall there.
An off-centre dividing wall needs an asymmetric peak, which nothing models.
Two candidate walls refuse too: a roof has one ridge.

A mutation survived the first pass and found a real hole: dropping the off-axis
guard left the centred test doing the work, and the centred test reads
`start.x`, which is only the wall's x if the wall is vertical. A diagonal
*starting* on the midline passed everything. Pinned. Six mutations, all caught.

### ⚠ It also found a defect older than the Multiplex

`decideRoofForm` returns a `refusal` for a building too wide to roof at its
pitch — *"This roof needs a bearing line between the wall and the ridge,
which nothing models yet"* — and **that field has never been read anywhere in
this app.** It is computed in `applyRoofDefaultsForFootprint` and thrown away.

So the app has been quietly building roofs out of panels the shop cannot make:

| building | span across the ridge | panel needed at 4:12 | limit |
| --- | --- | --- | --- |
| **Multiplex 36x36** | 36.0ft | **19.0ft** (21.6ft at his 8:12) | 18ft |
| **The Cindy** | 34'-10" | **18.4ft** | 18ft |

It is a Review Log line now, measured against the **live** form and pitch
rather than by re-running the form decision — a user who has dragged the peak
to an end has a shed, and a refusal describing a peak they do not have is worse
than silence.

**Four ways out, all his:** narrow the building, flatten the pitch, raise the
18ft panel limit (itself his own estimate — *"I have not had any structural
engineer look at these yet. But that's a safe bet for now"*), or model an
intermediate bearing line part way up each plane, which nothing does.

⚠ **This is why his 8:12 is not on the tile yet.** At 8:12 a 36ft span needs a
21.6ft panel, and the building would have to come down to about 29.9ft to fit.
Stride 4 is where the pitch lands, and it needs his answer first.

### ⚠ Stride 3b, named rather than implied

The centre wall's panels are tiled at the **story height**, and the ridge sits a
full rise above the eave — **72in at 4:12 on his 36ft span.** So the part of
the wall that does the carrying is the part that is not built.

The bearing is right: the ridge runs along the wall and no beam is built over
it. What is missing is the row from the ceiling to the ridge, which is the same
shape of part as a shed's cross-tilt row — uniform height along its length,
with both roof planes falling away from its top. It is in the Review Log,
because a wall priced to the ceiling under a roof it is meant to reach is
exactly the silence that log exists to break.

## Why it is worth doing beyond this one tile

An interior load-bearing wall is the missing piece for every building that is
not a single open volume. The eight current templates are all one room. This
is the first one that is a *plan*.

It also lands inside the [[january-hardening-scope]] item *"make all the
pre-designs presentable"* — a ninth tile raises that bar rather than meeting
it, so the sequencing is his call: Multiplex before hardening, or after.
