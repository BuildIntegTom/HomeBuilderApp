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
  handleRepanelizeRequest: {
    calls: 2,
    fate: "REDERIVES",
    stage: "—",
    why:
      "Repanelize IS the deliberate re-derivation — the one call site whose entire purpose is to re-tile, asked for by name and behind a confirmation. " +
      "⚠ It runs the tiler to WORK OUT THE PROGNOSIS, not to apply it: the result is held and applied only if the user confirms, so what they approved is what they get and confirming costs no second pass. " +
      "⚠ TWO calls since 2026-10-10: the ground storey and the second. Repanelize exists to actuate a settings change (Tommy), so leaving half a building on the old settings while clearing the caution markers — which say it HAS been applied — would be the worst of both. " +
      "⚠ This test caught this handler twice: once when it was added without a classification, and again when it grew its second call.",
  },
  /* ⚠ `handleEditWallLength` LEFT THIS LIST ON 2026-10-16 — Stage 4a/4b, and
     the second handler to stop re-tiling after `handleSetLeastAccessibleCorner`.
     All three of its calls are gone: the bump-out, rectangle and octagon paths
     now resize each wall's existing panel array via `resizeWallRun`, at
     whichever end actually moved (`wallGrowthEnd`). Two of six handlers remain.

     This test did its job on the way through: it went red the moment the last
     call disappeared, which is the signal that the inventory — not just the
     code — had to be updated deliberately. */
  handleDragWall: {
    calls: 1,
    fate: "REDERIVES",
    stage: "—",
    why:
      "⚠ RECLASSIFIED 2026-10-16, Stage 4c, and this is a CHANGE OF MIND recorded rather than hidden. Two of its three calls are gone — the ordinary right-angle drag and the octagon drag are pure length changes and now resize panels directly. " +
      "The one that remains is the COLLAPSE branch (Tommy: 'walls can snap back into each other and reform a straight one'), which REMOVES a wall and renumbers every survivor. " +
      "That is a shape change, not a length change: the merged wall has no single prior panel array to manipulate, so there is nothing for tile-once to preserve and re-deriving is the correct answer. " +
      "It is classified REDERIVES for the same reason `handleAddBumpOut` is, and it is NOT work left undone.",
  },
  retileAllForRunStops: {
    calls: 1,
    fate: "DIRECT",
    stage: "Stage 4",
    why:
      "⚠ PARTLY CONVERTED 2026-10-17, Stage 4d. The APPLY path is gone: a stop now resizes panels and sets aside what it removes (`applyRunStopChange`), which also replaces what the run-stop opening memory did — and improves on it, since a remembered slot array restores hand-set widths and types, not just openings. " +
      "The ONE call left is the legality PROBE: it re-tiles a candidate stop to ask whether the result would be panelizable, and applies nothing. Converting it means asking the same question of `applyRunStopChange` instead, and it is the last thing standing between here and Stage 6.",
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
    /* ⚠ Lowered from 10 to 6 as Stage 4 removes call sites. It is a
       NON-VACUITY floor, not a target: its only job is to fail if a refactor
       moves these calls out of page.tsx entirely and leaves this file
       measuring nothing. It must keep dropping as the remaining handlers
       convert, and when it reaches the three REDERIVES sites it stops. */
    expect(total).toBeGreaterThanOrEqual(6);
  });

  it("⚠ records what tile-once still has to convert, so the size of the job is visible", () => {
    const direct = Object.entries(EXPECTED).filter(([, e]) => e.fate === "DIRECT");
    const rederives = Object.entries(EXPECTED).filter(([, e]) => e.fate === "REDERIVES");
    // Not a behaviour assertion — a statement of scope that fails if someone
    // reclassifies a site without thinking about it.
    /* ⚠ `handleSetLeastAccessibleCorner` LEFT THIS LIST ON 2026-10-10 — the
       first handler to stop re-tiling, and the one Stage 2 originally
       targeted. Not by the permutation that was attempted and abandoned
       (it moved windows up to 59in), but by becoming a DEFERRED setting:
       it now changes nothing but the setting, shows a caution marker, and
       is applied by Repanelize. Three of six handlers remain. */
    expect(direct.map(([h]) => h).sort()).toEqual(["retileAllForRunStops"]);
    /* ⚠ Four REDERIVES sites now, up from three — `handleDragWall`'s collapse
       branch joined them by reclassification, not by someone adding a re-tile.
       Asserted so that growth has to be deliberate: a FIFTH would mean a
       handler quietly went back to re-deriving. */
    expect(rederives.length).toBe(4);
    expect(rederives.map(([h]) => h).sort()).toEqual([
      "handleAddBumpOut",
      "handleDragWall",
      "handleDraw",
      "handleRepanelizeRequest",
    ]);
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
