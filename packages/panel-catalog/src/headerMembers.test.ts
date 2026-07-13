import { describe, expect, it } from "vitest";
import {
  buildDoorHeaderMembers,
  buildDoorHeaderSchema,
  buildWindowHeaderMembers,
  buildWindowHeaderSchema,
  headerWebRiseIn,
} from "./headerMembers";
import { computeTrussWebPeakCount, memberBoxSizeIn } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;

describe("buildDoorHeaderMembers", () => {
  const WIDTH_IN = 36;
  const HEIGHT_IN = 18; // rise ~13.5in (2x4 chords + plywood caps eat into it), half-width 18 -> forced to 1 peak regardless

  it("has 4 chords (top/bottom x ext/int) plus 2 plywood plate caps, chords each spanning the full width", () => {
    const members = buildDoorHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const chords = members.filter((m) => m.role === "plate");
    expect(chords).toHaveLength(4);
    for (const c of chords) expect(c.actualDimsIn.lengthIn).toBeCloseTo(WIDTH_IN, 6);

    const plyCaps = members.filter((m) => m.role === "skin");
    expect(plyCaps).toHaveLength(2); // bottom_chord_ply + top_chord_ply
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
  it("uses more peaks for a wide window than a narrow one, at the same height", () => {
    const narrow = buildWindowHeaderMembers(30, DEPTH_IN, 18);
    const wide = buildWindowHeaderMembers(240, DEPTH_IN, 18);
    const narrowPeaks = narrow.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise")).length;
    const widePeaks = wide.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise")).length;
    expect(widePeaks).toBeGreaterThan(narrowPeaks);
  });

  it("matches computeTrussWebPeakCount's own prediction", () => {
    const widthIn = 96;
    const heightIn = 14;
    const expectedPeaks = computeTrussWebPeakCount(widthIn, headerWebRiseIn(heightIn));
    const members = buildWindowHeaderMembers(widthIn, DEPTH_IN, heightIn);
    const extRises = members.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise"));
    expect(extRises).toHaveLength(expectedPeaks);
  });
});

describe("header chord plywood caps", () => {
  const WIDTH_IN = 60;
  const HEIGHT_IN = 20;

  it("the web braces bear against the plywood caps' faces, not the bare 2x4 chord faces", () => {
    const members = buildWindowHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const bottomChord = members.find((m) => m.memberId === "bottom_chord_2x4_ext")!;
    const bottomPly = members.find((m) => m.memberId === "bottom_chord_ply")!;
    const firstRiseExt = members.find((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("1_rise"))!;

    const bottomChordTopZ = bottomChord.position.zIn + bottomChord.actualDimsIn.thicknessIn;
    const bottomPlyTopZ = bottomPly.position.zIn + bottomPly.actualDimsIn.thicknessIn;
    expect(bottomPly.position.zIn).toBeCloseTo(bottomChordTopZ, 6); // ply sits right on top of the chord
    expect(bottomPlyTopZ).toBeGreaterThan(bottomChordTopZ); // ply's own top face is further up

    // Reconstruct both real endpoints of the tilted brace (same method as bracedPanelMembers.test.ts).
    const size = memberBoxSizeIn(firstRiseExt);
    const tiltRad = (firstRiseExt.position.tiltDeg! * Math.PI) / 180;
    const halfLen = size.zIn / 2;
    const endpointZs = [firstRiseExt.position.zIn + Math.cos(tiltRad) * halfLen, firstRiseExt.position.zIn - Math.cos(tiltRad) * halfLen];
    const lowFootZ = Math.min(...endpointZs);
    expect(lowFootZ).toBeCloseTo(bottomPlyTopZ, 6); // the web's low foot bears on the plywood's top face, not the bare chord
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
});
