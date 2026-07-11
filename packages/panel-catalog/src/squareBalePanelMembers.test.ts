import { describe, expect, it } from "vitest";
import { buildSquareBalePanelMembers, buildSquareBalePanelSchema } from "./squareBalePanelMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

// Tommy's reference case: "for a 39in standard panel that is 14in thick,
// there are two 11in and two 36in 2x4s that make the rectangle."
const WIDTH_IN = 39;
const DEPTH_IN = 14;
const HEIGHT_IN = 120;

describe("buildSquareBalePanelMembers", () => {
  const members = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);

  it("reproduces the reference blocking-girt rectangle: two 11in short sides + two 36in long sides, per row", () => {
    const shortSides = members.filter((m) => m.memberId.includes("blocking_girt") && m.memberId.includes("short"));
    const longSides = members.filter((m) => m.memberId.includes("blocking_girt") && m.memberId.includes("long"));
    expect(shortSides).toHaveLength(4); // 2 rows x 2 short sides
    expect(longSides).toHaveLength(4); // 2 rows x 2 long sides
    for (const m of shortSides) expect(m.actualDimsIn.lengthIn).toBeCloseTo(11, 6);
    for (const m of longSides) expect(m.actualDimsIn.lengthIn).toBeCloseTo(36, 6);
  });

  it("still shares the standard 4 corner studs + plates + skins", () => {
    expect(members.filter((m) => m.role === "stud")).toHaveLength(4);
    expect(members.filter((m) => m.role === "plate")).toHaveLength(4); // bottom ext/int + top ext/int
    expect(members.filter((m) => m.role === "skin")).toHaveLength(2);
  });

  it("has no web girt members (girt_web role) — blocking girts replace them entirely", () => {
    expect(members.filter((m) => m.role === "girt_web")).toHaveLength(0);
  });

  it("adds 4 end blocks (left/right x bottom/top), 7in long for the 14in-thick reference", () => {
    const endBlocks = members.filter((m) => m.role === "blocking");
    expect(endBlocks).toHaveLength(4);
    for (const m of endBlocks) expect(m.actualDimsIn.widthIn).toBeCloseTo(7, 6);
  });

  it("sizes every member correctly via the shared axis mapping", () => {
    for (const m of members) {
      const size = memberBoxSizeIn(m);
      expect(size.xIn).toBeGreaterThan(0);
      expect(size.yIn).toBeGreaterThan(0);
      expect(size.zIn).toBeGreaterThan(0);
    }
  });

  it("includes the nailer when requested", () => {
    const withNailer = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true);
    expect(withNailer.find((m) => m.role === "nailer")).toBeDefined();
  });
});

describe("buildSquareBalePanelSchema", () => {
  it("wraps the members with the shared schema envelope", () => {
    const schema = buildSquareBalePanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(schema.id).toBe("square_bale_panel");
    expect(schema.members.length).toBeGreaterThan(0);
  });
});

describe("buildSquareBalePanelMembers stud config", () => {
  it("single-2x4 (default): 4 studs, no void-fill pieces, 3.5in-wide plates", () => {
    const members = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "single-2x4");
    expect(members.filter((m) => m.role === "stud")).toHaveLength(4);
    expect(members.filter((m) => m.material === "wood_fiber_board")).toHaveLength(0);
    for (const m of members.filter((m) => m.role === "plate")) expect(m.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
  });

  it("double-2x4: 8 studs (2 per corner), 4 void-fill pieces, still 3.5in-wide plates", () => {
    const members = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "double-2x4");
    expect(members.filter((m) => m.role === "stud")).toHaveLength(8);
    const voidFill = members.filter((m) => m.material === "wood_fiber_board");
    expect(voidFill).toHaveLength(4);
    for (const m of voidFill) {
      expect(m.actualDimsIn.thicknessIn).toBeCloseTo(1.5, 6);
      expect(m.actualDimsIn.widthIn).toBeCloseTo(7, 6);
    }
    for (const m of members.filter((m) => m.role === "plate")) expect(m.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
  });

  it("double-2x6: 8 studs, 4 void-fill pieces, and 5.5in-wide plates (studs + plates both widen)", () => {
    const members = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "double-2x6");
    expect(members.filter((m) => m.role === "stud")).toHaveLength(8);
    expect(members.filter((m) => m.material === "wood_fiber_board")).toHaveLength(4);
    for (const m of members.filter((m) => m.role === "stud")) expect(m.actualDimsIn.widthIn).toBeCloseTo(5.5, 6);
    for (const m of members.filter((m) => m.role === "plate")) expect(m.actualDimsIn.widthIn).toBeCloseTo(5.5, 6);
  });

  it("blocking girt short sides stay flush against the (wider) doubled corner stud assembly", () => {
    const single = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "single-2x4");
    const doubled = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "double-2x4");
    const singleLeft = single.find((m) => m.memberId === "blocking_girt_1_short_left")!;
    const doubledLeft = doubled.find((m) => m.memberId === "blocking_girt_1_short_left")!;
    expect(doubledLeft.position.xIn).toBeGreaterThan(singleLeft.position.xIn);
    // short-side length itself (11in reference) is unaffected — only its X position shifts inward
    expect(doubledLeft.actualDimsIn.lengthIn).toBeCloseTo(singleLeft.actualDimsIn.lengthIn, 6);
  });

  it("sizes every member correctly via the shared axis mapping, for every stud config", () => {
    for (const studConfig of ["single-2x4", "double-2x4", "double-2x6"] as const) {
      const members = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true, studConfig, 4);
      for (const m of members) {
        const size = memberBoxSizeIn(m);
        expect(size.xIn).toBeGreaterThan(0);
        expect(size.yIn).toBeGreaterThan(0);
        expect(size.zIn).toBeGreaterThan(0);
      }
    }
  });

  it("threads nailerOffsetIn through to the nailer member", () => {
    const centered = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true, "single-2x4", 0);
    const slid = buildSquareBalePanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true, "single-2x4", 5);
    const centeredNailer = centered.find((m) => m.role === "nailer")!;
    const slidNailer = slid.find((m) => m.role === "nailer")!;
    expect(slidNailer.position.xIn).toBeCloseTo(centeredNailer.position.xIn + 5, 6);
  });
});
