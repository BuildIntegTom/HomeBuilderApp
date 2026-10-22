"use client";

import type { SplitResult } from "@building-integrity/geometry";

/**
 * WHICH SIDE DO YOU KEEP?
 *
 * Tommy, 2026-10-20, on how a trapezoid gets made:
 *
 * > *"if a user makes new wall tool and adds an enclosed space - so they can
 * > delete the other wall and have a trapezoid building"*
 *
 * and on 2026-10-21, choosing split-and-choose over a delete-wall tool:
 *
 * > *"For number one I like your suggestion there."*
 *
 * ⚠ **The two buttons are colour-matched to the canvas outlines**, which is the
 * whole usability of this step. "Keep the bigger one" is meaningless on a cut
 * that makes two near-equal halves, and a dialog that only names square
 * footage would make him do the matching in his head. The region drawn in blue
 * is the blue button.
 */

/** Region A's outline on the canvas, and its button. Must match
 * `FootprintCanvas`'s own constants — they are duplicated rather than shared
 * because the canvas draws in Konva and this draws in CSS, and a single
 * exported constant that one of them quietly stopped using would be worse than
 * two that disagree visibly. */
export const SPLIT_REGION_COLORS = ["#2d6cdf", "#c76a1f"] as const;

export interface DrawWallChooserProps {
  split: SplitResult;
  onKeep: (regionIndex: 0 | 1) => void;
  onCancel: () => void;
}

const area = (sqFt: number) => `${Math.round(sqFt)} sq ft`;

export default function DrawWallChooser({ split, onKeep, onCancel }: DrawWallChooserProps) {
  return (
    <div
      role="group"
      aria-label="Keep which side"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        padding: 8,
        boxSizing: "border-box",
        border: "1px solid #ddd",
        borderRadius: 6,
        background: "#fcfcfb",
      }}
    >
      <strong style={{ fontSize: 12 }}>Keep which side?</strong>
      <span style={{ fontSize: 11, color: "#555", lineHeight: 1.35 }}>
        The new wall cuts the building in two. The side you keep becomes the building; the other is discarded.
      </span>
      {/* ⚠ Keyed by POSITION, not by `chordWallId`, and the difference is a
          real bug rather than a style point. Each region renumbers its own
          corners from "0", so a rectangle cut corner to corner gives two
          triangles whose walls are BOTH named "01", "12", "20" — the chord id
          is identical in both, and React logged "two children with the same
          key, 20" the moment the chooser rendered.

          The ids overlapping is correct and not worth avoiding: the regions are
          alternatives, only one of them survives, and each is numbered as the
          building it would become. It is only as a REACT KEY that two walls
          called "20" are a problem. Two fixed alternatives have no identity
          worth preserving across renders, so the index is the honest key. */}
      {split.regions.map((region, i) => (
        <button
          key={`region-${i}`}
          type="button"
          onClick={() => onKeep(i as 0 | 1)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            fontSize: 12,
            textAlign: "left",
            border: `2px solid ${SPLIT_REGION_COLORS[i]}`,
            borderRadius: 5,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden
            style={{ width: 12, height: 12, borderRadius: 3, background: SPLIT_REGION_COLORS[i], flex: "0 0 auto" }}
          />
          <span>
            Keep this side — {area(region.areaSqFt)}, {region.footprint.walls.length} walls
          </span>
        </button>
      ))}
      <button type="button" onClick={onCancel} style={{ fontSize: 11, padding: "4px 8px" }}>
        Cancel — leave the building as it is
      </button>
    </div>
  );
}
