"use client";

import type { BoxBeamCoverage, Footprint, PanelSlot, WallRunStop } from "@building-integrity/geometry";
import type {
  BoxBeamSizeId,
  BracingStyle,
  GirtStyle,
  JackStudConfig,
  PanelPlanMitre,
  StudConfig,
} from "@building-integrity/panel-catalog";
import Building3DView, { type InteriorBearingWallsByWallId } from "./Building3DView";
import type { MidWallBeam } from "./midWallBeam";
import type { SpanningHeader } from "./spanningHeader";

export interface BuildingSummaryRenderProps {
  footprint: Footprint | null;
  wallSlots: Record<string, PanelSlot[]>;
  wallHeightFt: number;
  maxPanelHeightIn: number;
  thicknessIn: number;
  includeNailer: boolean;
  /** See Building3DView's own prop doc — forwarded so the captured summary
   * image shows the same girts the live model does. */
  girtStyle?: GirtStyle;
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
  /** The second bevel on each wall's gable row, forwarded straight through to
   *  `Building3DView` — see its own prop for what the number means. */
  gableCrossRiseInByWallId?: Record<string, number>;
  gablePlanMitreByTile?: Record<string, PanelPlanMitre>;
  wallPlanMitreByWallId?: Record<string, PanelPlanMitre>;
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
  /* ⚠ **THE FLOOR AND ROOF DECKS — ADDED 2026-11-26, AND THEY HAD NEVER BEEN
     FORWARDED AT ALL.** `showFloorPanels` and `showRoofPanels` default to
     `false` in `Building3DView`, and nothing here passed them, so the static
     rendering on the Project Summary drew walls and gable tiles only — on
     every building, since this component was written. The panel table
     directly beside the picture was meanwhile saying "13 floor + 12 roof" on
     a Tiny House. This file's own doc comment called that case *"the quietest
     kind of wrong"*.

     ⚠ They are gated on the SCOPE flags (`floorsEnabled` / `roofEnabled`),
     NOT on the layer toggles beside the live 3D view. Those toggles exist so
     somebody can lift a deck off and look inside; a printed proposal should
     show what is built, and `roofEnabled` above is already forwarded on
     exactly that basis.

     The remaining four are what the deck takeoff needs to place the panels on
     a real slope — see `computeDeckPanelTakeoff`'s inputs. Without a pitch
     there is no plane to lay a roof deck on and it is withheld. */
  showFloorPanels?: boolean;
  showRoofPanels?: boolean;
  roofPitchIn12?: number;
  roofEaveHeightFt?: number;
  roofForm?: "shed" | "peaked";
  roofGableEndInsetIn?: number;
  /** The roof-top lift on a gable row — forwarded so the rows the summary
   *  already drew still meet the deck it now draws above them. */
  gableEndsFullHeight?: boolean;
  crossTiltWallIds?: Set<string>;
  /* ⚠ **THE BALE FOUNDATION — THE SAME OMISSION, FOUND BY DIFFING THE TWO
     CALL SITES.** The live view takes six props that draw the Bale
     Foundation's rim rings and field stacks and none of them reached here,
     so picking Bale Foundation (the Floor tab's own default option, per B7's
     note) changed the live model and left the proposal's picture showing a
     building with nothing under it.

     ⚠ Found only because the decks above were fixed first and the list was
     then diffed end to end — the other 20 props the live view holds back are
     interaction handlers and viewer toggles, which a static capture is right
     not to have. The lesson is in the shape: this component spreads
     `{...props}` straight into `Building3DView`, so its interface is the ONLY
     thing deciding what the picture knows about, and a prop added to the live
     view is silently absent here forever after. */
  isBaleFoundationFloor?: boolean;
  baleFoundationTopDepthIn?: number;
  baleFoundationBottomDepthIn?: number;
  baleFoundationGapIn?: number;
  baleFoundationFieldSpacingIn?: number;
  floorBottomSkinEnabled?: boolean;
  /** B34 stride 3b — forwarded so the captured summary image shows the
   *  dividing walls at the same height the live model does. Without them the
   *  Project Summary's own picture would be the only place in the app still
   *  drawing a bearing wall stopped at the ceiling. */
  groundInteriorBearingWalls?: InteriorBearingWallsByWallId;
  secondStoryInteriorBearingWalls?: InteriorBearingWallsByWallId;
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
  /** Always fires when a requested capture is finished with, including when
   * it was skipped as unnecessary — the PDF export waits on it. */
  onCaptureDone?: () => void;
  /** True only while the Project Summary note is open, i.e. while the image
   * is actually on screen. Everything below about the cost of this canvas
   * applies to `captureLive`, not to the canvas being mounted. */
  captureLive?: boolean;
  /** Bump to take one capture now even when not live. */
  captureRequestId?: number;
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
