import { describe, expect, it } from "vitest";
import { applyWallBracingPattern, type BraceablePanel } from "./wallBracingOverlay";

const panel = (id: string, widthIn = 48, eligible = true): BraceablePanel => ({ id, widthIn, heightIn: 96, eligible });

describe("laying a pattern across a wall", () => {
  it("pairs them two at a time, in order", () => {
    const r = applyWallBracingPattern({
      pattern: "superbrace",
      panels: [panel("p1"), panel("p2"), panel("p3"), panel("p4")],
      startFrom: "start",
    });
    expect(r.pairs).toEqual([
      { leftPanelId: "p1", rightPanelId: "p2" },
      { leftPanelId: "p3", rightPanelId: "p4" },
    ]);
    expect(r.unpairedPanelIds).toEqual([]);
  });

  it("⚠ starts at the end he said to start at", () => {
    /* "Just do it till it ends starting at least accessable side." Which end
       that is comes in as an argument, because computeGapEnd already answers
       the opposite question for safety gaps and two rules disagreeing about
       the same corner would be worse than asking. */
    const panels = [panel("p1"), panel("p2"), panel("p3")];
    const fromStart = applyWallBracingPattern({ pattern: "superbrace", panels, startFrom: "start" });
    const fromEnd = applyWallBracingPattern({ pattern: "superbrace", panels, startFrom: "end" });
    expect(fromStart.pairs).toEqual([{ leftPanelId: "p1", rightPanelId: "p2" }]);
    expect(fromStart.unpairedPanelIds).toEqual(["p3"]);
    // Walked the other way, the leftover is at the other end.
    expect(fromEnd.pairs).toEqual([{ leftPanelId: "p3", rightPanelId: "p2" }]);
    expect(fromEnd.unpairedPanelIds).toEqual(["p1"]);
  });

  it("⚠ an unpaired panel still gets half a pattern", () => {
    /* "Just do it till it ends." The legs brace that panel perfectly well;
       what they do not do is meet anything at the seam, which is why it is
       reported rather than quietly looking like the rest. */
    const r = applyWallBracingPattern({
      pattern: "superbrace",
      panels: [panel("p1"), panel("p2"), panel("odd")],
      startFrom: "start",
    });
    expect(r.unpairedPanelIds).toEqual(["odd"]);
    expect(r.addedByPanelId["odd"]!.length).toBeGreaterThan(0);
    // Same legs a left-hand panel gets.
    expect(r.addedByPanelId["odd"]!.map((s) => s.id)).toEqual(r.addedByPanelId["p1"]!.map((s) => s.id));
  });

  it("⚠ a run of pairs BREAKS at anything ineligible", () => {
    /* Every leg runs to the seam two panels share. Panels with a corner post
       between them share no seam, so pairing restarts rather than reaching
       over it. */
    const r = applyWallBracingPattern({
      pattern: "superbrace",
      panels: [panel("p1"), panel("corner", 25.5, false), panel("p2"), panel("p3")],
      startFrom: "start",
    });
    expect(r.pairs).toEqual([{ leftPanelId: "p2", rightPanelId: "p3" }]);
    expect(r.unpairedPanelIds).toEqual(["p1"]);
    expect(r.addedByPanelId["corner"]).toBeUndefined();
  });

  it("ineligible panels get nothing at all", () => {
    const r = applyWallBracingPattern({
      pattern: "superbrace",
      panels: [panel("gap", 0.75, false), panel("gap2", 0.75, false)],
      startFrom: "start",
    });
    expect(r.pairs).toEqual([]);
    expect(r.walkedPanelIds).toEqual([]);
    expect(Object.keys(r.addedByPanelId)).toEqual([]);
  });

  it("⚠ the two halves of a pair mirror each other at their shared seam", () => {
    /* The left panel's legs start at its RIGHT edge and the right panel's at
       its LEFT, which is the same line once they are side by side. If this
       ever flips, the X becomes two diagonals pointing away from each other
       and nothing says so on screen. */
    const r = applyWallBracingPattern({
      pattern: "superbrace",
      panels: [panel("a", 48), panel("b", 48)],
      startFrom: "start",
      wythes: ["exterior"],
    });
    // Flush with each panel's seam-side POST, 1.5in in from the seam itself.
    for (const s of r.addedByPanelId["a"]!) expect(s.kind === "diagonal" && s.fromXIn).toBe(48 - 1.5);
    for (const s of r.addedByPanelId["b"]!) expect(s.kind === "diagonal" && s.fromXIn).toBe(1.5);
  });

  it("each panel's members are cut to ITS width, not the pair's", () => {
    const r = applyWallBracingPattern({
      pattern: "superbrace",
      panels: [panel("wide", 48), panel("narrow", 24)],
      startFrom: "start",
      wythes: ["exterior"],
    });
    const outer = (id: string, i: number) => {
      const s = r.addedByPanelId[id]![i]!;
      return s.kind === "diagonal" ? s.toXIn : -1;
    };
    expect(outer("wide", 0)).toBe(1.5);
    // The right-hand panel's legs run out to ITS own far post.
    expect(outer("narrow", 0)).toBe(24 - 1.5);
  });

  it("a nailer wall pairs the same way and adds no surgery members", () => {
    const r = applyWallBracingPattern({
      pattern: "nailer",
      panels: [panel("p1"), panel("p2"), panel("p3")],
      startFrom: "start",
    });
    expect(r.pairs).toHaveLength(1);
    expect(r.unpairedPanelIds).toEqual(["p3"]);
    for (const id of ["p1", "p2", "p3"]) expect(r.addedByPanelId[id]).toEqual([]);
  });

  it("an empty wall is not an error", () => {
    const r = applyWallBracingPattern({ pattern: "superbrace", panels: [], startFrom: "start" });
    expect(r).toEqual({ addedByPanelId: {}, pairs: [], unpairedPanelIds: [], walkedPanelIds: [] });
  });

  it("⚠ every eligible panel is walked exactly once, at any wall length", () => {
    /* Swept, because the failure mode is a panel silently missed in the
       middle of a long wall rather than at either end. */
    for (let n = 1; n <= 24; n++) {
      const panels = Array.from({ length: n }, (_, i) => panel(`p${i}`));
      for (const startFrom of ["start", "end"] as const) {
        const r = applyWallBracingPattern({ pattern: "superbrace", panels, startFrom });
        expect({ n, startFrom, walked: r.walkedPanelIds.length }).toEqual({ n, startFrom, walked: n });
        expect({ n, startFrom, unique: new Set(r.walkedPanelIds).size }).toEqual({ n, startFrom, unique: n });
        expect({ n, startFrom, odd: r.unpairedPanelIds.length }).toEqual({ n, startFrom, odd: n % 2 });
      }
    }
  });
});
