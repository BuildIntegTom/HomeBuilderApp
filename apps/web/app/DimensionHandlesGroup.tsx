"use client";

import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { formatFeetInches, resolveLengthEntry } from "./canvasGeometry";
import { clampHandleValueFt, type DimensionHandle, type DimensionHandleId } from "./dimensionHandles";

/**
 * ⚠ **U6 stride 2 — the five handles, drawn and driven.**
 *
 * Each badge floats at its own point on the model and offers the same number
 * three ways: chevrons for a step, a pointer drag for a sweep, and a typed
 * field for the truth. ⚠ **The typed field is the master** — his rule for this
 * item, and B29/B30's for the panel editor's drag before it: *the gesture
 * proposes, the arithmetic disposes.* A drag never writes a number of its own;
 * it proposes one, and the commit snaps it to the eighth and, on an octagon,
 * SOLVES for the box rather than taking it literally.
 *
 * ⚠ **This component owns no resize logic.** Every commit goes out through
 * `onCommit` to the seam `page.tsx` already uses for the typed fields, which
 * is why U6's stride 1 came first: without it this would have been a fifth
 * copy of "rebuild the footprint" and the first place the handles could drift
 * from the sidebar.
 */

/** How far a badge can be dragged before the gesture counts as a drag rather
 * than a click, px. Below it the pointer-up opens the typed field, which is
 * what a click on a number should do. */
const DRAG_THRESHOLD_PX = 4;

export interface DimensionHandlesGroupProps {
  handles: DimensionHandle[];
  /** Commits a handle's new value in FEET. The caller decides what that means
   * — a wall length, a height, a position along a wall — and routes it to the
   * same function the typed sidebar field uses. */
  onCommit: (id: DimensionHandleId, valueFt: number) => void;
  /** The length of the wall a position handle runs along, feet, so a thrown
   * drag can be held on it. */
  wallLengthFtFor: (handle: DimensionHandle) => number;
}

/**
 * How many pixels one foot along this handle's axis covers on screen, as a
 * 2-D screen vector.
 *
 * ⚠ **Projected per drag, not assumed.** The same world foot is a different
 * number of pixels depending on where the camera is and how far away the
 * handle sits, and an orbiting user changes both. Taking the projection at
 * pointer-down means a drag tracks the model under the pointer instead of
 * running at some fixed sensitivity that is wrong at every zoom but one.
 */
function axisScreenVector(
  anchorFt: readonly [number, number, number],
  axisFt: readonly [number, number, number],
  camera: Parameters<typeof projectPoint>[1],
  size: { width: number; height: number },
): { x: number; y: number } {
  const a = projectPoint(new Vector3(anchorFt[0], anchorFt[1], anchorFt[2]), camera, size);
  const b = projectPoint(
    new Vector3(anchorFt[0] + axisFt[0], anchorFt[1] + axisFt[1], anchorFt[2] + axisFt[2]),
    camera,
    size,
  );
  return { x: b.x - a.x, y: b.y - a.y };
}

function projectPoint(
  point: Vector3,
  camera: { projectionMatrix: unknown; matrixWorldInverse: unknown },
  size: { width: number; height: number },
): { x: number; y: number } {
  const projected = point.clone().project(camera as never);
  return {
    x: ((projected.x + 1) / 2) * size.width,
    y: ((1 - projected.y) / 2) * size.height,
  };
}

interface DragState {
  id: DimensionHandleId;
  startValueFt: number;
  startClientX: number;
  startClientY: number;
  /** Screen pixels per foot along the handle's axis. */
  screenPerFt: { x: number; y: number };
  moved: boolean;
}

export default function DimensionHandlesGroup({ handles, onCommit, wallLengthFtFor }: DimensionHandlesGroupProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  /* ⚠ A ref, not state: a drag updates many times a second and re-rendering
     the whole badge set on every pointer move would fight the drag it is
     trying to follow. The live value goes to React once per move, through
     `draftFt`, and the bookkeeping stays out of the render path. */
  const dragRef = useRef<DragState | null>(null);
  const [draft, setDraft] = useState<{ id: DimensionHandleId; valueFt: number } | null>(null);
  const [typing, setTyping] = useState<{ id: DimensionHandleId; text: string } | null>(null);

  const beginDrag = (handle: DimensionHandle, event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const screenPerFt = axisScreenVector(handle.anchorFt, handle.axisFt, camera, size);
    /* An axis pointing almost straight at the camera covers no pixels, so a
       drag along it would be an enormous move per pixel. Refuse rather than
       run away with the building: the chevrons and the typed field still work,
       and orbiting a few degrees makes the drag available again. */
    if (Math.hypot(screenPerFt.x, screenPerFt.y) < 2) return;
    dragRef.current = {
      id: handle.id,
      startValueFt: handle.valueFt,
      startClientX: event.clientX,
      startClientY: event.clientY,
      screenPerFt,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (handle: DimensionHandle, event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== handle.id) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    /* The component of the pointer's travel that lies along the handle's own
       axis, in feet: a dot product over the axis's squared screen length. */
    const lengthSq = drag.screenPerFt.x ** 2 + drag.screenPerFt.y ** 2;
    const alongFt = (dx * drag.screenPerFt.x + dy * drag.screenPerFt.y) / lengthSq;
    const proposed = clampHandleValueFt(handle, drag.startValueFt + alongFt, wallLengthFtFor(handle));
    setDraft({ id: handle.id, valueFt: proposed });
  };

  const endDrag = (handle: DimensionHandle, event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag || drag.id !== handle.id) return;
    if (!drag.moved) {
      /* A click, not a drag: open the number for typing, which is the control
         that can say an eighth. */
      setTyping({ id: handle.id, text: formatFeetInches(handle.valueFt) });
      return;
    }
    const committed = draft?.id === handle.id ? draft.valueFt : drag.startValueFt;
    setDraft(null);
    onCommit(handle.id, committed);
  };

  return (
    <>
      {handles.map((handle) => {
        const shownFt = draft?.id === handle.id ? draft.valueFt : handle.valueFt;
        const isTyping = typing?.id === handle.id;
        return (
          <Html
            key={handle.id}
            position={handle.anchorFt}
            center
            /* ⚠ `zIndexRange` low so a badge never covers the app's own menus;
               the Canvas is inside the page's normal stacking context. */
            zIndexRange={[20, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div
              title={handle.hint}
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: "2px 3px",
                borderRadius: 999,
                border: "1px solid #4a5a6a",
                background: "rgba(255,255,255,0.94)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                font: "11px/1.1 system-ui, sans-serif",
                color: "#1d2733",
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              <Chevron
                label={`Decrease ${handle.label}`}
                onClick={() =>
                  onCommit(
                    handle.id,
                    clampHandleValueFt(handle, handle.valueFt - handle.stepFt, wallLengthFtFor(handle)),
                  )
                }
              >
                −
              </Chevron>
              {isTyping ? (
                <input
                  autoFocus
                  aria-label={`${handle.label}, in feet and inches`}
                  value={typing.text}
                  size={8}
                  onChange={(e) => setTyping({ id: handle.id, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setTyping(null);
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  onBlur={() => {
                    /* ⚠ The same reader every other length field in this app
                       uses, so `20 1/2` means here what it means on a wall. */
                    const parsed = resolveLengthEntry(typing.text, "ft");
                    setTyping(null);
                    if (parsed.value !== null) {
                      onCommit(handle.id, clampHandleValueFt(handle, parsed.value, wallLengthFtFor(handle)));
                    }
                  }}
                  style={{ font: "inherit", width: 68, border: "1px solid #9aa7b4", borderRadius: 4, padding: "1px 3px" }}
                />
              ) : (
                <button
                  type="button"
                  aria-label={`${handle.label}: ${formatFeetInches(shownFt)}. Drag to change, or click to type.`}
                  onPointerDown={(e) => beginDrag(handle, e)}
                  onPointerMove={(e) => moveDrag(handle, e)}
                  onPointerUp={(e) => endDrag(handle, e)}
                  onPointerCancel={(e) => endDrag(handle, e)}
                  style={{
                    font: "inherit",
                    border: "none",
                    background: "none",
                    padding: "1px 4px",
                    cursor: handle.axisFt[1] === 1 ? "ns-resize" : "ew-resize",
                    color: "inherit",
                    touchAction: "none",
                  }}
                >
                  <span style={{ color: "#5a6a7a" }}>{handle.label} </span>
                  <strong>{formatFeetInches(shownFt)}</strong>
                </button>
              )}
              <Chevron
                label={`Increase ${handle.label}`}
                onClick={() =>
                  onCommit(
                    handle.id,
                    clampHandleValueFt(handle, handle.valueFt + handle.stepFt, wallLengthFtFor(handle)),
                  )
                }
              >
                +
              </Chevron>
            </div>
          </Html>
        );
      })}
    </>
  );
}

function Chevron({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      /* ⚠ Stopped here as well as on the drag: without it a chevron click
         reaches the Canvas, where `onPointerMissed` clears the Orbit tool's
         re-centring. */
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        font: "inherit",
        lineHeight: 1,
        width: 16,
        height: 16,
        borderRadius: 999,
        border: "1px solid #b7c2cd",
        background: "#f3f6f9",
        color: "#28333f",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}
