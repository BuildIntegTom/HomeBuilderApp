import { describe, expect, it } from "vitest";
import { buildBigHeaderMembers } from "./bigHeaderMembers";
import { sillDefaultHeightIn } from "./data";
import { memberBoxSizeIn, PLATE_2X4_WIDTH_IN } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const WIDTH_IN = 96;
const HEIGHT_IN = 24;

describe("buildBigHeaderMembers", () => {
  it("builds without throwing across the catalog width range", () => {
    for (const widthIn of [48, 72, 96, 120, 144]) {
      expect(() => buildBigHeaderMembers(widthIn, DEPTH_IN, HEIGHT_IN, false, "plywood")).not.toThrow();
    }
  });

  it("has exactly 2 jack studs (left + right)", () => {
    const members = buildBigHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "plywood");
    const jackStuds = members.filter((m) => m.role === "jack_stud");
    const left = jackStuds.filter((m) => m.memberId.startsWith("jack_left_"));
    const right = jackStuds.filter((m) => m.memberId.startsWith("jack_right_"));
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
    expect(left.length).toBe(right.length);
  });

  it("positions the right jack stud at the far end of the width", () => {
    const members = buildBigHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "2x4-stud");
    const rightStud = members.find((m) => m.memberId.startsWith("jack_right_"))!;
    expect(rightStud.position.xIn).toBeGreaterThan(WIDTH_IN - 10);
    expect(rightStud.position.xIn).toBeLessThan(WIDTH_IN);
  });

  it("uses more peaks for a wide Big Header than a narrow one, at the same height", () => {
    const narrow = buildBigHeaderMembers(48, DEPTH_IN, HEIGHT_IN, false, "plywood");
    const wide = buildBigHeaderMembers(144, DEPTH_IN, HEIGHT_IN, false, "plywood");
    const narrowPeaks = narrow.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise")).length;
    const widePeaks = wide.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise")).length;
    expect(widePeaks).toBeGreaterThan(narrowPeaks);
  });

  it("rotates each chord 2x4 to show its 3.5in wide face in elevation (Tommy: '3.5in face... face the user')", () => {
    const members = buildBigHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "plywood");
    const chord = members.find((m) => m.memberId === "bottom_chord_2x4_ext")!;
    const size = memberBoxSizeIn(chord);
    expect(size.zIn).toBeCloseTo(PLATE_2X4_WIDTH_IN, 6); // visible (elevation-facing) height = the WIDE 3.5in face
  });

  it("has no sill members by default (Tommy: 'there are no sills with big headers')", () => {
    const members = buildBigHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "plywood");
    expect(members.some((m) => m.memberId.startsWith("sill_"))).toBe(false);
  });

  it("adds a real sill panel below Z=0 when includeSill is true", () => {
    const members = buildBigHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true, "plywood");
    const sillMembers = members.filter((m) => m.memberId.startsWith("sill_"));
    expect(sillMembers.length).toBeGreaterThan(0);
    for (const m of sillMembers) {
      expect(m.position.zIn).toBeLessThanOrEqual(0);
      expect(m.position.zIn).toBeGreaterThanOrEqual(-sillDefaultHeightIn.value);
    }
  });

  it("sizes every member correctly via the shared axis mapping", () => {
    for (const m of buildBigHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true, "plywood")) {
      const size = memberBoxSizeIn(m);
      expect(size.xIn).toBeGreaterThan(0);
      expect(size.yIn).toBeGreaterThan(0);
      expect(size.zIn).toBeGreaterThan(0);
    }
  });
});
