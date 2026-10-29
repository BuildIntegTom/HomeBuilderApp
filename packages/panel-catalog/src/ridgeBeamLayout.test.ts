import { describe, expect, it } from "vitest";
import { columnBearingGirtPositionsIn, columnStorySegments, ridgeBeamLayout } from "./ridgeBeamLayout";
import { ROOF_CATCHER_BEAM_MAX_SPAN_IN } from "./roofCatcherBeamMembers";
import { STRUCTURAL_COLUMN_WIDTH_IN } from "./structuralColumnMembers";

const along = (lengthFt: number) => ({ ridgeStartFt: { x: 0, y: 10 }, ridgeEndFt: { x: lengthFt, y: 10 } });

describe("the beam along the ridge", () => {
  it("no segment is longer than 12ft, which is its own spec", () => {
    // "spawn in 3 2x12 dimensional lumber pieces that span a maximum of 12'"
    expect(ROOF_CATCHER_BEAM_MAX_SPAN_IN).toBe(144);
    for (const lengthFt of [8, 12, 13, 24, 30, 40, 60]) {
      const layout = ridgeBeamLayout(along(lengthFt));
      for (const s of layout.segments) {
        expect({ lengthFt, over: s.spanIn > 144 + 1e-9 }).toEqual({ lengthFt, over: false });
      }
    }
  });

  it("the segments cover the whole ridge, end to end, with no gap", () => {
    for (const lengthFt of [13, 24, 30, 47.5]) {
      const layout = ridgeBeamLayout(along(lengthFt));
      const total = layout.segments.reduce((a, s) => a + s.spanIn, 0);
      expect({ lengthFt, total }).toEqual({ lengthFt, total: lengthFt * 12 });
      expect(layout.segments[0]!.startFt).toEqual({ x: 0, y: 10 });
      expect(layout.segments[layout.segments.length - 1]!.endFt.x).toBeCloseTo(lengthFt, 9);
    }
  });

  it("⚠ spans are EVEN, not 12ft-then-whatever-is-left", () => {
    /* A 30ft ridge gets three 10ft segments rather than 12 + 12 + 6. Even
       spans are what a built-up beam wants; the short leftover of the other
       layout governs nothing and still costs a post. */
    const layout = ridgeBeamLayout(along(30));
    expect(layout.segments).toHaveLength(3);
    for (const s of layout.segments) expect(s.spanIn).toBe(120);
  });

  it("⚠ columns go at the INTERIOR joints only", () => {
    /* The ends bear on the gable walls, which already carry roof load. A
       column there would be a post standing inside a wall doing the same
       job. */
    const layout = ridgeBeamLayout(along(30));
    expect(layout.columns).toHaveLength(2);
    expect(layout.columns.map((c) => c.alongIn)).toEqual([120, 240]);
    // A short ridge needs no column at all.
    expect(ridgeBeamLayout(along(10)).columns).toEqual([]);
  });

  it("columns are the 15 1/2in square ones, not the wall panel", () => {
    const layout = ridgeBeamLayout(along(30));
    for (const c of layout.columns) expect(c.widthIn).toBe(STRUCTURAL_COLUMN_WIDTH_IN);
  });

  it("a ridge running the other way places everything along it just the same", () => {
    const layout = ridgeBeamLayout({ ridgeStartFt: { x: 5, y: 0 }, ridgeEndFt: { x: 5, y: 30 } });
    expect(layout.columns.map((c) => c.atFt)).toEqual([
      { x: 5, y: 10 },
      { x: 5, y: 20 },
    ]);
  });

  it("refuses a ridge with no length, and a nonsense span", () => {
    expect(ridgeBeamLayout({ ridgeStartFt: { x: 1, y: 1 }, ridgeEndFt: { x: 1, y: 1 } }).refusal).toContain("no ridge");
    expect(ridgeBeamLayout({ ...along(30), maxSpanIn: 0 }).refusal).toContain("maximum span");
  });
});

describe("⚠ the extra bearing a column needs from the floor under it", () => {
  it("one girt under each side of the column", () => {
    // "more structural girts, one under each side of the panel resting above it"
    const { girtAtIn } = columnBearingGirtPositionsIn(100, STRUCTURAL_COLUMN_WIDTH_IN, []);
    expect(girtAtIn).toEqual([100 - 7.75, 100 + 7.75]);
  });

  it("⚠ says when a column straddles a floor seam, because it often will", () => {
    /* A column is 15.5in and a floor panel is 24in, so a column lands within
       one panel more often than not — but not always, and when it straddles,
       the two girts fall in DIFFERENT panels. Reported rather than left to be
       discovered by whoever adds the girts. */
    const seams = [0, 24, 48, 72, 96, 120];
    expect(columnBearingGirtPositionsIn(96, STRUCTURAL_COLUMN_WIDTH_IN, seams).straddlesSeam).toBe(true);
    expect(columnBearingGirtPositionsIn(84, STRUCTURAL_COLUMN_WIDTH_IN, seams).straddlesSeam).toBe(false);
  });

  it("a seam exactly on the column's own edge is not a straddle", () => {
    // Touching is not crossing — the girt lands on the seam, which is fine.
    const seams = [100 - 7.75, 100 + 7.75];
    expect(columnBearingGirtPositionsIn(100, STRUCTURAL_COLUMN_WIDTH_IN, seams).straddlesSeam).toBe(false);
  });

  it("⚠ how often it straddles, measured rather than guessed", () => {
    /* ⚠ Swept across a 40ft run of 24in panels: a 15.5in column straddles a
       seam roughly TWO THIRDS of the time, not occasionally.

       The arithmetic once measured is obvious: a 15.5in column fits inside a
       24in bay only while its centre sits in the middle 8.5in, which is 35%
       of the bay. Tommy expected the opposite — asked whether a column lands
       within one panel or straddles, he said *"I think most cases are going
       to be the prior because of how the floors and roof patterns are
       regarding the short ends"*. So the case he treated as the exception is
       the common one, and whichever answer is cheaper to build should be
       chosen on that basis. */
    const seams = Array.from({ length: 21 }, (_, i) => i * 24);
    let straddles = 0;
    let total = 0;
    for (let centre = 12; centre <= 468; centre += 0.5) {
      total++;
      if (columnBearingGirtPositionsIn(centre, STRUCTURAL_COLUMN_WIDTH_IN, seams).straddlesSeam) straddles++;
    }
    const pct = (straddles / total) * 100;
    expect(pct).toBeGreaterThan(60);
    expect(pct).toBeLessThan(70);
  });
});

describe("⚠ a column reaching the foundation, broken at every floor", () => {
  it("one story: one segment, straight to the foundation", () => {
    const segs = columnStorySegments([10], 14);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ storyIndex: 0, baseFt: 0, heightIn: 120, landsOnFloor: false });
    // The last stretch is the gable wall's own height above the top plate.
    expect(segs[1]!.heightIn).toBe(48);
  });

  it("⚠ two stories: it BREAKS at the floor between them", () => {
    /* A single stick from foundation to beam would pass straight through
       the upper floor deck, which is unbuildable and exactly the overlap
       this app forbids. What is continuous is the PATH, not the stick. */
    const segs = columnStorySegments([10, 10], 22);
    expect(segs.map((s) => s.baseFt)).toEqual([0, 10, 20]);
    expect(segs.map((s) => s.heightIn)).toEqual([120, 120, 24]);
  });

  it("⚠ marks which segments bear on a FLOOR rather than the foundation", () => {
    // Those are the ones needing extra girts in the deck beneath.
    const segs = columnStorySegments([10, 10], 22);
    expect(segs.map((s) => s.landsOnFloor)).toEqual([false, true, true]);
  });

  it("the segments add up to the beam's underside exactly", () => {
    for (const [stories, beamFt] of [[[10], 14], [[10, 10], 22], [[9, 9, 9], 30]] as [number[], number][]) {
      const segs = columnStorySegments(stories, beamFt);
      const total = segs.reduce((a, s) => a + s.heightIn, 0);
      expect({ beamFt, total }).toEqual({ beamFt, total: beamFt * 12 });
    }
  });

  it("a beam below the top of a story stops there rather than overshooting", () => {
    const segs = columnStorySegments([10, 10], 15);
    expect(segs.map((s) => s.heightIn)).toEqual([120, 60]);
    expect(segs.reduce((a, s) => a + s.heightIn, 0)).toBe(180);
  });

  it("no stories at all still reaches the beam", () => {
    expect(columnStorySegments([], 12)).toEqual([
      { storyIndex: 0, baseFt: 0, heightIn: 144, landsOnFloor: false },
    ]);
  });
});
