/**
 * Shared geometry/spec schema (Tommy's `panel_schema_draft.md`) — one data
 * shape meant to feed 3 consumers: shop-drawing widgets, the app's 3D
 * renderer, and a future SketchUp Ruby exporter. Field names are adapted
 * to this repo's camelCase convention (the draft itself uses snake_case
 * JSON keys); the shape/meaning is otherwise unchanged from the draft.
 *
 * Coordinate convention (draft: "origin = bottom-left-front corner"): for
 * a single component in isolation, X = along its width, Y = along its
 * depth/thickness, Z = up from its bottom face, and every member's
 * `position` is its own min-corner (not center) in that space. The
 * draft's "wall-run" placement (stringing panel instances along a linear
 * wall-run offset) is a later concern, not modeled here yet — nothing
 * upstream of a single component needs it today.
 */

export type ComponentType = "panel" | "floor_assembly" | "connection_detail" | "fastener_schedule";

export type ComponentStatus = "locked" | "draft" | "deprecated";

export type MemberMaterial =
  | "dimensional_lumber"
  | "plywood"
  | "osb"
  | "wood_fiber_board"
  | "wire_mesh"
  | "fastener";

export type MemberOrientation = "vertical" | "horizontal" | "diagonal" | "flat";

export type MemberRole = "stud" | "plate" | "girt" | "girt_web" | "nailer" | "brace" | "skin" | "blocking" | "jack_stud";

export interface MemberDims {
  thicknessIn: number;
  widthIn: number;
  lengthIn: number;
}

/** A point in a panel's own local X-Z (elevation) plane — panel-X = along
 * its width, panel-Z = up from its bottom face. */
export interface PanelSpacePoint2D {
  xIn: number;
  zIn: number;
}

/** A point in a member's own PLAN (X-Y) plane — member-X = width, member-Y
 * = depth (see `MemberPosition` below). Deliberately a separate type from
 * `PanelSpacePoint2D`, which is the ELEVATION (X-Z) plane: a floor plate
 * extruded upward and a beveled brace extruded through the wall are
 * genuinely different extrusions, and one overloaded `{xIn, ...}` type
 * would make the plane a matter of guesswork at every call site. */
export interface PlanSpacePoint2D {
  xIn: number;
  yIn: number;
}

/**
 * A point in a member's own SECTION (Y-Z) plane — member-Y = depth through
 * the panel, member-Z = height/span (see `MemberPosition` below).
 *
 * ⚠ This is the THIRD of the three planes, and the only one in which a
 * ROOF PANEL'S PLUMB END CUT can be drawn. `PanelSpacePoint2D` is the
 * elevation (X-Z) and `PlanSpacePoint2D` is the plan (X-Y); a roof panel is
 * built lying in the compressor table, so its span is Z and its depth is Y,
 * and a cut that is vertical once the panel is tipped onto the roof runs
 * across BOTH of those at once. Neither of the other two can express it, and
 * an overloaded `{...In}` type would make the plane guesswork at every call
 * site — the same reasoning that split the first two.
 */
export interface SectionSpacePoint2D {
  yIn: number;
  zIn: number;
}

/**
 * A member's placement in MEMBER SPACE (the authoring convention every
 * builder in packages/panel-catalog/src writes, Z-up):
 *   xIn = WIDTH, along the panel/assembly's length, from its own min-corner
 *   yIn = DEPTH, through the wall, 0 at the exterior face
 *   zIn = HEIGHT, UP, 0 at the bottom face
 * This is NOT the space the renderer and the OBJ file use. `memberLocalCornersIn`
 * (panelMemberHelpers.ts) converts to VIEW SPACE (Y-up: world X = member X,
 * world Y = member Z, world Z = member Y), and that swap happens there and in
 * PanelMembersGroup.tsx only — a builder never writes view-space coordinates.
 * Reasoning about "up" means zIn; reasoning about "through the wall" means yIn.
 * See "3D Member Geometry — the two axis spaces" in building_integrity_app_spec.md;
 * writing a depth offset into zIn is exactly the floor-band bug logged there.
 *
 * All three are the member's MIN-CORNER (not its center) for every orientation
 * except "diagonal" — see `tiltDeg` below and `memberBoxSizeIn` in
 * panelMemberHelpers.ts.
 */
export interface MemberPosition {
  /** Width, along the panel's own length. */
  xIn: number;
  /** Depth, through the wall (0 = exterior face). */
  yIn: number;
  /** Height, up from the bottom face — never a depth offset. */
  zIn: number;
  rotationDeg: number;
  /** Rotation (degrees) around the member-space Y (depth) axis, tilting
   * the member within the member-space X-Z plane — the same rotation is
   * "around view-space Z" once converted, which is how the renderer and
   * `memberLocalCornersIn` describe it — used only for "diagonal" orientation members (e.g. a
   * braced panel's angled brace). When set, `xIn`/`yIn`/`zIn` above are
   * the member's CENTER point, not its min-corner (a rotated box has no
   * single natural corner to anchor on) — the one exception to the
   * min-corner rule every other orientation follows. */
  tiltDeg?: number;
  /** True beveled-end trapezoid corners (panel-space X/Z, absolute,
   * perimeter order — see `computeBraceTrapezoidCornersIn` in
   * panelMemberHelpers.ts) — present only for a diagonal brace with a
   * real plumb (stud-end) + level (plate-end) cut pair. When present,
   * this OVERRIDES the plain tilted-box shape both `PanelMembersGroup.tsx`
   * and `panelObjExport.ts` would otherwise derive from xIn/zIn/tiltDeg —
   * both must check this first. `xIn`/`yIn`/`zIn`/`tiltDeg` remain
   * populated as the centerline reference (still used by
   * `computeBraceEndCutAngleDeg`, shear-capacity estimates, and any note
   * text that doesn't know about trapezoids). */
  trapezoidCornersIn?: [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D];
  /** An arbitrary n-gon PRISM's plan ring (member-space X-Y, absolute,
   * perimeter order, no repeated first point) — extruded UPWARD from
   * `position.zIn` by `actualDimsIn.thicknessIn`, so `zIn` is the prism's
   * bottom face, the same min-corner rule every other "flat" member
   * follows. Built for the floor bottom skin, whose real shape is the
   * building's own footprint polygon clipped into opacity bands, not the
   * footprint's bounding rectangle.
   *
   * This is a DIFFERENT PLANE from `trapezoidCornersIn` above, which is the
   * member-space ELEVATION (X-Z) plane extruded through depth — hence a
   * second field rather than a widened first one. The two are mutually
   * EXCLUSIVE; `memberLocalCornersIn` checks the trapezoid first, so a
   * member carrying both silently renders as a trapezoid. No builder may
   * set both.
   *
   * When present, this OVERRIDES the plain box shape both
   * `PanelMembersGroup.tsx` and `panelObjExport.ts` would otherwise derive
   * from the position/dims — and unlike a box or a trapezoid prism, such a
   * member has 2n corners, not 8, and its faces come from
   * `memberFaceIndices` rather than `BOX_FACES`. `position.xIn`/`yIn` are
   * NOT added to these points (they are already absolute); `actualDimsIn`'s
   * `widthIn`/`lengthIn` are the ring's own plan bounding box, kept
   * populated for consumers that read dims, same caveat
   * `trapezoidCornersIn` already carries. */
  planPolygonCornersIn?: PlanSpacePoint2D[];
  /**
   * A beveled SECTION prism's cross-section (member-space Y-Z, absolute,
   * perimeter order) — extruded along member-space X from `position.xIn` by
   * the member's own box X-extent (`memberBoxSizeIn(member).xIn`), so a
   * joist extrudes through its 1 1/2in thickness and a lid skin through the
   * panel's full width without either naming a number twice.
   *
   * Built for the ROOF PANEL'S PLUMB END CUT. Tommy, 2026-10-29: *"The tall
   * end of a roof panel should be plumb cut with a vertical structural top
   * plate, and the bottom of it should meet flush with the entire wall depth
   * and the rest should go plumb cut vertically."* A panel lying in the
   * table has its span along Z and its depth along Y; a cut that stands
   * vertical once the panel is tipped onto a 4:12 roof slices across both.
   *
   * ⚠ MUTUALLY EXCLUSIVE with `trapezoidCornersIn` and
   * `planPolygonCornersIn` — they are three different extrusion axes (X-Z
   * through Y, X-Y through Z, and Y-Z through X). `memberLocalCornersIn`
   * checks the trapezoid first, then the plan ring, then this, so a member
   * carrying two silently renders as the earlier one. No builder may set
   * more than one.
   *
   * When present this OVERRIDES the plain box shape, exactly as the other
   * two do. `actualDimsIn` stays the piece AS CUT — for a plumb-cut joist
   * that is its LONG point, which is the number the shop cuts to — and the
   * bevel angle belongs in `notes`.
   *
   * ⚠ THREE corners is a real case, not a degenerate four. The bearing
   * wedge under a roof panel's tall end is a true triangle: a level bottom,
   * a plumb outer face, and the panel's own sloped underside closing it.
   * Topology comes from `memberFaceIndices`' n-gon path rather than
   * `BOX_FACES`, so a triangle is drawn and exported as a triangle instead
   * of as a quad with two corners sitting on top of each other.
   */
  sectionCornersIn?: SectionSpacePoint2D[];
}

export interface PanelMember {
  memberId: string;
  material: MemberMaterial;
  /** null until sourced — needed for an NDS cross-reference later, not required for shop drawings/3D/export. */
  speciesGrade: string | null;
  /** Plywood/OSB spec (e.g. "3/4in_5ply_CDX") — null for non-sheet materials. */
  plySpec: string | null;
  nominalSize: string | null;
  actualDimsIn: MemberDims;
  orientation: MemberOrientation;
  position: MemberPosition;
  role: MemberRole;
  qty: number;
  notes?: string;
  /** Overrides this ONE member's own render opacity, ahead of whatever
   * PanelMembersGroup.tsx's MATERIAL_OPACITY map would otherwise use for
   * its material (Tommy: floor bottom membrane opacity "dividing the
   * space into one side being opaque and the other side being 75%
   * opaque followed by 50%") — needed since several same-material
   * members (e.g. the floor bottom skin's own 3 bands) can each need a
   * DIFFERENT opacity, which a material-keyed map alone can't express.
   * Undefined = today's exact behavior, purely material-driven. */
  opacityOverride?: number;
}

export interface ComponentNote {
  type: "discrepancy" | "deviation" | "warning";
  text: string;
}

export interface PanelComponentSchema {
  schemaVersion: string;
  componentType: ComponentType;
  id: string;
  displayName: string;
  status: ComponentStatus;
  derivedFrom: string | null;
  overallDimensions: { heightIn: number; widthIn: number; depthIn: number };
  members: PanelMember[];
  /** Typed loosely for now — this repo has no fastener-schedule consumer
   * yet (see fastenerSpacingTable in data.ts for the existing, unrelated
   * connection-level schedule); shaped here only so the field exists for
   * a future SketchUp exporter/connection_detail consumer. */
  fasteners: unknown[];
  notes: ComponentNote[];
  disclaimer: string;
}
