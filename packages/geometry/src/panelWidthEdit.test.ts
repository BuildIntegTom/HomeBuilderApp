import { describe, expect, it } from "vitest";
import { findSubMinimumPanelWidths, resolvePanelBoundaryDrag, resolvePanelWidthEdit } from "./panelWidthEdit";
import type { PanelSlot } from "./types";

/** The real catalog numbers, restated here because packages/geometry has no
 * dependency on packages/panel-catalog (see panelWidthEdit.ts's own note).
 * `fabricationMinPanelWidthIn` = 24 (confirmed, Tommy);
 * `panelWidthInRange.maxIn` = 48 (confirmed). */
const LIMITS = { minIn: 24, maxIn: 48 };
/** Tommy's ±2in snap window around the floor — ergonomics, unchanged. */
const SNAP_TOLERANCE_IN = 2;

const panel = (widthIn: number, lockedWidthIn?: number): PanelSlot =>
  lockedWidthIn === undefined ? { type: "standard", widthIn } : { type: "standard", widthIn, lockedWidthIn };

describe("resolvePanelWidthEdit — typed panel widths", () => {
  it("accepts a typed width and stores it on the 1/8in grid", () => {
    const slots = [panel(40), panel(40), panel(40)];
    const result = resolvePanelWidthEdit(slots, 0, 41.5, LIMITS);
    expect(result).toMatchObject({ outcome: "commit", widthIn: 41.5, clampedFromIn: null });
  });

  it("quantizes a width that arrives off the grid, rather than storing it as typed", () => {
    const slots = [panel(40), panel(40)];
    const result = resolvePanelWidthEdit(slots, 0, 41.53, LIMITS);
    expect(result.outcome).toBe("commit");
    if (result.outcome !== "commit") return;
    expect(result.widthIn).toBe(41.5);
    expect(Math.abs(result.widthIn * 8 - Math.round(result.widthIn * 8))).toBeLessThan(1e-9);
  });

  it("REFUSES below the 24in fabrication minimum — not a warning, not a clamp", () => {
    const slots = [panel(40), panel(40)];
    const result = resolvePanelWidthEdit(slots, 0, 20, LIMITS);
    expect(result).toEqual({ outcome: "refuse-below-minimum", requestedIn: 20, minIn: 24 });
  });

  it("refuses 23 7/8in — one eighth under is still a panel the shop cannot build", () => {
    const slots = [panel(40), panel(40)];
    expect(resolvePanelWidthEdit(slots, 0, 23.875, LIMITS).outcome).toBe("refuse-below-minimum");
  });

  it("accepts exactly 24in — the limit is a floor, not an exclusive bound", () => {
    const slots = [panel(40), panel(40)];
    expect(resolvePanelWidthEdit(slots, 0, 24, LIMITS)).toMatchObject({ outcome: "commit", widthIn: 24 });
  });

  it("clamps above the 48in maximum and reports what was typed, rather than refusing", () => {
    const slots = [panel(40), panel(40), panel(40)];
    const result = resolvePanelWidthEdit(slots, 0, 60, LIMITS);
    expect(result).toMatchObject({ outcome: "commit", widthIn: 48, clampedFromIn: 60 });
  });

  it("refuses when the free run cannot give up the width, and says how wide it could go", () => {
    // 40in panel, one free 30in neighbour: 70in is the most this panel can be,
    // and 48in is the ceiling, so the answer is 48 — but 44 is asked for and
    // only 2in is free, so it refuses.
    const slots = [panel(40), panel(2), { type: "window", widthIn: 36 } as PanelSlot];
    const result = resolvePanelWidthEdit(slots, 0, 44, LIMITS);
    expect(result).toEqual({ outcome: "refuse-no-room", requestedIn: 44, maxAvailableIn: 42, freeWidthIn: 2 });
  });

  it("refuses when every other slot on the wall is pinned, an opening or a corner", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      panel(40),
      panel(40, 40),
      { type: "door", widthIn: 36 },
    ];
    const result = resolvePanelWidthEdit(slots, 1, 43, LIMITS);
    expect(result).toMatchObject({ outcome: "refuse-no-room", maxAvailableIn: 40, freeWidthIn: 0 });
  });

  it("will not take width from a neighbour that is itself hand-set", () => {
    const slots = [panel(40), panel(40, 40), panel(30)];
    // 30in is free; 40 -> 70 would need 30, which is exactly what is there.
    expect(resolvePanelWidthEdit(slots, 0, 48, LIMITS)).toMatchObject({ outcome: "commit", widthIn: 48 });
    // But with the free slot pinned too, there is nothing to take.
    const allPinned = [panel(40), panel(40, 40), panel(30, 30)];
    expect(resolvePanelWidthEdit(allPinned, 0, 48, LIMITS)).toMatchObject({ outcome: "refuse-no-room", freeWidthIn: 0 });
  });

  it("allows a SHRINK only while some free panel can absorb the width given up", () => {
    const shrinkable = [panel(40), panel(30)];
    expect(resolvePanelWidthEdit(shrinkable, 0, 24, LIMITS)).toMatchObject({ outcome: "commit", widthIn: 24 });
    // Nowhere for the 16in to go: the wall's own total would have to move.
    const nowhere: PanelSlot[] = [panel(40), { type: "window", widthIn: 36 }];
    expect(resolvePanelWidthEdit(nowhere, 0, 24, LIMITS).outcome).toBe("refuse-no-room");
  });

  it("refuses to edit anything that is not a standard or braced panel", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      { type: "safety-gap", widthIn: 0.75 },
      { type: "window", widthIn: 36 },
      { type: "column", widthIn: 25.5 },
    ];
    for (let i = 0; i < slots.length; i++) {
      expect(resolvePanelWidthEdit(slots, i, 40, LIMITS)).toEqual({ outcome: "refuse-not-a-panel" });
    }
    expect(resolvePanelWidthEdit(slots, 9, 40, LIMITS)).toEqual({ outcome: "refuse-not-a-panel" });
  });

  it("edits a braced panel exactly as it edits a standard one", () => {
    const slots: PanelSlot[] = [{ type: "braced", widthIn: 40, bracedPattern: "chevron" }, panel(40)];
    expect(resolvePanelWidthEdit(slots, 0, 43, LIMITS)).toMatchObject({ outcome: "commit", widthIn: 43 });
  });

  it("accepts a pin WIDER than the 40in standard width — a pinned slot is bounded by the catalog range, not by the tiler", () => {
    const slots = [panel(40), panel(40), panel(40)];
    expect(resolvePanelWidthEdit(slots, 0, 48, LIMITS)).toMatchObject({ outcome: "commit", widthIn: 48 });
  });

  // The acceptance test for Smearforn: Tommy's real job.
  describe("the Rogers-Sehorn ADU's own widths", () => {
    const ADU_WIDTHS_IN = [43, 41.5, 37.5, 35, 31.5, 30, 29.5, 28.5, 25.5, 24, 48];

    it.each(ADU_WIDTHS_IN)("%sin is typeable and commits at exactly that width", (widthIn) => {
      // A long wall with plenty of free run, so the only thing under test is
      // the limit logic rather than the wall's budget.
      const slots = [panel(40), panel(40), panel(40), panel(40)];
      const result = resolvePanelWidthEdit(slots, 0, widthIn, LIMITS);
      expect(result).toMatchObject({ outcome: "commit", widthIn, clampedFromIn: null });
    });

    it("not one of them trips the 24in refusal", () => {
      const slots = [panel(40), panel(40), panel(40), panel(40)];
      for (const widthIn of ADU_WIDTHS_IN) {
        expect(resolvePanelWidthEdit(slots, 0, widthIn, LIMITS).outcome).not.toBe("refuse-below-minimum");
      }
    });
  });
});

describe("resolvePanelBoundaryDrag — the drag lands on eighths", () => {
  const pair = { pairStartIn: 0, pairEndIn: 80, floorIn: LIMITS.minIn, snapToleranceIn: SNAP_TOLERANCE_IN };

  it("snaps the boundary to the nearest eighth", () => {
    const result = resolvePanelBoundaryDrag({ ...pair, cursorIn: 41.53 });
    expect(result.boundaryIn).toBe(41.5);
    expect(result.leftWidthIn).toBe(41.5);
    expect(result.rightWidthIn).toBe(38.5);
  });

  it("conserves the pair total exactly, at every cursor position", () => {
    for (let cursorIn = 0; cursorIn <= 80; cursorIn += 0.03) {
      const { leftWidthIn, rightWidthIn } = resolvePanelBoundaryDrag({ ...pair, cursorIn });
      expect(leftWidthIn + rightWidthIn).toBe(80);
    }
  });

  it("leaves both widths on the grid, at every cursor position", () => {
    const isWholeEighth = (v: number) => Math.abs(v * 8 - Math.round(v * 8)) < 1e-9;
    for (let cursorIn = 0; cursorIn <= 80; cursorIn += 0.017) {
      const { leftWidthIn, rightWidthIn } = resolvePanelBoundaryDrag({ ...pair, cursorIn });
      expect(isWholeEighth(leftWidthIn)).toBe(true);
      expect(isWholeEighth(rightWidthIn)).toBe(true);
    }
  });

  it("floors the shrinking panel at the catalog minimum, and hands the rest to the other side", () => {
    const result = resolvePanelBoundaryDrag({ ...pair, cursorIn: 12 });
    expect(result).toMatchObject({ leftWidthIn: 24, rightWidthIn: 56, atFloor: true });
  });

  it("keeps the ±2in snap window: within 2in of the floor it snaps exactly to it", () => {
    expect(resolvePanelBoundaryDrag({ ...pair, cursorIn: 25.75 }).leftWidthIn).toBe(24);
    expect(resolvePanelBoundaryDrag({ ...pair, cursorIn: 26.5 }).leftWidthIn).toBe(26.5);
    expect(resolvePanelBoundaryDrag({ ...pair, cursorIn: 54.5 }).rightWidthIn).toBe(24);
  });

  it("never emits a negative width on a pair too short to floor both sides", () => {
    const shortPair = { pairStartIn: 0, pairEndIn: 40, floorIn: 24, snapToleranceIn: SNAP_TOLERANCE_IN };
    const result = resolvePanelBoundaryDrag({ ...shortPair, cursorIn: 38 });
    expect(result.leftWidthIn).toBeGreaterThanOrEqual(0);
    expect(result.rightWidthIn).toBeGreaterThanOrEqual(0);
    expect(result.leftWidthIn + result.rightWidthIn).toBe(40);
  });

  it("works from a pair that does not start at zero (a wall with a corner panel first)", () => {
    const offsetPair = { pairStartIn: 25.5, pairEndIn: 105.5, floorIn: 24, snapToleranceIn: SNAP_TOLERANCE_IN };
    const result = resolvePanelBoundaryDrag({ ...offsetPair, cursorIn: 66.55 });
    expect(result.boundaryIn).toBe(66.5);
    expect(result.leftWidthIn).toBe(41);
    expect(result.rightWidthIn).toBe(39);
  });
});

describe("findSubMinimumPanelWidths — reported, never refused", () => {
  it("finds a tiler-generated panel under the minimum", () => {
    const found = findSubMinimumPanelWidths({ AB: [panel(40), panel(20.5), panel(20.5)] }, 24);
    // Both halves of computePlainSizing's two-way split, each reported on its own.
    expect(found).toEqual([
      { wallId: "AB", slotIndex: 1, type: "standard", widthIn: 20.5 },
      { wallId: "AB", slotIndex: 2, type: "standard", widthIn: 20.5 },
    ]);
  });

  it("does NOT report the safety-gap board — a 3/4in plywood spacer is not a panel", () => {
    const found = findSubMinimumPanelWidths({ AB: [panel(40), { type: "safety-gap", widthIn: 0.75 }, panel(40)] }, 24);
    expect(found).toEqual([]);
  });

  it("does not report an opening's rough-opening width", () => {
    const slots: PanelSlot[] = [
      { type: "window", widthIn: 18 },
      { type: "door", widthIn: 20 },
      { type: "big-header", widthIn: 12 },
    ];
    expect(findSubMinimumPanelWidths({ AB: slots }, 24)).toEqual([]);
  });

  it("reports a corner or column panel clamped below the minimum — those are fabricated panels too", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 18 },
      { type: "column", widthIn: 20 },
    ];
    expect(findSubMinimumPanelWidths({ AB: slots }, 24).map((f) => f.type)).toEqual(["corner", "column"]);
  });

  it("reports across every wall, keeping each panel's own wall and index", () => {
    const found = findSubMinimumPanelWidths({ AB: [panel(20)], CD: [panel(40), panel(23.875)] }, 24);
    expect(found).toEqual([
      { wallId: "AB", slotIndex: 0, type: "standard", widthIn: 20 },
      { wallId: "CD", slotIndex: 1, type: "standard", widthIn: 23.875 },
    ]);
  });

  it("says nothing about a wall whose panels all clear the minimum, including one exactly on it", () => {
    expect(findSubMinimumPanelWidths({ AB: [panel(24), panel(40)] }, 24)).toEqual([]);
  });

  it("survives an empty or missing wall entry", () => {
    expect(findSubMinimumPanelWidths({}, 24)).toEqual([]);
    expect(findSubMinimumPanelWidths({ AB: [] }, 24)).toEqual([]);
  });

  it("is the whole of the enforcement at load: it reports, it does not rewrite", () => {
    // The stored design is handed back untouched — the caller gets a list to
    // print, not a corrected wall.
    const stored = { AB: [panel(20), panel(40)] };
    const before = JSON.stringify(stored);
    findSubMinimumPanelWidths(stored, 24);
    expect(JSON.stringify(stored)).toBe(before);
  });
});
