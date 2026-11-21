import { describe, expect, it } from "vitest";
import {
  DEFAULT_GIRT_STYLE,
  GIRT_WEB_PLY_SPEC,
  GIRT_WEB_THICKNESS_IN,
  GIRT_WEB_THICK_PLY_SPEC,
  GIRT_WEB_THICK_THICKNESS_IN,
  LEGACY_GIRT_STYLE,
  LUMBER_2X6_WIDTH_IN,
  PLATE_2X4_THICKNESS_IN,
  computePlywoodAreaSqFt,
  girtHalfHeightIn,
  girtRowTopAboveCentreIn,
  memberBoxSizeIn,
} from "./panelMemberHelpers";
import { overlappingMemberPairs } from "./memberPrism";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { buildBracedPanelMembers } from "./bracedPanelMembers";

/**
 * ⚠ **The girt is a STYLE now**, and these tests are about the two things that
 * must stay true while it changes.
 *
 * > *"Girts should have a couple options in the panel settings just like the
 * > bracing/nailer styles — Ring Girts (as seen in the square bale
 * > panelizer), Web Girts (a piece of 3/4" plywood and two 2x4s), and
 * > Blocking (instead of plywood, it's a 2x6 — I would like this to be the
 * > default setting actually, it's what I'm currently doing in the shop. The
 * > 2x6 is centered in the panel depth with two 2x4s."* — Tommy, 2026-11-03
 *
 * 1. Nothing a brace, a sheet or a stud is measured from may move. The styles
 *    differ in ONE member, and the bars are byte-identical across them.
 * 2. The new member has to be buildable: no overlaps, inside the panel.
 */

const WIDTH_IN = 48;
const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;

const panel = (style: Parameters<typeof buildStandardPanelMembers>[4]) =>
  buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, style);

describe("girt styles", () => {
  it("his default is Blocking — it is what the shop is doing today", () => {
    expect(DEFAULT_GIRT_STYLE).toBe("blocking");
    /* ⚠ And the BUILDER's own fallback is deliberately NOT that. A call site
       that has not been taught about styles keeps drawing what it always drew
       (a stale picture) rather than a panel nobody chose (a wrong one) — the
       `braceFigure` lesson, where a two-field `Pick` silently built every shop
       sheet at the default figure. */
    expect(LEGACY_GIRT_STYLE).toBe("web");
    expect(panel(undefined)).toEqual(panel("web"));
  });

  it("⚠ the two styles differ in EXACTLY one member — the bars do not move", () => {
    /* This is the load-bearing claim. A brace's low point rides the girt bar's
       TOP face (his 2026-10-13 rule), so a style that moved a bar by even a
       quarter inch would silently re-cut every diagonal in the building. */
    const web = panel("web");
    const blocking = panel("blocking");
    expect(blocking.length).toBe(web.length);

    const bars = (ms: typeof web) => ms.filter((m) => m.role === "girt");
    expect(bars(blocking)).toEqual(bars(web));

    const differing = web.filter((w) => !blocking.some((b) => JSON.stringify(b) === JSON.stringify(w)));
    expect(differing.map((m) => m.memberId).sort()).toEqual(["girt_1_web", "girt_2_web"]);
  });

  it("the Blocking member is a 2x6 laid flat, centred in the panel depth", () => {
    const blocking = panel("blocking").filter((m) => m.memberId.endsWith("_blocking"));
    expect(blocking.length).toBe(2);
    for (const m of blocking) {
      expect(m.nominalSize).toBe("2x6");
      expect(m.material).toBe("dimensional_lumber");
      const box = memberBoxSizeIn(m);
      // 5.5in through the DEPTH, 1.5in standing up — "centered in the panel depth".
      expect(box.yIn).toBeCloseTo(LUMBER_2X6_WIDTH_IN, 9);
      expect(box.zIn).toBeCloseTo(PLATE_2X4_THICKNESS_IN, 9);
      // Centred: the same clearance to each face of the panel.
      expect(m.position.yIn).toBeCloseTo(DEPTH_IN / 2 - LUMBER_2X6_WIDTH_IN / 2, 9);
      expect(DEPTH_IN - (m.position.yIn + box.yIn)).toBeCloseTo(m.position.yIn, 9);
    }
  });

  it("it rests on the bars at exactly the height the web did", () => {
    const webZ = panel("web")
      .filter((m) => m.memberId.endsWith("_web"))
      .map((m) => m.position.zIn);
    const blockingZ = panel("blocking")
      .filter((m) => m.memberId.endsWith("_blocking"))
      .map((m) => m.position.zIn);
    expect(blockingZ).toEqual(webZ);
  });

  it("⚠ a Blocking panel has no overlapping members — his standing rule", () => {
    /* The 2x6 is deeper than nothing else in the panel is: at y 5.0-10.5 on a
       15.5in panel it has to clear BOTH centre nailer studs (y 0-3.5 and
       12-15.5) and all four corner studs. A 48in panel carries a centre nailer,
       so this is the case that would catch it. */
    expect(overlappingMemberPairs(panel("blocking"))).toEqual([]);
    expect(overlappingMemberPairs(buildStandardPanelMembers(96, DEPTH_IN, HEIGHT_IN, false, "blocking"))).toEqual([]);
    /* A braced panel the same way: its chevron's two legs already meet the
       centre connector, at every girt style, so the claim here is the DELTA. */
    const braced = (style: Parameters<typeof buildStandardPanelMembers>[4]) =>
      overlappingMemberPairs(buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", false, false, style));
    expect(braced("blocking")).toEqual(braced("web"));

    /* ⚠ **With the NAILER on, a panel already overlaps — and it is not this
       change.** `nailer x bottom_plate_2x4_ext` and `nailer x stud_centre_N_exterior`
       are reported identically at every girt style, so they are one of the
       causes the no-overlap audit still has open, not something Blocking
       introduced. Asserted as a DELTA rather than silently skipped: swapping
       the girt style adds nothing. */
    const nailed = (style: Parameters<typeof buildStandardPanelMembers>[4]) =>
      overlappingMemberPairs(buildStandardPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, true, style));
    expect(nailed("blocking")).toEqual(nailed("web"));
    /* ⚠ **Was two, is one — B31, 2026-11-06, and going down still gets
       recorded.** `bottom_plate_2x4_ext x nailer` is fixed: the optional
       nailer used to start at the skin's top face and run through the plate
       above it, where his own reference BOM has always cut it at plate face to
       plate face (115.5in on a 120in panel). What is left is the real
       question, and it is a building one: on any panel wide enough to carry a
       centre nailer stud, the OPTIONAL nailer lands in exactly the same place
       — the same board asked for twice, not two boards fighting. */
    expect(nailed("web")).toEqual(["stud_centre_1_exterior x nailer"]);
  });

  it("the plywood leaves the totals and the lumber takes its place", () => {
    /* The point of the style reaching the one member list: a Blocking project
       orders a 2x6 and does NOT order the half-inch sheet. */
    const web = panel("web");
    const blocking = panel("blocking");
    expect(computePlywoodAreaSqFt(web, 0.5)).toBeGreaterThan(0);
    expect(computePlywoodAreaSqFt(blocking, 0.5)).toBe(0);
    // And the 3/4in skins are untouched by any of it.
    expect(computePlywoodAreaSqFt(blocking, 0.75)).toBeCloseTo(computePlywoodAreaSqFt(web, 0.75), 9);
  });

  it("⚠ Ring IS built now, and is nothing like the other two", () => {
    /* This test used to pin the fallback — `panel("ring")` equalling
       `panel("web")` — with a note saying it would fail the day a ring was
       built properly. B31 built it, so here is the day. See `ringGirts.test.ts`
       for the geometry; what belongs HERE is that the three styles are three
       different panels and that only a ring dispenses with the infill. */
    expect(panel("ring")).not.toEqual(panel("web"));
    expect(panel("ring").filter((m) => m.role === "girt_web")).toEqual([]);
    expect(panel("web").filter((m) => m.role === "girt_web").length).toBeGreaterThan(0);
    expect(panel("blocking").filter((m) => m.memberId.includes("blocking")).length).toBeGreaterThan(0);
    /* ⚠ A ring orders no sheet goods for its girts either — the same claim the
       Blocking test above makes, and the reason the style reaches the member
       list rather than only the drawing. */
    expect(computePlywoodAreaSqFt(panel("ring"), 0.5)).toBe(0);
  });
});

describe("the 3/4in web option (2026-11-20)", () => {
  /* > "Default girts should be made out of 2x4s with a 2x6 spanning the width
     > of the panel. No plywood in the default girt. 3/4 in and 1/2 in should
     > be options to replace the 2x6."  — Tommy, 2026-11-20

     The first half confirmed what was already built. The second half settled a
     real contradiction: his 2026-11-03 description of Web Girts said 3/4in
     plywood, and the confirmed Panel Set 1 BOM says 1/2in, so the single "Web
     Girts" button had been building a sheet he had not described. The answer
     was both, as two options. */

  it("⚠ leaves the 1/2in web and the default BYTE-IDENTICAL", () => {
    /* The whole reason `web` keeps meaning 1/2in. Every stored project, every
       sheet already cut and every price already quoted has to be unmoved by
       adding an option beside it. */
    expect(DEFAULT_GIRT_STYLE).toBe("blocking");
    expect(LEGACY_GIRT_STYLE).toBe("web");
    const web = panel("web");
    expect(web.filter((m) => m.memberId.endsWith("_web")).map((m) => m.plySpec)).toEqual([
      GIRT_WEB_PLY_SPEC,
      GIRT_WEB_PLY_SPEC,
    ]);
    for (const m of web.filter((x) => x.memberId.endsWith("_web"))) {
      expect(m.actualDimsIn.thicknessIn).toBeCloseTo(GIRT_WEB_THICKNESS_IN, 9);
    }
  });

  it("differs from the 1/2in web in exactly the sheet, and nowhere else", () => {
    const thin = panel("web");
    const thick = panel("web34");
    expect(thick.length).toBe(thin.length);
    /* The bars are the load-bearing claim again: a brace's low point rides a
       bar's top face, so a style that moved a bar would re-cut every diagonal
       in the building. */
    const bars = (ms: typeof thin) => ms.filter((m) => m.role === "girt");
    expect(bars(thick)).toEqual(bars(thin));
    const differing = thick.filter((t) => !thin.some((n) => JSON.stringify(n) === JSON.stringify(t)));
    expect(differing.map((m) => m.memberId).sort()).toEqual(["girt_1_web", "girt_2_web"]);
    for (const m of differing) {
      expect(m.plySpec).toBe(GIRT_WEB_THICK_PLY_SPEC);
      expect(m.actualDimsIn.thicknessIn).toBeCloseTo(GIRT_WEB_THICK_THICKNESS_IN, 9);
      expect(m.material).toBe("plywood");
    }
  });

  it("⚠ does NOT move a brace — a diagonal rides the BAR's top face, not the web's", () => {
    /* ⚠ **This test was written asserting the opposite and was wrong.** His
       2026-10-13 rule is that "the brace low point rides the girt bar TOP
       face", and the bar is the same 1 1/2in board under all three bar-pair
       styles — the web rests ON the bars, above where the brace lands. So
       `girtHalfHeightIn` (what the braces read) is thickness-blind, while
       `girtRowTopAboveCentreIn` (what the gable girt plan reads) is not. A
       ring moves a brace because its members stand ON EDGE; a thicker sheet
       does not, because it is not what the brace is sitting on.

       Worth keeping as a test rather than deleting: "the two webs swap without
       re-cutting a single diagonal" is the reason this option is cheap to
       offer, and it would be easy to break by wiring braces to the wrong
       helper. */
    const braced = (style: Parameters<typeof buildBracedPanelMembers>[7]) =>
      buildBracedPanelMembers(WIDTH_IN, DEPTH_IN, HEIGHT_IN, false, "chevron", false, false, style)
        .filter((m) => m.role === "brace");
    expect(braced("web34")).toEqual(braced("web"));
    expect(girtHalfHeightIn("web34")).toBe(girtHalfHeightIn("web"));
  });

  it("⚠ DOES raise the row's overall top by the extra 1/4in, where the gable reads it", () => {
    /* The difference the thicker sheet really makes: `girtRowTopAboveCentreIn`
       is how tall the finished row is above its centre, and `gableGirtPlan`
       uses it to decide whether a row fits under a sloped plate. A 3/4in web
       makes the row 1/4in taller, so a gable tile that just fits a 1/2in row
       may not fit this one. */
    expect(girtRowTopAboveCentreIn("web34") - girtRowTopAboveCentreIn("web")).toBeCloseTo(
      GIRT_WEB_THICK_THICKNESS_IN - GIRT_WEB_THICKNESS_IN,
      9,
    );
    expect(girtRowTopAboveCentreIn("web34")).toBeGreaterThan(girtRowTopAboveCentreIn("web"));
    /* And the blocking row is taller than either, being a 1 1/2in board. */
    expect(girtRowTopAboveCentreIn("blocking")).toBeGreaterThan(girtRowTopAboveCentreIn("web34"));
  });

  it("⚠ both webs are buildable — no overlapping members at either thickness", () => {
    expect(overlappingMemberPairs(panel("web34"))).toEqual([]);
    expect(overlappingMemberPairs(panel("web"))).toEqual([]);
  });

  it("⚠ the sheet lands in the 3/4in material bucket, not the 1/2in one", () => {
    /* `computePlywoodAreaSqFt` is per THICKNESS — that is how the Material
       Totals page orders sheets — so the whole point of the new style is that
       its area moves from one row of that table to the other. */
    /* ⚠ Measured as the girt's OWN contribution, against the Blocking panel
       as the baseline. The bucket total will not do: a panel's SKINS are 3/4in
       plywood too, so a 3/4in girt web lands in the same material row as the
       skins and the raw total for `web34` at 3/4in is 15.70 sqft against the
       1/2in web's 5.37 — 10.33 sqft of that being skin. Comparing the totals
       made this test fail with two numbers that were both right. */
    const girtAreaIn = (style: Parameters<typeof panel>[0], thicknessIn: number) =>
      computePlywoodAreaSqFt(panel(style), thicknessIn) -
      computePlywoodAreaSqFt(panel("blocking"), thicknessIn);
    const thinArea = girtAreaIn("web", GIRT_WEB_THICKNESS_IN);
    const thickArea = girtAreaIn("web34", GIRT_WEB_THICK_THICKNESS_IN);
    expect(thinArea).toBeGreaterThan(0);
    /* Same sheet size, so the same area — it has simply changed aisle. */
    expect(thickArea).toBeCloseTo(thinArea, 9);
    expect(girtAreaIn("web34", GIRT_WEB_THICKNESS_IN)).toBe(0);
    expect(girtAreaIn("web", GIRT_WEB_THICK_THICKNESS_IN)).toBe(0);
    /* And the default orders no girt plywood at either thickness — "no
       plywood in the default girt", his words, measured rather than asserted
       about the member list. */
    expect(computePlywoodAreaSqFt(panel("blocking"), GIRT_WEB_THICKNESS_IN)).toBe(0);
  });

  it("⚠ the default still has NO plywood girt in it at all — his words", () => {
    const blocking = panel("blocking");
    expect(blocking.filter((m) => m.role === "girt_web" && m.material === "plywood")).toEqual([]);
    expect(blocking.filter((m) => m.memberId.endsWith("_blocking"))).toHaveLength(2);
  });
});
