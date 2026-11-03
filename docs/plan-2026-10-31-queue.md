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


## E. Answered 2026-11-01 (interviewed)

### B3 — the ridge, and a correction to my own report

**His answers:** *gable follows the wall* at the ridge; the 1in corner sliver
*shouldn't be there*; and for gable windows, *wall joints win*.

⚠ **Two of my three findings were wrong, and the error was mine.** The
earlier B3 measurements fed `computeGableTiledRow` a profile containing both
wall ENDS as well as the peak. The app passes the INTERNAL points only (for a
peak, exactly one). With three points, `resolveAnchors` pushes the coincident
end point clear by `MIN_ANCHOR_GAP_IN` — which produced the phantom 1in
corner tile, and took the anchor count past the `anchors.length === 3` guard
so no gable column tile was built at all. **Neither happens in the app.** So:

- the **1in sliver does not exist** — nothing to remove;
- the gable column tile **is** built.

⚠ **And the ridge was worse than reported, not better.** The wall places its
ridge column where it best fits its own slot run (`placeColumnUnderPeak`
tries every viable ordinal); the gable centred its own column tile exactly on
the peak. On a 16ft wall the wall's column sat at 58⅞..84⅜ and the gable's
at 83¼..108¾ — **24⅜ in apart**. A ridge beam bearing on a column panel
most of a panel away from the one carrying it.

**Fixed, his way:** a wall slot marked `isColumn` hands the gable row its two
edges. Nothing about the wall moves. Measured after, on 16/20/24/32/40ft
gable walls: **every** interior joint lands on a wall joint — 6/6, 7/7, 8/8,
10/10, 13/13 — with the two columns exactly stacked and the row still summing
to the wall to the thousandth.

**Still open:** gable windows. His rule is now recorded (*wall joints win* —
a window snaps to the nearest wall joint rather than holding its position),
but the gable-window panel itself does not exist yet (B13), so there is
nothing to snap. The windowed row still keeps its own tiling.

### B8 — the tilted panel's low edge, plate stock and fill

**His answers:** *tall enough for a real stud in both wythes*; *a 4x4 top
plate* above the pitch where a 2x4's rip runs out; and *straw, like any wall
panel* in the cavity.

- **Low edge** is now the bottom skin + bottom plate + a stud at least as long
  as it is wide + the rip's thin edge + the top skin. **6⅞ in at 4:12**,
  against the old 3½ in stand-in. Both wythes are framed; before this the
  exterior one had about ⅛ in of clear space and the roof's load reached the
  wall's outer wythe through plates and skins rather than framing.
- **Plate stock** steps 2x4 → 4x4 where the rip (`3½ in × pitch/12`) outgrows
  1½ in, i.e. above about 5.1:12. Past 12:12 even a 4x4 is eaten and the
  panel refuses, because nobody has chosen what comes next. The thin edge
  feathering out is expected on a bevel rip and no minimum is invented for it.
- **Cavity**: straw, unchanged.

⚠ **Consequence worth watching:** the row is now ~3⅓ in taller at 4:12 and
the roof above it does not move — the roof is laid from `gableEaveHeightIn`,
which has no term for this row. That relationship was already unresolved
(B2's shed half); it is now off by more.


## F. 2026-11-01 — four reports, one root cause and one separate one

### The root cause: a RESIZE never re-derived the roof

> *"When I changed a small shed roof building to 24 x 24, it extended the shed
> roof along with one gable end, but the other gable end went to peaked Gable
> end style."* / *"a weird short backwards north gable wall spawning for a
> wide small building"* / *"still no 3rd gable wall on shed roof are
> appearing"*

All three are the same defect. `handleDraw` derived the whole roof — which
walls are gable ends, the form, the profile positions, the ridge columns —
and **a resize changed the footprint and nothing else.** Two things then go
stale:

1. **Which walls are gable ends.** They are the short pair. Resize past square
   and the short pair is the other two, leaving a gable row on a wall that is
   not a gable end any more, wound the way its old wall was. That is the
   *"weird short backwards north gable wall"*.
2. **The stored shed profile positions, which are ABSOLUTE INCHES.** A shed
   puts its point at `x = 0` on one gable wall and at `x = that wall's own
   LENGTH` on the other, because the two are wound in opposite directions
   round the footprint. Grow the building and the stored length is no longer
   that wall's end — it is mid-span, which reads as a PEAK, while the wall
   that stored 0 still snaps to a shed. **One wall stays a shed and its
   opposite becomes a gable.**

And the third wall follows from it: `crossTiltWallIds` reads the live roof
form, so a roof that cannot decide what it is grows no tilted row. (A freshly
drawn shed was verified to grow its row correctly — 20 tilted gable panels on
a 12ft-deep building — so the row itself was never broken.)

**Fixed:** the derivation is one function (`applyRoofDefaultsForFootprint`)
called by the draw AND by every shape change through `applyShapeChange`.
`roofShapeChangeVerdict` decides when: the gable-end pair changing, or the
span crossing the shed/peak limit. Short of that the roof is left alone and
only its end-anchored positions are carried onto the new lengths — a
two-inch nudge must not throw away a roofline somebody shaped by hand.

⚠ **Two footprint paths still bypass it**, named rather than left quiet:
`commitFootprintShapeChange` (adding/removing a COURTYARD, which flips
whether gable ends are allowed at all) and `handleKeepSplitRegion`. Both
re-tile through a different route, so threading the ridge-column placement
through them is its own piece of work.

### The separate one: box and membrane views

> *"the box and membrane views still have the roof panels' bottoms raised
> up"*

Those views draw ONE prism, from the panel's own silhouette. The panel really
is raised — it is cut back to a level seat so it can bear on a level plate —
and what fills the space underneath is the **eave cap**, a separate part. The
framed view has drawn it since the cap was placed properly; a silhouette of
the panel alone had nothing to draw there. `roofPanelCapOutlineSection` gives
those two views the cap's own rectangle.

## G. 2026-11-01 — B14: the ridge column is not under the ridge

> *"This image outlines in the 3D view some weird inclined changes in the
> slope to an off centered column panel that's not the right height. 25'3" x
> 22'9" building."* — Tommy

**Reproduced exactly, on his dimensions.** The gable end is the 22'9" pair
(273in), so the peak is at x = 136.50. Tiling that wall and placing the ridge
column gives:

| tile | span | top | the roofline there |
| --- | --- | --- | --- |
| standard | 73.50..121.50 | 24.50 → 40.50 | 24.50 / 40.50 |
| **column** | **121.50..147.00** | **33.50 flat** | **40.50 / 42.00** |
| standard | 147.00..172.88 | 42.00 → 33.38 | 42.00 / 33.38 |

Every other tile lands on the roofline to the inch. The column does not, and
there are two separate reasons:

1. **It is 2.25in off the peak.** Its centre is 134.25 against a peak at
   136.50, so the ridge beam — which is centred on the peak — does not sit
   centred on the panel that carries it. The two slopes therefore meet it at
   DIFFERENT heights, 40.50 on the left and 42.00 on the right, which is the
   *"weird inclined change in the slope"*: the step down is 7.00in on one
   side and 8.50in on the other.

2. **The 12in drop is not the fault.** `GABLE_COLUMN_FLAT_TOP_DROP_IN` is his
   own number — *"it has a flat top that is 12in down from the peak"* — and
   a column centred on the peak would read as deliberate. It only looks wrong
   because of (1).

⚠ **It is a TILER limit, not a chooser bug.** `placeColumnUnderPeak` tiles
every viable ordinal and takes the nearest; all three were measured:

| ordinal | column centre | off peak |
| --- | --- | --- |
| 1 | 86.25 | —50.25in |
| **2** | **134.25** | **—2.25in** (chosen) |
| 3 | 160.13 | +23.63in |

2.25in is the best the current tiler can reach. The left run is a corner plus
two FULL-width 48in standards (25.5 + 48 + 48 = 121.50) and the redistribution
happens only on the RIGHT of the column (25.9, 25.9). To put the centre on the
peak the left run would have to be 123.75in, which needs the standards either
side trimmed rather than only those on one side.

**The open question is what gives**, and it is a building decision:

 (a) The panels beside the column are trimmed so the column sits exactly under
     the ridge — non-standard widths next to it, exact bearing.
 (b) The column stays on its tile boundary and the ridge beam moves to it —
     standard widths, unequal roof slopes.

**Answered: (a), trim the neighbours.** And correcting my own framing above
— the beam was never MISSING the panel: the peak at 136.5 sits inside the
column's 121.50..147.00 span, so it bore on the panel, just 2.25in off its
centreline. The visible fault was the asymmetric step.

**Fixed** (`0a1148c`). `retileWithColumnAtIn` tiles the two sides of the
column as separate runs, so it lands exactly on the peak. On his wall the
column now centres at 136.50 and the roofline meets it at **41.25 on both
sides** — a symmetric 7.75in step instead of 7.00/8.50. Every other tile
still lands on the roofline to the inch, and the wall still sums to 273.00.

⚠ Used only where the wall carries no OTHER openings: the new tiler knows
about one reservation, so a wall with windows stays on the ordinal search,
which preserves every anchor. Pinned, because the alternative is silently
deleting somebody's windows to centre a column.

## H. 2026-11-01 — B15: patterned bracing, stacked through floor/wall/roof

> *"I want the floors, walls, and roof intersections of panels to be stacked
> and supported. Attached I have what an ideal layout for an auto spawn for
> that 22x25' or so building. Might as well say that this kind of integrated
> pattern layout changing each panel individually will make more groups of
> fewer panels for grouping shop fabrication pages and that's fine."* — Tommy

His overlay sketch shows the brace pattern laid out across the WHOLE WALL as
one figure — diagonals meeting at panel joints and at the top and bottom
plates, forming a continuous load path — with red ticks marking the roof
members above and the floor members below landing on those same joints.

Three things in it, and they are separable:

1. **The brace pattern is a property of the WALL, not of a panel.** Today each
   panel is braced in isolation, so the diagonals do not meet across a joint.
2. **Floor and roof members land on wall panel joints**, so load stacks
   straight down. This is `panel_module_2ft_4ft` (24in decks, 48in walls)
   carried through to the actual member positions rather than just the widths.
3. **Panel grouping will fragment, and he has accepted that in advance**:
   more groups of fewer panels on the Shop Fabrication pages is fine.

⚠ Depended on B14 above, which is now fixed: a ridge column off the peak
would have put the wall joints out of step with the roof members meant to
stack on them, so the pattern would have been laid against a reference that
was itself off.

## I. 2026-11-01 — B9 done: the ridge beam bears on the column

> *"gable end column panels' tops should be flush/meet the bottom of the
> gable ridge beams. This means the column panel should be shorter, rather
> than having the beam run through the panel as it currently does. The beam
> should air on top the panel."* — Tommy

**Four numbers described one joint**, and the one the gable row used was the
nominal:

| constant | was |
| --- | --- |
| `ROOF_CATCHER_BEAM_DEPTH_IN` (three 2x12s on edge) | **11.25** |
| `GABLE_COLUMN_FLAT_TOP_DROP_IN` (what the row used) | 12 |
| `DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN` | 11.25, its own literal |
| the UI's beam-depth offset control | 11.25, and inert |

A 2x12 is 11.25in deep, not the 12in its name says. Measured on the same
25'3" x 22'9" building as B14, at 4:12:

| | before | after |
| --- | --- | --- |
| peak | 167.75in | 167.75in |
| beam underside | 156.50in | 156.50in |
| column top | 155.75in | **156.50in** |
| gap | **0.75in, beam floating** | **0.00in** |

⚠ **Both of his quotes are in the record because they disagree**, and the
disagreement IS the bug: *"it has a flat top that is 12in down from the
peak"* against *"column panel...11.25in down from the peak (so it can catch
a beam)"*.

**Fixed** (`bff90fc`): the drop is a parameter and both callers pass the
beam's own depth, so a change to the beam cannot leave the column behind.
The fourth copy is gone — `DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN` derives
from the beam. The three readouts that told the user 12 now read the beam.

### Named, not fixed

- **`WallElevationDiagram` does not receive the wall's own slots**, so its
  preview row tiles unaligned where the model's is joint-aligned (B3). It
  now passes `[]` explicitly with a comment rather than relying on the
  default. Wiring it needs the slots threaded in as a prop.
- **`computeGableColumnHeightIn` is exported and never called**, and the
  UI's "Roof-catcher-beam depth offset" control is advisory and drives
  nothing. Making that control real is a user-facing design decision.


---

# Queue, re-planned 2026-11-02

Written at Tommy's request: *"Take all this info, flesh out/plan the queue,
and then take the next step."* Three new decisions landed in one message —
decouple safety gaps, right-click the panel menu, build the derivation
sheet — and two from the message before it (retire near-corner braces, work
backwards to a seismic rating). This is where they sit.

## The three decisions, as given

> *"We don't need any of this safety Gap combining stuff. I don't want to
> see any of the panels combined with safety gaps. Safety gaps should be
> treated as their own slot as they are already measured out with our
> thresholds and every once in awhile dynamic. But let's decouple safety
> gaps from any particular panels."*

> *"I would like to be able to right click on a panel in the 2D plan and 2D
> elevation ... to see several options including delete/merge, delete/ no
> panel, change, panel type, and then a drop-down menu of all of the panel
> types. This would remove the need for the left click cycle which is fine
> because left clicking should be used for dragging and resizing. We can
> interview about the right click stuff when it comes up in the queue."*

> *"Derivation sheet sounds freaking awesome."*

---

## B16 — Safety gaps are their own slot. **DOING NOW.**

The corner-brace combine is the only thing in the app that ever merged a
safety gap into a panel: a gap slot grew to `standardWidthIn + 3/4in`,
picked up `secondaryType: "braced"`, **swallowed the neighbouring standard
panel whole** and settled the leftover against the panels past it, so the
wall still summed exactly. Deleting it is a deletion, not a rewrite.

What goes with it, and this is the point worth knowing — **most of the code
being deleted is not the combine, it is the guard rail around it:**

| | why it existed |
|---|---|
| `planCornerBraceCombine` + `CornerBraceCombinePlan` | the combine itself |
| `SAFETY_PLYWOOD_BUFFER_IN` | the 3/4in glued onto a combined panel |
| `applyBracedPlacement`'s `preservedBracedIndices`, `slotIndicesArePinned`, `preCombinedGapOrdinals` | three parameters that exist only to decide whether a combine may fire |
| `reconcileBracedPlacement`'s `slotIndicesArePinned` (~10 call sites) | the same, one layer up |
| `pinnedSlotIndexWalls.ts` + the `slotIndexPinnedWallIds` memo | computes which walls have a beam or header stored against slot POSITIONS, so the combine can be refused there |
| `cornerBraceCombineRefusals.ts` + its Review Log entry | tells an engineer that a refused combine left one brace serving two corners |
| `combineSwallowedOrdinals` / `holeOrdinals` / `swallowedOldMarkers` | re-derives, on every reconcile, which standard-family ordinal the combine had eaten, so the brace markers past it do not shift by one |

That last row is the one I would point at. A combined wall is stored **one
panel shorter than it tiles**, so every pass since has had to reconstruct
the missing position from the slot list. Several bugs in this file's history
are that reconstruction getting it wrong by one.

**The one real question: files already saved with a combined wall.** A
stored combined slot does not un-combine itself, and nothing retiles a wall
until it is edited — so without a migration his existing projects would keep
showing a 48-3/4in `braced + safety-gap` panel, which is precisely what he
said he does not want to see. It migrates **exactly**, with no retile and no
lost hand edits: split the combined slot back into a gap at the run's own
threshold width plus a standard panel carrying the remainder. The sum is
unchanged, so the wall's length stays exact, and the panel count goes back
to what the run tiles to. Applied unconditionally on load, which is the
established pattern in `projectFile.ts`, not a version bump.

**It does not make the 24in module worse — it makes it slightly better.**
The gap was always its own slot in the run; what the combine added was
48-3/4in panels and settled residuals on their neighbours. Those go away.
The borrowed tail is still the module problem (see the carried item below).

---

## B17 — Retire the auto-seeded braced panels

> *"We can retire near corner braces because the super brace pattern should
> inherently provide the same structural shear value."*

Authorised 2026-11-02, and **B16 is its prerequisite**, which is why it is
second rather than first. `applyBracedPlacement` has two seeding rules:

1. **near-corner** — one braced panel walking inward from each end.
2. **periodic** — another every `seismicBracedPanelSpacingFt[zone]`.

Rule 1 is the one he named, and the combine lived *inside* it — ungated by
the per-panel eligibility set, so suppressing the brace would have left the
combine still mutating panel widths. After B16 there is nothing left in
there but the brace, and retiring it is a deletion.

**Rule 2 I am proposing to retire too, and that is a building decision, so
it is called out rather than assumed.** The argument: with the pattern on,
every standard panel on the wall already carries half an X. Rule 2 would
convert one of them into a chevron Braced Panel — which both over-braces
(his own reservation: *"we are over bracing with these kind of patterns"*)
and **breaks the pair run it lands in**, because a `braced` slot is not a
pair member. It is also the thing that makes the seismic zone an input, and
B18 is about making it an output. Retiring both rules is what makes the
inversion real rather than cosmetic.

Also in scope: the click-cycle, and the seismic-zone control's copy — once
nothing is seeded from a zone, a control that picks one is lying.

---

## B18 — The derivation sheet

> *"to have some equation showing details ready for engineers would be
> awesome"*

The capacity half already works the way he wants: shear is derived from the
braces that are actually on the panels, so his hand edits already move it.
Measured on a 39ft x 32ft building: SuperBrace ~58,362 lb across 27 panels,
Nailer ~13,487 lb across 6. What is missing is the **showing of the work.**

Per brace: length, tilt, section, species/grade, slenderness, the NDS column
capacity it resolves to, and `horizontal = axial x sin(tilt)`. Per wall
line: the sum and the panels it came from. Per building: the total. Every
input named with its own `confirmed` / `pending-BI-confirmation` status, so a
reader can see which numbers are Building Integrity's and which are still
placeholders.

**What this sheet deliberately does NOT do is name a seismic zone.** A zone
is a comparison of capacity against the code's design base shear, which
needs the site's seismic design parameters, the building's seismic weight
and a response modification factor for a straw-bale panel shear wall. The
app has no force numbers for any zone — `seismicBracedPanelSpacingFt` and
`bracedWallLineSpacingFt` are spacing rules, in feet. Printing a zone badge
would mean inventing a base shear, which is the exact thing the flags rule
exists to stop. The sheet gives an engineer the half that is real and lets
him do the comparison against numbers he can check. If he or his engineer
supplies the demand side, the badge becomes a subtraction.

---

## B19 — Right-click the panel menu (interview first, as he asked)

Not started, by his instruction: *"We can interview about the right click
stuff when it comes up in the queue."* What he named, so the interview
starts from it rather than from scratch:

- Right-click a panel in the **2D plan** and the **2D elevation**.
- Options: **delete/merge**, **delete/no panel**, **change panel type** with
  a dropdown of every panel type.
- **Left click stops cycling** and belongs to dragging and resizing.

Open questions for that interview, not to decide alone: what "delete/merge"
merges into (the neighbour on which side, and what pays for the width);
whether "delete/no panel" leaves a hole the wall length must still account
for, or shortens the wall; whether the type dropdown offers types the slot
cannot physically be (a Corner mid-run); and what happens to a brace pair
when one half of it changes type.

Note the dependency: retiring the click-cycle in B17 and replacing it in B19
are two halves of one change to how a panel is edited. B17 only removes the
*seeding*; the cycle itself should outlive B17 and be retired by B19, or
there is a window with no way to change a panel's type at all.

---

## Carried, unchanged

| | |
|---|---|
| **B10** | the gable/tilted rows as a second layer on the 2D plan, set out from the wall |
| **B13** | the gable window panel — spec captured 2026-11-01, not built |
| **B3 remainder** | `WallElevationDiagram` still does not receive the wall's own slots, so its preview can disagree with the model |
| **the module remainder** | the tiler's borrowed tail plus the gap still push the last stretch off the 24in grid — on a 30ft wall, three joints miss by 3.88, 7.75 and 7.00in |
| **roof re-derive** | `commitFootprintShapeChange` (courtyards) and `handleKeepSplitRegion` still bypass it |
| **cross-tilt low edge** | the 3-1/2in low face cannot hold its own layers — 5 pinned overlaps, waiting on Tommy |
| **roof eave cap** | the filler for the 15.5 x 5.17in void is built at the origin and never placed |
| **stale prose** | ~14 mentions of the old 51-75.5in corner band, ~29 of the 25.5in corner |

## Order

**B16 → B17 → B18 → B19 interview.** B16 first because B17 is blocked on it
and because it is the one he asked for in plain terms. B18 before B19
because it is additive and cannot break the editor. B19 last because it
needs the interview, and because its own prerequisite is that B17 has not
taken the click-cycle away yet.

---

# B17 — DONE, 2026-11-02. Both rules retired, not one.

`applyBracedPlacement` is deleted. Nothing in the app places a braced panel
automatically any more.

**Rule 1 (near-corner)** was authorised up front:

> *"We can retire near corner braces because the super brace pattern should
> inherently provide the same structural shear value."*

**Rule 2 (periodic, off `seismicBracedPanelSpacingFt[zone]`)** was the open
building decision, and he answered it mid-stride:

> *"My answer on the periodic rule: not sure exactly what this means but we're
> replacing it with something better."*

> *"Id rather have a pattern be described to an engineer with estimated values
> rather than prescribe an engineer seismic zone thing."*

So the inversion is real rather than cosmetic: **the seismic zone is no longer
an input to ground-floor bracing at all**, which is the half of the
seismic-rating problem that had to go before B18 can read a rating OUT of a
built design.

## What went

| Deleted | What it was |
|---|---|
| `applyBracedPlacement` | both seeding rules, and the `eligibleIndices` machinery that decided which positions they were allowed to touch |
| `BracedSeed` (retile.ts) | the 3-value bundle (spacing, pattern, mirror) threaded through `retile`, `retilePreservingOpenings` and `retilePreservingOpeningsWithRunStopMemory` |
| 4 params on `reconcileBracedPlacement` | `spacingIn`, `standardWidthIn`, `defaultPattern`, `defaultMirrored` — all 10+ call sites |
| `bracedSeed` (page.tsx) | and the load-path's one-time seismic seed, now a no-op kept for the locked-width re-force it also performs |

`reconcileBracedPlacement` keeps its name because it still reconciles braced
placement — it carries a panel's type, pattern, mirror, zones and locked width
across a retile. It just no longer invents one.

## What deliberately stayed

- **`applyAdditionalRowBracedPattern`.** A different rule, from a different
  instruction of his, for a tall wall's freshly-spawned UPPER row. The wall
  brace pattern is laid per slot and does not reach zone 1, so retiring it
  would remove bracing and put nothing back. It is the only remaining reader of
  the seismic zone, and the control's copy now says exactly that much.
- **Three places that reasoned FROM rule 1**, each re-reasoned in place rather
  than left pointing at a deleted walk:
  - `buildPlainMiddle` keeps the borrowed panel off the corner-touching
    position. ⚠ Its stated reason — *"Tommy wants the borrowed panel(s) to
    never be the one that ends up braced"* — **can no longer be honoured by
    position at all**, because the pattern braces every standard panel. Open
    item, below.
  - `pickFreeSlotsToDrop` sorts the corner-touching slots last. Kept as an
    arbitrary-but-FIXED tie-break.
  - `seedDefaultOpenings` refuses a default opening at either end. That is his
    own confirmed answer and outlives the brace it was stated against.
- **The type cycle.** He lifted the constraint — *"No problem on there being
  not able to change a panel during this queue"* — so B17 and B19 are no longer
  coupled, but there was no reason to break it early either.

## Two bugs this surfaced, both fixed

1. **The Summary's shear caption counted `panelType === "braced"`.** Measured on
   a 43'8" × 33' rectangle it read **"~66,717 lb across 0 braced panels"**. The
   capacity was right; the caption was counting the wrong thing, and had been
   under-counting since the pattern shipped. Now reads
   `estimatedTotalShear.shearPanelCount` — derived from each panel's own
   members, the same number the Review Log prints, so the two cannot disagree.
2. **The plan's per-panel tooltip showed shear only for a `braced` slot.** After
   the retirement that is no panel at all, so every tooltip would have been
   silent about shear while the building totalled 66,001 lb. Now asks the
   members, the same way.

## Open, and his

- **The borrowed panel is braced now, whatever position it sits in.** His
  preference that it never be the braced one predates the pattern. Does an
  odd-width panel carrying half a superbrace matter? The cut note already
  carries the real angle, so this may be nothing — but it is his call, not an
  assumption to bury in a comment.

---

# B20 (superseded) — see the full spec below

Written from his first, shorter description, before the sketch and the geometry
note arrived. Kept only for the quotes.


> *"This super brace design (I think one thing may be missing from them - the
> one additional 2x4 diagonal on each side on the top that help carry the load
> of the roof panel above it in the center (presumably 4' walls and 2' roof
> panels) and two on the bottom that help carry it to the floor panel (2' floor
> panels, one lands in the center of the wall)."*

The geometry behind it is already settled and recorded: walls are 48in, floors
and roofs are 24in, so **a roof panel joint lands exactly on the centre of a
wall panel, and so does a floor panel joint**. That point load is what these
members are for — spreading it from the centre of the top plate out to where
the panel is supported, and gathering it again at the bottom.

**Not built.** It changes the panel recipe, the cut list, the weight, the 3D
view and the shear figure, and four details are unstated:

1. **Where the top pair lands.** From the centre of the top plate out to — the
   panel edge? The first girt? [[brace_anchors_on_two_points]] settled that a
   brace's low point rides the girt bar's TOP face and the far point sits flush
   to the panel edge; do these follow that rule, or is their angle set by the
   load path instead?
2. **"Two on the bottom" vs "one on each side on the top".** Read literally
   that is 2 top + 2 bottom; read as symmetry it is 2 and 2. Which?
3. **Whether they are part of the SuperBrace pattern or additions to every
   standard panel.** The pattern is a control with three settings — does a
   Braced Pair or a Nailer Pair get these too? A Nailer Pair that gains
   diagonals stops being a nailer.
4. **What happens on a panel that is not 48in.** A borrowed panel's centre is
   not where the roof joint lands, so the member either moves off-centre or
   stops being a load path.

Worth asking all four together before any of it is cut.

---

# B20 — The carrots. DONE 2026-11-02.

> *"Let's have super brace mean absolutely Overkill on the bracing."*

## The three figures, and his names for them

> *"I suppose the names are now Little Carrot and Big Carrot. Little Carrot,
> Super Carrot (meaning both). ... no big carrot in pattern but good to have a
> name for just the X."*

| Figure | On this panel | Across a pair |
|---|---|---|
| **Big Carrot** | 2 long legs of the pair's X | 4 — his *"four total 2x4s ... 4 or 5 ft long"* |
| **Little Carrot** | 2 short load-path diagonals | 4 — his *"four more 2x4s ... 2 or 3 ft"* |
| **Super Carrot** | both, 4 members | 8 |

Big Carrot is named but **not produced by the pattern** — it exists because the
X needed a name and because a per-panel editor will want to offer it.

## The pattern

> *"The pattern would be super carrot, super carrot, little carrot, little
> carrot, super etc."*

Two panels of each is exactly one PAIR of each, so the cycle reads off the pair
index. **It restarts at Super after every window, door and header** (his
choice), which came free: the overlay already splits a wall into runs of
consecutive eligible panels and flushes at each ineligible one.

> *"The only interruptions are, however, and wherever headers and doors and
> windows spawn, and most of them will have diagonals."*

## Exterior only

> *"I guess these super brace patterns could just be for the outside actually,
> exterior only. Standard panel style for inside, perhaps ready to receive edits
> and nailers somehow."*

So the Carrot Pattern defaults to the exterior wythe and the interior face is an
ordinary standard panel — which is what makes it "ready to receive edits": the
recipe system already takes per-panel surgery and an untouched face is what it
can be applied to. **The Braced Pair is untouched and still takes both wythes**,
because he said nothing about it.

His own arithmetic for this: *"Super braced pattern was 8844, is now really more
like 4422 since I don't think the interior needs to be braced (happy to be
checked on that)."* ⚠ **That parenthesis is his, and it is the one assumption in
B20 he has asked to have checked** — it is recorded on the type itself, not just
here.

## ⚠ One deliberate deviation from his sketch, and why

He sketched the short diagonals running **outward** from the top-plate centre
toward the panel's outer edge. **Built that way they measurably cross the Big
Carrot's upper leg.** Checked numerically on a 48 × 120in panel: at mid-width
the X leg is at z 89.5 and the outward carrot at z 119; by the outer post they
have swapped, so they intersect in between. Two 2x4s let into the same straw
groove cannot cross — *"It doesn't make sense to allow any overlapping because
these need to [be] possible to build."*

Routed toward the **seam** instead, it fits the triangle the X's own upper leg
leaves open, keeps the same ~3ft length, still carries the load to an edge stud
and down to the floor, and `overlappingPairsIn` is clean on a Super Carrot. It
also matches his FIRST description better than the sketch does — *"the one
additional 2x4 diagonal on each side on the top"* — since the two panels of a
pair now bring their top carrots down to the seam they share, one from each
side.

Only a Super Carrot has anything to collide with; a Little Carrot panel carries
no X, so outward would be free there. It is routed the same way regardless,
because one figure that reads identically on every panel beats two that differ
for a reason nobody can see on the shop drawing.

## Where it lands

- `braceFigure` on the slot and on `PanelInstance`, derived not stored.
- The Shop Fabrication group key grew the figure, so a Super Carrot and a Little
  Carrot of the same width no longer share a page — without it half the panels
  on every wall would be built with members they do not have.
- Measured on a 43'8" × 33' building: shear **66,001 → 137,183 lb**.

---

# B21 — Vertical Nailers is its own overlay

> *"Vertical nailers is actually a totally different bracing pattern overlay.
> Let's make that a button that turns all of the panels into straight up and
> down 2x4s just on the exterior."*

Today `nailer` is one of the three patterns and adds **nothing** — it is the
standard panel with its own centre-nailer flag on, which is why the Review Log
has to say a Nailer Pair models no lateral resistance at all. He wants a real
overlay: vertical 2x4s across the whole panel, exterior face only.

---

# B22 — The upper row's own diagonal pattern (interview first)

> *"The upper row on a wall tall enough to spawn 3rd gable panels I guess can
> have their own diagonal pattern, either synonymous or similar with its
> downstairs counterparts. We'll work on those later with an interview, put that
> to the queue."*

This is the other half of what B17 left alone. `applyAdditionalRowBracedPattern`
is the last reader of the seismic zone, kept because the per-slot pattern does
not reach zone 1. Giving the upper row its own figure is what finally retires it
and takes the seismic zone out of the app entirely.

---

# B23 — A girt a wall-depth in from the floor panel's long edges

> *"there should be a girt wall depth (15.5") in from the exterior edges of the
> long channels of the floor panels to help carry the entire toe up load to the
> foundation."*

⚠ Today a floor panel's structural girt goes **only where a wall lands, at a
panel END** (`structuralGirtEnds`; roof panels get none at all, his own earlier
decision). This asks for something different: a girt running parallel to each
long edge, set in by the wall depth, so the whole footprint of the wall above
bears on something continuous rather than only at the panel ends.

Note the dependency: `cornerPanelWidthIn` is 15.5in and the wall depth is 15.5in
([[corner_panel_is_15_5]]), so "wall depth in" must read the live thickness, not
a literal 15.5.

---

# B19 (addition) — the panel editor behind the right click

Already queued for an interview; he has now specified most of it unprompted.

> *"Right click should have an option to go to a panel editor. An editor all for
> editing that panel. It should be possible to turn it into any other panel, as
> well as recategorize it or name it. This panel editor isolates the panel in
> question in its own 3d framed view and the left bar is dedicated to having
> options such as change panel type, add diagonal, add vertical, add horizontal.
> Once spawned, it is easy to click and drag a member (maybe there's a toggle on
> the editor where you switch back and forth from or it and edit) because it
> snaps to center and flush with either side of other members, corners, and
> intersections. Ooo actually it would be cool to have a toggle opaque rest of
> the 3d framed view, and those x,y, and z be snappable too. If you right click
> on a member in the panel editor, you get a selection to change it to anything.
> Left bar also has an option to rotate 90 or custom degrees."*

> *"All of this should be pretty easy to track materials wise I would thin[k],
> seems like a json thing"*

**He is right that the structure is already there**, and that is worth saying
precisely rather than vaguely:

- `AddedMemberSpec` + `buildPanelFromRecipe` is exactly the "json thing" — a
  panel is already *base recipe + a list of added members*, which is how the
  carrots, the brace pair tie and the nailer are all expressed today. An editor
  writes that list.
- `recipeConflicts` / `overlappingPairsIn` already refuse a panel whose members
  intersect, so drag-and-drop gets a correctness check for free.
- Materials already come from the member list (`standardPanelMembersFor` is the
  single seam), so an edited panel costs, weighs and cuts correctly with no
  extra plumbing.

**What is genuinely new:** persisting a per-panel member list into the project
file (everything today is derived, nothing is stored), the snapping model, and
the isolated 3D view with the rest of the building ghosted.

---

---

# B18 — The Derivation Sheet. DONE 2026-11-02.

> *"Derivation sheet sounds freaking awesome."* /
> *"Id rather have a pattern be described to an engineer with estimated values
> rather than prescribe an engineer seismic zone thing."*

`shearDerivation.ts` in calc-engine, rendered as a formal document note beside
the Summary. Per brace: le/d → FcE → CP → Fc′ → axial → horizontal. Rolled up
per panel, per wall line with **lb per running foot**, per building. Every
shared input carries its own status — Fc and Emin stay `pending-BI-confirmation`.

⚠ **It names no seismic zone, and a test asserts that** by searching the derived
data for "seismic", "zone", "SDC", "demand", "base shear". A rating is capacity
against demand, and this app has no demand figures.

⚠ **It cannot drift from the figure it explains.** Both read `shearMembersFor`,
and the sheet equals `computeBracedPanelShearCapacityLb` by test. Verified live:
Summary and sheet both **138,712 lb**, four wall lines summing to it exactly.

**A finding it surfaced, printed on the sheet:** a short brace out-performs a
long one, often by 3×, because halving length halves slenderness and CP climbs
steeply. That is the NDS curve, and it is why the carrots doubled the total.
Worth his engineer's eye rather than being presented as a conclusion.

---

# B19 stride 2 — The anchor fix, and the cycle retires. DONE 2026-11-03.

> *"Anchor fix and then cycle retires let's go!"* — Tommy, 2026-11-03

Stride 1 shipped the menu with the opening types greyed out, because the
anchor retile behind them lost the panel. **Three separate faults**, all now in
geometry with 19 tests of their own:

1. **A door inherited the width of whatever it replaced.** A 96in big header
   asked to become a door handed over its 96in; a 96in door header fails the
   single-peak angle rule; `applyBigHeaderAutoUpgrade` put it straight back.
   Fixed by a rule: a fresh reservation inherits a width only from a panel of
   the tiler's own run. His *"a door keeps the slot's width"* is untouched —
   that rule was about replacing a standard panel, and it still does.
2. **`reconcileBracedPlacement` did not know `big-header` was a reservation.**
   It named window/door/column while `getOpeningAnchors` named four, so a big
   header consumed no old marker and counted as none dropped: every carried
   braced panel, `zones` split and `lockedWidthIn` pin after one read a
   position early, **on every retile of any wall with a big header on it**.
   This one was never about B19.
3. **Nothing treated a void as a reservation.** `open` shipped in stride 1 as a
   slot type only, so the first retile of its wall handed the void's width back
   to the tiler and the void vanished.

One predicate now, `RESERVATION_PANEL_TYPES` — window, door, column,
big-header, open — read by every place that had been keeping its own copy. Two
more ordinals were reading the wrong list and are fixed with it:
`handleSetWindowWidth` counted only window/door, so **a window sitting after a
column or a big header resized that instead of itself**.

**`transitionPanelType`** in geometry is the whole width-moving edit now —
anchors, retile, mitered corner, reconcile, and finding the panel again. It was
inline in `page.tsx` and reachable only by clicking.

**THE CYCLE IS RETIRED.** `nextPanelCycleState` and `PanelCycleState` are
deleted; a left click selects a panel and nothing more. The roster test that
walked the cycle now reads `PANEL_TYPE_MENU_ORDER`.

**A finding, and it is his to decide.** At the app's own defaults — a 120in
wall, a 32in sill, a 48in rough opening — the header is 40in deep and the
single web runs at **56°** against a 45° ceiling. **No window narrower than
72in can carry a single peak**, and on a 120in wall no ordinary door width can
either (36in is 62°, 60in is 49°). So any window the user edits becomes a Big
Header. The seeded windows survive only because seeding does not run the check.
Nothing here changed that rule; what changed is that the app now **says so**
instead of silently swapping the type — `headerUpgradeNotice` in the Selected
Panel note. `doorDefaultWidthIn` is 36in for the same reason: on an 8ft wall it
is the only ordinary door width that clears 30°.

Gates: 3574 tests across 194 files. Typecheck clean in all four projects. Lint
**167 / 119 errors / 48 warnings**, per rule identical to the B18 baseline.

Verified live on a 41'8" x 20'8" building: the menu offers every type with only
the tiler's three refused; Big Header → Standard took the wall from 36 to 37
panels with nothing else moving (it used to do nothing at all); three left
clicks on one panel left it Standard and selected (it used to cycle to Column);
"Delete — no panel" left a 48in void and took the wall to 36; a Column placed
on the same wall **left that void exactly where it was, still 48in**; and the
void became a reservation again on request.
