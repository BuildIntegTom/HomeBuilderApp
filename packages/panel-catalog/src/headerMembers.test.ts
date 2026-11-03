import { describe, expect, it } from "vitest";
import {
  buildDoorHeaderMembers,
  buildDoorHeaderSchema,
  buildWindowHeaderMembers,
  headerWebRiseIn,
  headerPeakCount,
  headerWebAngleDeg,
  buildWindowHeaderSchema,
  HEADER_MAX_ANGLE_DEG,
} from "./headerMembers";
import { computeTrussWebPeakCount, memberBoxSizeIn, SKIN_THICKNESS_IN, TRUSS_WEB_MIN_ANGLE_DEG } from "./panelMemberHelpers";

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

  it("gives an ordinary door the one upside-down V, on both wythes", () => {
    /* His original rule - "door headers just have one upside down V as a
       brace" - is still what an ordinary door gets. It is a CONSEQUENCE of
       the peak rule now rather than a cap carved out of it (2026-11-03). */
    const members = buildDoorHeaderMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN);
    const braces = members.filter((m) => m.role === "brace");
    expect(braces).toHaveLength(4); // 1 peak x (rise+fall) x (ext+int)
    expect(braces.filter((m) => m.memberId.includes("_ext_"))).toHaveLength(2);
    expect(braces.filter((m) => m.memberId.includes("_int_"))).toHaveLength(2);
    // ...and it is 1 because the rule says 1 here, not because it was forced.
    expect(headerPeakCount(WIDTH_IN, HEIGHT_IN)).toBe(1);
  });

  it("⚠ a very wide door gets MORE peaks rather than one shallow one", () => {
    /* > "Headers can have more than one peak." - Tommy, 2026-11-03

       This asserted 4 braces - one peak, however wide the opening - until the
       cap was retired. A 200in opening under an 18in header would have left
       its single web at 7.7deg, a quarter of the 30deg floor. */
    const peaks = headerPeakCount(200, HEIGHT_IN);
    expect(peaks).toBeGreaterThan(1);
    expect(buildDoorHeaderMembers(200, DEPTH_IN, HEIGHT_IN).filter((m) => m.role === "brace")).toHaveLength(peaks * 4);
    expect(headerWebAngleDeg(200, HEIGHT_IN)).toBeGreaterThanOrEqual(TRUSS_WEB_MIN_ANGLE_DEG);
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
  it("⚠ takes as many peaks as the width needs, where it used to take exactly 1", () => {
    /* > "Headers can have more than one peak. Big headers and window headers
       >  are really the same thing." - Tommy, 2026-11-03

       The narrow one is still a single V; the wide one is not, and that is
       the whole change. Counting RISE braces on the exterior wythe counts
       peaks exactly. */
    const peaksOf = (members: ReturnType<typeof buildWindowHeaderMembers>) =>
      members.filter((m) => m.role === "brace" && m.memberId.includes("_ext_") && m.memberId.includes("_rise")).length;
    expect(peaksOf(buildWindowHeaderMembers(30, DEPTH_IN, 18))).toBe(1);
    expect(peaksOf(buildWindowHeaderMembers(240, DEPTH_IN, 18))).toBeGreaterThan(1);
  });

  it("⚠ every web segment clears the 30deg floor, at any width", () => {
    /* The point of adding peaks. Swept rather than spot-checked, because the
       floor is the one half of his 30-45 that still binds. */
    for (const widthIn of [24, 30, 36, 48, 60, 72, 96, 120, 180, 240]) {
      for (const heightIn of [10, 14, 18, 24, 40]) {
        const angle = headerWebAngleDeg(widthIn, heightIn);
        expect(angle, `${widthIn}x${heightIn}`).toBeGreaterThanOrEqual(TRUSS_WEB_MIN_ANGLE_DEG);
      }
    }
  });

  it("⚠ a DEEP header stays steep, and no peak count can fix that", () => {
    /* The measurement behind dropping the 45deg ceiling: the app's own
       defaults (120in wall, 32in sill, 48in RO) leave a 40in-deep header whose
       web runs past 45deg. Adding peaks makes a web steeper, never shallower,
       so this is built and reported rather than refused. */
    const angle = headerWebAngleDeg(48, 40);
    expect(angle).toBeGreaterThan(HEADER_MAX_ANGLE_DEG);
    expect(headerPeakCount(48, 40)).toBe(1);
    expect(buildWindowHeaderMembers(48, DEPTH_IN, 40).filter((m) => m.role === "brace")).toHaveLength(4);
  });

  it("builds the same web a Big Header does, which is the point of 'the same thing'", () => {
    for (const [widthIn, heightIn] of [[96, 24], [144, 30], [48, 24]] as const) {
      expect(headerPeakCount(widthIn, heightIn), `${widthIn}x${heightIn}`).toBe(
        computeTrussWebPeakCount(widthIn, headerWebRiseIn(heightIn)),
      );
    }
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

describe("⚠ the header's ends are 2x4 STUDS, not plywood sheets", () => {
  const WIDTH_IN = 60;
  const DEPTH_IN_LOCAL = DEPTH_IN;
  const HEIGHT_IN = 20;

  /* > *"The 3/4\" plywood skins on the side I don't think are necessary, and
     > should be replaced with regular 2x4 studs vertically like a standard
     > panel. This may bring that tip and angle of the diagonal towards the
     > center of the header panel a little bit."* — Tommy, 2026-11-01

     The sheets were a full-depth x full-height plywood cap at each X extreme,
     carried with a note calling their corner collisions *"an illustrative
     simplification"*. They were this panel's whole interference count: 12
     overlaps on each header type, now **zero**. */

  it("⚠ frames each end like a standard panel: a stud per wythe, between the chords", () => {
    for (const members of [
      buildWindowHeaderMembers(WIDTH_IN, DEPTH_IN_LOCAL, HEIGHT_IN),
      buildDoorHeaderMembers(WIDTH_IN, DEPTH_IN_LOCAL, HEIGHT_IN),
    ]) {
      expect(members.some((m) => m.memberId.endsWith("_end_ply"))).toBe(false);
      const studs = members.filter((m) => m.role === "stud");
      expect(studs.map((m) => m.memberId).sort()).toEqual([
        "left_end_stud_ext",
        "left_end_stud_int",
        "right_end_stud_ext",
        "right_end_stud_int",
      ]);
      for (const stud of studs) {
        expect(stud.material).toBe("dimensional_lumber");
        expect(stud.nominalSize).toBe("2x4");
        // Standing BETWEEN the chords, which is what keeps it clear of them.
        expect(stud.position.zIn).toBeCloseTo(SKIN_THICKNESS_IN + 1.5, 9);
        expect(stud.actualDimsIn.lengthIn).toBeCloseTo(headerWebRiseIn(HEIGHT_IN), 9);
      }
      const left = studs.filter((m) => m.memberId.startsWith("left_"));
      const right = studs.filter((m) => m.memberId.startsWith("right_"));
      for (const m of left) expect(m.position.xIn).toBeCloseTo(0, 9);
      for (const m of right) expect(m.position.xIn).toBeCloseTo(WIDTH_IN - 1.5, 9);
      // One in each wythe, like a standard panel's edge.
      expect(new Set(studs.map((m) => m.position.yIn)).size).toBe(2);
    }
  });

  it("⚠ the diagonal's foot moves inboard with them, exactly as he predicted", () => {
    /* It used to stop at the 3/4in sheet's inner face; it stops at the
       1 1/2in stud's now. *"This may bring that tip and angle of the diagonal
       towards the center of the header panel a little bit."* */
    const braces = buildWindowHeaderMembers(WIDTH_IN, DEPTH_IN_LOCAL, HEIGHT_IN).filter((m) => m.role === "brace");
    expect(braces.length).toBeGreaterThan(0);
    const xs = braces.flatMap((b) => b.position.trapezoidCornersIn!.map((c) => c.xIn));
    expect(Math.min(...xs)).toBeCloseTo(1.5, 9);
    expect(Math.max(...xs)).toBeCloseTo(WIDTH_IN - 1.5, 9);
  });

  it("the ext/int faces stay open, showing the truss web directly", () => {
    const members = buildWindowHeaderMembers(WIDTH_IN, DEPTH_IN_LOCAL, HEIGHT_IN);
    const skins = members.filter((m) => m.role === "skin");
    // The two chord caps and nothing else: no end sheet, no ext/int face skin.
    expect(skins.map((m) => m.memberId).sort()).toEqual(["bottom_chord_ply", "top_chord_ply"]);
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

  it("⚠ no longer flags a wide, shallow header — it adds peaks instead", () => {
    /* This asserted the opposite until 2026-11-03: a 400x5 door header was
       the canonical "outside 30-45deg" warning. Peaks solve it now, so the
       warning would be a lie. */
    const schema = buildDoorHeaderSchema(400, DEPTH_IN, 5);
    expect(schema.notes.some((n) => n.type === "warning")).toBe(false);
    expect(headerWebAngleDeg(400, 5)).toBeGreaterThanOrEqual(TRUSS_WEB_MIN_ANGLE_DEG);
  });

  it("⚠ DOES still report a header too deep for its width", () => {
    /* The one side peaks cannot fix, reported rather than corrected — and
       the reason the Big Header auto-upgrade could be deleted. */
    const schema = buildWindowHeaderSchema(48, DEPTH_IN, 40);
    const warning = schema.notes.find((n) => n.type === "warning");
    expect(warning).toBeDefined();
    expect(warning!.text).toMatch(/steeper than the 45deg/);
    expect(warning!.text).toMatch(/Reported, not auto-corrected/);
  });

  it("reports a real bevel-cut angle for the truss web braces' ends", () => {
    // 36in wide, 22.5in tall -> rise 18in (heightIn - 2*1.5 - 2*0.75), half-width 18 -> 45deg tilt.
    const schema = buildDoorHeaderSchema(36, DEPTH_IN, 22.5);
    expect(schema.notes.some((n) => n.type === "deviation" && n.text.includes("45.0deg off vertical"))).toBe(true);
  });
});
