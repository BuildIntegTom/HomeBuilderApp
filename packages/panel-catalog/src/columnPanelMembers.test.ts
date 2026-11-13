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
import { memberBoxSizeIn, PLATE_END_CLEARANCE_IN } from "./panelMemberHelpers";
import { overlappingMemberPairs } from "./memberPrism";

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
  /* ⚠ This used to assert `floor(studSpan / 16)` and passed, because at 120in
     the two rules agree — 7 rows either way. The rule it named was wrong at
     other heights, so the test was describing a bug it could not see. */
  it("uses 16in o.c. spacing, counting only rows that clear the top plate", () => {
    const studSpanIn = HEIGHT_IN - 1.5; // 118.5
    /* 118.5 less the top plate's 1.5in and the row's own 3.5in = 113.5. */
    expect(computeColumnBlockingRowCount(studSpanIn)).toBe(Math.floor(113.5 / 16));
    /* Still 7 at 120in, which is why the old assertion survived. */
    expect(computeColumnBlockingRowCount(studSpanIn)).toBe(7);
  });

  it("never returns a negative count on a panel too short for any row", () => {
    expect(computeColumnBlockingRowCount(4)).toBe(0);
    expect(computeColumnBlockingRowCount(0)).toBe(0);
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

  it("adds 2x4 blocking every 16in on both the interior and exterior face, running the same X span as the plate runners", () => {
    const studSpanIn = HEIGHT_IN - 1.5;
    const expectedRows = computeColumnBlockingRowCount(studSpanIn);
    const blockingMembers = members.filter((m) => m.role === "blocking");
    expect(blockingMembers).toHaveLength(expectedRows * 2);
    // "On edge" (orientation "horizontal", rotationDeg 0), spanning X the
    // same length as the top/bottom plate runners (widthIn - 2 *
    // PLATE_END_CLEARANCE_IN) — not the old "on edge, spanning Y" front-
    // to-back strip at the panel's 2 X-extremes.
    const expectedLengthIn = COLUMN_CORE_WIDTH_IN - 2 * PLATE_END_CLEARANCE_IN;
    for (const b of blockingMembers) {
      expect(b.actualDimsIn).toEqual({ thicknessIn: 1.5, widthIn: 3.5, lengthIn: expectedLengthIn });
      expect(b.orientation).toBe("horizontal");
      expect(b.position.rotationDeg).toBe(0);
    }
    // Both faces' row 1 sit at the same X (matching the plate runners' own
    // clearance from the panel edge), differing only in Y — exterior at
    // the panel's front face, interior set back by the blocking's own
    // (on-edge) 1.5in Y-footprint from the panel's back face.
    const exteriorRow1 = blockingMembers.find((m) => m.memberId === "blocking_1_exterior")!;
    const interiorRow1 = blockingMembers.find((m) => m.memberId === "blocking_1_interior")!;
    expect(exteriorRow1.position.xIn).toBeCloseTo(COLUMN_SIDE_PLY_THICKNESS_IN + PLATE_END_CLEARANCE_IN, 6);
    expect(interiorRow1.position.xIn).toBeCloseTo(exteriorRow1.position.xIn, 6);
    expect(exteriorRow1.position.yIn).toBeCloseTo(0, 6);
    expect(interiorRow1.position.yIn).toBeCloseTo(DEPTH_IN - 1.5, 6);
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

/**
 * ⚠ **BLOCKING MUST FIT INSIDE THE PANEL, AT EVERY HEIGHT.**
 *
 * > *"We can't be having any overlapping in the 3d renderings or anywhere…
 * > these need to be possible to build."* — Tommy, 2026-10-23
 *
 * The blocking row count was derived from a span 3in longer than the space
 * the rows have, and took no account of a row's own 3 1/2in width, so at some
 * heights the last row ran through the top plate and out of the top of the
 * panel. It was invisible because `memberOverlap.test.ts` samples ONE height
 * (96in) and 96in happens to be clean.
 *
 * So this sweeps instead of sampling. A single height proves nothing about a
 * rule that only bites on some of them.
 */
describe("⚠ column blocking fits under the top plate at every height", () => {
  /* Every inch from a short column to a two-storey one, so no height can hide
     between the samples. */
  const HEIGHTS = Array.from({ length: 113 }, (_, i) => 32 + i);

  it("no blocking row touches a plate or a skin, and none leaves the panel", () => {
    const bad: string[] = [];
    for (const heightIn of HEIGHTS) {
      const members = buildColumnPanelMembers(DEPTH_IN, heightIn, false);
      const blocking = members.filter((m) => m.role === "blocking");
      const shell = members.filter((m) => m.memberId.includes("plate_2x4") || m.memberId.includes("plate_skin"));
      for (const b of blocking) {
        const zLoIn = b.position.zIn;
        const zHiIn = zLoIn + memberBoxSizeIn(b).zIn;
        if (zHiIn > heightIn + 1e-9) {
          bad.push(`h=${heightIn}: ${b.memberId} reaches ${zHiIn.toFixed(2)}in on a ${heightIn}in panel`);
        }
        for (const s of shell) {
          const pair = overlappingMemberPairs([b, s]);
          if (pair.length > 0) bad.push(`h=${heightIn}: ${pair.join(", ")}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("⚠ and the correction only ever REMOVES a row that could not be built", () => {
    /* The old rule, kept here as the thing being compared against rather than
       described in prose. A height where the two agree is a height this fix
       did not touch; the count may never come out HIGHER than the old one. */
    const oldRule = (studSpanIn: number) => Math.floor(studSpanIn / 16);
    const changed: string[] = [];
    for (const heightIn of HEIGHTS) {
      const studSpanIn = heightIn - 1.5;
      const now = computeColumnBlockingRowCount(studSpanIn);
      const before = oldRule(studSpanIn);
      expect({ heightIn, higher: now > before }).toEqual({ heightIn, higher: false });
      if (now !== before) changed.push(`${heightIn}in: ${before} → ${now}`);
    }
    /* ⚠ Reported as BANDS rather than 35 separate lines, so a change of
       spacing or stock reads as a moved band instead of a wall of numbers.
       Each band is the five heights in every 16in course where the last row
       no longer fits: the old rule turned a row on 1 1/2in after the previous
       course, the new one waits until there is 5in of room for the row's own
       3 1/2in plus the top plate's 1 1/2in. */
    const bands: string[] = [];
    for (const line of changed) {
      const [heightPart, countPart] = line.split("in: ") as [string, string];
      const heightIn = Number(heightPart);
      const last = bands[bands.length - 1];
      if (last !== undefined && last.endsWith(`|${heightIn - 1}|${countPart}`)) {
        bands[bands.length - 1] = last.replace(`|${heightIn - 1}|`, `|${heightIn}|`);
      } else {
        bands.push(`${heightIn}-|${heightIn}|${countPart}`);
      }
    }
    expect(bands.map((b) => b.replace("-|", "-").replace("|", "in: "))).toEqual([
      "34-38in: 2 → 1",
      "50-54in: 3 → 2",
      "66-70in: 4 → 3",
      "82-86in: 5 → 4",
      "98-102in: 6 → 5",
      "114-118in: 7 → 6",
      "130-134in: 8 → 7",
    ]);
  });
});
