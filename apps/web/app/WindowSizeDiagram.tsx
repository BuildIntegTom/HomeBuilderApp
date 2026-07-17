"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const IN_PER_FT = 12;
const DIAGRAM_WIDTH_PX = 150;
const DIAGRAM_HEIGHT_PX = 260;
const NOMINAL_MAX_WINDOW_WIDTH_IN = 96; // widest realistic option — just a proportional-sizing reference, not an enforced limit
const HANDLE_GRAB_HEIGHT_PX = 16; // generous hit target around each thin grip line

export interface WindowSizeDiagramProps {
  wallHeightFt: number;
  windowWidthIn: number;
  sillHeightIn: number;
  windowHeightIn: number;
  onSetSillHeight: (requestedIn: number) => void;
  onSetWindowHeight: (requestedHeightIn: number) => void;
}

type DragHandle = "sill" | "header";

/**
 * To-scale side elevation of the wall with the window's Rough Opening
 * drawn at its actual sill/header position, plus draggable sill/header
 * grips — the 2D counterpart to Building3DView's renderSillHeaderHandles
 * Sill & Header drag tool (Tommy: "manipulate sill and header height with
 * the drag tool", "i want window editor sizing to be very user friendly").
 *
 * Purely an input surface: drag state is local (for a smooth live-follow
 * line while dragging), but the actual committed value always goes
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
  onSetSillHeight,
  onSetWindowHeight,
}: WindowSizeDiagramProps) {
  const wallHeightIn = wallHeightFt * IN_PER_FT;
  const pxPerInch = DIAGRAM_HEIGHT_PX / wallHeightIn;
  const svgRef = useRef<SVGSVGElement>(null);

  const [drag, setDrag] = useState<{ handle: DragHandle; sillIn: number; heightIn: number } | null>(null);

  const liveSillIn = drag?.sillIn ?? sillHeightIn;
  const liveHeightIn = drag?.heightIn ?? windowHeightIn;

  const yForHeightIn = (heightFromFloorIn: number) => DIAGRAM_HEIGHT_PX - heightFromFloorIn * pxPerInch;

  const windowWidthPx = Math.min(DIAGRAM_WIDTH_PX * 0.8, (windowWidthIn / NOMINAL_MAX_WINDOW_WIDTH_IN) * DIAGRAM_WIDTH_PX * 0.8);
  const windowXPx = (DIAGRAM_WIDTH_PX - windowWidthPx) / 2;

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
    const heightFromFloorIn = (DIAGRAM_HEIGHT_PX - yPx) / pxPerInch;

    if (drag.handle === "sill") {
      // Visual-only floor/ceiling so the grip line can't cross the header
      // or the floor while dragging — the authoritative range clamp still
      // happens in onSetSillHeight after release.
      const nextSillIn = Math.min(Math.max(heightFromFloorIn, 0), sillHeightIn + windowHeightIn - 1);
      setDrag({ handle: "sill", sillIn: nextSillIn, heightIn: windowHeightIn });
    } else {
      const nextHeightIn = Math.max(1, heightFromFloorIn - sillHeightIn);
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
      <rect x={0} y={yPx - HANDLE_GRAB_HEIGHT_PX / 2} width={DIAGRAM_WIDTH_PX} height={HANDLE_GRAB_HEIGHT_PX} fill="transparent" />
      <line x1={0} y1={yPx} x2={DIAGRAM_WIDTH_PX} y2={yPx} stroke={color} strokeWidth={2} strokeDasharray="4 3" />
      <circle cx={DIAGRAM_WIDTH_PX - 8} cy={yPx} r={5} fill={color} />
      <text x={4} y={yPx - 5} fontSize={10} fill={color}>
        {label}
      </text>
    </g>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg
        ref={svgRef}
        width={DIAGRAM_WIDTH_PX}
        height={DIAGRAM_HEIGHT_PX}
        viewBox={`0 0 ${DIAGRAM_WIDTH_PX} ${DIAGRAM_HEIGHT_PX}`}
        style={{ border: "1px solid #ccc", background: "#fafafa" }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Wall outline, floor to top plate */}
        <rect x={0} y={0} width={DIAGRAM_WIDTH_PX} height={DIAGRAM_HEIGHT_PX} fill="none" stroke="#999" strokeWidth={1} />
        {/* Window Rough Opening */}
        <rect
          x={windowXPx}
          y={headerYPx}
          width={windowWidthPx}
          height={Math.max(0, sillYPx - headerYPx)}
          fill="#cfe8ff"
          stroke="#2f6fa8"
          strokeWidth={1.5}
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
