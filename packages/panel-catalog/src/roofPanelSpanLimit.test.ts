import { describe, expect, it } from "vitest";
import {
  decideRoofForm,
  maxRoofPanelGroundRunIn,
  roofPanelLengthForGroundRunIn,
} from "./roofPanelSpanLimit";

describe("⚠ 16ft is a HORIZONTAL number and a roof panel is not horizontal", () => {
  it("what 18ft of panel actually reaches, pitch by pitch", () => {
    /* The table that made him agree this should be computed. His 16ft holds
       to about 6:12 and stops being true above it. Measured, not estimated. */
    const reach = (pitch: number) => Number((maxRoofPanelGroundRunIn(pitch) / 12).toFixed(2));
    expect(reach(2)).toBe(17.76);
    expect(reach(4)).toBe(17.08);
    expect(reach(6)).toBe(16.1);
    expect(reach(8)).toBe(14.98);
    expect(reach(12)).toBe(12.73);
  });

  it("⚠ a flat 16ft rule would overrun the panel limit above 6:12", () => {
    for (const pitch of [8, 10, 12]) {
      const needed = roofPanelLengthForGroundRunIn(16 * 12, pitch);
      expect({ pitch, overruns: needed > 18 * 12 }).toEqual({ pitch, overruns: true });
    }
    for (const pitch of [2, 4, 6]) {
      const needed = roofPanelLengthForGroundRunIn(16 * 12, pitch);
      expect({ pitch, overruns: needed > 18 * 12 }).toEqual({ pitch, overruns: false });
    }
  });

  it("the two conversions are inverses of each other", () => {
    for (const pitch of [0, 3, 4, 7, 12]) {
      const ground = maxRoofPanelGroundRunIn(pitch);
      expect(roofPanelLengthForGroundRunIn(ground, pitch)).toBeCloseTo(18 * 12, 6);
    }
  });

  it("a flat roof reaches the panel's full length, because it IS horizontal", () => {
    expect(maxRoofPanelGroundRunIn(0)).toBe(18 * 12);
  });
});

describe("which roof a building gets", () => {
  it("a small building sheds, and says why", () => {
    // "If the roof panels length is 0-16, then gable ends spawn as shed roof"
    const d = decideRoofForm({ buildingWidthIn: 10 * 12, pitchIn12: 4 });
    expect(d.kind).toBe("shed");
    expect(d.panelGroundRunIn).toBe(120);
    expect(d.reason).toContain("clear across");
  });

  it("⚠ a wide building peaks, because one panel cannot reach across it", () => {
    // "if longer than that, then [peaked] roof"
    const d = decideRoofForm({ buildingWidthIn: 30 * 12, pitchIn12: 4 });
    expect(d.kind).toBe("peaked");
    expect(d.panelGroundRunIn).toBe(15 * 12);
    expect(d.reason).toContain("Split at a ridge");
    expect(d.refusal).toBeNull();
  });

  it("⚠ the pitch moves the line, which is the whole point of computing it", () => {
    /* A 17ft building sheds at 2:12 and peaks at 8:12, on the same footprint.
       A fixed 16ft rule would have peaked both or shed both. */
    const width = 17 * 12;
    expect(decideRoofForm({ buildingWidthIn: width, pitchIn12: 2 }).kind).toBe("shed");
    expect(decideRoofForm({ buildingWidthIn: width, pitchIn12: 8 }).kind).toBe("peaked");
  });

  it("a peak can be asked for on a building that does not need one", () => {
    // "some settings to be able to do peaked roof even if it's a small building"
    const d = decideRoofForm({ buildingWidthIn: 10 * 12, pitchIn12: 4, forcePeaked: true });
    expect(d.kind).toBe("peaked");
    expect(d.panelGroundRunIn).toBe(60);
    expect(d.reason).toContain("asked for");
  });

  it("⚠ refuses a building too wide even split at the ridge, naming both numbers", () => {
    /* A 60ft building at 12:12 needs 30ft of ground per side and a 42ft
       panel. Nothing models a bearing line between wall and ridge yet, so it
       says so rather than drawing a panel nobody can build. */
    const d = decideRoofForm({ buildingWidthIn: 60 * 12, pitchIn12: 12 });
    expect(d.refusal).toContain("30.0ft");
    expect(d.refusal).toContain("needs a bearing line");
  });

  it("the panel length it reports is the length the shop would cut", () => {
    const d = decideRoofForm({ buildingWidthIn: 24 * 12, pitchIn12: 6 });
    expect(d.kind).toBe("peaked");
    expect(d.panelLengthIn).toBeCloseTo(roofPanelLengthForGroundRunIn(12 * 12, 6), 9);
    expect(d.panelLengthIn).toBeGreaterThan(12 * 12);
  });
});
