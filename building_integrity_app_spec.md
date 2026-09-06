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

## Dimensional Precision — the 1/8in grid (2026-08-30) — decided, not built

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

Per wall: round each slot width to eighths independently, then distribute the residual `wallFabricationLengthIn − Σ(rounded)` one eighth at a time, **round-robin over the standard/braced slots only**, widest first, ties by lowest index. Fixed-width slots (safety-gap, corner, openings) are left at their own rounding — they are already eighth-exact in every file the app has ever written. Footprint corners are snapped by the same `quantizeFootprint` the geometry ops use. Bound on movement: each slot shifts by its own rounding (≤1/16in) plus at most `⌈|residual| / k⌉` eighths. Silent, no Review Log entry — this is a precision convention, not a building value, and nothing provisional changes.

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
  - **⚠ Inference, flagged as such and needing Tommy's yes: the creator of a Seed-tree project must keep access to it.** Taken literally, "create freely" plus "editing an existing Seed project needs an invitation" means you lose your own work the instant you save it, which cannot be what he means. **The coherent reading: creating a project in another company's tree grants the creator a standing collaborator grant on that project.** Ownership still lands with the Seed Collaborative (`projects.company_id`), so it is Seed's project in Seed's tree — the creator simply holds a grant on it, using machinery that already exists for 24-26. Confirm before building; do not silently pick the other reading.
- **The switcher is visible at all times, not buried in a menu.** The failure mode it exists to prevent is saving a project into the wrong company's folder tree, which is silent, plausible, and only noticed later by someone else. It belongs in the top bar next to the sign-in state, showing the acting-as company by name at all times — not only while being changed. **This matters more now than it did as a plain switcher**, because the control also changes whether you are looking at one company or at all of them.
- **What "acting as" governs:** which company a **new project is created under** (the one that actually loses work if it is wrong); which **folder tree** is shown; whether the **shared read layer** is visible at all; which company's **admin powers** apply, if you are an admin of one company and a plain member of another; which company a **backup** covers (29).
- **Saving into an existing project is still governed by that project's own ownership and grants, not by the switcher.** If you hold access to a project, you can save to it; flipping the switcher does not revoke access to a project you already hold, and does not grant access to one you do not.

**Correction to this spec's own earlier wording, made explicit rather than quietly edited.** The first draft said *"if an implementation ever needs to consult the switcher to answer 'may this person do X,' that is the bug."* **That is now false** — under this model the acting-as company genuinely does determine whether the shared read layer is visible. The rule it is replaced by:

> **The switcher selects among entitlements you already hold; it never creates one.** A person with no path to the Seed Collaborative has no toggle to flip and cannot reach the browse set by any client-side means. **The server verifies the acting-as company against the user's own memberships and entitlements on every request** and re-derives permissions from the verified `(user, acting-as company)` pair. A client-supplied "I am acting as X" is an input to be checked, never a fact to be trusted.

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
- **`siteLabel` is derived at render** from `zipCode`: `documentSiteLabel = zipCode.trim() ? \`Zip ${zipCode.trim()}\` : "Site not set"` (`page.tsx:5468`).
- **`date` is `new Date()` at render time** (`page.tsx:5469`) — **always today, never the save date.** `ProjectFile.savedAt` exists but is never read back into the UI.

Decisions:

- **Name: `projects.name` is authoritative for the folder tree; the document is authoritative for the printed sheet.** The row is set from the document's `projectName` on first save and updated on every subsequent save. Renaming in the tree writes back into the *next* version's document rather than mutating past versions. When an old version's document and the row disagree, that is correct and not a bug: **the tree shows what the project is called now, a printed sheet shows what it was called when that version was saved.** Rows are mutable; versions are not.
- **Site: stays in the document only.** No `site` column. `zipCode` is a design input (it drives seismic zone and shipping distance), not filing-cabinet metadata, and duplicating it onto the row creates a second source of truth for something that already has one.
- **Date: a printed sheet shows the date the design was saved, not the date it was printed. Decided by Tommy 2026-09-06 — this is now a decision, no longer a flagged defect.**
  - **The bug it fixes:** `documentDate` is `new Date()` at render (`page.tsx:5469`), so **every printed sheet claims today**. Reopen a project a year later and the title block dates it a year late. A printed set is a snapshot of a design at a moment; dating it "whenever you happened to hit print" makes the date worse than useless, because it looks authoritative.
  - **Resolution order for the title-block date:**

| Case | Date shown | Source |
|---|---|---|
| Cloud version opened | that version's save time | `project_versions.created_at` — authoritative for cloud projects |
| Local file loaded (**including every guest**) | that file's save time | **`ProjectFile.savedAt`, which is already written on every save and has never once been read** — this decision is what finally reads it |
| Never saved (fresh design in the editor) | today | genuinely is today's work; nothing to be wrong about |

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
| **Invited collaborator** (cross-cutting, per project) | yes | yes | — | — | **yes, that project** | — | **yes, that project** | **yes, that project** | no | no | no | no | no | that project counts as own (29) |
| **Platform admin** | yes | yes | all | yes | yes | yes | yes | yes | yes | yes | yes | yes | **yes** | everything |

Readings that must survive implementation:

- **Browsing is a row of this table now, not a mode layered over one.** "Acting as the Seed Collaborative" is where consortium read lives; there is no separate browse permission to grant.
- **The two Seed rows are different and both are real.** Someone from Building Integrity acting as Seed gets Seed's tree read-only plus create rights. Someone whose *own* company is the Seed Collaborative gets their own company's tree, with costs, plus browsing. **Do not collapse them** — the difference is ownership, and it falls out of the ownership rule rather than needing a special case.
- **"Create yes, edit only with a grant" is the one asymmetric cell**, and it is deliberate (18): creating in the consortium's tree is free, editing someone's existing work is not. **It depends on the flagged inference above** that a creator keeps a grant on what they created — otherwise this row means you cannot edit your own new project after saving it once.
- **An invited collaborator's access is scoped to the one project**, not to the inviting company, and it is the mechanism behind the "only with a grant" cell.
- **The switcher does appear in this table now, and that is the correction.** An earlier draft said consulting the switcher in a permission check was always a bug. Under the merged model the acting-as company is a legitimate input. The surviving rule: **the switcher selects among entitlements you hold and never creates one**, and the acting-as claim is verified server-side on every request.

### Build order

Tommy has seen and agreed this. **Each stage is usable alone**, which is the point — none of them is a foundation-only stage that ships nothing.

**There is no Stage 0 any more.** The iframe sign-in spike — previously a go/no-go gate and named here as the biggest technical unknown in the plan — is deleted, because the iframe itself is gone (see "Starting position" above). **The largest single risk in this design is gone, and it was retired by a product fact rather than by engineering.**

0. **Title-block save date (no backend required).** The local-file and never-saved rows of the date table above: read `ProjectFile.savedAt`, stop calling `new Date()` at render. **Numbered zero because it needs nothing from any other stage and fixes the defect for every user the app currently has.** The cloud row follows in Stage 2.
1. **Accounts and companies.** Sign in/out, invites, memberships, default company, company admin, **and the always-visible acting-as switcher including the Seed toggle**. The app gains a real identity and nothing else changes. *(Usable alone: nothing to save yet, but the top-bar sign-in Tommy described exists and works.)*
2. **Cloud projects and versions.** The three folders, save-as-new-version, the version list, open-from-cloud, the divergence notice (11), and the cloud row of the date table. Local save/load untouched alongside it. *(This is the stage that delivers Tommy's actual sentence — "reachable to another Member on any computer where they can log in.")*
3. **Collaboration.** `collaborators`, invitations, requests, shared access to one project (24-26). Supersedes the older "in-app inbox" line in the Handoff section above — this *is* the handoff mechanism. **It is also what makes the "edit an existing Seed project" case work**, so it is a prerequisite for Stage 4 being coherent rather than an independent feature.
4. **Consortium browsing.** Acting as the Seed Collaborative, the cross-company read layer, the cost redactor, the export restrictions (19-23). **The redactor is the highest-risk single piece of the whole design** and deliberately does not ship before there is anything to browse.
5. **Platform admin.** Cross-company visibility, permanent delete, full backup, and the case-by-case departing-company judgement (28).

Backups (29) ride with the stage that makes them meaningful: company backup with stage 2, platform backup with stage 5.

**Flags check: clean, and confirmed rather than assumed.** This section introduces **no real-world building values at all** — no fastener spacing, no load, no density, no dimension, no cost figure. No `CatalogValue`, `CatalogRange`, or `PanelStructuralStatus` is in scope, and `data.ts` is not touched. Nothing new reaches the Review Log. **It does touch the `pending-BI-confirmation` convention in exactly one indirect way, and only in the direction of strengthening it:** the redaction rule adopts the same principle the flag convention exists for — a plausible substituted number (a defaulted price modifier shown to a browsing company) is worse than a visible gap, for the same reason a researched value marked `confirmed` is worse than one marked pending. Any dollar figure this work causes to be *displayed* is an existing catalog value, still carrying whatever status it already has. The coder re-runs the 6-point check against the actual diff.

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
- **Which panel absorbs the extra eighth on an uneven split.** `distributeEighths` gives it to the lowest-index part; `buildPlainMiddle` then places the pair in its existing order, so the wider one currently ends up first in the array. Deterministic and documented, but arbitrary. If Tommy would rather the wider panel always sit nearest the gap panel (or always farthest from it), it's a one-line reorder at the call site.
- **Octagon miters can't sit on the 1/8in grid.** A 45° wall between two grid corners has an irrational length, so its fabrication length is rounded (≤1/16in residual per diagonal wall, absorbed at the corner joint — the safety/gap panel's own stated purpose). Rejected: distorting the octagon to force grid-exact diagonals, and exempting mitered shapes from the invariant. Revisit only if a fabricator reports the miter joints reading short.
- **Should fabrication sheets be imperial-only?** The 1/8in grid is exact in imperial and provably cannot sum exactly in metric at nearest-mm. Current plan is a note on metric fabrication output saying the imperial value is authoritative. Blocking the metric toggle on fabrication sheets outright would be cleaner but is a bigger UX call than Tommy asked for.
- **The 1/8in grid stops at wall panelization this pass — deliberately.** The same even-split defect exists in `computeJoistLayout`, `computeFieldFramingLayout` (`perimeterRing.ts`), `floorPanelGrid.ts`, and `trussLayout.ts`, which all divide a span into equal pieces. Not folded in: Tommy asked about drawing tools, bump-out, panel movers, and the panelizer. `distributeEighths` is directly reusable when it's wanted.
- **The vertical invariant is the same problem, not yet spec'd.** `computeWallVerticalBandsForSlot` splits a wall's height into bands around mid-wall beams; "the bands sum to the wall height" is the same guarantee as "the panels sum to the wall length," and beam height/top drags are in the Stage 2 snap list, but the band arithmetic itself hasn't been audited for the same halving defect. Worth doing right after Stage 1.
- Single nearest fabricator vs. broadcast to a few for handoff — **partially answerable now:** the backend's collaboration grants (decisions 24-26) are the mechanism either answer would use. The routing policy question is still Tommy's.
- Detail page numbering scheme

### Open Items — Backend, Accounts & Project Sharing

### Per-company colour schemes — possible, not yet affordable

Tommy (2026-09-06): each company should be able to carry its own colour scheme, the Seed Collaborative's being a light green palette. **Not built, and deliberately not built in Stage 1** — but Stage 1 must not preclude it.

**The real palette exists.** `SeedCollabColors.pdf` at the repo root is a full brand guide (Seed Collaborative, Brand Guidelines V2.0), currently untracked. Source colours: **Lime `#B7D732`, Sky `#7ADBF5`, Amber `#FBB03B`, Ink `#000000`**, with limestone neutrals (`#FCFBFA` paper, `#F9F8F6` card, `#F4F2EE` band, `#F0EDE8`, `#E6E2DC`) and lime/sky tints (`#EFF4D9`, `#E9F0CA`, `#E7F4F5`, `#DBF0F4`). It carries a hard rule worth honouring: **the 5% rule** — brights appear only as the smallest spot accents (a dot, a bullet, a marker), never as washes or backgrounds; larger surfaces use the ink-blended tints, and ink alone carries text, rules and shading. A naive "make it green" theming pass would violate the very brand guide it is trying to implement.

**Why it is not affordable yet.** The app has **2** colour custom properties in total (`--background`, `--foreground`) against roughly **188 hardcoded hex values across 21 CSS files** and **462 more in TSX**. There is no token layer to theme.

**The distinction that makes this tractable** — and the reason a blanket find-and-replace would be wrong. Two kinds of colour are mixed together in that count:

- **Chrome** — top bar, sticky notes, panels, buttons, the title block. This is company identity and *should* re-skin.
- **Drawing semantics** — member colours by role, material colours, the opacity bands, the review-log red. These encode meaning. A stud must not change colour because a Seed Collaborative member is viewing, and a fabrication sheet must read identically to whoever opens it. These must **never** be themed.

Only chrome gets tokens, so the count that matters is far smaller than 650.

**What Stage 1 must do, and no more:** add a nullable `theme` JSON column to `companies` so the data model carries it, and define the chrome token layer in `globals.css` with today's Building Integrity values as the defaults — so nothing changes visually and new code has tokens to reach for. Migrating existing chrome colours onto tokens is opportunistic afterwards, never a Stage 1 task.

**Decided (2026-09-06): the theme follows the company you are ACTING AS**, not the owning company of the project on screen. Browsing New Frameworks' tree while acting as Building Integrity shows Building Integrity's colours throughout.

**Useful consequence, and a reason to prefer this reading beyond Tommy having chosen it:** the theme becomes a second, ambient indicator of which company you are acting as. The spec already requires the switcher to be always visible because the failure it prevents is saving into the wrong company's folder; a whole-interface colour shift reinforces that far more strongly than a label does. Under the alternative reading the colours would change as you browsed between companies, which would have made them noise rather than signal — actively working against the switcher.

It also means the colour never encodes *whose work you are looking at*, so nothing about theming can be mistaken for a permission or ownership cue. Ownership is shown, not coloured.

**One narrow exception to settle before theming ships: the title block.** A printed sheet is a document about who produced it, not about who pressed print. If chrome tokens are applied blindly, the same fabrication sheet would carry different branding depending on which company the person printing it happened to be acting as — and the block already renders a fixed "Building Integrity" wordmark today. The likely answer is that the title block follows the project's **owning** company (or stays fixed) while every other surface follows acting-as, but it needs deciding rather than inheriting. Not a Stage 1 concern; a Stage 2 one, when projects have owners.

**The genuinely open question is one: the backup file format.** Everything else below is either answered, a recorded rejection, or a known implementation caveat that does not need a decision before a coder starts.

- **⚠ Backup format and manifest — the one open decision.** Decision 29 says "a complete backup for a USB stick" and nothing about shape. A zip of one JSON per version plus a manifest is the obvious answer and needs about ten seconds of Tommy's confirmation, mostly so the manifest carries what he would actually want to find on that stick a year later (company, project, folder, version, author, date). Blocks nothing until Stage 2.

**Needs Tommy's yes, but is an inference rather than a question he was asked.**
- **⚠ Does the creator of a Seed-tree project keep access to it?** "Create freely, but editing an existing Seed project needs an invitation" taken literally means you lose your own work the moment you save it. **The coherent reading — creating in another company's tree grants the creator a standing collaborator grant on that project — is written into the spec above and flagged there as an inference.** Confirm before Stage 3/4; the alternative reading is not plausible but should be ruled out by him rather than by us.

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
