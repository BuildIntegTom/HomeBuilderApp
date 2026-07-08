import { describe, expect, it } from "vitest";
import { panelInstancesOfTypes } from "./panelInstances";

describe("panelInstancesOfTypes", () => {
  const wallSlots = {
    AB: [
      { type: "corner" as const, widthIn: 24 },
      { type: "standard" as const, widthIn: 40 },
      { type: "standard" as const, widthIn: 40 },
      { type: "corner" as const, widthIn: 24 },
    ],
    BC: [
      { type: "safety-oct-corner" as const, widthIn: 24 },
      { type: "braced" as const, widthIn: 40 },
      { type: "window" as const, widthIn: 36 },
      { type: "corner" as const, widthIn: 24 },
    ],
  };

  it("numbers instances sequentially per wall, in slot order", () => {
    const standards = panelInstancesOfTypes(wallSlots, ["standard"]);
    expect(standards.map((p) => p.name)).toEqual(["AB-1", "AB-2"]);
  });

  it("combines multiple slot types (e.g. corner + its safety-oct-corner variant) into one list", () => {
    const corners = panelInstancesOfTypes(wallSlots, ["corner", "safety-oct-corner"]);
    expect(corners.map((p) => ({ name: p.name, slotType: p.slotType }))).toEqual([
      { name: "AB-1", slotType: "corner" },
      { name: "AB-2", slotType: "corner" },
      { name: "BC-1", slotType: "safety-oct-corner" },
      { name: "BC-2", slotType: "corner" },
    ]);
  });

  it("excludes non-matching types entirely (e.g. windows never show up in a straw-panel list)", () => {
    const standards = panelInstancesOfTypes(wallSlots, ["standard"]);
    expect(standards.every((p) => p.slotType === "standard")).toBe(true);
  });

  it("returns an empty list when no wall has a panel of the requested type", () => {
    expect(panelInstancesOfTypes(wallSlots, ["door"])).toEqual([]);
  });
});
