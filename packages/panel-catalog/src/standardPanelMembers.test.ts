import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers, buildStandardPanelSchema, computeStandardGirtRowCount } from "./standardPanelMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";

const WIDTH_IN = 40;
const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

function findMember(members: ReturnType<typeof buildStandardPanelMembers>, memberId: string) {
  const found = members.find((m) => m.memberId === memberId);
  if (!found) throw new Error(`member ${memberId} not found`);
  return found;
}

describe("buildStandardPanelMembers", () => {
  it("sizes the bottom/top skins to the full widthIn x depthIn footprint, stacked at the panel's bottom/top faces", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const bottom = findMember(members, "bottom_plate_skin");
    expect(bottom.actualDimsIn).toEqual({ thicknessIn: 0.75, widthIn: DEPTH_IN, lengthIn: WIDTH_IN });
    expect(bottom.position).toEqual({ xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 });

    const top = findMember(members, "top_plate_skin");
    expect(top.actualDimsIn).toEqual({ thicknessIn: 0.75, widthIn: DEPTH_IN, lengthIn: WIDTH_IN });
    expect(top.position.zIn).toBeCloseTo(119.25, 6); // 120 - 0.75
  });

  it("insets bottom/top plate 2x4s 1.5in from each end, ext at the y=0 wythe and int at the far wythe", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const bottomExt = findMember(members, "bottom_plate_2x4_ext");
    expect(bottomExt.actualDimsIn.lengthIn).toBeCloseTo(37, 6); // 40 - 2*1.5
    expect(bottomExt.position).toEqual({ xIn: 1.5, yIn: 0, zIn: 0.75, rotationDeg: 0 });

    const bottomInt = findMember(members, "bottom_plate_2x4_int");
    expect(bottomInt.position.yIn).toBeCloseTo(12, 6); // 15.5 - 3.5

    const topExt = findMember(members, "top_plate_2x4_ext");
    expect(topExt.position.zIn).toBeCloseTo(117.75, 6); // 120 - 0.75 - 1.5
  });

  it("places all 4 corner studs at the panel's 4 corners, spanning the full stud height between the skins", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    /* Corner posts only — a 4ft panel also carries centre nailer studs, which
       are the same role but stop at the plates rather than running the full
       height, and have their own test below. */
    const studs = members.filter((m) => m.memberId.startsWith("stud_corner_"));
    expect(studs).toHaveLength(4);
    for (const stud of studs) {
      expect(stud.actualDimsIn.lengthIn).toBeCloseTo(118.5, 6); // 120 - 2*0.75
      expect(stud.position.zIn).toBeCloseTo(0.75, 6);
    }
    const corners = studs.map((s) => ({ x: Math.round(s.position.xIn * 100) / 100, y: Math.round(s.position.yIn * 100) / 100 }));
    expect(corners).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 38.5, y: 0 }, // 40 - 1.5
        { x: 0, y: 12 }, // 15.5 - 3.5
        { x: 38.5, y: 12 },
      ]),
    );
  });

  it("splits the stud span into 3 equal bays with 2 girt rows (2 bars flush to the stud doubles + 1 web resting on top)", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    const bars1 = members.filter((m) => m.role === "girt" && m.memberId.startsWith("girt_1_"));
    const bars2 = members.filter((m) => m.role === "girt" && m.memberId.startsWith("girt_2_"));
    expect(bars1).toHaveLength(2);
    expect(bars2).toHaveLength(2);

    // centerZ = 0.75 + studSpan*row/3; bar z (min-corner) = centerZ - 1.5/2
    // (bars are rolled 90deg "hotdog style" onto their 3.5in face — only
    // their 1.5in thickness is vertical now, not their 3.5in width).
    const bar1Left = findMember(members, "girt_1_bar_left");
    const bar1Right = findMember(members, "girt_1_bar_right");
    expect(bar1Left.position.zIn).toBeCloseTo(0.75 + 118.5 / 3 - 0.75, 6);
    expect(bar1Right.position.zIn).toBeCloseTo(bar1Left.position.zIn, 6);
    expect(bar1Left.actualDimsIn.lengthIn).toBeCloseTo(DEPTH_IN, 6); // spans the full depth
    // Each bar's OUTER edge is flush to its stud double's inner face,
    // extending inward by its own (now-rotated) 3.5in face.
    expect(bar1Left.position.xIn).toBeCloseTo(1.5, 6); // flush with the left stud pair's inner face
    expect(bar1Right.position.xIn).toBeCloseTo(WIDTH_IN - 1.5 - 3.5, 6); // flush with the right stud pair's inner face

    const bar2Left = findMember(members, "girt_2_bar_left");
    expect(bar2Left.position.zIn).toBeCloseTo(0.75 + (118.5 * 2) / 3 - 0.75, 6);

    // Web lies flat (Z=thickness), resting on top of both bars, overhanging
    // the stud-face span by 0.5in total.
    const girt1Web = findMember(members, "girt_1_web");
    expect(girt1Web.orientation).toBe("flat");
    expect(girt1Web.actualDimsIn.lengthIn).toBeCloseTo(WIDTH_IN - 3 + 0.5, 6); // 37.5
    expect(girt1Web.position.xIn).toBeCloseTo(1.5 - 0.25, 6); // 1.25
    expect(girt1Web.position.zIn).toBeCloseTo(bar1Left.position.zIn + 1.5, 6); // rests on top of the bars
  });

  it("omits the nailer when includeNailer is false, includes it centered on the exterior wythe when true", () => {
    const without = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(without.find((m) => m.role === "nailer")).toBeUndefined();
    // 2 skins + 4 plate 2x4s + 4 corner studs + 4 girt bars + 2 girt webs,
    // plus 2 centre nailers now that the default panel is 4ft wide.
    expect(without).toHaveLength(18);

    const withNailer = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true);
    const nailer = findMember(withNailer, "nailer");
    expect(nailer.actualDimsIn.lengthIn).toBeCloseTo(115.5, 6); // 120 - 4.5 (deficit derived from the 120in reference)
    expect(nailer.position).toEqual({ xIn: WIDTH_IN / 2 - 0.75, yIn: 0, zIn: 0.75, rotationDeg: 0 });
    expect(withNailer).toHaveLength(19); // 18 plus the nailer
  });

  it("stays parametric to a different selected width/depth (not hardcoded to the 48in x 15.5in reference)", () => {
    const members = buildStandardPanelMembers(48, 15.5, HEIGHT_IN, false);
    const bottomExt = findMember(members, "bottom_plate_2x4_ext");
    expect(bottomExt.actualDimsIn.lengthIn).toBeCloseTo(45, 6); // matches Panel Set 1's confirmed reference exactly at 48in
    const girt1Web = findMember(members, "girt_1_web");
    expect(girt1Web.actualDimsIn.lengthIn).toBeCloseTo(48 - 3 + 0.5, 6); // 45.5
  });

  it("keeps every member's footprint within the panel's own overall bounds", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true);
    for (const m of members) {
      const size = memberBoxSizeIn(m);
      expect(m.position.xIn).toBeGreaterThanOrEqual(0);
      expect(m.position.xIn + size.xIn).toBeLessThanOrEqual(WIDTH_IN + 1e-6);
      expect(m.position.yIn).toBeGreaterThanOrEqual(0);
      expect(m.position.yIn + size.yIn).toBeLessThanOrEqual(DEPTH_IN + 1e-6);
      expect(m.position.zIn).toBeGreaterThanOrEqual(0);
      expect(m.position.zIn + size.zIn).toBeLessThanOrEqual(HEIGHT_IN + 1e-6);
    }
  });
});

describe("computeStandardGirtRowCount", () => {
  it("spawns 0 girts for a panel 36in or shorter (e.g. a short sill)", () => {
    expect(computeStandardGirtRowCount(20)).toBe(0);
    expect(computeStandardGirtRowCount(36)).toBe(0); // exactly 36 is not yet "more than 36"
  });

  it("spawns 1 girt once a panel is more than 36in tall", () => {
    expect(computeStandardGirtRowCount(37)).toBe(1);
    expect(computeStandardGirtRowCount(60)).toBe(1);
    expect(computeStandardGirtRowCount(72)).toBe(1); // exactly 72 is not yet "more than 72"
  });

  it("spawns 2 girts once a panel is more than 72in tall", () => {
    expect(computeStandardGirtRowCount(73)).toBe(2);
    expect(computeStandardGirtRowCount(100)).toBe(2);
  });

  it("keeps the confirmed fixed 2-row spec at/above the real Panel Set 1 standard height (120in), not the extrapolated formula", () => {
    expect(computeStandardGirtRowCount(120)).toBe(2);
    expect(computeStandardGirtRowCount(200)).toBe(2); // a taller-than-normal custom wall still uses the confirmed spec
  });

  it("the sill's own default height (32in) lands at 0 girts", () => {
    expect(computeStandardGirtRowCount(32)).toBe(0);
  });
});

describe("buildStandardPanelMembers at a short (sill-scale) height", () => {
  it("spawns no girt rows for a 32in-tall panel (Tommy's sill default)", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, 32, false);
    expect(members.filter((m) => m.role === "girt")).toHaveLength(0);
    expect(members.filter((m) => m.role === "girt_web")).toHaveLength(0);
  });

  it("spawns exactly 1 girt row for a 50in-tall panel", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, 50, false);
    expect(members.filter((m) => m.role === "girt_web")).toHaveLength(1);
  });

  it("still spawns the full 2 girt rows at the real 120in standard height", () => {
    const members = buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(members.filter((m) => m.role === "girt_web")).toHaveLength(2);
  });
});

describe("memberBoxSizeIn", () => {
  const dims = { thicknessIn: 1, widthIn: 2, lengthIn: 3 };
  const basePosition = { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 };

  it("maps flat -> (length, width, thickness)", () => {
    const m = { orientation: "flat" as const, actualDimsIn: dims, position: basePosition } as Parameters<typeof memberBoxSizeIn>[0];
    expect(memberBoxSizeIn(m)).toEqual({ xIn: 3, yIn: 2, zIn: 1 });
  });

  it("maps vertical -> (thickness, width, length)", () => {
    const m = { orientation: "vertical" as const, actualDimsIn: dims, position: basePosition } as Parameters<typeof memberBoxSizeIn>[0];
    expect(memberBoxSizeIn(m)).toEqual({ xIn: 1, yIn: 2, zIn: 3 });
  });

  it("maps horizontal + 90deg -> (thickness, length, width)", () => {
    const m = {
      orientation: "horizontal" as const,
      actualDimsIn: dims,
      position: { ...basePosition, rotationDeg: 90 },
    } as Parameters<typeof memberBoxSizeIn>[0];
    expect(memberBoxSizeIn(m)).toEqual({ xIn: 1, yIn: 3, zIn: 2 });
  });

  it("maps horizontal + 0deg -> (length, thickness, width)", () => {
    const m = { orientation: "horizontal" as const, actualDimsIn: dims, position: basePosition } as Parameters<typeof memberBoxSizeIn>[0];
    expect(memberBoxSizeIn(m)).toEqual({ xIn: 3, yIn: 1, zIn: 2 });
  });
});

describe("buildStandardPanelSchema", () => {
  it("wraps the members list with the shared component schema envelope", () => {
    const schema = buildStandardPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(schema.componentType).toBe("panel");
    expect(schema.id).toBe("standard_panel");
    expect(schema.overallDimensions).toEqual({ heightIn: HEIGHT_IN, widthIn: WIDTH_IN, depthIn: DEPTH_IN });
    expect(schema.members.length).toBeGreaterThan(0);
  });

  it("flags a deviation note when the selected width differs from the confirmed 48in reference", () => {
    const atReference = buildStandardPanelSchema(48, DEPTH_IN, HEIGHT_IN, false);
    expect(atReference.notes).toEqual([]);

    const deviated = buildStandardPanelSchema(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(deviated.notes).toHaveLength(1);
    expect(deviated.notes[0]!.type).toBe("deviation");
  });
});

describe("⚠ the centre nailer that lets a 4ft panel carry 2ft floors", () => {
  /* > *"I like the idea of 4' panels potentially getting a nailer stud of
     > different type of braced piece, allowing them to work with the floor and
     > roof panels and be 4'."* — Tommy, 2026-10-23

     A floor or roof panel carries its joists on its two side edges, so at the
     2ft module a seam lands every 24in. Without a stud at mid-panel, every
     other one of those seams would land on 4ft of top plate in bending. */

  it("a 4ft panel gets one pair; a 2ft panel needs none", () => {
    const wide = buildStandardPanelMembers(48, DEPTH_IN, HEIGHT_IN, false);
    expect(wide.filter((m) => m.memberId.startsWith("stud_centre_"))).toHaveLength(2);
    const narrow = buildStandardPanelMembers(24, DEPTH_IN, HEIGHT_IN, false);
    expect(narrow.filter((m) => m.memberId.startsWith("stud_centre_"))).toHaveLength(0);
  });

  it("⚠ no stud bay is ever wider than the floor module", () => {
    /* The property that matters, swept rather than spot-checked: whatever
       width a wall tiles to, a 24in floor seam always has a stud under it. */
    for (let widthIn = 24; widthIn <= 48; widthIn += 0.125) {
      const members = buildStandardPanelMembers(widthIn, DEPTH_IN, HEIGHT_IN, false);
      const xs = [
        0,
        ...members.filter((m) => m.memberId.startsWith("stud_centre_") && m.memberId.endsWith("exterior")).map((m) => m.position.xIn + 0.75),
        widthIn,
      ].sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        expect({ widthIn, bay: xs[i]! - xs[i - 1]! <= 24 + 1e-9 }).toEqual({ widthIn, bay: true });
      }
    }
  });

  it("⚠ it sits ON the bottom plate, unlike a corner post", () => {
    /* A corner post runs the full height because it stands outside the
       plates' span in x. A centre nailer lands mid-plate, so it stops at the
       plate faces — and until it did, it measurably occupied the same space
       as all four of them. */
    const members = buildStandardPanelMembers(48, DEPTH_IN, HEIGHT_IN, false);
    const nailer = members.find((m) => m.memberId === "stud_centre_1_exterior")!;
    const corner = members.find((m) => m.memberId === "stud_corner_1")!;
    expect(nailer.position.zIn).toBeCloseTo(2.25, 9);
    expect(corner.position.zIn).toBeCloseTo(0.75, 9);
    expect(nailer.actualDimsIn.lengthIn).toBeCloseTo(corner.actualDimsIn.lengthIn - 3, 9);
  });

  it("one on each wythe, so both faces have something to nail to", () => {
    const members = buildStandardPanelMembers(48, DEPTH_IN, HEIGHT_IN, false);
    const ext = members.find((m) => m.memberId === "stud_centre_1_exterior")!;
    const int = members.find((m) => m.memberId === "stud_centre_1_interior")!;
    expect(ext.position.yIn).toBe(0);
    expect(int.position.yIn).toBeCloseTo(DEPTH_IN - 3.5, 9);
    expect(ext.position.xIn).toBeCloseTo(int.position.xIn, 9);
  });
});
