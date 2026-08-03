import type { PanelSlot, PanelSlotZone } from "./types";
import type { WallVerticalBand } from "./wallVerticalBands";

/** The single implicit zone a slot with no real `zones` array represents —
 * its own top-level fields, unchanged. */
export function zoneFromSlot(slot: PanelSlot): PanelSlotZone {
  return {
    type: slot.type,
    secondaryType: slot.secondaryType,
    heightIn: slot.heightIn,
    sillHeightIn: slot.sillHeightIn,
    bracedPattern: slot.bracedPattern,
    bracedMirrored: slot.bracedMirrored,
  };
}

/** Sets a slot's real `zones` array, keeping the bottom-most zone
 * (`zones[0]`) mirrored onto the slot's own top-level fields — every
 * horizontal/structural consumer of PanelSlot (retile, tiling, corner
 * ownership, braced placement) only ever reads those top-level fields, so
 * this mirroring is what keeps them making sane decisions with zero
 * changes of their own, even once a column has independently-typed zones. */
export function applyZonesToSlot(slot: PanelSlot, zones: PanelSlotZone[]): PanelSlot {
  const bottom = zones[0]!;
  return {
    ...slot,
    type: bottom.type,
    secondaryType: bottom.secondaryType,
    heightIn: bottom.heightIn,
    sillHeightIn: bottom.sillHeightIn,
    bracedPattern: bottom.bracedPattern,
    bracedMirrored: bottom.bracedMirrored,
    zones,
  };
}

/**
 * Safe, always-correct-SHAPE zones for rendering — pads with fresh
 * "standard" zones if `slot.zones` hasn't caught up to `bandCount` yet
 * (e.g. a just-loaded project whose walls predate this feature, or whose
 * own maxPanelHeightIn default already implies a split nothing has
 * reconciled yet), and truncates if it somehow has more than `bandCount`.
 * This is the dumb, render-time fallback — real split/merge DATA
 * preservation is `reconcilePanelSlotZones`'s job, called from the
 * handlers that actually change band-determining inputs. */
export function effectiveZonesForSlot(slot: PanelSlot, bandCount: number): PanelSlotZone[] {
  const zones = slot.zones ?? [zoneFromSlot(slot)];
  if (zones.length === bandCount) return zones;
  if (zones.length > bandCount) return zones.slice(0, bandCount);
  return [...zones, ...Array.from({ length: bandCount - zones.length }, (): PanelSlotZone => ({ type: "standard" }))];
}

/**
 * Reconciles a column's own zone DATA against a fresh band computation —
 * called from inside the handler that changed whatever input (a beam's
 * height/coverage, maxPanelHeightIn, story wallHeightFt) just moved band
 * boundaries, using the OLD bands/zones (computed from the pre-mutation
 * inputs, still in the handler's own closure) and the NEW bands (computed
 * from the proposed post-mutation inputs).
 *
 * Rule: a new band inherits an old zone's data iff the new band's range
 * contains that old band's own BOTTOM edge. A new band containing multiple
 * old bottoms (a merge) keeps the LOWEST one's zone — "prioritizing the
 * bottom panel" (Tommy). A new band containing no old bottom (a fresh
 * split) defaults to "standard". This single rule handles split, merge,
 * and an unchanged/reshaped band (a live drag that doesn't change band
 * count) uniformly, without a separate count-based special case.
 */
export function reconcilePanelSlotZones(oldBands: WallVerticalBand[], oldZones: PanelSlotZone[], newBands: WallVerticalBand[]): PanelSlotZone[] {
  return newBands.map((newBand) => {
    const contained = oldBands
      .map((band, i) => ({ band, zone: oldZones[i] }))
      .filter((entry): entry is { band: WallVerticalBand; zone: PanelSlotZone } => entry.zone !== undefined)
      .filter(({ band }) => band.bottomIn >= newBand.bottomIn && band.bottomIn < newBand.topIn);
    if (contained.length === 0) return { type: "standard" as const };
    contained.sort((a, b) => a.band.bottomIn - b.band.bottomIn);
    return contained[0]!.zone;
  });
}
