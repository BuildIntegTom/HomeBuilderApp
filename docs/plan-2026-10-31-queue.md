# Where we are, and what's next — 2026-10-31

Written at Tommy's request: *"take a step back after your current task to
organize and plan all we've talked about today and make a plan to proceed."*

This is the state of the roof/gable/panel work after today, what is actually
done, what is open, and the order I'd take the open items in. It is a plan,
not a commitment — the sequencing is my recommendation and the scope calls
are yours.

---

## 1. What shipped today

Eight commits, all on `main`, all with the full suite green and lint at its
168/120/48 baseline.

| | |
|---|---|
| `62cc0fa` | Gable ends run to the top of the roof panels; roof stops at them; Settings → Panelizer toggle |
| `96e1379` | Ridge beam lands on a gable column panel, carried down every story + floor girts |
| `639f523` | Eave plumb-cut; gable row corner to corner; roof anchor uses plumb thickness |
| `e287ac5` | Gable top plate flush with the roof's top surface |
| `9f728c0` | Eave rebuilt as a bird's mouth; gable row fix reaching the elevation view |
| `331a99f` | Shed's west gable unflipped; cross-tilt panel rebuilt; roof end webs; bottom chord taper |
| *(pending)* | Truss heel seat off when gable ends run full height; full-page Summary/Print; box views draw the real silhouette |

### The one lesson worth keeping

Four separate rounds of "the gable isn't flush" all came from the same
class of error: **a distance measured in the wrong frame.** The three
conversions of a board's half-thickness on a rake — `d`, `d × cos`,
`d / cos` — were each used in the wrong place at some point, and none of
them broke a test or showed up in a screenshot.

The fix that finally held was structural, not arithmetic:
`roofTopAboveRooflineIn` is now the single source for that distance and
**both** the roof's anchor and the gable's lift read it. Flush is true by
construction.

**The rule going forward:** when two parts have to meet, assert the
*junction*, not either side of it. `gableMeetsRoof.test.ts` and
`floorRoofPanelOutline.test.ts` are both written that way.

---

## 2. Open — and what I'd do first

### Tier 1: things that are wrong on screen now

**1.1 — ~~The 1″ sliver tile at the start of every gable row.~~**
⚠ **I was wrong about this, and the correction matters more than the
original claim.** I wrote that the first tile of a gable row (`0→1,
1→49, 49→97, …`) was *"a real, priced, fabricated panel instance one
inch wide."* It is not. It is the **0.75″ safety-gap panel** —
`safetyGapWidthForRunIn` returns 0.75, and a safety gap starts every
gable row by design. It is a sheet of plywood between panels, which is
what it is supposed to be. Nothing to fix.

**What the hunt did turn up is a genuine defect, now fixed** (below):
once the truss heel seat stopped holding the gable row off the corners,
a shed's row reaches the corner where its roofline height is **zero** —
and `buildGablePanelMembers` was handed a panel shorter than its own two
skins. It built one, with **negative stud lengths**, straight into the
cut list (`stud_corner_1 = -0.50″` at a 1″ tile).

Underneath that sat the larger one: **the 3D view had been lifting
gables to the roof's top surface since 2026-10-30 and the cut list, the
shop drawings, the materials and the pricing had not** — every gable
panel in the building described 16 3/8″ shorter than the one on screen.
`gableTileRoofTopLiftIn` now answers for both.

**1.2 — A shed's gable row should not need a profile point at `x=0`.**
With the point at the wall's start the row comes out as a spike (`0 → 53″
in one inch`), and at the wall's end it comes out clean. Today's fix picks
the right end per wall, which hides it — but the underlying asymmetry is
still there and will bite the next person who places a point at `x=0`.

**1.3 — Verify today's fixes on a real draw.** I could not resolve the
junctions in the preview pane at any viewport I tried. Everything below
Tier 1 should wait until you have eyes on 1.1–1.2.

### Tier 2: the big one you named

**2.1 — Floor, roof and gable panels in the documents.**
*"Project summary only lists 32 panels for the walls… Let's start include
floor and roof and gable end panels on shop drawings, materials
calculations, weight calculations, plaster master, etc."*

This is the largest open item and it is mostly plumbing, not geometry: the
panels exist and are fully modelled, they are simply not in the pipelines
that count, price, weigh and draw them. It touches the summary, the
materials and fastener tables, the weight/carbon breakdown, Plaster Master
and the shop-drawing set.

⚠ **It needs an interview before any code**, which you already said. The
questions I have:
- Do roof and floor panels price at the roof rate, the wall rate, or their
  own? (The roof *bucket* already exists for gable/box-beam/truss-plate.)
- Does Plaster Master apply to a roof panel's underside, its top, or
  neither?
- Do floor panels carry a bottom skin in the materials count? (The clay/
  steel skin is already a Plaster Master default.)
- Does a shop drawing per *panel type* suffice, or does each tapered/
  plumb-cut variant need its own sheet?

### Tier 3: editing model — the idea you floated today

**3.1 — Cross-tilt as a first-class panel type.**
It is currently spawned automatically on a shed's tall wall and cannot be
chosen, edited or removed. Making it a type is a precondition for 3.2.

**3.2 — Parametric face tilts in the Panel Editor.**
*"parametrically make editing panels to tilt or inclined or decline one way
or another on any face would be AWESOME."*

Worth saying: **the geometry for this already landed today.**
`sectionCornersIn` is exactly "an arbitrary profile in the depth × height
plane", and it is what the cross-tilt panel, the roof's plumb cuts, the
bearing wedge and the eave seat are all built from. A general "tilt this
face by N°" control is a UI over a representation that now exists. This is
the cheapest big feature on the list *because* of today's work.

**3.3 — Right-click context menus on panels and groups.**
*"right clicking an object/group in the app an easy way to see a menu for
items such as edit panel options/delete/replace/move."*

Entirely doable — a right-click handler that suppresses the browser menu
and opens our own. Worth doing after 3.1/3.2 so the menu has the options
worth showing. ⚠ One caution: it must not break the existing click-to-cycle
editing or the sill/header drag tool.

### Tier 4: already queued, unchanged

- Panel Editor UI + cloud panel library
- Engineer review (three stages: invite, red-bubble edits, resin/export)
- Exports: **CSV → DXF → IFC**. ⚠ You asked where the CSV/DXF export is —
  **it does not exist yet.** Only OBJ is built. Nothing is hidden; it is
  still on this list.
- Seed Collaborate: 475 Mento membrane, furring strips, siding
- The four remaining overlap causes
- Ring-roof pitch control
- Corner bevel vs two-incline panel decision

---

## 3. Suggested order

1. **1.1 and 1.2** — small, measurable, and they finish the junction work
   properly rather than leaving it at "0.33 inches".
2. **You look at a real draw** and confirm Tier 1 is actually done.
3. **2.1 interview**, then build it. This is the one that changes what the
   app is *for* — a summary that counts 32 of a building's panels is not a
   proposal anyone can send out.
4. **3.1 → 3.2 → 3.3** as one arc. The representation is already there.
5. Tier 4 as it comes.

## 4. One thing I'd push back on

Nothing in Tier 1 or 2 is blocked. But I would not start Tier 3 until 2.1
is done. The editor work is more fun and more visible, and it will make the
document gap *worse* — every new way to make a panel is another panel the
summary does not count.

---

# Queue added 2026-11-01

Tier 2 shipped in full on 2026-11-01 — `8d98b9a` (one floor/roof takeoff),
`0a713cb` (counts, materials, weights), `a9ccf0e` (floor/roof/beam pricing),
`b1de294` (the roof's own assembly + real sloped area), plus `4eec77c`, the
mobile-draw crash hotfix. What follows is what Tommy raised afterwards, in
his own words, in the order he raised it.

## A. Exporters — `.dae` (DONE), and what it does not do

> *"can we add .dae to the types of exports this app can do? I think that
> might work well uploading into free SketchUp. The goal with exporter
> options is to be able to export the object (ideally as parametric groups
> of objects) into SketchUp."*

**Built.** `buildBuildingCollada` + an `Export as COLLADA (.dae)` button
beside the OBJ one, off the same single walk of the building. Panel groups
are named the way the schedule names them (`N1`, `N4+5`, `E3`).

⚠ **Two corrections to the premise, both measured rather than assumed:**

1. **SketchUp's FREE web tier will not open a `.dae`.** Its import list is
   `.skp`, `.jpg`, `.png`; `.dae`, `.stl` and `.dwg` are subscriber-only.
   Desktop SketchUp imports COLLADA normally, and free *desktop* SketchUp
   has not existed since SketchUp Make was retired — so "free SketchUp"
   today means the web app, which will refuse this file.
2. **COLLADA is not parametric.** It has no notion of a Dynamic Component's
   attributes. This gives named, individually selectable groups in the
   Outliner. A panel whose width can be typed *inside* SketchUp is the DC
   path — a Ruby script run in SketchUp against Cameron's library — which is
   still blocked on that conversation. The `.dae` is a reasonable input for
   that script later; it is not a step toward it on its own.

**Still open on exports:** CSV and DXF, neither of which exists yet.

## B. The 2026-11-01 bug list — a 16' x 20' building, gable roof

Seven items, verbatim, with what each one actually means for the code.

### B1. Gable/inclined panel corners are not plumb cut
> *"The corners of the gable end panels are not plumb cut, see attached
> screen shot. This applies to any gable or inclined panel, may be some
> tricky geometry involved to keep it all dynamically proportional/
> parametrically accurate."*

His sketch (`docs/2026-11-01-gable-corner-not-plumb.jpg`) marks the sloped
top edge (red/yellow) against the panel's end
(green): the end should run PLUMB, and today it is cut square to the slope.
Same family as the roof panel's plumb tall end, settled 2026-10-29 — but
that fix went into `buildFloorRoofPanelMembers`, and the gable builder
(`buildGablePanelMembers`) never got it. Affects gable, cross-tilt and any
future inclined panel, so the plumb-cut geometry wants to be shared rather
than written a third time.

### B2. A truss plate ring under BOTH the gable ends and the roof
> *"the gable ends sit directly on the wall panel top plates, while there is
> a several inch gap under where the roof panels bear. On top of the first
> layer of wall system, there should be auto spawned a truss plate detail -
> two 2x4's and a default 8.5" piece of timber HP insulation. The gable end
> panels and the roof panels should both sit directly on this 2x4 top wall
> ring."*

⚠ Real building values: **two 2x4s** and **8.5in Timber HP** are his, so
they are `confirmed` with this quotation as provenance. Nothing else about
the detail is — no fastener schedule, no bearing figure. A truss plate
assembly already exists (`buildTrussPlateMembers`, `trussPlateInsetDefaultIn`
— the inset is `pending-BI-confirmation`); this is about making it spawn
automatically on the wall ring and making BOTH the gable row and the roof
bear on it, which is what closes the several-inch gap he is seeing.

### B3. Gable panel slots do not line up with the wall panels below
> *"The gable end panels do not directly line up with the studs of the wall
> panels underneath - let's figure out how to match these two layers of
> panel slots up, and adjust the bottom row if needed."*

The gable row is tiled by `gableTiledRow` against the roofline; the wall
below is tiled by the wall tiler. Nothing couples them, so a gable stud
lands mid-bay. "Adjust the bottom row if needed" is the important half —
he is willing to move the WALL to suit the gable. Relates directly to the
2ft/4ft module decision (walls 48in with a centre nailer).

### B4. Safety gaps and headers missing from 3D Framed
> *"the safety gap panels and pink headers don't populate into the 3D frames
> view."*

Both have real members (`buildSafetyGapMembers`, `buildWindowHeaderMembers` /
`buildDoorHeaderMembers`) and both reach the cut list — so this is the
framed view's own member selection dropping them, not missing geometry.

### B5. Gable girt rules by the SHORT stud
> *"If the shorter height of a stud on a Gable end panel is less than 2',
> then no girts are needed. I am seeing a lot of girts/noggings very close
> to each other on gable end panels. If the shorter stud length (or really
> from bottom of panel to top tip of shorter stud member) is between 2-3',
> then one girt should be placed, it's top height flush with the lower butt
> corner of that shorter stud. Gable end panels 3'+ should follow the
> typical girt rules (one for every 3' or less so that there are no spaces
> that are 3' that aren't braced laterally. Whatever the top height of the
> pointy tall end of a Gable end panel is is less relevant for this
> equation."*

A complete, unambiguous rule, all his — so it is `confirmed`:

| short stud (panel bottom → top of the shorter member) | girts |
|---|---|
| under 24in | none |
| 24in–36in | exactly one, its TOP flush with the shorter stud's lower butt corner |
| 36in+ | the standard rule: one per 36in or less, no unbraced gap of 36in |

⚠ The driver is the SHORT edge, explicitly not the tall point. Today
`GABLE_GIRT_ROW_COUNT` is a fixed count spread over the shorter stud span,
which is exactly why he is seeing girts bunched together.

### B6. Header panels overlap, and lose their plywood sides
> *"I am seeing some minor overlapping in header panels. The 3/4" plywood
> skins on the side I don't think are necessary, and should be replaced with
> regular 2x4 studs vertically like a standard panel. This may bring that
> tip and angle of the diagonal towards the center of the header panel a
> little bit."*

Two things: an overlap to find (the standing no-overlapping-members rule),
and a real build change — the side plywood becomes vertical 2x4 studs, which
moves where the W-brace diagonal lands. He has already said he expects the
diagonal to shift; that is permission for the geometry to follow, not a
separate decision to go and ask about.

### B4 — ANSWERED, and nothing was missing

His hint: *"It's either for an old safety gap braced combo panel that
doesn't make sense anymore and/or extra spaces left open from column panels
being a fixed width trying to fill a bigger slot. I don't see any 3D
rendering on for example s4 of a 16x20' building. Wall row."*

**Measured, by instrumenting the framed view's own `slotRenderData` on a
drawn building.** Every slot builds members and every member set fills its
box exactly:

| panel | type | box | members span |
|---|---|---|---|
| S3 | door | 34.13in | 34.13in |
| **S4** | **safety-gap** | **0.75in** | **0.75in** |
| S5 | braced | 48in | 48in |
| S6+7 | window (header + sill) | 34.13in | 34.13in |

**S4 is a 3/4in safety gap, drawn at 3/4in.** On a 20ft wall in a 560px
viewport that is about half a pixel — it is rendering, and it cannot be
seen. Nothing is absent: safety gaps even carry their own colour override
(the orange slivers visible in the framing), and a window slot builds 26
members including its header.

⚠ **The 2D plan gives a safety gap a CALL-OUT ARROW for exactly this
reason** and the 3D view gives it a colour and no leader. That is the real
gap, and it is a design question rather than a defect: should a 3/4in panel
get a call-out in 3D, or be drawn at a visible minimum (which would lie
about its size)? Tommy's call.

**His second hypothesis WAS a real latent bug, and it is fixed.**
`buildColumnPanelMembers` is hard-wired to the nominal 25.5in on the stated
grounds that *"nothing in the app ever asks for another one"* — true of the
tiler, not true of a stored file or a hand-dragged width under tile-once.
The corner builder had been fixed for precisely this; the column had not.
Three places now pass the real width: the 3D wall slot, the 3D gable column
tile, and page.tsx's materials/weights and Shop Fabrication builders.
Bearing is deliberately NOT widened with it — a wider column's built-up
capacity is an open spec item.

### B7. Panelized Floor is the default; Bale Foundation is opt-in — DONE

> *"Bale foundation is default selected and it makes the floor look really
> messy. I found that if I unclick Bale foundation, the really nicely
> forming floor panels are much more clear to understand. Let's default Bale
> floor off and turn it on to repopulate a different floor plan when it is
> selected. Right next to Bale floor button to the left of it. There should
> be a default selected button that says panelized floor."*

`floorSystemId: null` already meant exactly "the floor panels and nothing
laid over them". It has a name and a button now — first in the group,
selected by default — and Bale Foundation is something you turn on. ⚠ Given
a name rather than a new `"panelized"` id on purpose: every project ever
saved stores `null` or `"bale-foundation"`, so a new literal would make all
of them load with no button pressed, for a state the app already had.

⚠ **One consequence worth knowing:** Plaster Master's floor-bottom clay +
steel mesh skin is gated on the Bale Foundation (`hasSteelClaySkin =
isBaleFoundationFloor && floorBottomSkinEnabled`). With Bale off by default
that section no longer appears by default — which may or may not be what he
wants, since his Tier 2 note said *"default is floor bottom is clay
plaster/metal mesh"*. Flagged rather than changed: whether a PANELIZED floor
also gets a rodent/air-sealed bottom skin is a real building question.

## C. Suggested order

1. **B4** — smallest, and it is a view lying about what the building has.
2. **B5** — a complete rule of his, self-contained in the gable member
   builder, and it is visibly wrong on every gable panel right now.
3. **B1** — the plumb cut, shared between gable/cross-tilt/roof rather than
   written a third time.
4. **B2** — the truss plate ring. Biggest of the seven, and both B1 and B3
   touch what sits on it, so it wants to come after B1.
5. **B3** — slot alignment, with the 2ft/4ft module decision in hand.
6. **B6** — header rebuild.
7. Exports: CSV, then DXF.
