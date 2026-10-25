import type { AddedMemberSpec, PanelWythe } from "./panelRecipe";
import { recipeClearHeightIn } from "./panelRecipe";
import { centreNailerStudSpansIn } from "./panelMemberHelpers";

/** A corner post is 1.5in across the panel's width. */
const CORNER_POST_THICKNESS_IN = 1.5;

/**
 * The bracing patterns, as they are drawn on a PAIR of panels.
 *
 * From his sketch of 2026-10-24 and his answers of 2026-10-25.
 *
 * ⚠ **Nothing crosses the seam.** *"The x in the super brace is 4 smaller
 * pieces, each one leg of the x, on two different panels."* So a pattern that
 * looks continuous across a pair is really each panel carrying its own legs,
 * and that is exactly why a pattern can be stored on the PANEL — his answer
 * to where it belongs — rather than on the wall. A continuous board could not
 * be pressed into two separate panels anyway.
 */
export type BracePairPattern = "superbrace" | "braced" | "nailer";

/** Which panel of the pair this is. A pair's two panels are mirror images. */
export type PairHalf = "left" | "right";

export const BRACE_PAIR_PATTERNS: { id: BracePairPattern; label: string; description: string }[] = [
  {
    id: "superbrace",
    label: "SuperBrace Pair",
    description:
      "A full X across the pair, each panel carrying two legs that meet at the seam. The densest of the three, and the default.",
  },
  {
    id: "braced",
    label: "Braced Pair",
    description: "One long diagonal across the pair, with an added horizontal tie at mid-height.",
  },
  {
    id: "nailer",
    label: "Nailer Pair",
    description:
      "No diagonal — a standard panel with a nailer added, for fixing shear coverings such as Timber HP or Power Wool.",
  },
];

/** ⚠ His answer when asked what decides a pair's pattern: *"Default could be
 * super braced for now."* Deliberately the densest, until something decides
 * it by wall length, openings or seismic. */
export const DEFAULT_BRACE_PAIR_PATTERN: BracePairPattern = "superbrace";

export interface BracePairOptions {
  pattern: BracePairPattern;
  widthIn: number;
  heightIn: number;
  half: PairHalf;
  /** Both wythes get the pattern, the way the braced panel already does it.
   * One wythe only is available for a user who wants it. */
  wythes?: PanelWythe[];
}

/**
 * The members a pattern adds to ONE panel of a pair.
 *
 * Returns specs rather than members so the caller can put them in a recipe,
 * which is what makes these editable afterwards instead of baked in.
 *
 * ⚠ `nailer` adds nothing here. A Nailer panel is the standard panel with its
 * own nailer turned on (*"It is indeed the same as a standard panel with
 * nailer added"*), which is a flag on the recipe, not a surgery member.
 */
export function bracePairAddedMembers(options: BracePairOptions): AddedMemberSpec[] {
  const { pattern, widthIn, heightIn, half } = options;
  const wythes = options.wythes ?? (["exterior", "interior"] as PanelWythe[]);
  if (pattern === "nailer") return [];

  const { bottomZIn, topZIn } = recipeClearHeightIn(heightIn);
  const midZIn = (bottomZIn + topZIn) / 2;
  /* The seam edge is the one this panel shares with its partner: the right
     edge of the left panel, the left edge of the right panel. Every leg of
     an X runs from the seam outward, which is what makes the two panels'
     legs line up across it. */
  /* ⚠ Flush with the POSTS, not the panel edges. *"Braces should be flush
     with the post, not the edge of the panel. No overlapping."* A leg run to
     the edge measurably occupies the same space as the corner post standing
     there, so both ends stop at a post's inner face. The two panels' legs
     therefore stop 3in apart across the seam — two post thicknesses — which
     is exactly the material that is in the way. */
  const seamXIn = half === "left" ? widthIn - CORNER_POST_THICKNESS_IN : CORNER_POST_THICKNESS_IN;
  const outerXIn = half === "left" ? CORNER_POST_THICKNESS_IN : widthIn - CORNER_POST_THICKNESS_IN;

  const out: AddedMemberSpec[] = [];
  for (const wythe of wythes) {
    const tag = `${wythe}_${half}`;
    if (pattern === "superbrace") {
      /* Half of the X, plus the return legs to this panel's own outer top
         and bottom corners — the extra diagonals in the sketch that make
         SuperBrace denser than a plain X. */
      out.push(
        {
          kind: "diagonal",
          id: `superbrace_${tag}_x_upper`,
          fromXIn: seamXIn,
          fromZIn: midZIn,
          toXIn: outerXIn,
          toZIn: topZIn,
          wythe,
          notes: "upper leg of the pair's X, meeting its partner at the seam",
        },
        {
          kind: "diagonal",
          id: `superbrace_${tag}_x_lower`,
          fromXIn: seamXIn,
          fromZIn: midZIn,
          toXIn: outerXIn,
          toZIn: bottomZIn,
          wythe,
          notes: "lower leg of the pair's X, meeting its partner at the seam",
        },
      );
    } else {
      /* One long diagonal across the pair — this panel carries its half —
         and the added horizontal tie at mid-height. The tie is an ADDED
         member, not the existing girt: *"additional member via panel
         surgery"*. */
      out.push(
        {
          kind: "diagonal",
          id: `braced_${tag}_diagonal`,
          fromXIn: seamXIn,
          fromZIn: half === "left" ? topZIn : midZIn,
          toXIn: outerXIn,
          toZIn: half === "left" ? midZIn : bottomZIn,
          wythe,
          notes: "this panel's half of the pair's long diagonal",
        },
        ...tieSegments(widthIn, midZIn, wythe, tag),
      );
    }
  }
  return out;
}

/**
 * The horizontal tie, broken around anything standing in its way.
 *
 * ⚠ It cannot be one board edge to edge. The corner posts are let into the
 * same faces, and so is the centre nailer stud a 4ft panel carries, so a tie
 * run straight across measurably occupies the same space as all three. Real
 * carpentry would notch one into the other; nothing in the model can say
 * "housed into", and inventing which member loses material is not mine to
 * decide. Segments between them are buildable and describe themselves.
 */
function tieSegments(widthIn: number, midZIn: number, wythe: PanelWythe, tag: string): AddedMemberSpec[] {
  const blocked: [number, number][] = (
    [
      [0, CORNER_POST_THICKNESS_IN],
      ...centreNailerStudSpansIn(widthIn),
      [widthIn - CORNER_POST_THICKNESS_IN, widthIn],
    ] as [number, number][]
  ).sort((a, b) => a[0] - b[0]);

  const out: AddedMemberSpec[] = [];
  for (let i = 0; i < blocked.length - 1; i++) {
    const fromXIn = blocked[i]![1];
    const toXIn = blocked[i + 1]![0];
    if (toXIn - fromXIn <= 1e-9) continue;
    out.push({
      kind: "straight",
      id: `braced_${tag}_tie_${i}`,
      fromXIn,
      fromZIn: midZIn,
      toXIn,
      toZIn: midZIn,
      wythe,
      notes: "added horizontal tie at mid-height — a surgery member, not the girt; cut in segments between the studs",
    });
  }
  return out;
}

/**
 * ⚠ Two 5/16in GRK 4in screws at EACH END of every diagonal, predrilled.
 *
 * > *"Each end of each 2x4 on the diagonals has 2 5/16" GRKs 4" screws
 * > predrilled and driven into the. Add to materials counts calculators."*
 *
 * So four per leg. The app's existing fastener rule already counts four per
 * brace member, which agrees — but it counts them as **6in** screws, which
 * his number contradicts. See `BRACE_SCREW_LENGTH_IN`.
 */
export const BRACE_SCREWS_PER_END = 2;
export const BRACE_SCREWS_PER_DIAGONAL = BRACE_SCREWS_PER_END * 2;
export const BRACE_SCREW_LENGTH_IN = 4;
export const BRACE_SCREW_DIAMETER_LABEL = "5/16in";
