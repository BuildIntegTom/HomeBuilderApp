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

/** A 4x4's real thickness, for the steep-pitch top plate below. */
const PLATE_4X4_THICKNESS_IN = 3.5;

/**
 * ⚠ **WHAT THE TOP PLATE IS CUT FROM, which depends on the pitch.**
 *
 * The plate lies flat and the roof's slope is ripped into its top face, so
 * the rip takes `3 1/2in x pitch/12` out of the board's thickness. A 2x4 has
 * 1 1/2in to give, which runs out at about 5.1:12.
 *
 * > *"A 4x4 top plate."* — Tommy, 2026-11-01, asked what a steeper shed
 * should do. 3 1/2in of thickness in one piece, which carries to 12:12.
 *
 * ⚠ The thin edge FEATHERS, and that is expected on a bevel rip: at 4:12 a
 * 2x4 is left 1/3in at its outer edge and the full 1 1/2in at its inner one,
 * where the bearing actually is. So the rule is simply whether the board
 * survives the rip at all — no minimum edge is invented here.
 */
export function crossTiltTopPlateStock(pitchIn12: number): { nominalSize: "2x4" | "4x4"; thicknessIn: number } {
  const removedIn = PLATE_2X4_WIDTH_IN * (pitchIn12 / 12);
  return removedIn < PLATE_2X4_THICKNESS_IN
    ? { nominalSize: "2x4", thicknessIn: PLATE_2X4_THICKNESS_IN }
    : { nominalSize: "4x4", thicknessIn: PLATE_4X4_THICKNESS_IN };
}

/**
 * ⚠ **A real stud in the exterior wythe, which is what sets the low edge.**
 *
 * > *"Tall enough for a real stud in both wythes."* — Tommy, 2026-11-01
 *
 * The shortest piece this app will call a stud is one as long as it is wide
 * — the same rule a gable's corner studs are held to. Below that it is
 * blocking, and the wythe may as well have none.
 */
const CROSS_TILT_MIN_STUD_IN = PLATE_2X4_WIDTH_IN;

/**
 * ⚠ **THE SHORTEST THIS PANEL CAN BE AND STILL HOLD ITS OWN LAYERS**, at its
 * exterior face, which is the low side.
 *
 * Read down that face: the bottom skin, the bottom plate, the thin edge the
 * top plate's rip leaves, and the top skin standing `1 / cos` tall because it
 * lies at the roof's angle. Nothing may be stacked in less than their sum.
 *
 * ⚠ **It does not depend on the wall's depth** — only on the pitch. The rip
 * is taken across the plate's own 3 1/2in, so a deeper wall changes how high
 * the panel finishes but not how thin its outer edge gets. And it goes UP as
 * the roof gets FLATTER: less comes off the rip, so more of the 2x4 is left
 * standing at the thin edge. At 4:12 it is 3.374in, at 2:12 3.927in, and dead
 * flat it is the full 4.5in.
 *
 * This is the number B8 was about. The row was being built at a flat 3 1/2in
 * — `PLATE_2X4_WIDTH_IN`, this app's own stand-in — and at 4:12 that was
 * 1.25in short of what the panel needed, so the exterior stud had nowhere to
 * go and the two plates ran into each other. It is DERIVED from the panel
 * rather than chosen, which is why it can be used without waiting on anyone.
 */
export function crossTiltMinimumLowHeightIn(pitchIn12: number): number {
  const tan = pitchIn12 / 12;
  const cos = 12 / Math.hypot(12, pitchIn12);
  const stock = crossTiltTopPlateStock(pitchIn12);
  const thinEdgeIn = Math.max(0, stock.thicknessIn - PLATE_2X4_WIDTH_IN * tan);
  return (
    SKIN_THICKNESS_IN +
    PLATE_2X4_THICKNESS_IN +
    /* ⚠ **A REAL STUD, which is the 2026-11-01 decision.** This read the
       stack with NO stud until then, so the row came out at 3 1/2in and the
       exterior wythe had about 1/8in of clear space — not a stud, and the
       roof's load reached the wall's outer wythe through plates and skins
       rather than through framing. */
    CROSS_TILT_MIN_STUD_IN +
    thinEdgeIn +
    SKIN_THICKNESS_IN / cos
  );
}

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
  /**
   * ⚠ **The rip taken off one edge of each top plate**, so the shop sheet can
   * state the cut rather than leaving a fabricator to work it out.
   *
   * > *"Both 2x4s on top plate have an edge ripped off of them (that cut
   * > should be specced out in the shop fab pages)."* — Tommy, 2026-11-01
   */
  topPlateRip: {
    /** The stock it is cut from: a 2x4 until the rip outgrows one, then a 4x4. */
    nominalSize: "2x4" | "4x4";
    /** What is left at the THIN edge, after the rip. */
    thinEdgeIn: number;
    /** The full 1 1/2in, at the thick edge. */
    thickEdgeIn: number;
    /** How much comes off, measured at the thin edge. */
    removedIn: number;
    /** The angle of the rip, off the board's own face. */
    angleDeg: number;
  };
  refusal: string | null;
}

export function buildCrossTiltPanelMembers(options: CrossTiltPanelOptions): CrossTiltPanelResult {
  const { widthIn, depthIn, lowHeightIn, pitchIn12 } = options;
  const empty = {
    members: [],
    highHeightIn: 0,
    tiltDeg: 0,
    topPlateRip: { nominalSize: "2x4" as const, thinEdgeIn: 0, thickEdgeIn: 0, removedIn: 0, angleDeg: 0 },
  };

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
  const sin = pitchIn12 / Math.hypot(12, pitchIn12);
  const riseIn = depthIn * tan;
  const highHeightIn = lowHeightIn + riseIn;
  const tiltDeg = (Math.atan2(riseIn, depthIn) * 180) / Math.PI;

  /**
   * ⚠ **THE RIP, and the pitch at which a 2x4 runs out.**
   *
   * A top plate sits FLAT on the studs and carries the incline on its own top
   * face, which means one edge is ripped away: over the board's 3 1/2in the
   * roof climbs `3.5 x tan`, and that much comes off a 1 1/2in board. At 4:12
   * it leaves 1/3in at the thin edge. Past about 5.1:12 it leaves nothing at
   * all, and the plate wants to be a 2x6 — which is a decision, so this
   * refuses rather than emitting a board of negative thickness.
   */
  const plateStock = crossTiltTopPlateStock(pitchIn12);
  const plateThicknessIn = plateStock.thicknessIn;
  const ripRemovedIn = PLATE_2X4_WIDTH_IN * tan;
  const thinEdgeIn = plateThicknessIn - ripRemovedIn;
  if (!(thinEdgeIn > 0)) {
    return {
      ...empty,
      refusal: `At ${pitchIn12}:12 the rip across a top plate's own ${PLATE_2X4_WIDTH_IN}in takes ${ripRemovedIn.toFixed(2)}in, which is more than even a ${plateStock.nominalSize}'s ${plateThicknessIn}in. Past 12:12 this detail needs a different plate, and which one is a decision nobody has made.`,
    };
  }
  const topPlateRip = {
    nominalSize: plateStock.nominalSize,
    thinEdgeIn,
    thickEdgeIn: plateThicknessIn,
    removedIn: ripRemovedIn,
    angleDeg: tiltDeg,
  };

  /* ⚠ Refuse a panel too short to hold its own layers, rather than building
     one whose plates run into each other. See
     `crossTiltMinimumLowHeightIn` — and note this is what the five pinned
     interferences of B8 were. */
  const minimumLowHeightIn = crossTiltMinimumLowHeightIn(pitchIn12);
  if (lowHeightIn < minimumLowHeightIn - 1e-9) {
    return {
      ...empty,
      refusal: `A ${lowHeightIn.toFixed(2)}in exterior face cannot hold this panel's own layers at ${pitchIn12}:12: the bottom skin, the bottom plate, the ${thinEdgeIn.toFixed(2)}in the top plate's rip leaves and the top skin come to ${minimumLowHeightIn.toFixed(2)}in. Build it at least that tall.`,
    };
  }

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

  /**
   * ⚠ **STUDS IN TWO ROWS, EACH ROW LEVEL-TOPPED — the plate carries the
   * incline, not the stud.**
   *
   * They used to be ripped to the incline themselves, each one a sloping
   * section across its own 3 1/2in. That is not how the panel is built:
   * *"Both 2x4s on top plate have an edge ripped off of them"* (Tommy,
   * 2026-11-01, with SketchUp screenshots). The plate sits FLAT on the studs
   * and takes the whole slope in its own rip, so every stud in a row is one
   * plain square-cut length — which is also what the shop would rather cut.
   *
   * ⚠ **It is what makes this panel buildable at all.** With the slope in the
   * studs, the exterior face had to hold `0.75 + 1.5` of bottom stack and a
   * full `2.25 / cos` of top assembly — 4.62in at 4:12 — against a 3 1/2in
   * low height, so the exterior stud had no room and the two plates ran into
   * each other: five real interferences, pinned in `memberOverlap.test.ts`.
   * With the rip in the plate the exterior face needs only
   * `0.75 + 1.5 + thinEdge + skin/cos`, which is 3.37in at 4:12 and fits.
   */
  const bottomZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const studXs: number[] = [0, widthIn - PLATE_2X4_THICKNESS_IN];
  const bays = Math.max(1, Math.ceil((widthIn - PLATE_2X4_THICKNESS_IN) / CROSS_TILT_STUD_SPACING_IN));
  for (let i = 1; i < bays; i++) {
    studXs.push((i * (widthIn - PLATE_2X4_THICKNESS_IN)) / bays);
  }
  studXs.sort((a, b) => a - b);

  /** The underside of a row's top plate: level, set by the plate's THICK
   * edge, which is the deeper (higher) of its two. */
  const plateBottomZIn = (y1In: number) => belowTopAtYIn(y1In, SKIN_THICKNESS_IN) - plateThicknessIn;

  for (const [face, y0In] of [
    ["exterior", 0],
    ["interior", depthIn - PLATE_2X4_WIDTH_IN],
  ] as [string, number][]) {
    const y1In = y0In + PLATE_2X4_WIDTH_IN;
    const studLengthIn = plateBottomZIn(y1In) - bottomZIn;
    /* ⚠ No stud where the panel leaves no room for one — the same guard a
       gable's corner studs carry. At the app's own 3 1/2in low height the
       exterior row comes out about 1/8in, which is not a stud; it is the row
       telling you the panel is as short as it can be. Drawing a sliver, or a
       stud of negative length, would be worse than drawing none. */
    if (!(studLengthIn > PLATE_2X4_THICKNESS_IN)) continue;
    for (const [index, xIn] of studXs.entries()) {
      members.push({
        memberId: `cross_tilt_stud_${face}_${index}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: {
          thicknessIn: PLATE_2X4_THICKNESS_IN,
          widthIn: PLATE_2X4_WIDTH_IN,
          lengthIn: studLengthIn,
        },
        orientation: "vertical",
        position: { xIn, yIn: y0In, zIn: bottomZIn, rotationDeg: 0 },
        role: "stud",
        qty: 1,
        notes:
          index === 0
            ? `${face} row — square cut both ends, all ${studXs.length} the same length; the incline is taken by the plate above, not by this stud`
            : undefined,
      });
    }
  }

  /* ⚠ **THE TOP PLATES: FLAT ON THE STUDS, WITH ONE EDGE RIPPED OFF.**

     They used to be slabs lying IN the incline — a whole 2x4 tilted, bottom
     face and all. His 2026-11-01 note and screenshots say otherwise: *"Both
     2x4s on top plate have an edge ripped off of them."* So the board sits
     flat, its underside level on the studs, and the roof's slope is cut into
     its top face. The thin edge faces OUT, because the roof climbs inward. */
  for (const [face, y0In] of [
    ["exterior", 0],
    ["interior", depthIn - PLATE_2X4_WIDTH_IN],
  ] as [string, number][]) {
    const y1In = y0In + PLATE_2X4_WIDTH_IN;
    const bottomOfPlateZIn = plateBottomZIn(y1In);
    members.push({
      memberId: `cross_tilt_top_plate_${face}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: plateStock.nominalSize,
      /* Dimensioned at the THICK edge, which is the stock it is cut from and
         the number a shop sets a saw to. */
      actualDimsIn: { thicknessIn: plateThicknessIn, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: widthIn },
      orientation: "flat",
      position: {
        xIn: 0,
        yIn: y0In,
        zIn: bottomOfPlateZIn,
        rotationDeg: 0,
        sectionCornersIn: [
          { yIn: y0In, zIn: bottomOfPlateZIn },
          { yIn: y1In, zIn: bottomOfPlateZIn },
          { yIn: y1In, zIn: belowTopAtYIn(y1In, SKIN_THICKNESS_IN) },
          { yIn: y0In, zIn: belowTopAtYIn(y0In, SKIN_THICKNESS_IN) },
        ],
      },
      role: "plate",
      qty: 1,
      notes: `${face}-wythe edge — a ${plateStock.nominalSize} lying FLAT on the studs; rip ${ripRemovedIn.toFixed(3)}in off one edge at ${tiltDeg.toFixed(2)}deg so the top face carries the roof's slope, leaving ${thinEdgeIn.toFixed(3)}in at the outer (thin) edge and the full ${plateThicknessIn}in at the inner one. Square cut both ends.`,
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
    /* ⚠ **CUT SQUARE, NOT BEVELLED**, and the drawing says what that costs.
       > *"Plywood should just be cut perpendicular on these with a note in
       > the shop drawing saying to be ~1/4\" bottom plate piece is proud of
       > the plywood."* — Tommy, 2026-11-01
       A 3/4in sheet lying at the roof's angle, cut square to its own faces
       rather than plumb, leaves its lower corner set back by
       `thickness x sin` along the slope. That is 0.237in at 4:12 — his
       "~1/4in" — and it is the plate below standing proud of the sheet. The
       number is printed from the real pitch rather than as a flat 1/4in. */
    notes: `the one inclined surface — cut ${(depthIn / cos).toFixed(3)}in across, not the panel's ${depthIn}in depth. Cut the edges SQUARE (perpendicular to the sheet), not bevelled: the plate below finishes about ${(SKIN_THICKNESS_IN * sin).toFixed(3)}in proud of the plywood, which is expected.`,
  });

  return { members, highHeightIn, tiltDeg, topPlateRip, refusal: null };
}
