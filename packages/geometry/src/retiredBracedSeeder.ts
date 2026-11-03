import type { BracePattern, PanelSlot } from "./types";

/**
 * ⚠ **THE RETIRED AUTOMATIC BRACING RULES, KEPT AS A TEST FIXTURE BUILDER
 * ONLY. Nothing in the app calls this, and it is deliberately NOT exported
 * from `index.ts`.**
 *
 * This is `applyBracedPlacement` as it stood until 2026-11-02, copied
 * verbatim. Both of its rules — one brace walking inward from each end of the
 * wall, plus another every `seismicBracedPanelSpacingFt[zone]` along the plain
 * run — were retired in B17 (Tommy: *"We can retire near corner braces because
 * the super brace pattern should inherently provide the same structural shear
 * value"* / *"we're replacing it with something better"*). The record of why
 * lives at the top of `bracedPlacement.ts`.
 *
 * **Why keep a copy at all, rather than deleting these tests' fixtures with
 * the rule?** Two of this package's largest pinned sweeps — the locked-width
 * re-force sweep and the braced-placement product sweep — are not about
 * bracing. They are about whether a wall's panel widths still sum to its own
 * length (Tommy, 2026-09-29: *"this app needs to be perfectly tight with
 * dimensions and wall lengths"*) across every wall length, corner config and
 * opening set, **on a wall that has braced panels scattered through it**. A
 * `braced` slot is still an entirely ordinary thing for a wall to carry — the
 * user types them with the panel type control, a tall wall's upper row still
 * gets them from `applyAdditionalRowBracedPattern`, and every project file
 * written before today has them. So the input stays realistic and the sweeps
 * keep their meaning.
 *
 * Keeping it verbatim has a second, concrete payoff: the pinned case counts in
 * those sweeps did not move, so the numbers there still measure the same space
 * they were measured over, and a future change to them means something.
 *
 * ⚠ **Do not reach for this to put braces back into the app.** If automatic
 * bracing ever returns it will be derived from the wall brace pattern and from
 * a real demand figure (see the derivation sheet, B18), not from a zone
 * lookup — and it will not look like this.
 */
export function seedRetiredBracedPlacement(
  slots: PanelSlot[],
  spacingIn: number,
  defaultPattern: BracePattern,
  defaultMirrored: boolean,
): PanelSlot[] {
  const result = slots.map((s) => ({ ...s }));

  // Rule 1: 1 braced panel touching each corner, walking inward past any gap
  // panel. An already-braced slot satisfies the requirement without being
  // touched; a non-standard slot other than a gap stops the walk.
  const markNearestBraceable = (start: number, step: number, count: number) => {
    let marked = 0;
    for (let i = start; i >= 0 && i < result.length && marked < count; i += step) {
      const slot = result[i]!;
      if (slot.type === "braced") {
        marked++;
      } else if (slot.type === "standard") {
        slot.type = "braced";
        slot.bracedPattern = defaultPattern;
        slot.bracedMirrored = defaultMirrored;
        marked++;
      }
    }
  };
  markNearestBraceable(0, 1, 1);
  markNearestBraceable(result.length - 1, -1, 1);

  // Rule 2: periodic braced panel every `spacingIn`. Corner and already-braced
  // slots reset the count; an opening does not, so the requirement carries
  // forward to the next standard slot instead of being dropped.
  let cumulativeIn = 0;
  for (let i = 0; i < result.length; i++) {
    const slot = result[i]!;
    if (slot.type === "corner" || slot.type === "braced") {
      cumulativeIn = 0;
      continue;
    }
    cumulativeIn += slot.widthIn;
    if (cumulativeIn >= spacingIn && slot.type === "standard") {
      slot.type = "braced";
      slot.bracedPattern = defaultPattern;
      slot.bracedMirrored = defaultMirrored;
      cumulativeIn -= spacingIn;
    }
  }

  return result;
}
