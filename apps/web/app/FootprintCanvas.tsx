"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Stage, Layer, Rect, Circle, Text, Group, Line, Arrow } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ShapeTool } from "./DrawingToolPen";
import {
  buildOctagonFootprint,
  dragWallBounded,
  footprintIsAllRightAngles,
  type CornerId,
  type Footprint,
  type PanelSlot,
  type Wall,
} from "@building-integrity/geometry";
import {
  computeBracedPanelShearCapacityLb,
  computeBuiltUpColumnBearingCapacityLb,
  computeStudPackBearingCapacityLb,
} from "@building-integrity/calc-engine";
import {
  bracingStyleToPatternMirror,
  buildBracedPanelMembers,
  buildColumnPanelMembers,
  buildCornerPanelMembers,
  type BracingStyle,
  type JackStudConfig,
} from "@building-integrity/panel-catalog";
import { resolveBracedStyle } from "./bracedStyle";
import {
  OCTAGON_SQUARE_SNAP_PX,
  SCALE_PX_PER_FT,
  WALL_PICK_TOLERANCE_PX,
  clientPointFromEvent,
  computeSlotRects,
  cornerMarkerPosition,
  findNearestWall,
  findNearestWallCandidates,
  firstTouchId,
  formatFeetInches,
  nearestPointOnSegments,
  octagonPreviewPoints,
  pickWallByDragDirection,
  projectOntoWallFt,
  resolveLengthEntry,
  signedDepthFt,
  signedPerpOffsetFt,
  snapOctagonBoxPx,
  snapSpanPointFt,
  wallAndPanelSnapLines,
  wallLabelPosition,
  wallPointsPx,
  type DragPoint,
} from "./canvasGeometry";
import { allPanelInstances, combinedPanelLabel, type PanelInstance } from "./panelInstances";
import { PANEL_TYPE_COLORS as SLOT_COLORS } from "./panelColors";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 480;

// Small line-icon SVGs for the pan/zoom toolbar — byte-identical copy of
// WallElevationDiagram.tsx's own same icons, same "each file keeps its own
// small copy" convention already used for other small shared helpers.
const ICON_PROPS = { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const PanIcon = () => (
  <svg {...ICON_PROPS}>
    <polyline points="5 9 2 12 5 15" />
    <polyline points="9 5 12 2 15 5" />
    <polyline points="15 19 12 22 9 19" />
    <polyline points="19 9 22 12 19 15" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="12" y1="2" x2="12" y2="22" />
  </svg>
);
const ZoomOutIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);
const ZoomInIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

// A combined slot (e.g. safety-gap + braced near a corner, Tommy: "have
// multiple types of panels be represented in a particular panel... safety
// panel should be hashed orange so you can see both colors") renders its
// secondaryType as the solid base (what it structurally also is) with the
// primary type's color as a diagonal hatch on top — cached per color since
// building a canvas pattern tile isn't free and there are only ever a
// handful of distinct colors in play.
// react-konva types fillPatternImage as HTMLImageElement only, but Konva
// itself accepts any CanvasImageSource at runtime (including a canvas) —
// the cast below is safe, not a real type mismatch.
const hatchPatternCache = new Map<string, HTMLImageElement>();
function diagonalHatchPattern(color: string): HTMLImageElement {
  const cached = hatchPatternCache.get(color);
  if (cached) return cached;
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-size / 2, size / 2);
  ctx.lineTo(size / 2, -size / 2);
  ctx.moveTo(size / 2, size * 1.5);
  ctx.lineTo(size * 1.5, size / 2);
  ctx.stroke();
  const image = canvas as unknown as HTMLImageElement;
  hatchPatternCache.set(color, image);
  return image;
}

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

// Under this, a press-and-release is an accidental click rather than a draw.
// Screen px — scaled by the view below, like the other thresholds.
const MIN_DRAG_PX = 10;

interface PendingWallPick {
  downPos: DragPoint;
  candidates: { wall: Wall; alongFt: number; distPx: number }[];
}

export interface FootprintCanvasProps {
  footprint: Footprint | null;
  shapeTool: ShapeTool;
  /** The first corner picked for a new wall, or null before the first
   * click. Ephemeral — never saved. */
  drawWallFirstCornerId: string | null;
  onPickDrawWallCorner: (cornerId: string) => void;
  /** The two candidate regions once both corners are picked, outlined in
   * the same two colours the sidebar chooser uses. */
  drawWallRegions: { points: { x: number; y: number }[] }[] | null;
  offsetPx: DragPoint;
  wallSlots: Record<string, PanelSlot[]>;
  wallStartOffsetIn: Record<string, number>;
  /** Stage 3 — for each wall, the along-wall spans (inches from that wall's
   * own start corner) that are deliberately NOT built. Drawn as a **dashed
   * boundary line, not a hatched wall**: it is where the building ends, not
   * a wall of unknown type. Absent/empty = every wall fully panelized. */
  wallUnbuiltSpansIn?: Record<string, { fromIn: number; toIn: number }[]>;
  wallThicknessIn: number;
  /** Only needed for the hover tooltip's estimated bearing/shear numbers —
   * see structuralByKey below. */
  wallHeightFt: number;
  includeNailer: boolean;
  /** Which diagonal-brace pattern the hover tooltip's estimated shear
   * number uses for a "braced" slot (Tommy: "add another bracing
   * option... Hatch Forward, and Hatch Back"). */
  bracingStyle: BracingStyle;
  /** Needed to compute how many sill instances a wide window's rough
   * opening splits into (see allPanelInstances/computeSillRunWidths), so
   * the on-canvas combined label (e.g. "N3+4+5") matches its Shop
   * Drawing page. */
  standardWidthIn: number;
  jackStudConfig: JackStudConfig;
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
  /** When supplied, the compact Pan/Zoom/Reset icon row renders into this
   * DOM node (via a portal) instead of inline above the canvas — its own
   * state/handlers never move, only where the JSX mounts (Tommy: "squeeze
   * all the viewing tab stuff beside the compass"). Undefined/null renders
   * it inline as before. */
  toolbarPortalTarget?: HTMLDivElement | null;
  /** Same portal mechanism, for the separate Panel ID Visibility/Measure
   * row — kept apart from `toolbarPortalTarget` since only Pan/Zoom/Reset
   * are meant to sit beside the compass, not these two. */
  secondaryToolbarPortalTarget?: HTMLDivElement | null;
}

export default function FootprintCanvas({
  footprint,
  shapeTool,
  drawWallFirstCornerId,
  onPickDrawWallCorner,
  drawWallRegions,
  offsetPx,
  wallSlots,
  wallStartOffsetIn,
  wallUnbuiltSpansIn,
  wallThicknessIn,
  wallHeightFt,
  includeNailer,
  bracingStyle,
  standardWidthIn,
  jackStudConfig,
  leastAccessibleCorner,
  primaryCornerIds,
  isWallLengthEditable,
  onDraw,
  onToggleOpening,
  onSetLeastAccessibleCorner,
  onEditWallLength,
  onAddBumpOut,
  onDragWall,
  toolbarPortalTarget,
  secondaryToolbarPortalTarget,
}: FootprintCanvasProps) {
  // A ref (not state) because mousedown/mousemove/mouseup can all fire within
  // the same React batch during a fast drag — state set in mousedown wouldn't
  // be visible yet to mousemove/mouseup's closures if we relied on state here.
  const dragStartRef = useRef<DragPoint | null>(null);
  const [editingWallId, setEditingWallId] = useState<Wall["id"] | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editInvalid, setEditInvalid] = useState(false);
  // `aria-describedby` rather than a live region — the hint changes on
  // every keystroke and a live region would read each half-typed value out.
  const wallLengthHintId = useId();
  const [dragCurrent, setDragCurrent] = useState<DragPoint | null>(null);

  // Keyed the same way computeSlotRects identifies a slot (wallId +
  // slotIndex) so the on-canvas label always matches the name(s) shown for
  // this same panel on its Shop Drawing page. A window slot maps to 2
  // instances (header + sill, sharing one slot since they're stacked in
  // elevation, not sequential in plan) — combinedPanelLabel merges those
  // into one label (e.g. "N3+4") for the single rectangle drawn here.
  const panelNameByKey = useMemo(() => {
    const grouped = new Map<string, PanelInstance[]>();
    if (footprint) {
      for (const inst of allPanelInstances(footprint, wallSlots, standardWidthIn, jackStudConfig)) {
        const key = `${inst.wallId}-${inst.slotIndexInWall}`;
        const list = grouped.get(key) ?? [];
        list.push(inst);
        grouped.set(key, list);
      }
    }
    const map = new Map<string, string>();
    for (const [key, instances] of grouped) map.set(key, combinedPanelLabel(instances));
    return map;
  }, [footprint, wallSlots, standardWidthIn, jackStudConfig]);

  // Estimated bearing/shear numbers for the hover tooltip below (Tommy:
  // "when you hover over a panel... shows you extra details... shear and
  // load bearing estimates if applicable"). Bearing is a flat per-panel
  // figure for standard/braced/safety-gap, but MUCH higher for column/
  // corner (their two full-height side plywood sheets form a built-up
  // section — see computeBuiltUpColumnBearingCapacityLb). Shear (diagonal
  // brace) only applies to a braced panel (or a safety-gap combined with one).
  const structuralByKey = useMemo(() => {
    const map = new Map<string, { bearingLb: number; shearLb?: number }>();
    if (!footprint) return map;
    const standardBearingLb = computeStudPackBearingCapacityLb();
    const columnBearingLb = computeBuiltUpColumnBearingCapacityLb(
      buildColumnPanelMembers(wallThicknessIn, wallHeightFt * 12, includeNailer),
      wallHeightFt * 12,
    );
    // The NOMINAL-width corner section on purpose — corner members are built at
    // each slot's real width elsewhere now, but a wider section reports HIGHER
    // bearing and that is not a number to infer. Same decision, same reasoning
    // as `estimatedCornerBuiltUpBearingLb` in page.tsx; the question is in the
    // spec's `## Open Items` as "Does a WIDER corner panel carry more axial
    // load?" (added there 2026-09-26 — this comment used to point at an Open
    // Items list that did not contain it).
    //
    // ⚠ A pre-existing divergence, recorded and NOT fixed here: this builds the
    // PLYWOOD corner at nominal unconditionally, while page.tsx's twin reads
    // `cornerPanelMembers3D`, which under Square Bale is the BALE corner body.
    // So the two sites agree for Loose Packed Braced and Timber Frame Curtain
    // and disagree under Square Bale. Not introduced by the corner work.
    const cornerBearingLb = computeBuiltUpColumnBearingCapacityLb(
      buildCornerPanelMembers(wallThicknessIn, wallHeightFt * 12, includeNailer),
      wallHeightFt * 12,
    );
    for (const wall of footprint.walls) {
      const slots = wallSlots[wall.id] ?? [];
      slots.forEach((slot, slotIndex) => {
        // ⚠ THIS site counts a COMBINED safety-gap+brace slot as braced;
        // page.tsx's zero-bracing Review Log entry counts `panelType === "braced"`
        // only, because `PanelInstance` does not carry `secondaryType` at all and
        // `summarizeBearingAndShear` therefore gives a combined slot zero shear.
        // So the per-panel tooltip and the building's shear total genuinely
        // disagree today. Recorded here as well as there, because page.tsx claims
        // the divergence is noted at both sites and until 2026-09-27 it was not.
        // The spec's `## Open Items` carries it as "Does a COMBINED
        // safety-gap+brace slot count as bracing, and should `PanelInstance` carry
        // `secondaryType`?" — not fixed either way here, since the honest fix
        // RAISES a displayed structural total.
        const isBraced = slot.type === "braced" || slot.secondaryType === "braced";
        const shearLb = isBraced
          ? (() => {
              // A combined safety-gap+brace slot (secondaryType==="braced")
              // has no per-slot style of its own — resolveBracedStyle's
              // "absent = default" fallback handles that case naturally,
              // same as a plain "braced" slot missing bracedPattern.
              const defaultStyle = bracingStyleToPatternMirror(bracingStyle);
              const style = resolveBracedStyle(slot, defaultStyle.pattern, defaultStyle.mirrored);
              return computeBracedPanelShearCapacityLb(
                buildBracedPanelMembers(slot.widthIn, wallThicknessIn, wallHeightFt * 12, includeNailer, style.pattern, style.mirrored),
              );
            })()
          : undefined;
        const bearingLb =
          slot.type === "column"
            ? columnBearingLb
            : slot.type === "corner" || slot.type === "safety-oct-corner"
              ? cornerBearingLb
              : standardBearingLb;
        map.set(`${wall.id}-${slotIndex}`, { bearingLb, shearLb });
      });
    }
    return map;
  }, [footprint, wallSlots, wallThicknessIn, wallHeightFt, includeNailer, bracingStyle]);

  const [hoveredSlot, setHoveredSlot] = useState<{
    key: string;
    type: string;
    x: number;
    y: number;
    rotationDeg: number;
    width: number;
  } | null>(null);

  const [showPanelLabels, setShowPanelLabels] = useState(true);

  const wallThicknessPx = (wallThicknessIn / 12) * SCALE_PX_PER_FT;

  // Every wall/panel edge the measure tool can snap to, recomputed
  // whenever the drawing itself changes (not on every mouse move).
  const snapLines = useMemo(
    () => (footprint ? wallAndPanelSnapLines(footprint, wallSlots, offsetPx, wallStartOffsetIn, wallThicknessPx) : []),
    [footprint, wallSlots, offsetPx, wallStartOffsetIn, wallThicknessPx],
  );

  // Measure tool: mousedown snaps an anchor point and it stays fixed;
  // mousemove keeps snapping the *other* end and shows the live distance;
  // mouseup just stops updating it — the last measurement stays visible
  // (as a reference) until a new one is started or the tool is toggled off.
  const [isMeasuring, setIsMeasuring] = useState(false);
  const measureGestureRef = useRef(false); // true while the mouse is down mid-measurement
  const [measureAnchor, setMeasureAnchor] = useState<DragPoint | null>(null);
  const [measureEnd, setMeasureEnd] = useState<DragPoint | null>(null);

  const clearMeasurement = () => {
    measureGestureRef.current = false;
    setMeasureAnchor(null);
    setMeasureEnd(null);
  };

  const toggleMeasuringOff = () => {
    setIsMeasuring(false);
    clearMeasurement();
  };

  const toggleMeasuring = () => {
    setIsMeasuring((was) => {
      const next = !was;
      if (next) setIsPanning(false);
      clearMeasurement();
      return next;
    });
  };

  // Pan/zoom view — a pure rendering concern, entirely local to this
  // component (unlike `offsetPx`, which positions the *footprint* within
  // the canvas's coordinate space, this just controls which portion of
  // that space is currently visible). Applied straight to the Stage's own
  // x/y/scale.
  //
  // ⚠ **This comment used to claim `getPointerPosition()` was "already
  // compensated for this transform", so the pointer code needed no
  // changes. That was false, and it cost the app its zoom.** Konva has
  // two pointer accessors and they are not the same: `getPointerPosition()`
  // is screen px inside the stage's container, while
  // `getRelativePointerPosition()` runs that through the stage's inverse
  // transform. Measured in the running app at 25% zoom, one pointer:
  // `getPointerPosition()` → 599.3 (the app concluded 50ft) against
  // `getRelativePointerPosition()` → 2397.3 (the truth, 199.8ft). A 4x
  // error, exactly 1/scale, in the same direction everywhere — which is
  // why it read as "zoom does nothing" rather than as a wrong number: a
  // drag across the whole plan at 25% committed a building a quarter the
  // size of the box the user had just dragged, and Measure under-reported
  // by the same factor. Every reading now uses the relative accessor;
  // panning below is the one deliberate exception and says why.
  const [viewOffset, setViewOffset] = useState<DragPoint>({ x: 0, y: 0 });
  const [viewScale, setViewScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  // Raw screen-space (clientX/clientY) drag tracking for panning — NOT
  // `getPointerPosition()`, which is already adjusted by the very
  // transform we're trying to change here (using it would be circular).
  const panStartRef = useRef<{ clientX: number; clientY: number; viewOffset: DragPoint; touchId?: number } | null>(null);

  /* Hit targets and gesture thresholds, converted from screen px to plan px.
   *
   * Every pointer reading is in plan space now, so a threshold left in plan
   * px would shrink on screen as the user zooms out — at the 0.1 floor a 20
   * plan-px wall-pick target is 2px under the cursor, and nothing is
   * clickable. Dividing by the view scale keeps each of these the same size
   * UNDER THE USER'S CURSOR at every zoom, which is the only frame in which
   * "near enough to have meant it" means anything. */
  const pickTolerancePx = WALL_PICK_TOLERANCE_PX / viewScale;
  const octagonSnapPx = OCTAGON_SQUARE_SNAP_PX / viewScale;
  const dragDeadzonePx = DRAG_DISAMBIGUATION_DEADZONE_PX / viewScale;
  const minDragPx = MIN_DRAG_PX / viewScale;

  const zoomIn = () => setViewScale((s) => Math.min(3, s * 1.25));
  // ⚠ The floor is what caps how big a building can be DRAWN, because a
  // single draw gesture cannot reach beyond the visible plan: at zoom z the
  // canvas shows (720/z)/12 ft by (480/z)/12 ft. At the old 0.25 that was
  // 240x160ft, and with the pointer bug above in place it was really 60x40ft
  // — about 60 panels, against Tommy's "300+ panels should be doable in this
  // app" (2026-10-02). 0.1 gives 600x400ft, roughly 600 panels at a 40in
  // standard, which clears that with room to spare. Nothing downstream is
  // bounded by this; it is a view limit, not a model limit.
  const zoomOut = () => setViewScale((s) => Math.max(0.1, s / 1.25));
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

  const handleMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isPanning) {
      const touchId = firstTouchId(e.evt);
      const client = clientPointFromEvent(e.evt, touchId);
      if (client) panStartRef.current = { ...client, viewOffset: { ...viewOffset }, touchId };
      return;
    }

    if (isMeasuring) {
      const pos = e.target.getStage()!.getRelativePointerPosition()!;
      const snapped = nearestPointOnSegments(pos, snapLines);
      if (snapped) {
        measureGestureRef.current = true;
        setMeasureAnchor(snapped);
        setMeasureEnd(snapped);
      }
      return;
    }

    const pos = e.target.getStage()!.getRelativePointerPosition()!;

    if (shapeTool === "bump-out") {
      if (footprint && !bumpOutGestureRef.current && !pendingWallPickRef.current) {
        const candidates = findNearestWallCandidates(pos, footprint, offsetPx, pickTolerancePx);
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
        const found = findNearestWall(pos, footprint, offsetPx, pickTolerancePx);
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

  const handleMouseMove = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isPanning) {
      const start = panStartRef.current;
      if (!start) return;
      const client = clientPointFromEvent(e.evt, start.touchId);
      if (!client) return;
      setViewOffset({
        x: start.viewOffset.x + (client.clientX - start.clientX),
        y: start.viewOffset.y + (client.clientY - start.clientY),
      });
      return;
    }

    if (isMeasuring) {
      if (measureGestureRef.current) {
        const pos = e.target.getStage()!.getRelativePointerPosition()!;
        const snapped = nearestPointOnSegments(pos, snapLines);
        if (snapped) setMeasureEnd(snapped);
      }
      return;
    }

    const pos = e.target.getStage()!.getRelativePointerPosition()!;

    if (shapeTool === "bump-out") {
      if (pendingWallPickRef.current && !bumpOutGestureRef.current) {
        const pending = pendingWallPickRef.current;
        const dist = Math.hypot(pos.x - pending.downPos.x, pos.y - pending.downPos.y);
        if (dist < dragDeadzonePx) {
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

  const handleMouseUp = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (isPanning) {
      panStartRef.current = null;
      return;
    }

    if (isMeasuring) {
      measureGestureRef.current = false;
      return;
    }

    if (shapeTool === "bump-out") {
      if (pendingWallPickRef.current && !bumpOutGestureRef.current) {
        const pos = e.target.getStage()!.getRelativePointerPosition() ?? bumpOutPointerPos;
        if (pos) resolvePendingWallPick(pos);
      }
      const gesture = bumpOutGestureRef.current;
      if (!gesture || !footprint) return;
      const pos = e.target.getStage()!.getRelativePointerPosition() ?? bumpOutPointerPos;
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
        const pos = e.target.getStage()!.getRelativePointerPosition() ?? dragWallPointerPos;
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
    const pos = e.target.getStage()!.getRelativePointerPosition() ?? dragCurrent;
    dragStartRef.current = null;
    setDragCurrent(null);
    if (!pos) return;

    let widthPx = Math.abs(pos.x - dragStart.x);
    let heightPx = Math.abs(pos.y - dragStart.y);
    if (widthPx < minDragPx || heightPx < minDragPx) return; // ignore accidental clicks
    if (shapeTool === "octagon") ({ widthPx, heightPx } = snapOctagonBoxPx(widthPx, heightPx, octagonSnapPx));

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
      shapeTool === "octagon"
        ? snapOctagonBoxPx(rawWidthPx, rawHeightPx, octagonSnapPx)
        : { widthPx: rawWidthPx, heightPx: rawHeightPx };
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
      return dragWallBounded(footprint, gesture.wallId, offsetFt);
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

  const startEditingWall = (wall: Wall) => {
    setEditingWallId(wall.id);
    setEditingValue(formatFeetInches(wall.lengthFt));
    setEditInvalid(false);
  };

  /**
   * This is the FEET-domain field, so a bare `47 5/8` here means 47 feet
   * plus ⅝ of an inch, not 47.625in — the whole number keeps the field's
   * unit, the fraction is always inches. That reading is a factor of twelve
   * away from the alternative, which is why `editHint` renders the resolved
   * value live above the field before anything commits.
   *
   * Returns false when the entry couldn't be parsed. It used to be
   * `if (parsed !== null)` with no `else`, so an unparseable entry just
   * closed the editor with no feedback at all and the wall silently kept
   * its old length.
   */
  const commitEdit = (): boolean => {
    if (!editingWallId) return true;
    const resolved = resolveLengthEntry(editingValue, "ft");
    if (resolved.value === null) {
      setEditInvalid(true);
      return false;
    }
    onEditWallLength(editingWallId, resolved.value);
    setEditingWallId(null);
    setEditInvalid(false);
    return true;
  };

  const editHint = editingWallId ? resolveLengthEntry(editingValue, "ft") : null;

  const editingWall = footprint?.walls.find((w) => w.id === editingWallId) ?? null;
  const editingPos =
    footprint && editingWall
      ? wallLabelPosition(editingWall, footprint.corners, offsetPx)
      : null;

  // Compact icon buttons (Tommy: "lets squeeze all the viewing tab stuff
  // beside the compass - pan zoom, full screen. each of these can be
  // changed to an icon that gives a hover over description... pan can be a
  // cooking pan... zoom can be magnifying glasses with plus or minus...
  // reset view doesnt have to be an icon but can just read Reset") — a
  // hover title carries the full description since the icon alone doesn't.
  const iconButtonStyle = (active: boolean): CSSProperties => ({
    fontSize: 15,
    lineHeight: 1,
    padding: "6px 9px",
    borderRadius: 6,
    border: active ? "1px solid #4a90d9" : "1px solid #ccc",
    background: active ? "#4a90d9" : "#fff",
    color: active ? "#fff" : "#333",
    cursor: "pointer",
  });

  const viewingToolbar = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button
        type="button"
        title="Pan: drag the canvas to pan around"
        aria-pressed={isPanning}
        onClick={() =>
          setIsPanning((p) => {
            const next = !p;
            if (next) toggleMeasuringOff();
            return next;
          })
        }
        style={iconButtonStyle(isPanning)}
      >
        <PanIcon />
      </button>
      <button type="button" title="Zoom out" onClick={zoomOut} style={iconButtonStyle(false)}>
        <ZoomOutIcon />
      </button>
      <span style={{ fontSize: 11, color: "#555", minWidth: 28, textAlign: "center" }}>
        {Math.round(viewScale * 100)}%
      </span>
      <button type="button" title="Zoom in" onClick={zoomIn} style={iconButtonStyle(false)}>
        <ZoomInIcon />
      </button>
      <button
        type="button"
        title="Reset pan and zoom to the default view"
        onClick={resetView}
        style={{ ...iconButtonStyle(false), fontSize: 12, padding: "6px 10px" }}
      >
        Reset
      </button>
    </div>
  );

  const panelToolsToolbar = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, width: "100%" }}>
      <button
        type="button"
        title="Show or hide the panel ID labels drawn on each panel, and the safety-gap call-out arrows"
        aria-pressed={showPanelLabels}
        onClick={() => setShowPanelLabels((v) => !v)}
        style={{ fontWeight: showPanelLabels ? "bold" : "normal" }}
      >
        Panel ID Visibility
      </button>
      <button
        type="button"
        title="Click two points on the canvas to measure the distance between them"
        aria-pressed={isMeasuring}
        onClick={toggleMeasuring}
        style={{ fontWeight: isMeasuring ? "bold" : "normal" }}
      >
        Measure
      </button>
    </div>
  );

  return (
    <div>
      {toolbarPortalTarget ? createPortal(viewingToolbar, toolbarPortalTarget) : viewingToolbar}
      {secondaryToolbarPortalTarget ? createPortal(panelToolsToolbar, secondaryToolbarPortalTarget) : panelToolsToolbar}
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
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          style={{ border: "1px solid #ccc", background: "#fcfcfa", cursor: isPanning ? "grab" : "crosshair", touchAction: "none" }}
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
              ).map((r) => {
                const panelName = panelNameByKey.get(`${r.wallId}-${r.slotIndex}`);
                const slotKey = `${r.wallId}-${r.slotIndex}`;
                const typeLabel = r.slot.secondaryType ? `${r.slot.secondaryType} + ${r.slot.type}` : r.slot.type;
                const baseColor = SLOT_COLORS[r.slot.secondaryType ?? r.slot.type];
                const hatchColor = r.slot.secondaryType ? SLOT_COLORS[r.slot.type] : null;
                if (r.trapezoidPoints) {
                  // Point index 3 (x,y at array indices 6,7) is always the
                  // interior-side corner nearest the slot's start, for both
                  // the start- and end-corner trapezoid constructions.
                  const labelX = r.trapezoidPoints[6]!;
                  const labelY = r.trapezoidPoints[7]!;
                  return (
                    <Group key={`${r.wallId}-${r.slotIndex}`}>
                      <Line
                        points={r.trapezoidPoints}
                        closed
                        fill={baseColor}
                        stroke="#555"
                        strokeWidth={0.5}
                        onClick={shapeTool === "edit" ? () => onToggleOpening(r.wallId, r.slotIndex) : undefined}
                        onTap={shapeTool === "edit" ? () => onToggleOpening(r.wallId, r.slotIndex) : undefined}
                        onMouseEnter={() =>
                          setHoveredSlot({ key: slotKey, type: typeLabel, x: labelX, y: labelY, rotationDeg: 0, width: 0 })
                        }
                        onMouseLeave={() => setHoveredSlot((was) => (was?.key === slotKey ? null : was))}
                      />
                      {hatchColor && (
                        <Line
                          points={r.trapezoidPoints}
                          closed
                          fillPatternImage={diagonalHatchPattern(hatchColor)}
                          fillPatternRepeat="repeat"
                          listening={false}
                        />
                      )}
                      {showPanelLabels && panelName && (
                        <Text
                          x={labelX + 2}
                          y={labelY - 11}
                          text={panelName}
                          fontSize={9}
                          fill="#fff"
                          stroke="#333"
                          strokeWidth={0.6}
                          listening={false}
                        />
                      )}
                    </Group>
                  );
                }
                // Local (0, height) is the "bottom-left"-equivalent corner
                // (start-of-slot, interior edge) — rendered inside the same
                // rotated Group as the Rect so it lands correctly for every
                // wall angle, not just axis-aligned ones.
                const labelLocalY = r.height > 0 ? r.height - 11 : r.height;
                return (
                  <Group key={`${r.wallId}-${r.slotIndex}`} x={r.x} y={r.y} rotation={r.rotationDeg}>
                    <Rect
                      width={r.width}
                      height={r.height}
                      fill={baseColor}
                      stroke="#555"
                      strokeWidth={0.5}
                      onClick={shapeTool === "edit" ? () => onToggleOpening(r.wallId, r.slotIndex) : undefined}
                      onTap={shapeTool === "edit" ? () => onToggleOpening(r.wallId, r.slotIndex) : undefined}
                      onMouseEnter={() =>
                        setHoveredSlot({ key: slotKey, type: typeLabel, x: r.x, y: r.y, rotationDeg: r.rotationDeg, width: r.width })
                      }
                      onMouseLeave={() => setHoveredSlot((was) => (was?.key === slotKey ? null : was))}
                    />
                    {hatchColor && (
                      <Rect
                        width={r.width}
                        height={r.height}
                        fillPatternImage={diagonalHatchPattern(hatchColor)}
                        fillPatternRepeat="repeat"
                        listening={false}
                      />
                    )}
                    {showPanelLabels && panelName && (
                      <Text
                        x={2}
                        y={labelLocalY}
                        text={panelName}
                        fontSize={9}
                        fill="#fff"
                        stroke="#333"
                        strokeWidth={0.6}
                        listening={false}
                      />
                    )}
                    {/* The safety-gap panel is only 3/4in wide (well under a
                        pixel at typical zoom) — Tommy: "they are kinda hard
                        to see without a label" — a call-out arrow + text
                        makes it findable, toggled by the same Panel ID
                        Visibility button as the other panel labels. Tommy:
                        "the safety gap lines... are off a little - it
                        appears to be like a wall depth off" — the old
                        offsets (tail 8/22 units outside the exterior line,
                        tip landing 2 units past the panel's edge instead of
                        touching it) were plain inches at 1px/in-zoom, so
                        they read as comparable to the wall's own 15.5in
                        depth instead of a tight, close-by callout. Tightened
                        so the tip touches the panel's actual edge/mid-depth
                        and the tail/text sit just outside the wall instead
                        of floating a wall-depth's distance away. */}
                    {showPanelLabels && r.slot.type === "safety-gap" && (
                      <>
                        <Arrow
                          points={[r.width + 16, -4, r.width, r.height / 2]}
                          pointerLength={5}
                          pointerWidth={5}
                          fill="#b8630f"
                          stroke="#b8630f"
                          strokeWidth={1.5}
                          listening={false}
                        />
                        <Text
                          x={r.width + 11}
                          y={-15}
                          text="Safety Gap"
                          fontSize={9}
                          fontStyle="bold"
                          fill="#b8630f"
                          stroke="#fff"
                          strokeWidth={0.5}
                          listening={false}
                        />
                      </>
                    )}
                  </Group>
                );
              }),
            )}
          {hoveredSlot &&
            (() => {
              const info = structuralByKey.get(hoveredSlot.key);
              if (!info) return null;
              const lines = [
                hoveredSlot.type,
                `Est. bearing: ~${Math.round(info.bearingLb).toLocaleString()} lb`,
                ...(info.shearLb !== undefined ? [`Est. shear: ~${Math.round(info.shearLb).toLocaleString()} lb`] : []),
              ];
              const boxWidth = 130;
              const boxHeight = lines.length * 13 + 8;
              const boxX = hoveredSlot.width / 2 - boxWidth / 2;
              const boxY = -boxHeight - 6;
              return (
                <Group x={hoveredSlot.x} y={hoveredSlot.y} rotation={hoveredSlot.rotationDeg} listening={false}>
                  <Rect x={boxX} y={boxY} width={boxWidth} height={boxHeight} fill="#222" opacity={0.85} cornerRadius={3} />
                  {lines.map((line, i) => (
                    <Text
                      key={i}
                      x={boxX + 6}
                      y={boxY + 4 + i * 13}
                      text={line}
                      fontSize={10}
                      fill="#fff"
                    />
                  ))}
                </Group>
              );
            })()}
          {/* ⚠ DRAW WALL puts a target on EVERY corner, on every shape. The
              least-accessible-corner markers below are a different thing —
              they appear only on all-right-angle shapes and only for primary
              corners — so this draws its own rather than borrowing them. */}
          {footprint &&
            shapeTool === "draw-wall" &&
            footprint.corners.map((c) => {
              const picked = c.id === drawWallFirstCornerId;
              return (
                <Circle
                  key={`draw-wall-${c.id}`}
                  x={c.point.x * SCALE_PX_PER_FT + offsetPx.x}
                  y={c.point.y * SCALE_PX_PER_FT + offsetPx.y}
                  radius={picked ? 11 : 9}
                  fill={picked ? "#2d6cdf" : "#fff"}
                  stroke="#2d6cdf"
                  strokeWidth={2}
                  /* ⚠ A FORGIVING TARGET, found by failing to hit it. Driving
                     this tool from a script, clicks landing within a few pixels
                     of a corner missed it repeatedly — and a tool whose entire
                     interaction is "click a corner, click another corner" is
                     exactly the wrong place for a target that needs precision.
                     `hitStrokeWidth` widens the hit area without drawing
                     anything bigger, so the dot stays small and the click does
                     not have to be. */
                  hitStrokeWidth={18}
                  onClick={() => onPickDrawWallCorner(c.id)}
                  onTap={() => onPickDrawWallCorner(c.id)}
                />
              );
            })}
          {/* The two candidate regions, colour-matched to the chooser's own
              buttons. `DrawWallChooser` carries the same two colours rather
              than importing them: one side draws in Konva and the other in
              CSS, and a shared constant one of them quietly stopped using
              would be worse than two that disagree visibly. */}
          {drawWallRegions?.map((region, i) => (
            <Line
              key={`split-region-${i}`}
              points={region.points.flatMap((p) => [
                p.x * SCALE_PX_PER_FT + offsetPx.x,
                p.y * SCALE_PX_PER_FT + offsetPx.y,
              ])}
              closed
              stroke={i === 0 ? "#2d6cdf" : "#c76a1f"}
              strokeWidth={3}
              fill={i === 0 ? "rgba(45,108,223,0.12)" : "rgba(199,106,31,0.12)"}
              listening={false}
            />
          ))}
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
                  onTap={shapeTool === "edit" ? () => onSetLeastAccessibleCorner(c.id) : undefined}
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
                  onTap={
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
          {/* Stage 3 — each wall's deliberately unbuilt span(s), as a DASHED
              BOUNDARY LINE rather than a hatched wall: this is where the
              building ends, not a wall whose type is still to be decided.
              The footprint outline itself is untouched, because the polygon
              stays closed and the floor, foundation and roof all still reach
              this line. Non-interactive — a stop is edited from the Selected
              Wall note, not by dragging a line that means "nothing here". */}
          {footprint &&
            footprint.walls.flatMap((wall) => {
              const spans = wallUnbuiltSpansIn?.[wall.id] ?? [];
              if (spans.length === 0) return [];
              const start = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
              const end = footprint.corners.find((c) => c.id === wall.endCorner)!.point;
              const startPx = { x: start.x * SCALE_PX_PER_FT + offsetPx.x, y: start.y * SCALE_PX_PER_FT + offsetPx.y };
              const endPx = { x: end.x * SCALE_PX_PER_FT + offsetPx.x, y: end.y * SCALE_PX_PER_FT + offsetPx.y };
              const lengthPx = Math.hypot(endPx.x - startPx.x, endPx.y - startPx.y) || 1;
              const dir = { x: (endPx.x - startPx.x) / lengthPx, y: (endPx.y - startPx.y) / lengthPx };
              const normal = { x: -dir.y, y: dir.x };
              const pointAt = (alongIn: number) => ({
                x: startPx.x + (dir.x * alongIn * SCALE_PX_PER_FT) / 12,
                y: startPx.y + (dir.y * alongIn * SCALE_PX_PER_FT) / 12,
              });
              return spans.map((span, i) => {
                const a = pointAt(span.fromIn);
                const b = pointAt(span.toIn);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                return (
                  <Group key={`unbuilt-${wall.id}-${i}`} listening={false}>
                    <Line points={[a.x, a.y, b.x, b.y]} stroke="#8a8a8a" strokeWidth={2} dash={[8, 5]} listening={false} />
                    <Line
                      points={[a.x - normal.x * 5, a.y - normal.y * 5, a.x + normal.x * 5, a.y + normal.y * 5]}
                      stroke="#8a8a8a"
                      strokeWidth={1}
                      listening={false}
                    />
                    <Line
                      points={[b.x - normal.x * 5, b.y - normal.y * 5, b.x + normal.x * 5, b.y + normal.y * 5]}
                      stroke="#8a8a8a"
                      strokeWidth={1}
                      listening={false}
                    />
                    <Text
                      x={mid.x - normal.x * 14 - 50}
                      y={mid.y - normal.y * 14 - 6}
                      width={100}
                      align="center"
                      text={`NO PANELS: ${formatFeetInches((span.toIn - span.fromIn) / 12)}`}
                      fontSize={10}
                      fontStyle="bold"
                      fill="#6a6a6a"
                      listening={false}
                    />
                  </Group>
                );
              });
            })}
          {measureAnchor && measureEnd && (
            <>
              <Line
                points={[measureAnchor.x, measureAnchor.y, measureEnd.x, measureEnd.y]}
                stroke="#e0392b"
                strokeWidth={2}
                dash={[5, 4]}
                listening={false}
              />
              <Circle x={measureAnchor.x} y={measureAnchor.y} radius={4} fill="#e0392b" listening={false} />
              <Circle x={measureEnd.x} y={measureEnd.y} radius={4} fill="#e0392b" listening={false} />
              <Text
                x={(measureAnchor.x + measureEnd.x) / 2 + 8}
                y={(measureAnchor.y + measureEnd.y) / 2 - 18}
                text={formatFeetInches(
                  Math.hypot(measureEnd.x - measureAnchor.x, measureEnd.y - measureAnchor.y) / SCALE_PX_PER_FT,
                )}
                fontSize={13}
                fontStyle="bold"
                fill="#e0392b"
                listening={false}
              />
            </>
          )}
        </Layer>
        </Stage>
        {editingPos && editHint && (
          <span
            id={wallLengthHintId}
            style={{
              position: "absolute",
              left: editingPos.x * viewScale + viewOffset.x - 105 * viewScale,
              top: editingPos.y * viewScale + viewOffset.y - 26 * viewScale,
              // Wide enough for the longest thing it can say, which is the
              // failure state plus its way out.
              width: 210 * viewScale,
              fontSize: 11 * viewScale,
              textAlign: "center",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              color: editHint.value === null ? "#c0392b" : "#555",
            }}
          >
            {editHint.hint}
            {editHint.value === null ? " (Esc to cancel)" : ""}
          </span>
        )}
        {editingPos && (
          <input
            autoFocus
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={editInvalid || undefined}
            aria-describedby={wallLengthHintId}
            aria-label="Wall length"
            value={editingValue}
            onChange={(e) => {
              setEditingValue(e.target.value);
              setEditInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setEditingWallId(null);
                setEditInvalid(false);
              }
            }}
            onBlur={() => {
              // Never closes on an unparseable entry — the editor stays
              // open and red with the typed text intact, and the wall keeps
              // its old length. Focus is deliberately NOT forced back: an
              // autoFocused overlay the caret can't leave is a trap, and a
              // visible failure was the requirement, not an inescapable
              // one. The hint above says "Esc to cancel" for the way out.
              commitEdit();
            }}
            style={{
              ...(editInvalid ? { outline: "2px solid #c0392b" } : null),
              // This overlay is a plain HTML element (not drawn by Konva),
              // so it doesn't automatically track the Stage's pan/zoom
              // transform the way canvas content does — apply the same
              // viewOffset/viewScale here so it stays aligned with the
              // wall label underneath it at any pan/zoom level.
              position: "absolute",
              left: editingPos.x * viewScale + viewOffset.x - 42 * viewScale,
              top: editingPos.y * viewScale + viewOffset.y - 9 * viewScale,
              // Wider than the 60 it used to be: the seed value now carries
              // a fraction (`24'-3⅝"`), and a value the user can't fully
              // read is a value they can't check before committing.
              width: 84 * viewScale,
              fontSize: 12 * viewScale,
              textAlign: "center",
            }}
          />
        )}
      </div>
    </div>
  );
}
