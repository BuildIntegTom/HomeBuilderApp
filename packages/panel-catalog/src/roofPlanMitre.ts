import type { PanelMember, SectionSpacePoint2D } from "./componentSchema";
import { boxXExtentFieldOf, memberBoxSizeIn } from "./panelMemberHelpers";
import { NO_FLOOR_ROOF_MITRE, type FloorRoofPanelMitre } from "./floorRoofPanelMitreTypes";

/**
 * ⚠ **CUTTING A ROOF PANEL WITH A PLUMB PLANE — his answer, 2026-11-18.**
 *
 * > *"i dont think there should be any wedges? i imagined that there will be a
 * > lot of dual bevel cuts in the shop to get multiple angles to meet. i
 * > imagined roof panels to be cut plumb vertically when plan view looking
 * > down on the building. this would in reality make an elongated octagon
 * > roof. i do like the simple overhang as an option."*
 *
 * The floor deck has been cut to the building since 2026-11-16 and the roof had
 * not, because a roof panel already carries two cuts in the Y-Z plane (the
 * plumb tall end and the eave) and a plan mitre is a cut that varies with X.
 * `floorRoofMitreUnsupportedReason` refused the pair rather than approximating
 * it, naming two blockers. **He has answered both**, and in a way that makes
 * this far smaller than the refusal expected:
 *
 * 1. *"no wedges"* — the cut grows **no new part**. The old worry was a bearing
 *    wedge whose apparent pitch along an angled cut is not the roof's; there is
 *    no such wedge to size.
 * 2. *"cut plumb vertically when plan view looking down"* — the cut is a
 *    **vertical plane**, so on any member it is a plain limit on Z that varies
 *    with X. That is what `sectionFarCornersIn` expresses, and it is why a roof
 *    joist's FIVE-sided eave section (the seat's taper kink) survives intact
 *    where no quad-based mechanism could have carried it.
 *
 * ## ⚠ It CLAMPS, it does not shift — and the difference is a whole assembly
 *
 * The first version moved everything at the cut end inboard by the cut's depth,
 * which quietly **carried the eave lid along with it**: a cut 190in into a
 * 192in panel produced a full eave assembly sitting at the new end, as though
 * the panel had been redesigned rather than cut. Clamping each corner into the
 * kept range is the literal reading of *"cut"*: a member the plane crosses is
 * shortened, a member wholly outside it collapses and is dropped, and a member
 * wholly inside is untouched byte for byte.
 *
 * ## ⚠ Nothing is re-oriented to run ALONG the cut, and that is a reading
 *
 * A floor panel's mitred end lid turns to follow the cut line (his *"one
 * bevelled board"*, 2026-11-15); this takes the roof panel as built and passes
 * a vertical plane through it. That is the literal reading of *"cut plumb
 * vertically"* and the one that matches *"a lot of dual bevel cuts in the
 * shop"* — a shop cutting the panel, not a different panel being designed. If
 * he wants the roof's end assembly to follow the cut the way the floor's does,
 * that is a larger part and this is where the difference is recorded.
 */

/** Where the kept span begins and ends at one position across the width. */
export interface RoofMitreKeptRangeIn {
  startIn: number;
  endIn: number;
}

export function roofMitreKeptRangeAtXIn(
  mitre: FloorRoofPanelMitre,
  widthIn: number,
  lengthIn: number,
  xIn: number,
): RoofMitreKeptRangeIn {
  /* Clamped, because a member can overhang its panel's nominal width by float
     noise and the cut must not run away past the corner it was measured at. */
  const t = widthIn > 0 ? Math.min(Math.max(xIn / widthIn, 0), 1) : 0;
  const startIn = mitre.startNearIn + t * (mitre.startFarIn - mitre.startNearIn);
  const endIn = mitre.endNearIn + t * (mitre.endFarIn - mitre.endNearIn);
  /* ⚠ **AN UNCUT END IS UNBOUNDED, NOT BOUNDED AT THE PANEL'S NOMINAL END** —
     and the difference is the eave's own overhang. A roof panel's members do
     not all live inside z ∈ [0, lengthIn]: the eave fascia hangs to NEGATIVE
     z by the panel's depth times the pitch, which is the rafter tail. Clamping
     a square end at 0 would saw that off on every panel in the building, which
     is what the "a square panel comes back byte for byte" test caught. */
  return {
    startIn: startIn > 1e-9 ? startIn : Number.NEGATIVE_INFINITY,
    endIn: endIn > 1e-9 ? lengthIn - endIn : Number.POSITIVE_INFINITY,
  };
}

/** A member's own section ring, whatever shape mechanism it was authored with.
 *  A plain box becomes its Y-Z rectangle, in the same perimeter order a section
 *  ring uses, so one code path cuts both. */
function sectionRingOf(member: PanelMember): SectionSpacePoint2D[] | null {
  if (member.position.sectionCornersIn) return member.position.sectionCornersIn;
  /* ⚠ A trapezoid or plan-polygon member is NOT converted. Those run through
     other axes and a plumb cut on them is a different construction; nothing in
     a roof panel uses either today, and silently reshaping one would be worse
     than leaving it. Reported as `uncutMemberIds`. */
  if (member.position.trapezoidCornersIn || member.position.planPolygonCornersIn) return null;
  const size = memberBoxSizeIn(member);
  const { yIn, zIn } = member.position;
  return [
    { yIn, zIn },
    { yIn, zIn: zIn + size.zIn },
    { yIn: yIn + size.yIn, zIn: zIn + size.zIn },
    { yIn: yIn + size.yIn, zIn },
  ];
}

/**
 * ⚠ **A PLUMB PLANE'S BOUND IS NOT A BOUND ON Z, BECAUSE A ROOF PANEL IS
 * TILTED — 2026-11-25.**
 *
 * This module's own header reasoned: *"the cut is a vertical plane, so on any
 * member it is a plain limit on Z that varies with X."* That is true of the
 * FLOOR deck, which lies flat, and it is where the reasoning came from. It is
 * false of a roof panel. Panel Z runs UP THE SLOPE and panel Y runs
 * perpendicular to the roof surface, so a plane that is vertical in the world
 * is, in the panel's own axes,
 *
 * ```
 * zIn + yIn * (pitchIn12 / 12) = constant
 * ```
 *
 * — a bound that varies with DEPTH as well as width, by `tan(pitch)` per inch
 * of depth. At 4:12 across a 15 1/2in panel that is **5.17in of span**, which
 * is the difference between a plumb cut and one square to the roof surface.
 *
 * ⚠ **This is not a reading; it is what every other end cut in this builder
 * already does.** `eaveCut.fasciaAtYIn` is literally `-yIn * tan`, and
 * `plumbEndCut.setBackAtYIn` carries the same slope. Measured off a real 16ft
 * Octagon roof panel, every end ring in it has a CONSTANT `w` on each face: an
 * eave joist's two plumb faces read 2.3717 and 200.014 at both y=0 and
 * y=5.5in. Bounding Z instead left the mitre as the one cut in the panel that
 * was not plumb.
 *
 * ⚠ **And it is what makes the clamp EXACT rather than close.** Clamping a
 * corner is only the true clip where the crossing edge runs at constant depth
 * — see `clampIsApproximate`. In `w` every end face of every member is a
 * single constant, so a cut lands flush on it; in Z the same face spans
 * 5.17in and the per-corner clamp kinks at a different X for each corner,
 * which is a prism that is a fiction between its two ends. That is what put
 * the eave lid skin inside both left joists.
 */
const plumbSpanSlopeOf = (pitchIn12: number | undefined): number =>
  pitchIn12 !== undefined && pitchIn12 > 0 ? pitchIn12 / 12 : 0;

/** A ring corner's position along the PLUMB span — see `plumbSpanSlopeOf`. */
const plumbWIn = (c: SectionSpacePoint2D, slope: number): number => c.zIn + c.yIn * slope;

const clampRing = (ring: SectionSpacePoint2D[], kept: RoofMitreKeptRangeIn, slope: number): SectionSpacePoint2D[] =>
  ring.map((c) => {
    const keptWIn = Math.min(Math.max(plumbWIn(c, slope), kept.startIn), kept.endIn);
    return { ...c, zIn: keptWIn - c.yIn * slope };
  });

const ringsDiffer = (a: SectionSpacePoint2D[], b: SectionSpacePoint2D[]): boolean =>
  a.some((c, i) => Math.abs(c.zIn - b[i]!.zIn) > 1e-9 || Math.abs(c.yIn - b[i]!.yIn) > 1e-9);

const zSpanOf = (ring: SectionSpacePoint2D[]): number =>
  Math.max(...ring.map((c) => c.zIn)) - Math.min(...ring.map((c) => c.zIn));

/** How much of the ring is left ALONG THE CUT'S OWN DIRECTION. The honest
 *  measure of "is there any board here": a piece whose plumb span has gone to
 *  nothing is gone, and its Z span can still be nonzero because Z and the
 *  plumb span are not the same axis on a tilted panel. */
const wSpanOf = (ring: SectionSpacePoint2D[], slope: number): number =>
  Math.max(...ring.map((c) => plumbWIn(c, slope))) - Math.min(...ring.map((c) => plumbWIn(c, slope)));

/**
 * ⚠ **THE TRUE CLIP, for the members a clamp cannot describe — 2026-11-25.**
 *
 * Clamping a corner into the kept range moves it along Z at a FIXED DEPTH.
 * That is the real cut only where the edge crossing the plane runs at constant
 * depth, which `clampIsApproximate` has said all along. An anti-twist girt is
 * the case where it does not: its web is a plain box, so its two ends are
 * square to the roof surface rather than plumb, and a plumb plane crosses it
 * diagonally. Clamping then keeps the girt's whole 15 1/2in depth and squashes
 * it along the span; the true cut keeps a 0.72in-deep sliver. Measured on the
 * 16ft Octagon, that difference is what put an anti-twist web inside its own
 * two flanges — the last pairs the audit reported on either octagon.
 *
 * So clip properly: intersect the ring with the half-plane, which ADDS a
 * vertex where the plane crosses an edge.
 *
 * ⚠ **THE CONSTRAINT THAT MAKES THIS AWKWARD, and the trick that satisfies
 * it.** A prism's two end rings are paired corner by corner (`i` with
 * `i + n`), so they must have the SAME number of corners in the same order —
 * and the near and far rings are clipped by planes at DIFFERENT places, so a
 * naive clip gives one a triangle and the other a quad. The answer is to
 * insert every plane's crossing points into the ORIGINAL ring first, so both
 * rings are cut from one augmented vertex list and come out the same length.
 * A corner the plane removed is then replaced by the crossing point its own
 * run begins at — a duplicated vertex, which this file's rings already carry
 * and the ear clipper already tolerates, and which has no area.
 *
 * ⚠ **Why not just project the removed corner onto the cut line?** Because
 * the convex hull of the result would then reach along that line to wherever
 * the removed corner's depth was, which on the girt above is 15 1/2in from the
 * sliver that is really there — a fifth of the area, instead of all of it, but
 * still a solid the panel does not contain.
 */
function clipRingToPlane(
  ring: SectionSpacePoint2D[],
  limitIn: number,
  keepAbove: boolean,
  slope: number,
): SectionSpacePoint2D[] | null {
  const outsideBy = (c: SectionSpacePoint2D): number =>
    keepAbove ? limitIn - plumbWIn(c, slope) : plumbWIn(c, slope) - limitIn;
  const outside = ring.map((c) => outsideBy(c) > 1e-9);
  if (!outside.some((v) => v)) return ring;
  /* Nothing of it is on the kept side. The caller decides whether that means
     dropped or merely gone at this one X face. */
  if (outside.every((v) => v)) return null;

  return ring.map((c, i) => {
    if (!outside[i]) return c;
    /* ⚠ Walk BACK to the crossing point this run of removed corners began
       at. It is guaranteed to be a vertex of the augmented ring, which is the
       whole reason the augmentation happens first: between any removed corner
       and the nearest kept one there is a corner sitting exactly on the
       plane. */
    for (let step = 1; step <= ring.length; step++) {
      const j = (i - step + ring.length * 2) % ring.length;
      if (!outside[j]) return { ...ring[j]! };
    }
    return c;
  });
}

/**
 * ⚠ Every corner of `ring`, plus a corner wherever one of the cut planes
 * crosses one of its edges. The shape is unchanged — this only subdivides
 * edges — and it is what lets the near and far rings be clipped independently
 * and still pair up corner for corner.
 */
function ringAugmentedAtCrossings(
  ring: SectionSpacePoint2D[],
  limitsIn: number[],
  slope: number,
): SectionSpacePoint2D[] {
  const finite = limitsIn.filter((l) => Number.isFinite(l));
  if (finite.length === 0) return ring;
  const out: SectionSpacePoint2D[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    out.push(a);
    const aWIn = plumbWIn(a, slope);
    const bWIn = plumbWIn(b, slope);
    const spanIn = bWIn - aWIn;
    if (Math.abs(spanIn) <= 1e-12) continue;
    const ts = finite
      .map((limitIn) => (limitIn - aWIn) / spanIn)
      .filter((t) => t > 1e-12 && t < 1 - 1e-12)
      .sort((x, y) => x - y);
    for (const t of ts) {
      const yIn = a.yIn + t * (b.yIn - a.yIn);
      const wIn = aWIn + t * spanIn;
      out.push({ yIn, zIn: wIn - yIn * slope });
    }
  }
  return out;
}

/**
 * ⚠ **Corners the cut left on top of each other, dropped from BOTH rings at
 * once.** Augmenting with every plane's crossings and then collapsing removed
 * corners onto them leaves duplicates: the eave joist's five-cornered section
 * came out of a chamfer with thirteen corners, all but seven of them repeats.
 * They are harmless — zero area, and the ear clipper tolerates them — but
 * they are carried into the 3D mesh, the `.obj` and every SAT axis the overlap
 * audit tries, so they are worth not having.
 *
 * ⚠ **Dropped only where BOTH rings repeat**, which is the whole subtlety:
 * the two rings are paired corner for corner, so a corner removed from one
 * must be removed from the other even if the other still needs it. And never
 * below three corners, which would stop being a polygon.
 */
function dropPairedDuplicateCorners(
  nearRing: SectionSpacePoint2D[],
  farRing: SectionSpacePoint2D[],
): { nearRing: SectionSpacePoint2D[]; farRing: SectionSpacePoint2D[] } {
  if (nearRing.length !== farRing.length || nearRing.length <= 3) return { nearRing, farRing };
  const same = (a: SectionSpacePoint2D, b: SectionSpacePoint2D): boolean =>
    Math.abs(a.yIn - b.yIn) <= 1e-9 && Math.abs(a.zIn - b.zIn) <= 1e-9;
  const keep: number[] = [];
  for (let i = 0; i < nearRing.length; i++) {
    const previous = keep.length > 0 ? keep[keep.length - 1]! : null;
    if (
      previous !== null &&
      same(nearRing[i]!, nearRing[previous]!) &&
      same(farRing[i]!, farRing[previous]!)
    ) {
      continue;
    }
    keep.push(i);
  }
  /* The ring closes, so the last corner can repeat the first. */
  while (
    keep.length > 3 &&
    same(nearRing[keep[keep.length - 1]!]!, nearRing[keep[0]!]!) &&
    same(farRing[keep[keep.length - 1]!]!, farRing[keep[0]!]!)
  ) {
    keep.pop();
  }
  if (keep.length < 3) return { nearRing, farRing };
  return { nearRing: keep.map((i) => nearRing[i]!), farRing: keep.map((i) => farRing[i]!) };
}

/** Is every corner of this ring on the kept side of both planes? */
function ringIsInsideKept(ring: SectionSpacePoint2D[], kept: RoofMitreKeptRangeIn, slope: number): boolean {
  return ring.every((c) => {
    const wIn = plumbWIn(c, slope);
    return wIn >= kept.startIn - 1e-6 && wIn <= kept.endIn + 1e-6;
  });
}

/**
 * The ring cut by both of one X face's planes. `null` when the face keeps
 * nothing at all, or when the clip could not be trusted — see below.
 *
 * ⚠ **THE ONE THING THE SEQUENTIAL CLIP CANNOT PROVE ABOUT ITSELF.** The
 * crossing points are inserted into the ORIGINAL ring, so the SECOND plane's
 * clip runs on a ring the first one has already moved. If a corner the start
 * plane pulled onto its line were then outside the END plane, the crossing
 * the walk-back needs would not be in the list and it would land on an
 * interior corner instead — a polygon pulled out of shape, silently.
 *
 * That needs the two planes to have crossed each other, which means the kept
 * band is empty and the member is gone anyway; `survivingXRangeIn` and the
 * drop test both catch it first. **But "it cannot happen" is a claim, and
 * this checks it rather than asserting it**: a result with a corner outside
 * either plane is thrown away, and the caller falls back to the clamp and
 * names the member in `approximateMemberIds`. A wrong solid becomes a
 * reported approximation.
 */
function clipRingToKept(
  ring: SectionSpacePoint2D[],
  kept: RoofMitreKeptRangeIn,
  slope: number,
): SectionSpacePoint2D[] | null {
  let out: SectionSpacePoint2D[] | null = ring;
  if (Number.isFinite(kept.startIn)) out = clipRingToPlane(out, kept.startIn, true, slope);
  if (out && Number.isFinite(kept.endIn)) out = clipRingToPlane(out, kept.endIn, false, slope);
  if (out && !ringIsInsideKept(out, kept, slope)) return null;
  return out;
}

/**
 * ⚠ **When clamping is not the same as cutting, said rather than hidden.**
 *
 * Intersecting a polygon with a half-plane normally ADDS a vertex; moving the
 * vertices that fall outside onto the line instead gives the same region only
 * where the edges crossing the line are at constant Y. Every four-cornered
 * section in a roof panel is built that way, so the clamp is exact for them.
 * The one shape that can break it is the eave joist's TAPER, whose kink sits
 * at its own depth — if the cut lands between the kink and a neighbour, the
 * clamped ring is a close shape rather than the exact one.
 */
function clampIsApproximate(ring: SectionSpacePoint2D[], kept: RoofMitreKeptRangeIn, slope: number): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (Math.abs(a.yIn - b.yIn) <= 1e-9) continue;
    for (const line of [kept.startIn, kept.endIn]) {
      if ((plumbWIn(a, slope) - line) * (plumbWIn(b, slope) - line) < -1e-12) return true;
    }
  }
  return false;
}

/**
 * ⚠ **A CUT SHORTENS A BOARD ACROSS THE WIDTH TOO, and leaving that out put
 * material in the middle of the panel — 2026-11-25.**
 *
 * Clamping each corner's Z into the kept range is exact for a member the cut
 * plane passes THROUGH at both of its X faces: the plane's set-back is linear
 * in X, so the clamped corner moves linearly and the two end rings describe
 * the solid between them. It is NOT exact for a member the plane has gone
 * clean PAST at one X face. There the ring collapses to a line, and a prism
 * built from a collapsed ring at one end and the full ring at the other is a
 * long wedge sweeping the whole width — material the saw took away, sitting
 * where the joists are.
 *
 * Measured on the 16ft Octagon's own mitred roof panel: the eave lid skin is
 * 3/4in of plywood in a 21.477in-deep cut, so it is consumed over all but
 * 0.755in of the panel's 20.375in width. The interpolated wedge instead ran
 * the full width, and the audit reported **21 pairs of members in the same
 * volume** on that one panel — among them the lid skin inside both of the
 * left joists.
 *
 * So: find the X interval over which the ring still has material on the kept
 * side, and trim the member to it. Each plane's set-back is linear in X, so
 * "is there anything left" flips at most once across the member and is
 * SOLVED rather than sampled — the crossing is the exact X at which the saw
 * runs out of board, which is what makes the piece a true triangle instead of
 * a triangle plus a fiction.
 */
function survivingXRangeIn(
  ring: SectionSpacePoint2D[],
  mitre: FloorRoofPanelMitre,
  widthIn: number,
  lengthIn: number,
  nearXIn: number,
  farXIn: number,
  slope: number,
): { loIn: number; hiIn: number } {
  let loIn = nearXIn;
  let hiIn = farXIn;
  if (widthIn <= 0) return { loIn, hiIn };

  /* The ring survives one plane while that plane's set-back stays short of
     this much. `1e-9` is the same floor `roofMitreKeptRangeAtXIn` uses to
     call an end UNCUT: below it the end is unbounded and nothing is ever
     consumed, so the threshold can never be lower than that. */
  const narrow = (planeNearIn: number, planeFarIn: number, thresholdIn: number): void => {
    const acrossIn = planeFarIn - planeNearIn;
    /* A set-back that does not vary with X is all-or-nothing, and the ring
       test in `applyRoofPlanMitre` already decides it. */
    if (Math.abs(acrossIn) <= 1e-12) return;
    const crossXIn = (widthIn * (thresholdIn - planeNearIn)) / acrossIn;
    if (acrossIn > 0) hiIn = Math.min(hiIn, crossXIn);
    else loIn = Math.max(loIn, crossXIn);
  };

  /* ⚠ In the PLUMB span, not in Z — the cut's own direction. */
  const maxWIn = Math.max(...ring.map((c) => plumbWIn(c, slope)));
  const minWIn = Math.min(...ring.map((c) => plumbWIn(c, slope)));
  narrow(mitre.startNearIn, mitre.startFarIn, Math.max(maxWIn, 1e-9));
  narrow(mitre.endNearIn, mitre.endFarIn, Math.max(lengthIn - minWIn, 1e-9));
  return { loIn, hiIn };
}

export interface RoofPlanMitreResult {
  members: PanelMember[];
  /** Members the cut consumed entirely. Named rather than silently absent: a
   *  panel at an octagon's corner really can lose a lid board, and a count that
   *  quietly drops is how a cut list and a drawing part company. */
  droppedMemberIds: string[];
  /** Members whose shape runs through an axis a plumb cut cannot touch. Empty
   *  for every roof panel this app builds; present so that adding one later is
   *  a visible refusal rather than an untouched board. */
  uncutMemberIds: string[];
  /** Members where the clamp is a close shape rather than the exact one — see
   *  `clampIsApproximate`. */
  approximateMemberIds: string[];
}

/**
 * Every member of a roof panel, cut by the plan mitre's two vertical planes.
 *
 * ⚠ **`actualDimsIn.lengthIn` is only rewritten when the piece's stated length
 * IS its span extent**, which is the case for a joist and a web and is not for
 * a lid face board (whose length is its plumb edge height, across the panel's
 * depth). Rewriting it blindly would put a number on a cut list that the part
 * does not have. Where it is not rewritten the cut still reaches the shop
 * through the member's own `notes`.
 */
export function applyRoofPlanMitre(
  members: PanelMember[],
  o: { widthIn: number; lengthIn: number; mitreIn?: FloorRoofPanelMitre; pitchIn12?: number },
): RoofPlanMitreResult {
  const mitre = o.mitreIn ?? NO_FLOOR_ROOF_MITRE;
  /* ⚠ **Without a pitch the cut is square to the panel, not plumb** — see
     `plumbSpanSlopeOf`. A flat deck is the one case where those are the same
     thing, which is why 0 is a correct answer and not a fallback. */
  const slope = plumbSpanSlopeOf(o.pitchIn12);
  const out: PanelMember[] = [];
  const droppedMemberIds: string[] = [];
  const uncutMemberIds: string[] = [];
  const approximateMemberIds: string[] = [];

  for (const member of members) {
    const ring = sectionRingOf(member);
    if (!ring) {
      uncutMemberIds.push(member.memberId);
      out.push(member);
      continue;
    }
    const nearXIn = member.position.xIn;
    const boxXIn = memberBoxSizeIn(member).xIn;
    const farXIn = nearXIn + boxXIn;

    /* ⚠ The X interval the saw leaves behind — see `survivingXRangeIn`. */
    const { loIn, hiIn } = survivingXRangeIn(ring, mitre, o.widthIn, o.lengthIn, nearXIn, farXIn, slope);
    const trimmedXIn = hiIn - loIn;
    const trimmedInX = loIn > nearXIn + 1e-9 || hiIn < farXIn - 1e-9;

    /* ⚠ A member the cut consumed, now measured on the board's own extent
       ACROSS THE WIDTH as well as along the span: a board with no X left is
       not there, however much of its section ring survives in the abstract. */
    if (trimmedXIn <= 1e-9) {
      droppedMemberIds.push(member.memberId);
      continue;
    }

    const keptNear = roofMitreKeptRangeAtXIn(mitre, o.widthIn, o.lengthIn, loIn);
    const keptFar = roofMitreKeptRangeAtXIn(mitre, o.widthIn, o.lengthIn, hiIn);

    /* ⚠ **Both rings are cut from ONE augmented vertex list**, so they pair
       up corner for corner however differently the two planes fall. See
       `clipRingToPlane`. */
    const augmented = ringAugmentedAtCrossings(
      ring,
      [keptNear.startIn, keptNear.endIn, keptFar.startIn, keptFar.endIn],
      slope,
    );
    const clippedNear = clipRingToKept(augmented, keptNear, slope);
    const clippedFar = clipRingToKept(augmented, keptFar, slope);
    /* A face that keeps nothing collapses onto its own cut plane, which is the
       shape a saw leaves: the piece tapers out to the line. `clampRing` is the
       right tool for exactly that one case, because there is no polygon left
       to clip. */
    const { nearRing, farRing } = dropPairedDuplicateCorners(
      clippedNear ?? clampRing(augmented, keptNear, slope),
      clippedFar ?? clampRing(augmented, keptFar, slope),
    );

    /* ⚠ **Untouched means UNTOUCHED.** A member wholly inside the kept span
       comes back the object it went in as — which keeps a square panel byte
       for byte, and keeps a mitred panel's un-cut members out of the group key
       and out of the overlap audit's oblique path.

       ⚠ Compared against the member's OWN ring rather than the augmented one,
       and by length first: a ring that came back the shape it went in as is
       uncut however many crossings were inserted and then collapsed again. */
    if (
      !trimmedInX &&
      nearRing.length === ring.length &&
      !ringsDiffer(ring, nearRing) &&
      !ringsDiffer(ring, farRing)
    ) {
      out.push(member);
      continue;
    }

    /* ⚠ A member the cut consumed. Measured on the solid rather than on the
       cut's position: a board whose span has gone to nothing at BOTH of its X
       faces is not there, and one that survives at either face still is. */
    if (wSpanOf(nearRing, slope) <= 1e-9 && wSpanOf(farRing, slope) <= 1e-9) {
      droppedMemberIds.push(member.memberId);
      continue;
    }
    /* ⚠ **Only the faces that had to fall back to the clamp** — a clipped
       face is exact, whatever its edges do. This list used to name every
       member with a slanted crossing edge, which after the clip above is no
       longer an approximation at all: it comes back EMPTY on every mitred
       roof panel this app builds, measured on both Octagon tiles.

       A face falls back for one of two reasons, and both end here: it kept
       nothing at all, or `clipRingToKept` refused its own answer. */
    if (
      (clippedNear === null && clampIsApproximate(augmented, keptNear, slope)) ||
      (clippedFar === null && clampIsApproximate(augmented, keptFar, slope))
    ) {
      approximateMemberIds.push(member.memberId);
    }

    const oblique = ringsDiffer(nearRing, farRing);
    const minZIn = Math.min(...nearRing.map((c) => c.zIn), ...farRing.map((c) => c.zIn));
    const longPointIn = Math.max(zSpanOf(nearRing), zSpanOf(farRing));
    /* ⚠ **Does this piece's stated LENGTH run along the span?** Asked of the
       member's own box, not of its ring: a joist's ring spans more than the
       joist is long (its two ends are bevelled, so the ring's extent is the
       long point at one depth plus the set-back at the other), and comparing
       the two would have answered no for the one member that most needs yes.
       `memberBoxSizeIn` maps orientation to axes, so this is the one honest
       question — a lid face board's length is its plumb edge height and comes
       back as the box's Y, not its Z. */
    const lengthIsSpan = Math.abs(memberBoxSizeIn(member).zIn - member.actualDimsIn.lengthIn) <= 1e-9;

    /* ⚠ **The X trim rewrites a DIFFERENT dims field per orientation**, which
       is why it goes through `boxXExtentFieldOf` rather than assuming
       `lengthIn`. A lid face board's X is its `widthIn`, a joist's is its
       `thicknessIn`, a flat sheet's is its `lengthIn`. */
    const xFieldKey = boxXExtentFieldOf(member);
    let actualDimsIn = member.actualDimsIn;
    if (lengthIsSpan) actualDimsIn = { ...actualDimsIn, lengthIn: longPointIn };
    if (trimmedInX) actualDimsIn = { ...actualDimsIn, [xFieldKey]: trimmedXIn };

    /* ⚠ **The one case where those two rewrites want the SAME field**, said
       rather than letting one quietly win: a piece whose stated length is both
       its span extent and its extent across the width. No roof panel member is
       that shape today (a sheet's X is its length while its Z is its 3/4in
       thickness), and `roofPlanMitre.test.ts` pins that; if one ever is, the X
       trim takes the field and the span long point goes in the note. */
    const xTrimTookTheLengthField = trimmedInX && lengthIsSpan && xFieldKey === "lengthIn";

    out.push({
      ...member,
      actualDimsIn,
      position: {
        ...member.position,
        xIn: loIn,
        zIn: minZIn,
        sectionCornersIn: nearRing,
        ...(oblique ? { sectionFarCornersIn: farRing } : {}),
      },
      notes: [
        member.notes,
        roofMitreNote(keptNear, keptFar, o.lengthIn),
        trimmedInX
          ? `the cut also SHORTENS this piece across the panel's width: ${trimmedXIn.toFixed(3)}in of the ${boxXIn.toFixed(3)}in it is built at, starting ${loIn.toFixed(3)}in across`
          : "",
        xTrimTookTheLengthField ? `its span long point is ${longPointIn.toFixed(3)}in` : "",
      ]
        .filter((n): n is string => n !== undefined && n.length > 0)
        .join(" — "),
    });
  }

  return { members: out, droppedMemberIds, uncutMemberIds, approximateMemberIds };
}

/** What the shop needs to read off one cut member: which end moved and how far
 *  at each of its two faces, so a dual bevel can be set from the sheet. */
function roofMitreNote(near: RoofMitreKeptRangeIn, far: RoofMitreKeptRangeIn, lengthIn: number): string {
  const parts: string[] = [];
  if (Math.abs(near.startIn) > 1e-9 || Math.abs(far.startIn) > 1e-9) {
    parts.push(`eave end cut back ${near.startIn.toFixed(3)}in to ${far.startIn.toFixed(3)}in across this piece`);
  }
  if (Math.abs(lengthIn - near.endIn) > 1e-9 || Math.abs(lengthIn - far.endIn) > 1e-9) {
    parts.push(
      `tall end cut back ${(lengthIn - near.endIn).toFixed(3)}in to ${(lengthIn - far.endIn).toFixed(3)}in across this piece`,
    );
  }
  if (parts.length === 0) return "";
  return `plan mitre: ${parts.join(", ")} — the cut is PLUMB, so this is a dual bevel with the end cut it already carries`;
}
