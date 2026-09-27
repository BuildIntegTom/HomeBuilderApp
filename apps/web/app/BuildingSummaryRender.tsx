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
 */
export default function BuildingSummaryRender(props: BuildingSummaryRenderProps) {
  return (
    <div aria-hidden="true" style={{ position: "fixed", top: 0, left: "-9999px", pointerEvents: "none" }}>
      <Building3DView {...props} captureMode onCapture={props.onCapture} />
    </div>
  );
}
