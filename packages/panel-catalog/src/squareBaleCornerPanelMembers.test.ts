import { describe, expect, it } from "vitest";
import { buildSquareBaleCornerPanelMembers, buildSquareBaleCornerPanelSchema } from "./squareBaleCornerPanelMembers";
import { squareBalePanel } from "./data";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const DEPTH_IN = 14;
const HEIGHT_IN = 120;

describe("buildSquareBaleCornerPanelMembers", () => {
  const members = buildSquareBaleCornerPanelMembers(DEPTH_IN, HEIGHT_IN, false);

  it("is the standard 39in square-bale width, not the 25.5in Column/Corner width", () => {
    expect(squareBalePanel.widthIn).toBe(39);
  });

  it("has 6 studs total: a double-2x6 pair at the primary corner (2x2) + a single-2x4 at the base corner (2x1)", () => {
    const studs = members.filter((m) => m.role === "stud");
    expect(studs).toHaveLength(6);
    const wide = studs.filter((m) => m.actualDimsIn.widthIn === 5.5);
    const narrow = studs.filter((m) => m.actualDimsIn.widthIn === 3.5);
    expect(wide).toHaveLength(4);
    expect(narrow).toHaveLength(2);
  });

  it("has void-fill pieces only at the primary (doubled) corner, not the base corner", () => {
    const voidFill = members.filter((m) => m.material === "wood_fiber_board");
    expect(voidFill).toHaveLength(2);
  });

  it("sizes the main plate boards to the base (3.5in) stud width, not the wider primary corner", () => {
    const mainPlates = members.filter((m) => m.role === "plate" && !m.memberId.includes("lip"));
    expect(mainPlates).toHaveLength(4); // bottom/top x ext/int
    for (const m of mainPlates) expect(m.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
  });

  it("adds 4 plate lip pieces (bottom/top x ext/int) bridging the 2in delta at the primary corner", () => {
    const lips = members.filter((m) => m.memberId.includes("plate_lip"));
    expect(lips).toHaveLength(4);
    for (const m of lips) {
      expect(m.actualDimsIn.widthIn).toBeCloseTo(2, 6); // 5.5 - 3.5
      expect(m.position.xIn).toBe(0); // right at the primary corner
    }
  });

  it("adds an extra 'outer' girt short-side bar at the primary corner for each row, but not the base corner", () => {
    const outerBars = members.filter((m) => m.memberId.includes("blocking_girt") && m.memberId.includes("outer"));
    expect(outerBars).toHaveLength(2); // 2 rows x 1 (left/primary side only)
    for (const m of outerBars) expect(m.memberId).toContain("left");
  });

  it("still has the full rectangular blocking-girt frame (short + long sides) per row", () => {
    const longSides = members.filter((m) => m.memberId.includes("blocking_girt") && m.memberId.includes("long"));
    expect(longSides).toHaveLength(4); // 2 rows x 2 long sides, unaffected by the asymmetric corner
  });

  it("still has skins, end blocks, and no leftover uniform-corner artifacts", () => {
    expect(members.filter((m) => m.role === "skin")).toHaveLength(2);
    expect(members.filter((m) => m.role === "blocking" && m.memberId.includes("end_block"))).toHaveLength(4);
  });

  it("sizes every member correctly via the shared axis mapping", () => {
    for (const m of members) {
      const size = memberBoxSizeIn(m);
      expect(size.xIn).toBeGreaterThan(0);
      expect(size.yIn).toBeGreaterThan(0);
      expect(size.zIn).toBeGreaterThan(0);
    }
  });

  it("includes the nailer when requested, threading nailerOffsetIn through", () => {
    const withNailer = buildSquareBaleCornerPanelMembers(DEPTH_IN, HEIGHT_IN, true, 4);
    const nailer = withNailer.find((m) => m.role === "nailer");
    expect(nailer).toBeDefined();
    expect(nailer!.position.xIn).toBeCloseTo(squareBalePanel.widthIn / 2 - 1.5 / 2 + 4, 6);
  });
});

describe("buildSquareBaleCornerPanelSchema", () => {
  it("wraps the members with the shared schema envelope at the 39in width", () => {
    const schema = buildSquareBaleCornerPanelSchema(DEPTH_IN, HEIGHT_IN, false);
    expect(schema.id).toBe("square_bale_corner_panel");
    expect(schema.overallDimensions.widthIn).toBe(39);
    expect(schema.members.length).toBeGreaterThan(0);
  });
});
