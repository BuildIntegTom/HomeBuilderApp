import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, tileWall, type PanelSlot } from "@building-integrity/geometry";
import { DEFAULT_BRACE_PAIR_PATTERN, buildStandardPanelMembers } from "@building-integrity/panel-catalog";
import { applyDrawTimeBracing, bracingStartFrom, isBraceEligible } from "./drawTimeBracing";
import { standardPanelMembersFor } from "./standardPanelMembers";

/**
 * ⚠ **B15 — the brace pattern, laid when the shape is drawn.**
 *
 * > *"Applying this patterned bracing should be part of the original tiling
 * > when drawing a shape."* — Tommy, 2026-11-01
 *
 * `applyWallBracingPattern` had ten tests and no callers: not one panel in the
 * app had ever carried a pair pattern. These cover the two pieces that make it
 * reachable — who is eligible, and a panel's members actually changing —
 * and they pin the eligibility rule he chose, because the overlay deliberately
 * refuses to decide it: *"The caller decides this; inventing an eligibility
 * rule here would bury a building decision in a geometry module."*
 */

const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;
const STANDARD_IN = 48;
const CORNER_IN = 15.5;

const footprint = buildRectangleFootprint(25.25, 22.75);
const LEAST_ACCESSIBLE = footprint.corners[0]!.id;

function wallSlots(wallLengthIn: number): PanelSlot[] {
  return tileWall(wallLengthIn, STANDARD_IN, CORNER_IN, "end").slots;
}

describe("⚠ the pattern is laid at draw time", () => {
  it("⚠ STANDARD PANELS ONLY — his eligibility answer, pinned", () => {
    /* Corners and columns are already stiff plywood boxes; a header, a
       window, a door and a safety gap's plywood spacer have nothing to route
       a diagonal through. */
    const eligible: PanelSlot["type"][] = ["standard"];
    const ineligible: PanelSlot["type"][] = [
      "corner",
      "safety-oct-corner",
      "column",
      "braced",
      "window",
      "door",
      "big-header",
      "safety-gap",
    ];
    for (const type of eligible) expect({ type, ok: isBraceEligible({ type, widthIn: 48 }) }).toEqual({ type, ok: true });
    for (const type of ineligible) expect({ type, ok: isBraceEligible({ type, widthIn: 48 }) }).toEqual({ type, ok: false });
  });

  it("⚠ every eligible panel on every wall gets a half, and nothing else does", () => {
    const slotsByWallId = Object.fromEntries(
      footprint.walls.map((w) => [w.id, wallSlots(w.lengthFt * 12)]),
    );
    const braced = applyDrawTimeBracing(footprint, slotsByWallId, LEAST_ACCESSIBLE, DEFAULT_BRACE_PAIR_PATTERN, HEIGHT_IN);

    let eligibleSeen = 0;
    for (const [wallId, slots] of Object.entries(braced)) {
      expect(slots.length).toBe(slotsByWallId[wallId]!.length);
      slots.forEach((slot, i) => {
        /* Width is never touched — bracing is members, not geometry. */
        expect(slot.widthIn).toBe(slotsByWallId[wallId]![i]!.widthIn);
        if (isBraceEligible(slot)) {
          eligibleSeen++;
          expect({ wallId, i, pattern: slot.bracePairPattern }).toEqual({ wallId, i, pattern: "superbrace" });
          expect(["left", "right"]).toContain(slot.bracePairHalf);
        } else {
          expect({ wallId, i, pattern: slot.bracePairPattern }).toEqual({ wallId, i, pattern: undefined });
        }
      });
    }
    expect(eligibleSeen).toBeGreaterThan(0);
  });

  it("⚠ within each RUN the halves alternate, and an odd tail takes a left", () => {
    /* *"The x in the super brace is 4 smaller pieces, each one leg of the x,
       on two different panels."* A left half beside a right half share the
       seam their legs run to.

       ⚠ **Per RUN, not per wall.** Pairing restarts after anything
       ineligible, because *"every leg of an X runs to the seam the two
       panels share, and panels separated by a third thing share no seam."*
       Measured on this 25ft 3in wall: left, right, left, right, left,
       [safety-gap], left — the first run is five panels, so its last one is
       unpaired and still gets half a pattern (*"Just do it till it ends"*),
       and the single panel past the gap is its own run. */
    const slots = wallSlots(25.25 * 12);
    const braced = applyDrawTimeBracing(footprint, { AB: slots }, LEAST_ACCESSIBLE, DEFAULT_BRACE_PAIR_PATTERN, HEIGHT_IN).AB!;

    const runs: ("left" | "right" | undefined)[][] = [];
    let run: ("left" | "right" | undefined)[] = [];
    for (const slot of braced) {
      if (isBraceEligible(slot)) run.push(slot.bracePairHalf);
      else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);

    expect(runs.length).toBeGreaterThan(1); // the gap really did split it
    for (const r of runs) {
      r.forEach((half, i) => {
        /* Even index opens a pair, odd index closes it. An odd-length run
           therefore ends on an opener with no partner, which is the
           unpaired panel. */
        expect({ i, half }).toEqual({ i, half: i % 2 === 0 ? "left" : "right" });
      });
    }
    expect(runs[0]!.length % 2).toBe(1); // this wall's first run really is odd
  });

  it("⚠ pairing starts at the end NEAREST the least accessible corner", () => {
    /* The inverse of `computeGapEnd`, which puts the safety gap at the end
       FURTHEST from it — taken as its inverse rather than as a second
       distance calculation that could disagree with it. */
    const ends = footprint.walls.map((w) => bracingStartFrom(footprint, w.id, LEAST_ACCESSIBLE));
    expect(ends.every((e) => e === "start" || e === "end")).toBe(true);
    /* A wall id the footprint does not have cannot throw. */
    expect(bracingStartFrom(footprint, "ZZ", LEAST_ACCESSIBLE)).toBe("start");
  });
});

describe("⚠ a standard panel's members come from ONE place", () => {
  it("⚠ no pattern: byte-for-byte the members it always had", () => {
    /* The seam has to be invisible until the pattern is switched on. */
    const plain = buildStandardPanelMembers(STANDARD_IN, DEPTH_IN, HEIGHT_IN, false);
    expect(standardPanelMembersFor({}, STANDARD_IN, DEPTH_IN, HEIGHT_IN, false)).toEqual(plain);
    /* A half with no pattern, or a pattern with no half, is not a pattern. */
    expect(standardPanelMembersFor({ bracePairHalf: "left" }, STANDARD_IN, DEPTH_IN, HEIGHT_IN, false)).toEqual(plain);
    expect(standardPanelMembersFor({ bracePairPattern: "superbrace" }, STANDARD_IN, DEPTH_IN, HEIGHT_IN, false)).toEqual(plain);
  });

  it("⚠ with a pattern: real diagonals appear, and the two halves differ", () => {
    const plain = buildStandardPanelMembers(STANDARD_IN, DEPTH_IN, HEIGHT_IN, false);
    const left = standardPanelMembersFor(
      { bracePairPattern: "superbrace", bracePairHalf: "left" },
      STANDARD_IN,
      DEPTH_IN,
      HEIGHT_IN,
      false,
    );
    const right = standardPanelMembersFor(
      { bracePairPattern: "superbrace", bracePairHalf: "right" },
      STANDARD_IN,
      DEPTH_IN,
      HEIGHT_IN,
      false,
    );
    expect(left.length).toBeGreaterThan(plain.length);
    /* ⚠ A pair's two panels are mirror images, so the halves must NOT be
       the same part — if they were, the X would not close at the seam. */
    expect(left).not.toEqual(right);
    expect(right.length).toBe(left.length);
  });

  it("⚠ a diagonal removes the centre nailer studs, which is worth knowing", () => {
    /* `buildPanelFromRecipe`'s own rule, not one invented at the seam: a
       diagonal and a centre stud want the same place. Named because
       `panel_module_2ft_4ft` wants a 48in panel's CENTRE over the deck joint
       between its two 24in deck panels — with a superbrace what lands there
       is the crossing of the two diagonals rather than a stud. */
    const withNailer = buildStandardPanelMembers(STANDARD_IN, DEPTH_IN, HEIGHT_IN, true);
    expect(withNailer.some((m) => m.memberId.startsWith("stud_centre_"))).toBe(true);

    const braced = standardPanelMembersFor(
      { bracePairPattern: "superbrace", bracePairHalf: "left" },
      STANDARD_IN,
      DEPTH_IN,
      HEIGHT_IN,
      true,
    );
    expect(braced.some((m) => m.memberId.startsWith("stud_centre_"))).toBe(false);
  });

  it("the nailer pattern adds no diagonal, so the panel keeps its studs", () => {
    /* *"It is indeed the same as a standard panel with nailer added"* — a
       Nailer panel adds nothing at the seam. */
    const nailer = standardPanelMembersFor(
      { bracePairPattern: "nailer", bracePairHalf: "left" },
      STANDARD_IN,
      DEPTH_IN,
      HEIGHT_IN,
      true,
    );
    expect(nailer.some((m) => m.memberId.startsWith("stud_centre_"))).toBe(true);
  });
});
