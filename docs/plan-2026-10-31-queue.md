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

**DONE, 2026-11-01.** The cut-list note on the gable's top plates and top
skin had claimed *"Ends are plumb-cut (vertical), flush to each corner stud's
face — not square to the rip"* since long before the geometry did any such
thing: `tiltedMember` draws a rectangle rotated about its centre, so the ends
came out square to the rip and the note described a cut nobody was drawing.
They are real parallelograms now, and the corner studs' tops are cut to the
rake instead of left as flat boxes. One `topAtXIn` is read by the skin, both
plates and all four studs, so they meet on shared faces — which took the
gable's one recorded member overlap (*the sloped top plate clipping its own
skin*) to zero, and it is now held to zero like every other clean panel.

⚠ Still open from this item: the CROSS-TILT panel. Its tilt runs through the
panel's depth rather than along its width, so "plumb cut" means something
different there and it was not touched.

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

## D. Added to the queue 2026-11-01, after the B-list

### B8 — the row's own documents (DONE this pass, with one thing pinned)

> *"Let's finish B1 with the tilted gable panels populating upon draw,
> material counts, screw counts, etc, along with shop fabrication pages."*

The cross-tilted row existed only inside `Building3DView`, as a loop that
built members and threw everything else away — so a shed's tall wall grew a
row of real framed panels that **no document knew about**: no panel count, no
plywood or board-feet, no project weight, no screws, no price, no shop sheet,
and not in the OBJ or COLLADA export either. `apps/web/app/crossTiltTakeoff.ts`
is now the one takeoff both the view and the paperwork read, the same answer
the floor and roof decks got.

"Populating upon draw" was also literally true: the wall ids were **state**,
set once in the fresh-draw effect off the drawn form and the DEFAULT pitch.
Edit the roofline profile to a shed afterwards and no row appeared; edit it
away and the row stayed behind on a wall that had become a gable end; and it
was never in the project file, so a saved shed re-opened with no row. Derived
from the live roof now, so all three answer themselves.

⚠ ~~**PINNED, NOT FIXED**~~ — **FIXED 2026-11-01**, see B11 below. What
follows is the diagnosis as it stood. Adding the panel to `memberOverlap.test.ts` (it had
never been audited, for the same reason it had no documents) found five real
interferences, every one of them on the low/exterior face:

```
cross_tilt_bottom_plate_exterior x cross_tilt_stud_exterior_0
cross_tilt_bottom_plate_exterior x cross_tilt_stud_exterior_1
cross_tilt_bottom_plate_exterior x cross_tilt_top_plate_exterior
cross_tilt_stud_exterior_0       x cross_tilt_top_plate_exterior
cross_tilt_stud_exterior_1       x cross_tilt_top_plate_exterior
```

It is arithmetic, not a geometry slip. At the exterior face the panel's own
layers need `0.75 + 1.5` of bottom stack and `2.25 / cos(rake)` of top
assembly — **4.62in at 4:12** — and the row is built with a 3.5in low height.
There is no room for the stud, and the two plates run into each other.

The 3.5in is `PLATE_2X4_WIDTH_IN`, this app's own stand-in; he never gave this
panel a height. Three ways out, and which one is right is his call:

1. **Raise the low edge** to the layer stack plus a real exterior stud
   (~8.1in at 4:12 if the stud is one 2x4's width). ⚠ This makes the row
   taller, and the roof does not move with it — the roof is laid from
   `gableEaveHeightIn`, which this row is not part of. So it may push the row
   up through the roof until B2 settles the bearing ring.
2. **Taper to a solid edge** — one plate instead of two where the panel is too
   shallow for both, which is how a tapered sleeper is really built and needs
   no new dimension.
3. **Refuse** below the minimum and draw no row, which is the strict reading
   of his dimensional-tightness rule but loses the row on a 4:12 shed.

### B9 — a gable ridge beam should land ON its column panel, not through it

> *"gable end column panels' tops should be flush/meet the bottom of the
> gable ridge beams. This means the column panel should be shorter, rather
> than having the beam run through the panel as it currently does. The beam
> should air on top the panel."* — Tommy, 2026-11-01

Same class as the gable/roof flush junction and as B2: a bearing member drawn
passing through the thing it bears on. The column panel's height is derived
from the roofline, so this is a question of subtracting the beam's own depth
from that derivation — and of making sure the number that moves is the
PANEL's height, not the roofline, so the pitch readout does not shift (the
mistake `gable_ends_full_height` records). Also an overlap the audit should
see once fixed.

### B10 — the gable/tilted rows as a second layer on the 2D PLAN, set out from the wall

> *"On 2D plan view.... Additional layers of panels appear 2' directly
> outward of the first floor walls. That would perhaps help everything line
> up, and to be able to visually edit it. The 2' is arbitrary, but for the
> north wall's shed gable panels, they would appear on 2d view a few ft north
> of the north wall. And that way all the panel editor tools for Gable ends
> can also be on the same 2d plan view editor where most of the editing
> happens anyways."* — Tommy, 2026-11-01

An exploded plan: each wall's upper rows drawn as their own strip offset
outward from that wall, so the gable row, the tilted row and the wall row all
appear in one plan, one above the other, and the plan editor's tools reach
them. That answers B3's *"let's figure out how to match these two layers of
panel slots up"* by making the mismatch visible while you edit, instead of
only in elevation.

⚠ **It does NOT address the cross-tilt low-edge problem (B8).** That one is a
dimension in the panel's SECTION — the 3.5in exterior face is too shallow to
hold two plates and two skins — and no plan view can show it, because a plan
has no height. What B10 would give is the place to SET that height once it is
decided, which is the useful part.

Scope notes before building: the offset is a drawing convention, so it must
never reach a cut list or a coordinate the 3D view reads; the strips want to
be selectable and hit-tested independently of the wall under them; and a
courtyard ring or a mitered footprint has walls whose outward normals are not
axis-aligned, so "2ft outward" is along each wall's own normal rather than
north.


### B11 — the tilted panel's top plate is RIPPED, which closes B8

> *"Plywood should just be cut perpendicular on these with a note in the shop
> drawing saying to be ~1/4" bottom plate piece is proud of the plywood. Both
> 2x4s on top plate have an edge ripped off of them (that cut should be
> specced out in the shop fab pages)."* — Tommy, 2026-11-01, with SketchUp
> screenshots

Two sentences, and the first one settles B8 outright.

**The top plates lie FLAT on the studs and the slope is cut into their top
faces.** They were whole 2x4s tilted bodily into the incline, which is a
different part: a tilted board occupies `2.25 / cos` of vertical space at the
panel's outer face, where a ripped one occupies only the `1.5 - 3.5 x tan`
its rip leaves. At 4:12 that is 4.62in against 3.37in — and the row is built
at 3.5in, which is why the exterior stud had no room and the two plates ran
into each other. **Five interferences, now zero**, and the entry is deleted
from `memberOverlap.test.ts` rather than set to zero.

With the plate carrying the slope, every stud is a plain square-cut length,
one per wythe row. Two things fell out of it:

- **At the app's 3.5in low height the exterior wythe has no room for a stud at
  all** (about 1/8in of clear space), so the panel is framed in the interior
  wythe only. The builder emits none rather than a sliver. Still open: how
  much straight exterior face this row should really have — 3.5in is this
  app's stand-in, now floored at whatever the panel's own layers come to.
- **Above about 5.1:12 the rip takes more than a 2x4 has** (`3.5 x tan > 1.5`)
  and the plate wants a deeper board. The panel refuses rather than emitting
  one of negative thickness. Which board is a decision nobody has made.

**The plywood** is noted as cut square (perpendicular) on both the gable and
the cross-tilt skins, with the real `thickness x sin(rake)` printed — 0.237in
at 4:12, his "~1/4in". ⚠ On the gable the MODEL keeps the plumb cut: a
square-cut sheet aligned to the panel's own ends overhangs the high end by
that same 1/4in and runs into the next panel, which is worse on a drawing than
a plate standing proud. So it is carried as a shop allowance on the cut list
rather than as a different shape.

### B3 — the gable row lands on the wall's joints (DONE, with its other half named)

> *"The gable end panels do not directly line up with the studs of the wall
> panels underneath - let's figure out how to match these two layers of panel
> slots up, and adjust the bottom row if needed."*

Measured on a 20ft gable wall before anything changed:

```
wall joints   0, 25.5, 73.5, 119.625, 165.75, 166.5, 214.5, 240
gable joints  0, 1, 40.75, 80.375, 120, 160, 200, 240
```

**Not one** interior gable joint landed on a wall joint, and the worst sat
**23¼in** from the nearest — half a panel. The wall opens with a 25½in corner
and absorbs its leftovers into a couple of narrowed standards; the gable
divided each segment evenly on a 48in module from the ends in. Two rules,
nothing coupling them.

`computeGableTiledRow` now takes the wall's own slots and puts a tile boundary
wherever the wall has one, then merges a tile too narrow to be a panel (under
3in — its own two edge studs) and subdivides a bay wider than the target. The
wall's safety gap becomes the gable's, directly over it. Measured after:
**every** interior joint on every wall length tested lands on a wall joint,
0/N → N/N.

⚠ **Still open, and it is the "adjust the bottom row" half:** the **PEAK** is a
roofline anchor and the wall below has no joint there, so the one gable joint
that still bears mid-bay is the ridge — which is the worst place for it, since
that is where the ridge beam comes down. Closing it means giving the wall
tiler a forced joint at the peak, which changes the panel layout, the cut list
and the price of every gable wall. That is a change to the WALL and deserves
its own pass.

⚠ **Not composed with gable WINDOWS.** A gable window is placed by ordinal
within its segment, and re-dividing the segment would renumber every window
after it. A windowed gable row keeps its own tiling; the two want reconciling.

⚠ **A pre-existing oddity this surfaced:** `resolveAnchors` puts a roofline
anchor 1in in from each eave corner, so a gable row opens and closes with a
**1in tile** — a whole segment, which no merge inside a segment can touch. It
is there with or without alignment. Worth a look on its own.

### B13 — what a GABLE WINDOW panel actually is (spec captured, not built)

> *"Gable windows will be a thing for sure. Those are made by a Gable inclined
> panel just turned into a header panel without a sill - bottom edge is just
> the truss plate."* — Tommy, 2026-11-01

So a gable window is not a new panel type: it is the **Gable End Panel** with
its body replaced by a **header (lintel) assembly**, and

- **no sill** — unlike a wall window, which is a header *and* a sill panel;
- **its bottom edge is the truss plate**, i.e. the opening runs right down to
  the ring the gable row sits on, so the "header" spans from the truss plate
  up to the raked top rather than floating in the middle of the panel.

⚠ This is the panel that B3's joint alignment does **not** compose with yet:
a gable window is placed by ordinal within its roofline segment, and
re-dividing that segment to land on the wall's joints would renumber every
window after it. With the panel's own shape now settled, the two can be
reconciled — the window's own edges become joints the row must honour, the
same way a wall joint is.

### B6 — the header's ends are 2x4 studs now (DONE)

> *"I am seeing some minor overlapping in header panels. The 3/4" plywood
> skins on the side I don't think are necessary, and should be replaced with
> regular 2x4 studs vertically like a standard panel. This may bring that tip
> and angle of the diagonal towards the center of the header panel a little
> bit."*

**The two were the same problem.** A header's ends were a full-depth x
full-height plywood sheet at each X extreme, and both chord caps are
full-span sheets meeting them at 90°, so every end cap crossed all four of
them at the corners — carried in the code as *"an illustrative
simplification"*. That was the whole of this panel's interference count:
**12 on each header type, now 0**, and both entries deleted from
`memberOverlap.test.ts` rather than set to zero.

Framed like a standard panel instead: a 2x4 in each wythe at each end,
standing **between** the chords rather than past them, so nothing crosses
anything. And the diagonal's foot moved inboard with it, from the 3/4in
sheet's face to the 1 1/2in stud's — **0.75in → 1.5in**, which is the shift
he predicted.

⚠ **It changes material totals.** Four plywood end caps per opening are gone
from every project that has one, so the 3/4in sheet count drops. That is a
correction, not a loss: those sheets were being counted and are not in the
panel any more.

⚠ **Scoped to Door/Window headers.** The Big Header and the Big Header Beam
still have their plywood ends and their own baselines — the brace builder
takes the end inset as a parameter now, defaulting to the 3/4in sheet, so
neither moved. Whether they want the same treatment is his call.


### B6b — the whole header family follows suit (DONE)

> *"Doors and headers and big headers should all follow suit."* — Tommy,
> 2026-11-01

`buildHeaderEndStuds` is shared by all three now. Results:

| assembly | before | after |
|---|---|---|
| Door Header | 12 | **0** |
| Window Header | 12 | **0** |
| Big Header Beam | 12 | **0** |
| Big Header | 26 | **0** |

The Big Header had **two** causes and the end sheets were only the first.
14 were the plywood ends crossing the chords and the jacks; the other **12
were the CHORDS THEMSELVES drawn straight through both jack studs**, which is
a board through a post and could not have been built as drawn.

Which gives way is settled by his own convention rather than by a choice
here: *"RO's take into account these jack studs"*, and a slot's width
*"represents the WHOLE assembly's footprint (header + jack studs + RO +
sill)"*. The jacks are inside the width, so the header stops short of them.
⚠ **Every Big Header chord is two jack thicknesses shorter on the cut list
now** — a correction to a part that could not have been built, not a change
of spec.

The Big Header's own end studs sit **inboard of its jacks**, which is the one
difference from a Door or Window header: the order across the end is jack,
edge stud, web. The Big Header Beam was also **added to the overlap audit** —
it had never been in it, and it shared its siblings' defects.


### CSV export (DONE) — and the seam the next exports come through

A project-wide cut list, from the Print page's toolbar beside Export PDF.
Every fabricated part in the building as one flat table, built from the same
`computePanelCutList` every Shop Fabrication sheet prints from, so the file
and the sheets cannot describe different parts.

Three pieces, and the middle one is the point:

1. `packages/panel-catalog/src/csv.ts` — one RFC 4180 writer. A cut list
   contains every character that breaks a naive join: commas in the cut
   notes, a double quote in **every** inch mark (`47½"`), newlines in a long
   note. It also leads with a **UTF-8 BOM**, because Excel on Windows opens a
   BOM-less UTF-8 file as the system codepage and a whole column of
   dimensions arrives as `47Â½"`.
2. `apps/web/app/projectExportAssemblies.ts` — **the seam.** Six pipelines
   plan this building's parts and each one's groups have a different shape;
   this reduces them to the five things any export wants (name, size, copies,
   where, members). The next export is then a renderer, not another walk of
   six pipelines — which is also how two exports come to disagree about what
   the building contains, the defect `deckPanelTakeoff` and `crossTiltTakeoff`
   both exist to prevent.
3. `packages/panel-catalog/src/projectCutListCsv.ts` — the table itself.

Two columns are deliberately doubled:

- **Qty per panel** and **Qty total.** A sheet is an instruction for building
  ONE; a purchase is for all of them. Conflating them is how a job comes up
  short.
- **Length** and **Length (in).** The first is what a saw is set to (`47½"`,
  or a long point on a bevel); the second is the same figure as a decimal,
  because a spreadsheet cannot sum `47½"`. Both come off the same member.

Verified on a drawn building: 238 part rows across 25 distinct panels — wall,
gable, header, sill, safety gap, corner, column, braced, truss plate, floor
and roof — every length parsing as a number, every `Qty total` equal to
`Qty per panel x Copies`, and 53 bevelled rows carrying their real angle and
jig note.

**Next export:** DXF. It reads the same `ExportableAssembly` list; what it
needs on top is a 2D projection per member, which `memberLocalCornersIn`
already gives for every shaped member in the catalogue.


### DXF export (DONE) — and what it cost to get right

Every unique panel as a to-scale 2D elevation, one drawing, from the Print
toolbar. **R12 ASCII** (`AC1009`), which is the most widely readable DXF
there is, with members on layers by material (`LUMBER`, `PLYWOOD`), the
panel's nominal outline on its own layer, and labels under each cell.

It reads `projectMemberShapes` — **the same projection the Shop Fabrication
sheets draw** — so the drawing and the sheets cannot hold different opinions
about what a panel looks like. It reads the same `ExportableAssembly` list
the CSV does, which was the whole point of building that seam.

⚠ **A WRONG DXF IS A VALID DXF**, and this export proved it three times.
Each time the file opened, drew, and reported nothing:

1. `projectMemberShapes` is **Y-DOWN** and DXF is **Y-UP**, so a panel's
   parts landed on the opposite side of its baseline from its outline.
   Measured on a drawn building: **725 of 746 member polylines outside their
   own panel.**
2. Rows stood **UP** from a baseline, with the next row dropped by the height
   of the row just finished — which clears the PREVIOUS row while the new one
   grows upward by its OWN. Measured: **five overlapping cells**, a 21ft
   floor panel lying across a truss plate. Rows hang DOWN from a top line
   now, which clears unconditionally.
3. DXF `TEXT` has no width, so a 3/4in safety gap with a 40-character name
   ran its label straight through its neighbour's. Cells reserve label width.

Because none of that is visible in a well-formed file, **the layout is its
own tested function** (`layOutProjectPanels`) returning cells as data, rather
than a side effect of writing entities. The tests check the layout; a
separate set checks the DXF structure a reader actually walks (pair
alternation, section order, the `66` "vertices follow" flag, no exponent
notation, no newline inside a label).

⚠ One thing worth keeping: **a member may legitimately leave its panel's
nominal rectangle.** A roof panel's plumb-cut fascia hangs below its span and
an eave cap's seat reaches past the panel's end — the catalogue says so. So
the OUTLINE is the panel's nominal size and the CELL is whatever has to fit,
and they are different numbers on purpose.

**Next exports:** the same seam serves them. A per-panel DXF (one file per
panel, for a CNC) is a different pagination of this. A materials/purchase CSV
is a different aggregation of the cut list.
