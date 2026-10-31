import type { PanelMember, SectionSpacePoint2D } from "./componentSchema";
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
 * > *"These panels should begin at the top plate and have an inclined top
 * > plate sloped to receive the roof panels."* — Tommy, 2026-10-31
 *
 * ⚠ **This is a different axis from every sloped panel the app has.** A Gable
 * End Panel's top slopes along its WIDTH: stand in front of it and the top
 * runs uphill left to right. This one's top slopes along its DEPTH: the top
 * runs uphill from the outside face to the inside face, and in elevation it
 * looks level.
 *
 * ⚠ **It used to be SIX members and its one sloped board rendered in the
 * wrong plane.** Tommy, 2026-10-31: *"it appears as though the shed roof
 * sloped determining inclined panels are not spawning, though there are a few
 * pieces of wood hanging around where they should be."* The few pieces were
 * the whole panel. The sloped board carried `tiltDeg`, which both the
 * renderer and the OBJ exporter apply in the panel's WIDTH/HEIGHT plane — the
 * one plane this panel's tilt is not in — so it came out swung sideways.
 *
 * `sectionCornersIn` is that missing plane (depth × height), and every member
 * whose top meets the incline now carries it. *"One incline surface per panel
 * in the table"* is taken literally: the panel's whole top is ONE plane and
 * each member is ripped to it.
 */

/** Intermediate studs are added so no bay exceeds this. */
const CROSS_TILT_STUD_SPACING_IN = 24;

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
  /** The angle the top is cut to, off level. */
  tiltDeg: number;
  refusal: string | null;
}

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

  const tan = pitchIn12 / 12;
  const cos = 12 / Math.hypot(12, pitchIn12);
  const riseIn = depthIn * tan;
  const highHeightIn = lowHeightIn + riseIn;
  const tiltDeg = (Math.atan2(riseIn, depthIn) * 180) / Math.PI;

  /** The panel's one inclined top surface, as a height at a given depth. */
  const topAtYIn = (yIn: number) => lowHeightIn + yIn * tan;
  /**
   * ⚠ A thickness measured PERPENDICULAR to the incline drops the surface by
   * `thickness / cos` when read at a fixed depth — not by the thickness. The
   * same conversion the gable's top plate needed; getting it wrong leaves
   * every layer here a little proud of the one above it.
   */
  const belowTopAtYIn = (yIn: number, perpendicularIn: number) => topAtYIn(yIn) - perpendicularIn / cos;

  /** A slab lying IN the incline, between two perpendicular depths. */
  const slab = (y0In: number, y1In: number, perpStartIn: number, perpEndIn: number): SectionSpacePoint2D[] => [
    { yIn: y0In, zIn: belowTopAtYIn(y0In, perpStartIn) },
    { yIn: y1In, zIn: belowTopAtYIn(y1In, perpStartIn) },
    { yIn: y1In, zIn: belowTopAtYIn(y1In, perpEndIn) },
    { yIn: y0In, zIn: belowTopAtYIn(y0In, perpEndIn) },
  ];

  const members: PanelMember[] = [];

  /* The bottom skin and its two plates, flat and square like any other
     panel's — the panel "begins at the top plate" of the wall below it. */
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
    notes: "sits on the wall's own top plate",
  });
  for (const [face, yIn] of [
    ["exterior", 0],
    ["interior", depthIn - PLATE_2X4_WIDTH_IN],
  ] as [string, number][]) {
    members.push({
      memberId: `cross_tilt_bottom_plate_${face}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: `${face}-wythe edge`,
    });
  }

  /* ⚠ STUDS IN TWO ROWS, each RIPPED TO THE INCLINE. A stud in the exterior
     row is shorter than one in the interior row by the rise, and within a
     single stud the 3 1/2in it occupies through the depth is itself a slope
     — which is why each carries its own section rather than a height. */
  const bottomZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const studXs: number[] = [0, widthIn - PLATE_2X4_THICKNESS_IN];
  const bays = Math.max(1, Math.ceil((widthIn - PLATE_2X4_THICKNESS_IN) / CROSS_TILT_STUD_SPACING_IN));
  for (let i = 1; i < bays; i++) {
    studXs.push((i * (widthIn - PLATE_2X4_THICKNESS_IN)) / bays);
  }
  studXs.sort((a, b) => a - b);

  for (const [face, y0In] of [
    ["exterior", 0],
    ["interior", depthIn - PLATE_2X4_WIDTH_IN],
  ] as [string, number][]) {
    const y1In = y0In + PLATE_2X4_WIDTH_IN;
    const topPerpIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
    for (const [index, xIn] of studXs.entries()) {
      members.push({
        memberId: `cross_tilt_stud_${face}_${index}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        /* The piece AS CUT is its LONG point, at the deeper of its two
           edges, because the rip runs uphill toward the inside face. */
        actualDimsIn: {
          thicknessIn: PLATE_2X4_THICKNESS_IN,
          widthIn: PLATE_2X4_WIDTH_IN,
          lengthIn: belowTopAtYIn(y1In, topPerpIn) - bottomZIn,
        },
        orientation: "vertical",
        position: {
          xIn,
          yIn: y0In,
          zIn: bottomZIn,
          rotationDeg: 0,
          sectionCornersIn: [
            { yIn: y0In, zIn: bottomZIn },
            { yIn: y0In, zIn: belowTopAtYIn(y0In, topPerpIn) },
            { yIn: y1In, zIn: belowTopAtYIn(y1In, topPerpIn) },
            { yIn: y1In, zIn: bottomZIn },
          ],
        },
        role: "stud",
        qty: 1,
        notes:
          index === 0 && face === "exterior"
            ? `ripped ${tiltDeg.toFixed(2)}deg across its own depth — the exterior row is the SHORT one, the top rises toward the inside face`
            : undefined,
      });
    }
  }

  /* ⚠ THE INCLINED TOP PLATE, and the surface the roof actually lands on.
     Two ripped 2x4s at the wythe edges with the skin over them, all three
     lying IN the one inclined plane. */
  for (const [face, y0In] of [
    ["exterior", 0],
    ["interior", depthIn - PLATE_2X4_WIDTH_IN],
  ] as [string, number][]) {
    const y1In = y0In + PLATE_2X4_WIDTH_IN;
    members.push({
      memberId: `cross_tilt_top_plate_${face}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: widthIn },
      orientation: "flat",
      position: {
        xIn: 0,
        yIn: y0In,
        zIn: belowTopAtYIn(y1In, SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN),
        rotationDeg: 0,
        sectionCornersIn: slab(y0In, y1In, SKIN_THICKNESS_IN, SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN),
      },
      role: "plate",
      qty: 1,
      notes: `${face}-wythe edge, ripped ${tiltDeg.toFixed(2)}deg off level so the roof panel lands flush`,
    });
  }

  members.push({
    memberId: "cross_tilt_top_skin",
    material: "plywood",
    speciesGrade: null,
    plySpec: SKIN_PLY_SPEC,
    nominalSize: null,
    /* Its width is the SLOPED depth, longer than the panel is deep, which is
       the number the shop cuts to. */
    actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn / cos, lengthIn: widthIn },
    orientation: "flat",
    position: {
      xIn: 0,
      yIn: 0,
      zIn: belowTopAtYIn(depthIn, SKIN_THICKNESS_IN),
      rotationDeg: 0,
      sectionCornersIn: slab(0, depthIn, 0, SKIN_THICKNESS_IN),
    },
    role: "skin",
    qty: 1,
    notes: `the one inclined surface — cut ${(depthIn / cos).toFixed(3)}in across, not the panel's ${depthIn}in depth`,
  });

  return { members, highHeightIn, tiltDeg, refusal: null };
}
