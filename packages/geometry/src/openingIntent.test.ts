import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { retile, retilePreservingOpeningsWithRunStopMemory, wallGeometryFor } from "./retile";
import { getOpeningAnchors, retileWithOpenings, type OpeningAnchor } from "./tiling";
import type { Footprint, PanelSlot } from "./types";

/**
 * REPANELIZE R2, step 1 — an opening's intended position is CARRIED, not
 * recomputed.
 *
 * ⚠ These tests exist because the obvious version of this failed. On
 * 2026-10-07 an `offsetIn` that `getOpeningAnchors` DERIVED from the current
 * slots broke the run-stop round trip: the value recorded while a wall was
 * stopped described the stopped layout, so restoring sorted by a meaningless
 * key and a window and a door swapped places. The fix is that the intent
 * lives on the slot and every other layer is a courier.
 *
 * Placement still uses `beforeStandardCount`, so this step changes no
 * behaviour. What it establishes is the one property the failed attempt did
 * not have: **an intent goes through a re-tile unchanged.**
 */

const THICKNESS_IN = 15.5;
const STANDARD = 40;
const CORNER = 25.5;
const BRACED_SEED = { spacingIn: 100_000, defaultPattern: "chevron" as const, defaultMirrored: false };
const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));
const openingsOf = (slots: readonly PanelSlot[]) => slots.filter((s) => s.type === "window" || s.type === "door");

describe("an opening's intent is copied, never measured", () => {
  it("getOpeningAnchors reports the slot's own intent, even when it disagrees with where the slot IS", () => {
    // The sharpest form of the test: an intent deliberately unlike the actual
    // position. A function that measured would "correct" it; a courier does
    // not. 400 is nowhere near this window's real offset of 65.5.
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      { type: "standard", widthIn: 40 },
      { type: "window", widthIn: 48, anchorOffsetIn: 400 },
      { type: "corner", widthIn: 25.5 },
    ];
    const [anchor] = getOpeningAnchors(slots);
    expect(anchor!.offsetIn).toBe(400);
    // ...and the count, which placement still uses, is unaffected.
    expect(anchor!.beforeStandardCount).toBe(1);
  });

  it("an opening with no intent gets none invented for it", () => {
    const slots: PanelSlot[] = [
      { type: "corner", widthIn: 25.5 },
      { type: "standard", widthIn: 40 },
      { type: "window", widthIn: 48 },
      { type: "corner", widthIn: 25.5 },
    ];
    expect(getOpeningAnchors(slots)[0]!.offsetIn).toBeUndefined();
  });

  it("a re-tile hands the intent back out unchanged", () => {
    const openings: OpeningAnchor[] = [{ beforeStandardCount: 2, type: "window", widthIn: 48, offsetIn: 137.25 }];
    const slots = retileWithOpenings(300, STANDARD, CORNER, "start", true, true, openings).slots;
    const window = openingsOf(slots)[0]!;
    expect(window.anchorOffsetIn).toBe(137.25);
    // ⚠ And it is NOT the window's actual offset in this layout — which is
    // the proof it was carried rather than recomputed on the way through.
    let actual = 0;
    for (const s of slots) {
      if (s === window) break;
      actual += s.widthIn;
    }
    expect(actual).not.toBe(137.25);
  });

  it("⚠ THE ONE THAT FAILED BEFORE: a run-stop round trip leaves the intent untouched", () => {
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
        fp,
        "A",
        primary,
        STANDARD,
        CORNER,
        THICKNESS_IN,
        slotsByWallId,
        BRACED_SEED,
        undefined,
        stops,
        true,
        memory,
      );

    const start = run({ ...base, [WALL]: seeded }, {}).slotsByWallId;
    const intents = (slots: readonly PanelSlot[]) => openingsOf(slots).map((o) => `${o.type}:${o.anchorOffsetIn}`);
    expect(intents(start[WALL]!)).toEqual(["window:265.5", "door:407"]);

    // Stop the wall hard enough to withhold one opening, then put it back.
    for (const startStopIn of [200, 266, 268, 271, 300]) {
      const stopped = run(start, { [WALL]: { startStopIn, endStopIn: 0 } });
      const restored = run(stopped.slotsByWallId, {}, stopped.unbuiltOpeningsByWallId).slotsByWallId;
      expect(intents(restored[WALL]!), `after a start stop of ${startStopIn}in`).toEqual(["window:265.5", "door:407"]);
    }
  });
});
