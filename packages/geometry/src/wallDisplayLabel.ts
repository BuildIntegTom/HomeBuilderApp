import { wallCompassDirection, type CompassDirection } from "./wallCompassDirection";
import type { Footprint } from "./types";

/**
 * WHAT A WALL IS CALLED ON SCREEN — Tommy, 2026-10-18:
 *
 * > *"Labeling walls Ab, BC etc. makes it difficult for me to conceptualize
 * > which elevation view I want to look at and which wall is which wall. Can we
 * > change AB to just simply be N? BC to E? Etc. octagons would have N, NE, E,
 * > etc. these labels would affect the elevation view titles than anything else
 * > that's relevant like that"*
 *
 * ⚠ **The naming already existed; what was missing was using it on screen.**
 * `wallCompassDirection` has done exactly this since before he asked —
 * exterior face normal snapped to one of eight, screen-up treated as North,
 * and an octagon's mitered walls landing on the intercardinal between their
 * two neighbours. The shop has been reading it for a while (panel names `N1`,
 * `N2`, and the spanning-header sheets saying *"East wall — spans E4, E5"*).
 * The EDITOR was the only place still showing the internal wall id, so the app
 * had two vocabularies and handed the shop the better one.
 *
 * ⚠ **`wall.id` is a KEY, not a label, and nothing here renames it.** `AB` and
 * `BC` key the saved project's `slotsByStoryAndWallId`, its stopped slots, run
 * stops, box-beam coverage, mid-wall beams, locked-width records and the undo
 * history. Renaming them would be a schema migration and a compatibility break
 * for every saved project, to fix a display problem. This is a label DERIVED
 * from the id, which is the same relationship the panel names already have.
 */

/**
 * The suffix for the second and later walls facing the same direction.
 *
 * Any bump-out gives a building two north-facing walls, and a courtyard ring
 * will give it several. Tommy picked this form on 2026-10-18 from three
 * options: `N` and `N2` (this), `N (1 of 2)`, and `N-left` / `N-right`.
 *
 * ⚠ **The first one carries no number**, so a plain rectangle or octagon — the
 * only shapes where every direction is unique — reads exactly as he asked:
 * `N`, `E`, `S`, `W`, and `N`, `NE`, `E`, `SE`, … It is only the shapes that
 * genuinely need disambiguating that show a number.
 *
 * Numbered in `footprint.walls` order, which is the ring order the corner ids
 * already follow, so the numbers run around the building the same way the
 * letters do rather than by distance or by accident of iteration.
 */
function suffixed(direction: CompassDirection, ordinal: number): string {
  return ordinal === 0 ? direction : `${direction}${ordinal + 1}`;
}

/**
 * Every wall's display label, keyed by wall id.
 *
 * Computed for the whole footprint at once because the numbering is only
 * decidable from the complete set — a wall cannot know whether it is the only
 * north-facing one.
 */
export function wallDisplayLabelsByWallId(footprint: Footprint): Record<string, string> {
  const seen = new Map<CompassDirection, number>();
  const out: Record<string, string> = {};
  for (const wall of footprint.walls) {
    const direction = wallCompassDirection(wall, footprint);
    const ordinal = seen.get(direction) ?? 0;
    seen.set(direction, ordinal + 1);
    out[wall.id] = suffixed(direction, ordinal);
  }
  return out;
}

/**
 * One wall's display label.
 *
 * ⚠ Still derived from the whole footprint, for the numbering reason above. A
 * caller labelling every wall should use `wallDisplayLabelsByWallId` rather
 * than calling this in a loop, which would rebuild the map per wall.
 */
export function wallDisplayLabel(footprint: Footprint, wallId: string): string | null {
  return wallDisplayLabelsByWallId(footprint)[wallId] ?? null;
}

/**
 * The label with the wall id in parentheses — `N2 (CD)`.
 *
 * For anywhere a person may have to trace a label back to a drawing, a saved
 * file or a conversation held before this change: the Review Log, refusal
 * notices, and the elevation title. The compass name is what he reads; the id
 * is what the file and the code still call it.
 */
export function wallDisplayLabelWithId(footprint: Footprint, wallId: string): string {
  const label = wallDisplayLabel(footprint, wallId);
  return label === null ? wallId : `${label} (${wallId})`;
}
