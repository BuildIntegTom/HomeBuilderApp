import { describe, expect, it } from "vitest";
import { COLUMN_SIDE_PLY_THICKNESS_IN, COLUMN_TOTAL_WIDTH_IN, buildColumnPanelMembers } from "./columnPanelMembers";
import { buildCornerPanelMembers, buildCornerPanelSchema } from "./cornerPanelMembers";
import { panelWidthInRange } from "./data";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

/** The widest X extent any member reaches — what the framing actually fills. */
const framedWidthIn = (widthIn: number): number => {
  const members = buildCornerPanelMembers(DEPTH_IN, HEIGHT_IN, false, widthIn);
  return Math.max(...members.map((m) => m.position.xIn + memberBoxSizeIn(m).xIn));
};

describe("buildCornerPanelMembers at the nominal width", () => {
  it("is byte-identical to the Column Panel it is built from", () => {
    // The re-export used to BE buildColumnPanelMembers. Widening it must not
    // have moved a single member on the panel every other caller asks for.
    expect(buildCornerPanelMembers(DEPTH_IN, HEIGHT_IN, false)).toEqual(
      buildColumnPanelMembers(DEPTH_IN, HEIGHT_IN, false),
    );
    expect(buildCornerPanelMembers(DEPTH_IN, HEIGHT_IN, true)).toEqual(
      buildColumnPanelMembers(DEPTH_IN, HEIGHT_IN, true),
    );
    // Explicitly passing the nominal is the same as omitting it.
    expect(buildCornerPanelMembers(DEPTH_IN, HEIGHT_IN, false, COLUMN_TOTAL_WIDTH_IN)).toEqual(
      buildColumnPanelMembers(DEPTH_IN, HEIGHT_IN, false),
    );
  });
});

describe("buildCornerPanelMembers at the slot's real width", () => {
  it("FRAMES THE WHOLE SLOT — the defect was 25.5in of framing in a 36in box", () => {
    // A 72in wall owning both corners tiles to two 36in corner panels (corner
    // absorb). Before this fix the members filled 25.5in of it: 10.5in short in
    // Framed 3D, in the OBJ export, and on the shop fabrication page.
    expect(framedWidthIn(36)).toBeCloseTo(36, 6);
    expect(framedWidthIn(COLUMN_TOTAL_WIDTH_IN)).toBeCloseTo(COLUMN_TOTAL_WIDTH_IN, 6);
  });

  it("frames every width across Tommy's confirmed 24in-48in corner band, to the eighth", () => {
    // Tommy, 2026-09-25: "Yes — any width in the 24-48in band."
    for (let eighths = 24 * 8; eighths <= 48 * 8; eighths++) {
      const widthIn = eighths / 8;
      expect(framedWidthIn(widthIn)).toBeCloseTo(widthIn, 6);
    }
  });

  it("keeps the two side plywood faces at 3/4in and moves the far one out to the real width", () => {
    // The added width goes into the CORE, not into the plywood faces — the
    // faces are a fixed piece of the construction.
    const members = buildCornerPanelMembers(DEPTH_IN, HEIGHT_IN, false, 36);
    const left = members.find((m) => m.memberId === "side_ply_left")!;
    const right = members.find((m) => m.memberId === "side_ply_right")!;
    expect(left.actualDimsIn.thicknessIn).toBeCloseTo(COLUMN_SIDE_PLY_THICKNESS_IN, 6);
    expect(right.actualDimsIn.thicknessIn).toBeCloseTo(COLUMN_SIDE_PLY_THICKNESS_IN, 6);
    expect(left.position.xIn).toBeCloseTo(0, 6);
    expect(right.position.xIn).toBeCloseTo(36 - COLUMN_SIDE_PLY_THICKNESS_IN, 6);
  });

  it("invents no new member: same roles and same count as the nominal panel", () => {
    const nominal = buildCornerPanelMembers(DEPTH_IN, HEIGHT_IN, true);
    const wide = buildCornerPanelMembers(DEPTH_IN, HEIGHT_IN, true, 42);
    expect(wide.map((m) => m.memberId)).toEqual(nominal.map((m) => m.memberId));
    expect(wide.filter((m) => m.role === "stud")).toHaveLength(4);
    // Blocking rows are spaced by HEIGHT, so a wider panel gets the same
    // number of them — just longer, tracking the plate runners as Tommy
    // specified ("same length as the runners").
    expect(wide.filter((m) => m.role === "blocking")).toHaveLength(nominal.filter((m) => m.role === "blocking").length);
    const nominalBlocking = nominal.find((m) => m.role === "blocking")!;
    const wideBlocking = wide.find((m) => m.role === "blocking")!;
    expect(wideBlocking.actualDimsIn.lengthIn - nominalBlocking.actualDimsIn.lengthIn).toBeCloseTo(
      42 - COLUMN_TOTAL_WIDTH_IN,
      6,
    );
  });

  it("frames a corner the tiler sized DOWN, too (merge and clamp both do)", () => {
    // A wall too short for both corners gets ONE corner panel spanning it. The
    // old lock drew 25.5in of framing inside a narrower box, sticking out past
    // the panel — the same defect in the other direction.
    expect(framedWidthIn(40)).toBeCloseTo(40, 6);
    expect(framedWidthIn(20)).toBeCloseTo(20, 6);
  });

  it("produces no member of negative length at a width under the two side faces", () => {
    // Defensive: no caller can ask for this today. It must not reach a cut
    // list as a part with a negative dimension.
    for (const widthIn of [1.5, 1, 0.5, 0]) {
      const members = buildCornerPanelMembers(DEPTH_IN, HEIGHT_IN, false, widthIn);
      for (const m of members) {
        expect(m.actualDimsIn.lengthIn).toBeGreaterThanOrEqual(0);
        expect(m.actualDimsIn.widthIn).toBeGreaterThanOrEqual(0);
        expect(m.actualDimsIn.thicknessIn).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("buildCornerPanelSchema", () => {
  it("reports the panel's REAL width, not the nominal", () => {
    expect(buildCornerPanelSchema(DEPTH_IN, HEIGHT_IN, false, 36).overallDimensions.widthIn).toBe(36);
    expect(buildCornerPanelSchema(DEPTH_IN, HEIGHT_IN, false).overallDimensions.widthIn).toBe(COLUMN_TOTAL_WIDTH_IN);
  });

  it("says in its own notes that off-nominal widths outside the confirmed band are not confirmed", () => {
    const notes = buildCornerPanelSchema(DEPTH_IN, HEIGHT_IN, false, 36).notes.map((n) => n.text);
    expect(notes.some((t) => t.includes("24-48in band"))).toBe(true);
    // The band it cites is the catalog's own, not a number invented here.
    expect(panelWidthInRange.maxIn).toBe(48);
  });

  it("carries members that match its own reported width", () => {
    const schema = buildCornerPanelSchema(DEPTH_IN, HEIGHT_IN, false, 30.875);
    const framed = Math.max(...schema.members.map((m) => m.position.xIn + memberBoxSizeIn(m).xIn));
    expect(framed).toBeCloseTo(schema.overallDimensions.widthIn, 6);
  });
});
