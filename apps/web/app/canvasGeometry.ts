import type * as React from "react";
import {
  cornerTurnAngleRad,
  footprintIsAllRightAngles,
  type Footprint,
  type PanelSlot,
  type Wall,
} from "@building-integrity/geometry";

/** Screen-space (px) point — distinct from the ft-space `Point` used
 * throughout `packages/geometry`. Everything in this module converts
 * between the two via `SCALE_PX_PER_FT`. */
export interface DragPoint {
  x: number;
  y: number;
}

export const SCALE_PX_PER_FT = 12;
export const CORNER_MARKER_OFFSET_PX = 16;
// Mirrors packages/geometry/src/octagon.ts's CLIP_RATIO — kept in sync
// manually since this is just a screen-space preview outline, not the
// actual footprint geometry.
export const OCTAGON_CLIP_RATIO = 1 - 1 / Math.SQRT2;

/**
 * Extracts client coordinates from either a mouse or touch event (React
 * synthetic or native) — mobile touch input was silently doing nothing
 * because every canvas only wired up mouse handlers (Tommy: "input from a
 * cellphone finger touch"). Touch coordinates live one level deeper
 * (`touches[0]`) than mouse's direct `clientX`/`clientY`; touchend has an
 * empty `touches` list (the finger's already lifted), so that falls back
 * to `changedTouches` instead. Returns null only for a touchend/touchcancel
 * with no touch data at all (shouldn't normally happen).
 *
 * `touchId` (Tommy, mobile: "after a while... the image gets dragged and
 * makes a mess when you pan around") pins this to one specific finger by
 * its stable `identifier` — without it, a multi-touch drag gesture (e.g. a
 * panning finger plus an incidental second touch from a resting palm)
 * would silently grab whichever touch happens to be `touches[0]` on each
 * event, which can jump to a completely different finger mid-gesture once
 * the original touch's list position shifts, producing a sudden huge
 * position delta. Callers that track a gesture across multiple events
 * (panning) should capture the first touch's `identifier` at gesture start
 * and pass it on every subsequent call; one-shot readers (measure) can
 * omit it and keep the old "just use touches[0]" behavior.
 */
export function clientPointFromEvent(
  evt: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
  touchId?: number,
): { clientX: number; clientY: number } | null {
  if ("touches" in evt) {
    const find = (list: TouchList | React.TouchList) =>
      touchId != null ? Array.from(list).find((t) => t.identifier === touchId) : list[0];
    const touch = find(evt.touches) ?? find(evt.changedTouches);
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
  }
  return { clientX: evt.clientX, clientY: evt.clientY };
}

/** Pulls the identifier of the first active touch off a touch event, for
 * pinning a subsequent `clientPointFromEvent` call to that same finger —
 * see its doc comment. Returns undefined for a mouse event (no touches to
 * pin to; harmless since `clientPointFromEvent` ignores `touchId` for mice). */
export function firstTouchId(evt: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): number | undefined {
  return "touches" in evt ? evt.touches[0]?.identifier : undefined;
}

export const WALL_PICK_TOLERANCE_PX = 20;
const SPAN_SNAP_FLUSH_THRESHOLD_FT = 1; // under this distance from a corner, snap flush to it
const SPAN_SNAP_MIN_REMAINDER_FT = 2; // Tommy: never leave a remainder wall shorter than this
const OCTAGON_SQUARE_SNAP_PX = 20; // within this, a dragged octagon box snaps to a perfect square
const LABEL_OFFSET_PX = 18;

const CORNER_SLOT_TYPES: PanelSlot["type"][] = ["corner", "safety-oct-corner"];

/** Snaps a span endpoint (measured in ft along the wall from its start
 * corner) so the remainder on whichever side it's nearer to is either
 * flush (0ft) or at least `SPAN_SNAP_MIN_REMAINDER_FT` — never landing in
 * the dead zone between, which would create a "funny tiny wall" (Tommy). */
export function snapSpanPointFt(rawFt: number, wallLengthFt: number): number {
  const distFromStart = rawFt;
  const distFromEnd = wallLengthFt - rawFt;
  const nearStart = distFromStart <= distFromEnd;
  const dist = nearStart ? distFromStart : distFromEnd;
  if (dist >= SPAN_SNAP_MIN_REMAINDER_FT) return rawFt;
  const snapped = dist < SPAN_SNAP_FLUSH_THRESHOLD_FT ? 0 : SPAN_SNAP_MIN_REMAINDER_FT;
  return nearStart ? snapped : wallLengthFt - snapped;
}

/** A regular (fully symmetric) octagon needs an equal width/depth bounding
 * box — an unequal one still clips all 4 corners the same amount (see
 * octagon.ts's CLIP_RATIO comment) but the 4 straight sides end up 2
 * different lengths, which reads as slightly "off" once you're this close
 * to square anyway (Tommy). Snaps a dragged box's width/height together
 * (to their average) whenever they're within `OCTAGON_SQUARE_SNAP_PX` of
 * each other, leaving genuinely elongated drags untouched. */
export function snapOctagonBoxPx(widthPx: number, heightPx: number): { widthPx: number; heightPx: number } {
  if (Math.abs(widthPx - heightPx) > OCTAGON_SQUARE_SNAP_PX) return { widthPx, heightPx };
  const avg = (widthPx + heightPx) / 2;
  return { widthPx: avg, heightPx: avg };
}

/** A wall's two endpoints in screen (px) space. */
export function wallPointsPx(
  wall: Wall,
  corners: Footprint["corners"],
  offsetPx: DragPoint,
): { startPx: DragPoint; endPx: DragPoint } {
  const start = corners.find((c) => c.id === wall.startCorner)!.point;
  const end = corners.find((c) => c.id === wall.endCorner)!.point;
  return {
    startPx: { x: start.x * SCALE_PX_PER_FT + offsetPx.x, y: start.y * SCALE_PX_PER_FT + offsetPx.y },
    endPx: { x: end.x * SCALE_PX_PER_FT + offsetPx.x, y: end.y * SCALE_PX_PER_FT + offsetPx.y },
  };
}

/** Every wall within `WALL_PICK_TOLERANCE_PX` of a screen point, nearest
 * first, each with how far along it (in ft, clamped to the segment) the
 * point projects to. Near a corner, two perpendicular walls can both be
 * within tolerance — callers that care about picking the wall the user
 * actually means to drag along (not just the nearest by raw perpendicular
 * distance) should use `pickWallByDragDirection` to disambiguate once a
 * drag direction is known, rather than assuming the first entry is right. */
export function findNearestWallCandidates(
  point: DragPoint,
  footprint: Footprint,
  offsetPx: DragPoint,
): { wall: Wall; alongFt: number; distPx: number }[] {
  const results: { wall: Wall; alongFt: number; distPx: number }[] = [];
  for (const wall of footprint.walls) {
    const { startPx, endPx } = wallPointsPx(wall, footprint.corners, offsetPx);
    const lengthPx = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
    const dir = { x: (endPx.x - startPx.x) / lengthPx, y: (endPx.y - startPx.y) / lengthPx };
    const rel = { x: point.x - startPx.x, y: point.y - startPx.y };
    const alongPxClamped = Math.max(0, Math.min(lengthPx, rel.x * dir.x + rel.y * dir.y));
    const closest = { x: startPx.x + dir.x * alongPxClamped, y: startPx.y + dir.y * alongPxClamped };
    const distPx = Math.hypot(point.x - closest.x, point.y - closest.y);
    if (distPx <= WALL_PICK_TOLERANCE_PX) {
      results.push({ wall, alongFt: alongPxClamped / SCALE_PX_PER_FT, distPx });
    }
  }
  results.sort((a, b) => a.distPx - b.distPx);
  return results;
}

/** Which wall (if any, within `WALL_PICK_TOLERANCE_PX`) a screen point is
 * nearest to, and how far along that wall (in ft, clamped to the segment)
 * the point projects to — the anchor for starting a bump-out's span drag. */
export function findNearestWall(
  point: DragPoint,
  footprint: Footprint,
  offsetPx: DragPoint,
): { wall: Wall; alongFt: number; distPx: number } | null {
  const best = findNearestWallCandidates(point, footprint, offsetPx)[0];
  if (!best) return null;
  return { ...best, alongFt: snapSpanPointFt(best.alongFt, best.wall.lengthFt) };
}

/** Disambiguates which of several near-corner wall candidates (from
 * `findNearestWallCandidates`) the user actually means to drag along, by
 * picking whichever wall's own direction is most parallel (in either
 * direction — hence `Math.abs`) to the observed drag vector so far. Fixes
 * the "bump-out selection follows perpendicular instead of the perimeter"
 * bug: a mousedown a few px right and several px down from a corner is
 * geometrically closer to a vertical wall's line than a horizontal one's,
 * even when the user's very next mousemove is clearly horizontal — raw
 * closest-point distance alone can't tell those two cases apart, but the
 * drag direction can. */
export function pickWallByDragDirection(
  downPos: DragPoint,
  currentPos: DragPoint,
  candidates: { wall: Wall; alongFt: number; distPx: number }[],
  corners: Footprint["corners"],
  offsetPx: DragPoint,
): { wall: Wall; alongFt: number; distPx: number } {
  const dragVec = { x: currentPos.x - downPos.x, y: currentPos.y - downPos.y };
  const dragLen = Math.hypot(dragVec.x, dragVec.y) || 1;
  const dragDir = { x: dragVec.x / dragLen, y: dragVec.y / dragLen };
  let best = candidates[0]!;
  let bestAlignment = -Infinity;
  for (const candidate of candidates) {
    const { startPx, endPx } = wallPointsPx(candidate.wall, corners, offsetPx);
    const lengthPx = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
    const wallDir = { x: (endPx.x - startPx.x) / lengthPx, y: (endPx.y - startPx.y) / lengthPx };
    const alignment = Math.abs(dragDir.x * wallDir.x + dragDir.y * wallDir.y);
    if (alignment > bestAlignment) {
      bestAlignment = alignment;
      best = candidate;
    }
  }
  return best;
}

/** Projects a screen point onto a wall's line, clamped to the segment,
 * returning the along-wall distance in ft from the wall's start corner. */
export function projectOntoWallFt(
  point: DragPoint,
  wall: Wall,
  corners: Footprint["corners"],
  offsetPx: DragPoint,
): number {
  const { startPx, endPx } = wallPointsPx(wall, corners, offsetPx);
  const lengthPx = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
  const dir = { x: (endPx.x - startPx.x) / lengthPx, y: (endPx.y - startPx.y) / lengthPx };
  const rel = { x: point.x - startPx.x, y: point.y - startPx.y };
  return Math.max(0, Math.min(lengthPx, rel.x * dir.x + rel.y * dir.y)) / SCALE_PX_PER_FT;
}

/** Signed perpendicular distance (ft) from a wall's line to a screen point,
 * positive = outward (away from the footprint's centroid, an addition),
 * negative = inward (a notch) — the live "depth" reading for a bump-out. */
export function signedDepthFt(point: DragPoint, wall: Wall, footprint: Footprint, offsetPx: DragPoint): number {
  const { startPx, endPx } = wallPointsPx(wall, footprint.corners, offsetPx);
  const lengthPx = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
  const dir = { x: (endPx.x - startPx.x) / lengthPx, y: (endPx.y - startPx.y) / lengthPx };
  const perp = { x: -dir.y, y: dir.x };
  const centerFt = {
    x: footprint.corners.reduce((sum, c) => sum + c.point.x, 0) / footprint.corners.length,
    y: footprint.corners.reduce((sum, c) => sum + c.point.y, 0) / footprint.corners.length,
  };
  const centerPx = { x: centerFt.x * SCALE_PX_PER_FT + offsetPx.x, y: centerFt.y * SCALE_PX_PER_FT + offsetPx.y };
  const midPx = { x: (startPx.x + endPx.x) / 2, y: (startPx.y + endPx.y) / 2 };
  const outward =
    perp.x * (midPx.x - centerPx.x) + perp.y * (midPx.y - centerPx.y) >= 0 ? perp : { x: -perp.x, y: -perp.y };
  const rel = { x: point.x - midPx.x, y: point.y - midPx.y };
  return (rel.x * outward.x + rel.y * outward.y) / SCALE_PX_PER_FT;
}

/** Signed perpendicular distance (ft) from a wall's ORIGINAL line to a
 * screen point — the live "how far has this wall been dragged" reading for
 * the drag-wall tool. Unlike `signedDepthFt`, the sign is NOT flipped to
 * "outward from centroid" — dragging a wall inward is just as valid as
 * outward here, there's no addition/notch asymmetry to orient by — it's
 * simply positive on whichever side `perp = rotate(dir, 90deg)` points to,
 * the same raw convention `dragWall` itself uses internally, so this value
 * can be passed straight through as `offsetFt`. */
export function signedPerpOffsetFt(point: DragPoint, wall: Wall, footprint: Footprint, offsetPx: DragPoint): number {
  const { startPx, endPx } = wallPointsPx(wall, footprint.corners, offsetPx);
  const lengthPx = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
  const dir = { x: (endPx.x - startPx.x) / lengthPx, y: (endPx.y - startPx.y) / lengthPx };
  const perp = { x: -dir.y, y: dir.x };
  const midPx = { x: (startPx.x + endPx.x) / 2, y: (startPx.y + endPx.y) / 2 };
  const rel = { x: point.x - midPx.x, y: point.y - midPx.y };
  return (rel.x * perp.x + rel.y * perp.y) / SCALE_PX_PER_FT;
}

/** Screen-space points for an octagon preview outline clipped from a
 * widthPx x heightPx box at (x,y) — same 45deg-corner shape as
 * `buildOctagonFootprint`, just for the live drag preview. */
export function octagonPreviewPoints(x: number, y: number, width: number, height: number): number[] {
  const clip = Math.min(width, height) * OCTAGON_CLIP_RATIO;
  return [
    x + clip, y,
    x + width - clip, y,
    x + width, y + clip,
    x + width, y + height - clip,
    x + width - clip, y + height,
    x + clip, y + height,
    x, y + height - clip,
    x, y + clip,
  ];
}

export interface SlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
  /** World-space (px) quad points for a mitered corner panel — set instead
   * of relying on x/y/width/height/rotation when present. */
  trapezoidPoints?: number[];
  slot: PanelSlot;
  wallId: Wall["id"];
  slotIndex: number;
}

/**
 * General 2D vector version of the old horizontal/vertical special-casing —
 * works for any wall angle (needed once footprints stopped being restricted
 * to axis-aligned rectangles, e.g. octagons). Each slot is an unrotated
 * Konva Rect (local +x = along the wall, local +y = inward, toward the
 * footprint's centroid) anchored at its start-of-slot point on the exterior
 * line, then rotated by the wall's angle — a horizontal wall is just the
 * rotation=0 case of this.
 *
 * For mitered shapes (every wall owns its own corner panels — anything
 * that isn't the 4-corner rectangle), the corner slots at each end are
 * instead built as trapezoids: the exterior edge keeps the full corner
 * width, but the interior edge recedes from the shared vertex by
 * `thickness * tan(turnAngle / 2)` — the standard miter-cut construction,
 * so two adjacent walls' corner panels meet along a shared bisector line
 * instead of overlapping (Tommy: symmetric trapezoid panels).
 */
export function computeSlotRects(
  wall: Wall,
  slots: PanelSlot[],
  footprint: Footprint,
  offsetPx: DragPoint,
  startOffsetIn: number,
  wallThicknessPx: number,
): SlotRect[] {
  const corners = footprint.corners;
  const start = corners.find((c) => c.id === wall.startCorner)!.point;
  const end = corners.find((c) => c.id === wall.endCorner)!.point;
  const startPx = { x: start.x * SCALE_PX_PER_FT + offsetPx.x, y: start.y * SCALE_PX_PER_FT + offsetPx.y };
  const endPx = { x: end.x * SCALE_PX_PER_FT + offsetPx.x, y: end.y * SCALE_PX_PER_FT + offsetPx.y };
  const lengthPx = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
  const dir = { x: (endPx.x - startPx.x) / lengthPx, y: (endPx.y - startPx.y) / lengthPx };
  const rotationDeg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;

  // The floor plan outline is the panels' EXTERIOR edge (Tommy) — the wall's
  // full thickness extends inward from that line, not straddling it. Local
  // +y (after rotation) points along `rotate(dir, 90deg)`; if that's not
  // already the inward direction, a negative height flips it without
  // touching the along-wall (local +x) axis.
  const centerX = corners.reduce((sum, c) => sum + c.point.x, 0) / corners.length;
  const centerY = corners.reduce((sum, c) => sum + c.point.y, 0) / corners.length;
  const centerPx = { x: centerX * SCALE_PX_PER_FT + offsetPx.x, y: centerY * SCALE_PX_PER_FT + offsetPx.y };
  const perp = { x: -dir.y, y: dir.x };
  const pointsInward = perp.x * (centerPx.x - startPx.x) + perp.y * (centerPx.y - startPx.y) >= 0;
  const heightPx = pointsInward ? wallThicknessPx : -wallThicknessPx;
  const perpInward = pointsInward ? perp : { x: -perp.x, y: -perp.y };

  const isMiteredShape = !footprintIsAllRightAngles(footprint);
  const prevWall = footprint.walls.find((w) => w.endCorner === wall.startCorner);
  const nextWall = footprint.walls.find((w) => w.startCorner === wall.endCorner);
  const shiftAtStart =
    isMiteredShape && prevWall
      ? wallThicknessPx * Math.tan(cornerTurnAngleRad(prevWall, wall, corners) / 2)
      : 0;
  const shiftAtEnd =
    isMiteredShape && nextWall
      ? wallThicknessPx * Math.tan(cornerTurnAngleRad(wall, nextWall, corners) / 2)
      : 0;

  // Butting (long) walls don't own a corner panel — their content is inset
  // from the actual corner point by the perpendicular wall's thickness.
  const startOffsetPx = (startOffsetIn / 12) * SCALE_PX_PER_FT;
  const anchorStart = { x: startPx.x + dir.x * startOffsetPx, y: startPx.y + dir.y * startOffsetPx };
  const worldPoint = (anchor: DragPoint, u: number, v: number) => ({
    x: anchor.x + dir.x * u + perpInward.x * v,
    y: anchor.y + dir.y * u + perpInward.y * v,
  });

  let offsetFt = 0;
  const rects: SlotRect[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const widthPx = (slot.widthIn / 12) * SCALE_PX_PER_FT;
    const alongPx = offsetFt * SCALE_PX_PER_FT;
    const anchor = { x: anchorStart.x + dir.x * alongPx, y: anchorStart.y + dir.y * alongPx };

    const isCornerType = CORNER_SLOT_TYPES.includes(slot.type);
    let trapezoidPoints: number[] | undefined;
    if (isMiteredShape && isCornerType && i === 0) {
      const shift = Math.min(shiftAtStart, widthPx);
      const p = [
        worldPoint(anchor, 0, 0),
        worldPoint(anchor, widthPx, 0),
        worldPoint(anchor, widthPx, wallThicknessPx),
        worldPoint(anchor, shift, wallThicknessPx),
      ];
      trapezoidPoints = p.flatMap((pt) => [pt.x, pt.y]);
    } else if (isMiteredShape && isCornerType && i === slots.length - 1) {
      const shift = Math.min(shiftAtEnd, widthPx);
      const p = [
        worldPoint(anchor, 0, 0),
        worldPoint(anchor, widthPx, 0),
        worldPoint(anchor, widthPx - shift, wallThicknessPx),
        worldPoint(anchor, 0, wallThicknessPx),
      ];
      trapezoidPoints = p.flatMap((pt) => [pt.x, pt.y]);
    }

    rects.push({
      x: anchor.x,
      y: anchor.y,
      width: widthPx,
      height: heightPx,
      rotationDeg,
      trapezoidPoints,
      slot,
      wallId: wall.id,
      slotIndex: i,
    });
    offsetFt += slot.widthIn / 12;
  }
  return rects;
}

export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const MEASURE_SNAP_TOLERANCE_PX = 20;

function rotatedRectCorners(x: number, y: number, width: number, height: number, rotationDeg: number): DragPoint[] {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const local = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  return local.map((p) => ({ x: x + p.x * cos - p.y * sin, y: y + p.x * sin + p.y * cos }));
}

function pointsFromFlatArray(flat: number[]): DragPoint[] {
  const points: DragPoint[] = [];
  for (let i = 0; i < flat.length; i += 2) points.push({ x: flat[i]!, y: flat[i + 1]! });
  return points;
}

/** Every edge of every rendered wall/panel rectangle (or mitered-corner
 * trapezoid) currently on screen — the full set of "lines" the measure
 * tool can snap to, covering both each wall's own exterior/interior edges
 * and every individual panel's boundary (since each panel's rect shares
 * its edges with its neighbors and the wall's own outline). */
export function wallAndPanelSnapLines(
  footprint: Footprint,
  wallSlots: Record<string, PanelSlot[]>,
  offsetPx: DragPoint,
  wallStartOffsetIn: Record<string, number>,
  wallThicknessPx: number,
): LineSegment[] {
  const segments: LineSegment[] = [];
  for (const wall of footprint.walls) {
    const rects = computeSlotRects(
      wall,
      wallSlots[wall.id] ?? [],
      footprint,
      offsetPx,
      wallStartOffsetIn[wall.id] ?? 0,
      wallThicknessPx,
    );
    for (const r of rects) {
      const corners = r.trapezoidPoints
        ? pointsFromFlatArray(r.trapezoidPoints)
        : rotatedRectCorners(r.x, r.y, r.width, r.height, r.rotationDeg);
      for (let i = 0; i < corners.length; i++) {
        const a = corners[i]!;
        const b = corners[(i + 1) % corners.length]!;
        segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
    }
  }
  return segments;
}

/** The closest point to `point`, projected onto whichever of `segments` is
 * nearest (clamped to each segment's own length) — null if nothing is
 * within `MEASURE_SNAP_TOLERANCE_PX`. Same closest-point-on-a-segment math
 * as `findNearestWall`, generalized to an arbitrary line-segment list
 * instead of just wall centerlines. */
export function nearestPointOnSegments(point: DragPoint, segments: LineSegment[]): DragPoint | null {
  let best: DragPoint | null = null;
  let bestDist = Infinity;
  for (const seg of segments) {
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((point.x - seg.x1) * dx + (point.y - seg.y1) * dy) / lenSq));
    const candidate = { x: seg.x1 + t * dx, y: seg.y1 + t * dy };
    const dist = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best && bestDist <= MEASURE_SNAP_TOLERANCE_PX ? best : null;
}

/** Nudges a corner marker diagonally outward (away from the rectangle's
 * center) so it doesn't sit on top of the corner panel underneath. */
export function cornerMarkerPosition(
  corner: Footprint["corners"][number],
  allCorners: Footprint["corners"],
  offsetPx: DragPoint,
): DragPoint {
  const centerX = allCorners.reduce((sum, c) => sum + c.point.x, 0) / allCorners.length;
  const centerY = allCorners.reduce((sum, c) => sum + c.point.y, 0) / allCorners.length;
  const dirX = Math.sign(corner.point.x - centerX) || 1;
  const dirY = Math.sign(corner.point.y - centerY) || 1;
  return {
    x: corner.point.x * SCALE_PX_PER_FT + offsetPx.x + dirX * CORNER_MARKER_OFFSET_PX,
    y: corner.point.y * SCALE_PX_PER_FT + offsetPx.y + dirY * CORNER_MARKER_OFFSET_PX,
  };
}

/** Midpoint of a wall, nudged outward (away from the footprint's centroid,
 * perpendicular to the wall) so the dimension label sits clear of the wall
 * itself — works for any wall angle, not just axis-aligned ones. */
export function wallLabelPosition(wall: Wall, corners: Footprint["corners"], offsetPx: DragPoint): DragPoint {
  const start = corners.find((c) => c.id === wall.startCorner)!.point;
  const end = corners.find((c) => c.id === wall.endCorner)!.point;
  const midPx = {
    x: ((start.x + end.x) / 2) * SCALE_PX_PER_FT + offsetPx.x,
    y: ((start.y + end.y) / 2) * SCALE_PX_PER_FT + offsetPx.y,
  };
  const centerPx = {
    x: (corners.reduce((sum, c) => sum + c.point.x, 0) / corners.length) * SCALE_PX_PER_FT + offsetPx.x,
    y: (corners.reduce((sum, c) => sum + c.point.y, 0) / corners.length) * SCALE_PX_PER_FT + offsetPx.y,
  };
  const lengthPx = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const dir = { x: (end.x - start.x) / lengthPx, y: (end.y - start.y) / lengthPx };
  const perp = { x: -dir.y, y: dir.x };
  const outward = perp.x * (midPx.x - centerPx.x) + perp.y * (midPx.y - centerPx.y) >= 0 ? 1 : -1;

  // The panel now renders fully inward of the exterior-edge line (no more
  // straddling), so the label only needs to clear the line itself.
  const clear = LABEL_OFFSET_PX * outward;
  return { x: midPx.x + perp.x * clear, y: midPx.y + perp.y * clear };
}

/** e.g. 40.5 -> "40'-6\"" */
export function formatFeetInches(ft: number): string {
  const totalInches = Math.round(ft * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'-${inches}"`;
}

/** Accepts "40'-6\"", "40' 6", plain decimal feet ("40.5"), etc. Returns null if unparseable. */
export function parseLengthFt(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const feetInches = trimmed.match(/^(\d+(?:\.\d+)?)\s*'\s*-?\s*(\d+(?:\.\d+)?)?\s*"?$/);
  if (feetInches) {
    const feet = parseFloat(feetInches[1]!);
    const inches = feetInches[2] ? parseFloat(feetInches[2]) : 0;
    return feet + inches / 12;
  }
  const plain = parseFloat(trimmed);
  return Number.isFinite(plain) ? plain : null;
}
