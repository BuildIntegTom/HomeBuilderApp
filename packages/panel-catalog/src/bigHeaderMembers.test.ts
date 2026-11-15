import { describe, expect, it } from "vitest";
import { buildBigHeaderMembers, bigHeaderIsStuffedPerpendicular } from "./bigHeaderMembers";
import { overlappingMemberPairs } from "./memberPrism";
import type { PanelMember } from "./componentSchema";
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

/**
 * ⚠ **OVER 48 INCHES WIDE, A BIG HEADER IS STUFFED PERPENDICULAR — 2026-11-14.**
 *
 * > *"treat them as a 'standard panel' if they are 48 in or less in elevation
 * > horizontal measurement. If they are greater than 48 in... the top and
 * > bottom plates should be completely within the panel so that the top and
 * > bottom plate stretch the entire opening. I think that is important.
 * > Structurally."* — Tommy
 *
 * The threshold is the width ALONG THE WALL (his *"correct"*), and at 48in and
 * under nothing changes at all (his *"just the way its stuff and created /
 * as is"*) — so half of what these tests pin is that the narrow case did not
 * move.
 */
describe("⚠ a Big Header wider than 48in", () => {
  const D = 15.5;
  const H = 25;
  const plateIds = ["bottom_chord_2x4_ext", "bottom_chord_2x4_int", "top_chord_2x4_ext", "top_chord_2x4_int", "bottom_chord_ply", "top_chord_ply"];
  const spanOf = (members: PanelMember[], id: string) => {
    const m = members.find((x) => x.memberId === id)!;
    return [m.position.xIn, m.position.xIn + m.actualDimsIn.lengthIn] as const;
  };

  it("is the WIDTH that decides it, not the height", () => {
    expect(bigHeaderIsStuffedPerpendicular(48)).toBe(false);
    expect(bigHeaderIsStuffedPerpendicular(48.125)).toBe(true);
    /* A 60in header only 8in tall is still perpendicular-stuffed. */
    expect(bigHeaderIsStuffedPerpendicular(60)).toBe(true);
  });

  it("⚠ runs every plate the FULL width, over both jack studs", () => {
    const wide = buildBigHeaderMembers(72, D, H, false, "plywood");
    for (const id of plateIds) expect({ id, span: spanOf(wide, id) }).toEqual({ id, span: [0, 72] });
  });

  it("⚠ at 48in and under the plates still stop at the jacks — unchanged", () => {
    const narrow = buildBigHeaderMembers(48, D, H, false, "plywood");
    /* 3/4in plywood jack each side. */
    for (const id of plateIds) expect({ id, span: spanOf(narrow, id) }).toEqual({ id, span: [0.75, 47.25] });
  });

  it("⚠ the jack studs stand BETWEEN the plates once the plates run over them", () => {
    const wide = buildBigHeaderMembers(72, D, H, false, "plywood");
    const jack = wide.find((m) => m.memberId === "jack_left_jack_stud_sheet")!;
    /* Bottom plate stack is 3/4in of cap plus 3.5in of rotated chord. */
    expect(jack.position.zIn).toBeCloseTo(0.75 + 3.5, 6);
    expect(jack.position.zIn + jack.actualDimsIn.lengthIn).toBeCloseTo(H - 0.75 - 3.5, 6);

    /* ...and beside them when they do not. */
    const narrow = buildBigHeaderMembers(48, D, H, false, "plywood");
    const narrowJack = narrow.find((m) => m.memberId === "jack_left_jack_stud_sheet")!;
    expect(narrowJack.position.zIn).toBe(0);
    expect(narrowJack.actualDimsIn.lengthIn).toBeCloseTo(H, 6);
  });

  it("keeps its top and bottom skins, which is what it is stuffed against", () => {
    const wide = buildBigHeaderMembers(72, D, H, false, "plywood");
    for (const id of ["bottom_chord_ply", "top_chord_ply"]) {
      const ply = wide.find((m) => m.memberId === id)!;
      expect({ id, t: ply.actualDimsIn.thicknessIn, w: ply.actualDimsIn.widthIn }).toEqual({ id, t: 0.75, w: D });
    }
  });

  it("⚠ a 2x4 jack is cleared by the plate too, at its bigger thickness", () => {
    const wide = buildBigHeaderMembers(96, D, H, false, "plywood+2x4");
    for (const id of plateIds) expect({ id, span: spanOf(wide, id) }).toEqual({ id, span: [0, 96] });
    expect(overlappingMemberPairs(wide)).toEqual([]);
  });

  it("builds nothing overlapping at either side of the threshold", () => {
    for (const widthIn of [24, 40, 48, 48.5, 60, 72, 96, 144]) {
      expect({ widthIn, overlaps: overlappingMemberPairs(buildBigHeaderMembers(widthIn, D, H, false, "plywood")) }).toEqual({
        widthIn,
        overlaps: [],
      });
    }
  });
});
