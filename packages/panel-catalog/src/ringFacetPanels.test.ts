import { describe, expect, it } from "vitest";
import { divideRingFacet, MAX_PANEL_WIDTH_IN } from "./ringFacetPanels";

/* The facets measured off `ringRoofPlanes` for real octagon rings — inner
   edge, outer edge, span, and what the building is. */
const REAL_FACETS: [string, number, number, number][] = [
  ["40ft octagon, 12ft ring", 79.5, 198.75, 144],
  ["40ft octagon, 10ft ring", 99.25, 198.75, 120],
  ["60ft octagon, 14ft ring", 159, 298.25, 168],
  ["30ft octagon, 8ft ring", 69.5, 149, 96],
];

describe("dividing a ring facet into tapered panels", () => {
  it("⚠ every panel reaches both walls, which is the whole point", () => {
    /* "They need their joists to all bear on the panel below it." A panel's
       joists live on its side edges, so a panel that reaches both walls lands
       both joists. Every panel here spans the full width by construction —
       this asserts the division never invents a panel that does not. */
    for (const [name, innerIn, outerIn, spanIn] of REAL_FACETS) {
      const division = divideRingFacet({ innerEdgeIn: innerIn, outerEdgeIn: outerIn, spanIn });
      expect({ name, refusal: division.refusal }).toEqual({ name, refusal: null });
      expect({ name, panels: division.panels.length > 0 }).toEqual({ name, panels: true });
    }
  });

  it("⚠ the panels sum to both edges exactly, on the 1/8in grid", () => {
    // His dimensional-tightness rule, applied to a facet that tapers.
    for (const [name, innerIn, outerIn, spanIn] of REAL_FACETS) {
      const { panels } = divideRingFacet({ innerEdgeIn: innerIn, outerEdgeIn: outerIn, spanIn });
      const innerSum = panels.reduce((a, p) => a + p.innerWidthIn, 0);
      const outerSum = panels.reduce((a, p) => a + p.outerWidthIn, 0);
      expect({ name, innerSum }).toEqual({ name, innerSum: innerIn });
      expect({ name, outerSum }).toEqual({ name, outerSum: outerIn });
      for (const p of panels) {
        expect({ name, i: p.index, grid: Number.isInteger(p.innerWidthIn * 8) }).toEqual({ name, i: p.index, grid: true });
        expect({ name, i: p.index, grid: Number.isInteger(p.outerWidthIn * 8) }).toEqual({ name, i: p.index, grid: true });
      }
    }
  });

  it("no panel is wider than the press will take", () => {
    for (const [name, innerIn, outerIn, spanIn] of REAL_FACETS) {
      const { panels } = divideRingFacet({ innerEdgeIn: innerIn, outerEdgeIn: outerIn, spanIn });
      for (const p of panels) {
        expect({ name, i: p.index, over: p.outerWidthIn > MAX_PANEL_WIDTH_IN + 1e-9 }).toEqual({ name, i: p.index, over: false });
      }
    }
  });

  it("⚠ near-identical, not identical — the 1/8in grid sees to that", () => {
    /* A 40ft octagon with a 10ft ring divides its 99 1/4in inner edge five
       ways into 19.85in, which is not a fraction anybody cuts. So the panels
       come out within 1/8in of each other rather than equal, and one jig
       still covers the facet. */
    const { panels, effectivelyIdentical } = divideRingFacet({ innerEdgeIn: 99.25, outerEdgeIn: 198.75, spanIn: 120 });
    expect(panels).toHaveLength(5);
    expect(panels.map((p) => p.innerWidthIn)).toEqual([19.875, 19.875, 19.875, 19.875, 19.75]);
    expect(panels.map((p) => p.outerWidthIn)).toEqual([39.75, 39.75, 39.75, 39.75, 39.75]);
    expect(effectivelyIdentical).toBe(true);
  });

  it("the end panels carry the hip rake and the rest share the splay", () => {
    /* The facet splays 22.5 degrees at each end. The first panel's start edge
       and the last panel's end edge ARE the hip lines, so they carry the full
       rake; the edges between lean less. */
    const { panels } = divideRingFacet({ innerEdgeIn: 99.25, outerEdgeIn: 198.75, spanIn: 120 });
    expect(panels[0]!.startRakeDeg).toBeCloseTo(0, 9);
    expect(panels[panels.length - 1]!.endRakeDeg).toBeCloseTo(
      (Math.atan2(198.75 - 99.25, 120) * 180) / Math.PI,
      6,
    );
    // Each interior edge leans more than the one before it, monotonically.
    for (let i = 1; i < panels.length; i++) {
      expect({ i, grows: panels[i]!.startRakeDeg > panels[i - 1]!.startRakeDeg }).toEqual({ i, grows: true });
    }
  });

  it("positions follow the widths along both edges", () => {
    const { panels } = divideRingFacet({ innerEdgeIn: 79.5, outerEdgeIn: 198.75, spanIn: 144 });
    let innerAt = 0;
    let outerAt = 0;
    for (const p of panels) {
      expect({ i: p.index, innerAt: p.innerAtIn, outerAt: p.outerAtIn }).toEqual({ i: p.index, innerAt, outerAt });
      innerAt += p.innerWidthIn;
      outerAt += p.outerWidthIn;
    }
  });

  it("⚠ refuses a facet that tapers too hard, and says what gives", () => {
    /* The squeeze is real: the outer edge sets a floor on the panel count and
       the inner edge sets a ceiling. A deep ring on a small courtyard runs
       them together. */
    const division = divideRingFacet({ innerEdgeIn: 20, outerEdgeIn: 200, spanIn: 150 });
    expect(division.panels).toEqual([]);
    expect(division.refusal).toContain("tapers too hard");
    expect(division.refusal).toContain("at least 5 panels");
    expect(division.refusal).toContain("at most 1");
  });

  it("refuses nonsense instead of dividing it", () => {
    expect(divideRingFacet({ innerEdgeIn: 0, outerEdgeIn: 100, spanIn: 120 }).refusal).toContain("no edges");
    expect(divideRingFacet({ innerEdgeIn: 120, outerEdgeIn: 100, spanIn: 120 }).refusal).toContain("cannot be shorter");
  });

  it("a facet that does not taper at all still divides", () => {
    // A square courtyard's facet, where inner and outer edges match.
    const { panels, refusal } = divideRingFacet({ innerEdgeIn: 96, outerEdgeIn: 96, spanIn: 120 });
    expect(refusal).toBeNull();
    expect(panels).toHaveLength(2);
    for (const p of panels) {
      expect(p.innerWidthIn).toBe(48);
      expect(p.outerWidthIn).toBe(48);
      expect(p.startRakeDeg).toBeCloseTo(0, 9);
      expect(p.endRakeDeg).toBeCloseTo(0, 9);
    }
  });
});
