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
   * How far the modelled board disagrees with this stock width, in inches.
   *
   * ⚠ Non-zero means the member's modelled board really is not the stock the
   * jig would be cut from — its face is not parallel-sided, or it has run out
   * to a sliver. See `missingTriangleFor`.
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
    modelDisagreementIn: modelDisagreementIn(cut, stockWidthIn),
  };
}

/**
 * ⚠ **THE DISAGREEMENT, MEASURED OFF THE SOLID AND NOT OFF THE DRAWING.**
 *
 * `cutEdgeLengthIn * cos(angle)` is the across-extent of the member's NEAR
 * FACE. That identity holds **in one plane only**: a board that leans out of
 * the elevation plane is drawn as a raked section of itself, so its face reads
 * wider than the board is. `describeBraceEndCuts` undoes that lean when it is
 * given the far face — see `BraceEndCut.modelAcrossIn` and `faceShearAcrossIn`
 * for the derivation — and this prefers that reading whenever it exists.
 *
 * ⚠ **Measured 2026-11-25 on the 16ft Octagon's gable row.** Of its 112
 * cut-list rows, 76 carry a trapezoid face and **60 carried this CHECK** — and
 * it was false on all but two. Two separate faults, and the lean is the
 * SMALLER of them:
 *
 * | compared against | rows still flagged |
 * |---|---|
 * | `widthIn`, in-plane identity (what shipped) | **60** |
 * | the stock dimension that really crosses the face | 8 |
 * | ...and the lean undone as well | **2** |
 *
 * ⚠ **The 60 break down 52 / 6 / 2, and the lean is the 6.** Fifty-two were
 * the wrong FACE alone — `widthIn` against a board drawn on its 1½in or ¾in
 * face, which is `faceAcrossFieldOf`'s subject and reads 2in or 14¾in out by
 * itself. Six are the dual-bevelled gable plates, **0.038968in** apiece on
 * solids that measure exactly 1.5000in; that one is the lean. The last two are
 * real. Both fixes were needed: either alone still leaves the sheet warning
 * about parts that are right.
 *
 * The 2 that remain are the gable sliver plates, whose faces are **triangles**
 * — long edges not parallel, one of them 2.96in across on 1½in stock and the
 * other run out to a point. Those are the fault this CHECK exists to report,
 * so they keep it.
 *
 * Falls back to the single-plane identity when nobody measured the solid, which
 * is honest: with only one face in hand that identity is the best available
 * reading, and for a board that genuinely lies flat it is also the exact one.
 */
function modelDisagreementIn(cut: BraceEndCut, stockWidthIn: number): number {
  const modelAcrossIn = cut.modelAcrossIn ?? cut.cutEdgeLengthIn * Math.cos((cut.angleDeg * Math.PI) / 180);
  return Math.abs(modelAcrossIn - stockWidthIn);
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
  if (cut.angleDeg < EXACT_EPS) {
    const square = `Square crosscut — ${orientationPhrase(cut.kind)}.`;
    /* ⚠ **A square end still gets the CHECK when the BOARD is wrong.** Nothing
       is raked here, so there is no jig and no triangle — but a member modelled
       at a width its stock does not have is a part that will not fit, and the
       early return used to swallow exactly that. It is how the 16ft Octagon's
       run-out gable plate (zero inches across) reached a sheet saying only
       "Square crosscut". */
    const outIn = modelDisagreementIn(cut, stockWidthIn);
    return outIn >= JIG_MODEL_TOLERANCE_IN
      ? `${square} ${modelCheckSentence(outIn)}`
      : square;
  }
  const tri = missingTriangleFor(cut, stockWidthIn)!;
  const note =
    `${formatShopDegrees(cut.angleDeg)} off square — ${orientationPhrase(cut.kind)}. ` +
    `Waste triangle ${formatShopInches(tri.acrossIn)} across the face ` +
    `x ${formatShopInches(tri.alongIn)} along the length; ` +
    `build the jig block to those two legs.`;
  // ⚠ Said out loud on the sheet rather than rounded away — see
  // JIG_MODEL_TOLERANCE_IN.
  if (tri.modelDisagreementIn >= JIG_MODEL_TOLERANCE_IN) {
    return `${note} ${modelCheckSentence(tri.modelDisagreementIn)}`;
  }
  return note;
}

/** One wording for the one warning, so the raked and the square end cannot
 *  word it differently. */
function modelCheckSentence(outIn: number): string {
  return (
    `CHECK: the modelled board is ${formatShopInches(outIn)} off this stock width, ` +
    `so confirm the panel geometry before cutting a jig to it.`
  );
}

/**
 * ⚠ **THE SECOND ANGLE on a COMPOUND cut — the saw's TILT, not its mitre.**
 *
 * > *"can we make the top of Gable and dual beveled So that the roof can meet
 * > it?"* — Tommy, 2026-11-16
 *
 * Every other note in this file describes a cut in ONE plane: the board is
 * raked and the saw is square to its face. A gable top on an octagon facet is
 * not — the roof falls through the wall as well as along it, so the same cut
 * also tips the blade across the board's width.
 *
 * ⚠ **Without this the sheet is unbuildable and does not say so.** The cut
 * list reads a member's end cuts off its elevation geometry, where a compound
 * bevel is invisible; what reached the shop was the mitre alone, plus the
 * generic "CHECK: the modelled face is off this stock width". Measured on the
 * 16ft Octagon: 21 more parts carrying that CHECK and not one of them naming
 * the angle a shop would have to set.
 *
 * ✅ **And that CHECK was false on every one of them.** Two causes, and this
 * note only guessed at the smaller one: the lean a compound bevel puts on a
 * board does make its drawn face read wider than the board is — but the bulk
 * of the figure was the stock dimension it was compared against. Closed
 * 2026-11-25. See `modelDisagreementIn` for the measurement and
 * `faceAcrossFieldOf` for the larger half.
 *
 * The missing wedge is given the same way every other jig in this file is —
 * the triangle the cut REMOVES, because the jig block is its negative.
 */
export function compoundBevelNote(bevelDeg: number, acrossIn: number, alongIn: number, highFace: string): string {
  return (
    `COMPOUND CUT — also tilt the blade ${formatShopDegrees(bevelDeg)} across the board's ` +
    `${formatShopInches(acrossIn)} width, ${formatShopInches(alongIn)} of fall, ${highFace} face high. ` +
    `The wedge this one removes is ${formatShopInches(acrossIn)} x ${formatShopInches(alongIn)}; ` +
    "build its jig block to those two legs as well."
  );
}

/**
 * ⚠ **MITRED IN PLAN — the saw swung flat, at an octagon corner.**
 *
 * > *"The octagon Gable pieces need to be cut like octagon corners."* —
 * > Tommy, 2026-11-16
 *
 * A third kind of angle, and it reads nothing like the other two. The end
 * cuts in this file are in the board's own ELEVATION (it is raked along its
 * length); `compoundBevelNote` tips the blade across the board's width. This
 * one swings the saw's table: the end face is square to the board's faces and
 * raked in PLAN, so two walls meeting at an octagon corner close on the
 * corner's bisector instead of crossing into each other's wood.
 *
 * ⚠ It is said here because the geometry the cut list reads — one elevation
 * quad — cannot show it. A plate mitred 22½° in plan has the same elevation
 * as a square-cut one, so without this the sheet describes a square crosscut
 * and the part comes back the wrong shape with nothing on the page wrong.
 *
 * `longFace` names the face the long point is on — exterior at a building's
 * convex corner, interior at the inside of a notch — because a board cut the
 * wrong way round is still exactly the right length.
 */
export function planMitreNote(angleDeg: number, acrossIn: number, alongIn: number, longFace: string): string {
  return (
    `MITRED IN PLAN — swing the saw ${formatShopDegrees(angleDeg)} and cut this end flat through the board's ` +
    `${formatShopInches(acrossIn)} depth, ${formatShopInches(alongIn)} of pull-back, long point on the ` +
    `${longFace} face. The end face stays square to the board's own two faces; it is the saw's table that turns, ` +
    "not the blade."
  );
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
