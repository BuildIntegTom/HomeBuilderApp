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

## Questions for him, before anything is drawn

None of these are guessable, and the first two change the geometry:

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

## Why it is worth doing beyond this one tile

An interior load-bearing wall is the missing piece for every building that is
not a single open volume. The eight current templates are all one room. This
is the first one that is a *plan*.

It also lands inside the [[january-hardening-scope]] item *"make all the
pre-designs presentable"* — a ninth tile raises that bar rather than meeting
it, so the sequencing is his call: Multiplex before hardening, or after.
