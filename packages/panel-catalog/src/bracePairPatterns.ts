import type { AddedMemberSpec, PanelWythe } from "./panelRecipe";
import { recipeClearHeightIn } from "./panelRecipe";
import { PLATE_2X4_THICKNESS_IN, centreNailerStudSpansIn } from "./panelMemberHelpers";
import { standardGirtRowCentreZsIn } from "./standardPanelMembers";
import { nailerOverlaySpacingIn } from "./data";

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

/**
 * ⚠ **THE THREE CARROTS — his names, 2026-11-02.**
 *
 * > *"I suppose the names are now Little Carrot and Big Carrot. Little Carrot,
 * > Super Carrot (meaning both). ... no big carrot in pattern but good to have
 * > a name for just the X."*
 *
 * | Figure | Members on THIS panel | What it is |
 * |---|---|---|
 * | `big-carrot` | 2 long | this panel's two legs of the pair's X |
 * | `little-carrot` | 2 short | the load-path diagonals, one off the top plate and one off the bottom |
 * | `super-carrot` | 4 | both of the above |
 *
 * Counted across a PAIR those are 4, 4 and 8, which is where his original
 * *"four total 2x4s ... as a big carrot. Then ... four more 2x4s"* comes from.
 * Per panel and exterior-only they are 2, 2 and 4 — *"Super braced pattern
 * was 8844, is now really more like 4422 since I don't think the interior
 * needs to be braced (happy to be checked on that)."* That parenthesis is his,
 * and it is the one assumption in here he has asked to have checked.
 *
 * `big-carrot` is NOT produced by the pattern. It is named because the X alone
 * needed a name, and because a per-panel brace editor will want to offer it.
 */
export type BraceFigure = "super-carrot" | "big-carrot" | "little-carrot";

export const BRACE_PAIR_PATTERNS: { id: BracePairPattern; label: string; description: string }[] = [
  {
    id: "superbrace",
    label: "Carrot Pattern",
    description:
      "Super Carrot, Super Carrot, Little Carrot, Little Carrot, and repeat \u2014 restarting at the first panel after every window, door or header. A Super Carrot is this panel's two legs of the pair's X plus two short load-path diagonals; a Little Carrot is the two short diagonals alone. Exterior face only.",
  },
  {
    id: "braced",
    label: "Braced Pair",
    description: "One long diagonal across the pair, with an added horizontal tie at mid-height.",
  },
  {
    id: "nailer",
    label: "Vertical Nailers",
    description:
      "No diagonal, and the centre nailer studs stay — straight up-and-down 2x4s on the exterior face for fixing " +
      "shear coverings such as Timber HP or Power Wool. The panel's own studs already sit inside the " +
      `${nailerOverlaySpacingIn.value}in spacing Tommy builds to, so this adds no extra board today; it adds one only ` +
      "to a bay that would otherwise be wider. Adds no racking resistance either way: the covering does that work and this app does not model it.",
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
  /**
   * Which carrot this panel got. Only read when `pattern` is `superbrace`;
   * defaults to the full figure so every existing caller keeps the densest
   * one it already had plus the new short diagonals.
   */
  figure?: BraceFigure;
  /**
   * ⚠ **The Carrot Pattern defaults to the EXTERIOR face only, 2026-11-02.**
   *
   * > *"I guess these super brace patterns could just be for the outside
   * > actually, exterior only. Standard panel style for inside, perhaps ready
   * > to receive edits and nailers somehow."*
   *
   * So the interior face of a braced panel is now an ordinary standard panel
   * face — which is what makes it "ready to receive edits": the recipe system
   * already takes per-panel surgery, and an untouched interior is the thing it
   * can be applied to. The Braced Pair pattern is unchanged and still takes
   * both wythes, because he said nothing about it.
   *
   * Pass an explicit list to override either default.
   */
  wythes?: PanelWythe[];
}

/**
 * The members a pattern adds to ONE panel of a pair.
 *
 * Returns specs rather than members so the caller can put them in a recipe,
 * which is what makes these editable afterwards instead of baked in.
 *
 * ⚠ **`nailer` used to add nothing — B21 gave it its own figure.** It was the
 * standard panel with the single centre nailer flag turned on, which is why
 * the Review Log had to say a Nailer panel modelled no lateral resistance
 * *and* carried nothing to show for the setting. See `verticalNailerSpecs`.
 */
export function bracePairAddedMembers(options: BracePairOptions): AddedMemberSpec[] {
  const { pattern, widthIn, heightIn, half } = options;
  const figure = options.figure ?? "super-carrot";
  /* ⚠ Both the Carrot Pattern and the Vertical Nailer overlay are EXTERIOR
     ONLY — *"these super brace patterns could just be for the outside
     actually"* and *"just on the exterior"*. Only the Braced Pair takes both
     wythes, because he has said nothing about it. */
  const wythes =
    options.wythes ?? ((pattern === "braced" ? ["exterior", "interior"] : ["exterior"]) as PanelWythe[]);
  if (pattern === "nailer") return wythes.flatMap((wythe) => verticalNailerSpecs(widthIn, heightIn, wythe));

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
      if (figure !== "little-carrot") {
        /* The BIG CARROT: this panel's two legs of the pair's X, meeting their
           partners at the seam. Unchanged since 2026-10-24 — he confirmed it
           by drawing over it: *"This pic depicts one panel is blue, one panel
           in purple with just the exterior highlighted just as it does in the
           app today. I'm saying let's add the yellow pieces."* */
        out.push(
          {
            kind: "diagonal",
            id: `big_carrot_${tag}_upper`,
            fromXIn: seamXIn,
            fromZIn: midZIn,
            toXIn: outerXIn,
            toZIn: topZIn,
            wythe,
            notes: "upper leg of the pair's X (Big Carrot), meeting its partner at the seam",
          },
          {
            kind: "diagonal",
            id: `big_carrot_${tag}_lower`,
            fromXIn: seamXIn,
            fromZIn: midZIn,
            toXIn: outerXIn,
            toZIn: bottomZIn,
            wythe,
            notes: "lower leg of the pair's X (Big Carrot), meeting its partner at the seam",
          },
        );
      }
      if (figure !== "big-carrot") {
        out.push(...littleCarrotSpecs(widthIn, heightIn, seamXIn, wythe, tag));
      }
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
 * **THE VERTICAL NAILER OVERLAY — B21.**
 *
 * > *"Vertical nailers is actually a totally different bracing pattern
 * > overlay. Let's make that a button that turns all of the panels into
 * > straight up and down 2x4s just on the exterior."* — Tommy, 2026-11-02
 *
 * Before this, `nailer` was the one "pattern" that added nothing: it was the
 * standard panel with its single centre-nailer flag on, so the button changed
 * a label and a Review Log sentence and not one member. This is the overlay.
 *
 * ⚠ **AT HIS CONFIRMED 24in THIS ADDS NO BOARDS, AND THAT IS THE POINT.**
 *
 * > *"The way I want to build these is 24\" spacing, which works well enough
 * > for lumber and sheet goods. We can drop 16\" being meaningful."*
 * > — Tommy, 2026-11-04, after being told 24in or more is a no-op
 *
 * `MAX_STUD_SPACING_IN` already puts a vertical every 24in so a floor or roof
 * seam lands on a stud, so every panel this app draws already meets his
 * number. What stays here is a GUARANTEE rather than a generator: the nailer
 * rule and the stud rule are two different rules that happen to agree today,
 * and encoding both means the day they diverge a wall gets nailers instead of
 * silently going unnailable. Nothing here invents wood his shop does not cut.
 *
 * So what Vertical Nailers MEANS, at his number, is "no diagonals, and the
 * centre nailer studs stay" — a real difference from the Carrot Pattern,
 * which deletes those studs to make room for its legs.
 *
 * ⚠ **THE NAILERS GO IN THE BAYS THE PANEL ALREADY HAS, NOT ON A FRESH GRID.**
 * A standard panel's exterior face already carries verticals: a corner post at
 * each edge, and a centre nailer stud wherever `MAX_STUD_SPACING_IN` demands
 * one. A grid laid from x = 0 would land a nailer an inch off a stud that is
 * already standing there — two members fighting for one groove, which is what
 * [[no_overlapping_members]] exists to stop, and a detail no shop could build.
 * So each existing clear bay is divided into the FEWEST equal sub-bays that
 * bring every face-to-face gap under the spacing, and a nailer goes on each
 * interior division. The result is symmetric, collides with nothing, and
 * reduces to "add nothing" on a panel whose bays are already close enough.
 *
 * ⚠ **They stop at the plate faces, exactly as a centre nailer stud does.**
 * *"A centre nailer is a real stud: it sits ON the bottom plate and the top
 * plate sits on IT."* A full-height nailer would run straight through both
 * plates. The sheet still gets fixing top and bottom, because the plates are
 * themselves 2x4s standing at the face. One consequence worth knowing: the
 * overlay's nailers are the IDENTICAL cut to the centre nailer studs, so the
 * cut list groups them under one letter and raises its quantity rather than
 * printing a second row — which is `cutKey`'s deliberate rule, *"a shop
 * cutting a batch of those doesn't care which role a given stick ends up
 * filling."*
 *
 * ⚠ **`role: "nailer"`, not `"stud"`, and that is load-bearing in one place:**
 * shear reads `role === "brace"`, so these contribute nothing to racking.
 * That is the truth — a vertical does not resist racking; the covering nailed
 * to it does, and this app does not model coverings. A Vertical Nailer
 * building still reports 0 lb of shear capacity and the Review Log still says
 * so.
 */
export function verticalNailerSpecs(
  widthIn: number,
  heightIn: number,
  wythe: PanelWythe = "exterior",
  /** The gap to stay under. Defaults to his confirmed 24in. Exposed so the
   *  subdivision rule stays exercised at a spacing that actually bites — see
   *  the note above about a guarantee the panel happens to meet today. */
  spacingIn: number = nailerOverlaySpacingIn.value,
): AddedMemberSpec[] {
  const { bottomZIn, topZIn } = recipeClearHeightIn(heightIn);
  if (topZIn - bottomZIn <= 0) return [];
  if (!(spacingIn > 0)) return [];

  /* Everything already standing up this face, as [start, end] in x. */
  const occupied: [number, number][] = [
    [0, PLATE_2X4_THICKNESS_IN],
    ...centreNailerStudSpansIn(widthIn),
    [widthIn - PLATE_2X4_THICKNESS_IN, widthIn],
  ].sort((a, b) => a[0] - b[0]) as [number, number][];

  const out: AddedMemberSpec[] = [];
  let n = 0;
  for (let i = 0; i < occupied.length - 1; i++) {
    const bayFromIn = occupied[i]![1];
    const bayToIn = occupied[i + 1]![0];
    const bayIn = bayToIn - bayFromIn;
    if (bayIn <= 0) continue;
    /* The fewest equal sub-bays that get every gap under the spacing. Each
       sub-bay is at most bayIn / subBays wide before the nailers' own 1.5in
       is taken out of it, so this is conservative in the safe direction. */
    const subBays = Math.max(1, Math.ceil(bayIn / spacingIn - 1e-9));
    for (let k = 1; k < subBays; k++) {
      const centreXIn = bayFromIn + (bayIn * k) / subBays;
      const leftXIn = centreXIn - PLATE_2X4_THICKNESS_IN / 2;
      n++;
      out.push({
        kind: "straight",
        id: `nailer_v_${wythe}_${n}`,
        fromXIn: leftXIn,
        fromZIn: bottomZIn,
        toXIn: leftXIn,
        toZIn: topZIn,
        wythe,
        role: "nailer",
        notes: `vertical nailer — keeps every face-to-face gap on this wythe at or under ${spacingIn}in for fixing a shear covering`,
      });
    }
  }
  return out;
}

/** How near a girt has to be before the short diagonal lands ON it instead of
 *  stopping beside it. His *"within a couple inches"*. */
const GIRT_SNAP_IN = 2;

/** A quarter of the clear height down from the plate — his stated target for
 *  the short diagonal's tip when no girt is near enough to claim it. */
const LITTLE_CARROT_HEIGHT_FRACTION = 0.25;

/**
 * **THE LITTLE CARROT — the yellow pieces in his 2026-11-02 sketch.**
 *
 * > *"the one additional 2x4 diagonal on each side on the top that help carry
 * > the load of the roof panel above it in the center (presumably 4' walls and
 * > 2' roof panels) and two on the bottom that help carry it to the floor
 * > panel (2' floor panels, one lands in the center of the wall)."*
 *
 * > *"The top pair lands its center[ed] on the top plate of the panel, with its
 * > diagonal's tip touching the top [girt] or 1/4 of the way down from the top
 * > if the other [girt] is not within a couple inches for interfering. ... Then
 * > the third and fourth pair are just like the first two pairs except on the
 * > bottom half of the panel."*
 *
 * ⚠ **This is a LOAD PATH, not shear, and the geometry is why.** Walls are
 * 48in and floor/roof panels are 24in, so a roof panel seam lands dead centre
 * on the top plate of every wall panel and a floor panel seam lands dead centre
 * under the bottom plate. Each diagonal starts at that seam and runs down-and-
 * OUTWARD, away from the pair's own seam, spreading the point load toward the
 * panel's supported edge. The direction is his: in the sketch the left panel's
 * pieces run left and the right panel's run right.
 *
 * On a 48in x 120in panel each one measures about 3ft, which is his *"maybe 2
 * or 3 ft long"*.
 *
 * ⚠ **IT RUNS TOWARD THE SEAM, AND HIS SKETCH RUNS IT THE OTHER WAY.** This
 * is a deliberate, reported deviation, not a misreading. Drawn outward — from
 * the top-plate centre down toward the panel's outer edge — it measurably
 * CROSSES the Big Carrot's upper leg, which on a 48 x 120in panel runs from the
 * seam post at mid-height up to the outer post at the top plate. Checked
 * numerically: at the panel's mid-width the X leg is at z 89.5 and the outward
 * carrot at z 119; at the outer post they have swapped. Two 2x4s let into the
 * same straw groove cannot cross — *"It doesn't make sense to allow any
 * overlapping because these need to [be] possible to build."*
 *
 * Toward the seam it fits the triangle the X's own upper leg leaves open, does
 * the same job (the load still reaches an edge stud and goes to the floor), and
 * keeps the same ~3ft length. `overlappingPairsIn` is clean on a Super Carrot.
 *
 * It also matches his FIRST description better than the sketch does —
 * *"the one additional 2x4 diagonal on each side on the top"* — since the two
 * panels of a pair now bring their top carrots down to the shared seam, one
 * from each side.
 *
 * ⚠ **Only a Super Carrot has anything to collide with.** A Little Carrot
 * panel carries no X, so the outward direction is free there. It is routed the
 * same way regardless, because one figure that reads identically on every panel
 * beats two that differ for a reason nobody can see on the shop drawing.
 *
 * ⚠ The tip stops at the seam post's inner face, not the panel edge, for the
 * same reason the X legs do — *"Braces should be flush with the post, not the
 * edge of the panel."*
 */
function littleCarrotSpecs(
  widthIn: number,
  heightIn: number,
  towardXIn: number,
  wythe: PanelWythe,
  tag: string,
): AddedMemberSpec[] {
  const { bottomZIn, topZIn } = recipeClearHeightIn(heightIn);
  const clearIn = topZIn - bottomZIn;
  const girtZs = standardGirtRowCentreZsIn(heightIn);

  /* The tip height: a quarter of the clear height in from the plate, unless a
     girt sits within a couple of inches of that, in which case it lands on the
     girt rather than stopping just shy of one and interfering with it. */
  const tipZFor = (plateZIn: number, towardIn: number) => {
    const target = plateZIn + towardIn * LITTLE_CARROT_HEIGHT_FRACTION * clearIn;
    let best: number | undefined;
    for (const z of girtZs) {
      if (Math.abs(z - target) > GIRT_SNAP_IN) continue;
      if (best === undefined || Math.abs(z - target) < Math.abs(best - target)) best = z;
    }
    return best ?? target;
  };

  /* The seam the roof and floor panels land on: the centre of this panel's own
     top and bottom plates. Not the pair's seam. */
  const seamOverPlateXIn = widthIn / 2;

  return [
    {
      kind: "diagonal",
      id: `little_carrot_${tag}_top`,
      fromXIn: seamOverPlateXIn,
      fromZIn: topZIn,
      toXIn: towardXIn,
      toZIn: tipZFor(topZIn, -1),
      wythe,
      notes: "Little Carrot: carries the roof panel seam landing on this panel's top-plate centre out to the supported edge",
    },
    {
      kind: "diagonal",
      id: `little_carrot_${tag}_bottom`,
      fromXIn: seamOverPlateXIn,
      fromZIn: bottomZIn,
      toXIn: towardXIn,
      toZIn: tipZFor(bottomZIn, 1),
      wythe,
      notes: "Little Carrot: carries this panel's bottom-plate centre down into the floor panel seam below",
    },
  ];
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
