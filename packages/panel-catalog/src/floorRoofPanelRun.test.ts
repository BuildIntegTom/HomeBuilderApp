import { describe, expect, it } from "vitest";
import {
  floorRoofPanelMinimumWidthIn,
  planFloorRoofPanelRun,
  type FloorRoofPanelRunOptions,
} from "./floorRoofPanelRun";
import { FLOOR_ROOF_EDGE_PANEL_WIDTH_IN } from "./floorRoofPanelMembers";

const floor = (over: Partial<FloorRoofPanelRunOptions> = {}): FloorRoofPanelRunOptions => ({
  kind: "floor",
  runLengthIn: 480,
  spanIn: 240,
  ...over,
});

describe("one building's worth of floor panels", () => {
  it("⚠ the panels fill the run EXACTLY, on every run from 27in to 60ft", () => {
    /* His standing rule, the one three overflow bugs came out of: a run's
       parts sum to the run, in whole eighths. Swept rather than spot-checked
       because the closer resets the drift every 8ft and an off-by-a-sixteenth
       would only show up at certain lengths. */
    for (let runIn = 27; runIn <= 720; runIn += 0.125) {
      const plan = planFloorRoofPanelRun(floor({ runLengthIn: runIn }));
      if (plan.refusal !== null) continue;
      const sum = plan.instances.reduce((a, i) => a + i.widthIn, 0);
      expect({ runIn, sum }).toEqual({ runIn, sum: runIn });
      // And every width is a whole eighth, so the shop can read it.
      for (const i of plan.instances) {
        expect({ runIn, id: i.name, eighths: Number.isInteger(i.widthIn * 8) }).toEqual({
          runIn,
          id: i.name,
          eighths: true,
        });
      }
    }
  });

  it("each panel's position is where the ones before it end", () => {
    const plan = planFloorRoofPanelRun(floor());
    let at = 0;
    for (const i of plan.instances) {
      expect({ id: i.name, atIn: i.atIn }).toEqual({ id: i.name, atIn: at });
      at += i.widthIn;
    }
  });

  it("groups account for every placed panel exactly once", () => {
    const plan = planFloorRoofPanelRun(floor());
    const grouped = plan.groups.flatMap((g) => g.instances.map((i) => i.name));
    expect(grouped.slice().sort()).toEqual(plan.instances.map((i) => i.name).sort());
    expect(new Set(grouped).size).toBe(plan.instances.length);
  });

  it("every panel in a group really is the same width", () => {
    const plan = planFloorRoofPanelRun(floor());
    for (const g of plan.groups) {
      for (const i of g.instances) expect({ g: g.key, w: i.widthIn }).toEqual({ g: g.key, w: g.widthIn });
    }
  });

  it("a 40ft run needs only four sheets to describe its whole floor", () => {
    /* The point of grouping: 26 placed panels, a handful of unique ones. */
    const plan = planFloorRoofPanelRun(floor());
    expect(plan.instances).toHaveLength(26);
    expect(plan.groups.length).toBeLessThan(6);
    expect(plan.groups[0]!.role).toBe("edge");
  });

  it("names run in order and never repeat", () => {
    const plan = planFloorRoofPanelRun(floor());
    expect(plan.instances.map((i) => i.name).slice(0, 3)).toEqual(["F1", "F2", "F3"]);
    expect(new Set(plan.instances.map((i) => i.name)).size).toBe(plan.instances.length);
    expect(planFloorRoofPanelRun(floor({ kind: "roof" })).instances[0]!.name).toBe("R1");
  });
});

describe("the plywood that ties the panels together", () => {
  it("the trimmed first sheet puts every sheet after it on a seam", () => {
    const plan = planFloorRoofPanelRun(floor());
    expect(plan.firstSheetWidthIn).toBe(90.25);
    // Which is a seam: the edge panel plus four field panels.
    const seams = new Set<number>();
    let at = 0;
    for (const i of plan.instances) {
      at += i.widthIn;
      seams.add(at);
    }
    expect(seams.has(plan.firstSheetWidthIn!)).toBe(true);
  });

  it("the sheet count actually covers the run", () => {
    for (const runIn of [120, 240, 360, 480, 600]) {
      const plan = planFloorRoofPanelRun(floor({ runLengthIn: runIn }));
      const covered = plan.firstSheetWidthIn! + (plan.sheetCount - 1) * 96;
      expect({ runIn, enough: covered >= runIn }).toEqual({ runIn, enough: true });
    }
  });
});

describe("⚠ what this plan will not pretend about", () => {
  it("refuses a run too short for its own two edge panels, in words", () => {
    const plan = planFloorRoofPanelRun(floor({ runLengthIn: 20 }));
    expect(plan.refusal).toContain("edge panels");
    expect(plan.instances).toHaveLength(0);
    expect(plan.groups).toHaveLength(0);
    // 26.5in is exactly the two edge panels, and that much IS buildable.
    const exact = planFloorRoofPanelRun(floor({ runLengthIn: 2 * FLOOR_ROOF_EDGE_PANEL_WIDTH_IN }));
    expect(exact.refusal).toBeNull();
    expect(exact.instances).toHaveLength(2);
  });

  it("⚠ the 20ft run that used to plan a 2 1/4in sliver now redistributes it", () => {
    /* This is the test that used to assert the sliver. A 240in run closed
       with a panel 2.25in wide — narrower than its own two joists, which
       measurably overlapped. Tommy, 2026-10-23: *"Real minimum is 12in for
       width, though it should Redistribute if not possible"*. */
    const plan = planFloorRoofPanelRun(floor({ runLengthIn: 240 }));
    expect(plan.narrowestWidthIn).toBe(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN);
    expect(Math.min(...plan.instances.slice(1, -1).map((i) => i.widthIn))).toBeGreaterThanOrEqual(12);
    expect(plan.impossiblePanels).toEqual([]);
    expect(plan.impossibleWarning).toBeNull();
    // Still exact, which is the whole point of redistributing rather than trimming.
    expect(plan.instances.reduce((a, i) => a + i.widthIn, 0)).toBe(240);
  });

  it("⚠ no run anywhere plans a panel under his 12in minimum", () => {
    /* Swept, because redistribution has to hold at every length, not at the
       handful anybody thinks to try. */
    for (let runIn = 26.5; runIn <= 900; runIn += 0.125) {
      const plan = planFloorRoofPanelRun(floor({ runLengthIn: runIn }));
      if (plan.refusal !== null) continue;
      const field = plan.instances.slice(1, -1);
      if (field.length === 0) continue;
      const narrowest = Math.min(...field.map((i) => i.widthIn));
      expect({ runIn, under12: narrowest < 12 - 1e-9 }).toEqual({ runIn, under12: false });
      expect({ runIn, impossible: plan.impossiblePanels.length }).toEqual({ runIn, impossible: 0 });
    }
  });

  it("the geometric minimum is now a backstop his 12in sits above", () => {
    /* floorRoofPanelMinimumWidthIn says what can physically hold together —
       3in for the joists alone, 7in once a structural girt's two 2x4s are in.
       Both are below 12, so his decision governs and this never fires. It is
       kept because it is measured off the members: if a member ever grows,
       the backstop moves with it and the 12in may stop being enough. */
    expect(floorRoofPanelMinimumWidthIn(false)).toBe(3);
    expect(floorRoofPanelMinimumWidthIn(true)).toBe(7);
    expect(floorRoofPanelMinimumWidthIn(true)).toBeLessThan(12);
  });

  it("a run with no building behind it says so instead of returning nothing", () => {
    expect(planFloorRoofPanelRun(floor({ runLengthIn: 0 })).refusal).toContain("no run or span");
    expect(planFloorRoofPanelRun(floor({ spanIn: 0 })).refusal).toContain("no run or span");
  });
});

describe("the members each sheet will print", () => {
  it("a floor panel carries a girt at both span ends by default", () => {
    const plan = planFloorRoofPanelRun(floor());
    const ids = plan.groups[0]!.members.map((m) => m.memberId);
    expect(ids.some((id) => id.startsWith("structural-girt-start"))).toBe(true);
    expect(ids.some((id) => id.startsWith("structural-girt-end"))).toBe(true);
  });

  it("⚠ a roof panel never carries a structural girt, whatever is asked for", () => {
    // "the roof panels do not need a structural girt" — so the option that
    // makes sense for a floor is overridden, not passed through.
    const plan = planFloorRoofPanelRun(floor({ kind: "roof", structuralGirtEnds: ["start", "end"] }));
    const ids = plan.groups[0]!.members.map((m) => m.memberId);
    expect(ids.filter((id) => id.startsWith("structural-girt-"))).toEqual([]);
  });

  it("a pitch buys the caps; without one there are none", () => {
    const capped = planFloorRoofPanelRun(floor({ kind: "roof", pitchIn12: 4 }));
    const bare = planFloorRoofPanelRun(floor({ kind: "roof" }));
    const caps = (plan: typeof capped) => plan.groups[0]!.members.filter((m) => m.memberId.startsWith("cap-"));
    expect(caps(capped).length).toBeGreaterThan(0);
    expect(caps(capped).some((m) => m.memberId.includes("eave"))).toBe(true);
    expect(caps(capped).some((m) => m.memberId.includes("ridge"))).toBe(true);
    expect(caps(bare)).toEqual([]);
  });

  it("the span the caller asks for is the length every member is cut to", () => {
    const plan = planFloorRoofPanelRun(floor({ spanIn: 180 }));
    const joists = plan.groups[0]!.members.filter((m) => m.memberId.startsWith("joist-"));
    expect(joists.length).toBeGreaterThan(0);
    // Less 2.25in of lid at each end, which the joists run between.
    for (const j of joists) expect(j.actualDimsIn.lengthIn).toBe(180 - 4.5);
  });
});
