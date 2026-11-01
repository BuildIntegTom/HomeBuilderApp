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
