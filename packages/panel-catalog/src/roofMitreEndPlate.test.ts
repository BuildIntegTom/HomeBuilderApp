import { describe, expect, it } from "vitest";
import { buildFloorRoofPanelMembers, JOIST_2X6_THICKNESS_IN, type FloorRoofPanelOptions } from "./floorRoofPanelMembers";
import { MITRE_END_PLATE_THICKNESS_IN, planRoofMitreEndPlates } from "./roofMitreEndPlate";
import { overlappingMemberPairs } from "./memberPrism";
import { computePanelCutList } from "./panelCutList";
import { NO_FLOOR_ROOF_MITRE } from "./floorRoofPanelMitreTypes";
import type { PanelMember } from "./componentSchema";

/* ──────────────────────────────────────────────────────────────────────────
   WHAT CLOSES A MITRED ROOF PANEL'S CUT FACE — his answer, 2026-11-25

   "An end plate with dual bevel cuts. Basically the same as a standard
    panel's top plate, except the 2x4s attached to the end plate span the
    shorter length of the lid and hug the insides of the studs (the full 3/4"
    plywood is exposed to the exterior with 2 vertical 2x4s butted up to the
    joist members)."

   The plan mitre saws a roof panel's end lid off — ten of its boards on the
   16ft Octagon's corner panel — and roofPlanMitre.ts was honest about leaving
   the face open, because closing it is a building decision. This is it.
   ────────────────────────────────────────────────────────────────────────── */

/** The 16ft Octagon's own corner roof panel, which is what this was built for. */
const ROOF: FloorRoofPanelOptions = {
  kind: "roof",
  widthIn: 20.375,
  depthIn: 15.5,
  lengthIn: 202.386,
  structuralGirtEnds: [],
  pitchIn12: 4,
  bearingSeatDepthIn: 15.5,
};

/** Its real mitre: 21.477in of set-back at one corner, nothing at the other. */
const MITRE = { startNearIn: 21.477, startFarIn: 0, endNearIn: 21.477, endFarIn: 0 };

const SLOPE = 4 / 12;
/** Where a point sits along the PLUMB span — the coordinate the cut lives in. */
const plumbW = (yIn: number, zIn: number) => zIn + yIn * SLOPE;

const byId = (members: PanelMember[], id: string) => members.find((m) => m.memberId === id);
const square = buildFloorRoofPanelMembers(ROOF);
const mitred = buildFloorRoofPanelMembers({ ...ROOF, mitreIn: MITRE });

describe("⚠ the end plate that closes a mitred roof panel", () => {
  it("⚠ is TWO 2x4s, not a tiled face — which is the whole of what he specified", () => {
    /* The trap this pins. "Basically the same as a standard panel's top
       plate" invites tiling the face solid, which is what a square lid does:
       this panel's square end carries SIX lid boards edge to edge. He asked
       for "2 vertical 2x4s butted up to the joist members". Reading the
       sentence the other way would put six boards here, and nothing in a
       count or a drawing would look wrong. */
    expect(square.filter((m) => /^lid-start-face-/.test(m.memberId))).toHaveLength(6);

    const plate = mitred.filter((m) => /^mitre-start-plate-/.test(m.memberId));
    expect(plate.map((m) => m.memberId).sort()).toEqual([
      "mitre-start-plate-skin",
      "mitre-start-plate-stud-left",
      "mitre-start-plate-stud-right",
    ]);
  });

  it("⚠ the two 2x4s HUG THE INSIDES of the side joists", () => {
    const left = byId(mitred, "mitre-start-plate-stud-left")!;
    const right = byId(mitred, "mitre-start-plate-stud-right")!;
    const xsOf = (m: PanelMember) => m.position.trapezoidCornersIn!.map((c) => c.xIn);
    /* The left joist runs 0 .. 1.5, so its inside face is 1.5. */
    expect(Math.min(...xsOf(left))).toBeCloseTo(JOIST_2X6_THICKNESS_IN, 9);
    /* The right joist runs widthIn - 1.5 .. widthIn, so its inside face is
       18.875 — and the board is BEHIND it, not past it. */
    expect(Math.max(...xsOf(right))).toBeCloseTo(ROOF.widthIn - JOIST_2X6_THICKNESS_IN, 9);
    /* Each spans the lid's SHORT dimension: the panel's depth, cut longer
       than 15 1/2in because the face stands plumb against a tilted panel. */
    for (const m of [left, right]) {
      expect(m.actualDimsIn.lengthIn).toBeCloseTo(15.5 * Math.hypot(1, SLOPE), 6);
      expect(m.actualDimsIn.lengthIn).toBeCloseTo(16.3384, 4);
      expect(m.position.trapezoidDepthIn).toBeCloseTo(ROOF.depthIn, 9);
    }
  });

  it("⚠ EACH 2x4 IS A TRUE 2x4 — a rectangular 1½ x 3½ board, not a parallelogram rip", () => {
    /* ⚠ **The defect this pins, and it took two goes.** The plate's plane is
       raked 46.5deg in plan, so "3 1/2in wide" has to mean 3 1/2in IN THAT
       PLANE. Measured on the first version — 3 1/2in of panel X — the board
       came out **5.085in x 2.236in at 136.5deg, 121.31 cubic inches against
       the 85.78 a 2x4 of that length holds. 41% too much wood**, on a cut
       list that said 1 1/2in x 3 1/2in. Fixing the width alone left the area
       right and the SHAPE wrong: a 45deg-sheared section you would have to
       rip out of a 2x6.

       So this measures the solid itself rather than trusting either number:
       its cross-section perpendicular to its own length must be a 3 1/2 x
       1 1/2 RECTANGLE, and its volume must be a 2x4's. */
    /* ⚠ **ALL FOUR, and that is the point.** The first version of this test
       measured the EAVE end's two boards only, and the TALL end's two were
       degenerate — zero-thickness slivers, because the plate's inward normal
       had its sign applied to Z and not to X, which at that end left the
       thickness step parallel to the board's own width. A degenerate solid
       overlaps nothing, so the audit said nothing; the browser's shop sheet
       said `90 degrees off square` and a waste triangle 649314165103509 1/2in
       long. **Measure every instance a builder emits, not one of them.** */
    for (const id of [
      "mitre-start-plate-stud-left",
      "mitre-start-plate-stud-right",
      "mitre-end-plate-stud-left",
      "mitre-end-plate-stud-right",
    ]) {
      const stud = byId(mitred, id)!;
      const near = stud.position.trapezoidCornersIn!;
      const far = stud.position.trapezoidFarCornersIn!;
      const at = (i: number, isFar: boolean): number[] => {
        const c = isFar ? far[i]! : near[i]!;
        return [c.xIn, isFar ? ROOF.depthIn : 0, c.zIn];
      };
      const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]!);
      const dot = (a: number[], b: number[]) => a.reduce((t, v, i) => t + v * b[i]!, 0);
      const len = (a: number[]) => Math.sqrt(dot(a, a));
      const perpTo = (v: number[], axis: number[]) => {
        const u = axis.map((c) => c / len(axis));
        return sub(v, u.map((c) => c * dot(v, u)));
      };
      const origin = at(0, false);
      const edgeWidth = sub(at(1, false), origin);
      const edgeThickness = sub(at(3, false), origin);
      const edgeLength = sub(at(0, true), origin);

      /* The piece runs the lid's SHORT way, cut longer than the panel is deep
         because it stands plumb against a tilted panel. */
      expect(len(edgeLength), `${id} length`).toBeCloseTo(15.5 * Math.hypot(1, SLOPE), 6);

      /* ⚠ Its true cross-section: 3 1/2 by 1 1/2, square — identified by
         MEASUREMENT, not by corner index. `normalizeQuadWindingIn` orders a
         quad by its signed area, so which neighbour of corner 0 is the width
         and which the thickness flips between the two ends. Reading index 1
         as "the width" passed at one end and failed at the other for a
         reason that had nothing to do with the board. */
      const sides = [perpTo(edgeWidth, edgeLength), perpTo(edgeThickness, edgeLength)];
      const [shortIn, longIn] = sides.map(len).sort((a, b) => a - b) as [number, number];
      const angleDeg = (Math.acos(dot(sides[0]!, sides[1]!) / (len(sides[0]!) * len(sides[1]!))) * 180) / Math.PI;
      expect(longIn, `${id} width`).toBeCloseTo(3.5, 9);
      expect(shortIn, `${id} thickness`).toBeCloseTo(1.5, 9);
      expect(angleDeg, `${id} is square in section`).toBeCloseTo(90, 6);
    }
  });

  it("⚠ and the two boards butt on OPPOSITE corners, because they lean the same way", () => {
    /* A square board on a raked plate does not present a face to the joist —
       it leans across the panel by 1.061in over its own 1 1/2in here. So the
       left board touches with its shallow corner and the right with its deep
       one, and placing both the same way drove one 1.061in into the joist. */
    const xs = (id: string) => byId(mitred, id)!.position.trapezoidCornersIn!.map((c) => c.xIn);
    for (const atEnd of ["start", "end"]) {
      expect(Math.min(...xs(`mitre-${atEnd}-plate-stud-left`)), atEnd).toBeCloseTo(JOIST_2X6_THICKNESS_IN, 9);
      expect(Math.max(...xs(`mitre-${atEnd}-plate-stud-right`)), atEnd).toBeCloseTo(
        ROOF.widthIn - JOIST_2X6_THICKNESS_IN,
        9,
      );
      /* Neither reaches past its joist into it. */
      expect(Math.max(...xs(`mitre-${atEnd}-plate-stud-left`)), atEnd).toBeLessThan(
        ROOF.widthIn - JOIST_2X6_THICKNESS_IN,
      );
      expect(Math.min(...xs(`mitre-${atEnd}-plate-stud-right`)), atEnd).toBeGreaterThan(JOIST_2X6_THICKNESS_IN);
    }
  });

  it("⚠ the plywood is OUTBOARD and its outer face IS the building's outline", () => {
    /* His 2026-11-05 rule, and here it is also the face the next facet's
       panel presses against. The skin's outer face sits exactly on the cut
       line — 21.477in of set-back at x = 0, nothing at x = 20.375 — and the
       2x4 is behind it, not beside it. */
    const skin = byId(mitred, "mitre-start-plate-skin")!;
    const outerAtX = (xIn: number) =>
      Math.min(
        ...skin
          .position.trapezoidCornersIn!.filter((c) => Math.abs(c.xIn - xIn) < 1e-9)
          .map((c) => plumbW(0, c.zIn)),
      );
    expect(outerAtX(0)).toBeCloseTo(MITRE.startNearIn, 6);
    expect(outerAtX(ROOF.widthIn)).toBeCloseTo(0, 6);

    const stud = byId(mitred, "mitre-start-plate-stud-left")!;
    const skinInner = Math.max(...skin.position.trapezoidCornersIn!.map((c) => plumbW(0, c.zIn) - 1.054 * 0));
    const studOuter = Math.min(...stud.position.trapezoidCornersIn!.map((c) => plumbW(0, c.zIn)));
    expect(studOuter).toBeLessThan(skinInner);
  });

  it("⚠ the face is PLUMB — the same plane the cut itself is on", () => {
    /* Not square to the roof surface. Across the panel's 15 1/2in depth a
       plumb face shifts 5.17in along the span at 4:12, and the plumb span of
       a given corner does not move at all. */
    const skin = byId(mitred, "mitre-start-plate-skin")!;
    const near = skin.position.trapezoidCornersIn!;
    const far = skin.position.trapezoidFarCornersIn!;
    for (const [i, c] of near.entries()) {
      expect(plumbW(ROOF.depthIn, far[i]!.zIn)).toBeCloseTo(plumbW(0, c.zIn), 9);
      /* And it really is leaning — if this were 0 the plate would be square
         to the panel and the test above would pass for the wrong reason. */
      expect(Math.abs(far[i]!.zIn - c.zIn)).toBeCloseTo(ROOF.depthIn * SLOPE, 9);
    }
  });

  it("⚠ DUAL BEVEL: the cut-list length is the CUT's length, not the panel's width", () => {
    /* The number a shop cuts the sheet to. A 46.51deg plan rake makes the cut
       face 29.604in across a 20.375in panel — state the width here and the
       sheet is 9in short while looking complete.

       ⚠ This is also why the plate is a TRAPEZOID prism rather than a section
       one: a section prism takes its extent across the panel from this very
       field, so `lengthIn` would have to be the width and the shop would lose
       the number. Built that way first, and the skin ran through both
       right-hand joists. */
    const skin = byId(mitred, "mitre-start-plate-skin")!;
    expect(skin.actualDimsIn.lengthIn).toBeCloseTo(29.6041, 4);
    expect(skin.actualDimsIn.lengthIn).toBeGreaterThan(ROOF.widthIn + 9);
    expect(skin.position.trapezoidCornersIn).toBeDefined();
  });

  it("⚠ THE STRUCTURE IS CUT 2 1/4in DEEPER, measured perpendicular to the face", () => {
    /* A lid occupies the last 2 1/4in of a square panel's span and the joists
       stop short of it. The mitred end does the same, or the plate is inside
       the joists -- measured, 47 pairs of members in the same volume on this
       panel when it was not.

       ⚠ PERPENDICULAR, not along the span: a plate on a double rake eats
       2.25 * 1.4907 = 3.354in of span for 2 1/4in of plate. Using 2.25 would
       leave every joist 1.1in long and back inside the plate. */
    const plan = planRoofMitreEndPlates(
      { ...ROOF, joistThicknessIn: JOIST_2X6_THICKNESS_IN },
      MITRE,
    );
    expect(plan.structuralMitre.startNearIn - MITRE.startNearIn).toBeCloseTo(3.3541, 4);
    expect(plan.structuralMitre.startFarIn - MITRE.startFarIn).toBeCloseTo(3.3541, 4);
    expect(MITRE_END_PLATE_THICKNESS_IN).toBe(2.25);

    /* And the joist really lands there: its cut end sits on the plate's inner
       face, at the deepened plane, flush. */
    const joist = byId(mitred, "joist-left-bottom")!;
    const joistStartW = Math.min(...joist.position.sectionCornersIn!.map((c) => plumbW(c.yIn, c.zIn)));
    expect(joistStartW).toBeCloseTo(MITRE.startNearIn + 3.3541, 3);
  });

  it("⚠ the original end lid is GONE, not left as a sliver beside the plate", () => {
    /* The assumption this part takes, pinned so it is a decision and not an
       accident: one plate for the end. At the shallow corner the old lid
       survives the saw almost intact, so keeping both would put two closures
       in the same place. */
    expect(square.some((m) => /^lid-start-/.test(m.memberId))).toBe(true);
    expect(mitred.filter((m) => /^lid-start-|^lid-end-/.test(m.memberId))).toEqual([]);
  });

  it("⚠ and NOTHING in the finished panel is in the same volume", () => {
    /* The standing rule, and the one that caught every wrong version of this
       part: the plate inside the joists (47 pairs), then the skin extruded to
       its cut length instead of the panel's width (19). */
    expect(overlappingMemberPairs(mitred)).toEqual([]);
  });

  it("⚠ and the SHOP SHEET reads sanely for every one of them", () => {
    /* The gate the browser was, now a test. A degenerate quad does not
       overlap anything and does not look wrong in a count — it shows up as a
       cut angle of exactly 90 degrees and a waste triangle whose length is
       `stockWidth * tan(90deg)`, i.e. 6.5e14 inches, printed on the sheet a
       shop builds from. */
    for (const row of computePanelCutList(mitred)) {
      if (!row.members.some((m) => /^mitre-/.test(m.memberId))) continue;
      const label = `${row.letter} ${row.partLabel}`;
      expect(row.angleLabel, label).not.toMatch(/90° off square/);
      expect(`${row.lengthLabel} ${row.cutNote ?? ""}`, label).not.toMatch(/\d{6}/);
    }
    /* All four studs cut the same way, so they are ONE lettered row — which
       is also how the degenerate pair gave themselves away: they split off
       into a row of their own. */
    const studRows = computePanelCutList(mitred).filter((r) =>
      r.members.every((m) => /plate-stud/.test(m.memberId)),
    );
    expect(studRows).toHaveLength(1);
    expect(studRows[0]!.qty).toBe(4);
  });

  it("a panel with no mitre gets no plate, and is byte for byte unchanged", () => {
    expect(buildFloorRoofPanelMembers({ ...ROOF, mitreIn: NO_FLOOR_ROOF_MITRE })).toEqual(square);
    const plan = planRoofMitreEndPlates(
      { ...ROOF, joistThicknessIn: JOIST_2X6_THICKNESS_IN },
      NO_FLOOR_ROOF_MITRE,
    );
    expect(plan.plates).toEqual([]);
    expect(plan.replacedEnds).toEqual([]);
    expect(plan.structuralMitre).toEqual(NO_FLOOR_ROOF_MITRE);
  });

  it("⚠ an end mitred at only ONE corner still gets a plate, running out to nothing", () => {
    /* Which is the common case on an octagon: a panel is cut at one end and
       square at the other, and cut at one corner and not the other. The plate
       follows the cut rather than appearing only where the set-back is deep. */
    const oneEnd = buildFloorRoofPanelMembers({
      ...ROOF,
      mitreIn: { startNearIn: 0, startFarIn: 12, endNearIn: 0, endFarIn: 0 },
    });
    expect(oneEnd.some((m) => m.memberId === "mitre-start-plate-skin")).toBe(true);
    /* The far end was not cut, so it keeps the lid it was built with. */
    expect(oneEnd.some((m) => /^mitre-end-plate-/.test(m.memberId))).toBe(false);
    expect(oneEnd.some((m) => /^lid-end-/.test(m.memberId))).toBe(true);
    expect(overlappingMemberPairs(oneEnd)).toEqual([]);
  });
});
