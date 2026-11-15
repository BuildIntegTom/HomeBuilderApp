import type { PanelMember } from "./componentSchema";
import { sillDefaultHeightIn } from "./data";
import { buildJackStudMembers, jackStudThicknessIn, type JackStudConfig } from "./jackStudMembers";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
  buildHeaderEndStuds,
  buildHeaderSolidBlocking,
  buildHeaderTrussWebBraces,
  computeTrussWebAngleDeg,
  planHeaderWeb,
  type HeaderWebPlan,
} from "./panelMemberHelpers";
import { buildSillPanelMembers } from "./sillPanelMembers";

/**
 * A standard panel's own vertical studs present their 1.5in (thickness)
 * face to an elevation-view viewer, with the 3.5in (width) face running
 * into the wall's own depth (see `buildCornerStuds`). Big Header's own
 * chords are rotated 90deg about their own long axis from that convention
 * (Tommy: "the 3.5in face of the studs, when looking at the wall/panel
 * face from elevation view, face the user... typically we see the 1.5in
 * side on standard panels") — same "roll a board about its own long axis"
 * idea `memberBoxSizeIn`'s own "horizontal, 180deg" case already documents
 * for girt bars, just applied to these flat chord members instead: the
 * board's WIDE edge now faces the viewer, its SHORT edge faces into the
 * wall.
 */
const ROTATED_CHORD_VISIBLE_IN = PLATE_2X4_WIDTH_IN; // 3.5in — now the visible (Z, elevation-facing) dimension
const ROTATED_CHORD_DEPTH_IN = PLATE_2X4_THICKNESS_IN; // 1.5in — now the into-wall (Y) dimension

/**
 * Top + bottom chord 2x4s, on both wythes, plus a plywood cap tying each
 * chord's 2 wythes into one rigid plate — same skin-then-plate layering as
 * `buildHeaderChords`/`buildBigHeaderBeamChords`, except each chord 2x4's
 * own thickness/width are swapped (see ROTATED_CHORD_VISIBLE_IN's own doc
 * comment) so its wide face shows in elevation. The plywood caps
 * themselves are unaffected — they're not "studs," just a thin membrane
 * tying the 2 wythes together, same construction regardless of chord
 * orientation.
 */
function buildBigHeaderChords(widthIn: number, depthIn: number, heightIn: number, jackInsetIn: number): PanelMember[] {
  const members: PanelMember[] = [];
  /**
   * ⚠ **THE CHORDS SPAN BETWEEN THE JACK STUDS, not through them.**
   *
   * They ran the assembly's full width while the two jacks stood at x = 0 and
   * x = width - t over that same full height, so all four chords and both
   * chord caps passed straight through both jacks: 12 interferences, every
   * one of them a board drawn through a post.
   *
   * Which gives way is settled by his own convention rather than by a choice
   * here: *"RO's take into account these jack studs"*, and a window/door
   * slot's width *"represents the WHOLE assembly's footprint (header + jack
   * studs + RO + sill)"*. The jacks are INSIDE the width, so the header is
   * what stops short of them.
   *
   * ⚠ This shortens every Big Header chord on the cut list by two jack
   * thicknesses. That is a correction to a part that could not have been
   * built as drawn, not a change of spec.
   */
  const chordStartXIn = jackInsetIn;
  const chordLengthIn = Math.max(0, widthIn - 2 * jackInsetIn);
  /* ⚠ Which of the two constructions this is — see `platesRunFullWidth` at
     the call site. `jackInsetIn` arrives as 0 for a perpendicular-stuffed
     header, so this reads the geometry rather than taking a second flag that
     could disagree with it. */
  const runsFullWidth = jackInsetIn === 0;
  const spanNote = runsFullWidth
    ? "Cut to the assembly's FULL width: it runs over both jack studs, which stand between the two plates, so the load it gathers lands on them."
    : "Cut to the clear span BETWEEN the two jack studs, not the assembly's full width.";
  const bottomPlyZIn = 0;
  const bottom2x4ZIn = SKIN_THICKNESS_IN;
  const topPlyZIn = heightIn - SKIN_THICKNESS_IN;
  const top2x4ZIn = heightIn - SKIN_THICKNESS_IN - ROTATED_CHORD_VISIBLE_IN;

  for (const [chord, zIn, otherChord] of [
    ["bottom", bottom2x4ZIn, "top"],
    ["top", top2x4ZIn, "bottom"],
  ] as const) {
    for (const [wythe, yIn] of [
      ["ext", 0],
      ["int", depthIn - ROTATED_CHORD_DEPTH_IN],
    ] as const) {
      members.push({
        memberId: `${chord}_chord_2x4_${wythe}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: ROTATED_CHORD_VISIBLE_IN, widthIn: ROTATED_CHORD_DEPTH_IN, lengthIn: chordLengthIn },
        orientation: "flat",
        position: { xIn: chordStartXIn, yIn, zIn, rotationDeg: 0 },
        role: "plate",
        qty: 1,
        notes: `${chord} chord, ${wythe} wythe — rotated 90deg from a standard panel's own stud orientation so its 3.5in face shows in elevation instead of 1.5in; the truss web braces span between this and the ${otherChord} chord. ${spanNote}`,
      });
    }
  }

  for (const [chord, zIn] of [
    ["bottom", bottomPlyZIn],
    ["top", topPlyZIn],
  ] as const) {
    members.push({
      memberId: `${chord}_chord_ply`,
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: chordLengthIn },
      orientation: "flat",
      position: { xIn: chordStartXIn, yIn: 0, zIn, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      notes:
        `${chord} plate plywood cap — this Big Header's own outer face, ties both wythes' ${chord} chord 2x4s into one rigid plate from the inside. ${spanNote}` +
        (runsFullWidth
          ? " It is also the closed face this header is stuffed against: over 48in wide the straw goes in perpendicular, from the end, so the top and bottom have to be skinned."
          : ""),
    });
  }
  return members;
}

/**
 * ⚠ **This Big Header's ends are 2x4 studs now, INBOARD of its two jack
 * studs.** *"Doors and headers and big headers should all follow suit."*
 * (Tommy, 2026-11-01.)
 *
 * They were a full-depth x full-height plywood sheet at each end, which
 * crossed all four chords and both chord caps at the corners, and crossed the
 * jack stud sitting at the very same x as well: 14 of this panel's 26
 * interferences.
 *
 * ⚠ **Set in by a jack stud's thickness**, which is the one difference from
 * a Door or Window header: a Big Header *"come[s]... with two jack studs"*
 * and they occupy x = 0 and x = width - t already. So the order across the
 * end is jack, then edge stud, then the web — which is how the assembly
 * actually goes together.
 */

/** The rise (in) available to the truss web between the chords' plywood-
 * capped facing edges — same formula as `headerWebRiseIn`, but subtracting
 * each chord's own ROTATED (3.5in, not 1.5in) visible height instead, since
 * a rotated chord eats more vertical space per chord. */
export function bigHeaderWebRiseIn(heightIn: number): number {
  return heightIn - 2 * ROTATED_CHORD_VISIBLE_IN - 2 * SKIN_THICKNESS_IN;
}

/**
 * ⚠ **A Big Header's web feet clear its JACK STUD as well as its end stud**,
 * so its end inset is bigger than a Door/Window Header's and it needs more
 * rise before a web fits. The jack is inside the assembly's own width —
 * *"RO's take into account these jack studs"* — so this is read from the
 * jack config rather than assumed.
 */
function bigHeaderEndInsetIn(jackStudConfig: JackStudConfig): number {
  return jackStudThicknessIn(jackStudConfig) + PLATE_2X4_THICKNESS_IN;
}

/**
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠ **OVER 48 INCHES WIDE, A BIG HEADER IS STUFFED PERPENDICULAR.**
 *
 * > *"treat them as a 'standard panel' if they are 48 in or less in elevation
 * > horizontal measurement. If they are greater than 48 in, I think we then
 * > plan on stuffing them in the table. Perpendicular, and so the top and
 * > bottom should have skins elevation view. Since we would be stuffing them
 * > perpendicular to how we would normally stuff a standard panel, the top and
 * > bottom plates should be completely within the panel so that the top and
 * > bottom plate stretch the entire opening. I think that is important.
 * > Structurally."* — Tommy, 2026-11-14
 *
 * ⚠ **The threshold is the WIDTH ALONG THE WALL**, his own confirmation when
 * asked: *"correct"*. So a 60in header is stuffed perpendicular even if it is
 * only 8in tall. Not a height, not an area.
 *
 * ⚠ **At 48in and under, NOTHING changes** — also his answer, *"just the way
 * its stuff and created / as is"*. This is a gate on a second construction,
 * not a replacement for the first.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const BIG_HEADER_PERPENDICULAR_MIN_WIDTH_IN = 48;

/** Whether this Big Header is stuffed perpendicular — see the constant. */
export function bigHeaderIsStuffedPerpendicular(widthIn: number): boolean {
  return widthIn > BIG_HEADER_PERPENDICULAR_MIN_WIDTH_IN;
}

/** What goes between this Big Header's chords — a web, or solid blocking at
 *  the heights where no buildable web exists. Same decision a window or door
 *  header makes (`headerWebPlan`), differing only in the rise a rotated chord
 *  leaves and in the jack stud its feet have to clear. */
export function bigHeaderWebPlan(widthIn: number, heightIn: number, jackStudConfig: JackStudConfig): HeaderWebPlan {
  return planHeaderWeb(widthIn, bigHeaderWebRiseIn(heightIn), bigHeaderEndInsetIn(jackStudConfig));
}

/** How many peaks this Big Header's web gets, and at what angle - the same
 *  pair `headerPeakCount`/`headerWebAngleDeg` give for a window or door
 *  header, differing only in the rise a rotated chord leaves.
 *  ⚠ `jackStudConfig` defaults to `"plywood"`, the app's own default, so the
 *  pre-existing two-argument callers (notes and tests) keep their answer. */
export function bigHeaderPeakCount(
  widthIn: number,
  heightIn: number,
  jackStudConfig: JackStudConfig = "plywood",
): number {
  return bigHeaderWebPlan(widthIn, heightIn, jackStudConfig).peakCount;
}

export function bigHeaderWebAngleDeg(widthIn: number, heightIn: number): number {
  return computeTrussWebAngleDeg(widthIn, bigHeaderWebRiseIn(heightIn), bigHeaderPeakCount(widthIn, heightIn));
}

/**
 * Every physical member of a Big Header — Tommy: "big headers are spawned
 * either in the click-editing wheel or also spawn when a window header
 * exceeds its allowance for having only 1 V shape... they come... with two
 * (⚠ the second half of that is history: a header has as many peaks as it
 * needs since 2026-11-03 and nothing auto-spawns a Big Header any more. It is
 * now simply A HEADER WITH NO OPENING UNDER IT, which is the half of his
 * sentence that still describes it - double doors, large openings and
 * conditioned garages. Tommy: *"Big headers and window headers are really the
 * same thing."*)
 * jack studs... there are no sills with big headers, so they can be used
 * for double doors, large openings, and conditioned garages" (a sill is
 * still available as an opt-in per Tommy's own follow-up: "2 with the
 * option to have a sill under it as an option in the left bar but default
 * not"). Reuses `buildHeaderTrussWebBraces` + `computeTrussWebPeakCount`
 * unchanged (the "however many peaks keep every web segment at or above
 * the 30deg minimum" path, same as a window header/Big Header Beam, NOT
 * the single-peak door path) — a Big Header exists specifically to replace
 * a header that couldn't satisfy the single-peak angle limit, so capping
 * it to 1 peak too would defeat its own purpose. The diagonal braces
 * themselves are NOT rotated (unlike the chords) — `buildHeaderTrussWebBraces`
 * is a shared function reused by every header-like assembly in this app;
 * its own "diagonal, rotationDeg 90" convention already presents a 3.5in-
 * wide face in elevation regardless of caller, so no change was needed
 * there for Tommy's own "3.5in face" request to already hold.
 *
 * `heightIn` is this Big Header's OWN total height (chords + jack studs
 * both span the full `[0, heightIn]` range — unlike a real window/door,
 * a Big Header has no separate opening below it that it sits above; it
 * IS the opening's own header+jack-stud unit). When `includeSill` is set,
 * a sill panel (`sillDefaultHeightIn` tall) is appended BELOW that, at
 * `[-sillDefaultHeightIn.value, 0]` — the caller anchoring this Big Header
 * in world space needs to account for that extra span below its own
 * `heightIn` when a sill is present.
 */
export function buildBigHeaderMembers(
  widthIn: number,
  depthIn: number,
  heightIn: number,
  includeSill: boolean,
  jackStudConfig: JackStudConfig,
): PanelMember[] {
  const bottomChordTopZIn = SKIN_THICKNESS_IN + ROTATED_CHORD_VISIBLE_IN;
  const topChordBottomZIn = heightIn - SKIN_THICKNESS_IN - ROTATED_CHORD_VISIBLE_IN;
  const riseIn = bigHeaderWebRiseIn(heightIn);
  const plan = bigHeaderWebPlan(widthIn, heightIn, jackStudConfig);

  const jackInsetIn = jackStudThicknessIn(jackStudConfig);
  /**
   * ⚠ **THE PLATES RUN THE FULL WIDTH ONCE IT IS STUFFED PERPENDICULAR.**
   *
   * > *"the top and bottom plates should be completely within the panel so
   * > that the top and bottom plate stretch the entire opening. I think that
   * > is important. Structurally."*
   *
   * At or under 48in they stop at the two jack studs' inner faces, which is
   * what they have done since 2026-11-01 and what he confirmed stays. Over
   * 48in they run corner to corner and everything vertical — the jacks and
   * the end studs — fits BETWEEN them.
   *
   * ⚠ **Which is why the jack studs shorten.** His answer when asked whether
   * the plate stops at the jacks or runs past them: *"they are what the jack
   * studs support — jack studs stop and the panel rests on them."* A plate
   * that stops at a jack's inner face delivers nothing to it; one that runs
   * over it does. So the jack stands ON the bottom plate and the top plate
   * rests on the jack, and its height falls out of the two plate stacks
   * rather than being a number anyone picked.
   *
   * ⚠ **The other reading, NOT built, and it is his call.** A beam over a
   * real opening has its jacks BELOW it, carrying it down to the deck, rather
   * than between its own two plates. This assembly has never modelled that —
   * its jacks have always lived inside its own height — and moving them out
   * would need a jack LENGTH, which is the opening's height and is not a
   * number this builder is given. Named rather than guessed.
   */
  const platesRunFullWidth = bigHeaderIsStuffedPerpendicular(widthIn);
  const plateInsetIn = platesRunFullWidth ? 0 : jackInsetIn;
  const members: PanelMember[] = [
    ...buildBigHeaderChords(widthIn, depthIn, heightIn, plateInsetIn),
    ...buildHeaderEndStuds(widthIn, depthIn, bottomChordTopZIn, riseIn, jackInsetIn),
  ];
  if (plan.kind === "blocking") {
    /* Too shallow for a buildable web — a solid beam instead, blocked
       between the chords. See `buildHeaderSolidBlocking`. */
    members.push(
      ...buildHeaderSolidBlocking(widthIn, depthIn, bottomChordTopZIn, topChordBottomZIn, jackInsetIn),
    );
  } else {
    for (const [wythe, yIn] of [
      ["ext", PLATE_2X4_THICKNESS_IN / 2],
      ["int", depthIn - PLATE_2X4_THICKNESS_IN / 2],
    ] as const) {
      members.push(
        /* ⚠ The outermost feet clear the jack AND the edge stud inboard of it,
           not a 3/4in sheet. */
        ...buildHeaderTrussWebBraces(
          plan.peakCount,
          widthIn,
          bottomChordTopZIn,
          topChordBottomZIn,
          yIn,
          `truss_brace_${wythe}`,
          bigHeaderEndInsetIn(jackStudConfig),
        ),
      );
    }
  }

  /* Exactly 2 jack studs (Tommy: "they come... with two jack studs"), same
     construction real window/door jack studs use, flanking this
     self-contained assembly instead of a separate opening below it.

     ⚠ **Between the plates when they run full width**, standing on the
     bottom plate with the top plate resting on them — see
     `platesRunFullWidth`. At 48in and under they still span the assembly's
     own full height beside the plates, unchanged. */
  const jackThicknessIn = jackInsetIn;
  const jackHeightIn = platesRunFullWidth ? topChordBottomZIn - bottomChordTopZIn : heightIn;
  const jackBaseZIn = platesRunFullWidth ? bottomChordTopZIn : 0;
  /* ⚠ A header shorter than its own two plate stacks (2 x 3.5in of rotated
     chord plus 2 x 3/4in of cap, so 8.5in) has no room between them. A jack
     with nowhere to stand is not a jack — the same answer the gable's centre
     stud and the header's own web already give at their floors, rather than a
     zero-length board in the cut list. */
  if (jackHeightIn > 0) {
    members.push(
      ...buildJackStudMembers(depthIn, jackHeightIn, jackStudConfig).map((m) => ({
        ...m,
        memberId: `jack_left_${m.memberId}`,
        position: { ...m.position, zIn: m.position.zIn + jackBaseZIn },
      })),
    );
    members.push(
      ...buildJackStudMembers(depthIn, jackHeightIn, jackStudConfig).map((m) => ({
        ...m,
        memberId: `jack_right_${m.memberId}`,
        position: { ...m.position, xIn: m.position.xIn + widthIn - jackThicknessIn, zIn: m.position.zIn + jackBaseZIn },
      })),
    );
  }

  if (includeSill) {
    const sillHeightIn = sillDefaultHeightIn.value;
    members.push(
      ...buildSillPanelMembers(widthIn, depthIn, sillHeightIn, false).map((m) => ({
        ...m,
        memberId: `sill_${m.memberId}`,
        position: { ...m.position, zIn: m.position.zIn - sillHeightIn },
      })),
    );
  }

  return members;
}
