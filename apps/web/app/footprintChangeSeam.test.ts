import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ⚠ **U6 STRIDE 1 — THE ROOF FOLLOWS THE SHAPE, AS A GUARD RATHER THAN A
 * HOPE.**
 *
 * `roof_follows_the_shape` is a bug that produced three separate-looking
 * reports from one gap: a path replaced the footprint and left the roof
 * alone. Tommy, 2026-11-01:
 *
 * > *"When I changed a small shed roof building to 24 x 24, it extended the
 * > shed roof along with one gable end, but the other gable end went to
 * > peaked Gable end style."*
 *
 * The fix at the time went through `applyShapeChange`, and the note left
 * behind said **two** paths still bypassed it. When U6 came to count them
 * there were **four**: `handleAddBumpOut` and `handleDragWall`'s collapse
 * branch had never been on the list. All four are closed now.
 *
 * ⚠ **This test asserts nothing about geometry. Its whole job is that NOBODY
 * REPLACES THE FOOTPRINT WITHOUT SAYING WHAT HAPPENS TO THE ROOF.** `page.tsx`
 * is over 12,000 lines; a new `setFootprint(...)` in a handler is invisible in
 * review, and U6's own dimension handles are exactly the kind of new caller
 * that would have become bypass number five. Adding one now fails here until
 * it is named and classified.
 *
 * If you are legitimately adding or removing a site, update `EXPECTED` and say
 * in the commit which class it is and why.
 */

const PAGE = fileURLToPath(new URL("./page.tsx", import.meta.url));

/** How a footprint-replacing site answers for the roof. */
type RoofClass =
  /** Goes through `applyShapeChange`, which calls `refreshRoofForShapeChange`
   * — re-derives only when `roofShapeChangeVerdict` says the roof is
   * genuinely invalidated, and otherwise carries the stored profile positions
   * onto the new wall lengths. The right answer for a LENGTH change, where a
   * hand-shaped roofline must survive a two-inch nudge. */
  | "SEAM"
  /** Goes through `withRederivedRoof`, which re-derives unconditionally. The
   * right answer for a path that RENUMBERS walls, because the verdict decides
   * by comparing gable-end wall ids and an id that matches across a renumber
   * is not the same wall. */
  | "REDERIVES"
  /** The first draw. There is no previous roof; `applyRoofDefaultsForFootprint`
   * builds one from the shape. */
  | "DRAW"
  /** Loading a saved project. The roof arrives with the file and must NOT be
   * re-derived — doing so would overwrite a roofline the user shaped and
   * saved. */
  | "LOADS";

/** The source marker that proves a handler really does what it claims. */
const MARKER_FOR: Record<RoofClass, string> = {
  SEAM: "applyShapeChange(",
  REDERIVES: "withRederivedRoof(",
  DRAW: "applyRoofDefaultsForFootprint(",
  LOADS: "setGableEndWallIds(",
};

const EXPECTED: Record<string, { calls: number; roof: RoofClass[]; why: string }> = {
  applyProjectState: {
    calls: 1,
    roof: ["LOADS"],
    why:
      "Loading a saved project. ⚠ The one site that must NOT re-derive: the file carries its own gable walls, profile positions and heights, and re-deriving would overwrite a roofline the user shaped and saved with the one the shape implies.",
  },
  commitNewFootprint: {
    calls: 1,
    roof: ["DRAW"],
    why:
      "The first draw, and a starter template. There is no previous roof to preserve, so the shape's own defaults are built — gable ends on the short pair, and the ridge column placed into the slots it returns.",
  },
  resizeBuildingBoxFt: {
    calls: 1,
    roof: ["SEAM"],
    why:
      "⚠ U6 stride 1's own seam, and the reason this inventory exists. Every change to the building's WIDTH or DEPTH arrives here — the typed wall-length editor, the octagon size panel, the octagon wall drag, and whatever handle U6 stride 2 adds. One caller, one resize, one roof decision.",
  },
  handleEditWallLength: {
    calls: 1,
    roof: ["SEAM"],
    why:
      "⚠ The BUMPED-OUT branch only. A freeform plan has more than two degrees of freedom, so it cannot be regenerated from a box; `editWallLength` moves only the corners that wall owns, and `applyShapeChange` resizes the panels and refreshes the roof. The rectangle and octagon branches are no longer here — they go through `resizeBuildingBoxFt`.",
  },
  handleKeepSplitRegion: {
    calls: 1,
    roof: ["REDERIVES"],
    why:
      "⚠ CLOSED BY U6, 2026-11-07 — one of the two bypasses that were written down. A drawn wall cuts the plan and the user keeps one half: every corner renumbers and the span can change by any amount, so the stored gable walls name walls that no longer exist.",
  },
  commitFootprintShapeChange: {
    calls: 1,
    roof: ["REDERIVES"],
    why:
      "⚠ CLOSED BY U6, 2026-11-07 — the second written-down bypass. Adding or removing a courtyard flips whether gable ends are allowed AT ALL (`ringRoofGableBlockReason`), so the roof a courtyard plan implies is a different roof entirely.",
  },
  handleAddBumpOut: {
    calls: 1,
    roof: ["REDERIVES"],
    why:
      "⚠ CLOSED BY U6, 2026-11-07, and it was NOT on the list of known bypasses. `insertBumpOut` renumbers every wall, so a gable profile keyed by the old ids is stale state rather than a roofline anybody shaped. ⚠ A second bump-out on an already-numeric plan can hand back the same ids for different walls, which is exactly why this re-derives unconditionally instead of asking the verdict.",
  },
  handleDragWall: {
    calls: 2,
    roof: ["SEAM", "REDERIVES"],
    why:
      "TWO sites, two different answers, in source order. The ordinary drag is a pure LENGTH change and goes through the seam, so a hand-shaped roofline survives it. ⚠ The COLLAPSE branch (Tommy: \"walls can snap back into each other and reform a straight one\") REMOVES a wall and renumbers every survivor — also not on the list of known bypasses, also closed by U6.",
  },
};

/** The component body of `page.tsx` is indented two spaces, so a declaration
 * at exactly that indent is component scope — a handler — while anything
 * deeper is a local inside one. Same reader `retileCallSites.test.ts` uses,
 * and for the same reason: matching loosely attributes a call to the nearest
 * `const`, which is usually a local variable. */
const HANDLER_DECL = /^ {2}(?:const|function)\s+([A-Za-z0-9_]+)\s*(?:=|\()/;

interface HandlerInfo {
  /** 1-based line numbers of this handler's `setFootprint(` calls. */
  sites: number[];
  markers: Set<string>;
}

function footprintSitesByHandler(): Map<string, HandlerInfo> {
  const lines = readFileSync(PAGE, "utf8").split(/\r?\n/);
  const info = new Map<string, HandlerInfo>();
  let handler = "(top level)";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const decl = line.match(HANDLER_DECL);
    if (decl) handler = decl[1]!;
    if (/^\s*(?:\*|\/\/)/.test(line)) continue; // prose about a call, not a call
    if (!info.has(handler)) info.set(handler, { sites: [], markers: new Set() });
    const entry = info.get(handler)!;
    if (/\bsetFootprint\s*\(/.test(line)) entry.sites.push(i + 1);
    for (const marker of Object.values(MARKER_FOR)) if (line.includes(marker)) entry.markers.add(marker);
  }
  for (const [handler, entry] of [...info]) if (entry.sites.length === 0) info.delete(handler);
  return info;
}

describe("U6 stride 1: every path that replaces the footprint answers for the roof", () => {
  it("the set of handlers that replace the footprint is exactly the inventory", () => {
    expect([...footprintSitesByHandler().keys()].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it("each handler replaces it the number of times the inventory records", () => {
    const actual: Record<string, number> = {};
    for (const [handler, entry] of footprintSitesByHandler()) actual[handler] = entry.sites.length;
    const expected: Record<string, number> = {};
    for (const [handler, e] of Object.entries(EXPECTED)) expected[handler] = e.calls;
    expect(actual).toEqual(expected);
  });

  it("⚠ and every one of them really carries the roof call its class claims", () => {
    const sites = footprintSitesByHandler();
    for (const [handler, expectation] of Object.entries(EXPECTED)) {
      const entry = sites.get(handler)!;
      for (const roofClass of new Set(expectation.roof)) {
        expect(
          entry.markers.has(MARKER_FOR[roofClass]),
          `${handler} is classified ${roofClass} but its body never calls ${MARKER_FOR[roofClass]}`,
        ).toBe(true);
      }
    }
  });

  it("a class is declared for every call, not once per handler", () => {
    for (const [handler, e] of Object.entries(EXPECTED)) {
      expect(e.roof, `${handler} must classify each of its ${e.calls} calls`).toHaveLength(e.calls);
    }
  });

  it("the inventory is non-vacuous — it really found call sites in page.tsx", () => {
    const total = [...footprintSitesByHandler().values()].reduce((n, e) => n + e.sites.length, 0);
    /* ⚠ A NON-VACUITY FLOOR, not a target. Its only job is to fail if a
       refactor moves these calls out of `page.tsx` and leaves this file
       measuring nothing. It went DOWN from twelve to nine when U6 collapsed
       the three box-resize paths into one seam, which is the direction it
       should move. */
    expect(total).toBeGreaterThanOrEqual(9);
  });

  it("⚠ the four bypasses U6 closed stay closed", () => {
    /* Named individually rather than counted, because the two that were never
       on the list — `handleAddBumpOut` and `handleDragWall`'s collapse — are
       the ones most likely to be lost again in a refactor. */
    for (const handler of [
      "handleAddBumpOut",
      "handleDragWall",
      "handleKeepSplitRegion",
      "commitFootprintShapeChange",
    ]) {
      expect(EXPECTED[handler]!.roof).toContain("REDERIVES");
      expect(footprintSitesByHandler().get(handler)!.markers).toContain("withRederivedRoof(");
    }
  });

  it("⚠ loading a project is the one site that must NOT re-derive", () => {
    const entry = footprintSitesByHandler().get("applyProjectState")!;
    /* A saved file carries its own roof. Re-deriving here would overwrite a
       roofline the user shaped, and would do it silently, on open. */
    expect(entry.markers.has("applyShapeChange(")).toBe(false);
    expect(entry.markers.has("withRederivedRoof(")).toBe(false);
    expect(entry.markers.has("applyRoofDefaultsForFootprint(")).toBe(false);
  });
});

describe("U6 stride 1: the size of the building has ONE entry point", () => {
  const src = () => readFileSync(PAGE, "utf8");

  it("⚠ nothing but the seam builds a footprint from a width and a depth", () => {
    /* `buildRectangleFootprint` and `buildOctagonFootprint` regenerate the
       whole shape from two numbers. Called anywhere but the seam and the first
       draw, that is a second resize path — which is what U6 stride 1 exists to
       remove, and what a dimension handle would otherwise have added. */
    const lines = src().split(/\r?\n/);
    let handler = "(top level)";
    const callers = new Set<string>();
    for (const line of lines) {
      const decl = line.match(HANDLER_DECL);
      if (decl) handler = decl[1]!;
      if (/^\s*(?:\*|\/\/)/.test(line)) continue;
      if (/^\s*import\b/.test(line)) continue;
      if (/\bbuild(?:Rectangle|Octagon)Footprint\s*\(/.test(line)) callers.add(handler);
    }
    /* `handleDraw` builds the shape the pointer is describing, which is the
       one case that is not a resize: the building does not exist yet. Every
       other caller goes through `footprintForBox`, which the seam owns. */
    expect([...callers].sort()).toEqual(["handleDraw"]);
  });

  it("the seam snaps before it builds, so a dragged dimension is a real one", () => {
    const seam = src().slice(src().indexOf("const resizeBuildingBoxFt"));
    const body = seam.slice(0, seam.indexOf("\n  const handleResizeOctagon"));
    expect(body).toContain("snapToEighthFt");
    expect(body).toContain("boxChanged");
    expect(body).toContain("applyShapeChange");
  });
});
