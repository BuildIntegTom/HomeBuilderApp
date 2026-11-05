import type { PanelMember } from "./componentSchema";
import { memberLocalCornersIn, SKIN_THICKNESS_IN } from "./panelMemberHelpers";

/**
 * **THE STRAW, AS A VOLUME YOU CAN SEE — his ask, 2026-11-04.**
 *
 * > *"I mean ideally we could also model out the straw too - let's add 3D straw
 * > volume infill with texture toggle option."*
 *
 * One semi-transparent box per panel, filling the cavity its frame encloses.
 * The single-panel preview (`StandardPanel3DView`) has had exactly this since
 * early on, derived inline from that one panel's own skins; this is that
 * derivation lifted out so the WHOLE BUILDING can show it, and so the two can
 * never draw the straw in two different places.
 *
 * ⚠ **It is illustrative, and the existing readout already says so**: the box
 * is not cut around the studs, girts and braces standing inside it, exactly as
 * `computeStandardPanelStrawVolume` is not. It shows WHERE the straw is and
 * roughly how much, not a packing quantity.
 *
 * ⚠ **Everything here is VIEW space** (X = width, Y = height up, Z = depth),
 * the frame `PanelMembersGroup` renders in and `memberLocalCornersIn` returns —
 * NOT the member space a builder authors `position` in. Doing the bounding box
 * off `memberLocalCornersIn` rather than off `position` + `memberBoxSizeIn` is
 * deliberate: it is the one function that already knows how to place a tilted
 * brace, a trapezoid prism and a beveled roof-panel end, so a gable or a
 * cross-tilted panel measures correctly without this file knowing what those
 * are.
 */
export interface StrawFillBoxIn {
  /** Box centre, view space, inches. */
  centerIn: [number, number, number];
  /** Box size, view space, inches. */
  sizeIn: [number, number, number];
}

/** A cap is a SKIN thin enough to be one: a 3/4in sheet, not a header's own
 * full-height end plate (which is also role `skin`, and whose Y-extent spans
 * the whole panel). Matched on thickness rather than on a member-id list, so a
 * wall panel's `bottom_plate_skin` and a floor panel's own end lid both qualify
 * without naming either. */
const CAP_TOLERANCE_IN = 0.01;

function isCapSkin(member: PanelMember, minYIn: number, maxYIn: number): boolean {
  if (member.role !== "skin") return false;
  /* A SLOPED cap (a gable's raked top skin) is thin in its own normal but
     spans feet in Y, so measure the sheet itself rather than its bounding
     box. */
  if (member.position.trapezoidCornersIn !== undefined) {
    return member.actualDimsIn.thicknessIn <= SKIN_THICKNESS_IN + CAP_TOLERANCE_IN;
  }
  return maxYIn - minYIn <= SKIN_THICKNESS_IN + CAP_TOLERANCE_IN;
}

/**
 * The straw volume a panel's frame encloses, as one box.
 *
 * Full width and full depth — a straw-bale wall panel is open on both faces,
 * which is why the single-panel view has always drawn it that way — and in
 * HEIGHT, between the capping skins:
 *
 * - the straw starts at the TOP of the highest bottom cap, and
 * - stops at the BOTTOM of the lowest top cap.
 *
 * ⚠ **Taking the LOWEST point of a sloped cap is what keeps straw inside a
 * gable panel.** A raked top skin's lowest corner is its low edge; stopping
 * there leaves the triangle above it unfilled, which under-draws the straw
 * rather than letting a box poke out through the rake. Under-drawn and inside
 * the panel beats accurate and outside it.
 *
 * Returns null when there is nothing to draw: no members, or caps that leave
 * no room between them.
 */
export function strawFillBoxIn(members: PanelMember[]): StrawFillBoxIn | null {
  if (members.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  /** Top of the highest bottom cap, and bottom of the lowest top cap. */
  let capBottomIn = -Infinity;
  let capTopIn = Infinity;

  const measured = members.map((member) => {
    const corners = memberLocalCornersIn(member);
    let mnY = Infinity;
    let mxY = -Infinity;
    for (const [x, y, z] of corners) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      if (y < mnY) mnY = y;
      if (y > mxY) mxY = y;
    }
    return { member, mnY, mxY };
  });

  const midYIn = (minY + maxY) / 2;
  for (const { member, mnY, mxY } of measured) {
    if (!isCapSkin(member, mnY, mxY)) continue;
    /* Which end it caps is decided by where its own middle sits, so a panel
       with only one cap still gets a sensible box. */
    if ((mnY + mxY) / 2 < midYIn) {
      if (mxY > capBottomIn) capBottomIn = mxY;
    } else if (mnY < capTopIn) {
      capTopIn = mnY;
    }
  }

  const strawBottomIn = capBottomIn === -Infinity ? minY : capBottomIn;
  const strawTopIn = capTopIn === Infinity ? maxY : capTopIn;
  if (!(strawTopIn > strawBottomIn)) return null;
  if (!(maxX > minX) || !(maxZ > minZ)) return null;

  return {
    centerIn: [(minX + maxX) / 2, (strawBottomIn + strawTopIn) / 2, (minZ + maxZ) / 2],
    sizeIn: [maxX - minX, strawTopIn - strawBottomIn, maxZ - minZ],
  };
}
