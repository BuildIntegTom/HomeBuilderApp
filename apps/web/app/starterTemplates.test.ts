import { decideRoofForm } from "@building-integrity/panel-catalog";
import { gableEndWallIdsFor, isCourtyardFootprint } from "@building-integrity/geometry";
import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES, footprintForPlan, planOutlineLoopsFt, type StarterPlan } from "./starterTemplates";

const byId = (id: string) => STARTER_TEMPLATES.find((t) => t.id === id)!;
const planOf = (id: string, optionId?: string): StarterPlan => {
  const t = byId(id);
  return (optionId === undefined ? t.options[0]! : t.options.find((o) => o.id === optionId)!).plan;
};

/** The span a roof is decided across: the gable-end walls' own length. */
const gableSpanFt = (plan: StarterPlan): number => {
  const { footprint } = footprintForPlan(plan);
  const wallId = gableEndWallIdsFor(footprint)[0]!;
  const wall = footprint.walls.find((w) => w.id === wallId)!;
  return wall.lengthFt;
};

describe("the starter templates are his six", () => {
  it("lists exactly the six prefabs he named, in his order", () => {
    expect(STARTER_TEMPLATES.map((t) => t.id)).toEqual([
      "tiny-house",
      "the-tank",
      "octagon",
      "the-cindy",
      "square-courtyard",
      "octagon-courtyard",
    ]);
  });

  it("⚠ carries NO roof, thickness-by-default, girt style, brace pattern or panel width", () => {
    /* A template is a recipe, not a frozen project. The only key here that is
       not geometry is `thicknessIn`, and only the Cindy has one because only
       the Cindy has a thickness of his. Everything else comes from the app's
       own live defaults at the moment the tile is picked — which is the only
       way a template cannot go stale against a default that later moves. */
    for (const t of STARTER_TEMPLATES) {
      for (const o of t.options) {
        expect(Object.keys(o.plan).sort()).toEqual(
          t.id === "the-cindy"
            ? ["depthFt", "shape", "thicknessIn", "widthFt"]
            : o.plan.courtyardBuildingWidthFt !== undefined
              ? ["courtyardBuildingWidthFt", "depthFt", "shape", "widthFt"]
              : ["depthFt", "shape", "widthFt"],
        );
      }
    }
  });
});

describe("⚠ his two roofs fall out of his own dimensions — nothing sets them", () => {
  it("the Tiny House's 16ft span is inside one panel run, so it is a SHED", () => {
    /* *"Tiny House (16x24' shed roof with tall north wall)"*. The tile stores
       24 x 16 and the short walls are therefore the 16ft pair — which is what
       `decideRoofForm` reads. If anyone ever swaps the two numbers this test
       fails, and it should: entered the other way round it is a gable. */
    expect(gableSpanFt(planOf("tiny-house"))).toBe(16);
    expect(decideRoofForm({ buildingWidthIn: 16 * 12, pitchIn12: 4 }).kind).toBe("shed");
  });

  it("⚠ and it is WIDER than it is deep, which is what puts the tall side north", () => {
    /* `simpleRoofPlanes` only applies "tall side north" when the ridge axis
       runs east-west, i.e. when the building is not longer north-to-south.
       Deep-and-narrow, the same shed falls WEST and he gets a different
       building than the one he named. */
    const plan = planOf("tiny-house");
    expect(plan.widthFt).toBeGreaterThanOrEqual(plan.depthFt);
  });

  it("the Tank's 24ft span is past what a run reaches, so it is a PEAK", () => {
    expect(gableSpanFt(planOf("the-tank"))).toBe(24);
    expect(decideRoofForm({ buildingWidthIn: 24 * 12, pitchIn12: 4 }).kind).not.toBe("shed");
  });
});

describe("the Cindy", () => {
  it("is 55'-3\" x 34'-10\", the two numbers both his perimeter chains close on", () => {
    const plan = planOf("the-cindy");
    expect(plan.widthFt).toBeCloseTo(55.25, 6);
    expect(plan.depthFt).toBeCloseTo(34 + 10 / 12, 6);
    /* 34'-10" is 418in, which his own plan states as a figure as well as a
       chain — the check that makes these measurements rather than a reading. */
    expect(plan.depthFt * 12).toBeCloseTo(418, 6);
  });

  it("is 15.5in thick, his call, and is the only tile that states a thickness", () => {
    expect(planOf("the-cindy").thicknessIn).toBe(15.5);
    for (const t of STARTER_TEMPLATES) {
      if (t.id === "the-cindy") continue;
      for (const o of t.options) expect(o.plan.thicknessIn).toBeUndefined();
    }
  });

  it("⚠ is a plain RECTANGLE — the notch and the step are deferred, not guessed", () => {
    /* His standing rule is that a wall length is exact. A rectangle at his two
       overall dimensions is a true simplification; a notch at invented lengths
       would be a false building. Four walls is what says so. */
    const { footprint } = footprintForPlan(planOf("the-cindy"));
    expect(footprint.walls).toHaveLength(4);
  });
});

describe("the octagon tile carries his two sub-options", () => {
  it("offers 16 ft and 32 ft on ONE tile", () => {
    expect(byId("octagon").options.map((o) => o.id)).toEqual(["16", "32"]);
  });

  it("builds a real eight-walled footprint at each", () => {
    for (const option of byId("octagon").options) {
      expect(footprintForPlan(option.plan).footprint.walls).toHaveLength(8);
    }
  });
});

describe("the two courtyard tiles really make rings", () => {
  it("both produce a two-loop footprint, and neither is refused", () => {
    for (const id of ["square-courtyard", "octagon-courtyard"]) {
      const { footprint, courtyardRefused } = footprintForPlan(planOf(id));
      expect(courtyardRefused).toBe(false);
      expect(isCourtyardFootprint(footprint)).toBe(true);
    }
  });

  it("⚠ the width on the tile is the BUILDING's, not the courtyard's", () => {
    /* `CourtyardPanel`'s own convention, and its reason holds here: "a 40ft
       courtyard inside an octagon is 40ft across which way?" A 40ft square at
       12ft deep therefore leaves a 16ft court, not a 40ft one. */
    const loops = planOutlineLoopsFt(planOf("square-courtyard"));
    expect(loops).toHaveLength(2);
    const span = (points: { x: number; y: number }[]) =>
      Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    expect(span(loops[0]!)).toBeCloseTo(40, 6);
    expect(span(loops[1]!)).toBeCloseTo(40 - 2 * 12, 6);
  });

  it("no tile BUT the courtyard pair draws a second loop", () => {
    for (const t of STARTER_TEMPLATES) {
      if (t.id.includes("courtyard")) continue;
      for (const o of t.options) expect(planOutlineLoopsFt(o.plan)).toHaveLength(1);
    }
  });
});

describe("the tile's picture is a drawing of the tile's own building", () => {
  it("every option produces an outline with at least three points per loop", () => {
    for (const t of STARTER_TEMPLATES) {
      for (const o of t.options) {
        const loops = planOutlineLoopsFt(o.plan);
        expect(loops.length).toBeGreaterThan(0);
        for (const loop of loops) expect(loop.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("⚠ comes from the SAME footprint the tile commits, not a parallel drawing", () => {
    /* The point of routing the preview through `footprintForPlan` rather than
       re-deriving corners: a picture built a second way can show a building
       the click does not produce, and nobody would notice until a client did. */
    const plan = planOf("octagon", "32");
    const { footprint } = footprintForPlan(plan);
    expect(planOutlineLoopsFt(plan)[0]).toHaveLength(footprint.walls.length);
  });
});
