import type { BoxBeamSizeId } from "@building-integrity/panel-catalog";

export interface MidWallBeam {
  /** Height of the beam's own bottom face, measured from this story's own
   * floor (0 = floor). */
  heightIn: number;
  sizeId: BoxBeamSizeId;
}
