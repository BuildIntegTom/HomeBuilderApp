import { describe, expect, it } from "vitest";
import type { PanelMember } from "./componentSchema";
import { overlappingMemberPairs } from "./memberPrism";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { buildBracedPanelMembers } from "./bracedPanelMembers";
import { buildCrossTiltPanelMembers, crossTiltMinimumLowHeightIn } from "./crossTiltPanelMembers";
import { buildColumnPanelMembers, buildColumnStyleMembers } from "./columnPanelMembers";
import { buildCornerPanelMembers } from "./cornerPanelMembers";
import { buildSafetyGapMembers } from "./safetyGapMembers";
import { buildGablePanelMembers, GABLE_PANEL_MIN_HEIGHT_IN } from "./gablePanelMembers";
import { buildDoorHeaderMembers, buildWindowHeaderMembers } from "./headerMembers";
import { buildJackStudMembers } from "./jackStudMembers";
import { buildTrussPlateMembers } from "./trussPlateMembers";
import { buildBoxBeamMembers } from "./boxBeamMembers";
import { buildBigHeaderMembers } from "./bigHeaderMembers";
import { buildBigHeaderBeamMembers } from "./bigHeaderBeamMembers";
import { buildVerticalGapFillerMembers } from "./verticalGapFillerMembers";
import { buildFloorRoofPanelMembers, buildRoofPanelCapMembers } from "./floorRoofPanelMembers";

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
  /* ⚠ The roof panel AS INSTALLED: pitched, plumb-cut at both ends, on its
     bearing seat, with the eave cap it lands on. Unaudited until 2026-11-01,
     because the cap's pieces were all stacked at {0,0,0} and the panel was
     only ever checked unpitched. Both are real now, and both are held to
     zero. */
  {
    name: "roof panel as installed",
    members: (() => {
      const o = { kind: "roof" as const, widthIn: 19.25, depthIn: D, lengthIn: 300, structuralGirtEnds: [], pitchIn12: 4, bearingSeatDepthIn: D };
      return [...buildFloorRoofPanelMembers(o), ...buildRoofPanelCapMembers(o, "eave", 4)];
    })(),
  },
  /* ⚠ **THE MITRED ROOF PANEL — an octagon's, and it CRASHED this audit,
     2026-11-24.** Every roof case above is square in plan, and a mitre is
     what makes a member OBLIQUE, which is what routes a pair through
     `convexSolidsOverlap` instead of the 2D path. That function walked
     `BOX_FACES` for both solids — a silent assumption of eight corners — and
     the tall end's bearing wedge is a TRIANGULAR section ring, six corners.
     `corners[7]` was `undefined` and it threw, taking the page down the
     moment anyone drew an Octagon from the Home tiles. Tommy: *"octagons are
     unable to work on the browser."*

     So this case exists to make the suite reach what a Home tile reaches.
     ⚠ **The numbers are the 16ft Octagon's own leading corner**, lifted from
     `floorRoofPanelMitre.test.ts`' `LEADING` — what `deckPanelCut` measures
     on that building — rather than a pull-back invented here. An invented
     mitre reports overlaps the app would never build, which is worse than no
     case at all. */
  {
    name: "roof panel as installed, mitred",
    members: (() => {
      const o = {
        kind: "roof" as const,
        widthIn: 28.125,
        depthIn: D,
        lengthIn: 192,
        structuralGirtEnds: [],
        pitchIn12: 4,
        bearingSeatDepthIn: D,
        mitreIn: { startNearIn: 56.25, startFarIn: 28.125, endNearIn: 56.25, endFarIn: 28.125 },
      };
      return [...buildFloorRoofPanelMembers(o), ...buildRoofPanelCapMembers(o, "eave", 4)];
    })(),
  },
  /* Previously unchecked, for want of a test that could see a diagonal. */
  { name: "braced chevron", members: buildBracedPanelMembers(48, D, H, false, "chevron", false) },
  { name: "braced hatch", members: buildBracedPanelMembers(48, D, H, false, "hatch", true) },
  { name: "gable", members: buildGablePanelMembers(48, D, 48, 72, false) },
  /* ⚠ The cross-tilted row, unchecked until 2026-11-01 — it lived inside the
     3D view, so it reached no document and no audit either. Its tilt runs
     through the panel's DEPTH, which is the one plane none of the other
     sloped panels here exercise. */
  {
    name: "cross tilt",
    members: buildCrossTiltPanelMembers({
      widthIn: 24,
      depthIn: D,
      /* ⚠ Its own minimum, not the old 3 1/2in stand-in: since 2026-11-01 the
         low edge has to hold a real stud in each wythe, and the panel
         refuses below that rather than building something that interferes
         with itself. */
      lowHeightIn: crossTiltMinimumLowHeightIn(4),
      pitchIn12: 4,
    }).members,
  },
  /* ⚠ And at the FLATTEST pitch the row builds, where the rip leaves the most
     board standing and the panel has to be tallest. That is the case the 3 1/2in
     stand-in failed, so it is the one worth holding. */
  {
    name: "cross tilt shallow",
    members: buildCrossTiltPanelMembers({
      widthIn: 24,
      depthIn: D,
      lowHeightIn: crossTiltMinimumLowHeightIn(2),
      pitchIn12: 2,
    }).members,
  },
  /* ⚠ The steep case, where the top plate is a 4x4 instead of a 2x4. */
  {
    name: "cross tilt steep",
    members: buildCrossTiltPanelMembers({
      widthIn: 24,
      depthIn: D,
      lowHeightIn: crossTiltMinimumLowHeightIn(8),
      pitchIn12: 8,
    }).members,
  },
  { name: "big header", members: buildBigHeaderMembers(40, D, 24, false, "plywood") },
  /* ⚠ The Mid-Wall Beam flavour, unaudited until 2026-11-01 — it shares the
     chords, the end treatment and the truss web with its two siblings, so it
     shared their interferences too. */
  { name: "big header beam", members: buildBigHeaderBeamMembers(120, D, 24) },
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
  /* ⚠ **2 → 1 on 2026-11-06 (B31), and a drop is recorded as carefully as a
     rise.** `bottom_plate_2x4_ext x nailer` is gone: the optional nailer used
     to start at the skin's top face and run through the plate 2x4 above it,
     and his own reference BOM has always cut that board at 115.5in on a 120in
     panel — which is exactly plate face to plate face. The position was wrong,
     not the length.

     The one that remains is a BUILDING question rather than an arithmetic
     one: on any panel wide enough for a centre nailer stud, the optional
     nailer is centred on the same line, so the two are the same board asked
     for twice. Nudging either would invent a position nobody chose. */
  "standard + nailer": 1,
  column: 4,
  "column style": 4,
  corner: 4,
  /* ⚠ Newly VISIBLE, not newly broken. These panels have always been like
     this; nothing could see them until the prism test. Most of what is here
     is a brace lapping a corner post, which is his own 2026-10-13 geometry —
     *the far point flush to the panel edge* — so the post is exactly where
     the brace is going. Lapped on purpose is still two solids in one place
     on a drawing, and the shop still has to be told which one is notched,
     so they are counted rather than waved through. */
  /* ⚠ 6 → 2 and 4 → 0 on 2026-10-25, when he corrected the far anchor from
     the panel edge to the opposite post's face. Every brace had been running
     into the post it reached past. A hatch panel is now clean outright.

     ⚠ 2 → 0 on 2026-11-24, and that was the app's LAST standing member
     overlap. The chevron's two were its legs clipping
     `brace_center_connector`, the vertical post the two legs meet at
     mid-panel — and the cause was never the post's length but its SQUARE
     ENDS, bearing on a face sloped at the brace's own pitch. Cut both ends to
     that pitch and the board lands flat: same centreline length, nothing in
     anything else. See `buildBracedCenterConnector`. */
  "braced chevron": 0,
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

  it("agrees with the height sweep at the height the sweep shares with it", () => {
    /* ⚠ The sweep below re-declares each builder's arguments, so the two
       lists could drift apart and each keep passing. Every height case names
       an `anchorIn` at which its parameters are identical to the fixed case
       above, and the two must report the same overlaps there. If you change a
       case in one list, this fails until you change it in the other. */
    for (const { name, at, anchorIn } of HEIGHT_CASES) {
      const fixed = CASES.find((c) => c.name === name);
      if (!fixed) continue;
      expect({ name, swept: overlappingPairsIn(at(anchorIn)) }).toEqual({ name, swept: overlappingPairsIn(fixed.members) });
    }
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
      /* ⚠ 12 → 0 each on 2026-11-01, and DELETED from BASELINE rather than
         set to zero. A header's two ends were full-depth x full-height
         plywood sheets at its X extremes, and both chord caps are full-span
         sheets meeting them at 90deg, so every end cap crossed all four of
         them — carried as *"an illustrative simplification"*. Tommy:
         *"The 3/4\" plywood skins on the side I don't think are necessary,
         and should be replaced with regular 2x4 studs vertically like a
         standard panel."* Framed like a standard panel, the ends stand
         BETWEEN the chords and nothing crosses anything. */
      "door header",
      "window header",
      "floor panel",
      "roof panel",
      "roof panel as installed",
      "roof panel as installed, mitred",
      "braced hatch",
      /* ⚠ 1 → 0 on 2026-11-01. The gable's single overlap was its sloped top
         plate clipping its own skin, and it went when the skin, the plates
         and the corner studs stopped each deriving the roofline separately:
         one `topAtXIn`, read by all three, with plumb ends instead of ends
         square to the rip. Tommy's *"The corners of the gable end panels are
         not plumb cut."* The entry is DELETED from BASELINE rather than set
         to 0, so the panel is now held to the same zero every clean panel
         is. */
      "gable",
      /* ⚠ 5 → 0 on 2026-11-01, and DELETED from BASELINE rather than set to
         zero. The cross-tilted panel's low edge could not hold its own layers
         while the slope was carried by whole 2x4s tilted bodily into it.
         Tommy, with SketchUp screenshots: *"Both 2x4s on top plate have an
         edge ripped off of them."* The plate lies FLAT and takes the slope in
         its own rip, so the exterior face needs 3.374in at 4:12 rather than
         4.62in — and the panel refuses outright below whatever its own
         layers come to, instead of building something that interferes with
         itself. */
      "cross tilt",
      "cross tilt shallow",
      "cross tilt steep",
      /* ⚠ 26 → 0 on 2026-11-01, and DELETED from BASELINE. *"Doors and
         headers and big headers should all follow suit."* Two causes, and the
         end sheets were only the first: 14 of them were the plywood ends
         crossing the chords and the jacks, and the other 12 were the CHORDS
         THEMSELVES drawn straight through both jack studs. Which gives way is
         settled by his own convention rather than by a choice here — *"RO's
         take into account these jack studs"*, a slot's width *"represents the
         WHOLE assembly's footprint"* — so the jacks are inside the width and
         the header stops short of them. Every Big Header chord is two jack
         thicknesses shorter on the cut list now. */
      "big header",
      "big header beam",
    ]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ⚠ THE SAME PANELS, SWEPT THROUGH EVERY HEIGHT THEY CAN BE BUILT AT.

   Everything above builds at `H = 96` and nothing else. That is ONE SAMPLE,
   so an interference that depends on a panel's height is invisible to this
   file unless it happens to bite at 96in — and on 2026-11-13 one did: the
   Column Panel's blocking row count ran a row out of the top of the panel in
   seven height bands, 2 1/4in proud at 50in and at 84in, with 40, 60, 72, 96
   and 120in all clean. The column was then swept in its own file; every
   other panel type was still sampled once.

   This sweeps them all, every 1/2in. It costs about 330ms.

   ⚠ **It found a HANG, not just overlaps.** `computeTrussWebPeakCount`
   divides by the web's rise, and all three header builders have a height at
   which that rise is exactly zero — 4.5in for a door/window header and the
   Mid-Wall Beam, 8.5in for a Big Header. `ceil(w·tan30 / 0)` is `Infinity`,
   and the brace loop ran on it until the heap died. A door/window header's
   height is DERIVED (`Math.max(0, wallHeightIn − roTopZIn)`), so a 55 1/2in
   window on a 36in sill in a 96in wall reaches it exactly. Guarded in that
   helper, where all three builders meet — see its own doc comment.

   ⚠ **Half-inch steps, not inches.** Panel heights in this app are not
   integers: a gable tile's edges come out at values like 81.5in. A 1in step
   would have stepped straight over the 8.5in singularity.

   Out of scope here, deliberately: the floor and roof panels, the truss
   plate and the box beam, whose geometry varies along their LENGTH rather
   than their height, and the cross-tilted panel, whose height is derived
   from its pitch. Each wants its own sweep over its own axis; none is
   covered by this one, and saying so is better than implying they are.
   ══════════════════════════════════════════════════════════════════════════ */

interface HeightCase {
  name: string;
  at: (heightIn: number) => PanelMember[];
  loIn: number;
  hiIn: number;
  /** A height at which this case's arguments match the fixed case of the
      same name, so the two lists can be checked against each other. */
  anchorIn: number;
}

/* ⚠ One octagon corner's own pull-back on a 15½ in wall: `t × tan 22½°`,
   written out rather than recomputed so every mitred case below is cut by the
   same number. A corner panel is mitred at ONE end — the end on the corner. */
const START_MITRE = { startExtIn: 0, startIntIn: 6.4203, endExtIn: 0, endIntIn: 0 } as const;
const WALL_LO = 32;
const WALL_HI = 144;

const HEIGHT_CASES: HeightCase[] = [
  { name: "standard", at: (h) => buildStandardPanelMembers(40, D, h, false), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 96 },
  { name: "standard + nailer", at: (h) => buildStandardPanelMembers(40, D, h, true), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 96 },
  { name: "standard narrow", at: (h) => buildStandardPanelMembers(24, D, h, false), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 96 },
  { name: "column", at: (h) => buildColumnPanelMembers(D, h, false), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 96 },
  { name: "column style", at: (h) => buildColumnStyleMembers(25.5, D, h, false), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 96 },
  { name: "corner", at: (h) => buildCornerPanelMembers(D, h, false), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 96 },
  { name: "safety gap", at: (h) => buildSafetyGapMembers(D, h), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 96 },
  /* Its one member is the full-height sheet, so "height" is its whole size. */
  { name: "jack stud", at: (h) => buildJackStudMembers(D, h), loIn: 12, hiIn: WALL_HI, anchorIn: 48 },
  { name: "braced chevron", at: (h) => buildBracedPanelMembers(48, D, h, false, "chevron", false), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 96 },
  { name: "braced hatch", at: (h) => buildBracedPanelMembers(48, D, h, false, "hatch", true), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 96 },
  /* Sweeps the LOW edge, keeping the 24in rise of the fixed case, so the
     anchor is its 48in low edge. */
  { name: "gable", at: (h) => buildGablePanelMembers(48, D, h, h + 24, false), loIn: WALL_LO, hiIn: WALL_HI, anchorIn: 48 },
  /* ⚠ **THREE MORE GABLES, because one was not the gable anyone ships.**
     2026-11-14: the sloped-plate-through-the-girt finding turned out to reach
     every girt style and both orientations, while the case above builds only
     the LEGACY plywood web on a LEFT-low tile. The project default is
     `blocking`, whose 2x6 stands 1in higher above the row centre, and a
     right-low tile mirrors the whole problem onto the other bar.
     ⚠ And the band BELOW `WALL_LO`, which nothing had ever built: a gable
     tile is allowed down to `GABLE_PANEL_MIN_HEIGHT_IN` — *"we can take
     little gable end panels all the way to the end"* — and a sliver that
     short has its own finding. */
  {
    name: "gable blocking",
    at: (h) => buildGablePanelMembers(48, D, h, h + 24, false, "blocking"),
    loIn: WALL_LO,
    hiIn: WALL_HI,
    anchorIn: 48,
  },
  {
    name: "gable ring",
    at: (h) => buildGablePanelMembers(48, D, h, h + 24, false, "ring"),
    loIn: WALL_LO,
    hiIn: WALL_HI,
    anchorIn: 48,
  },
  /* The same tile mirrored: the swept edge is the RIGHT one now. */
  {
    name: "gable right-low",
    at: (h) => buildGablePanelMembers(48, D, h + 24, h, false, "blocking"),
    loIn: WALL_LO,
    hiIn: WALL_HI,
    anchorIn: 48,
  },
  /* ⚠ **From ZERO**, not from `GABLE_PANEL_MIN_HEIGHT_IN`. The floor is on the
     TALLER edge (which is h + 24 here), so the LOW edge is allowed all the way
     down — *"we can take little gable end panels all the way to the end"* —
     and a low edge of 0 is an ordinary triangular tile at a shed's low corner
     or above a gable window. Starting at 1.5 only grazed the band where the
     two plates cross; this covers the triangle itself. */
  {
    name: "gable sliver",
    at: (h) => buildGablePanelMembers(48, D, h, h + 24, false, "blocking"),
    loIn: 0,
    hiIn: WALL_LO,
    anchorIn: 48,
  },

  /* ──────────────────────────────────────────────────────────────────────
     ⚠ **THE FAMILIES THAT VARY ALONG THEIR LENGTH, swept 2026-11-16.**

     This file's own note has said since 2026-11-14 that floor/roof panels,
     the truss plate, the box beam and the cross-tilt row were *"still
     unswept — named in the file so nobody assumes otherwise"*. They are the
     ones whose geometry moves with a span rather than a height, so the
     `at(h)` here is reading a LENGTH; the harness does not care which, and
     saying so is cheaper than a second harness.

     ⚠ **Worth doing now rather than later**: the deck was cut to the
     building's own outline on 2026-11-16, which rewrote three of the floor
     panel's member builders and gave its joists a plan bevel. A family that
     has just changed shape is exactly the one a single sample is least
     likely to represent.
     ────────────────────────────────────────────────────────────────────── */
  {
    name: "floor panel by length",
    at: (l) =>
      buildFloorRoofPanelMembers({
        kind: "floor",
        widthIn: 19.25,
        depthIn: D,
        lengthIn: l,
        structuralGirtEnds: ["start", "end"],
      }),
    loIn: 24,
    hiIn: 300,
    anchorIn: 300,
  },
  {
    name: "roof panel by length",
    at: (l) =>
      buildFloorRoofPanelMembers({ kind: "roof", widthIn: 19.25, depthIn: D, lengthIn: l, structuralGirtEnds: [] }),
    loIn: 24,
    hiIn: 300,
    anchorIn: 300,
  },
  /* ⚠ The MITRED deck panel — his 2026-11-15 *"cut to fit the raised octagon
     gable perimeter"*. The pull-back is held at an octagon corner's own
     6.420in while the span sweeps, so a length at which the cut eats more
     than the panel has shows up as a refusal or as an interference. */
  {
    name: "floor panel mitred by length",
    at: (l) =>
      buildFloorRoofPanelMembers({
        kind: "floor",
        widthIn: 19.25,
        depthIn: D,
        lengthIn: l,
        structuralGirtEnds: ["start", "end"],
        mitreIn: { startNearIn: 0, startFarIn: 6.4203, endNearIn: 6.4203, endFarIn: 0 },
      }),
    loIn: 24,
    hiIn: 300,
    anchorIn: 300,
  },
  { name: "truss plate by length", at: (l) => buildTrussPlateMembers(l, D), loIn: 24, hiIn: 300, anchorIn: 120 },
  { name: "box beam by length", at: (l) => buildBoxBeamMembers(l, D), loIn: 24, hiIn: 300, anchorIn: 120 },

  /* ──────────────────────────────────────────────────────────────────────
     ⚠ **THE 22½° PLAN MITRE, swept — both panels that take it.**

     Built 2026-11-16 and tested at a handful of sizes. A mitre moves posts,
     shortens plates per wythe and turns two sheets into oblique prisms, all
     of which interact with the height- and width-dependent rules this sweep
     exists for — so it belongs here rather than only in its own file.
     ────────────────────────────────────────────────────────────────────── */
  /* ⚠ **AT THE WIDTH THE APP ACTUALLY BUILDS, 15½ in** (`cornerPanelWidthIn`),
     and that is the whole point of these two. The first version of this case
     used 25½ in — `COLUMN_TOTAL_WIDTH_IN`, the COLUMN's width and the one
     width a corner panel never has — and a 25½ in core has room to frame a
     mitred girt row where a 14in core does not. Every unit test passed while
     the Review Log in the browser reported `girt_1_bar_left x
     girt_1_bar_right` on all sixteen corner panels of an octagon. **Sweep the
     size the app emits, not the size the constant is named after.** */
  {
    name: "corner mitred",
    at: (h) => buildCornerPanelMembers(D, h, false, 15.5, undefined, START_MITRE),
    loIn: WALL_LO,
    hiIn: WALL_HI,
    anchorIn: 96,
  },
  {
    name: "corner mitred + nailer",
    at: (h) => buildCornerPanelMembers(D, h, true, 15.5, undefined, START_MITRE),
    loIn: WALL_LO,
    hiIn: WALL_HI,
    anchorIn: 96,
  },
  /* A WIDE mitred corner panel is a real case too — the tiler emits one from
     the 51in-75.5in band — and it is the case where the row DOES fit and the
     centre nailer butts against the bar instead. */
  {
    name: "corner mitred wide + nailer",
    at: (h) => buildCornerPanelMembers(D, h, true, 25.5, undefined, START_MITRE),
    loIn: WALL_LO,
    hiIn: WALL_HI,
    anchorIn: 96,
  },
  /* ⚠ The gable with BOTH of 2026-11-16's cuts at once — the compound bevel
     across its depth and the plan mitre at its end. The two were built hours
     apart and compose on every diagonal octagon facet, which is the building
     he asked about. */
  {
    name: "gable mitred + bevelled",
    at: (h) => buildGablePanelMembers(39.75, D, h, h + 24, false, "blocking", 3.6534, START_MITRE),
    loIn: WALL_LO,
    hiIn: WALL_HI,
    anchorIn: 48,
  },
  /* The same wedge mirrored, so the merge is pinned at both orientations the
     way the full-height gable cases already are. */
  {
    name: "gable sliver right-low",
    at: (h) => buildGablePanelMembers(48, D, h + 24, h, false, "blocking"),
    loIn: 0,
    hiIn: WALL_LO,
    anchorIn: 48,
  },
  /* ⚠ The headers start BELOW their own layer sum on purpose — that is
     where the singularity and the chord-through-chord case live. */
  { name: "door header", at: (h) => buildDoorHeaderMembers(40, D, h), loIn: 4, hiIn: 48, anchorIn: 24 },
  { name: "window header", at: (h) => buildWindowHeaderMembers(40, D, h), loIn: 4, hiIn: 48, anchorIn: 24 },
  { name: "big header", at: (h) => buildBigHeaderMembers(40, D, h, false, "plywood"), loIn: 8, hiIn: 48, anchorIn: 24 },
  /* ⚠ **The OTHER Big Header — 2026-11-14.** Over 48in wide it is stuffed
     perpendicular, so its plates run corner to corner and the jack studs stand
     BETWEEN them instead of beside them. A full-width plate passing over a
     full-height jack is exactly the overlap this case exists to refuse, and
     the 40in case above can never reach it. Both 2x4 jack configs, because the
     jack's thickness is what the plate has to clear. */
  { name: "big header wide", at: (h) => buildBigHeaderMembers(72, D, h, false, "plywood"), loIn: 8, hiIn: 48, anchorIn: 24 },
  { name: "big header wide 2x4 jacks", at: (h) => buildBigHeaderMembers(96, D, h, false, "plywood+2x4"), loIn: 8, hiIn: 48, anchorIn: 24 },
  { name: "big header beam", at: (h) => buildBigHeaderBeamMembers(120, D, h), loIn: 4, hiIn: 48, anchorIn: 24 },
  { name: "vertical gap filler", at: (h) => buildVerticalGapFillerMembers(40, D, h, h + 12), loIn: 8, hiIn: WALL_HI, anchorIn: 12 },
];

/**
 * An overlap with its ROW INDICES removed, so one entry stands for the whole
 * family. A taller panel gets more blocking rows and therefore more copies of
 * the same mistake; what matters is whether a NEW KIND of interference
 * appears, not that an old one got more numerous.
 *
 * Only whole numeric segments are replaced, so `bottom_plate_2x4_ext` keeps
 * its `2x4` and `girt_3_bar_left` becomes `girt_N_bar_left`.
 */
function overlapPattern(pair: string): string {
  return pair
    .split(" x ")
    .map((id) =>
      id
        .replace(" (bounding boxes only)", "")
        .split("_")
        .map((seg) => (/^\d+$/.test(seg) ? "N" : seg))
        .join("_"),
    )
    .join(" x ");
}

/** Every pattern a case shows anywhere in its band, with the band it spans. */
function sweepFindings({ at, loIn, hiIn }: HeightCase): string[] {
  const seen = new Map<string, number[]>();
  for (let h = loIn; h <= hiIn; h += 0.5) {
    let members: PanelMember[];
    try {
      members = at(h);
    } catch {
      /* A refusal is a correct answer — the gable refuses a taller edge over
         its own limit, and the cross-tilt row refuses a low edge under its
         own layers. A panel that declines to exist cannot overlap itself. */
      continue;
    }
    for (const pair of overlappingPairsIn(members)) {
      const key = overlapPattern(pair);
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(h);
    }
  }
  return [...seen]
    .map(([key, hs]) => `${key} @ ${hs[0]}..${hs[hs.length - 1]}`)
    .sort();
}

/**
 * ⚠ WHAT EACH PANEL DOES ACROSS ITS WHOLE HEIGHT BAND. A new entry fails.
 *
 * Five panels are clean at **every** height they build at — standard,
 * standard narrow, safety gap, jack stud and braced hatch. Their empty lists
 * are the strongest statement in this file and are written out rather than
 * omitted, so deleting one reads as a change.
 *
 * Three groups are the SAME interferences the 96in baseline already pins,
 * now confirmed height-independent rather than newly tolerated: the optional
 * nailer inside the centre stud (all heights), the girt bar 1/4in into the
 * blocking rows (from 47.5in, which is simply where a column gets its first
 * row), and the chevron's legs clipping their centre post. Each is a BUILDING
 * question recorded in `BASELINE` above, and sweeping does not change the
 * answer.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ⚠ **THE FOUR FINDINGS THIS SWEEP FOUND ON 2026-11-13/14, AND WHAT TOMMY
 * DECIDED ABOUT EACH ON 2026-11-14.** Each was two of his own numbers in
 * conflict, which is the rule `BASELINE` is written under; he settled all
 * four, and the lists below are what is left.
 *
 * **1. A gable with a short low edge** ran its sloped top plate through the
 * first girt bar. FIXED. The row drops to the plate's underside instead of
 * being flush with the short stud's butt corner — *"It doesn't necessarily
 * matter where girts are. As long as they are spaced every 3 ft or less they
 * most certainly can be less to accommodate space for the top."* ⚠ The
 * finding was bigger than this file had pinned: it reached all three girt
 * styles (the project default `blocking` stands 1in higher above the row's
 * centre than the legacy web this case builds) and BOTH gable orientations.
 * Three more gable cases were added rather than trusting the one.
 *
 * **2. A header shallower than its own layers** drew its two chords through
 * each other — 4in for a door/window (layers 4.5in), 8in for a Big Header
 * (8.5in, its chords rotated to 3.5in). FLOORED, not refused:
 * `computeHeaderHeightIn` now returns at least `HEADER_MIN_HEIGHT_IN` and
 * `computeOpeningGeometry` drops the rough opening's top by the shortfall, so
 * the opening gives way rather than the header being drawn thinner than its
 * boards. A refusal was the obvious alternative and was rejected for a
 * specific reason: the height is DERIVED inside a render, which is how the
 * gable-window crash took the viewport down on 2026-10-31. The chord pair
 * therefore still appears below, at a height nothing in the app can ask for.
 *
 * **3. The shallow-web band** — door/window 6–10in, Big Header 10–14in,
 * Mid-Wall Beam 6–9in, where braces lapped each other, the end studs and the
 * Big Header's jacks. FIXED, and the diagnosis was the interesting part:
 * `computeTrussWebPeakCount`'s guard (a gap at least as thick as a brace
 * board) stopped the hang but still admitted a web whose own LEVEL-CUT
 * footprint — `boardWidth / sin α`, twice the board's width at 30deg —
 * does not fit the run one web bay leaves once the end inset is taken off.
 * `trussWebFitsIn` derives that, `planHeaderWeb` decides, and a header that
 * fails it is built as a SOLID BEAM: chords, end studs and blocking at 24in
 * on centre or less. Tommy's pick over relaxing the 30deg floor or refusing
 * the opening: *"3a sounds good."*
 *
 * **4. Nothing reported any of it.** REPORTED. A no-web header is an ABSENCE,
 * so it has no overlapping pairs to find and the Review Log's overlap entry
 * could never see it; `headerWithoutWebReviewEntries` in `page.tsx` lists it
 * by fabricated panel name, and the per-slot note says "solid blocking, no
 * truss web" instead of printing 0 peaks at 0.0deg.
 *
 * ⚠ **The `gable sliver` finding is FIXED, 2026-11-14.** A gable tile under
 * about 4 1/2in of low edge drew its sloped top plate through its own bottom
 * plate, and under 1 1/2in its two skins through each other. His answer was
 * *"Let two plates become one board"*, and the sweep now runs from a low edge
 * of **0** — the triangular tile itself, which is what the 1.5in floor had
 * been hiding — in both orientations, at zero findings.
 * ──────────────────────────────────────────────────────────────────────────
 */
const SWEEP_FINDINGS: Record<string, string[]> = {
  /* ──────────────────────────────────────────────────────────────────────
     ⚠ **SWEPT ALONG THEIR LENGTH, 2026-11-16** — the families this file's
     own note had listed as unswept since 2026-11-14.

     **Four were clean from the first run**: the roof panel, the truss plate,
     the box beam, and the gable carrying BOTH of 2026-11-16's cuts at once.
     Their empty lists are the strongest statement here and are written out
     rather than omitted, so deleting one reads as a change.

     **The floor panel was not**, and the two findings were the same mistake
     the column blocking bug was: a bound that does not allow for what is
     actually in the way.

     1. The far end's lid is `SKIN + PLATE` = **2 1/4in**, and the station
        bound read only the 1 1/2in plate — so a girt was admitted 3/4in
        inside the sheet. And a station is not a point: the member standing
        on it has its own thickness, which nothing allowed for either. An
        anti-twist girt ran into the lid at **66.5-68.5in and every 60in
        after**; blocking at **42.5-46in and every 36in after**.
     2. Blocking's extent ALONG the span is `PLATE_2X4_WIDTH_IN` (3 1/2in),
        not its 1 1/2in thickness — it is built `horizontal` at 90deg. Reading
        the thickness left exactly 2in of the interference in place, which is
        how it was caught: the band narrowed rather than closing. The same
        misreading sat in `buildBlocking`'s own mitred per-side test.
     3. Fixing those two exposed a third they had been masking: B23's pair of
        structural girts at the FAR end. The datum allows for the pair at the
        START and nothing allowed for the one at the end. A station landing on
        a structural girt is now dropped — a structural girt IS blocking at
        that station, and carrying a wall besides.

     ⚠ **Why no fixed-size test ever met any of it**: the interference is
     periodic and about 2in wide, and the 300in span this file pins, the 192in
     and 96in runs the app lays out, and every template all fall in the clear.
     Exactly how 96in missed the column blocking bug in November.
     ────────────────────────────────────────────────────────────────────── */
  "floor panel by length": [],
  "roof panel by length": [],
  "floor panel mitred by length": [],
  "truss plate by length": [],
  "box beam by length": [],

  /* ──────────────────────────────────────────────────────────────────────
     ⚠ **THE 22½° PLAN MITRE, swept.** The gable carrying the mitre AND the
     compound bevel is clean at every height it builds — which is the case the
     16ft Octagon's diagonal facets actually are.

     The corner panel carries the four `girt bar x blocking` pairs the
     unmitred column, column-style and corner already carry: a BUILDING
     question recorded in `BASELINE`, the girt bar 1/4in into the blocking
     rows, and sweeping does not change the answer.

     ⚠ **ONE PAIR WAS NEW AND WAS THE MITRE'S DOING — `girt_N_bar_left x
     nailer`, and it is now FIXED rather than pinned.** Measured against the
     same panel built square: the mitre moves a full-depth girt bar inboard by
     the whole pull-back, and on a 24in core that put it **1.232in into the
     centre nailer**, on every row, at every height.

     The nailer yields and the girt does not — `nailerSlideClearOfGirtRowIn`
     has the reasoning and the measurements. It is held against the bar's
     inboard face, which is a butt joint a shop builds without a tape, leaves
     the two stud bays at 8½ in and 7½ in, and moves nothing on a square panel.

     ⚠ **It was NOT answered the way the gable answered the same collision.**
     A gable drops the whole girt row (`gableGirtRowFitsMitredSpan`), which is
     cheap on a 19 7/8in tile. Doing that here would have taken the girts out
     of all sixteen corner panels of an octagon — structure, to protect a
     nailing surface that is free to move and that Tommy had already said
     *should be able to slide on the wyth they are on*.
     ────────────────────────────────────────────────────────────────────── */
  /* ⚠ **EMPTY, and both empties are load-bearing.** At the 15½ in the app
     actually builds, a mitred corner panel has no girt row at all — so it
     cannot carry the four `girt bar x blocking` pairs the unmitred panels do,
     and the nailer has nothing to butt against and stays centred. Four pinned
     lines went away here when the row did. */
  "corner mitred": [],
  "corner mitred + nailer": [
    /* Pre-existing and unrelated to the mitre: the optional nailer inside the
       exterior blocking rows, the same board asked for twice — on the square
       panel too, and recorded in `BASELINE` as one of his open questions. */
    "nailer x blocking_N_exterior @ 32..144",
  ],
  /* The WIDE mitred corner panel is where the row DOES fit, so it keeps those
     four pre-existing `girt bar x blocking` pairs — a BUILDING question
     recorded in `BASELINE`, the bar 1/4in into the blocking rows, and the
     mitre does not change the answer. ⚠ `girt_N_bar_left x nailer` stood here
     too, at 1.232in, until the nailer was slid clear; its absence is the
     assertion. */
  "corner mitred wide + nailer": [
    "girt_N_bar_left x blocking_N_exterior @ 47.5..144",
    "girt_N_bar_left x blocking_N_interior @ 47.5..144",
    "girt_N_bar_right x blocking_N_exterior @ 47.5..144",
    "girt_N_bar_right x blocking_N_interior @ 47.5..144",
    /* Pre-existing: the optional nailer inside the blocking rows, on the
       square panel too. */
    "nailer x blocking_N_exterior @ 32..144",
  ],
  "gable mitred + bevelled": [],
  standard: [],
  "standard narrow": [],
  "safety gap": [],
  "jack stud": [],
  "braced hatch": [],
  "vertical gap filler": [],

  // Already pinned at 96in; confirmed height-independent.
  "standard + nailer": ["stud_centre_N_exterior x nailer @ 32..144"],
  column: [
    "girt_N_bar_left x blocking_N_exterior @ 47.5..144",
    "girt_N_bar_left x blocking_N_interior @ 47.5..144",
    "girt_N_bar_right x blocking_N_exterior @ 47.5..144",
    "girt_N_bar_right x blocking_N_interior @ 47.5..144",
  ],
  "column style": [
    "girt_N_bar_left x blocking_N_exterior @ 47.5..144",
    "girt_N_bar_left x blocking_N_interior @ 47.5..144",
    "girt_N_bar_right x blocking_N_exterior @ 47.5..144",
    "girt_N_bar_right x blocking_N_interior @ 47.5..144",
  ],
  corner: [
    "girt_N_bar_left x blocking_N_exterior @ 47.5..144",
    "girt_N_bar_left x blocking_N_interior @ 47.5..144",
    "girt_N_bar_right x blocking_N_exterior @ 47.5..144",
    "girt_N_bar_right x blocking_N_interior @ 47.5..144",
  ],
  /* ⚠ Emptied 2026-11-24 with the connector's bevelled ends, and emptied at
     EVERY height in the sweep — which matters, because the square-ended bite
     scaled with the brace's pitch and so was worst on the panels this sweep
     exists to catch. */
  "braced chevron": [],

  /* ⚠ **Finding 1 is FIXED**, in all three styles and both orientations: the
     single girt row drops to the sloped top plate's own underside instead of
     being flush with the short stud's butt corner. Tommy, 2026-11-14: *"It
     doesn't necessarily matter where girts are. As long as they are spaced
     every 3 ft or less they most certainly can be less to accommodate space
     for the top."* Four empty lists where there were two findings. */
  gable: [],
  "gable blocking": [],
  "gable ring": [],
  "gable right-low": [],
  /* ⚠ **A NEW finding, and it is NOT the girt.** Below about 4 1/2in of low
     edge a gable tile's sloped top plate is drawn through its own BOTTOM
     plate: the plate's plumb-cut low corner sits a skin plus a plate's
     vertical thickness under the edge height, which at a 2in edge is below
     the bottom of the panel. Reachable — a gable row ending at a shed's low
     corner hands this builder a legitimate near-zero edge, which is why the
     builder deliberately does not refuse one. Which gives way is his call:
     refuse a tile this short, or let the two plates become one board. */
  "gable sliver": [],
  "gable sliver right-low": [],

  /* ⚠ **Finding 3 is FIXED and finding 2 is now UNREACHABLE from the app.**
     Every `brace x brace`, `brace x end_stud` and `brace x jack_stud` entry
     these four lists carried is gone: a header with no room for a buildable
     web gets solid blocking instead of a fan of overlapping slivers
     (`planHeaderWeb` / `buildHeaderSolidBlocking`). Verified at every 1/4in
     from each builder's floor to 60in and at widths from 12in to 400in, not
     only at the 40in these cases build.

     ⚠ What is LEFT is the chord-through-chord pair at exactly the layer sum
     less 1/2in, and it is left deliberately. `computeHeaderHeightIn` now
     floors a derived header at `HEADER_MIN_HEIGHT_IN` and a Big Header's own
     range starts at 24in, so **nothing in the app can ask for these heights
     any more** — only a direct call like this sweep's. The builders are left
     able to express the degenerate case rather than throwing, because a
     header's height is derived inside a render and that is exactly how the
     gable-window crash took the viewport down on 2026-10-31. */
  "door header": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 4..4",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 4..4",
  ],
  "window header": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 4..4",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 4..4",
  ],
  /* The SAME degenerate pair the narrow case pins, and nothing else: at 8in
     the assembly is shorter than its own two plate stacks. A full-width plate
     passing over a jack stud produces no finding at any height, which is the
     thing this case was added to check. */
  "big header wide": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 8..8",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 8..8",
  ],
  "big header wide 2x4 jacks": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 8..8",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 8..8",
  ],
  "big header": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 8..8",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 8..8",
  ],
  "big header beam": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 4..4",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 4..4",
  ],
};

describe("⚠ no member occupies the same space as another, at ANY height", () => {
  for (const heightCase of HEIGHT_CASES) {
    it(`${heightCase.name} panel builds solid from ${heightCase.loIn}in to ${heightCase.hiIn}in`, () => {
      const pinned = SWEEP_FINDINGS[heightCase.name];
      expect(pinned, `${heightCase.name} has no pinned sweep record`).toBeDefined();
      expect({ panel: heightCase.name, findings: sweepFindings(heightCase) }).toEqual({
        panel: heightCase.name,
        findings: pinned,
      });
    });
  }

  it("every swept panel has a pinned record and vice versa", () => {
    expect(Object.keys(SWEEP_FINDINGS).sort()).toEqual(HEIGHT_CASES.map((c) => c.name).sort());
  });

  /* ⚠ The hang this sweep found, pinned at the exact heights that produced
     it, so a change to a chord's stock or a skin's thickness cannot reopen it
     silently. These assert TERMINATION as much as geometry: before the guard,
     each of these four calls ran until the heap died. */
  it("a header at the height where its web rise is exactly zero still builds", () => {
    expect(buildDoorHeaderMembers(40, D, 4.5).length).toBeGreaterThan(0);
    expect(buildWindowHeaderMembers(40, D, 4.5).length).toBeGreaterThan(0);
    expect(buildBigHeaderBeamMembers(120, D, 4.5).length).toBeGreaterThan(0);
    expect(buildBigHeaderMembers(40, D, 8.5, false, "plywood").length).toBeGreaterThan(0);
  });

  it("a header with no room for a web gets no web, rather than an infinite one", () => {
    const webCount = (members: PanelMember[]) => members.filter((m) => m.memberId.includes("truss_brace")).length;
    // At the singular height, and below it, where the rise goes negative.
    expect(webCount(buildDoorHeaderMembers(40, D, 4.5))).toBe(0);
    expect(webCount(buildDoorHeaderMembers(40, D, 3))).toBe(0);
    expect(webCount(buildDoorHeaderMembers(40, D, 0))).toBe(0);
    expect(webCount(buildBigHeaderMembers(40, D, 8.5, false, "plywood"))).toBe(0);
    // And a header of a real size still has one.
    expect(webCount(buildDoorHeaderMembers(40, D, 24))).toBeGreaterThan(0);
    expect(webCount(buildBigHeaderMembers(40, D, 24, false, "plywood"))).toBeGreaterThan(0);
  });
});
