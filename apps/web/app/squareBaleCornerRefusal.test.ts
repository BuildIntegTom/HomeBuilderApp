import { describe, expect, it } from "vitest";
import { fabricationMinPanelWidthIn, panelWidthInRange, squareBalePanel } from "@building-integrity/panel-catalog";
import { buildRectangleFootprint, insertBumpOut, tileWall } from "@building-integrity/geometry";
import {
  findSquareBaleBandWalls,
  findSquareBaleMergedCornerWalls,
  findSquareBaleMergedCorners,
  squareBaleCornerRefusal,
  squareBaleMergedCornerNote,
  squareBaleMergedCornerRefusal,
  squareBalePanelizationRefusalMessage,
  squareBaleRefusalWallFacts,
} from "./squareBaleCornerRefusal";
import type { RefusalWallFacts } from "./squareBaleCornerRefusal";

/** Plain inches, so the assertions read as the shop would say them. */
const format = (valueIn: number) => `${valueIn}in`;

const BALE_IN = squareBalePanel.widthIn;
const MIN_IN = fabricationMinPanelWidthIn.value;

const wall = (wallId: string, lengthIn: number, corners: [boolean, boolean] = [true, true]): RefusalWallFacts => ({
  wallId,
  lengthIn,
  hasCornerStart: corners[0],
  hasCornerEnd: corners[1],
});

describe("the catalog values this refusal is stated against", () => {
  it("is measured against the CONFIRMED bale width and fabrication minimum, not local copies", () => {
    // If either of these ever moves, the band moves with it and these tests
    // fail loudly rather than asserting a stale number.
    expect(BALE_IN).toBe(39);
    expect(squareBalePanel.status).toBe("confirmed");
    expect(MIN_IN).toBe(24);
    expect(fabricationMinPanelWidthIn.status).toBe("confirmed");
  });
});

describe("findSquareBaleBandWalls", () => {
  it("finds an 8ft wall — MIN_DIMENSION_FT, the shortest side the app will draw", () => {
    expect(findSquareBaleBandWalls([wall("AB", 96)], BALE_IN)).toEqual([{ wallId: "AB", wallLengthIn: 96, middleIn: 18 }]);
  });

  it("finds a 7ft wall, whose corners absorb would have widened to 42in each", () => {
    expect(findSquareBaleBandWalls([wall("AB", 84)], BALE_IN)).toEqual([{ wallId: "AB", wallLengthIn: 84, middleIn: 6 }]);
  });

  it("is silent at both edges of the moved band", () => {
    // 78in: two nominal bale corners with exactly nothing between them.
    expect(findSquareBaleBandWalls([wall("AB", 78)], BALE_IN)).toEqual([]);
    // ⚠ 102.5in, not 102in, since 2026-10-01: the middle must hold the run's own
    // safety gap AND a legal panel, so the first legal middle is 24½in.
    expect(findSquareBaleBandWalls([wall("AB", 102.5)], BALE_IN)).toEqual([]);
    expect(findSquareBaleBandWalls([wall("AB", 102)], BALE_IN)).toHaveLength(1);
    expect(findSquareBaleBandWalls([wall("AB", 101.875)], BALE_IN)).toHaveLength(1);
    expect(findSquareBaleBandWalls([wall("AB", 78.125)], BALE_IN)).toHaveLength(1);
  });

  it("is silent on a wall owning only one corner, which is a different defect", () => {
    expect(findSquareBaleBandWalls([wall("AB", 96, [true, false])], BALE_IN)).toEqual([]);
    expect(findSquareBaleBandWalls([wall("AB", 96, [false, false])], BALE_IN)).toEqual([]);
  });

  it("is silent on a wall too short for the bale pair at all — that is the merge case", () => {
    expect(findSquareBaleBandWalls([wall("AB", 60)], BALE_IN)).toEqual([]);
  });

  it("reports every offending wall, in wall order", () => {
    const found = findSquareBaleBandWalls([wall("AB", 96), wall("BC", 240), wall("CD", 84), wall("DA", 240)], BALE_IN);
    expect(found.map((w) => w.wallId)).toEqual(["AB", "CD"]);
  });

  it("finds nothing on an ordinary 20ft x 16ft rectangle, so Square Bale stays available", () => {
    expect(findSquareBaleBandWalls([wall("AB", 240), wall("BC", 192), wall("CD", 240), wall("DA", 192)], BALE_IN)).toEqual([]);
  });
});

describe("squareBaleCornerRefusal", () => {
  it("returns null when no wall is in the band", () => {
    expect(squareBaleCornerRefusal([], BALE_IN, MIN_IN, format)).toBeNull();
  });

  it("quotes the real numbers, names the wall, and says what was not changed", () => {
    const message = squareBaleCornerRefusal(
      findSquareBaleBandWalls([wall("AB", 96)], BALE_IN),
      BALE_IN,
      MIN_IN,
      format,
    )!;
    expect(message).toContain("39in");
    expect(message).toContain("Wall AB");
    expect(message).toContain("96in");
    expect(message).toContain("18in");
    expect(message).toContain("24in");
    expect(message).toContain("no legal Square Bale tiling");
    expect(message).toContain("NOT changed");
  });

  it("never suggests a width that would make it fit — the whole point is that it cannot", () => {
    const message = squareBaleCornerRefusal(
      findSquareBaleBandWalls([wall("AB", 84)], BALE_IN),
      BALE_IN,
      MIN_IN,
      format,
    )!;
    // 42in is the panel absorb would have invented. It must not appear as
    // advice, or as anything else.
    expect(message).not.toContain("42in");
    expect(message).toContain("cannot be built any other width");
  });

  it("counts the other affected walls, singular and plural", () => {
    const one = squareBaleCornerRefusal(
      findSquareBaleBandWalls([wall("AB", 96), wall("CD", 84)], BALE_IN),
      BALE_IN,
      MIN_IN,
      format,
    )!;
    expect(one).toContain("1 other wall on this building is the same.");
    const many = squareBaleCornerRefusal(
      findSquareBaleBandWalls([wall("AB", 96), wall("CD", 84), wall("EF", 90)], BALE_IN),
      BALE_IN,
      MIN_IN,
      format,
    )!;
    expect(many).toContain("2 other walls on this building are the same.");
  });

  it("says nothing about other walls when only one is affected", () => {
    const only = squareBaleCornerRefusal(findSquareBaleBandWalls([wall("AB", 96)], BALE_IN), BALE_IN, MIN_IN, format)!;
    expect(only).not.toContain("other wall");
  });
});

/**
 * **The thickness the facts are built at is load-bearing, and it was wrong.**
 * See `squareBaleRefusalWallFacts`' own doc comment: the refusal used to be
 * built from page.tsx's `wallGeometryFor`, which closes over the CURRENT
 * thickness (15.5in), while the button that runs it then sets Square Bale's own
 * 14in. A reflex corner adds `extraLengthIn = thicknessIn` to a wall's run, so
 * the two bases diverge by exactly 1.5in on any two-corner wall that owns one —
 * which is enough to move a wall in or out of the 78in-102.5in bale band.
 *
 * The fixture is a 6ft bump-out on the 30ft wall of a 30x20 rectangle, exactly
 * as measured: wall `01` is the segment of `AB` left of the bump-out, and it
 * owns an ordinary corner at one end and the bump-out's REFLEX corner at the
 * other.
 */
const BALE_THICKNESS_IN = squareBalePanel.thicknessIn;
const PROJECT_DEFAULT_THICKNESS_IN = 15.5;

/**
 * An inward NOTCH on the long wall of a 30x20 rectangle, `spanWidthIn` across
 * and `depthFt` deep. Wall "23" is the notch's inner face: both of its corners
 * are REFLEX, and it wins both of them (neither it nor its two jog-wall
 * neighbours has a primary endpoint, so the fallback picks the shorter — which
 * is "23" whenever the notch is deeper than it is wide). Winning a reflex corner
 * means being EXTENDED by one wall thickness there, so this wall's run is
 * `spanWidthIn + 2 x thicknessIn` — thickness-dependent twice over, which is
 * what these tests need.
 *
 * ⚠ **This fixture was an OUTWARD bump-out until 2026-10-01**, where wall "01"
 * owned a convex corner against the 20ft side and a reflex corner against the
 * jog. It cannot be that any more: the longer wall now runs through, so "01"
 * loses the convex corner to the 240in side and no longer owns both ends — and
 * a wall that does not own both ends is never in the bale band at all, which
 * would have left these three tests vacuously green. The notch reproduces the
 * same two runs to the eighth (78.125in / 75.125in and 103.5in / 100.5in), so
 * every number below is the number that was measured before the flip.
 */
function bumpOutFootprint(spanWidthIn: number, depthFt = 5) {
  const base = buildRectangleFootprint(30, 20);
  const basePrimary = new Set(base.corners.map((c) => c.id));
  const { footprint, primaryCornerIds } = insertBumpOut(
    base,
    "AB",
    10,
    10 + spanWidthIn / 12,
    -depthFt,
    basePrimary,
  );
  return { footprint, primaryCornerIds, leastAccessible: footprint.corners[0]!.id };
}

function bandWallsAt(spanWidthIn: number, thicknessIn: number, depthFt = 5) {
  const { footprint, primaryCornerIds, leastAccessible } = bumpOutFootprint(spanWidthIn, depthFt);
  return findSquareBaleBandWalls(
    squareBaleRefusalWallFacts(footprint, primaryCornerIds, leastAccessible, thicknessIn, {}),
    BALE_IN,
  );
}

function wallFacts(spanWidthIn: number, thicknessIn: number, wallId: string, depthFt = 5): RefusalWallFacts {
  const { footprint, primaryCornerIds, leastAccessible } = bumpOutFootprint(spanWidthIn, depthFt);
  return squareBaleRefusalWallFacts(footprint, primaryCornerIds, leastAccessible, thicknessIn, {}).find(
    (f) => f.wallId === wallId,
  )!;
}

describe("squareBaleRefusalWallFacts — the thickness Square Bale is about to be applied at", () => {
  it("uses Square Bale's own 14in thickness, which is NOT the project default", () => {
    // If these ever converge, every assertion below becomes vacuous.
    expect(BALE_THICKNESS_IN).toBe(14);
    expect(BALE_THICKNESS_IN).not.toBe(PROJECT_DEFAULT_THICKNESS_IN);
  });

  it("reflex corners make the run thickness-dependent — 3in of difference on wall 23", () => {
    // The mechanism, stated once so the two band tests below are not magic. TWO
    // reflex ends now, so the difference is twice the thickness delta rather than
    // once — see bumpOutFootprint for why the fixture moved.
    const at155 = wallFacts(47.125, PROJECT_DEFAULT_THICKNESS_IN, "23");
    const at14 = wallFacts(47.125, BALE_THICKNESS_IN, "23");
    expect(at155.hasCornerStart && at155.hasCornerEnd).toBe(true);
    expect(at14.hasCornerStart && at14.hasCornerEnd).toBe(true);
    expect(at155.lengthIn).toBe(78.125);
    expect(at14.lengthIn).toBe(75.125);
    expect(at155.lengthIn - at14.lengthIn).toBe(2 * (PROJECT_DEFAULT_THICKNESS_IN - BALE_THICKNESS_IN));
  });

  it("THE MEASURED FALSE REFUSAL: 78.125in at 15.5in is in the band, 76.625in at 14in is not", () => {
    // The old glue refused Square Bale by name here, quoting a 78.125in run and
    // a 0.125in middle for a building that is not in the band at all under
    // Square Bale's own thickness.
    expect(bandWallsAt(47.125, PROJECT_DEFAULT_THICKNESS_IN)).toEqual([
      { wallId: "23", wallLengthIn: 78.125, middleIn: 0.125 },
    ]);
    // Built at the thickness the button is about to set: nothing to refuse.
    expect(bandWallsAt(47.125, BALE_THICKNESS_IN)).toEqual([]);
  });

  it("THE MIRROR CASE: out of band at 15.5in, in band at 14in — the refusal used to miss it", () => {
    // Not a shop-safety hole (cornerMayWiden: false still applies and the
    // sub-minimum middle still reports) but the refuse posture was incomplete.
    expect(bandWallsAt(72.5, PROJECT_DEFAULT_THICKNESS_IN, 8)).toEqual([]);
    expect(bandWallsAt(72.5, BALE_THICKNESS_IN, 8)).toEqual([
      { wallId: "23", wallLengthIn: 100.5, middleIn: 22.5 },
    ]);
  });

  it("the refusal SENTENCE follows the fixed basis, so it can never quote a length the building will not have", () => {
    const refused = squareBaleCornerRefusal(bandWallsAt(72.5, BALE_THICKNESS_IN, 8), BALE_IN, MIN_IN, format)!;
    expect(refused).toContain("100.5in");
    expect(refused).not.toContain("103.5in");
    expect(squareBaleCornerRefusal(bandWallsAt(47.125, BALE_THICKNESS_IN), BALE_IN, MIN_IN, format)).toBeNull();
  });

  it("returns one fact per wall of the footprint, in wall order", () => {
    const { footprint, primaryCornerIds, leastAccessible } = bumpOutFootprint(47.125);
    const facts = squareBaleRefusalWallFacts(footprint, primaryCornerIds, leastAccessible, BALE_THICKNESS_IN, {});
    expect(facts.map((f) => f.wallId)).toEqual(footprint.walls.map((w) => w.id));
  });
});

/**
 * **Case A — the MERGED bale corner.** Tommy, 2026-09-26, asked whether
 * *"No — refuse instead"* extends from the widened bale corner to the merged
 * one: **"Yes — refuse both cases too."**
 */
const MAX_IN = panelWidthInRange.maxIn;

describe("findSquareBaleMergedCornerWalls", () => {
  it("is measured against the CONFIRMED 48in ceiling, not a local copy", () => {
    expect(MAX_IN).toBe(48);
    expect(panelWidthInRange.status).toBe("confirmed");
  });

  it("finds a two-corner wall under 78in whose merged slot is OVER 48in, and reports the whole wall as the merged width", () => {
    expect(findSquareBaleMergedCornerWalls([wall("AB", 72)], BALE_IN, MAX_IN)).toEqual([
      { wallId: "AB", wallLengthIn: 72, mergedWidthIn: 72 },
    ]);
    // The widest a merged bale corner can be: one eighth under two nominal.
    expect(findSquareBaleMergedCornerWalls([wall("AB", 77.875)], BALE_IN, MAX_IN)).toEqual([
      { wallId: "AB", wallLengthIn: 77.875, mergedWidthIn: 77.875 },
    ]);
  });

  it("⚠ does NOT refuse a merged corner at or under 48in — Tommy narrowed this to 'only refuse over 48 inches'", () => {
    // 44.75in is a 9ft octagon's side. It is inside the confirmed 48in ceiling
    // and it is STILL not a 39in whole-bale unit, so the broad reading refused
    // it; Tommy was asked directly, was told the broad reading was the
    // technically safer one, and chose the narrow one. It is now PERMITTED
    // here — and still REPORTED, which the walk below asserts.
    expect(findSquareBaleMergedCornerWalls([wall("AB", 44.75)], BALE_IN, MAX_IN)).toEqual([]);
    // Exactly at the ceiling is permitted too: the condition is strictly ">".
    expect(findSquareBaleMergedCornerWalls([wall("AB", MAX_IN)], BALE_IN, MAX_IN)).toEqual([]);
    // One eighth over it is refused, so the line is where the catalog puts it.
    expect(findSquareBaleMergedCornerWalls([wall("AB", MAX_IN + 0.125)], BALE_IN, MAX_IN)).toEqual([
      { wallId: "AB", wallLengthIn: MAX_IN + 0.125, mergedWidthIn: MAX_IN + 0.125 },
    ]);
  });

  it("⚠ the narrowing tracks the CATALOG ceiling, not a copy of 48 written here", () => {
    // If panelWidthInRange.maxIn ever moves, the refusal's boundary moves with
    // it rather than going stale. Asserted by handing the detector a different
    // ceiling and watching the same wall change sides.
    expect(findSquareBaleMergedCornerWalls([wall("AB", 60)], BALE_IN, 48)).toHaveLength(1);
    expect(findSquareBaleMergedCornerWalls([wall("AB", 60)], BALE_IN, 72)).toHaveLength(0);
  });

  it("the octagon sizes Tommy's narrowing newly PERMITS, and the first one it still refuses", () => {
    // Measured on this branch at Square Bale's confirmed 39in corner and its own
    // confirmed 14in thickness. Every wall of every octagon from 8ft to 15.625ft
    // across is one merged bale corner; the merged width first passes 48in at
    // 9.640625ft across. These are the runs those sizes produce.
    for (const permittedRunIn of [39.75 /* 8ft */, 44.75 /* 9ft */, 47.875 /* ~9.625ft */]) {
      expect(findSquareBaleMergedCornerWalls([wall("AB", permittedRunIn)], BALE_IN, MAX_IN)).toEqual([]);
    }
    for (const refusedRunIn of [48.125 /* ~9.65625ft */, 59.75 /* 12ft */, 77 /* 15.5ft */]) {
      expect(findSquareBaleMergedCornerWalls([wall("AB", refusedRunIn)], BALE_IN, MAX_IN)).toHaveLength(1);
    }
  });

  it("is silent at 78in and above — that is the band's territory, not the merge's", () => {
    expect(findSquareBaleMergedCornerWalls([wall("AB", 78)], BALE_IN, MAX_IN)).toEqual([]);
    expect(findSquareBaleMergedCornerWalls([wall("AB", 96)], BALE_IN, MAX_IN)).toEqual([]);
    expect(findSquareBaleMergedCornerWalls([wall("AB", 240)], BALE_IN, MAX_IN)).toEqual([]);
  });

  it("is silent on a wall that does not own both corners", () => {
    expect(findSquareBaleMergedCornerWalls([wall("AB", 72, [true, false])], BALE_IN, MAX_IN)).toEqual([]);
    expect(findSquareBaleMergedCornerWalls([wall("AB", 72, [false, false])], BALE_IN, MAX_IN)).toEqual([]);
  });

  it("the two detectors partition the problem — no wall is ever in both", () => {
    for (let eighths = 8; eighths <= 8 * 120; eighths += 1) {
      const lengthIn = eighths / 8;
      const inBand = findSquareBaleBandWalls([wall("AB", lengthIn)], BALE_IN).length;
      const merged = findSquareBaleMergedCornerWalls([wall("AB", lengthIn)], BALE_IN, MAX_IN).length;
      expect(inBand + merged).toBeLessThanOrEqual(1);
    }
  });
});

describe("squareBaleMergedCornerRefusal", () => {
  it("returns null when nothing merges", () => {
    expect(squareBaleMergedCornerRefusal([], BALE_IN, MAX_IN, format)).toBeNull();
  });

  it("quotes the run, the 78in the pair needs, the merged width, and what was not changed", () => {
    const message = squareBaleMergedCornerRefusal(
      findSquareBaleMergedCornerWalls([wall("12", 72)], BALE_IN, MAX_IN),
      BALE_IN,
      MAX_IN,
      format,
    )!;
    expect(message).toContain("39in");
    expect(message).toContain("Wall 12");
    expect(message).toContain("72in");
    expect(message).toContain("78in");
    expect(message).toContain("not a whole-bale unit");
    expect(message).toContain("24in over the 48in maximum panel width");
    expect(message).toContain("NOT changed");
  });

  it("omits the over-the-ceiling clause when the merged panel does not breach it", () => {
    // ⚠ The wall is handed to the SENTENCE directly, because since Tommy's
    // narrowing (`findSquareBaleMergedCornerWalls` skips anything at or under
    // 48in) the detector can no longer produce a non-breaching wall, so going
    // through it would return null and assert nothing. The condition stays in
    // the sentence deliberately: this function must not assert a breach it was
    // not given, and it is what keeps the message honest if the detector is ever
    // widened back to the broad reading.
    const legalWidth = squareBaleMergedCornerRefusal(
      [{ wallId: "AB", wallLengthIn: 44.75, mergedWidthIn: 44.75 }],
      BALE_IN,
      MAX_IN,
      format,
    )!;
    // A refusal that quotes a limit the wall does not breach is not trusted.
    expect(legalWidth).not.toContain("maximum panel width");
    expect(legalWidth).toContain("not a whole-bale unit");
    // And the detector really does refuse to produce it, which is the decision.
    expect(findSquareBaleMergedCornerWalls([wall("AB", 44.75)], BALE_IN, MAX_IN)).toEqual([]);
  });

  it("counts the other affected walls — a small octagon is eight of them", () => {
    const octagon = Array.from({ length: 8 }, (_, i) => wall(`${i}${(i + 1) % 8}`, 59.75));
    const message = squareBaleMergedCornerRefusal(
      findSquareBaleMergedCornerWalls(octagon, BALE_IN, MAX_IN),
      BALE_IN,
      MAX_IN,
      format,
    )!;
    expect(message).toContain("7 other walls on this building are the same.");
  });
});

describe("squareBalePanelizationRefusalMessage — one entry point, both cases", () => {
  it("is null only when the building is legal in BOTH cases", () => {
    const legal = [wall("AB", 240), wall("BC", 192), wall("CD", 240), wall("DA", 192)];
    expect(
      squareBalePanelizationRefusalMessage(
        findSquareBaleBandWalls(legal, BALE_IN),
        findSquareBaleMergedCornerWalls(legal, BALE_IN, MAX_IN),
        BALE_IN,
        MIN_IN,
        MAX_IN,
        format,
      ),
    ).toBeNull();
  });

  it("refuses a band-only building with the band sentence", () => {
    const walls = [wall("AB", 96)];
    const message = squareBalePanelizationRefusalMessage(
      findSquareBaleBandWalls(walls, BALE_IN),
      findSquareBaleMergedCornerWalls(walls, BALE_IN, MAX_IN),
      BALE_IN,
      MIN_IN,
      MAX_IN,
      format,
    )!;
    expect(message).toContain("no legal Square Bale tiling");
    expect(message).not.toContain("merged into ONE corner panel");
  });

  it("refuses a merge-only building with the merge sentence", () => {
    const walls = [wall("AB", 72)];
    const message = squareBalePanelizationRefusalMessage(
      findSquareBaleBandWalls(walls, BALE_IN),
      findSquareBaleMergedCornerWalls(walls, BALE_IN, MAX_IN),
      BALE_IN,
      MIN_IN,
      MAX_IN,
      format,
    )!;
    expect(message).toContain("merged into ONE corner panel");
    expect(message).not.toContain("no legal Square Bale tiling");
  });

  it("says BOTH when a building has one of each, merged first", () => {
    const walls = [wall("AB", 96), wall("12", 72)];
    const message = squareBalePanelizationRefusalMessage(
      findSquareBaleBandWalls(walls, BALE_IN),
      findSquareBaleMergedCornerWalls(walls, BALE_IN, MAX_IN),
      BALE_IN,
      MIN_IN,
      MAX_IN,
      format,
    )!;
    expect(message).toContain("merged into ONE corner panel");
    expect(message).toContain("no legal Square Bale tiling");
    expect(message.indexOf("merged into ONE corner panel")).toBeLessThan(message.indexOf("no legal Square Bale tiling"));
    // Each names its OWN wall rather than one of them winning.
    expect(message).toContain("Wall 12");
    expect(message).toContain("Wall AB");
  });
});

describe("findSquareBaleMergedCorners — the Review Log walk over STORED slots", () => {
  const corner = (widthIn: number, type: "corner" | "safety-oct-corner" = "corner") => ({ type, widthIn }) as const;

  it("finds the merged shape: exactly one corner slot off the nominal bale width", () => {
    expect(findSquareBaleMergedCorners({ AB: [corner(72)] }, BALE_IN)).toEqual([{ wallId: "AB", mergedWidthIn: 72 }]);
    // A mitered octagon renames the type and changes nothing else.
    expect(findSquareBaleMergedCorners({ "01": [corner(52.25, "safety-oct-corner")] }, BALE_IN)).toEqual([
      { wallId: "01", mergedWidthIn: 52.25 },
    ]);
    // Under the ceiling and still reported — same reasoning as the refusal.
    expect(findSquareBaleMergedCorners({ AB: [corner(44.75)] }, BALE_IN)).toEqual([
      { wallId: "AB", mergedWidthIn: 44.75 },
    ]);
  });

  it("does NOT report a single slot that is exactly a whole-bale unit — that one is buildable", () => {
    expect(findSquareBaleMergedCorners({ AB: [corner(BALE_IN)] }, BALE_IN)).toEqual([]);
  });

  it("does NOT report an ordinary tiled wall, an opening, or an empty wall", () => {
    expect(
      findSquareBaleMergedCorners(
        {
          AB: [corner(39), { type: "standard", widthIn: 39 }, corner(39)],
          BC: [{ type: "window", widthIn: 30 }],
          CD: [],
        },
        BALE_IN,
      ),
    ).toEqual([]);
  });

  it("tolerates an empty map without inventing a wall", () => {
    expect(findSquareBaleMergedCorners({}, BALE_IN)).toEqual([]);
  });

  it("⚠ STAYS WIDE where the refusal was narrowed — this is what makes the permitted case 'reported'", () => {
    // Tommy narrowed the REFUSAL to merged corners over 48in only. This walk is
    // deliberately NOT narrowed with it: a merged bale corner inside the ceiling
    // is still not a whole-bale unit, so it is permitted AND reported rather
    // than permitted. Narrowing this too would turn a decision about refusing
    // into a decision about telling anyone, which he was not asked.
    const permittedRunIn = 44.75; // a 9ft octagon's side
    expect(findSquareBaleMergedCornerWalls([wall("AB", permittedRunIn)], BALE_IN, MAX_IN)).toEqual([]);
    expect(findSquareBaleMergedCorners({ AB: [corner(permittedRunIn)] }, BALE_IN)).toEqual([
      { wallId: "AB", mergedWidthIn: permittedRunIn },
    ]);
    // The 8ft octagon the rectangle tool's own MIN_DIMENSION_FT allows, too.
    expect(findSquareBaleMergedCorners({ AB: [corner(39.75)] }, BALE_IN)).toEqual([{ wallId: "AB", mergedWidthIn: 39.75 }]);
  });

  it("⚠ ALSO matches a ONE-corner wall whose corner was CLAMPED, which is not a merge — measured through the real tiler", () => {
    // The walk keys on the single-slot signature and cannot tell two branches of
    // `resolveCorners` apart. The second is the final CLAMP branch — a wall
    // owning ONE corner and shorter than a single nominal corner, where
    // Math.min(cornerEighths, wallEighths) sizes that corner down to the wall
    // and the middle comes out zero. Nothing is merged on such a wall.
    //
    // This is a CLAIM bug, not a silence: the part is not a whole-bale unit in
    // either shape, so the entry belongs. The note and the label are worded for
    // both, and the doc comment's old "cannot false-positive" paragraph is gone.
    const oneCornerSingleSlot: number[] = [];
    for (let eighths = 1; eighths <= 8 * BALE_IN; eighths += 1) {
      const lengthIn = eighths / 8;
      const { slots } = tileWall(lengthIn, 40, BALE_IN, "end", true, false, true, false);
      if (findSquareBaleMergedCorners({ AB: slots }, BALE_IN).length > 0) oneCornerSingleSlot.push(lengthIn);
    }
    // 311 lengths: every eighth from 0.125in to 38.875in. 39in itself is
    // excluded by the equality check, correctly — a 39in slot IS a bale unit.
    expect(oneCornerSingleSlot).toHaveLength(311);
    expect(oneCornerSingleSlot[0]).toBe(0.125);
    expect(oneCornerSingleSlot[oneCornerSingleSlot.length - 1]).toBe(38.875);
    expect(tileWall(39, 40, BALE_IN, "end", true, false, true, false).slots).toEqual([{ type: "corner", widthIn: 39 }]);

    // It is an EDGE CASE rather than routine: a bump-out return runs 60in at
    // every depth from 1.5ft to 4ft and tiles to THREE slots (corner, the run's
    // own narrow safety gap, and the remainder — it was two before the two-tier
    // gap of 2026-10-01), so it is not matched.
    const returnWall = tileWall(60, 40, BALE_IN, "end", true, false, true, false);
    expect(returnWall.slots).toHaveLength(3);
    expect(findSquareBaleMergedCorners({ AB: returnWall.slots }, BALE_IN)).toEqual([]);
  });
});

describe("squareBaleMergedCornerNote", () => {
  it("says what the part is, what it is not, and that nothing was rewritten", () => {
    const note = squareBaleMergedCornerNote({ wallId: "01", mergedWidthIn: 52.25 }, BALE_IN, MAX_IN, format);
    expect(note).toContain("78in");
    expect(note).toContain("52.25in");
    expect(note).toContain("bales do not stretch");
    expect(note).toContain("not a part the shop can build as drawn");
    expect(note).toContain("4.25in over the 48in maximum panel width");
    expect(note).toContain("Nothing was rewritten");
  });

  it("⚠ does NOT assert that two corners were merged — it is true of the CLAMPED one-corner wall too", () => {
    // The note used to open "This wall is shorter than the 78in two 39in bale
    // corners need side by side, so its two corners are merged into ONE corner
    // panel", which is FALSE on a wall that owns one corner and had it clamped
    // down to the wall: it owns one corner and nothing was merged. The walk
    // cannot distinguish the two shapes, so the note must be true of both.
    const note = squareBaleMergedCornerNote({ wallId: "AB", mergedWidthIn: 20 }, BALE_IN, MAX_IN, format);
    expect(note).not.toContain("its two corners are merged");
    // It describes the part, and names the two-corner merge as the USUAL cause.
    expect(note).toContain("only panel is a single corner slot");
    expect(note).toContain("The usual cause");
    // ...and names the one-corner shape explicitly, so neither reading is a lie.
    expect(note).toContain("owning a corner at ONE end");
    // The substance is unchanged and still true in both shapes.
    expect(note).toContain("bales do not stretch");
    expect(note).toContain("not a part the shop can build as drawn");
  });

  it("⚠ names Tommy's narrowing rather than promising a refusal that no longer fires", () => {
    // A 44.75in merged bale corner is permitted now. The note must not tell the
    // reader that choosing Square Bale on this building "is refused outright",
    // because it is not.
    const note = squareBaleMergedCornerNote({ wallId: "AB", mergedWidthIn: 44.75 }, BALE_IN, MAX_IN, format);
    expect(note).toContain("only refuse over 48 inches");
    expect(note).toContain("over the 48in maximum is refused outright");
    expect(note).not.toContain("on a building like this is refused outright");
  });

  it("invents no width and quotes no ceiling it does not breach", () => {
    const note = squareBaleMergedCornerNote({ wallId: "AB", mergedWidthIn: 44.75 }, BALE_IN, MAX_IN, format);
    expect(note).not.toContain("maximum panel width");
    expect(note).toContain("44.75in");
    // The note must never suggest a width that would fit.
    expect(note).not.toContain("39in wide");
  });
});
