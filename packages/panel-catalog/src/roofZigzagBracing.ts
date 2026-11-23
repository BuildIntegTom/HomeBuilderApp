import { PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN } from "./panelMemberHelpers";
import { ANTI_TWIST_SPACING_IN, ANTI_TWIST_WEB_THICKNESS_IN } from "./floorRoofPanelMembers";
import type { RoofBracePiece } from "./roofBraceMembers";

/**
 * ⚠ **THE ZIGZAG — one continuous Warren chain between a roof panel's two
 * joists, with the OSB girts kept and turned into its bay boundaries.**
 *
 * > *"Can we do both the zig zag and OSB girts every 5' or less? I feel like
 * > we gotta have the OSB plate girts. Why get rid of the girts?"*
 * > — Tommy, 2026-11-22
 *
 * He was right to push back. An exterior-only diagonal ties the exterior
 * joist chord and nothing else; the girt's OSB web runs the panel's WHOLE
 * depth, so it is the only thing in the panel restraining both chords
 * against roll, and it resists racking in a plane the zigzag cannot reach.
 * Economy was the weaker argument and the girts stay.
 *
 * ## Why this replaces the plane-wide X and its carrots
 *
 * ⚠ **A 24in panel has 21in of clear width, and that one number decides
 * everything.** A diagonal inside his 30-45deg band climbs `21 * tan(angle)`
 * of span per traverse — **12 to 21in, no more**. A figure laid across the
 * WHOLE plane escapes that by being shallow over a long run, and pays for it
 * three times over: every panel's slice sits at a different height so no two
 * panels are the same part (a 48ft plane was 25 distinct parts), the boards
 * cross the girts, and the snap that put every joint on a seam spent the
 * angles (10 of 20 members outside the band on a 24ft plane, up to 63.9deg).
 *
 * The zigzag stops fighting the panel's proportions and makes the traverse
 * the module. Every piece is the same parallelogram, every field panel is
 * the same part, and nothing crosses anything.
 *
 * ## The odd traverse count is the whole trick
 *
 * ⚠ **A bay carries an ODD number of traverses, so its chain enters at one
 * corner and leaves at the DIAGONALLY OPPOSITE one.** That is what keeps a
 * diagonal off a girt: the only place a board meets a girt's line is at a
 * joist corner, where the girt's own end already is, so every girt's middle
 * stays clear across its full width. An even count would return the chain to
 * the side it started on and force a board to die into the girt mid-span.
 *
 * It also makes each girt end a THREE-WAY node — girt, diagonal and joist
 * meeting at one point — which is the best screwing opportunity in the
 * panel, and the reason the figure can carry tension at all. A butted end
 * bearing on a joist takes compression and nothing else; two members meeting
 * at a node can be toe-screwed into the joist's SIDE grain, which the NDS
 * rates, unlike the end grain a lone butt would need.
 *
 * ## Equal bays, not a datum stride
 *
 * ⚠ **The girts divide the clear band into EQUAL bays rather than marching
 * from a datum at `ANTI_TWIST_SPACING_IN`** (Tommy, 2026-11-22: *"Equal bays
 * sounds great"*). His rule is a MAXIMUM, so equal bays under it still obey
 * it. What it buys is that every bay is the same height, so every piece in
 * the panel is the same piece; a datum stride leaves a short ragged tail bay
 * whose diagonal lands outside the angle band entirely.
 *
 * ⚠ **IT ALSO TAKES GIRTS OUT, which this comment first claimed it would
 * not.** Measured across the Home templates the count falls by 5-29%: the
 * Multiplex 108 -> 72, the Square Courtyard 168 -> 120, the Tank 100 -> 96.
 * Two causes, both real. The stride ran over the panel's whole span and could
 * fit one more station than equal bays inside the braced region do; and the
 * dodge used to ADD girts, because re-datuming from a girt that had moved
 * back left room for another before the far lid. Fewer girts is a saving, not
 * a loss of his rule — `noRoofGirtGapExceedsTheMaximum` in the tests is what
 * holds the rule, by measuring every gap on every panel rather than trusting
 * the spacing it was placed at.
 */
export const ROOF_ZIGZAG_MIN_ANGLE_DEG = 30;
export const ROOF_ZIGZAG_MAX_ANGLE_DEG = 45;

/** His own *"every 5' or less"*, as a MAXIMUM bay rather than a stride. */
export const ROOF_ZIGZAG_MAX_BAY_IN = ANTI_TWIST_SPACING_IN;

/** An anti-twist girt's own thickness along the span: OSB web plus one 2x4. */
export const ROOF_ZIGZAG_GIRT_THICKNESS_IN = ANTI_TWIST_WEB_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;

/**
 * The most traverses a bay may be cut into before the planner gives up. At
 * the 30deg end of his band a 12.5in-wide edge panel needs 9 in a 60in bay,
 * so this is slack rather than a constraint.
 */
const MAX_TRAVERSES_PER_BAY = 21;

export interface RoofZigzagInput {
  /** The joists' inner faces — the clear width a board really spans. */
  clearXFromIn: number;
  clearXToIn: number;
  /** The clear band on the panel's exterior face, from
   *  `roofBraceTopFaceClearZIn`. */
  regionFromIn: number;
  regionToIn: number;
  /** Bay maximum; defaults to his 5ft. */
  maxBayIn?: number;
  /** A girt's thickness along the span. */
  girtThicknessIn?: number;
  /**
   * ⚠ Which joist the chain's first traverse LEAVES. Panels alternate it
   * along a run so neighbouring panels mirror rather than repeat, which keeps
   * a plane's diagonals from all leaning the same way.
   */
  startAtFarJoist?: boolean;
}

export interface RoofZigzagPlan {
  /** Ready for `buildRoofBraceMembers` — x across the panel, y from the
   *  region's eave end. */
  pieces: RoofBracePiece[];
  /** Each girt's NEAR face in the panel's own span, which is exactly what
   *  `girtStationsIn` on `FloorRoofPanelOptions` wants. */
  girtStationsIn: number[];
  bayCount: number;
  bayHeightIn: number;
  traversesPerBay: number;
  /** How far the chain is held off each bay's two ends so a board's CORNERS
   *  clear the girts — `(boardWidth/2) / cos(angle)`. */
  insetIn: number;
  /** The one angle off the eave every piece in the panel sits at. */
  angleDeg: number;
  /** How far two boards at a node are pulled apart along the joist so their
   *  corners touch rather than overlap — a full end face, `width/cos(angle)`. */
  stepIn: number;
  /** 0 when the angle is inside his 30-45 band; otherwise how far outside, in
   *  degrees. A MISS IS REPORTED, never refused — his *"where possible"*. */
  bandMissDeg: number;
  /** In words, never an empty list standing in for "nothing to say". */
  refusal: string | null;
}

const nothing = (refusal: string): RoofZigzagPlan => ({
  pieces: [],
  girtStationsIn: [],
  bayCount: 0,
  bayHeightIn: 0,
  traversesPerBay: 0,
  insetIn: 0,
  angleDeg: 0,
  stepIn: 0,
  bandMissDeg: 0,
  refusal,
});

/**
 * Lay the chain in one roof panel.
 *
 * ⚠ **IT IS PER PANEL, and that is the departure from everything before it.**
 * The X and its carrots were per RUN because a leg crossed panel seams and no
 * panel could work out its own boards. Nothing in the zigzag crosses a seam,
 * so a panel needs only its own clear band and its own clear width — which is
 * what collapses a 48ft plane from 25 distinct parts to the two or three its
 * widths really give.
 */
export function planRoofZigzag(input: RoofZigzagInput): RoofZigzagPlan {
  const {
    clearXFromIn,
    clearXToIn,
    regionFromIn,
    regionToIn,
    maxBayIn = ROOF_ZIGZAG_MAX_BAY_IN,
    girtThicknessIn = ROOF_ZIGZAG_GIRT_THICKNESS_IN,
    startAtFarJoist = false,
  } = input;

  const clearWidthIn = clearXToIn - clearXFromIn;
  const bandIn = regionToIn - regionFromIn;

  if (!(clearWidthIn > 0)) {
    return nothing(
      "⚠ This roof panel is NOT braced. Its joists leave no clear width between them, so there is nowhere for a diagonal to run.",
    );
  }
  if (!(bandIn > 0)) {
    return nothing(
      "⚠ This roof panel is NOT braced. Its end lids leave no clear band on the exterior face, so there is nothing to lay a figure on.",
    );
  }

  const bayCount = Math.max(1, Math.ceil(bandIn / maxBayIn));
  const girtCount = bayCount - 1;
  const bayHeightIn = (bandIn - girtCount * girtThicknessIn) / bayCount;

  if (!(bayHeightIn > 0)) {
    return nothing(
      `⚠ This roof panel is NOT braced. Dividing its ${bandIn.toFixed(2)}in clear band into ${bayCount} bays under ${maxBayIn}in leaves no room between the ${girtCount} girts.`,
    );
  }

  /* ⚠ **A BOARD'S CORNER REACHES PAST ITS OWN ENDPOINT, and that governs
     BOTH ends of a bay AND every joint in between.**

     A piece is centred on its line and `PLATE_2X4_WIDTH_IN` across it, so at
     each end its corners run `(width/2) / cos(angle)` further along the span
     than the centreline does — call that the half reach, about 2.2in at 36deg.

     ⚠ **TOMMY'S RULE, 2026-11-22:** *"every diagonal piece is mitered to be a
     flush cut with the joist - and if another diagonal is a node with it, the
     edge/tip of one should meet the edge/tip of the other - varying distances
     depending on angle."* So both ends stay flush cuts on the joist faces —
     the parallelogram, one jig setting, the carrot panel's own part — and the
     two boards at a node are pulled apart along the joist until their CORNERS
     just touch. That separation is a full end face, `width / cos(angle)`, and
     it really does vary with the angle exactly as he says.

     The chain therefore advances by a rise AND a step at every node, which is
     what makes this a fixed point: the step depends on the angle, the angle
     on the rise, and the rise on the step. Solved per candidate n below. */
  const halfReachAt = (deg: number) => PLATE_2X4_WIDTH_IN / 2 / Math.cos((deg * Math.PI) / 180);

  /**
   * For n traverses in a bay: a half reach of lead-in, then n rises with a
   * full end face of step between consecutive ones, then a half reach of
   * lead-out. That makes `rise = bayHeight / n - 2 * halfReach`.
   */
  const settle = (n: number): { halfReachIn: number; riseIn: number; deg: number } | null => {
    let halfReachIn = 0;
    for (let k = 0; k < 80; k++) {
      const riseIn = bayHeightIn / n - 2 * halfReachIn;
      if (riseIn <= 0) return null;
      const deg = (Math.atan(riseIn / clearWidthIn) * 180) / Math.PI;
      const next = halfReachAt(deg);
      if (Math.abs(next - halfReachIn) < 1e-14) {
        halfReachIn = next;
        break;
      }
      halfReachIn = next;
    }
    const riseIn = bayHeightIn / n - 2 * halfReachIn;
    if (riseIn <= 0) return null;
    return { halfReachIn, riseIn, deg: (Math.atan(riseIn / clearWidthIn) * 180) / Math.PI };
  };

  /* ⚠ **THE BAND IS A PREFERENCE, NOT A GATE** — his *"where possible"*. The
     smallest odd count inside it wins; if none is, the closest one is taken
     and the miss is REPORTED rather than the panel refused. On a 24in field
     panel his corner-to-corner rule puts three traverses at 28.3deg, 1.7deg
     under the band, and he chose that over doubling the girts to chase it
     (2026-11-22). Shallower is also the efficient side for a diaphragm: a
     flatter diagonal puts more of its axial force along the plane. */
  let traversesPerBay = 0;
  let angleDeg = 0;
  let insetIn = 0;
  let riseIn = 0;
  let bandMissDeg = 0;
  let bestMiss = Number.POSITIVE_INFINITY;

  for (let n = 1; n <= MAX_TRAVERSES_PER_BAY; n += 2) {
    const got = settle(n);
    if (got === null) continue;
    const miss =
      got.deg > ROOF_ZIGZAG_MAX_ANGLE_DEG
        ? got.deg - ROOF_ZIGZAG_MAX_ANGLE_DEG
        : got.deg < ROOF_ZIGZAG_MIN_ANGLE_DEG
          ? ROOF_ZIGZAG_MIN_ANGLE_DEG - got.deg
          : 0;
    if (miss === 0) {
      traversesPerBay = n;
      angleDeg = got.deg;
      insetIn = got.halfReachIn;
      riseIn = got.riseIn;
      bandMissDeg = 0;
      break;
    }
    if (miss < bestMiss) {
      bestMiss = miss;
      traversesPerBay = n;
      angleDeg = got.deg;
      insetIn = got.halfReachIn;
      riseIn = got.riseIn;
      bandMissDeg = miss;
    }
  }

  if (traversesPerBay === 0) {
    return nothing(
      `⚠ This roof panel is NOT braced. No odd number of traverses leaves any rise at all across its ${clearWidthIn.toFixed(2)}in clear width in a ${bayHeightIn.toFixed(2)}in bay — the end faces alone fill the bay.`,
    );
  }

  const pitchIn = bayHeightIn + girtThicknessIn;
  const girtStationsIn: number[] = [];
  for (let b = 0; b < girtCount; b++) {
    girtStationsIn.push(regionFromIn + b * pitchIn + bayHeightIn);
  }

  const stepIn = 2 * insetIn;
  const pieces: RoofBracePiece[] = [];
  let atFarJoist = startAtFarJoist;

  for (let bay = 0; bay < bayCount; bay++) {
    const bayStartIn = bay * pitchIn;
    for (let t = 0; t < traversesPerBay; t++) {
      const fromFar = atFarJoist;
      pieces.push({
        figure: "zigzag",
        bayIndex: bay,
        braceIndex: t,
        pieceIndex: 1,
        pieceCount: 1,
        x1In: fromFar ? clearXToIn : clearXFromIn,
        y1In: bayStartIn + insetIn + t * (riseIn + stepIn),
        x2In: fromFar ? clearXFromIn : clearXToIn,
        y2In: bayStartIn + insetIn + t * (riseIn + stepIn) + riseIn,
      });
      atFarJoist = !atFarJoist;
    }
    /* ⚠ No flip between bays, deliberately: an ODD traverse count has already
       left the chain on the opposite joist, so the next bay simply carries on
       from where this one finished. That continuity is the whole reason the
       count is odd. */
  }

  return {
    pieces,
    girtStationsIn,
    bayCount,
    bayHeightIn,
    traversesPerBay,
    insetIn,
    angleDeg,
    stepIn,
    bandMissDeg,
    refusal: null,
  };
}
