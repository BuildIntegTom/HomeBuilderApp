import { describe, expect, it } from "vitest";
import type { PanelMember } from "./componentSchema";
import { memberBoxSizeIn } from "./panelMemberHelpers";
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
  const boxes = members.map((m) => {
    const size = memberBoxSizeIn(m);
    return {
      id: m.memberId,
      x0: m.position.xIn, x1: m.position.xIn + size.xIn,
      y0: m.position.yIn, y1: m.position.yIn + size.yIn,
      z0: m.position.zIn, z1: m.position.zIn + size.zIn,
    };
  });
  const found: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      /* A shared face is contact, not overlap — the tolerance has to be
         tighter than the thinnest real member (1/16in hardware) and looser
         than float noise. */
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      if (ox > 1e-6 && oy > 1e-6 && oz > 1e-6) {
        found.push(`${a.id} x ${b.id} (${ox.toFixed(3)} x ${oy.toFixed(3)} x ${oz.toFixed(3)}in)`);
      }
    }
  }
  return found;
}

/* Rotated members are excluded from the comparison, not from the rule: an
   axis-aligned box around a tilted brace claims space the brace does not
   fill, so comparing those boxes reports overlaps that are not real. Every
   panel below either has no rotated members or is listed as a known gap. */
const isAxisAligned = (m: PanelMember) => (m.position.rotationDeg ?? 0) % 90 === 0;

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
];

/* Panels whose members are not all axis-aligned, or that are known to
   overlap and are tracked elsewhere. Each one needs a reason, and the reason
   has to be better than "it was already like that". */
const KNOWN_ROTATED: { name: string; members: PanelMember[]; why: string }[] = [
  { name: "braced chevron", members: buildBracedPanelMembers(40, D, H, false, "chevron", false), why: "diagonal braces: an axis-aligned box round a tilted board claims space it does not fill" },
  { name: "gable", members: buildGablePanelMembers(40, D, 48, 72, false), why: "sloped top plate" },
  { name: "big header", members: buildBigHeaderMembers(40, D, 24, false, "plywood"), why: "W-truss web is diagonal" },
];

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
 *   2. `bottom_plate_2x4_ext x nailer`, 1 1/2 x 3 1/2 x 1 1/2in — a whole 2x4
 *      cross-section. Not a joint at all: the nailer is placed inside the
 *      plate. ⚠ This is the OLD `includeNailer` member, not the new centre
 *      nailer stud — that one sits on the plate properly. Where the old one
 *      should actually sit is still open.
 *   3. `girt_1_bar_* x blocking_2_*`, 3 1/2 x 1 1/2 x 1/4in, in column and
 *      corner panels — a girt bar and a blocking row 1/4in into each other.
 *   4. Header chords run 3/4in into the end plywood, 20 pairs per header —
 *      the same error the floor panel's joists had against its lids — plus
 *      the W-truss braces into the chords they land on.
 */
const BASELINE: Record<string, number> = {
  // "standard", "standard narrow" and "floor"/"roof" are solid and so are
  // absent: a panel only appears here while it is still wrong.
  "standard + nailer": 2,
  column: 4,
  "column style": 4,
  corner: 4,
  "door header": 20,
  "window header": 20,
};

describe("⚠ no member occupies the same space as another", () => {
  for (const { name, members } of CASES) {
    it(`${name} panel builds solid`, () => {
      const rotated = members.filter((m) => !isAxisAligned(m));
      expect({ panel: name, rotated: rotated.map((m) => m.memberId) }).toEqual({ panel: name, rotated: [] });
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

  it("⚠ the panels with tilted members are listed, not forgotten", () => {
    /* These cannot be checked this way, and saying so out loud is the point:
       a reader should not conclude from this file that every panel in the app
       has been proven solid. Checking them properly needs real oriented-box
       intersection, which nothing here does yet. */
    for (const { name, members, why } of KNOWN_ROTATED) {
      expect({ name, hasMembers: members.length > 0, why: why.length > 0 }).toEqual({ name, hasMembers: true, why: true });
    }
    expect(KNOWN_ROTATED.map((k) => k.name)).toEqual(["braced chevron", "gable", "big header"]);
  });

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
