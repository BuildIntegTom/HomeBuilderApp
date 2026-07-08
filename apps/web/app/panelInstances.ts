import type { PanelSlot, Wall } from "@building-integrity/geometry";

export interface PanelInstance {
  /** e.g. "AB-1" — sequential per wall, in wall-slot order (matches how a
   * real shop drawing would number panels along a run). */
  name: string;
  wallId: Wall["id"];
  slotType: PanelSlot["type"];
  widthIn: number;
}

/**
 * Every individual panel instance of the given slot type(s), across every
 * wall in the current footprint — the per-panel list a Shop Drawing page
 * needs (as opposed to just an aggregate count/weight). Accepts multiple
 * slot types so fabrication-ID variants of the same panel (e.g.
 * "safety-oct-corner" alongside "corner") can share one page while still
 * keeping their own slot type visible per instance.
 */
export function panelInstancesOfTypes(
  wallSlots: Record<string, PanelSlot[]>,
  types: PanelSlot["type"][],
): PanelInstance[] {
  const instances: PanelInstance[] = [];
  for (const [wallId, slots] of Object.entries(wallSlots)) {
    let counter = 0;
    for (const slot of slots) {
      if (!types.includes(slot.type)) continue;
      counter += 1;
      instances.push({ name: `${wallId}-${counter}`, wallId, slotType: slot.type, widthIn: slot.widthIn });
    }
  }
  return instances;
}
