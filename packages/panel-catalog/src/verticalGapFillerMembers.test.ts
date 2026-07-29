import { describe, expect, it } from "vitest";
import { buildVerticalGapFillerMembers, buildVerticalGapFillerSchema } from "./verticalGapFillerMembers";
import { SKIN_THICKNESS_IN } from "./panelMemberHelpers";

const WIDTH_IN = 48;
const DEPTH_IN = 15.5;
const LEFT_IN = 0;
const RIGHT_IN = 6;

describe("buildVerticalGapFillerMembers", () => {
  it("builds a single sloped plywood sheet, not a flat box, with no framing", () => {
    const members = buildVerticalGapFillerMembers(WIDTH_IN, DEPTH_IN, LEFT_IN, RIGHT_IN);
    expect(members).toHaveLength(1);
    const sheet = members[0]!;
    expect(sheet.material).toBe("plywood");
    expect(sheet.orientation).toBe("diagonal");
  });

  it("sizes the sheet's own cross-section (thickness x width) and rip length off the 2 given edge heights", () => {
    // Endpoints (0, LEFT_IN) -> (WIDTH_IN, RIGHT_IN), each offset inward by
    // half the skin thickness (tiltedMember's own convention, matching the
    // gable panel's own top skin) -> rip length = hypot(width, rise).
    const members = buildVerticalGapFillerMembers(WIDTH_IN, DEPTH_IN, LEFT_IN, RIGHT_IN);
    const sheet = members[0]!;
    expect(sheet.actualDimsIn.thicknessIn).toBe(SKIN_THICKNESS_IN);
    expect(sheet.actualDimsIn.widthIn).toBe(DEPTH_IN);
    expect(sheet.actualDimsIn.lengthIn).toBeCloseTo(Math.hypot(WIDTH_IN, RIGHT_IN - LEFT_IN), 6);
  });

  it("tapers to a knife edge (tiltDeg reflects the true slope) when one edge is exactly 0 — a valid sheet shape, not an error", () => {
    const members = buildVerticalGapFillerMembers(WIDTH_IN, DEPTH_IN, 0, 12);
    expect(members).toHaveLength(1);
    expect(members[0]!.position.tiltDeg).toBeDefined();
    expect(members[0]!.actualDimsIn.lengthIn).toBeCloseTo(Math.hypot(WIDTH_IN, 12), 6);
  });

  it("is perfectly level (tiltDeg 90, tiltedMember's own axis-aligned-horizontal convention) when both edges are equal — the degenerate case of the same sloped-sheet math, no special-casing needed", () => {
    const members = buildVerticalGapFillerMembers(WIDTH_IN, DEPTH_IN, 8, 8);
    expect(members[0]!.position.tiltDeg).toBeCloseTo(90, 6);
    expect(members[0]!.actualDimsIn.lengthIn).toBeCloseTo(WIDTH_IN, 6);
  });
});

describe("buildVerticalGapFillerSchema", () => {
  it("wraps the member with the shared schema envelope, using the taller edge as the overall height", () => {
    const schema = buildVerticalGapFillerSchema(WIDTH_IN, DEPTH_IN, LEFT_IN, RIGHT_IN);
    expect(schema.id).toBe("vertical_gap_filler");
    expect(schema.members).toHaveLength(1);
    expect(schema.overallDimensions).toEqual({ heightIn: RIGHT_IN, widthIn: WIDTH_IN, depthIn: DEPTH_IN });
  });
});
