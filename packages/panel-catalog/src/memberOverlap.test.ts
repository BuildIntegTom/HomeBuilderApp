import { describe, expect, it } from "vitest";
import type { PanelMember } from "./componentSchema";
import { overlappingMemberPairs } from "./memberPrism";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { buildBracedPanelMembers } from "./bracedPanelMembers";
import { buildColumnPanelMembers, buildColumnStyleMembers } from "./columnPanelMembers";
import { buildCornerPanelMembers } from "./cornerPanelMembers";
import { buildSafetyGapMembers } from "./safetyGapMembers";
import { buildGablePanelMembers } from "./gablePanelMembers";
import { buildDoorHeaderMembers, buildWindowHeaderMembers } from "./headerMembers";
import { buildJackStudMembers } from "./jackStudMembers";
import { buildTrussPlateMembers } from "./trussPlateMembers";
import { buildBoxBeamMembers } from "./boxBeamMembers";
import { buildBigHeaderMembers } from "./bigHeaderMembers";
import { buildVerticalGapFillerMembers } from "./verticalGapFillerMembers";
import { buildFloorRoofPanelMembers } from "./floorRoofPanelMembers";

/**
 * ⚠ NOTHING THE APP DRAWS MAY OCCUPY THE SAME SPACE TWICE.
 *
 * > *"We can't be having any overlapping in the 3d renderings or anywhere — I've
 * > noticed that while using the app. It doesn't make sense to allow any
 * > overlapping because these need to possible to build."* — Tommy, 2026-10-23
 *
 * Two solids cannot share a volume, so an overlap is always one of two real
 * errors: a member cut too long, or a member placed where another already is.
 * Either way a shop building from the drawing finds out the hard way.
 *
 * Bounds checks cannot see any of this — every offending member was inside
 * its panel. It took comparing every pair.
 */
export function overlappingPairsIn(members: PanelMember[]): string[] {
  return overlappingMemberPairs(members);
}

/* ⚠ Nothing is excluded any more. Until 2026-10-25 braced, gable and big
   header panels were left out because an axis-aligned box round a tilted
   brace claims space the brace does not fill. `memberPrism` compares the real
   cut instead — every member in this app is a convex polygon extruded along
   one axis, braces included — so they are all checked now, and the counts
   below are exact rather than conservative.

   It immediately mattered: a door header dropped from 20 reported overlaps
   to 12, so eight of them were never real. */

const D = 15.5;
const H = 96;

const CASES: { name: string; members: PanelMember[] }[] = [
  { name: "standard", members: buildStandardPanelMembers(40, D, H, false) },
  { name: "standard + nailer", members: buildStandardPanelMembers(40, D, H, true) },
  { name: "standard narrow", members: buildStandardPanelMembers(24, D, H, false) },
  { name: "column", members: buildColumnPanelMembers(D, H, false) },
  { name: "column style", members: buildColumnStyleMembers(25.5, D, H, false) },
  { name: "corner", members: buildCornerPanelMembers(D, H, false) },
  { name: "safety gap", members: buildSafetyGapMembers(D, H) },
  { name: "jack stud", members: buildJackStudMembers(D, 48) },
  { name: "truss plate", members: buildTrussPlateMembers(120, D) },
  { name: "box beam", members: buildBoxBeamMembers(120, D) },
  { name: "vertical gap filler", members: buildVerticalGapFillerMembers(40, D, 12, 24) },
  { name: "door header", members: buildDoorHeaderMembers(40, D, 24) },
  { name: "window header", members: buildWindowHeaderMembers(40, D, 24) },
  { name: "floor panel", members: buildFloorRoofPanelMembers({ kind: "floor", widthIn: 19.25, depthIn: D, lengthIn: 300, structuralGirtEnds: ["start", "end"] }) },
  { name: "roof panel", members: buildFloorRoofPanelMembers({ kind: "roof", widthIn: 19.25, depthIn: D, lengthIn: 300, structuralGirtEnds: [] }) },
  /* Previously unchecked, for want of a test that could see a diagonal. */
  { name: "braced chevron", members: buildBracedPanelMembers(48, D, H, false, "chevron", false) },
  { name: "braced hatch", members: buildBracedPanelMembers(48, D, H, false, "hatch", true) },
  { name: "gable", members: buildGablePanelMembers(48, D, 48, 72, false) },
  { name: "big header", members: buildBigHeaderMembers(40, D, 24, false, "plywood") },
];

/* Panels whose members are not all axis-aligned, or that are known to
   overlap and are tracked elsewhere. Each one needs a reason, and the reason
   has to be better than "it was already like that". */
/**
 * ⚠ THE PANELS THAT STILL OVERLAP, AND WHY EACH ONE IS NOT SILENTLY FIXED.
 *
 * Every entry here is a real interference — two solids in one place, which a
 * shop cannot build. They are pinned rather than tolerated: the count may go
 * down, never up, and a new one anywhere fails this file.
 *
 * They are NOT fixed here because each traces back to a dimension Tommy gave,
 * and choosing which of two of his numbers gives way is his call, not mine:
 *
 *   1. ~~`stud_corner_N x girt_N_web`~~ — **FIXED 2026-10-23.** The web is
 *      now ripped to the clear space between the studs it runs past. The BOM
 *      calls it 8 3/4in but a 15.5in panel leaves 8 1/2in, so the nominal web
 *      stood 1/8in into every stud it crossed. 8 gone per standard-family
 *      panel, and it unblocked the centre nailer, which would have added 4
 *      more.
 *   2. The nailer, twice over, and the cause is now known. Measured: the
 *      whole 90in of it sits inside `stud_centre_1_exterior`, and another
 *      1 1/2in of it inside the bottom plate.
 *
 *      ⚠ Both follow from the nailer being modelled INSIDE the panel's
 *      depth (y 0–3.5) when it is really applied to the FACE. Tommy,
 *      2026-10-25, describing how braces go on: *"The diagonals for each
 *      panel are added after it comes out of the compression table via panel
 *      surgery."* A member screwed to a pressed panel's face sits proud of
 *      it and collides with nothing inside — which would clear both of
 *      these at once.
 *
 *      Not changed here, because moving the nailer out of the cavity changes
 *      the wall's built thickness, and that is his call. Suppressing the
 *      nailer where the stud already is was tried and reverted: it silently
 *      drops a member the user asked for.
 *   3. `girt_1_bar_* x blocking_2_*`, 3 1/2 x 1 1/2 x 1/4in, in column and
 *      corner panels — a girt bar and a blocking row 1/4in into each other.
 *   4. Header chords run 3/4in into the end plywood, 20 pairs per header —
 *      the same error the floor panel's joists had against its lids — plus
 *      the W-truss braces into the chords they land on.
 */
const BASELINE: Record<string, number> = {
  "standard + nailer": 2,
  column: 4,
  "column style": 4,
  corner: 4,
  "door header": 12,
  "window header": 12,
  /* ⚠ Newly VISIBLE, not newly broken. These panels have always been like
     this; nothing could see them until the prism test. Most of what is here
     is a brace lapping a corner post, which is his own 2026-10-13 geometry —
     *the far point flush to the panel edge* — so the post is exactly where
     the brace is going. Lapped on purpose is still two solids in one place
     on a drawing, and the shop still has to be told which one is notched,
     so they are counted rather than waved through. */
  "braced chevron": 6,
  "braced hatch": 4,
  gable: 1,
  "big header": 26,
};

describe("⚠ no member occupies the same space as another", () => {
  for (const { name, members } of CASES) {
    it(`${name} panel builds solid`, () => {
      const overlaps = overlappingPairsIn(members);
      const allowed = BASELINE[name] ?? 0;
      if (allowed === 0) {
        expect({ panel: name, overlaps }).toEqual({ panel: name, overlaps: [] });
      } else {
        /* Pinned, with the list in the failure when it moves either way —
           going DOWN is good news and still has to be recorded here. */
        expect({ panel: name, count: overlaps.length, overlaps }).toEqual({ panel: name, count: allowed, overlaps });
      }
    });
  }

  it("the panels that ARE solid stay that way", () => {
    // Named so a regression reads as a list getting shorter, not a number.
    const clean = CASES.filter(({ name }) => BASELINE[name] === undefined).map(({ name }) => name);
    expect(clean).toEqual([
      "standard",
      "standard narrow",
      "safety gap",
      "jack stud",
      "truss plate",
      "box beam",
      "vertical gap filler",
      "floor panel",
      "roof panel",
    ]);
  });
});
