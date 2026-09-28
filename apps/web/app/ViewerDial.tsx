"use client";

import { useRustleSound } from "./useRustleSound";
import { viewerStopKey } from "./viewerMenus";
import { viewerStopLabel } from "./viewLabels";
import styles from "./ViewerDial.module.css";

export type ViewerStop =
  | { kind: "plan" }
  | { kind: "elevation"; wallId: string; label: string }
  | { kind: "3d-framed" }
  | { kind: "3d-boxes" }
  | { kind: "3d-wraps" };

/* Neither the stop LABELS nor the stop KEYS live here any more, and for the
   same reason in both cases: this dial is no longer the only thing that
   presents them.

   - viewLabels.ts holds the labels, so anything that has to NAME the current
     view (the Report Bug note's context line, for one) reads the same strings.
   - viewerMenus.ts holds `viewerStopKey` — this file's own former private
     `stopKey` — plus the Design/View split, because U1 puts the same stops on
     the top bar at 1200px and up while this dial stays as the below-breakpoint
     form. Two presentations that disagreed about which stop is "current" would
     be a quiet, maddening bug; one key function makes it impossible.

   This dial is still the only thing that renders them AS A DIAL, and it is
   still the only home of the scroll-wheel cycling and useRustleSound. Those
   two affordances exist nowhere else, which is exactly why the dial survives
   below the breakpoint instead of being replaced. */

export interface ViewerDialProps {
  stops: ViewerStop[];
  value: ViewerStop;
  onChange: (stop: ViewerStop) => void;
  disabled: boolean;
}

/**
 * The 2D/3D view-mode control, now a dial (Tommy: "cycle the wall view
 * options... like it's in the editor wheel") built on the exact same
 * up/down-chevron + label + scroll-wheel pattern as EditorTabDial, instead
 * of the old single click-to-cycle button. Its cycle isn't fixed — the
 * caller supplies `stops`, which is 2D Floor Plan, then one "elevation"
 * stop per wall in the footprint (compass order, same as the wall list
 * already uses), then 3D Framed, then 3D Boxes, then Membranes (Tommy: "3d
 * model selected after box mode and is everything box mode is with a few
 * changes: panels not labeled, and the 3D models of the wraps appear" —
 * labeled "3D Wraps" originally, renamed to "Membranes" per Tommy's later
 * request; the internal `"3d-wraps"` stop kind is unchanged, just the
 * user-facing label).
 * Landing on any stop swaps out the whole canvas area, same as the old
 * plan/3d toggle already did.
 */
export default function ViewerDial({ stops, value, onChange, disabled }: ViewerDialProps) {
  const playRustle = useRustleSound();
  const index = Math.max(
    0,
    stops.findIndex((s) => viewerStopKey(s) === viewerStopKey(value)),
  );
  const step = (delta: number) => {
    if (disabled || stops.length === 0) return;
    const next = (index + delta + stops.length) % stops.length;
    playRustle();
    onChange(stops[next]!);
  };

  return (
    <div
      className={styles.dial}
      role="group"
      aria-label="View mode"
      title="Scroll or use the arrows to switch between 2D Floor Plan, each wall's elevation view, 3D Framed, 3D Boxes, and Membranes"
      onWheel={(e) => {
        if (disabled) return;
        e.preventDefault();
        step(e.deltaY > 0 ? 1 : -1);
      }}
    >
      <button type="button" className={styles.chevron} title="Previous view" disabled={disabled} onClick={() => step(-1)}>
        ▲
      </button>
      <div className={styles.current}>{stops[index] ? viewerStopLabel(stops[index]!) : "—"}</div>
      <button type="button" className={styles.chevron} title="Next view" disabled={disabled} onClick={() => step(1)}>
        ▼
      </button>
    </div>
  );
}
