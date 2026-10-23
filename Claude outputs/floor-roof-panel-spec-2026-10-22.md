# Floor and roof panels — the fabrication spec, as Tommy gave it

Given verbally over 2026-10-22, in an interview. Every value below is **his own
first-hand decision**, not a researched or industry-typical figure — the same
standing `fabricationMinPanelWidthIn` (24in) has. His words are quoted where
the wording carries the meaning.

> *"Although I do want trusses modeled, I am talking about straw stuffed roof
> panels."*

So a roof panel is a **panel**, not a truss. Trusses are a separate want. That
answers the first question on the queue entry and settles the shape of the cut
list: these are fabricated boxes with members, not assemblies of sticks.

---

## What both panels are

> *"Floors and roof panels are actually quite similar, just inclined or not.
> Imagine a standard panel, except instead of 2x4 studs, they are 2x6s."*

| | Value | Notes |
|---|---|---|
| Depth | **15.5in** | the default for walls, floor and roof alike |
| Width | **19 3/16in** | five to the 8ft — *"so that the panels land on the money"* |
| First and last panel width | **13.25in** | `15.5 − 2.25`, so the panel plus its structural girt totals the wall depth |
| Joist | **a PAIR of 2x6s**, top and bottom | not a single member |

⚠ **A joist is a pair, and the seams double it.**

> *"Top and bottom pair makes one joist… So when the roof or floor panels are
> installed, the overall structure is a bunch of double double 2x6s (two joists
> together make a double and there's two 2x6s per joist)."*

So every seam between installed panels carries **four 2x6s** — two top, two
bottom. That is the number the material list has to produce, and it is easy to
get wrong by a factor of two in either direction.

### How it is built, which decides what the drawing has to show

> *"in the panel compressor table, we would put one joist on one side and one
> joist in the other, shove loose straw in all the voids, compress, and
> repeat."*

The straw is **loose and compressed in place**, not baled — so the voids are
what the drawing needs to describe, not a bale count.

---

## Floor panels only

**The structural girt**

> *"structural girt is a piece of plywood with two 2x4s nailed to the plywood.
> the 2x4s are on the left and right side, the cut edges exposed to the inside
> and outside of the panel."*

- ¾in CDX plywood, with a 2x4 nailed at each of its left and right edges.
- The 2x4s run through the panel's depth; their **cut ends show at the panel's
  inside and outside faces**.
- Overall **2.25in** — one 2x4 thickness plus the ¾in sheet, which is the
  figure he gave first time round (*"1.5" + 3/4" cdx"*).
- Positioned so that the panel's width plus the girt equals the **wall depth**,
  *"so that the girt fully supports the weight of the wall above it."*

**2x4 blocking**

> *"small piece of 2x4 cut to fit the height inbetween the 2x6s starting every
> 3' from the structural girt."*

Floors only. ⚠ Distinct from the anti-twist girts below — the first pass at
this spec read them as one member at two different spacings, and they are two
members.

---

## Roof panels only

> *"the roof panels do not need a structural girt, their weight should be on
> both the inner and outer wyth of the wall panel with the trapezoid shape."*

So a roof panel bears on **both wythes** of the inclined (trapezoid) wall panel
below it, and carries no structural girt.

**The caps**

> *"We need to put a fancy cap on the exterior/bottom side of the roof panels.
> Something like a structural girt except perhaps it's odd angle L shaped. That
> structural cap. The ridge cap is the same thing except to end plumbing cut.
> Girts start from the ridge every 5'"*

- **Eave cap** — like a structural girt but **L-shaped at the roof's own
  angle**.
- **Ridge cap** — the same part, **cut plumb** at the ridge end.
- Anti-twist girts are measured **from the ridge**, not from a structural girt,
  because there is not one.
- **No 2x4 blocking**: *"I guess we dont need blocking between the girts on the
  roofs."*
- The lid 2x4s are **cut at an angle** where a floor's are cut square.

---

## Both: anti-twist girts

> *"there are also anti twist osb girts every 5' starting from the structural
> girt"*

- ⅝in OSB web with 2x4s, **rotated 90° from the structural girt's** — *"one
  2x4 connect the other top chords laterally, and the second 2x4 the bottom."*
- Every **5ft**, from the structural girt on a floor and from the ridge on a
  roof.

## Both: structural lids, inside and out

> *"The exterior lids of floors and roof panels should be a bunch of vertical
> 2x4s, floors cut straight and roofs cut at an angle. These pieces help really
> stiffin that lid with its 2x4 plates going horizontally."*

and, asked whether the inner lid stays plain:

> *"Lets also make the interior lid structural. As many 2x4s (vertically when
> installed) to the face of the lid to entirely cover it - the last may need to
> be ripped."*

So **both** lids are structural: the plate assembly plus 2x4s laid face to face
across the whole lid, **the last ripped to fit**. On a 19 3/16in panel that is
five full 2x4s and a sixth ripped to about 1¾in.

---

## ⚠ Two things that do not follow from the above

**1. The trapezoid blocks are NOT the brace trapezoid we already have.**

> *"We can make triangle blocks to count the trapezoid shape, and a small
> sketch of that space in the shop drawings would be nice I think we already
> have that somewhere."*

Checked: what exists is `computeBraceBoardCornersIn` and the jig note from his
2026-10-13 decision — machinery that cuts a **2x4 to a trapezoid**, and draws
the missing triangle so the shop can build a jig. That is a close cousin, not
the same thing: filling a trapezoid **void** with a block is the inverse
problem. Reusing the cut-note format is realistic; reusing the geometry is not.

**2. A ring roof cannot be all 19 3/16in panels, and his own answer already
covers it.**

A ring roof plane is a trapezoid — the outer edge is longer than the inner,
because the building wraps. Fixed-width rectangular panels cannot tile a
trapezoid. But his octagon-roof description already names the answer:

> *"and then I guess triangle roof pieces around the corners"*

So the rectangular panels fill the middle of each plane and the **corner pieces
absorb the difference** at the hips. Worth stating outright because it means
the panel count per plane is a function of the span and the corner angle, not
just the wall length — and because it is the one place the fixed panel width
and the ring geometry have to be reconciled.

---

## Settled 2026-10-22, same interview

**The eave and ridge caps**

> *"on an installed panel roof, the L plate sits flat on the top plate and
> wraps up plum and has structural small vertical 2x4s."*

So the L is in a vertical plane: one leg flat on the wall's top plate, the
other turning up plumb, with small vertical 2x4s stiffening it — the same idea
as a structural lid. The *"odd angle"* is where the inclined panel meets it,
not between the legs, which are square to each other. The **ridge cap is the
same part with a plumb end cut**.

**The girts' 2x4 orientation**

> *"The structural girts are vertical, all the OSB girts are horizontal 2x4s."*

⚠ The orientation follows the **girt type**, not the panel type. The question
that prompted this assumed a floor's might differ from a roof's; his answer is
one rule for both, which is simpler than the question.

**Where a structural girt goes**

> *"only on exterior ends where panel walls are above."*

Not automatic at both ends. A floor panel gets one where a wall actually lands
and nowhere else; a roof panel never gets one.

---

## ⚠ ONE NUMBER THAT DOES NOT ADD UP, found by building it

> *"19 3/16. that is how wide each floor and roof panel should be - so that the
> panels land on the money"*

Measured: **19 3/16 x 5 = 95 15/16, not 96.** They land a sixteenth shy of 8ft.

The exact fifth of 8ft is **19.2in**, which is not a fraction anyone cuts.
19 3/16 is the nearest sixteenth to it, and five of them lose 1/16in — over a
40ft run, 25 panels, that is 5/16in.

⚠ **And 19 3/16 is a SIXTEENTH, so it is not on the app's own 1/8in grid**:
19.1875 x 8 = 153.5. Neither eighth either side lands on 96 either — 19 1/8
five times is 3/8in under, 19 1/4 five times is 1/4in over.

So "land on the money" and the dimensional-tightness rule pull against each
other here, and which gives is Tommy's call:

1. **Keep 19 3/16** and accept 1/16in per 8ft, absorbed somewhere — but it is
   off the eighth grid, which nothing else in this app is.
2. **Use 19 1/4** — on the grid, 1/4in over per 8ft.
3. **Let the END panels absorb it**, the way they already absorb the wall
   depth: field panels at a round 19 1/4 and the edge ones trimmed to suit.

The builder currently uses 19 3/16 exactly as he said it, and a test records
the shortfall rather than asserting a 96 that is not there.
