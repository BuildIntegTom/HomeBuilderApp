import { describe, expect, it } from "vitest";

import {
  deckFieldWidthForStandardWidthIn,
  standardPanelWidthOptionsIn,
  looseDensePackWidthIn,
  squareBalePanel,
  FLOOR_ROOF_PANEL_WIDTH_IN,
  FLOOR_ROOF_EDGE_PANEL_WIDTH_IN,
  FLOOR_ROOF_MIN_PANEL_WIDTH_IN,
  planFloorRoofPanelWidthsIn,
  planFloorRoofPanelRun,
} from "./index";

/**
 * ⚠ **ONE DIAL FOR WALLS, FLOORS AND ROOFS — Tommy, 2026-11-19.**
 *
 * > *"when we change the standard panel size in the editor... can we have that
 * > effect floor, wall, and roof panels all the same? there should be some
 * > absorbing or something on the corners, but once panels can get back on
 * > track then floors, walls, and roof are all stacked structurally."*
 *
 * > *"snap the dial to 48, 39, 36, 32, 24"*
 *
 * The stacking rule is his own, from 2026-10-23: *"2' wide panels everywhere
 * else with 4' wall panels with a center nailer"*. It only ever held because
 * two separate constants happened to be 48 and 24; the dial moved one of them.
 */
describe("the standard width drives the deck module", () => {
  it("offers exactly the five he named, widest first", () => {
    expect([...standardPanelWidthOptionsIn.value]).toEqual([48, 39, 36, 32, 24]);
    expect(standardPanelWidthOptionsIn.status).toBe("confirmed");
    expect(standardPanelWidthOptionsIn.note).toContain("snap the dial to 48, 39, 36, 32, 24");
  });

  it("keeps the current default and the Square Bale width on the list", () => {
    /* 48 is the default, so the picker must not change a new project's width
       just by existing. 39 is the Square Bale panel's own width — two 18in
       bales plus two 1.5in studs — which is why that odd number is there. */
    expect(standardPanelWidthOptionsIn.value).toContain(looseDensePackWidthIn.value);
    expect(standardPanelWidthOptionsIn.value).toContain(squareBalePanel.widthIn);
  });

  it("⚠ makes a deck field panel exactly HALF a wall panel, at every setting", () => {
    /* This is the whole load-path claim: two deck panels per wall panel means
       a deck seam lands under either the wall panel's edge or its centre
       nailer. A rule that held only at 48 was not a rule. */
    for (const widthIn of standardPanelWidthOptionsIn.value) {
      expect(deckFieldWidthForStandardWidthIn(widthIn) * 2).toBeCloseTo(widthIn, 9);
    }
    /* And the default still lands exactly on the constant the app shipped
       with, so nothing moves on an untouched project. */
    expect(deckFieldWidthForStandardWidthIn(looseDensePackWidthIn.value)).toBe(FLOOR_ROOF_PANEL_WIDTH_IN);
  });

  it("⚠ every option leaves a deck panel above the fabrication minimum", () => {
    /* The narrowest option is 24in, giving 12in decks — exactly his stated
       minimum. Anything narrower on this list would make the planner refuse
       every run, which is a dial setting that breaks the building. */
    for (const widthIn of standardPanelWidthOptionsIn.value) {
      expect(deckFieldWidthForStandardWidthIn(widthIn)).toBeGreaterThanOrEqual(FLOOR_ROOF_MIN_PANEL_WIDTH_IN);
    }
  });

  it("⚠ names which options keep the 8ft sheet module, and does not pretend they all do", () => {
    /* Reported rather than prevented — the panels stack at all five, it is
       the sheathing seams that drift at two of them. The note has to say so,
       because the planner's own comment used to promise the opposite. */
    const divides = standardPanelWidthOptionsIn.value.filter(
      (w) => Math.abs(96 % deckFieldWidthForStandardWidthIn(w)) < 1e-9,
    );
    expect(divides).toEqual([48, 32, 24]);
    expect(standardPanelWidthOptionsIn.note).toContain("8ft plywood sheet");
  });
});

describe("planFloorRoofPanelWidthsIn takes the module", () => {
  const RUN = 24 * 12; // a 24ft run

  it("defaults to 24in, so every existing caller is byte-identical", () => {
    expect(planFloorRoofPanelWidthsIn(RUN)).toEqual(
      planFloorRoofPanelWidthsIn(RUN, FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, FLOOR_ROOF_PANEL_WIDTH_IN),
    );
  });

  it("⚠ actually lays the field at the module it is given", () => {
    for (const standardIn of standardPanelWidthOptionsIn.value) {
      const fieldIn = deckFieldWidthForStandardWidthIn(standardIn);
      const widths = planFloorRoofPanelWidthsIn(RUN, FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, fieldIn);
      expect(widths, `${standardIn}in`).not.toBeNull();
      if (widths === null) continue;
      /* Two edge panels, whatever the module. */
      expect(widths[0]).toBe(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN);
      expect(widths[widths.length - 1]).toBe(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN);
      /* ⚠ **Every field panel is EXACTLY the module except the last one**,
         which is the redistributed tail and is allowed to exceed it —
         `redistributeNarrowTail` pools a too-narrow closer backwards and may
         come back with one panel wider than the module rather than two under
         the minimum. Measured on this 24ft run: a 19.5in module ends 23in, a
         24in module ends 17in. A test that forbade that would be asserting
         against a rule the planner documents. */
      const field = widths.slice(1, -1);
      for (const w of field.slice(0, -1)) {
        expect(w, `${standardIn}in field panel`).toBeCloseTo(fieldIn, 9);
      }
      const tailIn = field[field.length - 1]!;
      expect(tailIn, `${standardIn}in tail`).toBeGreaterThanOrEqual(FLOOR_ROOF_MIN_PANEL_WIDTH_IN - 1e-9);
      expect(tailIn, `${standardIn}in tail`).toBeLessThan(2 * fieldIn);
      /* ⚠ His standing rule: the parts sum to the whole, exactly. */
      expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(RUN, 9);
    }
  });

  it("⚠ a narrower module makes MORE panels, which is how you know it took", () => {
    const at48 = planFloorRoofPanelWidthsIn(RUN, FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, 24)!;
    const at24 = planFloorRoofPanelWidthsIn(RUN, FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, 12)!;
    expect(at24.length).toBeGreaterThan(at48.length);
  });
});

describe("⚠ the module reaches the run planner, not just the width planner", () => {
  /* `planFloorRoofPanelRun` names each panel by comparing its width to the
     module. With the module hardcoded, every correctly-sized field panel on a
     non-default building came back as a "remainder" — a run of right-sized
     panels, every one labelled the odd one out, on the shop sheets and in the
     takeoff. Nothing below the roleOf line would have noticed. */
  const runFor = (fieldPanelWidthIn: number) =>
    planFloorRoofPanelRun({
      kind: "floor",
      runLengthIn: 24 * 12,
      spanIn: 16 * 12,
      depthIn: FLOOR_ROOF_EDGE_PANEL_WIDTH_IN,
      fieldPanelWidthIn,
    });

  it("names a panel at the given module a FIELD panel, not a remainder", () => {
    for (const standardIn of standardPanelWidthOptionsIn.value) {
      const fieldIn = deckFieldWidthForStandardWidthIn(standardIn);
      const plan = runFor(fieldIn);
      expect(plan.refusal, `${standardIn}in`).toBeNull();
      const fields = plan.instances.filter((i) => i.role === "field");
      /* Most of the run is field panels at exactly the module. */
      expect(fields.length, `${standardIn}in field count`).toBeGreaterThan(2);
      for (const i of fields) expect(i.widthIn, `${standardIn}in`).toBeCloseTo(fieldIn, 9);
      /* And the run really was laid at that module, not at the default. */
      const widest = Math.max(...plan.instances.filter((i) => i.role !== "edge").map((i) => i.widthIn));
      expect(widest, `${standardIn}in`).toBeLessThan(2 * fieldIn);
    }
  });

  it("⚠ a narrower module yields more panels THROUGH the run planner too", () => {
    expect(runFor(12).instances.length).toBeGreaterThan(runFor(24).instances.length);
  });
});

describe("⚠ redistribution uses the module it was given, swept not sampled", () => {
  /* A single run length proves nothing: the redistributed tail only DIFFERS
     between the real module and a hardcoded 24 at particular run lengths, and
     the 24ft case above is not one of them.

     ⚠ **The invariant is the ALGORITHM'S OWN RULE, not "every panel is the
     module".** Redistribution pools a too-narrow closer backwards and divides
     it into the MOST panels that are each still at or above the minimum — so
     the tail can be several equal panels, not one. Measured while writing
     this: a 106.5in run at a 24in module ends `...24, 13.75, 13.75`, which an
     "all but the last are the module" assertion called a failure and which is
     the planner working correctly.

     So the two properties that actually pin it: the tail panels are EQUAL and
     legal, and they could NOT have been split one further — `w*c/(c+1) < min`.
     A redistribution counting at the wrong module breaks the second: at a
     19.5in module it leaves a single 24in panel where two 12in panels were
     both legal and therefore preferred. */
  it("holds across every run length from 8 to 60ft, at every option", () => {
    for (const standardIn of standardPanelWidthOptionsIn.value) {
      const fieldIn = deckFieldWidthForStandardWidthIn(standardIn);
      for (let runIn = 8 * 12; runIn <= 60 * 12; runIn += 0.5) {
        const widths = planFloorRoofPanelWidthsIn(runIn, FLOOR_ROOF_EDGE_PANEL_WIDTH_IN, fieldIn);
        if (widths === null) continue;
        const where = `${standardIn}in @ ${runIn}in`;
        expect(widths[0], where).toBe(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN);
        expect(widths[widths.length - 1], where).toBe(FLOOR_ROOF_EDGE_PANEL_WIDTH_IN);
        expect(widths.reduce((a, b) => a + b, 0), where).toBeCloseTo(runIn, 6);

        const field = widths.slice(1, -1);
        if (field.length === 0) continue;
        /* The run-length panels at exactly the module form a PREFIX. */
        let cut = field.length;
        for (let i = 0; i < field.length; i++) {
          if (Math.abs(field[i]! - fieldIn) > 1e-9) {
            cut = i;
            break;
          }
        }
        const tail = field.slice(cut);
        for (const w of field.slice(0, cut)) expect(w, where).toBeCloseTo(fieldIn, 9);
        if (tail.length === 0) continue;
        /* Equal to one another, and every one a legal panel. */
        for (const w of tail) {
          expect(w, `${where} tail`).toBeCloseTo(tail[0]!, 6);
          expect(w, `${where} tail`).toBeGreaterThanOrEqual(FLOOR_ROOF_MIN_PANEL_WIDTH_IN - 1e-9);
        }
        /* ⚠ And NOT splittable one further — the property a wrong module
           breaks, because it picks the count off the wrong divisor. */
        const c = tail.length;
        /* ⚠ **NO EPSILON, AND THAT IS THE WHOLE TEST.** The planner accepts a
           division at exactly the minimum (its skip is `< MIN - 1e-9`), so a
           correct tail can never sit at `w*c/(c+1) == MIN` — it would have
           been split. A `+1e-9` tolerance here let exactly that case through,
           and it is the ONLY case where redistributing on the wrong module
           shows: at a 16in module a 24in pool is two legal 12s, and a
           redistribution counting at 24in leaves one 24in panel. */
        expect((tail[0]! * c) / (c + 1), `${where} tail could have been split further`).toBeLessThan(
          FLOOR_ROOF_MIN_PANEL_WIDTH_IN,
        );
      }
    }
  });
});
