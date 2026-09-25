import { describe, expect, it } from "vitest";
import {
  reconcileBracedPlacement,
  redistributeFreeRun,
  resolvePanelInsert,
  retileWithOpenings,
  tileWall,
  toEighths,
  type PanelSlot,
} from "@building-integrity/geometry";
import { fabricationMinPanelWidthIn, panelWidthInRange } from "@building-integrity/panel-catalog";
import { standardFamilyCount, tilerWouldDropPanels } from "./handPlacedWallRetile";

/**
 * The Stage 1 / Stage 2 interaction, driven through the REAL tiler rather
 * than a hand-built fixture — this is the one place in the repo that can
 * put `retileWithOpenings`, `reconcileBracedPlacement` and
 * `redistributeFreeRun` in the same room, which is the same reason
 * `tilerFabricationLimits.test.ts` lives here.
 */

const LIMITS = { minIn: fabricationMinPanelWidthIn.value, maxIn: panelWidthInRange.maxIn };
const STANDARD_WIDTH_IN = 40;
const CORNER_WIDTH_IN = 25.5;
const SPACING_IN = 300;
const WALL_LENGTH_IN = 24 * 12;

function total(slots: PanelSlot[]): number {
  return slots.reduce((sum, s) => sum + toEighths(s.widthIn), 0);
}

function tileFresh(): PanelSlot[] {
  const { slots } = tileWall(WALL_LENGTH_IN, STANDARD_WIDTH_IN, CORNER_WIDTH_IN, "end", true, true);
  return reconcileBracedPlacement(undefined, slots, SPACING_IN, STANDARD_WIDTH_IN, "chevron", false);
}

/** What page.tsx's `retileWallAroundPins` does on its tiler path. */
function tilerPath(currentSlots: PanelSlot[]): PanelSlot[] {
  const tiled = retileWithOpenings(WALL_LENGTH_IN, STANDARD_WIDTH_IN, CORNER_WIDTH_IN, "end", true, true, []).slots;
  return reconcileBracedPlacement(currentSlots, tiled, SPACING_IN, STANDARD_WIDTH_IN, "chevron", false);
}

describe("a hand-placed panel and a later width edit", () => {
  it("is a wall the tiler would answer with fewer panels than it has", () => {
    const wall = tileFresh();
    const inserted = resolvePanelInsert(wall, 3, { type: "standard", widthIn: STANDARD_WIDTH_IN }, LIMITS);
    if (inserted.outcome !== "commit") throw new Error(`insert refused: ${inserted.outcome}`);
    expect(inserted.slots.length).toBe(wall.length + 1);
    expect(total(inserted.slots)).toBe(total(wall));

    // The tiler, asked about the same wall, gives back the count it always
    // gives back — one short. This is the silent revert, caught.
    const tiled = tilerPath(inserted.slots);
    expect(tilerWouldDropPanels(inserted.slots, tiled)).toBe(true);
    expect(standardFamilyCount(tiled)).toBe(standardFamilyCount(inserted.slots) - 1);
    // …and it sums correctly while doing it, which is why neither of
    // `retileWallAroundPins`' own guards would have noticed.
    expect(total(tiled)).toBe(total(inserted.slots));
  });

  it("keeps the hand-placed panel when the width edit takes the count-preserving path", () => {
    const wall = tileFresh();
    const inserted = resolvePanelInsert(wall, 3, { type: "standard", widthIn: STANDARD_WIDTH_IN }, LIMITS);
    if (inserted.outcome !== "commit") throw new Error(`insert refused: ${inserted.outcome}`);
    const withPanel = inserted.slots;

    // Now type a width onto a DIFFERENT panel, the Stage 1 gesture.
    const editIndex = withPanel.findIndex((s, i) => i !== 3 && s.type === "standard" && s.lockedWidthIn === undefined);
    expect(editIndex).toBeGreaterThan(-1);
    const pinnedEdit = withPanel.map((s, i) => (i === editIndex ? { ...s, widthIn: 43, lockedWidthIn: 43 } : s));

    const fallback = redistributeFreeRun(withPanel, pinnedEdit, editIndex, LIMITS);
    if (fallback.outcome !== "commit") throw new Error(`fallback refused: ${fallback.outcome}`);
    expect(fallback.slots.length).toBe(withPanel.length);
    expect(total(fallback.slots)).toBe(total(wall));
    // The hand-placed panel is still there, still pinned, still its width.
    expect(fallback.slots[3]).toMatchObject({ type: "standard", widthIn: STANDARD_WIDTH_IN, lockedWidthIn: STANDARD_WIDTH_IN });
    // The typed width took effect, and every automatic panel is buildable.
    expect(fallback.slots[editIndex]).toMatchObject({ widthIn: 43, lockedWidthIn: 43 });
    for (const slot of fallback.slots) {
      if (slot.type !== "standard" && slot.type !== "braced") continue;
      expect(slot.widthIn).toBeGreaterThanOrEqual(fabricationMinPanelWidthIn.value);
      expect(slot.widthIn).toBeLessThanOrEqual(panelWidthInRange.maxIn);
    }
  });

  it("leaves an ordinary wall on the tiler path — the fallback is not a behaviour change for one", () => {
    const wall = tileFresh();
    const editIndex = wall.findIndex((s) => s.type === "standard" || s.type === "braced");
    const pinnedEdit = wall.map((s, i) => (i === editIndex ? { ...s, widthIn: 43, lockedWidthIn: 43 } : s));
    const tiled = tilerPath(pinnedEdit);
    expect(tilerWouldDropPanels(pinnedEdit, tiled)).toBe(false);
  });

  it("does not fire on a wall whose count the tiler happens to match", () => {
    const wall = tileFresh();
    expect(tilerWouldDropPanels(wall, tilerPath(wall))).toBe(false);
  });
});
