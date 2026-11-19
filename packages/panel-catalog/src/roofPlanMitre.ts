import type { PanelMember, SectionSpacePoint2D } from "./componentSchema";
import { memberBoxSizeIn } from "./panelMemberHelpers";
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

const clampRing = (ring: SectionSpacePoint2D[], kept: RoofMitreKeptRangeIn): SectionSpacePoint2D[] =>
  ring.map((c) => ({ ...c, zIn: Math.min(Math.max(c.zIn, kept.startIn), kept.endIn) }));

const ringsDiffer = (a: SectionSpacePoint2D[], b: SectionSpacePoint2D[]): boolean =>
  a.some((c, i) => Math.abs(c.zIn - b[i]!.zIn) > 1e-9 || Math.abs(c.yIn - b[i]!.yIn) > 1e-9);

const zSpanOf = (ring: SectionSpacePoint2D[]): number =>
  Math.max(...ring.map((c) => c.zIn)) - Math.min(...ring.map((c) => c.zIn));

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
function clampIsApproximate(ring: SectionSpacePoint2D[], kept: RoofMitreKeptRangeIn): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (Math.abs(a.yIn - b.yIn) <= 1e-9) continue;
    for (const line of [kept.startIn, kept.endIn]) {
      if ((a.zIn - line) * (b.zIn - line) < -1e-12) return true;
    }
  }
  return false;
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
  o: { widthIn: number; lengthIn: number; mitreIn?: FloorRoofPanelMitre },
): RoofPlanMitreResult {
  const mitre = o.mitreIn ?? NO_FLOOR_ROOF_MITRE;
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
    const farXIn = nearXIn + memberBoxSizeIn(member).xIn;
    const keptNear = roofMitreKeptRangeAtXIn(mitre, o.widthIn, o.lengthIn, nearXIn);
    const keptFar = roofMitreKeptRangeAtXIn(mitre, o.widthIn, o.lengthIn, farXIn);
    const nearRing = clampRing(ring, keptNear);
    const farRing = clampRing(ring, keptFar);

    /* ⚠ **Untouched means UNTOUCHED.** A member wholly inside the kept span
       comes back the object it went in as — which keeps a square panel byte
       for byte, and keeps a mitred panel's un-cut members out of the group key
       and out of the overlap audit's oblique path. */
    if (!ringsDiffer(ring, nearRing) && !ringsDiffer(ring, farRing)) {
      out.push(member);
      continue;
    }

    /* ⚠ A member the cut consumed. Measured on the solid rather than on the
       cut's position: a board whose span has gone to nothing at BOTH of its X
       faces is not there, and one that survives at either face still is. */
    if (zSpanOf(nearRing) <= 1e-9 && zSpanOf(farRing) <= 1e-9) {
      droppedMemberIds.push(member.memberId);
      continue;
    }
    if (clampIsApproximate(ring, keptNear) || clampIsApproximate(ring, keptFar)) {
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

    out.push({
      ...member,
      actualDimsIn: lengthIsSpan ? { ...member.actualDimsIn, lengthIn: longPointIn } : member.actualDimsIn,
      position: {
        ...member.position,
        zIn: minZIn,
        sectionCornersIn: nearRing,
        ...(oblique ? { sectionFarCornersIn: farRing } : {}),
      },
      notes: [member.notes, roofMitreNote(keptNear, keptFar, o.lengthIn)]
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
