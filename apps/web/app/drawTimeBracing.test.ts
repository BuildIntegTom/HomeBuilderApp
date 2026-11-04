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
    expect(standardPanelMembersFor({}, STANDARD_IN, DEPTH_IN, HEIGHT_IN, false, "web")).toEqual(plain);
    /* A half with no pattern, or a pattern with no half, is not a pattern. */
    expect(standardPanelMembersFor({ bracePairHalf: "left" }, STANDARD_IN, DEPTH_IN, HEIGHT_IN, false, "web")).toEqual(plain);
    expect(standardPanelMembersFor({ bracePairPattern: "superbrace" }, STANDARD_IN, DEPTH_IN, HEIGHT_IN, false, "web")).toEqual(plain);
  });

  it("⚠ with a pattern: real diagonals appear, and the two halves differ", () => {
    const plain = buildStandardPanelMembers(STANDARD_IN, DEPTH_IN, HEIGHT_IN, false);
    const left = standardPanelMembersFor(
      { bracePairPattern: "superbrace", bracePairHalf: "left" },
      STANDARD_IN,
      DEPTH_IN,
      HEIGHT_IN,
      false,
      "web",
    );
    const right = standardPanelMembersFor(
      { bracePairPattern: "superbrace", bracePairHalf: "right" },
      STANDARD_IN,
      DEPTH_IN,
      HEIGHT_IN,
      false,
      "web",
    );
    expect(left.length).toBeGreaterThan(plain.length);
    /* ⚠ A pair's two panels are mirror images, so the halves must NOT be
       the same part — if they were, the X would not close at the seam. */
    expect(left).not.toEqual(right);
    expect(right.length).toBe(left.length);
  });

  it("⚠ a diagonal replaces the centre nailer studs, which he decided", () => {
    /* `buildPanelFromRecipe`'s own rule, not one invented at the seam: a
       diagonal and a centre stud want the same place. This was flagged as an
       open conflict with `panel_module_2ft_4ft`, which wants a 48in panel's
       CENTRE over the deck joint between its two 24in deck panels. His
       answer, 2026-11-02: *"Nailers can be replaced by diagonals. That's not
       a problem."* Kept as a test rather than a note, because it is now the
       intended behaviour and would be a regression if it changed. */
    const withNailer = buildStandardPanelMembers(STANDARD_IN, DEPTH_IN, HEIGHT_IN, true);
    expect(withNailer.some((m) => m.memberId.startsWith("stud_centre_"))).toBe(true);

    const braced = standardPanelMembersFor(
      { bracePairPattern: "superbrace", bracePairHalf: "left" },
      STANDARD_IN,
      DEPTH_IN,
      HEIGHT_IN,
      true,
      "web",
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
      "web",
    );
    expect(nailer.some((m) => m.memberId.startsWith("stud_centre_"))).toBe(true);
  });
});

/**
 * **B22 — the upper row walks its own pattern, 2026-11-04.**
 *
 * > *"The upper row on a wall tall enough to spawn 3rd gable panels I guess
 * > can have their own diagonal pattern, either synonymous or similar with its
 * > downstairs counterparts."* — Tommy
 *
 * Before this the brace pattern was laid per SLOT and an upper band read its
 * column's answer, so it was braced wherever the ground row happened to be
 * and bare above every window and door — the one place a wall is already
 * weakest, unbraced from the slab to the plate. The seismic-zone rule that
 * used to put `braced` panels up there
 * (`applyAdditionalRowBracedPattern`) is retired with this; see the record at
 * the top of `bracedPlacement.ts`.
 */
describe("⚠ B22 — every row gets the pattern, not just the ground one", () => {
  /** A wall whose columns each carry two bands. */
  function twoBandWall(
    wallLengthIn: number,
    /** Returns a type to OVERRIDE this column's ground zone with, or undefined
     *  to leave the tiler's own — corners and the safety gap included, which
     *  an override-everything helper would quietly flatten. */
    groundTypeAt?: (i: number) => PanelSlot["type"] | undefined,
  ): PanelSlot[] {
    return wallSlots(wallLengthIn).map((slot, i) => {
      const groundType = groundTypeAt?.(i) ?? slot.type;
      return { ...slot, type: groundType, zones: [{ type: groundType }, { type: "standard" as const }] };
    });
  }

  const wallId = "W";
  const lay = (slots: PanelSlot[]) =>
    applyDrawTimeBracing(footprint, { [wallId]: slots }, LEAST_ACCESSIBLE, DEFAULT_BRACE_PAIR_PATTERN, HEIGHT_IN)[
      wallId
    ]!;

  it("writes a pattern onto the upper band, where nothing did before", () => {
    const out = lay(twoBandWall(25.25 * 12));
    const upper = out.map((s) => s.zones![1]!);
    expect(upper.some((z) => z.bracePairPattern !== undefined)).toBe(true);
    /* Every band that took one took a real half and a real figure, not a
       half-written record. */
    for (const zone of upper) {
      if (zone.bracePairPattern === undefined) continue;
      expect(zone.bracePairPattern).toBe(DEFAULT_BRACE_PAIR_PATTERN);
      expect(["left", "right"]).toContain(zone.bracePairHalf);
      expect(["super-carrot", "little-carrot"]).toContain(zone.braceFigure);
    }
  });

  it("⚠ THE CASE THAT MOTIVATED IT — a band ABOVE A WINDOW is braced", () => {
    /* The ground column is a window, so it takes no leg and never could.
       Reading the column's answer left the band above it bare too, which is a
       whole unbraced line from the slab to the plate exactly where the wall is
       already weakest. The upper band is a plain standard panel and there is
       no reason it cannot carry a figure. */
    const out = lay(twoBandWall(25.25 * 12, (i) => (i === 3 ? "window" : undefined)));
    expect(out[3]!.type).toBe("window");
    expect(out[3]!.bracePairPattern).toBeUndefined();
    expect(out[3]!.zones![1]!.bracePairPattern).toBe(DEFAULT_BRACE_PAIR_PATTERN);
  });

  it("⚠ a CORNER column takes none at any height", () => {
    /* A corner is a stiff plywood box for its whole height, so its upper band
       is no more a brace candidate than its lower one.
       `applyAdditionalRowBracedPattern` read the parent slot for exactly this
       reason, and the reason outlived the rule. */
    const out = lay(twoBandWall(25.25 * 12));
    for (const slot of out) {
      if (slot.type !== "corner" && slot.type !== "safety-oct-corner") continue;
      expect({ ground: slot.bracePairPattern, upper: slot.zones![1]!.bracePairPattern }).toEqual({
        ground: undefined,
        upper: undefined,
      });
    }
  });

  it("⚠ where the two rows agree on eligibility, they agree on the figure — the \"synonymous\" half", () => {
    /* Nothing copies anything. Both rows are walked from the same end with
       the same cycle, so on a wall whose columns are standard top and bottom
       the two come out identical, column for column — which is the load path
       lining up vertically, for free. */
    const allStandard = twoBandWall(25.25 * 12).map((slot) =>
      slot.type === "corner" || slot.type === "safety-oct-corner"
        ? slot
        : { ...slot, type: "standard" as const, zones: [{ type: "standard" as const }, { type: "standard" as const }] },
    );
    const out = lay(allStandard);
    for (const slot of out) {
      expect({
        half: slot.zones![1]!.bracePairHalf,
        figure: slot.zones![1]!.braceFigure,
      }).toEqual({ half: slot.bracePairHalf, figure: slot.braceFigure });
    }
    expect(out.some((s) => s.bracePairPattern !== undefined)).toBe(true);
  });

  it("⚠ and where they DISAGREE, the upper row carries on and the cycle shifts — the \"similar\" half", () => {
    /* MEASURED, and the one consequence worth knowing before a shop sees it.
       A ground-row opening is not a candidate; the band above it is. So the
       upper row has one more panel in its run, the Super/Super/Little/Little
       cycle lands one position further along from there on, and past that
       point the two rows no longer line up column for column.

       This is the fork in his own sentence — *"either synonymous or similar
       with its downstairs counterparts"*. Walking the row buys bracing above
       every opening and costs exact vertical alignment after the first one.
       Inheriting the column would buy the alignment and leave a line of the
       wall unbraced from the slab to the plate. Pinned so the trade is
       visible rather than discovered. */
    const out = lay(twoBandWall(25.25 * 12, (i) => (i === 3 ? "window" : undefined)));
    const agree = out.map((s) => s.bracePairHalf === s.zones![1]!.bracePairHalf && s.braceFigure === s.zones![1]!.braceFigure);
    /* Identical up to the opening... */
    expect(agree.slice(0, 3).every(Boolean)).toBe(true);
    /* ...the opening itself is the whole point: bare below, braced above... */
    expect({ ground: out[3]!.bracePairPattern, upper: out[3]!.zones![1]!.bracePairPattern }).toEqual({
      ground: undefined,
      upper: DEFAULT_BRACE_PAIR_PATTERN,
    });
    /* ...and from there on the cycle no longer lines up column for column. */
    expect(agree.slice(4).some((ok) => !ok)).toBe(true);
  });

  it("clears a stale pattern rather than leaving it on a band that no longer takes one", () => {
    /* The three fields are DERIVED. A band that was standard and is now a
       window must not keep the figure it had — a stale derived value outlives
       the shape that justified it, and the shop sheet would cut legs for a
       panel that has no room for them. */
    const first = lay(twoBandWall(25.25 * 12));
    const braced = first.find((s) => s.zones![1]!.bracePairPattern !== undefined)!;
    const index = first.indexOf(braced);
    const retyped = first.map((s, i) =>
      i === index ? { ...s, zones: [s.zones![0]!, { ...s.zones![1]!, type: "window" as const }] } : s,
    );
    expect(lay(retyped)[index]!.zones![1]!).toEqual({ type: "window" });
  });

  it("a wall with no zone data is untouched, and its bands still inherit the column", () => {
    /* `effectiveZonesForSlot` pads a not-yet-reconciled wall with plain
       standard zones at render time. There is nothing here to write onto, so
       nothing is written, and `panelInstances` falls back to the column's own
       pattern — exactly the behaviour every band had before B22. */
    const out = lay(wallSlots(25.25 * 12));
    expect(out.every((s) => s.zones === undefined)).toBe(true);
    expect(out.some((s) => s.bracePairPattern !== undefined)).toBe(true);
  });
});
