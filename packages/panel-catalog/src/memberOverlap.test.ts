import { describe, expect, it } from "vitest";
import type { PanelMember } from "./componentSchema";
import { overlappingMemberPairs } from "./memberPrism";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { buildBracedPanelMembers } from "./bracedPanelMembers";
import { buildCrossTiltPanelMembers, crossTiltMinimumLowHeightIn } from "./crossTiltPanelMembers";
import { buildColumnPanelMembers, buildColumnStyleMembers } from "./columnPanelMembers";
import { buildCornerPanelMembers } from "./cornerPanelMembers";
import { buildSafetyGapMembers } from "./safetyGapMembers";
import { buildGablePanelMembers } from "./gablePanelMembers";
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

     The chevron's remaining two are its legs clipping `brace_center_connector`,
     the vertical post the two legs meet at mid-panel — the same shape of
     problem as a diagonal crossing a centre nailer stud, and it wants the
     same answer. */
  "braced chevron": 2,
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
  /* ⚠ The headers start BELOW their own layer sum on purpose — that is
     where the singularity and the chord-through-chord case live. */
  { name: "door header", at: (h) => buildDoorHeaderMembers(40, D, h), loIn: 4, hiIn: 48, anchorIn: 24 },
  { name: "window header", at: (h) => buildWindowHeaderMembers(40, D, h), loIn: 4, hiIn: 48, anchorIn: 24 },
  { name: "big header", at: (h) => buildBigHeaderMembers(40, D, h, false, "plywood"), loIn: 8, hiIn: 48, anchorIn: 24 },
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
 * ⚠ FOUR findings here are NEW — invisible at 96in — and none is fixed in
 * this commit, because each is two of Tommy's own numbers in conflict, and
 * choosing which gives way is his call. That is the rule `BASELINE` is
 * already written under.
 *
 * **1. A gable with a 32–36.5in low edge** runs its sloped top plate through
 * the first girt bar, in both wythes. A 5in band, and the only one of the
 * four that is not a header.
 *
 * **2. A header shallower than its own layers** draws its two chords through
 * each other: at 4in for a door/window header (its layers come to 4.5in) and
 * at 8in for a Big Header (8.5in, its chords being rotated to 3.5in). The
 * assembly is thinner than the parts it is made of. The precedent for exactly
 * this is the cross-tilted panel, which **refuses** rather than building
 * something that interferes with itself — but a header's height is DERIVED
 * from the wall and the opening, so a refusal here throws inside a render,
 * which is how the gable-window crash took the viewport down on 2026-10-31.
 * It wants a Review Log entry, not an exception.
 *
 * **3. The shallow-web band**, which is the one to read twice: door/window
 * 6–10in, Big Header 10–14in, Mid-Wall Beam 6–9in. The braces collide with
 * each other, with the end studs, and in the Big Header with its own jack
 * studs. Each band begins exactly at `layer sum + 1 1/2in` — the moment the
 * new guard in `computeTrussWebPeakCount` permits a web at all — and runs
 * about 4in up. So that guard's threshold (a gap at least as thick as the
 * brace board) stops the hang but still admits a web too dense to build:
 * `TRUSS_WEB_MIN_ANGLE_DEG = 30` and a 1 1/2in brace cannot both be honoured
 * until the rise reaches about 5 1/2in. Relaxing the angle, refusing the
 * header, or giving a short header solid blocking instead of a web are all
 * his calls.
 *
 * **4. Nothing reports any of it.** A header that quietly has no web, or one
 * whose braces interfere, reaches the shop drawing looking finished.
 * ──────────────────────────────────────────────────────────────────────────
 */
const SWEEP_FINDINGS: Record<string, string[]> = {
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
  "braced chevron": [
    "diagonal_brace_lower_ext x brace_center_connector @ 32..144",
    "diagonal_brace_upper_ext x brace_center_connector @ 32..144",
  ],

  // ⚠ Finding 1 — the sloped top plate into the first girt bar.
  gable: ["top_plate_2x4_ext x girt_N_bar_left @ 32..36.5", "top_plate_2x4_int x girt_N_bar_left @ 32..36.5"],

  // ⚠ Findings 2 and 3.
  "door header": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 4..4",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 4..4",
    "left_end_stud_ext x truss_brace_ext_N_fall @ 6..7",
    "left_end_stud_ext x truss_brace_ext_N_rise @ 6..10",
    "left_end_stud_int x truss_brace_int_N_fall @ 6..7",
    "left_end_stud_int x truss_brace_int_N_rise @ 6..10",
    "right_end_stud_ext x truss_brace_ext_N_fall @ 6..10",
    "right_end_stud_ext x truss_brace_ext_N_rise @ 6..7",
    "right_end_stud_int x truss_brace_int_N_fall @ 6..10",
    "right_end_stud_int x truss_brace_int_N_rise @ 6..7",
    "truss_brace_ext_N_fall x truss_brace_ext_N_fall @ 6..7",
    "truss_brace_ext_N_fall x truss_brace_ext_N_rise @ 6..8.5",
    "truss_brace_ext_N_rise x truss_brace_ext_N_fall @ 6..9",
    "truss_brace_ext_N_rise x truss_brace_ext_N_rise @ 6..7",
    "truss_brace_int_N_fall x truss_brace_int_N_fall @ 6..7",
    "truss_brace_int_N_fall x truss_brace_int_N_rise @ 6..8.5",
    "truss_brace_int_N_rise x truss_brace_int_N_fall @ 6..9",
    "truss_brace_int_N_rise x truss_brace_int_N_rise @ 6..7",
  ],
  "window header": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 4..4",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 4..4",
    "left_end_stud_ext x truss_brace_ext_N_fall @ 6..7",
    "left_end_stud_ext x truss_brace_ext_N_rise @ 6..10",
    "left_end_stud_int x truss_brace_int_N_fall @ 6..7",
    "left_end_stud_int x truss_brace_int_N_rise @ 6..10",
    "right_end_stud_ext x truss_brace_ext_N_fall @ 6..10",
    "right_end_stud_ext x truss_brace_ext_N_rise @ 6..7",
    "right_end_stud_int x truss_brace_int_N_fall @ 6..10",
    "right_end_stud_int x truss_brace_int_N_rise @ 6..7",
    "truss_brace_ext_N_fall x truss_brace_ext_N_fall @ 6..7",
    "truss_brace_ext_N_fall x truss_brace_ext_N_rise @ 6..8.5",
    "truss_brace_ext_N_rise x truss_brace_ext_N_fall @ 6..9",
    "truss_brace_ext_N_rise x truss_brace_ext_N_rise @ 6..7",
    "truss_brace_int_N_fall x truss_brace_int_N_fall @ 6..7",
    "truss_brace_int_N_fall x truss_brace_int_N_rise @ 6..8.5",
    "truss_brace_int_N_rise x truss_brace_int_N_fall @ 6..9",
    "truss_brace_int_N_rise x truss_brace_int_N_rise @ 6..7",
  ],
  /* ⚠ The only one whose web also reaches the JACK STUDS, because a Big
     Header carries its own pair inside its own width. */
  "big header": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 8..8",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 8..8",
    "left_end_stud_ext x truss_brace_ext_N_fall @ 10..11",
    "left_end_stud_ext x truss_brace_ext_N_rise @ 10..14",
    "left_end_stud_int x truss_brace_int_N_fall @ 10..11",
    "left_end_stud_int x truss_brace_int_N_rise @ 10..14",
    "right_end_stud_ext x truss_brace_ext_N_fall @ 10..14",
    "right_end_stud_ext x truss_brace_ext_N_rise @ 10..11",
    "right_end_stud_int x truss_brace_int_N_fall @ 10..14",
    "right_end_stud_int x truss_brace_int_N_rise @ 10..11",
    "truss_brace_ext_N_fall x jack_left_jack_stud_sheet @ 10..10.5",
    "truss_brace_ext_N_fall x jack_right_jack_stud_sheet @ 10..13",
    "truss_brace_ext_N_fall x truss_brace_ext_N_fall @ 10..11",
    "truss_brace_ext_N_fall x truss_brace_ext_N_rise @ 10..12.5",
    "truss_brace_ext_N_rise x jack_left_jack_stud_sheet @ 10..13",
    "truss_brace_ext_N_rise x jack_right_jack_stud_sheet @ 10..10.5",
    "truss_brace_ext_N_rise x truss_brace_ext_N_fall @ 10..13.5",
    "truss_brace_ext_N_rise x truss_brace_ext_N_rise @ 10..11",
    "truss_brace_int_N_fall x jack_left_jack_stud_sheet @ 10..10.5",
    "truss_brace_int_N_fall x jack_right_jack_stud_sheet @ 10..13",
    "truss_brace_int_N_fall x truss_brace_int_N_fall @ 10..11",
    "truss_brace_int_N_fall x truss_brace_int_N_rise @ 10..12.5",
    "truss_brace_int_N_rise x jack_left_jack_stud_sheet @ 10..13",
    "truss_brace_int_N_rise x jack_right_jack_stud_sheet @ 10..10.5",
    "truss_brace_int_N_rise x truss_brace_int_N_fall @ 10..13.5",
    "truss_brace_int_N_rise x truss_brace_int_N_rise @ 10..11",
  ],
  "big header beam": [
    "bottom_chord_2x4_ext x top_chord_2x4_ext @ 4..4",
    "bottom_chord_2x4_int x top_chord_2x4_int @ 4..4",
    "left_end_stud_ext x truss_brace_ext_N_fall @ 6..6.5",
    "left_end_stud_ext x truss_brace_ext_N_rise @ 6..9",
    "left_end_stud_int x truss_brace_int_N_fall @ 6..6.5",
    "left_end_stud_int x truss_brace_int_N_rise @ 6..9",
    "right_end_stud_ext x truss_brace_ext_N_fall @ 6..9",
    "right_end_stud_ext x truss_brace_ext_N_rise @ 6..6.5",
    "right_end_stud_int x truss_brace_int_N_fall @ 6..9",
    "right_end_stud_int x truss_brace_int_N_rise @ 6..6.5",
    "truss_brace_ext_N_fall x truss_brace_ext_N_fall @ 6..6.5",
    "truss_brace_ext_N_fall x truss_brace_ext_N_rise @ 6..8.5",
    "truss_brace_ext_N_rise x truss_brace_ext_N_fall @ 6..9",
    "truss_brace_ext_N_rise x truss_brace_ext_N_rise @ 6..6.5",
    "truss_brace_int_N_fall x truss_brace_int_N_fall @ 6..6.5",
    "truss_brace_int_N_fall x truss_brace_int_N_rise @ 6..8.5",
    "truss_brace_int_N_rise x truss_brace_int_N_fall @ 6..9",
    "truss_brace_int_N_rise x truss_brace_int_N_rise @ 6..6.5",
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
