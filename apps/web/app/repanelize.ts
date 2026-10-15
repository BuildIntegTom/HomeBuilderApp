import type { PanelSlot } from "@building-integrity/geometry";

/**
 * REPANELIZE R3 — what a re-panelization would actually do, worked out
 * BEFORE the user is asked to approve it.
 *
 * Tommy, 2026-10-07: *"perhaps have a 'Are you sure? This will retile over
 * any hand edits that have been made' or something like that."*
 *
 * ⚠ **The confirmation must not lie, and the obvious wording does.** "This
 * will retile over any hand edits" is false when there are none, and a
 * warning that cries wolf on a project with nothing to lose teaches the user
 * to click through the one that matters. So the comparison is run first and
 * the sentence is built from the answer.
 *
 * The comparison costs one tiling pass, which is exactly the work this app
 * did on EVERY edit until the 2026-10-06 capture fix, so it is affordable
 * for something the user asks for by name.
 */

/**
 * What a wall looks like for the purpose of "would this change?".
 *
 * Type and width per slot, in order. ⚠ Deliberately NOT the whole slot: a
 * window's `heightIn`/`sillHeightIn`, a braced panel's pattern and the
 * carried `anchorOffsetIn` all ride through a re-tile untouched, so
 * including them would report a change where the user would see none.
 * `secondaryType` IS included — a safety gap that has absorbed a braced
 * panel is visibly a different part.
 */
export function wallSignature(slots: readonly PanelSlot[]): string {
  return slots.map((s) => `${s.type}${s.secondaryType ? "+" + s.secondaryType : ""}:${s.widthIn}`).join("|");
}

/** The ids of the walls a re-panelization would rebuild differently from
 * what is on screen now. */
export function wallsThatWouldChange(
  current: Record<string, PanelSlot[]>,
  next: Record<string, PanelSlot[]>,
): string[] {
  const ids = new Set([...Object.keys(current), ...Object.keys(next)]);
  const changed: string[] = [];
  for (const id of ids) {
    if (wallSignature(current[id] ?? []) !== wallSignature(next[id] ?? [])) changed.push(id);
  }
  return changed.sort();
}

export interface RepanelizePrognosis {
  changedWallIds: string[];
  totalWalls: number;
}

/**
 * The sentence the user is asked to approve.
 *
 * ⚠ Three different true things, because one sentence cannot cover them:
 * nothing would change, some walls would, or every wall would. The first
 * case is the one the generic warning gets wrong.
 *
 * Openings are mentioned in the second and third because of the 2026-10-10
 * decision — a re-tile may MOVE an opening (measured up to 19in) though it
 * may never resize one. Learning that by noticing a window has shifted is
 * exactly the kind of surprise this whole feature exists to prevent.
 */
export function repanelizeConfirmation({ changedWallIds, totalWalls }: RepanelizePrognosis): string {
  const n = changedWallIds.length;
  if (n === 0) {
    const already = totalWalls === 1 ? "wall already matches" : "walls already match";
    return `Nothing would change — all ${totalWalls} ${already} the current settings. Repanelizing is safe but pointless.`;
  }
  const wallWord = n === 1 ? "wall" : "walls";
  const scope = n === totalWalls ? `all ${n} ${wallWord}` : `${n} of ${totalWalls} ${wallWord}`;
  return (
    `Repanelize will rebuild ${scope} from the current settings. ` +
    `Hand-set panel widths, inserted panels and panel types on ${n === 1 ? "that wall" : "those walls"} will be replaced. ` +
    `Windows and doors keep their sizes, but may shift position along the wall.`
  );
}

/**
 * The sentence for repanelizing ONE wall.
 *
 * Tommy asked for this after the whole-building version shipped: a wall you
 * are looking at, rebuilt from current settings, without touching the hand
 * edits on every other wall.
 *
 * ⚠ Same rule as `repanelizeConfirmation` — **it must not warn about losing
 * work that does not exist.** A wall already matching the settings loses
 * nothing, and saying otherwise on the wall the user is staring at is the
 * fastest way to teach them that this dialog lies.
 *
 * ⚠ And it says what it does NOT do, which the building-wide one has no need
 * to: the whole point of reaching for this instead of Repanelize is that the
 * rest of the building is left alone, and a user cannot act on that guarantee
 * unless it is stated.
 */
export function repanelizeWallConfirmation(wallId: string, wouldChange: boolean): string {
  if (!wouldChange) {
    return `Nothing would change — wall ${wallId} already matches the current settings. Repanelizing it is safe but pointless.`;
  }
  return (
    `Repanelize will rebuild wall ${wallId} from the current settings, and no other wall. ` +
    `Hand-set panel widths, inserted panels and panel types on this wall will be replaced. ` +
    `Windows and doors keep their sizes, but may shift position along the wall.`
  );
}
