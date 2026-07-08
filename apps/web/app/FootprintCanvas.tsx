"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Text, Group, Line } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  buildOctagonFootprint,
  dragWall,
  footprintIsAllRightAngles,
  type CornerId,
  type Footprint,
  type PanelSlot,
  type Wall,
} from "@building-integrity/geometry";
import {
  SCALE_PX_PER_FT,
  computeSlotRects,
  cornerMarkerPosition,
  findNearestWall,
  findNearestWallCandidates,
  formatFeetInches,
  octagonPreviewPoints,
  parseLengthFt,
  pickWallByDragDirection,
  projectOntoWallFt,
  signedDepthFt,
  signedPerpOffsetFt,
  snapOctagonBoxPx,
  snapSpanPointFt,
  wallLabelPosition,
  wallPointsPx,
  type DragPoint,
} from "./canvasGeometry";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 480;

const SLOT_COLORS: Record<PanelSlot["type"], string> = {
  corner: "#8a8a8a",
  "safety-oct-corner": "#5c4a2e",
  standard: "#d9c9a3",
  braced: "#b06fc9",
  "safety-gap": "#e08a3c",
  window: "#8fc7e8",
  door: "#7a4a2b",
};

interface BumpOutGesture {
  stage: "span" | "depth";
  wallId: Wall["id"];
  spanStartFt: number;
  spanEndFt: number;
}

// Near a corner, a mousedown can land within pick tolerance of 2
// perpendicular walls at once. Rather than lock in the raw-closest one
// immediately (which can be the wrong one — see pickWallByDragDirection),
// we wait for the drag to move this far before committing, so the actual
// drag direction can break the tie.
const DRAG_DISAMBIGUATION_DEADZONE_PX = 8;

interface PendingWallPick {
  downPos: DragPoint;
  candidates: { wall: Wall; alongFt: number; distPx: number }[];
}

export interface FootprintCanvasProps {
  footprint: Footprint | null;
  shapeTool: "rectangle" | "octagon" | "bump-out" | "edit" | "drag-wall";
  offsetPx: DragPoint;
  wallSlots: Record<string, PanelSlot[]>;
  wallStartOffsetIn: Record<string, number>;
  wallThicknessIn: number;
  leastAccessibleCorner: CornerId;
  /** Corners present before any bump-out was added — only these ever show
   * a least-accessible-corner marker (once a shape's first 4 corners are
   * drawn, bump-out-introduced corners never need one). */
  primaryCornerIds: Set<CornerId>;
  /** Per-wall length editing only makes sense when there's a well-defined
   * "opposite wall" to keep in sync — true for all 4 rectangle walls, only
   * the straight walls on an octagon (the mitered diagonals aren't). */
  isWallLengthEditable: (wallId: Wall["id"]) => boolean;
  onDraw: (widthFt: number, depthFt: number, offsetPx: DragPoint) => void;
  onToggleOpening: (wallId: Wall["id"], slotIndex: number) => void;
  onSetLeastAccessibleCorner: (cornerId: CornerId) => void;
  onEditWallLength: (wallId: Wall["id"], newLengthFt: number) => void;
  onAddBumpOut: (wallId: Wall["id"], spanStartFt: number, spanEndFt: number, depthFt: number) => void;
  onDragWall: (wallId: Wall["id"], offsetFt: number) => void;
}

export default function FootprintCanvas({
  footprint,
  shapeTool,
  offsetPx,
  wallSlots,
  wallStartOffsetIn,
  wallThicknessIn,
  leastAccessibleCorner,
  primaryCornerIds,
  isWallLengthEditable,
  onDraw,
  onToggleOpening,
  onSetLeastAccessibleCorner,
  onEditWallLength,
  onAddBumpOut,
  onDragWall,
}: FootprintCanvasProps) {
  // A ref (not state) because mousedown/mousemove/mouseup can all fire within
  // the same React batch during a fast drag — state set in mousedown wouldn't
  // be visible yet to mousemove/mouseup's closures if we relied on state here.
  const dragStartRef = useRef<DragPoint | null>(null);
  const [editingWallId, setEditingWallId] = useState<Wall["id"] | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [dragCurrent, setDragCurrent] = useState<DragPoint | null>(null);

  // Pan/zoom view — a pure rendering concern, entirely local to this
  // component (unlike `offsetPx`, which positions the *footprint* within
  // the canvas's coordinate space, this just controls which portion of
  // that space is currently visible). Applied straight to the Stage's own
  // x/y/scale, so every existing pointer-position-based calculation above
  // (findNearestWall, signedDepthFt, etc.) needs no changes — Konva's
  // `getPointerPosition()` already returns coordinates in the stage's own
  // local space, already compensated for this transform.
  const [viewOffset, setViewOffset] = useState<DragPoint>({ x: 0, y: 0 });
  const [viewScale, setViewScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  // Raw screen-space (clientX/clientY) drag tracking for panning — NOT
  // `getPointerPosition()`, which is already adjusted by the very
  // transform we're trying to change here (using it would be circular).
  const panStartRef = useRef<{ clientX: number; clientY: number; viewOffset: DragPoint } | null>(null);

  const zoomIn = () => setViewScale((s) => Math.min(3, s * 1.25));
  const zoomOut = () => setViewScale((s) => Math.max(0.25, s / 1.25));
  const resetView = () => {
    setViewOffset({ x: 0, y: 0 });
    setViewScale(1);
  };

  // Same ref-not-state reasoning as dragStartRef: the span/depth gesture's
  // stage and anchor point must be readable immediately by the very next
  // mousemove/mouseup, even if they land in the same batch as the mousedown
  // that set them. `bumpOutPointerPos` is plain state since its only job is
  // to trigger a re-render for the live preview.
  const bumpOutGestureRef = useRef<BumpOutGesture | null>(null);
  const [bumpOutPointerPos, setBumpOutPointerPos] = useState<DragPoint | null>(null);
  // Set at mousedown when the click is ambiguously close to >1 wall (a
  // corner); cleared once enough drag movement reveals which wall the user
  // means (see pickWallByDragDirection), at which point it becomes a real
  // bumpOutGestureRef. A ref, not state, for the same same-batch-visibility
  // reason as bumpOutGestureRef above.
  const pendingWallPickRef = useRef<PendingWallPick | null>(null);

  const resetBumpOutGesture = () => {
    bumpOutGestureRef.current = null;
    pendingWallPickRef.current = null;
    setBumpOutPointerPos(null);
  };

  // Switching away from the bump-out tool mid-gesture (e.g. clicking
  // "Rectangle") shouldn't leave a stale span/depth stuck for next time.
  useEffect(() => {
    if (shapeTool !== "bump-out") {
      bumpOutGestureRef.current = null;
      pendingWallPickRef.current = null;
      setBumpOutPointerPos(null);
    }
  }, [shapeTool]);

  /** Resolves a pending (ambiguous) wall pick into a real span gesture,
   * using the observed drag direction to break the tie once there's been
   * enough movement to reveal one; a pick with no movement yet (e.g. a
   * plain click released before any drag) just falls back to the nearest
   * candidate, matching the old single-candidate behavior. */
  const resolvePendingWallPick = (currentPos: DragPoint) => {
    const pending = pendingWallPickRef.current;
    if (!pending || !footprint) return;
    const moved = Math.hypot(currentPos.x - pending.downPos.x, currentPos.y - pending.downPos.y);
    const chosen =
      moved > 0
        ? pickWallByDragDirection(pending.downPos, currentPos, pending.candidates, footprint.corners, offsetPx)
        : pending.candidates[0]!;
    const spanStartFt = snapSpanPointFt(chosen.alongFt, chosen.wall.lengthFt);
    bumpOutGestureRef.current = { stage: "span", wallId: chosen.wall.id, spanStartFt, spanEndFt: spanStartFt };
    pendingWallPickRef.current = null;
  };

  // Single-stage gesture (unlike bump-out's 2-stage span/depth) — just
  // which wall was picked up; the live offset is derived each render from
  // `dragWallPointerPos` vs. that wall's original line, same as
  // `bumpOutPointerPos`/`signedDepthFt` above.
  const dragWallGestureRef = useRef<{ wallId: Wall["id"] } | null>(null);
  const [dragWallPointerPos, setDragWallPointerPos] = useState<DragPoint | null>(null);

  useEffect(() => {
    if (shapeTool !== "drag-wall") {
      dragWallGestureRef.current = null;
      setDragWallPointerPos(null);
    }
  }, [shapeTool]);

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (isPanning) {
      panStartRef.current = { clientX: e.evt.clientX, clientY: e.evt.clientY, viewOffset: { ...viewOffset } };
      return;
    }

    const pos = e.target.getStage()!.getPointerPosition()!;

    if (shapeTool === "bump-out") {
      if (footprint && !bumpOutGestureRef.current && !pendingWallPickRef.current) {
        const candidates = findNearestWallCandidates(pos, footprint, offsetPx);
        if (candidates.length === 1) {
          const only = candidates[0]!;
          const spanStartFt = snapSpanPointFt(only.alongFt, only.wall.lengthFt);
          bumpOutGestureRef.current = { stage: "span", wallId: only.wall.id, spanStartFt, spanEndFt: spanStartFt };
          setBumpOutPointerPos(pos);
        } else if (candidates.length > 1) {
          // Ambiguous (near a corner) — don't commit yet; wait for the
          // drag to move enough to reveal which wall is meant.
          pendingWallPickRef.current = { downPos: pos, candidates };
          setBumpOutPointerPos(pos);
        }
      }
      return;
    }

    if (shapeTool === "drag-wall") {
      if (footprint && !dragWallGestureRef.current) {
        const found = findNearestWall(pos, footprint, offsetPx);
        if (found && isWallLengthEditable(found.wall.id)) {
          dragWallGestureRef.current = { wallId: found.wall.id };
          setDragWallPointerPos(pos);
        }
      }
      return;
    }

    // "edit" mode has no drag gesture of its own — panel/label/corner-marker
    // clicks (below) are the only interaction it supports.
    if (shapeTool !== "rectangle" && shapeTool !== "octagon") return;

    dragStartRef.current = pos;
    setDragCurrent(pos);
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (isPanning) {
      const start = panStartRef.current;
      if (!start) return;
      setViewOffset({
        x: start.viewOffset.x + (e.evt.clientX - start.clientX),
        y: start.viewOffset.y + (e.evt.clientY - start.clientY),
      });
      return;
    }

    const pos = e.target.getStage()!.getPointerPosition()!;

    if (shapeTool === "bump-out") {
      if (pendingWallPickRef.current && !bumpOutGestureRef.current) {
        const pending = pendingWallPickRef.current;
        const dist = Math.hypot(pos.x - pending.downPos.x, pos.y - pending.downPos.y);
        if (dist < DRAG_DISAMBIGUATION_DEADZONE_PX) {
          setBumpOutPointerPos(pos);
          return; // still ambiguous — wait for more movement before committing
        }
        resolvePendingWallPick(pos);
      }
      const gesture = bumpOutGestureRef.current;
      if (!gesture || !footprint) return;
      setBumpOutPointerPos(pos);
      if (gesture.stage === "span") {
        const wall = footprint.walls.find((w) => w.id === gesture.wallId);
        if (wall) {
          const rawFt = projectOntoWallFt(pos, wall, footprint.corners, offsetPx);
          bumpOutGestureRef.current = { ...gesture, spanEndFt: snapSpanPointFt(rawFt, wall.lengthFt) };
        }
      }
      return;
    }

    if (shapeTool === "drag-wall") {
      if (!dragWallGestureRef.current || !footprint) return;
      setDragWallPointerPos(pos);
      return;
    }

    if (!dragStartRef.current) return;
    setDragCurrent(pos);
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (isPanning) {
      panStartRef.current = null;
      return;
    }

    if (shapeTool === "bump-out") {
      if (pendingWallPickRef.current && !bumpOutGestureRef.current) {
        const pos = e.target.getStage()!.getPointerPosition() ?? bumpOutPointerPos;
        if (pos) resolvePendingWallPick(pos);
      }
      const gesture = bumpOutGestureRef.current;
      if (!gesture || !footprint) return;
      const pos = e.target.getStage()!.getPointerPosition() ?? bumpOutPointerPos;
      if (!pos) return;

      if (gesture.stage === "span") {
        bumpOutGestureRef.current = { ...gesture, stage: "depth" };
        setBumpOutPointerPos(pos);
        return;
      }

      const wall = footprint.walls.find((w) => w.id === gesture.wallId);
      if (wall) {
        const depthFt = signedDepthFt(pos, wall, footprint, offsetPx);
        onAddBumpOut(gesture.wallId, gesture.spanStartFt, gesture.spanEndFt, depthFt);
      }
      resetBumpOutGesture();
      return;
    }

    if (shapeTool === "drag-wall") {
      const gesture = dragWallGestureRef.current;
      if (gesture && footprint) {
        const pos = e.target.getStage()!.getPointerPosition() ?? dragWallPointerPos;
        const wall = pos ? footprint.walls.find((w) => w.id === gesture.wallId) : undefined;
        if (pos && wall) {
          const offsetFt = signedPerpOffsetFt(pos, wall, footprint, offsetPx);
          onDragWall(gesture.wallId, offsetFt);
        }
      }
      dragWallGestureRef.current = null;
      setDragWallPointerPos(null);
      return;
    }

    const dragStart = dragStartRef.current;
    if (!dragStart) return;
    const pos = e.target.getStage()!.getPointerPosition() ?? dragCurrent;
    dragStartRef.current = null;
    setDragCurrent(null);
    if (!pos) return;

    let widthPx = Math.abs(pos.x - dragStart.x);
    let heightPx = Math.abs(pos.y - dragStart.y);
    if (widthPx < 10 || heightPx < 10) return; // ignore accidental clicks
    if (shapeTool === "octagon") ({ widthPx, heightPx } = snapOctagonBoxPx(widthPx, heightPx));

    const originPx = {
      x: Math.min(dragStart.x, pos.x),
      y: Math.min(dragStart.y, pos.y),
    };
    const widthFt = Math.round((widthPx / SCALE_PX_PER_FT) * 12) / 12;
    const depthFt = Math.round((heightPx / SCALE_PX_PER_FT) * 12) / 12;
    onDraw(widthFt, depthFt, originPx);
  };

  const previewRect = (() => {
    if (!dragStartRef.current || !dragCurrent) return null;
    const rawWidthPx = Math.abs(dragCurrent.x - dragStartRef.current.x);
    const rawHeightPx = Math.abs(dragCurrent.y - dragStartRef.current.y);
    const { widthPx, heightPx } =
      shapeTool === "octagon" ? snapOctagonBoxPx(rawWidthPx, rawHeightPx) : { widthPx: rawWidthPx, heightPx: rawHeightPx };
    return {
      x: Math.min(dragStartRef.current.x, dragCurrent.x),
      y: Math.min(dragStartRef.current.y, dragCurrent.y),
      width: widthPx,
      height: heightPx,
    };
  })();

  // Live preview for the bump-out's two-stage drag: the selected span
  // highlighted along the wall, plus (once past stage 1) the resulting
  // outward/inward quad following the pointer.
  const bumpOutPreview = (() => {
    const gesture = bumpOutGestureRef.current;
    if (!gesture || !footprint) return null;
    const wall = footprint.walls.find((w) => w.id === gesture.wallId);
    if (!wall) return null;
    const { startPx, endPx } = wallPointsPx(wall, footprint.corners, offsetPx);
    const lengthPx = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
    const dir = { x: (endPx.x - startPx.x) / lengthPx, y: (endPx.y - startPx.y) / lengthPx };
    const aPx = Math.min(gesture.spanStartFt, gesture.spanEndFt) * SCALE_PX_PER_FT;
    const bPx = Math.max(gesture.spanStartFt, gesture.spanEndFt) * SCALE_PX_PER_FT;
    const pa = { x: startPx.x + dir.x * aPx, y: startPx.y + dir.y * aPx };
    const pb = { x: startPx.x + dir.x * bPx, y: startPx.y + dir.y * bPx };

    let quadPoints: number[] | null = null;
    if (gesture.stage === "depth" && bumpOutPointerPos) {
      const depthFt = signedDepthFt(bumpOutPointerPos, wall, footprint, offsetPx);
      const depthPx = depthFt * SCALE_PX_PER_FT;
      const perp = { x: -dir.y, y: dir.x };
      const centerFt = {
        x: footprint.corners.reduce((sum, c) => sum + c.point.x, 0) / footprint.corners.length,
        y: footprint.corners.reduce((sum, c) => sum + c.point.y, 0) / footprint.corners.length,
      };
      const centerPx = { x: centerFt.x * SCALE_PX_PER_FT + offsetPx.x, y: centerFt.y * SCALE_PX_PER_FT + offsetPx.y };
      const midPx = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      const outward =
        perp.x * (midPx.x - centerPx.x) + perp.y * (midPx.y - centerPx.y) >= 0 ? perp : { x: -perp.x, y: -perp.y };
      const paOut = { x: pa.x + outward.x * depthPx, y: pa.y + outward.y * depthPx };
      const pbOut = { x: pb.x + outward.x * depthPx, y: pb.y + outward.y * depthPx };
      quadPoints = [pa.x, pa.y, paOut.x, paOut.y, pbOut.x, pbOut.y, pb.x, pb.y];
    }

    return { spanPoints: [pa.x, pa.y, pb.x, pb.y], quadPoints };
  })();

  // Live preview for the drag-wall gesture: recompute the ENTIRE resulting
  // footprint analytically (same dispatch page.tsx's handleDragWall uses)
  // rather than approximating, so the preview always exactly matches what
  // will commit, including clamping.
  const dragWallPreviewFootprint = (() => {
    const gesture = dragWallGestureRef.current;
    if (!gesture || !footprint || !dragWallPointerPos) return null;
    const wall = footprint.walls.find((w) => w.id === gesture.wallId);
    if (!wall) return null;
    const offsetFt = signedPerpOffsetFt(dragWallPointerPos, wall, footprint, offsetPx);

    if (footprintIsAllRightAngles(footprint)) {
      return dragWall(footprint, gesture.wallId, offsetFt);
    }

    const isWidthWall = wall.id === "01" || wall.id === "45";
    const isDepthWall = wall.id === "23" || wall.id === "67";
    if (!isWidthWall && !isDepthWall) return footprint; // diagonal: no preview movement
    const clipFt = footprint.walls.find((w) => w.id === "70")!.lengthFt / Math.SQRT2;
    const widthFt = footprint.walls.find((w) => w.id === "01")!.lengthFt + 2 * clipFt;
    const depthFt = footprint.walls.find((w) => w.id === "23")!.lengthFt + 2 * clipFt;
    return buildOctagonFootprint(
      isWidthWall ? widthFt + 2 * offsetFt : widthFt,
      isDepthWall ? depthFt + 2 * offsetFt : depthFt,
    );
  })();
  const dragWallPreviewPoints = dragWallPreviewFootprint?.corners.flatMap((c) => [
    c.point.x * SCALE_PX_PER_FT + offsetPx.x,
    c.point.y * SCALE_PX_PER_FT + offsetPx.y,
  ]);

  const wallThicknessPx = (wallThicknessIn / 12) * SCALE_PX_PER_FT;

  const startEditingWall = (wall: Wall) => {
    setEditingWallId(wall.id);
    setEditingValue(formatFeetInches(wall.lengthFt));
  };

  const commitEdit = () => {
    if (editingWallId) {
      const parsed = parseLengthFt(editingValue);
      if (parsed !== null) {
        onEditWallLength(editingWallId, parsed);
      }
    }
    setEditingWallId(null);
  };

  const editingWall = footprint?.walls.find((w) => w.id === editingWallId) ?? null;
  const editingPos =
    footprint && editingWall
      ? wallLabelPosition(editingWall, footprint.corners, offsetPx)
      : null;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <button
          type="button"
          aria-pressed={isPanning}
          onClick={() => setIsPanning((p) => !p)}
          style={{ fontWeight: isPanning ? "bold" : "normal" }}
        >
          Pan
        </button>
        <button type="button" onClick={zoomOut}>
          Zoom −
        </button>
        <span style={{ fontSize: 12, color: "#555", minWidth: 40, textAlign: "center" }}>
          {Math.round(viewScale * 100)}%
        </span>
        <button type="button" onClick={zoomIn}>
          Zoom +
        </button>
        <button type="button" onClick={resetView}>
          Reset View
        </button>
      </div>
      <div style={{ position: "relative", width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
        <Stage
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          x={viewOffset.x}
          y={viewOffset.y}
          scaleX={viewScale}
          scaleY={viewScale}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ border: "1px solid #ccc", background: "#fcfcfa", cursor: isPanning ? "grab" : "crosshair" }}
        >
          <Layer>
          {!footprint && !previewRect && (
            <Text
              x={CANVAS_WIDTH / 2 - 140}
              y={CANVAS_HEIGHT / 2 - 10}
              text="Click and drag to draw the footprint"
              fill="#999"
            />
          )}
          {previewRect && shapeTool === "octagon" && (
            <Line
              points={octagonPreviewPoints(
                previewRect.x,
                previewRect.y,
                previewRect.width,
                previewRect.height,
              )}
              closed
              stroke="#4a90d9"
              dash={[6, 4]}
              fill="rgba(74,144,217,0.08)"
            />
          )}
          {previewRect && shapeTool === "rectangle" && (
            <Rect
              {...previewRect}
              stroke="#4a90d9"
              dash={[6, 4]}
              fill="rgba(74,144,217,0.08)"
            />
          )}
          {bumpOutPreview && (
            <>
              <Line points={bumpOutPreview.spanPoints} stroke="#4a90d9" strokeWidth={5} />
              {bumpOutPreview.quadPoints && (
                <Line
                  points={bumpOutPreview.quadPoints}
                  stroke="#4a90d9"
                  dash={[6, 4]}
                  fill="rgba(74,144,217,0.15)"
                  closed
                />
              )}
            </>
          )}
          {dragWallPreviewPoints && (
            <Line
              points={dragWallPreviewPoints}
              closed
              stroke="#4a90d9"
              dash={[6, 4]}
              fill="rgba(74,144,217,0.08)"
            />
          )}
          {footprint &&
            footprint.walls.flatMap((wall) =>
              computeSlotRects(
                wall,
                wallSlots[wall.id] ?? [],
                footprint,
                offsetPx,
                wallStartOffsetIn[wall.id] ?? 0,
                wallThicknessPx,
              ).map((r) =>
                r.trapezoidPoints ? (
                  <Line
                    key={`${r.wallId}-${r.slotIndex}`}
                    points={r.trapezoidPoints}
                    closed
                    fill={SLOT_COLORS[r.slot.type]}
                    stroke="#555"
                    strokeWidth={0.5}
                    onClick={shapeTool === "edit" ? () => onToggleOpening(r.wallId, r.slotIndex) : undefined}
                  />
                ) : (
                  <Rect
                    key={`${r.wallId}-${r.slotIndex}`}
                    x={r.x}
                    y={r.y}
                    width={r.width}
                    height={r.height}
                    rotation={r.rotationDeg}
                    fill={SLOT_COLORS[r.slot.type]}
                    stroke="#555"
                    strokeWidth={0.5}
                    onClick={shapeTool === "edit" ? () => onToggleOpening(r.wallId, r.slotIndex) : undefined}
                  />
                ),
              ),
            )}
          {footprint &&
            footprintIsAllRightAngles(footprint) &&
            footprint.corners.filter((c) => primaryCornerIds.has(c.id)).map((c) => {
              const pos = cornerMarkerPosition(c, footprint.corners, offsetPx);
              return (
                <Circle
                  key={c.id}
                  x={pos.x}
                  y={pos.y}
                  radius={9}
                  fill={c.id === leastAccessibleCorner ? "#c0392b" : "#fff"}
                  stroke="#333"
                  strokeWidth={1.5}
                  onClick={shapeTool === "edit" ? () => onSetLeastAccessibleCorner(c.id) : undefined}
                />
              );
            })}
          {footprint &&
            footprint.walls.map((wall) => {
              if (wall.id === editingWallId) return null;
              const pos = wallLabelPosition(wall, footprint.corners, offsetPx);
              return (
                <Group
                  key={`label-${wall.id}`}
                  onClick={
                    shapeTool === "edit" && isWallLengthEditable(wall.id) ? () => startEditingWall(wall) : undefined
                  }
                >
                  {/* Text hit-testing only registers actual glyph pixels, not
                      the full bounding box (unlike Rect/Circle) — this
                      invisible Rect makes the whole label area clickable. */}
                  <Rect x={pos.x - 24} y={pos.y - 7} width={48} height={14} fill="transparent" />
                  <Text
                    x={pos.x - 24}
                    y={pos.y - 7}
                    width={48}
                    align="center"
                    text={formatFeetInches(wall.lengthFt)}
                    fontSize={12}
                    fill="#333"
                    listening={false}
                  />
                </Group>
              );
            })}
        </Layer>
        </Stage>
        {editingPos && (
          <input
            autoFocus
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditingWallId(null);
            }}
            onBlur={commitEdit}
            style={{
              // This overlay is a plain HTML element (not drawn by Konva),
              // so it doesn't automatically track the Stage's pan/zoom
              // transform the way canvas content does — apply the same
              // viewOffset/viewScale here so it stays aligned with the
              // wall label underneath it at any pan/zoom level.
              position: "absolute",
              left: editingPos.x * viewScale + viewOffset.x - 30 * viewScale,
              top: editingPos.y * viewScale + viewOffset.y - 9 * viewScale,
              width: 60 * viewScale,
              fontSize: 12 * viewScale,
              textAlign: "center",
            }}
          />
        )}
      </div>
    </div>
  );
}
