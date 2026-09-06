import type * as React from "react";
import { EIGHTHS_GLYPHS, formatImperialFractionIn } from "@building-integrity/calc-engine";
import {
  cornerTurnAngleRad,
  footprintIsAllRightAngles,
  outwardNormal,
  roundToEighthIn,
  toEighths,
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
 * positive = outward (an addition), negative = inward (a notch) — the live
 * "depth" reading for a bump-out. Uses the same fixed winding-order-based
 * outward normal as `insertBumpOut` (see that function's own doc comment
 * for why a centroid-relative heuristic doesn't hold up here) so the live
 * preview always matches what actually gets committed. */
export function signedDepthFt(point: DragPoint, wall: Wall, footprint: Footprint, offsetPx: DragPoint): number {
  const { startPx, endPx } = wallPointsPx(wall, footprint.corners, offsetPx);
  const lengthPx = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
  const dir = { x: (endPx.x - startPx.x) / lengthPx, y: (endPx.y - startPx.y) / lengthPx };
  const outward = outwardNormal(dir);
  const midPx = { x: (startPx.x + endPx.x) / 2, y: (startPx.y + endPx.y) / 2 };
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

/**
 * e.g. 40.5 -> `40'-6"`, 24.302083 -> `24'-3⅝"`.
 *
 * This used to do `Math.round(ft * 12)` — nearest WHOLE INCH — which made
 * it the coarsest formatter in the app: it is the footprint canvas's wall
 * label, the inline wall-length editor's seed value, the elevation's
 * "Overall Width" and the measure-tool readout, so a 24'-3⅝" wall read
 * back as `24'-4"`. Tommy chose feet-inches-eighths (`24'-3⅝"`) for long
 * lengths on 2026-08-30, so the fraction part is now carried through.
 *
 * Still rounds to the nearest 1/8in rather than refusing to lie about a
 * non-eighth — that honesty upgrade is Stage 1b for
 * `formatImperialFractionIn` and this formatter follows it there. Nearest
 * eighth is already strictly better than the nearest inch it replaces.
 *
 * Decomposition is done in whole eighths (integers) rather than in floats
 * so that `parseLengthFt(formatFeetInches(v)) === v` bit-identically for
 * any `v` that is a whole eighth of an inch — the round-trip Stage 1's
 * invariant leans on.
 */
export function formatFeetInches(ft: number): string {
  const totalEighths = toEighths(ft * 12);
  const sign = totalEighths < 0 ? "-" : "";
  const absEighths = Math.abs(totalEighths);
  const feet = Math.floor(absEighths / EIGHTHS_PER_FT);
  const inchEighths = absEighths % EIGHTHS_PER_FT;
  const inches = Math.floor(inchEighths / 8);
  const glyph = EIGHTHS_GLYPHS[inchEighths % 8] ?? "";
  return `${sign}${feet}'-${inches}${glyph}"`;
}

/** 96 — eighths of an inch in a foot. Named so the decomposition above
 * reads as a unit conversion rather than a magic number. */
const EIGHTHS_PER_FT = 96;

/** Which unit a field's *bare whole number* is written in. The fraction is
 * never in this unit — see `tokenizeLength`. */
export type LengthDomain = "in" | "ft";

/** Inverted from the formatter's own glyph table rather than retyped, so
 * the parser accepts exactly the glyphs `formatImperialFractionIn` emits —
 * and so a glyph the formatter never emits (`⅓`, `⅔`, `⅕`) is rejected
 * rather than silently misread as some nearby eighth. */
const EIGHTHS_BY_GLYPH = new Map<string, number>(
  Object.entries(EIGHTHS_GLYPHS)
    .filter(([, glyph]) => glyph.length > 0)
    .map(([eighths, glyph]) => [glyph, Number(eighths)] as const),
);

/** None of the eighth glyphs are regex metacharacters, so they go straight
 * into a character class. */
const GLYPH_CLASS = `[${[...EIGHTHS_BY_GLYPH.keys()].join("")}]`;

/** A plain unsigned decimal. Deliberately no exponent form: `1e3` in a wall
 * -length field is far more likely to be a typo than a request for 1000ft,
 * and the old `parseFloat` fallback would have accepted it silently. */
const NUMBER_SRC = String.raw`\d+(?:\.\d+)?|\.\d+`;

/**
 * `whole? separator? fraction?` — every part optional, so the caller has to
 * reject the all-empty match itself. Groups: 1 whole, 2 numerator, 3
 * denominator, 4 glyph.
 *
 * The separator is `[\s-]*` because a shop user writes the same value as
 * `47 5/8`, `47-5/8` or `47⅝`. A leading `-` has already been consumed as a
 * sign by then, so the hyphen here is unambiguously a separator.
 */
const INCH_EXPR = new RegExp(
  `^(${NUMBER_SRC})?(?:[\\s-]*(?:(\\d+)\\s*/\\s*(\\d+)|(${GLYPH_CLASS})))?$`,
);

const PLAIN_NUMBER = new RegExp(`^(?:${NUMBER_SRC})$`);

interface LengthTokens {
  sign: 1 | -1;
  /** Feet, if the input actually wrote a `'`. Null means "no feet mark",
   * which is what makes the field's own domain matter. */
  feet: number | null;
  /** The whole number in front of the fraction. Its unit depends on the
   * domain and on `hasInchMark`; the fraction's never does. */
  whole: number;
  /** Always INCHES (Tommy, 2026-08-30: "the fractions should always be
   * considered a fraction of an inch"). Not yet snapped to the grid — any
   * denominator parses, and the snap happens on commit. */
  fractionIn: number;
  hasInchMark: boolean;
}

/**
 * The one tokenizer behind `parseLengthIn` and `parseLengthFt`. Splits an
 * imperial length into sign / feet / whole / fraction without deciding what
 * unit the whole number is in — that is the domain wrapper's job.
 *
 * Returns null for anything it doesn't recognise. That matters: the code
 * this replaces fell through to `parseFloat`, so `47 5/8` came back as
 * **47** and `24'-3 5/8"` as **24**, silently, with the fraction (and three
 * inches) thrown away.
 */
function tokenizeLength(input: string): LengthTokens | null {
  let rest = input.trim();
  if (!rest) return null;

  let sign: 1 | -1 = 1;
  const signMatch = rest.match(/^([+-])\s*/);
  if (signMatch) {
    sign = signMatch[1] === "-" ? -1 : 1;
    rest = rest.slice(signMatch[0].length);
  }

  let feet: number | null = null;
  const footMark = rest.indexOf("'");
  if (footMark >= 0) {
    const feetText = rest.slice(0, footMark).trim();
    if (!PLAIN_NUMBER.test(feetText)) return null;
    feet = parseFloat(feetText);
    rest = rest.slice(footMark + 1).trim();
    // Belt and braces — `INCH_EXPR` has no `'` in it, so a second foot mark
    // already fails to match. Kept explicit because relying on that is
    // relying on a non-obvious property of a regex two screens away.
    if (rest.includes("'")) return null;
    // `24'-3` — the hyphen separates feet from inches, same character the
    // whole/fraction separator uses.
    rest = rest.replace(/^-\s*/, "");
  }

  let hasInchMark = false;
  if (rest.endsWith('"')) {
    hasInchMark = true;
    rest = rest.slice(0, -1).trim();
  }

  if (!rest) {
    // `24'` or `24'-` — feet with nothing after them. A bare `"` or a lone
    // sign has no number at all and is not a length.
    if (feet === null) return null;
    return { sign, feet, whole: 0, fractionIn: 0, hasInchMark };
  }

  const match = rest.match(INCH_EXPR);
  if (!match) return null;
  const [, wholeText, numeratorText, denominatorText, glyph] = match;
  // Every part of INCH_EXPR is optional, so it also matches the empty
  // string. That case is already caught by the `!rest` guard above; this is
  // here so the invariant is stated where the groups are read.
  if (wholeText === undefined && numeratorText === undefined && glyph === undefined) return null;

  let fractionIn = 0;
  if (glyph !== undefined) {
    fractionIn = EIGHTHS_BY_GLYPH.get(glyph)! / 8;
  } else if (numeratorText !== undefined) {
    const denominator = Number(denominatorText);
    // "5/0" is not a length. Note this is now SUBSUMED by parseInDomain's
    // Number.isFinite check (5/0 is Infinity, 0/0 is NaN, and both fail
    // it), so a mutation harness cannot kill this line — it is kept
    // deliberately, because a zero denominator is a fact about the grammar
    // rather than an accident of IEEE arithmetic, and this is where the
    // grammar is decided. Don't delete either guard on the grounds that
    // the other one covers it.
    if (denominator === 0) return null;
    fractionIn = Number(numeratorText) / denominator;
  }

  return {
    sign,
    feet,
    whole: wholeText === undefined ? 0 : parseFloat(wholeText),
    fractionIn,
    hasInchMark,
  };
}

/**
 * The shared body of `parseLengthIn` and `parseLengthFt`: tokenize, resolve
 * against the field's domain, and refuse anything that isn't a finite
 * number.
 */
function parseInDomain(input: string, domain: LengthDomain): number | null {
  const tokens = tokenizeLength(input);
  if (tokens === null) return null;
  const value = resolveTokens(tokens, domain);
  // A number long enough to overflow a double (400 digits of "9") gets
  // through the grammar intact and `parseFloat`s to Infinity, and Infinity
  // survives every arithmetic step below. An unbuildable wall is not a
  // parse; it is garbage, and garbage returns null so the field goes red
  // instead of committing `Infinity` or rendering `= Infinity'-NaN"`.
  return Number.isFinite(value) ? value : null;
}

/**
 * **The fraction is always inches; the whole number takes the field's own
 * unit.** Tommy, 2026-08-30: *"fractions when entered like 47 5/8 - the
 * fractions should always be considered a fraction of an inch."* So in an
 * inch field `47 5/8` is 47.625in, and in the feet-domain wall-length field
 * it is 47ft + ⅝in.
 *
 * ⚠ **That second reading is an unconfirmed factor-of-twelve assumption**
 * (47'-0⅝" vs 3'-11⅝") — see the spec's Open Items. It is taken literally
 * from Tommy's words and has not been demonstrated to him on the actual
 * field, which is why `resolveLengthEntry`'s live hint is part of this
 * stage rather than a later nicety: he sees the resolved number before it
 * commits.
 *
 * **A FOOT mark wins over the field's domain; a trailing inch mark does
 * not.** Settled by Tommy 2026-09-06, asked directly and answered
 * "it should always read as 47' and 5/8"":
 *
 * - **`'` names both units outright.** `24'-3 5/8"` means 24ft 3⅝in typed
 *   into either kind of field, the spec's grammar table gives it exactly
 *   that reading, and `formatFeetInches`' own output round-trips through
 *   it. Load-bearing — do not remove.
 * - **A trailing `"` is decoration.** In the wall-length field `47 5/8`
 *   and `47 5/8"` are the SAME value, 47'-0⅝". The whole number always
 *   takes the field's own unit; the fraction is always inches; the quote
 *   changes nothing. An earlier draft made the quote flip the whole number
 *   to inches, which put a second factor-of-twelve reading directly beside
 *   the first — two strings one character apart meaning 47 feet and 3 feet.
 *   It was load-bearing for nothing (removing it broke exactly one test,
 *   its own, and no round-trip), and it contradicted the spec's grammar
 *   table, which lists `47 5/8"` on the SAME ROW as `47 5/8`.
 *
 * The consequence to keep in mind: `3"` in a feet-domain field is 3 FEET,
 * not 3 inches. That falls out of "the whole number is always the field's
 * unit" and is the price of having one rule instead of two. Write `0'-3"`
 * — or just use an inch-domain field — to mean three inches.
 */
function resolveTokens(tokens: LengthTokens, domain: LengthDomain): number {
  if (tokens.feet !== null) {
    const totalIn = tokens.feet * 12 + tokens.whole + tokens.fractionIn;
    return tokens.sign * (domain === "ft" ? totalIn / 12 : totalIn);
  }
  if (domain === "in") {
    return tokens.sign * (tokens.whole + tokens.fractionIn);
  }
  // Feet field, no foot mark: the whole number is feet whether or not a
  // trailing `"` was typed (see above — the quote is decoration), and the
  // fraction is still inches.
  return tokens.sign * (tokens.whole + tokens.fractionIn / 12);
}

/**
 * Parses an imperial length typed into an INCH-domain field (window width,
 * sill height, max panel height...). Returns the value in inches, NOT yet
 * snapped to the 1/8in grid — the snap belongs on commit
 * (`resolveLengthEntry`), so `47 5/16` parses exactly and then commits as
 * `47⅜"`.
 *
 * Accepts `47 5/8`, `47-5/8`, `47 5/8"`, `5/8`, `⅝`, `47⅝`, `24'-3 5/8"`,
 * `47.625` and `47`. Anything else returns null.
 */
export function parseLengthIn(input: string): number | null {
  return parseInDomain(input, "in");
}

/**
 * The feet-domain twin of `parseLengthIn`, same grammar, same tokenizer —
 * `40.5` is still 40.5 FEET, and `47 5/8` is 47 feet plus ⅝ of an inch.
 */
export function parseLengthFt(input: string): number | null {
  return parseInDomain(input, "ft");
}

/**
 * Snaps a typed value onto the 1/8in shop grid in whichever unit the field
 * works in. Feet go through inches and back rather than being snapped to
 * 1/96 ft directly: 1/96 is not representable in binary, but every eighth
 * of an inch is, so `roundToEighthIn(ft * 12) / 12` reproduces exactly the
 * float a caller gets from `inches / 12`.
 */
export function snapLengthToEighthIn(value: number, domain: LengthDomain): number {
  return domain === "ft" ? roundToEighthIn(value * 12) / 12 : roundToEighthIn(value);
}

/**
 * How a committed value is written back into its own field once the user
 * stops editing — a fraction, not a decimal, so `47 5/16` visibly becomes
 * `47⅜` the moment it commits and the user is never shown one number while
 * another is stored.
 *
 * No unit mark: every one of these fields already has its unit in the
 * label or in the text immediately after it, and the feet-domain form
 * carries its own `'` and `"` anyway.
 */
export function formatLengthForDomain(value: number, domain: LengthDomain): string {
  return domain === "ft" ? formatFeetInches(value) : formatImperialFractionIn(value, "");
}

/** What a field shows beside itself when what's typed isn't a length. The
 * failed parse needs somewhere honest to live — before this stage an
 * unparseable entry was a silent no-op with no feedback at all. */
export const UNRECOGNIZED_LENGTH_HINT = "= —, unrecognized";

export interface LengthEntry {
  /** The value that would be committed, in the field's own unit, already
   * snapped to the grid. Null means "don't commit anything". */
  value: number | null;
  /** The live resolved hint, e.g. `= 47'-0⅝"`. */
  hint: string;
}

/**
 * Parse + snap + describe, in one call, so the hint a field shows while the
 * user types is computed by the same code path that commits — the user can
 * never be shown one number and have another stored.
 */
export function resolveLengthEntry(input: string, domain: LengthDomain): LengthEntry {
  const parsed = domain === "ft" ? parseLengthFt(input) : parseLengthIn(input);
  if (parsed === null) return { value: null, hint: UNRECOGNIZED_LENGTH_HINT };
  const value = snapLengthToEighthIn(parsed, domain);
  const hint = domain === "ft" ? formatFeetInches(value) : formatImperialFractionIn(value);
  return { value, hint: `= ${hint}` };
}
