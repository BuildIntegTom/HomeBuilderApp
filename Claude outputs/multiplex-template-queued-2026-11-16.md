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
   Both of those walls are **gable ends** under his N–S answer, which is worth
   knowing: a door in a gable-end wall is a ground-storey opening and does not
   touch the gable row above it.
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

## ⚠ ONE QUESTION STRIDE 2 TURNED UP — how many safety gaps does a butted wall get?

**Measured on the 36×36.** The centre wall's clear span is **401in** and it
tiles into 11 slots that sum to exactly 401.000in — his dimensional-tightness
rule holds. But the composition is:

```
standard 48 | safety-gap ¾ | standard 47¼ | standard 48 ×4 |
standard 32⅛ ×2 | safety-gap ¾ | standard 48
```

**Two 3/4in safety gaps, neither of them at an end.** The same 401in run WITH
corner panels produces **one**. The difference is the cornerless path: the
tiler was written for walls that end in corner panels, and both-ends-cornerless
is a case it has not had to answer for before.

⚠ **Nothing is wrong with the arithmetic** — it sums, the panels are buildable,
and each gap is a real shop item that already prices and exports correctly. The
question is a BUILDING one, and it is his:

> **Does a wall that butts another wall at both ends need a safety gap at all,
> or one, or two?** A gap exists to absorb error where a run meets a corner. A
> butt joint is itself a place to take up error — you scribe or shim at the
> butt — so the honest answers range from *none* to *the two it currently
> gets*.

Two gaps costs two extra shop items per interior wall and nothing structural.
It is **not** blocking: the wall is built, priced and fabricated either way.
Recorded rather than quietly decided, because picking one would be inventing a
shop rule.

## Why it is worth doing beyond this one tile

An interior load-bearing wall is the missing piece for every building that is
not a single open volume. The eight current templates are all one room. This
is the first one that is a *plan*.

It also lands inside the [[january-hardening-scope]] item *"make all the
pre-designs presentable"* — a ninth tile raises that bar rather than meeting
it, so the sequencing is his call: Multiplex before hardening, or after.
