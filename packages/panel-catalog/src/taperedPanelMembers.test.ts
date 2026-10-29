import { describe, expect, it } from "vitest";
import { buildTaperedPanelMembers } from "./taperedPanelMembers";
import { divideRingFacet } from "./ringFacetPanels";

/* The 40ft octagon with a 10ft ring, measured off ringRoofPlanes. */
const FACET = { innerEdgeIn: 99.25, outerEdgeIn: 198.75, spanIn: 120 };

describe("⚠ a panel whose ends are different widths", () => {
  it("its two side joists are NOT parallel, which is the whole point", () => {
    /* A ring's outer edge is longer than its inner one, so a panel spanning
       between them splays. Joists laid out square would stick out of one end
       and fall short at the other. */
    const built = buildTaperedPanelMembers({ kind: "roof", innerWidthIn: 16, outerWidthIn: 40, depthIn: 15.5, lengthIn: 120 });
    expect(built.refusal).toBeNull();
    const joists = built.members.filter((m) => m.memberId.startsWith("tapered_joist_"));
    expect(joists).toHaveLength(4);
    const tilts = joists.map((j) => j.position.tiltDeg!);
    // Equal and opposite: the two sides lean away from each other.
    expect(new Set(tilts.map(Math.abs)).size).toBe(1);
    expect(tilts.some((t) => t > 0)).toBe(true);
    expect(tilts.some((t) => t < 0)).toBe(true);
  });

  it("⚠ a raked joist is cut LONGER than the span it covers", () => {
    const built = buildTaperedPanelMembers({ kind: "roof", innerWidthIn: 16, outerWidthIn: 40, depthIn: 15.5, lengthIn: 120 });
    expect(built.joistLengthIn).toBeGreaterThan(120);
    expect(built.joistLengthIn).toBeCloseTo(Math.hypot(120, 12), 9);
    for (const j of built.members.filter((m) => m.memberId.startsWith("tapered_joist_"))) {
      expect(j.actualDimsIn.lengthIn).toBeCloseTo(built.joistLengthIn, 9);
    }
  });

  it("each lid is cut to its OWN end's width", () => {
    const built = buildTaperedPanelMembers({ kind: "roof", innerWidthIn: 16, outerWidthIn: 40, depthIn: 15.5, lengthIn: 120 });
    const inner = built.members.find((m) => m.memberId === "tapered_lid_inner_skin")!;
    const outer = built.members.find((m) => m.memberId === "tapered_lid_outer_skin")!;
    expect(inner.actualDimsIn.lengthIn).toBe(16);
    expect(outer.actualDimsIn.lengthIn).toBe(40);
    expect(outer.notes).toContain("NOT the other end's width");
  });

  it("⚠ every anti-twist girt is a different length, because the panel widens", () => {
    /* One cut length for all of them would be right in at most one place. */
    const built = buildTaperedPanelMembers({ kind: "roof", innerWidthIn: 16, outerWidthIn: 40, depthIn: 15.5, lengthIn: 240 });
    const girts = built.members.filter((m) => m.memberId.startsWith("tapered_anti_twist_"));
    expect(girts.length).toBeGreaterThan(1);
    const lengths = girts.map((g) => g.actualDimsIn.lengthIn);
    expect(new Set(lengths).size).toBe(lengths.length);
    // And they grow toward the wide end.
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });

  it("a panel that does not taper is still built, with no rake", () => {
    const built = buildTaperedPanelMembers({ kind: "floor", innerWidthIn: 24, outerWidthIn: 24, depthIn: 15.5, lengthIn: 120 });
    expect(built.rakeDeg).toBe(0);
    expect(built.joistLengthIn).toBe(120);
  });

  it("⚠ refuses an end too narrow for its own joists", () => {
    const built = buildTaperedPanelMembers({ kind: "roof", innerWidthIn: 2, outerWidthIn: 40, depthIn: 15.5, lengthIn: 120 });
    expect(built.members).toEqual([]);
    expect(built.refusal).toContain("cannot hold the two joists");
  });

  it("refuses a panel with no span or no width", () => {
    expect(buildTaperedPanelMembers({ kind: "roof", innerWidthIn: 0, outerWidthIn: 40, depthIn: 15.5, lengthIn: 120 }).refusal).toContain("width at both ends");
    expect(buildTaperedPanelMembers({ kind: "roof", innerWidthIn: 16, outerWidthIn: 40, depthIn: 15.5, lengthIn: 0 }).refusal).toContain("span and a depth");
  });
});

describe("⚠ the panels a real ring facet asks for are all buildable", () => {
  it("every one that divideRingFacet returns, builds", () => {
    /* The two halves have to agree: a division that produces a panel the
       builder refuses would be a ring roof that cannot be made. */
    const division = divideRingFacet(FACET);
    expect(division.refusal).toBeNull();
    expect(division.panels.length).toBeGreaterThan(0);
    for (const panel of division.panels) {
      const built = buildTaperedPanelMembers({
        kind: "roof",
        innerWidthIn: panel.innerWidthIn,
        outerWidthIn: panel.outerWidthIn,
        depthIn: 15.5,
        lengthIn: FACET.spanIn,
      });
      expect({ index: panel.index, refusal: built.refusal }).toEqual({ index: panel.index, refusal: null });
    }
  });

  it("and their rakes are small, which is what makes them near-identical", () => {
    const division = divideRingFacet(FACET);
    for (const panel of division.panels) {
      const built = buildTaperedPanelMembers({
        kind: "roof",
        innerWidthIn: panel.innerWidthIn,
        outerWidthIn: panel.outerWidthIn,
        depthIn: 15.5,
        lengthIn: FACET.spanIn,
      });
      expect({ index: panel.index, gentle: built.rakeDeg < 6 }).toEqual({ index: panel.index, gentle: true });
    }
  });
});
