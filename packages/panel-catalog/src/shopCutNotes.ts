import type { BraceEndCut } from "./panelMemberHelpers";

/**
 * HOW A CUT IS WRITTEN DOWN FOR THE PERSON AT THE SAW.
 *
 * Tommy, 2026-10-11, on what a cut list should say: *"using common
 * denominational names for dimensional lumber like 2x4 as materials and then
 * length(s) and angles where appropriate (for any inclined panel and with a
 * note that clearly details how to cut it for the shop crew to be able to
 * determine how to cut it"*.
 *
 * And, asked whether an inclined cut should be given as an angle or as a
 * rise and run:
 *
 * > *"Both because we will have to build a reversed triangle block for it -
 * > knowing the missing rise and run dimensions would actually be critically
 * > helpful in creating accurate jig blocks. I like the 22 1/2 degrees off
 * > square articulation there."*
 *
 * ⚠ **"Missing" is the load-bearing word.** The jig is the NEGATIVE of the
 * cut, so the dimensions the shop needs are the triangle that is REMOVED, not
 * the one that remains. A note giving only the kept geometry would make the
 * shop derive the jig by subtraction, which is where an error enters.
 */

/* ---------------------------------------------------------------------------
 * Numbers, written the way a shop reads them — and never rounded into a lie
 * ------------------------------------------------------------------------- */

const SIXTEENTHS: readonly string[] = [
  "",
  "¹⁄₁₆", // 1/16
  "⅛", // 1/8
  "³⁄₁₆", // 3/16
  "¼", // 1/4
  "⁵⁄₁₆", // 5/16
  "⅜", // 3/8
  "⁷⁄₁₆", // 7/16
  "½", // 1/2
  "⁹⁄₁₆", // 9/16
  "⅝", // 5/8
  "¹¹⁄₁₆", // 11/16
  "¾", // 3/4
  "¹³⁄₁₆", // 13/16
  "⅞", // 7/8
  "¹⁵⁄₁₆", // 15/16
];

/** Floating-point noise only — NOT a shop tolerance. */
const EXACT_EPS = 1e-6;

/**
 * Inches as a shop fraction to the nearest sixteenth — **prefixed with `~`
 * when that fraction is not the exact value.**
 *
 * ⚠ This is the dimensional-tightness rule applied to a number that genuinely
 * cannot be exact. A panel's wall lengths are held to whole eighths and must
 * never be rounded; a jig leg derived through `tan` is a different animal —
 * `3.5 x tan(22.5°)` is 1.4497", which is not a sixteenth of anything. Both
 * available choices are bad on their own: print a decimal and the shop has to
 * convert it at the saw, or print `1 7/16"` and a derived approximation is
 * presented as a measured fact. So the fraction is given, because that is what
 * is usable, **and it is marked** when it is approximate. Nothing silently
 * rounds.
 */
export function formatShopInches(valueIn: number): string {
  const sixteenths = valueIn * 16;
  const nearest = Math.round(sixteenths);
  const exact = Math.abs(sixteenths - nearest) < EXACT_EPS;
  const whole = Math.floor(nearest / 16);
  const rem = nearest - whole * 16;
  const frac = SIXTEENTHS[rem] ?? "";
  const body = rem === 0 ? `${whole}` : whole === 0 ? frac : `${whole}${frac}`;
  return `${exact ? "" : "~"}${body}"`;
}

const QUARTER_DEGREES: Record<number, string> = {
  0: "",
  1: "¼",
  2: "½",
  3: "¾",
};

/**
 * Degrees as a shop figure — a vulgar fraction when the angle lands exactly on
 * a quarter degree, a single decimal otherwise, marked `~`.
 *
 * Tommy asked for the `22½°` articulation specifically. A brace cut off a 2:1
 * slope is 26.565°, which is not a quarter of anything, so that one reads
 * `~26.6°` rather than being dressed up as a fraction it is not.
 */
export function formatShopDegrees(deg: number): string {
  const quarters = deg * 4;
  const nearest = Math.round(quarters);
  if (Math.abs(quarters - nearest) < EXACT_EPS) {
    const whole = Math.floor(nearest / 4);
    const frac = QUARTER_DEGREES[nearest - whole * 4] ?? "";
    return `${whole === 0 && frac ? "" : whole}${frac}°`;
  }
  return `~${deg.toFixed(1)}°`;
}

/* ---------------------------------------------------------------------------
 * The triangle the cut removes
 * ------------------------------------------------------------------------- */

export interface MissingTriangle {
  /** Across the board's face — one leg of the jig block. The STOCK's own
   * width, because that is what the block gets cut from. */
  acrossIn: number;
  /** Along the board's length: how far the long point runs past the short
   * point. The other leg. */
  alongIn: number;
  /**
   * How far the modelled cut edge disagrees with this stock width, in inches.
   *
   * ⚠ Non-zero means the member's modelled face is not exactly parallel-sided,
   * so the model's own idea of "across the face" differs from the stock a shop
   * would cut the jig out of. See `missingTriangleFor`.
   */
  modelDisagreementIn: number;
}

/**
 * The right triangle an angled end cut removes — **sized from the stock, not
 * from the model.**
 *
 * ⚠ **This was built the other way first and the geometry corrected it.** The
 * cut edge is that triangle's hypotenuse, so `length * cos(angle)` and
 * `length * sin(angle)` look like the obvious legs. Run against a real chevron
 * brace (40" x 120" panel), those gave **3.4628" at one end and 3.5156" at the
 * other, on a 2x4 whose width is 3.5"** — because the modelled brace face is a
 * slightly non-parallel quadrilateral rather than a true trapezoid, so each end
 * sees a different distance across.
 *
 * A jig block is cut from a piece of stock. Its legs are therefore the stock's
 * real width and `width * tan(angle)` — which is also what a shop would lay out
 * by hand, and which lands exactly on `3½"` instead of printing `~3½"` from
 * trig noise. The model's disagreement is reported rather than hidden, because
 * a gap bigger than a shop cares about means the panel geometry needs looking
 * at, not that the jig note needs rounding.
 *
 * Returns `null` for a square cut (0° off square), which removes nothing and
 * needs no jig — a note claiming a zero-by-something triangle would be noise on
 * the row that is simplest to cut.
 */
export function missingTriangleFor(cut: BraceEndCut, stockWidthIn: number): MissingTriangle | null {
  if (cut.angleDeg < EXACT_EPS) return null;
  const rad = (cut.angleDeg * Math.PI) / 180;
  return {
    acrossIn: stockWidthIn,
    alongIn: stockWidthIn * Math.tan(rad),
    modelDisagreementIn: Math.abs(cut.cutEdgeLengthIn * Math.cos(rad) - stockWidthIn),
  };
}

/**
 * How far out the model may be before the note says so: 1/32".
 *
 * Chosen as the smallest division a shop crew marks by hand — below it, a
 * difference cannot be transferred to a block anyway, so flagging it would be
 * noise. At or above it, the jig a shop builds and the panel the app modelled
 * are different objects, and the sheet must not pretend otherwise. The real
 * braces measured 1/64" and 1/32" out, so this sits right at the boundary on
 * purpose: it is a threshold to be reviewed with Tommy, not a tolerance to hide
 * behind.
 */
export const JIG_MODEL_TOLERANCE_IN = 1 / 32;

/* ---------------------------------------------------------------------------
 * The sentence
 * ------------------------------------------------------------------------- */

/** How the cut sits relative to the panel once installed, for orientation. */
function orientationPhrase(kind: BraceEndCut["kind"]): string {
  if (kind === "plumb") return "lands plumb";
  if (kind === "level") return "lands level";
  return "lands on a miter";
}

/**
 * One end's cut, as an instruction.
 *
 * Deliberately a sentence and not a cell of symbols: the brief was *"a note
 * that clearly details how to cut it for the shop crew to be able to determine
 * how to cut it"*. It names the angle off square first (what you set), then
 * what the finished end does (so a piece can be checked after cutting), then
 * the missing triangle (what you build the jig from).
 */
export function describeEndCutForShop(cut: BraceEndCut, stockWidthIn: number): string {
  if (cut.angleDeg < EXACT_EPS) return `Square crosscut — ${orientationPhrase(cut.kind)}.`;
  const tri = missingTriangleFor(cut, stockWidthIn)!;
  const note =
    `${formatShopDegrees(cut.angleDeg)} off square — ${orientationPhrase(cut.kind)}. ` +
    `Waste triangle ${formatShopInches(tri.acrossIn)} across the face ` +
    `x ${formatShopInches(tri.alongIn)} along the length; ` +
    `build the jig block to those two legs.`;
  // ⚠ Said out loud on the sheet rather than rounded away — see
  // JIG_MODEL_TOLERANCE_IN.
  if (tri.modelDisagreementIn >= JIG_MODEL_TOLERANCE_IN) {
    return (
      `${note} CHECK: the modelled face is ${formatShopInches(tri.modelDisagreementIn)} off this stock width, ` +
      `so confirm the panel geometry before cutting a jig to it.`
    );
  }
  return note;
}

/**
 * The whole cut note for a member with angled ends.
 *
 * Two ends with the same cut are said once — a shop reading "22½° off square"
 * twice has to stop and work out whether the two are really the same, and that
 * pause is the kind of thing that puts a board through the saw backwards. When
 * they differ, each is given with the end it belongs to in the order
 * `describeBraceEndCuts` returns them.
 */
export function cutNoteForEnds(cuts: readonly BraceEndCut[], stockWidthIn: number): string {
  if (cuts.length === 0) return "Square crosscut both ends.";
  const sentences = cuts.map((c) => describeEndCutForShop(c, stockWidthIn));
  if (sentences.length === 2 && sentences[0] === sentences[1]) {
    return `Both ends the same. ${sentences[0]}`;
  }
  return sentences.map((s, i) => `End ${i + 1}: ${s}`).join(" ");
}
