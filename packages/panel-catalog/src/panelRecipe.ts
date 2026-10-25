import type { PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_THICKNESS_IN,
  braceLongestEdgeIn,
  computeBraceBoardCornersIn,
} from "./panelMemberHelpers";
import { buildStandardPanelMembers } from "./standardPanelMembers";

/**
 * ⚠ A PANEL IS A BASE PLUS THE MEMBERS ADDED TO IT AFTERWARDS.
 *
 * > *"There could be a Panel Editor! Where users can create their own panels,
 * > name them, and use them as a library for designing with."* — Tommy,
 * > 2026-10-25
 *
 * This is the model under that. Today every panel kind is its own builder —
 * `buildStandardPanelMembers`, `buildBracedPanelMembers`, a dozen more — and
 * adding a pattern means writing another one. But all of them return
 * `PanelMember[]`, and nothing downstream knows what KIND of panel it has:
 * the cut list, the weight checker, the 3D view, the OBJ exporter, the
 * fabrication sheet and the overlap check all read members and nothing else.
 *
 * So composition is the only missing piece, and **panel surgery is why it is
 * honest rather than a trick**:
 *
 * > *"The diagonals for each panel are added after it comes out of the
 * > compression table via panel surgery."*
 *
 * A member added after pressing IS a composition. The panel leaves the table
 * as a plain box and then gets routed and fitted.
 */

/** Which face of the panel a surgery member is let into. */
export type PanelWythe = "exterior" | "interior";

/**
 * A member added to a pressed panel.
 *
 * ⚠ **Added members sit INSIDE the panel's depth, not on its face.** Tommy,
 * 2026-10-25: *"Inside the panels depth - the straw router bit'ed out a
 * little groove for a wooden member to sit where straw was."* So they occupy
 * space that was straw, flush with the face, which is what the braced panel
 * has always modelled. That also means they displace straw and the straw
 * volume has to come down, which it does automatically: every straw
 * calculation in the app subtracts member volume.
 */
export type AddedMemberSpec =
  | {
      /** A board cut on the diagonal, mitred at both ends — a brace leg. */
      kind: "diagonal";
      id: string;
      /** Panel elevation coordinates: x across the width, z up the height. */
      fromXIn: number;
      fromZIn: number;
      toXIn: number;
      toZIn: number;
      wythe: PanelWythe;
      notes?: string;
    }
  | {
      /** A board cut square, lying along one axis — a horizontal tie, an
       * extra stud, a nailer. */
      kind: "straight";
      id: string;
      fromXIn: number;
      fromZIn: number;
      toXIn: number;
      toZIn: number;
      wythe: PanelWythe;
      notes?: string;
    };

export interface PanelRecipe {
  /** What the user called it in their library. */
  name: string;
  widthIn: number;
  depthIn: number;
  heightIn: number;
  /** ⚠ A plain standard panel does NOT get one. Tommy, 2026-10-25: *"Plain
   * standard panel shouldn't have the nailer."* It is an added member for
   * fixing shear coverings, which is what makes a Nailer panel a Nailer
   * panel. */
  includeNailer?: boolean;
  added: AddedMemberSpec[];
}

/** Where a wythe's surgery members sit through the panel's depth: let into
 * the straw flush with that face. */
export function wytheInsetYIn(wythe: PanelWythe, depthIn: number): number {
  return wythe === "exterior" ? PLATE_2X4_THICKNESS_IN / 2 : depthIn - PLATE_2X4_THICKNESS_IN / 2;
}

/**
 * One diagonal leg, built the way the braced panel already builds them.
 *
 * ⚠ Reuses `computeBraceBoardCornersIn` and `braceLongestEdgeIn` rather than
 * recomputing the geometry. Those carry a lot of settled decisions — the real
 * trapezoid corners, the rigid shift that keeps a long point flush with the
 * panel edge instead of clamping one corner, and the cut length taken across
 * the longest edge, which is exactly his rule: *"For 2x4 length counts just
 * count the longest tips' length."*
 */
function buildDiagonalFromSpec(spec: Extract<AddedMemberSpec, { kind: "diagonal" }>, depthIn: number): PanelMember {
  const corners = computeBraceBoardCornersIn(spec.fromXIn, spec.fromZIn, spec.toXIn, spec.toZIn, PLATE_2X4_WIDTH_IN);
  /* Taken across the two long edges, not between the anchors: both anchors
     sit on ONE edge, so their midpoint is on that edge and not on the
     centreline. The braced panel learned this the hard way. */
  const centerX = (corners[0]!.xIn + corners[2]!.xIn) / 2;
  const centerZ = (corners[0]!.zIn + corners[2]!.zIn) / 2;
  const tiltDeg = (Math.atan2(-(spec.fromXIn - spec.toXIn), spec.fromZIn - spec.toZIn) * 180) / Math.PI;
  return {
    memberId: spec.id,
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: {
      thicknessIn: PLATE_2X4_THICKNESS_IN,
      widthIn: PLATE_2X4_WIDTH_IN,
      lengthIn: braceLongestEdgeIn(corners),
    },
    orientation: "diagonal",
    position: {
      xIn: centerX,
      yIn: wytheInsetYIn(spec.wythe, depthIn),
      zIn: centerZ,
      rotationDeg: 90,
      tiltDeg,
      trapezoidCornersIn: corners,
    },
    role: "brace",
    qty: 1,
    notes: spec.notes,
  };
}

/**
 * One square-cut board, horizontal or vertical.
 *
 * ⚠ The two cases sit differently through the depth, and it matters:
 *
 * - A **horizontal** tie is let into the face on its flat, so its 1.5in
 *   thickness goes through the depth and its 3.5in width stands up the
 *   panel. That is `orientation: "horizontal"` at rotation 0.
 * - A **vertical** member is a stud, and a stud is 1.5in across the panel's
 *   width and 3.5in through its depth, the same as the corner posts.
 *
 * Getting this wrong put a tie at y = -1in, outside the panel altogether.
 */
function buildStraightFromSpec(spec: Extract<AddedMemberSpec, { kind: "straight" }>, depthIn: number): PanelMember {
  const runXIn = Math.abs(spec.toXIn - spec.fromXIn);
  const runZIn = Math.abs(spec.toZIn - spec.fromZIn);
  const isVertical = runZIn >= runXIn;
  const lengthIn = isVertical ? runZIn : runXIn;
  /* How deep into the panel this member's own cross-section reaches, which
     is what decides where the interior wythe's copy starts. */
  const throughDepthIn = isVertical ? PLATE_2X4_WIDTH_IN : PLATE_2X4_THICKNESS_IN;
  const yIn = spec.wythe === "exterior" ? 0 : depthIn - throughDepthIn;
  return {
    memberId: spec.id,
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn },
    orientation: isVertical ? "vertical" : "horizontal",
    position: {
      xIn: Math.min(spec.fromXIn, spec.toXIn),
      yIn,
      zIn: Math.min(spec.fromZIn, spec.toZIn),
      rotationDeg: 0,
    },
    role: isVertical ? "stud" : "blocking",
    qty: 1,
    notes: spec.notes,
  };
}

/**
 * Build a panel from its recipe.
 *
 * ⚠ With no added members this is EXACTLY `buildStandardPanelMembers`, and a
 * test holds it to that. The whole value of composition is that the base is
 * untouched — if the recipe path drifted from the builder it replaces, every
 * panel in every existing project would quietly change.
 */
export function buildPanelFromRecipe(recipe: PanelRecipe): PanelMember[] {
  const base = buildStandardPanelMembers(recipe.widthIn, recipe.depthIn, recipe.heightIn, recipe.includeNailer ?? false);
  return [
    ...base,
    ...recipe.added.map((spec) =>
      spec.kind === "diagonal" ? buildDiagonalFromSpec(spec, recipe.depthIn) : buildStraightFromSpec(spec, recipe.depthIn),
    ),
  ];
}

/** The usable height between the plate faces, which is what a surgery member
 * has to fit inside. */
export function recipeClearHeightIn(heightIn: number): { bottomZIn: number; topZIn: number } {
  const face = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  return { bottomZIn: face, topZIn: heightIn - face };
}
