import type { PanelMember } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
} from "./panelMemberHelpers";

/**
 * A panel whose top is tilted FRONT TO BACK — through its depth — so an
 * inclined roof panel lands on it flush.
 *
 * > *"Currently Gable panels are inclined elevation view from left to right.
 * > I am suggesting that in a shed roof with a smaller set of gable line
 * > panels on top of the main wall, they can be inclined elevation view front
 * > to back. We can do one incline surface per panel in the table."* — Tommy,
 * > 2026-10-27
 *
 * ⚠ **This is a different axis from every sloped panel the app has.** A Gable
 * End Panel's top slopes along its WIDTH: stand in front of it and the top
 * runs uphill left to right. This one's top slopes along its DEPTH: the top
 * runs uphill from the outside face to the inside face, and in elevation it
 * looks level.
 *
 * It exists for the tall wall of a shed. The roof over that wall is LEVEL
 * along the wall — the slope runs perpendicular to it — so a gable panel's
 * own kind of incline would put a peak where the wall should be flat. What
 * has to tilt is the bearing surface in cross-section.
 *
 * ⚠ *"One incline surface per panel in the table"* is what makes it
 * fabricable: the compressor table can produce a single inclined face, so
 * this is a plain panel with one angled top rather than anything exotic.
 */

export interface CrossTiltPanelOptions {
  widthIn: number;
  depthIn: number;
  /** Height at the panel's EXTERIOR face, which is the low side on a shed's
   * tall wall: the roof rises away from the weather side. */
  lowHeightIn: number;
  /** Rise per 12 of depth — the roof's own pitch, since this top plate is
   * the surface that roof lands on. */
  pitchIn12: number;
}

export interface CrossTiltPanelResult {
  members: PanelMember[];
  /** Height at the interior face. */
  highHeightIn: number;
  /** The angle the top plate is cut to, off level. */
  tiltDeg: number;
  refusal: string | null;
}

/**
 * ⚠ The top plate is modelled as a single board cut to the tilt, not as a
 * stack of stepped pieces. That is the whole point of *"one incline surface
 * per panel"* — the table makes one angled face, and a stepped
 * approximation would describe a panel nobody is building.
 */
export function buildCrossTiltPanelMembers(options: CrossTiltPanelOptions): CrossTiltPanelResult {
  const { widthIn, depthIn, lowHeightIn, pitchIn12 } = options;
  const empty = { members: [], highHeightIn: 0, tiltDeg: 0 };

  if (!(widthIn > 0) || !(depthIn > 0)) {
    return { ...empty, refusal: "A panel needs a width and a depth." };
  }
  if (!(lowHeightIn > 0)) {
    return { ...empty, refusal: "A panel needs a height at its low side." };
  }
  if (!(pitchIn12 >= 0)) {
    return { ...empty, refusal: "The tilt needs a pitch to follow." };
  }

  const riseIn = (depthIn * pitchIn12) / 12;
  const highHeightIn = lowHeightIn + riseIn;
  const tiltDeg = (Math.atan2(riseIn, depthIn) * 180) / Math.PI;

  const members: PanelMember[] = [];

  /* The two studs, each cut to its own face's height — the exterior one
     short, the interior one tall. ⚠ A stud's height here depends on which
     FACE it is on, not where it sits across the width, which is the whole
     difference from a gable panel. */
  for (const [face, yIn, heightIn] of [
    ["exterior", 0, lowHeightIn],
    ["interior", depthIn - PLATE_2X4_WIDTH_IN, highHeightIn],
  ] as [string, number, number][]) {
    for (const [side, xIn] of [
      ["left", 0],
      ["right", widthIn - PLATE_2X4_THICKNESS_IN],
    ] as [string, number][]) {
      members.push({
        memberId: `cross_tilt_stud_${face}_${side}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: {
          thicknessIn: PLATE_2X4_THICKNESS_IN,
          widthIn: PLATE_2X4_WIDTH_IN,
          lengthIn: heightIn - SKIN_THICKNESS_IN,
        },
        orientation: "vertical",
        position: { xIn, yIn, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
        role: "stud",
        qty: 1,
        notes:
          face === "exterior" && side === "left"
            ? "exterior studs are the SHORT ones — the top rises toward the inside face"
            : undefined,
      });
    }
  }

  /* The bottom plate skin, flat and square like any other panel's. */
  members.push({
    memberId: "cross_tilt_bottom_skin",
    material: "plywood",
    speciesGrade: null,
    plySpec: SKIN_PLY_SPEC,
    nominalSize: null,
    actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthIn },
    orientation: "flat",
    position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
    role: "skin",
    qty: 1,
  });

  /* ⚠ THE TILTED TOP PLATE, as ONE board. Its cut length across the panel is
     the SLOPED depth, longer than the depth itself, which is the number the
     shop actually cuts to. `tiltDeg` carries the angle; the trapezoid
     machinery the braces use is not needed because this board is a plain
     rectangle — it is only its seating that is angled. */
  const slopedDepthIn = Math.hypot(depthIn, riseIn);
  members.push({
    memberId: "cross_tilt_top_plate",
    material: "dimensional_lumber",
    speciesGrade: LUMBER_SPECIES_GRADE,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: slopedDepthIn },
    orientation: "horizontal",
    position: { xIn: 0, yIn: 0, zIn: lowHeightIn - PLATE_2X4_THICKNESS_IN, rotationDeg: 90, tiltDeg },
    role: "plate",
    qty: 1,
    notes: `top plate cut ${tiltDeg.toFixed(2)}deg off level, rising toward the interior face — the surface the roof panel lands on`,
  });

  return { members, highHeightIn, tiltDeg, refusal: null };
}
