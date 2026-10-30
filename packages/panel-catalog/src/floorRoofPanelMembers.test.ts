import { describe, expect, it } from "vitest";
import {
  ANTI_TWIST_SPACING_IN,
  lastTrueSheetSeamIn,
  FLOOR_ROOF_RUN_CLOSER_WIDTH_IN,
  JOIST_2X6_THICKNESS_IN,
  planFloorRoofPanelWidthsIn,
  firstPlywoodSheetWidthIn,
  roofCapGeometry,
  buildRoofPanelCapMembers,
  ROOF_CAP_SEAT_WIDTH_IN,
  buildFloorRoofPanelSchema,
  BLOCKING_SPACING_IN,
  FLOOR_ROOF_EDGE_PANEL_WIDTH_IN,
  FLOOR_ROOF_PANEL_WIDTH_IN,
  JOIST_2X6_WIDTH_IN,
  STRUCTURAL_GIRT_TOTAL_THICKNESS_IN,
  buildFloorRoofPanelMembers,
  type FloorRoofPanelOptions,
} from "./floorRoofPanelMembers";
import { PLATE_2X4_WIDTH_IN, memberBoxSizeIn, memberLocalCornersIn } from "./panelMemberHelpers";
import type { PanelMember } from "./componentSchema";
import { overlappingMemberPairs } from "./memberPrism";
import { computePanelCutList } from "./panelCutList";

const floor = (over: Partial<FloorRoofPanelOptions> = {}): FloorRoofPanelOptions => ({
  kind: "floor",
  widthIn: FLOOR_ROOF_PANEL_WIDTH_IN,
  depthIn: 15.5,
  lengthIn: 144,
  structuralGirtEnds: ["start"],
  ...over,
});

const idsLike = (members: ReturnType<typeof buildFloorRoofPanelMembers>, prefix: string) =>
  members.filter((m) => m.memberId.startsWith(prefix));

describe("⚠ the numbers he gave, as numbers", () => {
  it("⚠ 24in, and what replacing 19 1/4 with it bought", () => {
    /* The module started at 19 3/16 — five to the 8ft, so a seam lands under
       the sheathing's 19.2in black diamonds. It cost a closer panel, a
       trimmed first sheet, and drift that had to be reset every 8ft, and it
       never actually divided 8ft.

       Tommy, 2026-10-23, once the load path mattered more than the diamonds:
       *"floors default to 15.5in edge panels, 2' wide panels everywhere else
       with 4' wall panels with a center nailer, as default"*.

       24 divides 8ft exactly — four panels, no drift, no closer — and lines
       a floor seam up under every wall panel edge and every wall panel's
       centre nailer. */
    expect(FLOOR_ROOF_PANEL_WIDTH_IN).toBe(24);
    expect(96 % FLOOR_ROOF_PANEL_WIDTH_IN).toBe(0);
    expect(48 % FLOOR_ROOF_PANEL_WIDTH_IN).toBe(0);
  });

  it("⚠ there is no closer panel any more, and 0 says so", () => {
    /* It existed only to drag a 19 1/4 run back onto 96. Four 24s are 96, so
       there is nothing left for it to close. */
    expect(FLOOR_ROOF_RUN_CLOSER_WIDTH_IN).toBe(0);
    expect(4 * FLOOR_ROOF_PANEL_WIDTH_IN).toBe(96);
  });

  it("⚠ the first and last panel is as wide as the wall is thick", () => {
    /* *"The edge panels for floors and roofs still have to be 15.5in because
       thata the wall thickness."* It was 13.25 — 15.5 less a structural girt
       running along its length — until he settled that no such girt exists:
       *"The walls that sit overtop one span of a panel do not need more than
       the one structural girt at the end."* */
    expect(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN).toBe(15.5);
    expect(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN).not.toBe(15.5 - STRUCTURAL_GIRT_TOTAL_THICKNESS_IN);
  });

  it("blocking every 3ft, anti-twist girts every 5ft", () => {
    expect(BLOCKING_SPACING_IN).toBe(36);
    expect(ANTI_TWIST_SPACING_IN).toBe(60);
  });
});

describe("⚠ a joist is a PAIR, and the seams make it a double double", () => {
  it("one panel carries FOUR 2x6s — two joists of two", () => {
    /* The single easiest number here to get wrong by a factor of two, and the
       one the material list is built on. Tommy: "two joists together make a
       double and there's two 2x6s per joist". */
    const members = buildFloorRoofPanelMembers(floor());
    const joists = idsLike(members, "joist-");
    expect(joists).toHaveLength(4);
    expect(joists.every((m) => m.nominalSize === "2x6")).toBe(true);
    expect(new Set(joists.map((m) => m.memberId))).toEqual(
      new Set(["joist-left-bottom", "joist-left-top", "joist-right-bottom", "joist-right-top"]),
    );
  });

  it("the pair is top and bottom, separated by the panel's depth", () => {
    const members = buildFloorRoofPanelMembers(floor());
    const left = idsLike(members, "joist-left-");
    const ys = left.map((m) => m.position.yIn).sort((a, b) => a - b);
    expect(ys[0]).toBe(0);
    expect(ys[1]).toBe(15.5 - JOIST_2X6_WIDTH_IN);
  });

  it("⚠ two panels butted together give the seam FOUR 2x6s", () => {
    // The "double double", stated as the thing an installer actually sees.
    const a = idsLike(buildFloorRoofPanelMembers(floor()), "joist-right-");
    const b = idsLike(buildFloorRoofPanelMembers(floor()), "joist-left-");
    expect(a.length + b.length).toBe(4);
  });

  it("⚠ the joists run between the LIDS, not the panel's full length", () => {
    /* 2.25in of lid at each end — a 3/4in skin plus the 2x4s facing it — and
       the joists stop short of both, the way a standard panel's studs stop
       short of its plates. They used to run the full length and measurably
       occupied the same space as the lids: 16 overlapping pairs. */
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 180 }));
    for (const m of idsLike(members, "joist-")) expect(m.actualDimsIn.lengthIn).toBe(180 - 4.5);
    for (const m of idsLike(members, "joist-")) expect(m.position.zIn).toBe(2.25);
  });
});

describe("⚠ the structural girt goes only where a wall lands", () => {
  it("not at an end that was not asked for", () => {
    // "only on exterior ends where panel walls are above."
    const one = buildFloorRoofPanelMembers(floor({ structuralGirtEnds: ["start"] }));
    expect(idsLike(one, "structural-girt-start")).not.toHaveLength(0);
    expect(idsLike(one, "structural-girt-end")).toHaveLength(0);
  });

  it("at both ends when both carry a wall, and at neither when none does", () => {
    expect(idsLike(buildFloorRoofPanelMembers(floor({ structuralGirtEnds: ["start", "end"] })), "structural-girt-")).toHaveLength(6);
    expect(idsLike(buildFloorRoofPanelMembers(floor({ structuralGirtEnds: [] })), "structural-girt-")).toHaveLength(0);
  });

  it("⚠ NEVER on a roof panel, whatever is asked for", () => {
    /* "the roof panels do not need a structural girt, their weight should be
       on both the inner and outer wyth of the wall panel with the trapezoid
       shape." Asked for explicitly and still refused, because the caller
       should not be able to produce a part the spec says does not exist. */
    const roof = buildFloorRoofPanelMembers(floor({ kind: "roof", structuralGirtEnds: ["start", "end"] }));
    expect(idsLike(roof, "structural-girt-")).toHaveLength(0);
  });

  it("is a 3/4in web with a 2x4 at each edge — 2.25in overall", () => {
    const members = buildFloorRoofPanelMembers(floor({ structuralGirtEnds: ["start"] }));
    const web = members.find((m) => m.memberId === "structural-girt-start-web")!;
    expect(web.actualDimsIn.thicknessIn).toBe(0.75);
    expect(idsLike(members, "structural-girt-start-left")).toHaveLength(1);
    expect(idsLike(members, "structural-girt-start-right")).toHaveLength(1);
    expect(STRUCTURAL_GIRT_TOTAL_THICKNESS_IN).toBe(2.25);
  });
});

describe("⚠ blocking and anti-twist girts are two members, not one", () => {
  it("a floor gets both, at their own spacings", () => {
    /* The first reading of this spec collapsed them into one member at two
       different numbers. They are a 2x4 cut to fit between the 2x6s every 3ft
       and a 5/8in OSB girt every 5ft. */
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 240 }));
    expect(idsLike(members, "blocking-").length).toBeGreaterThan(0);
    expect(idsLike(members, "anti-twist-").length).toBeGreaterThan(0);
  });

  it("⚠ a ROOF gets the girts and NOT the blocking", () => {
    // "I guess we dont need blocking between the girts on the roofs."
    const roof = buildFloorRoofPanelMembers(floor({ kind: "roof", lengthIn: 240, structuralGirtEnds: [] }));
    expect(idsLike(roof, "blocking-")).toHaveLength(0);
    expect(idsLike(roof, "anti-twist-").length).toBeGreaterThan(0);
  });

  it("blocking is cut to fit between the 2x6s", () => {
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 240 }));
    const block = idsLike(members, "blocking-")[0]!;
    /* 15.5 depth less the two 5.5in joists = 4.5in of gap, and that gap is the
       piece's CUT LENGTH — it is a 2x4 stood between the joists, so its own
       width stays 3.5in. */
    expect(block.actualDimsIn.lengthIn).toBe(15.5 - 2 * JOIST_2X6_WIDTH_IN);
    expect(block.actualDimsIn.widthIn).toBe(PLATE_2X4_WIDTH_IN);
  });

  it("⚠ the anti-twist girt's 2x4s are HORIZONTAL, tying top and bottom chords", () => {
    /* "The structural girts are vertical, all the OSB girts are horizontal
       2x4s." The orientation follows the GIRT TYPE, not the panel type —
       simpler than the question that prompted it assumed. */
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 240 }));
    const top = members.find((m) => m.memberId === "anti-twist-0-top")!;
    const bottom = members.find((m) => m.memberId === "anti-twist-0-bottom")!;
    /* Horizontal means it runs ACROSS the panel — so that direction is its
       cut LENGTH. It is cut to the space between the joists, not the panel's
       full width: *"Girts should all be dynamic components kind of thing to
       the size of the space in-between the joists."* */
    expect(top.actualDimsIn.lengthIn).toBe(FLOOR_ROOF_PANEL_WIDTH_IN - 2 * JOIST_2X6_THICKNESS_IN);
    expect(top.actualDimsIn.widthIn).toBe(PLATE_2X4_WIDTH_IN);
    expect(bottom.position.yIn).toBe(0);
    expect(top.position.yIn).toBe(15.5 - PLATE_2X4_WIDTH_IN);
  });

  it("the girt web is 5/8in OSB", () => {
    const members = buildFloorRoofPanelMembers(floor({ lengthIn: 240 }));
    expect(members.find((m) => m.memberId === "anti-twist-0-web")!.actualDimsIn.thicknessIn).toBe(0.625);
  });
});

describe("⚠ both lids are structural, and the last 2x4 is ripped", () => {
  it("covers the whole lid face: six full 2x4s and a seventh ripped", () => {
    /* "As many 2x4s (vertically when installed) to the face of the lid to
       entirely cover it - the last may need to be ripped." 24in over 3.5in
       is 6.86, so six full and one ripped to 3in.

       Each piece runs through the panel's DEPTH and they stack across its
       width, so the dimension that varies is widthIn. */
    const members = buildFloorRoofPanelMembers(floor());
    const face = idsLike(members, "lid-start-face-");
    expect(face).toHaveLength(7);
    const widths = face.map((m) => m.actualDimsIn.widthIn);
    // Every one of them is cut to the panel's depth, not to its own width.
    for (const m of face) expect(m.actualDimsIn.lengthIn).toBe(15.5);
    expect(widths.filter((w) => w === PLATE_2X4_WIDTH_IN)).toHaveLength(6);
    const ripped = widths.find((w) => w !== PLATE_2X4_WIDTH_IN)!;
    expect(ripped).toBeCloseTo(FLOOR_ROOF_PANEL_WIDTH_IN - 6 * PLATE_2X4_WIDTH_IN, 9);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(FLOOR_ROOF_PANEL_WIDTH_IN, 9);
  });

  it("the ripped one says so, so the shop is not left guessing", () => {
    const members = buildFloorRoofPanelMembers(floor());
    const ripped = idsLike(members, "lid-start-face-").find((m) => m.actualDimsIn.widthIn !== PLATE_2X4_WIDTH_IN)!;
    expect(ripped.notes).toContain("ripped");
  });

  it("⚠ BOTH ends get one — the interior lid is structural too", () => {
    // He was asked whether the inner lid stayed plain and said to make it
    // structural as well.
    const members = buildFloorRoofPanelMembers(floor());
    expect(idsLike(members, "lid-start-face-").length).toBe(idsLike(members, "lid-end-face-").length);
    expect(idsLike(members, "lid-start-skin")).toHaveLength(1);
    expect(idsLike(members, "lid-end-skin")).toHaveLength(1);
  });

  it("an edge panel's lid needs one fewer 2x4, and still comes out exact", () => {
    const members = buildFloorRoofPanelMembers(floor({ widthIn: FLOOR_ROOF_EDGE_PANEL_WIDTH_IN }));
    const widths = idsLike(members, "lid-start-face-").map((m) => m.actualDimsIn.widthIn);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, 9);
  });
});

describe("nothing lands outside the panel", () => {
  it("every member sits within the panel's own box, on every configuration", () => {
    for (const opts of [
      floor(),
      floor({ widthIn: FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, structuralGirtEnds: ["start", "end"] }),
      floor({ kind: "roof", structuralGirtEnds: [] }),
      floor({ lengthIn: 300 }),
    ]) {
      for (const m of buildFloorRoofPanelMembers(opts)) {
        expect({ id: m.memberId, x: m.position.xIn >= -1e-9 }).toEqual({ id: m.memberId, x: true });
        expect({ id: m.memberId, y: m.position.yIn >= -1e-9 }).toEqual({ id: m.memberId, y: true });
        expect({ id: m.memberId, z: m.position.zIn >= -1e-9 }).toEqual({ id: m.memberId, z: true });
        expect({ id: m.memberId, zMax: m.position.zIn <= opts.lengthIn + 1e-9 }).toEqual({ id: m.memberId, zMax: true });
        /* ⚠ The FAR faces, which this test used to leave unchecked — it
           asserted only that members start inside the panel, never that they
           end inside it. A 2.25in-wide panel measurably overflows its own box
           by 1.25in, because the two joists are 1.5in each and cannot both
           fit; that is where floorRoofPanelMinimumWidthIn comes from, and it
           went unnoticed for exactly this reason. Caps are excluded: a cap
           seat extends past the panel's end on purpose. */
        if (m.memberId.startsWith("cap-")) continue;
        const box = memberBoxSizeIn(m);
        expect({ id: m.memberId, xMax: m.position.xIn + box.xIn <= opts.widthIn + 1e-9 }).toEqual({ id: m.memberId, xMax: true });
        expect({ id: m.memberId, yMax: m.position.yIn + box.yIn <= opts.depthIn + 1e-9 }).toEqual({ id: m.memberId, yMax: true });
        expect({ id: m.memberId, zMaxFar: m.position.zIn + box.zIn <= opts.lengthIn + 1e-9 }).toEqual({ id: m.memberId, zMaxFar: true });
      }
    }
  });
});

describe("⚠ laying out a run so the sheets keep landing true", () => {
  it("every 8ft of field lands exactly on a sheet edge, at every run length", () => {
    /* The property the whole module choice was made for. Swept across real
       building widths rather than spot-checked, because the failure mode is
       drift that only shows up a few sheets along. */
    for (let runFt = 20; runFt <= 60; runFt += 0.5) {
      const widths = planFloorRoofPanelWidthsIn(runFt * 12)!;
      expect(widths).not.toBeNull();
      // Field panels only — the edge ones carry the wall and sit outside the
      // sheet module (see the planner's own note on the datum).
      const field = widths.slice(1, -1);
      const lastTrueFieldIn = (lastTrueSheetSeamIn(widths) ?? 0) - widths[0]!;
      let running = 0;
      for (let i = 0; i < field.length; i++) {
        running += field[i]!;
        // Four 24in panels to the sheet now, where it used to take five.
        const isFifth = (i + 1) % 4 === 0;
        // A full group of four closes on 96; a part-group at the end does not
        // have to, because the run simply stops there.
        /* ⚠ ...and only before the redistributed tail. A group whose panels
           were pooled into the tail no longer closes on 96, which is the one
           thing his 12in minimum costs. `lastTrueSheetSeamIn` is where that
           starts, and the run's own sheet says so. */
        const inRedistributedTail = running > lastTrueFieldIn + 1e-9;
        if (isFifth && i < field.length - 1 && !inRedistributedTail) {
          expect({ runFt, at: i + 1, running }).toEqual({ runFt, at: i + 1, running: ((i + 1) / 4) * 96 });
        }
      }
    }
  });

  it("the widths add up to the run, exactly", () => {
    for (let runFt = 20; runFt <= 60; runFt += 0.5) {
      const widths = planFloorRoofPanelWidthsIn(runFt * 12)!;
      expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(runFt * 12, 9);
    }
  });

  it("the first and last are the wall-bearing edge panels", () => {
    const widths = planFloorRoofPanelWidthsIn(40 * 12)!;
    expect(widths[0]).toBe(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN);
    expect(widths[widths.length - 1]).toBe(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN);
  });

  it("refuses a run too short to hold the two edge panels", () => {
    expect(planFloorRoofPanelWidthsIn(12)).toBeNull();
  });
});

describe("⚠ the installer cuts the first sheet, and everything after it lands true", () => {
  it("the first sheet's cut is on the 1/8in grid", () => {
    /* Tommy, 2026-10-22: "The installers will most likely cut the first piece
       of plywood to fit, so however that could work out with being on the
       grid." That answer dissolves the datum question — the edge panel simply
       is not part of the sheet module, and the first sheet is trimmed to the
       last seam it can reach. On a 40ft run that is 90 1/4in. */
    const widths = planFloorRoofPanelWidthsIn(40 * 12)!;
    const first = firstPlywoodSheetWidthIn(widths)!;
    // 15 1/2in of edge panel plus three 24in field panels.
    expect(first).toBe(87.5);
    expect(Number.isInteger(first * 8)).toBe(true);
    expect(first).toBeLessThanOrEqual(96);
  });

  it("⚠ and EVERY full sheet after it lands exactly on a panel seam", () => {
    /* The property the closer exists for, checked end to end across real
       building widths rather than on one example. */
    for (let runFt = 24; runFt <= 60; runFt += 0.5) {
      const widths = planFloorRoofPanelWidthsIn(runFt * 12)!;
      const first = firstPlywoodSheetWidthIn(widths)!;
      const seams = new Set<number>();
      let at = 0;
      for (const w of widths) {
        at = Math.round((at + w) * 16) / 16;
        seams.add(at);
      }
      /* ⚠ Only across the FIELD. The last sheet can land inside the closing
         edge panel, which is not a seam — and does not need to be, because the
         installer cuts the last sheet exactly as they cut the first. My first
         version of this asserted it anyway and failed on a 24ft run at
         282.25in, two thirds of the way into the final 13.25in panel. */
      /* ⚠ And only as far as `lastTrueSheetSeamIn` says. Redistributing a
         too-narrow tail eats backwards into the last complete 8ft group, so
         the seam that group would have closed on is gone. That is the price
         of his 12in minimum, and the sheet itself tells the installer where
         the true seams stop rather than leaving them to find out. */
      const lastTrue = lastTrueSheetSeamIn(widths)!;
      for (let k = 1; first + 96 * k <= lastTrue + 1e-9; k++) {
        const edge = Math.round((first + 96 * k) * 16) / 16;
        expect({ runFt, edge, lands: seams.has(edge) }).toEqual({ runFt, edge, lands: true });
      }
      /* And the part past it is bounded. Measured over every run from 26.5in
         to 120ft: the worst is 107.875in, on a 17.6ft run. So the installer
         cuts the first sheet, the middle of the run lands true, and at most
         a sheet and a bit at the far end gets cut as well. */
      const pastIn = runFt * 12 - FLOOR_ROOF_EDGE_PANEL_WIDTH_IN - lastTrue;
      expect({ runFt, overBound: pastIn > 107.875 + 1e-9 }).toEqual({ runFt, overBound: false });
    }
  });
});

describe("⚠ the caps — the L is square, the PANEL meets it at the odd angle", () => {
  const roofPanel = { kind: "roof" as const, widthIn: FLOOR_ROOF_PANEL_WIDTH_IN, depthIn: 15.5, lengthIn: 180, structuralGirtEnds: [] };

  it("the odd angle is the pitch, not the angle between the legs", () => {
    /* "the L plate sits flat on the top plate and wraps up plum" — flat and
       plumb are square to each other. What is odd is where the inclined panel
       lands on it. */
    expect(roofCapGeometry(4, 15.5, 19.25).panelAngleDeg).toBeCloseTo((Math.atan2(4, 12) * 180) / Math.PI, 9);
    expect(roofCapGeometry(0, 15.5, 19.25).panelAngleDeg).toBe(0);
  });

  it("⚠ the plumb leg is TALLER than the panel is deep, by 1/cos(pitch)", () => {
    /* An inclined panel's end face stands taller than its depth — the same
       reason a rafter is longer than its run. Getting this wrong makes a cap
       that does not reach, and it fails by more the steeper the roof. */
    for (const pitch of [2, 4, 6, 9, 12]) {
      const g = roofCapGeometry(pitch, 15.5, 19.25);
      expect(g.plumbHeightIn).toBeGreaterThan(15.5);
      expect(g.plumbHeightIn).toBeCloseTo(15.5 / Math.cos(Math.atan2(pitch, 12)), 9);
    }
    // Flat: the cap is exactly the panel's depth.
    expect(roofCapGeometry(0, 15.5, 19.25).plumbHeightIn).toBeCloseTo(15.5, 9);
  });

  it("the stiffeners cover the cap's width, last one ripped", () => {
    const g = roofCapGeometry(4, 15.5, FLOOR_ROOF_PANEL_WIDTH_IN);
    // 24in of cap over 3.5in stiffeners: six full and a seventh ripped to 3in.
    expect(g.stiffenerCount).toBe(7);
    expect((g.stiffenerCount - 1) * PLATE_2X4_WIDTH_IN + g.lastStiffenerWidthIn).toBeCloseTo(FLOOR_ROOF_PANEL_WIDTH_IN, 9);
  });

  it("⚠ eave and ridge are the SAME part — only the end cut differs", () => {
    // "The ridge cap is the same thing except to end plumbing cut."
    const eave = buildRoofPanelCapMembers(roofPanel, "eave", 4);
    const ridge = buildRoofPanelCapMembers(roofPanel, "ridge", 4);
    expect(eave.length).toBe(ridge.length);
    const dims = (ms: typeof eave) => ms.map((m) => `${m.actualDimsIn.thicknessIn}x${m.actualDimsIn.widthIn}x${m.actualDimsIn.lengthIn}`);
    expect(dims(eave)).toEqual(dims(ridge));
    // What differs is what the shop is told to do at the end.
    expect(eave.find((m) => m.memberId === "cap-eave-web")!.notes).toContain("off square");
    expect(ridge.find((m) => m.memberId === "cap-ridge-web")!.notes).toContain("plumb");
  });

  it("the seat bears the full depth of the wall's top plate", () => {
    const eave = buildRoofPanelCapMembers(roofPanel, "eave", 4);
    expect(eave.find((m) => m.memberId === "cap-eave-seat")!.actualDimsIn.widthIn).toBe(ROOF_CAP_SEAT_WIDTH_IN);
  });
});

describe("the component schema a SketchUp exporter would read", () => {
  const roofPanel = { kind: "roof" as const, widthIn: FLOOR_ROOF_PANEL_WIDTH_IN, depthIn: 15.5, lengthIn: 180, structuralGirtEnds: [] };

  it("⚠ says DRAFT, because it has not been through a fabrication round", () => {
    /* Everything in this panel came from one verbal interview and two readings
       of mine are still awaiting a sentence from him. A schema claiming
       "locked" would be claiming a confidence nobody has. */
    const schema = buildFloorRoofPanelSchema({ ...roofPanel, kind: "floor", structuralGirtEnds: ["start"] });
    expect(schema.status).toBe("draft");
    expect(schema.derivedFrom).toBe("standard_panel");
  });

  it("⚠ carries my two interpretations as NOTES, not as comments nobody exports", () => {
    const schema = buildFloorRoofPanelSchema({ ...roofPanel, kind: "floor", structuralGirtEnds: ["start"] });
    const text = schema.notes.map((n) => n.text).join(" ");
    expect(text).toContain("sits flat on the top plate");
    /* The closer panel's note went with the closer panel — four 24in field
       panels are exactly 8ft, so nothing has to be trimmed to get back onto
       the sheet, and the "a little bigger" discrepancy it recorded is moot. */
    expect(text).toContain("no closer panel and no drift");
  });

  it("⚠ overallDimensions is the panel AS FABRICATED, not as installed", () => {
    /* It is built lying in the compressor table: height is its span, depth the
       15.5in through-thickness. A roof panel is installed inclined and a floor
       flat, and neither is built that way — the shop drawing has to match the
       table, not the building. */
    const schema = buildFloorRoofPanelSchema(roofPanel, 4);
    expect(schema.overallDimensions).toEqual({ heightIn: 180, widthIn: FLOOR_ROOF_PANEL_WIDTH_IN, depthIn: 15.5 });
  });

  it("⚠ a roof panel WITH a pitch gets the eave cap and a PLUMB tall end", () => {
    /* It used to get a separate ridge cap. It no longer does, because the
       panel's own tall-end lid is now that plumb plate — Tommy, 2026-10-29:
       *"The tall end of a roof panel should be plumb cut with a vertical
       structural top plate."* Two plates in one place is an overlap. */
    const schema = buildFloorRoofPanelSchema(roofPanel, 4);
    expect(schema.members.some((m) => m.memberId === "cap-eave-web")).toBe(true);
    expect(schema.members.some((m) => m.memberId === "cap-ridge-web")).toBe(false);
    const plate = schema.members.find((m) => m.memberId === "lid-end-skin")!;
    expect(plate.position.sectionCornersIn).toBeDefined();
    expect(plate.actualDimsIn.widthIn).toBeCloseTo(15.5 / (12 / Math.hypot(12, 4)), 9);
  });

  it("⚠ and WITHOUT one gets no caps, and says so rather than guessing a pitch", () => {
    const schema = buildFloorRoofPanelSchema(roofPanel);
    expect(schema.members.some((m) => m.memberId.startsWith("cap-"))).toBe(false);
    expect(schema.notes.some((n) => n.type === "deviation" && n.text.includes("NO eave or ridge cap"))).toBe(true);
  });

  it("a floor panel never gets caps, pitch or no pitch", () => {
    const schema = buildFloorRoofPanelSchema({ ...roofPanel, kind: "floor", structuralGirtEnds: ["start"] }, 4);
    expect(schema.members.some((m) => m.memberId.startsWith("cap-"))).toBe(false);
    expect(schema.id).toBe("floor_panel");
  });
});

describe("⚠ the cut list the shop actually gets", () => {
  const opts = {
    kind: "floor" as const,
    widthIn: FLOOR_ROOF_PANEL_WIDTH_IN,
    depthIn: 15.5,
    lengthIn: 240,
    structuralGirtEnds: ["start" as const],
  };

  it("⚠ NO board is cut to its own thickness — the bug this test exists for", () => {
    /* The first version of this builder passed a BOUNDING BOX where the schema
       wants the piece as cut, so `lengthIn` came out as whatever the box
       measured along Z. The cut list dutifully told the shop to cut 2x4s
       "1 1/2in" long — twelve of them. Found by running `computePanelCutList`
       on a real panel instead of assuming a generic function would be fed
       sensible input.

       A board is never cut shorter than it is wide. That one sentence catches
       the whole class. */
    for (const members of [
      buildFloorRoofPanelMembers(opts),
      buildFloorRoofPanelMembers({ ...opts, kind: "roof", structuralGirtEnds: [] }),
      buildRoofPanelCapMembers({ ...opts, kind: "roof", structuralGirtEnds: [] }, "eave", 4),
    ]) {
      for (const m of members) {
        if (m.material !== "dimensional_lumber") continue;
        expect({ id: m.memberId, ok: m.actualDimsIn.lengthIn >= m.actualDimsIn.widthIn }).toEqual({ id: m.memberId, ok: true });
        expect({ id: m.memberId, thick: m.actualDimsIn.thicknessIn }).toEqual({ id: m.memberId, thick: 1.5 });
      }
    }
  });

  it("every length on the list is a real part of the panel", () => {
    /* Pinned as the set of distinct cut lengths, so a silently changed
       dimension shows up here rather than in a shop. */
    const rows = computePanelCutList(buildFloorRoofPanelMembers(opts));
    const lumberLengths = new Set(
      rows.filter((r) => r.material === "dimensional_lumber").map((r) => r.lengthLabel),
    );
    expect(lumberLengths).toEqual(
      new Set([
        '235½"', // the joists: the 240in span less 2.25in of lid at each end
        '15½"', // lid face pieces, running through the depth
        '21"', // anti-twist ties: the 24in width less both joists
        '4½"', // blocking, cut to fit between the 2x6s
      ]),
    );
  });

  it("⚠ a roof cap's stiffeners are cut to the PLUMB height, not the depth", () => {
    /* 15.5in of depth at 4:12 stands 16 5/16in tall. A cap cut to 15 1/2 would
       not reach, and the error grows with the pitch. */
    const roof = { ...opts, kind: "roof" as const, structuralGirtEnds: [] };
    const rows = computePanelCutList(buildRoofPanelCapMembers(roof, "eave", 4));
    const stiffener = rows.find((r) => r.partLabel.includes("2x4"))!;
    expect(stiffener.lengthLabel).not.toBe('15½"');
    expect(stiffener.lengthLabel).toContain("16");
  });

  it("the whole list is non-empty and every row names its material", () => {
    const rows = computePanelCutList(buildFloorRoofPanelMembers(opts));
    expect(rows.length).toBeGreaterThan(5);
    for (const r of rows) {
      expect(r.materialLabel.length).toBeGreaterThan(0);
      expect(r.lengthLabel.length).toBeGreaterThan(0);
    }
  });
});

describe("⚠ no two members occupy the same space", () => {
  /* The check that found the whole class. Girts were cut to the panel's full
     width and ran straight THROUGH both joists — 50 overlapping pairs on one
     floor panel — and the joists ran past the lids for another 16. Bounds
     tests could not see any of it, because every member was inside the panel.

     For comparison: a standard panel has 8, all girt-web-over-corner-stud,
     which is an accepted modelling convention across the app. Floor and roof
     panels are held to zero because nothing in them needs that licence. */
  const overlappingPairs = (members: PanelMember[]) => {
    const boxes = members.map((m) => {
      const size = memberBoxSizeIn(m);
      return {
        id: m.memberId,
        x0: m.position.xIn, x1: m.position.xIn + size.xIn,
        y0: m.position.yIn, y1: m.position.yIn + size.yIn,
        z0: m.position.zIn, z1: m.position.zIn + size.zIn,
      };
    });
    const found: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
        if (ox > 1e-6 && oy > 1e-6 && oz > 1e-6) found.push(`${a.id} x ${b.id}`);
      }
    }
    return found;
  };

  it("on a floor panel, at every width a run can produce", () => {
    for (const widthIn of [FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, 12, 13.5, 15.5, 19, FLOOR_ROOF_PANEL_WIDTH_IN, 21.5, 23.875]) {
      for (const girtEnds of [[], ["start"], ["start", "end"]] as ("start" | "end")[][]) {
        const members = buildFloorRoofPanelMembers({
          kind: "floor", widthIn, depthIn: 15.5, lengthIn: 300, structuralGirtEnds: girtEnds,
        });
        expect({ widthIn, girtEnds: girtEnds.join("+"), overlaps: overlappingPairs(members) }).toEqual({
          widthIn, girtEnds: girtEnds.join("+"), overlaps: [],
        });
      }
    }
  });

  it("on a roof panel, caps and all", () => {
    const options = { kind: "roof" as const, widthIn: FLOOR_ROOF_PANEL_WIDTH_IN, depthIn: 15.5, lengthIn: 300, structuralGirtEnds: [] };
    const members = [
      ...buildFloorRoofPanelMembers(options),
      ...buildRoofPanelCapMembers(options, "eave", 4),
    ];
    /* ⚠ Caps are excluded, and that is a real gap rather than a licence.
       Measured: every cap member sits at the same z as every other, so the
       web, the seat and all six stiffeners occupy one plane at the panel's
       end and run back into the lid. It is a stack, not an L.

       Not fixed here because placing the L properly needs the seat's bearing
       width settled first, and that is still one of the readings of his
       sentence awaiting a word from him. The rest of the panel is held to
       zero. */
    const offending = overlappingPairs(members).filter((pair) => !pair.includes("cap-"));
    expect(offending).toEqual([]);
  });

  it("⚠ the girts are cut to the space between the joists, which is what fixed it", () => {
    // "Girts should all be dynamic components kind of thing to the size of the
    // space in-between the joists." A girt is the panel width less both joists.
    const members = buildFloorRoofPanelMembers({
      kind: "floor", widthIn: FLOOR_ROOF_PANEL_WIDTH_IN, depthIn: 15.5, lengthIn: 300, structuralGirtEnds: ["start"],
    });
    const expectedIn = FLOOR_ROOF_PANEL_WIDTH_IN - 2 * JOIST_2X6_THICKNESS_IN;
    const web = members.find((m) => m.memberId === "anti-twist-0-web")!;
    expect(web.actualDimsIn.lengthIn).toBe(expectedIn);
    expect(web.position.xIn).toBe(JOIST_2X6_THICKNESS_IN);
    const tie = members.find((m) => m.memberId === "anti-twist-0-top")!;
    expect(tie.actualDimsIn.lengthIn).toBe(expectedIn);
    const girtWeb = members.find((m) => m.memberId === "structural-girt-start-web")!;
    expect(girtWeb.actualDimsIn.lengthIn).toBe(expectedIn);
  });

  it("⚠ the joists are cut to run BETWEEN the lids", () => {
    // 2.25in of lid at each end: a 3/4in skin plus the 2x4s facing it.
    const members = buildFloorRoofPanelMembers({
      kind: "floor", widthIn: FLOOR_ROOF_PANEL_WIDTH_IN, depthIn: 15.5, lengthIn: 300, structuralGirtEnds: [],
    });
    const joist = members.find((m) => m.memberId === "joist-left-top")!;
    expect(joist.actualDimsIn.lengthIn).toBe(295.5);
    expect(joist.position.zIn).toBe(2.25);
  });
});

describe("⚠ the extra girts a column needs from the floor under it", () => {
  const base = { kind: "floor" as const, widthIn: FLOOR_ROOF_PANEL_WIDTH_IN, depthIn: 15.5, lengthIn: 300 };

  it("one girt per position asked for, built from the SAME part as the end ones", () => {
    /* *"more structural girts, one under each side of the panel resting
       above it"* — his words say more of the same part, not a new member. */
    const members = buildFloorRoofPanelMembers({ ...base, structuralGirtEnds: ["start", "end"], extraStructuralGirtsAtIn: [100, 120] });
    const webs = members.filter((m) => m.memberId.includes("girt") && m.memberId.includes("web") && !m.memberId.includes("anti"));
    // Two ends plus two extras.
    expect(webs).toHaveLength(4);
    /* The web spans the space between the joists, same as an end girt's. Its
       own two 2x4s run through the depth, so they are filtered out here. */
    const extraWebs = members.filter((m) => m.memberId.startsWith("structural-girt-column_") && m.memberId.endsWith("-web"));
    expect(extraWebs).toHaveLength(2);
    for (const m of extraWebs) expect(m.actualDimsIn.lengthIn).toBe(FLOOR_ROOF_PANEL_WIDTH_IN - 3);
  });

  it("they land where they were asked for", () => {
    const members = buildFloorRoofPanelMembers({ ...base, structuralGirtEnds: [], extraStructuralGirtsAtIn: [100] });
    const web = members.find((m) => m.memberId === "structural-girt-column_0-web")!;
    expect(web.position.zIn).toBe(100);
  });

  it("⚠ a column near the end cannot push a girt out through the lid", () => {
    const members = buildFloorRoofPanelMembers({ ...base, structuralGirtEnds: [], extraStructuralGirtsAtIn: [-50, 9999] });
    const webs = members.filter((m) => m.memberId.startsWith("structural-girt-column_") && m.memberId.endsWith("-web"));
    expect(webs).toHaveLength(2);
    for (const w of webs) {
      expect({ id: w.memberId, inside: w.position.zIn >= 2.25 - 1e-9 && w.position.zIn <= 300 }).toEqual({
        id: w.memberId,
        inside: true,
      });
    }
  });

  it("a panel nobody put a column on is unchanged", () => {
    const withNone = buildFloorRoofPanelMembers({ ...base, structuralGirtEnds: ["start", "end"] });
    const withEmpty = buildFloorRoofPanelMembers({ ...base, structuralGirtEnds: ["start", "end"], extraStructuralGirtsAtIn: [] });
    expect(withEmpty).toEqual(withNone);
  });

  it("⚠ and the panel is still solid with them in", () => {
    // The whole reason the overlap check exists: new members, same rule.
    const members = buildFloorRoofPanelMembers({ ...base, structuralGirtEnds: ["start", "end"], extraStructuralGirtsAtIn: [100, 140] });
    expect(overlappingMemberPairs(members)).toEqual([]);
  });
});

describe("⚠ the tall end is PLUMB CUT, not square", () => {
  /* > "The tall end of a roof panel should be plumb cut with a vertical
     > structural top plate, and the bottom of it should meet flush with the
     > entire wall depth and the rest should go plumb cut vertically. This
     > makes for easy membrane application when it looks like a monopoly
     > house — meets the interior wall and exterior wall continues up and
     > cover." — Tommy, 2026-10-29 */
  const DEPTH = 15.5;
  const PITCH = 4;
  const TAN = PITCH / 12;
  const COS = 12 / Math.hypot(12, PITCH);
  const pitched = (over: Partial<FloorRoofPanelOptions> = {}) =>
    buildFloorRoofPanelMembers({ ...floor({ kind: "roof", structuralGirtEnds: [], pitchIn12: PITCH }), depthIn: DEPTH, ...over });

  it("⚠ the two joists of a pair are DIFFERENT lengths, which is the whole point", () => {
    /* A square cut gives both the same length. A plumb one cannot: they sit
       at different depths, and the cut leans through the depth. */
    const members = pitched();
    const atTop = members.find((m) => m.memberId === "joist-left-bottom")!;
    const atUnderside = members.find((m) => m.memberId === "joist-left-top")!;
    expect(atTop.actualDimsIn.lengthIn).toBeGreaterThan(atUnderside.actualDimsIn.lengthIn);
    /* Exactly the depth between them times the pitch — member y=0 is the
       installed TOP face, so the far joist sits (depth - 5.5) lower. */
    expect(atTop.actualDimsIn.lengthIn - atUnderside.actualDimsIn.lengthIn).toBeCloseTo((DEPTH - JOIST_2X6_WIDTH_IN) * TAN, 9);
  });

  it("⚠ each joist's OWN end is beveled, so its long and short points differ", () => {
    const joist = pitched().find((m) => m.memberId === "joist-left-bottom")!;
    const corners = joist.position.sectionCornersIn!;
    expect(corners).toBeDefined();
    const zs = corners.map((c) => c.zIn);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(joist.actualDimsIn.lengthIn, 9);
    // The bevel across its own 5 1/2in is the pitch, not some rounded angle.
    const far = corners.filter((c) => c.zIn > 2.25 + 1e-9);
    expect(Math.abs(far[0]!.zIn - far[1]!.zIn)).toBeCloseTo(JOIST_2X6_WIDTH_IN * TAN, 9);
    expect(joist.notes).toContain("stands plumb");
  });

  it("⚠ the underside pulls back by the full depth times the pitch", () => {
    /* His "meets the interior wall and exterior wall continues up and cover":
       the cut is one vertical plane, so the underside's end and the top's
       end are the same place in the world — they are just a bevel apart
       along the panel. */
    const skin = pitched().find((m) => m.memberId === "lid-end-skin")!;
    const outer = skin.position.sectionCornersIn!.filter((c) => c.yIn === 0 || c.yIn === DEPTH);
    const atTop = Math.max(...outer.filter((c) => c.yIn === 0).map((c) => c.zIn));
    const atUnderside = Math.max(...outer.filter((c) => c.yIn === DEPTH).map((c) => c.zIn));
    expect(atTop - atUnderside).toBeCloseTo(DEPTH * TAN, 9);
  });

  it("⚠ the vertical top plate is cut TALLER than the panel is deep", () => {
    /* A plate standing plumb against a leaning panel has to span
       depth / cos(pitch). Cutting it to the depth leaves the underside
       corner open — the exact corner the membrane turns. */
    const members = pitched();
    const skin = members.find((m) => m.memberId === "lid-end-skin")!;
    expect(skin.actualDimsIn.widthIn).toBeCloseTo(DEPTH / COS, 9);
    expect(skin.actualDimsIn.widthIn).toBeGreaterThan(DEPTH);
    const faces = members.filter((m) => m.memberId.startsWith("lid-end-face-"));
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) expect(f.actualDimsIn.lengthIn).toBeCloseTo(DEPTH / COS, 9);
    // And they still cover the panel's whole width, last one ripped.
    expect(faces.reduce((a, f) => a + f.actualDimsIn.widthIn, 0)).toBeCloseTo(FLOOR_ROOF_PANEL_WIDTH_IN, 9);
  });

  it("the joists land exactly on the plate's inner face, at every depth", () => {
    /* Dimensional tightness through a bevel: the two parts are cut on
       different angles and still have to meet with nothing between them. */
    const members = pitched();
    const plateInnerAt = (yIn: number) => 144 - yIn * TAN - (0.75 + 1.5) / COS;
    for (const id of ["joist-left-bottom", "joist-left-top"]) {
      const corners = members.find((m) => m.memberId === id)!.position.sectionCornersIn!;
      for (const c of corners.filter((c) => c.zIn > 2.25 + 1e-9)) {
        expect({ id, y: c.yIn, z: Number(c.zIn.toFixed(9)) }).toEqual({ id, y: c.yIn, z: Number(plateInnerAt(c.yIn).toFixed(9)) });
      }
    }
  });

  it("⚠ and nothing in the panel overlaps anything else", () => {
    // The standing rule, through a shape the overlap test had never seen.
    for (const lengthIn of [96, 144, 180, 216]) {
      expect({ lengthIn, pairs: overlappingMemberPairs(pitched({ lengthIn })) }).toEqual({ lengthIn, pairs: [] });
    }
  });

  it("a floor, and a roof with no pitch, are cut square exactly as before", () => {
    for (const options of [floor(), floor({ kind: "roof", structuralGirtEnds: [] }), floor({ kind: "roof", structuralGirtEnds: [], pitchIn12: 0 })]) {
      const members = buildFloorRoofPanelMembers(options);
      expect({ kind: options.kind, pitch: options.pitchIn12, beveled: members.some((m) => m.position.sectionCornersIn) }).toEqual({
        kind: options.kind,
        pitch: options.pitchIn12,
        beveled: false,
      });
    }
    // Byte for byte the panel it was.
    expect(buildFloorRoofPanelMembers(floor({ kind: "roof", structuralGirtEnds: [], pitchIn12: 0 }))).toEqual(
      buildFloorRoofPanelMembers(floor({ kind: "roof", structuralGirtEnds: [] })),
    );
  });

  it("⚠ the bevel REACHES THE RENDERER, not just the data", () => {
    /* A commit once shipped a flat roof deck because the tilt was written
       into the data and nothing drew it. `memberLocalCornersIn` is the one
       function both the 3D view and the .obj export read corners from, so
       asking it directly is asking the screen.

       A BOX would answer with its 8 corners at exactly 2 distinct heights.
       This joist answers with 3: its two eave-end corners share one, and
       its beveled tall end splits into the long point and the short. */
    const joist = pitched().find((m) => m.memberId === "joist-left-bottom")!;
    const corners = memberLocalCornersIn(joist);
    expect(corners).toHaveLength(8);
    const heights = [...new Set(corners.map(([, y]) => Number(y.toFixed(6))))].sort((a, b) => a - b);
    expect(heights).toHaveLength(3);
    expect(heights[2]! - heights[1]!).toBeCloseTo(JOIST_2X6_WIDTH_IN * TAN, 5);
    // And it is still 1 1/2in thick across the panel, swept from its own x.
    const xs = corners.map(([x]) => Number(x.toFixed(6)));
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(JOIST_2X6_THICKNESS_IN, 9);
  });

  it("⚠ a steeper roof cuts back further, a shallower one less", () => {
    const shallow = buildFloorRoofPanelMembers(floor({ kind: "roof", structuralGirtEnds: [], pitchIn12: 2 }));
    const steep = buildFloorRoofPanelMembers(floor({ kind: "roof", structuralGirtEnds: [], pitchIn12: 12 }));
    const underside = (ms: PanelMember[]) => ms.find((m) => m.memberId === "joist-left-top")!.actualDimsIn.lengthIn;
    expect(underside(steep)).toBeLessThan(underside(shallow));
  });
});
