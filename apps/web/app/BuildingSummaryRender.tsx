"use client";

import type { BoxBeamCoverage, Footprint, PanelSlot, WallRunStop } from "@building-integrity/geometry";
import type { BoxBeamSizeId, BracingStyle, JackStudConfig, StudConfig } from "@building-integrity/panel-catalog";
import Building3DView from "./Building3DView";
import type { MidWallBeam } from "./midWallBeam";
import type { SpanningHeader } from "./spanningHeader";

export interface BuildingSummaryRenderProps {
  footprint: Footprint | null;
  wallSlots: Record<string, PanelSlot[]>;
  wallHeightFt: number;
  maxPanelHeightIn: number;
  thicknessIn: number;
  includeNailer: boolean;
  primaryCornerIds: Set<string>;
  /** Stage 3 run stops — the summary render must show the same building the
   * live 3D preview does, unbuilt spans and all (i.e. nothing drawn there). */
  wallRunStopsByWallId?: Record<string, WallRunStop>;
  /** See Building3DView's own prop doc. */
  wallTilingLengthInByWallId?: Record<string, number>;
  secondStory?: { wallHeightFt: number; wallSlots: Record<string, PanelSlot[]> } | null;
  isSquareBalePanelization?: boolean;
  squareBaleStudConfig?: StudConfig;
  bracingStyle?: BracingStyle;
  nailerOffsetIn?: number;
  jackStudConfig: JackStudConfig;
  standardWidthIn: number;
  gableTilesByWallId?: Record<
    string,
    {
      widthIn: number;
      xStartIn: number;
      leftEdgeHeightIn: number;
      rightEdgeHeightIn: number;
      isSafetyGap?: boolean;
      verticalGapIn?: { leftIn: number; rightIn: number };
    }[]
  >;
  roofEnabled?: boolean;
  trussPlateInsetIn?: number;
  boxBeamCoverageByWallId?: Record<string, BoxBeamCoverage>;
  boxBeamSizeId?: BoxBeamSizeId;
  midWallBeamsByWallId?: Record<string, MidWallBeam[]>;
  secondStoryMidWallBeamsByWallId?: Record<string, MidWallBeam[]>;
  /** Smearforn Stage 2b — threaded straight through to Building3DView, so
   * the Project Summary's static render shows the same shortened panels and
   * the same drawn headers the live view does. A summary image that
   * disagreed with the model would be the quietest kind of wrong. */
  spanningHeadersByWallId?: Record<string, SpanningHeader[]>;
  secondStorySpanningHeadersByWallId?: Record<string, SpanningHeader[]>;
  spanningHeaderNameById?: Map<string, string>;
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
 *
 * ⚠ **This is the one heavy surface in the app that is mounted whenever a
 * footprint exists** — `page.tsx` renders it at the top level of the editor,
 * NOT inside a `StickyNote`, so unlike every Shop Drawing, the shipping view
 * and the octagon ring preview it does not unmount when nobody is looking at
 * it. That is deliberate (the Project Summary's image has to be ready for
 * print/PDF without the note having been opened first), and it is the reason
 * `captureMode`'s Canvas runs `frameloop="demand"`: on the default `always`
 * this canvas redrew the whole building at 60fps for the entire session.
 * Measured 2026-10-03 at ~46,000-70,000 WebGL draw calls per idle second.
 * **If anything here is ever changed to mount conditionally instead, check
 * the print and PDF-export paths first** — they read the captured PNG and
 * have no way to ask for one. See the spec, "The hidden canvas that never
 * stopped drawing".
 */
export default function BuildingSummaryRender(props: BuildingSummaryRenderProps) {
  return (
    <div aria-hidden="true" style={{ position: "fixed", top: 0, left: "-9999px", pointerEvents: "none" }}>
      <Building3DView {...props} captureMode onCapture={props.onCapture} />
    </div>
  );
}
