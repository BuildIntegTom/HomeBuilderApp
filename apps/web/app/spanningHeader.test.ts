import { buildRectangleFootprint, computeWallVerticalBandsForSlot, type PanelSlot } from "@building-integrity/geometry";
import { bigHeaderDefaultHeightIn, bigHeaderHeightInRange, bigHeaderWidthInRange } from "@building-integrity/panel-catalog";
import { describe, expect, it } from "vitest";
import { allPanelInstances } from "./panelInstances";
import {
  headerAboveByPanelName,
  resolveSpanningHeaderHeightIn,
  resolveSpanningHeaders,
  spannedPanelNames,
  spanningHeaderSheetLocation,
  spanningHeadersToGeometry,
  SPANNING_HEADER_LIMITS_IN,
  wallBandGeometry,
  type SpanningHeader,
} from "./spanningHeader";

// A(0,0) B(30,0) C(30,20) D(0,20) -> AB=N, BC=E, CD=S, DA=W.
const fp = buildRectangleFootprint(30, 20);

const standard = (widthIn: number): PanelSlot => ({ type: "standard", widthIn });

/** The Rogers-Sehorn ADU's own east wall, cut down to the part that matters:
 * two panels 3'5½" and 3'0" wide with E4A spanning both. */
const eastWallSlots: PanelSlot[] = [
  { type: "corner", widthIn: 25.5 },
  standard(41.5),
  standard(36),
  standard(40),
  { type: "corner", widthIn: 25.5 },
];
const northWallSlots: PanelSlot[] = [
  { type: "corner", widthIn: 25.5 },
  standard(40),
  standard(40),
  standard(40),
  { type: "corner", widthIn: 25.5 },
];

const header = (over: { from: number; to: number }, heightIn = 96, headerHeightIn?: number): SpanningHeader => ({
  id: `h-${over.from}-${over.to}`,
  heightIn,
  ...(headerHeightIn === undefined ? {} : { headerHeightIn }),
  startSlotIndex: over.from,
  endSlotIndex: over.to,
});

const groundOnly = (wallSlots: Record<string, PanelSlot[]>) => [{ id: "ground" as const, wallSlots }];

describe("resolveSpanningHeaders", () => {
  it("names a header H1 — no direction letter, no hyphen — and states its wall separately", () => {
    const resolved = resolveSpanningHeaders(fp, groundOnly({ BC: eastWallSlots }), {
      ground: { BC: [header({ from: 1, to: 3 })] },
      second: {},
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.name).toBe("H1");
    expect(resolved[0]!.headerNumber).toBe(1);
    // The wall is a FIELD, not part of the name.
    expect(resolved[0]!.direction).toBe("E");
    expect(resolved[0]!.name).not.toMatch(/[^A-Z0-9]/);
    expect(resolved[0]!.name).not.toContain("E");
  });

  it("reports the ADU's own span as exactly 6'5½\"", () => {
    const resolved = resolveSpanningHeaders(fp, groundOnly({ BC: eastWallSlots }), {
      ground: { BC: [header({ from: 1, to: 3 })] },
      second: {},
    });
    expect(resolved[0]!.spanWidthIn).toBe(77.5);
  });

  it("uses ONE building-wide counter — a second header on a DIFFERENT wall is H2, not H1", () => {
    // The whole point of the single series, and a per-wall counter is the
    // natural thing to write by mistake.
    const resolved = resolveSpanningHeaders(fp, groundOnly({ AB: northWallSlots, BC: eastWallSlots }), {
      ground: { AB: [header({ from: 1, to: 3 })], BC: [header({ from: 1, to: 3 })] },
      second: {},
    });
    expect(resolved.map((r) => ({ name: r.name, wallId: r.wallId }))).toEqual([
      { name: "H1", wallId: "AB" },
      { name: "H2", wallId: "BC" },
    ]);
  });

  it("numbers across stories too, ground floor first", () => {
    const resolved = resolveSpanningHeaders(
      fp,
      [
        { id: "ground", wallSlots: { BC: eastWallSlots } },
        { id: "second", wallSlots: { BC: eastWallSlots } },
      ],
      { ground: { BC: [header({ from: 1, to: 3 })] }, second: { BC: [header({ from: 2, to: 4 })] } },
    );
    expect(resolved.map((r) => ({ name: r.name, story: r.story }))).toEqual([
      { name: "H1", story: "ground" },
      { name: "H2", story: "second" },
    ]);
  });

  it("numbers two headers on the SAME wall left to right regardless of the order they were added", () => {
    const wall: PanelSlot[] = [standard(40), standard(40), standard(40), standard(40)];
    const resolved = resolveSpanningHeaders(fp, groundOnly({ AB: wall }), {
      ground: { AB: [header({ from: 2, to: 4 }), header({ from: 0, to: 2 })] },
      second: {},
    });
    expect(resolved.map((r) => [r.name, r.header.startSlotIndex])).toEqual([
      ["H1", 0],
      ["H2", 2],
    ]);
  });

  it("reports the panels it actually sits on when the wall has shrunk out from under it", () => {
    const shortWall: PanelSlot[] = [standard(40), standard(40)];
    const resolved = resolveSpanningHeaders(fp, groundOnly({ AB: shortWall }), {
      ground: { AB: [header({ from: 1, to: 4 })] },
      second: {},
    });
    expect(resolved[0]!.coveredSlotIndices).toEqual([1]);
    expect(resolved[0]!.spanWidthIn).toBe(40);
  });

  it("is empty with no footprint and empty with no headers", () => {
    expect(resolveSpanningHeaders(null, groundOnly({ BC: eastWallSlots }), { ground: {}, second: {} })).toEqual([]);
    expect(resolveSpanningHeaders(fp, groundOnly({ BC: eastWallSlots }), { ground: {}, second: {} })).toEqual([]);
  });
});

describe("the cross-reference, which the direction-free name makes mandatory", () => {
  const wallSlots = { BC: eastWallSlots };
  const instances = allPanelInstances(fp, wallSlots, 40);
  const nameFor = (wallId: string, slotIndex: number) =>
    instances.find((i) => i.wallId === wallId && i.slotIndexInWall === slotIndex)?.name;
  const resolved = resolveSpanningHeaders(fp, groundOnly(wallSlots), { ground: { BC: [header({ from: 2, to: 4 })] }, second: {} });

  it("puts the wall in WORDS and names the panels on the header's own sheet", () => {
    const names = spannedPanelNames(resolved[0]!, nameFor);
    expect(names).toEqual(["E3", "E4"]);
    expect(spanningHeaderSheetLocation(resolved[0]!, names)).toBe("East wall — spans E3, E4");
  });

  it("puts the reciprocal on each spanned panel's sheet", () => {
    const byPanel = headerAboveByPanelName(resolved, nameFor);
    expect(byPanel.get("E3")).toBe("H1");
    expect(byPanel.get("E4")).toBe("H1");
    expect(byPanel.get("E2")).toBeUndefined();
  });

  it("states the wall even when no panel can be named, rather than inventing one", () => {
    const orphan = resolveSpanningHeaders(fp, groundOnly({ BC: [] }), { ground: { BC: [header({ from: 0, to: 2 })] }, second: {} });
    expect(spanningHeaderSheetLocation(orphan[0]!, [])).toBe("East wall — spans no panels");
  });
});

describe("resolveSpanningHeaderHeightIn", () => {
  it("falls back to the catalog default, which is pending BI confirmation", () => {
    expect(resolveSpanningHeaderHeightIn(header({ from: 0, to: 2 }))).toBe(bigHeaderDefaultHeightIn.value);
    expect(bigHeaderDefaultHeightIn.status).toBe("pending-BI-confirmation");
  });

  it("uses this header's own height when it has one", () => {
    expect(resolveSpanningHeaderHeightIn(header({ from: 0, to: 2 }, 84, 36))).toBe(36);
  });
});

describe("SPANNING_HEADER_LIMITS_IN", () => {
  it("is the catalog's own Big Header ranges, read and never redefined", () => {
    expect(SPANNING_HEADER_LIMITS_IN).toEqual({
      minSpanIn: bigHeaderWidthInRange.minIn,
      maxSpanIn: bigHeaderWidthInRange.maxIn,
      minHeightIn: bigHeaderHeightInRange.minIn,
      maxHeightIn: bigHeaderHeightInRange.maxIn,
    });
  });

  it("carries the provisional status of the numbers it is made of", () => {
    // A number does not become confirmed by being used. If either of these
    // is ever widened to fit a drawing, this test is where that shows up.
    expect(bigHeaderWidthInRange.status).toBe("pending-BI-confirmation");
    expect(bigHeaderHeightInRange.status).toBe("pending-BI-confirmation");
    expect(bigHeaderWidthInRange.minIn).toBe(48);
    expect(bigHeaderWidthInRange.maxIn).toBe(144);
  });
});

describe("wallBandGeometry", () => {
  it("returns the beams themselves when there are no headers (no allocation, no behaviour change)", () => {
    const beams = [{ heightIn: 48, assemblyHeightIn: 10.5, startSlotIndex: 0, endSlotIndex: 2 }];
    expect(wallBandGeometry(beams, [])).toBe(beams);
  });

  it("shortens the panels beneath a header through the UNCHANGED beam band machinery", () => {
    const geometry = wallBandGeometry([], spanningHeadersToGeometry([header({ from: 1, to: 3 })]));
    expect(computeWallVerticalBandsForSlot(1, 120, geometry)).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 96 }]);
    expect(computeWallVerticalBandsForSlot(0, 120, geometry)).toEqual([{ bandIndex: 0, bottomIn: 0, topIn: 120 }]);
  });

  it("resolves an absent headerHeightIn through the catalog on the way to geometry", () => {
    expect(spanningHeadersToGeometry([header({ from: 1, to: 3 })])[0]!.assemblyHeightIn).toBe(bigHeaderDefaultHeightIn.value);
  });
});
