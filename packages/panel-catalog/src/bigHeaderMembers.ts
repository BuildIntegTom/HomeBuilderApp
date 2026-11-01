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
  buildHeaderTrussWebBraces,
  computeTrussWebPeakCount,
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
        notes: `${chord} chord, ${wythe} wythe — rotated 90deg from a standard panel's own stud orientation so its 3.5in face shows in elevation instead of 1.5in; the truss web braces span between this and the ${otherChord} chord.`,
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
      notes: `${chord} plate plywood cap — this Big Header's own outer face, ties both wythes' ${chord} chord 2x4s into one rigid plate from the inside. Cut to the clear span BETWEEN the two jack studs, not the assembly's full width.`,
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
function bigHeaderWebRiseIn(heightIn: number): number {
  return heightIn - 2 * ROTATED_CHORD_VISIBLE_IN - 2 * SKIN_THICKNESS_IN;
}

/**
 * Every physical member of a Big Header — Tommy: "big headers are spawned
 * either in the click-editing wheel or also spawn when a window header
 * exceeds its allowance for having only 1 V shape... they come... with two
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
  const peakCount = computeTrussWebPeakCount(widthIn, riseIn);

  const jackInsetIn = jackStudThicknessIn(jackStudConfig);
  const members: PanelMember[] = [
    ...buildBigHeaderChords(widthIn, depthIn, heightIn, jackInsetIn),
    ...buildHeaderEndStuds(widthIn, depthIn, bottomChordTopZIn, riseIn, jackInsetIn),
  ];
  for (const [wythe, yIn] of [
    ["ext", PLATE_2X4_THICKNESS_IN / 2],
    ["int", depthIn - PLATE_2X4_THICKNESS_IN / 2],
  ] as const) {
    members.push(
      /* ⚠ The outermost feet clear the jack AND the edge stud inboard of it,
         not a 3/4in sheet. */
      ...buildHeaderTrussWebBraces(
        peakCount,
        widthIn,
        bottomChordTopZIn,
        topChordBottomZIn,
        yIn,
        `truss_brace_${wythe}`,
        jackInsetIn + PLATE_2X4_THICKNESS_IN,
      ),
    );
  }

  // Exactly 2 jack studs (Tommy: "they come... with two jack studs"), each
  // spanning this Big Header's own full height — same construction real
  // window/door jack studs use (buildJackStudMembers), just flanking this
  // self-contained assembly directly instead of a separate opening below it.
  const jackThicknessIn = jackInsetIn;
  members.push(
    ...buildJackStudMembers(depthIn, heightIn, jackStudConfig).map((m) => ({ ...m, memberId: `jack_left_${m.memberId}` })),
  );
  members.push(
    ...buildJackStudMembers(depthIn, heightIn, jackStudConfig).map((m) => ({
      ...m,
      memberId: `jack_right_${m.memberId}`,
      position: { ...m.position, xIn: m.position.xIn + widthIn - jackThicknessIn },
    })),
  );

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
