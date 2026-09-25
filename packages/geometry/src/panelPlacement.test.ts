import { describe, expect, it } from "vitest";
import { toEighths } from "./eighths";
import {
  PLACEABLE_PANEL_TYPES,
  insertableBoundaryRange,
  isPlaceablePanelType,
  redistributeFreeRun,
  resolvePanelDelete,
  resolvePanelInsert,
  resolvePanelReplace,
  shiftSlotCoverage,
  type FreeRunLimitsIn,
  type PanelPlacementResult,
} from "./panelPlacement";
import { nextPanelCycleState } from "./tiling";
import type { PanelSlot } from "./types";

/** The real catalog pair, duplicated the same way `tiling.ts` duplicates
 * them and for the same reason (`packages/geometry` has no dependency on
 * `packages/panel-catalog`) — `apps/web/app/tilerFabricationLimits.test.ts`
 * is the one place that imports both and asserts they still agree. */
const LIMITS: FreeRunLimitsIn = { minIn: 24, maxIn: 48 };
const STANDARD_WIDTH_IN = 40;
const CORNER_WIDTH_IN = 25.5;

const std = (widthIn: number): PanelSlot => ({ type: "standard", widthIn });
const braced = (widthIn: number): PanelSlot => ({ type: "braced", widthIn, bracedPattern: "chevron", bracedMirrored: false });
const pinned = (widthIn: number): PanelSlot => ({ type: "standard", widthIn, lockedWidthIn: widthIn });
const corner = (): PanelSlot => ({ type: "corner", widthIn: CORNER_WIDTH_IN });
const gap = (): PanelSlot => ({ type: "safety-gap", widthIn: 0.75 });
const window40 = (): PanelSlot => ({ type: "window", widthIn: 40, heightIn: 48, sillHeightIn: 32 });

function totalEighths(slots: PanelSlot[]): number {
  return slots.reduce((sum, s) => sum + toEighths(s.widthIn), 0);
}

function commit(result: PanelPlacementResult) {
  if (result.outcome !== "commit") throw new Error(`expected a commit, got ${result.outcome}`);
  return result;
}

/** A plain wall: corner, 6 automatic standards, gap, corner-touching
 * standard, corner — the shape `buildPlainMiddle` produces for a long wall. */
function plainWall(): PanelSlot[] {
  return [corner(), std(40), std(40), std(40), std(40), std(40), std(40), gap(), std(40), corner()];
}

describe("the placeable roster", () => {
  it("is the click-through cycle's own roster exactly — no new types, no missing ones", () => {
    // Walk the cycle from "standard" and collect every type it can reach.
    const seen = new Set<string>();
    let state: { type: string; bracedPattern?: string; bracedMirrored?: boolean } | null = { type: "standard" };
    for (let i = 0; i < 20 && state; i++) {
      seen.add(state.type);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state = nextPanelCycleState(state as any);
      if (state && seen.has(state.type) && state.type === "standard") break;
    }
    expect([...seen].sort()).toEqual([...PLACEABLE_PANEL_TYPES].sort());
  });

  it("refuses corner and safety-gap, which are rule-placed", () => {
    expect(isPlaceablePanelType("corner")).toBe(false);
    expect(isPlaceablePanelType("safety-oct-corner")).toBe(false);
    expect(isPlaceablePanelType("safety-gap")).toBe(false);
    const wall = plainWall();
    expect(resolvePanelReplace(wall, 0, { type: "standard" }, LIMITS)).toEqual({
      outcome: "refuse-not-placeable",
      reason: "rule-placed-slot",
    });
    expect(resolvePanelReplace(wall, 7, { type: "braced" }, LIMITS)).toEqual({
      outcome: "refuse-not-placeable",
      reason: "rule-placed-slot",
    });
    expect(resolvePanelDelete(wall, 0, LIMITS)).toEqual({ outcome: "refuse-not-placeable", reason: "rule-placed-slot" });
    expect(resolvePanelDelete(wall, 7, LIMITS)).toEqual({ outcome: "refuse-not-placeable", reason: "rule-placed-slot" });
  });
});

describe("insertableBoundaryRange", () => {
  it("spans the panel run but never outside a corner", () => {
    expect(insertableBoundaryRange(plainWall())).toEqual({ minIndex: 1, maxIndex: 9 });
  });

  it("includes both ends on a wall that owns neither corner", () => {
    expect(insertableBoundaryRange([std(40), std(40)])).toEqual({ minIndex: 0, maxIndex: 2 });
  });

  it("leaves nowhere legal on a merged-corner wall", () => {
    const { minIndex, maxIndex } = insertableBoundaryRange([corner()]);
    expect(minIndex).toBeGreaterThan(maxIndex);
  });

  it("refuses an insert outside that range", () => {
    const wall = plainWall();
    expect(resolvePanelInsert(wall, 0, { type: "standard", widthIn: 40 }, LIMITS)).toEqual({
      outcome: "refuse-not-placeable",
      reason: "out-of-range",
    });
    expect(resolvePanelInsert(wall, 10, { type: "standard", widthIn: 40 }, LIMITS)).toEqual({
      outcome: "refuse-not-placeable",
      reason: "out-of-range",
    });
  });
});

describe("insert", () => {
  it("adds a slot, pins it at the width it was born with, and takes the width out of the free run only", () => {
    const wall = plainWall();
    const result = commit(resolvePanelInsert(wall, 4, { type: "standard", widthIn: STANDARD_WIDTH_IN }, LIMITS));
    expect(result.slots.length).toBe(wall.length + 1);
    expect(result.slots[4]).toEqual({ type: "standard", widthIn: 40, lockedWidthIn: 40 });
    expect(result.selectedIndex).toBe(4);
    // The wall's own total length never moves.
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
    // 7 automatic panels held 280in; they now hold 240in across the same 7.
    const free = result.slots.filter((s) => s.type === "standard" && s.lockedWidthIn === undefined);
    expect(free.length).toBe(7);
    expect(free.map((s) => s.widthIn)).toEqual([34.375, 34.375, 34.25, 34.25, 34.25, 34.25, 34.25]);
    expect(result.freeCountBefore).toBe(7);
    expect(result.freeCountAfter).toBe(7);
  });

  it("leaves every neighbour's type, style, zones and pin untouched — only unpinned widths move", () => {
    const wall: PanelSlot[] = [
      corner(),
      braced(40),
      { type: "standard", widthIn: 43, lockedWidthIn: 43 },
      { type: "standard", widthIn: 40, zones: [{ type: "standard" }, { type: "braced", bracedPattern: "hatch" }] },
      window40(),
      std(40),
      gap(),
      braced(40),
      corner(),
    ];
    const result = commit(resolvePanelInsert(wall, 5, { type: "standard", widthIn: 24 }, LIMITS));
    const survivors = result.slots.filter((_, i) => i !== 5);
    expect(survivors.length).toBe(wall.length);
    survivors.forEach((slot, i) => {
      const original = wall[i]!;
      expect(slot.type).toBe(original.type);
      expect(slot.bracedPattern).toBe(original.bracedPattern);
      expect(slot.bracedMirrored).toBe(original.bracedMirrored);
      expect(slot.zones).toEqual(original.zones);
      expect(slot.lockedWidthIn).toBe(original.lockedWidthIn);
      // Only the free run may resize; everything else keeps its exact width.
      const isFree = (original.type === "standard" || original.type === "braced") && original.lockedWidthIn === undefined;
      if (!isFree) expect(slot.widthIn).toBe(original.widthIn);
    });
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
  });

  it("refuses when the free run cannot cover the new panel, and says how much room there is", () => {
    const wall = [corner(), std(40), std(40), pinned(43), corner()];
    const result = resolvePanelInsert(wall, 2, { type: "big-header", widthIn: 96 }, LIMITS);
    expect(result).toEqual({ outcome: "refuse-no-room", requestedIn: 96, freeBudgetIn: 80, minIn: 24 });
  });

  it("refuses when what would be left of the free run is too narrow to build", () => {
    // 80in of free run, a 60in insert leaves 20in — under the shop's 24in
    // floor, with nothing to absorb it into. Refused, not rounded away.
    const wall = [corner(), std(40), std(40), corner()];
    const result = resolvePanelInsert(wall, 2, { type: "window", widthIn: 60 }, LIMITS);
    expect(result).toEqual({ outcome: "refuse-no-room", requestedIn: 60, freeBudgetIn: 80, minIn: 24 });
  });

  it("consumes an automatic panel rather than refusing when the run cannot keep them all", () => {
    // 3 automatic panels holding 90in; a 40in insert leaves 50in, which
    // cannot be 3 buildable panels but can be 2.
    const wall = [corner(), std(30), std(30), std(30), corner()];
    const result = commit(resolvePanelInsert(wall, 2, { type: "standard", widthIn: 40 }, LIMITS));
    expect(result.freeCountBefore).toBe(3);
    expect(result.freeCountAfter).toBe(2);
    expect(result.slotCountAfter).toBe(result.slotCountBefore);
    expect(result.slots.map((s) => s.widthIn)).toEqual([25.5, 25, 40, 25, 25.5]);
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
  });

  it("keeps the corner-touching panel when it has to give one up", () => {
    // 4 automatic panels holding 100in; a 40in insert leaves 60in, which is
    // only 2 buildable panels — so two slots go. The ones that go are the
    // ones next to the insertion point, never the corner-touching braces the
    // placement rule depends on.
    const wall = [corner(), braced(25), std(25), std(25), braced(25), corner()];
    const result = commit(resolvePanelInsert(wall, 3, { type: "standard", widthIn: 40 }, LIMITS));
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "braced", "standard", "braced", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([25.5, 30, 40, 30, 25.5]);
    expect(result.freeCountAfter).toBe(2);
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
  });

  it("can place a big header at its own default width when the wall has the room", () => {
    const wall = plainWall();
    const result = commit(
      resolvePanelInsert(wall, 4, { type: "big-header", widthIn: 96, heightIn: 24, includeSillOnBigHeader: false }, LIMITS),
    );
    expect(result.slots[4]).toEqual({ type: "big-header", widthIn: 96, heightIn: 24, includeSillOnBigHeader: false });
    // An opening is a reservation in its own right — never pinned.
    expect(result.slots[4]!.lockedWidthIn).toBeUndefined();
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
  });
});

describe("replace", () => {
  it("swaps a type in place, without touching any width, when the transition changes no width", () => {
    const wall = plainWall();
    const result = commit(resolvePanelReplace(wall, 3, { type: "braced", bracedPattern: "hatch", bracedMirrored: true }, LIMITS));
    expect(result.slots[3]).toEqual({ type: "braced", widthIn: 40, bracedPattern: "hatch", bracedMirrored: true });
    expect(result.slots.map((s) => s.widthIn)).toEqual(wall.map((s) => s.widthIn));
    expect(result.slotCountAfter).toBe(wall.length);
  });

  it("keeps a split column's bottom zone mirrored onto the slot's own fields", () => {
    const wall: PanelSlot[] = [
      corner(),
      { type: "standard", widthIn: 40, zones: [{ type: "standard" }, { type: "window", heightIn: 30 }] },
      std(40),
      corner(),
    ];
    const result = commit(resolvePanelReplace(wall, 1, { type: "braced", bracedPattern: "chevron", bracedMirrored: false }, LIMITS));
    expect(result.slots[1]!.type).toBe("braced");
    expect(result.slots[1]!.zones?.[0]).toEqual({ type: "braced", bracedPattern: "chevron", bracedMirrored: false });
    expect(result.slots[1]!.zones?.[1]).toEqual({ type: "window", heightIn: 30 });
  });

  it("reserves a fixed-width type out of the free run and conserves the wall", () => {
    const wall = plainWall();
    const result = commit(resolvePanelReplace(wall, 3, { type: "column", widthIn: 25.5 }, LIMITS));
    expect(result.slots[3]).toEqual({ type: "column", widthIn: 25.5 });
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
    expect(result.slotCountAfter).toBe(wall.length);
  });

  it("carries the panel's own width when the new type has no width of its own", () => {
    const wall = plainWall();
    const result = commit(resolvePanelReplace(wall, 3, { type: "window" }, LIMITS));
    expect(result.slots[3]).toEqual({ type: "window", widthIn: 40 });
    // Nothing had to move: the reservation is exactly the width it replaced.
    expect(result.slots.map((s) => s.widthIn)).toEqual(wall.map((s) => s.widthIn));
  });

  it("says nothing changed when the click asks for what is already there", () => {
    const wall = plainWall();
    expect(resolvePanelReplace(wall, 3, { type: "standard" }, LIMITS)).toEqual({ outcome: "no-change" });
    const bracedWall = [corner(), braced(40), std(40), corner()];
    expect(resolvePanelReplace(bracedWall, 1, { type: "braced", bracedPattern: "chevron", bracedMirrored: false }, LIMITS)).toEqual({
      outcome: "no-change",
    });
  });

  it("refuses a replacement the free run cannot pay for", () => {
    const wall = [corner(), std(40), std(40), corner()];
    expect(resolvePanelReplace(wall, 1, { type: "big-header", widthIn: 96 }, LIMITS)).toMatchObject({ outcome: "refuse-no-room" });
  });
});

describe("delete", () => {
  it("removes the panel and hands its width back to the free run", () => {
    const wall = plainWall();
    const result = commit(resolvePanelDelete(wall, 3, LIMITS));
    expect(result.slots.length).toBe(wall.length - 1);
    expect(result.selectedIndex).toBe(-1);
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
    const free = result.slots.filter((s) => s.type === "standard");
    expect(free.length).toBe(6);
    // 280in over 6 automatic panels instead of 7 — whole eighths, and the
    // odd eighths go to the lowest indices (`distributeEighths`' own rule).
    expect(free.map((s) => s.widthIn)).toEqual([46.75, 46.75, 46.625, 46.625, 46.625, 46.625]);
  });

  it("brings a wall's panel count down — the capability the click-cycle never had", () => {
    const wall = [corner(), std(30), std(30), std(30), corner()];
    const result = commit(resolvePanelDelete(wall, 2, LIMITS));
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "standard", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([25.5, 45, 45, 25.5]);
  });

  it("deletes a pinned panel and gives its width to the automatic run", () => {
    const wall = [corner(), pinned(43), std(30), std(30), std(30), corner()];
    const result = commit(resolvePanelDelete(wall, 1, LIMITS));
    expect(result.slots.map((s) => s.widthIn)).toEqual([25.5, 44.375, 44.375, 44.25, 25.5]);
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
  });

  it("deletes an opening and gives its width back too", () => {
    const wall = [corner(), std(30), window40(), std(30), std(30), corner()];
    const result = commit(resolvePanelDelete(wall, 2, LIMITS));
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "standard", "standard", "standard", "corner"]);
    expect(result.slots.map((s) => s.widthIn)).toEqual([25.5, 43.375, 43.375, 43.25, 25.5]);
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
  });

  it("refuses when there is no automatic panel left to absorb the width", () => {
    const wall = [corner(), pinned(40), pinned(40), corner()];
    expect(resolvePanelDelete(wall, 1, LIMITS)).toEqual({ outcome: "refuse-no-free-run", freedWidthIn: 40 });
  });

  it("refuses when the panels left behind would be wider than the shop's maximum", () => {
    // 200in over 5 automatic panels. Four of them would be 50in.
    const wall = [corner(), std(40), std(40), std(40), std(40), std(40), corner()];
    expect(resolvePanelDelete(wall, 2, LIMITS)).toEqual({ outcome: "refuse-would-exceed-maximum", wouldBeIn: 50, maxIn: 48 });
  });
});

describe("the [24in, 48in] bound", () => {
  it("holds for every automatic panel an insert or a delete leaves behind, across a sweep", () => {
    for (let freeCount = 1; freeCount <= 6; freeCount++) {
      for (let freeWidthEighths = toEighths(24); freeWidthEighths <= toEighths(48); freeWidthEighths++) {
        const widthIn = freeWidthEighths / 8;
        const wall = [corner(), ...Array.from({ length: freeCount }, () => std(widthIn)), corner()];
        for (const insertWidthIn of [24, 30, 39, 40, 48]) {
          const inserted = resolvePanelInsert(wall, 1 + Math.floor(freeCount / 2), { type: "standard", widthIn: insertWidthIn }, LIMITS);
          if (inserted.outcome === "commit") {
            expect(totalEighths(inserted.slots)).toBe(totalEighths(wall));
            for (const slot of inserted.slots) {
              if (slot.type !== "standard" && slot.type !== "braced") continue;
              expect(slot.widthIn).toBeGreaterThanOrEqual(24);
              expect(slot.widthIn).toBeLessThanOrEqual(48);
            }
          } else {
            expect(["refuse-no-room", "refuse-would-exceed-maximum"]).toContain(inserted.outcome);
          }
        }
        const deleted = resolvePanelDelete(wall, 1, LIMITS);
        if (deleted.outcome === "commit") {
          expect(totalEighths(deleted.slots)).toBe(totalEighths(wall));
          for (const slot of deleted.slots) {
            if (slot.type !== "standard" && slot.type !== "braced") continue;
            expect(slot.widthIn).toBeGreaterThanOrEqual(24);
            expect(slot.widthIn).toBeLessThanOrEqual(48);
          }
        } else {
          expect(["refuse-no-room", "refuse-no-free-run", "refuse-would-exceed-maximum"]).toContain(deleted.outcome);
        }
      }
    }
  });

  it("refuses to place a standard panel the shop could not build", () => {
    const wall = plainWall();
    expect(resolvePanelInsert(wall, 4, { type: "standard", widthIn: 96 }, LIMITS)).toEqual({
      outcome: "refuse-width-out-of-range",
      widthIn: 96,
      minIn: 24,
      maxIn: 48,
    });
    expect(resolvePanelInsert(wall, 4, { type: "braced", widthIn: 20 }, LIMITS)).toEqual({
      outcome: "refuse-width-out-of-range",
      widthIn: 20,
      minIn: 24,
      maxIn: 48,
    });
    // An opening answers to its own catalog range instead — a Big Header's
    // own 96in default is legal and is not a standard panel.
    expect(resolvePanelInsert(wall, 4, { type: "big-header", widthIn: 96 }, LIMITS).outcome).toBe("commit");
  });

  it("never emits a fractional eighth", () => {
    const wall = [corner(), std(40), std(40), std(40), std(40), std(40), corner()];
    const result = commit(resolvePanelInsert(wall, 3, { type: "standard", widthIn: 27.375 }, LIMITS));
    for (const slot of result.slots) {
      expect(slot.widthIn * 8).toBe(Math.round(slot.widthIn * 8));
    }
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
  });
});

describe("shiftSlotCoverage", () => {
  const beam = { id: "b1", startSlotIndex: 2, endSlotIndex: 5 };

  it("keeps a beam over the same panels when one is inserted before it", () => {
    expect(shiftSlotCoverage(beam, 1, 1)).toEqual({ id: "b1", startSlotIndex: 3, endSlotIndex: 6 });
  });

  it("widens it when the panel is inserted inside it", () => {
    expect(shiftSlotCoverage(beam, 3, 1)).toEqual({ id: "b1", startSlotIndex: 2, endSlotIndex: 6 });
  });

  it("leaves it alone when the panel is inserted after it", () => {
    expect(shiftSlotCoverage(beam, 5, 1)).toEqual(beam);
    expect(shiftSlotCoverage(beam, 9, 1)).toEqual(beam);
  });

  it("closes up after a delete before it, and narrows after a delete inside it", () => {
    expect(shiftSlotCoverage(beam, 0, -1)).toEqual({ id: "b1", startSlotIndex: 1, endSlotIndex: 4 });
    expect(shiftSlotCoverage(beam, 3, -1)).toEqual({ id: "b1", startSlotIndex: 2, endSlotIndex: 4 });
    expect(shiftSlotCoverage(beam, 6, -1)).toEqual(beam);
  });

  it("reports a range the delete emptied rather than leaving a zero-width one", () => {
    expect(shiftSlotCoverage({ startSlotIndex: 3, endSlotIndex: 4 }, 3, -1)).toBeNull();
  });
});

describe("redistributeFreeRun", () => {
  it("empties the free run when an insert consumes exactly all of it", () => {
    const wall = [corner(), std(40), corner()];
    const result = commit(resolvePanelInsert(wall, 1, { type: "standard", widthIn: 40 }, LIMITS));
    expect(result.slots.map((s) => s.type)).toEqual(["corner", "standard", "corner"]);
    expect(result.slots[1]!.lockedWidthIn).toBe(40);
    expect(result.freeCountAfter).toBe(0);
  });

  it("is the shared mechanism a hand-set width can fall back on without losing a panel", () => {
    // What page.tsx does when the tiler would answer a width edit by
    // re-deriving the panel count: pin one slot, let the free run absorb it.
    const wall = [corner(), std(40), std(40), std(40), corner()];
    const edited = wall.map((s, i) => (i === 1 ? { ...s, widthIn: 43, lockedWidthIn: 43 } : s));
    const result = commit(redistributeFreeRun(wall, edited, 1, LIMITS));
    expect(result.slots.map((s) => s.widthIn)).toEqual([25.5, 43, 38.5, 38.5, 25.5]);
    expect(totalEighths(result.slots)).toBe(totalEighths(wall));
    expect(result.slotCountAfter).toBe(wall.length);
  });
});
