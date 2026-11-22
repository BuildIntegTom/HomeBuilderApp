/**
 * ROOF BRACING, PHASE 3 STRIDE 4 — the figure as real boards in a real panel.
 *
 * Strides 1–3 drew the plane's figure, cut it at the panel seams and snapped
 * its joints onto them. All of that is lines on a plane. This turns each
 * piece into a `PanelMember`, which is what the 3D view, the shop sheet, the
 * cut list, the OBJ export and the price all read.
 *
 * > *"4 diagonals per roof panel on just the exterior face"* — Tommy. **The
 * > exterior face of a roof panel is its TOP**, the weather side, so a brace
 * > lives in the outermost 1 1/2in of the panel's depth and the roof's
 * > sheathing lies flat over both it and the joists.
 *
 * ⚠ **A 2x4 LYING FLAT, which is `orientation: "diagonal"` with
 * `rotationDeg: 90`** — the same shape a wall's brace takes (see
 * `bracedPanelMembers.ts`) and the same reason: 1 1/2in through the depth, 3
 * 1/2in of face in the panel's own plane. `memberBoxSizeIn` reads that pair
 * as `{xIn: 3.5, yIn: 1.5, zIn: length}`, and for a diagonal the position is
 * the member's CENTRE rather than its min corner.
 *
 * ⚠ **BOTH ENDS ARE CUT ON A PLANE OF CONSTANT X, so a roof brace is a
 * PARALLELOGRAM, not the trapezoid a wall brace is.** A wall brace is cut
 * plumb at one end and level at the other, which is why
 * `computeBraceTrapezoidCornersIn` takes a `plumbXIn` and a `levelZIn`. A
 * roof brace piece stops where its panel stops — at the panel's own side
 * face, a plane of constant x — at BOTH ends. Both cuts are therefore
 * parallel, both at the brace's own angle off the eave, and the two long
 * edges come out exactly the same length. `roofBraceBoardCornersIn` builds
 * it; nothing in `panelMemberHelpers.ts` could, and bending the trapezoid
 * helper to a second cut geometry would have made its two target arguments
 * mean different things to different callers.
 *
 * ⚠ **THE FIGURE SITS BETWEEN THE LIDS, NOT ACROSS THEM.** A panel's two end
 * lids are 2 1/4in of skin plus 2x4s at each end of the span, and they
 * occupy the same outermost depth the brace does. So the braced region is
 * the clear span between them and the caller builds the plane figure on
 * THAT slope — the brace then bears on a lid's inner face at each end,
 * exactly as a wall brace bears on the inner face of its plate.
 *
 * ⚠ **WHAT STILL OVERLAPS, AND WHY IT IS LEFT TO THE REVIEW LOG.** A board of
 * real width centred on a line that ends at the region's floor reaches past
 * that line by `halfWidth / cos(angle)`, so the end pieces bite into the lid;
 * a diagonal also crosses the two top joist chords at its ends and any
 * anti-twist girt in its way. His standing answer covers exactly this, given
 * when the ring girts were generalised (`cutRingGirtsAroundVerticals`):
 * *"As long as the review log says when things are overlapping, I think it's
 * fine for now."* A brace is not *"perfectly vertical"*, so it is not cut
 * around and nothing is cut around it. This module MEASURES the bite rather
 * than hiding it — see `RoofBraceMemberPlan.lidBiteIn`.
 */

import type { PanelMember, PanelSpacePoint2D } from "./componentSchema";
import { memberAabbIn } from "./memberPrism";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
} from "./panelMemberHelpers";

/**
 * How far the figure is held back from the clear region's eave and ridge
 * ends, so a board centred on a line that ends there still lands inside the
 * panel.
 *
 * ⚠ **IT IS THE BOARD'S OWN WIDTH, AND THAT IS A BOUND RATHER THAN A
 * MEASUREMENT.** A board of width `w` centred on a line at `θ` off the eave
 * reaches `w/2 / cos θ` past its own endpoint in z — 2.22in at 38deg, 2.47in
 * at 45deg. A full board width covers every member up to **60deg** off the
 * eave (`1.75 / cos 60 = 3.5`), which is well past the 45deg ceiling of
 * Tommy's own band, so a figure inside his band is always contained. Steeper
 * than that it is not, and `buildRoofBraceMembers` reports the overshoot
 * instead of clamping it — the 24ft plane's snapped figure contains a 63.9deg
 * member and bites 0.48in deeper than this.
 *
 * ⚠ **Not a building value and not his number**: it is this geometry's own
 * containment bound, stated with the angle it holds to.
 */
export const ROOF_BRACE_END_CLEARANCE_IN = PLATE_2X4_WIDTH_IN;

/** The angle, in degrees, up to which `ROOF_BRACE_END_CLEARANCE_IN` contains
 * a board centred on a line ending at the region's edge. */
export const ROOF_BRACE_CONTAINED_TO_DEG = 60;

/**
 * The clear band along a roof panel's span, on its exterior (top) face,
 * between whatever caps its two ends.
 *
 * ⚠ **DERIVED FROM THE PANEL'S OWN MEMBERS, never from the pitch arithmetic
 * a second time.** At 4:12 on a 15 1/2in panel the top face stops about 7in
 * short of the span at the plumb end and runs the full way at the eave — the
 * eave's cut takes material from BELOW, so there is nothing up here to stop
 * at. Rederiving that from the pitch would be a third copy of the plumb-end
 * geometry, and `roofTopAboveRooflineIn`'s own history is what that costs.
 *
 * ⚠ **AN END CAP IS A MEMBER THAT TOUCHES A SPAN END; a joist is not one even
 * though it runs to both.** The test is the x band: the brace lives between
 * the two joists, so a member confined to a joist's own 1 1/2in is outside
 * the band and cannot cap anything. That is what keeps the two 2x6 chords —
 * which do run the whole span in this very depth slice — from being read as
 * caps and collapsing the band to nothing.
 *
 * ⚠ The band is CONSERVATIVE at a cap whose face is not square: a plumb end
 * lid's own extent spans the panel's full depth, so taking its near face
 * stops the figure where the lid starts at the BOTTOM of the slice rather
 * than at the top. The brace stops a little short of where it could reach,
 * which is the safe direction.
 */
export function roofBraceTopFaceClearZIn(
  members: readonly PanelMember[],
  panelDepthIn: number,
  panelSpanIn: number,
  clearXFromIn: number,
  clearXToIn: number,
  boardThicknessIn: number = PLATE_2X4_THICKNESS_IN,
): { fromIn: number; toIn: number } {
  const sliceFromIn = panelDepthIn - boardThicknessIn;
  const tolerance = 1e-6;
  const overlaps = (aFrom: number, aTo: number, bFrom: number, bTo: number) =>
    Math.min(aTo, bTo) - Math.max(aFrom, bFrom) > tolerance;

  let fromIn = 0;
  let toIn = panelSpanIn;
  for (const member of members) {
    const box = memberAabbIn(member);
    if (!overlaps(box.y0, box.y1, sliceFromIn, panelDepthIn)) continue;
    if (!overlaps(box.x0, box.x1, clearXFromIn, clearXToIn)) continue;
    if (box.z0 <= tolerance) fromIn = Math.max(fromIn, box.z1);
    if (box.z1 >= panelSpanIn - tolerance) toIn = Math.min(toIn, box.z0);
  }
  return { fromIn, toIn };
}

/**
 * One piece of the plane's bracing, already made panel-local by the caller.
 *
 * ⚠ **`xIn` is measured from the PANEL's own near edge and `yIn` from the
 * BRACED REGION's eave end** — two different origins, and keeping them
 * distinct is the point. The slicer works in plane coordinates, where x runs
 * the length of the whole roof deck; a panel's member space starts at that
 * panel's own edge. Subtracting the band's position is the caller's one job,
 * and `roofBracePieceFromSlice` does it so no caller does it by hand.
 */
export interface RoofBracePiece {
  /** Which part of the figure this came from. */
  figure: "x" | "carrot";
  /** Which bay of the plane, for the note. */
  bayIndex: number;
  /** The parent brace's index within the plane's figure, for the note. */
  braceIndex: number;
  /** This piece's place along its parent, 1-based. */
  pieceIndex: number;
  pieceCount: number;
  x1In: number;
  y1In: number;
  x2In: number;
  y2In: number;
}

export interface RoofBraceMemberPlan {
  members: PanelMember[];
  /** The lowest and highest z any board reaches, boards' corners included. */
  zFromIn: number;
  zToIn: number;
  /**
   * How far the worst board reaches into an end lid, in inches — 0 when
   * none does.
   *
   * ⚠ **A MEASUREMENT, NOT A LIMIT.** It is `halfBoardWidth / cos(angle)` at
   * the steepest piece that ends on the region's floor or ceiling: 2.22in at
   * 38deg, 2.47in at 45deg, 3.98in at the 63.9deg member the 24ft plane's
   * snapped figure contains. Nobody has said how a roof brace meets an end
   * lid, so this reports the number and leaves it to the Review Log under
   * his standing rule for a brace crossing another member.
   */
  lidBiteIn: number;
  /** True when no board reaches outside the panel's own span. */
  withinPanelSpan: boolean;
  /**
   * The most any one piece lost to the joists, in inches — its two end trims
   * together. `joistThickness / cos(angle)` at each end, so about 3.8in off a
   * 38deg piece.
   */
  trimmedIn: number;
}

/**
 * A flat board of `boardWidthIn` centred on the line `(x1,z1)–(x2,z2)`, cut
 * at both ends on the plane of constant x through its own endpoints.
 *
 * ⚠ **IT IS A PARALLELOGRAM AND BOTH LONG EDGES ARE EXACTLY THE CENTRELINE'S
 * LENGTH.** Both cuts are parallel, so the shape has no long point and no
 * short point: the figure's own length is the length the shop cuts. That is
 * worth stating because every other brace in this repo has a long point, and
 * a cut list that printed one here would be inventing it.
 *
 * ⚠ The corners come back in perimeter order, as
 * `trapezoidCornersIn` requires — near-low, far-low, far-high, near-high
 * where "low" is the side the perpendicular points away from.
 */
export function roofBraceBoardCornersIn(
  x1In: number,
  z1In: number,
  x2In: number,
  z2In: number,
  boardWidthIn: number,
): [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] {
  const dx = x2In - x1In;
  const dz = z2In - z1In;
  const lengthIn = Math.hypot(dx, dz);
  if (!(lengthIn > 0)) {
    throw new Error(
      `A roof brace piece from (${x1In}, ${z1In}) to (${x2In}, ${z2In}) has no length. A piece with no run cannot be built, and the slicer must not emit one.`,
    );
  }
  if (Math.abs(dx) < 1e-9) {
    throw new Error(
      `A roof brace piece from (${x1In}, ${z1In}) to (${x2In}, ${z2In}) runs straight up the panel, so a cut on a plane of constant x cannot end it. Every member of the plane figure is a diagonal; the caller must not pass a member that is not.`,
    );
  }

  /* Perpendicular to the board, half its width. The sign is arbitrary and
     only has to be consistent: it names which pair of corners is "low". */
  const offXIn = (-dz / lengthIn) * (boardWidthIn / 2);
  const offZIn = (dx / lengthIn) * (boardWidthIn / 2);

  /* Each long edge, shifted along the board's own direction until it crosses
     the cut plane. `t` is that shift as a fraction of the centreline. */
  const cornerOn = (signum: number, atXIn: number): PanelSpacePoint2D => {
    const edgeXIn = x1In + signum * offXIn;
    const edgeZIn = z1In + signum * offZIn;
    const t = (atXIn - edgeXIn) / dx;
    return { xIn: atXIn, zIn: edgeZIn + t * dz };
  };

  return [cornerOn(-1, x1In), cornerOn(-1, x2In), cornerOn(1, x2In), cornerOn(1, x1In)];
}

/**
 * The bevel at a roof brace's end, off a square crosscut, in degrees.
 *
 * ⚠ **IT IS THE BRACE'S OWN ANGLE OFF THE EAVE, and the two are the same
 * number for a reason worth writing down**: a square crosscut runs
 * perpendicular to the board, the cut runs up the panel, and the angle
 * between those two is the angle between the board and the eave. So a 38deg
 * brace is cut at 38deg off square at both ends, and the shop needs one jig
 * setting for the piece rather than two.
 */
export function roofBraceEndBevelDeg(x1In: number, z1In: number, x2In: number, z2In: number): number {
  const dx = Math.abs(x2In - x1In);
  const dz = Math.abs(z2In - z1In);
  return (Math.atan2(dz, dx) * 180) / Math.PI;
}

/**
 * Where a panel's braced region sits inside it — six numbers that used to be
 * six positional arguments.
 *
 * ⚠ **`regionToIn` IS NOT `panelSpanIn - regionFromIn`, and assuming it was
 * is a bug this interface exists to prevent.** The clear band on a roof
 * panel's top face is NOT centred in its span: the eave takes its cut from
 * below so the top face runs the full way, while the plumb end lid stops it
 * about 7in short. Deriving one end from the other reported the ridge-end
 * overshoot against a boundary 7in further out than the real one, and so
 * reported no overshoot at all.
 */
export interface RoofBraceMemberOptions {
  panelDepthIn: number;
  panelSpanIn: number;
  /** Where the braced region's eave end sits in the panel's own span — the
   * z a piece's `y1In = 0` maps to. */
  regionFromIn: number;
  /** Where its ridge end sits. */
  regionToIn: number;
  /** The clear band across the panel's width: the joists' inner faces. */
  clearXFromIn: number;
  clearXToIn: number;
}

/**
 * The brace boards one roof panel carries, from its pieces of the figure.
 */
export function buildRoofBraceMembers(
  pieces: readonly RoofBracePiece[],
  options: RoofBraceMemberOptions,
): RoofBraceMemberPlan {
  const { panelDepthIn, panelSpanIn, regionFromIn, regionToIn, clearXFromIn, clearXToIn } = options;
  if (!(panelDepthIn > PLATE_2X4_THICKNESS_IN)) {
    throw new Error(
      `A roof panel ${panelDepthIn}in deep cannot carry a brace lying flat in its outermost ${PLATE_2X4_THICKNESS_IN}in. The caller must not ask for bracing on a panel shallower than the board.`,
    );
  }

  /* ⚠ The CENTRE of the outermost 1 1/2in slice, because a diagonal's
     position is its centre. A wall brace does the same at its own exterior
     wythe (`PLATE_2X4_THICKNESS_IN / 2`); a roof panel's exterior face is
     the far one in depth, so this is measured back from `panelDepthIn`. */
  const centreYIn = panelDepthIn - PLATE_2X4_THICKNESS_IN / 2;

  const members: PanelMember[] = [];
  let zFromIn = Number.POSITIVE_INFINITY;
  let zToIn = Number.NEGATIVE_INFINITY;

  let trimmedIn = 0;
  for (const piece of pieces) {
    const rawZ1In = piece.y1In + regionFromIn;
    const rawZ2In = piece.y2In + regionFromIn;

    /* ⚠ **THE PIECE STOPS AT THE JOISTS' INNER FACES, NOT AT THE PANEL SEAM,
       and that is a load-path decision rather than a clearance one.**
       Measured before this: every single brace member overlapped BOTH top
       joist chords — not crossing them, buried inside them, since a 2x6 chord
       laid in the top of the panel occupies the very depth slice the brace
       does. Butting the brace into the joist's face instead gives it
       something to bear against, and the joists are what carry the seam from
       one panel to the next anyway. A brace that reached the seam plane would
       end in end grain against the next panel's brace with nothing between
       them. */
    const [x1In, z1In, x2In, z2In] = trimToClearX(
      piece.x1In,
      rawZ1In,
      piece.x2In,
      rawZ2In,
      clearXFromIn,
      clearXToIn,
    );
    trimmedIn = Math.max(
      trimmedIn,
      Math.hypot(piece.x2In - piece.x1In, rawZ2In - rawZ1In) - Math.hypot(x2In - x1In, z2In - z1In),
    );

    const corners = roofBraceBoardCornersIn(x1In, z1In, x2In, z2In, PLATE_2X4_WIDTH_IN);
    const lengthIn = Math.hypot(x2In - x1In, z2In - z1In);
    const bevelDeg = roofBraceEndBevelDeg(x1In, z1In, x2In, z2In);

    /* ⚠ The recorded centre must agree with the corners, or the 3D view, the
       OBJ export and the cut list describe different objects — the lesson
       `makeBrace` in `bracedPanelMembers.ts` writes up at length. Here the
       two anchors ARE the centreline's ends, so their midpoint is the centre
       and the diagonal of the parallelogram agrees with it. */
    const centreXIn = (x1In + x2In) / 2;
    const centreZIn = (z1In + z2In) / 2;
    const tiltDeg = (Math.atan2(-(x1In - centreXIn), z1In - centreZIn) * 180) / Math.PI;

    for (const corner of corners) {
      zFromIn = Math.min(zFromIn, corner.zIn);
      zToIn = Math.max(zToIn, corner.zIn);
    }

    members.push({
      memberId: `roof-brace-${piece.bayIndex}-${piece.figure}-${piece.braceIndex}-${piece.pieceIndex}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: {
        thicknessIn: PLATE_2X4_THICKNESS_IN,
        widthIn: PLATE_2X4_WIDTH_IN,
        lengthIn,
      },
      orientation: "diagonal",
      position: {
        xIn: centreXIn,
        yIn: centreYIn,
        zIn: centreZIn,
        rotationDeg: 90,
        tiltDeg,
        trapezoidCornersIn: corners,
      },
      role: "brace",
      qty: 1,
      notes:
        `roof plane bracing, ${piece.figure === "x" ? "leg of the X" : "carrot"} in bay ${
          piece.bayIndex + 1
        }` +
        (piece.pieceCount > 1 ? `, piece ${piece.pieceIndex} of ${piece.pieceCount}` : "") +
        `. 2x4 laid flat on the panel's exterior (top) face. Both ends cut on the panel's own side face at ${
          Math.round(bevelDeg * 10) / 10
        }deg off square — the brace's own angle off the eave, so one jig setting does both. Both long edges are the full ${
          Math.round(lengthIn * 100) / 100
        }in: parallel cuts leave no long point.`,
    });
  }

  if (members.length === 0) {
    return { members, zFromIn: 0, zToIn: 0, lidBiteIn: 0, withinPanelSpan: true, trimmedIn: 0 };
  }

  const lidBiteIn = Math.max(0, regionFromIn - zFromIn, zToIn - regionToIn);

  return {
    members,
    zFromIn,
    zToIn,
    lidBiteIn,
    withinPanelSpan: zFromIn >= -1e-9 && zToIn <= panelSpanIn + 1e-9,
    trimmedIn,
  };
}

/**
 * One piece's centreline, clipped to the clear x band between the joists.
 *
 * The z at each clip follows the piece's own line, so the trimmed piece lies
 * exactly on the figure — shorter, never moved.
 */
function trimToClearX(
  x1In: number,
  z1In: number,
  x2In: number,
  z2In: number,
  clearFromIn: number,
  clearToIn: number,
): [number, number, number, number] {
  const dx = x2In - x1In;
  const dz = z2In - z1In;
  const zAt = (xIn: number) => z1In + ((xIn - x1In) / dx) * dz;
  const clamp = (xIn: number) => Math.min(Math.max(xIn, clearFromIn), clearToIn);
  const a = clamp(x1In);
  const b = clamp(x2In);
  if (!(Math.abs(b - a) > 1e-9)) {
    throw new Error(
      `A roof brace piece from x=${x1In}in to x=${x2In}in leaves nothing between the joists at x=${clearFromIn}in and x=${clearToIn}in. Every piece spans a whole panel, so the caller has passed a clear band wider than the panel.`,
    );
  }
  return [a, zAt(a), b, zAt(b)];
}

/**
 * The shape this module needs from one of the geometry package's brace
 * slices — structural, so `packages/panel-catalog` stays a leaf.
 *
 * ⚠ **The dependency would run the wrong way and there is no way to add it.**
 * `RoofBraceSlice` lives in `@building-integrity/geometry`, which does not
 * depend on this package and must not; this package does not depend on it
 * either. Naming the three fields it actually reads keeps the one piece of
 * arithmetic that joins them — making a plane coordinate panel-local — in one
 * place instead of in every caller, which is where it would quietly differ.
 */
export interface RoofBraceSliceLike {
  figure: "x" | "carrot";
  bayIndex: number;
  segmentIndex: number;
  panelIndex: number;
  startFraction: number;
  x1In: number;
  y1In: number;
  x2In: number;
  y2In: number;
}

/**
 * One panel's pieces of the plane figure, in that panel's own member space.
 *
 * ⚠ **IT TAKES THE WHOLE PLANE'S SLICES, NOT JUST THIS PANEL'S, because
 * "piece 2 of 3" is a fact about the PARENT brace and not about the panel.**
 * A shop sheet saying "piece 2 of 3" tells the installer another two pieces
 * of the same brace land in the panels either side; counted within one panel
 * it would say "piece 1 of 1" on every one of them and the run would look
 * like a row of unrelated boards.
 */
export function roofBracePiecesForPanel(
  slices: readonly RoofBraceSliceLike[],
  panelIndex: number,
  panelAtIn: number,
): RoofBracePiece[] {
  const byParent = new Map<number, RoofBraceSliceLike[]>();
  for (const slice of slices) {
    const held = byParent.get(slice.segmentIndex);
    if (held === undefined) byParent.set(slice.segmentIndex, [slice]);
    else held.push(slice);
  }
  for (const group of byParent.values()) {
    group.sort((a, b) => a.startFraction - b.startFraction);
  }

  return slices
    .filter((slice) => slice.panelIndex === panelIndex)
    .map((slice) => {
      const siblings = byParent.get(slice.segmentIndex)!;
      return {
        figure: slice.figure,
        bayIndex: slice.bayIndex,
        braceIndex: slice.segmentIndex,
        pieceIndex: siblings.indexOf(slice) + 1,
        pieceCount: siblings.length,
        x1In: slice.x1In - panelAtIn,
        y1In: slice.y1In,
        x2In: slice.x2In - panelAtIn,
        y2In: slice.y2In,
      };
    });
}

/**
 * The bands along a panel's SPAN that its brace boards occupy, for a girt to
 * dodge — see `FloorRoofPanelOptions.avoidGirtZBandsIn`.
 *
 * ⚠ **IT IS THE BOARD'S BOUNDING BAND IN Z, NOT THE LINE IT LIES ON, AND
 * THAT IS NOT CONSERVATISM.** A girt runs the panel's whole width and depth,
 * so it meets a diagonal somewhere along that diagonal's whole z-extent —
 * there is no part of the band a full-width girt could slip through. The
 * bounding box is the exact answer here, not an over-estimate of one.
 *
 * ⚠ Read off the MEMBERS, so it cannot drift from what is really in the
 * panel. Taking it from the figure instead would re-derive the end cuts, the
 * joist trim and the board width a second time, and the second copy would be
 * the one that was wrong.
 */
export function roofBraceGirtAvoidBandsIn(
  braceMembers: readonly PanelMember[],
): (readonly [number, number])[] {
  return braceMembers.map((member) => {
    const box = memberAabbIn(member);
    return [box.z0, box.z1] as const;
  });
}
