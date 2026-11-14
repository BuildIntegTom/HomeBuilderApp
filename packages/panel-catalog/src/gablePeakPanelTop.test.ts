import { describe, expect, it } from "vitest";
import {
  buildGablePeakPanelMembers,
  buildGablePeakTopMembers,
  gablePeakCapBandIn,
  type GablePeakTopProfile,
} from "./gablePeakPanelMembers";
import { COLUMN_TOTAL_WIDTH_IN } from "./columnPanelMembers";
import type { PanelMember } from "./componentSchema";
import { memberBoxIn } from "./panelMemberHelpers";

const DEPTH_IN = 15.5;
const WIDTH_IN = COLUMN_TOTAL_WIDTH_IN; // 25.5
const EDGE_TOP_IN = 48;

/**
 * ⚠ **A BOUNDING BOX CANNOT SEE A SLOPED BOARD**, and this file's first
 * version believed one.
 *
 * `memberBoxIn` on a `"diagonal"` member returns the box of the rotated
 * rectangle, not the board's real extent: a top plate whose true corners run
 * z 1.96 -> 5.21 came back as z 2.79 -> 13.07, and the test read a cap as
 * poking 11in above its own ridge. The `trapezoidCornersIn` ARE the board —
 * the same lesson `floorRoofPanelMembers.test.ts` records for the four lids,
 * learned twice now.
 */
const zsOf = (m: PanelMember): number[] => {
  const corners = m.position.trapezoidCornersIn;
  if (corners) return corners.map((p) => p.zIn);
  const box = memberBoxIn(m);
  return [box.zFromIn, box.zToIn];
};
const xsOf = (m: PanelMember): number[] => {
  const corners = m.position.trapezoidCornersIn;
  if (corners) return corners.map((p) => p.xIn);
  const box = memberBoxIn(m);
  return [box.xFromIn, box.xToIn];
};

/** The ridge rise a pitch puts on a panel this wide: half its width of run. */
const riseForPitch = (pitchIn12: number) => (WIDTH_IN / 2) * (pitchIn12 / 12);

const symmetricTop = (pitchIn12: number): GablePeakTopProfile => ({
  apexOffsetXIn: WIDTH_IN / 2,
  leftRiseIn: 0,
  apexRiseIn: riseForPitch(pitchIn12),
  rightRiseIn: 0,
});

const PITCHES = [2, 3, 4, 6, 8, 12];

describe("⚠ the five-sided Gable Peak Panel's top", () => {
  /* > *"What I've had in mind is that this Gable column panel would be
     > five-sided, or I guess technically seven-sided including the inside and
     > outside faces. The top lid would be very weird and two pieces and
     > that's fine."* — Tommy, 2026-11-13

     ⚠ **WIRED 2026-11-13.** These tests were written while the top was built
     and unwired, and they hold the SHAPE — the ridge's position at every
     pitch, the band's `1/cos`, the two lids, the off-centre case. They
     outlived the composition they were written against: the cap no longer
     brings a bottom assembly of its own, because the body stopped bringing a
     top one. The joint itself, the raked body and the shop sheet are in
     `gablePeakSharedTop.test.ts`. */

  it("⚠ it is TWO pieces — one lid per slope, which is what he asked for", () => {
    const cap = buildGablePeakTopMembers(WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, symmetricTop(4));
    const left = cap.filter((m) => m.memberId.startsWith("cap_left_"));
    const right = cap.filter((m) => m.memberId.startsWith("cap_right_"));
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
    const lids = cap.filter((m) => m.memberId.endsWith("top_plate_skin"));
    expect(lids).toHaveLength(2);
  });

  it("⚠ the ridge lands exactly where it was asked for, at every pitch", () => {
    for (const pitch of PITCHES) {
      const top = symmetricTop(pitch);
      const cap = buildGablePeakTopMembers(WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, top);
      const highest = Math.max(...cap.flatMap(zsOf));
      expect(highest, `pitch ${pitch}:12`).toBeCloseTo(EDGE_TOP_IN + top.apexRiseIn, 6);
    }
  });

  it("⚠ and the high point is over the ridge, not at an end", () => {
    const top = symmetricTop(6);
    const cap = buildGablePeakTopMembers(WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, top);
    const ridgeZ = EDGE_TOP_IN + top.apexRiseIn;
    for (const m of cap) {
      const zs = zsOf(m);
      const xs = xsOf(m);
      if (Math.max(...zs) < ridgeZ - 0.5) continue;
      /* Whatever reaches the ridge must touch the ridge's own x. */
      expect(Math.max(...xs), m.memberId).toBeGreaterThan(top.apexOffsetXIn - 1e-6);
      expect(Math.min(...xs), m.memberId).toBeLessThan(top.apexOffsetXIn + 1e-6);
    }
  });

  it("⚠ nothing in the cap hangs below the band — the hat-shaped version did, by 1.87in", () => {
    /* The defect that forced the band: a cap stacked ON a body that already
       reached the roofline had nowhere to put its own sloped top assembly at
       the panel's outer edges, so its plates ran down through the body's top
       plate. Measured at 4:12 before the fix: 1.87in of overlap, silent in
       the render and exactly what [[no_overlapping_members]] exists for. */
    for (const pitch of PITCHES) {
      const top = symmetricTop(pitch);
      const bandIn = gablePeakCapBandIn(WIDTH_IN, top);
      const cap = buildGablePeakTopMembers(WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, top);
      const lowest = Math.min(...cap.flatMap(zsOf));
      expect(lowest, `pitch ${pitch}:12`).toBeGreaterThanOrEqual(EDGE_TOP_IN - bandIn - 1e-6);
    }
  });

  it("⚠ the band carries its 1/cos, because a plumb-cut board on a slope stands taller", () => {
    /* 3/4in of skin and 1 1/2in of plate is 2.25in on the flat and 2.372in on
       a 4:12 slope. Using the flat number is how the plates poked through. */
    const flatIn = 2.25;
    expect(gablePeakCapBandIn(WIDTH_IN, symmetricTop(4))).toBeCloseTo(2.372, 3);
    for (const pitch of PITCHES) {
      expect(gablePeakCapBandIn(WIDTH_IN, symmetricTop(pitch)), `pitch ${pitch}`).toBeGreaterThan(flatIn);
    }
    /* Steeper means taller, monotonically. */
    const bands = PITCHES.map((p) => gablePeakCapBandIn(WIDTH_IN, symmetricTop(p)));
    for (let i = 1; i < bands.length; i++) expect(bands[i]!).toBeGreaterThan(bands[i - 1]!);
  });

  it("⚠ an OFF-CENTRE ridge gives two different pieces, and no board of negative length", () => {
    /* Measured on the real placement path, the apex is dead centre on every
       wall from 12ft to 40ft, with and without openings below. This is the
       case the TYPE allows, not one that has been seen — see
       `GableTiledPanel.apexXIn`. It is tested because a builder that silently
       assumed symmetry would be right today and wrong the day the wall's
       column stops landing on the peak. */
    const lopsided: GablePeakTopProfile = {
      apexOffsetXIn: WIDTH_IN * 0.25,
      leftRiseIn: 0,
      apexRiseIn: 9,
      rightRiseIn: 3,
    };
    const cap = buildGablePeakTopMembers(WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, lopsided);
    expect(cap.filter((m) => m.memberId.startsWith("cap_left_")).length).toBeGreaterThan(0);
    expect(cap.filter((m) => m.memberId.startsWith("cap_right_")).length).toBeGreaterThan(0);
    for (const m of cap) expect(m.actualDimsIn.lengthIn, m.memberId).toBeGreaterThan(0);
    expect(Math.max(...cap.flatMap(zsOf))).toBeCloseTo(EDGE_TOP_IN + lopsided.apexRiseIn, 6);
    /* The two slopes stay on their own sides of the ridge. */
    const left = cap.filter((m) => m.memberId.startsWith("cap_left_"));
    expect(Math.max(...left.flatMap(xsOf))).toBeLessThanOrEqual(lopsided.apexOffsetXIn + 1e-6);
  });

  it("⚠ the whole panel still carries its furring box and its two stud packs", () => {
    /* The cap must not displace the thing this panel exists for. The box and
       packs move DOWN with the body — they hang off its top plate, which the
       band lowers — but they are still all there, and still the same parts. */
    const withTop = buildGablePeakPanelMembers(DEPTH_IN, EDGE_TOP_IN, false, undefined, WIDTH_IN, 0, symmetricTop(4));
    const boxes = withTop.filter((m) => m.memberId.startsWith("gable_peak_box_"));
    const packs = withTop.filter((m) => m.memberId.startsWith("gable_peak_pack_"));
    const without = buildGablePeakPanelMembers(DEPTH_IN, EDGE_TOP_IN, false, undefined, WIDTH_IN, 0);
    expect(boxes).toHaveLength(without.filter((m) => m.memberId.startsWith("gable_peak_box_")).length);
    expect(packs).toHaveLength(without.filter((m) => m.memberId.startsWith("gable_peak_pack_")).length);
    expect(boxes.length).toBeGreaterThan(0);
    expect(packs.length).toBeGreaterThan(0);
  });

  it("no apex means the old flat-topped panel, member for member", () => {
    /* A peak landing exactly on this panel's edge is a plain column again,
       and must not drift just because the parameter now exists. This is what
       makes the whole change safe to land ahead of being wired in. */
    expect(buildGablePeakPanelMembers(DEPTH_IN, EDGE_TOP_IN, false, undefined, WIDTH_IN, 0, undefined)).toEqual(
      buildGablePeakPanelMembers(DEPTH_IN, EDGE_TOP_IN, false, undefined, WIDTH_IN, 0),
    );
  });
});
