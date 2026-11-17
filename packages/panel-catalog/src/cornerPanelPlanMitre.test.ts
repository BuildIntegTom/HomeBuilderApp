import { describe, expect, it } from "vitest";
import {
  NO_PANEL_PLAN_MITRE,
  type PanelPlanMitre,
  cornerPanelPlanMitre,
  panelPlanMitreXRangeIn,
} from "./panelPlanMitre";
import { buildCornerPanelMembers } from "./cornerPanelMembers";
import { COLUMN_TOTAL_WIDTH_IN, buildColumnPanelMembers } from "./columnPanelMembers";
import { memberLocalCornersIn } from "./panelMemberHelpers";
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
