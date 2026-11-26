# All pre-designs presentable by January — the plan, in his tiers

**His words, 2026-11-26:**

> *"Big priority is having all the predesign templates be done by January,
> that's the first big goal before hardening the app. If we can build a tiny
> house walls roof and floor panels, same for the tank/a gable end example,
> Cindy for trusses and slab and bump in/out shape, and then octagons and
> courtyards would be top tier amazing to get those ducks in a row."*

And, answering the question the spec had held open since 2026-09-25:

> *"Inner walls of courtyard and basically an exterior load bearing wall,
> yes."*

> *"We can ship and build however makes sense."*

## ⚠ This reorders the queue, and the correction is the point

I had picked the courtyard roof (R5) first, on the argument that two of the
eight Home tiles are courtyards and a tile cannot be presentable while its
roof is a scope statement. **He put courtyards last.** *"Top tier amazing"* is
a stretch goal, not the opener. The tiers below are his, in his order.

The shipping order inside a tier is mine.

## The bar

**"Presentable" = a stranger's first thirty seconds.** A template is drawn,
not loaded, so every defect in the app shows up in one immediately. The test
is: draw the tile, open Price, open the shop drawings, and look.

## Tier 1 — Tiny House: walls, roof AND floor panels

The complete set on the simplest shape. 16 x 24 ft, shed roof.

Measured 2026-11-26: 76 panels — 19 wall + 14 gable + 7 tilted gable + 13
floor + 12 roof + 4 window header/sill pairs + 3 door headers, plus 6 safety
gaps. All three families are present and priced.

- [x] **The proposal's picture had no roof and no floor.** Fixed 2026-11-26 —
      see the spec entry. It affected every tile at once.
- [ ] Walk the shop drawings for CHECK rows and refusals.
- [ ] Walk the Review Log.

## Tier 2 — The Tank: a gable end example

24 x 48 ft, peaked at 4:12. Measured 2026-11-26: 141 panels — 38 wall + 19
gable + 25 floor + 48 roof + 4 window header/sill pairs + 3 door headers.

- [ ] The gable end is the thing on show here, so the gable row is what to
      read: joints, the ridge column, the peak, the window seeding.

## Tier 3 — The Cindy: trusses, slab, and the bump in/out shape

55'-3" x 34'-10". Three distinct subjects in one tile, and the only tile that
exercises any of them:

- [ ] **Trusses** — the roof truss layout editor and its parts.
- [ ] **Slab** — the thermal slab foundation, end to end into the takeoff.
- [ ] **Bump in / bump out** — the non-rectangular plan.

## Tier 4 — Octagon and both courtyards ("top tier amazing")

### The courtyard roof, as measured on 2026-11-26

⚠ **The spec's Concentric Wall Ring section says R5 is "PLANNED, NOTHING
BUILT". That is stale.** What is actually there:

| Piece | State |
|---|---|
| `ringRoofPlanes` — facet pairing, spans | built; **1** production call site |
| `divideRingFacet` + `buildTaperedPanelMembers` | built; same single call site |
| `ringRoofSlopedPlanes`, `ringRoofSurfaceAreaSqFt` | built; **0** production call sites |

That one call site is `Building3DView.tsx`'s `ringRoofRenderData` memo. **The
whole courtyard roof lives inside a 3D rendering memo.** Nothing in
`deckPanelTakeoff.ts`, `projectExportAssemblies.ts`, the shop sheets, the
panel numbering, the weight or the price knows a ring roof exists — and
**no Review Log entry says so**, so the app draws a convincing roof that costs
nothing.

`ringRoofSurfaceAreaSqFt` is the only genuinely sloped roof area in the whole
app and nothing calls it; the 3D view re-derives the heights itself.

**So tier 4's real work is the takeoff seam, not the geometry.**

### What his answer unblocked, and what it did not

Form (a), the **ring gable** (a truss spanning inner-to-outer, two slopes all
the way round), was blocked on whether the inner ring bears on a foundation.
It does. Form (b), the **ring shed** (one plane falling outward), is the one
already half-built.

⚠ **The water question is NOT settled by it.** The slope decision of
2026-10-22 was *outward, high at the courtyard*, and the reasoning was
explicitly that courtyard-facing straw stays the driest part of the building.
Form (a) adds a second slope falling INTO the courtyard. **Ask before
building form (a).**

### Suggested order inside tier 4

1. A Review Log entry saying the ring roof is drawn but not costed — small,
   honest, and it stops the app overstating itself in the meantime.
2. Form (b) through the takeoff seam: the ring shed becomes real panels with
   sheets, numbers, weight and price. This is what makes the two courtyard
   tiles presentable.
3. Form (a), after his answer on the courtyard-side water path.

## Standing questions for his next check-in

1. **Clay and lime plaster have no numeric perm rating**, so every template's
   proposal prints *"Assembly permeance: not computable"* and *"Vapor-openness
   rule: not computable"*. Does he have ratings for them, or should those rows
   be withheld rather than printed as "not computable"?
2. **The same template drawn twice gives a different price** — $45,268.21 and
   $45,269.16 on two draws of the Tiny House. The window seeder places one
   window per 12ft of wall at random. For a *pre-design* this may be wrong:
   should a template be deterministic?
3. **Form (a)'s water path**, above.
