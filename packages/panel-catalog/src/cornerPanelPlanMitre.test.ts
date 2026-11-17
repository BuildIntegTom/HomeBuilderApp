import { describe, expect, it } from "vitest";
import {
  NO_PANEL_PLAN_MITRE,
  type PanelPlanMitre,
  cornerPanelPlanMitre,
  panelPlanMitreXRangeIn,
} from "./panelPlanMitre";
import { buildCornerPanelMembers, cornerMitreDropsGirtRow } from "./cornerPanelMembers";
import { COLUMN_TOTAL_WIDTH_IN, buildColumnPanelMembers } from "./columnPanelMembers";
import {
  MAX_STUD_SPACING_IN,
  memberBoxIn,
  memberLocalCornersIn,
  nailerSlideClearOfGirtRowIn,
} from "./panelMemberHelpers";
import { membersOverlap } from "./memberPrism";
import { computePanelCutList } from "./panelCutList";
import type { PanelMember } from "./componentSchema";

/* ──────────────────────────────────────────────────────────────────────────
   THE GROUND STORY'S OWN 22 1/2deg CORNER MITRE

   The gable row was cut to the corner's bisector on 2026-11-16. This is the
   story below it, which had the identical defect: measured on the 16ft
   Octagon, two walls' panel runs share **99.51 in^2 of plan area at each of
   the eight corners** — `t^2 x tan(22.5deg)` — over the full height of the
   wall. Every octagon wall tiles
   `corner 25.5 | gap 0.5 | standard 28 | safety-oct-corner 25.5` from x = 0,
   so both end panels sit on the corner point.

   ⚠ The 2D plan has drawn that trapezoid since 2026-09 (`computeSlotRects`
   recedes a corner slot's interior edge by `thickness x tan(turn/2)`). The
   drawing was right and the part was not.
   ────────────────────────────────────────────────────────────────────────── */

const DEPTH = 15.5;
const HEIGHT = 120;
const RAKE_RAD = Math.PI / 8;
const PULL_BACK_IN = DEPTH * Math.tan(RAKE_RAD);
/** A corner panel is mitred at ONE end — the end that sits on the corner. */
const startMitre: PanelPlanMitre = { startExtIn: 0, startIntIn: PULL_BACK_IN, endExtIn: 0, endIntIn: 0 };
const endMitre: PanelPlanMitre = { startExtIn: 0, startIntIn: 0, endExtIn: 0, endIntIn: PULL_BACK_IN };

function outsideMitre(
  members: readonly PanelMember[],
  widthIn: number,
  mitre: PanelPlanMitre,
  tolIn = 1e-6,
): { memberId: string; byIn: number }[] {
  const out: { memberId: string; byIn: number }[] = [];
  for (const member of members) {
    for (const [xIn, , depthIn] of memberLocalCornersIn(member)) {
      const span = panelPlanMitreXRangeIn(mitre, widthIn, DEPTH, depthIn);
      const by = Math.max(span.startIn - xIn, xIn - span.endIn);
      if (by > tolIn) out.push({ memberId: member.memberId, byIn: by });
    }
  }
  return out;
}

function overlappingPairs(members: readonly PanelMember[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++)
      if (membersOverlap(members[i]!, members[j]!).overlaps)
        out.push(`${members[i]!.memberId} x ${members[j]!.memberId}`);
  return out;
}

const plain = buildCornerPanelMembers(DEPTH, HEIGHT, false, COLUMN_TOTAL_WIDTH_IN);
const mitred = buildCornerPanelMembers(DEPTH, HEIGHT, false, COLUMN_TOTAL_WIDTH_IN, undefined, startMitre);
const byId = new Map(mitred.map((m) => [m.memberId, m]));
const plainById = new Map(plain.map((m) => [m.memberId, m]));

describe("a corner panel with no mitre", () => {
  it("is BYTE-IDENTICAL to the panel built before this existed", () => {
    for (const widthIn of [COLUMN_TOTAL_WIDTH_IN, 24, 36, 48]) {
      expect(
        buildCornerPanelMembers(DEPTH, HEIGHT, true, widthIn, undefined, NO_PANEL_PLAN_MITRE),
        `${widthIn}`,
      ).toEqual(buildCornerPanelMembers(DEPTH, HEIGHT, true, widthIn));
    }
  });

  it("⚠ and a COLUMN panel is untouched, because it never sits on a corner", () => {
    expect(buildColumnPanelMembers(DEPTH, HEIGHT, true)).toEqual(buildColumnPanelMembers(DEPTH, HEIGHT, true));
    expect(buildColumnPanelMembers(DEPTH, HEIGHT, true).some((m) => m.position.trapezoidFarCornersIn)).toBe(false);
  });
});

describe("⚠ a corner panel mitred at the end that sits on the corner", () => {
  it("puts NO wood outside the cut", () => {
    expect(outsideMitre(mitred, COLUMN_TOTAL_WIDTH_IN, startMitre)).toEqual([]);
  });

  it("and the SQUARE panel does, which is the defect", () => {
    const outside = outsideMitre(plain, COLUMN_TOTAL_WIDTH_IN, startMitre);
    expect(outside.length).toBeGreaterThan(0);
    expect(Math.max(...outside.map((o) => o.byIn))).toBeCloseTo(PULL_BACK_IN, 6);
  });

  it("builds every member it built before — nothing is dropped", () => {
    expect(mitred.map((m) => m.memberId).sort()).toEqual(plain.map((m) => m.memberId).sort());
  });

  it("adds no two members sharing a volume", () => {
    const before = new Set(overlappingPairs(plain));
    expect(overlappingPairs(mitred).filter((p) => !before.has(p))).toEqual([]);
  });
});

describe("⚠ the side ply turns ONTO the cut — it is the panel's end face", () => {
  const sidePly = byId.get("side_ply_left")!;

  it("lies in the 22.50deg face instead of square to the wall", () => {
    const corners = memberLocalCornersIn(sidePly);
    const nearX = corners.filter(([, , z]) => z < 1e-9).map(([x]) => x);
    const farX = corners.filter(([, , z]) => z > DEPTH - 1e-9).map(([x]) => x);
    /* At the exterior face it still starts at the corner point; at the
       interior face it has moved the whole pull-back with the cut. */
    expect(Math.min(...nearX)).toBeCloseTo(0, 9);
    expect(Math.min(...farX)).toBeCloseTo(PULL_BACK_IN, 9);
  });

  it("⚠ is a DIFFERENT CUT SIZE: 16.78in across the face, not the wall's 15.5in", () => {
    /* The number a shop notices. A sheet lying on the rake spans
       `depth / cos(rake)`. */
    expect(sidePly.actualDimsIn.widthIn).toBeCloseTo(DEPTH / Math.cos(RAKE_RAD), 9);
    expect(sidePly.actualDimsIn.widthIn).toBeCloseTo(16.78, 2);
    expect(plainById.get("side_ply_left")!.actualDimsIn.widthIn).toBe(DEPTH);
    /* Its THICKNESS is unchanged — that is perpendicular to its own faces
       either way. */
    expect(sidePly.actualDimsIn.thicknessIn).toBe(plainById.get("side_ply_left")!.actualDimsIn.thicknessIn);
  });

  it("⚠ clipping it square would have left NOTHING at the interior face", () => {
    /* Why it turns rather than being cut: the square sheet is 3/4in wide at
       x 0, and at the interior face the cut does not start until 6.42in. */
    const square = plainById.get("side_ply_left")!;
    const squareFarX = memberLocalCornersIn(square)
      .filter(([, , z]) => z > DEPTH - 1e-9)
      .map(([x]) => x);
    expect(Math.max(...squareFarX)).toBeLessThan(PULL_BACK_IN);
  });

  it("the OTHER side ply is untouched — only one end sits on a corner", () => {
    expect(byId.get("side_ply_right")!).toEqual(plainById.get("side_ply_right")!);
  });
});

describe("⚠ each wythe's posts slide by their OWN wythe's need", () => {
  it("the exterior pair barely moves and the interior pair moves the lot", () => {
    /* ⚠ Measured from the CUT, then inboard of the side ply standing on it:
       a 3/4in sheet lying in a 22½° face eats `3/4 / cos(22½°)` of x, not
       3/4. A post clears its own wythe's DEEPEST face, so the exterior pair
       reads the cut at 3½in deep and the interior pair at the full 15½in. */
    const SIDE_PLY_ALONG_X_IN = 0.75 / Math.cos(RAKE_RAD);
    const cutAt = (depthIn: number) => depthIn * Math.tan(RAKE_RAD);
    const postX = (id: string) => Math.min(...memberLocalCornersIn(byId.get(id)!).map(([x]) => x));
    const extLeft = postX("stud_corner_1");
    const intLeft = postX("stud_corner_3");
    expect(extLeft).toBeCloseTo(cutAt(3.5) + SIDE_PLY_ALONG_X_IN, 6);
    expect(intLeft).toBeCloseTo(cutAt(DEPTH) + SIDE_PLY_ALONG_X_IN, 6);
    /* The two wythes' posts are nearly 5in apart, which is the whole point. */
    expect(intLeft - extLeft).toBeCloseTo(PULL_BACK_IN - cutAt(3.5), 6);
    expect(intLeft - extLeft).toBeGreaterThan(4.9);
  });

  it("posts stay SQUARE — two distinct x, not four", () => {
    for (const id of ["stud_corner_1", "stud_corner_3"]) {
      const xs = new Set(memberLocalCornersIn(byId.get(id)!).map(([x]) => x.toFixed(9)));
      expect(xs.size, id).toBe(2);
    }
  });
});

describe("⚠ the boards that run BETWEEN the posts end at them", () => {
  it("plates and blocking butt their own wythe's post, and the two wythes differ", () => {
    const loX = (id: string) => Math.min(...memberLocalCornersIn(byId.get(id)!).map(([x]) => x));
    const hiX = (id: string) => Math.max(...memberLocalCornersIn(byId.get(id)!).map(([x]) => x));
    expect(loX("bottom_plate_2x4_ext")).toBeCloseTo(hiX("stud_corner_1"), 6);
    expect(loX("bottom_plate_2x4_int")).toBeCloseTo(hiX("stud_corner_3"), 6);
    /* Different lengths, which is new for this part. */
    expect(byId.get("bottom_plate_2x4_int")!.actualDimsIn.lengthIn).toBeLessThan(
      byId.get("bottom_plate_2x4_ext")!.actualDimsIn.lengthIn,
    );
    const intBlocking = mitred.filter((m) => m.memberId.endsWith("_interior"));
    const extBlocking = mitred.filter((m) => m.memberId.endsWith("_exterior"));
    if (intBlocking.length > 0 && extBlocking.length > 0) {
      expect(intBlocking[0]!.actualDimsIn.lengthIn).toBeLessThan(extBlocking[0]!.actualDimsIn.lengthIn);
    }
  });
});

describe("the shop sheet says what changed", () => {
  it("carries the 22½° plan mitre on the pieces that take it", () => {
    const rows = computePanelCutList(mitred);
    const mitredRows = rows.filter((r) => r.cutNote.includes("MITRED IN PLAN"));
    expect(mitredRows.length).toBeGreaterThan(0);
    expect(mitredRows.some((r) => r.angleLabel.includes("22½"))).toBe(true);
    /* And an unmitred corner panel says nothing of the kind. */
    expect(computePanelCutList(plain).some((r) => r.cutNote.includes("MITRED IN PLAN"))).toBe(false);
  });
});

describe("mitred at the OTHER end, which is the far corner of the wall", () => {
  it("is the mirror image, and equally clean", () => {
    const other = buildCornerPanelMembers(DEPTH, HEIGHT, false, COLUMN_TOTAL_WIDTH_IN, undefined, endMitre);
    expect(outsideMitre(other, COLUMN_TOTAL_WIDTH_IN, endMitre)).toEqual([]);
    const before = new Set(overlappingPairs(plain));
    expect(overlappingPairs(other).filter((p) => !before.has(p))).toEqual([]);
    const sidePly = other.find((m) => m.memberId === "side_ply_right")!;
    expect(sidePly.actualDimsIn.widthIn).toBeCloseTo(DEPTH / Math.cos(RAKE_RAD), 9);
  });
});

describe("⚠ which END a corner slot takes, from its index alone", () => {
  const wallMitre: PanelPlanMitre = {
    startExtIn: 0,
    startIntIn: PULL_BACK_IN,
    endExtIn: 0,
    endIntIn: PULL_BACK_IN,
  };

  it("slot 0 takes the START corner and any other corner slot takes the END", () => {
    /* A corner-typed slot exists only at a wall END — the tiler emits two per
       wall on a mitred shape — so the index is enough and no caller has to
       carry a slot count. Measured on the 16ft Octagon, every wall is
       `corner | gap | standard | safety-oct-corner`. */
    expect(cornerPanelPlanMitre(wallMitre, 0)).toEqual({
      startExtIn: 0,
      startIntIn: PULL_BACK_IN,
      endExtIn: 0,
      endIntIn: 0,
    });
    for (const index of [1, 3, 7]) {
      expect(cornerPanelPlanMitre(wallMitre, index), String(index)).toEqual({
        startExtIn: 0,
        startIntIn: 0,
        endExtIn: 0,
        endIntIn: PULL_BACK_IN,
      });
    }
  });

  it("⚠ a right-angled building gets nothing, whatever the index", () => {
    for (const index of [0, 1, 5]) {
      expect(cornerPanelPlanMitre(NO_PANEL_PLAN_MITRE, index), String(index)).toEqual(NO_PANEL_PLAN_MITRE);
    }
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   THE CENTRE NAILER SLIDES CLEAR OF THE GIRT BAR THE MITRE MOVED

   Found by the length/height sweep (`memberOverlap.test.ts`) the same day the
   mitre shipped: a girt bar runs the FULL depth of the wall, so the cut drives
   it inboard by the whole pull-back, and on a 24in core that put it 1.232in
   into the centre nailer.

   The nailer is the piece that yields. It is a nailing surface Tommy had
   already said *should be able to slide on the wyth they are on*; a girt bar
   carries the row and has exactly one x at which a full-depth board clears a
   22 1/2deg face.
   ────────────────────────────────────────────────────────────────────────── */
describe("the centre nailer slides clear of a mitred girt bar", () => {
  const MITRE = startMitre;
  const boxOf = (members: readonly PanelMember[], id: string) => {
    const box = memberBoxIn(members.find((m) => m.memberId === id)!);
    return { fromIn: box.xFromIn, toIn: box.xToIn };
  };

  it("⚠ on a SQUARE panel it does not move at all — byte-identical", () => {
    const square = buildCornerPanelMembers(DEPTH, 96, true, COLUMN_TOTAL_WIDTH_IN);
    const withNoMitre = buildCornerPanelMembers(DEPTH, 96, true, COLUMN_TOTAL_WIDTH_IN, undefined, {
      ...NO_PANEL_PLAN_MITRE,
    });
    expect(withNoMitre).toEqual(square);
    const nailer = square.find((m) => m.memberId === "nailer")!;
    expect(nailer.notes).toContain("Centered on exterior wythe");
  });

  it("butts against the bar's inboard face, and nothing of it is left inside", () => {
    const members = buildCornerPanelMembers(DEPTH, 96, true, COLUMN_TOTAL_WIDTH_IN, undefined, MITRE);
    const bar = boxOf(members, "girt_1_bar_left");
    const nailer = boxOf(members, "nailer");
    /* Flush: the slide is derived from the same girt window the bar is, so
       this is an equality and not a tolerance. */
    expect(nailer.fromIn).toBeCloseTo(bar.toIn, 9);
    /* Both rows, since a nailer is full height and every row shares the x. */
    expect(boxOf(members, "girt_2_bar_left").toIn).toBeCloseTo(bar.toIn, 9);
    /* And it has actually MOVED — otherwise the assertion above could pass on
       a panel where the bar had not been driven inboard at all. */
    const square = boxOf(buildCornerPanelMembers(DEPTH, 96, true, COLUMN_TOTAL_WIDTH_IN), "nailer");
    expect(nailer.fromIn - square.fromIn).toBeGreaterThan(1);
  });

  it("the part carries the butt as an instruction, not a measurement to take", () => {
    const members = buildCornerPanelMembers(DEPTH, 96, true, COLUMN_TOTAL_WIDTH_IN, undefined, MITRE);
    const nailer = members.find((m) => m.memberId === "nailer")!;
    expect(nailer.notes).toContain("held against the inboard face of the girt bar");
    expect(nailer.notes).toContain("needs no measurement");
  });

  it("⚠ leaves both stud bays far inside the spacing rule", () => {
    const members = buildCornerPanelMembers(DEPTH, 96, true, COLUMN_TOTAL_WIDTH_IN, undefined, MITRE);
    const nailer = boxOf(members, "nailer");
    /* The exterior wythe's two posts, which are what a bay is measured
       between — stud_corner_1 and _2 are the y 0..3.5 pair. */
    const left = boxOf(members, "stud_corner_1");
    const right = boxOf(members, "stud_corner_2");
    for (const bayIn of [nailer.fromIn - left.toIn, right.fromIn - nailer.toIn]) {
      expect(bayIn).toBeGreaterThan(0);
      expect(bayIn).toBeLessThan(MAX_STUD_SPACING_IN);
    }
  });

  it("⚠ no girt bar is left overlapping the nailer, at any wall height", () => {
    for (const heightIn of [96, 108, 120, 144]) {
      const members = buildCornerPanelMembers(DEPTH, heightIn, true, COLUMN_TOTAL_WIDTH_IN, undefined, MITRE);
      const nailer = members.find((m) => m.memberId === "nailer")!;
      for (const bar of members.filter((m) => /^girt_\d+_bar_/.test(m.memberId))) {
        expect(membersOverlap(nailer, bar).overlaps, `${heightIn}in ${bar.memberId}`).toBe(false);
      }
    }
  });

  it("⚠ a RING row does not push the nailer — its rails are cut around it instead", () => {
    /* `cutRingGirtsAroundVerticals` is Tommy's own answer for a vertical
       crossing a ring: cut the rail, tie behind it. Only the members that are
       NOT cut can move the nailer, which for a ring is its 1 1/2in short end
       piece — and that one already clears. */
    const slide = nailerSlideClearOfGirtRowIn("ring", 24, 6.482, 23.938);
    expect(slide).toBe(0);
    expect(nailerSlideClearOfGirtRowIn("blocking", 24, 6.482, 23.938)).toBeGreaterThan(1);
  });

  it("⚠ returns null when the bay cannot hold a nailer at all", () => {
    /* Reachable: two bars fit in a 10in window and the nailer needs 13 1/2in,
       so a window between the two satisfies the row and starves the nailer.
       The builder's answer to a null is to drop the ROW — see below. */
    expect(nailerSlideClearOfGirtRowIn("blocking", 24, 8, 20)).toBeNull();
    expect(nailerSlideClearOfGirtRowIn("blocking", 24, 0, 13.4)).toBeNull();
    expect(nailerSlideClearOfGirtRowIn("blocking", 24, 0, 13.6)).not.toBeNull();
  });
});

/* ──────────────────────────────────────────────────────────────────────────
   AT THE WIDTH THE APP ACTUALLY BUILDS, THE GIRT ROW GOES

   ⚠ Found in the BROWSER, not here. A corner panel is **15 1/2in** wide
   (`cornerPanelWidthIn`), so its core is 14in, and a 22 1/2deg cut on a
   15 1/2in wall takes 6.482in of that. A row needs 10in of window and this
   one leaves 7.456in — so the two girt bars **overlapped each other by
   2.482in**, on every row, on all sixteen corner panels of an octagon. The
   Review Log reported it as `girt_1_bar_left x girt_1_bar_right`.

   ⚠ Every test in this file and in the sweep had built a **25 1/2in** panel —
   `COLUMN_TOTAL_WIDTH_IN`, the COLUMN's width and the one width a corner panel
   never has. A 25 1/2in core has room and shows nothing.
   ────────────────────────────────────────────────────────────────────────── */
describe("a mitred corner panel too narrow for a girt row gives up the row", () => {
  const APP_WIDTH_IN = 15.5;
  const girtIds = (members: readonly PanelMember[]) =>
    members.filter((m) => m.role === "girt" || m.role === "girt_web").map((m) => m.memberId);

  it("⚠ the 15 1/2in panel the app builds loses its rows, and keeps everything else", () => {
    const square = buildCornerPanelMembers(DEPTH, HEIGHT, true, APP_WIDTH_IN);
    const mitred = buildCornerPanelMembers(DEPTH, HEIGHT, true, APP_WIDTH_IN, undefined, startMitre);
    expect(girtIds(square).length).toBeGreaterThan(0);
    expect(girtIds(mitred)).toEqual([]);
    /* The nailer is NOT one of the casualties — with no row to clear it stays
       centred, which is the whole reason the row's fit and the nailer's room
       are decided together. */
    expect(mitred.some((m) => m.memberId === "nailer")).toBe(true);
    expect(mitred.find((m) => m.memberId === "nailer")!.notes).toContain("Centered on exterior wythe");
  });

  it("⚠ no two members share a volume on it, at any wall height", () => {
    for (const heightIn of [96, 120, 144]) {
      const members = buildCornerPanelMembers(DEPTH, heightIn, false, APP_WIDTH_IN, undefined, startMitre);
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          expect(
            membersOverlap(members[i]!, members[j]!).overlaps,
            `${heightIn}in ${members[i]!.memberId} x ${members[j]!.memberId}`,
          ).toBe(false);
    }
  });

  it("a WIDE mitred corner panel keeps its rows — the row is given up only where it cannot go", () => {
    const wide = buildCornerPanelMembers(DEPTH, HEIGHT, true, COLUMN_TOTAL_WIDTH_IN, undefined, startMitre);
    expect(girtIds(wide).length).toBeGreaterThan(0);
  });

  it("`cornerMitreDropsGirtRow` answers the Review Log's question by building both ways", () => {
    expect(cornerMitreDropsGirtRow(DEPTH, HEIGHT, true, APP_WIDTH_IN, undefined, startMitre)).toBe(true);
    /* The wide panel keeps its row, so there is nothing to report. */
    expect(cornerMitreDropsGirtRow(DEPTH, HEIGHT, true, COLUMN_TOTAL_WIDTH_IN, undefined, startMitre)).toBe(false);
    /* And a right-angled building never reports anything, at any width. */
    for (const w of [APP_WIDTH_IN, COLUMN_TOTAL_WIDTH_IN])
      expect(cornerMitreDropsGirtRow(DEPTH, HEIGHT, true, w, undefined, NO_PANEL_PLAN_MITRE), String(w)).toBe(false);
  });

  it("⚠ a square 15 1/2in panel is untouched — the row goes only because of the cut", () => {
    expect(
      buildCornerPanelMembers(DEPTH, HEIGHT, true, APP_WIDTH_IN, undefined, NO_PANEL_PLAN_MITRE),
    ).toEqual(buildCornerPanelMembers(DEPTH, HEIGHT, true, APP_WIDTH_IN));
  });
});
