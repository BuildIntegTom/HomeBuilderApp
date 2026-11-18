import { describe, expect, it } from "vitest";
import {
  INSTALL_PHASE_ORDER,
  type InstallSequenceItem,
  computeInstallSequence,
  installStepsForSheet,
} from "./installSequence";
import * as installSequenceModule from "./installSequence";
import { panelKey } from "./panelKey";

/* ──────────────────────────────────────────────────────────────────────────
   B35 — THE INSTALL SEQUENCE

   His order: *"from point of least accessability, clockwise, from out to in,
   from bottom to top by label of 0000, 0001, 0002, etc."*

   ⚠ This module SORTS. It does not know what a wall is — the rotation to the
   least-accessible corner, the clockwise question and the ring order are each
   already computed elsewhere and handed in as indices, so there is only one
   derivation of each in the app.
   ────────────────────────────────────────────────────────────────────────── */

let seq = 0;
function item(partial: Partial<InstallSequenceItem> & { name: string }): InstallSequenceItem {
  return { family: "wall-panel", phase: "wall", pipelineIndex: seq++, ...partial };
}

/** The 1-based positions, in order, as names. */
function order(items: readonly InstallSequenceItem[]): string[] {
  const sequence = computeInstallSequence(items);
  return [...sequence.entries()].sort((a, b) => a[1] - b[1]).map(([key]) => key.split("|")[1]!);
}

describe("the install sequence follows his clauses, outermost first", () => {
  it("⚠ PHASE first — the deck is under the walls, and the roof goes on last", () => {
    /* His packet order, 2026-11-04: floor sheets first, walls, truss plate,
       roof last. A strict bottom-to-top reading of B35 gives the same answer,
       which is why phase leads rather than competing with it. */
    expect(
      order([
        item({ name: "R1", phase: "roof", family: "roof-panel" }),
        item({ name: "T1", phase: "roof-bearing", family: "roof-bearing" }),
        item({ name: "N1", phase: "wall" }),
        item({ name: "F1", phase: "floor", family: "floor-panel" }),
      ]),
    ).toEqual(["F1", "N1", "T1", "R1"]);
  });

  it("the phase order is exactly his packet order", () => {
    expect([...INSTALL_PHASE_ORDER]).toEqual(["floor", "wall", "roof-bearing", "roof"]);
  });

  it("⚠ then the families with no position — a beam never numbers ahead of every panel", () => {
    /* His clauses place a PANEL. They do not place a spanning header over
       three of them, or a Mid-Wall Bond Beam partway up a wall. Left at the
       defaults those would sort to 0 on every positional field and take
       `0001` on the whole building, which is the bug `groupRank` exists to
       stop. Positioned families first, the rest after. */
    expect(
      order([
        item({ name: "beam", family: "Mid-wall beam", groupRank: 2, pipelineIndex: 0 }),
        item({ name: "header", family: "Spanning header", groupRank: 1, pipelineIndex: 1 }),
        item({ name: "N1", wallIndex: 0, slotIndex: 0, pipelineIndex: 2 }),
        item({ name: "W9", wallIndex: 3, slotIndex: 9, pipelineIndex: 3 }),
      ]),
    ).toEqual(["N1", "W9", "header", "beam"]);
  });

  it("⚠ then BOTTOM TO TOP by story — a second storey never numbers before a ground panel", () => {
    expect(
      order([
        item({ name: "up2", storyIndex: 1, wallIndex: 0 }),
        item({ name: "ground9", storyIndex: 0, wallIndex: 9 }),
        item({ name: "up1", storyIndex: 1, wallIndex: 0, slotIndex: 0 }),
      ]),
    ).toEqual(["ground9", "up2", "up1"]);
  });

  it("⚠ then OUT TO IN — the outer ring finishes before an inner one starts", () => {
    /* Ring-major, which is the obvious reading of "out to in" and matches
       install order: you cannot reach the courtyard wall through the
       building's own outer wall. */
    expect(
      order([
        item({ name: "inner-first-wall", ringIndex: 1, wallIndex: 0 }),
        item({ name: "outer-last-wall", ringIndex: 0, wallIndex: 7 }),
      ]),
    ).toEqual(["outer-last-wall", "inner-first-wall"]);
  });

  it("then CLOCKWISE from the least-accessible corner, by the rotated wall index", () => {
    /* `wallIndex` is the position AFTER the caller has rotated the ring to
       start at the PLA corner, so 0 is that corner's own wall whatever its
       footprint id. */
    expect(
      order([
        item({ name: "third", wallIndex: 2 }),
        item({ name: "first", wallIndex: 0 }),
        item({ name: "second", wallIndex: 1 }),
      ]),
    ).toEqual(["first", "second", "third"]);
  });

  it("then along the wall, and then BOTTOM TO TOP within one slot", () => {
    /* A window's sill and the header above it share a slot index and are
       stacked in elevation, which is what `bandIndex` is for. */
    expect(
      order([
        item({ name: "header", wallIndex: 0, slotIndex: 3, bandIndex: 1 }),
        item({ name: "sill", wallIndex: 0, slotIndex: 3, bandIndex: 0 }),
        item({ name: "next-panel", wallIndex: 0, slotIndex: 4 }),
        item({ name: "prev-panel", wallIndex: 0, slotIndex: 2 }),
      ]),
    ).toEqual(["prev-panel", "sill", "header", "next-panel"]);
  });

  it("⚠ the pipeline index breaks every remaining tie, so the order is TOTAL", () => {
    /* Nothing is left to the sort's stability or to object key order: the same
       building must number the same way every time, so a renumber can only be
       caused by a real change to the building. */
    const a = item({ name: "a", pipelineIndex: 5 });
    const b = item({ name: "b", pipelineIndex: 2 });
    expect(order([a, b])).toEqual(["b", "a"]);
    /* And it is what carries the families with no wall position at all — a
       deck panel or a beam, where the pipeline's own order is the only answer
       there is. */
    expect(
      order([
        item({ name: "F3", phase: "floor", family: "floor-panel", pipelineIndex: 3 }),
        item({ name: "F1", phase: "floor", family: "floor-panel", pipelineIndex: 1 }),
        item({ name: "F2", phase: "floor", family: "floor-panel", pipelineIndex: 2 }),
      ]),
    ).toEqual(["F1", "F2", "F3"]);
  });

  it("numbers are 1-based and contiguous", () => {
    const items = [item({ name: "a" }), item({ name: "b" }), item({ name: "c" })];
    expect([...computeInstallSequence(items).values()].sort((x, y) => x - y)).toEqual([1, 2, 3]);
  });
});

describe("⚠ a STEP IS NOT A NUMBER — B36 stride 2", () => {
  it("⚠ this module exports no four-digit formatter at all any more", () => {
    /* The regression, pinned as a type-level fact rather than a comment.
       `formatInstallSequenceNumber` zero-padded a step to four digits, which
       made an ORDER look exactly like an IDENTITY sitting next to one: a panel
       could read install `0042` and crew code `P-0017` on the same row. The
       four-digit token is `formatPanelNumber`'s alone now, and a step is a
       plain integer. */
    const mod: Record<string, unknown> = installSequenceModule;
    expect(Object.keys(mod).filter((k) => k.toLowerCase().includes("format"))).toEqual([]);
  });

  it("⚠ and the key lives in ONE place now, not two pinned-equal copies", () => {
    /* `installSequenceKey` and `panelCodeKey` were byte-identical bodies in two
       modules that could not import each other, kept equal by a test. Both are
       gone; `panelKey` is the formula. */
    expect(panelKey("wall-panel", "N3", 0)).toBe("wall-panel|N3");
    expect(panelKey("beam", "", 4)).toBe("beam|#4");
  });
});

describe("the key", () => {
  it("⚠ scopes by family, so a wall panel and a deck panel named alike are two panels", () => {
    const sequence = computeInstallSequence([
      item({ name: "1", family: "wall-panel", phase: "wall" }),
      item({ name: "1", family: "floor-panel", phase: "floor" }),
    ]);
    expect(sequence.size).toBe(2);
    /* And the deck one is FIRST, because the phase says so. */
    expect(sequence.get("floor-panel|1")).toBe(1);
    expect(sequence.get("wall-panel|1")).toBe(2);
  });

  it("⚠ a duplicate key keeps its FIRST position rather than overwriting", () => {
    /* Taking the later one would let the number on the drawing and the number
       on the sheet differ for one panel. */
    const sequence = computeInstallSequence([
      item({ name: "N1", wallIndex: 0, pipelineIndex: 0 }),
      item({ name: "N1", wallIndex: 5, pipelineIndex: 1 }),
      item({ name: "N2", wallIndex: 1, pipelineIndex: 2 }),
    ]);
    expect(sequence.get("wall-panel|N1")).toBe(1);
    expect(sequence.get("wall-panel|N2")).toBe(2);
    expect(sequence.size).toBe(2);
  });
});

describe("what one fabrication sheet prints", () => {
  const sequence = new Map([
    ["wall-panel|N1", 7],
    ["wall-panel|N2", 3],
    ["wall-panel|N3", 44],
  ]);

  it("⚠ lists the STEPS it covers, sorted numerically, as a TAG", () => {
    /* Never a group key: keying a sheet on a unique number would take a Tiny
       House from ~12 sheets to 74 and retire B25's pusher-head order.

       ⚠ **Plain integers, not `"0003"`** — B36 stride 2. These print as "step
       3 of 134", which is the one reading that cannot be mistaken for the
       panel's own number. */
    expect(installStepsForSheet(["wall-panel|N1", "wall-panel|N3", "wall-panel|N2"], sequence)).toEqual([3, 7, 44]);
  });

  it("leaves out a key the sequence has never heard of rather than inventing one", () => {
    expect(installStepsForSheet(["wall-panel|N2", "wall-panel|nope"], sequence)).toEqual([3]);
  });

  it("an empty sheet prints nothing", () => {
    expect(installStepsForSheet([], sequence)).toEqual([]);
  });
});
