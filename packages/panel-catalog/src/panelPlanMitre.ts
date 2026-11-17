import type { PanelMember, PanelSpacePoint2D } from "./componentSchema";
import {
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  braceLongestEdgeIn,
  memberBoxSizeIn,
} from "./panelMemberHelpers";

/* ──────────────────────────────────────────────────────────────────────────
   A PANEL'S END CUT ON AN ANGLE **IN PLAN** — the octagon corner.

   > *"The octagon Gable pieces need to be cut like octagon corners."* —
   > Tommy, 2026-11-16

   Two walls meeting at an octagon corner turn 45deg, so each one's end face
   is raked **half** of that — 22 1/2deg — and the two meet on the corner's
   own bisector. That is the same rule `cornerRakeRad` has described in the
   geometry package since 2026-10-20, and the same number he approved for the
   octagon's corner panels on 2026-10-13.

   ⚠ **Measured before any of this was written, on the 16ft Octagon at a
   15 1/2in wall:** every corner rakes exactly 22.50deg, the short face pulls
   back 15.5 x tan(22.5deg) = **6.4203in**, and until it does, the two walls'
   panel runs **share 99.51 in^2 of plan area at every one of the eight
   corners** — which is t^2 x tan(22.5deg), i.e. precisely the two mitre
   triangles that were not being cut. Eight corners, the full height of the
   row. Nothing reported it, because this app's overlap audit asks whether two
   members of ONE panel share a volume and never asks it of two panels.

   ⚠ **WHICH PIECES FOLLOW THE ANGLE — his decision, 2026-11-16**, taken
   after I measured that cutting every stick to the line is not buildable:

   > **Sheets and plates follow it; the sticks stay square and slide inboard
   > until they clear.**

   The measurements behind that question, all on the same 15 1/2in wall:

   - the EXTERIOR wythe sits 0 to 3 1/2in deep, so the cut eats at most
     **1.449in** there — and its plates already stand 1 1/2in in
     (`PLATE_END_CLEARANCE_IN`), so they were clear of it to begin with;
   - the INTERIOR wythe sits 12 to 15 1/2in deep, where the cut eats
     **4.971in to 6.420in** — its plates and its end post are well inside it;
   - an end POST stands at x 0 to 1 1/2in through 3 1/2in of depth. Cut it to
     the line and **0.051in of it survives at its deep face**. That is a knife
     edge, not a part, which is why a post slides instead of being cut;
   - an end GIRT BAR runs the FULL 15 1/2in depth at x 1 1/2 to 5in, so at the
     interior face it is entirely outside the mitre and has to move too.

   So: **a sheet or a plate takes the 22 1/2deg cut and everything else slides
   in square.** The two wythes' end posts stop lining up with each other,
   which is what a mitre means.

   ⚠ **AND ONE HALF OF HIS ANSWER TURNED OUT NOT TO BE POSSIBLE in a gable
   panel, which is recorded rather than quietly dropped.** Its "plates" are
   edge rails running BETWEEN the end posts in the SAME height band, not sole
   plates under them — so a plate run out to the mitre face occupies exactly
   the wood its own end post stands in, which the overlap audit reports and
   the picture hides. Each plate ends at its own wythe's post instead (see
   `plateRunAtDepth`), and the two wythes' plates come out different lengths.
   **The two full-depth plywood SHEETS are the only pieces that reach the
   mitre face.** The `plate` branch below is still correct and is kept for the
   panel families whose plates DO reach an end — the ground story's corner
   panels are next in line — and it is tested directly, because a mutation
   that removed it changed nothing in any gable panel.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * How far a panel is pulled back from its full `widthIn` rectangle at each of
 * its four plan corners — inches along x, never negative.
 *
 * `start` is the panel's `x = 0` end and `end` its `x = widthIn` end; `Ext` is
 * the wall's EXTERIOR face (`y = 0`) and `Int` its interior one
 * (`y = depthIn`). All four zero — or the field absent — is the rectangle
 * every panel in this app was before 2026-11-16, which is what a box building
 * still gets.
 *
 * ⚠ **Four numbers rather than a pull-back and a boolean.** At a CONVEX
 * corner the exterior face is the long one and the interior pulls back; at a
 * REFLEX corner (the inside of a notch) it is the other way round. Giving
 * each face its own number says both without a flag to get backwards, and it
 * is the same shape `FloorRoofPanelMitre` already uses for the deck.
 */
export interface PanelPlanMitre {
  startExtIn: number;
  startIntIn: number;
  endExtIn: number;
  endIntIn: number;
}

/** Nothing cut back: the identity, and what every rectangle building gets. */
export const NO_PANEL_PLAN_MITRE: PanelPlanMitre = {
  startExtIn: 0,
  startIntIn: 0,
  endExtIn: 0,
  endIntIn: 0,
};

/** Numerical tolerance, in inches. Pull-backs come from one `tan` of an exact
 *  turn angle, so floating-point noise sits many orders below this and a real
 *  mitre is inches. Purely numerical — not a shop tolerance. */
const EPS_IN = 1e-9;

/**
 * True when this really is cut on an angle somewhere.
 *
 * ⚠ **A mitre of all zeros is NOT a mitre**, and that matters beyond
 * tidiness: every box building would otherwise take the mitred path, turn its
 * boxes into trapezoid prisms, change its group key and rebuild parts that
 * are supposed to be byte-identical.
 */
export function hasPanelPlanMitre(mitre?: PanelPlanMitre): boolean {
  if (!mitre) return false;
  return (
    Math.abs(mitre.startExtIn) > EPS_IN ||
    Math.abs(mitre.startIntIn) > EPS_IN ||
    Math.abs(mitre.endExtIn) > EPS_IN ||
    Math.abs(mitre.endIntIn) > EPS_IN
  );
}

/**
 * Where the panel's material starts and ends along x, at one depth through
 * the wall.
 *
 * ⚠ **Linear through the depth, which is exact rather than an
 * approximation**: a mitre is a single plane standing on the corner's
 * bisector, so its trace across the wall's depth is a straight line. (The
 * deck's own `floorRoofMitreZRangeIn` carries a warning here because its
 * outline can turn a corner mid-panel; a wall panel's end face cannot.)
 */
export function panelPlanMitreXRangeIn(
  mitre: PanelPlanMitre,
  widthIn: number,
  depthIn: number,
  atDepthIn: number,
): { startIn: number; endIn: number } {
  /* Clamped so a member reaching a hair past a face reads that face's own cut
     rather than extrapolating the plane beyond the wall. */
  const t = depthIn > 0 ? Math.min(Math.max(atDepthIn / depthIn, 0), 1) : 0;
  return {
    startIn: mitre.startExtIn + t * (mitre.startIntIn - mitre.startExtIn),
    endIn: widthIn - (mitre.endExtIn + t * (mitre.endIntIn - mitre.endExtIn)),
  };
}

/**
 * The x window that clears the mitre over a whole depth BAND — the tightest
 * reading of both of the band's faces.
 *
 * This is what a square-cut stick slides into: a post 3 1/2in deep is clear
 * of the cut only once its deepest face is, so the window is the intersection
 * and not the average.
 */
export function panelPlanMitreClearXRangeIn(
  mitre: PanelPlanMitre,
  widthIn: number,
  depthIn: number,
  fromDepthIn: number,
  toDepthIn: number,
): { startIn: number; endIn: number } {
  const a = panelPlanMitreXRangeIn(mitre, widthIn, depthIn, fromDepthIn);
  const b = panelPlanMitreXRangeIn(mitre, widthIn, depthIn, toDepthIn);
  return { startIn: Math.max(a.startIn, b.startIn), endIn: Math.min(a.endIn, b.endIn) };
}

/**
 * The plan angle of one mitred end, in degrees off square — what the shop
 * sets the saw to. 0 is a square cut.
 */
export function panelPlanMitreAngleDeg(
  mitre: PanelPlanMitre,
  depthIn: number,
  atEnd: "start" | "end",
): number {
  if (!(depthIn > 0)) return 0;
  const runIn =
    atEnd === "start" ? mitre.startIntIn - mitre.startExtIn : mitre.endIntIn - mitre.endExtIn;
  return (Math.atan2(Math.abs(runIn), depthIn) * 180) / Math.PI;
}

/** Is this end cut at all? */
export function panelPlanMitreCutsEnd(mitre: PanelPlanMitre, atEnd: "start" | "end"): boolean {
  return atEnd === "start"
    ? Math.abs(mitre.startExtIn) > EPS_IN || Math.abs(mitre.startIntIn) > EPS_IN
    : Math.abs(mitre.endExtIn) > EPS_IN || Math.abs(mitre.endIntIn) > EPS_IN;
}

/**
 * ⚠ **The shortest a mitred panel's interior face may be and still be
 * framed.** Below this the two end posts have nowhere to stand once they have
 * slid in, and the mitre is refused for that panel rather than drawn as a
 * part nobody can build — the same shape of decision as
 * `gableTopDivesIntoBottom`, and reported the same way.
 *
 * Two post thicknesses: one at each end, touching. Not a shop clearance and
 * not a value anyone confirmed — it is the width at which the framing stops
 * existing, which is a geometric floor rather than a building figure.
 */
export const MIN_MITRED_INTERIOR_LENGTH_IN = 2 * PLATE_2X4_THICKNESS_IN;

/**
 * Does a panel of this size still frame once it is mitred?
 *
 * The one condition is that the interior face stays long enough for the two
 * end posts to stand on once they have slid in. Below that there is no panel
 * left to build and the mitre is refused, with the corner's overlap left in
 * place and said in the Review Log.
 *
 * ⚠ **It used to also require room for the GIRT ROW, and that was the wrong
 * place to put it.** A girt bar runs the full depth of the wall, so a mitre
 * moves it inboard by the whole interior pull-back — 6.420in on a 15 1/2in
 * wall — and on a narrow tile that lands it on the panel's own centre nailer.
 * Refusing the whole mitre for that would have made the feature inert on the
 * building he asked about: the 16ft Octagon's gable row tiles to **19 7/8in**
 * panels (the row takes a joint wherever the wall below has one), and the
 * girt-room test wanted about **24 1/3in**. So the girt ROW answers for
 * itself instead — see `gableGirtRowFitsMitredSpan`. A tile whose mitred span
 * cannot hold a row does not get one, which is the same answer
 * `gableGirtPlan` already gives a short tile, and the mitre still happens.
 */
export function panelPlanMitreFits(
  mitre: PanelPlanMitre,
  widthIn: number,
  depthIn: number,
): boolean {
  if (!hasPanelPlanMitre(mitre)) return true;
  if (!(widthIn > 0) || !(depthIn > 0)) return false;
  for (const atDepthIn of [0, depthIn]) {
    const span = panelPlanMitreXRangeIn(mitre, widthIn, depthIn, atDepthIn);
    if (span.endIn - span.startIn < MIN_MITRED_INTERIOR_LENGTH_IN) return false;
  }
  return true;
}

/**
 * ⚠ **Where an end POST stands once the mitre has moved it, and where the
 * boards that run between the posts therefore end.**
 *
 * One expression, because two panel families need the same answer and a
 * second copy is how they come to disagree. A post is clear of the cut only
 * once its DEEPER face is, so the window is the intersection of its band's
 * two faces and not their average — which is why this takes the band rather
 * than a single depth.
 *
 * `runFromXIn` / `runToXIn` are the post's inner faces: a plate, a blocking
 * board or anything else spanning between the posts at that depth ends there,
 * exactly as it does at a square end. At a square end this returns
 * `0` / `widthIn - postThicknessIn` and the run is the familiar
 * `PLATE_END_CLEARANCE_IN` inset, so an unmitred panel is byte-identical.
 */
export function mitredPostsForBand(
  mitre: PanelPlanMitre,
  widthIn: number,
  depthIn: number,
  bandFromYIn: number,
  bandToYIn: number,
  postThicknessIn: number,
): { leftXIn: number; rightXIn: number; runFromXIn: number; runToXIn: number } {
  const clear = panelPlanMitreClearXRangeIn(mitre, widthIn, depthIn, bandFromYIn, bandToYIn);
  const leftXIn = Math.min(Math.max(0, clear.startIn), widthIn - postThicknessIn);
  const rightXIn = Math.max(Math.min(widthIn - postThicknessIn, clear.endIn - postThicknessIn), 0);
  return {
    leftXIn,
    rightXIn,
    runFromXIn: leftXIn + postThicknessIn,
    runToXIn: rightXIn,
  };
}

/**
 * ⚠ **Can a girt row be framed inside this x window, clear of the panel's own
 * verticals?**
 *
 * A row puts a bar `PLATE_2X4_THICKNESS_IN` inside each end of its window and
 * the bar is `PLATE_2X4_WIDTH_IN` across, so a window has to hold two of them
 * without their meeting, and without either landing on a centre nailer or
 * centre stud — which do NOT move, because a centre stud stacks on the wall
 * stud below it.
 *
 * ⚠ **With no mitre this is always true**, which is what keeps every panel
 * in this app byte-identical: a bar at 1 1/2in and the first bay division at
 * half the panel's width are never within 3 1/2in of each other on anything
 * this app builds. It only ever answers false for a window a mitre has
 * narrowed.
 */
export function gableGirtRowFitsMitredSpan(
  widthIn: number,
  spanFromXIn: number,
  spanToXIn: number,
  verticalSpansIn: readonly (readonly [number, number])[],
): boolean {
  const bars: [number, number][] = [
    [spanFromXIn + PLATE_2X4_THICKNESS_IN, spanFromXIn + PLATE_2X4_THICKNESS_IN + PLATE_2X4_WIDTH_IN],
    [spanToXIn - PLATE_2X4_THICKNESS_IN - PLATE_2X4_WIDTH_IN, spanToXIn - PLATE_2X4_THICKNESS_IN],
  ];
  if (bars[1]![0] - bars[0]![1] < -EPS_IN) return false;
  if (bars[0]![0] < -EPS_IN || bars[1]![1] > widthIn + EPS_IN) return false;
  for (const bar of bars)
    for (const vertical of verticalSpansIn)
      if (bar[0] < vertical[1] - EPS_IN && vertical[0] < bar[1] - EPS_IN) return false;
  return true;
}

/**
 * One PANEL's share of a whole wall's mitre — a tile takes a corner's cut only
 * if it actually reaches that corner.
 *
 * ⚠ **Keyed on the tile's own x range, not on its index in the row.** A gable
 * row's first tile is usually at the wall's start corner, but not always: a
 * safety gap can occupy the corner instead, a truss-plate inset can hold the
 * row off it, and a Smearforn run stop can stop the row short of it. In every
 * one of those the panel beside the corner is NOT at the corner and must stay
 * square, and asking where the tile is answers all of them at once.
 *
 * ⚠ **The tolerance is 1/8in, and it is doing real work rather than
 * guarding floating point.** Measured on the 16ft Octagon: a diagonal facet
 * is 79.550in long and its row tiles to 39.75 + 39.75 = **79.500in**, because
 * the tiler rounds a panel width to eighths. So the last tile stops 0.050in
 * short of the corner, and a tolerance of a thousandth left every diagonal
 * facet's far end UNMITRED — which looked exactly like a mitre that only
 * worked at one end of a wall.
 *
 * ⚠ It cannot swallow a real inset: the smallest thing that genuinely holds
 * a row off a corner is the truss-plate inset at 5 1/2in, and a safety gap is
 * a whole panel wide. 1/8in is 44 times smaller than the first of those and
 * is the tiler's own quantum.
 *
 * ⚠ **The 0.050in itself is a pre-existing gap and is NOT fixed here** — the
 * row really does stop a twentieth of an inch short of the corner on those
 * facets, which is a dimensional-tightness question about the tiler and not
 * about the mitre.
 */
export function panelPlanMitreForSpan(
  wallMitre: PanelPlanMitre,
  tileStartIn: number,
  tileEndIn: number,
  wallLengthIn: number,
  tolIn = 0.125,
): PanelPlanMitre {
  const atStart = tileStartIn <= tolIn;
  const atEnd = tileEndIn >= wallLengthIn - tolIn;
  return {
    startExtIn: atStart ? wallMitre.startExtIn : 0,
    startIntIn: atStart ? wallMitre.startIntIn : 0,
    endExtIn: atEnd ? wallMitre.endExtIn : 0,
    endIntIn: atEnd ? wallMitre.endIntIn : 0,
  };
}

/**
 * A CORNER PANEL's share of its wall's mitre, from its slot index alone.
 *
 * ⚠ **Only the slot INDEX is needed, and that is worth justifying rather
 * than looking clever.** A corner-typed slot exists only at a wall END — the
 * tiler emits exactly two per wall on a mitred shape, `corner` at the start
 * and `safety-oct-corner` at the finish (measured on the 16ft Octagon:
 * `corner 25.5 | gap 0.5 | standard 28 | safety-oct-corner 25.5`). So index 0
 * is the start corner and any other corner slot is the end one, and no caller
 * has to carry a slot count around to work that out — which matters because
 * the ground and second stories keep separate slot records.
 *
 * ⚠ On a right-angled building `wallMitre` is all zeros, so this returns
 * "not mitred" whatever the index, and every rectangle stays byte-identical.
 */
export function cornerPanelPlanMitre(wallMitre: PanelPlanMitre, slotIndexInWall: number): PanelPlanMitre {
  const atStart = slotIndexInWall === 0;
  return {
    startExtIn: atStart ? wallMitre.startExtIn : 0,
    startIntIn: atStart ? wallMitre.startIntIn : 0,
    endExtIn: atStart ? 0 : wallMitre.endExtIn,
    endIntIn: atStart ? 0 : wallMitre.endIntIn,
  };
}

/** One member the mitre could not be applied to, and why. */
export interface PlanMitreRefusal {
  memberId: string;
  reason: string;
}

type Quad = [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D];

/**
 * Clip one elevation (X-Z) quad to an x window, carrying z along the quad's
 * own edges.
 *
 * ⚠ **Only quads whose two END edges stand at constant x can be clipped this
 * way, and every member this app mitres is one** — a plate, a skin and a stud
 * all have plumb ends by construction (`plumbEndedSlopedBoardCornersIn`,
 * `buildGableCornerStuds`). The sloped edge is the TOP, and clipping it means
 * following that slope down, which a plain `clamp` on x would not do: it
 * would leave a plate's cut corner standing at the height it had further
 * along the rake. Returns `null` for a quad this cannot describe, so the
 * caller refuses out loud instead of drawing a deformed board.
 */
function clipQuadToXRange(quad: Quad, startIn: number, endIn: number): Quad | null {
  const xs = quad.map((p) => p.xIn);
  const loX = Math.min(...xs);
  const hiX = Math.max(...xs);
  if (!(hiX - loX > EPS_IN)) return null;
  if (quad.some((p) => Math.abs(p.xIn - loX) > EPS_IN && Math.abs(p.xIn - hiX) > EPS_IN)) return null;
  const atLo = quad.filter((p) => Math.abs(p.xIn - loX) <= EPS_IN);
  const atHi = quad.filter((p) => Math.abs(p.xIn - hiX) <= EPS_IN);
  if (atLo.length !== 2 || atHi.length !== 2) return null;
  const topLoZ = Math.max(atLo[0]!.zIn, atLo[1]!.zIn);
  const botLoZ = Math.min(atLo[0]!.zIn, atLo[1]!.zIn);
  const topHiZ = Math.max(atHi[0]!.zIn, atHi[1]!.zIn);
  const botHiZ = Math.min(atHi[0]!.zIn, atHi[1]!.zIn);

  const newLoX = Math.max(loX, startIn);
  const newHiX = Math.min(hiX, endIn);
  if (!(newHiX - newLoX > EPS_IN)) return null;
  const lerp = (a: number, b: number, atX: number) => a + ((b - a) * (atX - loX)) / (hiX - loX);
  const topAt = (atX: number) => lerp(topLoZ, topHiZ, atX);
  const botAt = (atX: number) => lerp(botLoZ, botHiZ, atX);

  /* Each corner keeps its own end (lo or hi) and its own role (top or bottom),
     so the quad comes back in the SAME vertex order it went in — winding, and
     therefore every face normal downstream, is untouched. */
  return quad.map((p) => {
    const isLo = Math.abs(p.xIn - loX) <= EPS_IN;
    const atX = isLo ? newLoX : newHiX;
    const isTop = isLo ? p.zIn >= topLoZ - EPS_IN : p.zIn >= topHiZ - EPS_IN;
    return { xIn: atX, zIn: isTop ? topAt(atX) : botAt(atX) };
  }) as Quad;
}

/** Which pieces take the angled cut, per his 2026-11-16 decision. Everything
 *  else slides in square. */
function roleTakesTheCut(role: PanelMember["role"]): boolean {
  return role === "skin" || role === "plate";
}

/**
 * ⚠ **THE WHOLE PANEL, CUT TO ITS MITRED PLAN OUTLINE — one pass over the
 * finished member list rather than a parameter threaded into a dozen
 * builders.**
 *
 * The same shape as `cutRingGirtsAroundVerticals`, and for the same reason: a
 * rule about where material may be is a property of the assembled panel, not
 * of each board's own builder. It also means the next panel type to need this
 * — the ground story's corner panels carry the identical uncut overlap —
 * needs no new geometry, only this call.
 *
 * - **Sheets and plates are CLIPPED** to the mitre at each of their own two
 *   depth faces. A board whose two faces end at different x is no longer a
 *   box, so it becomes an oblique prism (`trapezoidFarCornersIn`), which the
 *   overlap audit already routes through an exact 3D test.
 * - **Everything else SLIDES** inboard, square, until it clears — his
 *   decision, and the only buildable answer for a post the cut would reduce
 *   to 0.051in.
 * - A member with no room left at all is **dropped and reported**. Silently
 *   keeping it would leave the overlap this whole pass exists to remove.
 *
 * ⚠ **A member already clear of the cut is returned UNTOUCHED, by identity.**
 * That is what keeps every box building, and every unmitred tile of a mitred
 * one, byte-identical.
 */
export function mitrePanelMembersInPlan(
  members: readonly PanelMember[],
  widthIn: number,
  depthIn: number,
  mitre: PanelPlanMitre,
): { members: PanelMember[]; refusals: PlanMitreRefusal[] } {
  if (!hasPanelPlanMitre(mitre)) return { members: [...members], refusals: [] };
  const refusals: PlanMitreRefusal[] = [];
  const out: PanelMember[] = [];
  const xRangeAt = (atDepthIn: number) =>
    panelPlanMitreXRangeIn(mitre, widthIn, depthIn, atDepthIn);

  for (const member of members) {
    const { trapezoidCornersIn, trapezoidFarCornersIn, planPolygonCornersIn, sectionCornersIn } =
      member.position;

    if (planPolygonCornersIn || sectionCornersIn) {
      /* Neither shape appears in any panel this is applied to today. Said out
         loud rather than ignored, because ignoring it is the failure mode that
         leaves wood in two places. */
      refusals.push({
        memberId: member.memberId,
        reason: "its shape is a plan or section prism, which this pass cannot cut",
      });
      out.push(member);
      continue;
    }

    if (trapezoidCornersIn) {
      const halfDepthIn = (member.position.trapezoidDepthIn ?? member.actualDimsIn.thicknessIn) / 2;
      const nearDepthIn = member.position.yIn - halfDepthIn;
      const farDepthIn = member.position.yIn + halfDepthIn;
      const nearQuad = trapezoidCornersIn;
      const farQuad = trapezoidFarCornersIn ?? trapezoidCornersIn;
      const nearWindow = xRangeAt(nearDepthIn);
      const farWindow = xRangeAt(farDepthIn);
      const quadXSpan = (q: Quad) => {
        const xs = q.map((p) => p.xIn);
        return { loIn: Math.min(...xs), hiIn: Math.max(...xs) };
      };
      const nearSpan = quadXSpan(nearQuad);
      const farSpan = quadXSpan(farQuad);
      const clearOf = (span: { loIn: number; hiIn: number }, w: { startIn: number; endIn: number }) =>
        span.loIn >= w.startIn - EPS_IN && span.hiIn <= w.endIn + EPS_IN;
      if (clearOf(nearSpan, nearWindow) && clearOf(farSpan, farWindow)) {
        out.push(member);
        continue;
      }
      if (!roleTakesTheCut(member.role)) {
        const slid = slideMemberInPlan(member, nearSpan, farSpan, nearWindow, farWindow);
        if (slid === null) {
          refusals.push({
            memberId: member.memberId,
            reason: "no square position inside the mitre is wide enough for it",
          });
          continue;
        }
        out.push(slid);
        continue;
      }
      const clippedNear = clipQuadToXRange(nearQuad, nearWindow.startIn, nearWindow.endIn);
      const clippedFar = clipQuadToXRange(farQuad, farWindow.startIn, farWindow.endIn);
      if (!clippedNear || !clippedFar) {
        refusals.push({
          memberId: member.memberId,
          reason: "the mitre leaves it nothing at one of its two depth faces",
        });
        continue;
      }
      out.push(withClippedQuads(member, clippedNear, clippedFar, nearDepthIn, farDepthIn));
      continue;
    }

    /* A plain axis-aligned box. `tiltDeg` would rotate it about its centre,
       which no member in a mitred panel does; refused rather than cut on the
       wrong axis. */
    if (member.position.tiltDeg !== undefined) {
      refusals.push({ memberId: member.memberId, reason: "it is a tilted box, which this pass cannot cut" });
      out.push(member);
      continue;
    }
    const sizeIn = memberBoxSizeIn(member);
    const loIn = member.position.xIn;
    const hiIn = loIn + sizeIn.xIn;
    const nearDepthIn = member.position.yIn;
    const farDepthIn = member.position.yIn + sizeIn.yIn;
    const nearWindow = xRangeAt(nearDepthIn);
    const farWindow = xRangeAt(farDepthIn);
    const span = { loIn, hiIn };
    const clearOf = (w: { startIn: number; endIn: number }) =>
      loIn >= w.startIn - EPS_IN && hiIn <= w.endIn + EPS_IN;
    if (clearOf(nearWindow) && clearOf(farWindow)) {
      out.push(member);
      continue;
    }
    if (!roleTakesTheCut(member.role)) {
      const slid = slideMemberInPlan(member, span, span, nearWindow, farWindow);
      if (slid === null) {
        refusals.push({
          memberId: member.memberId,
          reason: "no square position inside the mitre is wide enough for it",
        });
        continue;
      }
      out.push(slid);
      continue;
    }
    const z0 = member.position.zIn;
    const z1 = z0 + sizeIn.zIn;
    const nearLo = Math.max(loIn, nearWindow.startIn);
    const nearHi = Math.min(hiIn, nearWindow.endIn);
    const farLo = Math.max(loIn, farWindow.startIn);
    const farHi = Math.min(hiIn, farWindow.endIn);
    if (!(nearHi - nearLo > EPS_IN) || !(farHi - farLo > EPS_IN)) {
      refusals.push({
        memberId: member.memberId,
        reason: "the mitre leaves it nothing at one of its two depth faces",
      });
      continue;
    }
    const quadAt = (a: number, b: number): Quad => [
      { xIn: a, zIn: z0 },
      { xIn: b, zIn: z0 },
      { xIn: b, zIn: z1 },
      { xIn: a, zIn: z1 },
    ];
    out.push(
      withClippedQuads(
        member,
        quadAt(nearLo, nearHi),
        quadAt(farLo, farHi),
        nearDepthIn,
        farDepthIn,
        sizeIn.yIn,
      ),
    );
  }
  return { members: out, refusals };
}

/**
 * Move a square-cut stick inboard until it clears the cut, keeping its own
 * size. Returns `null` when the clear window is narrower than the piece —
 * there is no position that works, and the caller reports it.
 *
 * ⚠ **The window is the INTERSECTION of the member's two depth faces**, not
 * the average: a post 3 1/2in deep is clear only once its deeper face is.
 */
function slideMemberInPlan(
  member: PanelMember,
  nearSpan: { loIn: number; hiIn: number },
  farSpan: { loIn: number; hiIn: number },
  nearWindow: { startIn: number; endIn: number },
  farWindow: { startIn: number; endIn: number },
): PanelMember | null {
  const loIn = Math.min(nearSpan.loIn, farSpan.loIn);
  const hiIn = Math.max(nearSpan.hiIn, farSpan.hiIn);
  const startIn = Math.max(nearWindow.startIn, farWindow.startIn);
  const endIn = Math.min(nearWindow.endIn, farWindow.endIn);
  const lengthIn = hiIn - loIn;
  if (endIn - startIn < lengthIn - EPS_IN) return null;
  const shiftIn = loIn < startIn ? startIn - loIn : hiIn > endIn ? endIn - hiIn : 0;
  if (Math.abs(shiftIn) <= EPS_IN) return member;
  const shiftQuad = (q: Quad): Quad => q.map((p) => ({ xIn: p.xIn + shiftIn, zIn: p.zIn })) as Quad;
  const { trapezoidCornersIn, trapezoidFarCornersIn } = member.position;
  return {
    ...member,
    position: {
      ...member.position,
      xIn: member.position.xIn + shiftIn,
      ...(trapezoidCornersIn && { trapezoidCornersIn: shiftQuad(trapezoidCornersIn) }),
      ...(trapezoidFarCornersIn && { trapezoidFarCornersIn: shiftQuad(trapezoidFarCornersIn) }),
    },
    notes:
      `${member.notes ? `${member.notes} ` : ""}Slid ${Math.abs(shiftIn).toFixed(3)}in ` +
      `${shiftIn > 0 ? "right" : "left"} to clear the panel's mitred end — this piece is cut SQUARE; ` +
      "the sheets and plates take the angle.",
  };
}

/**
 * Rewrite a member as the oblique prism between two clipped elevation quads.
 *
 * ⚠ **`yIn` becomes the CENTRE of the depth band, not its near face.** A
 * trapezoid prism is read as `yIn +- trapezoidDepthIn / 2`, while a plain box
 * anchors on its min corner — the same footgun the deck's mitred joists
 * carry a warning about, and the one that would push a clipped plate half its
 * own width out of the wall.
 *
 * ⚠ **`lengthIn` becomes the LONG POINT**, the way every other angle-cut
 * member in this app is dimensioned: a shop cuts to the long point and reads
 * the angle off the note.
 */
function withClippedQuads(
  member: PanelMember,
  nearQuad: Quad,
  farQuad: Quad,
  nearDepthIn: number,
  farDepthIn: number,
  depthSpanIn?: number,
): PanelMember {
  const sameQuad =
    nearQuad.every((p, i) => Math.abs(p.xIn - farQuad[i]!.xIn) <= EPS_IN && Math.abs(p.zIn - farQuad[i]!.zIn) <= EPS_IN);
  const allXs = [...nearQuad, ...farQuad].map((p) => p.xIn);
  const allZs = [...nearQuad, ...farQuad].map((p) => p.zIn);
  return {
    ...member,
    actualDimsIn: {
      ...member.actualDimsIn,
      lengthIn: Math.max(braceLongestEdgeIn(nearQuad), braceLongestEdgeIn(farQuad)),
    },
    position: {
      ...member.position,
      xIn: Math.min(...allXs),
      yIn: (nearDepthIn + farDepthIn) / 2,
      zIn: Math.min(...allZs),
      trapezoidDepthIn: depthSpanIn ?? member.position.trapezoidDepthIn ?? farDepthIn - nearDepthIn,
      trapezoidCornersIn: nearQuad,
      ...(sameQuad ? {} : { trapezoidFarCornersIn: farQuad }),
    },
  };
}
