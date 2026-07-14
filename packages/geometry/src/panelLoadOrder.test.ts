import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { computePanelLoadOrder } from "./panelLoadOrder";
import type { PanelSlot } from "./types";

describe("computePanelLoadOrder", () => {
  const fp = buildRectangleFootprint(30, 20); // walls AB, BC, CD, DA
  const slot = (widthIn: number): PanelSlot => ({ type: "standard", widthIn });
  const wallSlots: Record<string, PanelSlot[]> = {
    AB: [slot(10), slot(11)],
    BC: [slot(20), slot(21)],
    CD: [slot(30), slot(31)],
    DA: [slot(40), slot(41)],
  };

  it("starts at the wall beginning at the least-accessible corner and proceeds around the ring", () => {
    const order = computePanelLoadOrder(fp, wallSlots, "A");
    // A is the start corner of wall AB — the sequence should begin there and
    // continue AB -> BC -> CD -> DA.
    expect(order.map((e) => e.wallId)).toEqual(["AB", "AB", "BC", "BC", "CD", "CD", "DA", "DA"]);
    expect(order[0]!.slot.widthIn).toBe(10); // the PLA corner's own panel is first
  });

  it("rotates to start at whichever corner is passed, not always A", () => {
    const order = computePanelLoadOrder(fp, wallSlots, "C");
    expect(order.map((e) => e.wallId)).toEqual(["CD", "CD", "DA", "DA", "AB", "AB", "BC", "BC"]);
    expect(order[0]!.slot.widthIn).toBe(30);
  });

  it("preserves each wall's own slot order (not reversed)", () => {
    const order = computePanelLoadOrder(fp, wallSlots, "B");
    const bcWidths = order.filter((e) => e.wallId === "BC").map((e) => e.slot.widthIn);
    expect(bcWidths).toEqual([20, 21]);
  });

  it("falls back to the unrotated wall order for a corner that isn't any wall's start", () => {
    const order = computePanelLoadOrder(fp, wallSlots, "not-a-real-corner");
    expect(order.map((e) => e.wallId)).toEqual(["AB", "AB", "BC", "BC", "CD", "CD", "DA", "DA"]);
  });
});
