import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { insertBumpOut } from "./bumpOut";
import {
  cornerOwnership,
  gapEndFor,
  isMiteredShape,
  retile,
  retilePreservingOpenings,
  retilePreservingOpeningsWithRunStopMemory,
  wallGeometryFor,
} from "./retile";
import { getOpeningAnchors, retileWithOpenings, type OpeningAnchor } from "./tiling";
import type { Footprint, PanelSlot, WallRunStop } from "./types";

const THICKNESS_IN = 15.5;
const STANDARD_WIDTH_IN = 40;
const CORNER_PANEL_WIDTH_IN = 24;
// Huge spacing so only rule 1 (corner-touching) fires, keeping fixture
// outputs predictable for tests that aren't specifically about bracing.
const BRACED_SEED = { spacingIn: 100_000, defaultPattern: "chevron" as const, defaultMirrored: false };
const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

describe("isMiteredShape", () => {
  it("is false for a rectangle and true for an octagon", () => {
    expect(isMiteredShape(buildRectangleFootprint(30, 20))).toBe(false);
    expect(isMiteredShape(buildOctagonFootprint(30, 20))).toBe(true);
  });
});

describe("gapEndFor", () => {
  it("uses the least-accessible-corner rule on a rectangle", () => {
    const fp = buildRectangleFootprint(30, 20);
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    // A=(0,0), B=(30,0); least-accessible "A" is closer to start, so the
    // gap goes at the far ("end") side.
    expect(gapEndFor(fp, wallAB, "A")).toBe("end");
  });

  it("uses the per-wall safety-corner rule on an octagon (ignores the passed corner id)", () => {
    const fp = buildOctagonFootprint(30, 20);
    const wall = fp.walls.find((w) => w.id === "01")!;
    // Same result regardless of the (irrelevant, for a mitered shape) 2nd arg.
    expect(gapEndFor(fp, wall, "0")).toBe(gapEndFor(fp, wall, "4"));
  });
});

describe("cornerOwnership", () => {
  it("gives every corner of a plain rectangle to the (tied) shorter-or-lower-id wall", () => {
    const fp = buildRectangleFootprint(30, 20);
    const ownership = cornerOwnership(fp, allPrimary(fp), THICKNESS_IN);
    // AB (30ft) meets BC (20ft) at B: BC is shorter, so BC wins (owns its
    // own start corner), AB insets by thicknessIn at its end.
    expect(ownership["AB"]!.end).toEqual({ hasCorner: false, insetAmount: THICKNESS_IN, extraLengthIn: 0 });
    expect(ownership["BC"]!.start).toEqual({ hasCorner: true, insetAmount: 0, extraLengthIn: 0 });
  });

  it("matches the pixel-verified reflex-corner rule on a bump-out'd shape", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped, primaryCornerIds } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    // corners: A(0), pa(1), paOut(2), pbOut(3), pb(4), B(5), C(6), D(7).
    // Reflex corner at "1" (pa): wall "0-1" (original, has a primary
    // endpoint) must win and extend by thicknessIn; wall "1-2" (new jog)
    // must NOT inset at all (see retile.ts's doc comment for why a flat
    // inset leaves a real gap here — this was originally caught by direct
    // pixel measurement in the browser).
    const ownership = cornerOwnership(bumped, primaryCornerIds, THICKNESS_IN);
    expect(ownership["01"]!.end).toEqual({ hasCorner: true, insetAmount: 0, extraLengthIn: THICKNESS_IN });
    expect(ownership["12"]!.start).toEqual({ hasCorner: false, insetAmount: 0, extraLengthIn: 0 });
  });
});

describe("retile", () => {
  it("produces corner-owning slots at both ends of every wall on a plain rectangle", () => {
    const fp = buildRectangleFootprint(30, 20);
    const slots = retile(fp, "A", allPrimary(fp), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    for (const wall of fp.walls) {
      expect(slots[wall.id]).toBeDefined();
      expect(slots[wall.id]!.length).toBeGreaterThan(0);
    }
  });

  it("marks a safety-oct-corner slot on every wall of an octagon", () => {
    const fp = buildOctagonFootprint(30, 20);
    const slots = retile(fp, "0", allPrimary(fp), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    for (const wall of fp.walls) {
      expect(slots[wall.id]!.some((s) => s.type === "safety-oct-corner")).toBe(true);
    }
  });

  it("seeds every wall with the bracedSeed's default pattern/mirror on every newly-placed braced panel (no prior state to preserve)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const slots = retile(fp, "A", allPrimary(fp), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, {
      spacingIn: 100_000,
      defaultPattern: "hatch",
      defaultMirrored: true,
    });
    let sawBraced = false;
    for (const wall of fp.walls) {
      for (const s of slots[wall.id]!) {
        if (s.type !== "braced") continue;
        sawBraced = true;
        expect(s.bracedPattern).toBe("hatch");
        expect(s.bracedMirrored).toBe(true);
      }
    }
    expect(sawBraced).toBe(true);
  });
});

describe("retilePreservingOpenings", () => {
  it("preserves an existing window on an id-stable wall (dragWall/editWallLength style: same-id old slots passed straight through)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const plainSlots = retile(fp, "A", primary, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    const cdSlots = plainSlots["CD"]!.slice();
    const standardIdx = cdSlots.findIndex((s) => s.type === "standard");
    cdSlots[standardIdx] = { type: "window", widthIn: 36 };
    const oldSlots = { ...plainSlots, CD: cdSlots };

    const nextSlots = retilePreservingOpenings(
      fp,
      "A",
      primary,
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      oldSlots,
      BRACED_SEED,
    );
    expect(nextSlots["CD"]!.some((s) => s.type === "window")).toBe(true);
    // A wall whose old slots were untouched re-tiles identically to plain retile.
    expect(nextSlots["AB"]).toEqual(plainSlots["AB"]);
  });

  it("falls back to a plain (opening-free) tile when a wall has no entry in oldSlotsByNewWallId", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const plainSlots = retile(fp, "A", primary, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    const nextSlots = retilePreservingOpenings(
      fp,
      "A",
      primary,
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      {},
      BRACED_SEED,
    );
    expect(nextSlots["AB"]!.some((s) => s.type === "window" || s.type === "door")).toBe(false);
    expect(nextSlots["AB"]).toEqual(plainSlots["AB"]);
  });

  it("preserves an opening across insertBumpOut's id renumbering (a caller-built correlation map), but a brand-new jog wall gets no openings", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const plainSlots = retile(fp, "A", primary, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    const cdSlots = plainSlots["CD"]!.slice();
    const standardIdx = cdSlots.findIndex((s) => s.type === "standard");
    cdSlots[standardIdx] = { type: "door", widthIn: 36 };

    const { footprint: bumped, primaryCornerIds: nextPrimary } = insertBumpOut(fp, "AB", 10, 15, 5, primary);
    // Per insertBumpOut's own renumbering (corners: A(0), pa(1), paOut(2),
    // pbOut(3), pb(4), B(5), C(6), D(7) — same convention the
    // cornerOwnership bump-out test above documents), wall "CD"
    // (untouched by the bump-out on "AB") becomes wall "67" — this is
    // exactly the kind of caller-built point-pair correlation
    // handleAddBumpOut assembles in page.tsx.
    const nextSlots = retilePreservingOpenings(
      bumped,
      [...nextPrimary][0]!,
      nextPrimary,
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      { "67": cdSlots },
      BRACED_SEED,
    );
    expect(nextSlots["67"]!.some((s) => s.type === "door")).toBe(true);
    // The bump-out's own new jog wall has no old counterpart at all.
    const jogWall = bumped.walls.find((w) => w.startCorner === "1" && w.endCorner === "2")!;
    expect(nextSlots[jogWall.id]!.some((s) => s.type === "window" || s.type === "door")).toBe(false);
  });

  it("preserves a wall's own prior braced-panel decisions (type, pattern, mirror) across a retile, instead of re-seeding them", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const plainSlots = retile(fp, "A", primary, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    // Simulate the user picking a specific style for the corner-touching
    // braced panel on wall AB, and reverting a periodic one back to plain
    // standard (there isn't one here since spacing is huge, so just flip
    // the one braced slot's own style to something the default wouldn't
    // produce, to prove it survives the next retile untouched).
    const abSlots = plainSlots["AB"]!.slice();
    const bracedIdx = abSlots.findIndex((s) => s.type === "braced");
    abSlots[bracedIdx] = { ...abSlots[bracedIdx]!, bracedPattern: "hatch", bracedMirrored: true };
    const oldSlots = { ...plainSlots, AB: abSlots };

    // Retile again with a DIFFERENT default (chevron/false) — if the
    // preserved slot were re-seeded instead of preserved, it would come
    // back as chevron/false, not the user's own hatch/true choice.
    const nextSlots = retilePreservingOpenings(
      fp,
      "A",
      primary,
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      oldSlots,
      { spacingIn: 100_000, defaultPattern: "chevron", defaultMirrored: false },
    );
    const preserved = nextSlots["AB"]!.find((s) => s.type === "braced");
    expect(preserved).toBeDefined();
    expect(preserved!.bracedPattern).toBe("hatch");
    expect(preserved!.bracedMirrored).toBe(true);
  });
});

describe("openingSeed (default door/window on a freshly-panelized wall)", () => {
  it("seeds exactly 1 door + 1 window on a fresh East-facing wall, never at either corner-touching position", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const slots = retile(fp, "A", primary, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED, { randomFn: () => 0 });
    const bc = slots["BC"]!; // BC faces East (see wallCompassDirection.test.ts)
    expect(bc.filter((s) => s.type === "door").length).toBe(1);
    expect(bc.filter((s) => s.type === "window").length).toBe(1);
    // Rule 1 still braces a panel touching each corner — proves the door/
    // window didn't steal a corner-touching position.
    expect(bc.filter((s) => s.type === "braced" || s.secondaryType === "braced").length).toBeGreaterThanOrEqual(2);
  });

  it("seeds only a window (no door) on a fresh North-facing wall", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const slots = retile(fp, "A", primary, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED, { randomFn: () => 0 });
    const ab = slots["AB"]!; // AB faces North
    expect(ab.filter((s) => s.type === "door").length).toBe(0);
    expect(ab.filter((s) => s.type === "window").length).toBe(1);
  });

  it("seeds no default openings at all when openingSeed is omitted (today's exact behavior)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const slots = retile(fp, "A", primary, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    for (const wall of fp.walls) {
      expect(slots[wall.id]!.some((s) => s.type === "window" || s.type === "door")).toBe(false);
    }
  });

  it("skips seeding (and doesn't crash) on a wall too short for any standard slot", () => {
    // Both ends want a corner (24in each) on a 36in wall — resolveCorners
    // merges them into one corner panel spanning the whole wall, with no
    // standard-family slot at all for a default opening to claim.
    const tinyFp: Footprint = {
      corners: [
        { id: "X", point: { x: 0, y: 0 } },
        { id: "Y", point: { x: 3, y: 0 } },
      ],
      walls: [{ id: "XY", startCorner: "X", endCorner: "Y", lengthFt: 3 }],
    };
    const slots = retile(tinyFp, "X", new Set(["X", "Y"]), STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED, {
      randomFn: () => 0,
    });
    expect(slots["XY"]).toEqual([{ type: "corner", widthIn: 36 }]);
  });

  it("seeds a default window on a wall with no old counterpart when openingSeed is supplied (retilePreservingOpenings)", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const nextSlots = retilePreservingOpenings(
      fp,
      "A",
      primary,
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      {},
      BRACED_SEED,
      { randomFn: () => 0 },
    );
    expect(nextSlots["AB"]!.some((s) => s.type === "window")).toBe(true);
  });

  it("never re-seeds a wall whose old slots are being preserved", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const plainSlots = retile(fp, "A", primary, STANDARD_WIDTH_IN, CORNER_PANEL_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    const nextSlots = retilePreservingOpenings(
      fp,
      "A",
      primary,
      STANDARD_WIDTH_IN,
      CORNER_PANEL_WIDTH_IN,
      THICKNESS_IN,
      plainSlots,
      BRACED_SEED,
      { randomFn: () => 0 },
    );
    expect(nextSlots["AB"]!.some((s) => s.type === "window" || s.type === "door")).toBe(false);
  });
});

describe("wallGeometryFor", () => {
  it("returns geometry for an existing wall and null for a nonexistent one", () => {
    const fp = buildRectangleFootprint(30, 20);
    const geometry = wallGeometryFor(fp, "AB", allPrimary(fp), "A", THICKNESS_IN);
    expect(geometry).not.toBeNull();
    // AB is the longer wall at both corners (DA=20ft wins at A, BC=20ft
    // wins at B), so it insets by thicknessIn at both ends.
    expect(geometry!.lengthIn).toBeCloseTo(30 * 12 - 2 * THICKNESS_IN, 6);
    expect(geometry!.allowBorrow).toBe(true);

    expect(wallGeometryFor(fp, "nonexistent", allPrimary(fp), "A", THICKNESS_IN)).toBeNull();
  });

  it("disallows borrowing on a mitered (octagon) shape", () => {
    const fp = buildOctagonFootprint(30, 20);
    const geometry = wallGeometryFor(fp, "01", allPrimary(fp), "0", THICKNESS_IN);
    expect(geometry!.allowBorrow).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CORNER ABSORB, END TO END — the 51in-75in two-corner band through the real
// retile path rather than through `tileWall` alone.
//
// The band's own arithmetic is covered in tiling.test.ts. What is covered
// here is the part `tileWall` cannot answer on its own: which walls of a real
// footprint actually own two corners and are actually short enough to land in
// it, and whether a Stage 3 run stop can put one there.
// ---------------------------------------------------------------------------
describe("corner absorb on real footprints", () => {
  const REAL_CORNER_WIDTH_IN = 25.5; // the catalog value — NOT this file's 24in fixture
  const FLOOR_IN = 24;
  const CEILING_IN = 48;

  /** Every fabricated panel of every wall, checked against the shop's limits
   * and against its own wall's total. Openings and the 0.75in gap board are
   * not fabricated panels for this purpose. */
  function fabricationViolations(
    fp: Footprint,
    slotsByWall: Record<string, import("./types").PanelSlot[]>,
    stops?: Record<string, import("./types").WallRunStop>,
  ): string[] {
    const out: string[] = [];
    for (const wall of fp.walls) {
      const slots = slotsByWall[wall.id] ?? [];
      const geometry = wallGeometryFor(fp, wall.id, allPrimary(fp), "0", THICKNESS_IN, stops)!;
      let sumEighths = 0;
      for (const slot of slots) {
        const fabricated =
          slot.type === "standard" || slot.type === "braced" || slot.type === "corner" || slot.type === "safety-oct-corner";
        if (fabricated && slot.widthIn < FLOOR_IN - 1e-9) {
          out.push(`${wall.id}: ${slot.type} ${slot.widthIn}in is under the ${FLOOR_IN}in minimum`);
        }
        if (fabricated && slot.widthIn > CEILING_IN + 1e-9) {
          out.push(`${wall.id}: ${slot.type} ${slot.widthIn}in is over the ${CEILING_IN}in ceiling`);
        }
        sumEighths += Math.round(slot.widthIn * 8);
      }
      if (sumEighths !== Math.round(geometry.lengthIn * 8)) {
        out.push(`${wall.id}: slots sum to ${sumEighths} eighths, run is ${Math.round(geometry.lengthIn * 8)}`);
      }
    }
    return out;
  }

  it("a small octagon — every wall in the band — now tiles legally on every wall", () => {
    // A regular octagon's side is 0.41421x its bounding box, so EVERY wall of
    // an octagon between 10.26ft and 15.09ft across sits in the 51in-75in
    // band, and every wall of an octagon owns BOTH its corners because the
    // corners are mitered. Small octagons were therefore broken outright:
    // each of the eight walls produced a panel the shop cannot build.
    //
    // MIN_DIMENSION_FT is 8ft, so these sizes are all drawable today.
    const violations: string[] = [];
    let bandWalls = 0;
    for (let acrossFt = 10.5; acrossFt <= 15; acrossFt += 0.5) {
      const fp = buildOctagonFootprint(acrossFt, acrossFt);
      const slots = retile(fp, "0", allPrimary(fp), STANDARD_WIDTH_IN, REAL_CORNER_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
      for (const wall of fp.walls) {
        const runIn = wallGeometryFor(fp, wall.id, allPrimary(fp), "0", THICKNESS_IN)!.lengthIn;
        if (runIn > 51 && runIn < 75) bandWalls++;
      }
      violations.push(...fabricationViolations(fp, slots).map((v) => `${acrossFt}ft octagon — ${v}`));
    }
    // Every wall of every one of these octagons is in the band: 10 sizes x 8
    // walls. If this number drops, the test has stopped exercising the fix.
    expect(bandWalls).toBe(80);
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it("an octagon just above the band is untouched, so the fix is not swallowing the normal case", () => {
    const fp = buildOctagonFootprint(20, 20);
    const slots = retile(fp, "0", allPrimary(fp), STANDARD_WIDTH_IN, REAL_CORNER_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    for (const wall of fp.walls) {
      const runIn = wallGeometryFor(fp, wall.id, allPrimary(fp), "0", THICKNESS_IN)!.lengthIn;
      expect(runIn).toBeGreaterThan(75);
      // A real middle survives — these walls did not become corner pairs.
      expect(slots[wall.id]!.some((s) => s.type === "standard" || s.type === "braced")).toBe(true);
    }
    expect(fabricationViolations(fp, slots).slice(0, 10)).toEqual([]);
  });

  it("⚠ a Stage 3 run stop CANNOT move a wall into the two-corner band — and here is why", () => {
    // This was flagged as the interaction most likely to be missed, on the
    // reasoning that a stop shortens a wall's run and so could drop it into
    // the band. **It cannot, and the reason is structural rather than
    // arithmetic** — worth asserting rather than trusting, because it is the
    // kind of claim that quietly stops being true:
    //
    //   1. A wall's OWN stop takes that end's corner with it
    //      (`applyWallRunStop`), so a stopped wall owns at most one corner
    //      and can never be a two-corner wall at all.
    //   2. The cross-wall orphan rule (`cornerOwnershipWithRunStops`) only
    //      ever zeroes an `insetAmount`, and `cornerOwnership` gives an
    //      inset of 0 to every end that OWNS its corner. So a wall owning
    //      both corners has nothing for a neighbour's stop to change, and
    //      the adjustment only ever makes a wall LONGER in any case.
    //
    // Swept over every wall of a bumped-out shape with a stop at each end of
    // each wall, at several depths: no wall anywhere ends up with two corners
    // and a run in the band, and nothing is ever unbuildable.
    const base = buildRectangleFootprint(20, 16);
    // A bump-out gives the shape both convex and REFLEX corners, so the
    // reflex path is swept here too rather than only the convex one.
    const { footprint: fp, primaryCornerIds: primary } = insertBumpOut(base, "AB", 6, 11, 4, allPrimary(base));
    const violations: string[] = [];
    let twoCornerWallsInBand = 0;
    let twoCornerWallsChecked = 0;
    for (const stopped of fp.walls) {
      for (const end of ["startStopIn", "endStopIn"] as const) {
        for (const stopIn of [6, 18, 36, 60]) {
          const stops = { [stopped.id]: { startStopIn: 0, endStopIn: 0, [end]: stopIn } };
          const slots = retile(
            fp,
            "0",
            primary,
            STANDARD_WIDTH_IN,
            REAL_CORNER_WIDTH_IN,
            THICKNESS_IN,
            BRACED_SEED,
            undefined,
            stops,
          );
          for (const wall of fp.walls) {
            const geometry = wallGeometryFor(fp, wall.id, primary, "0", THICKNESS_IN, stops)!;
            const unstopped = wallGeometryFor(fp, wall.id, primary, "0", THICKNESS_IN)!;
            if (geometry.hasCornerStart && geometry.hasCornerEnd && geometry.lengthIn > 51 && geometry.lengthIn < 75) {
              twoCornerWallsInBand++;
            }
            // The structural claim itself, stated directly so this cannot
            // pass merely because no wall of this fixture happens to be near
            // the band: a wall that still owns BOTH corners under a stop map
            // has exactly the run it had with no stops at all. Nothing a stop
            // does can move such a wall by even one eighth, in or out of the
            // band.
            if (geometry.hasCornerStart && geometry.hasCornerEnd) {
              twoCornerWallsChecked++;
              if (Math.round(geometry.lengthIn * 8) !== Math.round(unstopped.lengthIn * 8)) {
                violations.push(
                  `stop ${stopped.id} ${end}=${stopIn}: two-corner wall ${wall.id} moved from ${unstopped.lengthIn}in to ${geometry.lengthIn}in`,
                );
              }
            }
          }
          // The sum invariant must survive the stop regardless.
          for (const wall of fp.walls) {
            const sumEighths = (slots[wall.id] ?? []).reduce((s, slot) => s + Math.round(slot.widthIn * 8), 0);
            const runEighths = Math.round(
              wallGeometryFor(fp, wall.id, primary, "0", THICKNESS_IN, stops)!.lengthIn * 8,
            );
            if (sumEighths !== runEighths) {
              violations.push(`stop ${stopped.id} ${end}=${stopIn}: ${wall.id} sums to ${sumEighths}, run is ${runEighths}`);
            }
          }
        }
      }
    }
    expect(twoCornerWallsInBand).toBe(0);
    // Non-vacuous: the sweep really did look at two-corner walls under stops.
    expect(twoCornerWallsChecked).toBeGreaterThan(50);
    expect(violations.slice(0, 10)).toEqual([]);
  });

  it("a stopped wall lands in the ONE-corner sub-minimum zone instead, which is still unfixed", () => {
    // The shape a stop CAN produce, recorded so it is not mistaken for
    // something this pass fixed. A stop of 55in on a 100in run leaves 45in
    // with a single corner: 25.5in of corner and a 19.5in standard panel,
    // under the shop minimum. A lone corner has no partner to absorb into,
    // and Tommy's decision was specifically about the two-corner rule.
    //
    // The app refuses this stop rather than shipping it — `page.tsx` runs the
    // same `findSubMinimumPanelWidths` check over the candidate result before
    // accepting a stop — so the user sees a message, not a bad cut list.
    const fp = buildRectangleFootprint(20, 16);
    const wall = fp.walls[0]!;
    const stops = { [wall.id]: { startStopIn: 0, endStopIn: wall.lengthFt * 12 - 45 } };
    const geometry = wallGeometryFor(fp, wall.id, allPrimary(fp), "A", THICKNESS_IN, stops)!;
    expect(geometry.hasCornerStart && geometry.hasCornerEnd).toBe(false);
    const slots = retile(
      fp,
      "A",
      allPrimary(fp),
      STANDARD_WIDTH_IN,
      REAL_CORNER_WIDTH_IN,
      THICKNESS_IN,
      BRACED_SEED,
      undefined,
      stops,
    );
    const sub = slots[wall.id]!.filter((s) => s.type !== "safety-gap" && s.widthIn < 24);
    expect(sub.length).toBeGreaterThan(0);
    // ...and the total is still exact. A broken wall, not a broken total.
    expect(slots[wall.id]!.reduce((s, slot) => s + Math.round(slot.widthIn * 8), 0)).toBe(
      Math.round(geometry.lengthIn * 8),
    );
  });
});

// ---------------------------------------------------------------------------
// Stage 3's run-stop opening memory — Tommy, 2026-09-29: **"Drop them, and
// remember"**. End to end on a real footprint, through the function page.tsx
// actually calls; the rule itself is tested in `runStopOpenings.test.ts`.
//
// The defect these exist for, in his words: *"whenever i stop wall over a
// certain amount, for one wall this boundary was 174", it says that the panel
// wall doesnt add up and will not let me edit the layout how i need to"*.
// ---------------------------------------------------------------------------
describe("retilePreservingOpeningsWithRunStopMemory", () => {
  const REAL_CORNER_WIDTH_IN = 25.5; // the catalog value, not this file's 24in fixture
  const WALL_ID = "AB";

  /**
   * A 30ft wall that OWNS both its corners (its two neighbours are the 35ft
   * sides, so the shorter-wall rule gives AB both), carrying two 61.5in
   * windows. `2 x 61.5 + 2 x 25.5 = 174in` of openings and corner panels on a
   * 360in run — the same openings-plus-corners relationship that produced the
   * 174in boundary Tommy reported.
   *
   * Measured layout, which every position below is read off:
   *
   *   corner   0      .. 25.5
   *   braced   25.5   .. 65.5
   *   window   65.5   .. 127        <- the first window
   *   standard 127    .. 167
   *   standard 167    .. 199.625
   *   window   199.625.. 261.125    <- the second window
   *   standard 261.125.. 293.75
   *   gap      293.75 .. 294.5
   *   braced   294.5  .. 334.5
   *   corner   334.5  .. 360
   *
   * The baseline goes back through this same function with NO stop, so it
   * carries `reconcileBracedPlacement`'s own output and a restore can be
   * compared to it slot for slot rather than approximately — and the fixture
   * asserts that round trip is a fixed point, so a later assertion cannot
   * quietly be measuring the re-tile instead of the stop.
   */
  function buildFixture() {
    const fp = buildRectangleFootprint(30, 35);
    const primary = allPrimary(fp);
    const openings: OpeningAnchor[] = [
      { beforeStandardCount: 1, type: "window", widthIn: 61.5, heightIn: 60, sillHeightIn: 36 },
      { beforeStandardCount: 3, type: "window", widthIn: 61.5, heightIn: 60, sillHeightIn: 36 },
    ];
    const geometry = wallGeometryFor(fp, WALL_ID, primary, "A", THICKNESS_IN)!;
    expect(geometry.hasCornerStart && geometry.hasCornerEnd).toBe(true);
    expect(geometry.lengthIn).toBe(360);
    const seeded = retileWithOpenings(
      geometry.lengthIn,
      STANDARD_WIDTH_IN,
      REAL_CORNER_WIDTH_IN,
      geometry.gapEnd,
      geometry.hasCornerStart,
      geometry.hasCornerEnd,
      openings,
      geometry.allowBorrow,
    ).slots;
    const base = retile(fp, "A", primary, STANDARD_WIDTH_IN, REAL_CORNER_WIDTH_IN, THICKNESS_IN, BRACED_SEED);
    const slots = run(fp, primary, { ...base, [WALL_ID]: seeded }, {}).slotsByWallId;
    expect(slots[WALL_ID]!.filter((s) => s.type === "window").length).toBe(2);
    expect(sumEighths(slots[WALL_ID]!)).toBe(360 * 8);
    expect(run(fp, primary, slots, {}).slotsByWallId).toEqual(slots);
    return { fp, primary, slots };
  }

  const run = (
    fp: Footprint,
    primary: Set<string>,
    oldSlots: Record<string, PanelSlot[] | undefined>,
    stops: Record<string, WallRunStop>,
    remembered?: Record<string, OpeningAnchor[]>,
  ) =>
    retilePreservingOpeningsWithRunStopMemory(
      fp,
      "A",
      primary,
      STANDARD_WIDTH_IN,
      REAL_CORNER_WIDTH_IN,
      THICKNESS_IN,
      oldSlots,
      BRACED_SEED,
      undefined,
      stops,
      true,
      remembered,
    );

  const sumEighths = (slots: PanelSlot[]) => slots.reduce((s, slot) => s + Math.round(slot.widthIn * 8), 0);
  const runEighths = (fp: Footprint, primary: Set<string>, stops: Record<string, WallRunStop>) =>
    Math.round(wallGeometryFor(fp, WALL_ID, primary, "A", THICKNESS_IN, stops)!.lengthIn * 8);

  /** The run's shape, with the braced/standard distinction flattened out.
   *
   * ⚠ **Braced markers are deliberately NOT part of "restores it exactly".**
   * `reconcileBracedPlacement` re-derives them from slot POSITION on every
   * re-tile, and a stop genuinely moves positions — so a corner-adjacent
   * brace lands on a different panel while the wall is stopped and is
   * re-seeded when it comes back. That is Stage 3 behaviour that predates
   * this change and is not something an opening memory could undo. What the
   * memory promises, and what the next assertion checks separately, is that
   * the OPENINGS come back with every field they had. */
  const shape = (slots: PanelSlot[]) =>
    slots.map((s) => ({ type: s.type === "braced" ? "standard" : s.type, widthIn: s.widthIn }));

  it("an unstopped project takes no new path at all — same slots, empty memory", () => {
    const { fp, primary, slots } = buildFixture();
    const result = run(fp, primary, slots, {});
    expect(result.unbuiltOpeningsByWallId).toEqual({});
    expect(result.slotsByWallId).toEqual(
      retilePreservingOpenings(fp, "A", primary, STANDARD_WIDTH_IN, REAL_CORNER_WIDTH_IN, THICKNESS_IN, slots, BRACED_SEED),
    );
  });

  it("a stop that swallows a window drops it from the run, remembers it, and keeps the sum exact", () => {
    const { fp, primary, slots } = buildFixture();
    expect(slots[WALL_ID]!.filter((s) => s.type === "window").length).toBe(2);

    const stops = { [WALL_ID]: { startStopIn: 0, endStopIn: 120 } };
    const result = run(fp, primary, slots, stops);
    const after = result.slotsByWallId[WALL_ID]!;

    // Gone from the built run — and so from the cut list, the fabrication
    // groups and the shop drawings, all of which read these slots.
    expect(after.filter((s) => s.type === "window").length).toBe(1);
    // Remembered, with its own height and sill intact.
    const withheld = result.unbuiltOpeningsByWallId[WALL_ID]!;
    expect(withheld.length).toBe(1);
    expect(withheld[0]).toMatchObject({ type: "window", widthIn: 61.5, heightIn: 60, sillHeightIn: 36 });
    // And the invariant whose failure produced Tommy's useless message.
    expect(sumEighths(after)).toBe(runEighths(fp, primary, stops));
  });

  it("un-stopping restores the dropped window exactly, slot for slot", () => {
    const { fp, primary, slots } = buildFixture();
    const stopped = run(fp, primary, slots, { [WALL_ID]: { startStopIn: 0, endStopIn: 120 } });
    expect(stopped.unbuiltOpeningsByWallId[WALL_ID]!.length).toBe(1);
    const restored = run(fp, primary, stopped.slotsByWallId, {}, stopped.unbuiltOpeningsByWallId);
    expect(shape(restored.slotsByWallId[WALL_ID]!)).toEqual(shape(slots[WALL_ID]!));
    // Every field the opening carried, back exactly — this is the promise.
    expect(getOpeningAnchors(restored.slotsByWallId[WALL_ID]!)).toEqual(getOpeningAnchors(slots[WALL_ID]!));
    expect(restored.unbuiltOpeningsByWallId).toEqual({});
  });

  it("both ends stopped at once withholds what either span covers, and restores both", () => {
    const { fp, primary, slots } = buildFixture();
    // [70, 250] of the 360in run is built: the start span swallows the first
    // window (65.5-127) and the far span the second (199.625-261.125).
    const stops = { [WALL_ID]: { startStopIn: 70, endStopIn: 110 } };
    const result = run(fp, primary, slots, stops);
    const geometry = wallGeometryFor(fp, WALL_ID, primary, "A", THICKNESS_IN, stops)!;
    // A stop at each end takes BOTH corner panels with it.
    expect(geometry.hasCornerStart).toBe(false);
    expect(geometry.hasCornerEnd).toBe(false);
    expect(sumEighths(result.slotsByWallId[WALL_ID]!)).toBe(runEighths(fp, primary, stops));
    expect(result.unbuiltOpeningsByWallId[WALL_ID]!.length).toBe(2);
    expect(result.slotsByWallId[WALL_ID]!.some((s) => s.type === "window")).toBe(false);
    const restored = run(fp, primary, result.slotsByWallId, {}, result.unbuiltOpeningsByWallId);
    expect(shape(restored.slotsByWallId[WALL_ID]!)).toEqual(shape(slots[WALL_ID]!));
    expect(getOpeningAnchors(restored.slotsByWallId[WALL_ID]!)).toEqual(getOpeningAnchors(slots[WALL_ID]!));
  });

  it("a fully-stopped wall builds nothing and remembers every opening on it", () => {
    const { fp, primary, slots } = buildFixture();
    const wall = fp.walls.find((w) => w.id === WALL_ID)!;
    const stops = { [WALL_ID]: { startStopIn: wall.lengthFt * 12, endStopIn: 0 } };
    const result = run(fp, primary, slots, stops);
    expect(result.slotsByWallId[WALL_ID]).toEqual([]);
    expect(result.unbuiltOpeningsByWallId[WALL_ID]!.length).toBe(2);
    // A wall the tiler built nothing on has no slots left to read anchors
    // from, so its windows can only come back out of the memory — which is
    // the case the memory exists for.
    const restored = run(fp, primary, result.slotsByWallId, {}, result.unbuiltOpeningsByWallId);
    expect(restored.slotsByWallId[WALL_ID]!.filter((s) => s.type === "window").length).toBe(2);
  });

  it("holds at EVERY eighth of stop on that wall: no window lost, and the sum is always exact", () => {
    const { fp, primary, slots } = buildFixture();
    const wall = fp.walls.find((w) => w.id === WALL_ID)!;
    const lost: string[] = [];
    const sumOff: number[] = [];
    const combinedGap: number[] = [];
    const zeroWidth: number[] = [];
    for (let e = 0; e <= Math.round(wall.lengthFt * 12 * 8); e++) {
      const endStopIn = e / 8;
      const stops = { [WALL_ID]: { startStopIn: 0, endStopIn } };
      const result = run(fp, primary, slots, stops);
      const built = result.slotsByWallId[WALL_ID]!;
      const accounted =
        built.filter((s) => s.type === "window").length + (result.unbuiltOpeningsByWallId[WALL_ID]?.length ?? 0);
      if (accounted !== 2) lost.push(`${endStopIn}in: ${accounted} windows accounted for, expected 2`);
      if (sumEighths(built) !== runEighths(fp, primary, stops)) sumOff.push(endStopIn);
      if (built.some((s) => s.type === "safety-gap" && s.secondaryType === "braced")) combinedGap.push(endStopIn);
      if (built.some((s) => Math.round(s.widthIn * 8) === 0)) zeroWidth.push(endStopIn);
    }
    // The property this change owns: a window is either built or remembered,
    // at every single eighth of stop, and never simply gone.
    expect(lost.slice(0, 10)).toEqual([]);
    // ⚠ **THIS ASSERTION USED TO CARRY AN EXCEPTION, AND NO LONGER DOES.**
    // It used to read `sumOff.filter((s) => !combinedGap.includes(s))` —
    // every stop whose total was off had to be one where
    // `reconcileBracedPlacement`'s corner-brace combine had fired, because
    // that combine fixed a safety-gap slot at `standardWidthIn + buffer` and
    // shed the difference onto the nearest standard panel CLAMPED AT ZERO,
    // leaving the wall longer than itself whenever that neighbour was
    // narrower than the swing. With no stop anywhere,
    // `reconcileBracedPlacement(undefined, retileWithOpenings(240, 40, 25.5,
    // "end", true, true, [{0, 61.5}, {1, 61.5}]).slots, ...)` turned
    // `safety-gap 0.75 | standard 32.625` into `safety-gap 40.75 | standard 0`
    // and summed 247.375in on a 240in wall.
    //
    // That combine was fixed on 2026-09-29 (`planCornerBraceCombine`), so the
    // characterisation is obsolete and the real invariant is asserted instead:
    // **nothing on this wall breaks the sum, at any stop, ever** — which is
    // the property Tommy's "panels don't add back up to that wall" refusal was
    // reporting in the first place.
    expect(sumOff).toEqual([]);
    // And the other half of that fix, which this sweep is well placed to hold:
    // the combine no longer pays for itself with a 0in panel.
    expect(zeroWidth).toEqual([]);
    // Non-vacuous: the combine really does fire somewhere in this sweep, so
    // the two assertions above are covering the path they were written for
    // rather than passing because it never ran.
    expect(combinedGap.length).toBeGreaterThan(0);
  });
});
