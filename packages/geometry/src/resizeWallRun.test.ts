import { describe, expect, it } from "vitest";
import { OPENING_COLLAPSE_BELOW_IN, resizeWallRun, wallGrowthEnd } from "./resizeWallRun";
import type { PanelSlot } from "./types";

const corner = (w = 25.5): PanelSlot => ({ type: "corner", widthIn: w });
const std = (w: number): PanelSlot => ({ type: "standard", widthIn: w });
const gap = (): PanelSlot => ({ type: "safety-gap", widthIn: 0.75 });
const win = (w: number): PanelSlot => ({ type: "window", widthIn: w, heightIn: 48, sillHeightIn: 36 });
const door = (w: number): PanelSlot => ({ type: "door", widthIn: w });

const shape = (slots: readonly PanelSlot[]) => slots.map((s) => `${s.type}:${s.widthIn}`).join("|");
const totalEighths = (slots: readonly PanelSlot[]) => slots.reduce((n, s) => n + Math.round(s.widthIn * 8), 0);

const WALL = () => [corner(), std(40), std(40), std(40), corner()];

describe("conservation — the property the whole model rests on", () => {
  it("⚠ Σ(widths) is EXACTLY old + delta, over a wide sweep, in whole eighths", () => {
    /* Not a spot check. This is the guarantee tile-once replaces a
       790,440-case policing sweep with, so it is measured across every
       delta that fits rather than asserted once. A single eighth lost here
       is a wall whose panels no longer sum to its own length. */
    let cases = 0;
    for (const start of [WALL(), [corner(), std(40), gap(), std(31.5), corner()], [std(40), std(40)]]) {
      const before = totalEighths(start);
      for (let eighths = -before; eighths <= 400; eighths++) {
        const deltaIn = eighths / 8;
        for (const end of ["start", "end"] as const) {
          const out = resizeWallRun(start, deltaIn, end, 40);
          cases++;
          // Shortfall is the honest report of an impossible shrink; what is
          // conserved is "everything that could move, did".
          expect(totalEighths(out.slots)).toBe(before + eighths + out.shortfallEighths);
          // And never a fractional eighth anywhere.
          for (const s of out.slots) expect(Math.abs(s.widthIn * 8 - Math.round(s.widthIn * 8))).toBeLessThan(1e-9);
        }
      }
    }
    expect(cases).toBeGreaterThan(3000);
  });

  it("a zero delta changes nothing at all", () => {
    expect(shape(resizeWallRun(WALL(), 0, "end", 40).slots)).toBe(shape(WALL()));
  });
});

describe("growing — panels enter and grow at the dragged end", () => {
  it("the end-most panel grows first, up to the standard width", () => {
    // Tommy: "it auto populates standard panels that enter and grow with the
    // drag". A part-width panel at the end finishes filling before a new one
    // appears behind it.
    const wall = [corner(), std(40), std(24), corner()];
    expect(shape(resizeWallRun(wall, 16, "end", 40).slots)).toBe("corner:25.5|standard:40|standard:40|corner:25.5");
  });

  it("⚠ a NEW panel enters once the end-most one is full, and it is nearest the end", () => {
    // Which end the new panel lands on is the whole reversibility story: the
    // newest panel must be the first one a drag back removes.
    const out = resizeWallRun(WALL(), 10, "end", 40);
    expect(shape(out.slots)).toBe("corner:25.5|standard:40|standard:40|standard:40|standard:10|corner:25.5");
  });

  it("...and at the START end it enters on the other side, mirrored", () => {
    const out = resizeWallRun(WALL(), 10, "start", 40);
    expect(shape(out.slots)).toBe("corner:25.5|standard:10|standard:40|standard:40|standard:40|corner:25.5");
  });

  it("a big growth makes a row of full panels plus the remainder", () => {
    const out = resizeWallRun(WALL(), 100, "end", 40);
    expect(shape(out.slots)).toBe(
      "corner:25.5|standard:40|standard:40|standard:40|standard:40|standard:40|standard:20|corner:25.5",
    );
  });

  it("⚠ the corner panel is stepped OVER, never grown — its width IS its geometry", () => {
    const out = resizeWallRun(WALL(), 10, "end", 40);
    expect(out.slots[out.slots.length - 1]!.type).toBe("corner");
    expect(out.slots[out.slots.length - 1]!.widthIn).toBe(25.5);
    expect(out.slots[0]!.widthIn).toBe(25.5);
  });

  it("⚠ the safety gap is stepped over too, and keeps its 3/4in", () => {
    // Spec: the corner panels and the safety gap stay rule-placed. A drag that
    // silently widened the gap would change a detail that is not the user's.
    const wall = [corner(), std(40), gap(), corner()];
    const out = resizeWallRun(wall, 12, "end", 40);
    expect(out.slots.find((s) => s.type === "safety-gap")!.widthIn).toBe(0.75);
    expect(shape(out.slots)).toBe("corner:25.5|standard:40|standard:12|safety-gap:0.75|corner:25.5");
  });

  it("a wall of nothing but rule-placed parts still grows, rather than refusing", () => {
    // Refusing would leave the wall shorter than its own length, which breaks
    // the one guarantee that may never break.
    const wall = [corner(), gap(), corner()];
    const out = resizeWallRun(wall, 30, "end", 40);
    expect(totalEighths(out.slots)).toBe(totalEighths(wall) + 240);
    expect(out.slots.some((s) => s.type === "standard" && s.widthIn === 30)).toBe(true);
  });
});

describe("shrinking — the latest panels shrink and disappear", () => {
  it("the end-most panel shrinks first", () => {
    expect(shape(resizeWallRun(WALL(), -10, "end", 40).slots)).toBe(
      "corner:25.5|standard:40|standard:40|standard:30|corner:25.5",
    );
  });

  it("⚠ a panel that reaches zero DISAPPEARS rather than lingering at 0in", () => {
    // Tommy: "each of those latest panels shrinks and disappears". A 0in slot
    // left in the array would be an invisible part with a cut list entry.
    const out = resizeWallRun(WALL(), -40, "end", 40);
    expect(shape(out.slots)).toBe("corner:25.5|standard:40|standard:40|corner:25.5");
    expect(out.slots.every((s) => s.widthIn > 0)).toBe(true);
  });

  it("then it eats into the next one, in reverse order of arrival", () => {
    const out = resizeWallRun(WALL(), -55, "end", 40);
    expect(shape(out.slots)).toBe("corner:25.5|standard:40|standard:25|corner:25.5");
  });

  it("⚠ tiny panels mid-drag are ALLOWED — he chose this explicitly", () => {
    // "This will make some tiny panels as the drag is marked, and I think this
    // is okay because there should be a drag tool on the elevation editor."
    // A rule that tidied them away would be the tiler running behind his back,
    // which is the whole thing tile-once removes.
    const out = resizeWallRun(WALL(), -39.875, "end", 40);
    expect(out.slots[out.slots.length - 2]!.widthIn).toBe(0.125);
  });

  it("⚠ REPORTS a shortfall rather than silently under-shrinking", () => {
    // Everything shrinkable reaches zero and 100in is still owed. Returning a
    // wall whose panels do not sum to its length would be the exact failure
    // the dimensional-tightness rule exists to prevent — so it is reported and
    // the caller refuses.
    const out = resizeWallRun(WALL(), -220, "end", 40);
    expect(out.shortfallEighths).toBeGreaterThan(0);
    expect(out.slots.every((s) => s.type === "corner" || s.type === "safety-gap")).toBe(true);
  });

  it("shrinking from the START end eats the first panels instead", () => {
    expect(shape(resizeWallRun(WALL(), -50, "start", 40).slots)).toBe(
      "corner:25.5|standard:30|standard:40|corner:25.5",
    );
  });
});

describe("an opening caught in the shrink", () => {
  it("shrinks with the drag while it is still a foot wide or more", () => {
    // "It shortens the width of the RO, header, and sill and those shrink
    // with the drag."
    const wall = [corner(), std(40), win(40), corner()];
    const out = resizeWallRun(wall, -16, "end", 40);
    expect(out.slots[2]!.type).toBe("window");
    expect(out.slots[2]!.widthIn).toBe(24);
    expect(out.collapsedOpenings).toBe(0);
  });

  it("⚠ BECOMES ONE STANDARD PANEL below a foot — RO, header and sill together", () => {
    // His rule exactly: "until it's less than 1' in which case the RO, header,
    // and sill all 3 get replaced by 1 standard panel."
    const wall = [corner(), std(40), win(40), corner()];
    const out = resizeWallRun(wall, -29, "end", 40);
    expect(out.slots[2]!.type).toBe("standard");
    expect(out.slots[2]!.widthIn).toBe(11);
    expect(out.collapsedOpenings).toBe(1);
  });

  it("...and keeps shrinking to nothing from there", () => {
    // "That continues down to zero (even though that would make an
    // 'impossible' panel - that's okay)."
    const wall = [corner(), std(40), win(40), corner()];
    const out = resizeWallRun(wall, -40, "end", 40);
    expect(out.slots.some((s) => s.type === "window")).toBe(false);
    expect(shape(out.slots)).toBe("corner:25.5|standard:40|corner:25.5");
  });

  it("the collapsed slot drops the opening's own header/sill zones", () => {
    // A standard panel carrying a window's bands would put a header in a cut
    // list for a panel that has no opening in it.
    const wall = [corner(), std(40), { ...win(40), zones: [{ type: "window" as const, heightIn: 48 }] }, corner()];
    const out = resizeWallRun(wall, -29, "end", 40);
    expect(out.slots[2]!.type).toBe("standard");
    expect(out.slots[2]!.zones).toBeUndefined();
  });

  it("a door collapses on the same rule as a window", () => {
    const wall = [corner(), std(40), door(36), corner()];
    const out = resizeWallRun(wall, -25, "end", 40);
    expect(out.slots[2]!.type).toBe("standard");
    expect(out.collapsedOpenings).toBe(1);
  });

  it("the collapse threshold is exactly one foot, not approximately", () => {
    const at = (toWidth: number) => {
      const wall = [corner(), win(40), corner()];
      return resizeWallRun(wall, toWidth - 40, "end", 40).slots[1]!.type;
    };
    expect(at(OPENING_COLLAPSE_BELOW_IN)).toBe("window"); // exactly 12in is still a window
    expect(at(OPENING_COLLAPSE_BELOW_IN - 0.125)).toBe("standard"); // one eighth under is not
  });
});

describe("round trips — a drag out and back", () => {
  it("⚠ growing then shrinking by the same amount returns the ORIGINAL wall", () => {
    /* The reversibility Tommy described — "when that side is dragged back,
       each of those latest panels shrinks and disappears". If growth spread
       itself over several panels this could not hold, which is why only the
       end-most panel grows. */
    for (const deltaIn of [0.125, 1, 10, 40, 40.5, 100, 237.75]) {
      for (const end of ["start", "end"] as const) {
        const grown = resizeWallRun(WALL(), deltaIn, end, 40);
        const back = resizeWallRun(grown.slots, -deltaIn, end, 40);
        expect(shape(back.slots)).toBe(shape(WALL()));
      }
    }
  });

  it("but a shrink past an opening is NOT reversible, and should not pretend to be", () => {
    // A collapsed window cannot come back by dragging out: the information
    // that it was a window is gone. Said in a test so nobody later "fixes"
    // the round trip by resurrecting openings from nothing.
    const wall = [corner(), std(40), win(40), corner()];
    const shrunk = resizeWallRun(wall, -40, "end", 40);
    const back = resizeWallRun(shrunk.slots, 40, "end", 40);
    expect(back.slots.some((s) => s.type === "window")).toBe(false);
  });
});

describe("which end the panels enter at", () => {
  const at = (x: number, y: number) => ({ x, y });
  // A rectangle A(0,0) B(30,0) C(30,20) D(0,20), walls AB BC CD DA.
  const before = new Map([["A", at(0, 0)], ["B", at(30, 0)], ["C", at(30, 20)], ["D", at(0, 20)]]);
  // Widened to 40ft: B and C move, A and D stay.
  const wider = new Map([["A", at(0, 0)], ["B", at(40, 0)], ["C", at(40, 20)], ["D", at(0, 20)]]);

  it("⚠ the growth goes to the end whose CORNER MOVED, on each wall", () => {
    // AB runs A->B and B moved, so panels enter at its END.
    expect(wallGrowthEnd(before, wider, { startCorner: "A", endCorner: "B" })).toBe("end");
    // CD runs C->D and C moved, so panels enter at its START — the opposite
    // end of the array, because the walls run in opposite directions around
    // the ring. This is exactly what a per-shape table would get wrong.
    expect(wallGrowthEnd(before, wider, { startCorner: "C", endCorner: "D" })).toBe("start");
  });

  it("a wall neither of whose corners moved is left alone entirely", () => {
    // DA: D and A both stayed put. Returning null is what stops its panel
    // array being touched — identity preserved, no re-render, no edits lost.
    expect(wallGrowthEnd(before, wider, { startCorner: "D", endCorner: "A" })).toBeNull();
  });

  it("a wall carried bodily sideways still reports an end, and it does not matter", () => {
    // BC: both B and C moved by the same amount. Its LENGTH is unchanged, so
    // resizeWallRun is called with a zero delta and returns the array as-is.
    expect(wallGrowthEnd(before, wider, { startCorner: "B", endCorner: "C" })).toBe("end");
  });

  it("a sub-grid wobble is not a move", () => {
    // Below an eighth of an inch, in feet. Floating-point noise from rebuilding
    // a footprint must not be read as a drag.
    const nudged = new Map([["A", at(0, 0)], ["B", at(30 + 1e-9, 0)]]);
    expect(wallGrowthEnd(before, nudged, { startCorner: "A", endCorner: "B" })).toBeNull();
  });

  it("an unknown corner id counts as not moved rather than throwing", () => {
    // A bump-out renumbers ids; a wall naming a corner the other footprint
    // lacks must degrade to "leave it alone", not crash the editor.
    expect(wallGrowthEnd(before, wider, { startCorner: "ZZ", endCorner: "YY" })).toBeNull();
  });
});
