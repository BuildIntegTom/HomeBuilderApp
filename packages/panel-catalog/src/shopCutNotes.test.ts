import { describe, expect, it } from "vitest";
import type { BraceEndCut } from "./panelMemberHelpers";
import {
  cutNoteForEnds,
  describeEndCutForShop,
  formatShopDegrees,
  formatShopInches,
  missingTriangleFor,
} from "./shopCutNotes";

const cut = (angleDeg: number, cutEdgeLengthIn: number, kind: BraceEndCut["kind"] = "level"): BraceEndCut => ({
  kind,
  angleDeg,
  cutEdgeLengthIn,
});

describe("degrees, the way Tommy asked for them", () => {
  it("⚠ 22.5 reads as 22½° — his words, 'I like the 22 1/2 degrees off square articulation'", () => {
    expect(formatShopDegrees(22.5)).toBe("22½°");
  });

  it("every quarter degree gets its own fraction", () => {
    expect(formatShopDegrees(45)).toBe("45°");
    expect(formatShopDegrees(45.25)).toBe("45¼°");
    expect(formatShopDegrees(45.5)).toBe("45½°");
    expect(formatShopDegrees(45.75)).toBe("45¾°");
  });

  it("a sub-one-degree angle keeps no stray leading zero", () => {
    expect(formatShopDegrees(0.5)).toBe("½°");
  });

  it("⚠ AN ANGLE THAT IS NOT A QUARTER IS NOT DRESSED UP AS ONE", () => {
    // A brace off a 2:1 slope is atan(1/2) = 26.565°. Printing that as a
    // fraction would present a derived approximation as a measured fact.
    const twoToOne = (Math.atan(0.5) * 180) / Math.PI;
    expect(formatShopDegrees(twoToOne)).toBe("~26.6°");
    expect(formatShopDegrees(26.565)).toMatch(/^~/);
  });
});

describe("inches, and the refusal to round silently", () => {
  it("whole inches and exact sixteenths print clean, with no tilde", () => {
    expect(formatShopInches(3)).toBe('3"');
    expect(formatShopInches(3.5)).toBe('3½"');
    expect(formatShopInches(0.75)).toBe('¾"');
    expect(formatShopInches(1.4375)).toBe('1⁷⁄₁₆"');
    expect(formatShopInches(0.0625)).toBe('¹⁄₁₆"');
  });

  it("⚠ A VALUE THAT IS NOT A SIXTEENTH IS MARKED, NOT QUIETLY ROUNDED", () => {
    // 3.5 * tan(22.5°) = 1.4497", which is not a sixteenth of anything. The
    // shop still needs a fraction to work from, so it gets one — flagged.
    const jigLeg = 3.5 * Math.tan((22.5 * Math.PI) / 180);
    const printed = formatShopInches(jigLeg);
    expect(printed).toBe('~1⁷⁄₁₆"');
    expect(printed.startsWith("~")).toBe(true);
  });

  it("the tilde is the ONLY difference between an exact and an inexact sixteenth", () => {
    // Which is what makes it readable at a glance: same figure, one mark.
    expect(formatShopInches(1.4375)).toBe('1⁷⁄₁₆"');
    expect(formatShopInches(1.4497)).toBe('~1⁷⁄₁₆"');
  });
});

describe("the missing triangle — the thing the jig is built from", () => {
  it("⚠ THE LEGS COME FROM THE STOCK, not from the modelled cut edge", () => {
    // Built the other way first: cut edge as hypotenuse, so legs are
    // length*cos and length*sin. A real chevron brace gave 3.4628" at one end
    // and 3.5156" at the other on a 2x4 — the modelled face is a slightly
    // non-parallel quadrilateral. A jig is cut from stock, so the stock's own
    // 3.5" is the leg, and it lands exactly on a fraction instead of ~3½".
    const edgeFromModel = 4.1727; // what the real brace actually measured
    const tri = missingTriangleFor(cut(32.59423099064128, edgeFromModel), 3.5)!;
    expect(tri.acrossIn).toBe(3.5);
    expect(formatShopInches(tri.acrossIn)).toBe('3½"'); // no tilde
    expect(tri.alongIn).toBeCloseTo(3.5 * Math.tan((32.59423099064128 * Math.PI) / 180), 9);
  });

  it("⚠ and it REPORTS how far the model disagrees rather than hiding it", () => {
    // The whole reason the stock-based leg is safe to use: the gap is measured
    // and surfaced, so a real geometry problem cannot be absorbed by the
    // rounding of a jig dimension.
    const tri = missingTriangleFor(cut(32.59423099064128, 4.1727), 3.5)!;
    expect(tri.modelDisagreementIn).toBeCloseTo(0.0156, 3);
    // A cut edge that agrees with the stock disagrees by nothing.
    const clean = missingTriangleFor(cut(22.5, 3.5 / Math.cos((22.5 * Math.PI) / 180)), 3.5)!;
    expect(clean.modelDisagreementIn).toBeLessThan(1e-9);
  });

  it("a disagreement at or past 1/32in puts a CHECK on the sheet", () => {
    const edge = (3.5 + 1 / 32) / Math.cos((30 * Math.PI) / 180);
    const note = describeEndCutForShop(cut(30, edge), 3.5);
    expect(note).toContain("CHECK:");
    expect(note).toContain("confirm the panel geometry");
  });

  it("...and a disagreement below it does NOT, because a shop cannot mark it", () => {
    const edge = (3.5 + 1 / 128) / Math.cos((30 * Math.PI) / 180);
    expect(describeEndCutForShop(cut(30, edge), 3.5)).not.toContain("CHECK:");
  });

  it("the two legs and the angle really are a right triangle", () => {
    // The relationship the shop checks by laying the block against the board:
    // along / across must equal tan(angle).
    for (const angle of [5, 22.5, 30, 45, 60, 85]) {
      const tri = missingTriangleFor(cut(angle, 7.25), 3.5)!;
      expect(tri.alongIn / tri.acrossIn).toBeCloseTo(Math.tan((angle * Math.PI) / 180), 9);
    }
  });

  it("⚠ a square cut has NO missing triangle and gets no jig", () => {
    expect(missingTriangleFor(cut(0, 3.5), 3.5)).toBeNull();
    expect(describeEndCutForShop(cut(0, 3.5), 3.5)).toBe("Square crosscut — lands level.");
  });

  it("a steeper angle takes more along the length and the same across", () => {
    const shallow = missingTriangleFor(cut(15, 3.63), 3.5)!;
    const steep = missingTriangleFor(cut(60, 7), 3.5)!;
    expect(shallow.acrossIn).toBe(steep.acrossIn);
    expect(steep.alongIn).toBeGreaterThan(shallow.alongIn);
  });

  it("a 2x6 jig is wider than a 2x4 jig at the same angle", () => {
    // The leg follows the stock, so it must track the stock.
    const two_by_four = missingTriangleFor(cut(22.5, 3.79), 3.5)!;
    const two_by_six = missingTriangleFor(cut(22.5, 5.96), 5.5)!;
    expect(two_by_four.acrossIn).toBe(3.5);
    expect(two_by_six.acrossIn).toBe(5.5);
    expect(two_by_six.alongIn).toBeGreaterThan(two_by_four.alongIn);
  });
});

describe("the note the shop actually reads", () => {
  const edge22 = 3.5 / Math.cos((22.5 * Math.PI) / 180);

  it("names the angle off square, what the end does, and both jig legs", () => {
    const note = describeEndCutForShop(cut(22.5, edge22, "plumb"), 3.5);
    expect(note).toContain("22½° off square");
    expect(note).toContain("lands plumb");
    expect(note).toContain("across the face");
    expect(note).toContain("along the length");
    expect(note).toContain("jig block");
  });

  it("⚠ says 'both ends the same' ONCE rather than repeating itself", () => {
    // A shop reading the identical sentence twice has to stop and decide
    // whether the two really are the same, and that pause is how a board goes
    // through the saw backwards.
    const note = cutNoteForEnds([cut(22.5, edge22, "plumb"), cut(22.5, edge22, "plumb")], 3.5);
    expect(note.startsWith("Both ends the same.")).toBe(true);
    expect(note.match(/off square/g)).toHaveLength(1);
  });

  it("numbers the ends when they differ", () => {
    const note = cutNoteForEnds([cut(22.5, edge22, "plumb"), cut(45, 4.95, "level")], 3.5);
    expect(note).toContain("End 1:");
    expect(note).toContain("End 2:");
    expect(note).toContain("22½°");
    expect(note).toContain("45°");
  });

  it("⚠ two ends at the same ANGLE but different KINDS are not collapsed", () => {
    // A Braced Panel's brace is exactly this case at 45°: one plumb end, one
    // level end. Saying "both ends the same" there would be wrong — they are
    // cut to the same setting but land differently, and a crew checking a
    // finished piece needs to know which is which.
    const note = cutNoteForEnds([cut(45, 4.95, "plumb"), cut(45, 4.95, "level")], 3.5);
    expect(note.startsWith("Both ends the same.")).toBe(false);
    expect(note).toContain("lands plumb");
    expect(note).toContain("lands level");
  });

  it("a member with no angled ends says so plainly", () => {
    expect(cutNoteForEnds([], 3.5)).toBe("Square crosscut both ends.");
  });
});
