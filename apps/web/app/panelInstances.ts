import { wallCompassDirection, computeSillRunWidths, type CompassDirection, type Footprint, type PanelSlot } from "@building-integrity/geometry";
import { computeRoughOpeningWidthIn, type BracePattern, type JackStudConfig } from "@building-integrity/panel-catalog";

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
    });
  };

  for (const wall of footprint.walls) {
    const slots = wallSlots[wall.id] ?? [];
    const direction = wallCompassDirection(wall, footprint);
    for (let slotIndexInWall = 0; slotIndexInWall < slots.length; slotIndexInWall++) {
      const slot = slots[slotIndexInWall]!;
      if (slot.type === "window" || slot.type === "door") {
        pushInstance(
          direction,
          wall.id,
          "header",
          slot.widthIn,
          slotIndexInWall,
          slot.type,
          slot.type === "window" ? slot.heightIn : undefined,
          slot.type === "window" ? slot.sillHeightIn : undefined,
        );
        if (slot.type === "window") {
          const roWidthIn = computeRoughOpeningWidthIn(slot.widthIn, jackStudConfig);
          for (const sillWidthIn of computeSillRunWidths(roWidthIn, standardWidthIn)) {
            pushInstance(direction, wall.id, "sill", sillWidthIn, slotIndexInWall, slot.type, undefined, slot.sillHeightIn);
          }
        }
      } else if (SIMPLE_NAMED_TYPES.has(slot.type)) {
        pushInstance(
          direction,
          wall.id,
          slot.type as NamedPanelType,
          slot.widthIn,
          slotIndexInWall,
          undefined,
          undefined,
          undefined,
          slot.type === "braced" ? slot.bracedPattern : undefined,
          slot.type === "braced" ? slot.bracedMirrored : undefined,
        );
      }
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
