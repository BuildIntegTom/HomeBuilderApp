import { describe, expect, it } from "vitest";
import { buildSillPanelMembers, buildSillPanelSchema } from "./sillPanelMembers";
import { buildStandardPanelMembers } from "./standardPanelMembers";

const WIDTH_IN = 36;
const DEPTH_IN = 15.5;
const HEIGHT_IN = 32;

describe("buildSillPanelMembers", () => {
  it("is identical construction to a Standard Panel at the same dimensions", () => {
    const sill = buildSillPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const standard = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(sill).toEqual(standard);
  });

  it("includes the nailer when requested, same as the standard panel", () => {
    const withNailer = buildSillPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true);
    expect(withNailer.find((m) => m.role === "nailer")).toBeDefined();
  });
});

describe("buildSillPanelSchema", () => {
  it("wraps the members with a distinct sill_panel id/displayName", () => {
    const schema = buildSillPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(schema.id).toBe("sill_panel");
    expect(schema.displayName).toBe("Sill Panel");
    expect(schema.overallDimensions).toEqual({ heightIn: HEIGHT_IN, widthIn: WIDTH_IN, depthIn: DEPTH_IN });
    expect(schema.members.length).toBeGreaterThan(0);
  });
});
