import { describe, expect, it } from "vitest";
import {
  buildCrossTiltPanelMembers,
  crossTiltMinimumLowHeightIn,
  crossTiltTopPlateStock,
} from "./crossTiltPanelMembers";
import { buildGablePanelMembers } from "./gablePanelMembers";

const W = 48;
const D = 15.5;

describe("⚠ a panel tilted FRONT TO BACK, not left to right", () => {
  it("the two faces are different heights; the two sides are not", () => {
    /* This is the whole difference from a Gable End Panel. A gable's top
       slopes along its WIDTH — stand in front and it runs uphill left to
       right. This one's slopes through its DEPTH, and in elevation it looks
       level. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    expect(built.refusal).toBeNull();

    const studs = built.members.filter((m) => m.memberId.startsWith("cross_tilt_stud_"));
    const ext = studs.filter((m) => m.memberId.includes("exterior"));
    const int = studs.filter((m) => m.memberId.includes("interior"));

    // Both exterior studs match each other, as do both interior ones...
    expect(new Set(ext.map((m) => m.actualDimsIn.lengthIn)).size).toBe(1);
    expect(new Set(int.map((m) => m.actualDimsIn.lengthIn)).size).toBe(1);
    /* ⚠ ...and the EXTERIOR pair is taller, because the top FALLS inward.
       This row stands on the tall wall of a shed — the wall under the roof's
       HIGH edge — and the roof descends from there to the low wall. This
       assertion read the other way until 2026-11-01, and so did the
       geometry: a top plate pitched against its own roof. */
    expect(ext[0]!.actualDimsIn.lengthIn).toBeGreaterThan(int[0]!.actualDimsIn.lengthIn);
    /* The gap between them is the slope over the distance between the two
       wythes' own HIGH edges, which are y = 0 and y = D - 3.5 apart. */
    expect(ext[0]!.actualDimsIn.lengthIn - int[0]!.actualDimsIn.lengthIn).toBeCloseTo(((D - 3.5) * 4) / 12, 9);
  });

  it("⚠ a gable panel does the opposite, which is why this is a new type", () => {
    /* Proof the existing type cannot express it: a gable's own two heights
       are its LEFT and RIGHT edges. */
    const gable = buildGablePanelMembers(W, D, 48, 72, false);
    const gableStuds = gable.filter((m) => m.role === "stud");
    expect(gableStuds.length).toBeGreaterThan(0);
    // Its studs vary across the width; the tilted panel's vary through depth.
    const byX = new Map<number, number>();
    for (const s of gableStuds) byX.set(s.position.xIn, s.actualDimsIn.lengthIn);
    expect(new Set(byX.values()).size).toBeGreaterThan(1);
  });

  it("the rise follows the roof's own pitch over the panel's depth", () => {
    // 15.5in of depth at 4:12 rises 5.167in.
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    expect(built.highHeightIn).toBeCloseTo(96 + (15.5 * 4) / 12, 9);
    expect(built.tiltDeg).toBeCloseTo((Math.atan2((15.5 * 4) / 12, 15.5) * 180) / Math.PI, 9);
    // Which is the roof's own angle, as it has to be to land flush.
    expect(built.tiltDeg).toBeCloseTo((Math.atan2(4, 12) * 180) / Math.PI, 9);
  });

  it("⚠ the top is ONE inclined plane and every member is ripped to it", () => {
    /* "We can do one incline surface per panel in the table." A single
       angled face, not a stepped approximation — so the top skin, both top
       plates and every stud top lie in the same plane. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    const cos = 12 / Math.hypot(12, 4);
    /* ⚠ 96in is the INTERIOR face, the low one, so the plane climbs as it
       comes back OUT toward y = 0. */
    const topAt = (yIn: number) => 96 + ((D - yIn) * 4) / 12;

    const skin = built.members.find((m) => m.memberId === "cross_tilt_top_skin")!;
    /* The skin is cut to the SLOPED depth, longer than the panel is deep —
       the number the shop cuts to. */
    expect(skin.actualDimsIn.widthIn).toBeCloseTo(D / cos, 9);
    expect(skin.actualDimsIn.widthIn).toBeGreaterThan(D);
    /* Its upper face IS the plane, at both ends of the depth. */
    const skinCorners = skin.position.sectionCornersIn!;
    expect(skinCorners.find((c) => c.yIn === 0)!.zIn).toBeCloseTo(topAt(0), 9);
    expect(skinCorners.find((c) => c.yIn === D)!.zIn).toBeCloseTo(topAt(D), 9);

    /* ⚠ Both top plates sit UNDER that skin, lying FLAT on the studs with
       one edge RIPPED AWAY — his 2026-11-01 note with the SketchUp
       screenshots: *"Both 2x4s on top plate have an edge ripped off of
       them."* So the underside is level and the slope is in the top face.
       They used to be whole 2x4s tilted bodily into the incline, which is a
       different part and the reason this panel could not hold its own
       layers. */
    for (const face of ["exterior", "interior"]) {
      const plate = built.members.find((m) => m.memberId === `cross_tilt_top_plate_${face}`)!;
      const [a, b, c, d] = plate.position.sectionCornersIn!;
      // The two bottom corners share one height: the underside is LEVEL.
      expect(a!.zIn).toBeCloseTo(b!.zIn, 9);
      /* The two top corners do not: the rip carries the slope. ⚠ `d` is
         the corner at y0, the OUTER edge of the pair, and it is the HIGH one
         because the top falls inward. Reversed with the tilt on 2026-11-01. */
      expect(d!.zIn).toBeGreaterThan(c!.zIn);
      // And both top corners land on the skin's underside, one plane.
      const skinUnderAt = (yIn: number) => topAt(yIn) - 0.75 / cos;
      expect(d!.zIn).toBeCloseTo(skinUnderAt(d!.yIn), 9);
      expect(c!.zIn).toBeCloseTo(skinUnderAt(c!.yIn), 9);
      expect(plate.notes).toContain("lying FLAT on the studs");
    }

    /* And every stud is one plain square-cut length, because the plate took
       the slope. */
    const studs = built.members.filter((m) => m.role === "stud");
    expect(studs.length).toBeGreaterThan(0);
    for (const stud of studs) {
      expect({ id: stud.memberId, shaped: stud.position.sectionCornersIn !== undefined }).toEqual({
        id: stud.memberId,
        shaped: false,
      });
    }
  });

  it("⚠ the rip is SPECCED, because a shop has to set a saw to it", () => {
    /* > *"(that cut should be specced out in the shop fab pages)"* — Tommy,
       2026-11-01. Over the plate's own 3 1/2in the roof climbs `3.5 x tan`,
       and that is what comes off a 1 1/2in board. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    expect(built.topPlateRip.removedIn).toBeCloseTo(3.5 * (4 / 12), 9);
    expect(built.topPlateRip.thinEdgeIn).toBeCloseTo(1.5 - 3.5 * (4 / 12), 9);
    expect(built.topPlateRip.thickEdgeIn).toBe(1.5);
    expect(built.topPlateRip.angleDeg).toBeCloseTo(built.tiltDeg, 9);
    // The thin edge plus what came off is the stock it was cut from.
    expect(built.topPlateRip.thinEdgeIn + built.topPlateRip.removedIn).toBeCloseTo(1.5, 9);
    // And the cut list says so in words.
    const plate = built.members.find((m) => m.memberId === "cross_tilt_top_plate_exterior")!;
    expect(plate.notes).toContain("rip");
    expect(plate.notes).toContain("Square cut both ends");
  });

  it("⚠ the panel refuses a low edge too short to hold its own layers", () => {
    /* THE B8 FIX, as a rule rather than a pinned overlap. The row was built
       at a flat 3 1/2in — this app's own stand-in — and at 4:12 the panel
       needs 3.374in of bottom skin, bottom plate, ripped edge and top skin.
       It used to build anyway, with the exterior stud squeezed out and the
       two plates driven into each other: five real interferences. */
    for (const pitchIn12 of [1, 2, 3, 4, 5]) {
      const minIn = crossTiltMinimumLowHeightIn(pitchIn12);
      expect(buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: minIn - 0.01, pitchIn12 }).refusal)
        .toContain("cannot hold this panel's own layers");
      expect(buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: minIn, pitchIn12 }).refusal).toBeNull();
    }
    /* ⚠ Within one stock it goes UP as the roof gets FLATTER — less comes
       off the rip, so more board is left standing at the thin edge. The
       opposite of what you would guess. */
    expect(crossTiltMinimumLowHeightIn(2)).toBeGreaterThan(crossTiltMinimumLowHeightIn(4));
    /* ⚠ 6 7/8in at the default pitch, not 3 3/8in: Tommy, 2026-11-01, asked
       how much straight exterior face this row should have — *"tall enough
       for a real stud in both wythes."* The stack is the bottom skin, the
       bottom plate, a stud at least as long as it is wide, the rip's thin
       edge and the top skin. */
    expect(crossTiltMinimumLowHeightIn(4)).toBeCloseTo(6.874, 3);
    expect(crossTiltMinimumLowHeightIn(0)).toBeCloseTo(8.0, 9);
    /* ⚠ And it JUMPS where the stock changes, because a 4x4's thin edge is
       2in more board than a 2x4's at the same pitch. */
    expect(crossTiltMinimumLowHeightIn(6)).toBeGreaterThan(crossTiltMinimumLowHeightIn(5));
  });

  it("⚠ the top plate steps up to a 4x4 when the rip outgrows a 2x4", () => {
    /* > *"A 4x4 top plate."* — Tommy, 2026-11-01, asked what a shed steeper
       than about 5.1:12 should do. The rip takes `3 1/2in x pitch/12` out of
       the board's thickness; a 2x4 has 1 1/2in to give, a 4x4 has 3 1/2in. */
    expect(crossTiltTopPlateStock(4).nominalSize).toBe("2x4");
    expect(crossTiltTopPlateStock(5).nominalSize).toBe("2x4");
    expect(crossTiltTopPlateStock(6).nominalSize).toBe("4x4");
    expect(crossTiltTopPlateStock(12).nominalSize).toBe("4x4");

    const steep = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 8 });
    expect(steep.refusal).toBeNull();
    expect(steep.topPlateRip.nominalSize).toBe("4x4");
    expect(steep.topPlateRip.thickEdgeIn).toBe(3.5);
    const plate = steep.members.find((m) => m.memberId === "cross_tilt_top_plate_exterior")!;
    expect(plate.nominalSize).toBe("4x4");
    expect(plate.actualDimsIn.thicknessIn).toBe(3.5);

    /* ⚠ And even a 4x4 runs out: at 12:12 the rip takes its whole 3 1/2in.
       Past that this detail needs a different plate, which nobody has
       chosen, so it refuses rather than emitting a board of no thickness. */
    expect(buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 12 }).refusal)
      .toContain("needs a different plate");
  });

  it("⚠ BOTH wythes are framed now, not just the interior one", () => {
    /* The row used to be built at a 3 1/2in low edge, which left the
       exterior wythe about 1/8in of clear space — not a stud, so the roof's
       load reached the wall's outer wythe through plates and skins rather
       than through framing. */
    for (const pitchIn12 of [2, 3, 4, 5, 6, 8]) {
      const low = crossTiltMinimumLowHeightIn(pitchIn12);
      const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: low, pitchIn12 });
      expect({ pitchIn12, refusal: built.refusal }).toEqual({ pitchIn12, refusal: null });
      const studs = built.members.filter((m) => m.role === "stud");
      const ext = studs.filter((m) => m.memberId.includes("exterior"));
      const int = studs.filter((m) => m.memberId.includes("interior"));
      expect({ pitchIn12, ext: ext.length > 0, int: int.length > 0 }).toEqual({ pitchIn12, ext: true, int: true });
      /* Every stud is at least as long as it is wide, which is the rule that
         makes it a stud rather than blocking. */
      for (const stud of studs) expect(stud.actualDimsIn.lengthIn).toBeGreaterThanOrEqual(3.5 - 1e-9);
    }
  });

  it("⚠ it is a REAL panel now, not the six pieces it was", () => {
    /* Tommy, 2026-10-31: "it appears as though the shed roof sloped
       determining inclined panels are not spawning, though there are a few
       pieces of wood hanging around where they should be." The few pieces
       WERE the panel. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    /* A 4ft panel: two skins, two bottom plates, two top plates, and two
       rows of three studs — twelve, against the six it had.

       ⚠ **Plus its girts since 2026-11-12.** A 96in panel's shorter wythe has
       about 92in of stud, which is two rows under his "3ft or less" rule, and
       a row is three members (a bar at each wythe plus the web). So eighteen.
       Spelled out as a sum rather than bumped to a new literal: the point of
       this test is still that the panel is a PANEL and not a handful of
       sticks, and the girts are part of that now. */
    const girtCount = built.members.filter((m) => /girt/i.test(m.memberId)).length;
    expect(girtCount).toBe(2 * 3);
    expect(built.members).toHaveLength(12 + girtCount);
    expect(built.members.some((m) => m.memberId === "cross_tilt_bottom_skin")).toBe(true);
    expect(built.members.some((m) => m.memberId === "cross_tilt_top_skin")).toBe(true);
    expect(built.members.filter((m) => m.role === "plate")).toHaveLength(4);
    /* Studs in two rows, and INTERMEDIATE ones, so no bay runs more than
       24in — the old panel had nothing between its four corners. */
    const studs = built.members.filter((m) => m.role === "stud");
    expect(studs).toHaveLength(6);
    const xs = [...new Set(studs.map((m) => m.position.xIn))].sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeLessThanOrEqual(24 + 1e-9);
    /* A wider panel gets more of them rather than longer bays. */
    const wide = buildCrossTiltPanelMembers({ widthIn: 96, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    expect(wide.members.filter((m) => m.role === "stud").length).toBeGreaterThan(studs.length);
  });

  it("⚠ the tilt is carried in the DEPTH plane, not the width plane", () => {
    /* The bug that made it look like loose pieces: `tiltDeg` is applied by
       both the renderer and the exporter in the panel's WIDTH/HEIGHT plane,
       which is the one plane this panel's tilt is NOT in, so its one sloped
       board came out swung sideways. Nothing here may carry it. */
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 4 });
    for (const m of built.members) {
      expect({ id: m.memberId, tilt: m.position.tiltDeg }).toEqual({ id: m.memberId, tilt: undefined });
    }
    expect(built.members.some((m) => m.position.sectionCornersIn)).toBe(true);
  });

  it("a flat roof tilts it not at all, and the faces match", () => {
    const built = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 0 });
    expect(built.tiltDeg).toBe(0);
    expect(built.highHeightIn).toBe(96);
    const studs = built.members.filter((m) => m.memberId.startsWith("cross_tilt_stud_"));
    expect(new Set(studs.map((m) => m.actualDimsIn.lengthIn)).size).toBe(1);
  });

  it("a steeper roof tilts it more", () => {
    /* ⚠ 2:12 against 5:12, not 12:12. Past about 5.1:12 the top plate's rip
       takes more than a 2x4 has and the panel refuses outright — see the
       deeper-board test above. */
    const shallow = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 2 });
    const steep = buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: 5 });
    expect(steep.tiltDeg).toBeGreaterThan(shallow.tiltDeg);
    expect(steep.highHeightIn).toBeGreaterThan(shallow.highHeightIn);
  });

  it("⚠ has GIRTS, which it had none of until 2026-11-12", () => {
    /* > *"the north wall panels do not appear to have [girts]. They should
       > have [girts] just like every other panel."* — Tommy, 2026-11-12

       He was looking at a Tiny House with a 5ft shed, where this row comes
       out 58 7/8in tall at the exterior face — a FIVE FOOT panel whose whole
       cut list was four plates, four studs and two lids. No threshold was
       rejecting girts and no rule forbade them: the builder never called for
       any, while the sheet printed its weight as "Wood (studs/plates/girts)".

       One row at a 58 7/8in panel, by his own rule — one girt for every 3ft
       or less of unbraced span. A girt row is three members: a bar at each
       wythe and the web between them. */
    const built = buildCrossTiltPanelMembers({ widthIn: 24, depthIn: D, lowHeightIn: 58.875, pitchIn12: 4 });
    expect(built.refusal).toBeNull();
    const girts = built.members.filter((m) => /girt/i.test(m.memberId));
    expect(girts).toHaveLength(3);
    /* Mid-panel, inside the SHORTER wythe's studs — see below. */
    for (const g of girts) {
      expect({ id: g.memberId, aboveTheBottomPlate: g.position.zIn > 2.25 }).toEqual({ id: g.memberId, aboveTheBottomPlate: true });
      expect({ id: g.memberId, belowTheShortStudTop: g.position.zIn < 58.875 - 2.25 }).toEqual({ id: g.memberId, belowTheShortStudTop: true });
    }
    /* Every width this row is cut at gets the same treatment — the end
       panels at the wall's own depth included. */
    for (const widthIn of [15.5, 17, 24]) {
      const b = buildCrossTiltPanelMembers({ widthIn, depthIn: D, lowHeightIn: 58.875, pitchIn12: 4 });
      expect({ widthIn, girts: b.members.filter((m) => /girt/i.test(m.memberId)).length }).toEqual({ widthIn, girts: 3 });
    }
  });

  it("⚠ and a row too short to need one still gets none", () => {
    /* The rule protects itself: his "3ft or less" gives zero rows on a short
       panel, which is what the 3 1/2in minimum row wants. No separate floor,
       no second rule to keep in step. */
    const short = buildCrossTiltPanelMembers({ widthIn: 24, depthIn: D, lowHeightIn: 20, pitchIn12: 4 });
    expect(short.refusal).toBeNull();
    expect(short.members.filter((m) => /girt/i.test(m.memberId))).toHaveLength(0);
  });

  it("⚠ the girt fits inside the SHORTER wythe's studs, not the longer one's", () => {
    /* The top plate carries the incline through the panel's DEPTH, so the two
       rows of studs are different lengths. A row spaced on the longer one
       would sit above the shorter one's own top plate — out of the panel on
       that face. Same reasoning as a gable panel's girts, which spread across
       its short edge for the same reason.

       Checked at a steep pitch, where the two faces differ most. */
    const built = buildCrossTiltPanelMembers({ widthIn: 24, depthIn: D, lowHeightIn: 80, pitchIn12: 5 });
    expect(built.refusal).toBeNull();
    const studTops = built.members
      .filter((m) => /cross_tilt_stud_/.test(m.memberId))
      .map((m) => m.position.zIn + m.actualDimsIn.lengthIn);
    const shortestStudTopIn = Math.min(...studTops);
    for (const g of built.members.filter((m) => /girt/i.test(m.memberId))) {
      expect({ id: g.memberId, insideShortestStud: g.position.zIn < shortestStudTopIn }).toEqual({
        id: g.memberId,
        insideShortestStud: true,
      });
    }
  });

  it("refuses what it cannot build", () => {
    expect(buildCrossTiltPanelMembers({ widthIn: 0, depthIn: D, lowHeightIn: 96, pitchIn12: 4 }).refusal).toContain("width");
    expect(buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 0, pitchIn12: 4 }).refusal).toContain("low side");
    expect(buildCrossTiltPanelMembers({ widthIn: W, depthIn: D, lowHeightIn: 96, pitchIn12: Number.NaN }).refusal).toContain("pitch");
  });
});
