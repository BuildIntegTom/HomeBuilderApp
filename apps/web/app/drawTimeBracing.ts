import { computeGapEnd, type CornerId, type Footprint, type PanelSlot, type PanelSlotZone } from "@building-integrity/geometry";
import { DEFAULT_BRACE_PAIR_PATTERN, applyWallBracingPattern, type BraceablePanel } from "@building-integrity/panel-catalog";

/**
 * ⚠ **THE BRACE PATTERN IS LAID WHEN THE SHAPE IS DRAWN — B15.**
 *
 * > *"Applying this patterned bracing should be part of the original tiling
 * > when drawing a shape."* — Tommy, 2026-11-01
 *
 * `applyWallBracingPattern` has done the hard part since 2026-10-25 — pairing
 * from the least accessible end, breaking a run at anything ineligible,
 * giving an odd last panel half a pattern — and **nothing called it.** It was
 * built, exported and covered by ten tests, and no panel in the app had ever
 * carried a pair pattern. This is the call.
 *
 * ⚠ **Eligibility is decided HERE, deliberately.** `BraceablePanel.eligible`
 * carries its own note: *"The caller decides this; inventing an eligibility
 * rule here would bury a building decision in a geometry module."* Asked on
 * 2026-11-01, Tommy chose **standard panels only** — corners and columns are
 * already stiff plywood boxes, and a header, a window, a door or a safety
 * gap's plywood spacer has nothing to route a diagonal through. Pairing
 * restarts after each of those, so an X never reaches across one.
 *
 * ⚠ **`braced` slots are NOT eligible, and until B17 that meant a wall
 * carried BOTH systems at once.** He chose "the pattern replaces them", and on
 * 2026-11-02 the replacement happened: both automatic bracing rules were
 * retired, so **the pattern now runs continuously from corner to corner on
 * every ordinary wall** instead of restarting after each seeded chevron. See
 * the record at the top of `bracedPlacement.ts` (geometry) for what went and
 * why.
 *
 * A `braced` slot still breaks the pair run it sits in, because pairing
 * restarts after anything ineligible — but now it only sits there because
 * somebody put it there, which makes the discontinuity a choice rather than a
 * default. Whether a Braced Panel should instead take its own pattern half is
 * open and his to decide.
 *
 * ⚠ **His standing reservation, recorded because it is about the
 * BUILDING and not the code:** *"My general feeling with this is that we are
 * over bracing with these kind of patterns."* He said to proceed anyway. If
 * it proves too much, the lever is one constant — `DEFAULT_BRACE_PAIR_PATTERN`
 * from `superbrace` (two legs plus two returns per panel) to `braced` (one
 * leg plus a tie) or `nailer` (no diagonal at all).
 *
 * ⚠ **Ground floor only**, his scope answer. The second story and the gable
 * rows keep what they have until this is proven on the walls below them.
 */

/** Only a plain standard panel takes a leg of the pattern. See the note above. */
export function isBraceEligible(slot: PanelSlot): boolean {
  return slot.type === "standard";
}

/**
 * The same question for one vertical BAND of a column — B22.
 *
 * ⚠ It takes the parent slot as well as the zone, and both have a say. The
 * zone decides what is in this band (a window up here is no more braceable
 * than a window down there), and the parent decides whether this column is a
 * brace candidate at all: a corner or an octagon corner is a stiff plywood
 * box for its whole height, so its upper band is no more eligible than its
 * lower one. `applyAdditionalRowBracedPattern` read the parent for exactly
 * this reason before it was retired, and the reason outlived it.
 */
export function isZoneBraceEligible(slot: PanelSlot, zone: PanelSlotZone | undefined): boolean {
  if (slot.type === "corner" || slot.type === "safety-oct-corner") return false;
  /* Absent = the render-time "standard" placeholder `effectiveZonesForSlot`
     pads with, which is a plain panel and takes a leg like one. */
  return (zone?.type ?? "standard") === "standard";
}

/**
 * Which end of a wall the pairing walks FROM: the one nearest the least
 * accessible corner.
 *
 * ⚠ `computeGapEnd` answers the opposite question — it puts the safety gap at
 * the end FURTHEST from that corner — so this is its inverse rather than a
 * second distance calculation that could disagree with it.
 */
export function bracingStartFrom(
  footprint: Footprint,
  wallId: string,
  leastAccessibleCornerId: CornerId,
): "start" | "end" {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall) return "start";
  return computeGapEnd(wall, leastAccessibleCornerId, footprint.corners) === "end" ? "start" : "end";
}

/**
 * Every wall's slots with the pattern written onto the eligible ones.
 *
 * Pure, and returns a new map — nothing here reads state, which is the same
 * shape `applyRoofDefaultsForFootprint` settled on for the roof.
 *
 * ⚠ **Despite the name, this does NOT run only at draw time**, and the
 * name is kept because draw time is when it first fires and what he asked
 * for. It is called from `page.tsx`'s `overlayWallSlots` memo, which is the
 * one layer every re-tile path flows through — toggling an opening, dragging
 * a panel, repanelizing a run, loading a project. A pattern written once
 * inside `handleDraw` would silently vanish from the wall you just put a
 * window in, because that wall's slots are rebuilt from the tiler. See that
 * memo's own note.
 */
export function applyDrawTimeBracing(
  footprint: Footprint,
  slotsByWallId: Record<string, PanelSlot[]>,
  leastAccessibleCornerId: CornerId,
  pattern = DEFAULT_BRACE_PAIR_PATTERN,
  wallHeightIn?: number,
): Record<string, PanelSlot[]> {
  const out: Record<string, PanelSlot[]> = {};
  for (const [wallId, slots] of Object.entries(slotsByWallId)) {
    /**
     * One horizontal row's worth of the walk, as `{ pattern, half, figure }`
     * per index. Extracted for B22 so a wall's upper band is braced by the
     * SAME walk as its ground row rather than by a second rule that drifts
     * from it — the whole lesson of the two bracing systems B17 retired.
     */
    const walkRow = (eligible: (index: number) => boolean) => {
      /* An id lets the overlay hand its answer back per panel without the
         caller having to re-walk the array in the same order. */
      const panels: BraceablePanel[] = slots.map((slot, index) => ({
        id: `${wallId}:${index}`,
        widthIn: slot.widthIn,
        /* The height only scales the legs; a wall's panels all share one.
           A band's own shorter height reaches the members through
           `heightOverrideIn` on the instance, not through here. */
        heightIn: wallHeightIn ?? 0,
        eligible: eligible(index),
      }));

      const result = applyWallBracingPattern({
        pattern,
        panels,
        /* ⚠ Every row starts from the SAME end — the one nearest the least
           accessible corner. That is the "synonymous with its downstairs
           counterparts" half of his sentence: two rows walked from the same
           end with the same cycle line their figures up wherever their
           eligibility agrees, without anything having to copy anything. */
        startFrom: bracingStartFrom(footprint, wallId, leastAccessibleCornerId),
      });

      /* `half` is not returned per panel, so it is read back off the pairs:
         a pair's left panel is its left half, its right panel the right. An
         unpaired panel takes the LEFT half — *"Just do it till it ends"*, the
         same legs it would have taken with a partner. */
      const halfById = new Map<string, "left" | "right">();
      for (const pair of result.pairs) {
        halfById.set(pair.leftPanelId, "left");
        halfById.set(pair.rightPanelId, "right");
      }
      for (const id of result.unpairedPanelIds) halfById.set(id, "left");

      return (index: number) => {
        const id = `${wallId}:${index}`;
        const half = halfById.get(id);
        if (half === undefined) return undefined;
        return { bracePairPattern: pattern, bracePairHalf: half, braceFigure: result.figureByPanelId[id] };
      };
    };

    const groundFigureFor = walkRow((index) => isBraceEligible(slots[index]!));

    /* How many bands the tallest column on this wall has. A wall nothing has
       reconciled yet has none, and the loop below simply does not run — the
       reader then falls back to the column's own pattern, which is what every
       band did before B22. */
    const bandCount = slots.reduce((max, slot) => Math.max(max, slot.zones?.length ?? 1), 1);
    const upperFigureFor: ((index: number) => ReturnType<ReturnType<typeof walkRow>>)[] = [];
    for (let z = 1; z < bandCount; z++) {
      upperFigureFor[z] = walkRow((index) => isZoneBraceEligible(slots[index]!, slots[index]!.zones?.[z]));
    }

    out[wallId] = slots.map((slot, index) => {
      const ground = groundFigureFor(index);
      const zones = slot.zones;
      const nextZones =
        zones === undefined
          ? undefined
          : zones.map((zone, z) => {
              if (z === 0) return zone;
              const figure = upperFigureFor[z]?.(index);
              /* ⚠ A band that took no leg has its pattern CLEARED rather than
                 left alone. The fields are derived, so a stale one from a
                 previous shape would outlive the shape that justified it —
                 the same reason `PanelSlot`'s own three are rewritten from
                 scratch on every pass instead of merged.

                 Deleted rather than destructured away, because the three names
                 would then be bound and never read — three unused bindings to
                 say "I meant to drop these", which is a worse way of saying it
                 than saying it. */
              const cleared: PanelSlotZone = { ...zone };
              delete cleared.bracePairPattern;
              delete cleared.bracePairHalf;
              delete cleared.braceFigure;
              return figure === undefined ? cleared : { ...cleared, ...figure };
            });
      if (ground === undefined && nextZones === undefined) return slot;
      return {
        ...slot,
        ...(ground ?? { bracePairPattern: undefined, bracePairHalf: undefined, braceFigure: undefined }),
        ...(nextZones !== undefined && { zones: nextZones }),
      };
    });
  }
  return out;
}
