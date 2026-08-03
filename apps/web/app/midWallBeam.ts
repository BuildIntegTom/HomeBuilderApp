import { computeBoxBeamAssemblyHeightIn, type BoxBeamSizeId } from "@building-integrity/panel-catalog";
import type { MidWallBeamGeometry } from "@building-integrity/geometry";

/** "box-beam" = the original insulated Box Beam (dense-pack cellulose
 * cavity, sized from the 5-size catalog); "web-braced-lintel" = Tommy:
 * "elongated header panels that have W bracing" — a solid framed + braced
 * panel like a window header, with its own continuously user-adjustable
 * height instead of a discrete catalog size. */
export type MidWallBeamKind = "box-beam" | "web-braced-lintel";

/** Within this distance of the roofline (that row's own ceiling), a
 * dragged beam's own top edge snaps flush with the ceiling instead of
 * leaving a short standalone wall panel wedged above it — Tommy: "when a
 * li[n]tel panel is 6" or closer to the roof line, lets snap it into place
 * as the tallest panel that fills that space," generalized to box-beam
 * kind too (Stride 3a). A lintel grows its own `lintelHeightIn` to close
 * the gap (its own assembly height is user-adjustable); a box-beam has no
 * such independent "grow the assembly" concept (its depth is fixed by
 * `sizeId`), so it instead snaps `heightIn` itself — the whole beam slides
 * up flush with the ceiling. See WallElevationDiagram.tsx's own height-drag
 * effect for both. */
export const MID_WALL_BEAM_ROOFLINE_SNAP_THRESHOLD_IN = 6;
/** Within this distance of a covered window's own header bottom (= its RO's
 * own top), a dragged beam's own bottom edge snaps flush with it instead of
 * stopping just short — Tommy: "box beams, when their bottom is 3 inches
 * from a door or window header's bottom, should snap to that." Once
 * snapped, the header itself just shrinks to fit within its own band
 * (rowWallHeightIn already stops exactly there — see
 * computeWallVerticalBandsForSlot), no separate "push" logic needed. */
export const MID_WALL_BEAM_HEADER_SNAP_THRESHOLD_IN = 3;
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
 * WallElevationDiagram.tsx's drag/render, Building3DView.tsx) should call
 * instead of reading sizeId/lintelHeightIn directly. */
export function resolveMidWallBeamAssemblyHeightIn(beam: MidWallBeam): number {
  return beam.kind === "web-braced-lintel" ? (beam.lintelHeightIn ?? LINTEL_MIN_HEIGHT_IN) : computeBoxBeamAssemblyHeightIn(beam.sizeId);
}

/** Resolves each beam's own real assemblyHeightIn (via
 * resolveMidWallBeamAssemblyHeightIn) — the one place `MidWallBeam` (the
 * app-level, catalog-aware type) turns into `MidWallBeamGeometry` (the
 * geometry package's own catalog-agnostic input), so every consumer
 * (panelInstances.ts, WallElevationDiagram.tsx, Building3DView.tsx) resolves
 * sizes identically regardless of kind. */
export function midWallBeamsToGeometry(beams: MidWallBeam[]): MidWallBeamGeometry[] {
  return beams.map((b) => ({
    heightIn: b.heightIn,
    assemblyHeightIn: resolveMidWallBeamAssemblyHeightIn(b),
    startSlotIndex: b.startSlotIndex,
    endSlotIndex: b.endSlotIndex,
  }));
}
