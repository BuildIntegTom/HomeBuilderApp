import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * TILE-ONCE, STAGE 1 — the inventory, as a guard rather than a document.
 *
 * Tile-once (see `building_integrity_app_spec.md`, "The tile-once editing
 * model") removes a class of behaviour: today every one of these call sites
 * re-runs the tiler over every wall, and every mechanism that preserves user
 * intent does it by anchor-and-reconcile across that re-derivation. Stages 2
 * and 4 convert the ones marked `DIRECT` below into direct manipulation of
 * the panel array, and Stage 6 then deletes the reconcile machinery they
 * needed.
 *
 * ⚠ **This test asserts nothing about behaviour. Its whole job is that NOBODY
 * ADDS A RE-TILE WITHOUT CLASSIFYING IT.** `page.tsx` is over 12,000 lines; a
 * new `retilePreservingOpenings(...)` added to a handler during the stages
 * below would be invisible in review and would quietly restore the behaviour
 * being removed. Adding one now fails here until it is named and classified.
 *
 * If you are legitimately adding or removing a call site, update `EXPECTED`
 * and say in the commit which class it is and why.
 */

const PAGE = fileURLToPath(new URL("./page.tsx", import.meta.url));

/** How a call site is meant to end up once tile-once is built. */
type Fate =
  /** A re-derivation that is CORRECT and stays. The shape itself changed (or
   * did not exist yet), so there is no prior panel array to preserve. */
  | "REDERIVES"
  /** An edit that must stop re-deriving and become direct manipulation of the
   * existing panel array. The stage that converts it is named. */
  | "DIRECT";

const EXPECTED: Record<string, { calls: number; fate: Fate; stage: string; why: string }> = {
  handleDraw: {
    calls: 1,
    fate: "REDERIVES",
    stage: "—",
    why: "The first draw IS the one tiling pass tile-once keeps. There is no prior array to preserve.",
  },
  handleAddBumpOut: {
    calls: 1,
    fate: "REDERIVES",
    stage: "—",
    why: "A bump-out changes the SHAPE — it adds walls and splits one. Re-deriving is correct; there is no prior array for the new walls.",
  },
  handleEditWallLength: {
    calls: 3,
    fate: "DIRECT",
    stage: "Stage 4",
    why: "Tommy's spec: panels enter and grow at the dragged end, and shrink and disappear on the way back. That is manipulation of the existing array, not a re-derivation of it.",
  },
  handleDragWall: {
    calls: 3,
    fate: "DIRECT",
    stage: "Stage 4",
    why: "The same as typing a length, driven by the mouse. Same treatment.",
  },
  retileAllForRunStops: {
    calls: 1,
    fate: "DIRECT",
    stage: "Stage 4",
    why: "A run stop shortens the built part of a wall, which is a length change by another name. ⚠ It is also what the run-stop opening memory exists to survive, so Stage 6 cannot delete that memory until this one is converted.",
  },
  handleSetLeastAccessibleCorner: {
    calls: 1,
    fate: "DIRECT",
    stage: "Stage 2",
    why: "This moves WHERE the safety gap sits on every wall and changes no length. Moving a slot within an array is a permutation — it preserves the multiset of widths, so it needs no tiler at all.",
  },
};

/** The component body of `page.tsx` is indented two spaces, so a declaration
 * at exactly that indent is component scope — a handler — while anything
 * deeper is a local inside one. Matching loosely is what made the first run
 * of this inventory report `nextPrimary` and `newCornersById` as owners. */
const HANDLER_DECL = /^ {2}(?:const|function)\s+([A-Za-z0-9_]+)\s*(?:=|\()/;
const CALL = /\b(?:retilePreservingOpeningsPure|retilePreservingOpenings|retile)\s*\(/;

function callSitesByHandler(): Map<string, number[]> {
  const lines = readFileSync(PAGE, "utf8").split(/\r?\n/);
  const found = new Map<string, number[]>();
  let handler = "(top level)";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const decl = line.match(HANDLER_DECL);
    if (decl) handler = decl[1]!;
    if (!CALL.test(line)) continue;
    if (/^\s*(?:\*|\/\/)/.test(line)) continue; // prose about a call, not a call
    if (/^\s*import\b/.test(line)) continue;
    // The local wrapper's own definition and body are the plumbing every
    // other site goes through, not a site of their own.
    if (handler === "retilePreservingOpenings") continue;
    if (!found.has(handler)) found.set(handler, []);
    found.get(handler)!.push(i + 1);
  }
  return found;
}

describe("tile-once Stage 1: every re-tile call site is classified", () => {
  it("the set of handlers that re-tile is exactly the inventory", () => {
    const actual = [...callSitesByHandler().keys()].sort();
    expect(actual).toEqual(Object.keys(EXPECTED).sort());
  });

  it("each handler re-tiles the number of times the inventory records", () => {
    const sites = callSitesByHandler();
    const actual: Record<string, number> = {};
    for (const [h, lines] of sites) actual[h] = lines.length;
    const expected: Record<string, number> = {};
    for (const [h, e] of Object.entries(EXPECTED)) expected[h] = e.calls;
    expect(actual).toEqual(expected);
  });

  it("the inventory is non-vacuous — it really found call sites in page.tsx", () => {
    const total = [...callSitesByHandler().values()].reduce((n, l) => n + l.length, 0);
    // If page.tsx is ever refactored so these live elsewhere, this test is
    // measuring nothing and should be moved rather than left passing.
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it("⚠ records what tile-once still has to convert, so the size of the job is visible", () => {
    const direct = Object.entries(EXPECTED).filter(([, e]) => e.fate === "DIRECT");
    const rederives = Object.entries(EXPECTED).filter(([, e]) => e.fate === "REDERIVES");
    // Not a behaviour assertion — a statement of scope that fails if someone
    // reclassifies a site without thinking about it.
    expect(direct.map(([h]) => h).sort()).toEqual([
      "handleDragWall",
      "handleEditWallLength",
      "handleSetLeastAccessibleCorner",
      "retileAllForRunStops",
    ]);
    expect(rederives.map(([h]) => h).sort()).toEqual(["handleAddBumpOut", "handleDraw"]);
  });
});

describe("tile-once Stage 1: what already does NOT re-tile", () => {
  it("changing the standard panel width re-tiles nothing", () => {
    // Found during the Stage 1 inventory, 2026-10-07, and recorded because it
    // is surprising in BOTH directions: a user who changes the standard width
    // sees existing walls keep their panels, which looks like a bug today —
    // and is exactly right under tile-once. Nothing should "fix" it by adding
    // a re-tile here; that would be work to undo.
    const src = readFileSync(PAGE, "utf8");
    const setterCalls = [...src.matchAll(/setStandardWidthIn\s*\(/g)];
    expect(setterCalls.length).toBeGreaterThan(0);
    const sites = callSitesByHandler();
    for (const handler of sites.keys()) {
      expect(handler).not.toMatch(/StandardWidth/i);
    }
  });
});
