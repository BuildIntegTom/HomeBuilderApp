import { describe, expect, it } from "vitest";
import {
  MIN_MITRED_INTERIOR_LENGTH_IN,
  NO_PANEL_PLAN_MITRE,
  type PanelPlanMitre,
  gableGirtRowFitsMitredSpan,
  hasPanelPlanMitre,
  mitrePanelMembersInPlan,
  panelPlanMitreAngleDeg,
  panelPlanMitreClearXRangeIn,
  panelPlanMitreFits,
  panelPlanMitreForSpan,
  panelPlanMitreXRangeIn,
} from "./panelPlanMitre";
import {
  buildGablePanelMembers,
  buildGablePanelMembersReportingMitre,
} from "./gablePanelMembers";
import { membersOverlap } from "./memberPrism";
import { memberLocalCornersIn } from "./panelMemberHelpers";
import { computePanelCutList } from "./panelCutList";
import type { PanelMember } from "./componentSchema";

/* ──────────────────────────────────────────────────────────────────────────
   THE 22 1/2deg PLAN MITRE AT AN OCTAGON CORNER

   > *"The octagon Gable pieces need to be cut like octagon corners."* —
   > Tommy, 2026-11-16

   Every number here is the 16ft Octagon's own, derived rather than typed:
   a 15 1/2in wall at a 45deg turn rakes half of it and pulls its short face
   back `15.5 x tan(22.5deg)`.
   ────────────────────────────────────────────────────────────────────────── */

const DEPTH = 15.5;
/** Half of an octagon's 45deg turn — `cornerRakeRad`'s own rule. */
const RAKE_RAD = Math.PI / 8;
const PULL_BACK_IN = DEPTH * Math.tan(RAKE_RAD);
/** How far the cut has eaten at the two wythes' own depths — derived, so a
 *  mistyped decimal cannot pass for geometry. */
const AT_EXT_WYTHE_IN = 3.5 * Math.tan(RAKE_RAD);
const AT_INT_WYTHE_IN = 12 * Math.tan(RAKE_RAD);
/** A convex corner: the exterior face reaches the corner point, the interior
 *  pulls back. */
const startMitre: PanelPlanMitre = { startExtIn: 0, startIntIn: PULL_BACK_IN, endExtIn: 0, endIntIn: 0 };
const bothMitre: PanelPlanMitre = {
  startExtIn: 0,
  startIntIn: PULL_BACK_IN,
  endExtIn: 0,
  endIntIn: PULL_BACK_IN,
};

/** Is every corner of every member inside the panel's mitred plan outline?
 *
 * ⚠ The outline's constraint is LINEAR in (x, depth), and each member is a
 * convex solid, so testing its corners tests the whole solid. Corners in
 * VIEW space: x along the panel, y up, z through the depth. */
function membersInsideMitre(
  members: readonly PanelMember[],
  widthIn: number,
  depthIn: number,
  mitre: PanelPlanMitre,
  tolIn = 1e-6,
): { memberId: string; xIn: number; depthIn: number; byIn: number }[] {
  const out: { memberId: string; xIn: number; depthIn: number; byIn: number }[] = [];
  for (const member of members) {
    for (const [xIn, , zIn] of memberLocalCornersIn(member)) {
      const span = panelPlanMitreXRangeIn(mitre, widthIn, depthIn, zIn);
      const by = Math.max(span.startIn - xIn, xIn - span.endIn);
      if (by > tolIn) out.push({ memberId: member.memberId, xIn, depthIn: zIn, byIn: by });
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

describe("the mitre's own arithmetic", () => {
  it("an octagon corner rakes 22.50deg and pulls a 15 1/2in wall back 6.4203in", () => {
    expect((RAKE_RAD * 180) / Math.PI).toBeCloseTo(22.5, 10);
    expect(PULL_BACK_IN).toBeCloseTo(6.4203, 4);
    expect(panelPlanMitreAngleDeg(startMitre, DEPTH, "start")).toBeCloseTo(22.5, 9);
    expect(panelPlanMitreAngleDeg(startMitre, DEPTH, "end")).toBe(0);
  });

  it("the x window walks linearly through the wall's depth", () => {
    expect(panelPlanMitreXRangeIn(startMitre, 48, DEPTH, 0).startIn).toBeCloseTo(0, 12);
    expect(panelPlanMitreXRangeIn(startMitre, 48, DEPTH, DEPTH).startIn).toBeCloseTo(PULL_BACK_IN, 12);
    /* The two wythes, which is where the whole framing decision came from. */
    expect(AT_EXT_WYTHE_IN).toBeCloseTo(1.4497, 4);
    expect(AT_INT_WYTHE_IN).toBeCloseTo(4.9706, 4);
    expect(panelPlanMitreXRangeIn(startMitre, 48, DEPTH, 3.5).startIn).toBeCloseTo(AT_EXT_WYTHE_IN, 10);
    expect(panelPlanMitreXRangeIn(startMitre, 48, DEPTH, 12).startIn).toBeCloseTo(AT_INT_WYTHE_IN, 10);
    /* The far end is untouched on a tile mitred only at its start. */
    expect(panelPlanMitreXRangeIn(startMitre, 48, DEPTH, DEPTH).endIn).toBe(48);
  });

  it("a clear window is the INTERSECTION of a band's two faces, not their average", () => {
    const band = panelPlanMitreClearXRangeIn(startMitre, 48, DEPTH, 0, 3.5);
    expect(band.startIn).toBeCloseTo(AT_EXT_WYTHE_IN, 10);
    const deep = panelPlanMitreClearXRangeIn(startMitre, 48, DEPTH, 12, 15.5);
    expect(deep.startIn).toBeCloseTo(PULL_BACK_IN, 10);
  });

  it("all zeros is not a mitre", () => {
    expect(hasPanelPlanMitre(undefined)).toBe(false);
    expect(hasPanelPlanMitre(NO_PANEL_PLAN_MITRE)).toBe(false);
    expect(hasPanelPlanMitre(startMitre)).toBe(true);
  });
});

describe("⚠ the pass itself: which pieces take the cut and which slide", () => {
  /* ⚠ **This block exists because a mutation got through.** Removing `plate`
     from `roleTakesTheCut` changed nothing in any gable panel, because a
     gable's plates are already ended at their own post faces by
     `plateRunAtDepth` and so never reach the cut. His decision — *sheets and
     plates follow it* — is still the rule for a plate that DOES reach it (the
     ground story's corner panels are next in line), so the branch is tested
     directly on a hand-built panel rather than left as dead code. */
  const W = 48;
  const board = (
    memberId: string,
    role: PanelMember["role"],
    xIn: number,
    lengthIn: number,
    yIn: number,
    depthSpanIn: number,
  ): PanelMember => ({
    memberId,
    material: "dimensional_lumber",
    speciesGrade: "SPF-2",
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: 1.5, widthIn: depthSpanIn, lengthIn },
    orientation: "flat",
    position: { xIn, yIn, zIn: 0.75, rotationDeg: 0 },
    role,
    qty: 1,
  });

  it("a PLATE that reaches the cut is clipped on the angle, at each of its own faces", () => {
    const plate = board("plate_ext", "plate", 0, W, 0, 3.5);
    const { members, refusals } = mitrePanelMembersInPlan([plate], W, DEPTH, startMitre);
    expect(refusals).toEqual([]);
    const corners = memberLocalCornersIn(members[0]!);
    const nearX = corners.filter(([, , z]) => z < 1e-9).map(([x]) => x);
    const farX = corners.filter(([, , z]) => z > 3.5 - 1e-9).map(([x]) => x);
    expect(Math.min(...nearX)).toBeCloseTo(0, 9);
    expect(Math.min(...farX)).toBeCloseTo(AT_EXT_WYTHE_IN, 9);
    /* The long point is what the shop cuts to. */
    expect(members[0]!.actualDimsIn.lengthIn).toBeCloseTo(W, 9);
  });

  it("a STICK that reaches the cut slides in square, keeping its length", () => {
    const stud = board("stud_x", "stud", 0, 1.5, 0, 3.5);
    const { members } = mitrePanelMembersInPlan([stud], W, DEPTH, startMitre);
    const corners = memberLocalCornersIn(members[0]!);
    const xs = [...new Set(corners.map(([x]) => x.toFixed(9)))];
    expect(xs.length, "square: two distinct x").toBe(2);
    expect(Math.min(...corners.map(([x]) => x))).toBeCloseTo(AT_EXT_WYTHE_IN, 9);
    expect(members[0]!.actualDimsIn.lengthIn).toBe(1.5);
    expect(members[0]!.notes).toContain("clear the panel's mitred end");
  });

  it("a piece already clear of the cut comes back BY IDENTITY", () => {
    const clear = board("plate_mid", "plate", 20, 10, 0, 3.5);
    const { members } = mitrePanelMembersInPlan([clear], W, DEPTH, startMitre);
    expect(members[0]).toBe(clear);
  });

  it("a stick with nowhere left to stand is dropped and REPORTED", () => {
    /* A 2x4 in a window only 1in wide: there is no square position for it. */
    const narrow: PanelPlanMitre = { startExtIn: 23.5, startIntIn: 23.5, endExtIn: 23.5, endIntIn: 23.5 };
    const stud = board("stud_x", "stud", 0, 1.5, 0, 3.5);
    const { members, refusals } = mitrePanelMembersInPlan([stud], W, DEPTH, narrow);
    expect(members).toEqual([]);
    expect(refusals).toEqual([
      { memberId: "stud_x", reason: "no square position inside the mitre is wide enough for it" },
    ]);
  });
});

describe("⚠ only a tile that reaches a corner takes that corner's cut", () => {
  const wallMitre = bothMitre;
  it("the first and last tiles take one end each; the middle ones take none", () => {
    const wallLengthIn = 159;
    const spans: [number, number][] = [
      [0, 39.75],
      [39.75, 79.5],
      [79.5, 119.25],
      [119.25, 159],
    ];
    const got = spans.map(([a, b]) => panelPlanMitreForSpan(wallMitre, a, b, wallLengthIn));
    expect(got[0]).toEqual({ startExtIn: 0, startIntIn: PULL_BACK_IN, endExtIn: 0, endIntIn: 0 });
    expect(got[1]).toEqual(NO_PANEL_PLAN_MITRE);
    expect(got[2]).toEqual(NO_PANEL_PLAN_MITRE);
    expect(got[3]).toEqual({ startExtIn: 0, startIntIn: 0, endExtIn: 0, endIntIn: PULL_BACK_IN });
  });

  it("⚠ and the tiler's own 1/8in rounding does not lose the far corner", () => {
    /* Measured: the 16ft Octagon's diagonal facet is 79.550in and its row
       tiles to 79.500in, so the last tile stops 0.050in short. A tolerance of
       a thousandth left every diagonal facet unmitred at one end. */
    expect(panelPlanMitreForSpan(wallMitre, 39.75, 79.5, 79.55).endIntIn).toBeCloseTo(PULL_BACK_IN, 9);
    /* But a real inset — the truss plate's 5 1/2in is the smallest — is not
       swallowed. */
    expect(panelPlanMitreForSpan(wallMitre, 5.5, 74, 79.5).startIntIn).toBe(0);
    expect(panelPlanMitreForSpan(wallMitre, 5.5, 74, 79.5).endIntIn).toBe(0);
  });

  it("a single tile spanning the whole wall takes BOTH", () => {
    expect(panelPlanMitreForSpan(wallMitre, 0, 48, 48)).toEqual(wallMitre);
  });
});

describe("a gable tile with no mitre", () => {
  const shapes: [number, number, number][] = [
    [48, 96, 60],
    [39.75, 64, 40],
    [24, 12, 30],
    [48, 40, 40],
  ];
  it("is BYTE-IDENTICAL to the panel built before the mitre existed", () => {
    for (const [w, l, r] of shapes) {
      const plain = buildGablePanelMembers(w, DEPTH, l, r, false);
      expect(buildGablePanelMembers(w, DEPTH, l, r, false, undefined, 0, NO_PANEL_PLAN_MITRE), `${w}`).toEqual(plain);
      /* And with the compound bevel on as well, since the two compose. */
      const bevelled = buildGablePanelMembers(w, DEPTH, l, r, false, undefined, 3.6534);
      expect(
        buildGablePanelMembers(w, DEPTH, l, r, false, undefined, 3.6534, NO_PANEL_PLAN_MITRE),
        `${w} bevelled`,
      ).toEqual(bevelled);
    }
  });
});

describe("a gable tile mitred at one end", () => {
  const W = 39.75;
  const members = buildGablePanelMembers(W, DEPTH, 64, 40, false, undefined, 0, startMitre);
  const plain = buildGablePanelMembers(W, DEPTH, 64, 40, false);
  const byId = new Map(members.map((m) => [m.memberId, m]));
  const plainById = new Map(plain.map((m) => [m.memberId, m]));

  it("puts NO wood outside the mitred plan outline", () => {
    expect(membersInsideMitre(members, W, DEPTH, startMitre)).toEqual([]);
  });

  it("and the unmitred panel DOES, which is the defect", () => {
    const outside = membersInsideMitre(plain, W, DEPTH, startMitre);
    expect(outside.length).toBeGreaterThan(0);
    /* The worst offender reaches the full pull-back past the cut. */
    expect(Math.max(...outside.map((o) => o.byIn))).toBeCloseTo(PULL_BACK_IN, 6);
  });

  it("builds every member it built before — nothing is dropped", () => {
    expect(members.map((m) => m.memberId).sort()).toEqual(plain.map((m) => m.memberId).sort());
  });

  it("slides each wythe's end post by its OWN wythe's need, square-cut", () => {
    /* Corner studs are ordered [ext-left, ext-right, int-left, int-right]. */
    const extLeft = byId.get("stud_corner_1")!;
    const intLeft = byId.get("stud_corner_3")!;
    expect(extLeft.position.xIn).toBeCloseTo(AT_EXT_WYTHE_IN, 10);
    expect(intLeft.position.xIn).toBeCloseTo(PULL_BACK_IN, 9);
    /* Square: both of a post's depth faces end at the same x. */
    const xsOf = (m: PanelMember) => new Set(memberLocalCornersIn(m).map(([x]) => x.toFixed(9)));
    expect(xsOf(extLeft).size).toBe(2);
    expect(xsOf(intLeft).size).toBe(2);
    /* Still 1 1/2in thick — a slide takes nothing off the stock. */
    expect(extLeft.actualDimsIn.thicknessIn).toBe(plainById.get("stud_corner_1")!.actualDimsIn.thicknessIn);
    /* The far (square) end of the panel never moved. */
    expect(byId.get("stud_corner_2")!.position.xIn).toBe(plainById.get("stud_corner_2")!.position.xIn);
    expect(byId.get("stud_corner_4")!).toEqual(plainById.get("stud_corner_4")!);
  });

  it("⚠ re-reads the roof plane at the post's NEW x — the 0.34in that would be invisible", () => {
    const rake = (40 - 64) / W;
    /* ⚠ A 3/4in skin lying at the rake is THICKER than 3/4in measured
       vertically — `verticalForPerpendicularIn`. Dividing by the plane's own
       dip is the 2026-11-16 rule, and typing 0.75 here is how this assertion
       first disagreed with the builder by 0.126in. */
    const skinVerticalIn = 0.75 / Math.cos(Math.atan(Math.abs(rake)));
    for (const [id, atXIn] of [
      ["stud_corner_1", AT_EXT_WYTHE_IN],
      ["stud_corner_3", PULL_BACK_IN],
    ] as const) {
      const post = byId.get(id)!;
      const corners = post.position.trapezoidCornersIn!;
      const topZ = Math.max(...corners.map((c) => c.zIn));
      /* What the plane says at this post's own near x, less the top skin. */
      expect(topZ, id).toBeCloseTo(64 + rake * atXIn - skinVerticalIn, 9);
      /* And the stale reading — the height it had at x = 0 — is measurably
         different, so this assertion has teeth. */
      expect(Math.abs(topZ - (64 - skinVerticalIn)), id).toBeGreaterThan(0.3);
    }
  });

  it("⚠ ends each plate at its OWN post — a plate cannot reach the mitre face", () => {
    /* His answer was *sheets and plates follow it*; measured, a plate cannot.
       These plates are edge rails running BETWEEN the posts in the same height
       band, so a plate run out to the mitre would occupy the very wood its own
       end post stands in. Each butts its post, as it does at a square end —
       and the two wythes' plates are now different lengths. */
    for (const [id, postId] of [
      ["bottom_plate_2x4_ext", "stud_corner_1"],
      ["top_plate_2x4_ext", "stud_corner_1"],
      ["bottom_plate_2x4_int", "stud_corner_3"],
      ["top_plate_2x4_int", "stud_corner_3"],
    ] as const) {
      const plate = byId.get(id);
      const post = byId.get(postId);
      if (!plate || !post) continue;
      const plateLoX = Math.min(...memberLocalCornersIn(plate).map(([x]) => x));
      const postHiX = Math.max(...memberLocalCornersIn(post).map(([x]) => x));
      expect(plateLoX, id).toBeCloseTo(postHiX, 9);
    }
    /* And the interior pair really did move, by the full pull-back. */
    expect(
      Math.min(...memberLocalCornersIn(byId.get("bottom_plate_2x4_int")!).map(([x]) => x)) -
        Math.min(...memberLocalCornersIn(plainById.get("bottom_plate_2x4_int")!).map(([x]) => x)),
    ).toBeCloseTo(PULL_BACK_IN, 9);
  });

  it("cuts the two full-depth SHEETS on the angle — they are what reaches the corner", () => {
    for (const id of ["bottom_plate_skin", "top_plate_skin"] as const) {
      const skin = byId.get(id)!;
      const corners = memberLocalCornersIn(skin);
      const nearX = corners.filter(([, , z]) => z < 1e-9).map(([x]) => x);
      const farX = corners.filter(([, , z]) => z > DEPTH - 1e-9).map(([x]) => x);
      expect(Math.min(...nearX), `${id} exterior face`).toBeCloseTo(0, 9);
      expect(Math.min(...farX), `${id} interior face`).toBeCloseTo(PULL_BACK_IN, 9);
    }
    /* The long point is what the shop cuts to, so it does not shrink. */
    expect(byId.get("bottom_plate_skin")!.actualDimsIn.lengthIn).toBeCloseTo(W, 9);
  });

  it("stands the girt row's bar against the slid post's inner face", () => {
    const bar = byId.get("girt_1_bar_left");
    if (!bar) return;
    expect(bar.position.xIn).toBeCloseTo(PULL_BACK_IN + 1.5, 6);
    /* The interior post's own inner face, which is the relationship a square
       end already has. */
    expect(bar.position.xIn).toBeCloseTo(byId.get("stud_corner_3")!.position.xIn + 1.5, 6);
  });

  it("adds no two members sharing a volume", () => {
    const before = new Set(overlappingPairs(plain));
    expect(overlappingPairs(members).filter((p) => !before.has(p))).toEqual([]);
  });

  it("puts the plan angle on the cut list", () => {
    const rows = computePanelCutList(members);
    const mitred = rows.filter((r) => r.cutNote.includes("MITRED IN PLAN"));
    expect(mitred.length).toBeGreaterThan(0);
    expect(mitred.some((r) => r.angleLabel.includes("22.50") || r.angleLabel.includes("22½"))).toBe(true);
  });
});

describe("a gable tile mitred at BOTH ends", () => {
  it("is cut at each end independently", () => {
    const W = 48;
    const members = buildGablePanelMembers(W, DEPTH, 72, 72, false, undefined, 0, bothMitre);
    expect(membersInsideMitre(members, W, DEPTH, bothMitre)).toEqual([]);
    const byId = new Map(members.map((m) => [m.memberId, m]));
    expect(byId.get("stud_corner_3")!.position.xIn).toBeCloseTo(PULL_BACK_IN, 9);
    expect(byId.get("stud_corner_4")!.position.xIn).toBeCloseTo(W - PULL_BACK_IN - 1.5, 9);
    const before = new Set(overlappingPairs(buildGablePanelMembers(W, DEPTH, 72, 72, false)));
    expect(overlappingPairs(members).filter((p) => !before.has(p))).toEqual([]);
  });
});

describe("the mitre composes with the compound bevel", () => {
  it("a diagonal octagon facet takes both at once", () => {
    const W = 39.75;
    const crossRiseIn = DEPTH * (4 / 12) * Math.SQRT1_2;
    const members = buildGablePanelMembers(W, DEPTH, 64, 40, false, undefined, crossRiseIn, startMitre);
    expect(membersInsideMitre(members, W, DEPTH, startMitre)).toEqual([]);
    /* The bevel is still there: the top skin's two depth faces disagree in z
       by the cross rise. */
    const skin = members.find((m) => m.memberId === "top_plate_skin")!;
    const near = skin.position.trapezoidCornersIn!;
    const far = skin.position.trapezoidFarCornersIn!;
    /* ⚠ At the SAME x, which has to be the panel's square end: the two faces
       no longer span the same x range, so comparing their maxima would be
       reading the plan mitre and calling it the bevel. */
    const atW = (q: typeof near) =>
      Math.max(...q.filter((c) => Math.abs(c.xIn - W) < 1e-9).map((c) => c.zIn));
    expect(atW(far) - atW(near)).toBeCloseTo(crossRiseIn, 6);
    const before = new Set(
      overlappingPairs(buildGablePanelMembers(W, DEPTH, 64, 40, false, undefined, crossRiseIn)),
    );
    expect(overlappingPairs(members).filter((p) => !before.has(p))).toEqual([]);
  });
});

describe("⚠ a narrow tile keeps its mitre and gives up its GIRT ROW", () => {
  /* ⚠ **This was the other way round first, and it would have made his ask
     inert.** `panelPlanMitreFits` also demanded room for the girt row, which
     wanted about 24 1/3in — and the 16ft Octagon he asked about tiles its
     gable row into 19 7/8in panels, because the row takes a joint wherever
     the wall below has one. Every corner tile on that building refused. The
     girt row answers for itself now. */
  it("the mitre itself only needs room for the two end posts", () => {
    for (const W of [16, 20, 24, 30, 48]) {
      expect(panelPlanMitreFits(startMitre, W, DEPTH), `${W}`).toBe(true);
    }
    /* Below that there is no panel left to build. */
    expect(panelPlanMitreFits(bothMitre, 2 * PULL_BACK_IN + 1, DEPTH)).toBe(false);
    expect(buildGablePanelMembers(2 * PULL_BACK_IN + 1, DEPTH, 40, 40, false, undefined, 0, bothMitre)).toEqual(
      buildGablePanelMembers(2 * PULL_BACK_IN + 1, DEPTH, 40, 40, false),
    );
  });

  it("⚠ the 19 7/8in octagon tile: mitred, and its girt row is what goes", () => {
    const W = 19.875;
    const plain = buildGablePanelMembers(W, DEPTH, 96, 96, true, undefined, 0);
    const mitred = buildGablePanelMembers(W, DEPTH, 96, 96, true, undefined, 0, startMitre);
    /* The cut really happened. */
    expect(membersInsideMitre(mitred, W, DEPTH, startMitre)).toEqual([]);
    expect(membersInsideMitre(plain, W, DEPTH, startMitre).length).toBeGreaterThan(0);
    /* And the only thing missing is the girt row. */
    const lost = plain.map((m) => m.memberId).filter((id) => !mitred.some((m) => m.memberId === id));
    expect(lost.length).toBeGreaterThan(0);
    expect(lost.filter((id) => !id.startsWith("girt"))).toEqual([]);
    /* The span it would have had to fit into, and the nailer it would have
       hit — both measured rather than asserted in the abstract. */
    const clear = panelPlanMitreClearXRangeIn(startMitre, W, DEPTH, 0, DEPTH);
    expect(clear.startIn).toBeCloseTo(PULL_BACK_IN, 9);
    expect(gableGirtRowFitsMitredSpan(W, clear.startIn, clear.endIn, [[W / 2 - 1.75, W / 2 + 1.75]])).toBe(false);
    /* The clear span the row would have braced is 10 1/2in, well inside the
       36in his own girt rule names. */
    expect(clear.endIn - clear.startIn - 2 * 1.5).toBeCloseTo(10.455, 3);
    /* Nothing else moved: with no mitre the same tile keeps its row. */
    expect(gableGirtRowFitsMitredSpan(W, 0, W, [[W / 2 - 1.75, W / 2 + 1.75]])).toBe(true);
  });
});

describe("a sweep, because a dropped member is the failure that hides", () => {
  it("every tile the mitre FITS keeps all its members and stays inside the cut", () => {
    let fitted = 0;
    let refused = 0;
    /* 14in is in the sweep so the REFUSED half of it is real: both ends
       mitred leaves no interior face for the two posts to stand on. */
    for (const W of [14, 16, 19.875, 20, 24, 30, 36, 39.75, 42, 48]) {
      for (const [l, r] of [
        [96, 96],
        [96, 40],
        [40, 96],
        [64, 2],
        [2, 64],
        [12, 12],
      ] as [number, number][]) {
        for (const mitre of [startMitre, bothMitre]) {
          for (const crossRiseIn of [0, DEPTH * (4 / 12) * Math.SQRT1_2]) {
            const plainPanel = buildGablePanelMembers(W, DEPTH, l, r, true, undefined, crossRiseIn);
            const mitred = buildGablePanelMembers(W, DEPTH, l, r, true, undefined, crossRiseIn, mitre);
            const label = `W=${W} ${l}->${r} cross=${crossRiseIn.toFixed(2)} ends=${mitre === bothMitre ? 2 : 1}`;
            if (!panelPlanMitreFits(mitre, W, DEPTH)) {
              refused++;
              expect(mitred, label).toEqual(plainPanel);
              continue;
            }
            fitted++;
            /* ⚠ **Nothing is DROPPED by the cut**, which is the failure that
               hides: the panel still draws and still prices with a member
               missing. Read off the pass's own report rather than inferred. */
            expect(
              buildGablePanelMembersReportingMitre(W, DEPTH, l, r, true, undefined, crossRiseIn, mitre).refusals,
              `${label}: refusals`,
            ).toEqual([]);
            /* No member ever APPEARS, either. One may legitimately stop being
               built: a mitre shortens the plate run, so a tapering tile whose
               plates crossed inside the full run may not cross inside the
               short one, and its tapered `merged_plate` wedge is then simply
               not a part. That is the merge rule answering correctly for a
               shorter board, not the cut losing wood. */
            const mitredIds = new Set(mitred.map((m) => m.memberId));
            const plainIds = plainPanel.map((m) => m.memberId);
            expect([...mitredIds].filter((id) => !plainIds.includes(id)), `${label}: new members`).toEqual([]);
            /* Two kinds of member may legitimately stop being built, and
               nothing else may: the tapered `merged_plate` wedge (the plate
               run shortened, so the plates no longer cross inside it) and the
               whole GIRT ROW on a tile the mitre leaves too narrow for one. */
            expect(
              plainIds
                .filter((id) => !mitredIds.has(id))
                .filter((id) => !id.startsWith("merged_plate") && !id.startsWith("girt")),
              `${label}: lost members`,
            ).toEqual([]);
            expect(membersInsideMitre(mitred, W, DEPTH, mitre), `${label}: outside`).toEqual([]);
            /* Subset, not equality: on a tapering tile the cut REMOVES two
               pre-existing overlaps (the top skin running past the corner post
               at the feather edge). It must never add one. */
            const before = new Set(overlappingPairs(plainPanel));
            expect(overlappingPairs(mitred).filter((p) => !before.has(p)), `${label}: new overlaps`).toEqual([]);
          }
        }
      }
    }
    /* Both halves of the sweep are real, or the assertions above are vacuous. */
    expect(fitted).toBeGreaterThan(100);
    expect(refused).toBeGreaterThan(0);
  });
});
