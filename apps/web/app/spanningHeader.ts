import {
  spanningHeaderSpanWidthIn,
  wallCompassDirection,
  type CompassDirection,
  type Footprint,
  type MidWallBeamGeometry,
  type PanelSlot,
  type SpanningHeaderGeometry,
  type SpanningHeaderLimitsIn,
} from "@building-integrity/geometry";
import { bigHeaderDefaultHeightIn, bigHeaderHeightInRange, bigHeaderWidthInRange } from "@building-integrity/panel-catalog";

/**
 * Project Smearforn Stage 2b — the app-level half of the spanning ("triple")
 * header: the stored record, its catalog-aware height resolution, and the
 * building-wide `H1`/`H2`/`H3` naming walk.
 *
 * The arithmetic (the derived span width, the refusals) is in
 * `packages/geometry/src/spanningHeader.ts`, which knows nothing about the
 * catalog — the same split `midWallBeam.ts` already makes beside it.
 *
 * ### The name carries NO direction, and that is the whole point
 *
 * Tommy, 2026-09-24, choosing one building-wide header series over a
 * per-direction one (`EH1`/`NEH1`/`SWH1`): a header's name says **what it
 * is, and nothing about where it is.** The reason is the stencil rack in the
 * shop — eight direction prefixes times an `H` is a lot of stencils to own,
 * and headers are rare enough that finding one does not need the wall encoded
 * in its name. Written `H1`, never `H-1`: the shop owns no hyphen stencil.
 *
 * **Consequences, both deliberate:**
 *
 * - `H1` may be on the north wall and `H2` on the east. The series crosses
 *   walls by design, so the counter is global, not per wall. A per-wall
 *   counter is the natural thing to write by mistake, which is why
 *   `spanningHeader.test.ts` asserts two headers on two different walls come
 *   out `H1` and `H2`.
 * - **The cross-reference is REQUIRED, not a nicety.** With the wall stripped
 *   out of the name, `H1` alone says nothing about where the panel goes — so
 *   its own fabrication sheet states its wall in words and names the panels
 *   it spans ("East wall — spans E4, E5"), and each of those panels' sheets
 *   carries the reciprocal ("Header above: H1"). A shop reading one sheet
 *   cannot see the other, which is exactly the situation this naming decision
 *   creates.
 *
 * Nothing here parses a display string. `H1` is composed from a real
 * `headerNumber` field, the wall words come from a real `CompassDirection`,
 * and the spanned panels come from real `PanelInstance`s — the lesson
 * `combinedPanelLabel`'s hyphen parse and the placement notice's `verb`
 * branch both cost this repo already.
 */
export interface SpanningHeader {
  id: string;
  /** Height of the header's own bottom face above this story's floor. The
   * panels beneath are shortened to exactly this height — see
   * `computeWallVerticalBandsForSlot`, which does that work unchanged. */
  heightIn: number;
  /** This header's own assembly height. Undefined = the catalog default
   * (`bigHeaderDefaultHeightIn`, **pending BI confirmation**), the same
   * "absent = automatic" convention `PanelSlot` already uses. */
  headerHeightIn?: number;
  /** This header's own horizontal coverage, in slot indices within its
   * wall's own `PanelSlot[]` array — the same half-open-range convention the
   * roofline Box Beam and the Mid-Wall Bond Beam both use, so an insert or a
   * delete moves it through `shiftSlotCoverage` exactly like theirs. */
  startSlotIndex: number;
  endSlotIndex: number;
}

/**
 * The bounds a spanning header answers to, read from the catalog in exactly
 * one place.
 *
 * **Both ranges are `pending-BI-confirmation`** — "Tommy's own stated range
 * — not mfr-sourced". The ADU's 6'5½" span is inside the width range with
 * room to spare. **If a later job spans past 12ft the range does NOT get
 * widened to fit the drawing**: the placement is refused, with the number
 * quoted, and the question goes back to Building Integrity.
 */
export const SPANNING_HEADER_LIMITS_IN: SpanningHeaderLimitsIn = {
  minSpanIn: bigHeaderWidthInRange.minIn,
  maxSpanIn: bigHeaderWidthInRange.maxIn,
  minHeightIn: bigHeaderHeightInRange.minIn,
  maxHeightIn: bigHeaderHeightInRange.maxIn,
};

/** This header's own real assembly height — the single choke point every
 * consumer calls instead of reading `headerHeightIn` directly, mirroring
 * `resolveMidWallBeamAssemblyHeightIn`. */
export function resolveSpanningHeaderHeightIn(header: SpanningHeader): number {
  return header.headerHeightIn ?? bigHeaderDefaultHeightIn.value;
}

/** The one place `SpanningHeader` (the app-level, catalog-aware record)
 * becomes `SpanningHeaderGeometry` (the geometry package's own
 * catalog-agnostic input), so every consumer resolves heights identically. */
export function spanningHeadersToGeometry(headers: SpanningHeader[]): SpanningHeaderGeometry[] {
  return headers.map((h) => ({
    heightIn: h.heightIn,
    assemblyHeightIn: resolveSpanningHeaderHeightIn(h),
    startSlotIndex: h.startSlotIndex,
    endSlotIndex: h.endSlotIndex,
  }));
}

/**
 * Everything that splits ONE wall's columns into vertical bands, in one
 * list: its Mid-Wall Bond Beams and its spanning headers.
 *
 * **Every consumer that computes bands must use this**, not the beams alone —
 * `allPanelInstances`, the wall elevation, the 3D view and the zone
 * reconciliation all take the same list, so a header shortens the panels
 * beneath it in all four places or in none of them. `MidWallBeamGeometry` and
 * `SpanningHeaderGeometry` are structurally identical (that is the model), so
 * this is a concatenation and not a conversion.
 */
export function wallBandGeometry(beams: MidWallBeamGeometry[], headers: SpanningHeaderGeometry[]): MidWallBeamGeometry[] {
  return headers.length === 0 ? beams : [...beams, ...headers];
}

/** Which wall, in words, for a sheet that carries no direction in its own
 * name. Full words on purpose: "East wall" is unambiguous on a printed page
 * in a shop; "E" beside a panel called `H1` is not. */
export const COMPASS_DIRECTION_WORDS: Record<CompassDirection, string> = {
  N: "North",
  NE: "Northeast",
  E: "East",
  SE: "Southeast",
  S: "South",
  SW: "Southwest",
  W: "West",
  NW: "Northwest",
};

/** One placed spanning header, resolved: its building-wide name, where it
 * is, and how wide it is. */
export interface ResolvedSpanningHeader {
  story: "ground" | "second";
  wallId: string;
  header: SpanningHeader;
  /** `H1`, `H2`, ... — composed from `headerNumber`, never parsed back. */
  name: string;
  /** This header's own number in the single building-wide series, 1-based. */
  headerNumber: number;
  /** The wall this header is on. **Not part of its name** — carried so the
   * sheet can state the wall in words, which is the whole reason the
   * direction-free name is survivable. */
  direction: CompassDirection;
  /** The sum of the covered slots' widths: this header's fabricated width. */
  spanWidthIn: number;
  /** This header's own real assembly height. */
  heightIn: number;
  /** The slot indices it actually sits on, as they exist right now. Empty
   * when a wall has shrunk out from under it — see
   * `spanningHeaderCoveredSlotCount`. */
  coveredSlotIndices: number[];
}

/**
 * Every spanning header in the building, named from ONE global counter.
 *
 * The walk is stories in order, then `footprint.walls` in order, then each
 * wall's own headers by their start slot — the same wall-order-then-slot-order
 * walk `allPanelInstances` already does, so header numbering is deterministic
 * and rises in the same direction panel numbering does.
 *
 * **⚠ Renumbering is building-wide.** Inserting a header on the north wall
 * shifts every header after it anywhere in the building, not just on that
 * wall — a wider blast radius than the panels have, where a north-wall insert
 * only ever moves `N` numbers. Same staleness problem as the panel names,
 * larger radius, covered by the same printed sheet identity (Stage 5).
 */
export function resolveSpanningHeaders(
  footprint: Footprint | null,
  stories: { id: "ground" | "second"; wallSlots: Record<string, PanelSlot[]> }[],
  headersByStoryAndWallId: Record<"ground" | "second", Record<string, SpanningHeader[]>>,
): ResolvedSpanningHeader[] {
  if (!footprint) return [];
  const resolved: ResolvedSpanningHeader[] = [];
  let headerNumber = 0;
  for (const story of stories) {
    for (const wall of footprint.walls) {
      const headers = headersByStoryAndWallId[story.id]?.[wall.id] ?? [];
      if (headers.length === 0) continue;
      const slots = story.wallSlots[wall.id] ?? [];
      const direction = wallCompassDirection(wall, footprint);
      for (const header of [...headers].sort((a, b) => a.startSlotIndex - b.startSlotIndex)) {
        headerNumber += 1;
        const start = Math.max(0, Math.min(header.startSlotIndex, slots.length));
        const end = Math.max(start, Math.min(header.endSlotIndex, slots.length));
        const coveredSlotIndices: number[] = [];
        for (let i = start; i < end; i++) coveredSlotIndices.push(i);
        resolved.push({
          story: story.id,
          wallId: wall.id,
          header,
          // NO HYPHEN, and no direction letter — see this module's own header.
          name: `H${headerNumber}`,
          headerNumber,
          direction,
          spanWidthIn: spanningHeaderSpanWidthIn(slots, header),
          heightIn: resolveSpanningHeaderHeightIn(header),
          coveredSlotIndices,
        });
      }
    }
  }
  return resolved;
}

/** The panels one header spans, by name, in along-wall order — the input to
 * both halves of the cross-reference. `instanceNameFor(wallId, slotIndex)` is
 * the caller's own lookup into the real named instances (a slot can carry
 * more than one instance; the caller decides which name a slot shows). */
export function spannedPanelNames(
  resolvedHeader: ResolvedSpanningHeader,
  instanceNameFor: (wallId: string, slotIndex: number) => string | undefined,
): string[] {
  return resolvedHeader.coveredSlotIndices
    .map((slotIndex) => instanceNameFor(resolvedHeader.wallId, slotIndex))
    .filter((name): name is string => name !== undefined);
}

/**
 * The line a header's own fabrication sheet carries, because its name says
 * nothing about where it goes: *"East wall — spans E4, E5."*
 *
 * A header whose panels cannot be named (a wall that has shrunk out from
 * under it) still states its wall — an unknown is a visible gap, never a
 * plausible substitute.
 */
export function spanningHeaderSheetLocation(resolvedHeader: ResolvedSpanningHeader, spannedNames: string[]): string {
  const wallWords = `${COMPASS_DIRECTION_WORDS[resolvedHeader.direction]} wall`;
  return spannedNames.length === 0 ? `${wallWords} — spans no panels` : `${wallWords} — spans ${spannedNames.join(", ")}`;
}

/** The reciprocal line, for each panel beneath: *"Header above: H1."* Keyed
 * by panel name, since a fabrication sheet groups identical panels by name. */
export function headerAboveByPanelName(
  resolvedHeaders: ResolvedSpanningHeader[],
  instanceNameFor: (wallId: string, slotIndex: number) => string | undefined,
): Map<string, string> {
  const byPanelName = new Map<string, string>();
  for (const resolvedHeader of resolvedHeaders) {
    for (const panelName of spannedPanelNames(resolvedHeader, instanceNameFor)) {
      byPanelName.set(panelName, resolvedHeader.name);
    }
  }
  return byPanelName;
}
