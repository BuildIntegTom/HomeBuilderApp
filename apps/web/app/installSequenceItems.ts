import type { InstallPhase, InstallSequenceItem } from "@building-integrity/panel-catalog";

/**
 * ⚠ **TURNING THE BUILDING'S EIGHT EXPORT PIPELINES INTO ONE INSTALL ORDER —
 * B35, 2026-11-16.**
 *
 * `installSequence` (panel-catalog) sorts. `installRingWallOrder` (geometry)
 * answers *"from the point of least accessibility, clockwise, out to in"*.
 * This is the join between them: which phase each pipeline installs in, and
 * which of them carry a real position.
 *
 * ⚠ **It is its own module because every ordering fault in B35 was here, and
 * none of them was visible to a test while it lived inside a `useMemo`.** All
 * four were found by reading 86 chips off a shop packet in the browser. Three
 * are the same shape and the shape is worth stating once:
 *
 * > **A fabrication group gathers physically IDENTICAL panels, so an export's
 * > own order is SHAPE order, not building order.** Two panels at opposite
 * > ends of a run share a group and come out adjacent.
 *
 * Which is why a family with real positional data must use it, and a family
 * without one must say so rather than defaulting to zero.
 */

/** Where a wall panel sits, as the caller already knows it. */
export interface WallSlotPosition {
  storyIndex: number;
  ringIndex: number;
  wallIndex: number;
  /** ⚠ The TILE index, already unfolded — see `installSlotIndex`. */
  slotIndex: number;
  bandIndex: number;
}

/** Where a piece sits along a run or a ring, for the families that know. */
export interface RunPosition {
  wallIndex: number;
  slotIndex: number;
}

/**
 * ⚠ **A GABLE TILE'S `slotIndexInWall` IS NEGATIVE AND COUNTS DOWN.**
 *
 * `allPanelInstances` gives a gable tile `-(tileIndex + 1)` so a gable row's
 * indices cannot collide with the ground slots on the same wall. Sorted raw,
 * that runs the row **backwards**: measured on the 16ft Octagon, the first
 * gable tile numbered was `NE8` and the last `NE5`, against a name series that
 * is assigned in true along-wall order.
 *
 * Unfolded back to the tile index here, in one place, so the sequence and the
 * names agree about which end of a gable row a crew starts at.
 */
export function installSlotIndex(slotIndexInWall: number): number {
  return slotIndexInWall < 0 ? -slotIndexInWall - 1 : slotIndexInWall;
}

/**
 * ⚠ **Which phase each export family installs in, and whether it has a
 * position of its own.**
 *
 * The phases are his packet order (2026-11-04): floor sheets, walls, truss
 * plate, **roof last**.
 *
 * `groupRank` above 0 means *"this family has no position"* — a spanning
 * header over three panels and a beam partway up a wall belong to a wall, but
 * the app does not know where in a crew's sequence one goes. They follow the
 * panels in their phase, in the app's own order. ⚠ Left at the default they
 * would score 0 on every positional field and take `0001` on the whole
 * building.
 *
 * ⚠ **`"Deck panel"` is the floor AND the roof**, which is the fault that put
 * `R1`–`R8` at 0011–0018, in among the floor deck and ahead of every wall
 * panel. The family alone cannot answer it; `roofPanelNames` does, from the
 * pipeline's own `kind`. **Never from the `R` on the front of the name** —
 * `PanelInstance.name` is a display string, and parsing it is what broke
 * `combinedPanelLabel` the moment a hyphen changed.
 */
export const INSTALL_PHASE_BY_FAMILY: Readonly<Record<string, { phase: InstallPhase; groupRank: number }>> = {
  "Deck panel": { phase: "floor", groupRank: 0 },
  "Wall panel": { phase: "wall", groupRank: 0 },
  "Spanning header": { phase: "wall", groupRank: 1 },
  "Mid-wall beam": { phase: "wall", groupRank: 2 },
  "Tilted gable": { phase: "wall", groupRank: 3 },
  "Roof bearing": { phase: "roof-bearing", groupRank: 0 },
  "Ridge post": { phase: "roof-bearing", groupRank: 1 },
  "Ridge beam": { phase: "roof", groupRank: 0 },
};

/**
 * ⚠ **An unknown family lands in the WALL phase, at the back, rather than
 * being left out.** A new pipeline arriving unnumbered would be invisible to a
 * crew; arriving in roughly the right place is recoverable and obvious.
 */
export const UNKNOWN_FAMILY_PHASE: { phase: InstallPhase; groupRank: number } = { phase: "wall", groupRank: 9 };

export interface InstallSequenceItemsInput {
  /** The export seam's own list, in its own order. */
  assemblies: readonly { panelType: string; instanceNames: readonly string[] }[];
  /** Wall-panel positions, by instance name. */
  wallPositionByName: ReadonlyMap<string, WallSlotPosition>;
  /** ⚠ Which `"Deck panel"` names are ROOF panels — from the pipeline's `kind`. */
  roofPanelNames: ReadonlySet<string>;
  /** A truss plate or box beam's own wall, as a ring position. */
  roofBearingPositionByName: ReadonlyMap<string, { ringIndex: number; wallIndex: number }>;
  /** Keyed `family|name`: the deck and tilted-gable rows, which know where
   *  along their run each piece sits. */
  runPositionByFamilyAndName: ReadonlyMap<string, RunPosition>;
}

export function buildInstallSequenceItems(input: InstallSequenceItemsInput): InstallSequenceItem[] {
  const items: InstallSequenceItem[] = [];
  let pipelineIndex = 0;

  for (const assembly of input.assemblies) {
    const family = assembly.panelType;
    const fallback = INSTALL_PHASE_BY_FAMILY[family] ?? UNKNOWN_FAMILY_PHASE;

    for (const name of assembly.instanceNames) {
      let placement: Omit<InstallSequenceItem, "family" | "name" | "pipelineIndex">;

      const wall = family === "Wall panel" ? input.wallPositionByName.get(name) : undefined;
      const roofBearing = family === "Roof bearing" ? input.roofBearingPositionByName.get(name) : undefined;
      const run = input.runPositionByFamilyAndName.get(`${family}|${name}`);

      if (wall) placement = { phase: "wall", groupRank: 0, ...wall };
      else if (roofBearing) placement = { phase: "roof-bearing", groupRank: 0, ...roofBearing };
      else if (run) placement = { ...fallback, ...run };
      else placement = fallback;

      /* ⚠ LAST, so it wins over the family's own phase: a roof panel and a
         floor panel are the same family and install at opposite ends of the
         job. It keeps whatever position the run gave it. */
      if (family === "Deck panel" && input.roofPanelNames.has(name)) {
        placement = { ...placement, phase: "roof" };
      }

      items.push({ family, name, pipelineIndex: pipelineIndex++, ...placement });
    }
  }

  return items;
}
