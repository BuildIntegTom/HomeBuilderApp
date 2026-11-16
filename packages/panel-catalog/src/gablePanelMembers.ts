import { standardPanelHeightIn } from "./data";
import type { PanelComponentSchema, PanelMember, PanelSpacePoint2D } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  PLATE_END_CLEARANCE_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
  GIRT_WEB_THICKNESS_IN,
  braceLongestEdgeIn,
  LEGACY_GIRT_STYLE,
  buildGirtRows,
  type GirtStyle,
  buildNailer,
  plumbEndedSlopedBoardCornersIn,
  cutRingGirtsAroundVerticals,
  girtRowTopAboveCentreIn,
  centreNailerStudSpansIn,
  MAX_STUD_SPACING_IN,
} from "./panelMemberHelpers";

/**
 * ⚠ **How many girts a gable panel gets, and where — measured off its
 * SHORT edge, not its tall point.**
 *
 * > *"If the shorter height of a stud on a Gable end panel is less than 2',
 * > then no girts are needed. I am seeing a lot of girts/noggings very close
 * > to each other on gable end panels. If the shorter stud length (or really
 * > from bottom of panel to top tip of shorter stud member) is between 2-3',
 * > then one girt should be placed, it's top height flush with the lower
 * > butt corner of that shorter stud. Gable end panels 3'+ should follow the
 * > typical girt rules (one for every 3' or less so that there are no spaces
 * > that are 3' that aren't braced laterally. Whatever the top height of the
 * > pointy tall end of a Gable end panel is is less relevant for this
 * > equation."* — Tommy, 2026-11-01
 *
 * This replaces a flat `GABLE_GIRT_ROW_COUNT = 2` — two rows spread evenly
 * over the short stud whatever its length, which is exactly why he was
 * seeing *"a lot of girts/noggings very close to each other"*: on a tile
 * whose short edge is 10in, two rows land 3in apart.
 *
 * ⚠ **The driver is the SHORT edge and he said so twice** — "the shorter
 * height of a stud", and then "whatever the top height of the pointy tall
 * end ... is less relevant". A gable tile's two edges can differ by feet,
 * and bracing the short side is what the girt is for.
 *
 * ⚠ **The middle band's girt is placed against a real feature, not a
 * fraction**: its TOP (the web's top face, since the web rests on the bars)
 * is flush with the short stud's lower butt corner. Everything above 3ft
 * falls back to the even spread every other panel uses, sized so no unbraced
 * span exceeds 3ft.
 */
export const GABLE_GIRT_NONE_BELOW_IN = 24;
export const GABLE_GIRT_SINGLE_MAX_IN = 36;
/** The standard rule's own ceiling: *"one for every 3' or less so that there
 * are no spaces that are 3' that aren't braced laterally."* */
export const GABLE_GIRT_MAX_UNBRACED_SPAN_IN = 36;

export interface GableGirtPlan {
  rowCount: number;
  /** Non-null only in the 2ft-3ft band, where the one row is placed against
   * the short stud's own top rather than at a fraction of the span. */
  centerZsIn: number[] | null;
}

/**
 * `shortStudSpanIn` is the SHORTER edge's stud span — bottom skin to the top
 * of that stud, which is his *"from bottom of panel to top tip of shorter
 * stud member"* less the bottom skin he measures from.
 */
export interface GableGirtClearance {
  /**
   * The highest z any member of the row may reach — the underside of the
   * sloped top plate at its own LOW end, which is the lowest point of the
   * lowest board above the girt.
   */
  maxRowTopZIn: number;
  /** How far the row's tallest member stands above its centre, per style —
   *  see `girtRowTopAboveCentreIn`. */
  rowTopAboveCentreIn: number;
}

export function gableGirtPlan(shortStudSpanIn: number, clearance?: GableGirtClearance): GableGirtPlan {
  /* His measurement starts at the BOTTOM OF THE PANEL, which is the outside
     of the bottom skin, while the stud starts on top of it. */
  const fromPanelBottomIn = SKIN_THICKNESS_IN + shortStudSpanIn;
  if (!(shortStudSpanIn > 0)) return { rowCount: 0, centerZsIn: null };
  if (fromPanelBottomIn < GABLE_GIRT_NONE_BELOW_IN) return { rowCount: 0, centerZsIn: null };
  if (fromPanelBottomIn <= GABLE_GIRT_SINGLE_MAX_IN) {
    /* ⚠ Solved backwards from the TOP, because that is what he specified. */
    const studTopZIn = SKIN_THICKNESS_IN + shortStudSpanIn;
    /**
     * ⚠ **THE ROW DROPS TO CLEAR THE SLOPED TOP PLATE — his call, 2026-11-14.**
     *
     * Flush with the short stud's butt corner put the row's top exactly where
     * the plate's own low end already is: the plate descends into that same
     * corner, so the two were in the same place for every tile whose short
     * edge is under about 3ft, in BOTH gable orientations and in all three
     * girt styles. The 96in overlap gate never sampled a tile that short.
     *
     * > *"It doesn't necessarily matter where girts are. As long as they are
     * > spaced every 3 ft or less they most certainly can be less to
     * > accommodate space for the top."* — Tommy, 2026-11-14
     *
     * So the flush rule gives way and the spacing rule governs, which costs
     * nothing: one row inside a span of 3ft or less leaves both gaps under
     * 3ft wherever it sits. The drop is the plate's own vertical thickness
     * plus the skin's, measured rather than named, so it follows the pitch.
     *
     * ⚠ The 3ft-and-up branch below needs no clamp and is deliberately not
     * given one: `ceil(span / 36) − 1` rows spread evenly put the topmost row
     * at least 18in below the stud top, against a drop of under 2in at any
     * pitch. A clamp there could only bunch rows for no reason.
     */
    const rowTopZIn = Math.min(studTopZIn, clearance?.maxRowTopZIn ?? Infinity);
    /* A row's top face is its own tallest member's, which the plywood web,
       the 2x6 blocking and the ring each reach differently. Defaults to the
       web — what this app built before girts had styles. */
    const topAboveCentreIn = clearance?.rowTopAboveCentreIn ?? PLATE_2X4_THICKNESS_IN / 2 + GIRT_WEB_THICKNESS_IN;
    const centerZIn = rowTopZIn - topAboveCentreIn;
    /* A row cannot hang below the bottom skin. Below ~2.75in of stud there
       is no room for one at all, and that is already inside the "no girts"
       band — this is a floor, not a second rule. */
    if (centerZIn - PLATE_2X4_THICKNESS_IN / 2 <= SKIN_THICKNESS_IN) return { rowCount: 0, centerZsIn: null };
    return { rowCount: 1, centerZsIn: [centerZIn] };
  }
  /* 3ft and up: the ordinary rule. n rows spread evenly leave n+1 gaps of
     span/(n+1), so the smallest n with every gap at or under 3ft is
     ceil(span / 36) - 1. */
  return { rowCount: Math.max(0, Math.ceil(shortStudSpanIn / GABLE_GIRT_MAX_UNBRACED_SPAN_IN) - 1), centerZsIn: null };
}

/**
 * Rip angle/length for a Gable End Panel's sloped top plate + top skin
 * (Tommy: "the plywood of the top plate should also be called out what
 * angle and length it should be ripped at") — pure trig off the two edge
 * heights, kept independent of the member-geometry builder so a UI can
 * show this callout without building full member geometry first.
 * `leftHeightIn`/`rightHeightIn` are the panel's own real edge heights at
 * local x=0 and x=widthIn respectively — either can be the taller one
 * (see buildGablePanelMembers's own doc comment on why order matters here
 * now). `angleDeg` is signed (positive = rising left-to-right); callers
 * that only want the physical rip magnitude (e.g. a shop-drawing callout,
 * where the cut is the same either way) should take `Math.abs()` of it.
 */
export function computeGableRipCallout(
  widthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
): { angleDeg: number; lengthIn: number } {
  const riseIn = rightHeightIn - leftHeightIn;
  return {
    angleDeg: (Math.atan2(riseIn, widthIn) * 180) / Math.PI,
    lengthIn: Math.hypot(widthIn, riseIn),
  };
}

/**
 * The 4 corner studs, left edge pair + right edge pair.
 *
 * ⚠ **The top is a REAL rake cut now, not a plain box.** It used to be
 * *"angle-cut top simplified to a plain box (not a true bevel)"*, which on a
 * 4:12 roof leaves the stud's flat top crossing the sloped skin above it by
 * half an inch over its own 1 1/2in — one corner buried in the skin and the
 * other hanging under a gap. Tommy, 2026-11-01, with a sketch: *"The corners
 * of the gable end panels are not plumb cut... This applies to any gable or
 * inclined panel."*
 *
 * The two SIDES stay plumb (a stud is vertical) and the TOP follows the
 * underside of the top skin across the stud's own thickness, so the stud and
 * the skin meet on a line instead of crossing. `topUndersideAtXIn` is handed
 * in rather than derived here, so the stud, the plates and the skin are all
 * reading one roofline.
 */
function buildGableCornerStuds(
  widthIn: number,
  depthIn: number,
  leftStudSpanIn: number,
  rightStudSpanIn: number,
  /** The top skin's underside at a panel x AND a panel depth — see
   *  `topUndersideAtIn`. A stud reads it at its own depth, which is what
   *  makes a compound bevel land on the stud instead of over it. */
  topUndersideAtIn: (xIn: number, yIn: number) => number,
  /** Rise of the top plane per inch of depth. 0 on a box. */
  crossSlope: number,
): PanelMember[] {
  const cornerXs: [number, number] = [0, widthIn - PLATE_2X4_THICKNESS_IN]; // [left edge, right edge]
  const cornerYs = [0, depthIn - PLATE_2X4_WIDTH_IN];
  const heights = [leftStudSpanIn, rightStudSpanIn];
  const edgeLabels = ["left", "right"];
  const members: PanelMember[] = [];
  let idx = 0;
  for (const yIn of cornerYs) {
    for (let side = 0; side < 2; side++) {
      idx++;
      /* ⚠ No stud where the panel has no height for one. The ids stay with
         their own corner (idx still advances), so `stud_corner_3` means the
         same corner whether or not its neighbour exists. */
      if (!(heights[side]! > 0)) continue;
      const nearXIn = cornerXs[side]!;
      const farXIn = nearXIn + PLATE_2X4_THICKNESS_IN;
      /* Both top corners, each read off the roofline at its own x — then
         clamped to the bottom plate, because a stud at a triangle's tip can
         have one corner above the bottom skin and the other below it. */
      /* ⚠ **A STUD'S TOP FOLLOWS THE PLANE AND ITS BOTTOM DOES NOT**, which
         is why this reads the two depth faces separately instead of shearing
         the whole board. A uniform shear tipped the bottom too and pushed the
         stud through the bottom skin — see `trapezoidFarCornersIn`. */
      const centreDepthIn = yIn + PLATE_2X4_WIDTH_IN / 2;
      const faceCornersIn = (atDepthIn: number) => {
        const nearTopZIn = Math.max(SKIN_THICKNESS_IN, topUndersideAtIn(nearXIn, atDepthIn));
        const farTopZIn = Math.max(SKIN_THICKNESS_IN, topUndersideAtIn(farXIn, atDepthIn));
        return [
          { xIn: nearXIn, zIn: SKIN_THICKNESS_IN },
          { xIn: farXIn, zIn: SKIN_THICKNESS_IN },
          { xIn: farXIn, zIn: farTopZIn },
          { xIn: nearXIn, zIn: nearTopZIn },
        ] as [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D];
      };
      const cornersIn = faceCornersIn(yIn);
      const farFaceCornersIn = faceCornersIn(yIn + PLATE_2X4_WIDTH_IN);
      /* The long point over BOTH faces — four top corners on a compound cut,
         not two. */
      const longPointIn =
        Math.max(...cornersIn.map((c) => c.zIn), ...farFaceCornersIn.map((c) => c.zIn)) - SKIN_THICKNESS_IN;
      if (!(longPointIn > 0)) continue;
      members.push({
        memberId: `stud_corner_${idx}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        /* ⚠ The LONG POINT, the way every other angle-cut member in this app
           is dimensioned — a shop cuts to the long point and reads the angle
           off the note. */
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: longPointIn },
        orientation: "vertical",
        position: {
          xIn: nearXIn,
          yIn: centreDepthIn,
          zIn: SKIN_THICKNESS_IN,
          rotationDeg: 0,
          trapezoidCornersIn: cornersIn,
          /* A stud stands on its 1 1/2in thickness and runs 3 1/2in through
             the panel — see `trapezoidDepthIn`. */
          trapezoidDepthIn: PLATE_2X4_WIDTH_IN,
          ...(crossSlope !== 0 && { trapezoidFarCornersIn: farFaceCornersIn }),
        },
        role: "stud",
        qty: 1,
        notes:
          `${edgeLabels[side]} edge — bottom is a square cut flush to the bottom plate; top is cut to the roof rake ` +
          `so it lands flush on the underside of the top skin.` +
          (crossSlope === 0
            ? ""
            : ` That top is a COMPOUND cut: also bevel it ` +
              `${((Math.atan(Math.abs(crossSlope)) * 180) / Math.PI).toFixed(2)}deg across the stud's 3 1/2in depth, ` +
              `${(Math.abs(crossSlope) * PLATE_2X4_WIDTH_IN).toFixed(3)}in of fall from one face to the other.`),
      });
    }
  }
  return members;
}

/**
 * Every physical member of a Gable End Panel (Tommy): a Standard Panel
 * core whose top is cut at the roof pitch instead of flat — trapezoidal
 * envelope, not rectangular. The left/right edge heights are supplied
 * directly per instance; no roof/ridge system exists yet to derive them
 * from automatically (see the gable-multistory-roof-strategy memory —
 * that auto-derivation from a roof pitch + bottom-of-truss height is the
 * long-term target).
 *
 * Bottom skin/plates are flat and unchanged from a Standard Panel. The 2
 * edge stud pairs each get their own height with an angle-cut top
 * (simplified to a plain box, not true beveled geometry). The top plate
 * 2x4s and top skin run the full sloped rip length, modeled as tilted
 * ("diagonal") members using the same convention as the Braced Panel's
 * brace.
 *
 * Girt rows and the optional nailer use the SHORTER edge's (more
 * conservative) stud span for vertical spacing/length, whichever end that
 * actually is — a real gable panel's taller-edge side may need additional
 * fill rows, not modeled here. Flag for refinement, same as the Braced
 * Panel's own draft status.
 */
/** A Gable End Panel is a short add-on cap sitting above the wall's own
 * eave line, not a full-height wall panel — Tommy: "gable panels...can be
 * up to 8' tall." `leftHeightIn`/`rightHeightIn` are this panel's own real
 * height at local x=0 and x=widthIn respectively — already relative to the
 * eave line (a caller subtracts the roofline's own base height before
 * calling this), and already relative to true world position (a caller
 * placing this panel at a real wall position must NOT reorder these into
 * "low then high" — a tile whose real roofline descends left-to-right
 * (e.g. one to the right of a single peak) needs `leftHeightIn >
 * rightHeightIn` here, or the built panel ends up mirrored: physically
 * correct in isolation, but facing the wrong way once placed in the real
 * scene). Either can be the taller one — there is no ordering
 * requirement. */
/**
 * ⚠ **SUPERSEDED 2026-11-13: it is the MAIN STORY PANEL HEIGHT, not 8ft.**
 *
 * > *"Also gable end panels I noticed aren't trapezoid above a certain point.
 * > Maybe there's a threshold or I remember putting some setting in the make
 * > them flat…? They should be trapezoid and can be up the height of the main
 * > story panels."* — Tommy, 2026-11-13
 *
 * This was `96` on his earlier *"gable panels…can be up to 8' tall"*, and the
 * 8ft was doing two jobs: a real fabrication ceiling AND the point at which
 * `capGableTileHeights` flattens a tile's top and hands the remainder to a
 * vertical filler. So a gable steeper or wider than 8ft of rise stopped being
 * a trapezoid and became a flat-topped box with a filler above it — which is
 * the *"aren't trapezoid above a certain point"* he is describing.
 *
 * His new figure raises both: a gable panel may be built as tall as a wall
 * panel. Read from `standardPanelHeightIn` rather than written as 120, so the
 * two cannot drift — it is the same number the ground floor's own panels are
 * built at, which is what *"the height of the main story panels"* says.
 *
 * ⚠ It does NOT follow a custom `wallHeightFt`. A project whose walls are set
 * to 12ft still caps its gables at the catalog's standard panel height. That
 * is the narrower reading of his words and the one that needs no new
 * plumbing; if he wants it to track the project's own wall height, this
 * becomes a parameter the caller supplies, the way `girtStyle` already is.
 */
export const GABLE_PANEL_MAX_HEIGHT_IN = standardPanelHeightIn.value;

/**
 * The 8ft ceiling this carried until 2026-11-13, kept only so a loader can
 * recognise a stored project that was pinned at it and raise that project to
 * the new ceiling. Not a limit any more — nothing builds against it.
 */
export const LEGACY_GABLE_PANEL_MAX_HEIGHT_IN = 96;

/** ⚠ The floor, and it is a GEOMETRIC one rather than a fabrication
 * judgement: a Gable End Panel's studs span its height less its two 3/4in
 * skins, so under 1 1/2in they are negative. Not a minimum anyone chose —
 * the smallest height at which the panel this builder makes still exists. */
export const GABLE_PANEL_MIN_HEIGHT_IN = 2 * SKIN_THICKNESS_IN;

/**
 * ⚠ **The buildable test, in ONE place instead of at every call site.**
 *
 * `buildGablePanelMembers` THROWS on a panel whose taller edge cannot carry
 * its own two skins, and that throw lands inside a `useMemo` and takes the
 * page down rather than one panel. The 2026-10-31 crash was fixed in the
 * builder; the 2026-11-13 one survived it *because the clamp lived at a call
 * site*, and on 2026-11-14 a third call site was found the same way — the
 * moment gable windows started being auto-spawned, a window whose head
 * reaches its own roofline leaves a cap of no height, which is a legitimate
 * answer and not an error.
 *
 * So: ask here. `null` means there is genuinely no panel to build. A caller
 * that wants the refusal's REASON still calls the builder directly.
 */
export function buildGablePanelMembersIfBuildable(
  widthIn: number,
  depthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
  includeNailer: boolean,
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
  topCrossRiseIn = 0,
): PanelMember[] | null {
  /* ⚠ The TALLEST CORNER of the top plane, not the taller edge: a compound
     bevel lifts one depth face above the other, so on an octagon facet the
     two numbers differ by the full cross rise. */
  if (gableTallestCornerIn(leftHeightIn, rightHeightIn, topCrossRiseIn) < GABLE_PANEL_MIN_HEIGHT_IN) return null;
  return buildGablePanelMembers(widthIn, depthIn, leftHeightIn, rightHeightIn, includeNailer, girtStyle, topCrossRiseIn);
}

/**
 * The top plane's highest and lowest corner, which is what the fabrication
 * floor and ceiling have to be judged against once the top is a PLANE rather
 * than a line.
 *
 * `leftHeightIn`/`rightHeightIn` are read at the panel's EXTERIOR face
 * (member-space y = 0, the reference face everything in this app measures
 * from), and `topCrossRiseIn` is how much higher the plane stands at the
 * INTERIOR face. Signed: on a 16ft Octagon shed the NE facet's interior face
 * is 3.653in LOWER and the SE facet's is 3.653in higher.
 */
export function gableTallestCornerIn(leftHeightIn: number, rightHeightIn: number, topCrossRiseIn: number): number {
  return Math.max(leftHeightIn, rightHeightIn) + Math.max(0, topCrossRiseIn);
}

export function gableShortestCornerIn(leftHeightIn: number, rightHeightIn: number, topCrossRiseIn: number): number {
  return Math.min(leftHeightIn, rightHeightIn) + Math.min(0, topCrossRiseIn);
}

/**
 * ⚠ **The dip of a gable's top plane, which is the ROOF'S OWN PITCH on every
 * facet — not the rake you see in elevation.**
 *
 * A wall at an angle to the roof's fall splits that fall between its length
 * and its depth: a 16ft Octagon facet at 4:12 rakes 2.83:12 along the wall
 * and falls 2.83:12 across its depth, and `hypot` of the two is 4:12 again.
 * Every thickness-to-vertical conversion in the top assembly has to use THIS
 * angle; using the rake alone is the same class of error as the 2026-10-31
 * perpendicular-vs-vertical bug, and on a diagonal facet it is 7x larger.
 */
export function gableTopPlaneDipRad(rakeSlope: number, crossSlope: number): number {
  return Math.atan(Math.hypot(rakeSlope, crossSlope));
}

export function buildGablePanelMembers(
  widthIn: number,
  depthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
  includeNailer: boolean,
  /** The project's girt style. Defaults to `LEGACY_GIRT_STYLE`, which is what
   * this app built before girts had styles — never to the project default,
   * so an un-taught call site draws a stale panel rather than a wrong one. */
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
  /**
   * ⚠ **THE SECOND BEVEL: how much higher the top plane stands at the
   * panel's INTERIOR face than at its exterior one.** Signed, inches.
   *
   * > *"You're right, it is not flush for the roof at the top, can we make
   * > the top of Gable and dual beveled So that the roof can meet it?"* —
   * > Tommy, 2026-11-16
   *
   * The panel's top has always been a straight rake between
   * `leftHeightIn` and `rightHeightIn`, which is the whole top only where
   * the roof is level across the wall's depth. That is true for every wall
   * of a box and false for most walls of an octagon: measured on the 16ft
   * Octagon shed at 4:12, four of the six facets carrying a gable row
   * needed 3.653in of fall across their 15 1/2in depth and got none, so
   * the roof could not sit on them.
   *
   * Asked how the shop should make the compound top, he chose to **rip the
   * gable's own top** on a compound setting over adding a tapered bevel
   * plate above a square-topped panel. So the top skin, both top plates and
   * every stud under them carry it, and their notes give the second angle
   * and its fall.
   *
   * ⚠ **Defaults to 0, which is byte-identical to every gable this app has
   * ever built** — and 0 is the right answer for a box, not a stand-in for
   * an unknown.
   */
  topCrossRiseIn = 0,
): PanelMember[] {
  /* ⚠ The highest and lowest CORNERS of the top plane. With a cross rise the
     taller EDGE is no longer the panel's tallest point. */
  const tallerHeightIn = gableTallestCornerIn(leftHeightIn, rightHeightIn, topCrossRiseIn);
  /** Rise of the top plane per inch of depth. 0 on a box, and every
   *  `crossSlope !== 0` guard below is what keeps a box byte-identical. */
  const crossSlope = depthIn > 0 ? topCrossRiseIn / depthIn : 0;
  /**
   * ⚠ **A PANEL WITH NO HEIGHT AT ALL IS NOT A PANEL** — but a panel with
   * ONE edge at nothing is a TRIANGLE, and that is an ordinary gable part.
   *
   * > *"We can take little gable end panels all the way to the end."*
   *
   * The first version of this guard refused on the SHORTER edge, and it was
   * wrong in a way that took the whole app down: a gable row ending at a
   * shed's low corner, and the triangular cap above a gable window that
   * reaches its own roofline, both hand this builder a legitimate 0in edge.
   * Refusing them threw inside the 3D view's render — *"This page couldn't
   * load whenever I lift my fingers off of the shape draw on mobile"* (Tommy,
   * 2026-10-31). One `Math.max(0, ...)` upstream, and the page was gone.
   *
   * So the refusal is about the PANEL: if even its taller edge cannot carry
   * its own two skins, there is nothing to build. The short edge is handled
   * where it actually bites — the corner studs there are omitted rather than
   * cut to a negative length (which IS what this used to put in the cut list:
   * `stud_corner_1 = -0.50in` at a 1in tile).
   */
  if (tallerHeightIn < GABLE_PANEL_MIN_HEIGHT_IN) {
    throw new Error(
      `No corner of this Gable End Panel (${leftHeightIn} and ${rightHeightIn} across ${widthIn}in, cross rise ` +
        `${topCrossRiseIn}in) reaches the ` +
        `${GABLE_PANEL_MIN_HEIGHT_IN}in it needs for its own two skins, so there is no panel here to build. A sliver ` +
        `this short belongs in the row as a safety-gap filler, not as a fabricated panel.`,
    );
  }
  if (tallerHeightIn > GABLE_PANEL_MAX_HEIGHT_IN) {
    throw new Error(
      `The taller edge height (${tallerHeightIn}) exceeds the ${GABLE_PANEL_MAX_HEIGHT_IN}in (${GABLE_PANEL_MAX_HEIGHT_IN / 12}ft) max a single Gable End Panel can be built at — this should be the panel's own height above the eave line, not an absolute floor height.`,
    );
  }

  const plateLengthIn = widthIn - 2 * PLATE_END_CLEARANCE_IN;
  /* ⚠ Clamped at zero, and `buildGableCornerStuds` then OMITS the pair that
     lands there. At a triangle's tip the two skins and the plates meet with
     no room between them — there is no stud, which is a different statement
     from a stud of length -1.5in. */
  const leftStudSpanIn = Math.max(0, leftHeightIn - 2 * SKIN_THICKNESS_IN);
  const rightStudSpanIn = Math.max(0, rightHeightIn - 2 * SKIN_THICKNESS_IN);
  const shorterStudSpanIn = Math.min(leftStudSpanIn, rightStudSpanIn);
  const { angleDeg: ripAngleDeg, lengthIn: ripLengthIn } = computeGableRipCallout(widthIn, leftHeightIn, rightHeightIn);
  // The top plate 2x4s must run PARALLEL to the top skin (same roof pitch,
  // just a shorter run since they're inset by PLATE_END_CLEARANCE_IN at
  // each end, same as every other plate in this app) — so their own
  // endpoint heights are read off the SAME roofline trend line the skin
  // uses (leftHeightIn -> rightHeightIn over the full widthIn), evaluated
  // at the plate's own inset x positions, not the skin's raw full-width
  // edge heights (Tommy: "the top plate's 2x4's...don't seem to be in
  // parallel with the plywood" — using the raw edge heights at an inset x
  // made the plate's own rise/run steeper than the skin's real pitch).
  const heightAtXIn = (xIn: number) => leftHeightIn + ((rightHeightIn - leftHeightIn) * xIn) / widthIn;
  const platePeakLeftIn = heightAtXIn(PLATE_END_CLEARANCE_IN);
  const platePeakRightIn = heightAtXIn(widthIn - PLATE_END_CLEARANCE_IN);
  const { angleDeg: platePlumbCutAngleDeg, lengthIn: plateRipLengthIn } = computeGableRipCallout(
    plateLengthIn,
    platePeakLeftIn,
    platePeakRightIn,
  );
  // A "plumb cut" at a sloped board's own end (where it butts a vertical
  // corner stud) needs the saw angled by the SAME pitch angle as the rip
  // itself (Tommy: "mitered plumb cut...flush to the studs") — the cut
  // face's own extra length beyond a square cut, measured across the
  // board's thickness, is thicknessIn / cos(angle).
  const plumbCutEdgeLengthIn = (thicknessIn: number) => thicknessIn / Math.cos((ripAngleDeg * Math.PI) / 180);
  /** The rake as a slope, which is what the plane's own dip is built from. */
  const rakeSlope = widthIn > 0 ? (rightHeightIn - leftHeightIn) / widthIn : 0;
  /** ⚠ The plane's TRUE dip — the roof's pitch on every facet, not the rake.
   *  See `gableTopPlaneDipRad`; with no cross rise it IS the rake angle, so a
   *  box's arithmetic is unchanged to the last bit. */
  const planeDipRad = gableTopPlaneDipRad(rakeSlope, crossSlope);
  /** The bevel the shop sets across a board's width, and its fall. */
  const crossBevelDeg = (Math.atan(Math.abs(crossSlope)) * 180) / Math.PI;
  const crossBevelNote = (acrossIn: number) =>
    crossSlope === 0
      ? ""
      : ` COMPOUND CUT: bevel the saw ${crossBevelDeg.toFixed(2)}deg across the board as well, ` +
        `${(Math.abs(crossSlope) * acrossIn).toFixed(3)}in of fall over its ${acrossIn}in — the ` +
        `${crossSlope > 0 ? "interior" : "exterior"} face is the high one. The missing wedge the jig is cut from is ` +
        `${acrossIn}in across by ${(Math.abs(crossSlope) * acrossIn).toFixed(3)}in.`;
  /**
   * ⚠ **A PERPENDICULAR THICKNESS IS NOT A VERTICAL ONE**, and the top
   * assembly used to subtract them as if they were.
   *
   * `tiltedMember` takes a CENTRELINE and lays the board's thickness
   * perpendicular to it, so dropping a centreline by half the board's
   * thickness leaves its top face `half x (1/cos - 1)` ABOVE where it was
   * meant to be. Measured at 4:12: the top skin stood 0.020in proud of the
   * edge height it was handed, and the 2x4 plate beneath it ran 0.081in INTO
   * the skin it is supposed to sit under.
   *
   * Small numbers, and exactly the ones that stop a gable's top plate
   * finishing flush with the roof above it — which is what he asked for.
   * Dividing by cos turns a perpendicular offset into the vertical drop that
   * puts the face where it was asked for.
   */
  const verticalForPerpendicularIn = (perpendicularIn: number) => perpendicularIn / Math.cos(planeDipRad);

  /**
   * ⚠ **ONE roofline, read by the skin, the plates and the corner studs
   * alike.**
   *
   * `topAtXIn` is the panel's own top surface — the top face of the top
   * skin, which is the surface the roof above sits on and the one
   * `leftHeightIn`/`rightHeightIn` name. Everything below it is measured
   * down from there in VERTICAL inches, never perpendicular ones: a board
   * sloped at θ and cut plumb stands `thickness / cos θ` tall, and the two
   * were subtracted as if equal twice before (see
   * `verticalForPerpendicularIn` above, and the gable-roof flush junction
   * that took four passes).
   */
  const topAtIn = (xIn: number, yIn: number) =>
    leftHeightIn + ((rightHeightIn - leftHeightIn) * xIn) / widthIn + crossSlope * yIn;
  /** ⚠ The MID-DEPTH reading, for the places where the answer genuinely does
   *  not depend on depth — the rip callout, and the solves for where the top
   *  plane runs into the bottom of the panel on a tapering tile. Identical to
   *  the old single-argument `topAtXIn` whenever there is no cross rise. */
  const topAtXIn = (xIn: number) => topAtIn(xIn, depthIn / 2);
  const skinVerticalThicknessIn = verticalForPerpendicularIn(SKIN_THICKNESS_IN);
  const plateVerticalThicknessIn = verticalForPerpendicularIn(PLATE_2X4_THICKNESS_IN);
  /** The top skin's underside: what the corner studs reach and what the top
   * plates hang beneath — at a given panel x AND depth. */
  const topUndersideAtIn = (xIn: number, yIn: number) => topAtIn(xIn, yIn) - skinVerticalThicknessIn;
  const topUndersideAtXIn = (xIn: number) => topUndersideAtIn(xIn, depthIn / 2);

  /**
   * A sloped top board with PLUMB (vertical) ends, the shape these members'
   * own cut-list notes have been describing all along — see
   * `plumbEndedSlopedBoardCornersIn`. `tiltedMember` drew them as rectangles
   * rotated about their centres, so the ends came out square to the rip and
   * the panel's corners were visibly wrong: *"The corners of the gable end
   * panels are not plumb cut"* (Tommy, 2026-11-01).
   */
  const slopedTopBoard = (
    memberId: string,
    material: PanelMember["material"],
    plySpec: PanelMember["plySpec"],
    nominalSize: PanelMember["nominalSize"],
    perpendicularThicknessIn: number,
    crossWidthIn: number,
    fromXIn: number,
    toXIn: number,
    /** This board's own TOP face, at a panel x and a panel depth. Both faces
     *  are parallel to the top plane for a plate or a skin, so this is read at
     *  the two depth extremes and the prism joins them. */
    topAtIn_: (xIn: number, yIn: number) => number,
    centerDepthIn: number,
    role: PanelMember["role"],
    notes: string,
  ): PanelMember => {
    const verticalThicknessIn = verticalForPerpendicularIn(perpendicularThicknessIn);
    const nearDepthIn = centerDepthIn - crossWidthIn / 2;
    const farDepthIn = centerDepthIn + crossWidthIn / 2;
    const faceCornersIn = (atDepthIn: number) =>
      plumbEndedSlopedBoardCornersIn(
        fromXIn,
        topAtIn_(fromXIn, atDepthIn),
        toXIn,
        topAtIn_(toXIn, atDepthIn),
        verticalThicknessIn,
      );
    const cornersIn = faceCornersIn(nearDepthIn);
    const farFaceCornersIn = faceCornersIn(farDepthIn);
    const topAtFromXIn = topAtIn_(fromXIn, nearDepthIn);
    const topAtToXIn = topAtIn_(toXIn, nearDepthIn);
    return {
      memberId,
      material,
      speciesGrade: material === "dimensional_lumber" ? LUMBER_SPECIES_GRADE : null,
      plySpec,
      nominalSize,
      actualDimsIn: {
        thicknessIn: perpendicularThicknessIn,
        widthIn: crossWidthIn,
        /* The LONG POINT — the rake-length of the board's own top edge,
           which is what a shop cuts to. Over BOTH depth faces: a compound cut
           makes one face's edge the longer. */
        lengthIn: Math.max(braceLongestEdgeIn(cornersIn), braceLongestEdgeIn(farFaceCornersIn)),
      },
      orientation: "diagonal",
      position: {
        xIn: (fromXIn + toXIn) / 2,
        yIn: centerDepthIn,
        zIn: (topAtFromXIn + topAtToXIn) / 2 - verticalThicknessIn / 2,
        rotationDeg: 0,
        tiltDeg: ripAngleDeg,
        trapezoidCornersIn: cornersIn,
        /* It stands on its thickness and runs `crossWidthIn` through the
           panel's depth — see `trapezoidDepthIn`. */
        trapezoidDepthIn: crossWidthIn,
        /* ⚠ The compound bevel: the far depth face is the SAME plane read
           further through the wall. Both of this board's faces are parallel to
           it, which is what makes the two quads a translation of each other —
           a stud's are not. */
        ...(crossSlope !== 0 && { trapezoidFarCornersIn: farFaceCornersIn }),
      },
      role,
      qty: 1,
      notes,
    };
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ⚠ **WHERE THE TWO PLATES WOULD CROSS, THEY ARE ONE BOARD.**

     > *"Let two plates become one board."* — Tommy, 2026-11-14, choosing
     > between that and refusing the tile outright.

     A gable tile whose LOW edge is only a few inches tall runs its sloped top
     plate down THROUGH its own flat bottom plate: the two want the same wood.
     Found by the height sweep (`gable sliver`) on 2026-11-14, over a low edge
     of 1.5 to 4in — a band nothing in this app had ever built.

     It is local to the low end — over the rest of the panel the two plates are
     properly apart — so the merge is a ZONE, not a whole-panel rule, and the
     cavity above the bottom plate survives everywhere it already exists. In
     the zone the pair becomes a single board **tapered** between the bottom
     skin's top face and the top skin's underside: the shop rips one wedge
     rather than cutting two boards that occupy the same wood. The same move as
     a header too shallow to brace becoming a solid beam, shipped the same day.

     ⚠ **The wedge stops where it runs out of thickness**, not at the panel's
     end. Inboard of the x at which the top skin's own underside reaches the
     bottom skin's top face there is no board at all, only the two skins —
     forcing one in there is what drew a negative-thickness member.
     ─────────────────────────────────────────────────────────────────────── */
  const plateFromXIn = PLATE_END_CLEARANCE_IN;
  const plateToXIn = widthIn - PLATE_END_CLEARANCE_IN;
  /** The underside of a sloped top plate hanging beneath the top skin, at a
   *  given panel x and depth. */
  const plateUndersideAtIn = (xIn: number, yIn: number) => topUndersideAtIn(xIn, yIn) - plateVerticalThicknessIn;
  /** The same at MID-DEPTH — used only where the answer does not depend on
   *  depth (the plate-crossing solve on a tapering tile). */
  const plateUndersideAtXIn = (xIn: number) => plateUndersideAtIn(xIn, depthIn / 2);
  /** The top face of the flat bottom plate, which is what it has to clear. */
  const bottomPlateTopZIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const lowIsLeft = leftHeightIn <= rightHeightIn;
  const lowPlateXIn = lowIsLeft ? plateFromXIn : plateToXIn;
  const highPlateXIn = lowIsLeft ? plateToXIn : plateFromXIn;
  const undersideAtLowIn = plateUndersideAtXIn(lowPlateXIn);
  const undersideAtHighIn = plateUndersideAtXIn(highPlateXIn);
  const platesCross = undersideAtLowIn < bottomPlateTopZIn;
  /* Linear in x, so one division finds the crossover. Clamped to the high end
     for the degenerate tile where even there the two do not fit: the pair then
     disappears entirely and the wedge IS the whole plate run. */
  const crossFraction =
    undersideAtHighIn > undersideAtLowIn
      ? Math.min(1, Math.max(0, (bottomPlateTopZIn - undersideAtLowIn) / (undersideAtHighIn - undersideAtLowIn)))
      : 1;
  const crossXIn = platesCross ? lowPlateXIn + crossFraction * (highPlateXIn - lowPlateXIn) : lowPlateXIn;
  /**
   * ⚠ **AND THE TWO SKINS, at a triangle's feather edge.**
   *
   * Nothing had built this band before 2026-11-14 either. Where the tile
   * tapers toward nothing, the sloped top skin's underside drops below the
   * flat bottom skin's top face: two 3/4in sheets in less than 1 1/2in of
   * panel. Same answer as the plates, and physically the only one — at the
   * feather edge there is one sheet of plywood, so the BOTTOM skin stops where
   * it no longer fits and the top skin runs on alone to the point.
   *
   * It is the top skin that continues because its top face IS the panel's
   * stated edge height, the surface the roof above sits on.
   */
  const skinMergeXIn = (() => {
    const slopePerIn = (rightHeightIn - leftHeightIn) / widthIn;
    if (slopePerIn === 0) return lowIsLeft ? 0 : widthIn;
    const xIn = (SKIN_THICKNESS_IN + skinVerticalThicknessIn - leftHeightIn) / slopePerIn;
    return Math.min(widthIn, Math.max(0, xIn));
  })();
  const bottomSkinFromXIn = lowIsLeft ? skinMergeXIn : 0;
  const bottomSkinLengthIn = lowIsLeft ? widthIn - skinMergeXIn : skinMergeXIn;
  /** The wedge's thin end: where the top skin's underside meets the bottom
   *  skin's top face. Clamped into the plate run at both ends. */
  const wedgeThinXIn = (() => {
    const slopePerIn = (rightHeightIn - leftHeightIn) / widthIn;
    if (slopePerIn === 0) return lowPlateXIn;
    const xIn = (SKIN_THICKNESS_IN + skinVerticalThicknessIn - leftHeightIn) / slopePerIn;
    return lowIsLeft ? Math.max(lowPlateXIn, Math.min(crossXIn, xIn)) : Math.min(lowPlateXIn, Math.max(crossXIn, xIn));
  })();
  const wedgeSpansIn = Math.abs(crossXIn - wedgeThinXIn);
  const hasMergedPlate = platesCross && wedgeSpansIn > 1e-9;
  /** The span the ORDINARY pair still covers: the whole plate run when the two
   *  do not cross, and everything inboard of the crossover when they do. */
  const platedFromXIn = lowIsLeft ? crossXIn : plateFromXIn;
  const platedToXIn = lowIsLeft ? plateToXIn : crossXIn;
  const platedLengthIn = platedToXIn - platedFromXIn;
  const hasPlatePair = platedLengthIn > 1e-9;
  /* The rip callout has to describe the board that is actually cut, so it is
     taken over the plated span rather than the full run — identical when
     nothing merged, and short by the wedge when something did. */
  const { lengthIn: platedRipLengthIn } = computeGableRipCallout(
    platedLengthIn,
    heightAtXIn(platedFromXIn),
    heightAtXIn(platedToXIn),
  );
  /** The tapered board the pair becomes: flat on the bottom skin, following
   *  the top skin's underside above it. */
  const mergedPlate = (memberId: string, nearDepthIn: number): PanelMember => {
    const x0 = Math.min(wedgeThinXIn, crossXIn);
    const x1 = Math.max(wedgeThinXIn, crossXIn);
    /* At this wedge's OWN mid-depth — the two wythes' wedges are different
       boards at different depths, so on a bevelled top they are different
       tapers too. */
    const centreDepthIn = nearDepthIn + PLATE_2X4_WIDTH_IN / 2;
    const undersideIn = (xIn: number) => topUndersideAtIn(xIn, centreDepthIn);
    /* ⚠ Like a stud, the wedge's BOTTOM lies flat on the bottom skin while its
       top follows the plane, so the two depth faces are read separately. */
    const faceCornersIn = (atDepthIn: number) =>
      [
        { xIn: x0, zIn: Math.max(SKIN_THICKNESS_IN, topUndersideAtIn(x0, atDepthIn)) },
        { xIn: x1, zIn: Math.max(SKIN_THICKNESS_IN, topUndersideAtIn(x1, atDepthIn)) },
        { xIn: x1, zIn: SKIN_THICKNESS_IN },
        { xIn: x0, zIn: SKIN_THICKNESS_IN },
      ] as [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D];
    const cornersIn = faceCornersIn(nearDepthIn);
    const farFaceCornersIn = faceCornersIn(nearDepthIn + PLATE_2X4_WIDTH_IN);
    const thinIn = Math.max(0, undersideIn(lowIsLeft ? x0 : x1) - SKIN_THICKNESS_IN);
    const thickIn = Math.max(0, undersideIn(lowIsLeft ? x1 : x0) - SKIN_THICKNESS_IN);
    return {
      memberId,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: x1 - x0 },
      orientation: "diagonal",
      position: {
        xIn: (x0 + x1) / 2,
        yIn: centreDepthIn,
        zIn: (SKIN_THICKNESS_IN + Math.max(SKIN_THICKNESS_IN, undersideIn((x0 + x1) / 2))) / 2,
        rotationDeg: 0,
        tiltDeg: 0,
        trapezoidCornersIn: cornersIn,
        trapezoidDepthIn: PLATE_2X4_WIDTH_IN,
        ...(crossSlope !== 0 && { trapezoidFarCornersIn: farFaceCornersIn }),
      },
      role: "plate",
      qty: 1,
      notes:
        `${memberId.endsWith("_ext") ? "exterior" : "interior"}-wythe edge — ONE BOARD where the top and bottom plates ` +
        `would otherwise cross. Rip a 2x4 to a taper: ${thickIn.toFixed(2)}in thick at the inboard end, ` +
        `${thinIn.toFixed(2)}in at the low end, ${(x1 - x0).toFixed(2)}in long. It lies flat on the bottom skin and ` +
        `follows the top skin's underside. Tommy, 2026-11-14: "Let two plates become one board."` +
        crossBevelNote(PLATE_2X4_WIDTH_IN),
    };
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ⚠ **THE GABLE ROW GETS THE SAME CENTRE STUDS THE WALL BELOW HAS.**

     > *"I really want to see these studs lining up perfectly with the row
     > below them, it does not appear that way on the app live right now."*
     > — Tommy, 2026-11-14

     Measured 2026-11-14 and he is right: a 48in wall panel carries a PAIR of
     centre studs at x = 22.25, one per wythe, and the 48in gable tile sitting
     on it carried **none** — four corner studs and nothing between them. The
     row joints had been aligned since B3; the studs INSIDE the tiles never
     were, so a gable end showed a stud under every tile edge and a 48in hole
     everywhere a wall panel's own centre stud came up to meet it.

     Same rule, same x: `MAX_STUD_SPACING_IN` over the tile's own width, and a
     gable tile's width IS a wall slot's width (B3, `computeGableTiledRow`
     takes the wall's joints), so the two land on each other by construction
     rather than by coincidence. That is the load path his module decision was
     for — *"load bearing as straight down as possible"*.

     ⚠ **The one difference is the TOP**, and it is why this cannot just call
     `buildCentreNailerStuds`: a gable's top plate is sloped, so each stud is
     cut to the plate's underside AT ITS OWN X, and a stud whose x has no room
     left (inside the merged-plate wedge at a tapering end) is omitted rather
     than built at a negative length.
     ─────────────────────────────────────────────────────────────────────── */
  const gableCentreStuds = (): PanelMember[] => {
    const out: PanelMember[] = [];
    for (const [spanIndex, [fromXIn, toXIn]] of centreNailerStudSpansIn(widthIn).entries()) {
      /* The LOWER of the stud's own two x edges, so it never pokes up through
         the sloped plate on its high side. */
      /* ⚠ PER FACE, because the plate above tilts through the depth too: the
         exterior and interior centre studs of one span are different lengths
         on a bevelled top. Reading one and building both is exactly the
         mistake that made the first compound-bevel test fixture overlap. */
      for (const [face, centreYIn] of [
        ["exterior", PLATE_2X4_THICKNESS_IN / 2],
        ["interior", depthIn - PLATE_2X4_THICKNESS_IN / 2],
      ] as [string, number][]) {
        const ceilingAtIn = (xIn: number) => plateUndersideAtIn(xIn, centreYIn);
        const ceilingZIn = Math.min(ceilingAtIn(fromXIn), ceilingAtIn(toXIn));
        const lengthIn = ceilingZIn - bottomPlateTopZIn;
        /* No room at all: this x is inside the taper, where the two plates
           have already become one board. Nothing to stand. */
        if (!(lengthIn > 0)) continue;
        /* Raked to the plate above, like the corner studs beside it — a square
           top would leave a wedge up to 3 1/2in x the pitch open under the
           plate it is meant to carry. Corner order matches
           `buildGableCornerStuds`: 0 and 1 the level bottom, 2 and 3 the
           rake. */
        /* Laid flat, so it runs 1 1/2in through the depth; its top follows
           the plate above and its bottom stays on the bottom plate. */
        const faceCornersIn = (atDepthIn: number) =>
          [
            { xIn: fromXIn, zIn: bottomPlateTopZIn },
            { xIn: toXIn, zIn: bottomPlateTopZIn },
            { xIn: toXIn, zIn: plateUndersideAtIn(toXIn, atDepthIn) },
            { xIn: fromXIn, zIn: plateUndersideAtIn(fromXIn, atDepthIn) },
          ] as [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D];
        const cornersIn = faceCornersIn(centreYIn - PLATE_2X4_THICKNESS_IN / 2);
        const farFaceCornersIn = faceCornersIn(centreYIn + PLATE_2X4_THICKNESS_IN / 2);
        const longPointIn =
          Math.max(...cornersIn.map((c) => c.zIn), ...farFaceCornersIn.map((c) => c.zIn)) - bottomPlateTopZIn;
        out.push({
          memberId: `stud_centre_${spanIndex + 1}_${face}`,
          material: "dimensional_lumber",
          speciesGrade: LUMBER_SPECIES_GRADE,
          plySpec: null,
          nominalSize: "2x4",
          /* The LONG POINT, like every other rake-cut member here. */
          actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: longPointIn },
          orientation: "vertical",
          position: {
            xIn: fromXIn,
            yIn: centreYIn,
            zIn: bottomPlateTopZIn,
            rotationDeg: 90,
            trapezoidCornersIn: cornersIn,
            /* Laid FLAT (B30): 3 1/2in along the wall, 1 1/2in into the panel,
               which is what gives a seam above it a 3 1/2in face to bear on. */
            trapezoidDepthIn: PLATE_2X4_THICKNESS_IN,
            ...(crossSlope !== 0 && { trapezoidFarCornersIn: farFaceCornersIn }),
          },
          role: "stud",
          qty: 1,
          notes:
            spanIndex === 0 && face === "exterior"
              ? `centre nailer — same ${MAX_STUD_SPACING_IN}in rule and same x as the wall panel below, so the studs stack. ` +
                `Long point ${longPointIn.toFixed(2)}in, top cut to the roof rake so it lands flush under the top plate.` +
                crossBevelNote(PLATE_2X4_THICKNESS_IN)
              : undefined,
        });
      }
    }
    return out;
  };

  const members: PanelMember[] = [
    {
      memberId: "bottom_plate_skin",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: bottomSkinLengthIn },
      orientation: "flat",
      position: { xIn: bottomSkinFromXIn, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      /* Short of the full width only on a tile that tapers below its own two
         sheets — see `skinMergeXIn`. On every ordinary panel this is the full
         width and the note is absent. */
      ...(bottomSkinLengthIn < widthIn - 1e-9 && {
        notes:
          `Cut ${bottomSkinLengthIn.toFixed(2)}in, not the panel's full ${widthIn.toFixed(2)}in: the tile tapers below ` +
          `1 1/2in before its ${lowIsLeft ? "left" : "right"} end, and the top skin alone carries the last ` +
          `${(widthIn - bottomSkinLengthIn).toFixed(2)}in to the point. One sheet, not two.`,
      }),
    },
    /* ⚠ The pair is absent on a tile whose whole plate run merged — see
       `hasPlatePair`. A zero-length board is not a board. */
    ...(hasPlatePair
      ? ([
          {
            memberId: "bottom_plate_2x4_ext",
            material: "dimensional_lumber",
            speciesGrade: LUMBER_SPECIES_GRADE,
            plySpec: null,
            nominalSize: "2x4",
            actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: platedLengthIn },
            orientation: "flat",
            position: { xIn: platedFromXIn, yIn: 0, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
            role: "plate",
            qty: 1,
            notes: "exterior-wythe edge",
          },
          {
            memberId: "bottom_plate_2x4_int",
            material: "dimensional_lumber",
            speciesGrade: LUMBER_SPECIES_GRADE,
            plySpec: null,
            nominalSize: "2x4",
            actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: platedLengthIn },
            orientation: "flat",
            position: { xIn: platedFromXIn, yIn: depthIn - PLATE_2X4_WIDTH_IN, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
            role: "plate",
            qty: 1,
            notes: "interior-wythe edge",
          },
        ] as PanelMember[])
      : []),
    ...(hasMergedPlate ? [mergedPlate("merged_plate_ext", 0), mergedPlate("merged_plate_int", depthIn - PLATE_2X4_WIDTH_IN)] : []),
    ...buildGableCornerStuds(widthIn, depthIn, leftStudSpanIn, rightStudSpanIn, topUndersideAtIn, crossSlope),
    ...gableCentreStuds(),
    ...(hasPlatePair
      ? [
    slopedTopBoard(
      "top_plate_2x4_ext",
      "dimensional_lumber",
      null,
      "2x4",
      PLATE_2X4_THICKNESS_IN,
      PLATE_2X4_WIDTH_IN,
      platedFromXIn,
      platedToXIn,
      topUndersideAtIn,
      PLATE_2X4_WIDTH_IN / 2,
      "plate",
      `exterior-wythe edge — rip parallel to the top skin, at ${platePlumbCutAngleDeg.toFixed(2)}deg, cut to ${platedRipLengthIn.toFixed(2)}in long (point to butt). Ends are plumb-cut (vertical), flush to each corner stud's face — not square to the rip — extending the board's 1.5in thickness to a ${plumbCutEdgeLengthIn(PLATE_2X4_THICKNESS_IN).toFixed(2)}in cut edge.` +
        crossBevelNote(PLATE_2X4_WIDTH_IN),
    ),
    slopedTopBoard(
      "top_plate_2x4_int",
      "dimensional_lumber",
      null,
      "2x4",
      PLATE_2X4_THICKNESS_IN,
      PLATE_2X4_WIDTH_IN,
      platedFromXIn,
      platedToXIn,
      topUndersideAtIn,
      depthIn - PLATE_2X4_WIDTH_IN / 2,
      "plate",
      `interior-wythe edge — rip parallel to the top skin, at ${platePlumbCutAngleDeg.toFixed(2)}deg, cut to ${platedRipLengthIn.toFixed(2)}in long (point to butt). Ends are plumb-cut (vertical), flush to each corner stud's face — not square to the rip — extending the board's 1.5in thickness to a ${plumbCutEdgeLengthIn(PLATE_2X4_THICKNESS_IN).toFixed(2)}in cut edge.` +
        crossBevelNote(PLATE_2X4_WIDTH_IN),
    ),
        ]
      : []),
    slopedTopBoard(
      "top_plate_skin",
      "plywood",
      SKIN_PLY_SPEC,
      null,
      SKIN_THICKNESS_IN,
      depthIn,
      0,
      widthIn,
      /* ⚠ The skin's top face IS the panel's stated edge height, exactly —
         no half-thickness correction, because the corners name the face
         rather than a centreline. That is what makes a gable's top plate
         finish flush with the roof above it, which is what he asked for and
         what the centreline reading kept missing by hundredths. */
      /* ⚠ The PLANE, not a single height. The skin's top face IS the panel's
         stated top surface, and on a bevelled facet that surface is read at
         both depth faces rather than once at the middle. */
      topAtIn,
      depthIn / 2,
      "skin",
      /* ⚠ **THE SHEET MAY BE CUT SQUARE, and the note says what that costs.**
         > *"Plywood should just be cut perpendicular on these with a note in
         > the shop drawing saying to be ~1/4\" bottom plate piece is proud of
         > the plywood."* — Tommy, 2026-11-01
         A 3/4in sheet lying at the rake, cut square to its own faces rather
         than plumb, puts its lower corner `thickness x sin(rake)` along the
         slope from where a plumb cut would — 0.237in at 4:12, his "~1/4in" —
         and the plate below finishes that much proud of it.
         ⚠ The MODEL keeps the plumb cut. A square-cut sheet aligned to the
         panel's own ends overhangs the high end by that same 1/4in and runs
         into the next panel, which is worse on a drawing than a plate
         standing proud. So this is carried as a shop allowance on the cut
         list rather than as a different shape, and it is one of the readings
         in the Review Log. */
      `Rip at ${ripAngleDeg.toFixed(2)}deg, cut to ${ripLengthIn.toFixed(2)}in long (point to butt). Panel-width edges are drawn plumb-cut (vertical), flush to each corner stud's face — extending the sheet's 0.75in thickness to a ${plumbCutEdgeLengthIn(SKIN_THICKNESS_IN).toFixed(2)}in cut edge. CUTTING THEM SQUARE (perpendicular to the sheet) is accepted: the top plate below then finishes about ${(SKIN_THICKNESS_IN * Math.sin((ripAngleDeg * Math.PI) / 180)).toFixed(3)}in proud of the plywood, which is expected and needs no shim.` +
        crossBevelNote(depthIn),
    ),
    /* ⚠ Girts are spaced across the SHORTER edge's clear span, so a panel
       tapering to nothing has none: they would otherwise stack on the bottom
       skin, or (before the clamp above) sit at a negative height outside the
       panel altogether. A triangle this shallow is skins, plates and its one
       standing stud. */
    ...(() => {
      /* ⚠ By the SHORT edge, per `gableGirtPlan` — it replaced a flat two
         rows, which bunched girts inches apart on a short tile. */
      /* ⚠ The LOW end's plate underside, whichever end that is. The sweep
         only ever built a left-low gable, so the mirror-image overlap on a
         right-low tile was pinned nowhere — it is swept in both directions
         now. */
      const lowEndPlateXIn = leftHeightIn <= rightHeightIn ? PLATE_END_CLEARANCE_IN : widthIn - PLATE_END_CLEARANCE_IN;
      /* ⚠ At the depth face where the plane is LOWER, so a girt clears the
         plate on both wythes rather than on the average of them. */
      const lowFaceYIn = crossSlope >= 0 ? 0 : depthIn;
      const plan = gableGirtPlan(shorterStudSpanIn, {
        maxRowTopZIn: plateUndersideAtIn(lowEndPlateXIn, lowFaceYIn),
        rowTopAboveCentreIn: girtRowTopAboveCentreIn(girtStyle),
      });
      return buildGirtRows(plan.rowCount, widthIn, depthIn, shorterStudSpanIn, plan.centerZsIn ?? undefined, girtStyle);
    })(),
  ];
  /* ⚠ The optional nailer is SKIPPED once a centre stud already stands at
     mid-width: it is the same board at the same x, and B21's own rule is that
     the overlay is a guarantee rather than a generator — it adds a board only
     where the stud rule does not already put one. (A standard panel still
     builds both; that pre-existing duplicate is pinned as
     `stud_centre_N_exterior x nailer` in the overlap sweep.) */
  if (includeNailer && centreNailerStudSpansIn(widthIn).length === 0) {
    members.push(buildNailer(widthIn, Math.min(leftHeightIn, rightHeightIn)));
  }
  /* See `buildStandardPanelMembers` — a ring's rails are cut around the
     panel's verticals once the panel is whole. */
  return cutRingGirtsAroundVerticals(members, depthIn);
}

/**
 * Wraps `buildGablePanelMembers` in the full shared component schema —
 * see `buildStandardPanelSchema`'s doc comment for the same rationale.
 * `overallDimensions.heightIn` is the TALLER edge height (whichever side
 * that is) — the envelope is trapezoidal, not a uniform rectangle.
 */
export function buildGablePanelSchema(
  widthIn: number,
  depthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
  includeNailer: boolean,
  /** The project's girt style. Defaults to `LEGACY_GIRT_STYLE`, which is what
   * this app built before girts had styles — never to the project default,
   * so an un-taught call site draws a stale panel rather than a wrong one. */
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
  /** See `buildGablePanelMembers`. 0 is a box, and is the default. */
  topCrossRiseIn = 0,
): PanelComponentSchema {
  const { angleDeg: ripAngleDeg, lengthIn: ripLengthIn } = computeGableRipCallout(widthIn, leftHeightIn, rightHeightIn);
  const crossSlope = depthIn > 0 ? topCrossRiseIn / depthIn : 0;
  const crossBevelDeg = (Math.atan(Math.abs(crossSlope)) * 180) / Math.PI;
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "gable_panel",
    displayName: "Gable End Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    /* ⚠ The TALLEST CORNER of the top plane. With a compound bevel the taller
       EDGE is not the panel's tallest point — one depth face stands the whole
       cross rise above the other. */
    overallDimensions: {
      heightIn: gableTallestCornerIn(leftHeightIn, rightHeightIn, topCrossRiseIn),
      widthIn,
      depthIn,
    },
    members: buildGablePanelMembers(
      widthIn,
      depthIn,
      leftHeightIn,
      rightHeightIn,
      includeNailer,
      girtStyle,
      topCrossRiseIn,
    ),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Trapezoidal envelope — edge stud angle cuts are simplified to plain boxes, not true beveled geometry. " +
          "Girt rows/nailer use the shorter edge's stud span for vertical spacing, not the full slope. No diagonal " +
          "bracing — standard panel with an inclined top only, for the default construction.",
      },
      {
        type: "warning",
        text: `Top skin rip: ${Math.abs(ripAngleDeg).toFixed(2)}deg, ${ripLengthIn.toFixed(2)}in long. Left/right edge heights are ` +
          "supplied manually — no roof/ridge system exists yet to derive them automatically.",
      },
      ...(crossSlope === 0
        ? []
        : [
            {
              type: "warning" as const,
              /* ⚠ Named rather than implied, because a compound bevel is
                 invisible in elevation: the drawing of this panel looks
                 exactly like the square-topped one. */
              text:
                `COMPOUND (dual) bevel top: the panel is raked ${Math.abs(ripAngleDeg).toFixed(2)}deg along its width ` +
                `AND bevelled ${crossBevelDeg.toFixed(2)}deg across its ${depthIn}in depth, ` +
                `${Math.abs(topCrossRiseIn).toFixed(3)}in of fall with the ` +
                `${topCrossRiseIn > 0 ? "interior" : "exterior"} face high. This is what lets a roof plane that falls ` +
                "THROUGH the wall — any wall at an angle to the roof's fall, which is most walls of an octagon — sit " +
                "flush on it. It does not show in the elevation view.",
            },
          ]),
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
