import { computeBoxBeamAssemblyHeightIn, type BoxBeamSizeId } from "@building-integrity/panel-catalog";
import type { MidWallBeamGeometry } from "@building-integrity/geometry";

/** "box-beam" = the original insulated Box Beam (dense-pack cellulose
 * cavity, sized from the 5-size catalog); "web-braced-lintel" = Tommy:
 * "elongated header panels that have W bracing" — a solid framed + braced
 * panel like a window header, with its own continuously user-adjustable
 * height instead of a discrete catalog size. */
export type MidWallBeamKind = "box-beam" | "web-braced-lintel";

/** Within this distance of the roofline (that row's own ceiling), a
 * dragged lintel's own top edge snaps flush with the ceiling instead of
 * leaving a short standalone wall panel wedged above it — Tommy: "when a
 * li[n]tel panel is 6" or closer to the roof line, lets snap it into place
 * as the tallest panel that fills that space." Box-beam-kind beams never
 * snap — this is a lintel-only behavior. */
export const LINTEL_ROOFLINE_SNAP_THRESHOLD_IN = 6;
/** Floor for a lintel's own draggable height — a sane minimum so it can
 * never collapse to zero/negative, not a sourced spec. */
export const LINTEL_MIN_HEIGHT_IN = 6;

export interface MidWallBeam {
  id: string;
  /** Height of the beam's own bottom face, measured from this story's own
   * floor (0 = floor). */
  heightIn: number;
  kind: MidWallBeamKind;
  /** Meaningful only when kind === "box-beam". */
  sizeId?: BoxBeamSizeId;
  /** Meaningful only when kind === "web-braced-lintel" — this lintel's own
   * real assembly height, directly user-adjustable (its own draggable top
   * edge) rather than picked from a catalog. */
  lintelHeightIn?: number;
  /** This beam's own horizontal coverage, in slot indices within its
   * wall's own PanelSlot[] array — same half-open-range convention as the
   * roofline Box Beam's own BoxBeamCoverage. */
  startSlotIndex: number;
  endSlotIndex: number;
}

/** Resolves a beam's own real assembly height regardless of kind — a
 * box-beam's sizeId through the catalog (unchanged), a lintel's own
 * lintelHeightIn directly. The single choke point every consumer
 * (midWallBeamsToGeometry below, page.tsx's fabrication grouping/pricing,
 * WallElevationView.tsx's drag/render, Building3DView.tsx) should call
 * instead of reading sizeId/lintelHeightIn directly. */
export function resolveMidWallBeamAssemblyHeightIn(beam: MidWallBeam): number {
  return beam.kind === "web-braced-lintel" ? (beam.lintelHeightIn ?? LINTEL_MIN_HEIGHT_IN) : computeBoxBeamAssemblyHeightIn(beam.sizeId);
}

/** Resolves each beam's own real assemblyHeightIn (via
 * resolveMidWallBeamAssemblyHeightIn) — the one place `MidWallBeam` (the
 * app-level, catalog-aware type) turns into `MidWallBeamGeometry` (the
 * geometry package's own catalog-agnostic input), so every consumer
 * (panelInstances.ts, WallElevationView.tsx, Building3DView.tsx) resolves
 * sizes identically regardless of kind. */
export function midWallBeamsToGeometry(beams: MidWallBeam[]): MidWallBeamGeometry[] {
  return beams.map((b) => ({
    heightIn: b.heightIn,
    assemblyHeightIn: resolveMidWallBeamAssemblyHeightIn(b),
    startSlotIndex: b.startSlotIndex,
    endSlotIndex: b.endSlotIndex,
  }));
}
