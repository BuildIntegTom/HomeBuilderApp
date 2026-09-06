import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, buildOctagonFootprint } from "@building-integrity/geometry";
import { formatImperialFractionIn } from "@building-integrity/calc-engine";
import {
  SCALE_PX_PER_FT,
  UNRECOGNIZED_LENGTH_HINT,
  computeSlotRects,
  cornerMarkerPosition,
  findNearestWall,
  findNearestWallCandidates,
  formatFeetInches,
  formatLengthForDomain,
  nearestPointOnSegments,
  parseLengthFt,
  parseLengthIn,
  pickWallByDragDirection,
  projectOntoWallFt,
  resolveLengthEntry,
  signedDepthFt,
  signedPerpOffsetFt,
  snapLengthToEighthIn,
  snapOctagonBoxPx,
  snapSpanPointFt,
  wallAndPanelSnapLines,
  wallLabelPosition,
  wallPointsPx,
} from "./canvasGeometry";

const ORIGIN = { x: 60, y: 60 };

describe("formatFeetInches / parseLengthFt round-trip", () => {
  it("formats and re-parses whole and fractional feet", () => {
    for (const ft of [0, 1, 20, 40.5, 12.25]) {
      expect(parseLengthFt(formatFeetInches(ft))).toBeCloseTo(ft, 6);
    }
  });

  it("accepts plain decimal feet and rejects garbage", () => {
    expect(parseLengthFt("40.5")).toBeCloseTo(40.5, 6);
    expect(parseLengthFt("")).toBeNull();
    expect(parseLengthFt("not a number")).toBeNull();
  });

  // The formatter used to do Math.round(ft * 12) — nearest WHOLE INCH — so
  // this exact wall read back as `24'-4"`, a bigger precision loss than any
  // decimal site in the app.
  it("carries eighths instead of rounding to the nearest whole inch", () => {
    expect(formatFeetInches(291.625 / 12)).toBe("24'-3⅝\"");
    expect(formatFeetInches(40.5)).toBe("40'-6\"");
    expect(formatFeetInches(0)).toBe("0'-0\"");
    expect(formatFeetInches(-18 / 12)).toBe("-1'-6\"");
  });

  // Format and parse are inverses, so they are swept as a pair rather than
  // spot-checked. `toBe`, not `toBeCloseTo`: an eighth is exactly
  // representable in binary and Stage 1's sum invariant leans on that, so
  // "approximately round-trips" would pass on precisely the bug this
  // stage exists to remove.
  it("round-trips every eighth from 96in to 720in bit-identically", () => {
    const mismatches: string[] = [];
    for (let eighths = 96 * 8; eighths <= 720 * 8; eighths++) {
      const ft = eighths / 8 / 12;
      const back = parseLengthFt(formatFeetInches(ft));
      if (back !== ft) mismatches.push(`${formatFeetInches(ft)}: ${back} !== ${ft}`);
    }
    expect(mismatches).toEqual([]);
  });
});

describe("parseLengthIn / formatImperialFractionIn round-trip", () => {
  it("round-trips every eighth from 0in to 120in bit-identically", () => {
    const mismatches: string[] = [];
    for (let eighths = 0; eighths <= 120 * 8; eighths++) {
      const valueIn = eighths / 8;
      const back = parseLengthIn(formatImperialFractionIn(valueIn));
      if (back !== valueIn) mismatches.push(`${formatImperialFractionIn(valueIn)}: ${back} !== ${valueIn}`);
    }
    expect(mismatches).toEqual([]);
  });

  it("round-trips negatives, which the formatter also emits", () => {
    for (const valueIn of [-0.125, -3.625, -47.875]) {
      expect(parseLengthIn(formatImperialFractionIn(valueIn))).toBe(valueIn);
    }
  });
});

describe("fraction grammar", () => {
  it("accepts whole + fraction in all three separator forms", () => {
    expect(parseLengthIn("47 5/8")).toBe(47.625);
    expect(parseLengthIn("47-5/8")).toBe(47.625);
    expect(parseLengthIn("47 5/8\"")).toBe(47.625);
  });

  it("accepts a bare fraction", () => {
    expect(parseLengthIn("5/8")).toBe(0.625);
    expect(parseLengthIn("5/8\"")).toBe(0.625);
  });

  it("accepts the glyphs formatImperialFractionIn itself emits", () => {
    expect(parseLengthIn("47⅝")).toBe(47.625);
    expect(parseLengthIn("⅝")).toBe(0.625);
    expect(parseLengthIn("12⅛")).toBe(12.125);
    expect(parseLengthIn("12¼")).toBe(12.25);
    expect(parseLengthIn("12⅜")).toBe(12.375);
    expect(parseLengthIn("12½")).toBe(12.5);
    expect(parseLengthIn("12¾")).toBe(12.75);
    expect(parseLengthIn("12⅞")).toBe(12.875);
  });

  it("accepts feet + inches + optional fraction", () => {
    expect(parseLengthFt("24'-3 5/8\"")).toBe(291.625 / 12);
    expect(parseLengthFt("24' 3⅝")).toBe(291.625 / 12);
    expect(parseLengthFt("24'3\"")).toBe(291 / 12);
    expect(parseLengthFt("24'")).toBe(24);
  });

  it("leaves the existing decimal and whole forms alone", () => {
    expect(parseLengthIn("47.625")).toBe(47.625);
    expect(parseLengthIn("47")).toBe(47);
    expect(parseLengthFt("40.5")).toBe(40.5);
    expect(parseLengthFt("40")).toBe(40);
  });

  it("returns null for anything else", () => {
    const rejected = [
      "",
      "   ",
      "not a number",
      "47.5/8",
      "5 8",
      "-",
      "\"",
      "'3\"", // a foot mark with no number in front of it
      "1e3", // the old parseFloat fallback would have read this as 1000
      "47\"\"",
      "24'6'",
      "a24'3\"", // junk before the feet number
      "2 4'3\"", // two numbers where the feet go
    ];
    for (const bad of rejected) {
      expect(parseLengthIn(bad)).toBeNull();
      expect(parseLengthFt(bad)).toBeNull();
    }
  });
});

// Tommy, 2026-08-30: "the fractions should always be considered a fraction
// of an inch". The whole number keeps the field's own unit; the fraction
// never does. Getting this backwards in the feet-domain field is a
// FACTOR-OF-TWELVE error (47'-0⅝" vs 3'-11⅝"), which is why it has its own
// named test and why the field shows a live hint before committing.
describe("the fraction is always inches", () => {
  it("reads 47 5/8 in an inch-domain field as 47.625in", () => {
    expect(parseLengthIn("47 5/8")).toBe(47.625);
  });

  it("reads 47 5/8 in the feet-domain wall-length field as 47ft + ⅝in", () => {
    expect(parseLengthFt("47 5/8")).toBe(47 + 0.625 / 12);
    expect(parseLengthFt("47 5/8")! * 12).toBeCloseTo(564.625, 9);
  });

  it("gives a bare fraction in a feet field the same reading", () => {
    expect(parseLengthFt("5/8")).toBe(0.625 / 12);
  });

  // An explicit unit mark wins over the field's own domain, which is what
  // makes a fully-written form mean the same thing in either kind of
  // field. NOTE: this is an implementation judgement the spec does not
  // settle — see resolveTokens' doc comment.
  it("lets a FOOT mark override the field's domain", () => {
    expect(parseLengthFt("24'-3 5/8\"")).toBe(291.625 / 12);
    expect(parseLengthIn("2'")).toBe(24);
  });

  // Settled by Tommy 2026-09-06, asked directly: "it should always read as
  // 47' and 5/8"". The whole number always takes the field's own unit and a
  // trailing quote changes nothing — otherwise two strings one character
  // apart would mean 47 feet and 3 feet, a second factor-of-twelve trap
  // right beside the first.
  it("treats a trailing inch mark as decoration, not an override", () => {
    expect(parseLengthFt("47 5/8\"")).toBe(parseLengthFt("47 5/8"));
    expect(parseLengthFt("47 5/8\"")).toBe(47 + 0.625 / 12);
    // The price of one rule instead of two: in a feet field the whole
    // number is feet even when a quote is typed. Write 0'-3" for 3 inches.
    expect(parseLengthFt("3\"")).toBe(3);
    // An inch-domain field is unaffected either way.
    expect(parseLengthIn("47 5/8\"")).toBe(47.625);
    expect(parseLengthIn("47 5/8")).toBe(47.625);
  });
});

describe("regressions: the three ways typed fractions used to be destroyed", () => {
  // 1. parseLengthFt fell through to parseFloat, which reads "47 5/8" as 47.
  it("no longer drops the fraction on the parseFloat fallback", () => {
    expect(parseFloat("47 5/8")).toBe(47); // the old behaviour, pinned
    expect(parseLengthIn("47 5/8")).toBe(47.625);
    expect(parseLengthFt("47 5/8")).not.toBe(47);
  });

  // 2. The feet-inches branch had no fraction slot, so "24'-3 5/8\"" missed
  //    it and also fell through to parseFloat -> 24, losing 3⅝ inches.
  it("no longer loses three inches and five eighths on a feet-inches entry", () => {
    expect(parseFloat("24'-3 5/8\"")).toBe(24); // the old behaviour, pinned
    expect(parseLengthFt("24'-3 5/8\"")).toBe(291.625 / 12);
    expect(parseLengthFt("24'-3 5/8\"")).toBeCloseTo(24.3020833, 7);
  });

  // 3. The inch-domain fields were <input type="number">, which cannot hold
  //    "47 5/8" at all: the browser refuses the text, e.target.value comes
  //    back "", and Number("") is 0 — so a typed fraction ZEROED the
  //    dimension. Those fields are now type="text" and commit through
  //    resolveLengthEntry, which is the value this asserts. (The DOM half
  //    can't be exercised here — vitest runs without a browser — so the
  //    old `Number("")` result is pinned alongside it to keep the reason
  //    the field type had to change visible.)
  it("no longer zeroes an inch-domain field when a fraction is typed", () => {
    expect(Number("")).toBe(0); // what a number input handed the old onChange
    expect(resolveLengthEntry("47 5/8", "in").value).toBe(47.625);
    expect(resolveLengthEntry("47 5/8", "in").value).not.toBe(0);
  });
});

describe("fraction parsing edge cases", () => {
  it("handles zero, signs and negatives", () => {
    expect(parseLengthIn("0")).toBe(0);
    expect(parseLengthIn("-3 1/2")).toBe(-3.5);
    expect(parseLengthIn("+3 1/2")).toBe(3.5);
    expect(parseLengthFt("-3 1/2")).toBe(-(3 + 0.5 / 12));
    expect(parseLengthFt("-1'-6\"")).toBe(-1.5);
  });

  it("accepts any denominator, improper included, and rejects a zero one", () => {
    expect(parseLengthIn("9/8")).toBe(1.125);
    expect(parseLengthIn("5/1")).toBe(5);
    expect(parseLengthIn("47 5/16")).toBe(47.3125);
    expect(parseLengthIn("3/32")).toBe(0.09375);
    expect(parseLengthIn("5/0")).toBeNull();
  });

  // A 400-digit number satisfies the grammar and parseFloats to Infinity.
  // Without the finite check it committed Infinity into an inch field and
  // rendered "= Infinity'-NaN\"" as the hint of a feet field.
  it("rejects numbers too large to be a real length", () => {
    const huge = "9".repeat(400);
    expect(parseLengthIn(huge)).toBeNull();
    expect(parseLengthFt(huge)).toBeNull();
    expect(parseLengthFt(`${huge}'6"`)).toBeNull();
    expect(parseLengthIn(`47 ${huge}/8`)).toBeNull();
    expect(resolveLengthEntry(huge, "in").value).toBeNull();
    expect(resolveLengthEntry(huge, "ft").hint).toBe(UNRECOGNIZED_LENGTH_HINT);
  });

  it("rejects fraction glyphs the formatter never emits", () => {
    expect(parseLengthIn("⅓")).toBeNull();
    expect(parseLengthIn("⅔")).toBeNull();
    expect(parseLengthIn("⅕")).toBeNull();
    expect(parseLengthIn("2⅔")).toBeNull();
    expect(parseLengthIn("¾")).toBe(0.75); // ...but ¾ IS one of the eight
  });

  it("tolerates whitespace variants", () => {
    expect(parseLengthIn("  47   5 / 8  ")).toBe(47.625);
    expect(parseLengthFt("  24 '  -  3 5/8 \"  ")).toBe(291.625 / 12);
  });
});

describe("snapLengthToEighthIn", () => {
  it("snaps inches round-half-up onto the grid", () => {
    expect(snapLengthToEighthIn(47.3125, "in")).toBe(47.375);
    expect(snapLengthToEighthIn(40.3, "in")).toBe(40.25);
    expect(snapLengthToEighthIn(47.625, "in")).toBe(47.625);
  });

  it("snaps feet to the nearest 1/8in without disturbing a value already on it", () => {
    expect(snapLengthToEighthIn(40.5, "ft")).toBe(40.5);
    expect(snapLengthToEighthIn(291.625 / 12, "ft")).toBe(291.625 / 12);
    expect(snapLengthToEighthIn(10.001, "ft")).toBe(10);
  });
});

describe("formatLengthForDomain (what a committed value reads back as)", () => {
  it("writes an inch-domain value back as a fraction with no unit mark", () => {
    expect(formatLengthForDomain(47.375, "in")).toBe("47⅜");
    expect(formatLengthForDomain(40, "in")).toBe("40");
    expect(formatLengthForDomain(0.625, "in")).toBe("⅝");
  });

  it("writes a feet-domain value back in feet-inches, which carries its own marks", () => {
    expect(formatLengthForDomain(10, "ft")).toBe("10'-0\"");
    expect(formatLengthForDomain(291.625 / 12, "ft")).toBe("24'-3⅝\"");
  });

  // The redisplay has to round-trip, or committing a value would move it.
  it("round-trips through the parser in both domains", () => {
    for (const valueIn of [0, 0.125, 40, 47.375, 119.875]) {
      expect(parseLengthIn(formatLengthForDomain(valueIn, "in"))).toBe(valueIn);
    }
    for (let eighths = 96 * 8; eighths <= 200 * 8; eighths += 7) {
      const ft = eighths / 8 / 12;
      expect(parseLengthFt(formatLengthForDomain(ft, "ft"))).toBe(ft);
    }
  });
});

describe("resolveLengthEntry (the live resolved hint)", () => {
  it("shows the resolved value for every grammar row", () => {
    expect(resolveLengthEntry("47 5/8", "in").hint).toBe("= 47⅝\"");
    expect(resolveLengthEntry("47-5/8", "in").hint).toBe("= 47⅝\"");
    expect(resolveLengthEntry("5/8", "in").hint).toBe("= ⅝\"");
    expect(resolveLengthEntry("47⅝", "in").hint).toBe("= 47⅝\"");
    expect(resolveLengthEntry("47.625", "in").hint).toBe("= 47⅝\"");
    expect(resolveLengthEntry("47", "in").hint).toBe("= 47\"");
    expect(resolveLengthEntry("24'-3 5/8\"", "ft").hint).toBe("= 24'-3⅝\"");
    expect(resolveLengthEntry("40.5", "ft").hint).toBe("= 40'-6\"");
  });

  // The factor-of-twelve case, shown to the user before it commits.
  it("spells the feet-domain reading out in full", () => {
    const entry = resolveLengthEntry("47 5/8", "ft");
    expect(entry.hint).toBe("= 47'-0⅝\"");
    expect(entry.value).toBe(47 + 0.625 / 12);
  });

  it("snaps an off-grid denominator and shows what will actually be stored", () => {
    const entry = resolveLengthEntry("47 5/16", "in");
    expect(entry.value).toBe(47.375);
    expect(entry.hint).toBe("= 47⅜\"");
  });

  it("gives a failed parse somewhere honest to live", () => {
    for (const bad of ["", "   ", "banana", "5/0", "⅔"]) {
      const entry = resolveLengthEntry(bad, "in");
      expect(entry.value).toBeNull();
      expect(entry.hint).toBe(UNRECOGNIZED_LENGTH_HINT);
    }
    expect(UNRECOGNIZED_LENGTH_HINT).toBe("= —, unrecognized");
  });
});

describe("snapSpanPointFt", () => {
  const wallLengthFt = 30;

  it("snaps flush (0) when within the flush threshold of the start", () => {
    expect(snapSpanPointFt(0.5, wallLengthFt)).toBe(0);
  });

  it("snaps up to the 2ft floor when past flush but still inside the dead zone", () => {
    expect(snapSpanPointFt(1.5, wallLengthFt)).toBe(2);
  });

  it("leaves a point already >= 2ft from both ends untouched", () => {
    expect(snapSpanPointFt(15, wallLengthFt)).toBe(15);
  });

  it("mirrors the same rule at the far end", () => {
    expect(snapSpanPointFt(wallLengthFt - 0.5, wallLengthFt)).toBe(wallLengthFt);
    expect(snapSpanPointFt(wallLengthFt - 1.5, wallLengthFt)).toBe(wallLengthFt - 2);
  });
});

describe("snapOctagonBoxPx", () => {
  it("snaps a near-square box to a perfect square (average of the two)", () => {
    expect(snapOctagonBoxPx(300, 310)).toEqual({ widthPx: 305, heightPx: 305 });
  });

  it("leaves a clearly elongated box untouched", () => {
    expect(snapOctagonBoxPx(400, 200)).toEqual({ widthPx: 400, heightPx: 200 });
  });
});

describe("findNearestWall / projectOntoWallFt", () => {
  const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20)

  it("picks the nearest wall within tolerance and clamps along-wall distance to the segment", () => {
    // Top wall AB runs from px (60,60) to (420,60).
    const found = findNearestWall({ x: 240, y: 65 }, fp, ORIGIN);
    expect(found?.wall.id).toBe("AB");
    expect(found?.alongFt).toBeCloseTo(15, 1);
  });

  it("returns null when the point is farther than the pick tolerance from every wall", () => {
    expect(findNearestWall({ x: 240, y: 200 }, fp, ORIGIN)).toBeNull();
  });

  it("projects and clamps a point beyond the wall's end to the segment boundary", () => {
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    const beyondEnd = { x: 60 + 30 * SCALE_PX_PER_FT + 500, y: 60 };
    expect(projectOntoWallFt(beyondEnd, wallAB, fp.corners, ORIGIN)).toBeCloseTo(30, 6);
  });
});

describe("findNearestWallCandidates / pickWallByDragDirection (corner-ambiguity fix)", () => {
  // Corner A sits at px (60,60): wall AB runs right from it (horizontal),
  // wall DA runs down to it from D (vertical) — the same 2 walls a real
  // bump-out drag near this corner has to disambiguate between.
  const fp = buildRectangleFootprint(30, 20);

  it("near a corner, raw closest-distance can favor the perpendicular wall over the intended one", () => {
    // 3px right, 8px down from the corner: closer to DA's vertical line
    // (dist 3) than AB's horizontal line (dist 8) — this is the exact
    // click that reproduced "selection follows perpendicular, not the
    // perimeter" (Tommy's bug report).
    const candidates = findNearestWallCandidates({ x: 63, y: 68 }, fp, ORIGIN);
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates[0]!.wall.id).toBe("DA");
  });

  it("a horizontal drag from that same ambiguous point resolves to the horizontal wall (AB), not DA", () => {
    const downPos = { x: 63, y: 68 };
    const candidates = findNearestWallCandidates(downPos, fp, ORIGIN);
    const dragged = { x: 250, y: 68 }; // purely horizontal movement
    const chosen = pickWallByDragDirection(downPos, dragged, candidates, fp.corners, ORIGIN);
    expect(chosen.wall.id).toBe("AB");
  });

  it("a vertical drag from the same ambiguous point resolves to the vertical wall (DA)", () => {
    const downPos = { x: 63, y: 68 };
    const candidates = findNearestWallCandidates(downPos, fp, ORIGIN);
    const dragged = { x: 63, y: 200 }; // purely vertical movement
    const chosen = pickWallByDragDirection(downPos, dragged, candidates, fp.corners, ORIGIN);
    expect(chosen.wall.id).toBe("DA");
  });

  it("findNearestWall still returns the single raw-closest wall away from any corner (unchanged behavior)", () => {
    const found = findNearestWall({ x: 240, y: 65 }, fp, ORIGIN);
    expect(found?.wall.id).toBe("AB");
  });
});

describe("signedDepthFt / signedPerpOffsetFt", () => {
  const fp = buildRectangleFootprint(30, 20);
  const wallAB = fp.walls.find((w) => w.id === "AB")!;

  it("signedDepthFt is positive when the point is outward (away from centroid) of the wall", () => {
    // Centroid is below AB (y=60+120=180px); a point above AB (y<60) is outward.
    const depth = signedDepthFt({ x: 240, y: 30 }, wallAB, fp, ORIGIN);
    expect(depth).toBeGreaterThan(0);
    expect(depth).toBeCloseTo(2.5, 1);
  });

  it("signedDepthFt is negative when the point is inward (toward centroid)", () => {
    expect(signedDepthFt({ x: 240, y: 90 }, wallAB, fp, ORIGIN)).toBeLessThan(0);
  });

  it("signedPerpOffsetFt uses a fixed rotate(dir,90deg) convention, NOT centroid-relative 'outward' like signedDepthFt", () => {
    // For AB (dir=(1,0)), perp=(0,1) points *toward* the centroid (which
    // sits below AB) — so signedDepthFt flips it to read "outward" as
    // positive, while signedPerpOffsetFt deliberately does NOT flip,
    // giving the opposite sign for the same point. This is intentional
    // (see the doc comment on signedPerpOffsetFt: dragging a wall inward
    // is just as valid as outward, there's no "outward" to orient by) —
    // a live-dragging user sees this in real time via the preview, so the
    // absolute sign for any one wall doesn't matter for usability. This
    // test just locks in that the two functions are NOT interchangeable.
    const point = { x: 240, y: 30 };
    const depth = signedDepthFt(point, wallAB, fp, ORIGIN);
    const offset = signedPerpOffsetFt(point, wallAB, fp, ORIGIN);
    expect(Math.sign(offset)).toBe(-Math.sign(depth));
  });

  it("signedPerpOffsetFt's sign flips when the point crosses to the other side of the wall", () => {
    const above = signedPerpOffsetFt({ x: 240, y: 30 }, wallAB, fp, ORIGIN);
    const below = signedPerpOffsetFt({ x: 240, y: 90 }, wallAB, fp, ORIGIN);
    expect(Math.sign(above)).toBe(-Math.sign(below));
  });
});

describe("wallLabelPosition / cornerMarkerPosition", () => {
  const fp = buildRectangleFootprint(30, 20);

  it("nudges a wall's label outward from the footprint's centroid", () => {
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    const pos = wallLabelPosition(wallAB, fp.corners, ORIGIN);
    // AB is the top wall; its label should sit above the wall's own px line (y=60).
    expect(pos.y).toBeLessThan(ORIGIN.y);
  });

  it("nudges a corner marker diagonally outward from the centroid", () => {
    const cornerA = fp.corners.find((c) => c.id === "A")!;
    const pos = cornerMarkerPosition(cornerA, fp.corners, ORIGIN);
    // A is the top-left corner; the marker should sit up and to the left of it.
    expect(pos.x).toBeLessThan(cornerA.point.x * SCALE_PX_PER_FT + ORIGIN.x);
    expect(pos.y).toBeLessThan(cornerA.point.y * SCALE_PX_PER_FT + ORIGIN.y);
  });
});

describe("computeSlotRects", () => {
  it("lays out slots end-to-end along a wall, in px, without gaps or overlaps", () => {
    const fp = buildRectangleFootprint(30, 20);
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    const slots = [
      { type: "corner" as const, widthIn: 24 },
      { type: "standard" as const, widthIn: 40 },
      { type: "corner" as const, widthIn: 24 },
    ];
    const rects = computeSlotRects(wallAB, slots, fp, ORIGIN, 0, 15.5);
    expect(rects).toHaveLength(3);
    // Each slot's start should exactly match the previous slot's end (along the wall).
    for (let i = 1; i < rects.length; i++) {
      const prevEndPx = rects[i - 1]!.x + rects[i - 1]!.width;
      expect(rects[i]!.x).toBeCloseTo(prevEndPx, 6);
    }
  });

  it("builds trapezoid points instead of a plain rect for corner slots on a mitered (octagon) shape", () => {
    const fp = buildOctagonFootprint(30, 20);
    const wall = fp.walls.find((w) => w.id === "01")!;
    const slots = [
      { type: "safety-oct-corner" as const, widthIn: 24 },
      { type: "standard" as const, widthIn: 40 },
      { type: "corner" as const, widthIn: 24 },
    ];
    const rects = computeSlotRects(wall, slots, fp, ORIGIN, 0, 15.5);
    expect(rects[0]!.trapezoidPoints).toBeDefined();
    expect(rects[rects.length - 1]!.trapezoidPoints).toBeDefined();
    expect(rects[1]!.trapezoidPoints).toBeUndefined(); // middle standard slot: plain rect
  });
});

describe("wallPointsPx", () => {
  it("converts a wall's ft-space endpoints to px using SCALE_PX_PER_FT and the given offset", () => {
    const fp = buildRectangleFootprint(30, 20);
    const wallAB = fp.walls.find((w) => w.id === "AB")!;
    const { startPx, endPx } = wallPointsPx(wallAB, fp.corners, ORIGIN);
    expect(startPx).toEqual({ x: ORIGIN.x, y: ORIGIN.y });
    expect(endPx).toEqual({ x: ORIGIN.x + 30 * SCALE_PX_PER_FT, y: ORIGIN.y });
  });
});

describe("nearestPointOnSegments", () => {
  it("clamps to the segment's own length rather than the infinite line", () => {
    const segments = [{ x1: 0, y1: 0, x2: 100, y2: 0 }];
    // (110,5) is past the segment's x2 end - nearest point is the endpoint (100,0), not (110,0).
    expect(nearestPointOnSegments({ x: 110, y: 5 }, segments)).toEqual({ x: 100, y: 0 });
  });

  it("picks whichever of several segments is actually closest", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 100, y2: 0 }, // horizontal line, y=0
      { x1: 50, y1: 10, x2: 50, y2: 100 }, // vertical line, x=50, starting at y=10
    ];
    // (50,3): distance 3 from the horizontal line, distance 7 from the vertical one.
    expect(nearestPointOnSegments({ x: 50, y: 3 }, segments)).toEqual({ x: 50, y: 0 });
  });

  it("returns null when nothing is within MEASURE_SNAP_TOLERANCE_PX", () => {
    const segments = [{ x1: 0, y1: 0, x2: 100, y2: 0 }];
    expect(nearestPointOnSegments({ x: 50, y: 100 }, segments)).toBeNull();
  });
});

describe("wallAndPanelSnapLines", () => {
  const fp = buildRectangleFootprint(30, 20); // A(0,0) B(30,0) C(30,20) D(0,20)
  const wallSlots = {
    AB: [{ type: "standard" as const, widthIn: 360 }],
    BC: [{ type: "standard" as const, widthIn: 240 }],
    CD: [{ type: "standard" as const, widthIn: 360 }],
    DA: [{ type: "standard" as const, widthIn: 240 }],
  };
  const wallStartOffsetIn = { AB: 0, BC: 0, CD: 0, DA: 0 };

  it("includes each wall's own exterior edge as a snappable line", () => {
    const segments = wallAndPanelSnapLines(fp, wallSlots, ORIGIN, wallStartOffsetIn, 15);
    expect(segments.length).toBeGreaterThan(0);
    // A point just off the top wall's exterior edge (60,60)-(420,60) should snap onto that line.
    const snapped = nearestPointOnSegments({ x: 240, y: 65 }, segments);
    expect(snapped).not.toBeNull();
    expect(snapped!.y).toBeCloseTo(60, 0);
  });

  it("returns null for a point far from every wall/panel edge", () => {
    const segments = wallAndPanelSnapLines(fp, wallSlots, ORIGIN, wallStartOffsetIn, 15);
    // Dead center of the 30x20 footprint - well clear of all 4 walls.
    expect(nearestPointOnSegments({ x: 240, y: 180 }, segments)).toBeNull();
  });
});
