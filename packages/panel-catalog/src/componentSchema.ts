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

export type MemberRole = "stud" | "plate" | "girt" | "girt_web" | "nailer" | "brace" | "skin" | "blocking";

export interface MemberDims {
  thicknessIn: number;
  widthIn: number;
  lengthIn: number;
}

export interface MemberPosition {
  /** Min-corner (not center) for every orientation except "diagonal" —
   * see `tiltDeg` below and `memberBoxSizeIn` in panelMemberHelpers.ts. */
  xIn: number;
  yIn: number;
  zIn: number;
  rotationDeg: number;
  /** Rotation (degrees) around the Y axis, tilting the member within the
   * X-Z plane — used only for "diagonal" orientation members (e.g. a
   * braced panel's angled brace). When set, `xIn`/`yIn`/`zIn` above are
   * the member's CENTER point, not its min-corner (a rotated box has no
   * single natural corner to anchor on) — the one exception to the
   * min-corner rule every other orientation follows. */
  tiltDeg?: number;
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
