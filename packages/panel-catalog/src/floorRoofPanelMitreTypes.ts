/**
 * How far a mitred floor or roof panel is pulled back from its rectangle at
 * each of its four plan corners, in inches along Z.
 *
 * ⚠ **Its own module, and the reason is an import cycle this repo has already
 * paid for.** `roofPlanMitre.ts` cuts a roof panel's members and
 * `floorRoofPanelMembers.ts` builds them, so the builder imports the cutter —
 * which means the cutter cannot import the builder for the one type and the
 * one constant it needs. A leaf module holding both is the fix, and
 * `floorRoofPanelMembers.ts` re-exports them so no caller has to know.
 * See `AGENTS.md` on `PLATE_2X4_THICKNESS_IN`, where exactly this shape took
 * the dev server down while `tsc`, `vitest` and lint all passed.
 */
export interface FloorRoofPanelMitre {
  /** At the span's START (z = 0): the pull-back at x = 0 and at x = widthIn. */
  startNearIn: number;
  startFarIn: number;
  /** At the span's END (z = lengthIn), measured back from that end. */
  endNearIn: number;
  endFarIn: number;
}

/** Nothing cut back: what every rectangle gets, and the identity for a merge. */
export const NO_FLOOR_ROOF_MITRE: FloorRoofPanelMitre = {
  startNearIn: 0,
  startFarIn: 0,
  endNearIn: 0,
  endFarIn: 0,
};
