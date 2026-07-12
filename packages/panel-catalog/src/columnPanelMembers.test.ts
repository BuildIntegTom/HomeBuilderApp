import { describe, expect, it } from "vitest";
import {
  COLUMN_CORE_WIDTH_IN,
  COLUMN_SIDE_PLY_THICKNESS_IN,
  COLUMN_TOTAL_WIDTH_IN,
  DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN,
  buildColumnPanelMembers,
  buildColumnPanelSchema,
  computeColumnBlockingRowCount,
  computeGableColumnHeightIn,
} from "./columnPanelMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

describe("column panel constants", () => {
  it("totals 25.5in (24in core + two 0.75in side plies)", () => {
    expect(COLUMN_CORE_WIDTH_IN).toBe(24);
    expect(COLUMN_SIDE_PLY_THICKNESS_IN).toBe(0.75);
    expect(COLUMN_TOTAL_WIDTH_IN).toBeCloseTo(25.5, 6);
  });
});

describe("computeColumnBlockingRowCount", () => {
  it("uses 16in o.c. spacing, floor of studSpan/16", () => {
    const studSpanIn = HEIGHT_IN - 1.5; // 118.5
    expect(computeColumnBlockingRowCount(studSpanIn)).toBe(Math.floor(118.5 / 16));
  });
});

describe("buildColumnPanelMembers", () => {
  const members = buildColumnPanelMembers(DEPTH_IN, HEIGHT_IN, false);

  it("shares the standard panel's skins/plates/4 corner studs/2 girt rows, shifted by the side ply thickness", () => {
    const bottomSkin = members.find((m) => m.memberId === "bottom_plate_skin");
    expect(bottomSkin).toBeDefined();
    expect(bottomSkin!.position.xIn).toBeCloseTo(COLUMN_SIDE_PLY_THICKNESS_IN, 6);
    expect(members.filter((m) => m.role === "stud")).toHaveLength(4);
    const girtRows = new Set(members.filter((m) => m.role === "girt").map((m) => m.memberId.split("_")[1]));
    expect(girtRows.size).toBe(2);
  });

  it("adds two full-height 3/4in side plywood faces spanning the full panel thickness", () => {
    const left = members.find((m) => m.memberId === "side_ply_left")!;
    const right = members.find((m) => m.memberId === "side_ply_right")!;
    expect(left.actualDimsIn).toEqual({ thicknessIn: 0.75, widthIn: DEPTH_IN, lengthIn: HEIGHT_IN });
    expect(left.position.xIn).toBeCloseTo(0, 6);
    expect(right.position.xIn).toBeCloseTo(COLUMN_CORE_WIDTH_IN + COLUMN_SIDE_PLY_THICKNESS_IN, 6);

    const leftSize = memberBoxSizeIn(left);
    expect(leftSize.xIn).toBeCloseTo(0.75, 6);
    expect(leftSize.yIn).toBeCloseTo(DEPTH_IN, 6);
    expect(leftSize.zIn).toBeCloseTo(HEIGHT_IN, 6);
  });

  it("adds 2x4 blocking every 16in on both edges, in addition to the girt rows", () => {
    const studSpanIn = HEIGHT_IN - 1.5;
    const expectedRows = computeColumnBlockingRowCount(studSpanIn);
    const blockingMembers = members.filter((m) => m.role === "blocking");
    expect(blockingMembers).toHaveLength(expectedRows * 2);
    for (const b of blockingMembers) {
      expect(b.actualDimsIn).toEqual({ thicknessIn: 1.5, widthIn: 3.5, lengthIn: DEPTH_IN });
    }
    // Left-edge blocking sits flush with the (shifted) left corner stud.
    const leftRow1 = blockingMembers.find((m) => m.memberId === "blocking_1_left")!;
    expect(leftRow1.position.xIn).toBeCloseTo(COLUMN_SIDE_PLY_THICKNESS_IN, 6);
  });

  it("includes the nailer when requested", () => {
    const withNailer = buildColumnPanelMembers(DEPTH_IN, HEIGHT_IN, true);
    expect(withNailer.find((m) => m.role === "nailer")).toBeDefined();
  });

  it("keeps every member's overall X footprint within 0..25.5in", () => {
    for (const m of members) {
      const size = memberBoxSizeIn(m);
      const minX = m.position.tiltDeg !== undefined ? m.position.xIn - size.xIn / 2 : m.position.xIn;
      const maxX = minX + size.xIn;
      expect(minX).toBeGreaterThanOrEqual(-1e-6);
      expect(maxX).toBeLessThanOrEqual(COLUMN_TOTAL_WIDTH_IN + 1e-6);
    }
  });
});

describe("buildColumnPanelSchema", () => {
  it("wraps the members with the shared schema envelope", () => {
    const schema = buildColumnPanelSchema(DEPTH_IN, HEIGHT_IN, false);
    expect(schema.id).toBe("column_panel");
    expect(schema.overallDimensions.widthIn).toBeCloseTo(25.5, 6);
    expect(schema.members.length).toBeGreaterThan(0);
  });
});

describe("computeGableColumnHeightIn", () => {
  it("subtracts the default 11.25in beam-depth offset (a real 2x12's actual depth) from the gable peak height", () => {
    expect(computeGableColumnHeightIn(150)).toBeCloseTo(150 - 11.25, 6);
    expect(DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN).toBe(11.25);
  });

  it("accepts a custom offset instead of the default", () => {
    expect(computeGableColumnHeightIn(150, 8)).toBeCloseTo(142, 6);
  });
});
