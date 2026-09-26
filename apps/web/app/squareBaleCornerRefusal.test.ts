import { describe, expect, it } from "vitest";
import { fabricationMinPanelWidthIn, panelWidthInRange, squareBalePanel } from "@building-integrity/panel-catalog";
import { buildRectangleFootprint, insertBumpOut } from "@building-integrity/geometry";
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
    // 102in: the first legal middle, exactly the 24in floor.
    expect(findSquareBaleBandWalls([wall("AB", 102)], BALE_IN)).toEqual([]);
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
 * which is enough to move a wall in or out of the 78in-102in bale band.
 *
 * The fixture is a 6ft bump-out on the 30ft wall of a 30x20 rectangle, exactly
 * as measured: wall `01` is the segment of `AB` left of the bump-out, and it
 * owns an ordinary corner at one end and the bump-out's REFLEX corner at the
 * other.
 */
const BALE_THICKNESS_IN = squareBalePanel.thicknessIn;
const PROJECT_DEFAULT_THICKNESS_IN = 15.5;

function bumpOutFootprint(spanStartIn: number) {
  const base = buildRectangleFootprint(30, 20);
  const basePrimary = new Set(base.corners.map((c) => c.id));
  const { footprint, primaryCornerIds } = insertBumpOut(
    base,
    "AB",
    spanStartIn / 12,
    spanStartIn / 12 + 6,
    5,
    basePrimary,
  );
  return { footprint, primaryCornerIds, leastAccessible: footprint.corners[0]!.id };
}

function bandWallsAt(spanStartIn: number, thicknessIn: number) {
  const { footprint, primaryCornerIds, leastAccessible } = bumpOutFootprint(spanStartIn);
  return findSquareBaleBandWalls(
    squareBaleRefusalWallFacts(footprint, primaryCornerIds, leastAccessible, thicknessIn, {}),
    BALE_IN,
  );
}

function wallFacts(spanStartIn: number, thicknessIn: number, wallId: string): RefusalWallFacts {
  const { footprint, primaryCornerIds, leastAccessible } = bumpOutFootprint(spanStartIn);
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

  it("a reflex corner makes the run thickness-dependent — 1.5in of difference on wall 01", () => {
    // The mechanism, stated once so the two band tests below are not magic.
    const at155 = wallFacts(62.625, PROJECT_DEFAULT_THICKNESS_IN, "01");
    const at14 = wallFacts(62.625, BALE_THICKNESS_IN, "01");
    expect(at155.hasCornerStart && at155.hasCornerEnd).toBe(true);
    expect(at14.hasCornerStart && at14.hasCornerEnd).toBe(true);
    expect(at155.lengthIn).toBe(78.125);
    expect(at14.lengthIn).toBe(76.625);
    expect(at155.lengthIn - at14.lengthIn).toBe(PROJECT_DEFAULT_THICKNESS_IN - BALE_THICKNESS_IN);
  });

  it("THE MEASURED FALSE REFUSAL: 78.125in at 15.5in is in the band, 76.625in at 14in is not", () => {
    // The old glue refused Square Bale by name here, quoting a 78.125in run and
    // a 0.125in middle for a building that is not in the band at all under
    // Square Bale's own thickness.
    expect(bandWallsAt(62.625, PROJECT_DEFAULT_THICKNESS_IN)).toEqual([
      { wallId: "01", wallLengthIn: 78.125, middleIn: 0.125 },
    ]);
    // Built at the thickness the button is about to set: nothing to refuse.
    expect(bandWallsAt(62.625, BALE_THICKNESS_IN)).toEqual([]);
  });

  it("THE MIRROR CASE: out of band at 15.5in, in band at 14in — the refusal used to miss it", () => {
    // Not a shop-safety hole (cornerMayWiden: false still applies and the
    // sub-minimum middle still reports) but the refuse posture was incomplete.
    expect(bandWallsAt(86.5, PROJECT_DEFAULT_THICKNESS_IN)).toEqual([]);
    expect(bandWallsAt(86.5, BALE_THICKNESS_IN)).toEqual([
      { wallId: "01", wallLengthIn: 100.5, middleIn: 22.5 },
    ]);
  });

  it("the refusal SENTENCE follows the fixed basis, so it can never quote a length the building will not have", () => {
    const refused = squareBaleCornerRefusal(bandWallsAt(86.5, BALE_THICKNESS_IN), BALE_IN, MIN_IN, format)!;
    expect(refused).toContain("100.5in");
    expect(refused).not.toContain("102in");
    expect(squareBaleCornerRefusal(bandWallsAt(62.625, BALE_THICKNESS_IN), BALE_IN, MIN_IN, format)).toBeNull();
  });

  it("returns one fact per wall of the footprint, in wall order", () => {
    const { footprint, primaryCornerIds, leastAccessible } = bumpOutFootprint(62.625);
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

  it("finds every two-corner wall under 78in, and reports the whole wall as the merged width", () => {
    expect(findSquareBaleMergedCornerWalls([wall("AB", 72)], BALE_IN)).toEqual([
      { wallId: "AB", wallLengthIn: 72, mergedWidthIn: 72 },
    ]);
    // The widest a merged bale corner can be: one eighth under two nominal.
    expect(findSquareBaleMergedCornerWalls([wall("AB", 77.875)], BALE_IN)).toEqual([
      { wallId: "AB", wallLengthIn: 77.875, mergedWidthIn: 77.875 },
    ]);
  });

  it("finds the LEGAL-width merged corner too, because it is still not a 39in bale unit", () => {
    // A 9ft octagon's side. Inside the 48in ceiling, and refused all the same.
    expect(findSquareBaleMergedCornerWalls([wall("AB", 44.75)], BALE_IN)).toEqual([
      { wallId: "AB", wallLengthIn: 44.75, mergedWidthIn: 44.75 },
    ]);
  });

  it("is silent at 78in and above — that is the band's territory, not the merge's", () => {
    expect(findSquareBaleMergedCornerWalls([wall("AB", 78)], BALE_IN)).toEqual([]);
    expect(findSquareBaleMergedCornerWalls([wall("AB", 96)], BALE_IN)).toEqual([]);
    expect(findSquareBaleMergedCornerWalls([wall("AB", 240)], BALE_IN)).toEqual([]);
  });

  it("is silent on a wall that does not own both corners", () => {
    expect(findSquareBaleMergedCornerWalls([wall("AB", 72, [true, false])], BALE_IN)).toEqual([]);
    expect(findSquareBaleMergedCornerWalls([wall("AB", 72, [false, false])], BALE_IN)).toEqual([]);
  });

  it("the two detectors partition the problem — no wall is ever in both", () => {
    for (let eighths = 8; eighths <= 8 * 120; eighths += 1) {
      const lengthIn = eighths / 8;
      const inBand = findSquareBaleBandWalls([wall("AB", lengthIn)], BALE_IN).length;
      const merged = findSquareBaleMergedCornerWalls([wall("AB", lengthIn)], BALE_IN).length;
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
      findSquareBaleMergedCornerWalls([wall("12", 72)], BALE_IN),
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
    const legalWidth = squareBaleMergedCornerRefusal(
      findSquareBaleMergedCornerWalls([wall("AB", 44.75)], BALE_IN),
      BALE_IN,
      MAX_IN,
      format,
    )!;
    // A refusal that quotes a limit the wall does not breach is not trusted.
    expect(legalWidth).not.toContain("maximum panel width");
    expect(legalWidth).toContain("not a whole-bale unit");
  });

  it("counts the other affected walls — a small octagon is eight of them", () => {
    const octagon = Array.from({ length: 8 }, (_, i) => wall(`${i}${(i + 1) % 8}`, 59.75));
    const message = squareBaleMergedCornerRefusal(
      findSquareBaleMergedCornerWalls(octagon, BALE_IN),
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
        findSquareBaleMergedCornerWalls(legal, BALE_IN),
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
      findSquareBaleMergedCornerWalls(walls, BALE_IN),
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
      findSquareBaleMergedCornerWalls(walls, BALE_IN),
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
      findSquareBaleMergedCornerWalls(walls, BALE_IN),
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

  it("invents no width and quotes no ceiling it does not breach", () => {
    const note = squareBaleMergedCornerNote({ wallId: "AB", mergedWidthIn: 44.75 }, BALE_IN, MAX_IN, format);
    expect(note).not.toContain("maximum panel width");
    expect(note).toContain("44.75in");
    // The note must never suggest a width that would fit.
    expect(note).not.toContain("39in wide");
  });
});
