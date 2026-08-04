import { describe, expect, it } from "vitest";
import {
  buildDoorHeaderMembers,
  buildDoorHeaderSchema,
  buildWindowHeaderMembers,
  buildWindowHeaderSchema,
} from "./headerMembers";
import { memberBoxSizeIn, SKIN_THICKNESS_IN } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;

describe("buildDoorHeaderMembers", () => {
  const WIDTH_IN = 36;
  const HEIGHT_IN = 18; // rise ~13.5in (2x4 chords + plywood caps eat into it), half-width 18 -> forced to 1 peak regardless

  it("has 4 chords (top/bottom x ext/int) plus 2 plywood plate caps, chords each spanning the full width", () => {
    const members = buildDoorHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const chords = members.filter((m) => m.role === "plate");
    expect(chords).toHaveLength(4);
    for (const c of chords) expect(c.actualDimsIn.lengthIn).toBeCloseTo(WIDTH_IN, 6);

    const plyCaps = members.filter((m) => m.role === "skin" && (m.memberId === "bottom_chord_ply" || m.memberId === "top_chord_ply"));
    expect(plyCaps).toHaveLength(2); // bottom_chord_ply + top_chord_ply (the header also has its own ext/int side skins — see the dedicated describe block below)
    for (const p of plyCaps) {
      expect(p.material).toBe("plywood");
      expect(p.actualDimsIn.widthIn).toBeCloseTo(DEPTH_IN, 6); // spans the full depth, bridging both wythes
      expect(p.actualDimsIn.lengthIn).toBeCloseTo(WIDTH_IN, 6);
    }
  });

  it("always has exactly 1 peak (one upside-down V) regardless of proportions, on both wythes", () => {
    const members = buildDoorHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const braces = members.filter((m) => m.role === "brace");
    expect(braces).toHaveLength(4); // 1 peak x (rise+fall) x (ext+int)
    const ext = braces.filter((m) => m.memberId.includes("_ext_"));
    const int = braces.filter((m) => m.memberId.includes("_int_"));
    expect(ext).toHaveLength(2);
    expect(int).toHaveLength(2);
  });

  it("still gives exactly 1 peak even for a very wide door opening", () => {
    const members = buildDoorHeaderMembers(200, DEPTH_IN, HEIGHT_IN);
    expect(members.filter((m) => m.role === "brace")).toHaveLength(4);
  });

  it("sizes every member correctly via the shared axis mapping", () => {
    for (const m of buildDoorHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN)) {
      const size = memberBoxSizeIn(m);
      expect(size.xIn).toBeGreaterThan(0);
      expect(size.yIn).toBeGreaterThan(0);
      expect(size.zIn).toBeGreaterThan(0);
    }
  });
});

describe("buildWindowHeaderMembers", () => {
  it("always has exactly 1 peak regardless of width, on both wythes — same cap as a door header now (Tommy: 'cap every header at 1 V, auto-upgrade past that')", () => {
    const narrow = buildWindowHeaderMembers(30, DEPTH_IN, 18);
    const wide = buildWindowHeaderMembers(240, DEPTH_IN, 18);
    const narrowPeaks = narrow.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise")).length;
    const widePeaks = wide.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise")).length;
    expect(narrowPeaks).toBe(1);
    expect(widePeaks).toBe(1);
  });

  it("still gives exactly 1 peak even for a very wide window opening", () => {
    const members = buildWindowHeaderMembers(240, DEPTH_IN, 14);
    expect(members.filter((m) => m.role === "brace")).toHaveLength(4); // 1 peak x (rise+fall) x (ext+int)
  });
});

describe("header chord plywood caps", () => {
  const WIDTH_IN = 60;
  const HEIGHT_IN = 20;

  it("the plywood cap is the header's own OUTER face (bottom: z=0; top: flush with the header's own top) — Tommy: plywood on top/bottom, 2x4s facing the middle", () => {
    const members = buildWindowHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const bottomChord = members.find((m) => m.memberId === "bottom_chord_2x4_ext")!;
    const bottomPly = members.find((m) => m.memberId === "bottom_chord_ply")!;
    const topChord = members.find((m) => m.memberId === "top_chord_2x4_ext")!;
    const topPly = members.find((m) => m.memberId === "top_chord_ply")!;

    expect(bottomPly.position.zIn).toBeCloseTo(0, 6); // bottom ply is the header's own bottom face
    const bottomPlyTopZ = bottomPly.position.zIn + bottomPly.actualDimsIn.thicknessIn;
    expect(bottomChord.position.zIn).toBeCloseTo(bottomPlyTopZ, 6); // 2x4 sits right above the ply, facing the cavity

    const topPlyTopZ = topPly.position.zIn + topPly.actualDimsIn.thicknessIn;
    expect(topPlyTopZ).toBeCloseTo(HEIGHT_IN, 6); // top ply is the header's own top face
    const topChordTopZ = topChord.position.zIn + topChord.actualDimsIn.thicknessIn;
    expect(topChordTopZ).toBeCloseTo(topPly.position.zIn, 6); // 2x4 sits right below the ply, facing the cavity
  });

  it("the web braces bear against the 2x4 chords' own inner faces (not the plywood, which is now the outer skin)", () => {
    const members = buildWindowHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const bottomChord = members.find((m) => m.memberId === "bottom_chord_2x4_ext")!;
    const firstRiseExt = members.find((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("1_rise"))!;

    const bottomChordTopZ = bottomChord.position.zIn + bottomChord.actualDimsIn.thicknessIn;

    // A header brace is a true trapezoid, not a plain symmetric box — its
    // own longest edge (actualDimsIn.lengthIn, "long point to long point")
    // is generally LONGER than the raw centerline span once a real bevel
    // cut is involved, so reconstructing endpoints from
    // position.zIn +- cos(tiltDeg)*lengthIn/2 (a plain-box assumption) is
    // only ever approximate here. Its real corners (trapezoidCornersIn)
    // are the ground truth instead — same source the 2D diagram/3D
    // view/OBJ export all render from.
    const lowFootZ = Math.min(...firstRiseExt.position.trapezoidCornersIn!.map((c) => c.zIn));
    expect(lowFootZ).toBeCloseTo(bottomChordTopZ, 6); // the web's low foot bears on the 2x4 chord's own top face
  });
});

describe("header end caps (Tommy: 'plywood on the panel thickness side, not the interior and exterior faces' — confirmed against the SketchUp reference render: solid end, open/braced front)", () => {
  const WIDTH_IN = 60;
  const DEPTH_IN_LOCAL = DEPTH_IN;
  const HEIGHT_IN = 20;

  it("has a left_end_ply and right_end_ply spanning the full depth x full height, thin in width", () => {
    for (const members of [
      buildWindowHeaderMembers(WIDTH_IN, DEPTH_IN_LOCAL, HEIGHT_IN),
      buildDoorHeaderMembers(WIDTH_IN, DEPTH_IN_LOCAL, HEIGHT_IN),
    ]) {
      const leftCap = members.find((m) => m.memberId === "left_end_ply")!;
      const rightCap = members.find((m) => m.memberId === "right_end_ply")!;
      expect(leftCap).toBeDefined();
      expect(rightCap).toBeDefined();
      expect(leftCap.role).toBe("skin");
      expect(leftCap.material).toBe("plywood");

      const leftSize = memberBoxSizeIn(leftCap);
      expect(leftSize.yIn).toBeCloseTo(DEPTH_IN_LOCAL, 6);
      expect(leftSize.zIn).toBeCloseTo(HEIGHT_IN, 6);
      expect(leftSize.xIn).toBeCloseTo(SKIN_THICKNESS_IN, 6);

      expect(leftCap.position.xIn).toBeCloseTo(0, 6);
      expect(rightCap.position.xIn).toBeCloseTo(WIDTH_IN - SKIN_THICKNESS_IN, 6);
    }
  });

  it("does not add a skin on the ext/int (Y=0/Y=depthIn) faces — those stay open, showing the truss web directly", () => {
    const members = buildWindowHeaderMembers(WIDTH_IN, DEPTH_IN_LOCAL, HEIGHT_IN);
    const skins = members.filter((m) => m.role === "skin");
    // Exactly 4: bottom_chord_ply, top_chord_ply, left_end_ply, right_end_ply — no ext/int face skin.
    expect(skins).toHaveLength(4);
    expect(skins.some((m) => m.memberId.includes("side_ply"))).toBe(false);
  });
});

describe("buildDoorHeaderSchema / buildWindowHeaderSchema", () => {
  it("wraps door header members with a distinct id/displayName", () => {
    const schema = buildDoorHeaderSchema(36, DEPTH_IN, 18);
    expect(schema.id).toBe("door_header");
    expect(schema.members.length).toBeGreaterThan(0);
  });

  it("wraps window header members with a distinct id/displayName and a peak-count note", () => {
    const schema = buildWindowHeaderSchema(96, DEPTH_IN, 14);
    expect(schema.id).toBe("window_header");
    expect(schema.members.length).toBeGreaterThan(0);
    expect(schema.notes.some((n) => n.text.includes("truss web peak"))).toBe(true);
  });

  it("flags a warning when the resulting brace angle falls outside 30-45deg", () => {
    // A very short, wide door header — even 1 peak will be far too shallow.
    const schema = buildDoorHeaderSchema(400, DEPTH_IN, 5);
    expect(schema.notes.some((n) => n.type === "warning" && n.text.includes("outside the target"))).toBe(true);
  });

  it("reports a real bevel-cut angle for the truss web braces' ends", () => {
    // 36in wide, 22.5in tall -> rise 18in (heightIn - 2*1.5 - 2*0.75), half-width 18 -> 45deg tilt.
    const schema = buildDoorHeaderSchema(36, DEPTH_IN, 22.5);
    expect(schema.notes.some((n) => n.type === "deviation" && n.text.includes("45.0deg off vertical"))).toBe(true);
  });
});
