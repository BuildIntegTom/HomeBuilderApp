import { computeBoxBeamAssemblyHeightIn, type BoxBeamSizeId } from "@building-integrity/panel-catalog";
import type { MidWallBeamGeometry } from "@building-integrity/geometry";

export interface MidWallBeam {
  id: string;
  /** Height of the beam's own bottom face, measured from this story's own
   * floor (0 = floor). */
  heightIn: number;
  sizeId: BoxBeamSizeId;
  /** This beam's own horizontal coverage, in slot indices within its
   * wall's own PanelSlot[] array — same half-open-range convention as the
   * roofline Box Beam's own BoxBeamCoverage. */
  startSlotIndex: number;
  endSlotIndex: number;
}

/** Resolves each beam's own sizeId into a real assemblyHeightIn — the one
 * place `MidWallBeam` (the app-level, catalog-aware type) turns into
 * `MidWallBeamGeometry` (the geometry package's own catalog-agnostic
 * input), so every consumer (panelInstances.ts, WallElevationView.tsx,
 * Building3DView.tsx) resolves sizes identically. */
export function midWallBeamsToGeometry(beams: MidWallBeam[]): MidWallBeamGeometry[] {
  return beams.map((b) => ({
    heightIn: b.heightIn,
    assemblyHeightIn: computeBoxBeamAssemblyHeightIn(b.sizeId),
    startSlotIndex: b.startSlotIndex,
    endSlotIndex: b.endSlotIndex,
  }));
}
