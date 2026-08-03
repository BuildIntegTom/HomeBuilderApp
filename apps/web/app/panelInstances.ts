import {
  computeWallVerticalBandsForSlotWithMaxHeight,
  effectiveZonesForSlot,
  isSlotBoxBeamCovered,
  wallCompassDirection,
  zoneFromSlot,
  computeSillRunWidths,
  type BoxBeamCoverage,
  type CompassDirection,
  type Footprint,
  type MidWallBeamGeometry,
  type PanelSlot,
  type PanelSlotZone,
} from "@building-integrity/geometry";
import {
  computeRoughOpeningWidthIn,
  computeStandardGirtRowCount,
  panelHeightInRange,
  type BracePattern,
  type JackStudConfig,
} from "@building-integrity/panel-catalog";

/** Every real structural panel this app can name/count — header and sill
 * are derived from window/door slots (see allPanelInstances), not their
 * own PanelSlot type: a window/door opening isn't a panel itself, but the
 * header above it (and, for a window, the sill below it) are. */
export type NamedPanelType =
  | "standard"
  | "corner"
  | "safety-oct-corner"
  | "braced"
  | "safety-gap"
  | "header"
  | "sill"
  | "column"
  | "gable"
  | "jack-stud";

export interface PanelInstance {
  /** e.g. "N-3" — sequential per compass direction, across every wall
   * facing that direction, in true along-wall order (matches how a real
   * shop drawing would number panels along a building side, including
   * multiple wall segments on the same side from a bump-out). */
  name: string;
  wallId: string;
  panelType: NamedPanelType;
  widthIn: number;
  /** This slot's index within its wall's own slots array — lets a caller
   * match an instance back to the same slot a renderer (e.g.
   * computeSlotRects) is drawing, via wallId + slotIndex. A window slot
   * produces multiple instances (1 header + however many sill panels
   * share the run — see `computeSillRunWidths`) sharing the same
   * slotIndexInWall, since they're stacked in elevation, not sequential
   * in plan. */
  slotIndexInWall: number;
  /** Only set for "header"/"sill" instances — which opening type produced
   * them ("window" or "door"), since both collapse into the same
   * `panelType` ("header") otherwise. Lets a caller pick a door-header vs.
   * window-header 3D model for what's still one Shop Drawing page/type. */
  sourceSlotType?: PanelSlot["type"];
  /** Only set for "header" instances derived from a "window" slot — that
   * window's own selected height (Tommy: "i want each window individually
   * adjustable"), carried through from `PanelSlot.heightIn`. Undefined =
   * that window hasn't been customized (falls back to the project
   * default, same as the source slot's own field). */
  windowHeightIn?: number;
  /** Only set for "header"/"sill" instances derived from a "window" slot —
   * that window's own sill height (Tommy: "manipulate sill and header
   * height with the drag tool"), carried through from
   * `PanelSlot.sillHeightIn`. Undefined = that window hasn't been
   * customized (falls back to the project default, same as the source
   * slot's own field). */
  sillHeightIn?: number;
  /** Only set for "braced" instances — carried through from
   * `PanelSlot.bracedPattern`/`bracedMirrored` (see that field's own doc
   * comment) so per-instance consumers (Shop Drawing grouping/naming) can
   * tell 2 same-width braced panels of different styles apart without
   * re-reading the source slot. Undefined = not yet decided, resolves to
   * the project default (see `resolveBracedStyle` in bracedStyle.ts). */
  bracedPattern?: BracePattern;
  bracedMirrored?: boolean;
  /** Only set for "gable" instances — this tile's own REAL edge heights at
   * its own local x=0 (left) and x=widthIn (right), carried through
   * directly from computeGableTiledRow's own leftHeightIn/rightHeightIn —
   * NOT min/max'd. Either can be the taller one (a tile to one side of a
   * peak rises left-to-right; a tile on the other side falls) — a
   * consumer building real geometry (buildGablePanelMembers) must pass
   * these straight through in this same left/right order, or the built
   * panel ends up mirrored once placed at its own real world position.
   * Undefined for every other panel type. */
  leftEdgeHeightIn?: number;
  rightEdgeHeightIn?: number;
  /** Only set for "gable" instances that ARE the tiled row's own dedicated
   * horizontal safety-gap tile (see GABLE_SAFETY_GAP_WIDTH_IN) — never a
   * real, fabricated Gable End Panel, just a 3/4in plywood filler at this
   * tile's own local height. Carried through from computeGableTiledRow's
   * own `isSafetyGap`. */
  isSafetyGap?: boolean;
  /** Only set (true) for a second-story instance whose own slot falls
   * inside its wall's Box Beam coverage range (see
   * `isSlotBoxBeamCovered`/`computeRoofBearingSegments` in the geometry
   * package) — this instance's own real built height is shorter than the
   * story's flat nominal height by `computeBoxBeamHeightDeltaIn(sizeId)`,
   * so it still reaches the same roofline as an uncovered instance under a
   * Truss Plate. A pure structural fact, not a baked-in height — the
   * consumer (which already has the nominal height + selected box-beam
   * size in scope) computes the real number. Undefined for every ground-
   * floor instance and every 2nd-story instance not covered. */
  isBoxBeamCovered?: boolean;
  /** Only set for "gable" instances whose real roofline rise exceeds the
   * project's own maxGablePanelHeightIn fabrication ceiling — the real
   * remainder above this (now always flat) tile's own top, per edge
   * independently (either can be 0 — see capGableTileHeights in
   * gableProfilePoints.ts), filled by a dedicated sloped vertical
   * safety-gap filler piece instead of clamped. */
  gableVerticalGapIn?: { leftIn: number; rightIn: number };
  /** This instance's own real fabricated height, when it differs from the
   * flat per-story `wallHeightFt*12` every consumer otherwise assumes —
   * set only when this instance came from a wall split by a Mid-Wall Bond
   * Beam (see `midWallBeamBandsByWallId` below). Undefined = use the flat
   * nominal height, exactly today's behavior. */
  heightOverrideIn?: number;
  /** Only set alongside heightOverrideIn — which of the wall's own bands
   * (0 = lowest, increasing upward) this instance belongs to. Needed
   * because N+1 instances (one per band) can now share the same
   * wallId+slotIndexInWall, the same way a window's header and sill
   * already do — this disambiguates them for any consumer keyed by that
   * pair. A numeric index, not a "below-beam"/"above-beam" label, since a
   * slot covered by multiple Mid-Wall Bond Beams can split into more than
   * 2 bands. */
  midWallBandIndex?: number;
}

const SIMPLE_NAMED_TYPES = new Set<PanelSlot["type"]>([
  "corner",
  "safety-oct-corner",
  "standard",
  "braced",
  "safety-gap",
  "column",
]);

/**
 * Every individual panel instance across the whole footprint, named and
 * counted together in one pass (per compass direction, across every wall
 * facing that direction) — always computed for every nameable type at
 * once, never a caller-supplied subset, so a name always reflects a
 * panel's true position in the full sequence regardless of which types a
 * caller later filters down to (e.g. a Shop Drawing page showing only
 * "header" instances still sees the same numbers as the 2D canvas, which
 * shows every type together).
 *
 * A window/door slot's own widthIn represents the WHOLE assembly's
 * footprint (Tommy: "make sure... the window slot... represents the
 * entire primary space which the headers, RO, and sills are") — the
 * header instance uses that full width directly (it spans corner-to-
 * corner over both jack studs), but a window's sill is narrower (the
 * actual clear Rough Opening, inside the jack studs — see
 * `computeRoughOpeningWidthIn`) and, per Tommy: "sills are short standard
 * panels... if the window spacing or header length exceeds the standard
 * panel width, then create another sill to share the run", may split into
 * several evenly-sized sill instances (see `computeSillRunWidths`) rather
 * than always exactly 1. A door has no sill (floor-level).
 */
export function allPanelInstances(
  footprint: Footprint,
  wallSlots: Record<string, PanelSlot[]>,
  standardWidthIn: number,
  jackStudConfig: JackStudConfig = "plywood",
  /** Real gable-end tiles for whichever walls have "Add Gable End" enabled
   * (Tommy: fix "gable end always spawns to the top" by making each tile a
   * real instance, not one hardcoded full-ridge-height preview) — computed
   * by the caller (page.tsx) via computeGableTiledRow, since that needs
   * roof/peak state this function has no business knowing about. Absent
   * (or a wall with no entry) = no gable instances for that wall, exactly
   * today's behavior — every existing caller omitting this arg is
   * completely unaffected. */
  gableTilesByWallId?: Record<
    string,
    {
      widthIn: number;
      leftEdgeHeightIn: number;
      rightEdgeHeightIn: number;
      isSafetyGap?: boolean;
      verticalGapIn?: { leftIn: number; rightIn: number };
    }[]
  >,
  /** Which slots of which walls have a Box Beam rather than a Truss Plate
   * (page.tsx's `boxBeamCoverageByWallId`) — only meaningful for a
   * SECOND-STORY call (a caller building ground-floor instances should
   * omit this entirely, same "absent = unaffected" contract
   * `gableTilesByWallId` already has). Drives each real instance's own
   * `isBoxBeamCovered` flag; never applies to "gable" instances (the roof
   * cap sits above this concern entirely). */
  boxBeamCoverageByWallId?: Record<string, BoxBeamCoverage>,
  /** This story's own flat nominal height — only meaningful together with
   * `midWallBeamsByWallId` below; both omitted (or either alone) = every
   * slot renders as one unbanded instance, exactly today's behavior. */
  storyHeightIn?: number,
  /** Which walls (of THIS story) have one or more Mid-Wall Bond Beams,
   * each with its own real height AND its own horizontal coverage range
   * (page.tsx's own midWallBeamsByStoryAndWallId, resolved to geometry via
   * midWallBeamsToGeometry) — a wall with no entry produces exactly
   * today's single instance per slot, completely unaffected. Since each
   * beam has its own horizontal range, different slots of the SAME wall
   * can see different band counts — recomputed per slot (not hoisted per
   * wall) via computeWallVerticalBandsForSlotWithMaxHeight. A slot with N
   * real bands re-runs (header/sill/simple type alike) once per band, each
   * pass's instances getting heightOverrideIn/midWallBandIndex set to that
   * band's own real height/identity, AND its own independent
   * PanelSlotZone (see maxPanelHeightIn below) — a window/door zone is
   * therefore NOT specially excluded or shared across bands; it appears
   * once per band that's actually zoned "window"/"door", each sized
   * against that band's own local height. */
  midWallBeamsByWallId?: Record<string, MidWallBeamGeometry[]>,
  /** A wall column taller than this auto-splits into stacked, independently-
   * typed zones (page.tsx's own `maxPanelHeightIn`) — combines with
   * `midWallBeamsByWallId` above (Stride 2: both go through the same
   * zone-aware banding now — a beam-affected slot's bands are each their
   * own real PanelSlotZone, not a shared copy of the slot's own type).
   * Omitted = beam bands (if any) still compute, just never further
   * subdivided by height — exactly every pre-Stride-2 caller's behavior.
   * Requires `storyHeightIn` to do anything, same as `midWallBeamsByWallId`
   * above. */
  maxPanelHeightIn?: number,
): PanelInstance[] {
  const instances: PanelInstance[] = [];
  const counters: Partial<Record<CompassDirection, number>> = {};

  const pushInstance = (
    direction: CompassDirection,
    wallId: string,
    panelType: NamedPanelType,
    widthIn: number,
    slotIndexInWall: number,
    sourceSlotType?: PanelSlot["type"],
    windowHeightIn?: number,
    sillHeightIn?: number,
    bracedPattern?: BracePattern,
    bracedMirrored?: boolean,
    leftEdgeHeightIn?: number,
    rightEdgeHeightIn?: number,
    isSafetyGap?: boolean,
    gableVerticalGapIn?: { leftIn: number; rightIn: number },
    isBoxBeamCovered?: boolean,
    heightOverrideIn?: number,
    midWallBandIndex?: number,
  ) => {
    counters[direction] = (counters[direction] ?? 0) + 1;
    instances.push({
      name: `${direction}-${counters[direction]}`,
      wallId,
      panelType,
      widthIn,
      slotIndexInWall,
      ...(sourceSlotType && { sourceSlotType }),
      ...(windowHeightIn !== undefined && { windowHeightIn }),
      ...(sillHeightIn !== undefined && { sillHeightIn }),
      ...(bracedPattern !== undefined && { bracedPattern }),
      ...(bracedMirrored !== undefined && { bracedMirrored }),
      ...(leftEdgeHeightIn !== undefined && { leftEdgeHeightIn }),
      ...(rightEdgeHeightIn !== undefined && { rightEdgeHeightIn }),
      ...(isSafetyGap !== undefined && { isSafetyGap }),
      ...(gableVerticalGapIn !== undefined && { gableVerticalGapIn }),
      ...(isBoxBeamCovered !== undefined && { isBoxBeamCovered }),
      ...(heightOverrideIn !== undefined && { heightOverrideIn }),
      ...(midWallBandIndex !== undefined && { midWallBandIndex }),
    });
  };

  for (const wall of footprint.walls) {
    const slots = wallSlots[wall.id] ?? [];
    const direction = wallCompassDirection(wall, footprint);
    const boxBeamCoverage = boxBeamCoverageByWallId?.[wall.id];
    const midWallBeams = midWallBeamsByWallId?.[wall.id];
    for (let slotIndexInWall = 0; slotIndexInWall < slots.length; slotIndexInWall++) {
      const slot = slots[slotIndexInWall]!;
      const isBoxBeamCovered = isSlotBoxBeamCovered(slotIndexInWall, boxBeamCoverage) || undefined;
      // Different slots of the SAME wall can see different band counts
      // (each Mid-Wall Bond Beam has its own horizontal range, and a
      // beam-free slot can independently auto-split by maxPanelHeightIn) —
      // recomputed per slot, not hoisted above this loop. A slot affected
      // by neither (no covering beam, tall enough to fit under
      // maxPanelHeightIn as-is) runs exactly one pass, today's unmodified
      // behavior.
      //
      // Stride 2: beam-affected and beam-free slots now go through the
      // SAME zone-aware path — each band gets its own real PanelSlotZone
      // (falling back to "standard" via effectiveZonesForSlot until
      // something reconciles real data into slot.zones), instead of a
      // beam-affected slot sharing one type across every band (the "panel
      // above/below a beam changes together" bug this whole feature
      // exists to fix). maxPanelHeightIn omitted = Infinity, i.e. real
      // beam bands are still computed but never further subdivided —
      // matches every pre-Stride-2 caller that never passed it.
      let bandZonePairs: { band: { bandIndex: number; bottomIn: number; topIn: number } | undefined; zone: PanelSlotZone }[];
      const bands =
        storyHeightIn !== undefined
          ? computeWallVerticalBandsForSlotWithMaxHeight(
              slotIndexInWall,
              storyHeightIn,
              midWallBeams ?? [],
              maxPanelHeightIn ?? Infinity,
              panelHeightInRange.minIn,
            )
          : undefined;
      const isGenuinelyUnaffected =
        bands === undefined || (bands.length === 1 && bands[0]!.bottomIn === 0 && bands[0]!.topIn === storyHeightIn);
      if (isGenuinelyUnaffected) {
        // No covering beam AND short enough to fit under maxPanelHeightIn
        // as-is (or storyHeightIn wasn't given at all) — stays byte-
        // identical to a plain, never-split slot: no heightOverrideIn/
        // midWallBandIndex, straight off the slot's own top-level fields.
        // Keeps a wall's UNAFFECTED slots completely unchanged even once
        // ANOTHER slot on the same wall is split.
        bandZonePairs = [{ band: undefined, zone: zoneFromSlot(slot) }];
      } else if (bands!.length === 0) {
        // A beam consumes this slot's ENTIRE story height — zero real
        // panels here, not a phantom full-height one.
        bandZonePairs = [];
      } else {
        // 1 partial band (a beam ate part of the height but left a real
        // remainder) or 2+ real bands — either way every band gets its own
        // real PanelSlotZone (Stride 2: beam-driven and height-driven
        // splits share this same zone-aware path, instead of a beam-
        // affected slot sharing one type across every band).
        const zones = effectiveZonesForSlot(slot, bands!.length);
        bandZonePairs = bands!.map((band, i) => ({ band, zone: zones[i]! }));
      }
      for (const pair of bandZonePairs) {
        const band = pair.band;
        const zone = pair.zone;
        const heightOverrideIn = band ? band.topIn - band.bottomIn : undefined;
        const midWallBandIndex = band?.bandIndex;
        if (zone.type === "window" || zone.type === "door") {
          pushInstance(
            direction,
            wall.id,
            "header",
            slot.widthIn,
            slotIndexInWall,
            zone.type,
            zone.type === "window" ? zone.heightIn : undefined,
            zone.type === "window" ? zone.sillHeightIn : undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            isBoxBeamCovered,
            heightOverrideIn,
            midWallBandIndex,
          );
          if (zone.type === "window") {
            const roWidthIn = computeRoughOpeningWidthIn(slot.widthIn, jackStudConfig);
            for (const sillWidthIn of computeSillRunWidths(roWidthIn, standardWidthIn)) {
              pushInstance(
                direction,
                wall.id,
                "sill",
                sillWidthIn,
                slotIndexInWall,
                zone.type,
                undefined,
                zone.sillHeightIn,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                isBoxBeamCovered,
                heightOverrideIn,
                midWallBandIndex,
              );
            }
          }
        } else if (SIMPLE_NAMED_TYPES.has(zone.type)) {
          // A Braced Panel's diagonal braces need a real middle girt row to
          // anchor to (computeBracedGirtRowCount floors at 3 rows for
          // exactly this reason, never scaling down for a short panel the
          // way computeStandardGirtRowCount does) — fine for a normal,
          // still-tall band next to a Mid-Wall Bond Beam, but not for a
          // sliver band too short to even warrant a Standard Panel's own
          // girt (Tommy: "a sliver too short to properly anchor a brace
          // shouldn't fake one"). Only a band this short degrades to a
          // plain "standard" instance instead (no bracing, no girt) — its
          // own shear contribution drops from the project totals, matching
          // Tommy's reasoning that the wall's real shear capacity already
          // comes from its other, still-braced bands/runs.
          const bracedDegradesToStandard =
            zone.type === "braced" && heightOverrideIn !== undefined && computeStandardGirtRowCount(heightOverrideIn) === 0;
          pushInstance(
            direction,
            wall.id,
            bracedDegradesToStandard ? "standard" : (zone.type as NamedPanelType),
            slot.widthIn,
            slotIndexInWall,
            undefined,
            undefined,
            undefined,
            zone.type === "braced" && !bracedDegradesToStandard ? zone.bracedPattern : undefined,
            zone.type === "braced" && !bracedDegradesToStandard ? zone.bracedMirrored : undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            isBoxBeamCovered,
            heightOverrideIn,
            midWallBandIndex,
          );
        }
      }
    }

    // Gable tiles aren't members of this wall's own `slots` array at all
    // (no PanelSlotType exists for them) — appended after the normal loop,
    // continuing this same wall's own direction counter so names interleave
    // correctly (e.g. "N-8", "N-9", ...) with no collisions. `slotIndexInWall`
    // is negative here — real slot indices are always >= 0, so a negative
    // one can never collide with a per-slot instance-grouping lookup keyed
    // by `${wallId}-${slotIndex}` elsewhere (e.g. Building3DView's
    // groupInstancesBySlot) the way a real 0-based index would risk.
    const gableTiles = gableTilesByWallId?.[wall.id];
    if (gableTiles) {
      gableTiles.forEach((tile, tileIndex) => {
        pushInstance(
          direction,
          wall.id,
          "gable",
          tile.widthIn,
          -(tileIndex + 1),
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          tile.leftEdgeHeightIn,
          tile.rightEdgeHeightIn,
          tile.isSafetyGap,
          tile.verticalGapIn,
        );
      });
    }
  }

  return instances;
}

/** Combines the instances that share a single rendered slot (a window slot
 * has 1 header + however many sills share its run) into one label for
 * that slot's single on-canvas rectangle — e.g. ["N-3", "N-4", "N-5"] ->
 * "N-3+4+5". */
export function combinedPanelLabel(instances: PanelInstance[]): string {
  if (instances.length === 0) return "";
  if (instances.length === 1) return instances[0]!.name;
  const [prefix] = instances[0]!.name.split("-");
  const numbers = instances.map((inst) => inst.name.split("-")[1]);
  return `${prefix}-${numbers.join("+")}`;
}
