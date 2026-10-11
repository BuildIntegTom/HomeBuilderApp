import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { retile, retilePreservingOpeningsWithRunStopMemory, wallGeometryFor } from "./retile";
import { getOpeningAnchors, retileWithOpenings, type OpeningAnchor } from "./tiling";
import type { Footprint, PanelSlot } from "./types";

/**
 * REPANELIZE R2 — **an opening may DRIFT, but it may not RESIZE.**
 *
 * Tommy, 2026-10-10, choosing between letting openings move on a re-tile,
 * rebuilding the tiler so they hold their exact position, and refusing the
 * re-tile: *"Drift but stay the same size would be great."*
 *
 * ⚠ **That makes the width a guarantee, and a guarantee nobody checks is a
 * hope.** Position is allowed to move because an opening can only sit at a
 * slot boundary and the boundaries move with the layout — measured drift of
 * up to 19in on a 360in wall. **The width is a different matter entirely: a
 * window is an ordered unit with a real rough opening, so a re-tile that
 * quietly changed 48in to 40in would be ordering the wrong part.**
 *
 * These sweeps drive every re-tile path there is and assert that every
 * opening that SURVIVES comes out the width it went in. Openings that are
 * legitimately dropped — a corner-absorb that cannot keep them, a run stop
 * that withholds them — are not resizes and are excluded by name.
 */

const THICKNESS_IN = 15.5;
const STANDARD = 40;
const CORNER = 25.5;
const BRACED_SEED = { spacingIn: 100_000, defaultPattern: "chevron" as const, defaultMirrored: false };
const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));
const openingsOf = (slots: readonly PanelSlot[]) => slots.filter((s) => s.type === "window" || s.type === "door");
/** Type and width, in order — what the fabricator would be ordering. */
const sizes = (slots: readonly PanelSlot[]) => openingsOf(slots).map((o) => `${o.type}:${o.widthIn}`);

describe("an opening keeps its width through a re-tile", () => {
  it("across a safety-gap flip, on a sweep of walls and opening sizes", () => {
    const violations: string[] = [];
    let compared = 0;
    for (const lengthIn of [200, 240, 300, 360, 420, 500, 564]) {
      for (const beforeStandardCount of [1, 2, 3, 4]) {
        for (const widthIn of [36, 38, 48, 61.5]) {
          const openings: OpeningAnchor[] = [{ beforeStandardCount, type: "window", widthIn }];
          const atStart = retileWithOpenings(lengthIn, STANDARD, CORNER, "start", true, true, openings).slots;
          const atEnd = retileWithOpenings(lengthIn, STANDARD, CORNER, "end", true, true, openings).slots;
          if (openingsOf(atStart).length === 0) continue; // legitimately dropped, not resized
          compared++;
          /* ⚠ Compared against the width that went IN, not merely start
             against end. The first version of this checked the two layouts
             against each other, so a resize applied by both — which is what
             a broken width carry does — cancelled out and the test passed.
             Watching it fail is how that was found: a deliberate 2in break
             was caught by the other two sweeps here and NOT by this one. */
          const expected = [`window:${widthIn}`];
          if (JSON.stringify(sizes(atStart)) !== JSON.stringify(expected)) {
            violations.push(`${lengthIn}in w${widthIn}@${beforeStandardCount} gapEnd=start: ${sizes(atStart)}`);
          }
          if (JSON.stringify(sizes(atEnd)) !== JSON.stringify(expected)) {
            violations.push(`${lengthIn}in w${widthIn}@${beforeStandardCount} gapEnd=end: ${sizes(atEnd)}`);
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(50);
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it("across a WALL-LENGTH change, which is the re-tile a user triggers most", () => {
    const violations: string[] = [];
    let compared = 0;
    for (const widthIn of [36, 48, 61.5]) {
      const openings: OpeningAnchor[] = [{ beforeStandardCount: 2, type: "window", widthIn }];
      let carried = retileWithOpenings(300, STANDARD, CORNER, "start", true, true, openings).slots;
      const original = sizes(carried);
      if (original.length === 0) continue;
      // Lengthen and shorten repeatedly, carrying the anchors forward each
      // time exactly as the app does.
      for (const lengthIn of [320, 280, 400, 240, 360, 300]) {
        const anchors = getOpeningAnchors(carried);
        carried = retileWithOpenings(lengthIn, STANDARD, CORNER, "start", true, true, anchors).slots;
        if (openingsOf(carried).length === 0) break; // dropped, not resized
        compared++;
        if (JSON.stringify(sizes(carried)) !== JSON.stringify(original)) {
          violations.push(`w${widthIn} at ${lengthIn}in: ${original} -> ${sizes(carried)}`);
        }
      }
    }
    expect(compared).toBeGreaterThan(10);
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it("across a run-stop round trip, including the stops that withhold one", () => {
    const WALL = "AB";
    const fp = buildRectangleFootprint(47, 40);
    const primary = allPrimary(fp);
    const geometry = wallGeometryFor(fp, WALL, primary, "A", THICKNESS_IN)!;
    const seeded = retileWithOpenings(
      geometry.lengthIn,
      STANDARD,
      CORNER,
      geometry.gapEnd,
      geometry.hasCornerStart,
      geometry.hasCornerEnd,
      [
        { beforeStandardCount: 6, type: "window", widthIn: 61.5, offsetIn: 265.5 },
        { beforeStandardCount: 8, type: "door", widthIn: 38, offsetIn: 407 },
      ],
      geometry.allowBorrow,
    ).slots;
    const base = retile(fp, "A", primary, STANDARD, CORNER, THICKNESS_IN, BRACED_SEED);
    const run = (
      slotsByWallId: Record<string, PanelSlot[]>,
      stops: Record<string, { startStopIn: number; endStopIn: number }>,
      memory?: Parameters<typeof retilePreservingOpeningsWithRunStopMemory>[11],
    ) =>
      retilePreservingOpeningsWithRunStopMemory(
        fp, "A", primary, STANDARD, CORNER, THICKNESS_IN, slotsByWallId, BRACED_SEED, undefined, stops, true, memory,
      );

    const start = run({ ...base, [WALL]: seeded }, {}).slotsByWallId;
    const original = sizes(start[WALL]!);
    expect(original).toEqual(["window:61.5", "door:38"]);

    const violations: string[] = [];
    let withheldAtLeastOnce = 0;
    for (let startStopIn = 0; startStopIn <= 520; startStopIn += 4) {
      const stopped = run(start, { [WALL]: { startStopIn, endStopIn: 0 } });
      if ((stopped.unbuiltOpeningsByWallId[WALL]?.unbuilt.length ?? 0) > 0) withheldAtLeastOnce++;
      const restored = run(stopped.slotsByWallId, {}, stopped.unbuiltOpeningsByWallId).slotsByWallId;
      const got = sizes(restored[WALL]!);
      // A stop deep enough to lose an opening for good is a drop, not a
      // resize; only compare when both came back.
      if (got.length !== original.length) continue;
      if (JSON.stringify(got) !== JSON.stringify(original)) {
        violations.push(`stop ${startStopIn}in: ${original} -> ${got}`);
      }
    }
    // Non-vacuity: the sweep really did exercise stops that withheld an
    // opening, which is where a resize would be easiest to introduce.
    expect(withheldAtLeastOnce).toBeGreaterThan(5);
    expect(violations.slice(0, 5)).toEqual([]);
  });
});
