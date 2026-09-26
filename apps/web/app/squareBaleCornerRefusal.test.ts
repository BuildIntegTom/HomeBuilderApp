import { describe, expect, it } from "vitest";
import { fabricationMinPanelWidthIn, squareBalePanel } from "@building-integrity/panel-catalog";
import { buildRectangleFootprint, insertBumpOut } from "@building-integrity/geometry";
import {
  findSquareBaleBandWalls,
  squareBaleCornerRefusal,
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
