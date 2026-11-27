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

---

# Addendum — his answers, later the same day (2026-11-26)

## Two of the three standing questions are now closed

**1. Perm ratings — ANSWERED by research, not by him.** He said *"enter
research mode"*, and the numbers exist. Measured at 1.5 in: clay/earth
**10.7–21.9 US perms**, lime **7.8–14.0 US perms**, both far above the 3-perm
code floor. Full transcription of the primary tables, with sources, in
`docs/plaster-perm-and-shear-research-2026-11-26.md`. **The two "not
computable" rows should print a measured range plus a citation plus
`pending-BI-confirmation`.** Printing nothing currently reads as "this wall has
no vapour performance", which is the opposite of the truth.

**2. Determinism — CLOSED, he wants the randomness.** *"There's just something
kind of super actually fun about random seeding. If you click on that path, it
IS a random seed, a unique house to you."* Do not add a fixed seed. The path
for serious work is to save the design or send it off. Consequence to remember:
a browser A/B on a template is never a controlled comparison.

**3. Courtyard-side water path — still open, and still worth asking.** This was
my question and he asked me to restate it, which I have; it has not been
decided. Form (b) of the ring roof does not depend on it. Form (a) does.

## New items he added

- **Separate, explicitly non-structural shear indicators.** His framing:
  *"additional sheer value indicators that most certainly do not need to be
  used/somewhat separate calculation estimate."* The research supports exactly
  this shape — plaster shear stays OUT of the shear derivation sheet, and a
  labelled comparison figure sits beside it. See §4 of the research doc for why
  a pre-plastered panel cannot claim the code table's values as-is (the
  collision is the mesh lap requirement, not the plaster).
- **⚠ Type S lime is not a structural binder.** IRC Appendix S §104.4.6.2
  requires hydraulic or natural hydraulic lime. His 3-coat exterior spec uses
  Type S. Cheap to change at spec time, impossible after. **Flag before any
  wall gets plastered.**
- **Printable building-guide sections** — execution technique for DIYers and
  contractors, as their own print options. He will paste his current detail
  guide in to plan this. §5 of the research doc already lists ten citable,
  checkable instructions (mesh laps, mesh depth, staple gauge and spacing, felt
  placement, binder, bottom-edge support, mixed plasters, aspect ratio, wind
  uplift, coatings) that can seed it.
- **Floor and roof panel widths editable from the elevation view**, with
  visible snapping points, so floors, walls and roofs can be hand-aligned.
  ⚠ The gesture already exists for wall panels; floors and roofs are absent
  from the elevation drawing entirely. The alignment *indicator* is separable
  from the editing and is the higher-value half.
- **Tip4urTime proposal integration, February**, gated on January. Prerequisite
  is share/save/import being solid and safe, plus the security pass he asked
  for himself.

## Sequencing note

None of the above displaces the tiers. His stated first big goal is unchanged:
all pre-design templates presentable by January, Tiny House first.

---

# Addendum 2 — R5 settled, and three builds approved (2026-11-26)

## R5 is now ONE form, and the water question is closed

> *"R5 form a doesn't sound that cool, we can drop the trusses idea. I like the
> ring shed where the inner walls are taller and the outer walls are the lower
> slope of the shed roof. This building in a general sense should look like a
> cinder cone volcano."*

**Form (a) — the trussed ring gable — is dropped. Remove it from R5 rather
than leaving it listed as a stretch goal.** The courtyard roof is a ring shed:
tall inner ring (load-bearing), low outer ring, plane falling down and outward,
cinder-cone silhouette.

⚠ **This closes the courtyard-side water path question for good.** It only
existed because form (a) sent a second slope back into the courtyard. The
outward slope decided on 2026-10-22 stands, for the reason it was given then.
Tier 4's remaining work is the Review Log entry, then form (b) through the
takeoff seam — now the only courtyard roof path there is.

## Three things he approved for building

1. **The mismatch indicator** — *"I like the mismatch indicator!"* A visible
   mark in the elevation view where a floor seam, a wall joint and a roof seam
   do or do not stack. ⚠ Separable from, and higher value than, the drag
   editing; the drag gesture already exists for wall panels.
2. **Disclaimer on the printed page** — *"Disclaimer on the page is an absolute
   must."* There is already a four-role disclaimer system
   (`roleDisclaimers`, `footerDisclaimerFor`, admin/engineer/fabricator/public)
   with a test pinning each role's text verbatim. The work is getting it onto
   the printed/exported proposal, not inventing it.
3. **The plaster research into the app**, for engineers AND as a plastering
   how-to section of the building detail guide — *"It would be nice to have in
   the app calculations shown and source shown."*

## Done in this stride

Clay and lime now carry measured perm values with their citations in the
catalog note, replacing `permWinter: null` + *"No numeric perm rating given in
spec yet."* **These two are `DEFAULT_WALL_INTERIOR_LAYER_ID` and
`DEFAULT_WALL_EXTERIOR_LAYER_ID`, so every project in the app's history has
printed "not computable" on this row by default.**

⚠ **A finding that needs his call, surfaced by filling the numbers in:** lime
measures *less* vapour-open than clay in both independent sources (445 vs 612
ng in Minke; 804 vs 1,073–1,259 in Straube/EBNet's own tests). So the default
clay-inside/lime-outside wall has a tighter exterior than interior, and
`validateVaporOpenness` — which asks only *"is exterior > interior?"* — returns
**false** for it. Both layers are 7.8 and 10.7 perms, an order of magnitude
above vapour-retarder territory, so this is not the failure that rule was
written to catch. **The rule needs a third outcome ("both sides far above
retarder territory, direction immaterial") before this result is shown to
anyone.** Pinned in `permeability.test.ts` so nobody quietly reorders the
layers or nudges a measured number to make it green.

---

# Addendum 3 — four decisions, two builds (2026-11-26, later)

## Decided

1. **Vapour-open threshold = 5 perms, CONFIRMED.** *"Five is great. I like it
   keep it."* Status moves `pending-BI-confirmation` → `confirmed`, and the
   note still records that Claude proposed it and that no code clause states
   it as a threshold — a confirmed value whose provenance gets smoothed over
   is worse than a pending one, because nobody re-examines it.
2. **Lime binder = NHL, CONFIRMED.** *"Yeah I guess we have to go with NHL."*
   NHL 3.5 or 5; sand:lime ratios unchanged at 3:1 / 2.5:1 / 2:1.
3. **The four untracked .docx files stay untracked.** *"You can leave them if
   you do not think they're useful."* They are superseded Claude outputs; the
   live guide is the PDF he supplied. Not committed, not gitignored, not
   raised again.
4. **R5 form (a) dropped** (addendum 2).

## Built this stride

**The plaster shear comparison.** Table 106.16 in the catalog, the calc in
calc-engine, and a row in the **engineer-only** Assembly Performance note.
⚠ `applicable` is the literal `false` on every call and five inapplicability
reasons ship *with* the number. Nothing structural reads it. Verified on the
Tiny House: 80ft × row C2 = 36,000 lb, caveats printed beneath.

## Queued, specced, not built

**The mismatch indicator** — full build spec in
`docs/queue-mismatch-indicator.md`. ⚠ Split deliberately: draw the floor and
roof seam bands and mark alignment **read-only** first (job A); wire the
existing drag to them only after (job B), if he still wants it once the
picture exists. The drag gesture already exists for wall panels; floors and
roofs are simply absent from the elevation view.

## ⚠ New finding from his install guide — needs his call

He supplied the official 28-page install guide. **It has no exterior plaster
section at all.** The primary BI exterior in his own guide is Intello +
Mento/Adhero + wood-fibre board + rainscreen — the Pro Clima path, both
layers already `confirmed` in the catalog.

**But the app defaults to `clay-plaster` interior and `lime-plaster`
exterior.** The default disagrees with his own published system, and it
changes the price and the printed assembly on every new project. **Which
should be the default?** Not switching it unilaterally.

Good news in the same finding: the guide's membrane-over-straw build is NOT
condemned by the research's "no membrane between straw and plaster" rule.
That rule protects the structural bond on a plastered bale wall, and BI
panels never claim plaster shear.
