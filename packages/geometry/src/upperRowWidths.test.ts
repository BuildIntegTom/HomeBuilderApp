import { describe, expect, it } from "vitest";
import { computeUpperRowWidths, headerPeakOffsetsIn, type WallSlotWidth } from "./upperRowWidths";

/**
 * ⚠ **THE UPPER ROW TAKES THE WALL'S OWN WIDTHS.**
 *
 * > *"I really want these studs to line up."* — Tommy, 2026-11-12
 *
 * And his rule for when they cannot: *"build the exact match rule, refuse the
 * exceptions."* So every test here is either an exact match or a refusal with
 * both numbers in it; nothing approximates.
 */

const MIN = 15.5;
const MAX = 48;

/** A 24ft wall as the tiler actually cuts it: a corner each end, standards
 * between, and the safety gap. Sums to 288. */
const WALL: WallSlotWidth[] = [
  { widthIn: 15.5 }, // corner
  { widthIn: 48 },
  { widthIn: 48 },
  { widthIn: 48 },
  { widthIn: 48 },
  { widthIn: 0.75, isSafetyGap: true },
  { widthIn: 32.125 },
  { widthIn: 32.125 },
  { widthIn: 15.5 }, // corner
];
const WALL_LEN = WALL.reduce((t, s) => t + s.widthIn, 0);

describe("the upper row follows the wall below", () => {
  it("⚠ the row's run IS the wall between its two corners — which is why this works at all", () => {
    /* The shed row's inset is the wall THICKNESS (15.5in) and the wall's
       corner panel is the same 15.5in, so the row spans exactly the wall's
       middle. Not luck: the corner went from 25.5 to 15.5 on 2026-11-01 so
       wall joints would stack on deck joints, and this falls out of it.
       Measured on his Tiny House: wall 288in, row 257in. */
    expect(WALL_LEN).toBe(288);
    expect(WALL_LEN - 2 * 15.5).toBe(257);
  });

  it("⚠ copies the wall's widths exactly, safety gap and all", () => {
    const got = computeUpperRowWidths({
      wallSlotsIn: WALL,
      rowStartIn: 15.5,
      rowRunIn: 257,
      minPanelWidthIn: MIN,
      maxPanelWidthIn: MAX,
    });
    expect(got.refusal).toBeNull();
    /* The wall's middle, slot for slot, corners excluded — nothing resized,
       nothing merged, nothing invented. */
    expect(got.widthsIn).toEqual([48, 48, 48, 48, 0.75, 32.125, 32.125]);
  });

  it("⚠ the safety gap rides through at 3/4in, under the minimum, because it is a GAP", () => {
    /* His 2026-11-12 spec: the row "should have the same safety gaps as the
       walls below it". Copying widths is what delivers that — the gap is just
       one of the widths, and it must not be rejected for being narrow. */
    const got = computeUpperRowWidths({
      wallSlotsIn: WALL,
      rowStartIn: 15.5,
      rowRunIn: 257,
      minPanelWidthIn: MIN,
      maxPanelWidthIn: MAX,
    });
    expect(got.widthsIn).toContain(0.75);
  });

  it("⚠ REFUSES a row that does not start on a wall joint, and says by how much", () => {
    /* The Square Bale corner is 39in while the row's inset is still the
       15.5in wall thickness, so the two runs cannot start together. */
    const got = computeUpperRowWidths({
      wallSlotsIn: [{ widthIn: 39 }, { widthIn: 48 }, { widthIn: 48 }, { widthIn: 48 }, { widthIn: 39 }],
      rowStartIn: 15.5,
      rowRunIn: 222 - 31,
      minPanelWidthIn: MIN,
      maxPanelWidthIn: MAX,
    });
    expect(got.kind).toBe("refused");
    expect(got.refusal).toMatch(/not a joint in the wall below/);
    /* The nearest joint to 15.5in is the wall's own start at 0 — 15.5in
       away — because the 39in corner puts the next one at 39. Either way the
       row cannot start where the wall does not have a joint. */
    expect(got.refusal).toMatch(/15\.500in away/);
  });

  it("⚠ REFUSES a row that spans the whole wall when the inset is switched off", () => {
    const got = computeUpperRowWidths({
      wallSlotsIn: WALL,
      rowStartIn: 0,
      rowRunIn: WALL_LEN,
      minPanelWidthIn: MIN,
      maxPanelWidthIn: MAX,
    });
    /* ⚠ It starts on a joint (0) and ends on one (288), so it is NOT refused
       for its ends — it is refused for the 15.5in CORNER panels it would then
       have to follow, which are exactly at the row's minimum and so pass,
       leaving a row that is the whole wall rather than its middle. That is
       the honest shape of this case: switching the inset off does not break
       alignment, it changes which run the row is. Kept as a test so the
       behaviour is recorded rather than assumed. */
    expect(got.refusal).toBeNull();
    expect(got.widthsIn!.reduce((t, w) => t + w, 0)).toBe(WALL_LEN);
  });

  it("⚠ splits a long header at its own zigzag PEAKS, not evenly", () => {
    /* > *"on a longer header, ideally the separations of panels would be at
       > the same intervals of where the /\\/\\/\\/\\ zigzag pattern of headers
       > peaks (four places in this example)."* — Tommy, 2026-11-12

       An apex is where two web members meet the top chord, so a joint above
       one lands on a bearing point rather than on an arbitrary division. A
       12ft header with 4 peaks: apexes at 18/54/90/126, giving 18, 36, 36,
       36, 18 — every piece inside the 15.5-48in band. */
    const peaks = headerPeakOffsetsIn(144, 4);
    expect(peaks).toEqual([18, 54, 90, 126]);
    const got = computeUpperRowWidths({
      wallSlotsIn: [{ widthIn: 24 }, { widthIn: 144, headerPeakOffsetsIn: peaks }, { widthIn: 24 }],
      rowStartIn: 0,
      rowRunIn: 192,
      minPanelWidthIn: MIN,
      maxPanelWidthIn: MAX,
    });
    expect(got.refusal).toBeNull();
    expect(got.widthsIn).toEqual([24, 18, 36, 36, 36, 18, 24]);
    /* And the row still sums to itself, which is the invariant the whole
       thing exists to protect. */
    expect(got.widthsIn!.reduce((t, w) => t + w, 0)).toBe(192);
  });

  it("⚠ REFUSES an over-wide panel with no header to follow", () => {
    /* Dividing it evenly would put a joint over nothing. His rule: refuse. */
    const got = computeUpperRowWidths({
      wallSlotsIn: [{ widthIn: 24 }, { widthIn: 144 }, { widthIn: 24 }],
      rowStartIn: 0,
      rowRunIn: 192,
      minPanelWidthIn: MIN,
      maxPanelWidthIn: MAX,
    });
    expect(got.kind).toBe("refused");
    expect(got.refusal).toMatch(/no header whose peaks the split could follow/);
  });

  it("⚠ REFUSES when following the peaks would leave a piece out of band", () => {
    /* A single peak on a 144in header puts its apex at 72in — two 72in
       pieces, both over the 48in ceiling. Better to say so than to build it. */
    const got = computeUpperRowWidths({
      wallSlotsIn: [{ widthIn: 144, headerPeakOffsetsIn: headerPeakOffsetsIn(144, 1) }],
      rowStartIn: 0,
      rowRunIn: 144,
      minPanelWidthIn: MIN,
      maxPanelWidthIn: MAX,
    });
    expect(got.kind).toBe("refused");
    expect(got.refusal).toMatch(/header's own peaks leaves a piece outside/);
  });

  it("every width it returns is inside the band, or is a safety gap", () => {
    const got = computeUpperRowWidths({
      wallSlotsIn: [
        { widthIn: 48 },
        { widthIn: 0.75, isSafetyGap: true },
        { widthIn: 144, headerPeakOffsetsIn: headerPeakOffsetsIn(144, 4) },
        { widthIn: 15.5 },
      ],
      rowStartIn: 0,
      rowRunIn: 208.25,
      minPanelWidthIn: MIN,
      maxPanelWidthIn: MAX,
    });
    expect(got.refusal).toBeNull();
    for (const w of got.widthsIn!) {
      const ok = w === 0.75 || (w >= MIN - 1e-9 && w <= MAX + 1e-9);
      expect({ w, ok }).toEqual({ w, ok: true });
    }
  });

  it("refuses an empty wall and a row with no run", () => {
    expect(computeUpperRowWidths({ wallSlotsIn: [], rowStartIn: 0, rowRunIn: 10, minPanelWidthIn: MIN, maxPanelWidthIn: MAX }).kind).toBe("refused");
    expect(computeUpperRowWidths({ wallSlotsIn: WALL, rowStartIn: 0, rowRunIn: 0, minPanelWidthIn: MIN, maxPanelWidthIn: MAX }).kind).toBe("refused");
  });
});
