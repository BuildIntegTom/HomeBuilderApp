"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { buildOpeningAssemblyMembers, type JackStudConfig } from "@building-integrity/panel-catalog";
import { computeOpeningGeometry } from "./openingGeometry";
import { MemberElevationShapes } from "./MemberElevationShapes";

const IN_PER_FT = 12;
const DIAGRAM_HEIGHT_PX = 260;
const MAX_WINDOW_WIDTH_PX = 340; // keeps the widest realistic window comfortably inside the ~384px usable width of the fixed-420px "Selected Panel" note (see StickyNote.module.css)
const MIN_WINDOW_WIDTH_PX = 40; // floor so a narrow window doesn't collapse to nothing
const WALL_SIDE_MARGIN_PX = 20; // illustrative "wall material" shown on either side of the window, not to any real wall-length scale
const HANDLE_GRAB_HEIGHT_PX = 16; // generous hit target around each thin grip line

export interface WindowSizeDiagramProps {
  wallHeightFt: number;
  windowWidthIn: number;
  sillHeightIn: number;
  windowHeightIn: number;
  thicknessIn: number;
  jackStudConfig: JackStudConfig;
  includeNailer: boolean;
  standardWidthIn: number;
  onSetSillHeight: (requestedIn: number) => void;
  onSetWindowHeight: (requestedHeightIn: number) => void;
}

type DragHandle = "sill" | "header";

/**
 * To-scale side elevation of the wall with the window's Rough Opening
 * broken down into its real header/jack-stud/sill framing — the 2D
 * counterpart to Building3DView's "3D Framed" mode, sharing the exact same
 * `computeOpeningGeometry`/`buildOpeningAssemblyMembers` geometry and the
 * same material-based coloring (`MemberElevationShapes`) so this diagram
 * can never visually disagree with the 3D model. Plus draggable sill/header
 * grips — the 2D counterpart to Building3DView's renderSillHeaderHandles
 * Sill & Header drag tool (Tommy: "manipulate sill and header height with
 * the drag tool", "i want window editor sizing to be very user friendly").
 *
 * Purely an input surface: drag state is local (for a smooth live-follow
 * breakdown while dragging), but the actual committed value always goes
 * through the same onSetSillHeight/onSetWindowHeight callbacks the
 * dropdown/number-input controls already call — no independent clamping
 * logic here. The header-drag floor (`Math.max(1, ...)`) mirrors
 * Building3DView's `commitHeader` exactly, for the same reason (a window
 * can't have zero or negative height); the real clamp range enforcement
 * (mfr sill/header spec, wall-height ceiling) lives once, in page.tsx's
 * handleSetWindowSillHeight.
 */
export default function WindowSizeDiagram({
  wallHeightFt,
  windowWidthIn,
  sillHeightIn,
  windowHeightIn,
  thicknessIn,
  jackStudConfig,
  includeNailer,
  standardWidthIn,
  onSetSillHeight,
  onSetWindowHeight,
}: WindowSizeDiagramProps) {
  const wallHeightIn = wallHeightFt * IN_PER_FT;
  const pxPerInY = DIAGRAM_HEIGHT_PX / wallHeightIn;
  const svgRef = useRef<SVGSVGElement>(null);

  const [drag, setDrag] = useState<{ handle: DragHandle; sillIn: number; heightIn: number } | null>(null);

  const liveSillIn = drag?.sillIn ?? sillHeightIn;
  const liveHeightIn = drag?.heightIn ?? windowHeightIn;

  const yForHeightIn = (heightFromFloorIn: number) => DIAGRAM_HEIGHT_PX - heightFromFloorIn * pxPerInY;

  // True-to-scale width, matching PanelElevationDiagram's convention —
  // accurate relative proportions (thin jack studs vs. a wider sill/header)
  // only make visual sense if X and Y share one consistent scale. Falls
  // back to a smaller X-only scale (mirroring the same non-uniform-scale
  // precedent WallElevationView already sets for long walls) only in the
  // rare short-wall/wide-window case that would otherwise overflow the note.
  const windowWidthPxUncapped = windowWidthIn * pxPerInY;
  const windowWidthPx = Math.min(MAX_WINDOW_WIDTH_PX, Math.max(MIN_WINDOW_WIDTH_PX, windowWidthPxUncapped));
  const pxPerInX = windowWidthPx / windowWidthIn;

  const svgWidthPx = windowWidthPx + 2 * WALL_SIDE_MARGIN_PX;
  const windowXPx = WALL_SIDE_MARGIN_PX;
  const xToPx = (xIn: number) => windowXPx + xIn * pxPerInX;

  const openingGeometry = useMemo(
    () => computeOpeningGeometry(false, windowWidthIn, wallHeightIn, liveSillIn, liveHeightIn, jackStudConfig, standardWidthIn),
    [windowWidthIn, wallHeightIn, liveSillIn, liveHeightIn, jackStudConfig, standardWidthIn],
  );
  const members = useMemo(
    () =>
      buildOpeningAssemblyMembers(
        windowWidthIn,
        thicknessIn,
        "window",
        jackStudConfig,
        openingGeometry.sillHeightIn,
        openingGeometry.jackStudSpanIn,
        openingGeometry.headerHeightIn,
        openingGeometry.sillHeightIn,
        openingGeometry.sillWidthsIn,
        includeNailer,
      ),
    [windowWidthIn, thicknessIn, jackStudConfig, openingGeometry, includeNailer],
  );

  // The actual glazed opening — an explicitly OPEN area (no member fills it,
  // matching the 3D view exactly), inset between the two jack studs.
  const roGapXPx = xToPx(openingGeometry.jackThicknessIn);
  const roGapWidthPx = xToPx(windowWidthIn - openingGeometry.jackThicknessIn) - roGapXPx;
  const roGapTopPx = yForHeightIn(openingGeometry.roTopZIn);
  const roGapHeightPx = yForHeightIn(openingGeometry.sillHeightIn) - roGapTopPx;

  const sillYPx = yForHeightIn(liveSillIn);
  const headerYPx = yForHeightIn(liveSillIn + liveHeightIn);

  const beginDrag = (handle: DragHandle) => (e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation();
    // Pointer capture keeps the drag tracking correctly even if the cursor
    // strays outside the thin grip strip (or the whole SVG) mid-gesture —
    // best-effort only: a capture failure (e.g. an already-released
    // pointer) shouldn't silently kill the drag, since setDrag below is
    // what actually drives the interaction.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore — see comment above
    }
    setDrag({ handle, sillIn: sillHeightIn, heightIn: windowHeightIn });
  };

  const onPointerMove = (e: ReactPointerEvent<SVGElement>) => {
    if (!drag || !svgRef.current) return;
    // Always measure against the outer <svg>'s own rect, never
    // e.currentTarget's — pointer capture (set in beginDrag) redirects
    // move/up events to the thin <g> grip strip that received the
    // pointerdown, whose own bounding rect is only ~16px tall, not the
    // full diagram height.
    const rect = svgRef.current.getBoundingClientRect();
    const yPx = ((e.clientY - rect.top) / rect.height) * DIAGRAM_HEIGHT_PX;
    const heightFromFloorIn = (DIAGRAM_HEIGHT_PX - yPx) / pxPerInY;

    if (drag.handle === "sill") {
      // Visual-only floor/ceiling so the grip line can't cross the header
      // or the floor while dragging — the authoritative range clamp still
      // happens in onSetSillHeight after release. Rounded to the nearest
      // whole inch for a steadier, more predictable drag feel (Tommy: "i
      // want window editor sizing to be very user friendly") — applied
      // after the clamp so rounding never pushes the value back out of range.
      const nextSillIn = Math.round(Math.min(Math.max(heightFromFloorIn, 0), sillHeightIn + windowHeightIn - 1));
      setDrag({ handle: "sill", sillIn: nextSillIn, heightIn: windowHeightIn });
    } else {
      const nextHeightIn = Math.round(Math.max(1, heightFromFloorIn - sillHeightIn));
      setDrag({ handle: "header", sillIn: sillHeightIn, heightIn: nextHeightIn });
    }
  };

  const endDrag = () => {
    if (!drag) return;
    if (drag.handle === "sill") onSetSillHeight(drag.sillIn);
    else onSetWindowHeight(drag.heightIn);
    setDrag(null);
  };

  const grip = (yPx: number, color: string, handle: DragHandle, label: string) => (
    <g style={{ cursor: "ns-resize", touchAction: "none" }} onPointerDown={beginDrag(handle)} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <rect x={0} y={yPx - HANDLE_GRAB_HEIGHT_PX / 2} width={svgWidthPx} height={HANDLE_GRAB_HEIGHT_PX} fill="transparent" />
      <line x1={0} y1={yPx} x2={svgWidthPx} y2={yPx} stroke={color} strokeWidth={2} strokeDasharray="4 3" />
      <circle cx={svgWidthPx - 8} cy={yPx} r={5} fill={color} />
      {/* A filled chip behind the live label for contrast against the now-busier member breakdown behind it. */}
      <rect x={2} y={yPx - 16} width={label.length * 6 + 4} height={12} fill="#fafafa" opacity={0.85} />
      <text x={4} y={yPx - 5} fontSize={10} fill={color}>
        {label}
      </text>
    </g>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg
        ref={svgRef}
        width={svgWidthPx}
        height={DIAGRAM_HEIGHT_PX}
        viewBox={`0 0 ${svgWidthPx} ${DIAGRAM_HEIGHT_PX}`}
        style={{ maxWidth: "100%", height: "auto", border: "1px solid #ccc", background: "#fafafa" }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Wall outline, floor to top plate */}
        <rect x={0} y={0} width={svgWidthPx} height={DIAGRAM_HEIGHT_PX} fill="none" stroke="#999" strokeWidth={1} />

        {/* Real header/jack-stud/sill framing, colored exactly like the 3D Framed view. */}
        <MemberElevationShapes members={members} xToPx={xToPx} zToPx={yForHeightIn} />

        {/* The actual glazed opening — open, not filled by any member, matching the 3D view. */}
        <rect
          x={roGapXPx}
          y={roGapTopPx}
          width={Math.max(0, roGapWidthPx)}
          height={Math.max(0, roGapHeightPx)}
          fill="none"
          stroke="#6fa0c9"
          strokeWidth={1.5}
          strokeDasharray="5 3"
        />

        {grip(sillYPx, "#2f8f4e", "sill", `sill ${liveSillIn.toFixed(1)}"`)}
        {grip(headerYPx, "#c0392b", "header", `header ${(liveSillIn + liveHeightIn).toFixed(1)}"`)}
      </svg>
      <p style={{ fontSize: 11, color: "#777", margin: 0, textAlign: "center" }}>
        Drag the green (sill) or red (header) line — RO height {liveHeightIn.toFixed(1)}in, sill {liveSillIn.toFixed(1)}in off the floor.
      </p>
    </div>
  );
}
