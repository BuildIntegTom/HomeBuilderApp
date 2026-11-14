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
  /**
   * How much height the rough opening LOST to the header's own minimum —
   * 0 for every ordinary opening. Non-zero means the drawing is not the size
   * that was asked for, which is a Review Log reading, not a silent fix.
   */
  roShortfallIn: number;
}

/**
 * Shared by every renderer that needs to know where a window/door opening's
 * header, jack studs, and sill(s) actually sit — the real member 3D view
 * (Building3DView's `membersForSlot`), the simplified box 3D view
 * (`renderSimplifiedSlot`), and the 2D elevation views (WindowSizeDiagram,
 * WallElevationDiagram) — one formula, so none of them can ever drift apart.
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
  const requestedRoTopZIn = sillHeightIn + jackStudSpanIn;
  const headerHeightIn = computeHeaderHeightIn(wallHeightIn, requestedRoTopZIn);
  /**
   * ⚠ **THE OPENING GIVES WAY WHEN THE HEADER HITS ITS OWN MINIMUM.**
   *
   * `computeHeaderHeightIn` floors at `HEADER_MIN_HEIGHT_IN` (4 1/2in — two
   * chords and two caps), because below that the header is thinner than the
   * boards it is made of. Flooring the header alone would leave it hanging
   * into the rough opening, so the RO's top drops by the same shortfall and
   * the window or door loses that much height. Tommy, 2026-11-14, choosing
   * this over refusing the opening: *"let's go with option a."*
   *
   * ⚠ A header of 0 means there is NO header — an opening as tall as its wall
   * — and that case is untouched: the RO keeps the top it asked for, exactly
   * as it did before, and is reported elsewhere rather than silently resized.
   */
  const roTopZIn = headerHeightIn > 0 ? Math.min(requestedRoTopZIn, wallHeightIn - headerHeightIn) : requestedRoTopZIn;
  const builtJackStudSpanIn = Math.max(0, roTopZIn - sillHeightIn);
  const roWidthIn = computeRoughOpeningWidthIn(slotWidthIn, jackStudConfig);
  const jackThicknessIn = (slotWidthIn - roWidthIn) / 2;
  const sillWidthsIn = isDoor ? [] : computeSillRunWidths(roWidthIn, standardWidthIn);
  return {
    sillHeightIn,
    jackStudSpanIn: builtJackStudSpanIn,
    roTopZIn,
    headerHeightIn,
    jackThicknessIn,
    sillWidthsIn,
    roShortfallIn: Math.max(0, requestedRoTopZIn - roTopZIn),
  };
}
