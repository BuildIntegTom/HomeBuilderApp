import { wallCompassDirection, type CompassDirection, type Footprint, type PanelSlot } from "@building-integrity/geometry";

/** Every real structural panel this app can name/count — header and sill
 * are derived from window/door slots (see derivedPanelTypes), not their
 * own PanelSlot type: a window/door opening isn't a panel itself, but the
 * header above it (and, for a window, the sill below it) are. */
export type NamedPanelType = "standard" | "corner" | "safety-oct-corner" | "braced" | "safety-gap" | "header" | "sill";

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
   * produces 2 instances (header + sill) sharing the same slotIndexInWall,
   * since they're stacked in elevation, not sequential in plan. */
  slotIndexInWall: number;
}

/** A window has both a header (above the glazing) and a sill (below); a
 * door has only a header (it's floor-level, so no sill) — see Tommy's
 * clarification that the "window"/"door" PanelSlot itself isn't a panel,
 * it's an opening the real structural panels are built around. Every
 * other slot type names 1:1 with its own panel type. */
function derivedPanelTypes(slotType: PanelSlot["type"]): NamedPanelType[] {
  switch (slotType) {
    case "window":
      return ["header", "sill"];
    case "door":
      return ["header"];
    case "corner":
    case "safety-oct-corner":
    case "standard":
    case "braced":
    case "safety-gap":
      return [slotType];
    default:
      return [];
  }
}

/**
 * Every individual panel instance across the whole footprint, named and
 * counted together in one pass (per compass direction, across every wall
 * facing that direction) — always computed for every nameable type at
 * once, never a caller-supplied subset, so a name always reflects a
 * panel's true position in the full sequence regardless of which types a
 * caller later filters down to (e.g. a Shop Drawing page showing only
 * "header" instances still sees the same numbers as the 2D canvas, which
 * shows every type together).
 */
export function allPanelInstances(footprint: Footprint, wallSlots: Record<string, PanelSlot[]>): PanelInstance[] {
  const instances: PanelInstance[] = [];
  const counters: Partial<Record<CompassDirection, number>> = {};

  for (const wall of footprint.walls) {
    const slots = wallSlots[wall.id] ?? [];
    const direction = wallCompassDirection(wall, footprint);
    for (let slotIndexInWall = 0; slotIndexInWall < slots.length; slotIndexInWall++) {
      const slot = slots[slotIndexInWall]!;
      for (const panelType of derivedPanelTypes(slot.type)) {
        counters[direction] = (counters[direction] ?? 0) + 1;
        instances.push({
          name: `${direction}-${counters[direction]}`,
          wallId: wall.id,
          panelType,
          widthIn: slot.widthIn,
          slotIndexInWall,
        });
      }
    }
  }

  return instances;
}

/** Combines the 1 or 2 instances that share a single rendered slot (a
 * window slot has 2: header + sill) into one label for that slot's single
 * on-canvas rectangle — e.g. ["N-3", "N-4"] -> "N-3+4". */
export function combinedPanelLabel(instances: PanelInstance[]): string {
  if (instances.length === 0) return "";
  if (instances.length === 1) return instances[0]!.name;
  const [prefix] = instances[0]!.name.split("-");
  const numbers = instances.map((inst) => inst.name.split("-")[1]);
  return `${prefix}-${numbers.join("+")}`;
}
