# Building Integrity Panel App — Decisions Log
*Working spec, compiled from design conversation. Update as decisions change.*

## Project Overview
Web app (linked from Squarespace) for laying out single-story and loft-style residential homes using Building Integrity's prefabricated straw-core panels. Outputs a floor plan, 3D render, structural/cost/carbon estimates, and a set of construction detail pages — then routes the finished design to the nearest Seed Collaborative fabricator.

**Legal posture:** every output is reference-only. Title blocks state plans are not engineered and not fabricator-produced unless generated under a fabricator login. Current reality: a licensed structural engineer must stamp the fabricator's proposal before anything gets built. Long-term goal: UL listing + IRC/IBC code recognition for prefab straw-core panels.

**Scope:** exterior walls + shell only (no interior walls). Single-story and loft styles only — multistory blocked by jurisdictional limits on non-UL-listed materials.

**Confirmed real-world grounding:** Building Integrity is fabricating New Frameworks' "Casitas" line through the Seed Collaborative partnership (confirmed on buildinteg.com) — the NFW documents in project knowledge are the actual product Building Integrity already builds panels for, not just inspiration. "For Baleheads Only — Standards Roof and Floor Panels.pdf" in project knowledge contains real NDS 2018 (ASD) ClearCalcs beam engineering addressed to 1 South Garth Avenue, Columbia, MO — **still unconfirmed whether this is Building Integrity's own engineering** (possibly an earlier company name or the engineer's working file). Worth confirming — it may already satisfy part of the "pending" structural pre-engineering guide below.

---

## Construction Methods (first-class, selectable variable)

### Square Bale Panels
NFW-taught method, Building Integrity's current live process (confirmed via buildinteg.com's current copy, which still describes square-baler construction). Kept in the app as a **lighter reference/layout mode only** — not fabricated to anymore.
- Width and thickness locked together: **39" × 14"** (two 18" bales + two 1.5" studs)
- Typically needs continuous exterior plywood for shear, which works against permeability goals — the main reason for switching

### Loose Straw Dense-Packed Panels
Building Integrity's new direction, closer to a comparable European straw-panel producer's approach. **This is the method the calculation engine should fully support.**
- Width and thickness are independent variables (not bale-constrained)
- Fabrication: cut 4 studs, top/bottom plates (¾" ply + two 37" 2x4 runners), web girts (½" ply, 8.5"×38", 2x4 end bars) → bottom plate + studs set into fabricator table → loose straw added, pneumatic piston compresses → girt every 36" rides the piston down the stud guides, screwed off; repeat for remaining girts + top plate → trim, weigh against target density
- Carrot/bracing timbers are carved into the *finished* compressed panel afterward (angle grinder sled + Lancelot blade) — loose-pack has no internal tie the way a bale does, so local carving doesn't unravel surrounding compression

---

## Panel Dimensions (Loose Dense-Pack)
- **Width:** 40" temporary placeholder — legitimately unconstrained now that bale geometry doesn't apply
- **Thickness:** 14", 15.5" (temp. standard), 15.75" — all three selectable
  - 15.5" = 14" + 1.5" (one 2x4), so the fabricator table converts between styles with plain blocking
  - 15.75" ≈ 400mm exactly (a comparable European straw-panel producer's module), and divides a 4' sheet into 3 clean strips (zero waste)

## Target Density
- Suggested starting point: **~75 kg/m³ (~4.7 lb/ft³)** — peer-reviewed compressed-straw fire hazard study, best balance of thermal + fire performance
- General optimal range: 70–120 kg/m³ (~4.4–7.5 lb/ft³); floor ~50 kg/m³ (collapse risk); ceiling ~150 kg/m³ (impractical, thermal falloff)
- A comparable European straw-panel producer's own WUFI reports model their panel at 100 kg/m³ — sits mid-range, good cross-validation
- Straw core VDRF ≈ 1.3 (comparable producer's WUFI reports) — confirms straw is non-limiting for vapor calcs
- Reference densities: plywood/OSB ~36 lb/ft³; framing lumber ~25–35 lb/ft³ @ 10% moisture

## Panel Types (roster)
Standard · Corner · Column (reinforced/plywood-sided, >12' runs needing beam bearing under roof panels, not needed under trusses) · Carrot/Braced (diagonal; spacing by seismic zone, every 4/8/12/16 ft; 2 per corner forming an X; 1 per side of each window) · Header/Lintel (US term: **header**) · Sill · Inclined/Gable · **Safety/Gap Panel** — see below

### Safety/Gap Panel — confirmed detail
- Primary purpose is **dimensional tolerance absorption** between as-designed and as-built wall length, not primarily a structural feature (confirmed via NFW's own notes: "additional plywood to cover this tolerance and margin of error"). The strength increase is a genuine bonus, not the reason it exists.
- Building Integrity's version: standard panel width **minus ¾"**, plus **½" plywood on one face**
- Plywood held back **1¼"** from top and bottom (full-height panels); sill panels hold back from bottom only; header panels hold back from top only
- **Left/right side is always determined looking from the exterior** — universal convention, worth adopting to avoid field mistakes
- Placed farthest from the site's least-accessible side
- Applies to **roof panels too**, not just wall panels (confirmed on NFW's roof panel layouts, marked "SF")
- Open: exact fastener for attaching the ½" plywood skin itself (not yet sourced — likely standard sheathing nails/staples)

## Panel Calculations
Weight (straw volume × density-at-moisture + wood + nails) · density (lb/ft³ + kg/m³) · shear value & load capacity (pending Building Integrity's own pre-engineering numbers — see "For Baleheads Only" note above) · carbon sequestered · price ($28/sqft standard, $36/sqft column, $42/sqft roof, based on biggest face; total = Σ(area×rate) × 1.3 modifier)

---

## Fastener Standard
Building Integrity's system (via NFW precedent) standardizes on **GRK RSS structural screws** (ICC-ES ESR-2442, IBC/IRC code compliant) for nearly all structural wood-to-wood connections, supplemented by Simpson brackets/hangers at specific hardware connections. Real, sourced spacing table so far:

| Connection | Fastener | Spacing |
|---|---|---|
| Jack stud to panel | GRK 5/16"×4" star drive washer head | 24" o.c., interior & exterior |
| Panel to panel, interior | GRK 5/16"×4" star drive washer head | 24" o.c., staggered "stitching"/zipper pattern |
| Panel to panel, exterior | GRK 5/16"×4" star drive washer head | **16" o.c., staggered** (Building Integrity's resolved value — NFW's own two source docs conflicted at 6" vs 18") |
| Corner connection | GRK 5/16"×5⅛" star drive washer head | 18" o.c., 45° toe screw; paired at cross piece, 1" edge distance, 1½" between pair |
| Pier to beam | (4) Simpson SDS ¼"×4½" | 4 per connection |
| Floor panel to beam | GRK 3/8"×7¼" or 8" RSS | 12" o.c., 45° toe screw |
| Toe-up to floor panel | 16d nails | 12" o.c. interior, 6" o.c. exterior |
| Wall panel to toe-up | GRK 5/16"×5⅛" star drive washer head | 18" o.c., 45° toe screw, min. 3 per panel at exterior |

All values are NFW reference points — confirm against Building Integrity's own engineering before treating as final.

---

## Openings
- **Jack stud:** ¾" plywood, **U-shaped** (symmetric legs, not lopsided), toe-up to header, nailed to adjacent panels. Notch is 3"×5.5", cradles a double 2x6 (double 2x8 for spans up to 12 ft, notch deepens to 7.25"). **Top of the beam sits flush with the top of both legs** so the header panel bears evenly across the whole assembly. Beam secured with a metal hanger — model/size not yet selected, needs sizing to actual reaction load. Matches NFW's own header panel bill of materials ("2x6 x2" callout).
- **Window buck:** thermally broken, positioned **⅓ of wall depth in from the exterior face**. Buck's own fabrication method still open/schematic.
- **Doors:** two-leaf — screen door toward exterior face, 36" exterior-rated door toward interior face, same ⅓-depth logic as the buck

## Wall Assembly Finishes
- **Interior:** clay plaster direct-on-straw w/ paper+lath, OR Intello Plus (0.13–13.2 perm, variable) + furring + drywall
- **Exterior:** lime plaster direct-on-straw w/ paper+lath, OR Mento (38 perm, fixed) + furring + siding, OR timber board (wood-fiber insulation board, continuous thermal break), OR plywood + Adhero 3000 (8 perm) + furring + siding (needed near openings)
- **Permeability modeled as resistance-in-series** (1÷perm adds, not perm itself) — e.g. Intello+Mento assembly ≈ 0.13 perm winter, ≈ 9.8 perm summer
- **Validation rule:** flag any assembly where the exterior side isn't more vapor-open than the interior side

## Roof / Floor
- **Roof:** Adhero 3000 or Mento for underlayment; truss vs. roof-panel choice affects column-panel requirement; beam sizing depends on roof angle; dormer panels possible; safety/gap panels apply here too
- **Floor:** DIY EZ floor, structural panel floor (bathroom/step-panel option), thermally broken slab, crawlspace/basement/root cellar; Adhero Visto (1.1 perm, transparent) for floor wrap — **open: permanent layer or construction-phase-only?**

## Foundation Type
Moved to **early app sequencing** (with zip/seismic/units/site-accessibility).
- Standard: vented crawlspace on helical screw piers, full clearance
- Full load path confirmed: helical pier → wood beam → floor panel → toe-up (ext./int. 2x4 with 1½" wood fiberboard between, for thermal continuity) → wall panel bottom plate
- Floor vapor direction depends on foundation type: vented crawlspace → more open on the bottom (Mento). Slab and unvented basement/root cellar need their own logic — **not yet defined.**

## Wet-Area Waterproofing
- Flag the **whole tiled room**, not just the fixture zone
- **RedGard** (liquid-applied, ICC-ES ESR-1413, IAPMO-listed) over standard backer board — DIY-friendly default over Schluter-Kerdi
- Own visual flag + review-log/BOM line

---

## Output & Documentation
- Standard outputs: 2D floor plan, 3D render (angle set still TBD), aggregate totals (carbon, shear/load, price), disclaimer on every output, recommended-products appendix
- **Detail Guide Pages** — format validated and built out for 6 of 7 starter details:
  1. ✅ Wet-area floor waterproofing
  2. ✅ Window/door buck & jack stud (depth positioning)
  3. ✅ Jack stud & header beam (U-notch, double 2x6/2x8, hanger)
  4. ✅ Toe-up & foundation anchoring (full pier-to-wall load path)
  5. ✅ Panel-to-panel connections (straight seam + corner)
  6. ✅ Safety/gap panel
  7. ⬜ Floor-to-wall vapor continuity (synthesis detail — tying Mento/Intello logic through the toe-up transition) — **not yet built**
  - Template: branded header (logo + wordmark), title/trigger condition, parameterized diagram, fastener schedule (omitted if not applicable), notes, disclaimer + sign-off footer
- **Style:** NFW's Casitas Terra title block as structural template + Building Integrity's own logo. Simplified logo (blue + white, no gold) chosen for the small recurring title-block corner; full-color version (blue house, gold wheat) reserved for cover sheets. Tagline: *"The performance of modern construction. The integrity of natural materials."*
- **Review log:** every design ships an "Items for Engineer/Contractor Review" list, auto-populated from assumptions/reference values/validation flags

### Print / PDF export — paged-media rules
Both export paths (a note's own 🖶 button → `data-print-mode="page"`, and the "Export PDF" packet → `data-print-mode="packet"`) end in the browser's own Print / Save-as-PDF. On screen this app is a floating sticky-note editor; on paper it is a stack of sheets. **Every rule below lives inside `@media print` — screen layout and appearance are untouched.**

- **A sheet is a sheet: one fabrication sheet = one printed page.** The black frame and the right-hand title-block strip are the *edge of the sheet*, and they print exactly once. In print, `.sheet` releases its screen shape (`aspect-ratio` and `min-height` reset, `overflow: visible`) and is left free to size to its content — deliberately **uncapped**. An earlier attempt pinned it to the exact page box derived from the `@page` rules; that was reverted. Because `box-sizing: border-box` puts the 3px frame *inside* the height, the cap closed the frame precisely at the page boundary while the overflow painted into the unprintable margin — turning a truncated sheet into one that looked complete. `break-inside: avoid` on `.sheet` was dropped for the same reason. Native fragmentation is ugly when it happens; it never loses content.
  - This reframes an earlier print decision (Tommy: *"if it spills over to needing more than one page, then additional pages are made for that content"*, `SheetTitleBlock.module.css`). That instruction always held for the **content**; it was never meant to make the frame and title block reappear on page 2, which is what it actually did. Fragmenting a bordered flex row redraws the frame and an empty title-block column on the next page — Tommy read that as *"it puts it on two pages and it's duplicated."* It was never a duplicate render.
  - **Overflow policy — decided 2026-08-27 by Tommy, not yet built:** when a sheet's content genuinely exceeds one page, the remainder continues on **numbered continuation sheets** — each page a real framed sheet with its own title block, reading "Sheet 2 of 3". `SheetTitleBlock` already takes `sheetNumber`/`sheetCount` from `DocumentMetaContext`, so the metadata exists; the pagination does not. Rejected alternatives: unframed continuation pages, and auto-shrink-to-fit. Until it is built, an over-length sheet fragments natively and redraws its frame and title block on the continuation page. **Silent clipping is never acceptable** — losing a cut-list row off the bottom of a shop sheet is the worst possible failure here, and is exactly why the height cap was reverted rather than kept.
- **Scroll containers must be neutralized in print.** A `overflow: hidden`/`auto` box is unfragmentable — the browser clips it instead of flowing it. `SheetTitleBlock.module.css` already did this for `.sheet`/`.content`/`.titleZone`, but the shared StickyNote wrapper one layer up (`.note` `overflow: hidden`, `.body` `overflow-y: auto`) never got the same treatment: globals.css's shared print block reset display/position/inset/width/height/max-height/box-shadow but not `overflow`, so anything past the first page was silently cut off. That block now also resets `overflow` and `max-width` — an unreset `max-width: calc(100vw - 48px)` was printing the sheet 960px wide on a 1008px page, since `vw` resolves against the page area in paged media. Any new scrolling container anywhere in the app needs a print reset.
- **Sticky-note chrome never prints.** The note's yellow/gold card (background, border, radius, body padding) and its header bar with the live 🖶 / ⤢ / × buttons are editor UI, not document. They belong to the shared print block, not to any one page type — this affects every printed section, not just fabrication.
- **Screen-only guidance blurbs never print.** The "Fabricator/detailer document — one sheet per unique panel…" paragraphs above the fabrication sheets are on-screen orientation text; on paper they push the sheet down and eat page height. Marked opt-in with the existing `print-hidden-chrome` class rather than blanket-hiding `styles.note` (75 uses in `page.tsx`, several of which are honest caveats that *should* print).
- **"Last section" must be identified explicitly, not by `:last-of-type`.** `:last-of-type` matches the last element of its *element type* among siblings — not the last element matching the rest of the selector. StickyNotes are `div`s among many sibling `div`s emitted from several separate `.map()` groups, so the packet's "no page break after the final section" rule effectively never fired, and every multi-section export ended with a blank page. The last target is marked imperatively in document order at print time, alongside the existing `data-print-target` bookkeeping.

## Handoff
Digital handoff to the nearest Seed Collaborative fabricator's in-app inbox, labeled "Proposal" with a note field.

---

## 3D Member Geometry — the two axis spaces

There are **two** coordinate spaces in the member pipeline and both have been called "local space" in doc comments. A third name, **"panel space"**, is also in circulation (`componentSchema.ts`'s `PanelSpacePoint2D` and `trapezoidCornersIn`, `panelMemberHelpers.ts`, `columnPanelMembers.ts`, `openingAssemblyMembers.ts`): it is **not** a third space — it is member space's own X-Z elevation plane, and every existing use of it is correct. Treat "panel space (X-Z)" as an alias for the member-space elevation plane, and prefer the two names below in anything new. They are not the same space, and conflating them has already produced one shipped bug (below). Naming them, canonically:

- **Member space (authoring, Z-up)** — what `MemberPosition.xIn/yIn/zIn` in `componentSchema.ts` actually means, and what every member builder in `packages/panel-catalog/src` writes:
  - **X = width**, along the panel/assembly's length, from its own min-corner
  - **Y = depth**, through the wall, 0 at the exterior face
  - **Z = height, up**, 0 at the bottom face
  - Corroborated by `PanelSpacePoint2D`'s own doc comment ("panel-Z = up from its bottom face"), by `memberBoxSizeIn`'s orientation table, and by every builder's usage (`zIn: bottomDepthIn + gapIn`, `zIn: heightIn - SKIN_THICKNESS_IN` are heights; `yIn: depthIn - PLATE_2X4_WIDTH_IN`, `yIn: i * plyThicknessIn` are depths).
- **View space (render + export, Y-up)** — what `memberLocalCornersIn` *returns*, what `PanelMembersGroup.tsx` feeds three.js, what the OBJ file contains, and what `panelSlotBoxes3D` in `packages/geometry` describes: **world X = member X, world Y = member Z (height, up), world Z = member Y (depth).** The swap happens once, inside `memberLocalCornersIn` / `PanelMembersGroup`, and nowhere else.

**Rule: a member builder never writes view-space coordinates.** If a builder is reasoning about "up," that is `zIn`. If it is reasoning about "through the wall," that is `yIn`.

Doc comments to correct (they describe view space but call it "the panel's own local space," which reads as the authoring convention): `panelMemberHelpers.ts` ~line 111 on `memberLocalCornersIn`, and `PanelMembersGroup.tsx` ~lines 40 and 77-78. `componentSchema.ts`'s `MemberPosition` — the type that *defines* these three fields — documents the min-corner rule but never states which axis is which; that omission is the root of the confusion and is the most important place for the convention to land.

### Floor bottom-skin opacity bands — depth-axis placement bug (2026-08-30)
Tommy: *"sometimes when I draw a rectangle and then go to 3D Framed view, the translucent layers of the bottom of the floor detail (wire mesh and clay plaster) appear vertical above the 100% opaque area... these should always be on the same horizontal plane."*

`buildFloorBottomSkinMembers` (`baleFoundationMembers.ts` ~line 204) writes its depth-axis band offset into `zIn` instead of `yIn` — view-space thinking in a member-space builder, exactly the mix-up above. Bands 1 and 2 are lifted `bandSizeIn` and `2 × bandSizeIn` straight up into the air instead of tiling across the floor. Band dimensions are correct in both branches; only the position axis is wrong.

- **Intermittent because** `computeFloorMembraneOpacityBands` picks the longer axis (`widthFt >= depthFt ? "width" : "depth"`). The width branch writes `xIn`, which is right. Only footprints **deeper than they are wide** hit it — hence "sometimes," depending on how the rectangle was drawn.
- **The OBJ export has the same defect**, since it shares `memberLocalCornersIn`. Any `.obj` already downloaded from a deep footprint has the floating bands baked in; re-export after the fix.
- **The test encoded the bug** (`baleFoundationMembers.test.ts:39` asserts `position.zIn` is `[0, 160, 320]` for the depth axis), and the "covers the full span with no gap or overlap" test only ever exercised the width axis. Both get corrected.
- **Audited the rest of `packages/panel-catalog/src` for the same mix-up: clean.** Every other builder's `yIn` is depth-flavored and every `zIn` is height-flavored; this one line is the sole outlier. No inline member construction in `apps/web` authors a position from scratch; the four places that modify one by spread (`Building3DView.tsx:1126,1145`, `page.tsx:3431,3837`) are all height offsets on `zIn`, correctly. Scope stays a one-line fix plus tests plus the doc-comment corrections.
- Layout/geometry only — no real-world building value changes, nothing new reaches the review log. **Flags check: clean, confirmed rather than assumed** (no `CatalogValue`/`CatalogRange`/`PanelStructuralStatus` in the diff; the band opacities 1 / 0.75 / 0.5 and `STEEL_MESH_THICKNESS_IN` are render-only and unchanged).

### Floor bottom skin follows the footprint polygon, not its bounding box (2026-08-30) — BUILT
Tommy, seeing it live: *"i see how it overlaps on the current live version - not what i want. lets make that the same size as the footprint."*

`Building3DView.tsx:1283-1301` derives the skin from `footprint.corners`' **bounding box** (`minX/maxX/minZ/maxZ`), and `buildFloorBottomSkinMembers` emits rectangular box members from it. Correct on a rectangle; on an octagon, a bump-out, or a notch the skin is the bounding rectangle and hangs out past the real floor. The **cost side was already right** — `page.tsx:3710` charges steel mesh and floor-bottom plaster off `computeFootprintAreaSqFt(footprint)`, the true shoelace polygon area — so this is the 3D view catching up to what the calculator already bills, not a pricing change.

**Decision: the skin becomes an n-gon prism — a plan-plane polygon extruded through the mesh thickness — one member per connected band piece.** The band polygon is `footprint ∩ band strip`, so it is whatever shape the building actually is.

- **Why not clip-into-rectangles.** A strip through an octagon is a hexagon with 45° edges; only a rectilinear footprint decomposes into rectangles at all. Dead end for the shapes this app already supports.
- **Why not triangulate into many prism members.** It keeps `BOX_FACES`-style fixed topology, but the bands are *transparent*. Every shared edge between two adjacent triangle prisms is a pair of coincident coplanar internal faces — z-fighting stripes across a 50%-opaque floor, which is a direct regression against the reason the bands exist ("it's hard to see the floor framing"). One ring per connected piece means internal faces appear only at genuine band boundaries (intended) and at notch-caused splits (disjoint anyway).
- **Member count stops being exactly 3.** A band can split into several disjoint pieces — a U-shaped footprint (mid-wall notch, which `insertBumpOut` supports with a negative depth and non-flush ends) cuts a strip in two. Every piece of a band carries that band's own opacity. "3 bands" was always about opacity, never member count.

**Schema.** `MemberPosition` gains `planPolygonCornersIn?: PlanSpacePoint2D[]` — a new `{ xIn, yIn }` sibling to `PanelSpacePoint2D`, absolute in **member space's plan (X-Y) plane**, extruded upward from `position.zIn` by `actualDimsIn.thicknessIn`. Note this is a *different plane* from `trapezoidCornersIn`, which is the member-space elevation (X-Z) plane extruded through depth — a floor plate and a beveled brace are genuinely different extrusions, so they get different fields rather than one overloaded one. Mutually exclusive; `memberLocalCornersIn` checks the trapezoid first, unchanged. `zIn` is the bottom face (the min-corner rule every other `"flat"` member already follows), so all pieces sharing `zIn: 0` keeps the coplanarity the depth-axis fix above just established — **there is still no legitimate reason for this builder to write a depth offset into `zIn`.**

**Topology.** `BOX_FACES`' fixed 6-quad table can't describe an n-gon prism, and both consumers import it directly. It is joined by `memberFaceIndices(member)` in `panelMemberHelpers.ts`, returning `BOX_FACES` verbatim for every member that exists today and, for a polygon member, *n* side quads plus ear-clipped triangle caps. Both consumers switch to it. This *extends* rather than weakens the "screen and OBJ can never disagree" invariant: corners **and** face topology now come from one shared place instead of corners-shared/topology-assumed. The ear clipper lives in `panel-catalog` (which deliberately has no dependency on `packages/geometry`); nothing is duplicated, since no triangulator exists in either package today. Only tris and quads are ever emitted — no face grows past 4 vertices, same as today's OBJ.

**The exporter's hidden assumption.** `panelObjExport.ts` advances `vertexCount += 8` after every member, in both `buildPanelObj` and `buildBuildingObj`. A 2*n*-corner member makes every subsequent `f` line in the file point at the wrong vertices — a silently corrupt `.obj`, not a crash. It becomes `corners.length`. This is the single highest-risk line in the change.

**Split axis and band widths — both unchanged, deliberately.**
- The split axis stays **bounding-box derived** (`computeFloorMembraneOpacityBands`, untouched). The bands are a legibility device, and "which way is this building longer" is exactly what a bounding box measures, whatever the polygon does inside it. `nearIsMax` compares the marker against the same box extremes, so the two stay coherent. A polygon principal axis would be new machinery for no gain Tommy asked for.
- Bands stay **equal width along the axis**, not equal area. The bands read as *distance from the least-accessible corner*; equal-area boundaries sit at positions that correspond to nothing physical, and on an L-shape would crowd two boundaries into the narrow arm. Equal width also keeps the boundaries as straight constant lines, which is what makes the clip and its tests tractable. Reversible if Tommy dislikes it on a lopsided L — logged in Open Items, not built.
- No band can come out empty: the polygon is connected and spans the axis from min to max by construction, so every strip between them intersects it. Degenerate slivers (a boundary landing exactly on a vertex) are dropped below an area epsilon rather than emitted as a zero-area member.

**Ownership moves.** `computeFloorMembraneBandPolygons(footprint, nearPoint)` (new, `packages/geometry`) calls `computeFloorMembraneOpacityBands` internally and returns band pieces with `bandIndex` **0 = nearest the marker**. `buildFloorBottomSkinMembers` then takes pieces instead of `widthIn/depthIn/bandPlan`, and the hand-synced `FloorMembraneBandPlan` copy at the top of `baleFoundationMembers.ts` is deleted — the axis/`nearIsMax` decision ends up living in exactly one package, one less duplicated interface to keep in sync by hand.

**Staged as two commits, because the first is provably a no-op.** (1) Schema field + `memberFaceIndices` + both consumers + the `vertexCount` fix, with a golden test proving today's members produce a byte-identical `.obj`. (2) The band polygons, the builder, and the call site — where the visible change actually lands. Splitting them means a rendering regression can only have come from commit 2.

**Expected flags check: clean** — verified against the code, not assumed: no `CatalogValue`/`CatalogRange`/`PanelStructuralStatus` is in scope; `STEEL_MESH_THICKNESS_IN` and the 1 / 0.75 / 0.5 opacities are unchanged render-only values; mesh and plaster cost already read `computeFootprintAreaSqFt`, so no dollar figure moves; the only new constants are geometric tolerances (an area/coincidence epsilon of the same order as `SQUARE_TOLERANCE_IN`), which are numerical, not real-world. The coder re-runs the 6-point check against the actual diff.

### Bale Foundation perimeter rings bracket the wall (2026-08-30) — ALL THREE STAGES BUILT (2026-08-31)

Tommy, seeing it live: *"i see the floor framing on bump outs has a similar problem - and also is spawned wrong. there should be a larger multi-piece unit of lumber as the perimeter, under and flush with the inside of the outer perimeter of the walls. i would like that second large unit to be panel-depth inward perimeter and flush the other way. so basically these two large pieces (or LVL's if thats selected) are flush with the exterior and interior of the panel wall - does that make sense? right now, one piece is flush with the wrong side of the inner part and then theres one like 3 ft away, and theres nothing under the exterior wyth of the panel wall."*

**The intent: the two doubled rings bracket the wall, one under each wythe.** Ring A's outboard face flush with the wall's **exterior** face; Ring B's inboard face flush with the wall's **interior** face. Today neither is true. Three separate defects, all verified against the code rather than inferred:

1. **Ring A is inset by the full wall thickness**, so its outboard face sits at the wall's *interior* face and the entire ring is inboard of the wall. Exactly Tommy's "flush with the wrong side of the inner part," and the reason "there's nothing under the exterior wythe."
2. **Ring B's inset uses `standardWidthIn` — the panel's WIDTH along the wall (~40in) — as an inward offset distance.** `const ringBInsetIn = thicknessIn + standardWidthIn`. This is a **dimension-semantics error of the same family as the `yIn`/`zIn` mix-up** in the floor-skin fix above: a width used where a depth belongs. It puts Ring B ~4.6ft inboard, matching Tommy's "one like 3 ft away." Per his instruction the offset is **panel depth**, not panel width.
3. **`computeInsetPerimeterRing` (`perimeterRing.ts:47-50, 90`) still decides "which way is inward" from a naive vertex-averaged centroid** — the exact heuristic `bumpOut.ts` was fixed to abandon, documented in the regression test at `bumpOut.test.ts:204-212` ("a vertex average gets dragged hard toward a cluster of 4 tightly-spaced new corners from a single bump-out, which can flip which side reads as outward for an unrelated wall elsewhere"). **This is the likeliest cause of Tommy's "spawned wrong" on bump-outs, and it is wrong on its own terms regardless** — the winding-order replacement already lives in the same package.

**The geometry, made unambiguous.** A ring is a doubled pair of framing stacks, each `PLATE_2X4_THICKNESS_IN` thick, laid side by side at `yIn: 0` and `yIn: PLATE_2X4_THICKNESS_IN` (`buildDoubledStackPair`), so **`ringWidthIn = 2 × PLATE_2X4_THICKNESS_IN = 3in`** and `insetIn` positions the pair's **outboard face** — the ring occupies `[insetIn, insetIn + ringWidthIn]` measured inward from the exterior footprint line. The wall itself occupies `[0, thicknessIn]` (`wallBoxes3D`'s "exterior line minus thickness" convention). Therefore:

| Ring | Inset | Occupies | Flush with |
|---|---|---|---|
| A (exterior) | `0` | `[0, 3]` | wall's **exterior** face, on the ring's **outboard** side |
| B (interior) | `thicknessIn − ringWidthIn` | `[thicknessIn − 3, thicknessIn]` | wall's **interior** face, on the ring's **inboard** side |

That is "flush the other way" stated as a rule: **each ring is flush on the side that faces the wall face it belongs to**, so the pair brackets the wall and the clear span between them is `thicknessIn − 2 × ringWidthIn` (9.5in at the 15.5in default).

- **`ringWidthIn` is derived from the member spec, never hardcoded**, so a future material change moves Ring B automatically and keeps both flush. This matters immediately for the LVL question below.
- **Degenerate guard:** if `thicknessIn < 2 × ringWidthIn` the two rings would overlap. No shipping thickness comes close (the thinnest selectable is 14in, and `panelThicknessInRange`'s floor is 11.75in, against 6in of ring), but the guard collapses them to a single centered doubled ring rather than emitting interpenetrating geometry. An interpretation, not Tommy's instruction — flagged in the doc comment.
- **Field framing starts inboard of Ring B**, i.e. at `insetIn = thicknessIn` (the wall's interior face). The zone between the two rings is under the wall's own load path, not interior floor span. Today it is `thicknessIn + standardWidthIn`, which additionally leaves a ~40in unframed band all the way around the interior — a third visible symptom of defect 2.

**Two independent copies of this arithmetic have to change together.** `Building3DView.tsx:1249-1253` (3D) and `page.tsx:1644-1678` (2D, feeding FloorCanvas) each derive the insets separately. They must not be allowed to disagree; the inset derivation becomes one shared exported helper rather than a corrected duplicate. `baleFoundationBoardCount` and `baleFoundationLumberVolumeFt3` (`page.tsx:1683-1687`) hardcode a `1.5` board thickness in the same block — same source, same fix.

**LVL: not invented here.** Tommy's *"(or LVL's if thats selected)"* implies a material choice on these rings. **There is no such option today** — `buildFramingStackMembers` hardcodes `PLATE_2X4_THICKNESS_IN`. The catalog carries LVL in two unrelated places, and neither is a licence to pick a number here: `floorJoistTypes[].joistWidthIn` = 1.75in belongs to the **suspended floor joist** system (`floorRimJoistDetail`, `FIELD_JOIST_DEPTH_REDUCTION_IN`), a different floor type entirely; and `boxBeamMembers.ts`'s `BOX_BEAM_LVL_THICKNESS_IN` = 2in with its selectable depth set belongs to box beams. The box-beam one is the closer precedent for a ring material selector and is where to start. Borrowing either number for bale-foundation rings today would be exactly the kind of plausible-looking invention this spec's flag convention exists to prevent. So: **the inset arithmetic is written in terms of `ringWidthIn` now** (which is the whole cost of supporting it later), and whether the rings get their own material selector is an Open Item for Tommy, not something this pass builds.

**Field framing follows the polygon, not the bounding box.** `computeFieldFramingLayout` (`perimeterRing.ts:131-160`) lays its lines across the footprint's inset **bounding box**, so on an L or a U the field stacks run through the notch — through open air. This was already logged as a deferred Open Item alongside the floor-skin fix; Tommy has now seen it ("the floor framing on bump outs has a similar problem"), so it is in scope. Each line is clipped against the inward-offset footprint and only the inside spans are kept.
- **One line can become several spans**, so the `FieldFramingLine.id` scheme grows a span index (`field-${i}-${spanIndex}`). Those ids are member-id prefixes and React keys in both consumers — a silent collision here would merge two stacks in the OBJ export, so this is the highest-risk part of that change.
- The offset polygon to clip against is derived from `computeInsetPerimeterRing`'s own segment endpoints, which are already mitered and reflex-extended — reusing existing machinery rather than writing a second polygon offsetter. `computeJoistLayout` has the identical defect and is deliberately **not** folded in (different floor type, no report from Tommy).

**Ring tracing itself is fine** — `computeInsetPerimeterRing` handles arbitrary polygons including reflex-corner extension correctly, verified against `wallBoxes3D`'s own algorithm. The bugs are the inset *values* and the direction heuristic, not the tracing.

**Staged as three commits, smallest and most independent first.**
1. **Direction heuristic — BUILT 2026-08-31.** Delete the centroid from `perimeterRing.ts`; `inward` becomes the winding-based perpendicular unconditionally (it is already computed as `perp` on line 87 — `outwardNormal` is exactly its negation, so this is a deletion, not new math). Regression test mirroring `bumpOut.test.ts:204-212`. Fixes "spawned wrong" on bump-outs and nothing else.
2. **Ring placement — BUILT 2026-08-31.** The two insets, the shared derivation helper, the field-framing inset, the board-count/volume constants. Fixes "nothing under the exterior wythe" and the 4.6ft ring. Shipped as `baleFoundationRingPlan(wallThicknessIn)` in `packages/panel-catalog`, read by both consumers; `ringWidthIn` is derived from `PLATE_2X4_THICKNESS_IN` and asserted in test against `buildDoubledStackPair`'s own emitted member geometry, so it cannot drift from the real boards. Quantities move, as expected from a geometry fix: on a 30x20 rectangle at the 15.5in default with 16in field spacing, **66 -> 76 boards and 66.8 -> 89.7 ft3**; with a 6ft bump-out off one wall, **98 -> 108 boards and 75.0 -> 95.7 ft3**. The increase is almost entirely field framing (17 -> 22 lines) — the old `thicknessIn + standardWidthIn` inset was leaving a ~40in unframed band all round the interior. Placement is asserted in **world space** off `buildBuildingObj`'s own vertices (`apps/web/app/baleFoundationRingPlacement.test.ts`), never by re-reading `insetIn`; the old insets were re-applied as a mutation check and 12 of the new assertions fail under them.
   - **The suspected 2D/3D 0.75in offset does not exist** (the Open Item below asked for this while the coder was in both files). The 2D canvas draws each ring as 2 lines, at each stack's **outboard face** (`insetIn` and `insetIn + PLATE_2X4_THICKNESS_IN`); the 3D pair spans `[insetIn, insetIn + 3in]` with its stacks' outboard faces at exactly those two positions. Asserted in world space per wall, not read off the numbers. What the 2D genuinely does not draw is the inner stack's own inboard face, so a ring reads as 2 lines rather than a 3in band — a representation choice, not a misplacement.
3. **Field framing polygon clip — BUILT 2026-08-31.** Each bay is clipped to the inward-offset footprint by a new `clipSegmentToPolygon` (`packages/geometry`), and `FieldFramingLine.id` becomes `field-<line>-<span>`. What the clip does NOT change, deliberately: which axis the lines run along and where each line sits along it stay **bounding-box derived** — the same split `computeFloorMembraneBandPolygons` made when it kept its band axis on the bounding box and moved only the band shapes onto the polygon, and it is what makes this an exact no-op on a rectangle.
   - **The offset polygon is built out of `computeInsetPerimeterRing`'s own output** (`computeInsetFootprintPolygon`), not a second offsetter: each ring segment already lies on its wall's inward-offset line, so the polygon's vertices are just the intersections of consecutive segments' infinite lines. Convex-corner overlap and reflex-corner extension both move where a segment *stops* along its line, never the line, so intersecting the lines turns the ring's per-wall approximations into an exact mitered polygon.
   - **The octagon was broken too**, which nobody had reported and the handoff did not predict: a bounding box overhangs a mitered corner, so the pre-fix layout ran spans outside an octagon exactly as it did outside a notch. The rectangle is the only shape a bounding box describes exactly, which is why this shipped invisible.
   - **Quantities on a 30x20 at the 15.5in default / 16in spacing** (field framing only; ring counts unchanged): rectangle **76 boards / 89.7 ft3 -> unchanged, bit-identical**. 15x8ft notch: **92 boards, 90.0 -> 79.0 ft3**. 6ft outward bump-out: **108 boards, 110.8 -> 99.8 ft3**. Two-notch U: **140 boards, 105.4 -> 92.5 ft3**. A 10ft-deep notch off a wall PARALLEL to the lines is the only case where board count moves (**108 -> 124**, 99.4 -> 89.7 ft3) — it is the only geometry that splits one bay into two stacks rather than just shortening it.
   - **Not vulnerable to `clipRingToHalfPlane`'s open collinear-spike defect.** That is a property of returning a non-simple *ring*; this returns 1-D intervals. A collinear polygon edge or a grazed vertex contributes extra breakpoints, and an interval is emitted only if its own midpoint tests inside, with adjacent kept intervals merged — so a breakpoint that didn't actually change inside/outside is absorbed rather than becoming a doubled or zero-length span. **Boundary counts as inside**, which is load-bearing rather than a tie-break: a rectangle's outermost field lines sit exactly on the inset polygon's own edge, and reading the boundary as outside would silently delete them.
   - **Known limitation, and it IS reachable — an earlier draft of this bullet said otherwise:** a miter offset self-intersects once the inset exceeds half a feature's width (a feature narrower than 2 x inset). That threshold is 2.58ft at the 15.5in default, BELOW `insertBumpOut`'s own 2ft `MARGIN_FT`, and its degenerate-span fallback yields sub-2ft features on any wall under 4ft, which `snapSpanPointFt` lands on. Worked repro: rect 30x20, notch "AB" 3..13 by -8, then notch the resulting 3ft wall 1..3 by -6 — the offset polygon gains a vertex at x = -0.29, and unguarded `field-0-0` runs y 1.29 -> 18.71 straight through the 1ft notch, i.e. the exact defect stage 3 exists to remove. Outward thin arms fail SAFE (the reversed loop reads as outside, so the arm merely goes unframed); inward thin features fail UNSAFE once a leg is under ~one inset. **Guarded 2026-08-31:** `computeFieldFramingLayout` re-clips every span against the real footprint polygon after the inset clip — free on every sane shape, and it kills the whole class. A straight-skeleton offset is still not built, so any NEW caller of `computeInsetFootprintPolygon` needs the same guard.
   - **No minimum practical span length is invented.** A bay that clips to a 1in sliver is still emitted as a 1in framing stack. Whether there is a shortest stack worth building is a shop question for Tommy, in Open Items.
   - Mutation-checked twice: restoring the bounding-box behavior fails 5 of the new assertions, and keeping the clip while dropping the span index from the id fails 5 (including the OBJ-group-merge check, which is the silent-failure mode).

**Flags check: expected clean, but with one thing to watch.** No `CatalogValue`/`CatalogRange`/`PanelStructuralStatus` changes; the new insets are *derived* from existing values (`thicknessIn`, `PLATE_2X4_THICKNESS_IN`) rather than being new numbers, and no fastener, load, density, or cost figure moves — board count and lumber volume change because the geometry was wrong, not because a rate did. **The thing to watch:** the ring-placement rule is Tommy's own verbal description of his own detail, so the placement is `confirmed`; but the *degenerate-thickness collapse* and the *field-framing-starts-at-the-interior-face* choice are interpretations, and belong in doc comments and Open Items rather than being presented as his instruction. Do **not** add an LVL width for these rings under any status — the honest state is "no option exists yet."

---

## Dimensional Precision — the 1/8in grid (2026-08-30) — **Stages 0 and 1 BUILT 2026-09-06**; Stages 1b, 2 and 3 not built

Tommy: *"is there a way to make the movement of drawing tools, bump out, panel movers, etc be based on 1/8", and displayed in fractions. the whole goal here is to make it easy to read in the shop, let flexable for precision moving... i just dont want to see really long fractions displayed on panels or anywhere really, i suppose unless the user enters it themselves. we must remain absolutely precise on total lengths of wall segments being exactly the same as the addition of all the panels"*

This is one decision with two halves that are usually confused: a **display** convention (fractions) and an **exactness invariant** (parts sum to the whole). The second one constrains the first hard, and it is the reason this is a model change rather than a formatting sweep.

**The invariant, stated:** for every wall, on every story, `Σ(slot.widthIn) === wallFabricationLengthIn(wall)` **exactly**, and every `slot.widthIn` is a whole number of 1/8in. Both halves are required — either alone is useless. Widths that sum correctly but aren't eighths become wrong the moment they're displayed; widths that are all eighths but don't sum leave a wall short.

**Why display rounding can't deliver it.** `formatImperialFractionIn` already rounds to the nearest 1/8in (Tommy's own earlier decision: *"when in imperial, round everything to the nearest 1/8th inch and denote that as fractions everywhere"*) — but if the underlying widths aren't eighths, rounding each one independently is a lossy operation applied N times, and N roundings of ≤1/16in each do not cancel. The displayed parts then genuinely do not add to the displayed whole, no matter how the formatter behaves. **Quantization has to happen in the model; formatting then becomes lossless by construction.**

**Where it breaks today, concretely.** `computePlainSizing` in `packages/geometry/src/tiling.ts` splits the leftover with `const eachIn = (standardWidthIn + remainderIn) / 2`. Whenever `standardWidthIn + remainderIn` is an **odd** number of eighths, each half lands on a 1/16 — e.g. `40 + 7.125 = 47.125` (377 eighths) halves to `23.5625` (188.5 eighths) twice. Displayed at nearest-1/8 that pair reads `23⅝ + 23⅝ = 47¼`, against a budget of `47⅛`. That is exactly the failure Tommy is warning about. The same even-split pattern appears in `buildEvenMiddle`, `computeSillRunWidths`, `tileUniformRun` (`uniformPanelization.ts`), and `computeGableTiledRow`.

### The grid

- **The quantum is 1/8in, always, everywhere in the model.** It is a precision convention, not a building dimension — nothing here is a fastener spacing, a load, a density, or a cost. Nothing needs Building Integrity's engineer.
- **The canonical representation is an integer count of eighths.** Any function that must be exact converts at its boundary (`Math.round(valueIn * 8)`), does **integer** arithmetic, and converts back. This is what makes "exact" actually exact rather than "within 1e-9" — float `lengthFt * 12` is never bit-exact, and 1/96 ft is not representable in binary.
- **Everything the grid depends on is already an eighth**, verified rather than assumed: `SAFETY_GAP_WIDTH_IN` 0.75, `cornerPanelWidthIn` 25.5, `panelWidthInRange` 15.75–48, the 40in standard default, Square Bale 39in, and all three thickness options 14 / 15.5 / 15.75. **None of these change.**
- **Uneven splits replace even splits.** A shared `distributeEighths(budgetEighths, count): number[]` gives `base = ⌊budget/count⌋` to every part and one extra eighth to the first `budget mod count` parts. Every part is a whole eighth; the parts sum to the budget exactly; siblings differ by at most 1/8in, which no shop can tell apart on a cut list. For the 2-way split above: 189 and 188 eighths → `23⅝"` and `23½"`, summing to `47⅛"`.
  - **Deterministic absorber rule:** the extra eighth(s) go to the **lowest-index part in the returned array**, and `buildPlainMiddle` places that array in its existing order. Deliberately arbitrary but fixed, so a given wall always tiles identically. See Open Items — if Tommy would rather the wider panel always sit nearest the gap, that is a one-line reorder at the call site, not a change to `distributeEighths`.

### Wall length is quantized too — including the octagon's diagonals

A wall can only be tiled into eighths if its own length is an eighth. Two levels:

1. **Footprint corner coordinates are snapped to 1/8in** on the way out of every footprint-producing operation — `buildRectangleFootprint`, `buildOctagonFootprint`, `insertBumpOut`, `dragWall`/`dragWallBounded`/`dragWallWithCollapse`, `editWallLength` — before each one recomputes `lengthFt` from the corners (which they all already do). For **rectilinear** walls this alone makes every length an exact eighth, and it also stops repeated edits from accumulating float drift.
2. **`wallFabricationLengthIn(wall)` = `roundToEighthIn(wall.lengthFt * 12)`** is the single accessor that tiling, panel instances, elevation, and every display read. For rectilinear walls it is a no-op. For an **octagon's 45° walls it is not**: a diagonal between two grid points has an irrational length, so the grid and a regular octagon are mathematically incompatible. The residual is **≤1/16in per diagonal wall**, it is a drawing-vs-fabrication difference rather than a panel-sum error, and it is exactly the class of tolerance the safety/gap panel exists to absorb (see "Safety/Gap Panel — confirmed detail"). On the plan canvas at `SCALE_PX_PER_FT = 12` it is 0.06px. **Stated here rather than hidden**; rejected alternatives were distorting the octagon to force grid-exact diagonals (breaks the equal-side shape Tommy explicitly asked `snapOctagonBoxPx` to preserve) and exempting mitered shapes from the invariant (leaves a hole in the one guarantee this whole pass exists to make).

### Where snapping lives

**One shared primitive, in `packages/geometry`** — it has zero package dependencies and this is numeric/geometric, not catalog- or cost-aware. `calc-engine` gains `"@building-integrity/geometry": "*"` (acyclic; geometry depends on nothing) so `units.ts`'s formatters can share the same constant instead of a hand-synced copy.

Applied at the **input handlers**, not inside the geometry functions — the geometry functions receive already-snapped values, and additionally quantize their own *derived* outputs. Call sites in scope:

| Gesture | Where |
|---|---|
| Shape drawing (rectangle/octagon box drag) | `FootprintCanvas.tsx` px→ft conversion |
| Bump-out span ends + depth | `snapSpanPointFt` (`canvasGeometry.ts`), `insertBumpOut`'s depth clamp |
| Drag wall | `handleDragWall` (`page.tsx` ~7188) → `dragWallWithCollapse` |
| Edit wall length (inline field) | `FootprintCanvas.tsx` ~696–701, `parseLengthFt` commit |
| Panel movers (drag a panel boundary) | `WallElevationDiagram.tsx` ~881–905, `onDragResizePanels` |
| Mid-wall beam height / Big Header top / coverage handles | `WallElevationDiagram.tsx`, `midWallBeam.ts` |
| Gable profile point drag, max-panel-height line drag | `WallElevationDiagram.tsx` |
| Measure tool readout | `FootprintCanvas.tsx` / `FloorCanvas.tsx` |

**Order of operations: semantic snap first, eighth-quantize last.** The app already has meaningful non-1/8 snaps and they keep priority — `SPAN_SNAP_MIN_REMAINDER_FT` (2ft), `SPAN_SNAP_FLUSH_THRESHOLD_FT` (1ft), `OCTAGON_SQUARE_SNAP_PX`, `MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN` (6in), `MID_WALL_BEAM_HEADER_SNAP_THRESHOLD_IN` (3in), `BIG_HEADER_BEAM_MIN_HEIGHT_IN` (6in), `MIN_NEIGHBOR_LENGTH_FT`, `MIN_DEPTH_FT`, `MARGIN_FT`, and the slot-edge snapping the beam coverage handles use. **Every one of those targets is already an eighth-exact value**, so the final quantize is a no-op whenever a semantic snap fired. Nothing is duplicated or re-thresholded; the eighth grid is a floor under them, not a competitor.

**The panel mover conserves by construction and should be written that way:** snap the *boundary position*, then `leftWidthIn = boundary − pairStart` and `rightWidthIn = pairEnd − boundary`. The pair total is untouched, so the wall's sum can't drift no matter how the drag goes.

### Typed entry, and a formatter that never lies

Tommy's *"unless the user enters it themselves"* read two ways: (a) typed values are exempt from snapping, or (b) it's fine to *see* an ugly fraction if the user typed it. (a) is incompatible with the invariant — a hand-typed 47.6875in window width makes the remaining plain budget a non-eighth, and every panel on that wall inherits the problem. **Tommy confirmed (b), 2026-08-30**: snap typed values too, redisplay the snapped value, and make the formatter stop rounding silently so an off-grid value is visibly a long fraction rather than a quiet lie.

- **Numeric entry is snapped to 1/8in on commit** (blur/Enter), not on keystroke. The field then immediately redisplays what will actually be built, so the user is never shown one number while another is stored.
- **`formatImperialFractionIn` stops rounding silently.** New contract: a value that *is* a whole eighth renders as an eighth fraction; a value that is **not** renders at the finest precision that is exact (1/16, 1/32, 1/64) and, past that, as a decimal. A long fraction on screen therefore becomes a **signal that a value escaped the grid** — which is precisely the useful reading of Tommy's carve-out. Silent rounding is the failure mode this whole section exists to prevent; a formatter that quietly rounds is the same bug as a `confirmed` flag on a researched number.
- Sites that legitimately display a genuinely non-grid derived quantity (a measured diagonal, a rafter length, a hypotenuse) opt in with `formatLengthIn(v, unitSystem, { approximate: true })`, which rounds to the nearest eighth and marks it as approximate. Honest either way; never a silent lie.
- **`formatFeetInches` (`canvasGeometry.ts:519`) currently rounds to whole inches** — `Math.round(ft * 12)`. It is the wall-length label on the footprint canvas, the inline wall-length editor's seed value, the elevation's "Overall Width", and the measure-tool readout, so today a 24'-3⅝" wall reads `24'-4"`. **Tommy's call, 2026-08-30: long lengths read as feet-inches-eighths (`24'-3⅝"`)**, not decimal feet and not raw inches — so `formatFeetInches` gains a fraction part and `formatTrailerLengthIn`'s decimal-feet disagreement (`page.tsx` ~362) is reconciled to the same convention.

### Fraction input — the parser is the other half of this

Tommy: *"also double check that when the user enters 47 5/8" that that enters as such as well."*

Formatting fractions is only half a shop tool; a shop user **types** fractions. This is currently broken in two different silent, data-losing ways, and it is a nastier class of bug than anything in the display sweep — it loses the value on entry rather than merely mis-rendering it.

1. **`parseLengthFt` (`canvasGeometry.ts:527`) has no fraction branch at all.** It matches a feet-inches form (`/^(\d+(?:\.\d+)?)\s*'\s*-?\s*(\d+(?:\.\d+)?)?\s*"?$/`) or falls through to `parseFloat`. `parseFloat("47 5/8")` returns **47** — the `5/8` is silently discarded, no error, no warning. The feet-inches branch has no fraction slot either, so `24'-3 5/8"` doesn't match it and falls through to `parseFloat` too, yielding **24**. Worse, `commitEdit` (`FootprintCanvas.tsx:699-707`) does `if (parsed !== null)` and otherwise just closes the editor — an unparseable entry is a silent no-op with no feedback.
2. **Every inch-domain numeric field is `<input type="number">`** (e.g. window width, `page.tsx:6948-6957`). A `number` input **cannot hold `47 5/8` at all** — the browser refuses the text, `e.target.value` comes back `""`, and `Number("")` is **0**. So a typed fraction there doesn't drop the fraction, it can zero the dimension. Supporting fraction entry means those fields become `type="text"` with parse-on-commit. (They already carry `step={0.125}` — the spinner arrows have stepped by 1/8 all along, which is a nice independent confirmation that 1/8 is the right grid, but `step` never constrains a *typed* value.)

**Accepted grammar** — one shared tokenizer, two thin domain wrappers (`parseLengthIn` returning inches, `parseLengthFt` returning feet, keeping its existing signature):

| Input | Means |
|---|---|
| `47 5/8`, `47-5/8`, `47 5/8"` | whole + fraction |
| `5/8`, `5/8"` | bare fraction |
| `47⅝`, `⅝` | the glyphs `formatImperialFractionIn` itself emits |
| `24'-3 5/8"`, `24' 3⅝`, `24'3"` | feet + inches + optional fraction |
| `47.625`, `47` | existing decimal and whole forms, unchanged |
| anything else | `null` |

- **Any denominator is accepted**, then snapped to the eighth grid on commit — a shop person may well type `5/16` or `3/32`. `47 5/16` commits as `47⅜` and immediately redisplays that way, so Tommy always sees what got stored. (Round-half-up on the eighth, matching `roundToEighthIn` everywhere else.)
- **The parser and `formatImperialFractionIn` are now inverses** and are tested as a round-trip pair: format-then-parse returns the identical value for every eighth across a swept range, in both the inch and the feet-inches domain. Same for `formatFeetInches`, whose existing round-trip test (`canvasGeometry.test.ts:25`) must keep passing at the new precision.
- **A failed parse must be visible.** Today it's a silent no-op. The field keeps focus, shows its previous value, and marks itself invalid — never silently commits a different number. Silent substitution is the same failure mode as silent rounding, and this whole section exists to eliminate it.
- **The fraction is always inches.** Tommy, 2026-08-30: *"fractions when entered like 47 5/8 - the fractions should always be considered a fraction of an inch."* So the fraction part never takes the field's own unit — **the whole number keeps the field's unit, the fraction is always inches.** In an inch-domain field, `47 5/8` = 47.625in. In the feet-domain wall-length field, `47 5/8` = 47ft + ⅝in = 564.625in. This is how a carpenter reads it aloud, and it is what makes `24'-3 5/8"` parse consistently with everything else — the same rule applied to a value that already has both units written out.
  - **⚠ Assumption to confirm, and the miss is a factor of twelve.** The competing reading is that a fraction switches the whole field to inches, so `47 5/8` in the wall-length field would mean 47.625 **inches**. That is 3'-11⅝" against 47'-0⅝" — not a subtle difference, and the failure is silent if the parser guesses wrong. The rule above is taken literally from Tommy's words; it has not been demonstrated to him on the actual field. See Open Items.
  - **Mitigation, spec'd as part of this and not as a later nicety: a live resolved hint.** As the user types, the field shows the parsed result below/beside it (`= 47'-0⅝"`) before commit. Whichever reading turns out to be right, Tommy sees the real number before it lands, which turns a factor-of-twelve trap into something self-correcting. It also gives the failed-parse state somewhere honest to live (`= —, unrecognized`) instead of a silent no-op.

### Metric

**The grid stays 1/8in in metric mode. The unit toggle is display-only and never changes stored geometry.** Rationale: the panels are fabricated in a US shop off a US tape, and every real dimension in the catalog is imperial (`SAFETY_GAP_WIDTH_IN` 0.75in = 19.05mm, `cornerPanelWidthIn` 25.5in = 647.7mm — neither is a whole mm). Letting a display toggle change the fabricated grid would mean the same design cuts differently depending on which button was last pressed.

**Consequence, stated plainly: the sum invariant is exact in imperial and cannot be exact in metric at any readable precision.** 1/8in is 3.175mm exactly, so an eighth-multiple needs 3 decimal places to be exact in mm. `formatMetricMm` keeps rounding to the nearest mm (readable), and metric panel dimensions may therefore be off by up to 0.5mm each and fail to sum by a few mm across a wall. Any **fabrication** output rendered in metric carries a note that dimensions are converted from an imperial 1/8in grid and that the imperial value is authoritative. Whether fabrication sheets should simply be imperial-only is a Tommy question — Open Items.

### What must NOT become a fraction

Named explicitly so the display sweep doesn't over-reach. `toFixed(` appears **153 times across 12 files** and most of them are correct as-is:

- **Never fractions:** weights (lb/kg), prices ($ and $/mi), densities (lb/ft³, kg/m³), carbon (kg CO2e), areas (sqft), volumes (ft³, cu yd, bags), perm ratings, R/U values, percentages (moisture), roof pitch (x/12 and degrees), board feet, sheet/stick/panel/pier counts, opacity and scale factors, kN capacities.
- **Never touched at all — these are identity keys, not display:** `page.tsx` ~2624, ~2689 (`toFixed(6)` point keys), ~4227–4248, ~4330, ~4420–4421 (`toFixed(3)` fabrication-group keys). Changing their formatting silently re-groups fabrication sheets. Worth noting that once widths are eighth-exact these float keys become *stable*, which is a quiet side benefit — but they stay as they are.
- **Do become fractions:** panel/slot widths, wall lengths, panel and wall heights, thicknesses, header and rough-opening dimensions, sill widths and heights, jack-stud dimensions, beam heights and assembly heights, gable and column heights, box-beam deltas, truck interior dimensions, toe-up and foundation board dimensions, offsets and gaps, and the clamp messages at ~2270 and ~2511.
- **Long lengths — decided 2026-08-30:** everything currently shown in decimal feet (ridge run, seal length, wall-length totals, spans, and `formatTrailerLengthIn` at `page.tsx` ~362) uses the upgraded `formatFeetInches` (`38'-6⅛"`). Not decimal feet, not raw inches. Note the symmetry requirement: feet-inches is now both an output format **and** an input form the parser accepts, fraction slot included.

### Existing projects

Saved files carry unsnapped values (`PROJECT_FILE_VERSION` is currently v23, and `parseProjectFile` already accepts exactly one prior version and migrates forward). **v23→v24: a load-time quantization repair**, not a retile — a retile would discard every manual panel-mover adjustment in the file.

Per wall: round each slot width to eighths independently, then distribute the residual **`wallGeometryFor(...).lengthIn` − Σ(rounded)** one eighth at a time, **round-robin over the standard/braced slots only**, widest first, ties by lowest index. **Correction, 2026-09-06 — this spec was loose and the code is right.** An earlier draft named `wallFabricationLengthIn` as the repair target. `retile.ts` tiles against `wallFabricationLengthIn − insets + extras`, so a wall's slots sum to `wallGeometryFor(...).lengthIn`, not to `wallFabricationLengthIn` — repairing against the latter would ignore corner-ownership butt-joint insets and stretch every wall. Every inset is a `thicknessIn` from the catalog select (14 / 15.5 / 15.75, all whole eighths), so the target stays on the grid. The repair also carries a **guard**: if a wall's stored widths miss that target by more than one eighth *per slot*, they were never a tiling of that wall, so they are repaired against their own stored total rather than silently stretched. Measured on legacy octagons at 8/12/20/40ft across all eight walls, including the 8ft merged-corner case, the genuine residual is 0 or 1 eighth — a wide margin against that threshold. Fixed-width slots (safety-gap, corner, openings) are left at their own rounding — they are already eighth-exact in every file the app has ever written. Footprint corners are snapped by the same `quantizeFootprint` the geometry ops use. Bound on movement: each slot shifts by its own rounding (≤1/16in) plus at most `⌈|residual| / k⌉` eighths. Silent, no Review Log entry — this is a precision convention, not a building value, and nothing provisional changes.

The repair is written as a standalone `repairWallToEighths(slots, wallLengthIn)` and is what the invariant test exercises, so it is also available as a safety net if a future code path ever produces a non-grid width.

### The invariant needs a test, not a promise

A property-style test in `packages/geometry/src/tiling.test.ts`, over a swept product of inputs (not a handful of examples):

- `wallLengthIn` every 1/8in across a real range (say 96in–720in), `standardWidthIn ∈ {15.75, 39, 40, 48}`, `cornerWidthIn = 25.5`, `gapEnd ∈ {start, end}`, all four `hasCornerStart`/`hasCornerEnd` combinations.
- Assert, for `tileWall` and for `retileWithOpenings` with 0–3 eighth-multiple openings:
  1. every `slot.widthIn` satisfies `Math.abs(w * 8 - Math.round(w * 8)) < 1e-9`;
  2. `Σ Math.round(w * 8) === Math.round(wallLengthIn * 8)` — **integer equality, not `toBeCloseTo`**;
  3. no slot width is negative;
  4. no `standard` slot exceeds `standardWidthIn` (the existing "don't hand the shop an oversized panel" rule, which must survive this change).
- Same three assertions for `applyUniformPanelization`, `computeSillRunWidths`, and `computeGableTiledRow`.
- A named regression case for the exact defect: budget `47.125` (377 eighths) at `standardWidthIn = 40` must yield `23.625` + `23.5`, not `23.5625` twice.
- `units.test.ts` gains: `formatImperialFractionIn` never silently rounds a non-eighth (`15.7` no longer becomes `15¾"` — the existing tests at lines 28–30 encode the old contract and get rewritten), and a `formatFeetInches`/`parseLengthFt` round-trip at eighth precision.

### Staging

Deliberately staged, because the risk profile of each part is completely different.

0. **Fraction input (`canvasGeometry.ts` + the numeric fields).** The shared tokenizer, `parseLengthIn`/`parseLengthFt`, `formatFeetInches` gaining eighths, the inch-domain fields moving from `type="number"` to `type="text"` with parse-on-commit and visible parse failure, and the format/parse round-trip tests. Introduces the `roundToEighthIn` / `toEighths` / `isWholeEighthIn` primitives that Stage 1 then builds on, so it is enabling work rather than a detour.
   - **Goes first, ahead of the model work**, on three grounds: it is an *input* fix while the sweep is about output; it is independent of the tiling change; and it is the only part of this spec that is currently **losing user data** rather than just displaying it imprecisely. Highest value per line changed in the whole pass.
   - **What it deliberately does NOT do yet:** the exact-or-honest contract on `formatImperialFractionIn`. Until Stage 1 puts the model on the grid, the tiling engine still emits 1/16ths, so an honest formatter would spray long fractions across the whole app on day one. Through Stage 0, both formatters still round to the nearest eighth — which for `formatFeetInches` is already strictly better than today's nearest *inch*. The honesty upgrade lands with Stage 1, when the model can back it.

1. **The invariant (model only).** `roundToEighthIn` / `distributeEighths` / `quantizeFootprint` / `wallFabricationLengthIn` / `repairWallToEighths` in `packages/geometry`; applied in `tiling.ts`, `uniformPanelization.ts`, `gableTiledRow.ts` and the five footprint ops; the property test; the v23→v24 migration. No UI change. **This is the stage that makes the guarantee real** — everything after it is only trustworthy because of it.
   - **1b, a visible slice worth riding along:** the ~12 display sites where Tommy will actually notice (panel width labels in the Panelizer, the elevation's Overall Width, the footprint canvas wall labels, and the fabrication sheet dimensions), so the fractions show up immediately instead of after all three stages.
2. **The snapping layer (input).** Every gesture in the table above, semantic-snap-then-quantize. Cheap, but without it every drag walks values back off the grid and the Stage 1 repair ends up running constantly.
3. **The display sweep.** The remaining ~140 `toFixed` sites triaged per the exclusion list; the feet-inches convention applied to every long length; the metric fabrication note.

**Most of what Tommy actually asked for lands in Stage 0 + Stage 1 + 1b** — fraction entry that keeps what he typed, fractions on panels, and sums that hold. Stage 3 is the largest by line count and the most visible, but it is a sweep with no design risk left in it once Stages 0 and 1 have run.

**Flags check: clean, confirmed against the code rather than assumed.** No `CatalogValue`, `CatalogRange`, or `PanelStructuralStatus` is in scope. No fastener spacing, load, density, or cost figure moves. `SAFETY_GAP_WIDTH_IN` (0.75), `cornerPanelWidthIn` (25.5), `panelWidthInRange` (15.75–48), the 40in standard width, the 39in Square Bale width, and the 14/15.5/15.75 thickness options are all unchanged and were each independently checked to already be whole eighths. The only new constant is `1/8 inch`, which is a shop measurement convention, not a building-science value. Nothing new reaches the Review Log. The coder re-runs the 6-point check against the actual diff.

---

## Roles
Public/homeowner vs. Fabricator login — different disclaimer treatment. Square Bale mode: lighter reference/layout mode only, not the full calculation engine.

**This section describes the *viewer-role* axis only** (which disclaimer prints, what's shown). The separate *permission* axis — guest / member / company admin / platform admin — arrived with the backend design and is deliberately a different thing. See "Backend, Accounts & Project Sharing" below; the two must never be merged.

---

## Backend, Accounts & Project Sharing (2026-09-06) — decided, nothing built

Origin: Tommy's friend Fonz told him he needs a backend, specifically a MySQL relational database, to store projects for coworkers. Tommy's own goal, his words: *"organize projects in folders that are accessable over the cloud... you open the app as a regular user, and then have the option along the top bar to log into a Member or Admin,"* and *"I want to make any particular design savable, and reachable to another Member on any computer where they can log in."* Every decision below came from interviewing Tommy directly. **Nothing here is built.**

A published plan artifact exists for discussion with Fonz (`https://claude.ai/code/artifact/0ab3627b-fd52-4fb1-a58e-256b1c91297c`). **This spec is authoritative; that page is a snapshot.**

### Starting position — verified against the code, not assumed

- **There is no backend at all.** No route handlers anywhere under `apps/web/app`, no server code, no database, no auth dependency. `next.config.ts` sets only `reactStrictMode: false` — it is *not* a static export, so route handlers are available whenever they're wanted.
- **A project saves by downloading JSON and loads by uploading it.** `handleSaveProject` (`page.tsx:1377-1455`) builds a `Blob` and clicks an `<a download="building-integrity-project.json">`; `handleLoadFileSelected` reads a file the user picked. Both buttons live in `TopBar.tsx:119-126`.
- **`page.tsx` is `"use client"`** and the whole editor runs in the browser.
- **`viewerRole.ts` already anticipates this**, and says so: *"There's no real login yet — this is a local 'viewing as' toggle."*
- **The app is used directly at `home-builder-app-web.vercel.app`. The Vercel URL is the product.** Tommy, 2026-09-06: *"when i play on the app, it is through going to the vercel link... i originally embedded it into my website but i dont like using it when embedded because its not as full screen."* **Embedded use was tried and dropped, on ergonomics** — the editor wants the whole viewport. Recorded so nobody reintroduces an embed and is then surprised: **there is no iframe, so there is no cross-origin sign-in problem**, and an earlier revision's Stage 0 spike to prove sign-in inside an embed has been deleted rather than deferred. If embedding ever comes back, that whole question comes back with it.

### The framing: the design is a document, not a hundred rows

Fonz is right that this needs a database, and right about roughly what it stores. **The database stores the filing cabinet — companies, users, projects, folders, versions, permissions. Each saved plan is one JSON document inside it.**

A project already serializes to exactly one versioned document (`PROJECT_FILE_VERSION` is 23; `parseProjectFile` refuses unknown versions and accepts exactly one prior version, migrating it forward). Shredding that document into relational tables — a `walls` table, a `panel_slots` table, a `mid_wall_beams` table — would mean a schema migration every time a feature lands. This log's own history is the argument: seven schema versions in a few months, several of them real data reshapes (v18→v19's box-beam coverage, v21→v22's roofline rise). Those were single-file migrations. As relational schema they would each have been a database migration plus a backfill.

**Record this explicitly, because it is why the MySQL-vs-Postgres question turned out to be the small decision.** Once the design is a document, the database's job is small and stable, and the interesting question becomes which platform enforces the permission rules — not which one models a wall panel.

### Accounts

1. **Individual accounts belonging to a company** — not one shared company credential. Gives per-person attribution on saved versions, revocation of one person without rotating a shared password, and per-person levels.
   - **One login, several memberships — confirmed by Tommy 2026-09-06.** A person may belong to more than one company; he specifically has people spanning Building Integrity and The Seed Collaborative. `memberships` was already many-to-many; this makes it a real case rather than a latent one, and it adds an explicit **"acting as" company switcher**. See "The company switcher" below — it is not just a UI detail.
2. **Email + password, with reset.**
3. **Invite-only. Company admins invite; nobody self-registers.**
4. **"User" is not a signed-in state.** This revises Tommy's original three-level description ("regular user → Member → Admin"). The real ladder is **guest (not signed in) → member (has an account)**. Anyone can open the app, design a building, and download files. **Signing in is what grants cloud saving, the folder tree, collaboration, and the ability to act as the Seed Collaborative (and so to browse)** — it does not unlock the editor, which is already fully open.
5. **Guest work stays download-only, exactly as today.** No anonymous cloud storage, no "save and we'll email you a link."
6. **Leavers: access revoked, their work stays with the company, their name stays on versions they saved.** Attribution is history, not access.
7. **Two-factor: optional for everyone, encouraged — including platform admin. Twice-confirmed, not an oversight.** **Accepted risk, recorded rather than buried: the platform admin account can read every company, and under this decision it is one password away from everything.** Tommy was asked directly on 2026-09-06 whether his own account should be the one mandatory exception, with that exact reasoning put to him, and chose to leave it as decided. **This is a considered decision.** The accepted-risk note stays on the record not because the decision is unsettled but because it is worth revisiting at twenty companies rather than four — the exposure scales with how many companies the one account can read, and the right moment to reopen it is when that number grows, not now.

### The company switcher — "acting as" — is also the Seed Collaborator toggle

**Revised 2026-09-06 (second pass). These were two controls in the first draft and are now one.** Tommy: *"default seed flag status is off unless your default company is the seed collaborative... if i was in the position to design a house for the seed collaborative folder, i could do so when i toggle the flag."* Read alongside 17 (the Seed Collaborative is both a company and the consortium), his four answers collapse into a single mechanism, and it is a better model than the two-control version it replaces: **there is no separate "View as Seed Collaborator" control. Consortium browsing is what acting as the Seed Collaborative *means*.**

- **The switcher selects which company you are currently acting as.** Off = your own company (say, Building Integrity). On = acting as The Seed Collaborative.
- **Default is off, unless the Seed Collaborative is your default company** — in which case acting as Seed is simply your normal state, not a toggle you flipped. Requires a **default company per user** (a `memberships.is_default` flag or `users.default_company_id`), which multi-company membership needed anyway to decide what you are acting as at sign-in.
- **Acting as the Seed Collaborative is what grants consortium browsing.** A person acting as Building Integrity sees Building Integrity and nothing else. The shared read layer is not a permanent ambient state; it is the view you get while acting as the company that *is* the consortium.
- **Membership in any member company entitles you to act as the Seed Collaborative.** Being at Building Integrity is what puts the toggle in front of you. You do not need a separate Seed membership row.
- **Acting as Seed, you may create new projects in Seed's folders freely.** This is the "design a house for the Seed Collaborative folder" case in Tommy's own words.
- **Editing an *existing* Seed project requires an invitation on that project**, exactly like every other cross-company case (24-26). Deliberately consistent with the rest of the model rather than a special case for the consortium.
  - **ANSWERED by Tommy 2026-09-14: yes — creating a project in another company's tree gives the creator a standing collaborator grant; ownership stays with that tree's company.** See "Stage 3 plan — Collaboration", answer 1, and its creator-grant trigger. The original inference is kept below for the record.
  - **~~⚠ Inference, flagged as such and needing Tommy's yes~~: the creator of a Seed-tree project must keep access to it.** Taken literally, "create freely" plus "editing an existing Seed project needs an invitation" means you lose your own work the instant you save it, which cannot be what he means. **The coherent reading: creating a project in another company's tree grants the creator a standing collaborator grant on that project.** Ownership still lands with the Seed Collaborative (`projects.company_id`), so it is Seed's project in Seed's tree — the creator simply holds a grant on it, using machinery that already exists for 24-26. Confirm before building; do not silently pick the other reading.
- **The switcher is visible at all times, not buried in a menu.** The failure mode it exists to prevent is saving a project into the wrong company's folder tree, which is silent, plausible, and only noticed later by someone else. It belongs in the top bar next to the sign-in state, showing the acting-as company by name at all times — not only while being changed. **This matters more now than it did as a plain switcher**, because the control also changes whether you are looking at one company or at all of them.
  - **Stage 1 shipped this control but the top bar broke the guarantee, 2026-09-13.** The bar is one `nowrap` row needing 1407px with the account control last in it, so in Tommy's own 710px viewport it sat 677px off-screen — present in the DOM, unreachable in practice. **"Visible at all times" is a layout requirement, not just a component requirement**, and it is now the reason the top bar is being restructured rather than restyled. See "Top Bar & App Chrome — the Stitch reorganisation."
- **What "acting as" governs:** which company a **new project is created under** (the one that actually loses work if it is wrong); which **folder tree** is shown; whether the **shared read layer** is visible at all; which company's **admin powers** apply, if you are an admin of one company and a plain member of another; which company a **backup** covers (29).
- **Saving into an existing project is still governed by that project's own ownership and grants, not by the switcher.** If you hold access to a project, you can save to it; flipping the switcher does not revoke access to a project you already hold, and does not grant access to one you do not.

**Correction to this spec's own earlier wording, made explicit rather than quietly edited.** The first draft said *"if an implementation ever needs to consult the switcher to answer 'may this person do X,' that is the bug."* **That is now false** — under this model the acting-as company genuinely does determine whether the shared read layer is visible. The rule it is replaced by:

> **The switcher selects among entitlements you already hold; it never creates one.** A person with no path to the Seed Collaborative has no toggle to flip and cannot reach the browse set by any client-side means. **The server verifies the acting-as company against the user's own memberships and entitlements on every request** and re-derives permissions from the verified `(user, acting-as company)` pair. A client-supplied "I am acting as X" is an input to be checked, never a fact to be trusted.

**Session memberships are filtered to the signed-in user (fixed 2026-09-14).** `memberships_select` also shows a company admin their company's rows and a platform admin every row, so `loadSession` (`serverSession.ts`) reads `.eq('user_id', <auth user>)` rather than trusting RLS to return only "mine". Before the fix, entitlements were built from other people's rows: a company admin saw their company once per member, and the first row picked supplied `level` and `is_default`. Found from Tommy's "Building Integrity appears twice", reproduced on local PostgreSQL 17.4. If a company is ever listed more than once, every entry is labelled by source and level ("(company admin)", "(member)", "(platform admin)").
- **Reviewed consequence while live (Stage 1 → 2026-09-14): no security impact.** Ordinary members were never affected (RLS returns them only their own rows). For company and platform admins the effects were duplicate or mislabelled switcher entries, a possibly wrong default company at sign-in, and a company admin possibly shown as "member" (people list / backup entry hidden — a lockout, never a false "admin"). **One app-side rule was bypassable, by platform admins only:** if any Seed Collaborative membership row existed, a platform admin acting as Seed got a membership entitlement instead of consortium, which offered Save-as-new and a Seed folder listing that Open Item 2 defers to Stage 3. `projects_insert` permits platform admins there anyway, so nothing exceeded database permissions. Nothing sent to the browser beyond company id, name, level and default flag.
- **Can wait:** make `computeEntitlements` itself skip already-listed companies (defence in depth against a future unfiltered read), and replace the source-regex test pinning the filter with a behavioural one.

### The two failure modes this control has to avoid

Worth naming because they pull in opposite directions and one control now has to serve both:

1. **Saving into the wrong company's folder** — the reason it must be visible at all times.
2. **Not realising you are browsing rather than working** — new with this merge. Acting as Seed shows you other companies' projects read-only with costs stripped, which can look like your own tree at a glance. The acting-as state should be legible from the project view itself, not only from the top bar.

### Roles — two axes that must never be merged

This is the single most important structural decision in the section, because merging them is the obvious-looking mistake.

| | **Permission** | **Viewer role** |
|---|---|---|
| Values | guest / member / company admin / platform admin, plus two cross-cutting states (invited collaborator, seed-collaborator browsing) | the existing `ViewerRole`: public / fabricator / engineer / admin |
| What it controls | what data the server will send you, and what you may write | which disclaimer prints and what the document shows |
| Enforced | **server-side** | client-side presentation only |
| Who can change it | company admin / platform admin, via invites and grants | **anyone, freely, including guests** |

8. **Permission is server-enforced** and is the real security boundary.
9. **Viewer role stays a free presentation toggle available to anyone.** Tommy: *"the architect, fabricator, engineer, ect is all available to see through the Role Selector button."* **It is not a security level and must never be used as one.** The one place today's code leans on it for anything money-shaped — `effectivePriceModifier = role === "public" ? 1 : priceModifier` (`page.tsx:4814`) — is a *display* convention on your own project, and is not, and must not become, the mechanism behind the cost redaction in the consortium rules below.
   - **Consequence to implement, not to infer:** `role` is stored inside the project document (`ProjectState.role`, and it is in `REQUIRED_STATE_KEYS`, so it cannot simply be dropped without a version bump). When a project is opened **from the cloud**, the viewer's own current toggle wins; the document's stored `role` is ignored on load rather than applied. Otherwise opening a colleague's project silently re-skins your whole session.

### Storage

10. **Every save creates a new version. Nothing is overwritten. Append-only.**
11. **Two people saving the same project both get their save kept, as separate versions. No locking, no merge.** The version list *is* the reconciliation UI.
    - **The divergence notice — approved by Tommy 2026-09-06.** Each version records its `parent_version_id`: which version the person had open when they started. When someone saves and the project's head has moved on since they opened it, **the app tells them.** It does **not** block, lock, or merge, and both versions are kept, exactly as 11 decides. The notice only stops the second person's work from disappearing quietly into a list.
    - **Provenance, stated because it matters for who owns the idea:** this was proposed during spec'ing rather than instructed by Tommy. He has now explicitly approved it. If it ever proves annoying in practice, dropping the *notice* is a UI change; dropping the *column* is not, because it is also the record of what each version was based on.
12. **Fixed folders per company: Current Projects / Past Projects / Proposals.** No nesting, no custom folders. **Purely organisational — the folder is a status label, not a permission boundary.** All three are browsable under the consortium rule.
    - **Folder-level privacy was proposed, fully specified, and then deliberately rejected — recorded so it is not re-litigated as an oversight.** The spec'ing pass flagged that Proposals is the folder most likely to hold a live bid, and a first revision made Proposals private to the owning company. Tommy reversed it on 2026-09-06: *"lets keep proposals simple then, no permission boundary."*
    - **The exposure that choice accepts, stated plainly because he was shown it and chose anyway: a live bid — and who it is for — is visible to every member company.** Cost redaction (21) removes the margin; it does not remove the fact that a named company is bidding a house for a named client in a named place.
    - **The simplicity bought is real, not cosmetic.** With folder privacy, `projects.folder` becomes an access-control field: every list, filter, sort and badge touching it becomes security-relevant, moving a project between folders becomes a publish/retract action, and publishing exposes back versions written while the project was private. All of that disappears with the reversal.
13. **Archive, never delete.** Members move projects between the three folders. **Only platform admin can permanently delete anything**, including company folders. Moving between folders is filing and changes nothing about who can see a project.
14. **Local file save/load stays permanently, alongside cloud saving.** It is the escape hatch, and it is how guests work. The existing Save/Load buttons do not go away or become sign-in-gated.

### The consortium — the unusual part

15. **This is not standard multi-tenancy.** Companies own their own trees, but there is a **shared read layer** across all of them. **Membership in the app is the trust boundary.** Tommy: *"if you're logging into this app - you are in the club and welcome here is what everyone is doing."*
16. **Companies today:** Building Integrity, Rare Forms, New Frameworks, The Seed Collaborative. More expected.
17. **The Seed Collaborative is both a company and the consortium.** It has its own folder tree like anyone else, and other companies carry a membership flag pointing at it. **As of the 2026-09-06 revision this is load-bearing rather than a curiosity** — it is the reason browsing and the company switcher turn out to be one mechanism (see "The company switcher" above).
18. **Seed Collaborative projects follow exactly the same rules as any company's.** Its members will design projects and hand them off to other companies; nothing about its own tree is special-cased. **This is also why editing an existing Seed project needs an invitation** like any other cross-company edit, even though creating a new one in its tree is free.
19. **Consortium browsing is granted by acting as the Seed Collaborative** — the toggle described above, available to any member of a member company. No per-company opt-in, and no per-company opt-out. **State this plainly to every new company before they join: a company cannot join without its projects — all three folders, Proposals included — becoming browsable by every other member company. There is no join-but-stay-private state.**
20. **Browsing another company: design yes, money no.** Panels, quantities, drawings, details, assemblies — but not their price modifier or margin. Applies to every project of every member company, in all three folders (12).
    - **"Another company" means the company you are acting as is not the owner.** A Seed Collaborative member acting as Seed sees Seed's own projects as their own — costs included. Someone from Building Integrity acting as Seed does not. This falls out of the ownership rule and should not be special-cased.
21. **The cost hiding must be real, not cosmetic — the server strips cost fields before sending.** This is the one place server-side logic is genuinely required, and the reason is specific: a price modifier is **another company's commercial information**, not the app's own arithmetic. Contrast deliberately with 22 below.
22. **Formulas are not secret. No server-side calculation engine.** The editor stays entirely client-side and exactly as fast as it is now. **This is the single biggest scope reduction in the whole design** — the alternative (a server that recomputes takeoffs so the client never sees the inputs) would have meant porting `packages/calc-engine` to run in two places and keeping them in sync forever.

#### What "strip cost fields" actually means — the bounded exception to 22

21 and 22 pull against each other, and the seam has to be written down or it will be implemented as a client-side `if`.

- **The server has to understand exactly one thing about the document: which of its fields are money.** Everything else stays opaque. This is a small, explicit **redaction list keyed to `PROJECT_FILE_VERSION`**, not a server that parses the design.
- **Today that list is one field: `priceModifier`.** Verified: it is the only money-shaped key in `ProjectState`. The seven Plaster Master / shipping price fields (`shippingRatePerMile`, the four `plaster*Price*`, `steelMeshPricePerSqFt`, `plasterLaborRatePerHour` — `page.tsx:539, 562-567`) are `useState` only and **do not round-trip through save/load at all today.** That is a separate latent bug (edit a plaster price, save, reload, your edit is gone), and it matters here because **the day they are added to `ProjectState` they become redaction targets.**
- **Therefore the redactor is tested against `ProjectState`'s own key list**, and fails when a key exists that the redactor has not classified as money-or-not. A silently unclassified new field is exactly how the first leak happens.
- **The redactor fails closed on an unknown schema version.** A document whose `schemaVersion` the redaction list doesn't cover is **not served cross-company at all**, rather than served on the hope that nothing money-shaped was added.
- **A redacted document carries an explicit marker, not a plausible substitute.** Do **not** let the client fall back to the 1.3 default or to `1` — that shows a browsing company a confident, wrong number. The redacted document says so, and the UI shows "—" with a note that cost is not shown for another company's project. This is the same rule this log already applies to silent rounding and to `confirmed` flags on researched values: **a silent substitution is worse than a visible gap.**
- **What is not hidden, and cannot be:** the catalog's own list rates ($28/$36/$42 per sqft) live in the app's code and are visible to everyone by design. A browser can therefore compute an unmodified price. That is the app's arithmetic, not the other company's margin, and 20 asks for the modifier to be hidden — which this does exactly.

#### Export rules, and an honest limit

23. **View-only browsers can export drawings and PDFs, but not the project file or the OBJ.** The intent is that view-only cannot become "take a copy and continue it as mine."
    - **⚠ This one cannot be made technically real, and the spec says so rather than implying otherwise. Confirmed and communicated to Tommy 2026-09-06.**
    - **Why.** The PDF path *is* the browser's own Print/Save-as-PDF of a client-rendered DOM, and the 3D view renders from the same in-memory state, so **the document must reach the browser in order to draw the drawings at all.** Once it is there, anyone with the developer console can lift the JSON out of client state. Hiding the Save-Project and Export-OBJ buttons removes the easy path, not the possible one.
    - **What it therefore is, stated exactly: deliberate friction plus a terms-of-use line. It is not an access control.** Redaction (21) is a guarantee — the field never leaves the server. Export blocking is a speed bump. **These two rules look similar in the UI and are completely different in strength, and the difference must survive into whatever a joining company is told.**
    - **Do not describe this to a joining company as a guarantee, and do not let a summary, a marketing page, or an onboarding email say "other companies cannot take your files."** The honest sentence is closer to: *your design is visible to other member companies, who can print it but are not given a copy to edit; the app does not hand them one, and taking one anyway is a breach of the terms rather than something the software prevents.* Overstating this once is worse than never claiming it, because it is the kind of promise a company joins on.
    - The only design that would make it real is server-side rendering of the drawings, which contradicts 22 and costs far more than it buys. Not recommended; recorded so nobody re-derives the option from scratch.
24. **A deliberate handoff is different from passive browsing: an invited collaborator sees everything, costs included** — no redaction, full export.
25. **Handoff means shared access to the same project, not a fork.** One project, one version history, both companies. **This is why ownership must be modelled separately from access** — `projects.company_id` (who owns it, whose folder tree it appears in, whose backup includes it) is a different fact from a row in `collaborators`.
26. **Collaboration invitations work both directions:** a project can invite a member in, and a browser can request to be let in (`collab_requests`).
27. **Creating a new company: company admins at any member company, plus platform admin.** The creator names the company and invites its first admin by email; **the creator gets no standing access to the company they created** — creating is not joining.
28. **When a company leaves, their designs stay visible.** Only platform admin can delete company folders.
    - **Whether their people keep read access to the co-operative is decided by platform admin, case by case — and that is a deliberate judgement call, not a rule.** Decided 2026-09-06. There is no automatic consequence of a company leaving beyond its designs remaining; whether a departing company's members keep the ability to act as the Seed Collaborative and browse is a decision Tommy makes about that particular departure.
    - **The cost, recorded honestly rather than glossed: this is undocumented and inconsistent by construction.** Two companies leaving under similar circumstances can be treated differently, and nobody outside the decision can predict or audit the outcome. **That is defensible at four companies who know each other personally** — a judgement call between people with a relationship is often better than a rule — **and it is exactly the kind of thing that stops scaling quietly.** Worth revisiting as the co-operative grows; the trigger is roughly when Tommy no longer personally knows the people at every member company.
    - **Practical consequence for `is_seed_member`:** a departing company's flag state is part of that same judgement call rather than something the system flips automatically. See the data model note.

### Backups

29. **Each company admin can download a complete backup of their own company's projects and versions** — Tommy's stated use case is a USB stick. Platform admin can back up everything.
    - **Record the reasoning, because this reverses Tommy's first answer and the reversal will otherwise be re-broken later.** He originally said every company admin could back up *all* companies. That was withdrawn once it was pointed out that it hands every admin a complete, editable, cost-bearing copy of designs that rule 23 specifically prevents them from exporting one at a time — a backup button that quietly outranks the export rule. **A backup may never contain more than its owner could already export by hand.**
    - **The rule that makes that generalize:** a company backup contains projects the company **owns** (28) plus projects it has been **granted collaborator access to** (24, where full export is already allowed), and **excludes everything visible only through consortium browsing** (20/23).

### Platform

30. **Supabase (Postgres + auth + row-level security).** Chosen because the permission rules here are intricate *and* cross company boundaries, so writing them once in the database beats re-deriving them in every route that touches a project. MySQL has no row-level security and weaker JSON handling; both matter for this shape of problem.
    - **Honest caveat, recorded because it is easy to over-trust RLS: row-level security governs whether you can see a *project*, not whether you can see a *field inside it*.** The cost redaction in 21 is application logic on any platform. RLS decides *whether* the row is served; the redactor decides *what the served document contains*. Two different mechanisms, both required.
    - This does not change the deployment story: Vercel keeps serving the app, and Supabase is called from it.

### Data model

Validated against the real `ProjectState` and `DocumentMetaContext` rather than transcribed.

| Table | Holds | Notes |
|---|---|---|
| `companies` | name, seed-member flag, `created_by` | see the flag caveat below |
| `users` | email, password hash, name | Supabase Auth owns the credential; the profile row carries the display name that appears on versions |
| `memberships` | user ↔ company, level `member \| admin`, **`is_default`** | many-to-many, and **a real case, not a latent one** — confirmed 2026-09-06. One person, several rows, an "acting as" switcher. Level is per-membership: admin at one company and plain member at another is normal. `is_default` decides what you are acting as at sign-in, and therefore whether the Seed toggle starts on |
| `projects` | owning company, folder (`current \| past \| proposals`), name | the **listing** record; mutable. **`folder` is purely organisational** (12) — a status label, not an access-control field |
| `project_versions` | project, author, timestamp, optional label, **the JSON document**, `parent_version_id` | **append-only, never updated, never deleted except by platform admin.** `parent_version_id` = the version the author had open when they started (11) |
| `collaborators` | per-project grant to a user or a company | full access incl. costs (24); a *grant*, distinct from ownership (25) |
| `collab_requests` | a browser asking to be let into a project | the other direction of 26 |
| `invites` | email, company, level, token, expiry | invite-only (3); also the path a new company's first admin arrives by (27) |

**`companies.is_seed_member` now has a real job — third and final assessment, reversing the two before it.** This column was rejected twice as always-true and gating nothing. Under the merged switcher model (2026-09-06, second pass) that is no longer true: **the flag defines the consortium's membership set, and the consortium is now something you act as rather than an ambient state.** Concretely it decides two things:

1. **Whose trees appear when acting as the Seed Collaborative** — the browse set is the union of the trees of companies whose flag is true.
2. **Who gets the toggle at all** — a person whose companies are all non-members has no path to act as Seed, and therefore no browsing.

**The false branch is now defined, and it is coherent because it is symmetric: a non-member company neither sees nor is seen.** That is a genuinely different thing from what decision 19 rejects, which is a company that browses everyone else while hiding its own work. Symmetric non-membership is a defensible state; asymmetric is not.

- **Still true for all four companies today**, so the false branch remains untested in practice. Onboarding a non-member company is a real decision for Tommy, not a flag flip someone makes quietly.
- **Set the Seed Collaborative's own flag to true.** It is the consortium, so "is it a member of itself" reads as a philosophical question and is not one: if its flag is false its own tree drops out of the browse set, which is plainly wrong. Stated because leaving it false is the natural mistake.
- **A departing company's flag is a platform-admin judgement call, not automatic** (28). Their designs stay visible regardless, so the flag and "are these projects still browsable" are not the same question, and the honest answer is that the departure case is handled by a person rather than by a rule. Recorded as a known soft edge, consistent with 28's own framing.

#### Project name / site / date — where they live when the row and the document disagree

The prompt asked this specifically. Verified in the code:

- **`projectName` lives inside the document** (`ProjectState.projectName`, in `REQUIRED_STATE_KEYS`).
- **`siteLabel` is derived at render** from `zipCode`: `documentSiteLabel = zipCode.trim() ? \`Zip ${zipCode.trim()}\` : "Site not set"` (`page.tsx`, beside `documentDate`).
- **`date` is resolved by `resolveTitleBlockDate` (`titleBlockDate.ts`)** from the last loaded or saved file's `ProjectFile.savedAt`, falling back to today only for a never-saved design. *(Stage 0, shipped 2026-09-13; previously `new Date()` at render, always today.)*

Decisions:

- **Name: `projects.name` is authoritative for the folder tree; the document is authoritative for the printed sheet.** The row is set from the document's `projectName` on first save and updated on every subsequent save. Renaming in the tree writes back into the *next* version's document rather than mutating past versions. When an old version's document and the row disagree, that is correct and not a bug: **the tree shows what the project is called now, a printed sheet shows what it was called when that version was saved.** Rows are mutable; versions are not.
- **Site: stays in the document only.** No `site` column. `zipCode` is a design input (it drives seismic zone and shipping distance), not filing-cabinet metadata, and duplicating it onto the row creates a second source of truth for something that already has one.
- **Date: a printed sheet shows the date the design was saved, not the date it was printed. Decided by Tommy 2026-09-06 — this is now a decision, no longer a flagged defect.**
  - **The bug it fixes:** `documentDate` **was** `new Date()` at render, so **every printed sheet claimed today** (fixed in Stage 0). Reopen a project a year later and the title block dates it a year late. A printed set is a snapshot of a design at a moment; dating it "whenever you happened to hit print" makes the date worse than useless, because it looks authoritative.
  - **Resolution order for the title-block date:**

| Case | Date shown | Source |
|---|---|---|
| Cloud version opened | that version's save time | `project_versions.created_at` — authoritative for cloud projects |
| Local file loaded (**including every guest**) | that file's save time | **`ProjectFile.savedAt`, which is already written on every save and has never once been read** — this decision is what finally reads it |
| Never saved (fresh design in the editor) | today | genuinely is today's work; nothing to be wrong about |

  - **Saving locally counts as a save:** Save Project sets the title-block date to the downloaded file's own `savedAt` (one timestamp, not two). The browser does not report a cancelled download, so a cancelled Save still moves the date. *Accepted by Tommy 2026-09-13.*
  - **A loaded file with no usable `savedAt` prints "Date not recorded"**, never today. Today is reserved for a design that was never saved or loaded. *Decided by Tommy 2026-09-13.*
  - **What counts as usable:** a full ISO date-time with `Z` or `±HH:MM` (used as-is), or `YYYY-MM-DD` (read as that local calendar day). Anything else is not recorded, including a bare year, numbers, a date-time with no zone, and impossible dates. Every file the app writes is in the first form. The Stage 2 cloud `created_at` goes through the same rule.
  - **No autosave or New Project path exists today.** Load is the only action that replaces the whole project. Drawing a new footprint over a loaded file keeps that file's date.

  - **A guest has no version row, so `savedAt` is the whole answer for them** — and since guests are download-only (5), the local-file row is the *normal* path for a large share of printed output, not an edge case.
  - **Buildable now, with no backend at all.** The local-file and never-saved rows need only `ProjectFile.savedAt` and `page.tsx`; the cloud row needs Stage 2. **Ship the first two immediately** — that alone fixes the defect for every user the app has today, since today every user is on the local path.
  - **Edited-since-load reads as "as of last save," which is the correct meaning** and deliberately not smoothed over: load a file, edit for an hour without saving, and the sheet still shows the old save date while the drawing has moved on. That is what a snapshot date means. Whether to additionally mark the sheet as having unsaved changes is a nicety, not part of this decision.

### Permission matrix

Rows are permission states (never viewer roles). **"Own" = a project owned by any company you hold a membership in** — with several memberships (decision 1) that is several companies, and the switcher decides which tree you are *looking at*, not which ones you have rights in.

**Rows are `(person, acting-as company)` pairs, not people.** That is the change the merged switcher forces: the same person has different rows depending on what they are acting as, and the server decides which row applies from the acting-as company it has *verified*, never from what the client claims. Rows are still never viewer roles.

| | Use editor | Download local file | See acting-as tree | Create project there | Edit existing project there | Browse other member trees | See their costs | Export their file / OBJ | Move between folders | Invite users | Create company | Grant collaborators | Permanent delete | Backup |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Guest** | yes | yes | — | no | no | no | — | — | no | no | no | no | no | no |
| **Member, acting as own company** | yes | yes | yes | yes | yes | **no** | — | — | yes | no | no | own projects | no | no |
| **Company admin, acting as own company** | yes | yes | yes | yes | yes | **no** | — | — | yes | own company | yes (27) | own projects | no | **own company only (29)** |
| **Acting as the Seed Collaborative** (any member of a member company) | yes | yes | yes, read-only | **yes** | **only with a grant** | **yes** | **no** | **no** | no | no | no | no | no | no |
| **A Seed Collaborative member, acting as Seed** | yes | yes | yes | yes | yes | **yes** | **no** (other companies') | **no** (other companies') | yes | per their level | per their level | own projects | no | per their level |
| **Invited collaborator** (cross-cutting, per project) | yes | yes | — | — | **yes, that project** | — | **yes, that project** | **yes, that project** | **yes, that project** (Stage 3 answer 11: refiles it in the owner's folders) | no | no | **yes, that project** (Stage 3 answer 10: shares onward) | no | a company grant: in that company's backup (29); a personal grant: in no company's backup (Stage 3 Open Item 2) |
| **Platform admin** | yes | yes | all | yes | yes | yes | yes | yes | yes | yes | yes | yes | **yes** | everything |

Readings that must survive implementation:

- **Browsing is a row of this table now, not a mode layered over one.** "Acting as the Seed Collaborative" is where consortium read lives; there is no separate browse permission to grant.
- **The two Seed rows are different and both are real.** Someone from Building Integrity acting as Seed gets Seed's tree read-only plus create rights. Someone whose *own* company is the Seed Collaborative gets their own company's tree, with costs, plus browsing. **Do not collapse them** — the difference is ownership, and it falls out of the ownership rule rather than needing a special case.
- **"Create yes, edit only with a grant" is the one asymmetric cell**, and it is deliberate (18): creating in the consortium's tree is free, editing someone's existing work is not. **It depends on the creator keeping a grant on what they created** — confirmed by Tommy 2026-09-14 (Stage 3 plan, answer 1) — otherwise this row means you cannot edit your own new project after saving it once.
- **An invited collaborator's access is scoped to the one project**, not to the inviting company, and it is the mechanism behind the "only with a grant" cell.
- **Resolved 2026-09-14 (Stage 3 Open Item 6, default accepted by Tommy):** the "Invited collaborator" row says **yes, that project** for Move between folders (answer 11) and Grant collaborators (answer 10), and its Backup cell follows Open Item 2. The answers won because they are newer and were chosen explicitly over the alternatives.
- **The switcher does appear in this table now, and that is the correction.** An earlier draft said consulting the switcher in a permission check was always a bug. Under the merged model the acting-as company is a legitimate input. The surviving rule: **the switcher selects among entitlements you hold and never creates one**, and the acting-as claim is verified server-side on every request.

### Build order

Tommy has seen and agreed this. **Each stage is usable alone**, which is the point — none of them is a foundation-only stage that ships nothing.

**There is no Stage 0 any more.** The iframe sign-in spike — previously a go/no-go gate and named here as the biggest technical unknown in the plan — is deleted, because the iframe itself is gone (see "Starting position" above). **The largest single risk in this design is gone, and it was retired by a product fact rather than by engineering.**

0. **Title-block save date (no backend required).** The local-file and never-saved rows of the date table above: read `ProjectFile.savedAt`, stop calling `new Date()` at render. **Numbered zero because it needs nothing from any other stage and fixes the defect for every user the app currently has.** The cloud row follows in Stage 2. **Shipped 2026-09-13** (`titleBlockDate.ts`). Its fixed cloud-then-local precedence is replaced by the last-save-wins rule in Stage 2B (see the Stage 2 plan).
1. **Accounts and companies.** Sign in/out, invites, memberships, default company, company admin, **and the always-visible acting-as switcher including the Seed toggle**. The app gains a real identity and nothing else changes. *(Usable alone: nothing to save yet, but the top-bar sign-in Tommy described exists and works.)*
2. **Cloud projects and versions.** The three folders, save-as-new-version, the version list, open-from-cloud, the divergence notice (11), and the cloud row of the date table. Local save/load untouched alongside it. *(This is the stage that delivers Tommy's actual sentence — "reachable to another Member on any computer where they can log in.")* **Planned 2026-09-13. 2A BUILT and applied to live 2026-09-14; 2B BUILT, DEPLOYED and hand-tested live 2026-09-14 (as an ordinary member M and a Rare Forms member R: save and open across windows, company isolation, the divergence notice, the two-tab refusal); 2C BUILT, DEPLOYED and hand-tested live 2026-09-14 (steps 8a–8e matched; 8f had no out-of-window version to test, 8g skipped as already covered by the 2B cross-company check); 2D BUILT, DEPLOYED and hand-tested live 2026-09-14 (a Building Integrity backup extracted in Explorer and a file from it reopened with Load Project; the ordinary Building Integrity member and the Rare Forms member see no backup section). **Stage 2 is complete.** See "Stage 2 plan — Cloud projects and versions" below, sub-stages 2A–2D, and its Open Items.**
3. **Collaboration.** `collaborators`, invitations, shared access to one project (24-26). **Planned 2026-09-14 from Tommy's interview. 3A BUILT and reviewed (ship), migration 0008 merged; APPLIED TO LIVE 2026-09-15 (pre-flight 4 companies / 3 memberships / 3 projects / 12 versions; every post-flight check matched; counts unchanged, 0 grants; an ordinary member saved and loaded a cloud project afterwards). 3B BUILT, DEPLOYED and hand-tested live 2026-09-15 (steps 1–10 all matched, run as M, R, R2, N and T in separate browsers). 3C BUILT, reviewed (ship) and DEPLOYED 2026-09-20; **its hand test (step 11) is deferred to the next testing batch** at Tommy's request — he was away from his desktop and chose to push and move on. 3D BUILT, reviewed (ship) and DEPLOYED 2026-09-20 (this closes Stage 2 Open Item 2); **its hand test (steps 12–14) joins the same deferred batch**. 3E BUILT, reviewed (ship) and DEPLOYED 2026-09-20; **its hand test (steps 15–16) joins the same deferred batch. STAGE 3 IS COMPLETE** — every sub-stage is live. **Hand test 2026-09-24: SPOT-CHECKED, NOT COMPLETED** — 11a–11d driven in full and passed; 11e–11h, 12–16 and 26–35 judged by using the app rather than step by step, at Tommy's choice ("I think everything works… sharing and viewing and stuff looks good"). Recorded as it happened rather than as a pass; the Stage 3 plan heading lists the three checks that remain unproven live. See "Stage 3 plan — Collaboration", sub-stages 3A–3E, and its Open Items. **Access requests (26's other direction, `collab_requests`) moved to Stage 4** by Tommy's answer 6. Supersedes the older "in-app inbox" line in the Handoff section above — this *is* the handoff mechanism. **It is also what makes the "edit an existing Seed project" case work**, so it is a prerequisite for Stage 4 being coherent rather than an independent feature.
4. **Consortium browsing.** Acting as the Seed Collaborative, the cross-company read layer, the cost redactor, the export restrictions (19-23). **The redactor is the highest-risk single piece of the whole design** and deliberately does not ship before there is anything to browse. **Planned 2026-09-20. 4A BUILT 2026-09-21 (schema, redactor and tests), REVIEWED and NARROWED 2026-09-23, and **APPLIED TO LIVE 2026-09-24 — the redactor run over Tommy's 19 real saved versions returned 0 still carrying a price and 19 marked**. 4B BUILT 2026-09-24 (the fifth tab, the redacted read, the price gap and the export restrictions — app code only, on branch `stage4b-browsing-ui`) and **REVIEWED 2026-09-24, verdict ship**; not merged or deployed. **4C BUILT 2026-09-24** (access requests end to end — asking while browsing, the owner company's Grant and Decline in the existing Access… note, and the requester's own list — app code only, on branch `stage4c-access-requests`) and **REVIEWED 2026-09-24, verdict ship with one small fix, applied**; not merged, not deployed. **STAGE 4 IS BUILT; NONE OF 4B OR 4C IS LIVE YET.** Access requests (`collab_requests`) arrive here by Stage 3's answer 6. See "Stage 4 plan — Consortium browsing", sub-stages 4A–4C, its Tests and hand-test steps 17–25 and 36–45, and its **Open Items, which Tommy decides before any code is written**. Two sequencing facts live there and are repeated because they bite: Stage 3's hand-test steps 11–16 are still outstanding and **must run before 4B**, which replaces a string step 13 reads word for word; and the export restrictions ship **with** browsing in 4B, never after it.
5. **Platform admin.** Cross-company visibility, permanent delete, full backup, and the case-by-case departing-company judgement (28).

Backups (29) ride with the stage that makes them meaningful: company backup with stage 2, platform backup with stage 5.

**Flags check: clean, and confirmed rather than assumed.** This section introduces **no real-world building values at all** — no fastener spacing, no load, no density, no dimension, no cost figure. No `CatalogValue`, `CatalogRange`, or `PanelStructuralStatus` is in scope, and `data.ts` is not touched. Nothing new reaches the Review Log. **It does touch the `pending-BI-confirmation` convention in exactly one indirect way, and only in the direction of strengthening it:** the redaction rule adopts the same principle the flag convention exists for — a plausible substituted number (a defaulted price modifier shown to a browsing company) is worse than a visible gap, for the same reason a researched value marked `confirmed` is worse than one marked pending. Any dollar figure this work causes to be *displayed* is an existing catalog value, still carrying whatever status it already has. The coder re-runs the 6-point check against the actual diff.

### Stage 2 plan — Cloud projects and versions (2026-09-13) — APPROVED BY TOMMY 2026-09-13 (all Open Item defaults accepted) — **2A BUILT and applied to live 2026-09-14** (0006 + 0007, every post-flight check matched); **2B BUILT, DEPLOYED and hand-tested live 2026-09-14 (as an ordinary member M and a Rare Forms member R: save and open across windows, company isolation, the divergence notice, the two-tab refusal)**; **2C BUILT, DEPLOYED and hand-tested live 2026-09-14 (steps 8a–8e matched)**; **2D BUILT, DEPLOYED and hand-tested live 2026-09-14 (backup → Extract All → Load Project restored a project; members at both companies see no backup section) — STAGE 2 COMPLETE**

Provenance: Tommy approved starting Stage 2 on 2026-09-13 and asked to review the plan before any code is written. This plan builds on what is actually live, which was read directly rather than assumed:
- Stage 1 as deployed: `supabase/migrations/0001`–`0005`, `seed.sql`, `stage1_rls.test.sql`, `serverSession.ts`, `actingAs.ts`, `AuthProvider.tsx` and the `api/` routes.
- `projectFile.ts` at **`PROJECT_FILE_VERSION = 24`**. The Framing paragraph's "23" predates the 1/8in grid.

**Nothing decided above is reopened.** Planning in detail turned up four places where a decision was underspecified or collides with the code. Each is marked ⚠ inline and listed in this plan's Open Items; none is settled quietly.

#### Gate: finish the Stage 1 ordinary-account check first

Stage 1's hand test (`supabase/README.md`, "Hand-testing", steps 5–10) has **still not been run as an ordinary member.** Tommy passes every check as a platform admin, and both serious Stage 1 defects were invisible from that account. **Sub-stage 2B is the first time company design data reaches ordinary members through a new path, so the Stage 1 check must be done before 2B deploys.** 2A (schema only) may be applied before it, because nothing reads the new tables yet.

#### Where the document lives — a JSONB column on the version row (recommended)

**Size: estimated, not measured.**
- No real project files exist to measure. The repo and the session scratchpad were both searched on 2026-09-13; only test fixtures exist.
- **Estimate from `ProjectState`:** slot arrays are stored up to three times (`baseWallSlots`, `stories[0].wallSlots`, `stories[1].wallSlots`), at roughly 100–200 bytes per slot, more when it carries `zones`.
  - A 4-wall single-story rectangle comes to roughly 10–20 KB.
  - A two-story octagon with openings and bond beams comes to roughly 50–100 KB.
  - Everything else in the document is a few KB.
- Postgres TOAST-compresses JSONB values over about 2 KB, and this repetitive structure compresses well.
- **Arithmetic, not a forecast:** 2,000 versions at 30 KB is about 60 MB. 10,000 versions at 100 KB is about 1 GB. Compare these against the Supabase plan's database quota; this log does not state that quota from memory.
- **The coder records `pg_column_size(document)` for the first real saves**, and this paragraph gets the measured figure.

**Why a column, not Supabase Storage:**
1. **One write, one transaction.** The version row and its document land together or not at all. Storage would mean two writes, one to the object store and one to the row, which can fail independently and leave either an orphaned file or a row pointing at nothing.
2. **One permission system.** The document is covered by the same RLS policy as its row. Storage has its own separate policy system, and it would have to mirror every rule here and stay in step with it. That is exactly what decision 30 chose Supabase to avoid.
3. **Append-only is one trigger.** An object store has its own overwrite and delete paths, each needing its own guard.

**Backup consequence, stated because it decides this:** documents in a column are inside Supabase's database backups. Files in Storage are, to the best of this log's knowledge, **not** inside a database backup; only their metadata rows are. Confirm that against the current Supabase docs before ever moving documents to Storage.

**Revisit trigger:** move documents to Storage only if the median version exceeds about 1 MB, or the database approaches the plan quota. Listing queries must **name their columns and never select `document`**, so the folder tree stays cheap however large the documents get.

**⚠ Document size ceiling: 4 MB. This is picked, not decided (Open Item).** Vercel functions cap request and response bodies at about 4.5 MB. A larger document could not reach the database through a route anyway, so the database refuses anything over 4 MB with a readable error. It is an administrative guard, not a building value.
- *(Confirmed in 2B against `node_modules/next/dist/docs/`.)* Next 16 sets no body limit for route handlers. Server Actions default to 1 MB, which does not apply to routes. `proxyClientMaxBodySize` applies only to requests that pass through `proxy.ts`, and it truncates the body silently rather than refusing it; it does not apply here, because `proxy.ts`'s matcher excludes `/api`. **Vercel's ~4.5 MB is therefore the binding limit.**
- The database measures `document::text`, which is longer than the minified JSON the app sends, so "too large" is a real outcome with its own message ("This project is too large to save to the cloud (the limit is 4 MB). Nothing was saved. Download project file keeps a copy on this computer."). The client refuses without sending a minified document already over 4 MB, and a platform 413 that arrives without a JSON body maps to the same message.

#### Schema — migration `0006_stage2_projects_and_versions.sql`

**Safe on the live database, by construction:**
- It creates two tables, their helpers, triggers and policies.
- It **alters no Stage 1 table and touches no existing row.**
- The whole file is wrapped in `begin; … commit;`, so a failure part-way applies nothing.
- It is re-runnable: `create table if not exists`, `create or replace function`, and `drop policy if exists` before each `create policy`.
- Tommy pastes it into the SQL editor exactly as he did 0001–0005.

**`projects`:** the listing record. Mutable, but only in the ways listed.

| Column | Type / constraint | Why |
|---|---|---|
| `id` | uuid pk, `gen_random_uuid()` | |
| `company_id` | uuid not null, FK `companies(id)` **on delete restrict** | Ownership (25): whose tree it appears in and whose backup includes it. Immutable below privileged caller. `restrict`, not `cascade`, because companies leaving keep their designs (28) and a company delete must never silently take projects with it. |
| `folder` | text not null default `'current'`, check in (`current`,`past`,`proposals`) | Status label only (12). The one column a member may change. |
| `name` | text not null default `''` | **System-maintained** mirror of the head document's `state.projectName`. No client writes it directly; see name sync. Empty renders as *(untitled)* in the tree: a visible gap, not a substituted name. |
| `head_version_number` | integer not null default 0 | The latest version's number. System-maintained. `0` exists only inside `create_project`'s own transaction. |
| `created_by` | uuid, **no foreign key** | Immutable. Must equal the caller on insert. Not an FK: `on delete set null` would be an UPDATE the column guard refuses, which blocked deleting the account (review 2026-09-13; Open Item 8). |
| `created_at` / `updated_at` | timestamptz not null default `now()` | `updated_at` = last save; set by the version trigger, used for sorting. **Both forced to `now()` on insert by `projects_stamp_insert`** (as are `name` → `''` and `head_version_number` → 0), so a direct insert cannot backdate a project. |

Index `(company_id, folder, updated_at desc)`. **No uniqueness on name.** Two "Smith House" projects are legal; ids tell them apart.

**`project_versions`:** append-only (10). Enforced by the database, not the UI.

| Column | Type / constraint | Why |
|---|---|---|
| `id` | uuid pk | |
| `project_id` | uuid not null, FK `projects(id)` on delete cascade | Cascade is only reachable by a platform admin deleting a whole project. |
| `version_number` | integer not null; unique `(project_id, version_number)` | **Assigned by the trigger; any client value is overwritten.** |
| `parent_version_id` | uuid null, FK `project_versions(id)` (no action); check `parent_version_id <> id`; check `(version_number = 1) = (parent_version_id is null)` | The version the author had open when they started (11). Version 1 has no parent; every later version must name one. |
| `kind` | text not null default `'save'`, check in (`save`,`rename`) | Lets the version list show a rename as a rename. |
| `label` | text null, check length 1–200 | Optional note typed at save time. |
| `author_id` | uuid, **no foreign key** | **Overwritten with `auth.uid()`**, never trusted from the client. Not an FK: `on delete set null` would be an UPDATE, which append-only refuses for everyone. Attribution is carried by `author_name` (Open Item 8). |
| `author_name` | text not null | **A snapshot, taken by the trigger at save time**: `display_name`, falling back to email. See the leaver note below. |
| `created_at` | timestamptz not null | **Overwritten with `now()`.** This is the title-block date for cloud projects, so the browser clock is not trusted. |
| `schema_version` | integer not null | Copied from `document->>'schemaVersion'` by the trigger. The version list can then flag unopenable versions without downloading documents, and Stage 4's redactor (keyed to schema version) needs it. |
| `document` | jsonb not null | The `ProjectFile` exactly as `serializeProject` writes it, stored minified. |

Indexes: the unique pair above, `(parent_version_id)`, `(author_id)`.

**⚠ Why `author_name` is a snapshot. This is a real defect the plan avoids, not a nicety.** Decision 6 says a leaver's name stays on their versions. But `user_profiles_select` (0002) only shows a profile to someone who **shares a company** with that person. Revoke a leaver's membership, and every remaining colleague loses the ability to read their profile, so a join-on-read version list would show a blank author the moment attribution matters most. The snapshot makes decision 6 true.

**Triggers.** All are `SECURITY DEFINER` with `set search_path = public`, matching 0001.

1. **`prepare_project_version`, BEFORE INSERT.** In this order:
   - Refuse unless `can_write_project(new.project_id)`, with one uniform 42501 error. The same message for "no such project" and "not yours" means the error cannot be used to probe whether an id exists.
   - Lock the project row `for update`. **This serialises concurrent saves** on one project, so version numbers cannot collide and "head before this save" is exact.
   - Set `version_number` to head + 1, `created_at` to `now()`, `author_id` to `auth.uid()`, and `author_name` from `user_profiles`.
   - Validate the document:
     - it must be an object, with `state` an object and `schemaVersion` an integer;
     - its text length must be ≤ 4 MB;
     - a non-null `parent_version_id` must belong to **the same project**.
     Violations raise 23514 with a readable message.
2. **`apply_project_version_head`, AFTER INSERT.** Sets the project's `head_version_number`, `updated_at` to the version's `created_at`, and `name` to `document #>> '{state,projectName}'` (or `''`).
3. **`refuse_project_version_change`, BEFORE UPDATE OR DELETE.**
   - **UPDATE is refused for everyone**, platform admin and operator included. Decision 10 says never updated, not "updated by the powerful".
   - **DELETE is refused unless the caller is privileged *and* `pg_trigger_depth() > 1`**, meaning it is arriving as the cascade from a platform admin deleting the whole project.
   - A direct single-version delete is refused even for platform admin in Stage 2. It would leave `head_version_number` stale and break a `parent_version_id` chain. That operation belongs to Stage 5 and needs its own design.
4. **`guard_project_columns`, BEFORE UPDATE on `projects`.** Same shape as `guard_membership_self_update`.
   - `company_id`, `created_by` and `created_at` are immutable below a privileged caller. Transferring ownership is not an operation this system has yet.
   - `name`, `head_version_number` and `updated_at` may change **only when `pg_trigger_depth() > 1`**, meaning only from trigger 2. A client cannot set a trigger depth, so this is unspoofable from PostgREST.
   - `folder` is left to the update policy.
5. **`refuse_project_truncate`, BEFORE TRUNCATE on both tables** (added in review, 2026-09-13). Row triggers do not fire on TRUNCATE, so without this the owner could empty `project_versions` and append-only would not hold. Refused for everyone.
6. **`stamp_new_project`, BEFORE INSERT on `projects`** (added in review). Forces `created_at`/`updated_at` to `now()`, `name` to `''` and `head_version_number` to 0, whatever the client sends.

**Helpers.** `SECURITY DEFINER`, `stable`, execute revoked from `public` and `anon` and granted to `authenticated`, exactly as 0002's grant loop does.
- `can_read_project(uuid)`: the project exists and `is_member_of(company_id) or is_platform_admin()`.
- `can_write_project(uuid)`: **identical in Stage 2, deliberately defined separately.** Stage 3 adds collaborator grants to both. Stage 4 adds browsing to *neither*; see "Across companies".

**RPCs.** `SECURITY INVOKER`, so every policy below still applies to the caller. They exist for atomicity, not privilege, which is the opposite reason from 0003/0005's definer functions, and the comment says so. Execute is revoked from `public` and `anon` and granted to `authenticated`.
- `create_project(p_company_id, p_folder, p_document, p_label)`: inserts the project row, then version 1 with a null parent, in one call. Returns project id, version id, number and `created_at`.
- `save_project_version(p_project_id, p_parent_version_id, p_document, p_label)`: inserts one version. Returns version id, number, `created_at`, `head_before` (= new number − 1) and `diverged` (the parent's number ≠ `head_before`).
- `rename_project(p_project_id, p_name)`: appends a `kind = 'rename'` version whose document is the head document with only `state.projectName` replaced (`jsonb_set`), and whose parent is the head. Name length 1–200. This touches one key the same way the Stage 4 redactor will touch one key; it is not the server parsing the design (22).
- `insert … returning` inside these is safe from the trap 0005 documents: `projects_select` reads only the row's own `company_id` and never looks the row up, and `can_read_project` on versions reads a project row written by an *earlier* statement.

**Grants.** Supabase's default privileges grant broad rights on new `public` tables to `anon` and `authenticated`, so 0006 starts by revoking everything and then grants exactly:
- `projects`: `select`, `insert`, `update`, `delete` to `authenticated`.
- `project_versions`: `select`, `insert`, `delete` to `authenticated`, **with no `update` grant at all** (belt to trigger 3's braces).
- Nothing to `anon`, and **nothing to `service_role`** either (revoked from `anon`, `authenticated` and `service_role`; the app's only `service_role` use is `auth.admin` in the invite-accept route).
- **Follow-up `0007`** revokes `truncate, references, trigger` on the four Stage 1 tables from `authenticated`. Not a live exposure (PostgREST has no TRUNCATE), so it is defence in depth, kept out of 0006 so 0006 alters no Stage 1 object.

RLS is enabled on both, not FORCE (same reasoning as 0002). **Both get 0004's restrictive `meets_required_aal()` policy**, so an enrolled second factor gates project reads exactly as it gates companies.

**Policies, mapped to the permission matrix.** In the database, "own" means **any company you hold a membership in** (the matrix's own definition). Which of those trees you are *looking at* is the acting-as filter, applied in the route. The security boundary never depends on the acting-as cookie; the acting-as check exists to stop wrong-folder saves (see "Acting-as").

| Matrix row | `projects` | `project_versions` |
|---|---|---|
| **Guest** | No grant to `anon`: nothing. | Nothing. |
| **Member, acting as own company:** see tree, create, edit, move | `select`: `is_member_of(company_id) or is_platform_admin()` · `insert` with check: same, **and** `created_by = auth.uid()`, `head_version_number = 0` · `update` using/check: same (trigger 4 narrows it to `folder`) | `select`: `can_read_project(project_id)` · `insert` with check: `can_write_project(project_id)` (trigger 1 also enforces it) · no update policy |
| **Company admin, acting as own company** | Same as member in the database. Backup is gated in the route; see "Company backup" for why that is honest. | Same. |
| **Acting as the Seed Collaborative via the consortium entitlement** (read-only Seed tree, create yes, edit with grant) | **Nothing in Stage 2.** `is_member_of(Seed)` is false, so no rows, and create is refused. ⚠ See Open Items. | Nothing. |
| **A Seed Collaborative member, acting as Seed** | The member row, over Seed's own projects. No other company's rows (browsing is Stage 4). | Same. |
| **Invited collaborator** | Stage 3. `collaborators` does not exist yet. | Stage 3. |
| **Platform admin** | All rows · `delete`: `is_platform_admin()`, whole project | All rows · `delete` policy `is_platform_admin()`, but trigger 3 allows it only as the project cascade |

#### Across companies before Stage 4 — nothing at all

**Stage 2's policies give no read of any kind on a project owned by a company you are not a member of.** Platform admins are the exception, and that is already accepted and recorded under "Platform admins".
- There is no browse set, no redacted view and no metadata-only listing.
- **Because the cost redactor does not exist yet, this is what keeps every `priceModifier` inside its own company.** It is asserted directly in the RLS test.
- *(Stage 3, planned 2026-09-14: the one deliberate opening is an explicit `collaborators` grant. See "Stage 3 plan — Across companies".)*

**A constraint for Stage 4, recorded now so the easy path is not taken:** browsing must **not** be added by widening `project_versions_select`. RLS decides whether a row is served, not what the document inside contains (decision 30's caveat). A widened policy would hand browsers the raw document, margin included, straight from PostgREST using the publishable key that ships in the bundle. Cross-company documents must arrive only through the redactor's path.

#### Save flow

The editor holds one piece of new client state, `cloudContext`. It is either `null` or `{ projectId, companyId, companyName, folder, baseVersionId, baseVersionNumber, baseCreatedAt }`. **Base** means the version this editor state started from. `folder` is carried so the Project ▾ status line can name it without another request.

*(As built in 2B.)* `cloudContext` lives on a `DocumentSession` together with `titleBlockSave` and **`designGeneration`**, which sits beside `cloudContext` and is **not** part of it. `designGeneration` counts replacements of the design on screen: it is bumped by **Load Project, an Open from cloud that is applied, a Save as new / first Save to cloud that is applied, and a real account change** (below), and **not** by Save Project, Save to cloud into the open project, or a folder move. Every cloud request records the generation it was sent at, and its answer is applied only if the generation still matches (see "The cloud row of the date table"). The pre-apply check reads a synchronous copy of the session, advanced by the same reducer at dispatch time, because rendered state lags a dispatch by up to a frame.

- **Save to cloud, with no cloud project open** (`cloudContext === null`): opens the save dialog.
  - The dialog shows **"New project in *Building Integrity* › [Current Projects ▾]"**. The company is read-only, taken from the *verified* acting-as company. The folder defaults to Current Projects. There is an optional note, and the name is shown as the editor's project-name field.
  - Submitting calls `create_project`, and `cloudContext` becomes the new project at v1.
- **Save to cloud, with a cloud project open:** one click. `save_project_version` is called with `parent = baseVersionId`.
  - On success, **base moves to the new version**. Your own consecutive saves never trigger the divergence notice.
  - The title-block date becomes the server's `created_at`.
- **Save as new cloud project…** is always available when signed in. It is the dialog path again, into the acting-as company. The new project's v1 has no parent: a copy made within your own company is not a handoff (25) and records no lineage.
- **⚠ Load Project (a local file) clears `cloudContext`.** Otherwise a local file loaded while a cloud project was open would be appended into that unrelated cloud project on the next cloud save. This is silent, plausible, and exactly the class of failure the switcher exists for. The same applies to any "start a fresh design" action.
- **Name sync, per the decided rule.** Every save sets `projects.name` from the document (trigger 2). The editor's existing project-name field *is* the name.
  - **⚠ Renaming in the tree is `rename_project`: it appends a version.** A row-only rename would be reverted by the very next save, because the row takes its name from the document. Appending a version is the only reading under which both halves of the decision ("row follows document" and "rename writes into the next version") hold (Open Item).
  - If the renamed project is open in your own editor, the client also updates its name field. Base moves to the rename version only if base was head; otherwise base stays put and the notice will explain on your next save.
  - *(As built in 2C.)* **The title-block date moves with base, not with the rename.**
    - When base was head, the rename version is exactly base with a new name, so the date becomes its `created_at`, as for a save.
    - When base was not head (an older version was opened, or a colleague saved meanwhile), the rename copied someone else's head, not the design on screen. **The date stays**, because this rename did not save the design on screen. The name field still takes the new name, so the next save keeps it.
    - "Base was head" is decided by number: a rename's parent is always its number − 1, because `rename_project` copies the head under the project-row lock.
    - A rename whose answer lands after the design was replaced (the generation moved) writes nothing, not even the name field.
    - Save to cloud is disabled while a rename is in flight, so a save cannot name a base that the rename is about to move.
  - Past versions keep their old name, so a sheet printed from v3 shows v3's name. That is correct, as decided.
- **What is stored:** `serializeProject(state)` unchanged, cost fields included. This is your own company's project, and nothing crosses a company line in Stage 2.

#### Opening a version, and older app versions

- **Open** fetches one version's document, runs it through `parseProjectFile` unchanged, and applies it with the same setters `handleLoadFileSelected` uses.
  - **The coder extracts those ~60 setters into one shared apply function** rather than copying them.
  - **One difference, already decided (Roles, 9):** a cloud open **ignores the document's `role`** and keeps the viewer's own toggle.
- **Schema outcomes.** `parseProjectFile` deliberately accepts only the current version and the one before it.

| Document `schemaVersion` | What happens |
|---|---|
| = current | Opens. |
| = current − 1 | Opens via the existing migration. The next save writes it in the current format. |
| **< current − 1** | **⚠ Refused, visibly.** "Version 3 was saved by an older version of the app (file format 22) and can't be opened by this one." A **Download this version's file** button hands over the untouched JSON, so nothing is lost. The version list shows the same badge from the `schema_version` column without downloading. |
| > current | "This version was saved by a newer version of the app. Reload the page to open it." This is a real case: pushing to `main` auto-deploys, so an open tab can be a release behind. |

- **⚠ This collides with append-only history over time.** Every two schema bumps, the oldest cloud versions become unopenable in-app. Stored versions are permanent, but the reading window is two versions wide. The plan does not quietly widen `parseProjectFile`'s window, because that is a standing maintenance cost on every future bump. It is an Open Item.
- A stale tab **saving** an older-format document is accepted. It is stored with its own `schema_version`, and the current app opens it via the one-back migration.
- *(As built in 2B.)* **Open is head-only, but the list can be stale.** If a newer version was saved after the folder list loaded, the open still proceeds and a notice says: "A newer version (v9) was saved after this list loaded. You opened v7." It names no one, because the newer save may have been your own, in another tab.
- *(As built in 2B.)* **An open whose answer arrives after the design was replaced is not applied.** If a Load, another Open or a Save as new replaced the design while the version was downloading, the document is not put on screen, and the note says: "Smith House wasn't opened: the design on screen was replaced while it was loading. Open it again if you still want it."
- *(As built in 2C.)* **Opening any version.** Version history's Open and the tree's Open are one code path (`openVersion` in `useCloudProjects.tsx`). It has the same generation guard, the same `cloud-open` date writer (the version's `created_at`), the same schema outcomes, and ignores role in the same way.
  - **Base becomes the version opened.** So **the next Save to cloud saves a new version whose parent is that older version.** The database reports that save as diverged; nothing is overwritten and nothing is blocked.
  - Opening a version older than the head leaves a notice that says what the next save will do, before it happens: "You opened version 3 of Smith House, saved by Virgil on Sep 12, 2026, 2:14 pm. The latest is version 7. Save to cloud will add a new version that starts from version 3; versions 4–7 stay exactly as they are."
  - `cloudContext` gains `latestKnownVersionNumber`: the head seen when base was set. It lets the save notice tell "you started from an older version" apart from "someone saved while you had it open" (see the divergence notice).
  - **Out-of-window versions** carry a badge in the list and offer **Download this version's file** instead of Open. That means older than current − 1, newer than current, or with no recorded format.
    - The download fetches the untouched stored document. It changes nothing on screen, so it writes no date.
    - A newer-format version gets the download too. 2B's open refusal for it offers none; the list's badge says to reload.

#### The divergence notice (11)

- **Detection:** the database answers it inside the save, under the project-row lock. `diverged = (parent's version_number ≠ head_before)`. There is no separate pre-save check and no polling; the base version id the client already holds is the whole input.
- **The notice appears after the save has succeeded. It never blocks, never asks first, and never offers to undo.** Both versions are kept. It is a non-modal note that stays until dismissed:
  > **Saved as version 8.** While you had this project open, 1 other version was saved: **version 7 by Virgil, 2:14 pm**. You started from version 6. Both are kept; nothing was overwritten. **[Open version history]**
  - **As built (2B), the exact texts.** "Both are kept" belongs to the one-version form only.
    - One intervening version: "Saved as version 8. While you had this project open, 1 other version was saved: version 7 by Virgil, 2:14 pm. You started from version 6. Both are kept; nothing was overwritten."
    - More than one: "Saved as version 10. While you had this project open, 3 other versions were saved, the latest by Virgil at 2:31 pm. You started from version 6. Every version is kept; nothing was overwritten."
    - An intervening rename that this save set back. One version: "…1 other version was saved: version 7 by Virgil, 2:14 pm, a rename to 'Smith Residence'. Your save set the name back to 'Smith House'. You started from version 6. Both are kept; nothing was overwritten." More than one: "…3 other versions were saved, the latest by Virgil at 2:31 pm, including a rename to 'Smith Residence'. Your save set the name back to 'Smith House'. …" A rename the save kept is not mentioned. An empty name prints as '(untitled)'.
    - If the intervening rows could not be read back, the count still comes from the numbers, with no author: "While you had this project open, 2 other versions were saved. You started from version 6. Every version is kept; nothing was overwritten."
    - With no divergence, the notice is just "Saved as version 5."
  - *(As built in 2C.)* **[Open version history]** is a button on every diverged save notice, on the older-version open notice, and on the rename notice.
  - *(As built in 2C.)* **A save that started from an older version opened on purpose** must not say "while you had this project open", because those versions already existed when it was opened. ("Older" here means base is older than the head seen at open.)
    - Its text: "Saved as version 8. It starts from version 3, which you opened, not from version 7, the latest when you opened it, so it doesn't build on versions 4–7. Every version is kept; nothing was overwritten."
    - Versions saved after the open are then named the 2B way: "Since you opened it, 1 other version was saved: version 8 by Virgil, 2:20 pm."
    - A set-back rename in either range reads: "Your save set the name back to 'Smith Residence' (version 6 had renamed it to 'Smith House')."
    - "Both are kept" only when there is exactly one other version.
    - When base was the head at open, the 2B texts above are unchanged.
  - **A save whose answer no longer describes the design on screen** is still reported as saved, never as if the design on screen were that version:
    - The design was replaced while it was in flight (a Load, an Open, a Save as new): "Saved as version 1 of Smith House in Building Integrity › Current Projects. The design on screen was replaced while that save was in progress, so this editor is not attached to that project; the design you see now was not changed."
    - The design was not replaced, but a newer save from this editor had already moved the base on: "Saved as version 4, but a newer save from this editor had already moved on; your editor stays on version 5."
- **It ships in 2B, not 2C.** In 2B there is no version list yet, so without the notice a colleague's concurrent save would not merely "disappear quietly into a list"; it would be invisible altogether.

#### Folders (12, 13)

- Three fixed folders per company. **Moving** is an `update … set folder` through the route. It changes nothing about who can see the project and creates no version.
- The route checks the affected row count, because an RLS-denied UPDATE is silent (0002's own note). Zero rows means 404.
- **Archive, never delete:** Past Projects *is* the archive. There is no archived flag and **no delete control anywhere in the Stage 2 UI**, for anyone.
- Permanent delete is enforced now at the database level (platform admin, whole project only). Its UI is Stage 5.

#### Acting-as: which company a new project belongs to, and switching mid-project

- **A new project belongs to the verified acting-as company**, resolved server-side by `loadSession` from the cookie, exactly as Stage 1 resolves it.
  - The client also sends `expectedCompanyId`, the company its dialog displayed. **A mismatch returns 409**: "You're now acting as Rare Forms (changed in another tab). Nothing was saved." The acting-as cookie is per-browser, not per-tab, so a switch in one tab silently retargets another. The 409 turns that into a visible refusal instead of a wrong-folder save.
  - Allowed entitlement sources: `membership` and `platform-admin`. A `consortium` source gets 403 with a plain message. ⚠ See Open Items.
- **Switching company with a cloud project open: the project stays open and keeps saving to its own project.** Saving into an existing project is governed by that project's ownership, not by the switcher (already decided).
  - The folder tree reloads for the new company.
  - The Project ▾ status line reads "Owned by Building Integrity. You're acting as Rare Forms; saves still go to this project."
  - Save as new cloud project targets the new acting-as company, and its dialog names it.
- **Access lost mid-session** (membership revoked): the save returns 403. The message offers **Download project file** with the editor state untouched, so work is never stranded.

#### The cloud row of the date table — and the rule that replaces Stage 0's precedence

**Requirement added 2026-09-13, from the Stage 0 review.** Stage 0 shipped `resolveTitleBlockDate({ cloudVersionCreatedAt?, localFile?: { savedAt }, now })` in `apps/web/app/titleBlockDate.ts`, with a strict timestamp parser and a `local-file-unrecorded` source that prints "Date not recorded". Its precedence is fixed: **cloud, then local file, then today.** That is correct for Stage 0, where the cloud input is never set, but it breaks as soon as Stage 2 sets it:
- **Open a cloud version, then Load Project a local file from 2025.** The cloud date still wins, so the sheet dates a 2025 design with the cloud version's save time.
- **Open a cloud version, then Save Project locally.** The same problem: the sheet shows the cloud version's time, not the save just made.

In both cases the sheet shows a confident, wrong date, which is exactly the defect the date decision exists to fix.

**The rule for Stage 2: the last action that saved or replaced the design sets the date.** It does not matter which kind of action it was.

- **One state value, replacing the two separate inputs:** `titleBlockSave: { savedAt: string | undefined; source: "local-file" | "cloud-version" } | null`. `null` means never saved or loaded this session, so the sheet shows today. **A present value whose `savedAt` is missing or unusable prints "Date not recorded"** (Stage 0, Tommy 2026-09-13) — it must never collapse to `null` and show today.
- **Four writers, and nothing else writes it:**

| Action | Sets `savedAt` to | `source` |
|---|---|---|
| **Load Project** (local file) | that file's `ProjectFile.savedAt` | `local-file` |
| **Save Project** (local download) | the `savedAt` just written into the file | `local-file` |
| **Open from cloud** (any version) | that version's `created_at` | `cloud-version` |
| **Save to cloud** / **Save as new cloud project** / **Rename** of the project open in your editor *(2C: only when base was head; see "Name sync")* | the new version's `created_at` **as returned by the database**, never the browser clock | `cloud-version` |

- **Precedence disappears.** Whichever writer ran last has already overwritten the value, so the resolver has nothing to rank.
- **The resolver's interface changes in Stage 2 (2B)**, to roughly `resolveTitleBlockDate({ lastSave, now })`. It returns `lastSave.savedAt` with its `source`, or `now` with source `today`. Stage 0's tests for the timestamp parsing and the today fallback carry over. Its cloud-over-local precedence test is replaced by two regression tests, one for each break above.
- **A failed or refused action writes nothing.** Examples: a rejected Load, a 409 or 403 on a cloud save, an out-of-window version that could not be opened. The date stays with whatever the design on screen actually came from.
- *(As built in 2B.)* **Rules the table did not cover:**
  - **Save Project keeps the open cloud project.** Only Load Project, and a real account change, detach it; Open from cloud and Save as new cloud project *replace* it with the project just opened or created.
  - **Known and accepted (2B review):** if tab B signs out and signs in as another member of the *same* company, tab A (which has not re-read the session) can still save into its open project; the version is attributed to the new account by `auth.uid()`. RLS permits it, attribution is honest, and nothing crosses companies.
  - **A late answer writes nothing.** A create, open or save answer whose `designGeneration` no longer matches (a Load, an Open or a Save as new replaced the design while it was in flight) sets no cloud project and no date. An opened document is not even applied to the editor.
  - **A real account change** is a different non-null account appearing, or an explicit sign-out through the app. It detaches the cloud project and voids answers still in flight, but **keeps the date**, because it does not replace the design on screen.
  - **A transient signed-out reading does neither.** `/api/session` answers a guest whenever `getUser` errors (a network blip, an expired token), and the editor re-reads the session after every 401/403. That reading does not detach, and when the same account comes back the project is still attached. Detaching there would make the next Save to cloud offer a new project and invite a duplicate.
  - **A local Save does not void an in-flight cloud save.** Both describe the same design; whichever completes last sets the date. Sheets print the day, so the ordering only shows across midnight.
  - **An unusable `created_at` also prints "Date not recorded"**, never today.
- For cloud projects, the document's own `savedAt` (the browser clock) is ignored. The date table says `created_at` is authoritative, and the Open-from-cloud writer reads the column, not the document.
- **Consistency with the date table:** the table's three rows still hold. This rule is how they resolve when one session touches both paths, which the table did not address. **The date-decision paragraphs above are not changed by this plan.**
- **Drawing or editing after a load keeps the loaded date.** For example, drawing a whole new footprint over a loaded file leaves the title block on that file's save date. The existing "edited-since-load reads as 'as of last save'" rule already covers this. It is recorded here because a completely redrawn building is the case where that rule is most likely to surprise someone; see Open Item 7.

#### Company backup (29) — concrete shape

**Who can use it:** a company admin (membership level `admin` at the acting-as company) or a platform admin acting as that company.

**What it covers:** every version of every project **owned** by that company.
- Collaborator-granted projects join in Stage 3, as 29 requires.
- The platform-wide backup is Stage 5.
- Nothing visible only through browsing can be included, because Stage 2 has no browsing.

**What it is:** one `.zip`, built **in the browser**.
- The route pages versions to the browser (by count and by bytes, each page under the body limit), and the browser writes the zip.
- This keeps the backup clear of serverless time and size limits.
- It needs a zip dependency; `fflate` is suggested (small, no dependencies), and the coder confirms.
- The route reads with the admin's own session through RLS. **It never uses the service role.**

**Layout:**
- `manifest.json`, containing:
  - `company` (id, name), `exportedAt`, `exportedBy`, and the app's `PROJECT_FILE_VERSION`;
  - per version: project id, current project name, folder, `ownership: "owned"` (so Stage 3 can add `"granted"` without a format change), version number, kind, label, author name, `created_at`, `parent_version_id`, `schema_version`, and a SHA-256 of the file.
- `projects/<folder>/<project-name-slug>--<project-id>/v0007--2026-09-13T1402Z.json`, each **the untouched stored `ProjectFile`**. Any version in the schema window loads straight back through **Load Project**.

**Honest limit, stated the way 23's export note is:** admin-only backup is a **convenience boundary, not a security one**. Any member can already open every version of their company's projects one at a time, so a determined member could script the same download. 29's real concern, a backup outranking the export rule by carrying other companies' work, cannot arise in Stage 2, and the test proves it.

**As built in 2D (2026-09-14).**
- **Who gets the entry, and whom the route accepts: the same people as the people list (`isAdminHere`).** That is a company admin of the acting-as company, or a platform admin acting as any company, because the policies let platform admins read every company. The entry is **Download company backup…** in the account panel, under the people list and invite form. Nothing is added to the top bar, which still fits at 360, 768 and 1200.
- **The route checks the verified acting-as company, not `requireEntitlement`.** The company in the path must be the acting-as company, and the caller must be a company admin there (membership level `admin`) or a platform admin.
  - This is narrower than the Routes table's `requireEntitlement`, because the acting-as company is itself resolved from the entitlements. (`requireEntitlement` keeps its one caller, `/api/acting-as`.)
  - A different company in the path is a 409, as for a create: "You're now acting as … (changed in another tab). The backup stopped; no file was saved."
  - An ordinary member, or someone acting through the consortium, gets 403. A malformed company id gets 404.
- **Every `projects` read filters by `company_id`.** RLS lets a platform admin read every company's projects, so without the filter a platform admin's backup of one company would carry the others'. Checked on local PostgreSQL 17.4: a platform admin sees 3 projects unfiltered and 2 filtered.
- **Paging.**
  - Order: projects by id, then versions by number. `after` is `<project id>:<version number>` of the last version received, validated as a uuid and an integer. Every filter is `.eq()` or `.gt()`; nothing from the request is spliced into an `or=` string.
  - Size: a page holds at most 50 versions (25 by default) and at most 4,000,000 bytes of JSON, and always at least one version.
  - Reads: version metadata by named columns; documents in parallel batches of 5, each its own `.eq()` read. A page walks each batch in version order and stops before the first version over the budget; the cursor is the last version included, so a page may read up to one batch of documents it leaves out. *(Polish 2026-09-14; was one document at a time.)*
  - A single version over 4,400,000 bytes is sent without its document and marked `too-large`. 0006's 4 MB ceiling should make that unreachable.
  - The first page also returns the project count, the server time (the manifest's `exportedAt`) and the exporting account.
- **Saves during a backup.** A save on a project the backup has not finished is included. One on a project it has already passed is not ("as of when that project was read"). Nor is a project created mid-backup whose id sorts before the cursor.
- **Zip: `fflate` 0.8.3, pinned exactly in `apps/web/package.json`.** It was already installed through `@types/three`, so the lock file gains one line. The browser compresses each file as it arrives and holds only the compressed chunks. The file is made only after the whole backup has succeeded.
  - *(Polish 2026-09-14.)* `backupZip` (and fflate) is loaded with a dynamic `import()` when a backup starts, not with the page. If it can't load, the backup fails with "the zip writer couldn't be loaded (are you offline?)" and saves no file. A separate fflate copy remains in the initial bundle through the 3D libraries; that is not backup code.
- **Files.** `projects/<folder>/<name-slug>--<project-id>/v0007--2026-09-13T1402Z.json`, each `JSON.stringify(document, null, 2)`, the same call Save Project makes.
  - Key order is jsonb's rather than the original file's; `parseProjectFile` does not depend on it.
  - Slugs are lower-case ASCII: accents are folded, anything else becomes a hyphen, the length is at most 60 characters, and an empty slug is "untitled". So a path has no Windows-forbidden character, trailing dot or space, or bare device name.
  - The project id keeps same-named projects apart. A duplicate path would get "-2" rather than overwrite a file.
  - *(Polish 2026-09-14.)* The company slug in the zip's own file name is at most 30 characters, so a Windows **Extract All** path stays under 260 (worst case 236 from `C:\Users\Tommy\Downloads\`).
  - A project renamed or moved during the backup keeps the directory it had when the backup reached it.
- **Manifest keys are camelCase**, like `ProjectFile`'s:
  - Top level: `format`, `formatVersion`, `company`, `exportedAt`, `exportedBy` (id, email, name), `appProjectFileVersion`, `projectCount`, `versionCount`, `outsideFileFormatWindowCount` and `notes`.
  - Per version: `path`, `projectId`, `projectName`, `folder`, `ownership: "owned"`, `versionNumber`, `kind`, `label`, `authorName`, `createdAt`, `parentVersionId`, `schemaVersion`, `fileFormat`, `opensWithLoadProject` and `sha256`.
- **Out-of-window versions** are included raw, with `opensWithLoadProject: false` and `fileFormat` set to `too-old`, `too-new` or `unreadable`. They are counted in `outsideFileFormatWindowCount`.
- **Failure produces no file, never a partial one.**
  - A page is retried twice on a network error or a 5xx, and not at all on a refusal.
  - The backup stops, with a message naming the cause and "No file was saved; try again.", if a page still fails, if a version arrives marked `too-large` or `missing`, or if a project's version numbers are not 1 to head without gaps.
  - So the manifest carries no error list: a zip that exists is complete.
- **Progress and cancel.** The panel shows "Downloaded 37 versions from 3 of 12 projects (2.1 MB)…" and a **Cancel backup** button. The runner lives in `AccountControl`, so closing the Account note does not stop it. Switching company does, and says so. *(Polish 2026-09-14.)* A Cancel at any point, including after the last page has arrived, ends as "Backup cancelled. No file was saved." with no download.
- **A version file loaded with Load Project dates its title block from its own `savedAt`, not from `createdAt`.** `savedAt` is the saving browser's clock, and a rename copies the previous version's. The manifest's notes say so. The files are left untouched, as the plan requires.
- **Flags check (polish, 2026-09-14): clean.** New administrative numbers only: document batch size 5, company slug cap 30.

#### UI — the Project ▾ menu, and nothing new on the bar

The Project ▾ note (`TopBar.tsx`) gains groups. Existing items keep their exact labels and behaviour:

1. **Status line** (only when a cloud project is open): "*Smith House* · v7 · Building Integrity › Current Projects", plus the acting-as mismatch line above when it applies.
2. **This computer:** **Save Project** and **Load Project**, **unchanged, never sign-in-gated** (14).
3. **Cloud · *acting-as company*** (signed in only):
   - **Save to cloud**
   - **Save as new cloud project…**
   - **Open from cloud…**
   - **Version history** (only while a cloud project is open)
   - For a **guest**, the group is replaced by one line, "Sign in to save projects to the cloud", which opens the existing account control and gates nothing. With **no backend configured**, the group is absent.
   - *(As built in 2B.)* **Signed in with no company membership:** a "Cloud" heading, no save or open items, and one line: "You're signed in, but you aren't a member of any company yet, so there's no company to save a cloud project into. Ask a company admin for an invite. Save Project still downloads the file to this computer." If a cloud project is still open (a membership revoked mid-session), Save to cloud stays, so its 403 and the Download project file offer can show.
   - *(As built in 2B.)* **While a second factor is pending:** a "Cloud" heading, no items, and the line "Enter your two-factor code (Account ▾) to use cloud projects." The routes answer 401 "Enter your two-factor code (Account ▾) before using cloud projects" in that state. **Both are messages, not the gate:** the gate is 0004's restrictive aal RLS policy on both tables, which already refuses that session's reads and writes.
   - *(As built in 2B.)* **Acting as The Seed Collaborative through the consortium:** no create item, and a line saying its folders open in a later stage. Save to cloud stays only while a project owned elsewhere is open.
4. **Site Properties** and **Panelizer**, unchanged.

The notes behind those menu items:
- **Open from cloud** is a `StickyNote` titled with the acting-as company.
  - Three tabs: Current Projects, Past Projects, Proposals.
  - Rows sorted by last save, each reading "*name* · v7 · Virgil · 2 hours ago", with actions **Open**, **Versions**, **Move to…** and **Rename**.
  - Acting as the Seed Collaborative through the consortium entitlement, the note says in words that Seed's folders open in a later stage. It shows no create action and no empty tree dressed up as a real one.
- **Version history** is a `StickyNote`, newest first.
  - Each row: number, "Saved" or "Renamed to '…'", author name, date and time, label.
  - Markers for **latest** and **you started from this one**, the out-of-window badge where it applies, and **Open**.
  - *(As built in 2C.)* Each row prints:
    - the author, and the calendar date **and** time ("Virgil · Sep 12, 2026, 2:14 pm");
    - the note, if any;
    - "started from v3", when a save's parent is not the version just before it.
  - *(As built in 2C.)* Every row is listed. A `kind = 'rename'` row is labelled, never skipped or collapsed (`supabase/README.md`: `kind` is not proof that only the name changed). A rename whose name could not be read back says just "Renamed".
  - *(As built in 2C.)* It is reached three ways: **Versions** on each tree row; Project ▾ → **Version history** (inside the note, not on the bar) while a cloud project is open; and a notice's [Open version history].
  - *(As built in 2C.)* **Rename** on a tree row opens an inline name field. A blank name is refused in words without a request, and an unchanged name sends nothing.
  - *(As built in 2C.)* If the API's row cap cuts the list short, the summary line says how many older versions are not listed. The cap is Supabase's `max_rows`; confirm its value in the dashboard, not from this log.
- **Download company backup…** lives in the account control's company-admin section, beside the people list and invite form. It is not in Project ▾, because it is about the company rather than this file.
- **No new top-bar element.** The bar was measured with 34px to spare at 768px (see "Tommy's decisions, 2026-09-13"), and adding to it re-creates the overflow bug. ⚠ See Open Items.

#### Routes

New routes live under `apps/web/app/api/projects/` and follow Stage 1's conventions:
- Each starts with `requireSession()`, uses the session's JWT-bound client so RLS is the access control, and uses `readJsonBody` and `errorResponse`.
- **No route in Stage 2 imports `createSupabaseAdminClient`.**
- 2FA is covered by the restrictive policies, as it is for Stage 1's tables.

| Route | Does |
|---|---|
| `GET /api/projects?folder=` | Lists the verified acting-as company's projects. No `document`. *(As built in 2B.)* Each row also carries its head version's id and author name, from a second query that selects named columns only. That query's `or=(and(...))` filter is built only from values the database just returned, never from request input. Open is head-only, so the row's head version id is what Open requests. |
| `POST /api/projects` | `{ expectedCompanyId, folder, label?, document }` → `create_project`. Returns 409 on acting-as mismatch, 403 on a consortium entitlement. |
| `PATCH /api/projects/[id]` | `{ folder }`. Zero rows → 404. |
| `POST /api/projects/[id]/rename` | `{ name }` → `rename_project`. *(As built in 2C.)* The name is trimmed and must be 1–200 code points (as `char_length` counts), checked before any query. Returns the new version plus `renamedFromVersionNumber` (always its number − 1). A project you cannot write, a missing one and a malformed id are the same 404: "That project doesn't exist, or you can't rename it. Nothing was changed." The database's 22023 is a 400. |
| `GET /api/projects/[id]/versions` | Version metadata only. *(As built in 2C.)* Reads the project row first; unreadable, nonexistent and malformed are one 404. Then named columns only, newest first: id, number, parent, kind, label, author name, `created_at`, schema version. **`document` is never selected.** A rename's name lives only in its document, so a second read extracts `document->state->>projectName` **for `kind = 'rename'` rows only**, and no save's document is read to draw the list. If that read fails, the row says "Renamed" with no name. Also returns `notListedCount` = head − rows returned. |
| `POST /api/projects/[id]/versions` | `{ parentVersionId, label?, document }` → `save_project_version`. Returns the version, plus `diverged` and the intervening versions' number, author and time. |
| `GET /api/projects/[id]/versions/[versionId]` | One version with its document. Unreadable and nonexistent are the same 404. |
| `GET /api/companies/[id]/backup?after=&limit=` | Paged versions with documents. Route-gated to company admin or platform admin. *(As built in 2D: gated on the verified acting-as company rather than `requireEntitlement`, and paged by project id then version number; see "Company backup".)* |

The routes check only that `document` is an object with an integer `schemaVersion` and an object `state`. **No deep validation and no redaction on the server** (22).

*(As built in 2B.)* **Ids and error codes.**
- **Ids are checked as uuids after authentication** (`requireSession` runs first), before any query. Any hex uuid is accepted, not only v4, since seeded rows need not be random.
  - A malformed **path** id (project or version) gets **404**, with the same message as not found.
  - A missing or malformed **body** id (`expectedCompanyId`, `parentVersionId`) gets **400**.
- **The 22P02 backstop**, for a malformed id that still reached Postgres: **400** for create and save, **404** for move and read, **403** for the list.
- **A 42501 on the list** gets its own message: "Couldn't list this company's projects. Your access may have changed; reload the page and try again." It is never "That project version doesn't exist".
- **Other 42501s:** a create is 403; a save is 403 with the Download project file offer; a move or read is 404.
- **23514:** the 4 MB refusal is 413 with its own message; the note, folder and lineage checks each have a readable message that names no constraint.

#### Staging — four sub-stages, each shippable

- **2A — Schema, RLS and tests. No app change.**
  - Contents: `0006`, `supabase/tests/stage2_rls.test.sql`, and README updates (a Stage 2 section, read-only pre-flight and post-flight queries, "run 0006 after 0005").
  - Ships when the test passes locally with mutation checks and Tommy has pasted 0006 and run the post-flight queries.
  - **This is the one foundation-only step, deliberately.** It is the same order Stage 1 used, and it is safe to apply ahead of the app because nothing reads these tables.
- **2B — Save to cloud, open from cloud, folders, divergence notice.**
  - Contents: the routes except versions-list, rename and backup; the Project ▾ cloud group and status line; the save dialog; Open from cloud with folder tabs and **Move to…**; head-only open; role ignored on open; schema outcomes; `cloudContext` cleared by Load Project; acting-as 409 and switching behaviour; the **last-save-wins** title-block date (a single `titleBlockSave` value written by all four save and replace actions, with `resolveTitleBlockDate`'s interface changed to match).
  - **Usable alone: this is Tommy's sentence.** Save on one computer, sign in on another, open it.
  - Gates: the Stage 1 ordinary-account check is done, and Stage 0 is merged.
- **2C — Version history and rename.**
  - Contents: the version history note, opening any version, the out-of-window badge and raw download, and rename from the tree.
  - Usable alone: the list becomes the reconciliation UI (11).
  - *(Built and deployed 2026-09-14; hand-tested live 2026-09-14, steps 8a–8e matched. Hand-test step 8 is its acceptance.)*
- **2D — Company backup.**
  - Contents: the backup route, browser zip assembly, manifest, and the account-control entry.
  - Usable alone: the USB stick.
  - *(Built 2026-09-14 on branch `stage2d-company-backup`; not merged or deployed. Hand-test step 9 is its acceptance.)*

#### Tests — `supabase/tests/stage2_rls.test.sql` (local or staging only, never the live project)

The harness is Stage 1's, unchanged:
- `local_shim.sql`, then 0001–0006, then **`stage1_rls.test.sql` again (it must still pass)**, then this file.
- One transaction ending in `ROLLBACK`, with `pg_temp.assert` and `pg_temp.act_as`.
- The same refuse-to-run guard, extended to also refuse when any `projects` row exists. **Live has memberships, so the guard already refuses there. Nothing in `supabase/tests/` is ever pointed at the live project.**

Fixtures are Stage 1's people plus **frank, an ordinary member of Rare Forms** (the second company). Every assertion runs **without** the operator opt-in, as ordinary users unless the assertion is about platform admin.

1. **Create.** bob (ordinary BI member) creates a BI project.
   - Version 1 has `version_number = 1` and a null parent.
   - `author_id` is bob; `author_name` is set.
   - The project's `name` equals the document's `projectName`.
2. **Spoofing is overwritten, not trusted.** bob inserts with `author_id` = alice, `created_at` = 2001, and `version_number` = 99. The stored row says bob, now, 2.
3. **Wrong company.** bob cannot create in Rare Forms, or in the Seed Collaborative, with 42501. dave (Seed member) can create in Seed.
4. **Nothing crosses companies: the margin assertion.**
   - frank sees 0 BI projects and 0 BI versions.
   - carol (non-member company) sees 0.
   - From bob's session, `count(*)` of versions whose document carries `priceModifier` equals the number of BI versions only.
   - bob cannot read dave's Seed project.
5. **Append-only.**
   - UPDATE of a version's `document`, `label` or `created_at` raises: as bob, as alice (company admin), as pat (platform admin), and from a direct connection with the operator opt-in.
   - `has_table_privilege('authenticated', 'public.project_versions', 'update')` is false.
6. **Delete.**
   - A direct version DELETE is 0 rows for bob. It raises for pat (a single-version delete is not a Stage 2 operation).
   - Project DELETE is 0 rows for bob and alice.
   - For pat, it deletes 1 project and cascades its versions.
7. **Columns.**
   - bob PATCHing `name`, `head_version_number`, `company_id` or `created_by` raises 42501.
   - bob changing `folder` affects 1 row.
   - frank changing a BI project's folder affects 0 rows.
   - `folder = 'archive'` raises 23514.
8. **Lineage.** Each of these is refused:
   - a parent from another project;
   - a null parent on a project with versions;
   - a non-null parent on version 1;
   - a parent version belonging to a project the caller cannot read.
9. **Divergence.**
   - bob saves from v1 (→ v2, `diverged = false`).
   - alice saves from v1 (→ v3, `diverged = true`, `head_before = 2`).
   - bob saves from v2 (→ v4, `diverged = true`).
   - bob saves from v4 (→ v5, `diverged = false`).
10. **Rename.**
    - bob renames: a `kind = 'rename'` version appears, only `state.projectName` differs from its parent's document, every earlier document is byte-identical, and the row name is updated.
    - frank's rename of a BI project raises.
    - A following save of an old-name document sets the row name back.
11. **Leaver attribution.**
    - An operator removes bob's BI membership. bob now sees 0 BI projects.
    - alice still reads bob's name on his versions, even though `user_profiles_select` no longer shows her bob's profile.
12. **Two-factor.** bob with a verified factor at aal1 reads 0 projects and 0 versions; at aal2 he reads them again.
13. **Grants.**
    - `anon` has no privilege on either table.
    - `authenticated` has no `truncate` on either.
    - `anon` cannot execute any new helper or RPC; `authenticated` can.
14. **Validation.** Refused: a non-object document, a missing `schemaVersion`, and a document over 4 MB.

**Mutation checks before calling 2A done**, each of which must fail the suite:
- disable RLS on `project_versions`;
- make `can_read_project` return true;
- drop trigger 3;
- drop the `author_name` snapshot (join on read instead);
- remove the project-row lock.

#### Hand-test checklist — the live app, as an ordinary member and a second company

**Accounts:**
- **T:** Tommy (platform admin).
- **M:** the Stage 1 ordinary Building Integrity member, **not a platform admin**.
- **R:** a new ordinary member of **Rare Forms**, invited by Tommy to an address he controls. **Not Greg**, who is a platform admin and would pass everything.

Steps marked "as M" or "as R" must not be done as T; platform admin passes every check.

0. **After pasting 0006 (2A):** run the README's read-only post-flight queries:
   - both tables exist with RLS on;
   - `anon` holds nothing;
   - no update grant on versions;
   - existing companies and memberships unchanged.
1. **As M, not T:** draw a design and Save to cloud. The dialog says Building Integrity › Current Projects. Sign in as M **on a second computer or browser**, open it from the cloud, and confirm the design is identical and the title block shows the save date. To see it, open a sheet that has a title block, such as Project Summary.
2. **As R, not T:** Open from cloud lists nothing of Building Integrity's. Paste M's version URL (`/api/projects/<id>/versions/<vid>`) into R's browser and confirm 404 and no document. **This is the "no margins cross-company before Stage 4" check.**
3. **As M, then T at the same time:** both open v1, M saves, then T saves. T gets the notice naming M's version, nobody is blocked, and both versions are in history.
4. **As M, not T:** change the viewer role, then open a cloud version. The role is unchanged.
5. **As M, not T:** Load Project an older local file while a cloud project is open, and confirm **the title block switches to that file's date**. Save Project locally and confirm the date becomes now. Then Save to cloud: the dialog asks for a **new** project instead of appending.
   - **5a. As M, not T:** start Save as new cloud project, and before it finishes, Load Project a local file. The editor shows the loaded file with its date and no cloud status line. The notice says the new project was saved but the design on screen was replaced. The next Save to cloud asks for a new project.
6. **As M, not T, two tabs:** switch to The Seed Collaborative in tab B. In tab A, **without reloading it**, try Save as new cloud project and get the "changed in another tab, nothing saved" refusal. (A reloaded tab A already shows Seed and gets the consortium message instead.) In tab B, the cloud note says Seed's folders come later and offers no create. The project already open in tab A still saves to Building Integrity.
7. **As M, not T:** move a project to Past Projects, confirm T sees the move and R still sees nothing. Confirm there is no delete control anywhere.
8. **(2C) As M, not T:**
   - **8a.** Open from cloud → **Versions** on a project with at least three versions. Every row shows who saved it and the date and time. The newest is marked latest. There is no delete control.
   - **8b.** Use the tree's **Open** on that project **immediately before** renaming, so your editor is on its latest version (if you opened it earlier and a colleague has saved since, the rename correctly keeps your older base and this step will look like a failure). Then **Rename** it from the tree.
     - History shows "Renamed to …" as the newest row.
     - The Project ▾ status line moves to that version.
     - The title block shows the new name and today's date.
   - **8c.** From history, **Open** a version from before the rename.
     - The title block prints the **old name** and **that version's save date**.
     - The notice names the latest version and says the next save starts from this one.
   - **8d.** Save to cloud.
     - **Expected, not a failure:** the version you opened in 8c is from before 8b's rename, so this save writes the **old name back**. The notice adds "Your save set the name back to '…' (version N had renamed it to '…')", and the tree's name reverts.
     - The notice says the save starts from the version you opened and doesn't build on the later ones. It says nothing about versions saved "while you had this project open".
     - Its **Open version history** button shows the new version marked latest, with "you started from this one" and "started from v…".
     - In a second browser, as M, confirm both the rename and the new version are listed, and that both are attributed to M.
   - **8e.** 8d's save moved your editor to the new latest version, so first go back: from **Version history**, **Open** a version older than the latest again (as in 8c). Then Open from cloud → **Rename**.
     - The status line stays on that older version.
     - The **date does not change** (Tommy, 2026-09-14: "as built is fine").
     - The project name field takes the new name.
     - The notice says your editor stays on that version.
   - **8f.** If any version was saved before the last file-format bump (format older than the app's current − 1), check two things. Its row carries the older-app badge. **Download this version's file** hands over a JSON that plain Load Project refuses with the file-format message. If no such version exists yet, note that and skip.
   - **8g. As R, not T:** in R's browser, open M's `/api/projects/<id>/versions` URL, then POST to `/api/projects/<id>/rename` from the console. With R signed in to the app in that tab, run for example: `fetch('/api/projects/<id>/rename', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"x"}' }).then(r => r.status)`, so the console prints the status (otherwise it only shows in the Network tab). Both return 404 with no version data, and M's history gains no row.
9. **(2D) Company backup.** M must be an ordinary member of Building Integrity for 9d. *(Simplified in the 2D review: the earlier draft promoted M through the console and relied on remembering to demote them; cancel and retry are covered by unit tests and the Chrome harness instead.)*
   - **9a. As T, acting as Building Integrity:** open Account ▾. Under the people list is "Building Integrity — backup". Press **Download company backup…**. When it finishes, the line reads "Backup saved as company-backup--building-integrity--….zip: N versions of M projects…", and the zip is in Downloads. A small backup can finish before the progress line is readable; that is fine.
   - **9b. As T:** in File Explorer, right-click the zip, choose **Extract All**, and open `manifest.json` in Notepad. It names Building Integrity, and `exportedBy` shows T's email. Then Project ▾ → **Load Project**, and pick a file from the extracted `projects` folder whose manifest entry says `"opensWithLoadProject": true`. The design opens, and the title block shows that version's project name. Its date comes from the file's own `savedAt`, so it can differ from the manifest's `createdAt`; that is expected.
   - **9c. As T:** open `/api/session` in the address bar and copy `actingAsCompanyId`. This is the Building Integrity id.
   - **9d. As M, not T:** open Account ▾: there is no backup section. Open `/api/companies/<Building Integrity id>/backup` in the address bar. It shows `{"error":"Only a company admin of Building Integrity can download its backup."}` and no `versions`.
   - **9e. As R, not T:** open Account ▾: there is no backup section. Open `/api/companies/<Building Integrity id>/backup` in the address bar. It shows the "You're now acting as Rare Forms (changed in another tab). The backup stopped; no file was saved." refusal and no `versions`.
10. **Signed out:** Save Project and Load Project behave exactly as today. The cloud group shows only the sign-in line.
11. **As T:** revoke R's Rare Forms membership. R's tree empties on the next request. Revoke and restore a BI test member, and confirm their name stays on their versions.
12. **As `tommy.fieser@gmail.com`, not T** (signed in, no company membership today): Project ▾ shows the Cloud heading with the no-company line, and no cloud save or open item. Save Project and Load Project work.
13. **As M, not T, two tabs, with a cloud project open in tab A** (corrected in the final 2B review: the app's only sign-out is Sign out, which always detaches, so the "same account" and "different account" cases must be driven from a second tab):
    - **Same account comes back.** Sign out in tab B. In tab A, press Save to cloud: it is refused with **Download project file**, and the status line stays. Sign in as M again (in either tab), then Save to cloud in tab A: it saves a new version instead of asking for a new project.
    - **Explicit sign-out.** In tab A, use the app's Sign out. The status line disappears and the title-block date is unchanged. After signing back in, Save to cloud asks for a new project.
    - **Different account.** With a project open in tab A, sign out in tab B and sign in there as **R**. In tab A, press Save to cloud: after the refusal, the status line disappears and the date is unchanged.

Anything that behaves differently for M or R than for T is worth stopping on, even if T's version looks right.

#### Coder handoff — to-do, one block per sub-stage

- **2A.**
  - Scope: migration 0006 and its RLS test, exactly as specified above.
  - Files: `supabase/migrations/0006_stage2_projects_and_versions.sql`, `supabase/tests/stage2_rls.test.sql`, `supabase/README.md`.
  - Acceptance: both test files pass locally; all five mutation checks fail the suite; the file is one transaction and re-runnable; no Stage 1 object is altered.
  - Edge cases: concurrent saves; the cascade-versus-direct delete depth check; `insert … returning` under RLS.
  - Not in scope: any app code.
- **2B.**
  - Scope: save, open and folder moves in the live app.
  - Files: `apps/web/app/api/projects/**`, `TopBar.tsx` (Project ▾ groups), a new cloud notes component, `page.tsx` (shared apply function, `cloudContext`, Load Project clearing it, cloud date input), `projectFile.ts` (untouched unless the shared apply lives beside it).
  - Acceptance: hand-test steps 1–7 and 10 pass **as M and R**; local Save/Load unchanged byte-for-byte; no route imports the admin client.
  - Also: `titleBlockDate.ts` (interface change to one `lastSave` input) and its tests, including regression tests for "cloud open then local Load" and "cloud open then local Save".
  - Edge cases: stale tab (newer or older schema); 403 mid-session keeps editor state; an empty `projectName`; a refused save or open leaves the date unchanged.
  - Not in scope: version list, rename, backup.
- **2C.**
  - Scope: version history and rename.
  - Files: versions-list and rename routes, the history note.
  - Acceptance: step 8; the out-of-window badge and raw download.
  - Edge cases: renaming the project open in your own editor while base ≠ head.
  - Not in scope: deleting versions.
  - *(As built.)* Files:
    - Routes: `api/projects/[id]/versions/route.ts` (GET added) and `api/projects/[id]/rename/route.ts`.
    - Route logic: `cloud/projectRouteLogic.ts` (`listVersions`, `renameProject`).
    - Editor state: `cloud/documentSession.ts` (`cloud-rename`, `renameOutcome`, `latestKnownVersionNumber`).
    - Editor UI and wording: `cloud/versionHistory.ts`, `cloud/divergenceNotice.ts`, `cloud/useCloudProjects.tsx`.
    - `TopBar.tsx`: one item inside the Project note. `page.tsx`: passes the name setter.
    - **The edge case resolved as:** base stays, the date stays, and the name field takes the new name.
- **2D.**
  - Scope: company backup.
  - Files: backup route, zip assembly, account-control entry.
  - Acceptance: step 9; manifest fields as listed; files reload through Load Project.
  - Edge cases: a company with zero projects; a single page near the body limit.
  - Not in scope: platform backup, granted projects, restore.
  - *(As built.)* Files:
    - Route: `api/companies/[id]/backup/route.ts`.
    - Route logic: `cloud/backupRouteLogic.ts` (`checkBackupAccess`, `readBackupPage`). `cloud/projectRouteLogic.ts` gains the `backup` error mapping.
    - Browser: `cloud/companyBackup.ts` (file names, manifest, completeness, the page loop) and `cloud/backupZip.ts` (fflate).
    - UI: `cloud/useCompanyBackup.ts`, held by `auth/AccountControl.tsx`, and `cloud/CompanyBackupSection.tsx`, rendered by `auth/AccountPanel.tsx`.
    - `cloud/cloudTypes.ts`: the page shape. `apps/web/package.json` and `package-lock.json`: `fflate` 0.8.3.
    - No migration.
  - *(As built.)* **The edge cases resolved as:** a company with zero projects is a zip holding only `manifest.json`; a single page near the body limit holds one version, alone, under 4.5 MB.

**The coder re-runs the 6-point flags check against each diff.**

#### Not in scope for Stage 2

- Collaborators, grants and requests (Stage 3).
- Creating in Seed's tree through the consortium entitlement (Stage 3; the inference was confirmed 2026-09-14, see the Stage 3 plan, 3D).
- Browsing and the redactor (Stage 4).
- Permanent-delete UI, single-version delete, and platform backup (Stage 5).
- An unsaved-changes warning before opening over current work (Load Project has none today either).
- Autosave, search, restore-from-backup.
- Widening `parseProjectFile`'s version window.
- Title-block branding by owning company (theming is not applied to the title block yet).

#### Noticed while planning — not Stage 2 work, recorded so it is not lost

- **Stage 1's grants may include `TRUNCATE` for `authenticated`.** 0002 revokes from `anon` and grants four privileges to `authenticated`, but does not revoke Supabase's default broad grant first. TRUNCATE bypasses RLS. It is unreachable through PostgREST, which issues no TRUNCATE, so this is defence in depth rather than a hole. Check `has_table_privilege('authenticated','public.memberships','truncate')` in the 2A post-flight, and if true, revoke it in a small follow-up.
- **Cloud versions inherit the plaster and shipping price round-trip bug** (see "What strip cost fields actually means"). Those seven prices are not in `ProjectState`, so a colleague opening your cloud project sees defaults, exactly as a local file does today. Not fixed here. When it is fixed, those fields become redaction targets.

#### Open Items — Stage 2 (Tommy's decisions; each has a recommended default)

**Answered by Tommy 2026-09-13: all seven defaults accepted as written** — *"Your recommendations for all these things are great, let's roll with them."* Each item below is now a decision, not an open question; the ⚠ marks are kept only so the reasoning stays findable. The 4 MB ceiling (5) remains a picked number that Tommy accepted, not a measured one.

1. **⚠ Old cloud versions become unopenable after two file-format bumps.** Default: show them honestly ("saved by an older app version") with a raw-file download, and do not widen `parseProjectFile`'s one-back window now. The alternative, keeping every migration forever, is a real cost on every future schema change.
2. **⚠ Creating a project while acting as the Seed Collaborative without being a Seed member waits for Stage 3.** Without the `collaborators` table, the creator could not reopen their own project after saving it once. Default: defer, and answer the creator-grant inference (under "The company switcher") when Stage 3 is planned. **Answered by Tommy 2026-09-14 (Stage 3 answer 1): the creator gets a grant.** **BUILT and CLOSED by sub-stage 3D (2026-09-20):** `checkCreateTarget` admits the consortium source, the creator's standing grant is written by 0008's trigger (not by the app), and the project is reachable afterwards through the Shared with us tab. See "Stage 3 plan — Collaboration" → 3D as-built.
3. **⚠ Renaming from the tree adds a version marked "Renamed".** Default: yes. A rename that only touches the listing is undone by the next save, because the listing takes its name from the document.
4. **Backup format.** Default: the zip described under "Company backup". Accepting it closes the standing backup-format item, and confirms that admin-only backup is a convenience gate rather than a security one.
5. **⚠ Document size ceiling: 4 MB, picked, not decided.** Default: 4 MB, just under Vercel's request limit. Recorded here rather than wrapped in a `CatalogValue`, for the same reason as `INVITE_EXPIRY_DAYS`.
6. **No always-visible "which cloud project is open" indicator on the top bar.** Default: status lives in Project ▾ only. Reconsider after using it, because the bar has about 34px spare at 768px.
7. **Small: a redrawn building keeps the loaded file's date.** Load a file, draw a completely new footprint without saving, and the sheet still shows the old file's save date. The decided "as of last save" meaning already covers this. Default: leave it as decided. If it bites in practice, the cheap fix is the unsaved-changes marker that decision already calls a nicety, not a change to the date rule.

**Added in the 2A review (2026-09-13), after Tommy's acceptance above:**

8. **Account deletion leaves dangling uuids — approved by Tommy 2026-09-14:** *"yes, keep saved work separate from accounts."* `author_id` and `created_by` have no foreign key, so deleting an auth user leaves them pointing at no one. Attribution survives through the `author_name` snapshot, and nothing grants access through either column. Rejected: `on delete restrict`, which makes anyone who ever saved undeletable; a trigger exception on versions, which breaks "never updated". **Stage 3 must know:** if the creator-grant inference (Open Item 2) ever grants access by `created_by`, that column is a plain uuid that may name a deleted account. *(Addressed in the Stage 3 plan: the creator grant is written from `auth.uid()` into a column with a foreign key, and nothing keys on `created_by`.)* Revisit if a later stage joins versions to live accounts (such as a Stage 5 audit view); that join must tolerate missing users.
9. **Stage 1, found in passing: a person who founded a company cannot be deleted.** `companies.created_by` is an FK with `on delete set null`, and Stage 1's guard refuses changing a company's creator, so the delete aborts (`42501: a company's creator cannot be changed`). Not caused by Stage 2. Default: leave it until someone actually needs deleting, and fix it the same way as 8 (drop the FK) if so. Recorded in `supabase/README.md`.

#### Flags check: clean, confirmed against the code rather than assumed

1–4. **Clean.** No real-world building number is introduced or moved: no fastener spacing, load, density, dimension or cost figure. No `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is in scope, and `data.ts` is not touched.

5. **Clean.** Nothing new reaches the Review Log.

6. **Clean.** Nothing pending is treated as settled.
   - The document stores the existing `priceModifier` and catalog-derived values unchanged, each keeping whatever status it already carries.
   - The only new numbers are administrative: the 4 MB ceiling (flagged above as picked), backup page sizes, and layout measurements already recorded in the Top Bar section. Like `INVITE_EXPIRY_DAYS`, they are deliberately kept off the engineer's review list.
   - **The one principle this plan leans on is the flag convention's own:** "saved by an older app version" instead of a silently failed open, *(untitled)* instead of a substituted name, and a 409 instead of a silently retargeted save. A visible gap beats a plausible substitute.
   - *(2C, re-run against its diff: clean.)*
     - No building value is introduced, and no `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is touched. `data.ts` is untouched, and nothing new reaches the Review Log.
     - The only new number is administrative: the 200-character name limit, which is 0006's own check (`PROJECT_NAME_MAX_CHARS`).
     - Out-of-window versions, unreadable rename names, a blank author and a history cut short by the row cap are each shown as a visible gap, never a substitute.
   - *(2D, re-run against its diff: clean.)*
     - No building value is introduced, and no `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is touched. `data.ts` is untouched, and nothing new reaches the Review Log.
     - The only new numbers are administrative, and none is a building value:
       - page sizes (25 by default, 50 at most);
       - the 4,000,000-byte page budget and the 4,400,000-byte single-version guard;
       - the 60-character slug cap;
       - two retries.
     - Cost fields such as `priceModifier` travel inside the company's own documents, unchanged, exactly as a version download already carries them. The backup covers only projects the company owns.
     - A failed page, a version that could not be included, and a gap in version numbers each stop the backup with a message. None produces a zip that looks complete: a visible failure, never a silent substitute.

### Stage 3 plan — Collaboration (2026-09-14) — APPROVED BY TOMMY 2026-09-14 (all Open Item defaults accepted) — **3A BUILT and reviewed (ship), migration 0008 merged; APPLIED TO LIVE 2026-09-15 (pre-flight 4 companies / 3 memberships / 3 projects / 12 versions; every post-flight check matched; counts unchanged, 0 grants; an ordinary member saved and loaded a cloud project afterwards)**; **3B BUILT, DEPLOYED and hand-tested live 2026-09-15 (steps 1–10 all matched; a multi-account hand test needs one browser or profile per account, because incognito windows share one sign-in)**; **3C BUILT, reviewed (ship) and DEPLOYED 2026-09-20 (vitest 1677, tsc clean; review changed no code but rewrote step 11a/11e/11f, because `seen_through` starts unset and every grant from steps 1–10 is still pending at 11a). NOT hand-tested live: step 11 is deferred to the next testing batch by Tommy's choice, so run it alongside 3D's step 12 and 3E's steps.** Tommy also confirmed the company-grant notice rule stands as approved: *"a new company member would be able to find the folder - all good on them not getting a batch of messages."*; **3D BUILT, reviewed (ship) and DEPLOYED 2026-09-20 (vitest 1683, tsc clean; the review changed no code but rewrote step 14, which could not be driven as written — T reaches Seed through the consortium, so Seed's folder tabs stay on the Stage 4 message, and only a Seed member or a platform admin can remove a creator grant. Reviewer confirmed the consortium opening is exactly one company: `computeEntitlements` builds that source only for the single `isConsortium` row, 0001's unique index allows only one, and `projects_insert` re-checks. This closes Stage 2 Open Item 2.) NOT hand-tested live: steps 12–14 join step 11's deferred batch, in the order 12 → 13 → 14.**; **3E BUILT, reviewed (ship) and DEPLOYED 2026-09-20 (vitest 1704 in 104 files, tsc clean, 22 of 22 Chrome checks; the review changed no code but rewrote step 15a — the save dialog has no name box, so the name comes from the project-name field — and recorded two caveats: the 255-character path budget assumes `C:\Users\Tommy\Downloads\`, and a grant revoked partway through its own project aborts the whole backup with no file. The reviewer traced the two-source cursor and confirmed no version can be skipped or duplicated, including a budget ending exactly at the seam, a project both owned and granted, and an old phase-less cursor; the forged-cursor check re-reads the grant before the project and reveals nothing about whether an id exists.) NOT hand-tested live: steps 15–16 join the deferred batch.** **STAGE 3 IS COMPLETE: 3A–3E are all live.** **Hand test 2026-09-24: SPOT-CHECKED, NOT COMPLETED.** 11a–11d were driven in full and passed (the notice appears, survives opening the tab, clears on Got it, and stays clear in a second browser). The rest — 11e–11h, 12–16, and the people page's 26–35 — were judged by using the app rather than step by step, at Tommy's choice. **Three checks therefore remain unproven live:** a second co-op member cannot reach a Seed project's document (13), a personal share appears in no company's backup (15e), and a granted project is never duplicated under `shared/` in its owner's backup (16). All three are asserted in the local RLS suites; a live run would add PostgREST, cookies and a real browser on top. Worth running before real work starts in November.

Provenance: Tommy was interviewed on 2026-09-14, and his fifteen answers are below. He will review this plan and decide its Open Items before any code is written. The plan builds on what is live, which was read directly rather than assumed: `supabase/migrations/0001`–`0007`, `supabase/README.md`, `apps/web/app/api/projects/**`, `apps/web/app/cloud/**` and `apps/web/app/auth/{actingAs,serverSession}.ts`.

**Nothing decided above is reopened.** Where an answer collides with an earlier line of this log or with the live schema, it is marked ⚠ and listed in this plan's Open Items.

#### Tommy's answers, 2026-09-14 — decisions, not suggestions

1. **Creator keeps access.** Creating a project in another company's tree (for example, acting as The Seed Collaborative) gives the creator a standing collaborator grant. Ownership stays with that tree's company. *This confirms the inference under "The company switcher" and unblocks Stage 2 Open Item 2.*
2. **A grant goes to a person or to a whole company.**
3. **Any member of the owner company can share** a project outside the company. *Chosen over admin-only.*
4. **There is one access level: full edit, costs included** (24). There is no view-only tier.
5. **Shared-in projects appear in a "Shared with us" tab** in Open from cloud, beside Current / Past / Proposals, and each names the owner company. The recipient's own folders stay theirs.
6. **Access requests (the other direction of 26) are deferred to Stage 4**, alongside browsing. Stage 3 builds sharing only.
7. **Notification is an in-app notice at sign-in**, plus the project appearing in the Shared tab. There is no email service, and none is to be added.
8. **Removal** is refined by 13.
9. **A company-wide grant covers current and future members.** Whoever is a member at the time of each request has access; people who leave lose it.
10. **Collaborators CAN share onward.** *Chosen over owner-only.* See "Re-sharing".
11. **Collaborators can rename AND move folders.** *Chosen over rename-only.* See "Folder moves by a collaborator".
12. **Sharing is only with existing accounts and companies.** A new person is first invited to a company the normal way.
13. **Revocation:** any member of the owner company can remove any grant. A collaborator can remove only the grants they made themselves.
14. **Owner safety:** a collaborator can never remove the owner company's access or delete the project. Only a platform admin permanently deletes (13).
15. **The people/activity page and the "make admin" button are a short follow-up right after Stage 3**, not part of it. See "Open Items — Backend, Accounts & Project Sharing"; this plan does not specify them.

#### What changes, in one paragraph

- **A grant is a row in `collaborators`.** Holding one makes `can_read_project` and `can_write_project` true, which Stage 2 defined separately so that this stage could extend both.
- **The owner company's access is not a row.** It is `projects.company_id`, and no grant operation can touch it. That is what makes answer 14 structural rather than a rule someone has to remember.
- **Every write of a grant goes through a database function**, and **removal is an RLS policy**. The UI shows or hides buttons; the database decides.

#### Schema — migration `0008_stage3_collaboration.sql`

**Safe on the live database, by construction:**
- One `begin; … commit;`, re-runnable, in the same style as 0006: `create table if not exists`, `create or replace function`, and `drop … if exists` before each trigger and policy.
- **No Stage 1 object is altered.**
- **Exactly six Stage 2 objects are replaced, each because it has to be:**
  - the functions `can_read_project`, `can_write_project` and `create_project`;
  - the policies `projects_select`, `projects_insert` and `projects_update`.
  - The reason for each is given below. Nothing else from 0006 changes: no table, no trigger, no other policy, and no row.
- Tommy pastes it after 0007, exactly as before.

**`collaborators`:** one grant on one project.

| Column | Type / constraint | Why |
|---|---|---|
| `id` | uuid pk | |
| `project_id` | uuid not null, FK `projects(id)` **on delete cascade** | Reachable only through a platform admin deleting the whole project. |
| `grantee_user_id` | uuid null, FK `auth.users(id)` **on delete cascade** | A grant to a person (2). **Deleting the account deletes the grant.** This is a DELETE, which nothing refuses, so the 2A problem (an FK action becoming a refused UPDATE) cannot arise. |
| `grantee_company_id` | uuid null, FK `companies(id)` on delete cascade | A grant to a company (2). |
| **exactly one grantee** | `check (num_nonnulls(grantee_user_id, grantee_company_id) = 1)` | Enforced by the table, not by the function that writes it. |
| `kind` | text not null, check in (`shared`, `creator`) | `creator` is answer 1's grant. |
| `granted_by` | uuid, **no foreign key**; `check ((kind = 'creator') = (granted_by is null))` | Who shared it. Authorship-like, so it is decided the same way as 2A (Open Item 8): **no FK, and a snapshotted name.** An FK with `on delete set null` would make deleting a sharer's account rewrite the record of who granted whom, and 13 keys removal rights off this column. A dangling uuid grants nothing, because nobody holds a deleted account's `auth.uid()`. A creator grant has no granter. |
| `granted_by_name` | text null | Snapshot, using `prepare_project_version`'s rule (display name, then email). **Required for the access list across companies:** `user_profiles_select` hides a sharer from another company. Null only for `creator`. |
| `grantee_name` | text not null | Snapshot of the person's name, or of the company's name, when the grant was made. It is labelled "as shared" in the UI. **Why a snapshot:** neither `user_profiles_select` nor `companies_select` shows another company's person or company. |
| `created_at` | timestamptz not null default `now()`, forced by the writing function | Drives the notice (7) and the list order. |

- **Indexes:**
  - `unique (project_id, grantee_user_id) where grantee_user_id is not null`
  - `unique (project_id, grantee_company_id) where grantee_company_id is not null`
  - `(grantee_user_id)` and `(grantee_company_id)` (the Shared tab and the notice)
  - `(granted_by)`
- **Grants are immutable.** There is no update grant and no update policy. Changing a grant means removing it and sharing again.
- **Privileges:** `authenticated` gets **`select` and `delete` only**, with no `insert` and no `update`. Every grant is written by the functions below. `anon` and `service_role` get nothing, as in 0006.
- RLS is enabled, not FORCE. The table carries 0004's restrictive `meets_required_aal()` policy.

**`share_notice_state`:** one row per person, holding the in-app notice's high-water mark (7).

| Column | Type | Why |
|---|---|---|
| `user_id` | uuid pk, FK `auth.users(id)` on delete cascade | |
| `seen_through` | timestamptz not null | A grant created after this time is "new" to this person. Set only by `dismiss_share_notices()`, to the server's `now()`. |

- **Why not a seen flag on the grant:** a company grant reaches many people, and one flag cannot record that some of them have seen it.
- Privileges: `select` to `authenticated`, and nothing else. A `select` policy shows `user_id = auth.uid()` only, plus the aal policy.

**Helpers**, all `SECURITY DEFINER`, `stable`, `set search_path = public`, with execute revoked from `public`/`anon` and granted to `authenticated` (0002's grant loop):

- **`holds_project_grant(p_project uuid)`:** does a `collaborators` row exist on that project with `grantee_user_id = auth.uid()`, **or** with `grantee_company_id` set **and `is_member_of(grantee_company_id)`**?
  - **That membership test is answer 9, evaluated on every request and never copied.** A person who joins Rare Forms tomorrow has access on their first request, and a person who leaves has none on their next. No per-member rows are ever written.
  - **It is `is_member_of`, never `can_act_as` or `is_seed_entitled`.** A grant to the company *The Seed Collaborative* therefore reaches **Seed's own membership rows only, not the whole co-operative.** Otherwise one share would become Stage 4 browsing, costs included. The test asserts this, and one mutation checks it.
- **`can_read_project` / `can_write_project`** (replaced): Stage 2's body `or holds_project_grant(p_project)`. **They are still identical (4)** and still defined separately. The comment gains: *"Stage 4 adds browsing to NEITHER."*
- **`project_owner_company_id(p_project uuid)`:** the owning company, read past RLS, so that the `collaborators` policies can ask "is the caller a member of the owner?"
- **`project_owner_company_name(p_project uuid)`:** returns the name **only if `can_read_project(p_project)`**, and null otherwise. **This is needed because live code would show a blank owner:** `listVersions` and `getVersion` read `companies.name` through RLS, and `companies_select` hides the owner from a collaborator from another company.

**Policies** — the Stage 2 ones that change, and the new ones:

| Policy | Stage 3 expression | Why it must change |
|---|---|---|
| `projects_select` (replaced) | `is_member_of(company_id) or is_platform_admin() or holds_project_grant(id)` | **Stage 2's policy calls `is_member_of` directly, not `can_read_project`.** Changing only the helpers would show a collaborator the versions of a project they could not list. |
| `projects_update` (replaced) | the same expression, for both using and check | Answer 11 (moves). Also required for renames: `rename_project` runs `select … for update`, and **PostgreSQL applies the UPDATE policy to `FOR UPDATE`**, so a collaborator's rename would otherwise fail as "not found". `guard_project_columns` still narrows the update to `folder`, and it still refuses a change of `company_id` from anyone below a privileged caller. |
| `projects_insert` (replaced) | Stage 2's check, with `(is_member_of(company_id) or is_platform_admin() or (company_id = consortium_company_id() and is_seed_entitled()))` in place of the member test | Answer 1 plus 18: create freely in Seed's tree. **This widens nothing else:** no other company can be named. |
| `projects_delete` | unchanged: platform admin | 14. |
| `project_versions_*` | unchanged, and already expressed through `can_read_project` / `can_write_project` | They pick up grants through the helpers. |
| `collaborators_select` (new) | `can_read_project(project_id)` | Everyone who can open the project sees its whole access list, including who granted whom (10). ⚠ Open Item 3. |
| `collaborators_delete` (new) | `is_member_of(project_owner_company_id(project_id)) or is_platform_admin() or (granted_by = auth.uid() and can_read_project(project_id))` | Answer 13, **in the database.** A collaborator deleting someone else's grant affects zero rows. |
| `collaborators_require_aal`, `share_notice_state_require_aal` (new) | restrictive, `meets_required_aal()` | As on every other table. |
| `share_notice_state_select` (new) | `user_id = auth.uid()` | |

**Answer 14 holds structurally.** The owner company's access is `projects.company_id`: there is no row a collaborator could delete, and the share functions refuse a grant to the owner company. The project itself can be deleted only under `projects_delete`, by a platform admin.

**Functions that write** (`SECURITY DEFINER`). Each checks its own precondition, as `redeem_invite` does. **Each also calls `meets_required_aal()` itself and raises 42501 if it is false.** This adds them to 0004's written list of definer functions that bypass the restrictive policies, and that list must be updated in the migration comment rather than left to be rediscovered.

- **`share_project_with_person(p_project uuid, p_email text)` → `(status text, grant_id uuid)`.**
  - It refuses with one uniform 42501, *"project not found, or you cannot share it"*, unless `can_write_project(p_project)`. That covers answers 3 and 10: owner members, grantees (including members of a grantee company) and platform admins.
  - It looks up `lower(btrim(email))` in `auth.users`, which is why this function has to be definer.
  - **The status says what happened. Each case is not an exception:**
    - `shared`
    - `already-shared`: a grant to that person already exists. It is left untouched, and the original `granted_by` stands.
    - `no-account` (12): ⚠ Open Item 8.
    - `self`
    - `already-member`: the person is a member of the owner company, and a personal grant would keep them in after they leave, which would undermine decision 6.
  - It stamps `granted_by = auth.uid()`, both name snapshots and `created_at = now()`.
- **`share_project_with_company(p_project uuid, p_company uuid)` → `(status, grant_id)`.**
  - It uses the same access check as sharing with a person.
  - Statuses are `shared`, `already-shared`, `owner-company` (refused: answer 14, and a pointless grant), and `not-shareable` (a company outside `shareable_companies()`, reported with the same wording as a company that does not exist).
- **`shareable_companies()` → `(id, name)`.**
  - It feeds the company picker, and it is definer because `companies_select` shows only your own companies.
  - Default: companies with `is_seed_member = true`. ⚠ Open Item 4.
  - It returns names only, never flags or theme.
- **`dismiss_share_notices()`** upserts `(auth.uid(), now())` into `share_notice_state`.
- **The creator grant is a trigger, not a change to `create_project`.**
  - `grant_creator_access()` runs `AFTER INSERT` on `projects`, as definer. It inserts `(project_id = new.id, grantee_user_id = auth.uid(), kind = 'creator')` **when `auth.uid()` is not null and not `is_member_of(new.company_id)` and not `is_platform_admin()`.**
  - **It uses `auth.uid()`, never `new.created_by`.** That answers Stage 2 Open Item 8's warning: no access is ever keyed to the FK-less `created_by`. The grantee column has an FK, so the grant cannot outlive the account.
  - **A member creating in their own company gets no grant**, deliberately. Otherwise the grant would survive them leaving, against decision 6.
  - **A platform admin gets no grant either.** They already have access, and a grant would outlast losing the flag.
  - A trigger rather than an RPC change means every path that creates a project, including a direct PostgREST insert, writes the grant.
  - **A creator grant belongs to the person, not their company.** Someone who leaves every consortium company keeps that one Seed-tree project until a Seed member or a platform admin removes the grant (verified locally in the 3A review).

**Functions that read** (`SECURITY INVOKER`: RLS applies; they exist for one round trip, not for privilege):

- **`list_shared_projects(p_acting_as uuid)`** returns one row per project: project id, name, folder, head number, head version id, head author name, `updated_at`, owner company id and name (through the helper), and how the project reached you (`person` / `company` / `creator`, plus the granter's name snapshot).
  - It **never selects `document`.**
  - **The grant filter is written into the function, not left to RLS.** It includes rows where `grantee_user_id = auth.uid()`, or where `grantee_company_id = p_acting_as` and `is_member_of(p_acting_as)`.
  - It **excludes projects owned by `p_acting_as` when the caller is a member of it (or a platform admin)**, because the folder tabs already list those. Acting as Seed through the consortium, a project you created in Seed's tree stays in this tab.
  - *Why explicit:* `collaborators_select` also shows owner members every grant on their projects. An unfiltered read would list another person's grants as "shared with us", which is the same class of bug as the 2026-09-14 session-membership fix.
- **`pending_share_notices()`** returns grants that reach you and are newer than your `seen_through`.
  - Only `kind = 'shared'`, and not the grants you made yourself.
  - For a company grant, only grants created after **your own `memberships.created_at` at that company**. Someone who joins next year is not told about every old share as news.
  - Each row carries the project name, owner company name, the granter's name snapshot, "you" or the company name, and the time.

**`create_project` (replaced, same signature): why it must change.**
- **The trap.** It does `insert into projects … returning id into v_project_id`. `RETURNING` applies `projects_select` to the new row. For a consortium creator, the only true branch is `holds_project_grant(id)`, whose grant is written by an AFTER trigger in that same command. That is the invisible-to-its-own-command trap 0005 documents, so the create would fail with "new row violates row-level security policy".
- **The fix.** Set `v_project_id := gen_random_uuid()`, and insert it **without `RETURNING`**, which applies only the insert policy. The following version insert is a later statement, so it sees both the project row and the grant.
- **The comment in 0006 claiming the trap cannot bite is corrected here, not left standing.**
- **Assert both paths in the test:** a consortium create succeeds, and the single-statement CTE still fails closed.

#### Across companies — the one opening, and still nothing else

- **After Stage 3, a project owned by a company you are not a member of is readable only through a `collaborators` row that reaches you.** There is still no browse set, no redacted view and no metadata-only listing.
- **A collaborator sees costs** (24): the grant is the deliberate handoff that 21's redaction does not apply to.
- **The cost redactor still does not exist**, and nothing here needs it. RLS serves the whole document only to someone who holds a grant.
- **Stage 4's constraint is unchanged:** browsing must never be added through `can_read_project`, `holds_project_grant` or any `project_versions` policy.
- **The Seed-tree create is checked against this rule.** Acting as Seed through the consortium entitlement, you may create; the trigger then grants you that one project.
  - You still see **zero** other Seed projects, including those made by colleagues of your own company, unless one is shared with you.
  - **Consortium browsing is still Stage 4.** The folder tabs, acting as Seed through the consortium, keep saying so.
- **⚠ The honest consequence:** a document you create in Seed's tree carries **your** `priceModifier`, and Seed is now its owner. **Seed's own members see it, costs included**, by the ownership rule (20's sub-note). The database is behaving correctly; the person creating it might not expect this. ⚠ Open Item 5.

#### Re-sharing and propagation (10) — the exposure, stated plainly

- **There is no depth limit.** Anyone with access can share onward, to any existing account or to any company in the picker.
- **A company grant multiplies this.** Sharing with Rare Forms lets **every current and future member of Rare Forms** share onward, and their grantees can share onward again.
- **A design can therefore travel beyond the owner's direct control.** It does so with costs included (24), and with full export (a collaborator may Download project file or Save as new cloud project into their own company).
- **What the owner keeps:**
  - **Visibility.** The access list shows every grant and who made it.
  - **Removal.** Any owner member can remove any grant (13).
  - **Honest limit, same as 23:** removing a grant stops future reads. It does not recall a file already downloaded, or a copy already saved as someone else's project.
- **When a grant is removed, the grants that person made stay.** Grants are independent rows. The access list shows "shared by Frank" beside them, and makes no claim about whether Frank still has access: an ordinary member cannot see that through RLS, and no helper is added for it. ⚠ Open Item 1.
- **A possible mitigation is recorded, not built:** a per-project "only Building Integrity can share this" switch. ⚠ Open Item 7. The default is no limit, as Tommy chose.

#### Who sees what — the Shared tab and acting-as

- **"Shared with us" is a fourth tab** in Open from cloud. It lists:
  - projects **shared with you personally**, under any acting-as company, because a personal grant belongs to a person;
  - plus projects **shared with the company you are acting as**, because a company grant belongs to that company;
  - **minus** projects the acting-as company owns.
- **A company grant to one of your *other* companies is not listed while you act as a different one.** This is consistent with the folder tabs.
  - **Access is unaffected:** RLS still lets you save to it, and a project already open keeps saving (Stage 2's rule, below).
  - The empty state says so: "Projects shared with your other companies appear when you act as them."
- **Acting as Seed through the consortium:** the tab shows your personal grants, including creator grants. The three folder tabs keep the Stage 4 message.
- **A signed-in account with no membership** (such as `tommy.fieser@gmail.com` today) can hold a personal grant. For it, Project ▾ shows **Open from cloud**, with only the Shared tab.
- **Each row reads:** "*Smith House* · v7 · Frank · 2 hours ago — **Owned by Building Integrity › Proposals** · shared with you by Bob". A company grant reads "shared with Rare Forms by Bob", and a creator grant reads "you created it".
- **Actions:** **Open**, **Versions**, **Move to…** and **Rename** (all 11), plus **Access…**.

#### Folder moves by a collaborator (11)

- **The folder is the owner company's filing (12)**, and a collaborator's move refiles the project **in the owner's tree**.
- **How the collaborator sees it:** the Shared tab has no folders of its own, so every row prints the owner's folder: "Owned by Building Integrity › Proposals". The Project ▾ status line prints it too.
- **How they change it:** **Move to…** on the Shared row, or on the status line. The picker is titled **"Refile in Building Integrity's folders"** and lists Current / Past / Proposals, so that nobody thinks they are filing into their own company.
- **Route:** Stage 2's `PATCH /api/projects/[id]` is unchanged. The database allows the move through the replaced `projects_update`, and zero rows still means 404.
- **Rename:** Stage 2's route and `rename_project` are unchanged. They work through the replaced `projects_select` / `projects_update`.

#### Saving as a collaborator — which company's context applies

- **None. The project's grants govern it, as Stage 2 already decided.** `POST /api/projects/[id]/versions` has no acting-as check, and it stays that way.
- **The 2B 409 is create-only** (`checkCreateTarget`), so it cannot block a collaborator's save. Hand-test step 3 proves this live.
- **The author is `auth.uid()`, and the name is snapshotted** exactly as for a member. The divergence notice and version history already print `author_name` without a profile join, so **a Rare Forms author reads correctly in Building Integrity's history**, and still does after they lose access or leave (6).
- **The status line** adds how you reached the project: "Owned by Building Integrity · shared with you by Bob. You're acting as Rare Forms; saves still go to this project."
- **Save as new cloud project from a shared project** creates a copy in the acting-as company, with no lineage (Stage 2's rule). **It carries the owner's price modifier into your company.** 24 permits this (full export), and the dialog says "a copy, owned by Rare Forms; Building Integrity's project is unchanged".
- **When a grant is removed mid-session**, the save returns 403 with Stage 2's **Download project file** offer. Nothing new is needed.
- **`getVersion` / `listVersions` take the owner's name from `project_owner_company_name`**, not from a `companies` read, or a collaborator sees a blank owner.

#### The owner's access list, and sharing UI

- **Reached by** **Access…** on any tree row (all four tabs), and by Project ▾ → **Sharing…** while a cloud project is open. It is a `StickyNote`. **Nothing is added to the top bar** (Stage 2 Open Item 6).
- **First line, fixed, with no control:** "**Building Integrity** owns this project. Every Building Integrity member has access, and only a platform admin can delete it."
- **Then one row per grant, oldest first:**
  - "**Frank** (person) — shared by Bob · Sep 14, 2026"
  - "**Rare Forms** (company: every current and future member) — shared by Bob · Sep 14"
  - "**Dave** — created this project"
  - "… — shared by Frank"
- **Remove** appears only where the database would allow it: when you are an owner member or a platform admin, or when the row's `granted_by` is you. **The database is the gate, and the button is the courtesy.** A refused delete (zero rows) says "You can remove only the shares you made. Nothing was changed."
- **The share form** offers **Person** (email) or **Company** (picker from `shareable_companies`).
  - It always shows: "They get full edit access, costs included, and can share it onward."
  - For a company it adds: "…every current and future member of Rare Forms."
  - **A grant to The Seed Collaborative** reads: "The Seed Collaborative's own members, not the whole co-operative" (see `holds_project_grant`).
  - Status messages: `no-account` → "No account uses that email. Invite them to a company first; nothing was shared." `already-member` → "They're a Building Integrity member and already have access."

#### The in-app notice (7)

- **What is stored:** only `share_notice_state.seen_through`. What counts as new is computed by `pending_share_notices()`.
- **When it shows:** whenever the app loads for a signed-in person with pending notices, not only at the moment of signing in. It is a non-modal note:
  > **Shared with you:** Bob (Building Integrity) shared *Smith House* with you · Sep 14. **[Open Shared with us]** **[Got it]**
  - A company grant names the company: "…shared *Smith House* with Rare Forms."
- **When it clears:** **Got it**, which calls `dismiss_share_notices()`. The server time is stored, so a second computer is cleared too. Opening the tab does not clear it.
- **Not notified:** creator grants, grants you made, and company grants made before you joined that company.
- **Known race, accepted (3A review):** a grant's time is its sharing transaction's start. If the recipient presses **Got it** while that share is still committing, that one notice is never shown. The project still appears in Shared with us, which is the durable signal.

#### Company backup (29) — granted projects join

- **A company backup now contains every version of:**
  - projects the company **owns**, as today;
  - projects **shared with that company** (`grantee_company_id` = that company).
- **Personal grants are in no company's backup.** A personal grant belongs to a person, not a company. That person can already download each version by hand. ⚠ Open Item 2, which also covers creator grants: a Building Integrity designer's Seed-tree project is in **Seed's** backup (owned), not in Building Integrity's.
- **Route:** the cursor gains a phase, `after=owned:<project>:<n>` or `after=granted:<project>:<n>`. A cursor with no phase is read as `owned`, so a backup already in progress survives a deploy.
  - The granted phase reads project ids from `collaborators` **filtered by `.eq('grantee_company_id', companyId)`**, then pages exactly as the owned phase does.
  - **The filter is load-bearing for platform admins.** RLS shows them every grant, so without it one company's backup would carry another company's shares.
  - **A project both owned and shared with its owner cannot exist:** it is refused as `owner-company`.
- **Manifest:** `formatVersion` 2. Each granted version carries `ownership: "granted"` and `ownerCompany: { id, name }`, and the top level gains `grantedProjectCount`.
  - Files go under `shared/<owner-slug>/<name-slug>--<project-id>/…`, so an owner's folder names never mix with the backing-up company's.
- **A grant removed after a backup was taken:** the zip keeps the files. **A backup cannot be recalled**, which is the same honest limit as a downloaded file (23). The manifest's notes say so in one line.
- **A grant removed during a backup:** a page that can no longer read the project skips it, and the next project continues, as the owned phase already does for a deleted project. The completeness check applies only to projects that were read.

#### Routes

Stage 2's conventions apply unchanged: `requireCloudSession`, the JWT-bound client, `.eq()`/`.in()` only with database-returned or validated values, **no admin client**, and uuids checked before any query.

| Route | Does |
|---|---|
| `GET /api/projects/shared` | `list_shared_projects(<verified acting-as id or null>)`. No `document`. |
| `GET /api/projects/[id]/access` | The owner line (company name through the helper) and the grant rows (named columns). Unreadable and nonexistent are the same 404. |
| `POST /api/projects/[id]/access` | `{ kind: "person", email }` or `{ kind: "company", companyId }` → the matching RPC. `shared` is 201, and each other status is 200 with its message. 42501 is 404. |
| `DELETE /api/projects/[id]/access/[grantId]` | Deletes through RLS. **Zero rows is 404**, "You can remove only the shares you made, or this share is already gone. Nothing was changed." |
| `GET /api/companies/shareable` | `shareable_companies()`. |
| `GET /api/share-notices` · `POST /api/share-notices/dismiss` | The notice. |
| `POST /api/projects` (changed) | `checkCreateTarget` **admits `source === "consortium"`** (3D). The 409 on a mismatch is unchanged. |
| `GET /api/companies/[id]/backup` (changed) | The granted phase (3E). |
| `GET /api/projects/[id]/versions` and `…/versions/[versionId]` (changed) | The owner's name comes from `project_owner_company_name`. |

#### Staging — five sub-stages, each shippable

- **3A — Schema, RLS and tests. No app change.**
  - Contents: `0008`, `supabase/tests/stage3_rls.test.sql`, README (a Stage 3 section, pre-flight and post-flight, "run 0008 after 0007"), and **one deliberate edit to `stage2_rls.test.sql`**. Its assertion 3, "bob cannot create in the Seed Collaborative", becomes "bob **can**, and receives a creator grant". That is Stage 2 Open Item 2 being answered, not a regression.
  - Safe ahead of the app: no grant can exist until someone calls a share RPC. The live app's create route still refuses a consortium create.
  - Ships when all three SQL suites and the concurrency script pass locally, the mutation checks fail as expected, and Tommy has pasted 0008 and matched the post-flight results.
- **3B — Share, the access list, the Shared tab, and working as a collaborator.** The routes above except the notice and backup; the owner-name fix; Move to… and Rename on Shared rows; the status line. *Usable alone: this is the handoff.* Hand-test steps 1–10.
- **3C — The in-app notice.** Hand-test step 11.
- **3D — Creating in Seed's tree.** `checkCreateTarget` admits the consortium source; the save dialog names Seed and carries the Open Item 5 line; the Open note's create action appears acting as Seed. Hand-test steps 12–14.
- **3E — Granted projects in the company backup.** Hand-test steps 15–16.

#### Tests — `supabase/tests/stage3_rls.test.sql` (local or staging only, never the live project)

- **Harness:** Stage 2's harness, unchanged. Run `local_shim.sql`, then 0001–0008, then `stage1_rls.test.sql`, `stage2_rls.test.sql` (with its one edited assertion) and the concurrency script, then this file.
- **Guards:** the same refuse-to-run guard, extended to any `collaborators` row.
- **Fixtures:** Stage 2's people, plus:
  - **fiona**, a second ordinary member of Rare Forms;
  - **nick**, an ordinary member of a new company, New Frameworks (`is_seed_member` true);
  - **henry**, an account with no membership, who joins Rare Forms partway through.
- **Every assertion runs as an ordinary member**, without the operator opt-in, unless it is about the platform admin.

1. **Personal grant.** bob shares BI project P1 with frank → `shared`.
   - frank reads P1 and its versions, saves (the author is frank and the name is snapshotted), renames it, and moves its folder.
   - frank changing `company_id` or `created_by` raises 42501. frank deleting P1 affects 0 rows.
   - fiona (frank's colleague) reads 0.
2. **Nothing else crosses: the margin assertion, again.** frank sees exactly P1's versions among BI documents carrying `priceModifier`, and 0 rows of BI's other projects, even when naming their ids.
3. **Company grant, current and future (9).** bob shares P2 with Rare Forms.
   - frank and fiona read it; gwen reads it.
   - henry reads 0, is given a Rare Forms membership, and then reads it **with no new grant row**.
   - fiona's membership is removed, and she reads 0.
4. **A Seed company grant is not a consortium grant.** bob shares P3 with The Seed Collaborative. dave (a Seed member) reads it. **frank, who is seed-entitled but not a Seed member, reads 0.**
5. **Onward sharing (10).** frank shares P1 with nick: `granted_by` is frank and `granted_by_name` is set, and nick reads it. nick, now a grantee, shares P1 with carol, and carol reads it.
6. **Revocation (13), in the database.**
   - frank deleting bob's grant to frank, or bob's grant to Rare Forms, affects 0 rows.
   - frank deleting his own grant to nick affects 1 row.
   - alice (BI admin) and bob (BI member) can each delete any grant.
   - After bob deletes frank's grant, carol **still** reads P1 (encoding Open Item 1's default), and frank reads 0.
7. **Owner safety (14).**
   - Sharing with Building Integrity returns `owner-company`, and no row is written.
   - Sharing with erin (a BI member) returns `already-member`.
   - Sharing with yourself returns `self`.
   - Sharing the same person twice returns `already-shared`, with `granted_by` unchanged.
   - Sharing with an unknown email returns `no-account`, and the lookup is case-insensitive.
   - A direct `insert` or `update` on `collaborators` raises 42501 for everyone below operator.
8. **No access, no sharing.** frank, holding no grant on P4, calling either share RPC gets 42501. carol, whose company is not a member, gets the same on a project she cannot see.
9. **The creator grant (1).**
   - frank (seed-entitled) calls `create_project` into Seed: it succeeds, a `creator` row names frank, and frank saves again.
   - bob (seed-entitled) reads 0 of it. dave (a Seed member) reads it, costs included.
   - carol calling `create_project` into Seed gets 42501. frank creating in Rare Forms, dave in Seed, and pat anywhere each write **no** grant.
   - A direct `projects` insert by frank into Seed also writes the grant.
   - The single-statement CTE create still fails closed.
10. **Deleting accounts.**
    - Deleting nick's account (no operator opt-in) removes nick's grant.
    - Deleting frank's account leaves the grant frank made to someone else untouched, with its `granted_by_name` intact.
11. **Two-factor.** frank, with a verified factor at aal1, reads 0 shared projects and 0 grants, and each share RPC and `dismiss_share_notices` raise. At aal2 all of them work again.
12. **The Shared list and notices filter explicitly.**
    - bob (an owner member, who sees every grant on P1) gets **0** rows from `list_shared_projects(BI)`.
    - frank gets P1 under `list_shared_projects(Rare Forms)` and under `(Seed)`. He gets P2 only under `(Rare Forms)`.
    - `pending_share_notices()` for henry excludes P2, which was granted before he joined. After `dismiss_share_notices()` it returns 0 for that person, and `seen_through` equals the server's `now()`.
13. **Privileges.** `anon` holds nothing on either new table. `authenticated` holds no insert, update or truncate on `collaborators`. `anon` cannot execute any new function.

**Mutation checks**, each of which must fail the suite:
- `holds_project_grant` uses `can_act_as` instead of `is_member_of`: fails on assertion 4.
- The `granted_by = auth.uid()` branch of `collaborators_delete` is replaced with `can_read_project`: fails on 6.
- The creator trigger is dropped: fails on 9.
- The `owner-company` refusal is removed: fails on 7.
- The aal check is removed from `share_project_with_person`: fails on 11.
- `list_shared_projects` drops its grantee filter: fails on 12.
- `projects_select` is left at its Stage 2 form: fails on 1.

#### Pre-flight and post-flight for live — read-only, one query per paste

The coder copies these into the README with the exact expected output.

- **Pre-flight (a):** 0006 and 0007 are applied. Expect `true`.
  - `select to_regprocedure('public.create_project(uuid,text,jsonb,text)') is not null;`
- **(b):** 0008 is not yet applied. Expect `null | null`.
  - `select to_regclass('public.collaborators'), to_regclass('public.share_notice_state');`
- **(c):** write down four numbers.
  - `select (select count(*) from public.companies), (select count(*) from public.memberships), (select count(*) from public.projects), (select count(*) from public.project_versions);`
- **(d):** expect `true`.
  - `select has_table_privilege('postgres', 'auth.mfa_factors', 'select');`
- **Post-flight (A):** both new tables exist, with RLS on.
- **(B):** privileges. `collaborators` is select `t`, delete `t`, insert `f`, update `f`, truncate `f`. `share_notice_state` is select only. `anon` and `service_role` are `f` on everything.
- **(C):** policies on the two new tables, five rows, with the two `_require_aal` rows RESTRICTIVE. `projects` still has five policies with Stage 2's names.
- **(D):** the new trigger `projects_grant_creator` exists, and all 7 Stage 2 triggers are still present.
- **(E):** functions, with a definer flag for each and `anon_can_call` `f` on all of them.
  - `holds_project_grant`, `project_owner_company_id`, `project_owner_company_name`, `share_project_with_person`, `share_project_with_company`, `shareable_companies`, `dismiss_share_notices`, `grant_creator_access`, `can_read_project` and `can_write_project` are `t`.
  - `create_project`, `list_shared_projects` and `pending_share_notices` are `f`.
- **(F):** the helpers were really replaced. Expect `t | t`.
  - `select bool_or(proname = 'can_read_project' and prosrc like '%holds_project_grant%'), bool_or(proname = 'can_write_project' and prosrc like '%holds_project_grant%') from pg_proc where pronamespace = 'public'::regnamespace;`
- **(G):** the four numbers from (c) are unchanged, and `select count(*) from public.collaborators;` returns 0.

#### Hand-test checklist — the live app

**Accounts:**
- **T** — Tommy, the platform admin.
- **M** — the ordinary Building Integrity member.
- **R** — the ordinary Rare Forms member.
- **R2** — a **second ordinary Rare Forms member**, invited by T to another address he controls, as R was.
- **N** — an **ordinary New Frameworks member**, invited the same way. **Not Ace**, who is a platform admin.

Steps marked "as M / as R / as R2 / as N" must not be done as T.

0. **After pasting 0008 (3A):** pre-flight (a)–(d) before, and post-flight (A)–(G) after.
*(Steps 1–10 rewritten 2026-09-15 against the 3B screens, walked in headless Chrome. "Project A" and "Project B" are two Building Integrity projects M already has in the cloud. Names in quotes are what the screen prints; a person's name is their display name, or their email if they have none.)*

1. **(3B) As M, not T:** Project ▾ → **Open from cloud…** → Current Projects → **Open** on Project A. Then Project ▾ → **Sharing…**. Under **Share this project**, with **Person** selected, type R's email and press **Share**. It says "Shared with R." and the list gains a row **R (person)** with "shared by M · <today's date>" under it. Now type an address that has no account and press Share: "No account uses that email. Invite them to a company first; nothing was shared." **As R, not T:** Project ▾ → **Open from cloud…** → **Shared with us**. Project A is listed, with "Owned by Building Integrity › Current Projects · shared with you by M" under its name. Press **Open**, then open the **Project Summary** card on the right: the price matches what M sees. **As R2, not T:** Project ▾ → Open from cloud… → Shared with us: Project A is **not** listed.
2. **As R, not T:** with Project A open, Project ▾ → **Save to cloud**. It says "Saved as version N." **As M:** Project ▾ → Open from cloud… → Current Projects → **Versions** on Project A. The newest row shows R's name.
3. **As R, not T:** keep Project A open. In the **Acting as** box at the top left, pick **The Seed Collaborative (consortium)**. Open Project ▾: the grey status box's second line reads "Owned by Building Integrity. You're acting as The Seed Collaborative; saves still go to this project." (If you opened Project A from Shared with us without reloading the page since, it reads "Owned by Building Integrity · shared with you by M. You're acting as …" instead.) All four companies are consortium members today, so this step applies. Press **Save to cloud**. It says "Saved as version N."; there is no "changed in another tab" refusal. Switch the Acting as box back to Rare Forms.
4. **As R, not T:** Project ▾ → Open from cloud… → Shared with us. On Project A's row, open the **Move to…** dropdown. Its group heading reads "Refile in Building Integrity's folders", and "Current Projects (here now)" is greyed out. Pick **Proposals**. The row now reads "Owned by Building Integrity › Proposals". **As M:** Project ▾ → Open from cloud… → **Proposals** lists Project A. **As R:** on the same row press **Rename**, type a new name, press **Save name**. **As M:** close and reopen Open from cloud… → Proposals: Project A shows the new name.
5. **As R, not T:** on Project A's row in Shared with us, press **Access…** → Person → type N's email → **Share**. It says "Shared with N." **As N, not T:** Project ▾ → Open from cloud… → Shared with us lists Project A with "shared with you by R". Press **Access…** on it: there is a row **N (person)** with "shared by R · <date>".
6. **As R, not T:** press **Access…** on Project A. **Remove** appears only under N's row; R's own row has a small "you" tag and no Remove. Now press **F12**, open the **Console** tab (Chrome may ask you to type `allow pasting` first), and run these three lines one at a time:
   - `fetch('/api/projects/shared').then(r => r.json()).then(d => console.table(d.projects.map(p => ({ name: p.name, id: p.id }))))` — copy Project A's `id`.
   - `fetch('/api/projects/PASTE_ID/access').then(r => r.json()).then(d => console.table(d.grants.map(g => ({ who: g.granteeName, by: g.grantedByName, grantId: g.grantId }))))` — copy the `grantId` of the row whose **who** is R and **by** is M.
   - `fetch('/api/projects/PASTE_ID/access/PASTE_GRANT_ID', { method: 'DELETE' }).then(r => r.status)` — it prints **404**.
   Press **Refresh** in the Access note: the list is unchanged.
7. **As M, not T:** Open from cloud… → Open Project B → Project ▾ → **Sharing…** → **Company** → choose **Rare Forms** → **Share**. The row reads **Rare Forms (company: every current and future member)**. **As R and as R2 (each acting as Rare Forms):** Open from cloud… → Shared with us lists Project B with "shared with Rare Forms by M". **As T:** Acting as → Rare Forms; Account ▾ → under "Rare Forms — people", press **Remove** on R2. **As R2:** reload the page, then Project ▾ → Open from cloud…: Project B is not listed. **As T:** Account ▾ → **Invite someone** → R2's email, Member → **Create invite link**, and send R2 the link. **As R2:** open the link and accept, then Project ▾ → Open from cloud… → Shared with us lists Project B again. Its **Access…** list has no new row: nobody re-shared it.
8. **As R, not T:** Open from cloud… → Shared with us → **Open** Project A, and leave that browser tab as it is. **As M, not T:** Project ▾ → Open from cloud… → **Proposals** (step 4 moved Project A there) → **Open** Project A → Project ▾ → **Sharing…** → **Remove** under R's row. The confirmation shows a **ticked** box, "Also remove the 1 share R made (N)". **Untick it for this step** (the default question, Open Item 1, is whether N keeps access when you choose to keep it), then press **Remove**. It says "Removed the share with R." **As R, in the tab left open:** Project ▾ → **Save to cloud** is refused: "You can't save to this project any more…", with **Download project file**. Open from cloud… → Shared with us no longer lists Project A (Project B stays, through Rare Forms). **As N:** Shared with us still lists Project A. **As M:** the Access list still shows **N (person)**, "shared by R · <date>". Press **Remove** under it: no "Also remove" box appears (N shared it with nobody). Press **Remove**.
9. **As R, not T:** Open from cloud… → Shared with us → **Access…** on Project B (shared with Rare Forms). The first grey box (the owner line) has no button, no row has a Remove (R made no share on Project B), and there is no delete control anywhere. Press **Company** under Share this project: the dropdown does not list Building Integrity.
10. **As M, not T:** press F12 → Console and run `fetch('/api/projects?folder=current').then(r => r.json()).then(d => console.table(d.projects.map(p => ({ name: p.name, url: '/api/projects/' + p.id + '/versions/' + p.headVersionId }))))`. Copy the `url` of a project that was **never** shared: not Project A or B. If Current Projects has no other project, first draw anything and use Save as new cloud project to make one, then run the line again. **As R, not T:** paste the site address followed by that url into the address bar. The page shows only `{"error":"That project version doesn't exist, or you can't open it."}`: no document.
11. **(3C) The in-app notice.** *(Rewritten 2026-09-20 against the built screens.)* **Use one browser or profile per account** — as 3B's hand test found, incognito windows share one sign-in, so R and R2 must not be two incognito windows of the same browser. R needs **two** of them for 11d (say Chrome and Edge, or two Chrome profiles); everyone else needs one.
    - **11a. One notice. As R, not T, first:** reload the app. If a "Shared with you" note is already showing, it is from steps 1–10 — `seen_through` starts unset, so every grant ever made that reaches R is still pending, and nothing before 3C could clear them — so press **Got it** and reload, leaving it gone. **Then, as M, not T:** Project ▾ → Open from cloud… → Current Projects → **Open** Project A → Project ▾ → **Sharing…** → Person → R's email → **Share**. **As R, not T:** reload the page. A note titled **"Shared with you"** appears below the top bar, reading "**Project A**" and under it "M (Building Integrity) shared Project A with you · \<today's date\>", where M is M's display name (or M's email if M has none). It offers **Open Shared with us** and **Got it**, and says projects shared with you stay in Shared with us either way. **Nothing on the top bar changed.**
    - **11b. Opening the tab does not dismiss it. As R:** press **Open Shared with us**. Open from cloud opens with the **Shared with us** tab already selected and Project A listed. **The notice is still there** — that is deliberate: only Got it ends it. The notice and the tree share a cascade position, so one may sit over the other; drag either by its title bar to see both. Close the tree.
    - **11c. Got it. As R:** press **Got it**. The note disappears. **Reload the page: it does not come back.**
    - **11d. A second computer is cleared too. As R, in your second browser or profile:** sign in as R for the first time (or reload if already signed in). **No notice appears** — the dismissal was stored on the server, not in the first browser. *If you want to see it arrive in this second browser first, do 11d before 11c: sign in there while the notice is still pending, confirm the same note appears, then press Got it in EITHER browser and reload the other — it is gone in both.*
    - **11e. Several at once, and one project reached two ways. As M, not T:** share **Project B** with R (Person); then share **Project A** with the **company Rare Forms**; then share a **third project (C)** with R (Person) **and** with the **company Rare Forms**. (If you have no third cloud project, draw anything and use Save as new cloud project first.) **As R:** reload. The note's title reads **"Shared with you: 3 projects"**. Project C is **one row with two lines** — "…shared Project C with you" and "…shared Project C with Rare Forms" — because being reached twice is one piece of news. Press **Got it**. *(Corrected in the 3C review: 11c already dismissed Project A's personal grant, so Project A can no longer be the two-ways row.)*
    - **11f. Who is NOT notified.**
      - **As M** (who made every share above): reload. **No notice** — you are never told about your own shares.
      - **As R2, not T:** reload. The note lists **Project A and Project C** — the two shares made to Rare Forms in 11e — but **not Project B**, whose Rare Forms share was made back in step 7, *before* step 7 removed and re-invited R2. **That is the rule working, not a failure:** a company grant notifies only members who joined before it was made. Confirm the honest half: Project ▾ → Open from cloud… → **Shared with us** still lists Project B for R2. Press **Got it**.
      - **As R, signed out:** use Account ▾ → **Sign out**, then reload. No notice appears at all.
    - **11g. Onward sharing notifies the new person. As R, not T:** Open from cloud… → Shared with us → **Access…** on Project A → Person → N's email → **Share**. **As N, not T:** reload. The notice names **R** (not M) and Project A. Press **Got it**.
    - **11h. The top bar is unchanged.** On any of the accounts above, with a notice showing, narrow the window to roughly a phone width and back. The bar still fits, the **Acting as** box and **Account ▾** are still reachable, and the notice sits **below** the bar rather than in it.
    - **Not worth chasing:** the accepted race (a share that is still committing when Got it is pressed never shows as a notice). It is timing-dependent, cannot be produced on purpose from the UI, and the project still appears in Shared with us — which is the signal to rely on.
12. **(3D) Creating in Seed's tree.** *(Rewritten 2026-09-20 against the built screens.)* **Independent of steps 1–11:** it needs no project, share or notice from them, and 3C's step 11 and 3E's steps 15–16 neither feed it nor disturb it. The one ordering rule inside 3D is that **step 14 destroys what steps 12 and 13 set up**, so run 12 → 13 → 14 in that order. Only M is needed (one browser or profile, as in step 11).
    - **12a. The dialog. As M, not T:** in the **Acting as** box at the top left, pick **The Seed Collaborative (consortium)**. Draw anything, then Project ▾ → **Save as new cloud project…**. The dialog reads "New project in **The Seed Collaborative** › Current Projects", and under it, on **one line**: "**Owned by The Seed Collaborative: its members will see this design's costs.**" *(That line is Open Item 5, and it is honest: the design carries your own price modifier and Seed owns it, so Seed's members open it costs included. Nothing is redacted.)* Press **Save**: "Saved as version 1 of … in The Seed Collaborative › Current Projects."
    - **12b. Where it went. Still as M, acting as Seed:** Project ▾ → **Open from cloud…** → **Shared with us**: the new project is listed, and under its name it reads "**Owned by The Seed Collaborative › Current Projects · you created it**". Press **Current Projects**: Seed's folder tabs still list nothing. ~~and say its folders open in a later stage~~ **REWORDED BY 4B (2026-09-24):** they now say a consortium entitlement isn't a membership, so the tabs list nothing, and point at **Browse the consortium**, where Seed's own projects are — read-only, with costs not shown. **The tabs are still empty and that is still deliberate**: creating is the only thing 3D opened. Read the exact sentence in **Stage 4's step 13a**, not here.
    - **12c. No notice for your own work. As M:** reload the page. **No "Shared with you" note appears** for this project, now or later: a creator grant is never notified.
    - **12d. Saving, renaming and refiling it, all through the grant. As M:** Project ▾ → **Save to cloud**: "Saved as version 2." In Shared with us, on its row press **Rename**, type a new name, **Save name**. Then **Move to…** on the same row: the heading reads "Refile in The Seed Collaborative's folders"; pick **Proposals**. The row now reads "Owned by The Seed Collaborative › Proposals · you created it". Press **Versions**: the history lists v1, the rename and the saves, with M as the author.
    - **12e. The grant is yours, not your company's. As M:** switch the Acting as box back to **Building Integrity**. Shared with us **still lists it** as "you created it", and **Current Projects does not** — Building Integrity never owned it. Open it and Save to cloud once more: "Saved as version N", with no "changed in another tab" refusal.
13. ~~**As R, not T, acting as Seed:** Project ▾ → Open from cloud… → **Shared with us** does **not** list M's Seed project, and the folder tabs still say Seed's folders come later. To prove the document itself is unreachable, get its version URL the way step 10 does … **This is the Stage 4 line holding:** R is seed-entitled too, and still sees nothing of a Seed project that was not shared with them.~~
    **MOVED AND REWRITTEN — see Stage 4's step 13 (a/b/c).** Tommy skipped this step deliberately on 2026-09-15, on advice, because it read `consortiumLaterStageMessage` word for word and 4B was going to replace that string. **4B replaced it on 2026-09-24, so 4B owes the replacement**, and the rewritten version runs in 4B's own batch. Its substance is unchanged and is now stronger: R still cannot reach the document through Stage 2's address, **and** what R *can* now reach — the same project on the Browse the consortium tab — comes with its costs removed. Do not run this version; run Stage 4's.
14. **As T, with M's help for the id.** *(Console, as in steps 6 and 10 — Chrome may ask you to type `allow pasting` first. Rewritten in the 3D review: T cannot reach a Seed-owned project through the tree, because T's own company is a consortium member, so T's Seed entitlement is the **consortium** one — Seed's folder tabs list nothing for T, and Shared with us is empty for T since no grant reaches them. *(4B note, 2026-09-24: T can now SEE the project on the **Browse the consortium** tab, redacted. That does not help here — browsing offers no Access… control at all, so the grant still has to be removed through the console below.)* M cannot do this part either: a creator grant has no "shared by", so only a Seed member or a platform admin can remove it.)*
    - **As M:** F12 → Console → `fetch('/api/projects/shared').then(r => r.json()).then(d => console.table(d.projects.map(p => ({ name: p.name, id: p.id }))))`. Copy the Seed project's `id`.
    - **As T:** F12 → Console → `fetch('/api/projects/PASTE_ID/access').then(r => r.json()).then(d => console.table(d.grants.map(g => ({ who: g.granteeName, by: g.grantedByName, kind: g.kind, grantId: g.grantId }))))`. There is exactly one row: **who** is M, **by** is empty, **kind** is `creator`. Copy its `grantId`. Then run `fetch('/api/projects/PASTE_ID/access/PASTE_GRANT_ID', { method: 'DELETE' }).then(r => r.status)` — it prints **200**.
    - **As M:** reload. Shared with us no longer lists it, and with the project still open in the editor, Project ▾ → **Save to cloud** is refused with "You can't save to this project any more…" and a **Download project file** button.
    - **As T:** `fetch('/api/projects/PASTE_ID/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'person', email: 'PASTE_M_EMAIL' }) }).then(r => r.status)` — it prints **201**.
    - **As M:** reload. It is back in Shared with us, now reading "**shared with you by Tommy**" rather than "you created it", because the creator grant is gone and this is an ordinary share. A "Shared with you" notice also appears naming T (3C). Press **Got it**.
15. **(3E) Granted projects in Rare Forms' backup.** *(Rewritten 2026-09-20 against the built screens.)*
    - **What it needs, and what it does not.** It needs **step 7's company share** of Project B with **Rare Forms** to still be in place (11e adds Project A and Project C to it, which is fine — more granted projects, not fewer). It needs **nothing from 3D**: steps 12–14 destroy only the Seed project's own grant, which is a **personal** grant and was never in any company backup anyway. Run it after steps 11–14, in one browser or profile per account as before.
    - **15a. One personal-only share to prove Open Item 2. As M, not T:** draw anything, set the **project name field to "Project P"** (the save dialog takes the name from it — there is no name box in the dialog), then Project ▾ → **Save as new cloud project…** → **Save**. Then Project ▾ → **Sharing…** → **Person** → R's email → **Share**. Project P is now shared with **R the person** and with **no company**. *(Every other project by this point is shared with Rare Forms the company, so without this step there is nothing left to prove the exclusion with.)*
    - **15b. The backup. As T, acting as Rare Forms:** Account ▾ → under "Rare Forms — backup", press **Download company backup…**. The progress line counts owned and granted projects together, and the finished line reads "Backup saved as company-backup--rare-forms--….zip: N versions of M projects". Open the zip.
    - **15c. What is in it.** There is a **`shared/`** folder beside (or instead of) `projects/`, holding **`shared/building-integrity/<project>--<id>/v0001--….json`** for Project B, and for Projects A and C if 11e was run. `manifest.json` has `"formatVersion": 2`, a `grantedProjectCount`, and for each of those versions `"ownership": "granted"` with `"ownerCompany": { "id": …, "name": "Building Integrity" }`. *(If Rare Forms owns no projects of its own, there is no `projects/` folder at all and `projectCount` equals `grantedProjectCount`. That is correct, not a failure.)*
    - **15d. One of them opens.** Extract one file from `shared/` and open it with Project ▾ → **Load Project**. The design appears and the title block names it.
    - **15e. What is NOT in it.** Search the manifest for **Project P**: there is **no entry**, and no file for it anywhere in the zip. A share with one person is in no company's backup (Open Item 2). The zip also contains nothing owned by New Frameworks or anyone else who never shared with Rare Forms.
16. **As T, acting as Building Integrity:** download that company's backup. Project B appears **once**, as `"ownership": "owned"`, under **`projects/<folder>/`** — never a second time under `shared/`. There is **no `shared/` folder at all** unless another company has shared something with Building Integrity. Project P is here too, as `owned`: its personal share to R changes nothing about who owns it.

#### Coder handoff — to-do, one block per sub-stage

- **3A.**
  - Scope: `0008` and its RLS test, exactly as specified.
  - Files:
    - `supabase/migrations/0008_stage3_collaboration.sql`
    - `supabase/tests/stage3_rls.test.sql`
    - `supabase/tests/stage2_rls.test.sql` (assertion 3 only)
    - `supabase/README.md` (Stage 3 section, pre- and post-flight; delete the "collaborators are not here" line; add the new definer functions to 0004's bypass list)
  - Acceptance:
    - All suites pass locally, and every listed mutation fails them.
    - One transaction, re-runnable; a copy broken before `commit;` leaves nothing behind.
    - No Stage 1 object is touched. Only the six named Stage 2 objects change.
  - Edge cases: `create_project` through the consortium without `RETURNING`; FK cascade on grantee deletion under RLS; `for update` in `rename_project` for a grantee.
  - Not in scope: app code; `collab_requests`.
  - *(As built, 2026-09-14, branch `stage3a-collaboration-schema`; not merged, not applied to live.)*
    - **Files:** `supabase/migrations/0008_stage3_collaboration.sql`, `supabase/tests/stage3_rls.test.sql`, `supabase/tests/stage3_concurrency.test.sh` (new: see below), `supabase/tests/stage2_rls.test.sql` (assertion 3 only, inside an undone subtransaction so the rest of that suite reads what it did before), `supabase/README.md`.
    - **Verified locally** on PostgreSQL 17.4: all five scripts pass. On a database shaped like live, a copy broken before `commit;` leaves nothing behind, a second run is identical, and a per-object dump shows **exactly the six named Stage 2 objects changed**, every other object and row byte-identical, and all 53 added objects Stage 3's. The mutation table is in `supabase/README.md`, "Stage 3 verification status".
    - **⚠ The plan contradicted itself on the Shared tab; built to its stated reason.** "Functions that read" says `list_shared_projects` "excludes projects owned by `p_acting_as`, which are already in the folder tabs." "Who sees what" and hand-test step 12 say that, acting as Seed through the consortium, the tab lists your creator grants — and those projects are owned by Seed. Built as: *it excludes projects owned by `p_acting_as` **only when the caller is a member of `p_acting_as` or a platform admin**, i.e. when the folder tabs really list them.* A mutation back to the literal wording fails the suite. **Suggested spec wording** for that bullet: "It excludes projects owned by `p_acting_as` when the caller is a member of it (or a platform admin), because the folder tabs already list those. Acting as Seed through the consortium, a project you created in Seed's tree stays in this tab."
    - **Small judgement calls, each tightening rather than widening:**
      - `project_owner_company_id` also returns null unless `can_read_project` (the plan gated only the name), and both owner helpers return null below the required assurance level. Otherwise `project_owner_company_id(<any uuid>)` would tell anyone which ids exist and who owns them. The delete policy's answer is unchanged, because an owner member can always read.
      - `shareable_companies()` raises 42501 below the required assurance level, like the other definer functions.
      - The table also enforces the column note "`granted_by_name` null only for creator" (`check ((kind = 'creator') = (granted_by_name is null))`).
      - `share_project_with_person`: a blank email is 22023; an email matching two accounts raises 21000 rather than picking one. The status checks run in the order `no-account`, `self`, `already-member`, `already-shared`, then `shared`, **after** the access check, so an email cannot be probed through a project you cannot share.
      - **Both share functions write with `on conflict do nothing` and read the grant back**, so two people sharing with the same grantee at once get `shared` and `already-shared` naming one grant instead of a unique-violation error. The plan named no lock, but this is an ordering guarantee, so it has its own two-connection test (`stage3_concurrency.test.sh`), and removing the `on conflict` fails it.
      - **No TRUNCATE guard on `collaborators`:** grants are not history (any owner member removes any of them), and no client role holds TRUNCATE.
      - `list_shared_projects` returns one row per project, with `reached_via` (jsonb: `via` person/company/creator, `grantee_name`, `granted_by_name`, `created_at`), which covers 3B's "listed once, with both reasons".
      - 0004's written list of bypassing definer functions is updated in 0008's header comment and in the README, not in 0004's already-applied file.
      - `grant_creator_access` is not executable by any client role, and the new functions are also revoked from `service_role`.
    - **For 3D:** a **direct** `insert … returning` into Seed's tree is refused (42501) — `RETURNING` checks visibility before the creator grant exists. Create through `create_project`, which is what the route already calls. A direct insert without `RETURNING` works and writes the grant.
    - **Gaps found in 3A, resolved by the 3A review follow-ups (2026-09-14): no helper added; the wording in "Re-sharing and propagation", the access list, hand-test step 8, the in-app notice and Open Item 1 now says what the rows support.**
      1. **Whether a granter still has access cannot be computed by an ordinary member through RLS.** *(Resolved: the list shows "shared by Frank" and makes no claim either way.)* The shares Frank made are queryable (`granted_by` = Frank's `grantee_user_id`), which is all the Remove dialog's "also remove the N shares Frank made" needs, and the suite asserts it. But whether Frank *still* has access some other way — a company grant to a company he belongs to, or a membership — depends on memberships that another company's member cannot read. Options: (a) a small definer helper, for example `granter_has_access(p_grant uuid) → boolean`, null unless the caller can read the project, added to 0008 before it is pasted or in a 0009; or (b) weaker wording the rows can support, such as "shared by Frank (his own share was removed)", shown when no personal grant to `granted_by` remains on the project.
      2. **Removing a company grant has no "shares they made" to offer.** `granted_by` is a person, and nothing records which company they acted through. Suggested wording for Open Item 1: "the cascade offer applies to personal grants; removing a company grant offers nothing further".
      3. **One narrow notice race.** A grant's `created_at` is its sharing transaction's start. If the recipient presses Got it while that share is committing, that one notice is never shown, although the project still appears in the Shared tab. Suggested: accept it and record it, since the Shared tab is the durable signal.
- **3B.**
  - Scope: sharing, the access list, the Shared tab, and collaborator open/save/move/rename.
  - Files:
    - `api/projects/shared`, `api/projects/[id]/access/**` and `api/companies/shareable` routes
    - `cloud/projectRouteLogic.ts` (owner name through the helper)
    - `cloud/useCloudProjects.tsx` (fourth tab, Access…, refile picker wording)
    - `cloud/cloudMenu.ts` and the status line
    - `cloud/cloudTypes.ts`
  - Acceptance: hand-test steps 1–10 **as M, R, R2 and N**. No route imports the admin client. The Shared list never selects `document`.
  - Edge cases: a no-membership account with a personal grant; a grant removed while the Shared tab is open; a project shared both personally and to your company (listed once, with both reasons).
  - Not in scope: the notice, Seed create, backup.
  - *(As built, 2026-09-15, branch `stage3b-sharing-ui`; not merged, not deployed.)*
    - **Routes**, each starting from `requireCloudSession()` and the session's JWT-bound client; no admin client; ids checked as uuids before any query:
      - `GET /api/projects/shared` → `list_shared_projects(<verified acting-as id, or null>)`, one RPC, no table read.
      - `GET /api/projects/[id]/access` → the project row, `project_owner_company_name`, then `collaborators` by named columns, oldest first. Each row carries `canRemove` (owner-company **membership** or platform admin, or `granted_by` is you — a consortium entitlement to the owner is not owner-side) and, for a personal grant, the ids of the shares that person made. **No user ids are sent to the browser.**
      - `POST /api/projects/[id]/access` → `share_project_with_person` / `share_project_with_company` with `.single()`. `shared` is 201; every other status 200 with its message.
      - `DELETE /api/projects/[id]/access/[grantId]` → reads the grant (to scope the offer), deletes by id **and** project through RLS; zero rows is 404 with "You can remove only the shares you made, or this share is already gone. Nothing was changed." An optional body `{ alsoRemove: [grantId…] }` is the pre-ticked offer: deleted only where `granted_by` is the removed person, only after the main removal succeeded. No body is fine.
      - `GET /api/companies/shareable` → `shareable_companies()`, with the consortium company marked (through `consortium_company_id()`) for the Seed wording.
    - **SQLSTATEs mapped, confirmed on local PostgreSQL 17.4 against 0001–0008:** 42501 / 22P02 / PGRST116 → 404 for share, access and remove (not yours reads as not found), 403 for the two lists; 22023 (blank email) → 400; 21000 (two accounts, one email) → 409; 23514 (no name to snapshot) → 409. Nothing else is mapped, and no database text is forwarded. *23514 is unreachable today: `user_profiles.email` is NOT NULL, so every account has a name to snapshot.*
    - **Owner name:** `getVersion` and `listVersions` now take it from `project_owner_company_name`. Confirmed locally that a Rare Forms collaborator reads **0** `companies` rows for Building Integrity, so the live routes did show a blank owner. A null or failing helper is an empty name, which the status line shows as "(owner name not available)", never a blank.
    - **UI** (`cloud/useCloudProjects.tsx`, new `cloud/useProjectAccess.tsx`, `cloud/sharingDisplay.ts` for every label, `cloud/cloudMenu.ts`, `TopBar.tsx` inside the Project note only):
      - Open from cloud has a fourth tab, **Shared with us**. A signed-in account with no membership gets Open from cloud with only that tab.
      - Every row in all four tabs has **Access…**; Shared rows add a second line, "Owned by Building Integrity › Proposals · shared with you by Bob", and their **Move to…** has an option group headed "Refile in Building Integrity's folders" with the current folder greyed "(here now)".
      - Project ▾ gains **Sharing…** while a cloud project is open, and the status box gains **Move to…** (same heading). The status line's second line reads "Owned by Building Integrity · shared with you by Bob. You're acting as Rare Forms; saves still go to this project." when the Shared tab listed the project this session; otherwise 2B's wording.
      - Save as new, with another company's project open, adds "This saves a copy, owned by Rare Forms; Building Integrity's project is unchanged."
      - Top bar: unchanged. Measured with no overflow and nothing off-screen at 360, 768 and 1200 for a member, a collaborator, a no-membership account and the widest four-company label.
    - **Judgement calls:**
      - The access list shows rows as two lines ("Frank (person)", then "shared by Bob · Sep 14, 2026") rather than one dash-joined line, with a "you" tag on your own row, and "Names are as they were when each share was made." under the list.
      - The cascade offer lists who the shares went to, and offers only shares the remover could remove that are on screen (a collaborator removing their own grant to Frank is not offered Frank's shares). A creator grant is a personal grant, so it gets the offer too.
      - Status-line Move to… is offered for every open cloud project, owner members included; its heading is true for both.
      - No limit was invented on `alsoRemove`'s length.
    - **Where the plan proved wrong or unfollowable:**
      - **Hand-test step 8 contradicted Open Item 1's pre-ticked offer.** Removing R's grant with the offer left ticked also removes R's share to N, so "As N: it is still shared" fails. Rewritten below: M unticks the offer.
      - **Hand-test step 6 could not be followed:** no screen shows a project id, and the access response names the field `grantId`, not `id`. Rewritten to read both in the console.
      - **Hand-test step 10 could not be followed:** no screen shows another project's version URL. Rewritten so M reads it in the console.
      - **Step 1's "Project ▾ → Sharing…" needs the project open first.** Rewritten.
      - **Decision 13's existing test** ("no DELETE anywhere under `/api/projects`") had to change: the grant DELETE lives there. It now asserts the one DELETE is the grant route, calls `removeGrant`, and touches neither `projects` nor `project_versions`.
    - **Verified:** vitest 1621 passing in 101 files (new: `sharingRouteLogic.test.ts` 40, `sharingDisplay.test.ts` 24; `projectRouteLogic.test.ts` +2 owner-name tests; `cloudMenu.test.ts` +4); `tsc --noEmit` clean; headless Chrome against mocked routes, 28 of 28 checks. **Lint:** `useCloudProjects.tsx` still reports one `react-hooks/set-state-in-effect` error on the list-loading effect. It is pre-existing (HEAD reports the same rule on the same effect) and was left alone rather than changing when lists load.
    - **Only the live test can prove:** PostgREST's real response shapes (the scalar `project_owner_company_name`, the `reached_via` jsonb, a DELETE returning `[]` through RLS); Supabase's own two-factor behaviour on these routes; and every hand-test step below.
- **3C.**
  - Scope: the notice. Files: the share-notices routes and a notice component beside the account control.
  - Acceptance: step 11.
  - Edge case: a company grant made before you joined is not notified.
  - *(As built, 2026-09-20, branch `stage3c-share-notice`; not merged, not deployed.)*
    - **Routes**, both starting from `requireCloudSession()` and the session's JWT-bound client; no admin client; no table read of their own:
      - `GET /api/share-notices` → `pending_share_notices()`, one RPC.
      - `POST /api/share-notices/dismiss` → `dismiss_share_notices()`. **It takes no body**, deliberately: `authenticated` holds no insert or update on `share_notice_state` (confirmed locally), so a browser can only ask for the server's `now()`, never propose a time.
    - **Files:** `cloud/shareNoticeLogic.ts` (the two calls and the SQLSTATE mapping), `cloud/shareNoticeDisplay.ts` (every word, plus grouping), `cloud/shareNoticeCheck.ts` (when the check runs), `cloud/useShareNotice.tsx` (the StickyNote), `cloud/cloudTypes.ts` (three shapes), and three `*.test.ts` files beside the first three. `cloud/useCloudProjects.tsx` renders it and supplies the jump to the Shared tab. **`TopBar.tsx` is untouched.**
    - **WHEN THE CHECK RUNS — exactly three moments, and no polling.** At **page load** (the first `/api/session` answer naming a signed-in person), at **sign-in or any change of signed-in account**, and when a **second factor is completed** (`mfaPending` true → false). Nothing else, and **no timer**: a share is not urgent, the notice stays until Got it, and the Shared tab is the durable signal either way. **The acting-as company is deliberately not an input** to `shareNoticeCheckDecision` — `pending_share_notices()` takes no acting-as parameter — so switching company cannot re-check, which matters because the editor re-reads the session on every switch and after every 401/403. Measured in Chrome: one request per page load, none on a company switch, none while idle.
    - **Never notified:** guests and accounts with two-factor still pending, refused in three places — the client never asks (`shareNoticeCheck`), `requireCloudSession()` answers 401 before any query, and 0004's restrictive policy means the read returns nothing anyway. **Confirmed on local PostgreSQL 17.4:** the same call at aal1 with a verified factor returned 0 rows and at aal2 returned them all; `dismiss_share_notices()` raised 42501 at aal1 and succeeded at aal2; a session with no `auth.uid()` read 0 and could not dismiss.
    - **The notice** names who shared which project, for which owner company, with the date — "M (Building Integrity) shared Project A with you · Sep 20, 2026", or "…with Rare Forms" for a company grant. **Grants are grouped by project**, because one project reached two ways is one piece of news: confirmed locally, where sharing one project with a person *and* with their company really does return two rows with one `project_id`. Several at once are headed "Shared with you: 3 projects". It offers **Open Shared with us** (which does **not** dismiss — the spec is explicit) and **Got it**.
    - **A failed Got it leaves the notice showing**, with Got it still offered and the notices still listed. Nothing is cleared locally on a failure: `seen_through` did not move, so clearing would hide news that was never dismissed.
    - **Where the plan proved wrong, or was not followed:**
      - **The handoff said "a notice component beside the account control"; it was built inside `useCloudProjects` instead.** Both of the notice's actions already live there — Open from cloud's Shared tab is that hook's own state — as do `cloudFetch`, the session and the 401/403 refresh. Beside the account control it would have needed a second copy of all four. Nothing is added to the top bar either way, which is what Stage 2 Open Item 6 actually asks for.
      - **The plan's "[Open Shared with us] [Got it]" is the whole of the offer.** The 3C brief also mentioned "a way to open it", but `pending_share_notices()` returns no `head_version_id`, and a per-project Open would need one. Jumping to the Shared tab, where every row already has Open, was chosen over adding a second query to a notice.
      - **A defect this stage's own Chrome harness caught, not review:** the first version passed the route's message straight to the notice, so an unmapped failure showed `errorResponse`'s deliberately generic **"Something went wrong"** — four words that say neither that it failed nor that the notice was still there. Now `dismissFailureMessage()` uses the route's own words only for the 403 we wrote, and our own sentence otherwise.
    - **The `m.created_at < c.created_at` consequence, worth knowing before the hand test:** a company grant notifies only members who joined **before** it. Because hand-test step 7 removes and re-invites R2, R2's Rare Forms membership is newer than step 7's company grant, so **R2 gets no notice for that project (Project B, shared with Rare Forms in step 7)** while still seeing it in Shared with us. That is the rule working; step 11f says so and gives the way to see R2 notified.
    - **Verified:** vitest **1677 passing in 104 files** (new: `shareNoticeLogic.test.ts` 21, `shareNoticeDisplay.test.ts` 20, `shareNoticeCheck.test.ts` 14); `tsc --noEmit` clean; `eslint` clean on the new files; headless Chrome against mocked routes, **34 of 34 checks**, with screenshots of one notice, several notices, after Got it, a failed dismiss, a guest, two-factor pending, and the top bar at 360/768/1200. One 3B test changed: `sharingRouteLogic.test.ts`'s "add nothing for the notice (3C)" now asserts what it was really guarding — that 3B's logic still never calls the notice RPCs — plus a new assertion that 3C's two routes stay on the session client.
    - **Only the live test can prove:** PostgREST's own response shape for a void RPC (`dismiss_share_notices`) and for a set-returning one through `.rpc()`; Supabase's real two-factor behaviour on these two routes; that a dismissal really does clear a second browser signed in as the same person; and every part of hand-test step 11.
- **3D.**
  - Scope: consortium create. Files: `checkCreateTarget`, the save dialog and the Open note's consortium branch.
  - Acceptance: steps 12–14. The folder tabs acting as Seed through the consortium are unchanged.
  - *(As built, 2026-09-20, branch `stage3d-seed-tree-create`; not merged, not deployed.)*
    - **Four source files, all in `apps/web/app/cloud/`. No route file changed, and no SQL changed** — 0008 already carries the trigger, `grant_creator_access` and the widened `projects_insert`, so 3D is the app catching up with a database that was ready.
      - `projectRouteLogic.ts`: the `source === "consortium"` 403 is **deleted**. Nothing replaced it, deliberately — there is no name check against "The Seed Collaborative" anywhere, because `computeEntitlements` builds the `consortium` source **only** for the single company flagged `isConsortium`, and the entitlement itself came from `loadSession`, which re-verifies it against real rows every request. So the opening is one company wide **structurally**, not by a string.
      - `cloudMenu.ts` / `useCloudProjects.tsx`: `canCreate` is now simply "you are acting as some company". The save dialog's consortium refusal branch is gone, and it shows Open Item 5's line **only** when the acting-as source is `consortium`.
      - `cloudTypes.ts`: `seedTreeCostWarning()` is new, and **`consortiumLaterStageMessage()` lost half its sentence.** It used to say "…there's nothing to list here **and you can't create a project in it yet**". The second clause stopped being true, so it was removed rather than left standing; the folder tabs still carry the first clause, which is what hand-test step 13 reads.
    - **3B's display needed no new case.** `reachText` already answers "you created it" for `via: 'creator'`, and `list_shared_projects` already emits it; one test was added pinning the whole Shared row for a Seed-tree project rather than changing any wording.
    - **The 409 is untouched and still checked first**, so the two-tab refusal fires for a consortium entitlement exactly as before — asserted word for word, since deleting the branch below it could have masked it.
    - **Confirmed on local PostgreSQL 17.4** (own cluster, 0001–0008, one rolled-back transaction; never pointed at Supabase):
      - a seed-entitled **non-member** of Seed creates through `create_project` and the trigger writes **exactly one** grant — `kind = 'creator'`, to the person, `grantee_company_id`, `granted_by` and `granted_by_name` all null — while `projects.company_id` stays Seed's;
      - `list_shared_projects` returns it with `reached_via` = `[{"via": "creator", "created_at": …, "grantee_name": …, "granted_by_name": null}]`, which is the shape `SharedReach` is parsed from, and it is returned under **both** the creator's own company and Seed, because the grant is the person's;
      - saving again, renaming and refiling all succeed through that grant (head reached v3, folder `proposals`);
      - a member creating in their **own** company gets **0** grants, so this never fills their Shared tab;
      - a **non-seed-entitled** account is still refused `42501` for Seed *and* for another company, which is what the route maps to "You can't create a project in that company. Nothing was saved.";
      - another seed-entitled person who was not granted it reads **0** — the Stage 4 line still holds;
      - a Seed member reads the document **including `priceModifier` (1.3)**, which is the fact Open Item 5's warning states.
    - **Where the plan proved wrong, or was not followed:**
      - **The handoff named "the Open note's consortium branch" as a file to change; it must NOT change.** That branch is the folder tabs' Stage 4 message, and 3D deliberately leaves it (only explicitly granted projects stay visible). What actually had to change beside `checkCreateTarget` was `cloudMenu.ts`'s `canCreate`, which the handoff did not mention and which otherwise leaves Save as new cloud project greyed out with the route already willing.
      - **One string asserted two things and had to be split** (above). A wording change was unavoidable; the alternative was a message that contradicted the button next to it.
      - **Hand-test step 12 said "shows the price line"**, which is not a phrase any screen prints. Rewritten to quote Open Item 5's sentence exactly, and split into 12a–12e so the grant's own properties (no notice for your own work; still listed when you act as your own company; rename/refile through the grant) are each checked.
    - **Verified:** vitest **1683 passing in 104 files** (+6: `projectRouteLogic.test.ts` +3 on the consortium create and every still-refused create, `cloudTypes.test.ts` +2 on both wordings, `sharingDisplay.test.ts` +1 on the creator row; `cloudMenu.test.ts` rewritten, not added to); `tsc --noEmit` clean; headless Chrome against mocked routes, **24 of 24 checks**, with screenshots of the save dialog acting as Seed, the same dialog in the person's own company, the created notice, the Shared with us creator row, Seed's unchanged folder tabs, a later save, the row seen from the person's own company, and the top bar at 360/768/1200. **Lint:** the one pre-existing `react-hooks/set-state-in-effect` error on `useCloudProjects.tsx`'s list-loading effect is untouched and still reported, as in 3B and 3C.
    - **Only the live test can prove:** that Supabase's PostgREST really returns `create_project`'s row for a consortium creator now that 0008 dropped `RETURNING` (the local probe calls the function directly, not through PostgREST); Supabase's own two-factor behaviour on the create route; and every part of hand-test steps 12–14.
- **3E.**
  - Scope: granted projects in the company backup. Files: `cloud/backupRouteLogic.ts` (phased cursor), `cloud/companyBackup.ts` (manifest v2, `shared/` paths) and their tests.
  - Acceptance: steps 15–16. A phase-less cursor still works.
  - Edge case: a grant removed mid-backup.
  - Not in scope: personal grants in any backup (pending Open Item 2).
  - *(As built, 2026-09-20, branch `stage3e-granted-backups`; not merged, not deployed, not hand-tested.)*
    - **Files, all in `apps/web/app/cloud/`: `backupRouteLogic.ts` (the phased cursor and the second source), `companyBackup.ts` (manifest v2, `shared/` paths, `pageProjectCount`), `cloudTypes.ts` (the entry and page shapes, plus `consortiumMenuMessage`), `cloudMenu.ts` and `CompanyBackupSection.tsx` (one sentence each), and the four `*.test.ts` beside them. NO ROUTE FILE CHANGED** — `GET /api/companies/[id]/backup` already passed `after` straight through — **and no SQL changed**: 0008 already carries `collaborators` and `project_owner_company_name`.
    - **THE CURSOR IS `<phase>:<project id>:<version number>`, and a phase-less cursor reads as `owned`.** Versions are ordered by **(phase, project id, version number)**, the whole owned phase before the whole granted one. **It cannot skip or duplicate** because every resumption is "the next version after this one in that order" and each step is strictly forward: versions `.gt(version_number)` inside the cursor's project, then projects `.gt(id)` inside its phase, then the next phase from its start. The cursor carries **the last entry's own phase**, so a page that crosses the seam resumes on the right side of it. A 2D cursor arriving mid-backup still works, so a backup in flight survives the deploy.
    - **A project that is both owned and granted appears once, in the owned phase.** The granted walk skips any project whose `company_id` is the backing-up company, tested on the row the database returned, so every page gives the same answer. It cannot arise today (`share_project_with_company` refuses `owner-company`), but a duplicate file in a backup is worse than a wasted read.
    - **A resumed `granted:` cursor checks the grant BEFORE reading the project.** `after` is client input, and RLS lets a platform admin read every project, so without that check a platform admin acting as one company could name any project id and have the route page out its versions — more than that company could export by hand (decision 29). Confirmed locally: the check finds 0 grant rows for an unshared project that the same platform admin can otherwise read.
    - **Counts.** The page keeps `projectCount` (owned) and gains `grantedProjectCount`, both first-page-only; the progress line adds them. In the manifest, `projectCount` is **every** project in the backup and `grantedProjectCount` the granted subset. *(The plan did not say what `projectCount` should mean once there are two sources.)* The page's granted count comes from the grant rows, so it is an upper bound if a grant is revoked mid-backup — the same way the owned count already was for a project deleted mid-backup.
    - **Files and manifest.** `shared/<owner-slug>/<name-slug>--<project-id>/v0007--….json`, `formatVersion` 2, granted entries carrying `ownership: "granted"` and `ownerCompany: { id, name }`. **Owned entries are unchanged, down to having no `ownerCompany` key at all.** The owner's name comes from `project_owner_company_name`, never a `companies` read; an unreadable one is an **empty name** and an "untitled" folder, never a substituted company. Three notes are added: what is included, that a personal share is not, and that **removing a share later does not reach a backup already taken** (23's honest limit).
    - **⚠ The plan did not mention what `shared/` does to Windows' MAX_PATH.** With a 60-character owner slug the worst extracted path is **285** characters, over the 260 limit. The owner slug therefore reuses the existing **30-character company cap** (the same reason the zip's own name has one), giving **255**. No new number was invented, and the arithmetic is in the code and in a test.
      - **The 255 assumes `C:\Users\Tommy\Downloads\` (3E review).** A OneDrive-redirected Downloads folder adds roughly 9 characters, putting the worst case near **264** — back over the limit. Recorded rather than fixed: shortening the caps again would cost readable folder names for a case no one has hit.
    - **⚠ A grant that changes mid-backup (3E review).** A grant **added** while a backup is running is not included if its project id sorts before the granted phase's current position — the same "as of when the phase passed it" rule a save on an already-passed project follows. A grant **revoked** partway through its own project is worse than it looks: the resume finds no grant and advances, leaving versions 1..n of a project whose head is higher, which the completeness check turns into a **hard failure with no file at all**. That is the safe direction — never a silently short backup — but it is surprising, so it is written down here rather than discovered.
    - **Confirmed on local PostgreSQL 17.4** (own cluster on port 54394, 0001–0008, one rolled-back transaction; never pointed at Supabase): the granted enumeration `where grantee_company_id = <company> order by project_id` returns exactly the company-shared project and **not** the personally-shared one; **a personal grant is the two facts side by side** — the person reads the project (1 row) while the company backup's own query finds **0**; the grantee company's member reads the project row and both its versions **by id with no company filter**, through the grant; `project_owner_company_name` returns "Building Integrity" while that member's `companies` read returns **0 rows**, which is why the helper is load-bearing; a platform admin sees **2** grants and **3** projects unfiltered against **1** and **0** filtered, which is why both `.eq()`s are load-bearing; and after the grant is deleted the same member reads **0** grants, **0** project rows and **0** version rows, which is the grant-removed-mid-backup case.
    - **The 3D review's can-wait wording fix is folded in.** `cloudMenu`'s consortium line is now its own sentence (`consortiumMenuMessage`), ending "projects shared with you, and ones you create here, are in Shared with us", because "there's nothing to list here" sat directly above **Open from cloud…** and had been false since 3D. **The folder-tab message (`consortiumLaterStageMessage`) is deliberately unchanged** — hand-test step 13 reads it — and a test pins the two apart.
    - **Verified:** vitest **1704 passing in 104 files** (+21: `backupRouteLogic.test.ts` +11 on the two-source walk, `companyBackup.test.ts` +7 on the manifest and paths, `cloudTypes.test.ts` +1, `cloudMenu.test.ts` +1, plus the 2D fixtures updated); `tsc --noEmit` clean; headless Chrome against mocked routes, **22 of 22 checks**, which assembled a real zip from paged responses carrying both sources and unzipped it in Node — `shared/rare-forms/…` and `shared/new-frameworks/…` beside `projects/current/…`, `formatVersion` 2, `projectCount` 4 with `grantedProjectCount` 2, every SHA-256 matching, a **shared** file reopened with plain Load Project, the phased cursors visible on the wire (`?after=owned%3A…` then `?after=granted%3A…`), Cancel and a failing page each producing no file, and the top bar unchanged at 360/768/1200.
    - **Only the live test can prove:** PostgREST's own response shapes for the two `collaborators` reads and for the scalar `project_owner_company_name` **inside this route**; whether Supabase's `max_rows` ever truncates the one-row grant reads (they are `.limit(1)`, so it should not); and every part of hand-test steps 15–16.

**The coder re-runs the 6-point flags check against each diff.**

#### Not in scope for Stage 3

- **Access requests (`collab_requests`)**, which move to Stage 4 (answer 6).
- Browsing, the redactor and export restrictions (Stage 4).
- The people/activity page and promote-to-admin (answer 15). They follow Stage 3 directly; see the Backend Open Items.
- Email or any other notification channel (7).
- Sharing with an address that has no account (12).
- A view-only tier (4).
- Leaving a share yourself, as a recipient. Only owner members and the person who shared can remove a grant (13). A recipient who wants out asks either of them.
- Showing each version author's company in version history. `author_name` alone is recorded, as in Stage 2.
- Transferring ownership between companies.

#### Open Items — Stage 3 (Tommy's decisions; each has a recommended default)

**Answered by Tommy 2026-09-14: all eight defaults accepted.** Asked directly: item 1 ("Offer to remove them too", pre-ticked), item 2 ("The owner's backup only"), item 5 ("Yes, a one-line warning"); items 3, 4, 6, 7 and 8 accepted together as written. Each item below is now a decision; the ⚠ marks stay only so the reasoning is findable.

1. **⚠ When a grant is removed, do the grants that person made go with it?** Example: Bob shares with Frank, Frank shares with Nick, and Bob removes Frank. **Default: Nick keeps access.** The list keeps "shared by Frank" on those rows. Removing **a personal grant** offers "Also remove the 1 share Frank made", **pre-ticked**. Removing **a company grant** offers nothing further, because `granted_by` records a person, not the company they acted through. The alternative, cascading automatically, is stricter but silently removes people the remover never saw.
2. **⚠ Personal grants, including creator grants, and backups.** A share with Frank personally is in no company's backup. **Default: excluded.** The person can still download each version, and a company backup stays a company's. The consequence: a Building Integrity designer's Seed-tree project is in Seed's backup, not Building Integrity's.
3. **Who sees the access list?** **Default: everyone who can open the project.** Rare Forms can therefore see that New Frameworks also has it. The alternative, owner members only, hides from collaborators the grants they could remove.
4. **Which companies appear in the share picker?** **Default: consortium member companies (`is_seed_member`) only.** A non-member company ("neither sees nor is seen") is reachable by sharing with a person's email. No non-member company exists today. **Revisit before onboarding a non-member company (3A review):** as built, `shareable_companies()` answers any signed-in account, so a non-member company's members see the consortium's company names and can share their own projects into a consortium company. No one else's work leaks, but it is not "neither sees" either.
5. **⚠ Creating in Seed's tree hands your price modifier to Seed's members.** **Default: one line in the create dialog**: "Owned by The Seed Collaborative: its members will see this design's costs." No redaction, since it is Seed's project by decision.
6. **⚠ Conflict with the permission matrix.** The "Invited collaborator" row says **Move between folders: no** and **Grant collaborators: no**. Answers 11 and 10 say yes. **Default: the answers win**, because they are newer and were explicitly chosen over the alternatives. The matrix row is corrected when this plan is approved, and it was not edited silently.
7. **Re-sharing has no limit.** **Default: none, as chosen.** Recorded mitigation, not built: a per-project "only the owner company can share this" switch. **Revisit trigger:** the first time an owner finds a grant on their list they did not expect.
8. **Sharing by email reveals whether an address has an account**, to anyone who can share a project. **Default: say so plainly** ("No account uses that email"). Answer 12 needs the sharer to know this, and membership is already the trust boundary (15). **Also revealed (3A review):** the `already-member` answer tells anyone who can share the project, a collaborator from another company included, that the address belongs to a member of the owner company. And a name snapshot falls back to the email when an account has no display name, so the access list can show a collaborator's email address to everyone who can open the project.

#### Flags check: re-run against 4C's own diff, 2026-09-24 — clean

*(The coder's re-run against what was actually written, as the handoff requires. 4B's re-run is above and unchanged.)*

1. **Clean.** `packages/` is untouched — `git diff --stat` on it is empty. The only numerals the diff adds are **HTTP statuses** (200, 201, 400, 403, 404, 409), **SQLSTATEs** (42501, 22023, 23514, 22P02, PGRST116), the **500-character request-note cap** and the number **501** in the sentence that refuses it, the migration number **0009**, and uuids and timestamps in test fixtures. **None is a building figure, and 4C adds no dollar figure of any kind** — it is the one part of Stage 4 that touches no money field at all.
2. **Clean.** Nothing is marked `confirmed`; nothing real-world was added to mark.
3. **Clean.** Every note added traces to a named source — a decision number (20, 23, 24), a Stage 4 Open Item (2, 3, 4), a Stage 3 answer (6, 7, 10), "Two narrowings" item 4, a constraint or a function signature **read off local PostgreSQL 17.4** rather than off the migration, or a line of 0009 quoted by name.
4. **Clean.** No structural figure is in scope.
5. **Clean, and deliberately so. Nothing new reaches the Review Log.** An access request is administrative; a line saying "somebody at another company asked to see this" on a printed engineering sheet would be both wrong and a small leak about who is looking at whose work.
6. **Clean, and this is where 4C has to be careful rather than lucky.**
   - **Nothing pending is treated as settled.** The two Open Items 4C rests on — **3** (requests are personal only) and **4** (a decline carries no reason) — are both **answered by Tommy**, and the build follows them exactly: there is no company-request control anywhere, and there is **no reason box anywhere on the decline path**, so there is nothing recorded for the requester's list to show. The requester's list says "No reason is recorded" rather than leaving a silence that reads like a missing feature.
   - **A visible gap beats a plausible substitute, in three places.** A project that has **left the browse set** is shown as *"a project you can no longer browse"* rather than named from a wider read; the database's own over-length refusal (`22023`) names **no character count**, because at that point the count is not in hand and stating one would invent it; and a request row whose `status` is not one of the three is **dropped** rather than rendered as something made up.
   - **`decided_by` is withheld rather than reasoned about.** 4A's review named it in advance as the thing 4C would forward without thinking. It is absent from the shapes, absent from the column lists (which are explicit, never `select("*")`), dropped by the mapping even when a reply carries it anyway, and asserted absent from the **rendered page** by a browser check whose mock deliberately includes one.
   - **No wording claims the app prevents anything.** 4C's strings live in `browseDisplay.ts`, whose banned-phrasing test scans **every string literal in the file**, so they were covered the moment they were written; the explicit list was extended too. Nothing about a request implies a guarantee: "A member of theirs decides", and the answer appears in the app "or nowhere", because there is no email.

#### Flags check: clean, confirmed against the plan rather than assumed

1–4. **Clean.** No real-world building number is introduced: no fastener spacing, load, density, dimension or cost figure. No `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is in scope, and `data.ts` is not touched.

5. **Clean.** Nothing new reaches the Review Log.

6. **Clean.**
   - The one money-shaped field, `priceModifier`, moves only inside whole documents, to people who hold an explicit grant (24). No redaction is claimed that does not exist.
   - **No new number at all**, administrative or otherwise. Backup page sizes and name limits are Stage 2's, unchanged.
   - The plan leans on the convention's own principle:
     - "shared by Frank" kept on the rows he made, rather than a vanished attribution;
     - `no-account` rather than a silent no-op;
     - names snapshotted and labelled "as shared" rather than a blank.
   - *(3A, re-run against its diff, 2026-09-14: clean.)* Only `supabase/` files changed. No building value, `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is touched, `data.ts` is untouched, and nothing reaches the Review Log. The only numbers in 0008 are SQLSTATEs, migration numbers and decision references. The fixture documents carry the app's existing default `priceModifier`, as Stage 2's did.
   - *(3B, re-run against its diff, 2026-09-15: clean.)* Only `apps/web/app/cloud/**`, `apps/web/app/api/projects/**`, `apps/web/app/api/companies/shareable`, `TopBar.tsx`/`.module.css` and this spec changed. No building value, `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is touched; `data.ts`, `packages/**` and the Review Log are untouched. **No new number of any kind:** the only numerals are HTTP statuses and SQLSTATEs, and no length cap was invented for `alsoRemove`. `priceModifier` moves only inside whole documents the database already serves to a grant holder (24); the Save-as-new copy line says so rather than implying a redaction.
   - *(3C, re-run against its diff, 2026-09-20: clean.)* Only `apps/web/app/cloud/**`, the new `apps/web/app/api/share-notices/**` and this spec changed. No building value, `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is touched; `data.ts`, `packages/**`, `TopBar.tsx` and the Review Log are untouched. **No new number of any kind:** the only numerals are HTTP statuses (401/403/500) and a `cascadeIndex` of 0, which is a layout position already used by the tree and the history note. The notice carries **no cost field at all** — `pending_share_notices()` returns names, a project name and a time, and never `document` — so nothing here widens what a collaborator can see. The convention's own principle is kept: a missing sharer name reads "someone", a missing owner "(owner name not available)", an unnamed project "(untitled)", and a failed dismiss says the notice is still there rather than showing a bare "Something went wrong".
   - *(3D, re-run against its diff, 2026-09-20: clean.)* Only `apps/web/app/cloud/**` and this spec changed. No building value, `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is touched; `data.ts`, `packages/**`, `TopBar.tsx` and the Review Log are untouched, and no route file changed. **No new number of any kind:** the only numerals in the diff are the HTTP statuses `checkCreateTarget` already used (403, 409). **The one money-shaped thing this stage touches is said out loud rather than hidden:** a design created in Seed's tree carries the creator's own `priceModifier` into a project Seed owns, so the dialog's single new line tells the person that Seed's members will see its costs. It claims no redaction, because none exists. The convention's principle is kept in the other direction too — the consortium folder message **lost** the half that had stopped being true ("and you can't create a project in it yet") instead of being left to assert something the code no longer does.
   - *(3E, re-run against its diff, 2026-09-20: clean.)* Only `apps/web/app/cloud/**` and this spec changed. No building value, `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is touched; `data.ts`, `packages/**`, `TopBar.tsx` and the Review Log are untouched, and no route or SQL file changed. **No new number of any kind:** `BACKUP_MANIFEST_FORMAT_VERSION` moves 1 → 2, and the `shared/` owner slug **reuses** the existing 30-character company cap rather than inventing a second limit — the 260-character arithmetic that forced it is written out in the code and pinned by a test. No cost field moves anywhere new: a granted project's document was already served in full to the grantee company by RLS (24), and the backup adds no field to it. The convention's principle is kept in three places — an owner company whose name cannot be read is an **empty name and an "untitled" folder**, never a substituted company; the manifest says plainly that a personal share is **not** in a company backup rather than leaving its absence to be discovered; and it says that **a backup already taken cannot be recalled**, which is the honest limit rather than an implied guarantee.

### Stage 4 plan — Consortium browsing (2026-09-20) — APPROVED BY TOMMY 2026-09-20 (all seven Open Items answered) — **4A BUILT 2026-09-21 on branch `stage4a-browsing-schema` (migration `0009_stage4_browsing.sql`, `stage4_rls.test.sql`, README Stage 4 section); REVIEWED 2026-09-21 (verdict: ship), NARROWED 2026-09-23 on Tommy's decisions (save notes and email-shaped author names are not served while browsing); **APPLIED TO LIVE 2026-09-24.** Tommy pasted it from his phone against a trimmed check set agreed with him — the counts before (4 companies / 6 memberships / 6 projects / 19 versions / 4 grants, every version on format 24) matched exactly afterwards with `collab_requests 0`; privileges came back as expected (`browse_schema_redaction` unreadable by every client role, `collab_requests` select-only); and **post-flight (I), the redactor run over his 19 real saved documents, returned `still_carrying_price 0` and `marked 19`** — the guarantee proven on live data rather than fixtures. The policy, trigger and function-count checks were skipped by agreement, having been verified exactly on the local run. *(A `.sql` file would not open on his phone; a byte-identical `.txt` copy did.)* — **4B BUILT 2026-09-24 on branch `stage4b-browsing-ui`: the fifth tab, the redacted read, the price gap and the export restrictions, app code only. REVIEWED 2026-09-24 — verdict SHIP, no must-fix defect: the review attacked every nominated path and found none reaching an owner's costs or an unredacted document. Two contradictions in the PLAN were surfaced and settled — what `full` means on a browse row (Tommy: keep both doors and say so, 2026-09-24) and who gets the tab (the plan's sentence was stale; step 25 and the build were right, and the plan is corrected). Not merged, not deployed.** — **4C BUILT 2026-09-24 on branch `stage4c-access-requests`: access requests end to end — Ask for access from a browsed row and from the banner, the owner company's Grant and Decline inside the EXISTING Access… note, and the requester's own list of pending / granted / declined. App code only; 0009 was already live. 1960 vitest in 109 files, tsc clean, 42 of 42 headless-Chrome checks with 0 console errors, and the Stage 4 RLS suite re-run unchanged on local PostgreSQL 17.4. A granted request becomes an ORDINARY STAGE 3 GRANT — `decide_collab_request` writes it with `share_project_with_person` inside the database, and no app code writes a `collaborators` row at all. `decided_by` is withheld in four places (no field, no column, no mapping, and asserted absent from the rendered page). **REVIEWED 2026-09-24 — verdict SHIP WITH ONE SMALL FIX**, which is applied: the banner over a browsed design offered **Ask for access on a project the viewer can already open in full**, because a `full` row reaches that banner through **Versions** and the code claimed it could not. Harmless to send — `already-has-access` writes nothing — but a wrong offer; the row's `access` is now carried into `BrowseContext` and the banner is gated on it. The `self` decision wording, which described `already-member`'s situation, is corrected too. Not merged, not deployed. See "4C as built" (records 15 and 16) and hand-test steps 36–45.**

Provenance: Tommy asked to start Stage 4 on 2026-09-20, immediately after 3E went live. **He reviews this plan and decides its Open Items before any code is written**, exactly as for Stages 2 and 3. The plan was written against what is actually live, read directly rather than assumed: `supabase/migrations/0001`–`0008`, `supabase/README.md`, `apps/web/app/api/**`, `apps/web/app/cloud/**`, `apps/web/app/auth/{actingAs,serverSession}.ts`, and `apps/web/app/projectFile.ts` at **`PROJECT_FILE_VERSION = 24`**.

**Nothing decided above is reopened.** Four places where a decision collides with the live code are marked ⚠ and listed in this plan's Open Items; none is settled quietly.

**Sequencing warning, concrete and dated — and how it was settled.** Stage 3's hand-test steps **11–16 were still outstanding** when 4B was built (3C, 3D and 3E were deployed without them at Tommy's choice; he walked 11a–11d on 2026-09-15 and judged the rest by using the app). Step 13 read `consortiumLaterStageMessage` word for word, and 4B replaces that string because it finally stops being true. **The choice was "run the batch first, or rewrite step 13"; the second was taken.** Step 13 is rewritten in 4B's own hand-test batch below, as 13a/13b/13c, and the Stage 3 copy is struck through and points at it. Two of 3D's steps (12b and 14) read the same replaced string and carry 4B notes. The Stage 4 steps are numbered from 17 so the whole batch can still be driven in one sitting.

#### 4A as built (2026-09-21) — and where the plan proved wrong

**What `0009_stage4_browsing.sql` does.** The file name is the plan's own (`0009_stage4_browsing.sql`). It creates `browse_schema_redaction` (one row: `24 → [["state","priceModifier"]]`, no privilege for any client role), the internal redactor `browse_redact` (no client role may call it), the internal author-name mask `browse_author_name` (likewise), the four browse functions `browse_companies`, `browse_projects`, `browse_versions` and `browse_version`, and `collab_requests` with `request_project_access` and `decide_collab_request`. It replaces exactly one Stage 3 object, `shareable_companies` (answer 5). **`can_read_project`, `can_write_project`, `holds_project_grant`, `projects_select` and `project_versions_select` are untouched**, and three things prove it: a whitespace-normalised fingerprint in the suite, the README's pre-flight (e) and post-flight (F), and a whole-schema dump diff in which `shareable_companies` is the only changed pre-existing object. Local verification: every earlier suite and both concurrency scripts still pass unchanged, **44 of 45 mutation checks each fail a named assertion** (the 45th is a measured no-op — see "Two narrowings", item 5), a copy broken before `commit;` leaves nothing behind, and a second run changes nothing. The details are in `supabase/README.md`, "Stage 4".

**Where the plan proved wrong or needed a decision. Suggested wording is given for each.**

1. **Test 3 as written cannot pass.** It asks that `document::text` not contain `priceModifier` **and** that the marker name `state.priceModifier`. But the marker is inside the document (answer 1), so its own `removedPaths` value contains that text. As built, the test asserts four things instead:
   - no **key** named `priceModifier` at any depth;
   - no `priceModifier` text **outside the `redaction` marker**;
   - the modifier's **value** appears nowhere;
   - the marker names `state.priceModifier`.

   *Suggested wording for test 3:* "returns a document with no key named `priceModifier` at any depth, whose text outside the `redaction` marker does not contain `priceModifier`, and in which the modifier's value does not appear."

   Hand-test 19's console line had the same flaw: `JSON.stringify(d.document).includes('priceModifier')` would print `true`. **Corrected in step 19 on 2026-09-23**, along with test 3's wording and 4B's vitest (d) — the replacement is live in those places, so do not apply it again from here.
2. **The version list while browsing needed a function the plan did not name.** The plan describes it ("number, Saved/Renamed to…, author, date, label") but lists no function, and RLS gives a browser nothing. **`browse_versions(project)`** was added. It returns Stage 2C's list columns plus `redaction_known` and the name each version was saved under. Without it, 4B would need its own migration. **Since 2026-09-23 two of those columns are narrowed** — the label is always `null` and an email-shaped author name is masked — see "Two narrowings" below.
3. **Platform admins count as seed-entitled** in every browse function and in the tightened `shareable_companies()`. This follows the matrix ("Platform admin: Browse: yes", rows marked `full`). Answer 5 says "seed-entitled callers", and read literally that would have taken the share picker away from a platform admin with no consortium membership.
4. **`share_project_with_company` is deliberately left untightened. DECIDED BY TOMMY 2026-09-23: accept it as written — no code change.** The rule for 4A is that Stage 1–3 objects stay identical except those the plan names. So a non-member company's member who holds a grant (carol, in the Stage 3 suite) can still share that project with a consortium company if she knows its id, and the difference between the answers `not-shareable` and `shared` tells her whether an id belongs to a consortium company. He was shown the implications before deciding, and the reasoning is recorded because it is what makes this safe rather than merely convenient:
   - **She cannot list the ids.** `shareable_companies()` returns a non-member nothing at all now (Open Item 5, applied in 0009), and `browse_companies()` never answered her. There is no enumeration left.
   - **The only consortium company ids she could hold are ones she has already been shown** — on the access list of a project shared *with* her, which **Stage 3's Open Item 3 already accepted**. This adds no new id to anyone's hands.
   - **What leaks is one yes/no about an id she already has**, with no project, no company name and no cost behind it.
   - **Tightening would carve an exception into Stage 3 answer 10**, where Tommy chose that collaborators may share onward. A consultant could then pass a project to a *person* but not to a co-op *company*, which is the opposite of what that answer is for.

   Recorded as settled, not pending. If it is ever reopened, it belongs with Stage 3 answer 10, not with the redactor.
5. **Some refusals are statuses, not errors.** This follows Stage 3's convention that answers are statuses. A second pending request returns **`already-pending`**, naming the first, and writes nothing. Asking about a project you can already read returns **`already-has-access`**. `decide_collab_request` returns `share_project_with_person`'s own status: `shared`, `already-shared` (a grant arrived from elsewhere first), `already-member` or `self` (the requester has since joined the owner company). In all four the request is closed as `granted`. The other statuses are `declined` and, for a repeat decision, `already-granted` or `already-declined`. *Suggested wording for test 6:* "A second pending request from frank answers `already-pending` and writes nothing."
6. **A refusal to serve is SQLSTATE `0A000`**, kept distinct from 42501 ("not found, or you cannot browse it"). It covers an unclassified format, a document whose own `schemaVersion` disagrees with its recorded one, and a cost field that survived redaction.
7. **An added belt, recorded because it is beyond the plan.** Besides the per-version classification, the redactor refuses any document in which **a key named `priceModifier` survives anywhere**. So if a future format moves the modifier and nobody updates the classification, the document is refused, not served with the margin. The suite proves the belt on its own; mutation 13 removes both layers and fails the margin assertion by name.
8. **Format 23 is not classified**, exactly as the plan seeds it. A format-23 version is therefore refused on the browse path, even though the app still opens format 23 itself. Hand-test 21 already expects a "cannot be shown" row. The README's pre-flight (d) shows whether live has any such versions. Classifying 23 would take one reviewed row, after checking v23's `ProjectState` in git history.
9. **A test gap, found by mutation and closed.** A decline writes no grant, so `share_project_with_person`'s own two-factor check never runs for it. `decide_collab_request`'s own check is the only gate. The first draft of test 7 tried only a grant at aal1, so removing that check went unnoticed. Test 7 now also declines at aal1.
10. **"Every function frank can call" (test 3, last bullet) is implemented as a pinned inventory.** The suite fixes the exact set of functions `authenticated` can execute, and the subset that returns JSON (`browse_version`, `list_shared_projects`). A new callable function fails the suite by name until someone classifies it. The count then covers RLS, every browsable version and every classified format.

#### 4B as built (2026-09-24) — and where the plan proved wrong

**Branch `stage4b-browsing-ui`. No migration, no SQL change of any kind: 0009 was already live.** `tsc --noEmit` clean, **1876 vitest tests across 108 files**, and a headless-Chrome run against mocked routes (own port, own profile) with **38 checks, 0 failures and 0 console errors**.

**What shipped, against the plan's own file list.** New: `app/api/browse/{companies,projects}/**` (four GET routes, and only GET); `cloud/browseRouteLogic.ts` + test; `cloud/browseDisplay.ts` + test; `cloud/redaction.ts` + test; `app/BrowseModeContext.tsx`. Changed: `cloud/cloudTypes.ts` (the browse shapes; both consortium messages replaced), `cloud/cloudMenu.ts`, `cloud/documentSession.ts` (`browseContext`), `cloud/useCloudProjects.tsx` (the fifth tab, the browse open, the browse version list, the banner), `app/projectFile.ts` (`parseRedactedProjectFile`), `page.tsx`, `ProjectSummaryPage.tsx`, `TopBar.tsx`, `Building3DView.tsx`, `StandardPanel3DView.tsx`, `auth/actingAs.ts`.

**Where the plan proved wrong, needed a decision, or went further than it said.**

1. **⚠ THE PLAN CONTRADICTS ITSELF ABOUT WHAT `full` MEANS, and the contradiction is exactly hand-test 18.** Open Item 2 (answered) says a `full` row "opens through the Stage 2 route with costs". Open Item 7 (answered) says "your own company's projects are redacted while you act as Seed", and step 18 says to open one "from the browse tab anyway: **it shows `—`**". Both cannot be true of one button. **`can_read_project` is membership-based, not acting-as-based** (read from 0006/0008, not assumed), so a Building Integrity member acting as Seed gets `access = 'full'` on Building Integrity's own projects and the two answers collide on precisely that row.
   **Resolved so that both answers are kept, and neither is quietly dropped:** the browse row's **Open** honours Open Item 2 and goes through the Stage 2 route with costs; the same row's **Versions** → **Open** goes through `browse_version`, which always redacts for every caller — so the same project, from the same tab, is `—` there. That is also the only reading under which step 18's two sentences are both literally true ("its rows … open with the price" / "open one from the browse tab **anyway**: it shows `—`"). **Hand-test 18 walks both buttons.**
   **DECIDED BY TOMMY 2026-09-24, after 4B's review: keep both doors, and say so.** He was shown that both are defensible, that **neither leaks** (the review attacked every path and found none reaching an owner's costs that should not carry them), and that **the risk was confusion rather than exposure**. So the fix is a sentence, not a branch: the browse version list carries a **second line on a `full` row only** — *"Versions here always come with costs removed, even on a project you can open in full. Open the project itself to see it with its costs."* It is deliberately absent on a `redacted` row, where there is no second door and the sentence would be a puzzle. Recorded beside Open Items 2 and 7, and pinned in `browseDisplay.test.ts` both ways round.
2. **The plan contradicted its own hand test about who gets the tab — and THE PLAN WAS WRONG. Fixed in the plan 2026-09-24.** "What browsing shows" said the tab appears while "the acting-as entitlement is the consortium one, **or the acting-as company is a member company**"; hand-test 25 says a Rare Forms member acting as **Rare Forms** gets **no tab at all**, and Rare Forms *is* a member company. 4B implemented step 25's narrower reading — the tab appears only when **the company you are acting as IS the Seed Collaborative** — and **4B's review confirmed that is correct and the plan's sentence was the stale thing**. The bullet in "What browsing shows" has been corrected rather than left to mislead the next reader. It needed a field the plan did not name, **`Entitlement.isConsortium`**, because a real Seed *member* acts as Seed through `membership` and `computeEntitlements` deliberately adds no second `consortium` entry for a company already held — without it the permission matrix's two Seed rows collapse into one. Carried from `companies.is_consortium`, which was already being read. **It grants nothing:** the review traced all 13 of its usages and found exactly one that gates anything (`useCloudProjects.tsx`, the tab itself), and every browse function checks `is_seed_entitled()` for itself in the database.
3. **The banner cannot be a strip, and a screenshot is what proved it.** The plan says "the browse banner" without placing it. The first build put it in flow between `TopBar` and `main` — and a headless screenshot at 1200 showed it **underneath the top bar**: `.bar` is `position: fixed` and `.main` is a fixed layer pinned below it, so there is no flow position there at all. Reserving height would have meant measuring a strip whose height changes with wrapping and moving `.main`, `SectionCarousel` and every StickyNote's spawn point with it. **It is a `StickyNote` instead** — this app's own idiom for exactly this, fitting every width by construction. **The wording is not only in the note:** the same three sentences are on the **Project ▾ status line** for as long as the browsed design is on screen, so dismissing the note does not dismiss the statement. *(Nothing new went on the top bar; the bar was measured at 360, 768 and 1200 in both acting-as states and its controls are identical.)*
4. **`browseContext` deliberately SURVIVES an account change, unlike `cloudContext`.** The plan pairs them ("`cloudContext` must be null while browsing, and a new `browseContext` set instead") without saying what an account change does. They are not the same kind of fact: `cloudContext` is a save target the new account may have no right to, while `browseContext` describes **the design still on screen** — whose it is, and that its costs were removed before it was sent. Clearing it would drop the price gate while the redacted design is still drawn, which is the one thing this stage must not do. Asserted in `documentSession.test.ts`.
5. **The redacted parse path refuses more than the plan asked.** The plan says it "accepts exactly the paths the marker names as missing". As built it also refuses: a document with **no marker at all** (a browsed document always has one, so its absence is a fault, and it is never retried through `parseProjectFile`); a marker whose `schemaVersion` disagrees with the document's; a marker naming a path the money classification does not recognise (**a forged marker cannot be used to open a document with a hole in the DESIGN**); and a document in which a money field the marker says was removed is **still present** — the server's own account of what it sent being wrong is not a reason to show another company's markup. Each has its own test.
6. **`0A000` is answered as HTTP 422, and the choice is deliberate.** Not 404, which reads as "try somewhere else"; not 500, which reads as "a bug, retry". The message names no other route, and `browseRouteLogic.test.ts` asserts that **no second call follows a refusal** — the Stage 2 read would hand over the untouched stored document. The three SQLSTATEs were confirmed by running the refusals on a local PostgreSQL 17.4 cluster with 0001–0009 applied, not read off the migration and hoped for.
7. **The label is dropped twice.** `browse_versions` returns `null::text` for it (the 2026-09-23 narrowing) **and** `browseRouteLogic.ts` pins the response field to `null` rather than copying the column through, so a future edit to the function cannot start a save note flowing to another company through a route that merely passed it along. `browse_version`'s label is not read out of the row at all and has no field on the response.
8. **The `(d)` vitest fixture is a real `browse_redact` output**, captured from the local cluster, rather than a hand-written imitation of one — so the assertion that no key named `priceModifier` survives at any depth is made against what the database actually produces.
9. **A compile-time check beyond the plan's three layers:** `ProjectState[MoneyStateKey] extends number` is asserted in the type system, because `NaN` is how the redacted parse path poisons a money field and `NaN` is not a usable gap for a string. A money field of another type will fail the build and force its own decision about what its gap looks like.
10. **`Save as new cloud project…` is gone while browsing, and so is `Save Project`; `Load Project` STAYS.** Load replaces the browsed design with your own work — it is the way *out* of browsing, not a way around it, and removing it would strand somebody on a read-only design. Recorded because the plan's control table lists what goes and not what stays.
11. **Format 23's refusal is visible in two places, not one.** The plan puts it on the version row. It is also on the **project row**, because `browse_projects` returns `head_redaction_known` and a row whose head cannot be shown should not offer an Open that is certain to fail. Neither place offers a download of any kind.
12. **4C's surfaces are not built, as planned.** `collab_requests`, `request_project_access` and `decide_collab_request` are live in the database and unreferenced by the app. There is no **Ask for access** button anywhere yet, so hand-test steps 22–23 belong to 4C.
13. **The print surface is now WATCHED, not reasoned about** (2026-09-24, after the review, which had deliberately left it unchecked). The harness marks the Project Summary sheet for print exactly as the Print button does, switches Chrome to `@media print`, and reads the printed text: **0 dollar figures, no `NaN`, the gap and its reason present, the title block present.** The control — the same sheet, same print media, on the viewer's own design — **does** print a price, so the check is a real gate rather than one passing for want of a number. *A first attempt byte-scanned the produced PDF and "found" ten dollar figures on a browsed project; every one was inside a FlateDecode stream, because Chrome writes printed text as glyph indices into subsetted fonts. The PDF is kept as an artefact and is not what is asserted on. Recorded so nobody repeats the byte scan and trusts it.*
14. **⚠ NOT A DEFECT, NOT FIXED, AND WORTH TOMMY'S EYE: the printed title block on a browsed sheet reads "Building Integrity".** It is a **hardcoded wordmark** in `SheetTitleBlock.tsx` — the app's own branding, on every sheet for every company since long before this stage — not the acting-as company and not a claim of ownership. But a printed sheet of *Rare Forms'* design carrying Building Integrity's wordmark is a thing a co-op member might hand to a client. **Out of 4B's scope** (it would change every sheet in the app, for everyone, and the plan named only the title-block *date* as a browse concern), so it is flagged rather than guessed at. If it should become the owner's name — or the app's neutral name — that is its own small pass.

#### 4C as built (2026-09-24) — and where the plan proved wrong

**Branch `stage4c-access-requests`. No migration and no SQL change of any kind: `0009` was already live (applied 2026-09-24).** `tsc --noEmit` clean, **1960 vitest tests across 109 files**, and a headless-Chrome run against mocked routes (own port 3272, own CDP port 9602, own profile) with **42 checks, 0 failures and 0 console errors** — the last three added by the review fix, and that gate is **mutation-checked**: putting the ungated banner back fails check I4b by name. The Stage 4 RLS suite was re-run unchanged on a local PostgreSQL 17.4 cluster of this pass's own (port 54432, own data dir) and still reports ALL ASSERTIONS PASSED.

**What shipped.** New: `app/api/projects/[id]/access-requests/route.ts` (POST, asking); `app/api/access-requests/route.ts` (GET, the requester's own list); `app/api/access-requests/[id]/route.ts` (POST, the decision); `cloud/accessRequestRouteLogic.ts` + test. Changed: `cloud/cloudTypes.ts` (the request shapes, and `requests` on `ProjectAccessResponse`), `cloud/browseDisplay.ts` + test (all of 4C's wording), `cloud/sharingRouteLogic.ts` (the pending rows, owner-side only), `cloud/useProjectAccess.tsx` (Grant and Decline), `cloud/useCloudProjects.tsx` (Ask for access, the Ask note, Your access requests), `cloud/projectRouteLogic.test.ts` (the pinned route inventory).

**Where the plan proved wrong, needed a decision, or went further than it said.**

1. **⚠ `decided_by` is withheld in four places, not one.** The 4C handoff says "the route must not forward it". As built: it is absent from the response shapes (`cloudTypes.ts` has no field for it); absent from the **column list** the route selects (`MY_REQUEST_COLUMNS` and `PENDING_REQUEST_COLUMNS` are explicit, and **never `select("*")`** — a wildcard would pull the uuid into the route's hands, where the next person to add a field would find it already loaded); dropped by the mapping even when the reply carries one anyway; and asserted absent from the rendered page by the Chrome harness, which puts a real uuid into the mock's reply on purpose and then searches the DOM for it. Three vitest assertions and one browser assertion, because this is the one thing the review named in advance.
2. **The requester's list needed a name source the plan did not name, and the choice is load-bearing.** A requester is not a member of the owner company and holds no grant, so `projects_select` gives them **nothing**: a join to `projects` would return no name at all. The list therefore resolves project and owner names **against `browse_projects()` and nothing else** — the same function the browse tab reads. That makes "nothing here may widen what browsing shows" structural rather than remembered, and it gives the honest answer for a project that has **left** the browse set: it is shown as **"a project you can no longer browse"**, with no name invented for it. Pinned in `accessRequestRouteLogic.test.ts` both ways round (named when browsable, nameless when not, and `from("projects")` never called).
3. **⚠ THE `requested_by` FILTER ON THE REQUESTER'S LIST IS A GATE, NOT TIDINESS — and the plan does not mention it.** `collab_requests_select` serves three audiences: the requester, **every member of the owner company**, and platform admins. So `GET /api/access-requests` without `.eq("requested_by", <verified session id>)` would quietly answer "every request I can see" for exactly the people who are meant to read them in the Access… note instead. The id comes from `session.snapshot.user?.id`, never from the request, and both the filter and the absence of any `searchParams` reading are asserted.
4. **The owner's side is a field on the EXISTING access response, not a route of its own.** `GET /api/projects/[id]/access` gained `requests`, populated only when `viewerIsOwnerSide` — so a collaborator's read never touches `collab_requests` at all — and only with **pending** rows. A decided request is the requester's own business and is on their list; it is not a standing entry on somebody else's project. That is the plan's "in the project's existing Access… note, above the grant rows" taken literally, and it is why no new owner-side surface exists to review.
5. **Ask for access is offered on a `redacted` row and never on a `full` one.** The database would answer `already-has-access` on a `full` row and write nothing, so offering the button there would be a control whose only outcome is a refusal. The plan does not say this; it follows from Open Item 2's two-door row. **Both** doors were checked in Chrome: a Rare Forms row offers `Open · Versions · Ask for access`, a Building Integrity row offers `Open · Versions` and no more.
6. **There are TWO places to ask, because hand-test 22 reads as one and the row reads as the other.** Step 22 says "browsing that Rare Forms project, press **Ask for access**" — that is the banner over a design already on screen. The browse **row** is the other, and it is where somebody who has not opened anything yet will look. Both open the same note. ~~A browsed design on screen is always a redacted one (a `full` row opens through the Stage 2 route and sets no `browseContext`), so the banner never has an `already-has-access` case.~~ **⚠ THAT SENTENCE WAS WRONG — see record 15.** A `full` row reaches the banner through **Versions**, so the banner is gated on the row's own `access`, exactly as the row's button is.
7. **A row already asked about says so and offers no second ask** — "You've asked for access — waiting for an answer." That makes `already-pending` **hard to reach from the UI on purpose**: the database's answer is still implemented, shown in words and tested, but the ordinary path does not produce it. It is reachable by a race (two windows, one list loaded before the other asked), which is exactly what the status exists for; hand-test 37 has an optional two-window drive for it.
8. **Re-asking after a DECISION is offered, because 0009 allows it.** The partial unique index covers `status = 'pending'` only, so a declined request may be followed by a new row — the plan's "with no notification channel there is nothing to spam". The row says "Your earlier request was declined. You can ask again."
9. **The 500-character cap is enforced three times, and the third one names no number.** The field's `maxLength` stops real typing at 500 (proved with CDP `Input.insertText`, because setting `.value` from script does **not** go through `maxLength` — the first version of that check tested the wrong thing and passed for the wrong reason); the route refuses a longer note **before sending**, naming both numbers; and `collab_requests_message_length` is what actually holds. The route's mapping of the database's own `22023` deliberately carries **no length at all**, because at that point the length is not in hand and stating one would invent it.
10. **`decide_collab_request`'s `grant_id` is not forwarded either.** It is harmless — the owner can read `collaborators` — but the access list is re-read after every decision and carries the grant with everything else about it, so an id on its own has nothing to do. The decision response is exactly `{ status, granted, message }`.
11. **The Ask note has its own open flag rather than the single `openNote` slot**, because it is reached from the tree AND from the banner, and closing the tree underneath somebody in one direction or the banner in the other would be a surprise. Cascade **0**, like the tree and Version history: cascade 1 already overhangs a 360px screen by 2px, and this note is reached from a row on that screen. Measured at 360 in Chrome.
12. **Nothing new went on the top bar, and it was measured rather than asserted.** The bar was read at 360, 768 and 1200 while acting as the consortium: no overflow, nothing off-screen, and no control matching `/ask|request/`. 4C's four surfaces are the browse tab, the banner note, the Ask note and the existing Access… note.
13. **No `collaborators` row is written anywhere in 4C, and that is asserted on the source as well as on behaviour.** `share_project_with_person` and `share_project_with_company` are named nowhere in the routes or the logic, `from("collaborators")` appears nowhere, and granting makes exactly one call — to `decide_collab_request`, which writes the grant itself inside the database. That is the plan's "no new grant-writing path", checked rather than intended.
14. **The database's shapes were read off a cluster, not off the migration.** On local PostgreSQL 17.4 with 0001–0009 applied: `request_project_access(uuid, text)` returns `TABLE(status text, request_id uuid)`; `decide_collab_request(uuid, boolean)` returns `TABLE(status text, grant_id uuid)`; `collab_requests_message_length` is `1–500`; `authenticated` holds **SELECT and nothing else**; and both functions answer an unauthenticated caller with `42501` and their own uniform messages. Every status literal in `ASK_STATUSES` and `DECIDE_STATUSES` matches what 4A's own suite asserts, line for line.
15. **⚠ REVIEWED 2026-09-24 — verdict SHIP WITH ONE SMALL FIX, and the fix is recorded here because record 6 above was WRONG.** The first build gated the banner's Ask on nothing, and its comment claimed "a browsed design on screen is always a redacted one (a `full` row opens through the Stage 2 route and sets no `browseContext`)". **That is false, and this stage's own build disproves it: Versions is rendered on every browse row with no `access` gate**, and `showBrowseHistory` → `openBrowseHistoryRow` → `openBrowsedVersion` → `browse-open` sets `browseContext` — which is exactly why `BROWSE_VERSION_LIST_FULL_ACCESS_NOTE` exists at all. So M acting as Seed could open Building Integrity's own project through **Versions** and be invited to ask her own company for her own project. **Sending it was harmless** — `request_project_access` answers `already-has-access` and writes nothing — so it was a wrong OFFER, not a leak. **Fixed by carrying the row's `access` into `BrowseContext`** (both callers already hold the whole `BrowseProjectRow`, so it is a field, not a new fetch) and gating the banner on it exactly as the row's button is. The field says how the ROW opens and never what the document is: what `browse_version` served is redacted either way. Pinned in `documentSession.test.ts` with a `full` `browseContext` that still reports `costsRedacted`, and walked in hand-test 42's second bullet.
16. **The `self` decision message described the wrong event, and is corrected.** It read "You've since joined the same company as the person who asked" — which is **`already-member`'s** situation. `0008_stage3_collaboration.sql:308` returns `self` when `v_grantee = auth.uid()`: the person who asked **is** the caller. It now reads "You're the person who asked — you've since joined this project's owner company, so you can already open it. The request is closed.", and `browseDisplay.test.ts` pins the two apart by their opening words.
17. **Hand-test steps 22 and 23 are superseded.** They were written before the surfaces existed and are a sketch of them; the real batch is **36–45** below, written for M, R, R2, N and T with one browser or profile per account and assuming nothing from earlier batches. 22 and 23 are struck through and point at it.

#### Two narrowings, decided by Tommy 2026-09-23 after 4A's review — and three smaller records

4A passed review (verdict: ship). The redactor held against every crafted attempt: a `priceModifier` nested in arrays several levels deep, a forged `redaction` marker, an unclassified format 23 refused, and 47 of 48 mutations caught. **What follows are not redactor bugs.** They are two places where *ordinary metadata* — not the money field — crossed a company line, which the review surfaced and Tommy then decided. Both are **browse-path only**: the owning company and invited collaborators are unaffected, through Stage 2's and Stage 3's own paths, which 0009 does not touch.

1. **Save notes are not served while browsing.** `browse_versions` and `browse_version` return **`null` for `label`**. A version label is free text, and free text is exactly where people write prices: the reviewer's probe read back a note saying **"Quoted at 1.35 markup"** to another company's member, while the structured `priceModifier` beside it was correctly stripped. Redacting the field and shipping the same number in words is not a guarantee. The column stays in both signatures, so 4B's shape does not change; `browse_version` does not even read it out of the row. **Stage 2's and Stage 3's paths keep labels** — the suite asserts that the *same person*, on the *same project*, reads the label through his grant and gets `null` through the browse path, so it is the path that drops it and not the person.
2. **An email-shaped author name is masked while browsing**, to **"a member of *&lt;company&gt;*"**, in `browse_projects`, `browse_versions` and `browse_version`. `author_name` is a snapshot that falls back to the account's **email** when nobody has set a display name (`prepare_project_version`'s rule). Stage 3 accepted that address reaching an *invited collaborator*; it must not reach every member company in the consortium. Real display names pass through untouched. **It is done in SQL**, in an internal `browse_author_name(text, text)` that no client role may execute — the redactor's own reason: PostgREST serves these functions directly, so a TypeScript layer could be gone around. The test is deliberately generous in the safe direction (anything with no whitespace and exactly one `@` is masked), and the suite asserts that **no author name anywhere in the browse set contains an `@` at all**.
   - **The exact wording is Tommy's, decided 2026-09-24.** The first build used "a *&lt;company&gt;* member", which reads "a The Seed Collaborative member" for the one company whose name begins with "The" — flagged rather than quietly reworded, because it is the string a browsing member actually sees. He chose **"a member of *&lt;company&gt;*"**, which reads properly for every company name. The no-company fallback is **"a member of the consortium"**, the same shape; it is unreachable today (the join is inner and `companies.name` is not null). **A null name is still null**, not a masked string.
3. **A case-variant key is deliberately NOT treated as money.** The belt matches `priceModifier` exactly; **`PriceModifier`, `pricemodifier` or any other casing would not be caught**, and a document carrying one would be served. This is deliberate and is recorded rather than fixed: **the app only ever writes `priceModifier`** — verified across `apps/web` and `packages`, where that spelling occurs 11 times and no other casing exists anywhere. The real guard against a *renamed* field is not a fuzzier belt but the classification failing closed on a new schema version, plus the TypeScript `Record<keyof ProjectState, …>` that will not compile when a key changes. **If the app is ever changed to write a different casing, that is a new schema version and needs its own classification row** — which is the rule that already governs this.
4. **A requester can read `decided_by` on their own request row.** `collab_requests_select` lets the requester see their own rows, and that includes the decider's **user id** and `decided_by_name` — which Open Item 4 intends for "Declined", with who and when. It is harmless in the database, where a uuid identifies nobody by itself. **⚠ 4C's route must not forward `decided_by` to the client.** The requester's list needs `status`, `decided_at` and at most `decided_by_name`; shipping the raw uuid hands out an `auth.users` id for a person at another company, which nothing else in the app does. Recorded here because 4C is where it would be done without thinking.
5. **The belt now has an array case, and it closed a real test gap.** The reviewer's probe nested `priceModifier` **inside arrays, several levels deep** (their versions 2 and 8) and the belt caught it — but *nothing in the suite pinned that*, so a future array-blind rewrite of the belt would have passed. The suite now asserts it three ways: two hand-made documents through `browse_redact`, and a **real saved document** (project "Array House") that `browse_version` must refuse end to end. The matching mutation — a belt that walks objects but not arrays — fails the **headline** assertion, "MARGIN, EVERY PATH". *The reviewer's own suggested mutation, changing the belt's `lax` to `strict`, does **not** fail the suite, and should not: it was measured across eleven document shapes on PostgreSQL 17.4 and `$.**` descends into arrays identically in both modes, so the edit is behaviour-preserving. That is recorded so nobody "fixes" it later.*

#### Why this stage is the risky one, in one paragraph

Decision 22 says there is **no server-side calculation engine**: the document reaches the browser and the client computes everything. Decision 21 says a browsing company must **never** see another company's price modifier. Decision 23 admits export blocking is **friction, not access control**. So the only thing standing between a browsing company and another company's margin is that **the field is removed from the document before it is sent** — and that has to happen somewhere a browser cannot go around. That is this stage's whole job, and everything else here is arrangements around it.

#### What is money, named against the real shape

Verified against `apps/web/app/projectFile.ts` (v24), not guessed:

| Field | In the document? | What it feeds | Stage 4 |
|---|---|---|---|
| **`state.priceModifier`** | **Yes** — `ProjectState.priceModifier`, and it is in `REQUIRED_STATE_KEYS` | `effectivePriceModifier` (`page.tsx:4882`) → the `price` memo (`page.tsx:4884`) → the **Price** row and the **Markup** input on Project Summary (`page.tsx:7503-7531`) | **REDACTED. It is the whole list.** |
| `state.zipCode` | Yes | seismic zone, shipping distance, the sheet's site label | **Not redacted.** It is a design input, and decision 12 already accepted that a browsing company sees which client and place a project is for. |
| `state.role` | Yes | which disclaimer prints | **Not redacted, and already ignored on a cloud open** (Roles, 9). The viewer's own toggle wins. |
| `shippingRatePerMile`, the four `plaster*Price*`, `steelMeshPricePerSqFt`, `plasterLaborRatePerHour` | **No** — `useState` only (`page.tsx:550, 562-567, 577, 578`) | the Shipping and Plaster Master cards | **Not redaction targets today, because they are not in the document.** ⚠ See Open Item 6: what a browser is shown on those cards is *their own* defaults. **The day these are added to `ProjectState` they become redaction targets**, and the classification check below is what forces that. |
| The catalog list rates (`priceRates.*`, `packages/panel-catalog/src/data.ts:788`) | No — they are in the app's own code | every price | **Not hidden, and cannot be** (21's own note). A browser can compute an unmodified price. That is the app's arithmetic, not the other company's margin. |

**So the redaction list, for schema version 24, is exactly one path: `state.priceModifier`.** Recorded as a fact with its verification, not as an assumption.

#### ⚠ The collision with the live parser, and what it forces

**`priceModifier` is in `REQUIRED_STATE_KEYS` (`projectFile.ts:344`).** `parseProjectFile` returns `{ ok: false, error: 'That file is missing the "priceModifier" field.' }` when a required key is absent. So **a document with the field simply removed does not open** — every browsed project would fail with a message that reads like a corrupt file. Decision 21 is still right and is not reopened; it needs one more piece than it names:

- **The redacted document carries an explicit top-level marker**, a sibling of `schemaVersion` / `savedAt` / `state`:
  `"redaction": { "schemaVersion": 24, "removedPaths": ["state.priceModifier"], "reason": "another company's cost information" }`.
  A top-level key `parseProjectFile` does not read is ignored by it today, so **this needs no `PROJECT_FILE_VERSION` bump** — confirmed by reading the parser, which reads only `schemaVersion`, `state` and `savedAt`.
- **The client gets a redacted-aware parse path** that accepts exactly the paths the marker names as missing, and returns `costsRedacted: true` alongside the state. A document missing a required key **without** a marker naming it is still refused, exactly as today.
- **The field is removed, not nulled or zeroed.** 21's guarantee is "the field never leaves the server", and a key that is not there cannot be multiplied by anything.

#### What the client does with a redacted document — a visible gap, and a loud one

- **Everything that is not money still draws.** Panels, walls, the footprint, quantities, dimensions, the 3D preview, every fabrication and detail sheet, the Review Log, and printing. That is decision 20's "design yes, money no", and it is the whole point of the document reaching the browser.
- **The Price row prints `—`**, with: "Cost is not shown for another company's project." **The Markup input is not rendered at all** while browsing.
- **`—` whatever the viewer role.** `effectivePriceModifier` is `role === "public" ? 1 : priceModifier`, so a browsing viewer in the public role would otherwise be shown a real base price on someone else's sheet, which reads as "their price". 21 permits them to compute it themselves from published rates; the app does not present it as the owner's number.
- **`priceModifier` is held as `NaN` while browsing, and every price display is gated on `costsRedacted`.** Deliberate: if a gate is ever missed, the screen shows `$NaN` — obviously broken, impossible to mistake for a number — instead of a confident `$48,210` built from a defaulted 1.0 or 1.3. **This is the flag convention's own rule** (a visible gap beats a plausible substitute), applied to the one field that carries another company's commercial information.
- **No dollar figure anywhere on a browsed project may fall back to a default.** Where a card cannot honestly show a number, it shows the gap and says why.

#### The redactor: where it runs, and why it cannot be gone around

**It runs in the database, inside a `SECURITY DEFINER` function, and no function or policy a browser can reach ever returns an unredacted cross-company document.**

The reason is written in 0006 and 0008 already and is not re-derived here: **the publishable key ships in the browser bundle**, so anything RLS will serve, PostgREST will serve directly. Redacting in a Next.js route would mean some database call somewhere returns the raw document to a signed-in browser, and that call is then reachable without the route.

- **`project_versions_select`, `projects_select`, `can_read_project`, `can_write_project` and `holds_project_grant` are NOT touched.** 0006 and 0008 both say Stage 4 must not widen them; the post-flight and the test both assert they are byte-identical after 0009.
- **`browse_version(p_project, p_version)`** is the only way a browsed document is served. It is definer, checks seed entitlement and the browse set itself, checks `meets_required_aal()` itself, and returns the document **after** removing every path for that document's `schema_version`, with the marker added.
- **Nothing a browser can call returns the raw document.** There is no "read it raw, redact it in TypeScript" step anywhere, and no route uses the service role (the standing Stage 2/3 rule is unchanged).
- **Stage 2's and Stage 3's document paths are not borrowed and not widened.** `GET /api/projects/[id]/versions/[versionId]` and the backup route keep serving grant-holders and members exactly as they do now, through RLS. A browser gets a 404 from them, as today — hand-test step 19 checks precisely that.

**Keyed to `schema_version`, and failing closed.** `0009` creates:

`browse_schema_redaction (schema_version integer primary key, redacted_paths jsonb not null, note text)`, seeded with one row: `(24, '[["state","priceModifier"]]', …)`.

- **Absence of the row is the failure, not an empty list.** A future schema version with genuinely no money fields gets a row with an empty array; a schema version nobody has classified has **no row**, and `browse_version` **raises rather than serving it**. Stated explicitly because it is the rule that survives a future field: *a document whose `schemaVersion` the redactor does not know is not served cross-company at all.*
- **An out-of-window version is therefore never served to a browser either**, and — importantly — **the browse path offers no raw download.** ⚠ Stage 2C's honest "Download this version's file" hands over the *untouched stored document*; copied onto the browse path it would be a hole straight through 21, not merely 23's friction. It is suppressed on every browse surface, and the two rules line up: an unknown format is refused, and nothing is offered in its place except the fact that it cannot be shown.

#### What browsing shows

- **The browse set is every project of every company with `is_seed_member = true`**, in all three folders (19, 20, 12). All four companies carry the flag today, the Seed Collaborative's own included.
- **Open from cloud gains a fifth tab, "Browse the consortium"**, shown **only while the company you are acting as IS the Seed Collaborative** — whether you reach it through the consortium entitlement or through a real membership in it. Browsing is the acting-as state, never ambient (hand-test step 25).
  - ⚠ **CORRECTED 2026-09-24, after 4B's review. The plan was wrong here, not the build.** This bullet used to read "the acting-as entitlement is the consortium one, **or the acting-as company is a member company**". That second clause contradicts **hand-test step 25** in this same plan, which says a Rare Forms member acting as **Rare Forms** must have **no tab at all** — and Rare Forms *is* a member company. Step 25's narrower reading is the one that matches the stated principle, and it is what 4B implemented; the review confirmed the implementation is right and the sentence above is what was stale. *(Being in a member company is what entitles you to ACT AS the co-op. Acting as it is what opens the tab. The plan's old wording collapsed those two steps into one.)*
  - It needs `Entitlement.isConsortium`, because it cannot be derived from `source`: a real Seed **member** acts as Seed through `membership`, and `computeEntitlements` deliberately adds no second `consortium` entry for a company already held. The field **grants nothing** — the review traced all 13 of its uses and found exactly one gating anything (`useCloudProjects.tsx`, the tab) — and every browse function checks `is_seed_entitled()` for itself in the database.
  - It lists the member companies by name (`browse_companies()`), and within one company, the three folder tabs.
  - Each row: "*Smith House* · v7 · Frank · 2 hours ago — **Owned by Rare Forms › Proposals** · read-only, costs not shown".
  - **Each row is marked `full` or `redacted`.** `full` means the caller can already read it (membership, a grant, or platform admin), and the row opens through the Stage 2 route with costs; `redacted` opens through `browse_version`. See Open Item 2.
- **Acting as Seed through the consortium, Seed's own folder tabs finally show something** — through the browse path, redacted, because a consortium entitlement is not a Seed membership. `consortiumLaterStageMessage` and `consortiumMenuMessage` are replaced; both stop being true this stage.
- **A Seed member acting as Seed** sees Seed's own tree in the folder tabs with costs (membership, through RLS) and everyone else's redacted. The two Seed rows of the permission matrix stay different, as the matrix insists.
- **⚠ Your own company's projects are redacted while you act as Seed.** Decision 20's sub-note defines "another company" as "the company you are acting as is not the owner", so a Building Integrity member acting as Seed sees Building Integrity's own work costs-hidden. It is the decided rule and is not changed here, but it is surprising the first time; hand-test step 18 puts it in front of Tommy before it is final. See Open Item 7.
- **Platform admins are served through the normal path, never the redactor.** RLS already gives them everything, their rows are marked `full`, and "your margin stays yours and the four platform admins'" is not quietly widened or quietly narrowed.
- **A version list while browsing** shows number, "Saved"/"Renamed to …", author name and date and time — Stage 2C's metadata **minus two things, narrowed 2026-09-23 after 4A's review (see "Two narrowings" below): the save label is not served at all, and an author name that is an email address is replaced by "a member of *&lt;company&gt;*".** **Open** on a row goes through `browse_version`. There is **no** raw download, and **no** Move to…, Rename, Access… or Sharing… control: browsing writes nothing.

#### `is_seed_member` — its real job, and the symmetric false branch

The flag finally does the two things the data-model note promised:

1. **It defines the browse set.** `browse_projects` filters on it, in the database.
2. **It decides who gets the entitlement at all.** `computeEntitlements` already builds the consortium source only when one of your own companies carries the flag (`actingAs.ts`), and `is_seed_entitled()` is the database's own copy of that rule.

**The false branch, asserted rather than assumed: a non-member company neither sees nor is seen.** Its members get no consortium entitlement and every browse function returns them nothing; its projects are absent from every other company's browse set. Both halves are asserted in the RLS suite, as an ordinary member of a non-member company. **There is no non-member company today, so this branch cannot be hand-tested live** — that is stated rather than papered over, and it is why the SQL assertion carries the weight.

⚠ Stage 3 Open Item 4 recorded that `shareable_companies()` answers **any** signed-in account, so a non-member company's members can read the consortium's company names. Stage 4's functions must not repeat it: `browse_companies()` checks seed entitlement itself. Whether to tighten `shareable_companies()` at the same time is Open Item 5.

#### Access requests — `collab_requests`, the other direction of 26

Moved here by Stage 3's answer 6. **It is the one thing in this stage that writes.**

- **`collab_requests`**: `id`, `project_id` (FK, cascade), `requested_by` uuid (FK `auth.users`, **cascade** — a deleted account's request goes with it), `requested_by_name` (snapshot, same rule as everywhere else), `message` text null (1–500), `status` in (`pending`, `granted`, `declined`), `created_at`, `decided_by` uuid **no FK** (authorship-like, as `granted_by` is), `decided_by_name` snapshot, `decided_at`.
  - `unique (project_id, requested_by) where status = 'pending'` — one open request per person per project.
  - `authenticated` gets **select only**. Every write goes through a definer function; there is no insert, update or delete grant.
- **Who may ask:** anyone the project is **browsable** by — seed-entitled, and the project in their browse set — **and who cannot already read it**. Asking about a project outside your browse set raises the same uniform "not found, or you cannot ask about it" 42501 whether or not it exists, so requests cannot be used to probe for project ids.
- **Who may grant:** **any member of the owner company, or a platform admin** — the same set that may share (answer 3) and remove (answer 13). Not the requester's own company, and not a collaborator.
- **How a request becomes a grant:** `decide_collab_request(p_request, p_grant)` checks the decider, then — when granting — **writes the grant by calling `share_project_with_person` with the requester's address**. Deliberately **not** a second way to write a `collaborators` row: the grant that results is an ordinary personal grant with `granted_by` = the decider, so **everything downstream already understands it** — the Shared with us tab, the 3C notice, the access list, the cascade offer, and Open Item 2's backup exclusion. The request row is then marked `granted`.
- **What a refusal looks like:** `status = 'declined'`, with `decided_by_name` and `decided_at`. **The requester sees it on their own request list**, and nowhere else: there is no email (7), and no new notice channel is added. Nothing is written to `collaborators`. Re-asking is allowed (a new row), because with no notification channel there is nothing to spam. See Open Items 3 and 4.
- **Where owners see them:** pending requests appear in the project's existing **Access…** note, above the grant rows, for owner-side viewers only, each with **Grant** and **Decline**. **The database is the gate and the button is the courtesy**, as for Remove.

#### Export restrictions (23) in the UI — and the wording that must go with them

**While a redacted document is on screen, these controls are not rendered:**

| Control | Where it lives today |
|---|---|
| **Save Project** (local download) | `TopBar.tsx:284` |
| **Save to cloud**, **Save as new cloud project…** | `cloud/cloudMenu.ts` |
| **Export as OBJ** | `Building3DView.tsx:1619` |
| **Download OBJ** on a single panel | `StandardPanel3DView.tsx:132` |
| **Download this version's file** | `cloud/useCloudProjects.tsx` (the out-of-window offer) — see above; on the browse path it is a hole, not a courtesy |
| **Download project file** on a refused-save notice | `cloud/useCloudProjects.tsx` |

- **Save as new cloud project is included deliberately.** 23 names the project file and the OBJ; "save a copy into my own company and carry on with it" is the exact thing 23 says view-only must not become, and it is a copy of a redacted document besides. Recorded as a reading of 23, not a new decision.
- **`cloudContext` must be null while browsing**, and a new `browseContext` set instead, so **no save path can attach to a browsed project** even if a control were missed. Same shape as 2B's rule that Load Project clears `cloudContext`.
- **Printing and PDF stay** (23), as does every drawing and detail sheet.
- **The honest wording, on the browse banner:**
  > You're viewing **Smith House**, owned by **Rare Forms**, as a member of the consortium. Costs are not shown. You can print this or save a PDF. This app doesn't hand you an editable copy — taking one another way is a breach of the terms rather than something the software prevents.
- **The rule for every string this stage adds, stated so a coder cannot get it wrong: no wording may say or imply that the app prevents copying.** Banned phrasings include "other companies cannot take your files", "your designs are protected", "copy-protected" and "secure". **Redaction (21) is a guarantee and may be stated as one; export blocking (23) is friction and must never be.** A vitest assertion pins this against the browse strings file.

#### Backups (29) — browsing-only projects stay out, and how 3E enforces it

- **Nothing changes in `cloud/backupRouteLogic.ts`, and that is the enforcement.** The 3E cursor walks exactly two sources — `projects.company_id = <company>` (owned) and `collaborators.grantee_company_id = <company>` (granted) — and **Stage 4 adds no third phase.** A project reachable only through browsing matches neither `.eq()`, so no page can contain it.
- **29's rule holds unchanged: a backup may never contain more than its owner could already export by hand.** A browsing company cannot export a browsed project at all, so it cannot appear in their zip.
- **Asserted, not assumed**, in three places: the SQL suite (a browse-set project yields zero rows from both enumerations); a vitest assertion that the phase list is exactly `["owned", "granted"]`; and a vitest assertion that `companyBackup.ts` and `backupRouteLogic.ts` reference no browse function or `/api/browse` route. Hand-test step 24 checks it live.

#### The permission matrix rows this stage fills in

No row is rewritten; four cells stop being promises and become code.

| Row | Cells this stage makes real |
|---|---|
| **Acting as the Seed Collaborative** (any member of a member company) | **Browse other member trees: yes** (the browse path) · **See their costs: no** (the redactor) · **Export their file / OBJ: no** (23's friction, honestly labelled) · **See acting-as tree: yes, read-only** — Seed's own tree, served redacted, because a consortium entitlement is not a Seed membership |
| **A Seed Collaborative member, acting as Seed** | **Browse: yes** · **See their costs: no** (other companies') · **Export: no** (other companies'). Seed's own tree stays full, through membership. |
| **Member / company admin, acting as own company** | **Browse other member trees: no** — unchanged, and now enforced by the browse tab being absent rather than by there being nothing to browse |
| **Platform admin** | **Browse: yes · costs: yes** — through the normal path, never the redactor |
| **Invited collaborator** | unchanged (24: costs included, full export) — a grant is a handoff, not browsing |

#### Staging — three sub-stages, each shippable

- **4A — Schema, RLS, the redactor and tests. No app change.**
  - Contents: `supabase/migrations/0009_stage4_browsing.sql`, `supabase/tests/stage4_rls.test.sql`, README (a Stage 4 section, read-only pre-flight and post-flight, "run 0009 after 0008").
  - **Safe ahead of the app**: no app code calls any of it, and it widens no existing policy or helper. The live app has no browse surface until 4B.
  - Ships when the suites pass locally with every mutation check failing them, and Tommy has pasted `0009` and matched the post-flight output.
- **4B — Browsing, the redacted read, and the export restrictions. BUILT 2026-09-24 on branch `stage4b-browsing-ui`, REVIEWED 2026-09-24 (verdict: ship).** App code only; 0009 was already live. See "4B as built" above for the twelve records, two of them places the PLAN was wrong rather than the build. **They ship together, deliberately:** shipping the browse tab before the controls are hidden would hand out OBJs of other companies' work on day one.
  - Contents: the browse routes, the fifth tab and company list, the redacted-aware parse path and `costsRedacted`, the gap on every price display, the banner and its wording, the replaced consortium messages, and the hidden export controls.
  - *Usable alone: this is decision 15's sentence — "you are in the club and welcome, here is what everyone is doing."*
  - Hand-test steps 17–21 and 24–25.
- **4C — Access requests. BUILT 2026-09-24 on branch `stage4c-access-requests`.** `collab_requests` end to end: Ask for access while browsing, the owner's Grant/Decline in the Access note, the requester's own list. App code only; 0009 was already live. See "4C as built" above for the fifteen records, three of them places the plan was silent on something load-bearing (where a requester's project NAMES may come from, the `requested_by` filter on their own list, and that a granted request must produce no second grant-writing path). **Hand-test steps 36–45**; the plan's own 22–23 are superseded and struck through.

#### Tests — `supabase/tests/stage4_rls.test.sql` (local or staging only, never the live project)

Stage 3's harness unchanged: `local_shim.sql`, then 0001–0009, then the Stage 1, 2 and 3 suites (**all three must still pass**), then this file, in one transaction ending in `ROLLBACK`, with the same refuse-to-run guard extended to any `collab_requests` row. Fixtures are Stage 3's people, so the non-member company (carol) and the Seed member (dave) already exist. **Every assertion runs as an ordinary member of a real company — never only as the platform admin.**

1. **The browse set.** frank (Rare Forms), acting as Seed, lists Building Integrity's, New Frameworks', Rare Forms' and Seed's projects. **He does not list carol's non-member company's**, even naming its ids.
2. **The symmetric false branch.** carol gets **zero** companies from `browse_companies()`, zero projects from `browse_projects()`, and a 42501 from `browse_version()` on a project she named — the same error as for a project that does not exist.
3. **THE MARGIN ASSERTION, Stage 4's version, and the one that matters most.** For a Building Integrity project with `priceModifier` in its document:
   - `browse_version(...)` returns **a document with no key named `priceModifier` at any depth, whose text outside the `redaction` marker does not contain `priceModifier`, and in which the modifier's value does not appear** — for frank, for nick and for dave. *(Corrected 2026-09-21 from "`document::text` does not contain the string `priceModifier`", which cannot pass and which would also have passed if only the marker text carried the name: the marker's own `removedPaths` says `state.priceModifier`. See 4A as built, item 1.)*
   - the same document read through `project_versions` returns **0 rows** for each of them;
   - the marker is present and names `state.priceModifier`;
   - across **every** function frank can call, the count of documents he can reach that carry `priceModifier` equals the count of projects he holds a grant on or his own company owns — and no more.
4. **Fail closed on an unknown schema version.** A version stamped `schema_version = 99`, with no `browse_schema_redaction` row, makes `browse_version` **raise**; it serves no document, redacted or otherwise. A version stamped 24 serves normally. **This is the future-schema guard and it must fail loudly, not quietly serve.**
5. **RLS is untouched.** `projects_select`, `project_versions_select`, `can_read_project`, `can_write_project` and `holds_project_grant` all answer exactly as they did before 0009 — asserted by behaviour (frank still reads 0 rows of a BI project) **and** by a definition comparison in the post-flight.
6. **Access requests.** frank asks on a BI project he can browse → `pending`. bob (an ordinary BI member) grants → a `collaborators` row exists with `granted_by = bob`, frank now reads the **full** document with `priceModifier` present, and the request is `granted`. A second pending request from frank is refused. frank asking about carol's project raises. carol asking about anything raises. A decline writes no grant, and the declined requester still reads 0.
7. **Two-factor.** frank with a verified factor at aal1 gets nothing from every browse function and a raise from every request function; at aal2 they all work.
8. **Privileges.** `anon` holds nothing on `collab_requests` or `browse_schema_redaction` and can execute no Stage 4 function. `authenticated` holds no insert, update or truncate on `collab_requests`.
9. **Backups.** Both 3E enumerations return **0** rows for a project that is only browsable.

**Mutation checks — each must fail the suite, on the assertion named:**

| Mutation | Fails on |
|---|---|
| `browse_version` returns the raw document | 3 ("does not contain priceModifier") |
| `browse_schema_redaction`'s paths emptied for v24 | 3 |
| the unknown-schema refusal removed (serves it unredacted) | 4 |
| `browse_projects` drops its `is_seed_member` filter | 1 |
| `browse_companies` drops its seed-entitlement check | 2 |
| `projects_select` widened to the browse set | 5 |
| `decide_collab_request` skips the owner-member check | 6 |
| the `meets_required_aal()` check removed from `browse_version` | 7 |

**The TypeScript side — the test that fails when a future cost field is added and nobody notices.** This is decision 21's "tested against `ProjectState`'s own key list", and it has three layers, in `apps/web/app/cloud/redaction.ts` and `redaction.test.ts`:

- **(a) The build fails, not just a test.** `MONEY_CLASSIFICATION: Record<keyof ProjectState, "money" | "not-money">` — a `Record` over `keyof ProjectState` is **exhaustive by type**, so adding a field to `ProjectState` without classifying it fails `tsc --noEmit`, naming the missing key. A silently unclassified new field is exactly how the first leak happens, so it is caught by the compiler.
- **(b) The runtime keys agree with the type.** A test serializes a real project and asserts every key of `serializeProject(state).state` appears in the map, catching drift the type cannot see.
- **(c) The migration agrees with the classification.** The test `readFileSync`s `0009_stage4_browsing.sql` (the repo already has source-reading tests — `projectRouteLogic.test.ts`, `sharingRouteLogic.test.ts`), extracts the seeded paths for `PROJECT_FILE_VERSION`, and asserts they are **exactly** the keys classified `money`. So a new money field fails (a); classifying it without seeding it fails (c); and **a future schema version with no seed row at all** is asserted to be absent, which is the state that makes the database refuse to serve it.
- **(d) A redacted document has no key named `priceModifier` at any depth, its text *outside the `redaction` marker* does not contain `priceModifier`, and the modifier's value appears nowhere in it** — asserted both in vitest (on the shape) and in SQL (on the real function output, assertion 3 above). *(Corrected 2026-09-21 from "a stringified redacted document contains neither `"priceModifier"` nor the modifier's value": the marker names the removed path, so the whole-string form both fails against a correct redactor and passes when only the marker carries the name. See 4A as built, item 1.)*
- **(e) Route-level invariants**, in the established readFileSync style: no `/api/browse/**` route imports `createSupabaseAdminClient` or mentions `service_role`; no browse logic selects `document` from `project_versions` directly; and the browse strings contain none of the banned "cannot take your files" phrasings.

#### Hand-test checklist — the live app

**Accounts, with the real addresses.** Steps marked "as M / as R / as R2 / as N" **must not be done as T** — a platform admin passes every check here, including the redactor, by design, so doing them as T proves nothing.

| | Who | Address |
|---|---|---|
| **M** | ordinary Building Integrity member | `tommy.fieser@gmail.com` |
| **R** | ordinary Rare Forms member | `tommy.fieser+rare@gmail.com` |
| **R2** | a second ordinary Rare Forms member | `tommy.fieser+rare2@gmail.com` |
| **N** | ordinary New Frameworks member | `tommy.fieser+nf@gmail.com` |
| **T** | Tommy, the platform admin | `tommy@buildinteg.com` |

**One browser or profile per account.** Incognito windows share one sign-in (found in 3B's hand test), so two incognito windows are not two accounts. Any mix of desktop and phone is fine; each step says when a wider screen is easier.

**These steps assume NOTHING from Stage 3's steps 11e–16**, which were spot-checked rather than walked (2026-09-24). Where a step needs a particular project to exist, it says how to make one. **Step 13 is rewritten below and belongs to this batch**: it was skipped deliberately because it read a string word for word that 4B replaces, so 4B owes the replacement.

**Two strings 3D's steps read have also changed**, and both now name the browse tab instead of a later stage. Step 12b's "Seed's folder tabs still say its folders open in a later stage" and step 14's parenthetical about the same message are superseded by **step 13a** below; read that wording, not theirs.

---

**13. (rewritten for 4B — the Stage 3 line, checked against 4B's own words.)** *Three short parts. 13b needs a project M created in Seed's tree, which is Stage 3 step 12a; if you did not run 12a, make one now: **as M**, Acting as → **The Seed Collaborative (consortium)**, draw anything, Project ▾ → **Save as new cloud project…** → **Save**.*

- **13a. The replaced folder-tab sentence. As M, not T, acting as Seed:** Project ▾ → **Open from cloud…** → press **Current Projects**. It reads, in full:
  > You're acting as The Seed Collaborative through the consortium, which isn't a membership in it, so these folder tabs list nothing. The Seed Collaborative's own projects are in Browse the consortium, read-only and with costs not shown.

  **The words "later stage" appear nowhere**, here or in the Project ▾ menu line above Open from cloud…. *(That is the whole reason step 13 waited: the old sentence promised a stage that has now arrived.)*
- **13b. Seed's own tree finally shows something — redacted. Still as M, acting as Seed:** press **Browse the consortium** → **The Seed Collaborative** → **Current Projects**. **The project you created there is listed**, reading "Owned by The Seed Collaborative › Current Projects". Press **Open**, then open the **Project Summary** card: the price reads **`—`**. *That is the point of 13b: acting as Seed through the consortium is not a membership in Seed, so even Seed's own tree comes to you through the redactor.*
- **13c. A co-op member still cannot reach another company's document. As R, not T, acting as The Seed Collaborative:** Project ▾ → **Open from cloud…** → **Shared with us**. **M's Seed project is not listed** — nothing was shared with R. Press **Browse the consortium** → **The Seed Collaborative** → **Current Projects**: it **is** listed here, and pressing **Open** shows the design with the price as **`—`**. **That pair is the Stage 4 line holding**: R is seed-entitled, so R may *browse* it, and the only path that serves it serves it with the costs removed. *(Step 10's address-bar check is the Stage 2 half of the same statement and is repeated as step 19 below, where it belongs.)*

---

17. **(4B) The first browse, end to end. As M, not T.** *(Easier on a desktop or laptop; it works on a phone.)* In the **Acting as** box at the top left, pick **The Seed Collaborative (consortium)**. Project ▾ → **Open from cloud…**. There is a **fifth tab, "Browse the consortium"**, after Shared with us. Press it.
    - Under it: "Every member company's projects, in all three of their folders. Read-only, and costs are not shown.", then a row of **four company buttons** — Building Integrity, New Frameworks, Rare Forms, The Seed Collaborative.
    - Press **Rare Forms**, then **Current Projects**. *(If Rare Forms has nothing there: **as R**, draw anything and use Project ▾ → Save as new cloud project… → Save, then come back as M and press Rare Forms again.)*
    - A row reads the project's name, then "v\<n\> · \<author\> · \<how long ago\>", then **"Owned by Rare Forms › Current Projects · read-only, costs not shown"**. It offers exactly two buttons: **Open** and **Versions**. There is **no Move to…, no Rename, no Access…** — browsing writes nothing.
    - Press **Open**. A note titled **"Viewing \<project name\>"** appears, and behind it **the design draws** — footprint, walls, panels, dimensions.

    Now check, in this order:
    - **The note's three sentences.** "You're viewing \<name\>, owned by Rare Forms, as a member of the consortium." / "Costs are not shown. You can print this or save a PDF." / **"This app doesn't hand you an editable copy — taking one another way is a breach of the terms rather than something the software prevents."** ⚠ **Read that last sentence carefully and tell me if it overstates anything.** It must not say the app *stops* you taking a copy, because it cannot; hiding the buttons is friction, and the redaction is the only guarantee here. Press **Dismiss**.
    - **Project Summary → Price** reads **`—`**, with "Cost is not shown for another company's project." under it. There is **no Markup box**. It does **not** read `$NaN`, `$0.00`, or any number. Scroll the card: **no dollar figure appears anywhere on it**.
    - **Project ▾.** Under "This computer" there is **only Load Project** — **no Save Project**. Under "Cloud · The Seed Collaborative" there is **only Open from cloud…** — **no Save to cloud**, **no Save as new cloud project…** — above a line reading "Saving and the OBJ exports aren't offered on another company's project. Printing and Save as PDF still are." The grey status box at the top of the menu repeats the same three sentences as the note, and **stays there for as long as the design is on screen**, whether or not you dismissed the note.
    - **The 3D views.** Switch the editor to **3D** (the view toggle above the canvas): the building preview has **no "Export as OBJ"** button. Open any **Panel Fabrication** card on the right: its panel viewer has the **Show straw fill** checkbox but **no "Download OBJ"**.
    - **Printing still works.** Press **Export PDF** (or your browser's Print). The sheets appear with their title blocks, and the Project Summary sheet's **Price row prints `—` with the same reason**. Decision 23 allows printing and PDF; only the editable copies are withheld.
    - **Leaving.** Project ▾ → **Load Project** and open any `.json` you have on the machine — or just **Open from cloud…** and open one of your own Building Integrity projects. The "Viewing …" note goes, the Price row shows money again, and **Save Project and both cloud saves come back**. *(That is the intended way out; browsing is a state you leave, not a mode you switch off.)*

18. **⚠ Your own company's work, while you act as Seed — the one that may surprise you. As M, not T, still acting as Seed:** Project ▾ → Open from cloud… → **Browse the consortium** → **Building Integrity** → **Current Projects**.
    - Its rows read **"Owned by Building Integrity › Current Projects · you can open this in full"** — the tab tells you, truthfully, that this one is yours to read.
    - Press **Open** on one: it opens **with the price**, exactly as it does from your own folder tabs, and **no "Viewing …" note appears**. Nothing was redacted; you are a Building Integrity member and the app used the ordinary path.
    - Now press **Versions** on that same row. Above the list, on **this** row only, there is a second line: **"Versions here always come with costs removed, even on a project you can open in full. Open the project itself to see it with its costs."** Press **Open** on the newest version: **the price reads `—`**.
    - Press **Versions** on a **Rare Forms** row for contrast: that second line is **not** there. It would be a puzzle where there is no other door.

    *Both answers are correct, and the difference is decision 20's ownership rule: "another company" means the company you are ACTING AS is not the owner. The row's own Open asks "can this person read it?" and the answer is yes; the browse path always redacts, for everybody, because one always-redacting function has fewer branches and so fewer holes (Open Item 2). **You settled this on 2026-09-24 after the review: keep both doors and say so** — the review found neither leaks, so the risk was confusion rather than exposure, and the second line is the fix. **This step is now a confirmation, not a decision.** If the line does not actually clear it up when you see it on screen, say so.*

19. **The one path, and the one that stays shut. As M, not T, still acting as Seed.** *(This step needs the browser address bar. It is easier on a desktop; on a phone, open a new tab and type the address.)*
    - While a **Rare Forms** project is open through the browse tab, open Project ▾ and read the status box's first line: "\<name\> · v\<n\> · Rare Forms › Current Projects". Note the **version number**.
    - This is the only step in 4B that wants the console, and only because the id is not printed anywhere in the UI. **Desktop:** press **F12** → **Console** (Chrome may ask you to type `allow pasting` first) and paste this one line exactly:

      `fetch('/api/browse/projects?folder=current').then(r=>r.json()).then(d=>console.table(d.projects.map(p=>({name:p.name,owner:p.ownerCompanyName,stage2Url:'/api/projects/'+p.projectId+'/versions/'+p.headVersionId}))))`

      It prints a table of every project you can browse, in every member company. Copy the **stage2Url** of the **Rare Forms** row.
    - Paste the site address followed by that url into the address bar — e.g. `https://…/api/projects/<id>/versions/<vid>`. **The page shows only `{"error":"That project version doesn't exist, or you can't open it."}`. No document, no price.**
    - *That is the whole stage in one pair: the browse tab just drew you the design, and the Stage 2 address that would have handed over the untouched file says nothing exists. **The only path that serves it, serves it redacted.***
    - **If you would rather not use the console at all, skip this step and tell me** — it is proven in the RLS suite and by the app's own tests, and steps 17, 18 and 20 already show the redaction working from the UI alone.

20. **Both directions, as two ordinary members who are not you-the-admin.**
    - **As N, not T:** Acting as → **The Seed Collaborative (consortium)** → Project ▾ → Open from cloud… → **Browse the consortium**. Pick **Building Integrity** → Current Projects → **Open** a project: the design draws and **Price reads `—`**. Then pick **Rare Forms** → Current Projects → **Open**: same. *(If New Frameworks has no member yet, invite N first: **as T**, Acting as → New Frameworks → Account ▾ → **Invite someone** → N's address → Member → Create invite link, then open the link as N.)*
    - **As R, not T:** the same in the other direction — Acting as Seed, browse **Building Integrity**, open a project, **Price reads `—`**.
    - **On both**, check the version list once: press **Versions** on a browsed row. **Every row's save note is blank** — no "Note: …" line anywhere — and an author who never set a display name reads **"a member of \<company\>"** rather than an email address. A line above the list says so. **Both are deliberate and browse-only**: on your own company's Version history, notes and real names are still there. *(A save note is free text, and free text is exactly where a price gets written — a review probe read one back saying "Quoted at 1.35 markup".)*

21. **A version that cannot be shown.** The redactor refuses any file format it has not been told about, and **format 23 — the one the app itself still opens — is deliberately not classified**. So:
    - **As M, acting as Seed,** browse any company and press **Versions** on a project with a long history. If any row was saved by an older release, it reads **"This version can't be shown (file format 23). Nothing is offered in its place."**, has **no Open button**, and **offers no download of any kind**.
    - **Contrast, as M acting as Building Integrity:** Project ▾ → Open from cloud… → Current Projects → **Versions** on one of your own projects. An out-of-window row there still offers **"Download this version's file"**. That offer is honest on your own project and would be a hole straight through the cost redaction on somebody else's, so it is not on the browse path at all.
    - **Every one of your 19 saved versions is on format 24 today** (confirmed in 4A's pre-flight), so this row may simply not exist yet. **If it does not, note that and skip** — do not go looking for one.

22. ~~**(4C) As M, not T:** browsing that Rare Forms project, press **Ask for access**, type a short note, send…~~ **SUPERSEDED BY STEP 37 AND STEP 38 (4C, 2026-09-24).** This was a sketch written before the surfaces existed: it assumes a Rare Forms project already exists, does not say what the Ask note should read, and does not check that the granted share appears in the access list below. **Step 36 makes the ground, 37 asks, 38 grants and 39 checks that what came back is an ordinary Stage 3 grant.** Drive those, not this.
23. ~~**(4C) As N, not T:** ask for access on a different Rare Forms project. **As R:** press **Decline**…~~ **SUPERSEDED BY STEPS 40 AND 41 (4C, 2026-09-24)**, which add the two things this line leaves out: a decline has **no reason box anywhere**, and **re-asking after one is allowed** and says so on the row.

24. **A browsed project is in nobody's backup. As T, acting as Rare Forms:** Account ▾ → **Download company backup…**. Open the zip.
    - There is `projects/` (what Rare Forms owns) and, if anything has been shared with the company, `shared/` (what it was granted). **Nothing else.**
    - Open `manifest.json` and search it for the name of a **Building Integrity** project that R has only ever **browsed** — the one from step 20. **No entry, and no file anywhere in the zip.**
    - *(29: a backup may never contain more than its owner could export by hand, and a browsing company cannot export a browsed project at all. Stage 4 added no third source to the backup, which is what makes this true rather than merely tidy.)*

25. **Browsing is the acting-as state, never an ambient one. As R, not T, acting as Rare Forms** (not Seed): Project ▾ → **Open from cloud…**. There are **four tabs** — Current Projects, Past Projects, Proposals, Shared with us — and **no "Browse the consortium" at all**. Switch the Acting as box to **The Seed Collaborative (consortium)** and open the note again: the fifth tab is back. *(Rare Forms is a member company, and that is still not enough: you have to be acting as the co-op to browse it.)*

---

#### Hand-test batch — 4C, access requests (steps 36–45)

**Numbered from 36**, after 4B's 17–25 and the people page's 26–35, so the whole outstanding set can still be driven in one sitting. **These steps assume NOTHING from any earlier batch** — Stage 3's run was spot-checked rather than completed (2026-09-24) — so where a step needs a project or a share, it says how to make one. **Steps 22 and 23 are superseded by this batch**; they were written before the surfaces existed.

**The accounts are the same five as 4B's**, with **one browser or profile per account** (incognito windows share one sign-in — found in 3B's hand test):

| | Who | Address |
|---|---|---|
| **M** | ordinary Building Integrity member | `tommy.fieser@gmail.com` |
| **R** | ordinary Rare Forms member | `tommy.fieser+rare@gmail.com` |
| **R2** | a second ordinary Rare Forms member | `tommy.fieser+rare2@gmail.com` |
| **N** | ordinary New Frameworks member | `tommy.fieser+nf@gmail.com` |
| **T** | Tommy, the platform admin | `tommy@buildinteg.com` |

**No step here needs the browser console.** Desktop or phone either way; each step says where a wider screen is easier.

---

36. **Make the ground, so nothing later depends on an earlier batch. *(Skip any part you already have.)***
    - **A Rare Forms project to ask about. As R**, Acting as → **Rare Forms** → draw anything → Project ▾ → **Save as new cloud project…** → **Save**. Give it a name you will recognise, e.g. **Request Test One**. Repeat once more for a **second** one, e.g. **Request Test Two** — step 40 needs a different project from step 37's.
    - **A second Rare Forms member, for step 44.** If **R2** is not in Rare Forms yet: **as T**, Acting as → **Rare Forms** → Account ▾ → **Invite someone** → `tommy.fieser+rare2@gmail.com` → **Member** → Create invite link, then open that link in **R2's** browser.
    - **N in New Frameworks, for step 40.** If N is not a member yet: **as T**, Acting as → **New Frameworks** → Account ▾ → **Invite someone** → `tommy.fieser+nf@gmail.com` → Member → Create invite link, then open it as **N**.

37. **Ask for access. As M, not T.** *(Either screen; a wider one makes the note easier to read.)*
    - Acting as → **The Seed Collaborative (consortium)** → Project ▾ → **Open from cloud…** → **Browse the consortium** → **Rare Forms** → **Current Projects**.
    - The **Request Test One** row reads "Owned by Rare Forms › Current Projects · read-only, costs not shown" and offers **three** buttons: **Open**, **Versions** and **Ask for access**. Press **Ask for access**.
    - The note **Ask for access · Request Test One** opens. Check it says, in this order:
      - "Ask **Rare Forms** to share **Request Test One** with you. A member of theirs decides."
      - "This asks for you **personally, not for your company**. If it's granted, the project appears in **Shared with us** and **opens with its costs**, like any other project shared with you. **There's no email**: the answer shows up in Your access requests."
    - Type a short note — e.g. **Could we see how you detailed the gable?** — and press **Send request**. It answers: **"Your request was sent. You'll see the answer in Your access requests — there's no email."**
    - Press **Close**, then look at the **Request Test One** row again: it now reads **"You've asked for access — waiting for an answer."** and the **Ask for access** button is **gone**. *(That is deliberate: a second request while one is open writes nothing, so the button is not offered.)*
    - Open **Your access requests** (the fold-out at the top of the Browse the consortium tab). Request Test One is listed, **Owned by Rare Forms**, **"Waiting for an answer."**, with your note under it.
    - ***Optional, and the only way to see the "already asked" answer from the UI:*** open a **second window of M's browser** side by side, get both to the Browse the consortium tab **before** asking, ask in one, then press **Ask for access** in the other (its list is still the old one, so the button is still there) and **Send request**. It answers **"You've already asked for access to this project, and that request is still waiting for an answer. Nothing was sent again."** **Nothing is written twice.**

38. **The owner company decides. As R, not T.**
    - Acting as → **Rare Forms** → Project ▾ → **Open from cloud…** → **Current Projects** → **Access…** on **Request Test One**.
    - **Above** the grant rows there is a heading **"Asked for access"** and one row reading **"\<M's name or address\> asked for access"**, with **Note: Could we see how you detailed the gable?** under it, and two buttons: **Grant** and **Decline**. Under them: "Granting shares this project with that person, exactly as the box below would. You can remove it afterwards like any other share."
    - Press **Grant**. It answers **"Granted. It's an ordinary share now — it's in the list below, and you can remove it like any other."** The request row goes, and **a new grant row appears in the list below it**, naming M, "shared by \<you\>".
    - *(⚠ That last part is the whole point of 4C: a granted request is an **ordinary Stage 3 grant**, written by the same function the share box uses. If the grant row does not appear in the list below after a moment, say so.)*

39. **And it behaves exactly like any other share. As M, not T.**
    - **Reload the page.** A **"Shared with you"** notice appears naming **R** and **Request Test One** — Stage 3C's machinery, unchanged by this stage. Press **Got it**.
    - Project ▾ → **Open from cloud…** → **Shared with us**: **Request Test One is listed**, "Owned by Rare Forms".
    - Press **Open**, then open the **Project Summary** card: **the Price is a real number, not `—`**. A grant is a handoff (decision 24), so costs come with it.
    - Switch Acting as → **The Seed Collaborative (consortium)** → Open from cloud… → **Browse the consortium** → **Your access requests**: the Request Test One row now reads **"Granted by \<R's name\>. It's in Shared with us now, and it opens with its costs."**
    - **As R:** Access… on Request Test One again → the grant to M is there with a **Remove** button, like any other. *(Do not press it; step 44 wants the project still shared.)*

40. **A decline carries no reason. As N, not T.**
    - Acting as → **The Seed Collaborative (consortium)** → Project ▾ → Open from cloud… → **Browse the consortium** → **Rare Forms** → **Current Projects** → **Ask for access** on **Request Test Two** → **Send request** *(a note is optional; send it empty this time)*.
    - **As R, not T:** Open from cloud… → Current Projects → **Access…** on **Request Test Two**. N's request is listed, with **no** "Note:" line under it — an empty note is no note at all, not an empty line. Press **Decline**. It answers **"Declined. They'll see that it was declined, with no reason attached. Nothing was shared."**
    - **As N:** reload, then Open from cloud… → **Browse the consortium** → **Your access requests**. The row reads **"Declined by \<R's name\>. No reason is recorded."** — **there is no reason box anywhere, and none was ever asked for** (Open Item 4, your decision).
    - Still as N: **Shared with us** does **not** list Request Test Two. Go back to **Browse the consortium** → Rare Forms → Current Projects → press **Open** on it: it still browses, and **Project Summary's Price still reads `—`**. *(A decline changes nothing about browsing.)*

41. **Re-asking after a decline is allowed. Still as N.**
    - On the **Request Test Two** row, under the owner line, it reads **"Your earlier request was declined. You can ask again."** and **Ask for access is offered again**.
    - Press it, send a second request. It answers "Your request was sent." **As R:** Access… on Request Test Two shows N's request again, pending. **Leave it pending** — step 44 uses it. *(With no email and no notice channel there is nothing to spam, which is why re-asking is allowed at all.)*

42. **A project you can already read offers no ask at all. As M, not T, acting as Seed.**
    - Open from cloud… → **Browse the consortium** → **Building Integrity** → **Current Projects**. *(If Building Integrity has nothing there: **as M, acting as Building Integrity**, draw anything → Project ▾ → Save as new cloud project… → Save.)*
    - Its rows read "**· you can open this in full**" and offer **Open** and **Versions** and **nothing else** — **no Ask for access**. *(You are a Building Integrity member; there is nothing to ask for, and the database would answer "you can already open this project" and write nothing.)*
    - Press **Versions** on one of those rows and **Open** a version: the banner over the browsed design offers **no Ask for access** either. *(⚠ That is the path the 4C review caught: **Versions** is on every browse row, and `browse_version` always redacts, so a project you CAN open in full still arrives on screen as a browsed one. The banner is gated on the row's own access for exactly this reason.)*

43. **The note really does stop at 500 characters. As M, not T, acting as Seed.** *(Easier on a desktop, where you can paste.)*
    - Open from cloud… → Browse the consortium → **Rare Forms** → Current Projects → **Ask for access** on any row you have not asked about. *(If both Rare Forms projects already carry a request, make a third one as R, exactly as in step 36.)*
    - Under the note box it reads **"500 characters left"**, counting down as you type.
    - Paste a long paragraph — anything over about 500 characters; a couple of paragraphs of any text will do. **The box stops accepting at 500** and the counter reads **"0 characters left"**. Nothing is truncated silently after sending: what you can see is what goes.
    - Press **Close** without sending, unless you want the request.

44. **Any member of the owner company can decide — and your list is only yours. As R2, not T.**
    - Acting as → **Rare Forms** → Project ▾ → Open from cloud… → **Current Projects** → **Access…** on **Request Test Two**. **N's pending request from step 41 is listed**, with **Grant** and **Decline** — R2 never saw the request anywhere else and is not the person who was asked, but any member of the owner company may decide (the same set that may share and remove). Press **Grant**; a grant row to N appears below.
    - Still as R2: Acting as → **The Seed Collaborative (consortium)** → Open from cloud… → **Browse the consortium** → **Your access requests**. It reads **"You haven't asked anyone for access to a project."** — ⚠ **N's and M's requests are NOT in it**, even though R2 can see them on the project. *(If R2's own list shows somebody else's request, stop and tell me: that is the one thing this step exists to catch.)*
    - **As N:** reload → Browse the consortium → **Your access requests** → the second request now reads **"Granted by \<R2's name\>…"**, and Request Test Two is in **Shared with us**, opening **with its price**.

45. **Nothing new on the top bar, and the note fits a phone. As M, not T, acting as Seed.**
    - **On a phone** (or a narrow desktop window): the top bar carries the **same controls as ever** — Acting as, Account ▾, Project ▾, the editor tabs, Role and the gear. **There is no Ask, no Requests, nothing new.** Nothing about 4C lives on the bar.
    - Open from cloud… → Browse the consortium → Rare Forms → Current Projects → **Ask for access**: the note **fits the screen**, with nothing cut off at the right and no sideways scrolling of the page. **Send request** and **Close** are both reachable without scrolling sideways.
    - *(Checked in a headless browser at 360, 768 and 1200 too; this is the one that decides.)*

**Not provable except live, and said rather than skipped:** that a request written by one real account is decided by another real account **through PostgREST, cookies and RLS**, rather than through a mocked route — every check above is asserted in the RLS suite and in vitest, but only steps 37–44 put a real session, a real policy and a real browser on top of each other. And **`decided_by` never leaving the server** is proven in three vitest assertions and one browser assertion against a mock that deliberately carries one, but on live it is invisible by construction: if it ever did leak, nothing on screen would show it — which is why it is pinned in code rather than left to the eye.

**Not testable live, and said rather than skipped:** the non-member company branch ("neither sees nor is seen"). All four companies are consortium members today, and flipping a real company's flag is a platform-admin judgement call (28), not a test fixture. It is proven in the RLS suite only.

#### Coder handoff — to-do, one block per sub-stage

- **4A.**
  - **Scope:** `0009` and its RLS test, exactly as specified. No app code.
  - **Files:** `supabase/migrations/0009_stage4_browsing.sql`, `supabase/tests/stage4_rls.test.sql`, `supabase/README.md` (a Stage 4 section, pre-flight and post-flight, "run 0009 after 0008", and the new definer functions added to 0004's bypass list).
  - **Acceptance:** all four SQL suites and both concurrency scripts pass locally; every mutation in the table above fails the suite on its named assertion; one transaction, re-runnable, a copy broken before `commit;` leaves nothing behind; **`projects_select`, `project_versions_select`, `can_read_project`, `can_write_project` and `holds_project_grant` are byte-identical afterwards** (the per-object dump, as 3A did).
  - **Edge cases:** a version whose `schema_version` has no redaction row; a project owned by a company that has left the consortium (the flag is a judgement call, 28 — follow the flag, whatever it says); a grantee who is also seed-entitled (they must reach the full document through the grant, not the redacted one); `decide_collab_request` calling `share_project_with_person` as definer while `auth.uid()` is the decider.
  - **Not in scope:** any app code; widening any Stage 2 or Stage 3 object.
- **4B.**
  - **Scope:** browsing, the redacted read, and the export restrictions — together.
  - **Files:** `apps/web/app/api/browse/**` (new); `cloud/browseRouteLogic.ts` and `cloud/browseDisplay.ts` (every string, as `sharingDisplay.ts` holds Stage 3's); `cloud/redaction.ts` + `redaction.test.ts` (the classification map); `app/projectFile.ts` (the redacted-aware parse path — **a new exported function beside `parseProjectFile`, not a loosening of it**); `cloud/cloudTypes.ts` (the browse shapes; `consortiumLaterStageMessage` and `consortiumMenuMessage` replaced); `cloud/cloudMenu.ts`; `cloud/useCloudProjects.tsx` (the fifth tab, replacing the consortium branch at its folder-tab render site); `page.tsx` (`costsRedacted` threaded to the Price row, the Markup input gated); `TopBar.tsx`, `Building3DView.tsx`, `StandardPanel3DView.tsx` (the export controls gated).
  - **Acceptance:** hand-test steps 17–21 and 24–25 **as M, R and N**; every test in the TypeScript section above; no browse route imports the admin client; `tsc --noEmit` clean **including the exhaustive classification Record**.
  - **Edge cases:** **a browsed version list has no save notes and may name its author as "a member of *&lt;company&gt;*"** — both come back that way from the database and neither is a missing value to paper over or refetch; a browsed project renamed or moved by its owner while open; a browsed version whose format is out of window; a grant arriving while the browsed copy is on screen (the redacted copy stays until reopened — say so, do not silently swap it); `browseContext` and `cloudContext` never both set; the title-block date of a browsed version (it is that version's `created_at`, through the existing `cloud-version` writer).
  - **Not in scope:** access requests (4C); any change to the backup; widening `parseProjectFile`'s version window; adding the seven plaster/shipping prices to `ProjectState`.
- **4C.**
  - **Scope:** `collab_requests` end to end.
  - **Files:** the request routes, the Access note's request rows, the requester's own list, `cloud/browseDisplay.ts` for the wording.
  - **Acceptance:** hand-test steps 22–23; a granted request produces an ordinary `collaborators` row that the Shared tab, the 3C notice and the access list all already understand, with **no new grant-writing path**.
  - **Edge cases:** the same person asking twice; a request on a project whose grant arrives from elsewhere first; the requester's account deleted while a request is pending; a decline followed by a re-ask.
  - **⚠ Do not forward `decided_by`.** The requester can read their own request row, `decided_by` included — see "Two narrowings", item 4. The route serves `status`, `decided_at` and at most `decided_by_name`; the raw uuid is an `auth.users` id for someone at another company and must not leave the server.
  - **Not in scope:** email or any other notification channel (7); requests on behalf of a company (Open Item 3); a reason on a decline (Open Item 4).

**The coder re-runs the 6-point flags check against each diff.**

#### Not in scope for Stage 4

- Platform-admin cross-company UI, permanent-delete UI, single-version delete and the platform-wide backup (Stage 5).
- The departing-company judgement call (28) — the flag is followed, never set, by this code.
- The people/activity page and promote-to-admin (Stage 3 answer 15) — still its own short follow-up.
- Fixing the seven plaster/shipping prices' round-trip. **When it is fixed they become redaction targets**, and the classification `Record` is what will say so.
- A view-only tier for grants (Stage 3 answer 4: there is one access level).
- Any server-side rendering of drawings. 23 already records why that is the only design that would make export blocking real, and why it is not recommended.
- Search across the browse set, and browsing history or audit.

#### Open Items — Stage 4 (Tommy's decisions; each has a recommended default)

**Answered by Tommy 2026-09-20.** Asked directly: **item 5 — yes, tighten `shareable_companies()` to seed-entitled callers, in 4A's migration** (he was shown that it currently answers any signed-in account and undercuts the "neither sees nor is seen" branch Stage 4 depends on); **item 3 — personal requests only, and a decline carries no reason** ("Declined" is all the requester sees). Items **1, 2, 6 and 7 accepted as written**, including that his own company's work appears redacted while he acts as Seed — he was told it is decision 20 working, and that step 18 is where to eyeball it. Each item below is now a decision.

1. **⚠ How a redacted document is marked, given `priceModifier` is a required key.** **Default: remove the field, add a top-level `redaction` marker naming the removed paths, and add a redacted-aware parse path beside `parseProjectFile`** (no `PROJECT_FILE_VERSION` bump — the parser ignores unknown top-level keys). The alternative, keeping the key with `null`, avoids touching the parser but leaves a money key in the document, which is exactly what 21 says must not leave the server.
2. **⚠ Does the browse path also serve a project you can already read in full?** **Default: yes, always redacted, with the listing marking such rows so the UI opens them through the Stage 2 route with costs.** One always-redacting function has fewer branches and so fewer holes; the cost is that a mis-clicked row can show you your own project with `—`. The alternative is a refusal branch keyed to `can_read_project`.
   - **⚠ THIS ANSWER AND ANSWER 7 COLLIDE ON ONE ROW, and 4B found it. SETTLED BY TOMMY 2026-09-24: keep both doors, and say so.** `can_read_project` is membership-based, not acting-as-based, so a Building Integrity member acting as Seed gets `access = 'full'` on Building Integrity's own projects — where this answer says "open it with costs" and answer 7 says "show `—`". **Both are kept, on the same row, through two different controls:** the row's **Open** goes through the Stage 2 route WITH costs (this answer); the row's **Versions → Open** goes through `browse_version`, which always redacts for every caller (answer 7, and decision 20's ownership rule). It is also the only reading under which hand-test 18's two sentences are both literally true.
   - **What he was shown before deciding:** that both doors are defensible, that **neither leaks** — 4B's review attacked every path and found none reaching an owner's costs that should not carry them — and that **the risk here is confusion, not exposure**. He chose a sentence over a branch. The version list on a `full` row now carries a second line: *"Versions here always come with costs removed, even on a project you can open in full. Open the project itself to see it with its costs."* It is **not** shown on a `redacted` row, where there is no second door and the sentence would be a puzzle; `browseDisplay.test.ts` pins both halves.
3. **May a request be made on behalf of a company?** **Default: no — a request is personal, and grants a personal grant.** The owner can share with the whole company instead, which is a decision they should make deliberately.
4. **Does a decline carry a reason?** **Default: no free-text reason; the requester sees "Declined".** A reason box invites a negotiation the app cannot host, and it would be readable by everyone who can open the project.
5. **Tighten `shareable_companies()` to seed-entitled callers now?** (Stage 3 Open Item 4 said "revisit before onboarding a non-member company".) **Default: yes, in 0009** — Stage 4 is where the "neither sees nor is seen" branch finally means something, and leaving one function answering everyone undercuts it.
6. **⚠ The Shipping and Plaster Master dollar figures on a browsed project are the *viewer's own* defaults**, because those seven fields still do not round-trip. **Default: one line on those cards while browsing saying so.** The real fix is putting them in `ProjectState`, which is out of scope and which makes them redaction targets.
7. **⚠ Your own company's projects are redacted while you act as Seed** (decision 20's ownership rule). **Default: leave it exactly as decided**, and look at it once in hand-test step 18 before calling Stage 4 done.
   - **SETTLED BY TOMMY 2026-09-24, together with answer 2: left as decided, and now explained on screen.** The rule holds — the browse path always redacts, for every caller including a member of the owning company — and it sits beside answer 2's Stage-2 door on the same row rather than replacing it. **He was shown that both doors are defensible, that neither leaks, and that the risk was confusion rather than exposure**, and chose to keep both and say so. Hand-test step 18 still walks both buttons, so he sees the `—` on his own company's work with his own eyes; it is no longer his only chance to change it, because it is now decided.

#### Flags check: re-run against 4B's own diff, 2026-09-24 — clean

*(The plan's own check is below, unchanged. This is the coder's re-run against what was actually written, as the handoff requires.)*

1. **Clean.** `packages/` is untouched — `git diff --stat` on it is empty — so no `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` moved, and `data.ts` was not opened. The only numerals the app diff adds are **HTTP statuses** (400, 403, 404, 422), **schema versions** (23, 24), and **uuids, timestamps and fixture values in tests**. None is a building figure.
2. **Clean.** Nothing is marked `confirmed`; nothing is marked at all, because nothing real-world was added.
3. **Clean.** Every note added traces to a named source — a decision number (20, 21, 22, 23), an Open Item (1, 2, 6, 7), a plan section, or a SQLSTATE confirmed by running it on local PostgreSQL 17.4.
4. **Clean.** No structural figure is in scope.
5. **Clean.** Nothing new reaches the Review Log. *(Deliberate: the browse path adds no design value, and a "this was redacted" entry in the Review Log would put a note about another company's costs onto a printed sheet.)*
6. **Clean, and this is the point of the stage.**
   - **`priceModifier` moves in exactly one new direction: out of the document, before it is sent.** No new dollar figure is created, defaulted or displayed. **`—` and a named reason**, never a number; **`NaN` rather than 1.0 or 1.3** if a display gate is ever missed, asserted in `projectFile.test.ts`; **refuse to serve** an unclassified format rather than serve it; **no raw download** on the browse path; and export blocking described as friction, never as a guarantee — pinned by a banned-phrasing test over every string literal in `browseDisplay.ts`, not only the ones the test names.
   - **The seven plaster/shipping prices are treated as pending, not settled.** They are classified nowhere, because they are not in `ProjectState`; `cloud/redaction.ts` records that **the day they are added they become money and the build will not compile until each is classified**; and the browse path says in one line on both cards that those dollars are the viewer's own defaults, not the owner's (Open Item 6). That is a visible gap with a reason, not a plausible substitute.
   - **Test fixtures are marked as fixtures.** `redaction.test.ts`'s `ProjectState` fixture carries thicknesses, densities and spacings that are arbitrary and say so in a comment, because that test reads only the keys. They are not claims about a real building.
   - **Two places where the plan contradicts itself are flagged, not quietly resolved** — what `full` means on a browse row, and who gets the tab. Both are written up in "4B as built" with the reading taken and the one-line change if Tommy wants the other.

#### Flags check: clean, confirmed against the plan rather than assumed

1–4. **Clean.** No real-world building number is introduced or moved: no fastener spacing, load, density, dimension or cost figure. No `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is in scope, and `data.ts` is not touched.

5. **Clean.** Nothing new reaches the Review Log.

6. **Clean.**
   - **The one money-shaped field, `priceModifier`, moves in exactly one new direction: out of the document, before it is sent.** No new dollar figure is created, defaulted or displayed anywhere. The catalog list rates keep whatever status they already carry and stay visible to everyone, as 21 says they must.
   - **No new number of any kind is a building value.** The only numerals this plan adds are a schema version in a seed row, a 500-character request-note cap and HTTP statuses — administrative, and deliberately kept off the engineer's review list for the same reason as `INVITE_EXPIRY_DAYS`.
   - **The plan leans on the flag convention's own principle in five places**, which is the reason it is safe to build at all: `—` and a named reason instead of a defaulted price modifier; `NaN` rather than a plausible number if a display gate is ever missed; **refuse to serve** a schema version the redactor does not know, rather than serve it and hope; **no raw download** on the browse path, rather than Stage 2's honest-but-here-fatal offer; and export blocking described as friction, never as a guarantee.
   - **Nothing pending is treated as settled.** The seven plaster/shipping prices are named as not-yet-in-the-document and as future redaction targets rather than quietly assumed safe, and the non-member-company branch is marked as proven in SQL only, because no non-member company exists to test it live.

### People & activity page (2026-09-20) — BUILT 2026-09-21 on branch `people-activity-page` (all five Open Items answered; the cross-company list deferred; no migration and no SQL change of any kind)

**As built, and where it differs from this plan.** Three files changed and one was added: `apps/web/app/auth/peopleActivity.ts` (new — every label and every permission-display rule, pure), its `peopleActivity.test.ts` (50 tests), the extended `GET /api/companies/[id]/members`, and `auth/AccountPanel.tsx`. `PATCH /api/memberships/[id]` is untouched, as predicted: it already took `{ level }`. Three deviations, each recorded rather than smoothed over:

- **The count is one capped scan, not a grouped read.** PostgREST has no `group by`, and one `count` request per member is the round trip this plan rules out. So the route reads the company's most recent `VERSION_SCAN_CAP` (1,000) version rows once — no `document` — and tallies in memory. **A company past that cap gets counts that are floors, and the row then says "At least 12 versions saved in …" rather than presenting a floor as a total.** The cap and the 5-action list are the only two numbers added, both administrative.
- **A rename row is named but not quoted.** The plan's example reads "Renamed *Smith House* to 'Smith Residence'", but the new name lives in `document`, which this page never selects. As built the row reads **"Renamed Smith House (v6)"** — labelled as a rename, named by its project, and never guessing at what it was renamed to.
- **The button is "Remove admin", not "Make member"**, so the pair reads Make admin / Remove admin.

**Not done, deliberately: the three `stage1_rls.test.sql` assertions below.** Tommy's instruction for this pass was app code only, no SQL changes at all. The promotion rules were re-read in 0001/0002 and the UI matches them, but that SQL is still unwritten and is the one piece of this plan's Tests section outstanding.

Provenance: Tommy's direction is recorded verbatim under "Open Items — Backend, Accounts & Project Sharing", and he placed it as **a short follow-up directly after Stage 3** (Stage 3 answer 15). Stage 3 is complete, so it is due. This plan is deliberately small, and it was written against the live schema and routes rather than from the Open Item's description.

**The headline, and the reason this is short: it needs no new schema, and promotion needs no new route.** Everything Tommy described is already recorded, or is already permitted and simply has no button.

#### What the live schema already answers

| Tommy's words | Where it already lives | Verified |
|---|---|---|
| "their email" | `user_profiles.email`, already returned by `GET /api/companies/[id]/members` | `members/route.ts` |
| "how long they've been a member for" | **`memberships.created_at` exists** | `0001:134` |
| "how many edits they've made total" | `project_versions` rows where `author_id` is that person | `0006` |
| "latest actions each member has taken" | `project_versions` — `author_id`, `created_at`, `kind` (`save` / `rename`), `project_id` | `0006` |
| "upgrade a member to admin" | `memberships.level`, and **`PATCH /api/memberships/[id]` already accepts `{ level }`** | `api/memberships/[id]/route.ts:38` |

**No migration. No new table. No new route for promotion.** If a later pass wants an action this list cannot answer, that is new schema and a new decision — see Open Item 1.

#### "Latest actions" — the definition, and what it deliberately excludes

**An action is a version this person authored: a save or a rename.** That is the whole of it, and the honest reason is that it is the whole of what the app records.

- **Shown as:** "Saved *Smith House* v7 · 2 hours ago", "Renamed *Smith House* to 'Smith Residence' · yesterday" — the same words and the same `kind` caveat Version history already uses (`supabase/README.md`: `kind` is not proof of what changed, so a rename row is **labelled**, never trusted).
- **Not recorded anywhere, and therefore not shown:** sign-ins, opening or printing a project, folder moves (Stage 2: a move "creates no version"), backups, and browsing. **Proposing a general activity log for these is explicitly not done here** — it is new schema, it is a surveillance decision as much as a technical one, and Tommy asked for a short follow-up.
- **One cheap addition is available without schema and is left for Tommy:** shares are recorded (`collaborators.granted_by`, `granted_by_name`, `created_at`), so "Shared *Smith House* with Rare Forms" is answerable today. See Open Item 2.

#### "Total edits", scoped honestly

**"Edits" = versions authored.** But a count has to say *where*, because RLS decides what can be counted: `project_versions_select` is `can_read_project`, so a company admin can count a member's versions **in that company's own projects** and cannot see that member's work in another company (as a collaborator, or in the Seed tree).

- **The number shown is therefore "versions saved in *this company's* projects", and it is labelled that way.** A total across every company would be wrong for everyone except a platform admin, and silently wrong — the failure this log's flag convention exists to prevent.
- **On your own account page, the same rule**: your count is per company, for the company you are acting as.

#### "How long a member" — and its one honest caveat

`memberships.created_at` is **the membership's start, not the account's**. They differ, and the difference is real: Stage 3's hand-test step 7 removed and re-invited R2, so R2's Rare Forms membership now dates from that re-invite. The label says "member since 14 Sep 2026", not "joined the app", and a re-invited person's date is their **current** membership's. Stated rather than smoothed over, because it is exactly the kind of number someone would otherwise read as tenure.

#### Promotion — exactly who may promote whom, read from the migrations

| Caller | May change `level` on | Enforced by |
|---|---|---|
| **Company admin** | any membership **of a company they administer**, their own row included | `memberships_update` (0002:368) permits the row; `guard_membership_self_update` (0001:251) returns early for `is_company_admin(old.company_id)` |
| **Platform admin** | any membership, at any company | `is_platform_admin()` in the policy, `is_privileged_caller()` in the guard |
| **A plain member** | **nobody, including themselves** | the guard raises `42501: only a company admin can change a membership's level`. Self-update is narrowed to `is_default` alone |
| **Anyone** | **cannot** move a membership to another company or another person | the guard's first branch, checked **before** any early return — the privilege escalation found in the Stage 1 review |

- **Demotion is guarded too:** `guard_last_company_admin` raises `23514: a company must keep at least one admin`. So the last admin cannot demote themselves, and the UI must show that refusal in words rather than as a dead button.
- **So the whole of "make admin" is a button** on the existing people list, calling the existing `PATCH /api/memberships/[id]` with `{ level: "admin" }`. **Demote to member** is the same call with `{ level: "member" }`. **No route, policy, trigger or migration changes.** This closes README Stage 1 step 7, which has never been doable from the UI.

#### The cross-company view — the real decision, and the recommendation

Tommy: *"an entire list of everyone if viewing as the seed collaborative (or platform admin)."*

**Recommendation: build the per-company page now, and do not build the cross-company people list in this pass.** The reasons are structural, not scheduling:

- **`user_profiles_select` (0002:319) shows a profile only to `id = auth.uid()`, `shares_company_with(id)`, or a platform admin.** So "everyone" for an ordinary seed-entitled person is **zero rows** through RLS. Making it work means a new `SECURITY DEFINER` function that hands another company's people's **names and email addresses** across a company line — which is a genuine permission decision, not a UI detail.
- **It is a consortium read, so it belongs with the consortium read layer.** Stage 4 decides what acting as Seed reveals; a people list is another thing it would reveal, and decision 20 is about designs, not staff directories. **Emails in particular:** Stage 3 Open Item 8 already records that the app reveals whether an address has an account to anyone who can share a project — spreading addresses further is a step past that, not a continuation of it.
- **Stage 3 Open Item 4's live caveat is the warning shot:** `shareable_companies()` already answers **any** signed-in account, so company *names* have leaked past the consortium boundary once without anyone deciding it. Stage 4's Open Item 5 proposes tightening exactly that. Adding a cross-company people view in the same week would widen the boundary while the other hand is narrowing it.
- **A platform admin already has the access**, so the one part that is free is: **acting as any company, a platform admin sees that company's page** — which the existing `isAdminHere` gate already produces, because the policies treat them as an admin everywhere. That covers Tommy's "(or platform admin)" half at no cost.

See Open Item 3. If Tommy wants the full cross-company list, it is a Stage 4 companion, not this pass.

#### Attribution after someone leaves — the trap this page must not fall into

**The page must never resolve `project_versions.author_id` to a profile row.** That is the exact defect the `author_name` snapshot was created to avoid: once a leaver's membership is revoked, `user_profiles_select` stops showing their profile to their former colleagues, so a join-on-read shows a blank author precisely when attribution matters (decision 6, and 0006's own comment).

- **Any name beside an action comes from `author_name`**, as Version history already does.
- **A leaver simply drops off the people list** — the list is built from `memberships`, and they have none. Their saved work and their name stay exactly where they are.
- **The activity rows are counted by `author_id`** (a uuid comparison needs no profile read) and **labelled by `author_name`**. `author_id` may name a deleted account; nothing here grants access by it (Stage 2 Open Item 8).

#### Routes

| Route | Change |
|---|---|
| `GET /api/companies/[id]/members` | **Extended**: each member gains `memberSince` (`memberships.created_at`), `versionCount`, and `recentActions` (the latest few). Still RLS-decided, still no `requireEntitlement` — a plain member gets back only their own row, which is exactly what "each account can see these stats on their account page" needs. |
| `PATCH /api/memberships/[id]` | **Unchanged.** It already takes `{ level }`. |
| Everything else | **Unchanged.** No new route. |

- Counts and recent actions are read with `.eq()`/`.in()` on ids the database just returned, never spliced into a filter string (`listProjects`' rule).
- **`document` is never selected.** A count and a `created_at` need no document, and a project name for an action row comes from `projects.name`.
- One round trip per member is not acceptable for a company of twenty: counts come from one grouped read over `project_versions` filtered to that company's project ids, and recent actions from one ordered read with a small cap. **Cap the action list at 5 per member** — an administrative number, not a building value. **As built:** there is no grouped read to have — PostgREST has no `group by` — so it is *one* capped, ordered read (`VERSION_SCAN_CAP = 1000`) serving both the counts and the action lists, with the "At least …" label when the cap is hit. Four reads in total, whatever the size of the company.

#### UI

- **It extends the existing section**, `{company} — people` in `auth/AccountPanel.tsx` (the list at ~276–291, above the invite form and the 2D backup entry). **Nothing is added to the top bar** (Stage 2 Open Item 6).
- Each row today reads `email · level` with **Remove**. It gains: **member since**, **N versions saved**, the latest actions (collapsed, expandable), and **Make admin** / **Remove admin** (built under that name rather than "Make member").
- **Make admin asks for confirmation once**, naming what it grants: "An admin can invite and remove people, change levels, and download the company backup." Nothing in this app is undoable by accident.
- **A refused demotion shows the database's own meaning in words**: "A company must keep at least one admin. Promote someone else first." (`23514` from `guard_last_company_admin`.)
  - **Verified in review (2026-09-21), not assumed.** The coder mapped on a substring read from the migration source without ever running a probe; the reviewer ran one against 0001–0008 and confirmed the raise is SQLSTATE `23514` with exactly that text, and that it survives every hop: the PATCH route's `HttpError(403, error.message)` → `errorResponse`'s `{ error }` → `AccountPanel`'s `call()` → `levelErrorMessage`'s `includes("at least one admin")`. **Only the PostgREST → supabase-js hop is live-only**; if the text ever failed to survive it, the user would see the raw database sentence rather than a generic error — unpolished but honest, and the pre-emptive refusal on the row is independent of it.
  - **Follow-up DONE 2026-09-21 (deferred in the first pass):** `levelErrorMessage` forwarded **raw database text** as its fallback for any refusal that is not one of its two mapped substrings — for example `a membership cannot be moved to another company`. Everywhere else this codebase refuses to surface database text (see the 2B/2C route error mapping). A generic fallback ("Couldn't change that level — reload the page and try again") would close it, keeping the two mapped sentences. Done as its own small change at Tommy's request, reviewed before it was pushed: unmapped refusals now return `LEVEL_CHANGE_FAILED` ("Couldn’t change that level — reload the page and try again."), the two mapped sentences are unchanged, and a test asserts the reviewer's example never reaches the page verbatim. **The same review found the message could lie the other way:** the list reloads sat inside the same `try` as the change, so a successful promotion followed by a network blip on the reload said "Couldn’t change that level". `changeLevel` now puts only the PATCH in the first `try` and returns on failure; the reloads have their own, which reports `LEVEL_CHANGED_RELOAD_FAILED` ("Level changed. Reload the page to see the updated list.") as a notice, not an error, and any earlier notice is cleared first so it can't linger beside the new result.
- **Your own stats, for a plain member:** the same section renders with one row — yours — and no Make admin, no Remove, no invite form. That is what RLS already returns them, so the page is the same component, not a second one.
- **A platform admin acting as a company** sees that company's page, as they already do for the people list and the backup.

#### Tests

- **Unit (vitest), the established style:** the summary shape; "member since" formatting, including a date the strict parser rejects → a visible gap, never today's date; the count labelled per company; an action row for a `rename` labelled, never collapsed; **a test that no name is read from `user_profiles` for an action row** (source-level, as `sharingRouteLogic.test.ts` does).
- **SQL: STILL OUTSTANDING after the 2026-09-21 build** — that pass was app code only, by instruction, and wrote no SQL. No new migration, so no new suite. **Add three assertions to `stage1_rls.test.sql`**, where the promotion rules already live: an ordinary member changing their own `level` raises 42501; a company admin changing a member's level in their own company succeeds; the same admin changing a level at another company affects 0 rows. *(Check first whether the existing suite already covers the first of these — it carries the row-move attack and four variants — and do not duplicate it.)*
- **Mutation check:** gating the Make admin button on `actingAsLevel` instead of the existing `isAdminHere` must fail a test — that is the exact bug the 2D review found, invisible to a platform admin.

#### Hand-test checklist — short

Accounts as before, **one browser or profile per account** — a step marked "as M" or "as R" proves nothing if it is done in T's browser. **Numbered from 26**, because Stage 3's outstanding steps are 11–16 and Stage 4 has reserved 17–25. These can run in the same batch as Stage 3's outstanding steps.

26. **As T, acting as Building Integrity:** Account ▾ → **Building Integrity — people**. M's row shows their email, "Member since …", "N versions saved in Building Integrity's projects", and **Latest actions (n)** — press it and check the newest save is at the top and that a rename says "Renamed …". If T holds no admin **membership** at Building Integrity — check T's own row: it says `member` — then the buttons appearing at all is the platform-admin case working. If T's row already says `admin`, this step still passes; it just doesn't prove that case. *(Corrected in review: T's Building Integrity membership level is not recorded anywhere the reviewer could check, so the original sentence asserted something that may be false.)*
27. **As T:** press **Make admin** on M's row. The sentence naming what it grants appears ("An admin can invite and remove people, change levels, and download the company backup."). Press **Yes, make admin**. M's row now reads `admin`.
28. **As M, in M's own browser:** reload. The invite form and the company backup entry have appeared, and M's own row shows M's own stats.
29. **As M:** press **Remove admin** on M's own row. If M is Building Integrity's only admin, the row already reads "A company must keep at least one admin. Promote someone else first." and pressing it says exactly that — **no raw error, and no dead button.** If another admin exists, it succeeds and M's own controls disappear on reload.
30. **As R, in R's own browser** (an ordinary Rare Forms member): Account ▾ shows **one** row — R's own — with R's stats, **no** Make admin, **no** Remove, and no invite form.
31. **As R:** confirm R's count covers Rare Forms' own projects and **does not** include the Building Integrity project shared with R in Stage 3 step 1, which R saved to. *(The per-company scoping, working — and the line under the list says so.)*
32. **As R2**, who was removed and re-invited in Stage 3 step 7: R2's **"Member since" is the date of the re-invite**, not the date R2 first joined. That is the caveat this page states in words; this step is what confirms the words are true.
33. **As N**, an account that has saved nothing here: the row reads "No versions saved in …'s projects" and "No saves or renames here yet" — an honest empty state, not a zero dressed up as activity.
34. **As T:** revoke a test member's membership, then confirm they vanish from the people list while **their name is still on their versions** in Version history.
35. **As T, at 360, 768 and 1200 (a real phone for the first):** the top bar is unchanged — nothing was added to it — and the people rows stay readable at the narrow width.

#### Open Items — People & activity (each with a recommended default)

**Answered by Tommy 2026-09-20.** Asked directly: **item 3 — the cross-company "everyone" list stays out of this pass**, revisited with Stage 4, where that boundary is being decided anyway; he was told a platform admin already reaches any company's page by acting as it, which covers half of what he originally asked for at no cost. Items **1, 2, 4 and 5 accepted as written**: "latest actions" means saves and renames only, shares are not added yet, company admins see full action rows rather than counts, and any company admin may promote with no second approval. Each item below is now a decision.

1. **Is "latest actions" saves and renames only?** **Default: yes.** Anything else — sign-ins, opens, prints, folder moves — is not recorded, and recording it is new schema plus a decision about watching people, which is more than Tommy asked for.
2. **Add shares to the action list?** **Default: no, not in this pass** — but it is available with no schema (`collaborators.granted_by` + `granted_by_name`) if he wants it, and it is the one addition that costs almost nothing.
3. **⚠ The cross-company "everyone" list while acting as Seed.** **Default: not in this pass.** It needs a definer function to hand another company's people's names and emails across a company line, it is a consortium-read decision, and it lands in the same week Stage 4's Open Item 5 proposes *narrowing* that boundary. A platform admin already sees any company's page by acting as it, which covers half of what he asked for at no cost.
4. **Does a company admin see another member's action rows in full, or only counts?** **Default: in full** — they can already open every version of those projects and read the author on each, so the page shows what they could already assemble by hand. (The same "convenience, not a security boundary" wording the backup carries.)
5. **Does "make admin" need a second admin's agreement?** **Default: no.** Any company admin may promote, as Tommy said. The only refusal in the system is the last-admin guard, which protects the company rather than the person.

#### Flags check: clean

1–4. **Clean.** No real-world building number is introduced or moved. No `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is in scope, and `data.ts` is not touched.

5. **Clean.** Nothing new reaches the Review Log.

6. **Clean.**
   - **No new number of any kind is a building value.** The only one added is administrative: 5 recent actions per member.
   - **No cost field is involved at all.** This page reads names, dates and counts; it never reads `document`, so `priceModifier` is nowhere near it.
   - **The convention's own principle is kept in three places:** a count is labelled with the company it covers rather than presented as a total it is not; "member since" shows a visible gap for a date the strict parser rejects, never today; and a leaver's name comes from the `author_name` snapshot rather than a profile join that would quietly go blank.

---

## Project Smearforn — drawing a real job (2026-09-24) — STAGES 0, 1, 1r AND 2 BUILT (1r and 2 on 2026-09-25); Stages 2b, 3, 4, 5 still planned

The first time this app has been asked to reproduce an **engineered job** rather than a demo. Tommy's hard goal: **create his current project in the app by Monday evening, 2026-09-28.** This is editor work only — no backend, no schema beyond one project-file version bump, nothing in `supabase/`.

**Build order confirmed by Tommy, 2026-09-24: 4C → Smearforn → Stage 5.** His words: *"I like 4c then Smearforn then admin tooling."*

### Provenance

Tommy supplied two PDFs from the live job — **ROGERS-SEHORN ADU, job 26024, Columbia MO**, marked NOT FOR CONSTRUCTION — at `C:\Users\Tommy\.claude\uploads\1ed28836-38c7-4ff8-85f8-37ffe3336029\` (`12e19972-2026-09-15_Engineering_Sheets.pdf`, `3ac6daf8-09-16-26_CUT_LIST.pdf`). Facts below were extracted with `pdftotext -layout` and **re-read and verified** against both PDFs. (A byte scan of a PDF returns glyph noise — a trap already recorded in the 4B as-built note. Don't.)

He later uploaded a third source: **shop drawings drawn by Cameron on his team**, in SketchUp with open-cut extensions. Those drive the separate shop-drawing workstream below, not the editor stages.

### The evidence, and what it demands of the editor

- **60 panels**, labelled by wall: **N1–N5, E1–E12, S1–S12, W1–W12.** The app emits `${direction}-${n}` (`panelInstances.ts:282`) — the same scheme with a hyphen, **now dropped to match** (see the nomenclature workstream, and the stencil rack that decided it).
- **Sub-panel suffixes**: `E4A/E4B/E4C`, `S3A/S3B/S3C`, `W4A`. These are Tommy's "triple panel headers" — **now settled, see "The triple header" below.**
- **Irregular widths**: 43", 41½", 37½", 35", 31½", 30", 29½", 28½", 25½", 24", plus plan dimensions like 5'-1¾" and 3'-2½". Every one is a whole eighth, so the 1/8in grid holds with room to spare, and **every one is ≥24"**.
- **14" is the panel DEPTH, not a width** — the job uses the 14" option from `looseDensePackThicknessOptionsIn` ([14, 15.5, 15.75]) throughout. **An earlier draft of this section read it as a 14" panel width and built an Open Item on top of that; corrected here rather than quietly edited**, because the mistake had already propagated into the Stage 1 rule and the flags check. The 21" figure that sat beside it in the same draft is gone for the same reason: **on re-reading, no panel width in this job is under 24".** The lesson is the boring one — a bare number off a cut list has a unit and an axis, and both have to be read before it means anything.
- **"SAFETY GAP"** appears repeatedly. The app has Safety/Gap panels, but it *places* them by rule (gap end, second-to-last); it has no way to put one where a drawing puts one.
- One wall is annotated **"FRAMED WALL OF GARAGE - FOR REFERENCE"** — which, per Tommy's answer below, the app does **not** need to draw.

**The ADU is this plan's acceptance test.** Every sub-stage below closes with what of the 60-panel schedule it reaches.

### The minimum panel width — SETTLED 2026-09-24, and it uncovers a pre-existing defect

Tommy, unhedged: *"I can't make any panels that are left to right elevation view shorter than 2'. This project is a 14" thick panel."*

That is **24 inches, measured left-to-right in elevation**, and it is a **manufacturing** limit — a statement about what his shop can physically build, not a design preference. The same sentence confirms the depth/width distinction a second time.

#### How to record it — and specifically what NOT to overwrite

**`panelWidthInRange.minIn` stays at 15.75.** Its note — "300-400mm on the mfr spec sheet, translated 1:1" — is **true, sourced and about a different thing**. The manufacturer's floor and Building Integrity's working minimum are two separate facts, and the honest model keeps both. Overwriting the mfr number with Tommy's would destroy a traceable source to record an unrelated one, which is the exact failure the `status`/`note` convention exists to prevent.

**Add a new value beside it**, in `packages/panel-catalog/src/data.ts`:

- **`status: "confirmed"`.** Tommy is Building Integrity, and this is a first-hand statement about his own shop's capability. It meets the convention's definition ("traceable to Building Integrity") on the nose.
- **⚠ The one thing that would make it `pending`:** if anyone finds themselves *interpreting* rather than recording. He gave a number, a unit and an axis. Nothing is being inferred. **If the coder has to reason about what he meant, that is the signal to downgrade it** — flags-check point 2 exists for precisely that moment.
- **The note quotes him verbatim**, including "left to right elevation view", because the axis is the part that was misread once already in this very section.
- **Name it for what it is** — the narrowest panel the shop can build, e.g. `fabricationMinPanelWidthIn`. **Do not name it anything that reads as a twin of `panelWidthInRange.minIn`**; two similarly-named minimums one line apart is how the wrong one gets used.

#### What the app does between 15¾" and 24"

- **Typed entry: refuse.** Not a warning. A user cannot ask for a panel the shop cannot build, and the whole point of a manufacturing limit is that it is not negotiable at the keyboard. The field keeps focus, states the limit, and does not commit — the same shape as the existing "no room left" refusal.
- **`PANEL_DRAG_FLOOR_IN` is this number, not a coincidence.** Settled. The drag floor **becomes a consumer of the new catalog value** and the local `24` is deleted. `PANEL_DRAG_SNAP_TOLERANCE_IN = 2` stays exactly where it is — the ±2" snap window and the role-handoff are genuine ergonomics and are unaffected. One number, one definition, two consumers.
- **⚠ Existing saved projects open regardless. Limits are enforced at the point of EDIT, never at LOAD.** A stored design containing a narrower panel opens, draws, prices and prints exactly as before; the narrow panel is reported in the Review Log. **A file must never become unopenable because a limit tightened** — the same principle `parseProjectFile` already applies to a damaged timestamp ("still a loadable design, so it must not be rejected") and that the v23→v24 pass applied by repairing rather than re-tiling.

#### The defect this uncovers: the tiler already emits panels it cannot build — and the fix is ABSORB

**Pre-existing, not caused by Smearforn.** `computePlainSizing` (`tiling.ts:190-195`) splits a leftover across two panels: `distributeEighths(standardEighths + remainderEighths, 2)`. With the 40" standard width each half lands between **20" and 40"**, so a wall with a small leftover routinely produces **two ~20" panels**. `buildEvenMiddle` divides short walls into equal pieces with only a `Math.max(1, …)` floor. **Neither knows about a minimum**, so the app can hand a shop a cut list containing a panel that shop cannot make.

**DECIDED 2026-09-24 — absorb: one wider panel instead of two narrow ones.** Tommy chose this over report-only, over widening the safety gap, and over refusing the wall length.

**The rule:** where the two-way split would put either part under 24", **do not split** — emit a single panel of `standardWidth + remainder` instead. The run loses one panel and keeps its exact total.

#### ⚠ Absorb vs. the 48" ceiling — worked out, and it is total by one eighth of margin

The obvious objection is that absorbing pushes a panel past `panelWidthInRange.maxIn` = 48". **It cannot — and the reason is worth writing down because it is a coincidence of two numbers, not a property of the algorithm.**

Work in eighths. Let `S` = standard width, `r` = remainder, `F` = 24" floor, `C` = 48" ceiling.

- **The split is legal** iff its smaller part clears the floor: `floor((S+r)/2) ≥ F` ⟺ **`S + r ≥ 2F = 48"`**.
- **The absorb is legal** iff the single panel clears the ceiling: **`S + r ≤ C = 48"`**.

**The two conditions are exactly complementary.** Every value of `S + r` satisfies at least one, they overlap only at `S + r = 48"` precisely, and therefore **every wall has a legal tiling**. Concretely at the 40" default: absorb fires only when `r < 8"`, and the absorbed panel is `40" + r < 48"`. When `r ≥ 8"` the split already clears 24" and nothing changes.

- **Tie-break at exactly 48":** both are legal (one 48" panel, or two 24" panels). **Split wins** — it preserves today's behaviour at that point and keeps panels nearer the nominal width. Arbitrary but fixed, same discipline as `distributeEighths`' absorber rule.
- **⚠ The margin is ZERO, and this is the sentence to remember: the policy is total only because `maxIn` is exactly twice `minIn`.** Raise the minimum to 25", or lower the maximum to 46", and a band of wall lengths becomes genuinely untileable with no legal answer at all. **Any future change to either number must re-check this**, and the invariant test should assert `maxIn ≥ 2 × minIn` directly so the coupling fails loudly instead of silently producing an impossible wall.
- **Tommy explicitly rejected "refuse the wall length"**, so there is no fallback refusal to hide behind. That is survivable *only* because the analysis above shows no refusal is ever needed.

#### The residual cases absorb does not reach

Three paths can still produce a sub-minimum panel, and none of them has anything to absorb into. **These get a Review Log entry and no behaviour change:**

1. **A middle budget under 24" with nothing else on the run** — reachable on a wall that owns two corners and is between 51" and 75" long (e.g. a 6ft bump-out return), leaving a 0–24" middle. `floor(b/24) = 0`, so no legal panel count exists at all. **The likely real fix is the merged-corner precedent** `resolveCorners` already uses for a wall too short for both corners — extend "too short for both" to "too short for both plus a legal middle". That is a change to corner geometry, which is real construction. **Not invented here** — Open Items.
2. **`rawStandardCount === 0`** (`tiling.ts:183-189`) — openings eating all but a sliver of a long wall's middle. The sliver's neighbours are openings and corners; there is no standard panel to absorb into.
3. **`resolveCorners` clamping** a single corner to a wall shorter than 25.5". A degenerate wall.

#### What absorb does NOT change

- **The safety gap is untouched.** It is a fixed 0.75" reservation taken off the budget *before* the standard run is sized; absorption happens inside the run. Tommy rejected widening it, and nothing here widens it.
- **The corner is untouched.** `buildPlainMiddle` deliberately places resized panel(s) next to the gap and never corner-adjacent, so that the mandatory corner-touching brace never lands on a borrowed panel. Absorption changes the *count* of resized panels from two to one; **it does not change where they sit.** Corner panels stay at 25.5" (comfortably over the floor).
- **⚠ One interaction to test rather than assume:** `applyBracedPlacement`'s corner-brace-combining rule fixes a safety-gap slot to `standardWidth + 0.75"` and sheds the difference onto the nearest standard panel. **That shed can push an absorbed panel back out of [24", 48"]** — it is the one place where a legal tiling can be made illegal after the fact.

#### ⚠ Existing saved projects: the boundary already exists and must not be crossed

**Limits are enforced on EDIT, never on LOAD.** A saved design keeps exactly the panels it was saved with and only re-tiles when something actually edits that wall.

**The boundary is already in the code and already documented**, which is why this needs no new machinery: `repairStateToEighths` runs at load and is deliberately *"NOT a re-tile. Re-tiling would be simpler and would throw away every manual panel-mover adjustment"*. The absorb rule lives in `computePlainSizing`, which only runs on a re-tile. **So the single instruction is: nobody adds a re-tile-everything call to the load path.**

Two consequences, stated rather than discovered:

- **When the user does edit a wall, that wall re-tiles under the new rule and its panel count can change under their hands.** That is visible and on the wall they are working on — acceptable. What would not be acceptable is it happening to every other wall at load.
- **A cut list already issued for a saved project can therefore disagree with a fresh export of the same project.** This is the *second* cause of the same problem always-renumber creates. **Both are covered by the same fix:** the sheet revision identity specced in Stage 5.

#### Three neighbours in `data.ts`

- **`sillMinWidthIn` moves 23.625" → 24" — DECIDED 2026-09-24: sills follow the 2' rule.** A Building Integrity value **superseding** the manufacturer's, given the same treatment as the panel minimum: `status: "confirmed"`, Tommy's words as the note, and **the manufacturer's 600mm/23.622" figure and its provenance preserved inside the note rather than deleted**. Not silently rounded — the change is visible in the Review Log, because a dimension moving because a shop said so is exactly what a reviewer should see. **Note for the coder: it is currently a bare `export const` with a comment, so this is also a type change to `CatalogValue<number>`** — every consumer gains `.value`, and `data.test.ts:58` and `:94` encode the old figure and get rewritten to assert the new value *and* that the note still carries the manufacturer's number.
- **`columnMinWidthIn = 16.75` is below 24" but harmless** — a column's real built width is 25.5". Noted so nobody "fixes" it.
- **The Safety/Gap panel (0.75") is not a panel for this purpose** — a plywood spacer with "no studs, plates, or girts at all" per `buildSafetyGapMembers`. **It must be exempted explicitly**, or the Review Log fills with false positives on every wall over 12ft.
- **⚠ The Standard width project setting must be floored at 24" too.** It is user-editable in Panelizer (`page.tsx:5273`) and its title currently advertises the manufacturer's 15¾"–48" range. Setting it to 20" would make *every* plain panel unbuildable, which no amount of absorbing fixes. Clamp it to the same catalog value and update the title.

---

### The architectural question: what is a hand edit, and what survives?

Today a wall is panelized automatically from its length and settings. Tommy is asking for hand edits that **survive**: *"Ideally there would be fairly isolated movements with these tools rather than repanelizing the wall and reverting it back to something else."*

**First, a plain restatement of what he is actually asking for, because it changes the design.** Every one of these operations will still re-run the tiler for that one wall — that is how corner ownership, the gap-panel rule, the safety-panel threshold and the sum invariant stay true. What must stop is **losing work**. The goal is not "don't re-panelize"; it is "re-panelizing is lossless." Anything else forks the tiling pipeline.

#### The decision: an override layer per slot, and it mostly already exists

**Verified in the code, not proposed from scratch.** `PanelSlot.lockedWidthIn` (`packages/geometry/src/types.ts:117`) is already exactly this: a per-slot fixed-width reservation set by the panel-boundary drag (`page.tsx:2077` `handleDragResizePanels`), re-applied after every retile by `reconcileBracedPlacement` (`bracedPlacement.ts:420-427`), repaired onto the grid at load by `repairWallToEighths` (`eighths.ts:236-245`), and already serialized and already classified in `cloud/redaction.ts`. The same file already carries the same "absent = automatic, present = the user decided" convention on `heightIn`, `sillHeightIn`, `bracedPattern`, `zones`, and `secondaryType`.

**So: an override layer, not a switch to a manual list.** Rejected explicitly:

- **"Once touched, the wall becomes a hand-authored panel array."** It would have to re-implement corner ownership, the merged-corner rule, gap placement, the safety-panel threshold, opening anchors, zone reconciliation and the sum invariant for the manual path — i.e. a second copy of the tiler that drifts from the first. Everything in this app that preserves user intent across a retile does it by **anchor + reconcile**, never by freezing.
- **A separate `overrides` object beside the slots.** A second place for a width to live, which then has to be kept in sync with the slot it describes. `lockedWidthIn` is already on the slot.

#### The one genuinely new mechanism: pinned slots are anchors

The override layer covers *widths*. It does **not** cover *count* — and inserting a panel changes the count, which today is a pure function of `budget ÷ standardWidthIn` (`computePlainSizing`, `tiling.ts:150-205`). A retile re-derives the run and `reconcileBracedPlacement` maps old markers onto new positions by ordinal; an extra hand-inserted panel has no new position to land on and is dropped. **That is the silent revert Tommy is naming.**

The fix is already in the building, one concept over. `retileWithOpenings` (`tiling.ts:501`) treats each opening as a **fixed-width reservation at an anchored ordinal**: it subtracts the opening widths from the budget, tiles the remainder, and re-inserts the openings at `beforeStandardCount`. Everything a hand-inserted panel needs.

**Decision: generalize `OpeningAnchor` to a slot anchor.** A pinned standard/braced slot becomes an anchor exactly as a window is: its width comes out of the budget, its ordinal fixes its position, and the free run tiles around it. Consequences, stated:

- **The sum invariant holds by construction** — the budget arithmetic is already integer eighths (`toEighths`/`distributeEighths`), and reserving one more fixed width changes nothing about that.
- **`reconcileBracedPlacement`'s re-force loop becomes a no-op for pinned slots** (the retile already emitted them at their pinned width, so `deltaIn ≈ 0` and `shedWidthToNearestUnlocked` never fires). **Verify that rather than delete it** — the same loop still serves the combined safety-gap+brace case in `applyBracedPlacement`, which is a different customer.
- **`getOpeningAnchors` grows to emit pinned standard-family anchors too**, and every caller that builds anchors by hand (`handleSetWindowWidth:2353`, `handleToggleOpening`, `retilePreservingOpenings`) inherits it.
- **One tiler invariant has to be restated.** The property test asserts *"no `standard` slot exceeds `standardWidthIn`"* (spec, "The invariant needs a test"). A hand-pinned 43in panel against a 40in standard width breaks that as written. **The rule applies to tiler-generated slots only**; a pinned slot is bounded by `panelWidthInRange` instead. The coder updates the assertion deliberately, with a comment saying why — not by loosening it until it passes.
- **No new persisted field, and therefore no version bump, for typed widths or insert.** `lockedWidthIn` is already in the file. This is the strongest single argument for this design.

#### What happens when the wall changes afterwards

Four rules. A silent revert and a silent keep-that-no-longer-fits are equally bad, so neither is allowed.

1. **A pin survives any change that leaves room for it.** Wall lengthens or shortens, a window is resized, a neighbouring wall's corner ownership flips — the free run absorbs it and the pins hold. This is the common case and it is already how openings behave.
2. **The sum invariant outranks the pin.** When the pins plus the fixed slots exceed the wall, the invariant wins and the pins that do not fit are **released** — their `lockedWidthIn` is cleared, their width returns to the tiler. Never a wall whose panels do not add up.
3. **A release is always visible.** Two surfaces: the wall carries a **"hand-edited (n)"** badge in the elevation and Panelizer while pins are live, and a release raises a non-modal notice naming the wall and the count — the same shape as the existing `windowWidthClampNotice` / `sillClampNotice` (`page.tsx:2340-2346`), which is already the house pattern for "we changed your number and here is why".
4. **Direct wall-length edits refuse instead of releasing.** Typing a wall length (or dragging a wall) that cannot hold its own pins is clamped at the minimum that can, with the same notice — because that gesture has an obvious right answer and destroying six hand-set widths to honour a typo is not it. Indirect changes (a bump-out, a thickness change, a corner flip) have no such clean floor and take rule 2.

**Changing panelization type clears pins, with a confirm.** Square Bale locks panel width to 39in; a pinned 43in panel is not a square bale panel. This is a deliberate discard, announced, not a silent survival.

#### Getting back to automatic

Three exits, all explicit:

- **Per panel** — a reset control beside the width field in the Selected Panel note clears that slot's `lockedWidthIn`. One panel returns to the tiler; the wall re-tiles; everything else holds.
- **Per wall** — a **"Re-panelize this wall"** button clears every pin on that wall and runs the plain tiler. Confirmed by a dialog that names the count: *"This clears 9 hand-set widths on wall E."*
- **Per project** — unchanged. Existing full-retile paths (new footprint draw, panelization-type change) already rebuild everything and now say so.

#### The 1/8in grid, and the one snap that has to come with this

Typed widths go through the existing `LengthInput` (`domain="in"`), which already parses `41 1/2`, `41½`, `41-1/2` and snaps to the eighth on commit — Stage 0 of the grid work, BUILT 2026-09-06. Nothing new is needed for typing.

**But the panel-boundary drag is still unsnapped.** `WallElevationDiagram.tsx:874` says so outright: *"continuous, inch-based, NOT slot-snapped"*. That is the grid work's Stage 2 (the input-snapping layer), not built. Leaving it means a drag immediately walks a hand-set width off the grid, where the load-time repair silently absorbs it — the exact quiet-correction failure the grid section exists to prevent. **Fold the panel-boundary drag's own eighth-snap into Smearforn Stage 1**, and only that one gesture; the rest of grid Stage 2 stays where it is. Snap the *boundary position* and derive both widths from it (`leftWidthIn = boundary − pairStart`, `rightWidthIn = pairEnd − boundary`), which is what the grid section already specifies so the pair total cannot drift.

**One note for whoever reads `repairStateToEighths` next.** Its doc comment (`projectFile.ts:458-464`) describes a wall whose widths miss the tiling target as *"hand-edited state, a synthetic fixture, or a footprint/slots pair that drifted apart"* — written when hand-edited state was a hypothetical. It is about to be a feature. The **behaviour stays right** (pins are whole eighths and the invariant holds, so the guard never fires on a Smearforn wall), but the comment's premise is now stale and should be updated rather than left to mislead.

---

### Stage 0 — Defaults: floor and foundation off, and one version bump for the whole project — BUILT 2026-09-24

**As built.** `foundationEnabled` is a fourth checkbox in the Panelizer scope group, default `false` for new projects; `enabledEditorTabs` no longer pushes `"foundation"` unconditionally. `PROJECT_FILE_VERSION` is 25 and a v24 file's missing key migrates to **`true`** — proved by a test that loads a v24 document carrying floors AND a real foundation and asserts every key comes back with the value it was saved with. The last checked branch refuses to be unchecked (`isLastEnabledScopeBranch` in `editorTabs.ts`, unit-tested), in the Panelizer group and in the Floor/Roof Tools panels that carry the same two checkboxes. Stage 3's `wallRunStopsByWallId` rode along, inert.

Three things the plan did not say, found while building it:

- **A key added in v25 cannot be in `REQUIRED_STATE_KEYS` unconditionally** — the required-key check runs against the accepted PRIOR version too, so a v24 file would be refused for "missing foundationEnabled". There is now a `KEYS_ADDED_IN_V25` list the check skips when reading v24, which is the same carve-out v18->v19 needed and is deleted in one line when v24 falls out of the window.
- **An additive optional key does not actually need a bump in this file** (`wallReviewNotes`, `gableWindowAnchorsByWallId`, `maxPanelHeightIn` were all added without one). What makes v25 a real migration is the ASYMMETRY: off for a new project, on for an existing file. Stated because it changes the calculus for Stage 2b — see below.
- **⚠ The bump has a backend consequence the plan said it would not have.** The database's redactor classifies money paths **by schema version** (migration `0009`'s `browse_schema_redaction` seed, v24 only), so a project saved at **v25 is refused across a company line** until a seed row for 25 ships. Fail-closed — refused, not served unredacted — and owner-side open/save/versioning is unaffected. Writing SQL was out of scope for this pass, so it is **recorded as a test that asserts the gap** (`redaction.test.ts`, "does NOT yet classify v25") rather than quietly fixed. **One seed row, same single money path; it needs to reach the live database to mean anything.**

  **CLOSED IN CODE 2026-09-25, NOT YET IN THE DATABASE.** `supabase/migrations/0010_smearforn_v25_redaction_seed.sql` seeds format 25 with the same single path, following 0009's conventions — one transaction, re-runnable via upsert, a broken copy applies nothing, and it alters no existing object. The gap test is replaced by one asserting 25 IS classified, plus a new test asserting 0010's four safety properties against the file itself. `supabase/README.md` carries pre-flight, paste and post-flight steps as single-query blocks. **Two things to know before calling this done:** it has not been applied to the live project, and — unlike 0009 — it was **not verified against a local PostgreSQL either**, because none was installed on the machine that wrote it and connecting to live was not an option. The checks are static: real about what the file says, silent about whether PostgreSQL accepts it. The README says so in its own "0010 verification status".

**Stage 2b's key was deliberately NOT added here.** Its model (a wall-level header record over a slot-index range) is an inference the plan itself says Tommy must confirm, and inventing the stored shape of an unconfirmed model is exactly the thing this log exists to prevent. Since an additive optional key needs no bump (above), Stage 2b can add its own key when its model is settled without making a v24 file unreadable.

Tommy: *"I would like the turn off the floor and foundation tools as default for now and primarily focus on panelizing wall systems. This setting should still be visible, but perhaps it's somewhere in settings."*

**Mostly already built, which is why it goes first.** The Panelizer note already carries a "Scope of work" checkbox group (`page.tsx:5183-5196`) driving `enabledEditorTabs` (`page.tsx:1288`). `floorsEnabled` and `roofEnabled` **already default off**; `wallsEnabled` defaults on. All three are already persisted (`projectFile.ts:311-313`, `373-375`) and already classified in `cloud/redaction.ts:125-127`.

**What is missing is Foundation**, which is pushed unconditionally (`page.tsx:1291`). So:

- **New state `foundationEnabled`**, a fourth checkbox in the same group, **default `false` for new projects**.
- **Where it lives: the Panelizer note, beside the other three.** Tommy's *"perhaps it's somewhere in settings"* is satisfied — Panelizer is reached from the top bar and is already the stated *"keyhole to getting down to what editor tools are needed for this user's project."* Splitting one decision across two menus is worse than either menu. If he'd rather it sat in ⚙, that is a move of four checkboxes, not a redesign — Open Items.
- **⚠ Existing projects must not lose their Foundation tab.** A v24 file has no `foundationEnabled` key. The migration defaults it to **`true`**, *not* to the new-project default of `false`. This is the "data must not vanish because a default changed" requirement and it is the whole trap in this stage: getting it backwards silently hides a tab on every project ever saved.
- **Nothing is deleted, ever.** These flags gate rendering and which Detail Guide/Shop Drawing pages are in scope. Foundation *type*, pier grid, floor system and their geometry stay in state and in the file whether the tab is shown or not. That is already true of Floors and Roof today and must stay true.
- **⚠ Empty scope becomes reachable for the first time.** With Foundation optional, all four can be off. `editorTabsInScope([])` **returns every tab** (`editorTabs.test.ts:18`) while the snap-to-first effect sets `editorTab` to `enabledEditorTabs[0] ?? "foundation"` (`page.tsx:1300-1304`) — the dial would show everything while the state says foundation. **Refuse to uncheck the last checked branch** (disabled checkbox with a title saying why). Cheapest correct answer; the alternative is designing an empty state nobody asked for.

**This stage owns the single `PROJECT_FILE_VERSION` bump for all of Smearforn: v24 → v25.** `parseProjectFile` accepts the current version and **exactly one** prior (`projectFile.ts:549-551`), so two bumps in one week would make a v24 file unreadable. Stage 3's keys are therefore added **here**, in Stage 0, with inert defaults, even though Stage 3 may ship days later or not at all. Every new key also needs its entry in the required-keys list (`projectFile.ts:~325/373`) **and** in `cloud/redaction.ts` (all of these are `"not-money"`) — a missing classification is a load-bearing omission, not a lint nit.

**ADU reach after Stage 0:** none of the schedule. Less clutter while he works, and the file format settles once.

---

### Stage 1 — Type a panel width (the stage that must land) — BUILT 2026-09-24

**As built.** Standard/braced slots have the width field windows already had, in the Selected Panel note. A commit sets `widthIn` and `lockedWidthIn` together and re-tiles that one wall through the anchor path; a per-panel **Reset to automatic** clears the pin and hands the width back to the tiler. The panel-boundary drag snaps the BOUNDARY to the eighth and derives both widths from it, so the pair total is conserved exactly. The arithmetic is a pure module, `packages/geometry/src/panelWidthEdit.ts` (+ its test file): `resolvePanelWidthEdit`, `resolvePanelBoundaryDrag`, `findSubMinimumPanelWidths`.

The 24in rider, exactly as specified: `fabricationMinPanelWidthIn` is a new `confirmed` `CatalogValue` in `data.ts` quoting Tommy verbatim with his axis; `panelWidthInRange.minIn` still reads 15.75 with its manufacturer note, and a test asserts it ("if this ever reads 24, a sourced number has been overwritten"); `PANEL_DRAG_FLOOR_IN`'s local `24` is deleted and both consumers read the catalog; `PANEL_DRAG_SNAP_TOLERANCE_IN = 2` is untouched. Typed entry **refuses** below the minimum (the field keeps focus and the text, states the limit, commits nothing) via a new `validate` prop on `LengthInput` — a refusal, deliberately not a clamp, sitting beside the existing clamp path rather than replacing it. **No other number in `data.ts` moved.**

**⚠ The plan was wrong about the entry point, and Stage 1 could not work without a fix.** It says "click a panel (existing `selectedSlot`), type into the width field." But clicking a panel's body runs the type cycle, and from a **standard** panel the first stop is a window; `handleToggleOpening` selects openings and braced panels and explicitly selects **nothing** when a slot lands back on "standard". So a standard panel could never BE the selected panel — the new field would have been unreachable for exactly the panels this stage is for. **Fix, kept as small as it could be: clicking a panel's width LABEL on the elevation selects it, without cycling anything.** That is the first half of what Tommy actually described ("click the numerical value of width of one panel and then... it opens up the number value so you can type in a new value"); the editing still happens in the note, so this is not the click-to-EDIT label the plan pushed to Stage 1b. A hand-set label draws bold, so a pin is visible on the drawing.

Two smaller notes: an edit that would move the wall's own total length is **refused whole** (guarded by a sum check after the re-tile) rather than partly applied; and the Review Log now carries one entry per panel below the minimum, however it got there, with the safety-gap board and the openings exempt for the reasons the plan gives.

**Written against the plan as it stood at commit `7c96b96`.** The plan moved while this was being built (`a656b7a`, `da3f09d`), and **Stage 0's and Stage 1's own text did not change** — what changed sits around them: the tiler's `absorb` decision, the sill's move to 24in, the Standard-width clamp and the hyphen drop are now **Stage 1r**, a separate gate commit that lands before Tommy draws. None of them is done here, deliberately. The one place the newer text touches what this pass wrote: the sub-minimum Review Log entries will mostly stop firing once absorb lands, leaving the three residual cases absorb cannot reach — which is exactly what that entry is for.

**Evidence beyond the unit tests:** `apps/web/harness/smearforn-stage-0-1/` — a CDP harness IN THE REPO, with screenshots and an `evidence.json`. It shows a new project offering the Wall tab only, `41 1/2` committing as `41½`, `20` refused with the limit stated and the draft kept, per-panel reset returning a panel to 40in, a fractional-pixel drag committing 44½"/35½" with the run total conserved, a drag past the floor stopping at 24in — and **all eleven Rogers-Sehorn ADU widths typed in sequence with none refused.**

Tommy: *"We need a way to manipulate the widths of individual panels. Maybe when you are on the edit tool and click the numerical value of width of one panel and then click/highlight one of the edges, it opens up the number value so you can type in a new value. And/or also a tool should allow the user to click and drag a wall to shrink one and grow another."*

**The second interaction already exists** — the panel-boundary drag does exactly "shrink one and grow another", conserving the pair total, with the 24in floor and the role-handoff Tommy specified (`WallElevationDiagram.tsx:874-938`). What it lacks is the eighth snap (above). **The first interaction does not exist for standard panels** — only for windows, which already have a `LengthInput` width field in the Selected Panel note (`page.tsx:7062-7074`).

**So Stage 1 is: give standard/braced slots the width field windows already have.**

- **Entry point.** Click a panel (existing `selectedSlot`), type into the width field in the Selected Panel note. Tommy's phrasing suggests clicking the number on the elevation itself; a click-to-edit label on the diagram is a nicer gesture and a bigger change. **Recommendation: the Selected Panel note this pass**, because it reuses a field that already parses fractions, already clamps, already shows a clamp notice, and already relocates the selection after a retile. The on-diagram editor is a Stage-1b nicety if there is time.
- **Committing sets `widthIn` AND `lockedWidthIn` together**, exactly as the drag already does (`page.tsx:2085-2087`), then re-tiles that one wall through the anchor path.
- **Where the width comes from.** The typed panel grows; the *free* run shrinks. Concretely: the pinned width is reserved out of the budget and the unpinned standard/braced slots re-tile into what is left, which may change their count. The wall's total length never moves.
- **Constraints, and what happens when an edit is impossible:**
  - **The wall's total length is fixed.** Always. It is not a thing a panel width edit may change.
  - **Maximum: `panelWidthInRange.maxIn` = 48in** (confirmed). Above it, clamp and say so — the existing clamp-notice pattern.
  - **Minimum: REFUSE at 24in**, the new `confirmed` Building Integrity fabrication minimum. The field keeps focus, states the limit, and does not commit. Not a warning — a panel the shop cannot build is not a thing to negotiate at the keyboard. See "The minimum panel width" above for how it is recorded and why `panelWidthInRange.minIn` is untouched.
  - **The same constant drives the drag floor.** `PANEL_DRAG_FLOOR_IN`'s local `24` is deleted and both consumers read the catalog value. The ±2" snap tolerance and the role-handoff are unchanged ergonomics.
  - **Auto-generated panels below the minimum are reported, not refused** — the tiler can already produce them (see the defect above) and refusing at the tiler would change every existing wall. Review Log only, this pass.
  - **No room left.** If the free run cannot give up the width — every other slot on the wall is pinned, an opening, or a corner — **refuse the commit**, keep focus, and say how much is actually available. Never partially apply, never silently shrink a corner panel.
- **Reset control** beside the field: clears `lockedWidthIn`, wall re-tiles, panel returns to automatic.

**ADU reach after Stage 1:** every panel width in the schedule is typeable — 43", 41½", 37½", 35", 31½", 30", 29½", 28½", 25½", 24" — and **none of them trips any limit the app enforces**, so no warning fires anywhere in this job. Any wall whose panel *count* the tiler happens to produce correctly is fully reproducible. **Not** reachable: walls needing more or fewer panels than the tiler makes, the triple headers, the wall that stops short.

---

### Stage 1r — the gate: absorb, the 24in minimums, the hyphen — BUILT 2026-09-25

**As built, on branch `smearforn-stage-1r`, in four commits.**

**Absorb.** `computePlainSizing` splits a leftover two ways only when the parts total ≥ 48in, and otherwise emits ONE panel of `standardWidth + remainder`. `buildEvenMiddle` (the ≤12ft no-gap path, which the plan named and which turned out to need it just as badly — a 40⅛in budget at a 40in standard gave two ~20in panels) now floors its count at `floor(budget ÷ 24in)` as well as capping it at `ceil(budget ÷ standardWidth)`. The tie at exactly 48in goes to the split, asserted. `computeSillRunWidths` is deliberately untouched — see the gap noted below.

**The proof is preserved as a test, in two places.** `data.test.ts` asserts `panelWidthInRange.maxIn >= 2 * fabricationMinPanelWidthIn.value` directly, plus a sweep naming the first untileable band if it ever stops holding; `tilerFabricationLimits.test.ts` (in `apps/web`, the only place that imports both packages) asserts the tiler's own duplicated copies of those two numbers still agree with the catalog, because `packages/geometry` deliberately has no dependency on `packages/panel-catalog` and a duplicated number defended only by a comment is a number that drifts.

**Sweeps.** No tiler-generated panel under 24in or over 48in, and the wall total conserved exactly as integer eighths, over every eighth from 96in to 720in × `standardWidthIn ∈ {24, 39, 40, 48}` × both gap ends × all four corner combinations, plain and with 1–3 openings; plus a whole-footprint sweep over every rectangular ADU from 16×16ft to 44×44ft at every whole foot.

**The three residuals each got a test saying they are deliberately unfixed**, so "not attempted" stays distinguishable from "still broken". The 51–75in two-corner band is untouched, per Tommy's deferral to corner geometry after admin tooling.

**The safety-gap combine, measured rather than assumed.** `applyBracedPlacement`'s corner-brace combine can still shed a panel out of range — and it is **pre-existing**: over the same sweep, 32,266 cases produced an out-of-range panel before absorb and 3,279 after, and 3,279 is exactly the number of cases where the combine fires, either side of the change. So absorb removes nine tenths of them and creates none. Left unfixed (it is braced placement, not the tiler) with a test pinning the behaviour.

**Sills.** `sillMinWidthIn` is now a `CatalogValue<number>` at 24, `confirmed`, with the manufacturer's 600mm/23.622in figure and its provenance preserved *inside* the note. It reaches the Review Log through a new `CATALOG_SUPERSESSIONS` list appended **after** `toReviewLog` rather than mislabelled as pending — the value really is confirmed, and `toReviewLog` correctly filters confirmed entries out. **No other catalog number moved:** the whole `data.ts` diff is that one value plus doc comments.

**The hyphen.** `panelInstances.ts:282` emits `${direction}${n}`. `combinedPanelLabel` no longer parses: `PanelInstance` now carries `direction` and `panelNumber` as real fields, and the combined label is `N3+4+5`. Two tests, one named for the exact `N4-undefined+undefined` rendering and written as a property over the real generator's output. **Audit result: that was the only parse in the repo.** The only *format* that still adds a hyphen to a name is the jack-stud shipping ref `${inst.name}-JS1`, which nothing parses and which is now less ambiguous than the old `N-4-JS1`; the OBJ exporter's `g ${panel.label}_${memberId}` uses an underscore. Everything else keys or renders the name.

**The Standard width setting is clamped to [24, 48]** and its title no longer advertises the manufacturer's 15¾in floor. This matters more than it looks: absorb only ever resolves the *leftover*, so a standard width below the fabrication floor makes every full-width panel on every wall unbuildable and no amount of absorbing fixes it. There is a test named for exactly that.

**Two things the plan did not say, found while building it:**

- **`buildEvenMiddle` needed absorb as much as `computePlainSizing` did**, and the plan's framing ("the two-way split") only describes the latter. The ≤12ft path reaches the same failure through `Math.ceil`.
- **The grid sweep's "no standard slot exceeds `standardWidthIn`" rule had to be restated, not just relaxed.** Absorb makes oversized panels legal on purpose — unbuildable is worse than oversized, so the floor outranks the cap — and what survives is the ceiling, which is the bound that actually protects a cut list. Restated with a comment saying why, in the shape Stage 2 will need again for pinned slots.

**A gap this change creates and does not close:** `sillMinWidthIn` is now a confirmed 24in that **nothing enforces and nothing reports**. `computeSillRunWidths` can still emit a 22in sill, and `findSubMinimumPanelWidths` walks wall *slots*, which a sill is not. The plan scoped 1r's tiler work to `computePlainSizing` and `buildEvenMiddle` only, so this was left alone deliberately — but a confirmed limit with no consumer looks from the outside exactly like one being honoured, so it is written into the function's own doc comment and belongs in Open Items.

**Verified, not merely merged**, per the gate rule: `npx vitest run` green (111 files, 2040 tests), `tsc --noEmit` clean on a cleared `.next`, and the browser harness re-run against the real app — 12 of 12 checks, including all eleven ADU widths typed with none refused, and a new step that walks the viewer dial through all four wall elevations of a drawn footprint and finds nothing under 24in on any of them.

---

### Stage 2 — Insert, replace and delete a panel — BUILT 2026-09-25

**As built, on branch `smearforn-stage-2`, in five commits.**

**The tool.** A "Place a panel" group in the wall-elevation left bar: the nine click-cycle stops (Standard, four braced styles, Window, Door, Column, Big Header) plus **Delete**, each a toggle. With one armed, a click on a panel's body **replaces** it (or deletes it) instead of cycling it, and every legal boundary on the row becomes a drawn, dashed, clickable **insert** target. The panel-boundary drag stands down while the tool is armed — one strip cannot mean two things — and the width label stops swallowing clicks, or the panel under it would be the one spot the tool could not reach. Corner and safety-gap refuse, in words, on both replace and delete.

**The arithmetic is a pure module**, `packages/geometry/src/panelPlacement.ts` (+ its test file), the same shape Stage 1 took: `resolvePanelInsert`, `resolvePanelReplace`, `resolvePanelDelete`, `redistributeFreeRun`, `insertableBoundaryRange`, `shiftSlotCoverage`, and `PLACEABLE_PANEL_TYPES` — which a test asserts against `nextPanelCycleState`'s own reachable roster, so the two cannot drift apart. The catalog minimum/maximum are passed in, not imported, for the reason `panelWidthEdit.ts` already gives.

**⚠ The plan said "both use the existing anchor mechanism", and that turned out not to be buildable as written — this is the one place the build departs from the plan, deliberately.** `retileWithOpenings` derives the free run's COUNT from the budget alone, so it answers "how many panels does this wall hold" identically every time it is asked. Re-deriving the count is exactly what an insert or a delete must not do: a wall that just gained a hand-placed panel loses it again on the way back out, and a delete of an automatic panel is a no-op because the budget did not change. So the count is carried by **the slot array itself** — already persisted, no new key, **no `PROJECT_FILE_VERSION` bump** — and only the free run's *widths* are recomputed:

- Let `B` be what is left for the free run (the wall total minus every fixed width: corners, the gap, every opening, every pin) and `n` the free slots the edit left standing. The run keeps `n` when it legally can: `n' = min(max(n, ceil(B / 48in)), floor(B / 24in))`. `distributeEighths` then makes every part `floor(B/n')` or `ceil(B/n')`, so **both fabrication bounds hold for every panel rather than on average**.
- **The count may shrink, never grow.** Growing it would answer "I want one fewer panel" by inventing one, so that case is refused and said out loud.
- `0 < B < 24in` is **refused**, not rounded away — a sliver has no legal home and nothing to absorb into without moving a corner or an opening, which this module never does. `B === 0` exactly is fine: the free run simply ends up empty.

**The rider that makes Stage 1 and Stage 2 compose, and it is not optional.** `retileWallAroundPins` now falls back to `redistributeFreeRun` when the tiler's answer has **fewer standard-family slots than the wall actually has**. Without it the first width edit after an insert silently re-tiles the hand-placed panel away — and the wall still sums to its own length while doing it, so neither of that function's existing guards notices. That is the silent revert this plan forbids, and `apps/web/app/handPlacedWallRetile.{ts,test.ts}` pins both halves of it through the real tiler. A wall that has never been hand-placed on takes the tiler path exactly as before.

**A rider the plan did not mention: slot-index coverage.** A Mid-Wall Bond Beam's coverage (either story) and the roofline Box Beam's are slot-index ranges, and an insert/delete shifts every index after it. `shiftSlotCoverage` moves them so they cover the same panels; a panel placed exactly at either edge lands outside the range; a delete that empties a range removes it and **says so in the notice**. Only applied when the array's length actually moved by that delta — an insert the automatic run had to pay for by absorbing a panel is a net zero. Deliberately NOT extended to re-tiles, where the run is re-derived wholesale and coverage is a rough position at best.

**What an insert on a full wall does, stated because it will look like a bug.** A wall with no slack cannot hold another panel: the automatic run gives one up to pay for the new one and the wall's panel count does not move. **The notice says so** ("The automatic run gave up a panel to pay for it, so this wall still has 15 panels — narrow a panel to make room for another"), because the alternative is Tommy counting panels on a drawing to find out. The route to a higher count is the one the plan describes: pin widths narrower than the Standard width (Stage 1) and the freed budget shows up as room.

**Three known limits, none of them hidden:**

- **Only the paths this stage touches preserve the count.** The click-through cycle (`handleToggleOpening`), a window/Big Header width edit and a wall-length edit still re-tile and can take a hand-inserted panel with them. The new tool covers type changes on its own, so the workflow does not require the cycle — but this is the obvious next rider, and the real fix is still the plan's own "generalize `OpeningAnchor` to a slot anchor".
- **The free run re-tiles FLAT.** Every automatic panel ends up within an eighth of every other, which means the "one absorber next to the gap, full width everywhere else" shape of a tiler-laid wall does not survive a hand edit. Nothing moves out of [24in, 48in], and the absorber's *position* rule (never corner-adjacent) is unaffected since positions do not move.
- **A replace that would leave an automatic panel over 48in is refused** rather than answered by splitting it into two. Replacing an 8ft Big Header with a standard panel on a wall with no free run is the case.

**Verified:** `npx tsc --noEmit` clean in `apps/web`, `npx vitest run` green (113 files, 2079 tests, up from 2040), and a new in-repo browser harness — `apps/web/harness/smearforn-stage-2/` — 8 of 8 against the real app, including the wall total conserved to the eighth across insert/replace/delete, the safety-gap refusal in the words the tool prints, an 8ft Big Header refused with the real free width in the message, and no uncaught exception in the page all run. It found two real defects on the way: ten tool buttons overflowing a 240px sidebar, and a corner step clicking the leftmost panel on a wall that owns no corner. **Stage 0/1's own harness was re-run against this branch as a regression check — 12 of 12, including all eleven ADU widths and the per-panel reset** (its checked-in evidence was left alone rather than overwritten with a Stage 2 run).

**Flags check, run against the built diff: clean.** `data.ts` is not touched and no `CatalogValue`/`CatalogRange`/`PanelStructuralStatus` is in scope — the two catalog numbers this stage depends on (`fabricationMinPanelWidthIn` 24in, `panelWidthInRange.maxIn` 48in) are read, never redefined, and the pure module takes them as parameters. The widths a placed panel is born at are all existing values with their existing statuses: the project's Standard width, `COLUMN_TOTAL_WIDTH_IN`, and `bigHeaderDefaultWidthIn`/`bigHeaderDefaultHeightIn` (still `pending-BI-confirmation`, unchanged, and the tool does not present them as anything else). No fastener spacing, load, density, dimension or cost figure moves; nothing new reaches the Review Log. Every number added by the diff is a render or layout figure (a marker colour, a 2px stroke, an 8-second notice timeout) or index arithmetic.

**ADU reach after Stage 2, honestly:** panel *types* are now directly selectable anywhere on a wall, a wall's count can come **down** to match the schedule, and it can go **up** wherever the pinned widths have left slack. The triple headers are still Stage 2b.

---

Tommy: *"There should be a way to add a panel, select which type of panel you want to add, and then click where to put it. This would either replace a panel or add one between."*

- **Tool shape:** pick a type from the left bar, then click a panel or a boundary. Clicking a **panel** replaces it; clicking a **boundary** inserts between. Both are the anchor mechanism; neither is a new model.
- **Replace already half-exists.** `nextPanelCycleState` (`tiling.ts:603`) cycles standard → window → door → column → big-header → 4 braced styles → standard, and `handleToggleOpening` already routes width-changing transitions through the anchor retile and non-width-changing ones through an in-place mutation. The new tool is a **direct-select version of that same cycle** — no new transitions, no new types.
- **Placeable types: standard, braced (4 styles), window, door, column, big-header.** The click-cycle roster exactly.
- **NOT placeable: corner and safety-gap.** Both are placed by rules that exist for reasons — corner ownership (shorter-wall-wins, reflex corners, the merged-corner case) and gap-end placement. Hand-placing one would put the user in a fight with two systems that will overwrite them. **⚠ The ADU annotates "SAFETY GAP" repeatedly, so this may be exactly what Tommy wants next** — see Open Items. The anchor mechanism would carry it; it is a scope call, not a technical one.
- **Insert: where the width comes from.** A new panel is born pinned, at the project's standard width (or the type's own default — a Big Header is 96in by `bigHeaderDefaultWidthIn`). That width is reserved out of the budget and the free run re-tiles smaller. **If the free budget cannot cover it, refuse the insert** and say how much room there is. Never overflow the wall; never shrink a corner or an opening to make room.
- **Delete** is the same operation inverted: the slot goes, its width returns to the free run, the wall re-tiles. Deleting an opening is already expressible (cycle it back to standard); deleting a *panel* is new and is what lets a wall's count come down to match a drawing.
- **Neighbours:** untouched in type, style, zones and pins. Only the unpinned free run resizes. That is the whole point of the anchor design and it is the acceptance criterion.

**ADU reach after Stage 2:** panel *counts* become exact, so all four wall runs can be made to match the schedule. **The triple headers are NOT reachable here** — they are a cross-column relationship, not an insert; see Stage 2b.

---

### The triple header — SETTLED 2026-09-24, and it is a relationship, not three adjacent panels

Tommy: a triple header is **one header panel spanning two panels below it.** Verified in the cut list, and the arithmetic closes exactly:

| Panel | What it is |
|---|---|
| **E4A** | the header — two 6'5½" headers plus a lid |
| **E4B** | 3'5½" wide, below |
| **E4C** | 3'0" wide, below |

**3'5½" + 3'0" = 6'5½"** — the header's span is exactly the two panels beneath it. So A is not a sibling of B and C; **A sits on top of B and C.** An earlier draft of this section guessed "three adjacent Big Header slots" and would have produced a wall 6'5½" too long. Recorded because the guess was plausible and wrong, which is the dangerous combination.

**What the app can and cannot express today.** A `PanelSlot` is a full-height column, and `PanelSlot.zones` splits a column *vertically* — so "a header above a panel" is already expressible **within one column**, and "a header above two columns" is not. What spans a slot *range* today is a **Mid-Wall Bond Beam**: a `MidWallBeam` carries a slot-index coverage range (the `BoxBeamCoverage` shape), and `computeWallVerticalBandsForSlot` already shortens every covered slot's panels to make room for it. That is structurally the same object as a triple header.

**The design — CONFIRMED by Tommy 2026-09-24: *"Yes, that's what it is."*** Put to him as a header covering a slot range and reusing the mid-wall-beam coverage mechanism. A triple header is a **wall-level record over a slot-index range**, exactly like a mid-wall beam, except the thing occupying the band is a real **Header panel instance with its own width (the span), its own weight and its own fabrication sheet** — not a beam. **It began as an inference off the cut list's arithmetic and is now first-hand.** It appeared as an open question three times and should stop being re-listed: **Stage 2b is unblocked on geometry as well as on naming.**

Three consequences worth stating before anyone builds it:

- **It makes the A/B/C naming fall out naturally** — the spanning panel and the panels beneath it are a parent and its children, which is precisely the relationship a suffix expresses. See the nomenclature workstream: this is the same question, and Tommy has opened it.
- **`bigHeaderWidthInRange` (48–144in) is already `pending-BI-confirmation`**, noted "Tommy's own stated range — not mfr-sourced". A 6'5½" span sits inside it. **If a later job spans past 12ft, the range does not get widened to fit a drawing.**
- **`W4A` is an A with no B**, which under this reading means a header spanning something that was never split — or a naming artifact. Per Tommy, the ADU's letters came from splitting panels while leaving neighbours' names alone, so an orphan A is exactly the kind of debris that scheme produces. **Evidence for the nomenclature workstream, not a modelling requirement.**

**The label format question moved to the nomenclature workstream and was settled there: `E4`, hyphen dropped.** The spanning header itself is named from a **separate building-wide series (`H1`, `H2`) carrying no direction at all** — so **Stage 2b does not name it after E4, or after E, or after the east wall in any way**. That is the detail most likely to be assumed otherwise, and it is why the header's sheet has to state its wall in words.

---

### Stage 3 — Incomplete walls: a wall that simply ends

Tommy: *"We need an addition tool setting or stop wall tool so that it is possible to make incomplete walls."*

**Reference walls have dropped out of scope — Tommy, 2026-09-24:** *"For new construction the bare walls meet the other bare walls. This project being all new construction is just a simple end to our wall, no need to have the rest of the plan drawn."*

That answers the corner/junction Open Item and deletes a whole feature at once. The ADU does **not** need the garage drawn, labelled or dimensioned; it needs the ADU's own wall to **stop**. No junction detail, no inset question, no "REFERENCE ONLY" print treatment. The earlier plan's reference wall was solving a problem the job does not have.

**Recorded for later, not built:** the addition case, which is the one that *would* need a junction detail. Tommy: *"For additions, a toe up made of 2x4s and insulation is installed vertically over a vapor closed membrane."* That is a real assembly and it belongs with the Detail Guide pages (it is a close cousin of detail 4, the toe-up/foundation load path, rotated vertical). Nobody should invent it from this one sentence — see Open Items.

- **Hard decision, unchanged: the footprint polygon stays CLOSED.** An open polygon would break `computeFootprintAreaSqFt`, `perimeterRing`, `pointInPolygon`, `computeRoofBearingSegments`, the floor framing and the 3D pipeline simultaneously — every one assumes a closed ring, and `cornerOwnership` walks it by `walls.find(w => w.startCorner === wall.endCorner)`. **"Incomplete" is a property of the panel run, never of the shape.** This survives Tommy's answer intact and matters more because of it: the ADU's floor and roof still extend to the line where the wall stops, so that edge must still exist geometrically even though nothing is built along it.
- **Data (added in Stage 0's v25 bump, inert until this stage):** one record keyed by wall id — `{ startStopIn: number; endStopIn: number }`. Absent entry = fully panelized, today's behaviour, byte-identical. Stops are inches on the eighth grid, measured from each wall end. **An edge with no wall at all is just `startStopIn` covering the whole length** — no separate mode, now that the "reference" mode is gone. One concept, one field pair.
- **Geometry:** `wallGeometryFor` subtracts the stops from `lengthIn` before tiling. The invariant becomes **`Σ slot widths + startStop + endStop === wallFabricationLengthIn`** — still exact, still integer eighths.
- **Drawing:** the unbuilt span draws as a **dashed boundary line**, not a hatched wall — it is where the building ends, not a wall of unknown type. It carries its own dimension in plan and elevation. **In 3D, nothing is drawn there.** A ghost solid would read as a wall that exists, which is exactly backwards.
- **Printing:** the span's dimension prints, labelled **NO PANELS**.
- **Totals and the cut list — still the real trap.** No panels means no instances, so anything derived *from panel instances* (price, weight, carbon, BOM, cut list, shipping) is correct for free. **Anything derived from `wall.lengthFt` is not**, and will silently over-count — plaster and wall-assembly areas are the first suspects. **An explicit audit of every total that reads a wall length rather than a panel set is an acceptance criterion of this stage.**
- **A stop that reaches a corner takes the corner panel with it** (the corner is simply not built; the neighbour is unaffected, since it already butts or owns by its own rule). Inference; stated so it is not discovered mid-build.
- **Review Log:** one entry per wall carrying an unbuilt span. A wall that stops short is by definition an incomplete design and the engineer must see it. Mechanism: the existing `reviewLog` useMemo (`page.tsx:5023`), which already takes `{ label, status, note }` entries.

**ADU reach after Stage 3:** the wall that stops where the garage begins. **The full 60-panel schedule, minus the A/B/C naming.**

---

### Stage 4 — Shop drawings, to match Cameron's sheets

New workstream, 2026-09-24. Tommy uploaded shop drawings made by **Cameron** on his team (SketchUp, open-cut extensions) and wants the app's per-panel output to read like them:

> *"bird's eye view of the interior face at and up and clockwise angle, (more) clearly denote what the length of each cut is, and somehwere on the page clearly note what overall size (length, depth, height, AND the diagonal measurement of the exterior face. And I NEED to have total weight at 7lbs/ft3 of straw plus weight of wood and fasteners on each panels' page. I also want a blank table included on the page for the shop to write in actual height, length, and width, moisture content, weight, quality check date, and initials."*

**Most of this sheet already exists, which is the single most useful fact about this workstream.** `PanelFabricationPage.tsx` already renders, per unique panel: a lettered `PanelElevationDiagram`, a **Materials cut list** table (Letter / Part / Qty / Dimensions, from `computePanelCutList(members)`), an "Also used at" instance list, structural values, a **weight breakdown with a modeled total**, and one blank line — `Actual total weight: _______________`. So this is **mostly a print/sheet-content pass, not a modelling pass**, and almost none of it needs new data.

Taking his list item by item, with the print-vs-3D split he asked for:

1. **Weight at 7 lb/ft³ plus wood and fasteners — nearly done, and flags-clean.** `targetDensityKgM3` in `data.ts` **is already 7 lb/ft³**, noted "7 lb/ft3 (Tommy) — supersedes the earlier ~4.7 lb/ft3 literature-derived starting point", and `computePanelWeightBreakdown` already returns components plus a modeled total. **No new building value is introduced by this item at all.** The work is confirming the breakdown on the sheet names straw, wood and fasteners as three visible lines rather than one total, and that the fastener line traces to what the BOM already computes. **⚠ Fastener counts inherit `fastenerTableStatus`, which is `pending-BI-confirmation`** — a printed screw count must carry that provisionality, not appear as a fact because it is printed in a table.
2. **Per-cut lengths "more clearly denoted" — the data exists; the question is where it is shown.** Every cut length is already in the cut list's Dimensions column. **Inference: he means on the drawing**, as dimension leaders against the lettered members, because that is what Cameron's SketchUp sheets do and it is what "denote" reads as beside "bird's eye view". Confirm before building — if he only means a clearer table column, this item is nearly free.
3. **Overall size block: length, depth, height, and the exterior-face diagonal.** Pure geometry off dimensions the panel already has; the diagonal is `hypot` of the exterior face. **It is a squareness check** — that is why it sits beside height and width on his QC sheet — so it must be labelled as the *exterior face* diagonal and never as a generic "diagonal". No building value, nothing flagged.
4. **The bird's-eye interior-face view — a camera preset, not a new projection.** `StandardPanel3DView` already embeds a single-panel 3D view inside a sheet (see the Jack Stud Shop Drawing). **Recommendation: a fixed camera preset on the existing renderer** — up, clockwise, interior face toward the viewer — rather than a hand-drawn axonometric, which would be a second renderer to keep in sync with the member geometry forever. **⚠ One risk to settle before committing: the 3D view is `@react-three/fiber` (WebGL), and a WebGL canvas does not reliably print** without the drawing buffer being preserved. Verify on a real print preview *first*; if it prints blank, the fallback is rendering the preset to a raster at print time, not abandoning the view. **This also finally answers the long-standing Open Item "'Typical architect angle' set for 3D renders"** — Tommy has now described the angle he wants in his own words.
5. **The blank QC table — match his sheet, do not invent one.** The cut list PDF's **"QUALITY CONTROL PROJECT SUMMARY CHECK LIST"** already has the columns: PANEL ID, ACTUAL HEIGHT, ACTUAL WIDTH, ACTUAL DIAGONAL, MOISTURE CONTENT, SCREW COUNT, ACTUAL WEIGHT. He wants **QUALITY CHECK DATE** and **INITIALS** added. **Use his columns verbatim, in his order, plus the two new ones** — a shop that already fills in one layout should not have to learn a second.
   - **⚠ One real difference to settle: his existing table is project-level (one row per panel); he asked for a blank table *on each panel's page*.** Recommendation: the per-panel page carries **his columns with one row per placed instance of that panel** — since a fabrication sheet already covers N identical copies ("Also used at (12)"), one row per copy is what a shop actually fills in, and PANEL ID is then pre-filled per row rather than blank. The project-level checklist stays exactly as it is. Confirm.
   - The existing single `Actual total weight: ____` line is **superseded** by the table's ACTUAL WEIGHT column and should be removed rather than left as a second place to write the same number.
6. **What a panel page shows when a value is not known: a visible gap.** The house convention, already settled twice in this log (`PanelStructuralStatus` carries no invented value; the logo placeholder "claims nothing"). An unknown dimension prints as a dash with a note, never a plausible substitute. A blank cell in a QC table is *correct* — it is the shop's job to fill it.

**Monday relevance: almost none, and that is the honest answer.** The Monday goal is *creating* the project, not printing it. The one item that could ride along is (1), because the number already exists and the breakdown is already computed — but even that is not needed to draw a wall. **Stage 4 goes after the editor stages.**

### Stage 5 — Nomenclature: options, not a default

New workstream, 2026-09-24. Tommy:

> *"I would like to develope and impliment the most user friendly nomenclature system. I think we have a good one. This particular project I think was named that because we broke those panels down into abc because the other ones didn't want to change - not necessarily because that's the best nomenclature to use."*

**So the ADU's `E4A/E4B/E4C` is circumstantial, not exemplary.** It is what fell out of splitting panels while refusing to renumber their neighbours.

**DECIDED 2026-09-24:** *"Everything downstream should get renumbered. I really like the simplicity of CARDINALDIRECTIONLETTER-NUMBER."*

So: **positional, cardinal-direction letter plus number, renumbering everything downstream on every insert or delete.** Suffixes are out.

**Most of this is already built.** `panelInstances.ts:280-282` emits `${compassDirection}-${n}`, counted per direction across the building, in wall order then slot order — and because it is derived fresh on every render, **it already renumbers downstream automatically.** Nothing has to be built to get the behaviour he asked for; the work is in the consequences.

#### The hyphen is dropped — `E4`, not `E-4` — and the reason is a physical object

Tommy, 2026-09-24: ***"I have spray paint stencils in the shop, and there is no huphen stencil. So let's drop the hyphen."***

**Quoted verbatim and kept permanently, because nobody would ever derive this from first principles.** A software naming format is being decided by which stencils exist on a shelf in Columbia, Missouri. It is also the best kind of requirement — unarguable, verifiable, and invisible to anyone who only ever reads the screen. It has the side benefit of making the app match the drawings he already issues.

**⚠ This breaks a function, and it breaks it silently.** `combinedPanelLabel` (`panelInstances.ts:544-550`) parses the name it is given:

```
const [prefix] = instances[0]!.name.split("-");
const numbers = instances.map((inst) => inst.name.split("-")[1]);
return `${prefix}-${numbers.join("+")}`;
```

With `"N4"`, `split("-")` returns `["N4"]`, so `prefix` becomes `"N4"` and every entry of `numbers` is `undefined` — the on-canvas label renders **`N4-undefined+undefined`** on every multi-instance slot, which is every window slot (header + sills). **It throws nothing and fails no test that does not look at the string.** The prefix/number split has to become a real parse (or, better, the instance should carry its direction and number as fields and stop round-tripping through its own display string).

- **The combined label itself should lose the hyphen too** — `N3+4+5`. It is a screen and drawing label rather than a stencilled panel id, so the stencil constraint does not strictly bind it, but two conventions one character apart is how the wrong one gets stencilled.
- **Check every other consumer of `inst.name` before shipping.** It is used as a `Map` key in ~10 places in `page.tsx`, as a React key, and as the base of the jack-stud id (`page.tsx:3587`, `${inst.name}-JS${i+1}`). Uniqueness survives the change (`N4`/`NE4` stay distinct), but **anything that parses rather than merely keys is a candidate for the same silent breakage.**

#### The cost of always-renumber, and what the app now owes the shop

**This is the option whose cost lands on the shop floor rather than in the code**, and saying so is the point of writing it down. Insert a panel at E-3 and every panel east of it shifts by one: **the E-7 on the sheet in the shop's hand is the E-8 on the sheet in the office.** Nothing in either document says which is which. Someone installs the wrong panel.

**This is now a requirement, not a nicety: a printed sheet must carry its own identity.** Minimum: **project name, revision, and date issued, on every sheet**, so two sheets naming "E-7" can be told apart at a glance. The pieces exist — `SheetTitleBlock` already takes a date (`resolveTitleBlockDate`) and `sheetNumber`/`sheetCount` from `DocumentMetaContext`, and the backend already keeps `project_versions`. What is missing is the revision on the face of the sheet and a line on the panel schedule saying **names are positional and valid only for this revision.**

**Worth building, not this pass: a renumbering diff.** When a project is re-printed after an insert, show what moved — *"E-7 through E-12 shifted to E-8 through E-13."* That single feature is what turns a dangerous scheme into a safe one, because it tells the shop exactly which labels to re-read. Recommended as the first follow-up after the editor stages.

#### Spanning headers get ONE series for the whole building — DECIDED 2026-09-24: `H1`, `H2`, `H3`

The problem this solves: a left-to-right letter-number scheme describes a **one-dimensional** run, and a header spanning two panels below it is **two-dimensional**. No assignment of consecutive left-to-right numbers keeps all three in reading order — which is exactly why the ADU reached for A/B/C.

**Tommy's answer: a single building-wide header series with no direction prefix at all**, chosen over a per-direction series (`EH1`/`NEH1`/`SWH1`), over numbering panels first and spans afterwards, and over keeping A/B/C.

**The reasoning is the stencil rack again:** eight direction prefixes times an `H` is a lot of stencils to own and to keep straight, and **headers are rare enough that finding one does not need the wall encoded in its name.** So a header's name says **what it is, and nothing about where it is.** That is a deliberate trade, and it moves work onto the cross-reference below.

- **Written `H1`, not `H-1`.** The stencil rule is general.
- **No collision is possible.** Every panel name begins with a direction (N/NE/E/SE/S/SW/W/NW); none begins with `H`.
- **One global counter, not one per wall.** Recommended order: the **same wall-order-then-slot-order walk `allPanelInstances` already does**, so header numbering is deterministic and rises in the same direction panel numbering does. Consequence to state plainly: **`H1` may be on the north wall and `H2` on the east** — the series crosses walls by design.
- **⚠ Renumbering is now building-wide.** Inserting a header on the north wall shifts every header after it *anywhere in the building*, not just on that wall. That is a wider blast radius than the panels have, where a north-wall insert only ever moves `N` numbers. Same staleness problem, larger radius — covered by the same sheet revision identity, but worth knowing before someone inserts a header late in a job.
- **⚠ The cross-reference is no longer a nicety — it is the only way to locate a header, and it is REQUIRED.** With the wall stripped out of the name, `H1` alone says nothing about where the panel goes. So:
  - `H1`'s own fabrication sheet carries **its wall and its span in words**: *"East wall — spans E4, E5."*
  - `E4`'s and `E5`'s sheets each carry the reciprocal: *"Header above: H1."*
  - The elevation drawing shows it graphically, but **a shop reading one sheet cannot see the other**, and that is exactly the situation this decision creates. The cross-reference is what makes a two-dimensional relationship survive being printed as a stack of one-dimensional pages.

**Stage 2b is unblocked on naming.**

#### Two smaller questions the answer did not cover

- **Non-cardinal walls are already handled, and the handling is lossy.** `wallCompassDirection` snaps a wall's outward normal to the **nearest of eight** (N/NE/E/SE/S/SW/W/NW), so an octagon's mitered walls already name correctly (`NE3`) and a rectangle always lands on a cardinal. **But the snap means two differently-angled walls can both be "NE"** and share a number run while pointing different ways. The ADU is rectilinear so nothing bites today; a bay window or an angled wall would.
- **Two walls facing the same direction share one number run — DECIDED 2026-09-24, at the third asking.** An L-shaped building gets one `E1…E12` run spanning both east-facing walls. **His reason is the one that matters and it is better than "it is what the code does": every panel name in the building stays unique, which is what a shop needs when it stacks panels by label.** Recorded as a decision rather than as status quo — it happens to match today's behaviour, but it is now chosen. Noted that it took three asks, because a question that has to be asked three times is usually one where the asker has not made the stakes clear.

**Monday relevance: none.** The app already emits the names he asked for. The print-identity requirement is the part that matters, and it belongs with Stage 4.

### Staging, and an honest read on Monday

Order is by **how much of the ADU each stage unblocks per hour of work**, not by elegance. The elegant model (anchors) is carried by Stage 2 because Stage 1 does not need it.

| Stage | What it is | By Monday evening? |
|---|---|---|
| 0 | Foundation checkbox, default off; the single v24→v25 bump carrying every Smearforn key | **Yes**, comfortably — the mechanism exists |
| 1 | Typed panel width + eighth-snap the existing drag + per-panel reset | **Yes** — and this is the one that *must* land |
| **1r** | **Absorb + the 24in minimums + the hyphen drop** | **BUILT AND VERIFIED 2026-09-25** — the gate is closed; he draws on final tiling rules |
| 2 | Insert / delete / place-a-type; the anchor generalization; the spanning header | **The insert/delete half: plausible.** The **spanning header is the new risk** — it arrived with Tommy's answer, it needs its own confirmation, and it is a new cross-column concept rather than a width edit |
| 3 | Incomplete walls — a wall that simply ends | **Better than before, and still the most likely to slip.** Reference walls dropping out removed a whole feature; what is left is the stop mechanism plus the wall-length-derived-totals audit, which is the part that tends to find two more bugs |
| 4 | Shop drawings | **No, and it does not need to be.** The Monday goal is creating the project, not printing it |
| 5 | Nomenclature consequences (sheet identity) | **No** — but note the scheme itself needs **no work at all**; the app already does what he asked for |

**⚠ Stage 1r (absorb + the minimums + the hyphen) is MONDAY-CRITICAL and lands BEFORE Tommy opens the app to draw — his call, 2026-09-24. BUILT 2026-09-25 on branch `smearforn-stage-1r`; see the Stage 1r as-built section above for what it does and what it deliberately does not.** It is still its own commit (four of them), but it is no longer a follow-up: it is a gate, and "verified, not merely merged" was met — the sweeps, the `max ≥ 2 × min` property test and the browser harness were all green before this was written.

- **The reason it moved: it changes what the tiler produces for the ADU's own walls.** Absorb should make his job easier — fewer narrow panels means panel counts closer to the real schedule — but **a rule that changes tiling must not change while he is mid-job.** Re-tiling a wall he has already hand-fitted, because a rule shifted under him, is the exact experience Smearforn exists to prevent. Landing it first means he draws against final rules from the first wall.
- **"Verified", not just "merged".** Because it is a gate, the property test over swept wall lengths has to be green *before* he starts, not before the branch merges. A tiler change that lands unverified on Monday morning is worse than one that lands Tuesday.
- **Still its own commit, ordered after typed widths.** Absorb touches `computePlainSizing` and `buildEvenMiddle` — the functions every wall goes through. Fusing it into the typed-width commit means a tiler problem takes typed widths down with it. Two commits, same morning.
- **The 24in refusal changes nothing for this job** — every ADU width is ≥24", so it never fires. It rides along because the file is already open.
- **The hyphen drop is the highest-risk-per-character item in the whole plan.** One template string, plus a silent parse failure in `combinedPanelLabel` that renders `N4-undefined+undefined` and throws nothing. Cheap, not free, wants its own eyes.

**What this does to the order:** Stage 0 → Stage 1 → **Stage 1r (gate)** → Tommy draws. Stages 2, 2b and 3 land around and after that, and anything not finished by the time he starts is simply not part of Monday.

**Two things improved since the first draft of this plan, and one got worse.** Better: reference walls are gone (Tommy's *"just a simple end to our wall"*), and the 14in panel-width scare evaporated once it turned out to be a depth. Worse: **the triple header is a real cross-column concept**, not three adjacent panels, so Stage 2 carries more than it did yesterday.

**The fallback if Stage 3 slips, stated now so it isn't improvised Monday night:** draw only the ADU's panelized walls and accept that the footprint is then short on one side — which changes area, floor and roof. That is a **wrong building with a right panel schedule**, the correct trade for a Monday deadline *provided it is written on the sheet*. It must not become a silent compromise.

**What Tommy will not have Monday regardless:** the shop-drawing sheet changes, any nomenclature decision, and — unless Stage 2's spanning header lands — the `E4A`-over-`E4B`/`E4C` relationship, which would then have to be approximated by two full-height panels with the header drawn as a mid-wall beam. **That approximation is a drawing, not a panel:** it would not produce E4A as a fabricated panel with its own weight and its own sheet. Worth knowing before relying on it.

---

### Handoff to the coder

**Not in scope for any stage of this pass:** anything in `supabase/`; the backend Stage 5 work; hand-placing corner or safety-gap panels; **any change to the naming scheme itself** (`panelInstances.ts:282` already implements what Tommy decided — leave it alone); **any change to `computePlainSizing`'s split rule** to enforce the new minimum (pre-existing defect, reported not fixed — see Open Items); reference walls (dropped, see Stage 3); the addition/toe-up junction detail; the renumbering diff; the on-diagram click-to-edit width label (Stage 1b at best); the rest of the 1/8in grid's Stage 2 snapping layer beyond the single panel-boundary drag; per-wall standard widths.

**Stage 0 — defaults and the version bump.**
*Scope:* add a Foundation scope checkbox defaulting off, and land every Smearforn project-file key in one v24→v25 migration.
*Files:* `apps/web/app/page.tsx` (~1284-1304 state and `enabledEditorTabs`, ~5183 checkbox group), `apps/web/app/projectFile.ts` (`PROJECT_FILE_VERSION`, `ProjectState`, required-keys list, migration), `apps/web/app/cloud/redaction.ts`, `apps/web/app/editorTabs.ts`.
*Acceptance:* a new project opens with Wall only; a v24 file loads with Foundation **on**; unchecking Foundation hides the tab and changes no foundation data; re-checking restores it identically; a round-trip save/load of a v25 file is byte-stable; the last checked branch cannot be unchecked.
*Edge cases:* v24 file with `floorsEnabled: true`; the empty-scope path; `editorTabsInScope([])`; a file saved mid-week at v24 after a partial Stage 3 lands.

**Stage 1 — typed widths.**
*Scope:* a width field for standard/braced slots that sets `widthIn` + `lockedWidthIn` and re-tiles that wall; eighth-snap the panel-boundary drag; a per-panel reset; **plus the 24in minimum rider** (new catalog value, typed-entry refusal, `PANEL_DRAG_FLOOR_IN` folded in, Review Log entry).
*Files:* `apps/web/app/page.tsx` (Selected Panel note ~7032; a `handleSetPanelWidth` beside `handleSetWindowWidth:2335`; `reviewLog` ~5023), `apps/web/app/WallElevationDiagram.tsx` (~874-938, and the `PANEL_DRAG_FLOOR_IN` deletion at :113), `packages/panel-catalog/src/data.ts`, `packages/geometry/src/tiling.ts`, `packages/geometry/src/bracedPlacement.ts`.
*Acceptance:* typing `41 1/2` on a standard panel yields exactly 41.5in and redisplays as `41½"`; the wall's panels still sum exactly to `wallFabricationLengthIn`; every other panel's type, braced style, zones and pins are unchanged; resizing an unrelated window later does not move the pinned width; the panel drag lands only on eighths and floors at the catalog minimum; typing 20in is refused with the limit stated; **a saved project containing a 20in panel still opens, draws and prints**, reporting that panel in the Review Log.
*Edge cases:* a pin wider than `standardWidthIn`; a wall where every other slot is pinned or fixed (refuses); a pinned slot adjacent to the safety-gap panel, which has its own width-shedding rule; a pinned slot on a merged-corner wall; save/load round-trip preserving the pin; **the safety-gap panel's own 0.75in width must NOT trip the minimum-width Review Log entry**; a wall short enough that the tiler itself emits a sub-24in panel (logged, not blocked).

**Stage 2 — insert / replace / delete.**
*Scope:* generalize `OpeningAnchor` to cover pinned standard-family slots; a place-a-type tool.
*Files:* `packages/geometry/src/tiling.ts` (`OpeningAnchor`, `getOpeningAnchors`, `retileWithOpenings`), `packages/geometry/src/bracedPlacement.ts` (`reconcileBracedPlacement`), `packages/geometry/src/retile.ts`, `apps/web/app/page.tsx`, `apps/web/app/WallElevationDiagram.tsx`, `packages/geometry/src/tiling.test.ts`.
*Acceptance:* insert a panel mid-wall, then resize a window at the other end — the inserted panel is still there, still its width, still in position; the sum invariant holds through both; the tiler-generated-slots-only restatement of the max-width assertion is made deliberately and commented; `reconcileBracedPlacement`'s re-force loop is *observed* to be a no-op for pinned slots rather than assumed.
*Edge cases:* insert with zero free budget (refuses); insert beside a corner; insert on a wall under the 12ft safety-panel threshold (no gap panel exists); delete the last unpinned panel; insert on a mitered (octagon) wall, where `markSafetyCorner` runs afterwards; a wall with a second story whose zones must survive; the panelization-type switch clearing pins.

**Stage 1r — absorb, and the naming change.** *A rider on Stage 1, but its OWN commit — see the Monday read.*
*Scope:* the absorb rule in the tiler; the 24in minimum and the sill's move to 24in; the hyphen drop and the `combinedPanelLabel` parse it breaks.
*Files:* `packages/geometry/src/tiling.ts` (`computePlainSizing`, `buildEvenMiddle`), `packages/panel-catalog/src/data.ts` and `data.test.ts`, `apps/web/app/panelInstances.ts` (`:282` template and `combinedPanelLabel` `:544-550`), `apps/web/app/page.tsx` (Standard width clamp ~5273, `reviewLog` ~5023), `packages/geometry/src/tiling.test.ts`.
*Acceptance:* no tiler-generated panel is under 24in or over 48in on any wall length swept every 1/8in from 96in to 720in, across `standardWidthIn ∈ {24, 39, 40, 48}` and all four corner-ownership combinations; **the sum invariant still holds exactly** on every one of them; a test asserts `panelWidthInRange.maxIn >= 2 * fabricationMinPanelWidthIn` directly, with a comment saying the absorb policy's totality depends on it; `combinedPanelLabel` returns `N3+4+5` and never the string `undefined`; a saved v25 project's walls are byte-identical after load and only change when that wall is edited.
*Edge cases:* `S + r` exactly 48in (split wins — assert it); the safety-gap combine shedding a delta onto an absorbed panel and pushing it out of range; a middle budget under 24in (Review Log, no change); `rawStandardCount === 0`; a clamped corner on a sub-25.5in wall; a window slot's combined label; the jack-stud id `${inst.name}-JS1`.

**Stage 2b — the spanning (triple) header.** *Fully unblocked — model confirmed ("Yes, that's what it is") and naming settled (`H1`).*
*Scope:* a wall-level header record over a slot-index range, occupied by a real Header panel instance whose width is the span.
*Files:* `packages/geometry/src/wallVerticalBands.ts`, `packages/geometry/src/types.ts`, `apps/web/app/panelInstances.ts`, `apps/web/app/WallElevationDiagram.tsx`, `apps/web/app/page.tsx`, `apps/web/app/projectFile.ts` (key added in Stage 0).
*Acceptance:* a header spanning two 3'5½"/3'0" panels reports a span of exactly 6'5½"; the wall's slot widths still sum exactly to its fabrication length (**the header adds no width to the run** — it sits above it); the two panels below are shortened by the header's height and remain independently editable; the header is a real panel instance with its own weight and its own fabrication sheet, not a beam; **it is named `H1` from the single building-wide header series**, its sheet says "East wall — spans E4, E5", and E4's and E5's each say "Header above: H1". **A second header anywhere else in the building becomes `H2` regardless of which wall it is on** — assert that with two headers on two different walls, since a per-wall counter is the natural thing to write by mistake.
*Edge cases:* a span whose ends do not align with slot boundaries (refuse, or snap — decide and say which); a span over a slot that already has zones from a mid-wall beam; resizing a panel under a span; deleting a panel under a span; a span crossing an opening; a span on a wall that later shortens.

**Stage 3 — incomplete walls.**
*Scope:* per-wall run-stop record; the drawing, print, totals and Review Log consequences. **No reference walls.**
*Files:* `packages/geometry/src/retile.ts` (`wallGeometryFor`), `apps/web/app/page.tsx`, `apps/web/app/FootprintCanvas.tsx`, `apps/web/app/WallElevationDiagram.tsx`, `apps/web/app/Building3DView.tsx`, `apps/web/app/panelInstances.ts`, `apps/web/app/projectFile.ts` (keys already added in Stage 0).
*Acceptance:* an unbuilt span produces zero panel instances, zero cut-list rows, zero price, zero weight, zero carbon; **every total derived from a wall length rather than a panel set has been audited and named in the PR**; the footprint still closes and area/floor/roof are unchanged; the elevation and printed sheet both carry the unbuilt dimension; the Review Log carries one line per affected wall; 3D draws nothing along the span.
*Edge cases:* a stop that reaches past a corner panel; a stop longer than the wall; a wall stopped end to end; a stopped wall on a second story; a bump-out inserted on a wall that has stops; a stopped wall that is also a gable end.

**Stage 4 — shop drawings.** *Verify the WebGL print path before committing to the 3D view.*
*Scope:* per-panel sheet gains an overall-size block with the exterior-face diagonal, a three-line weight breakdown, the bird's-eye interior-face preset, clearer per-cut denotation, and Tommy's QC table.
*Files:* `apps/web/app/PanelFabricationPage.tsx`, `apps/web/app/PanelElevationDiagram.tsx`, `apps/web/app/StandardPanel3DView.tsx`, `apps/web/app/SheetTitleBlock.module.css`, `apps/web/app/globals.css` (print rules).
*Acceptance:* the sheet shows length, depth, height and exterior-face diagonal, labelled as the exterior face; weight shows straw (at the catalog's 7 lb/ft³), wood and fasteners as three lines plus a total; the QC table carries Tommy's seven columns in his order plus quality check date and initials; the old single `Actual total weight` line is gone; **the whole sheet prints on one page** (see the paged-media rules — an over-length sheet fragments, and a QC table is exactly the kind of content that pushes it over); an unknown value prints as a visible gap.
*Edge cases:* a panel with no dimensional lumber (`cutList.length === 0`); a fabrication group with many instances (how many QC rows?); the WebGL canvas in print preview; metric mode (the imperial-is-authoritative note applies); a fastener count printed while `fastenerTableStatus` is pending.

**Stage 5 — sheet identity.** **The naming scheme is decided; the hyphen drop rides with Stage 1r; what is left here is the staleness problem.**
*Scope:* project name, revision and date issued on every sheet, plus a "names are positional and valid only for this revision" line on the panel schedule.
*Files:* `apps/web/app/SheetTitleBlock.tsx`, `apps/web/app/DocumentMetaContext` consumers, `apps/web/app/PanelFabricationPage.tsx`.
*Acceptance:* two exports of the same project taken either side of an insert are distinguishable from the printed page alone, without opening the app. **This now covers two independent causes of the same failure** — renumbering, and a saved project re-tiling under the absorb rule when a wall is edited.
*Not in scope:* the renumbering diff (first follow-up).

**Flags check for the `data.ts` changes specifically** — Stage 1r is the only part of Smearforn that touches the catalog, so it gets its own pass:
1. **Two values carry `status` and a `note`:** the new 24in fabrication minimum, and `sillMinWidthIn` moving 23.625 → 24. Both quote Tommy verbatim, axis included. ✔
2. **`confirmed` is correct for both** — first-hand, from Building Integrity, not interpreted. **If the coder finds themselves reasoning about what he meant, downgrade it.**
3. **Both notes trace to a real source** (his own words, dated) rather than restating the number — and the sill's note additionally **preserves the manufacturer's 600mm/23.622" figure it supersedes**, so the older provenance survives the change instead of being deleted. ✔
4. Not structural figures; `PanelStructuralStatus` does not apply. ✔
5. **Both reach the Review Log.** The minimum through the below-minimum entry — including for panels the **tiler** generated, the case a reviewer would never otherwise see — and the sill because a dimension moving because a shop said so is exactly what a reviewer should be told.
6. **`panelWidthInRange.minIn` keeps its own sourced note and status**, unmodified. The one genuinely new risk is the absorb policy's dependence on `maxIn == 2 × minIn`, which is **asserted in a test** rather than trusted to a comment.

**Flags check RUN AGAINST THE BUILT DIFF, 2026-09-24 (Stages 0 and 1).** The whole `data.ts` diff is one added value and nothing else — `git diff` on that file shows a single insertion and zero deletions.

1. **Every real-world number in the diff carries a `status` and a `note`.** Exactly one real-world number was added: `fabricationMinPanelWidthIn = 24`, `status: "confirmed"`, note quoting Tommy verbatim and dated. Everything else in the diff is a mechanism (a pin, a snap, a refusal) or a dimension of one specific design.
2. **Nothing marked `confirmed` is actually researched.** The one `confirmed` value is first-hand from Building Integrity and nothing about it was interpreted: he gave a number, a unit and an axis, and all three are recorded as given. (The downgrade trigger the plan names — "if the coder has to reason about what he meant" — did not fire.)
3. **The note traces to a real source.** His own words, dated 2026-09-24, axis included, rather than a restatement of "24".
4. **No structural figure is involved.** `PanelStructuralStatus` is untouched; no load, shear or fastener value is anywhere in this diff.
5. **It reaches the Review Log.** One entry per panel below the minimum, *however it got there* — including the ones `computePlainSizing` produces by itself, which is the case no human reviewer would otherwise see. The Safety/Gap board (0.75in) is exempt explicitly, and so are openings, whose `widthIn` is a rough opening rather than a fabricated panel width.
6. **What the spec marks open is treated as provisional in the code.** The tiler's own sub-minimum panels are reported and NOT corrected (`computePlainSizing`'s split rule is untouched); `sillMinWidthIn` is left at 23.625in with its manufacturer note — **Tommy has since decided sills follow the same 2ft rule, and that move is deliberately NOT made here**: it is its own change with its own Review Log entry (the plan's Stage 1r), not a side effect of adding a different value, and the doc comment says so; `columnMinWidthIn` is untouched; Stage 2b's unconfirmed model got no stored key. **No existing catalog number was rounded, widened or deleted to make anything fit.**

**Flags check RUN AGAINST THE BUILT DIFF, 2026-09-25 (Stage 1r).** The whole `data.ts` diff is **one value and its doc comments**: `sillMinWidthIn` 23.625 → 24. Nothing else in the catalog moved.

1. **Every real-world number in the diff carries a `status` and a `note`.** Exactly one building value changed, and the change *adds* a flag where there was none — it was a bare `export const` with a one-line comment and is now a `CatalogValue<number>`, `confirmed`, with a real note. The only other numbers in the whole 1r diff are the tiler's copies of 24 and 48, which are not new facts: they are duplicates of catalog values, and a test asserts they still equal them.
2. **Nothing marked `confirmed` is actually researched.** First-hand from Building Integrity. The application to sills is Tommy's own answer to a direct question, recorded in Open Items and dated, not an inference from the panel rule — and **the note says which it is**, quoting him and then naming the question he was asked, rather than manufacturing a sentence he did not say. The downgrade trigger ("if the coder has to reason about what he meant") did not fire.
3. **The note traces to a real source**, and it carries the superseded one too: the mfr spec sheet's 600mm / 23.622in, the 1/8in rounding that made it 23⅝", and the date it stopped being the value. A superseded provenance that gets deleted is indistinguishable from a number nobody ever sourced. `data.test.ts` asserts the note still contains "600mm" and "23.622", so it cannot be tidied away later.
4. **No structural figure is involved.** `PanelStructuralStatus` untouched; no load, shear, fastener or density value anywhere in the diff.
5. **Both reach the Review Log.** The fabrication minimum through the below-minimum entry, whose *job has narrowed* now that the tiler no longer produces sub-minimum panels by itself — it now reports the three residual paths and anything a stored file arrives carrying. The sill through a new `CATALOG_SUPERSESSIONS` entry, appended after `toReviewLog` rather than given a false `pending` status to sneak past its filter.
6. **What the spec marks open is treated as provisional.** The 51–75in two-corner band is **not** attempted — Tommy flagged it and deferred it to corner geometry after admin tooling — and has a test asserting it still behaves as documented; the other two residuals likewise. `panelWidthInRange.minIn` still reads 15.75 with its manufacturer note and its own guard test; `columnMinWidthIn` untouched; `bigHeaderWidthInRange` still `pending-BI-confirmation` and not widened; Stage 2b's unconfirmed model got no code. **No existing catalog number was rounded, widened or deleted to make anything fit** — the one number that moved is the one Tommy decided to move.

**⚠ One thing this check surfaces that is NOT clean, recorded rather than passed over:** `sillMinWidthIn` is now a confirmed limit with **no consumer**. `computeSillRunWidths` does not enforce it and `findSubMinimumPanelWidths` cannot see sills, because a sill is derived per opening rather than stored as a slot. The plan scoped 1r's tiler work to `computePlainSizing` and `buildEvenMiddle`, so this was left alone deliberately — but a limit nothing enforces reads from the outside exactly like one being honoured. It is in the function's doc comment and in Open Items.

---

### Flags check — run against this plan, per the 6-point check

1. **Does every real-world number in the diff carry a `status` and a `note`?** **One new building number, and it is the only one in all of Smearforn:** the 24in Building Integrity fabrication minimum, added to `data.ts` as a `CatalogValue` with `status: "confirmed"` and Tommy's own words as its note. See its dedicated flags pass above. Everything else — a pinned panel width, a run stop, a header span — is a dimension of one specific design, the same class as a wall length, and correctly carries no flag. Stage 4 adds nothing: the 7 lb/ft³ straw density it needs is already there, already `confirmed`.
2. **Anything marked `confirmed` that is actually researched?** **No — and one number is being deliberately preserved rather than overwritten.** `panelWidthInRange.minIn = 15.75` keeps its manufacturer-sourced note; Tommy's 24in is added alongside it as a separate, differently-sourced fact. **Two earlier drafts of this check were wrong about this pair and both are corrected rather than quietly deleted:** the first claimed a confirmed catalog value was contradicted by an as-built drawing (it rested on reading the ADU's 14" *depth* as a width); the second left 24in open on the strength of a "pretty sure" that Tommy has since unhedged. The number is now first-hand and definitive, and the manufacturer's number was never in conflict with it.
3. **Do the notes trace to a real source?** One note is written — the minimum-width value's — and it quotes Tommy verbatim and dated, axis included, rather than restating the number. ✔
4. **Structural figures using `PanelStructuralStatus` with no invented value?** None in scope. **Two adjacent risks stay live:** `bigHeaderWidthInRange` (48–144in) is `pending-BI-confirmation` as Tommy's own stated range and **does not get widened to fit a drawing**; and Stage 4 prints fastener counts that inherit `fastenerTableStatus`, also pending — **a number does not become confirmed by being printed in a table**, which is the specific way this convention gets eroded.
5. **Does the value surface in the Review Log?** **Two new entries:** one per panel below the 24in fabrication minimum **however it got there — typed, dragged, or tiler-generated**, and one per wall carrying an unbuilt span. Both go through the existing `reviewLog` useMemo (`page.tsx:5023`). The tiler-generated case is the important one: it is a real defect that no human reviewer would otherwise see.
6. **Where the spec marks something open, does the code treat it as provisional?** Yes: the tiler's sub-minimum panels are **reported rather than silently corrected**, because correcting them is a change to every existing wall and needs Tommy's decision; the sill minimum's ⅜" conflict is logged rather than rounded; Stage 2b does not invent a name for a spanning header while the naming rule is open; and Stage 4's QC table leaves the shop's own measurements blank rather than pre-filling them with modeled values, which is the same principle applied to paper.

**The 1/8in grid itself remains a precision convention, not a building value** — pinned widths quantize exactly like everything else, and nothing here needs anyone's engineering sign-off.

### Open Items — Project Smearforn

**Answered 2026-09-24 — kept short, struck rather than deleted so the reasoning survives:**

- ~~Build order?~~ **4C → Smearforn → Stage 5.** *"I like 4c then Smearforn then admin tooling."*
- ~~Is a 14in panel real?~~ **It was never a width — 14in is the panel depth**, the `looseDensePackThicknessOptionsIn` option this job uses throughout. Every ADU width is ≥24in. My error, corrected in the evidence section.
- ~~What are `E4A/E4B/E4C`?~~ **One header panel spanning two panels below it**, verified: 3'5½" + 3'0" = 6'5½". Not three adjacent panels. See "The triple header".
- ~~Panel labels `E4` or `E-4`?~~ **Moved into the nomenclature workstream and settled there — `E4`.**
- ~~Corner treatment at a reference wall?~~ **No such wall.** *"For new construction the bare walls meet the other bare walls... just a simple end to our wall, no need to have the rest of the plan drawn."*
- ~~Scope checkboxes in Panelizer or ⚙?~~ **Panelizer.** Unchanged.
- ~~Hand-placed Safety/Gap panels?~~ **Not this pass.** Unchanged; the Stage 2 anchor mechanism would carry it cheaply whenever he wants it.

- ~~Is 24in Building Integrity's real minimum panel width?~~ **Yes, unhedged 2026-09-24:** *"I can't make any panels that are left to right elevation view shorter than 2'."* Recorded as a new `confirmed` catalog value; `panelWidthInRange.minIn` untouched; `PANEL_DRAG_FLOOR_IN` folded into it. See "The minimum panel width".
- ~~Nomenclature scheme?~~ **Positional, `CARDINALDIRECTIONLETTER-NUMBER`, renumber everything downstream.** Already how the app behaves; the work is in the consequences.
- ~~Cut-length denotation / QC rows / the addition toe-up?~~ **Accepted as recommended:** dimension leaders on the drawing, one QC row per placed copy with the ID pre-filled, and the toe-up recorded but not built.

- ~~What should the tiler do when its arithmetic produces a sub-24in panel?~~ **ABSORB** — one wider panel instead of two narrow ones. Chosen over report-only, widening the safety gap, and refusing the wall length. Worked out above: it never collides with the 48in ceiling, **but only because 48 is exactly twice 24.**
- ~~Does the 2' rule apply to sills?~~ **Yes.** `sillMinWidthIn` 23.625 → 24, as a Building Integrity value superseding the manufacturer's, with the manufacturer's figure preserved in the note.
- ~~How does a spanning header get named?~~ **One building-wide series, `H1`/`H2`/`H3`, no direction prefix.** Chosen over a per-direction series on the stencil-rack reasoning. A header's name says what it is, never where it is — which is why the sheet cross-reference is now **required**, not optional.
- ~~`E-4` or `E4`?~~ **`E4`.** *"I have spray paint stencils in the shop, and there is no huphen stencil."*
- ~~Confirm the spanning-header MODEL?~~ **Confirmed: *"Yes, that's what it is."*** A header covering a slot range, reusing the mid-wall-beam coverage mechanism. **Asked three times across this plan's drafts; settled. Stop re-listing it.**
- ~~Do two walls facing the same direction share one number run?~~ **Yes — decided at the third asking**, on the grounds that every panel name in the building stays unique, which is what the shop needs when it stacks by label.
- ~~Do the harnesses move into the repo?~~ **Yes, folded into the next build rather than done as its own task.** The Stage 0/1 coder already carries that instruction for its own harness; **4B's and 4C's existing harnesses come in when someone is next in that code.** The framing that justified it, kept because it generalises: *"the harness is currently the least-reviewed artefact in the project while being cited as proof of the most sensitive guarantee."* A "42 of 42" read out of an unreadable harness is a **report, not evidence** — including the single DOM check that a user id never reaches a rendered page.

**Still open:**

- **⚠ Does the 2ft rule get ENFORCED on sills, or only recorded?** `sillMinWidthIn` is now a confirmed 24in (Stage 1r) and **nothing consumes it.** `computeSillRunWidths` divides a rough opening into `ceil(RO ÷ standardWidth)` even sills with no floor, so a 44in RO at a 40in standard still yields two 22in sills; and the Review Log's below-minimum entry walks wall *slots*, which a sill is not, so it is not even reported. **Recommended default: give `computeSillRunWidths` the same absorb rule the tiler now has** — it is the same arithmetic, in the same shape, one function over — **and extend the Review Log walk to sills.** Not done in 1r because the plan scoped its tiler work to `computePlainSizing` and `buildEvenMiddle` by name, and widening a confirmed building limit's blast radius unasked is exactly the kind of scope creep this log exists to prevent. But a limit nothing enforces looks, from outside, identical to one being honoured.
- **⚠ Should the panel-boundary drag have a CEILING as well as a floor?** It stops the shrinking panel at 24in and lets the growing one pass 48in — the harness recorded a 56in panel produced by an ordinary drag. The typed width field clamps at 48in, so the same limit is enforced through one gesture and not the other. Pre-existing Stage 1 behaviour, not touched by 1r. **Recommended default: clamp the drag at `panelWidthInRange.maxIn` the way the typed field already does**, since the asymmetry is almost certainly an oversight rather than a decision — but it is a behaviour change to a shipped gesture, so it is his call, not a silent fix.
- **⚠ `applyBracedPlacement`'s corner-brace combine can still shed a panel out of range**, including to zero width, which then makes the wall's own total wrong. **Pre-existing and measured, not inferred:** 32,266 offending cases before the absorb rule and 3,279 after, where 3,279 is exactly the number of cases in which the combine fires either side of the change. Absorb removed nine tenths of the problem and left this tenth fully exposed. It is braced placement rather than tiling, so it was out of 1r's scope; `shedWidthToNearestStandard` already documents the "wall's total length will be off by deltaIn" tradeoff, which was written when it was rare.
- **⚠ A wall whose middle budget lands under 24in has no legal tiling and absorb cannot reach it** — a wall owning two corners and between 51" and 75" long, e.g. a 6ft bump-out return. **Recommended default: Review Log entry, no behaviour change this pass.** The likely real fix is extending the merged-corner rule `resolveCorners` already applies to a wall too short for both corners — but that changes corner geometry, which is real construction, and is his call.

**ANSWERED by Tommy 2026-09-24 — flagged and deferred until after Stage 5 (admin tooling), and the merged-corner route is the one he wants:** *"I want to prioritize good building principles here with the panelizer. I like the corner geometry rule… Let's flag this and return to it after admin tooling."* So the fence-around-the-problem option is rejected on purpose.

- **He was first offered a 6' minimum bump-out and I checked the arithmetic rather than recording it.** `cornerPanelWidthIn` is **25.5"** (24" core + two ¾" plywood faces), so a wall owning two corners spends **51"** on them. The middle is `L − 51`, which is under 24" for every `L` below **75"**. **6' is 72", leaving a 21" middle — three inches inside the broken band.** The first legal two-corner wall is **75" (6'3")**, where the middle is exactly 24". Recording "6' minimum" would have produced precisely the panel his shop cannot build, under a rule bearing his name.
- **Interim behaviour, in force until the fix lands:** a two-corner wall between 51" and 75" still yields a sub-24" middle, reported in the Review Log rather than silently shipped. Below 51" the existing merged-corner rule already handles it; 75" and above is legal.
- **⚠ Watch on the Rogers-Sehorn ADU:** `5'-1¾"` (61¾") appears among its plan dimensions, inside the broken band. If that is a wall owning two corners rather than an overall dimension, it will flag when he draws the job. Told to him as a thing to watch for, not asserted either way.
- **Does the shop have an `H` stencil?** The eight-prefix question is gone with the per-direction series — but the format is still downstream of a physical rack, and it now depends on exactly one new character. Worth thirty seconds of looking. No recommended default: it is a question about objects on a shelf.

---

## Top Bar & App Chrome — the Stitch reorganisation (2026-09-13) — Stage 1 BUILT (overflow fix); Stage 2 BUILT (wordmark + nav at 1200px, name grows — see Tommy's 2026-09-13 decisions); Stage 3 BUILT (footer — role disclaimer, no policy links yet; sidebar/tray re-skin not done)

Two things arrived at the same answer: a real overflow bug that hides the sign-in control, and the Stitch mockups (`part 1 ui stitch/` and `part 2 ui stitch/`, each holding `code.html`, `screen.png` and a **byte-identical** `DESIGN.md`). **Stitch's header is not a restyle of today's bar — it is structurally smaller, and that is what fixes the bug.** Recorded as one decision so the fix is not improvised twice.

### The bug, measured

`TopBar.module.css`'s `.row` is a single `flex-wrap: nowrap` row with `overflow-x: auto`. Measured on the live site: **the row needs 1407px**. In a **710px** viewport it overflows by **697px**, and because `AccountControl` is the **last child in the row**, it is the first thing to fall off — **677px past the right edge**. Tommy could not find how to sign in; that is why.

**This is not merely inconvenient, it breaks a decision already made.** The backend section requires the acting-as company to be *"visible at all times, not buried in a menu,"* because the failure it prevents — saving a project into the wrong company's folder tree — is silent, plausible, and noticed later by someone else. **A control you must scroll sideways to find does not satisfy that.** `AccountControl.tsx`'s own doc comment already claims "always visible"; today the CSS makes that claim false.

Two smaller things fall out with it:

- **`overflow-x: auto` is itself a trap and goes away.** Per the CSS spec, setting one axis to a non-`visible` value forces the other to `auto`; that already caused one shipped bug (nested popovers clipped into the bar's 56px height — see `TopBar.tsx`'s doc comment and the `StickyNote` pattern that replaced them). Once the bar fits by construction the scroller has no job left, and removing it converts a future overflow from **silent off-screen content** into **visible breakage**. Same principle this log applies to silent rounding and to cost redaction: a visible gap beats a plausible-looking nothing.
- **There is no responsive story today.** The one rule, `@media (max-width: 900px) { .row { justify-content: flex-start } }`, changes the alignment of a row that already does not fit. Nothing collapses at any width.

### Evidence the design was drawn against this app, not at it

Worth stating because it changes how much of Stitch to take literally. **Three of its spacing tokens are already the app's own numbers:** `topbar-height: 56px` = `--topbar-height: 56px` in `globals.css`; `sidebar-width: 240px` = `.editorSidebar`'s `flex: 0 0 240px`; `tray-width: 170px` = `SectionCarousel.module.css`'s `width: 170px` and `.editorRightSpacer`'s matching 170px. Backend Stage 1 also landed the **chrome token layer** in `globals.css` using DESIGN.md's own Material-style vocabulary (`surface`, `surface-container-lowest`…`highest`, `on-surface`, `outline`, `primary`, `secondary`) under a `--bi-` prefix, with today's rendered values as defaults so nothing moved visually. **This pass is what starts consuming that layer.**

**The hard rule from the theming decision is unchanged and governs everything below: chrome re-skins, drawing semantics never do.** Member colours by role, material colours, the floor opacity bands, `pending-amber`, the review-log red encode meaning. A stud must not change colour because of who is looking.

### The decision this pass turns on — where the account / acting-as control lives

The Stitch mockups predate auth and have no such control, so there is nothing to copy. **Decision: the header becomes three zones, and the account control lives in the LEFT zone, immediately after the wordmark.**

| Zone | Contents | Shrink behaviour |
|---|---|---|
| **Left — identity & document** | Wordmark (1200px and up) · **Acting as ▾ / Sign in** · **Project ▾** | the account control and Project never shed; the name truncates before anything disappears |
| **Middle — scope** | Wall · Foundation · Floor · Roof | sheds whole, below 1200px *(was `md`; see "Tommy's decisions, 2026-09-13")* |
| **Right — presentation** | **Role: ▾** · ⚙ settings · ? help | sheds only the help icon |

**Why left, stated as reasons rather than taste:**

1. **It is the only placement that cannot reproduce the bug.** In an LTR overflow the rightmost content falls off first. Today's control is last in the row; that is the entire cause. Putting it first makes it the last thing that could ever be lost.
2. **It keeps the two role axes at opposite ends, and now for a structural reason rather than by luck.** `TopBar.tsx` already sites them apart deliberately ("those are the two axes that must never be merged, and sitting them side by side is how someone starts reading one as a level of the other"). Under the zone model the separation stops being a seating chart and becomes a taxonomy: **permission lives in the identity zone, presentation lives in the presentation zone.** Stitch puts `Role:` on the right; if the account control went right too, they would be adjacent dropdowns — the exact conflation the spec forbids.
3. **The theme decision already points this way.** The theme follows the company you are **acting as**, so eventually the whole interface colour is an ambient acting-as indicator. Sitting the company name against the wordmark makes brand + company read as one identity block, which is what the colour shift will reinforce.
4. **It is the document-header convention, not the SaaS convention.** This app's own printed output puts the producing party at top-left (`SheetTitleBlock`'s wordmark). The on-screen header matching that is coherent.

**The cost, accepted:** account-at-top-right is the more common web convention, and the wordmark is no longer flush against an empty left margin. Judged smaller than any of the four reasons above.

**Rejected, with reasons — recorded so they are not re-proposed:**

- **Absorbed into the ⚙ settings icon.** Directly violates "visible at all times, not buried in a menu." Not a trade-off; a contradiction of a decision already taken. **Do not build this even as an interim.**
- **Right end, after `Role:` (the conventional spot).** Two failures: it sits the permission axis against the presentation axis as visually-matched dropdowns, and it re-creates the exact geometry that produced this bug — last-in-row, first-to-fall. Survivable with a non-shrinking right zone, but it is the placement with the worst failure mode for no gain beyond familiarity.
- **Its own fixed element outside the header** (a floating chip). No home in either mockup; adds a fourth fixed chrome layer competing with the canvas, the sidebar and the tray in a permanently-fullscreen editor; and it detaches identity from the one place users look for it.

**Visual distinctness is a requirement, not a preference.** The acting-as control keeps its bordered chip (`--bi-surface-container-low`, uppercase "ACTING AS" caption, company by name). The viewer-role control takes Stitch's filled pill on `surface-container-high` and reads **"Role: Engineer"** — never bare "Engineer", which next to a company name reads as a job title or a permission level. The open role menu carries one line of prose: *changes which disclaimer prints; it is not a permission.* They must not become two matched dropdowns.

### Where the rest of today's bar goes

The split that decides it: **the Project menu holds things that change the building or the file. Settings holds things that change only how you look at it.**

| Today | Goes to | Why |
|---|---|---|
| Save Project · Load Project | **Project ▾** (left) | It is the file. Stage 2's cloud save / open / version history joins the same menu rather than needing a new home. |
| Site Properties | **Project ▾** | Zip, seismic zone, foundation type, pier spacing are design inputs that change the building — not preferences. |
| Panelizer | **Project ▾** | Holds the "keyhole" checkboxes that gate which editor tabs exist, plus panel width/thickness/density/wall height. Burying the project's core parameters under a gear icon would be wrong. |
| Imperial / Metric | **⚙ Settings** | Display-only by explicit decision (*"the unit toggle is display-only and never changes stored geometry"*), so it is a viewer preference. See Open Items — Tommy may want it back on the bar surface. |
| Admin Options (Show All Detail Pages) | **⚙ Settings**, still gated on `role !== "public"` | Tied to the viewer role, which is presentation. |
| Public/Fabricator/Admin/Engineer (4 buttons) | **Role: ▾** (one control) | This is Stitch's structural answer to the overflow: four buttons become one. |

Each menu keeps opening as a real `StickyNote`, exactly as today — that pattern exists because the old nested popovers were clipped by `.row`'s overflow, and a `position: fixed` note escapes the overflow context. **No new popover mechanism.**

**The ⚙ and ? buttons are icon-only and therefore need real accessible names** (`aria-label`), and a `title`. **Use inline SVG, not Material Symbols** — Stitch's markup pulls a Google webfont, which adds a network dependency, a FOUT, and a licensing question for a two-icon need. **The help icon has no content to show today**; see Open Items. Do not ship an icon that opens nothing.

### The editor tabs, and what happens to `EditorTabDial`

**Decision: the Wall/Foundation/Floor/Roof nav moves into the header's middle zone at 1200px and up; `EditorTabDial` is kept and is the below-1200px form.** Not deleted. *(Originally `md` = 768px. Measured not to fit without taking width from the acting-as company name — see "Tommy's decisions, 2026-09-13" below.)*

- Both are controlled by the same `editorTab` state in `page.tsx` — one source of truth, two presentations, **never both visible at once and never neither.**
- The header nav must honour the **same `enabledTabs` keyhole** the dial does (Panelizer's checkboxes gate Wall/Floor/Roof; Foundation is always included by the caller). A ruled-out tab is **absent from the nav**, not shown-and-inert.
- Keeping the dial is what makes the below-1200px story possible at all — Stitch marks its own nav `hidden md:flex` and simply offers nothing in its place, and the nav was measured not to fit beside the acting-as name until ~1200px (see Tommy's decisions, 2026-09-13). **Tommy's own 710px viewport is below 1200px**, so his everyday case is the one the dial covers.
- `EditorToolbar.tsx` is the dial's only wrapper and is Region 2 of the sidebar's documented three-region layout. Hiding it at 1200px and up shifts Region 3 upward — acceptable, because that happens at a breakpoint rather than during use, so Region 1's "height never varies" property survives.
- **Reversible.** If Tommy wants the dial gone entirely, it is a deletion at one call site, and the reverse (dial always visible, nav never) is the same size. Logged in Open Items.

### The responsive story — an explicit shed order

The bar must fit, without horizontal scroll, at every width down to **360px**. What sheds, in order:

1. **The nav tabs and the wordmark**, together, below 1200px → `EditorTabDial` appears in the sidebar. *(Was: nav below `md`, wordmark third. Changed 2026-09-13 by Tommy's decision: at `md` neither fits without taking width from the company name.)*
2. **The "ACTING AS" caption word.** The company name stays. **It goes below `md` (`max-width: 767px`), together with the carets and the tighter padding — before the company name loses any width.** Stage 1 first shed at 600px, and between ~601 and 700px the name was cut to "The See…" while the caption still showed: the order above, inverted. Corrected in review, 2026-09-13.
3. *(Now folded into step 1 — the wordmark sheds with the nav at 1200px.)* Originally: **the wordmark text** → nothing (no logo asset exists in the app today; `SheetTitleBlock` renders a text wordmark too). The acting-as / sign-in control takes the leftmost position, with Project ▾ after it. *(Corrected 2026-09-13: this line and the zone table above both put Project first, contradicting the decision they sit under — account control immediately after the wordmark. Stage 1 was built account-first and review confirmed that as the right reading.)*
4. **The help icon.**
5. **Nothing else.** The acting-as company name, the Project menu, the `Role:` control and the ⚙ icon are **never shed at any width.** If it still does not fit, the company name truncates with an ellipsis plus a `title` — **truncated but present beats absent**, which is the entire lesson of this bug.

**Breakpoint hygiene:** the app already has 900px (TopBar) and 600px (`page.module.css`, `EditorTabDial`). Stitch implies `md` = 768px. The 900px rule is deleted with the row it modifies; **do not invent a fourth number**, and write the two that remain in one commented block at the top of `TopBar.module.css`. Reconciling 768 vs 600 app-wide is out of scope this pass. **As built in Stage 1, the top bar uses only 768** (as `max-width: 767px`); 600 stays where it already was, outside the bar. **As built in Stage 2, the top bar changes at 1200 and 768, plus the 360px floor** — 1200 added knowingly by Tommy's 2026-09-13 decision. It is written as one `min-width: 1200px` condition that shows the nav and wordmark and (in `EditorToolbar.module.css`) hides the dial, rather than a `max-width: 1199px` / `min-width: 1200px` pair: two opposite queries both fail at a fractional viewport width such as 1199.5px under browser zoom, one condition cannot, so exactly one tab control shows at every width.

### Departures from the mockups, deliberate

A coder copying `code.html` would reintroduce shipped bugs. Named so they do not:

- **`dark:` variants are NOT adopted.** `part 1 ui stitch/code.html` carries them throughout. `globals.css` documents killing the boilerplate `prefers-color-scheme: dark` query after Tommy reported invisible button labels on a phone: *"This app has no actual dark theme (every component hardcodes light colors)."* Reintroducing dark classes reproduces that bug exactly.
- **The side panels stay flex children; they do not become `position: fixed`.** Stitch's `aside`s are fixed with `main` offset by margins. `page.module.css` says the opposite deliberately: *"both side columns are real flex layout space now, not absolutely-positioned overlays, so the canvas never renders underneath them."* Same visual result, and the app's version already survived the problem the mockup's version invites.
- **The sidebar does not disappear below `md`.** Stitch marks it `hidden md:flex`; the app narrows it to 64px at ≤600px, deliberately, so the tools stay reachable. Keep the app's behaviour.
- **The tray is not new work.** Part 2's 170px right `aside` is `SectionCarousel`, already built and already 170px. Part 1 has no tray, which is a difference between mockups rather than a decision to make. **Scope: the tray is re-skinned at most, never rebuilt.**
- **The wordmark must not use `header-gold`.** Stitch paints it `text-header-gold` (`#c9a63f`) — which in that same DESIGN.md is a **panel semantic** colour, sitting among `standard-panel`, `corner-panel`, `braced-panel`. Using it for the brand couples the wordmark to the header-panel colour, so re-theming one would move the other. **Use `--bi-primary` (navy), or add a dedicated `--bi-wordmark`.**
- **Mockup copy is not content.** "Project Alpha", "V1.0.4-Stable", "PL / Project Lead", "Building Integrity © 2024" are lorem. None of it ships.
- **`--topbar-height` stays exactly 56px.** `.main`, `SectionCarousel`, and `StickyNote`'s default spawn point *and* fullscreen state all measure against it. A bar that renders 57px tall drifts all four.

### Tommy's decisions, 2026-09-13 — the nav moves to 1200px, and the company name grows

**Why the original "nav at `md`" changed: it was measured not to fit.** Headless Chrome against the built Stage 1 bar, four companies, "Role: Fabricator": at 768px the row is 728px wide and needed 694px — left zone 503px with the company name at its 220px cap, right zone 181px — leaving **34px spare**. Stage 2 adds the wordmark (132px at headline-md) and four tabs (~250px), roughly **380px**. At `md` that could only come out of the company name, which the Stage 1 fix exists to protect. Every alternative (a later breakpoint, reordering the shed order, letting the name truncate, JS fit-detection) contradicted a line of this section, so the implementer stopped and it went to Tommy.

1. **Wordmark and nav at 1200px and up; `EditorTabDial` below.** A third top-bar width, chosen knowingly: the bar changes at 1200 and 768, plus the 360px floor. Below 1200 the bar is exactly Stage 1's. One CSS condition flips nav and dial in opposite directions, so exactly one shows; both render one shared definition (`editorTabs.ts`) from `page.tsx`'s one `editorTab` state.
   - **Tab type role, chosen by measurement at exactly 1200px** with all four tabs enabled, four companies, "Role: Fabricator": label-sm (12px/600) — nav 246px, name 270px, full label; **body-lg (14px/400) — nav 254px, name 270px, full label — chosen**; headline-md (16px/600, Stitch's own header role) — nav 292px, name 242px, above 220 but cutting "(platform admin)" at the boundary. body-lg is the largest role that keeps the full label readable at 1200. The current tab is marked by navy text and a 2px underline, not by weight, so switching tabs never changes the bar's width.
2. **The acting-as company name grows at 1200px and up.** Tommy: use the spare room so the "(platform admin)" / "(consortium)" tag is readable — it is what tells acting-as-Seed apart from belonging to Seed. Below 1200 the 220px cap is unchanged. At 1200 and up the cap is **280px**: "The Seed Collaborative (platform admin)", the longest real label, renders at 270px (13px/600 Geist, including the select's arrow), plus 10px. The nav, Project, Role and ⚙ do not shrink; only the name can give, so growth can never push a control off-screen. A longer company name than today's truncates at 280px and needs re-measuring. Layout measurements, not building values.

### The footer legal bar — built 2026-09-13 without the policy links (originally deferred; reasons kept below)

Stitch adds a fixed footer on `warning-red` carrying "Engineered Scope View", a provenance line, and Privacy Policy / Legal Disclaimer links. The app has no footer today. **Not in this pass.** It is a good idea with three unresolved dependencies, none of which are layout:

1. **There are no Privacy Policy or Legal Disclaimer documents.** Those are real legal texts; they are not mine to draft and not the coder's to stub. Needs Tommy.
2. **It costs canvas height in a permanently-fullscreen editor, and four things measure against the top bar only.** A footer needs a matching `--footer-height` consumed by `.main`, `SectionCarousel`, `StickyNote`'s spawn point and its fullscreen state, or it overlaps them. That is the same drift class `--topbar-height` was introduced to end.
3. **The disclaimer strings do not fit.** `roleDisclaimers[role].text` runs to ~200 characters for `engineer`, and DESIGN.md's own rule is that legal text never drops below 11px. Stitch's footer is 24px tall. So either the footer carries a short badge with the full text staying where it is, or it is taller than the mockup. A real decision, not a CSS detail.

**Hard rule whenever it does land: the footer renders `roleDisclaimers[role].text` verbatim. Those strings are the app's legal posture and may be relocated but never reworded.** Editing one is a legal change wearing a layout change's clothes. Its red is **chrome** (a banner), so it may take `--bi-error`; it is not the review-log red, which encodes meaning and stays hardcoded.

**As built (Stage 3, 2026-09-13).** How each of the three blockers was handled:

1. **Policy links: not built.** No Privacy Policy or Legal Disclaimer page and no `#` links. `AppFooter.tsx` has a commented slot at the right end of the strip for them. Waiting on Tommy's documents (Open Items).
2. **Height: `--footer-height: 24px`** (`globals.css`), the Stitch footer's own height. It is used everywhere `--topbar-height` measures the top edge: `.main`'s `bottom` (`page.module.css`), `SectionCarousel`'s `bottom`, `StickyNote`'s `.noteFullscreen` `bottom`, and the **spawn state** through an inline `max-height: min(75vh, calc(100vh - spawnTop - var(--footer-height) - 12px))` in `StickyNote.tsx`. Before this, a note spawned low on a short viewport ran under the bottom edge. The cap follows the spawn position, not the drag position, so a note does not resize while being dragged.
3. **Disclaimer length: solved in layout, not text.** The footer renders `roleDisclaimers[role]` by reference (`footerDisclaimer.ts`, with a test that the object and strings are identical). The strip is one line at 11px (the floor), and the text is the only thing that shrinks, ending in an ellipsis. **The whole strip is a button:**
   - its accessible name and `title` are the full text
   - clicking, tapping, or Enter opens the full wrapped text in a panel that grows **upward** from the strip; the strip or Escape closes it.

   The strip never changes height, so `--footer-height` stays constant. The footer's z-index (600) sits above a fullscreen note (500); otherwise the upward panel would open underneath one.

**Colour.** New chrome tokens `--bi-footer-surface: var(--bi-error)` and `--bi-footer-label: var(--bi-on-error)`. `--bi-on-error: #ffffff` is also new, from DESIGN.md's `on-error`. Stitch's `warning-red` (#c0392b) is **not** used: DESIGN.md lists it next to `pending-amber` and the panel colours, which is the semantic family. `error-container` was only its `dark:` variant, and `dark:` is not adopted. `#a33` is untouched. The footer is wrapped in `print-hidden-chrome`, like the top bar.

**Verified in headless Chrome** at 1920, 1280, 1200, 1199, 768, 710, 600 and 360 (900px tall), four companies, every role:
- **Layout:** zero page overflow on both axes; top bar 56px; footer 24px and fully on-screen.
- **Nothing under the footer:** `.main`, the tray, six cascaded spawned notes, and a fullscreen note all end at or above its top edge. At 600 and 360 the spawn cap engaged, with notes stopping 12px above the footer.
- **Disclaimer text:** verbatim in the strip, its `title`, and the expanded panel. The panel is on-screen, needs no scrolling, and is not covered, including over a fullscreen note. It tracks role changes.
- **Top bar name width:** unchanged from Stage 2 (270px at ≥1200; 220px from 1199 to 600; 71.9px for Fabricator at 360).
- **Print:** the footer renders nothing under print emulation. A print-targeted note's layout is identical with and without both Stage 3 changes (footer node removed, inline max-height cleared).

The engineer text truncates at 768 and below; the other three roles truncate only at 600 and below.

### Staging — the bug fix ships alone

**Stage 1 — Overflow and the account control.** The three zones, the non-shrinking left and right, the shed order, four role buttons → one `Role:` control, Project and ⚙ menus, `overflow-x: auto` removed, `AccountControl` pinned in the left zone. **This is the whole bug fix and it is shippable on its own.** No wordmark, no nav, no restyle.
**Stage 2 — The Stitch header shape.** Wordmark, the Wall/Foundation/Floor/Roof nav in the middle zone, `EditorTabDial` demoted to below-1200px (was below-`md`; see Tommy's 2026-09-13 decisions), `TopBar.module.css`'s hardcoded hex migrated onto the existing `--bi-*` tokens, Geist type roles applied to the bar. **Built 2026-09-13**, per Tommy's decisions above: wordmark and nav at 1200px and up, `EditorTabDial` below, one shared `editorTabs.ts`; the company name's cap rises to 280px at 1200px and up; `TopBar.module.css` on the `--bi-*` tokens (no visual change); Geist roles (wordmark headline-md, controls body-md, tabs body-lg by measurement, menu titles label-sm); `AccountControl.tsx` uses `clampMenuLeft` and re-clamps its note on resize. No help icon (nothing to open). **Verified in headless Chrome** at 1920, 1440, 1280, 1200, 1199, 1024, 768, 767, 710, 640, 600 and 360, signed out and with four companies, all four roles, all four scope tabs enabled: zero page and row overflow, header 56px, account control inside the viewport, exactly one of nav/dial with tabs in sync from either, every menu on-screen, company name 220px from 1199 to 600 and identical to Stage 1 at 360, and the full "The Seed Collaborative (platform admin)" (270px) at every width from 1200 up. Still for Tommy on the live build: whether the dial should survive at desktop width (Open Items).
**Stage 3 — Footer, and the rest of the chrome.** Blocked on the three footer questions above; the sidebar and tray re-skin rides here. Nothing in Stage 3 is urgent. **Footer built 2026-09-13** (see "As built" under the footer legal bar above): role disclaimer verbatim, `--footer-height` consumed by all four bottom-edge consumers, no policy links. **Not done in that pass:** the Privacy Policy / Legal Disclaimer links (awaiting Tommy's documents), and the sidebar and tray re-skin, which was not part of the footer handoff.

**Explicitly not in scope for any of the three:** the sidebar's *contents*, the tray's *contents*, the canvas, `ViewerDial`, per-company theme *values* (only the token layer is consumed), and any change to `viewerRole.ts`'s strings.

**Flags check: expected clean, verified against the code rather than assumed.** No `CatalogValue`, `CatalogRange` or `PanelStructuralStatus` is in scope; `data.ts` is not touched; no fastener spacing, load, density, dimension or cost figure moves; nothing new reaches the Review Log. Every number in this section (56px, 240px, 170px, 768px, 600px, 360px) is a layout measurement, not a building value. The one thing to watch: `roleDisclaimers` text is legal-posture content — it may be **relocated or re-presented, never edited** — and the redaction-adjacent principle applies to the bar as much as to the server, in that a control which is present-but-off-screen is the UI equivalent of a plausible substituted number. The coder re-runs the 6-point check against the actual diff.

---

## Provisional Values — the `status` flag convention

Every spec-derived number in `packages/panel-catalog/src/data.ts` is wrapped in a `CatalogValue<T>`, `CatalogRange`, or `PanelStructuralStatus` carrying `status: "confirmed" | "pending-BI-confirmation"` plus a `note` tracing back to its source. This is the machine-readable half of this decisions log: **the log says what was decided, the flag says how solid it is.**

- `"confirmed"` — traceable to Building Integrity, the New Frameworks source documents, Tommy's own spreadsheets, or a manufacturer/ICC listing.
- `"pending-BI-confirmation"` — researched, industry-typical, or interpreted from a verbal description. Plausible, not authoritative.
- `PanelStructuralStatus` deliberately carries **no `value` field**. Inventing a placeholder for straw-panel structural capacity has no reasonable industry analog to fall back on (unlike, say, a standard concrete or steel product), so it surfaces the gap honestly instead of filling it.

`toReviewLog()` in `packages/calc-engine/src/reviewLog.ts` filters for pending entries — that is what populates the "Items for Engineer/Contractor Review" list on every output. **An unflagged value never reaches the review log**, so marking a researched number `confirmed` silently drops it off the engineer's list. That is the failure mode this convention exists to prevent, and it is worse than an obvious bug because a plausible number doesn't look wrong.

Current state: 77 `pending-BI-confirmation` vs. 58 `confirmed` in `data.ts`. Flags also appear in `packages/panel-catalog/src/types.ts`, `packages/calc-engine/src/reviewLog.ts`, `apps/web/app/page.tsx`, and `apps/web/app/wallReviewNotes.ts`.

### Flags check — run before any change is called done
1. Does every real-world number in the diff carry a `status` and a `note`?
2. Is anything marked `confirmed` that is actually researched, industry-typical, or interpreted from a verbal description? Downgrade it.
3. Does the `note` trace to a real source — a spec quote, a named document, an Open Item — rather than just restating the number?
4. If the figure is structural (shear, load-bearing), does it use `PanelStructuralStatus` with no invented value?
5. Does the value surface in the review log where a human reviewer would expect to see it?
6. If the spec marks the underlying decision open/pending/unconfirmed, is the code treating it as provisional rather than settled?

### What is provisional right now, by area
- **Structural capacity** — every panel's `shearValue` / `loadBearingCapacity` across the roster, plus `shearLoadCapacity`. All carry `STRUCTURAL_PENDING_NOTE`; blocked on Building Integrity's own pre-engineering numbers (see "For Baleheads Only" above).
- **Seismic bracing** — `seismicBracedPanelSpacingFt`, `bracedWallLineSpacingFt`.
- **Fastener schedule** — `fastenerTableStatus` covers the whole spacing table.
- **Headers & openings** — `bigHeaderWidthInRange`, `bigHeaderHeightInRange`, the big-header defaults, `headerPreviewHeightIn`, `windowHeaderWidthInRange`.
- **Standard window sizes** — `standardWindowWidthsIn`, `standardWindowHeightsIn`, `standardWindowHeightDefaultIn`.
- **Panel thickness default** — `looseDensePackDefaultThicknessIn` (the 14/15.5/15.75 option set).
- **Wall assembly layers** — several entries in `wallAssemblyLayers`.
- **Densities & carbon** — `carbonFractionOfDryMass`, `timberHpDensityLbFt3`, `densePackCelluloseDensityLbFt3`, and the pending entry in `referenceDensities`.
- **Foundation** — `groundScrewProductsStatus` and several `foundationTypes` entries.
- **Floor framing** — `floorRimJoistDetail`, `floorLongSideBlockingNote`, and a pending `floorJoistTypes` entry.
- **Roof** — `trussPlateInsetDefaultIn`, `gableHeelHeightDefaultIn`.
- **Shipping** — `truckBedTypes` (trailer interior dimensions cross-referenced from industry equipment guides, not a manufacturer sheet), `shippingRatePerMileDefault` ($6/mile one-way), `headerSillDunnageGapIn`.
- **Plaster Master** — all of `plasterPriceDefaults` (sand $45/cu-yd, clay $19/bag, lime $10/bag, straw $1.25/cu-ft, labor $45/hr), `steelMeshPriceDefaults`, and one entry in `plasterMixPartsDefaults`. The source "Faster Plaster Calculator" spreadsheet contains **zero pricing data** — every dollar figure here is this app's own researched placeholder. The formulas themselves mirror the spreadsheet exactly and are confirmed.
- **BOM** — `bomWidthMismatchWarning`.

### Provisional beyond the flags
Things that are interpreted or unresolved but aren't a single flaggable number:

- **Braced Panel geometry** (`packages/panel-catalog/src/bracedPanelMembers.ts`) — Tommy called the first-draft 3D model "a good start" and explicitly flagged it for editing later. The diagonal brace's angle-cut ends are simplified to a straight tilted box (no real bevel/miter), and the girt-row rule (3 rows baseline, +1 per 36" bay overage) plus the middle-row pick for the brace's bottom end are interpretations of a verbal description, not read off a shop drawing. Expect changes; don't treat as locked.
- **Shipping packing model** — a deliberately simplified uniform-grid packer (every stack in a shipment shares one footprint sized to the widest panel), not a true bin-packing optimizer. The truck count and load order shown are illustrative, consistent with the app's reference-only posture. Not a real optimized load plan.
- **Interior clay-plaster Finish Coat recipe** — the Sand:Clay 3:1 ratio is this app's own adaptation, confirmed by Tommy as the default. The source spreadsheet only ever gave a Sand:Lime finish recipe.
- **Buck window** — flagged by Tommy as a window-opening approach to consider (a separate rough "buck" frame set into the opening). This is a bare flag with no spec behind it. Ask for the actual detail before building anything; don't infer it from the current window/header/sill decomposition.
- **SketchUp / Dynamic Component export** — blocked on Tommy's conversation with Cameron, who has an existing SketchUp DC library for these same building blocks. True `.skp` can't be written outside SketchUp, so the realistic path is a Ruby script run inside SketchUp that reads this app's JSON component schema and places instances of Cameron's DCs. That only works if the schema's member roles/ids/dimensions line up with how his DCs are parameterized. The plain OBJ exporter has no such dependency and is safe to extend.

---

## Open Items
- **Smearforn Stage 2's count preservation reaches only the paths that stage touched.** A hand-inserted panel survives a typed width edit (`retileWallAroundPins`' fallback) but NOT the click-through type cycle, a window/Big Header width edit, or a wall-length edit — each of those still re-tiles and can take the extra panel with it, silently, because the wall still sums. **The real fix is the plan's own "generalize `OpeningAnchor` to a slot anchor"**, which makes a pinned slot a budget reservation and fixes the count everywhere at once; the fallback is the smallest thing that made the stage usable before Monday. Tommy should know that after inserting a panel, cycling a panel's type on that same wall can cost him the insert.
- **Should the free run re-tile flat after a hand edit?** Stage 2 redistributes the unpinned run with `distributeEighths`, so every automatic panel lands within an eighth of every other. A tiler-laid wall instead has full-width panels plus one absorber next to the gap. Nothing leaves [24in, 48in] either way and the absorber's *position* rule is untouched, but the shape of a hand-edited wall now differs from a fresh one. **A question for Tommy's eye, not a defect.**
- **Corner and safety-gap are still not hand-placeable**, per the Stage 2 plan. The ADU annotates "SAFETY GAP" repeatedly, so this is the likeliest next ask; the mechanism would carry it, and what it needs is a decision about what happens when the gap-end rule and a hand-placed gap disagree.
- **Footer Privacy Policy and Legal Disclaimer links await Tommy's documents.** The Stage 3 footer shipped without them on purpose: those are real legal texts, not ours to draft, and a link to a placeholder page or `#` was ruled out. `AppFooter.tsx` has a commented slot at the right end of the strip. When the documents exist, add the links as a non-shrinking group there so the disclaimer text is still the only thing that truncates, and re-measure at 360px.
- **Confirm:** is "For Baleheads Only" Building Integrity's own engineering (possibly earlier company name)?
- Metal hanger model for the jack stud beam connection — needs sizing to actual load
- Fastener for attaching safety/gap panel's ½" plywood skin
- Floor-to-wall vapor continuity detail — still to be built
- Adhero Visto: permanent floor layer or construction-phase-only?
- "Typical architect angle" set for 3D renders
- **Numbered continuation sheets — decided, not built.** Tommy's call (2026-08-27): each continuation page is a real framed sheet with its own title block, numbered "Sheet 2 of 3". Rejected: unframed continuation pages, and auto-shrink-to-fit. Metadata already exists (`sheetNumber`/`sheetCount`); the pagination does not. Until it lands, over-length sheets fragment natively and redraw the frame — ugly but non-lossy. Measured cases that need it: a braced-chevron fabrication sheet once **one** plaster coat is selected (~28px over) or its instance list wraps to a second line, and the Shipping / Plaster Master / Project Summary pages, which run 1–2.5 pages over on any page size. **Verification status (Chromium, 2026-08-28):** the print *rules* are confirmed live — every `@media print` block was force-applied to a running DOM and computed styles read back, showing the sticky-note chrome hidden, the header label preserved, and the `overflow`/`max-width`/`position` resets all landing (including `.main` dropping from `position: fixed; top: 56px` to `static`). *Pagination* is still unconfirmed: page breaks, fragmentation, and the packet blank-page fix are only observable in a real print preview, and the height figures above remain analytic.
- **Print audit of the other sections' `styles.note` paragraphs** — the fabrication intro blurbs are being marked screen-only; the other ~70 uses in `page.tsx` haven't been reviewed. Some (e.g. the shop-drawing "Preview-only — illustrative default dimensions" caveat) probably *should* print. Fold in one related item while doing it: `StickyNote`'s `.label` is now the printed document's only title for the notes that render no `SheetTitleBlock` (Review Log, Project Totals, Assembly Performance), and it still carries `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` with no print reset — latent today (nothing is near truncating at full page width), but it is a silent-truncation container sitting on a title. Worth a pass later; not folded into the fabrication fix.
- **Visual confirmation of the floor skin and ring placement: DONE (2026-08-31).** Tommy on the live build: *"The wire mesh/clay bands look great"* and, after the ring placement landed, *"I looked at the live version just now and it looks much better."* That closes the eye-check the automated tests could not stand in for on the floor-band axis fix, the footprint-shaped skin, and ring placement. Still unconfirmed by eye: field framing on a notch (stage 3, in progress).
- **Visual confirmation of the floor band fix on a deep footprint** — the depth-axis branch has never been seen working on screen (it shipped broken). After the fix, Tommy should draw a rectangle deeper than it is wide, open 3D Framed view, and confirm all 3 bands sit flat on one plane. Automated tests can prove the coordinates; only Tommy's eye confirms the bands read the way he wanted. Same pass should check an octagon and an L-shape once the footprint-shaped skin lands.
- **Question for Tommy: which line does the bottom skin die at?** This pass takes his words literally — the mesh spans to the **exterior footprint line**, so it reads flush with the outside of the building. But the mesh is physically stapled to the underside of the lowest framing member, and that framing (Ring A) is inset by the wall thickness, so a footprint-sized mesh overhangs its own framing by that much on every side. Which is right depends on whether the mesh is meant to turn up and tie into the wall's air barrier or simply die at the rim — a real detail question, not a modeling preference. Not blocking; if the answer is "Ring A's outer face," it's a different inset in one place.
- **Degenerate rings when a footprint edge lies exactly on a band boundary.** `clipRingToHalfPlane` can return a non-simple ring that back-tracks over itself — the repo's own test case `"handles a band boundary running collinear with a footprint edge"` produces one. Area and triangulation stay correct, so the existing assertions pass, but `memberFaceIndices` emits one side quad per raw ring edge, so a doubled-back edge yields duplicate coincident faces — the same coplanar-coincident-face z-fighting the design rejected triangulation to avoid. A second, distinct symptom: when a notch floor sits exactly on a band boundary, both retained runs terminate on the clip line and the reconnection merges them into one member joined by a zero-width corridor, which is the plain-Sutherland–Hodgman artifact the chain machinery exists to prevent. At 1/8in tall the practical impact is a hairline, not a stripe, which is why it was logged rather than blocking the merge. Two separate causes: the first is a "spike" vertex (neighbours collinear *and* on the same side, `cross ≈ 0 && dot > 0`) that `dropRepeatedPoints` misses because the points are not repeated; the second needs the reconnection step to notice the joining run coincides with a retained boundary. Fix: tighten the two existing tests to assert ring **simplicity**, not only area — they already build the right shapes. Needs an exact coincidence (a footprint edge at exactly 1/3 or 2/3 of the bounding-box extent), so it is occasional rather than routine.
- **`editWallLength` has no validity guard, and can invert a footprint's winding.** `dragWallBounded` refuses any offset that self-intersects; `editWallLength` enforces only `MIN_WALL_LENGTH_FT` on the edited wall. Shortening a bumped-out shape enough reverses the signed area, from a value typed straight into the wall-length field — e.g. a 40x30 rectangle, a notch via `insertBumpOut("AB", 5, 35, -12)`, then `editWallLength(fp, "67", 3)` yields a non-self-intersecting polygon with signed area -540. Every function relying on the winding invariant is then wrong together: `perimeterRing.ts`'s inward normal, `bumpOut.ts`'s `outwardNormal`, and `dragWall.ts`'s drag axis. Deliberately NOT patched inside `perimeterRing.ts` (2026-08-31) — normalizing one consumer would trade a coherently-broken app for an incoherent one and hide the real defect. Fix is the missing guard on `editWallLength`, matching `dragWallBounded`. Pre-existing; surfaced by the Stage 1 ring-direction work, not caused by it. Related sixth path: `parseProjectFile` casts a loaded footprint without deep validation, so a hand-edited project file could carry any winding.
- ~~**`wallBoxes3D` picked its inward side from a vertex-averaged centroid**~~ — **FIXED 2026-08-31.** Same three-line deletion as Stage 1, with a regression test asserting every wall box on a notched footprint sits inward, plus the positive-depth twin so nobody tries to reproduce the notch bug with a bump-out and reverts the fix. Original report follows. Found 2026-08-31 while building the ring-placement test, which originally read each wall's exterior face off the wall box. **It reproduces on a NOTCH, not a bump-out** — `insertBumpOut(rect, "AB", 5, 20, -6)`, negative depth, corners landing *inside* the rectangle. The two 6ft return walls (`12` and `34`) come back offset **outward**, on the wrong side of their own wall line — projection of the box centre onto the winding perpendicular is `-0.6458ft` where every other wall is `+0.6458ft`. A true outward bump-out (`+6`) is **correct on all eight walls**; anyone who tries the positive case will fail to reproduce and wrongly conclude the report was bogus. **Visible impact today is zero:** `wallBoxes3D` has no production consumer — the 3D preview draws walls from `panelSlotBoxes3D`, which applies depth in local member space and has no side test at all. Its only importers are `packages/geometry/src/index.ts`, its own test, and the ring-placement test. So this is latent, not live, and it does **not** justify jumping ahead of stage 3, which fixes something Tommy has actually reported seeing. It is still a genuine landmine — the ring-placement test very nearly adopted the broken value as ground truth, which is exactly how a latent bug becomes a live one. The fix is the same deletion Stage 1 made (`inward` is unconditionally `{ x: -dir.y, y: dir.x }`); worth its own small commit whenever convenient. Deliberately **not** fixed in stage 2 (out of scope); the ring test measures faces off the footprint's own corner line instead, and says so.
- **Bounding-box overhang: `computeJoistLayout` is the last one left.** `computeFieldFramingLayout` was fixed 2026-08-31 (stage 3 above). `computeJoistLayout` (`joistLayout.ts`) still lays its joists across the footprint's inset **bounding box**, so on an L, a U or an octagon they run through open air. Still deferred — a different floor type (suspended joists), never reported by Tommy — but the fix is now nearly free: `clipSegmentToPolygon` + `computeInsetFootprintPolygon` drop straight in, and the only real work is that `JoistLayout`'s ids would need the same span index for the same silent-collision reason.
- **Is there a shortest field-framing stack worth building?** **Frequency measured 2026-08-31:** sweeping a side notch across a 30x20 at the defaults, ~10% of notch positions leave a stack under 6in, ~5% under 3in, ~1.6% under 1in; shortest seen 0.2in. The driver: a notch leaving a remainder just above 2 x inset (2.58ft) yields `remainder - 2.58` of span, and the UI's own 2ft margin snapping parks users at the bottom of that band — so Tommy will hit one soon rather than eventually. Impact is cosmetic plus BOM noise (each sliver adds 2 to the displayed board count), not cost. The polygon clip (stage 3) can leave a bay as a short sliver where it just catches the inside of a notch corner, and it emits that as a real framing stack — no minimum practical length is assumed, because picking one would be inventing a shop threshold. Zero-length spans are dropped (a numerical tolerance, not a building value); anything above that is built. If Tommy has a real minimum (a stack under, say, some length is not worth setting), it is a one-line filter in `computeFieldFramingLayout`.
- **Does the Bale Foundation get an LVL (or other material) option on its rings?** Tommy said *"these two large pieces (or LVL's if thats selected)"*, but no such selector exists — `buildFramingStackMembers` hardcodes `PLATE_2X4_THICKNESS_IN`. The catalog has LVL in two unrelated systems — `floorJoistTypes[].joistWidthIn` = 1.75in (suspended floor joists) and `boxBeamMembers.ts`'s `BOX_BEAM_LVL_THICKNESS_IN` = 2in with a selectable depth set (box beams). The box-beam one is the closer precedent to copy the *shape* of; neither is a licence to pick a ring dimension without Tommy. The ring fix writes its inset arithmetic in terms of `ringWidthIn` so the option is cheap to add later, but the option itself needs Tommy's spec: which materials, what actual dimensions, and whether it changes the top/bottom board depths too.
- ~~**Bale Foundation 2D/3D ring representation mismatch — verify, don't assume.**~~ **RESOLVED 2026-08-31: no offset.** Both views place the sub-lines at the stacks' outboard faces; see the stage-2 note above. Original text kept for the record: The 3D pair spans `[insetIn, insetIn + 3in]` (two 1.5in stacks at `yIn` 0 and 1.5), while `page.tsx:1658-1671` draws the 2D "inner" sub-line at `insetIn + PLATE_2X4_THICKNESS_IN` — i.e. 2D appears to draw board *faces* where 3D places board *origins*, a possible 0.75in offset between the two views. Noticed while spec'ing the ring placement, not confirmed on screen, and deliberately not folded into the fix. Worth a look while the coder is already in both files.
- **Visual confirmation of the ring fix on a bump-out.** Same reason as the floor-band item below: the direction heuristic shipped broken, so the corrected inward direction has never been seen on a bump-out footprint. After stage 1, Tommy should add a deep notch and confirm no ring segment spawns outside the perimeter; after stage 2, confirm in 3D Framed view that one ring sits under each wythe with a clear gap between them.
- **Equal-area opacity bands** — rejected for now in favour of equal width along the split axis (see the floor-skin section). Worth revisiting only if a lopsided L makes one band read as nearly empty on screen.
- ~~**Band numbering**~~ — **DECIDED and BUILT (2026-08-30, `4203eb6`).** Tommy's call: band 1 is always the fully-opaque band nearest the least-accessible-corner marker, and the id index and the "band N of 3" prose follow it. Before this the id counted from the axis min, so under `nearIsMax` `band_0` was the band *farthest* from the marker at 50% opacity while its own note claimed it radiated from the marker — the code contradicted itself. Verified at both axis extremes. Two notes for anyone reading the old wording: the id format is now `floor_bottom_skin_band_N_P` (band index, then piece index, since a notch can split one band into several members), and "nothing depends on it" is now true only of the id *string* (OBJ group names and React keys) — the band index itself drives the opacity lookup and the prose.
- **Guard against member-space / view-space mix-ups generally** — worth doing later, deliberately *not* folded into the floor band fix: a shared test helper that asserts a member set's view-space bounding box (e.g. "every member in this group shares one height extent"), so an axis swap fails as a readable assertion instead of as a passing test that encodes the bug. The floor band bug survived ~900 tests precisely because the test asserted the raw field the builder wrote.
- ~~Does typed numeric entry get snapped to 1/8in too?~~ **Answered by Tommy 2026-08-30: yes, on commit.** *"Unless the user enters it themselves"* is about display honesty, not a grid exemption — the field redisplays the snapped value, and the formatter stops rounding silently so an off-grid value shows as a visibly long fraction. The sum invariant therefore holds unconditionally. Folded into the 1/8in grid section; no longer open.
- ~~Long lengths: feet-inches or decimal feet?~~ **Answered by Tommy 2026-08-30: feet-inches-eighths (`24'-3⅝"`)**, everywhere, including reconciling `formatTrailerLengthIn`'s decimal-feet outlier. Folded in; no longer open.
- ~~Fraction input's bare-number domain ambiguity.~~ **Answered by Tommy 2026-08-30: the fraction is always a fraction of an inch**, never of the field's own unit. Whole number keeps the field's unit; fraction is always inches. Folded into the parser grammar.
- **⚠ Confirm on screen: `47 5/8` in the *wall-length* field.** Under the rule above it parses as 47ft + ⅝in. The competing reading (a fraction switches the whole field to inches) gives 47.625in — **a factor-of-twelve difference**, 47'-0⅝" vs 3'-11⅝", and silent if wrong. The live resolved hint spec'd alongside the parser is the mitigation, but Tommy should type exactly that string into that field once and confirm the hint reads what he expects. Narrow, but the only place in the 1/8in pass where a wrong guess produces a plausible-looking wrong building.
- **Settled 2026-09-06 — a trailing inch mark is decoration.** Asked directly whether `47 5/8"` in the wall-length field means 3ft 11⅝in or 47ft 0⅝in, Tommy answered *"it should always read as 47' and 5/8""*. So: **the whole number always takes the field's own unit, the fraction is always inches, and a trailing quote changes nothing.** A FOOT mark still names both units outright (`24'-3 5/8"` is unambiguous in either field) — that half was always settled. Consequence accepted: `3"` in a feet field is 3 FEET; write `0'-3"` or use an inch field to mean three inches. That is the price of one rule instead of two, and it removes what would have been a second factor-of-twelve reading sitting one character away from the first.
- **Which panel absorbs the extra eighth on an uneven split.** `distributeEighths` gives it to the lowest-index part; `buildPlainMiddle` then places the pair in its existing order, so the wider one currently ends up first in the array. Deterministic and documented, but arbitrary. If Tommy would rather the wider panel always sit nearest the gap panel (or always farthest from it), it's a one-line reorder at the call site.
- **Octagon miters can't sit on the 1/8in grid.** A 45° wall between two grid corners has an irrational length, so its fabrication length is rounded (≤1/16in residual per diagonal wall, absorbed at the corner joint — the safety/gap panel's own stated purpose). Rejected: distorting the octagon to force grid-exact diagonals, and exempting mitered shapes from the invariant. Revisit only if a fabricator reports the miter joints reading short.
- **Should fabrication sheets be imperial-only?** The 1/8in grid is exact in imperial and provably cannot sum exactly in metric at nearest-mm. Current plan is a note on metric fabrication output saying the imperial value is authoritative. Blocking the metric toggle on fabrication sheets outright would be cleaner but is a bigger UX call than Tommy asked for.
- **The 1/8in grid stops at wall panelization this pass — deliberately.** The same even-split defect exists in `computeJoistLayout`, `computeFieldFramingLayout` (`perimeterRing.ts`), `floorPanelGrid.ts`, and `trussLayout.ts`, which all divide a span into equal pieces. Not folded in: Tommy asked about drawing tools, bump-out, panel movers, and the panelizer. `distributeEighths` is directly reusable when it's wanted.
- **The vertical invariant is the same problem, not yet spec'd.** `computeWallVerticalBandsForSlot` splits a wall's height into bands around mid-wall beams; "the bands sum to the wall height" is the same guarantee as "the panels sum to the wall length," and beam height/top drags are in the Stage 2 snap list, but the band arithmetic itself hasn't been audited for the same halving defect. Worth doing right after Stage 1.
- **⚠ Does the Imperial/Metric switch really go inside the ⚙ menu?** The top-bar reorg puts it there on the principle that the unit toggle is display-only. But it is a deliberate piece of delight — a physical-looking switch with a synthesized click (`UnitSystemSwitch.tsx`, `useSwitchSound.ts`) built because Tommy asked for it to "look like an actual switch" — and burying it may simply annoy him. It costs roughly 150px on the bar surface, and it is the one item that goes back first if he wants it. The component itself is unchanged either way. **Tommy's call; default is "inside ⚙" until he says otherwise.**
- **What does the ⚙ / ? pair actually look like, and does the help icon have anything to show?** Stitch specifies a settings icon and a help icon. Settings has real contents. **Help has none — the app has no help content today.** Candidates if Tommy wants one: the reference-only posture, the Detail Guide index, a "what do these roles mean" note. **Do not ship an icon that opens nothing**; omit it until there is content. Also his call whether to accept the Material Symbols look (a Google webfont) rather than the inline SVG the spec defaults to.
- **Does `EditorTabDial` survive at desktop width, or is the header nav the only tab control?** Built as: nav at 1200px and up, dial below 1200px (moved from `md` by Tommy's 2026-09-13 decision, because the nav did not fit at `md`), same state, never both. The alternative readings are "dial always, nav never" (keeps a control Tommy specifically designed — *"a scroll menu that rolls up or down"*) and "nav always, dial deleted" (matches Stitch exactly, leaves nothing below `md`). Both are one call site. **Worth Tommy looking at the live Stage 2 build before anyone deletes the dial.**
- **The footer legal bar — three questions before it can be built** (see the Top Bar section): there are no Privacy Policy or Legal Disclaimer documents to link to; a fixed footer needs a `--footer-height` consumed by `.main`, `SectionCarousel` and `StickyNote`'s spawn *and* fullscreen states or it overlaps them; and `roleDisclaimers.engineer.text` is ~200 characters against a 24px, 11px-minimum strip. **Whichever way it goes, the disclaimer strings are relocated verbatim, never reworded.**
- **Breakpoint reconciliation.** The app carries 1200px and `md` = 768px (top bar) alongside 600px (`page.module.css`, `EditorTabDial`); the 900px rule died with the row it modified. Three numbers is tolerable and picking one app-wide is a bigger UX call than the overflow fix. Worth doing in a later sweep, not folded in.
- **Visual confirmation of the top-bar fix at Tommy's own viewport.** The bug was found by him failing to find the sign-in control at 710px. Automated width assertions can prove zero overflow; only Tommy confirms the bar reads as one thing rather than three zones of unrelated buttons. Same pass should check the longest acting-as label and the 360px floor on an actual phone.
- **The acting-as suffix — "(platform admin)" / "(consortium)" — was cut off at every width, 1920 included; now only below 1200px.** `.actingAsSelect`'s `max-width: 220px` predates the top-bar work, and it truncates "The Seed Collaborative (platform admin)" to "The Seed Collaborative (p…" even on a wide screen. The suffix is exactly the part that tells *acting as* Seed apart from *belonging to* Seed, and not realising you are browsing as the consortium is a failure this spec names in the backend section's acting-as switcher. Options raised in review: a wider cap on wide viewports, or putting the suffix before the name so it is the part that survives truncation. **Resolved on wide screens, 2026-09-13 (Tommy):** at 1200px and up the cap rises to 280px and the full label is readable. **Still truncated below 1200px, unchanged** — which includes Tommy's everyday 710px window. Suffix-first ordering remains the untried option if that bites.
- **⚠ On a touch screen a truncated company name cannot be expanded.** The top bar's truncation fallback is an ellipsis plus a `title`, and a phone has no hover, so the `title` does nothing. With one entitlement the select is `disabled`, so a name cut to "Buildi…" can never be read in full on a phone. With several, the native picker does show the full names. The top-bar requirement ("legible by name … truncated with an ellipsis and a `title` if necessary") is met as written, but only thinly on a phone. **Tommy's call.**
- Single nearest fabricator vs. broadcast to a few for handoff — **partially answerable now:** the backend's collaboration grants (decisions 24-26) are the mechanism either answer would use. The routing policy question is still Tommy's.
- Detail page numbering scheme

### Platform admins — four, across three founding companies (2026-09-07, revised 2026-09-13)

Tommy: *"i want to have 3 platform admins that can reach all companies - me from building integrity, ace from new frameworks, and greg from rare forms."* Revised the same week to add Virgil, also at Building Integrity, asked directly and confirmed as a **fourth platform admin** rather than a company admin.

**The four**, with the real addresses: `tommy@buildinteg.com` and `virgil@buildinteg.com` (Building Integrity), Ace (New Frameworks), Greg (Rare Forms). Building Integrity holds two; that is deliberate. Note Tommy's app address is `tommy@buildinteg.com`, not the `tommy.fieser@gmail.com` an earlier draft of the bootstrap used.

**No schema or code change.** `user_profiles.is_platform_admin` already carries this; four platform admins is four rows set the same way the README bootstraps the first. Each also holds an ordinary membership at their own company, so each has two entitlements: their company by membership, and everything by platform admin.

**The consequence to state plainly, because it is a real change and not a side effect.** Decision: consortium browsing is *design yes, money no* — another company sees your panels and drawings but not your price modifier or margin. **Platform admin bypasses that.** So Ace sees Building Integrity's and Rare Forms' margins, Greg sees Building Integrity's and New Frameworks', and Tommy and Virgil see all three. That is defensible for co-owners of a co-operative, and it is what Tommy asked for — but Ace and Greg agreed to a set of three and it is now four, which is worth telling them rather than letting them find out — but it means the money boundary now holds between *companies* and not between *these three people*. Anyone reading "your margin stays yours" should understand it as "yours and the three platform admins'".

**It also quadruples the 2FA exposure.** Two-factor is optional by Tommy's twice-confirmed decision, and the accepted risk recorded there was one password standing in front of every company's data. It is now four, held by four people. Worth noting the set has grown once already, quietly, which is the pattern that makes an optional-2FA decision worth revisiting rather than the number itself. The decision stands; the risk statement needs the corrected number, and this is the change that most argues for revisiting it.

**Open — what "certain toggles" means.** Tommy: *"we three with that platform admin tag should be able to have access to everything with certain toggles."* A platform admin can already act as any company through the existing switcher. Whether he wants anything beyond that — a way to *drop* platform privilege and browse as an ordinary member to see what others see, an audit trail of platform-admin access, or a per-area toggle — is not specified and nothing was built for it. Ask before building.

### Open Items — Backend, Accounts & Project Sharing

- **FLAGGED FOR LATER (Tommy, 2026-09-14) — promote a member to company admin, and a people/activity page. Not specced; do not build until Tommy picks it up.** Found in the 2D review: the database already allows promotion (`memberships_update`, and 0001's `guard_membership_self_update` lets a company admin change a level) but the app has no control for it, so README Stage 1 step 7 ("promote them") cannot be done from the UI. Tommy's direction, recorded verbatim so it is not re-derived: *"any admin of a company or the platform admins can upgrade a member to admin. perhaps admins of companies have a section under the accounts that shows them latest actions each member of their company has taken, their email, how many edits theyve made total, and how long theyve been a member for. each account also can see these stats on their account page, but the admin has a drop down menu with everyone of their companies (if company admin) or an entire list of everyone if viewing as the seed collaborative (or platform admin)."*
  - **Things a spec pass must settle before any code:** "latest actions" needs a definition — Stage 2 records saves and renames (`project_versions`, with author and time) but there is no general activity log, so anything beyond saves/renames is new schema. "Edits" presumably means versions authored. "How long a member" needs `memberships.created_at` (check it exists). **Acting as the Seed Collaborative showing "everyone" is a cross-company people view**, which touches the consortium read layer (Stage 4) and the `user_profiles_select` rule that only shows profiles to people who share a company — that is a real permission decision, not a UI detail. **Caution already on record:** a platform admin can change levels only where the guard allows; re-check 0001 before promising platform-admin promotion everywhere.
  - **Placed by Tommy 2026-09-14 (Stage 3 answer 15): a short follow-up directly after Stage 3**, not part of it. ~~It still needs its own spec pass.~~ **SPEC'D 2026-09-20 — see "People & activity page (2026-09-20) — PLANNED, NOT BUILT", after the Stage 4 plan.** The questions listed above are answered there: the page needs **no migration and no new route** (`memberships.created_at` exists, `PATCH /api/memberships/[id]` already takes `{ level }`, and saves/renames are already recorded on `project_versions`), "edits" is scoped per company because RLS scopes it, and **the cross-company "everyone" list is recommended OUT of this pass** — it needs a definer function to carry another company's people and emails across a company line, which is a consortium-read decision belonging with Stage 4. Tommy decides its five Open Items before any code.

- **⚠ How long is an invite good for? Picked, not decided — needs Tommy.** Decision 3 makes the app invite-only and the build talks throughout about a "valid, unexpired invite token", but no window is named anywhere in this log. Stage 1 shipped with `INVITE_EXPIRY_DAYS = 14` in `apps/web/app/auth/inviteToken.ts` — long enough that someone gets round to it, short enough that a forwarded email is not still live a year later. **That is a guess wearing a constant's clothes**, and it is recorded here because a code comment is not where this project keeps unresolved decisions. Changing it is one edit; the invites already in flight keep the expiry they were minted with.
  - **Deliberately NOT wrapped in a `CatalogValue`.** The `status` / review-log convention exists for real-world building numbers, and it works because the Items for Engineer/Contractor Review list is short and every line on it is something a human reviewer needs to check. An administrative timeout on that list would dilute exactly the thing the convention protects. Flagged here instead — same honesty, right audience.
  - **There is no CEILING on an invite's expiry, only a floor.** `INVITE_EXPIRY_DAYS` is what the app's own routes ask for, but the database accepts any future date: `invites_insert` lets a company admin write one directly, and `create_company_with_first_admin` rejects only an already-past value. So a caller going around the routes — a company admin with the publishable key, which ships in the browser — can mint an invite good for a decade. **Recorded rather than clamped, deliberately:** the latitude is uniform across every invite path rather than a hole in one of them, and picking a maximum would mean inventing a second number beside one already flagged as guessed. If Tommy wants a ceiling, it is one condition in two places and it should be decided at the same time as the window above.

- ~~**How does the creator of a company invite its first admin, given they get no access to it?**~~ **Answered by Tommy 2026-09-07: with a definer function. Decision 27 stands exactly as written.** The problem is real — the first invite to a company has to be written at a moment when nobody administers it, so no policy phrased as "an admin of this company" can authorize it — but it does **not** force a reinterpretation of 27, and an earlier draft of this Open Item claimed the two halves of 27 "cannot both hold". **That was wrong and is corrected here rather than quietly edited.**
  - **Built:** `public.create_company_with_first_admin(name, email, token_hash, expires_at)` creates the company and mints the first-admin invite in one call, checking 27's own condition (`is_company_admin_anywhere() or is_platform_admin()`) itself. Same shape as `redeem_invite()`, which solves the other side of the same problem — an operation whose authorization cannot be expressed as a rule about a row that already exists.
  - **The creator gets no standing access at any point.** Not a membership, not a window, not a way to read the company back. Asserted in `supabase/tests/stage1_rls.test.sql`: after creating, they cannot see the company, cannot see the invite, and cannot mint a second one.
  - **Rejected: a temporary founding window** (the creator may see and invite to their new company until its first admin accepts). It worked, and it was the option this spec previously recorded as necessary. It has three things to be careful about that the definer function cannot get wrong: a first invite issued at `level = 'member'` holds the window open forever; invites minted inside a window outlive it; and nothing stops a founder addressing the first-admin invite to themselves.
  - **The cost, accepted: a mistyped first-admin address cannot be fixed by the founder.** They cannot withdraw or reissue that invite, because they do not administer that company. A platform admin does it. This is what "no standing access" actually costs, and the UI says so before the form is submitted rather than after.

### Per-company colour schemes — possible, not yet affordable

Tommy (2026-09-06): each company should be able to carry its own colour scheme, the Seed Collaborative's being a light green palette. **Not built, and deliberately not built in Stage 1** — but Stage 1 must not preclude it.

**The real palette exists.** `SeedCollabColors.pdf` at the repo root is a full brand guide (Seed Collaborative, Brand Guidelines V2.0), currently untracked. Source colours: **Lime `#B7D732`, Sky `#7ADBF5`, Amber `#FBB03B`, Ink `#000000`**, with limestone neutrals (`#FCFBFA` paper, `#F9F8F6` card, `#F4F2EE` band, `#F0EDE8`, `#E6E2DC`) and lime/sky tints (`#EFF4D9`, `#E9F0CA`, `#E7F4F5`, `#DBF0F4`). It carries a hard rule worth honouring: **the 5% rule** — brights appear only as the smallest spot accents (a dot, a bullet, a marker), never as washes or backgrounds; larger surfaces use the ink-blended tints, and ink alone carries text, rules and shading. A naive "make it green" theming pass would violate the very brand guide it is trying to implement.

**Why it is not affordable yet.** The app has **2** colour custom properties in total (`--background`, `--foreground`) against roughly **188 hardcoded hex values across 21 CSS files** and **462 more in TSX**. There is no token layer to theme.

**The distinction that makes this tractable** — and the reason a blanket find-and-replace would be wrong. Two kinds of colour are mixed together in that count:

- **Chrome** — top bar, sticky notes, panels, buttons, the title block. This is company identity and *should* re-skin.
- **Drawing semantics** — member colours by role, material colours, the opacity bands, the review-log red. These encode meaning. A stud must not change colour because a Seed Collaborative member is viewing, and a fabrication sheet must read identically to whoever opens it. These must **never** be themed.

Only chrome gets tokens, so the count that matters is far smaller than 650.

**What Stage 1 must do, and no more:** add a nullable `theme` JSON column to `companies` so the data model carries it, and define the chrome token layer in `globals.css` with today's Building Integrity values as the defaults — so nothing changes visually and new code has tokens to reach for. Migrating existing chrome colours onto tokens is opportunistic afterwards, never a Stage 1 task.

**First consumer, 2026-09-13:** the top-bar reorganisation's Stage 2 migrates `TopBar.module.css`'s hardcoded hex onto `--bi-*`. One caution surfaced there and it belongs here too: **Stitch paints its wordmark `header-gold` (`#c9a63f`), which is a panel semantic in its own palette** — chrome borrowing a drawing-semantic colour couples the brand to the header-panel colour, so re-theming one would move the other. The rule runs both directions.

**Decided (2026-09-06): the theme follows the company you are ACTING AS**, not the owning company of the project on screen. Browsing New Frameworks' tree while acting as Building Integrity shows Building Integrity's colours throughout.

**Useful consequence, and a reason to prefer this reading beyond Tommy having chosen it:** the theme becomes a second, ambient indicator of which company you are acting as. The spec already requires the switcher to be always visible because the failure it prevents is saving into the wrong company's folder; a whole-interface colour shift reinforces that far more strongly than a label does. Under the alternative reading the colours would change as you browsed between companies, which would have made them noise rather than signal — actively working against the switcher.

It also means the colour never encodes *whose work you are looking at*, so nothing about theming can be mistaken for a permission or ownership cue. Ownership is shown, not coloured.

**One narrow exception to settle before theming ships: the title block.** A printed sheet is a document about who produced it, not about who pressed print. If chrome tokens are applied blindly, the same fabrication sheet would carry different branding depending on which company the person printing it happened to be acting as — and the block already renders a fixed "Building Integrity" wordmark today. The likely answer is that the title block follows the project's **owning** company (or stays fixed) while every other surface follows acting-as, but it needs deciding rather than inheriting. Not a Stage 1 concern; a Stage 2 one, when projects have owners.

**The genuinely open question is one: the backup file format.** Everything else below is either answered, a recorded rejection, or a known implementation caveat that does not need a decision before a coder starts.

- **⚠ Backup format and manifest — the one open decision.** Decision 29 says "a complete backup for a USB stick" and nothing about shape. A zip of one JSON per version plus a manifest is the obvious answer and needs about ten seconds of Tommy's confirmation, mostly so the manifest carries what he would actually want to find on that stick a year later (company, project, folder, version, author, date). Blocks nothing until Stage 2. **2026-09-13: the Stage 2 plan proposes a concrete default** (a zip built in the browser, one untouched `ProjectFile` per version, and a `manifest.json` with those fields plus schema version, parent version and a checksum). See "Stage 2 plan — Company backup" and its Open Item 4. It still needs Tommy's yes before this item closes.

**Needs Tommy's yes, but is an inference rather than a question he was asked.**
- ~~**⚠ Does the creator of a Seed-tree project keep access to it?**~~ **Answered by Tommy 2026-09-14: yes** (Stage 3 plan, answer 1). Original text kept for the record: "Create freely, but editing an existing Seed project needs an invitation" taken literally means you lose your own work the moment you save it. **The coherent reading — creating in another company's tree grants the creator a standing collaborator grant on that project — is written into the spec above and flagged there as an inference.** Confirm before Stage 3/4; the alternative reading is not plausible but should be ruled out by him rather than by us.

**Answered by Tommy 2026-09-06 — folded in, kept for the record.**
- ~~**Does consortium browsing include the Proposals folder?**~~ **Answered twice, and the second answer reversed the first.** Initially: Proposals private to the owning company. **Final: no privacy — *"lets keep proposals simple then, no permission boundary."*** All three folders are browsable and `projects.folder` is purely organisational. **The exposure this accepts is recorded on decision 12** — a live bid and who it is for is visible to every member company — and he was shown that consequence and chose simplicity. Recorded as a deliberate rejection, not an oversight.
- ~~**What happens to version history when a project crosses the Proposals line?**~~ **Moot — deleted with the reversal above.** It existed only because folder privacy did.
- ~~**Can one person be a member of two companies?**~~ **Answered: yes, with an always-visible acting-as switcher** — which then turned out to be the same control as the Seed toggle. See "The company switcher."
- ~~**Should platform admin be the one account where 2FA is mandatory?**~~ **Answered: no.** Asked directly with the "one password away from everything" reasoning put to him. **Considered and twice-confirmed, not an oversight.** Accepted-risk note kept on decision 7 so it is revisitable at twenty companies rather than four.
- ~~**`parent_version_id` and the divergence warning.**~~ **Answered: yes, build it.** Records what each save was based on and tells you when the head moved; does not block, lock, or merge. Spec'ing pass's proposal, explicitly approved by him.
- ~~**Title-block date.**~~ **Answered: printed sheets show the save date.** Promoted from a ride-along offer to a decision, with a resolution table (cloud version → `project_versions.created_at`; local file → `ProjectFile.savedAt`, finally read; never saved → today). **Now Stage 0 in the build order, since the local-file half needs no backend and fixes the defect for every user the app has today.**
- ~~**Sign-in inside a cross-origin iframe.**~~ **Moot, and this retired the largest technical risk in the plan.** Tommy uses the Vercel URL directly; the embed was tried and dropped because the editor wants the full viewport. **There is no iframe, so there is no cross-origin sign-in problem and no Stage 0 spike.** Recorded on "Starting position" so a future embed brings the question back with it rather than surprising someone.
- ~~**Does `companies.is_seed_member` have a job?**~~ **Answered on the third assessment: yes, at last.** Rejected twice as always-true; under the merged switcher model it defines the consortium membership set, which decides whose trees appear when acting as Seed and who gets the toggle at all. **The false branch is now defined and symmetric** — a non-member company neither sees nor is seen. See the data model note.

**Known caveats — no decision needed, but a coder must not rediscover them the hard way.**
- **The seven Plaster Master / shipping price fields don't round-trip — pre-existing bug with a backend consequence.** `shippingRatePerMile` and the six `plaster*`/`steelMesh*` price fields (`page.tsx:539, 562-567`) are `useState` only and absent from `ProjectState`, so editing them and saving silently loses the edit. Worth fixing on its own merits. **The backend consequence: the moment they enter `ProjectState` they become cost-redaction targets** — which is exactly why the redactor is spec'd to be tested against `ProjectState`'s key list rather than a hand-written field list.
- **View-only export blocking is friction, not a guarantee — the finding is settled, only the wording is open.** Written into decision 23 with a suggested honest sentence. Tommy should approve the words a joining company actually sees before they appear anywhere, because overstating it once is the kind of promise a company joins on.
- **Signing in must not discard unsaved guest work.** Decision 5 keeps guests download-only, and the natural flow is "design something, then sign in to save it." A sign-in that navigates or remounts the editor loses the design. Cheaper to get right in Stage 1 than to retrofit.
- **Still pending from Tommy:** structural elements pre-engineering guide, panel parameters, and Base Set drawings (unless "For Baleheads Only" turns out to cover this)
- **Code-level provisional values** — tracked separately as `pending-BI-confirmation` flags in the catalog rather than as bullets here; see "Provisional Values" above for the full list and the flags check.
