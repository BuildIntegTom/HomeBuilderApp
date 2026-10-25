import type { AddedMemberSpec, PanelWythe } from "./panelRecipe";
import { type BracePairPattern, bracePairAddedMembers } from "./bracePairPatterns";

/**
 * Laying a bracing pattern across a whole wall.
 *
 * > *"Just do it till it ends starting at least accessable side."* — Tommy,
 * > 2026-10-25, on where pairing starts and what the odd panel gets
 *
 * > *"Just per wall start to finish whatever pattern is chosen."* — on
 * > whether a pair ever straddles a corner. It does not.
 */

/** One panel on the wall, in wall order. */
export interface BraceablePanel {
  id: string;
  widthIn: number;
  heightIn: number;
  /** False for anything a brace cannot be routed into — a safety gap's
   * plywood spacer, a corner post, an opening's header. ⚠ The caller decides
   * this; inventing an eligibility rule here would bury a building decision
   * in a geometry module. */
  eligible: boolean;
}

export interface WallBracingOptions {
  pattern: BracePairPattern;
  /** In wall order, start corner to end corner. */
  panels: BraceablePanel[];
  /** Which end of the wall is nearest the least accessible corner — where
   * pairing starts. `computeGapEnd` answers the opposite question for safety
   * gaps, so this is taken as an argument rather than re-derived here. */
  startFrom: "start" | "end";
  wythes?: PanelWythe[];
}

export interface BracePair {
  leftPanelId: string;
  rightPanelId: string;
}

export interface WallBracingResult {
  /** What to add to each panel. Panels that got nothing are absent. */
  addedByPanelId: Record<string, AddedMemberSpec[]>;
  pairs: BracePair[];
  /** ⚠ Panels that ended a run without a partner. They still get a half
   * pattern — see `applyWallBracingPattern` — and knowing which they are is
   * what lets a UI mark them. */
  unpairedPanelIds: string[];
  /** Eligible panels, in the order they were walked. Useful for showing the
   * user where the pattern started. */
  walkedPanelIds: string[];
}

/**
 * Pair a wall's panels from the least accessible end and give each one its
 * share of the pattern.
 *
 * ⚠ **A run of pairs breaks at anything ineligible.** Two panels either side
 * of a corner post are not a pair: every leg of an X runs to the seam the two
 * panels share, and panels separated by a third thing share no seam. So
 * pairing restarts after each ineligible panel rather than reaching over it.
 *
 * ⚠ **An unpaired panel still gets half a pattern.** *"Just do it till it
 * ends"* — so the last panel of an odd run takes the same legs it would have
 * taken with a partner. They brace that panel perfectly well; what they do
 * not do is meet anything at the seam, which is why those panels are
 * reported separately rather than quietly looking like the rest.
 */
export function applyWallBracingPattern(options: WallBracingOptions): WallBracingResult {
  const ordered = options.startFrom === "start" ? options.panels : [...options.panels].reverse();

  const addedByPanelId: Record<string, AddedMemberSpec[]> = {};
  const pairs: BracePair[] = [];
  const unpairedPanelIds: string[] = [];
  const walkedPanelIds: string[] = [];

  /* Split into runs of consecutive eligible panels, then pair within a run. */
  let run: BraceablePanel[] = [];
  const flush = () => {
    for (let i = 0; i < run.length; i += 2) {
      const left = run[i]!;
      const right = run[i + 1];
      walkedPanelIds.push(left.id);
      addedByPanelId[left.id] = bracePairAddedMembers({
        pattern: options.pattern,
        widthIn: left.widthIn,
        heightIn: left.heightIn,
        half: "left",
        wythes: options.wythes,
      });
      if (!right) {
        unpairedPanelIds.push(left.id);
        continue;
      }
      walkedPanelIds.push(right.id);
      addedByPanelId[right.id] = bracePairAddedMembers({
        pattern: options.pattern,
        widthIn: right.widthIn,
        heightIn: right.heightIn,
        half: "right",
        wythes: options.wythes,
      });
      pairs.push({ leftPanelId: left.id, rightPanelId: right.id });
    }
    run = [];
  };

  for (const panel of ordered) {
    if (panel.eligible) run.push(panel);
    else flush();
  }
  flush();

  return { addedByPanelId, pairs, unpairedPanelIds, walkedPanelIds };
}
