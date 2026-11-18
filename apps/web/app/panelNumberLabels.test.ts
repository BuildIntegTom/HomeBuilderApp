import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, retile } from "@building-integrity/geometry";
import { EMPTY_PANEL_NUMBER_LEDGER, panelKey, stampPanelNumbers } from "@building-integrity/panel-catalog";
import { allPanelInstances, combinedPanelLabel, exportGroupLabel, type PanelInstance } from "./panelInstances";

/* ──────────────────────────────────────────────────────────────────────────
   B36 stride 3 — THE LABEL IS THE NUMBER

   > *"the label IS the number"* — the panel's number is what a drawing shows,
   and `N3` becomes a separate LOCATION field beside it rather than the other
   half of the same token.

   ⚠ The number and the location are different KINDS of fact: one is frozen at
   issue and one moves whenever a panel is inserted upstream. This file pins
   the display seam they meet at.
   ────────────────────────────────────────────────────────────────────────── */

const STANDARD_IN = 48;
const CORNER_IN = 15.5;
const THICKNESS_IN = 15.5;

function instances(): PanelInstance[] {
  const fp = buildRectangleFootprint(24, 16);
  const slots = retile(fp, "A", new Set(["A", "B", "C", "D"]), STANDARD_IN, CORNER_IN, THICKNESS_IN);
  return allPanelInstances(fp, slots, STANDARD_IN, "plywood");
}

describe("⚠ combinedPanelLabel labels by NUMBER when it is handed numbers", () => {
  it("one panel reads its number, not its location", () => {
    const [first] = instances();
    const numbers = new Map([[first!.name, "0042"]]);
    expect(combinedPanelLabel([first!], numbers)).toBe("0042");
    /* And the location is still there, as its own separate fact on the
       instance — never parsed back out of the label. */
    expect(first!.name).toMatch(/^[A-Z]+\d+$/);
  });

  it("⚠ a window slot's header and sill join by NUMBER, not by series index", () => {
    /* One drawn rectangle covers both, so one label has to cover both. It used
       to read `N3+4`, a shared compass prefix and two series indices. With
       numbers it is two whole numbers, because they no longer share a prefix —
       and two panels on one rectangle is exactly the case a half-numbered
       label would be worst for. */
    const all = instances();
    const a = all[0]!;
    const b = all[1]!;
    const numbers = new Map([
      [a.name, "0007"],
      [b.name, "0008"],
    ]);
    expect(combinedPanelLabel([a, b], numbers)).toBe("0007+0008");
    /* ⚠ **Ascending, whichever order the instances arrive in.** A window
       slot's header and sill come header-first, which rendered as `0019+0018`
       on a real plan — a descending pair reads as a typo. The numbers are
       zero-padded, so a lexical sort is a numeric one. */
    expect(combinedPanelLabel([b, a], numbers)).toBe("0007+0008");
  });

  it("⚠ falls back to the LOCATION label when ANY instance in the group has no number", () => {
    /* Two real cases: a sheet rendered with no project context, and a panel
       drawn since the project was issued, which genuinely has no number. A
       MIXED label would be the worst of the three answers — it would read as a
       number for one panel and as a location for the other, in one string. */
    const all = instances();
    const a = all[0]!;
    const b = all[1]!;
    expect(combinedPanelLabel([a, b], new Map([[a.name, "0007"]]))).toBe(
      combinedPanelLabel([a, b]),
    );
  });

  it("with no map at all it is byte-identical to the old label", () => {
    /* Every caller without project context — and there are several — has to be
       untouched by this stride. */
    const all = instances();
    for (const inst of all) {
      expect(combinedPanelLabel([inst], undefined)).toBe(inst.name);
    }
  });

  it("an empty group is still an empty label", () => {
    expect(combinedPanelLabel([], new Map([["N1", "0001"]]))).toBe("");
  });
});

describe("⚠ a 3D model's group name is the ONE place the two are concatenated", () => {
  it("number first, location after — `0042_N3`", () => {
    /* Forced, not chosen: an OBJ group name is a single string with nowhere to
       put a second field. Number first so SketchUp's Outliner sorts in panel
       order. */
    const [first] = instances();
    expect(exportGroupLabel([first!], new Map([[first!.name, "0042"]]))).toBe(`0042_${first!.name}`);
  });

  it("⚠ and with no numbers it is the old group name exactly, with no stray separator", () => {
    /* A model exported by a caller with no project context must not grow a
       trailing underscore. */
    const [first] = instances();
    expect(exportGroupLabel([first!])).toBe(first!.name);
    expect(exportGroupLabel([first!], new Map())).toBe(first!.name);
  });
});

describe("⚠ the ledger's key and a drawing's key are the same key", () => {
  it("a stamped number is findable from an instance's own name", () => {
    /* The seam stride 3 rests on: a drawing holds `PanelInstance`s and knows
       nothing about export families, so page.tsx builds a name-keyed map from
       the family-keyed ledger. If those two keys ever drift, every drawing
       silently falls back to location labels. */
    const all = instances();
    const keys = all.map((inst) => panelKey("Wall panel", inst.name, 0));
    const ledger = stampPanelNumbers(keys, EMPTY_PANEL_NUMBER_LEDGER, new Map());
    const byName = new Map(all.map((inst) => [inst.name, ledger.codesByKey[panelKey("Wall panel", inst.name, 0)]!]));
    expect([...byName.values()].every((n) => /^\d{4}$/.test(n))).toBe(true);
    expect(new Set(byName.values()).size).toBe(all.length);
  });
});
