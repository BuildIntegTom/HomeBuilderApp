"use client";

import type { Footprint, PanelSlot } from "@building-integrity/geometry";
import type { StudConfig } from "@building-integrity/panel-catalog";
import Building3DView from "./Building3DView";

export interface BuildingSummaryRenderProps {
  footprint: Footprint | null;
  wallSlots: Record<string, PanelSlot[]>;
  wallHeightFt: number;
  thicknessIn: number;
  includeNailer: boolean;
  primaryCornerIds: Set<string>;
  secondStory?: { wallHeightFt: number; wallSlots: Record<string, PanelSlot[]> } | null;
  isSquareBalePanelization?: boolean;
  squareBaleStudConfig?: StudConfig;
  nailerOffsetIn?: number;
  onCapture: (dataUrl: string) => void;
}

/**
 * Off-screen, non-interactive SE bird's-eye render used to produce the
 * static image on the Project Summary page (Tommy: "a static 3d rendering
 * image from a SE birdseye view") — a captured PNG prints/exports reliably
 * where a live WebGL canvas would not. Rendered visually off-screen (not
 * `display:none`, which would give the canvas zero size and nothing to
 * capture) so it never appears in the normal page flow. Reuses
 * Building3DView's exact scene-building logic via its `captureMode` prop
 * rather than duplicating it.
 */
export default function BuildingSummaryRender(props: BuildingSummaryRenderProps) {
  return (
    <div aria-hidden="true" style={{ position: "fixed", top: 0, left: "-9999px", pointerEvents: "none" }}>
      <Building3DView {...props} captureMode onCapture={props.onCapture} />
    </div>
  );
}
