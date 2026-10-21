# Drawing walls, deleting walls, and the octagon ring — thinking big, 2026-10-20

Tommy asked to think big about the octagon ring, "as it may relate to other
shapes we can do." It does. What he described — a draw-wall tool that snaps to
corners and panel joints, corner panels that grow a tilted face to meet a new
wall, a delete-wall tool, and shape-moving tools — is not four features. It is
**one change to what a building IS**, plus three tools that fall out of it.

This document is the map, in dependency order, with the three things I found in
the code that change the size of the job.

---

## What is actually there today

Checked rather than remembered:

**1. ⚠ Corner angles are ALREADY per-corner. Mitering is not.**

`cornerAngle.ts` exports `cornerTurnAngleRad`, `isRightAngleCorner` and
`isConvexCorner` — every corner already knows its own angle, and has for a long
time. But the thing that *acts* on it is shape-wide:

```ts
export function isMiteredShape(fp: Footprint): boolean {
  return !footprintIsAllRightAngles(fp);
}
```

One non-right-angle corner anywhere makes the **whole building** mitered. That
flips `gapEndFor` from the least-accessible-corner rule to `computeSafetyEnd`
for every wall, changes corner ownership everywhere, and applies
`markSafetyCorner` across the building.

**So drawing one diagonal wall on a rectangle today would silently re-convention
every corner in it.** This is the single biggest obstacle to the draw-wall tool,
and it is also exactly what his own description fixes: *"Each side of every wall
touching an inclined panel gets this tilted surface"* — touching. Per corner,
not per building.

**2. There is no delete-wall tool.** He thought we had one (*"I think we made
it"*); we did not. The only thing that removes a wall is `handleDragWall`'s
COLLAPSE branch — drag two walls into each other and they merge back into a
straight one, renumbering every survivor. That is a side effect of dragging, not
a tool, and it cannot delete an arbitrary wall.

**3. A footprint is one closed ring, and nothing else is representable.**

```ts
export interface Footprint {
  corners: Corner[];
  walls: Wall[];
}
```

The ring is implied by each wall's start/end corner. There is no loop
membership, so **a second loop — the courtyard — has nowhere to live.** This is
the topology change, and it is the only part of the ring that is genuinely new;
everything else about a ring is ordinary walls.

---

## The spine: make the miter per-corner

Everything else depends on this, and on its own it is the smallest of the four.

A corner becomes a **joint with an angle**, and each wall end carries a **rake**
— the tilt of its end face — derived from that angle. The octagon stops being a
special shape and becomes the case where all eight joints happen to be 135°. A
rectangle with one diagonal wall has two 90° joints and two odd ones, and each
behaves locally.

This is good news for fabrication, because the parts already exist: the
octagon's mitered corner panel **is** the general angled corner panel, already
drawn, already cut, already priced. What changes is who gets one — a per-corner
question instead of a per-shape one.

⚠ **His constraint on the corner panel is the important one, and it is a
fabrication decision, not a drawing one:**

> *"it retiles the corner panel (not the wall, just the corner panel - it stays
> the same dimension except one side gets a tilted side)"*

The corner panel keeps its width. Only its end face rakes over. That means
**drawing a new wall does not re-tile the wall it lands on** — which is exactly
the tile-once model, extended to a new kind of edit. Nothing the user placed
moves.

**Work:** replace `isMiteredShape` at its ~8 call sites with a per-corner
question; give `PanelSlot`'s corner type a rake angle per side; teach the
elevation and 3D views to draw a raked end face (the octagon's already does).

---

## The draw-wall tool

Two endpoints, each snapped to one of:

- an existing **corner**, or
- a **panel joint** on an existing wall.

⚠ **Snapping to panel joints is not a UI nicety — it is what makes the split
free.** Landing a new wall mid-wall splits that wall in two, and if the split
falls on a joint the panels either side divide cleanly between the two new
walls with **no re-tiling and no width to redistribute.** Land it anywhere else
and a panel has to be cut, which is a re-tile of that wall and a different
promise. `insertBumpOut` already splits a wall, so there is precedent for the
mechanics; what is new is choosing the split point by snapping.

⚠ **One thing a split still costs, and it needs his answer.** The new corner
wants a corner panel, and a corner panel has width. Under the dimensional
tightness rule the wall's parts must still sum to the wall, so that width has
to come out of a neighbouring panel. Options: take it from the panel beside the
new corner (changes one part), or let the two new walls each lose a little
(changes two). **Question 2 below.**

---

## Delete, and the trapezoid

His case:

> *"if a user makes new wall tool and adds an enclosed space - so they can
> delete the other wall and have a trapezoid building"*

There are two ways to give him that, and they are not equally safe.

**(a) Split and choose a side — recommended.** A wall drawn corner-to-corner
cuts the footprint into two closed regions. The app offers both, he picks the
one to keep, and the other is discarded whole. The result is **always a valid
closed ring**, because it was one before the cut and both halves are closed by
construction. The trapezoid falls straight out: draw a diagonal across a
rectangle, keep the bigger side.

**(b) A true delete-wall tool.** Deleting one wall from a closed ring leaves it
open, so the app must re-close it — by extending the two neighbours to their
intersection, or by joining the orphaned corners with a straight wall. Both are
reasonable; both can fail (parallel neighbours never intersect) and both can
produce a self-intersecting shape the rest of the app has never seen.

I would build (a) first because it cannot produce an invalid building, and add
(b) afterwards for the cases (a) does not cover. He asked for a delete tool by
name, so this is a recommendation and not a decision — **question 1 below.**

---

## The ring: the only part that is a real topology change

A courtyard building is **a polygon with a hole** — two loops, an outer and an
inner, with the wall between them being... nothing. The building is the space
between the loops.

What breaks, concretely:

| Thing | Why it breaks | Severity |
|---|---|---|
| `Footprint` | No loop membership; walls are one flat list | the change itself |
| `footprintArea` | Must subtract the hole, not add it | small, must not be missed |
| `pointInPolygon` | Needs even-odd so the courtyard reads as OUTSIDE | small |
| **`wallCompassDirection`** | Decides "outward" as *away from the centroid*. An inner-ring wall's exterior faces the courtyard, i.e. **toward** the centroid — so every inner wall would be labelled with the wrong compass direction | ⚠ silent and wrong |
| Elevation views | An inner wall is seen from the courtyard. Which side is "front"? | design question |
| Roof | A courtyard has a valley or two separate roofs | its own project |
| Corner ownership | "The longer wall runs through" is a local rule — unaffected | none |

That compass one is worth calling out: it would not crash or look broken. It
would just quietly call the north-facing courtyard wall "S", and every drawing
would carry it.

**Naming is already decided** (inner ring numbers first), so that part is
settled.

---

## Shape-moving tools

He is right that these are a prerequisite and not a polish item:

> *"We will need some total shape moving tools when that happens so it's easy
> for the user to center and align and drag certain selections of wall shapes
> around."*

A second loop has no defined relationship to the first until you can position
it. The minimum that makes a ring drawable:

1. **Select a loop** (click any wall of it, or a selection box).
2. **Drag it**, with snapping to the other loop's corners and axes.
3. **Centre it** — one button, because a concentric ring is the common case and
   eyeballing it is exactly what he should not have to do.
4. **Numeric offset** — "inner ring 12ft inside the outer", which is how the
   building is actually specified.

⚠ Centring is the one with a real definition problem: centre on the **bounding
box** or on the **centroid**? They differ for any irregular shape, and for a
regular octagon they agree. Bounding box is more predictable and matches what
the eye expects on screen; I would default to it.

---

## Build order

1. **Per-corner miter.** Nothing else is safe without it, and it is the
   smallest. Lands on its own with no new UI.
2. **Draw-wall, corner-to-corner only.** Gives the trapezoid immediately via
   split-and-choose.
3. **Panel-joint snapping.** Extends draw-wall to mid-wall landings.
4. **Shape-moving and centring.** Needed before a ring is drawable at all.
5. **The second loop.** The topology change, once everything that will sit on
   top of it already works.
6. **Delete-wall**, if split-and-choose has not already covered it.

Each of 1–4 is useful on its own, which is the point of that order: the ring is
the last step rather than the first, and nothing is built speculatively for it.

---

## Questions for Tommy

**1. Delete, or split-and-choose?** When a drawn wall cuts the building in two,
would you rather the app ask which side to keep — always a valid building — or
would you rather have a delete-wall tool and do it by hand? (I would do the
first, then add the second.)

**2. When a new wall lands mid-wall, where does the new corner panel's width
come from?** The wall's parts still have to sum to the wall. Take it all out of
the panel next to the new corner, or split it between the two new walls?

**3. On a courtyard ring, which side of an inner wall is the outside?** I assume
the courtyard — weatherproofing, wraps and plaster face in toward it, and the
compass label follows. Worth saying out loud because the code would otherwise
assume the opposite.

**4. Is the courtyard open to the sky?** It changes whether the roof is one
surface with a valley or two independent roofs, and that is its own piece of
work either way.


---

# DECIDED — Tommy, 2026-10-21

All four answered, plus a scope widening. One of them makes the job cheaper
than the document above assumed.

## 1. Split and choose a side — yes

> *"For number one I like your suggestion there."*

A wall drawn across the building cuts it into two closed regions and the app
asks which to keep. A true delete-wall tool stays on the list behind it, for
the cases split-and-choose does not reach.

## 2. ⚠ Nobody gives up panel width — this is cheaper than planned

> *"The new corner panel just gets flush with the wall that's there, it does
> [not] protrude into the new wall. That's what I'm thinking, unless
> structurally really want it embedded. I figure that tying it together with
> GRKs to the old panel would really hold it structurally."*

The document above asked which panel loses the width a new corner needs. His
answer is **neither** — the new wall **butts flush** against the existing
wall's face and is **tied through with GRK structural screws** into the panel
it lands on.

That is not a new convention. It is the app's existing butt-joint rule — *"the
locally LONGER of the two walls meeting there RUNS THROUGH and owns the corner
panel; the shorter one butts flush against it, inset by one wall thickness"* —
applied to a T-junction. So:

- the **existing wall is untouched**: same panels, same widths, no corner slot
  inserted, nothing re-tiled;
- the **new wall** is inset one wall thickness at that end and gets no corner
  panel there;
- the joint is **fastened, not framed**.

**Two junctions, two behaviours, and they do not conflict:**

| The new wall lands... | What happens to the corner panel |
|---|---|
| on an existing **corner** | that corner panel keeps its dimension; one side is **raked** to meet the new wall (his 2026-10-20 description) |
| **mid-wall**, at a panel joint | no corner panel at all — the new wall **butts and is screwed** (this answer) |

⚠ **This reading is mine, from a sentence with a typo in it** (*"it does it
protrude"*). The principle — flush, fastened, nothing embedded — is
unambiguous; which of the two readings of that clause he meant is not. Worth
one sentence from him before the tool is built, because it is the difference
between a fastened joint and a framed one.

## 3 & 4. The courtyard is outside, and open to the sky

> *"The interior side of the inner courtyard wall is the outside. The courtyard
> is open to the sky."*

So on an inner ring wall, the face toward the courtyard is the **exterior**:
weatherproofing, wraps and plaster go on that side, and the compass label
follows it. This confirms the hazard flagged above — `wallCompassDirection`
decides "outward" as *away from the centroid*, which is backwards for every
inner-ring wall, and it would be silent.

Open to the sky means the courtyard is **not roofed**: the outer ring and inner
ring carry a roof between them, and the hole is a hole. On his own estimate:

> *"Octagon ring roof certainly will be somewhat complicated, but that's the
> point of this app to be able to make all this math easy."*

Recorded as accepted scope, and still its own project.

## ⚠ Scope widened: not an octagon feature

> *"This should also be compatible with concentric Square/rectangle buildings."*

The ring is **a second loop**, not an octagon ring. Nothing in the topology work
may assume eight sides. A concentric rectangle has to work the same way, and
the simplest proof that the work is general is that the first test fixture is a
rectangle inside a rectangle rather than an octagon inside an octagon.

---

# BUILT — step 1 groundwork, 2026-10-21

`packages/geometry/src/miteredCorners.ts` — `wallEndIsMitered`,
`wallTouchesMiteredCorner`, `miteredCornerIds`, `cornerRakeRad` /
`cornerRakeDeg`.

⚠ **It changes no behaviour, deliberately.** Every shape the app can draw today
is uniform — rectangles and bump-outs all square, octagons all mitered — so per
corner and per building give the same answer, and a sweep over every drawable
shape asserts exactly that. The difference appears only for shapes the
draw-wall tool will create, which is why this lands first and alone.

Two things worth keeping from building it:

- **The mixed wall is now a test fixture**: a rectangle with one corner cut
  off, which has two mitered corners and three square ones, and a wall with a
  mitered end and a square end. `isMiteredShape` calls that whole building
  mitered — the bug, stated as a passing test.
- **`cornerRakeRad` generalises a number he already approved.** The cut note he
  signed off on 2026-10-13 reads *"22 1/2 degrees off square"*. An octagon
  turns 45° at each clipped corner and the two walls split it. So 22.5 was
  never an octagon constant — it is half the turn, evaluated at the only angle
  the app could draw. A wall at any other angle gets its own number from the
  same rule, and the shop reads it the same way.
