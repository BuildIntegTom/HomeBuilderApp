import { describe, expect, it } from "vitest";
import {
  DEFAULT_GIRT_STYLE,
  LEGACY_GIRT_STYLE,
  LUMBER_2X6_WIDTH_IN,
  PLATE_2X4_THICKNESS_IN,
  computePlywoodAreaSqFt,
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
    expect(nailed("web")).toEqual(["bottom_plate_2x4_ext x nailer", "stud_centre_1_exterior x nailer"]);
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

  it("⚠ Ring is not built yet, and falls back rather than guessing", () => {
    /* A square bale panel's rectangle is NOT this panel's rectangle: its four
       members stand on edge (which moves the girt's top face, and a brace
       rides that face), its long sides run straight through a standard panel's
       centre nailer stud, and its short sides are placed off a stud-assembly
       spec a standard panel does not carry. Three real differences, so it is a
       different assembly rather than a different label. Pinned here so the day
       it IS built, this test fails and says why. */
    expect(panel("ring")).toEqual(panel("web"));
  });
});
