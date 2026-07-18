import { computeHeaderHeightIn, computeRoughOpeningWidthIn, type JackStudConfig } from "@building-integrity/panel-catalog";
import { computeSillRunWidths } from "@building-integrity/geometry";

export interface OpeningGeometry {
  /** Floor to RO-bottom (0 for a door — its RO always starts at the floor). */
  sillHeightIn: number;
  /** The RO's own height (sill-top to header-bottom for a window; floor to
   * header-bottom for a door). */
  jackStudSpanIn: number;
  /** The RO's top elevation, measured from the floor. */
  roTopZIn: number;
  headerHeightIn: number;
  /** Each side's jack stud thickness — the sill run is inset this much from
   * either edge of the slot's own full width. */
  jackThicknessIn: number;
  /** Empty for a door (no sill). */
  sillWidthsIn: number[];
}

/**
 * Shared by every renderer that needs to know where a window/door opening's
 * header, jack studs, and sill(s) actually sit — the real member 3D view
 * (Building3DView's `membersForSlot`), the simplified box 3D view
 * (`renderSimplifiedSlot`), and the 2D elevation views (WindowSizeDiagram,
 * WallElevationView) — one formula, so none of them can ever drift apart.
 * Scalar-based rather than `PanelSlot`-based since not every caller has a
 * real `PanelSlot` object (WindowSizeDiagram only has individual scalar
 * props) — each caller resolves its own "this slot's effective sill/RO
 * height, falling back to project defaults" logic and passes already-
 * resolved scalars in.
 */
export function computeOpeningGeometry(
  isDoor: boolean,
  slotWidthIn: number,
  wallHeightIn: number,
  sillHeightIn: number,
  jackStudSpanIn: number,
  jackStudConfig: JackStudConfig,
  standardWidthIn: number,
): OpeningGeometry {
  const roTopZIn = sillHeightIn + jackStudSpanIn;
  const headerHeightIn = computeHeaderHeightIn(wallHeightIn, roTopZIn);
  const roWidthIn = computeRoughOpeningWidthIn(slotWidthIn, jackStudConfig);
  const jackThicknessIn = (slotWidthIn - roWidthIn) / 2;
  const sillWidthsIn = isDoor ? [] : computeSillRunWidths(roWidthIn, standardWidthIn);
  return { sillHeightIn, jackStudSpanIn, roTopZIn, headerHeightIn, jackThicknessIn, sillWidthsIn };
}
