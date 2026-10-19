import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { insertBumpOut } from "./bumpOut";
import { wallCompassDirection } from "./wallCompassDirection";
import { wallDisplayLabel, wallDisplayLabelWithId, wallDisplayLabelsByWallId } from "./wallDisplayLabel";
import type { Footprint } from "./types";

const labels = (fp: Footprint) => fp.walls.map((w) => wallDisplayLabelsByWallId(fp)[w.id]);

/** A bump-out on one wall, which is the simplest shape with two walls facing
 * the same direction. */
const bump = (fp: Footprint, wallId: string, startFt = 10, endFt = 18): Footprint =>
  insertBumpOut(fp, wallId, startFt, endFt, 6, new Set(fp.corners.map((c) => c.id))).footprint;

describe("⚠ what he actually asked for, in his own terms", () => {
  it("a rectangle reads N, E, S, W — no numbers anywhere", () => {
    /* Tommy, 2026-10-18: "Can we change AB to just simply be N? BC to E?"
       The first wall facing a direction carries no number, so the shapes where
       every direction is unique read exactly as he described. */
    const fp = buildRectangleFootprint(40, 20);
    expect(new Set(labels(fp))).toEqual(new Set(["N", "E", "S", "W"]));
    expect(labels(fp).every((l) => !/\d/.test(l!))).toBe(true);
  });

  it("an octagon reads N, NE, E, SE, S, SW, W, NW", () => {
    // "octagons would have N, NE, E, etc." — all eight, each exactly once.
    const fp = buildOctagonFootprint(40, 30);
    expect([...labels(fp)].sort()).toEqual(["E", "N", "NE", "NW", "S", "SE", "SW", "W"]);
  });

  it("the label is the compass direction the wall's EXTERIOR face points", () => {
    // Not a renaming table — the same derivation the shop drawings already use.
    const fp = buildRectangleFootprint(40, 20);
    for (const wall of fp.walls) {
      expect(wallDisplayLabelsByWallId(fp)[wall.id]).toBe(wallCompassDirection(wall, fp));
    }
  });
});

describe("two walls facing the same way — his N2 decision", () => {
  it("a bump-out gives a building two walls on one face, and they are N and N2", () => {
    /* ⚠ This is the case that made the label ambiguous and needed his
       decision. He picked `N` / `N2` on 2026-10-18 over `N (1 of 2)` and
       `N-left` / `N-right`. */
    const fp = buildRectangleFootprint(40, 20);
    const bumped = bump(fp, fp.walls[0]!.id);
    const all = labels(bumped);
    const duplicated = [...new Set(all.map((l) => l!.replace(/\d+$/, "")))].filter(
      (base) => all.filter((l) => l!.replace(/\d+$/, "") === base).length > 1,
    );
    // The shape really does repeat a direction, or this test proves nothing.
    expect(duplicated.length).toBeGreaterThan(0);
    for (const base of duplicated) {
      const group = all.filter((l) => l!.replace(/\d+$/, "") === base);
      // Exactly one unnumbered, then 2, 3, ... with no gaps and no repeats.
      expect(group.filter((l) => l === base)).toHaveLength(1);
      expect([...group].sort()).toEqual([base, ...group.slice(1).map((_, i) => `${base}${i + 2}`)].sort());
    }
  });

  it("every label in any shape is unique — the point of the suffix", () => {
    const fp = buildRectangleFootprint(40, 20);
    for (const shape of [
      fp,
      buildOctagonFootprint(40, 30),
      bump(fp, fp.walls[0]!.id),
      bump(bump(fp, fp.walls[0]!.id, 6, 14), "CD", 6, 14),
    ]) {
      const all = labels(shape);
      expect(new Set(all).size).toBe(all.length);
      expect(all.every((l) => typeof l === "string" && l.length > 0)).toBe(true);
    }
  });

  it("numbers run in wall order, the same way around the ring as the letters", () => {
    // So a second north wall is N2 because it comes later around the building,
    // not because of iteration order or distance from anything.
    const fp = buildRectangleFootprint(40, 20);
    const bumped = bump(fp, fp.walls[0]!.id);
    const map = wallDisplayLabelsByWallId(bumped);
    const order = bumped.walls.map((w) => map[w.id]!);
    for (const base of new Set(order.map((l) => l.replace(/\d+$/, "")))) {
      const positions = order.map((l, i) => (l.replace(/\d+$/, "") === base ? i : -1)).filter((i) => i >= 0);
      const numbers = positions.map((i) => {
        const m = /(\d+)$/.exec(order[i]!);
        return m ? Number(m[1]) : 1;
      });
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    }
  });
});

describe("⚠ the wall id is never renamed — it is a key", () => {
  it("the labels are derived, and the walls still answer to their own ids", () => {
    /* `AB`/`BC` key the saved project's panels, stopped slots, run stops, beam
       coverage, locked widths and undo history. If this test ever has to
       change, something has started renaming keys to fix a display problem. */
    const fp = buildRectangleFootprint(40, 20);
    expect(fp.walls.map((w) => w.id)).toEqual(["AB", "BC", "CD", "DA"]);
    expect(Object.keys(wallDisplayLabelsByWallId(fp)).sort()).toEqual(["AB", "BC", "CD", "DA"]);
  });

  it("carries the id alongside the label where someone may have to trace it", () => {
    const fp = buildRectangleFootprint(40, 20);
    const label = wallDisplayLabel(fp, "CD")!;
    expect(wallDisplayLabelWithId(fp, "CD")).toBe(`${label} (CD)`);
  });

  it("an unknown wall id falls back to itself rather than to nothing", () => {
    // A stale id out of a saved file must still print as something readable.
    const fp = buildRectangleFootprint(40, 20);
    expect(wallDisplayLabel(fp, "ZZ")).toBeNull();
    expect(wallDisplayLabelWithId(fp, "ZZ")).toBe("ZZ");
  });
});
