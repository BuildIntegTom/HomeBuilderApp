/**
 * ⚠ **EVERY PANEL'S POSITION IN THE INSTALL SEQUENCE — `0001`, `0002`, … —
 * B35, 2026-11-16.**
 *
 * > *"Could we consider renaming all of the panels to go from point of least
 * > accessability, clockwise, from out to in, from bottom to top by label of
 * > 0000, 0001, 0002, etc."* — Tommy, 2026-11-16
 *
 * ## ⚠ This is a POSITION, not an identity, and the distinction is the whole
 * design
 *
 * A number that counts along the install sequence **renumbers** the moment the
 * design changes: insert one window on the north wall and everything after it
 * shifts by one. That is not a defect to be fixed here, it is what a position
 * IS.
 *
 * ⚠ **And it is exactly the problem the Tip4urTime panel code already
 * solved** — that one is stamped at first export and STORED, specifically so
 * it can never renumber, and it is a join key rather than a name. The
 * stability he admired in that file comes from *storing* it.
 *
 * So the two travel together and mean different things:
 *
 * | | what it is | survives an edit? |
 * | --- | --- | --- |
 * | `P-0007` (the stored code) | **identity** — the join key a crew's pay hangs on | **yes**, by construction |
 * | `0007` (this) | **position** — what comes off the truck next | **no**, and it says so |
 *
 * ⚠ Which is why **nothing here is stored and no migration runs**: his rule
 * that panel identity is DERIVED (*"not from a memory file"*) is untouched,
 * because this is not an identity. Anything printing one of these has to say
 * which revision it is a position in.
 *
 * ## ⚠ The order is HIS, and most of it already existed
 *
 * *"From point of least accessability, clockwise, from out to in, from bottom
 * to top."* Taken one clause at a time:
 *
 * - **Point of least accessibility** is already a real, user-set, persisted
 *   field (`leastAccessibleCorner`) that already drives the truck load order —
 *   from his own earlier words, *"the stack order must correlate to the point
 *   of least accessability."* `computePanelLoadOrder` already rotates the wall
 *   ring to start there.
 * - **Clockwise** is already the walk direction. `wallCompassDirection` treats
 *   screen-up as North and a rectangle is built `A(0,0) → B(w,0) → C(w,d) →
 *   D(0,d)`, which on a y-down plan is clockwise as drawn.
 * - **Out to in** is ring-major: the outer ring finishes before an inner one
 *   starts. It only means anything on a courtyard or concentric building. ⚠ On
 *   those, the inner ring **winds the other way**, which is the trap that made
 *   compass directions come out backwards on an inner ring in October — so the
 *   caller resolves "clockwise" in PLAN and hands over an index, and nothing
 *   here counts windings.
 * - **Bottom to top** is two nested things: the stories, and then the bands
 *   within a slot (a sill before the header above it, a mid-wall beam's lower
 *   piece before its upper).
 *
 * ⚠ **And the PHASE comes first, ahead of all of it** — because the sequence
 * is an install order, and his packet order (2026-11-04) is floor sheets,
 * walls, truss plate, roof last. A strict bottom-to-top reading of his words
 * gives the same answer: the deck is under the walls.
 *
 * ## ⚠ Positions are handed IN, never worked out here
 *
 * Every field below is a plain index the caller already has. This module
 * sorts; it does not know what a wall or a courtyard is. That is deliberate:
 * the ring order, the rotation to the least-accessible corner and the
 * clockwise question all have exactly one right answer each, already computed
 * elsewhere, and a second derivation here is how two orders come to disagree
 * about what the crew is holding.
 */

/**
 * The install phases, in order. ⚠ **His packet order, not a guess** —
 * *"floor sheets first, walls, truss plate, roof last"* (2026-11-04).
 */
export const INSTALL_PHASE_ORDER = ["floor", "wall", "roof-bearing", "roof"] as const;

export type InstallPhase = (typeof INSTALL_PHASE_ORDER)[number];

export interface InstallSequenceItem {
  /**
   * The pipeline family — the same string `ExportableAssembly.panelType`
   * carries. ⚠ **Part of the key, because a stencilled name is only unique
   * WITHIN a pipeline**: a wall panel and a deck panel can both be the first
   * of their run. That is the Tip4urTime ledger's own reasoning and the same
   * failure it guards (two families sharing a name, a crew paid once for two
   * panels).
   */
  family: string;
  /** The stencilled instance name — `N3`, `F12`. May be empty. */
  name: string;
  phase: InstallPhase;
  /**
   * ⚠ **Which families go first WITHIN a phase — and this one is the app's
   * own reading, not his instruction.**
   *
   * His clauses place a PANEL: least-accessible corner, clockwise, out to in,
   * bottom to top. They do not place the tie-and-tackle that goes in among
   * them — a spanning header over three panels, a Mid-Wall Bond Beam partway
   * up a wall. Those belong to a wall but the app does not know where in the
   * sequence a crew would hang one.
   *
   * So inside a phase: **everything with a real position comes first, in full
   * positional order (`groupRank` 0), and the rest follow in the app's own
   * pipeline order.** Stated rather than implied, because the alternative —
   * leaving them at the default and having a beam number 0001 ahead of every
   * panel on the building — is the bug this field exists to stop.
   *
   * ⚠ If a beam's own wall ever reaches here, give it that wall's indices and
   * drop it back to rank 0; it will slot in beside the panels it ties.
   */
  groupRank?: number;
  /** 0 = the ground story. Bottom to top. */
  storyIndex?: number;
  /** 0 = the outer ring. Out to in. */
  ringIndex?: number;
  /** Position in the ring AFTER it has been rotated to start at the
   *  least-accessible corner, walking clockwise in plan. */
  wallIndex?: number;
  /** Position along that wall, in the wall's own run direction. */
  slotIndex?: number;
  /** Bottom to top WITHIN one slot — a window's sill is 0 and the header
   *  above it is 1; a Mid-Wall Bond Beam's lower piece comes before its
   *  upper. Slots that hold one panel leave it at 0. */
  bandIndex?: number;
  /**
   * ⚠ **The tie-breaker, and it is never a coin toss.** The order the app's
   * own pipeline produced this item. Two items identical on every field above
   * fall back to it, which keeps the sequence **total** — so the same
   * building always numbers the same way, and a renumber can only ever be
   * caused by a real change to the building.
   *
   * It carries the whole order for the families that have no wall position at
   * all (deck panels, beams), where the pipeline's own order is the only
   * answer there is and pretending otherwise would be inventing one.
   */
  pipelineIndex: number;
}

/**
 * ⚠ **The key, and it is deliberately the SAME FORMULA as the Tip4urTime
 * ledger's `panelCodeKey`** — so a panel's position and its stored code are
 * looked up by one key, and a consumer holding one can always find the other.
 *
 * ⚠ **It is a copy of that formula rather than an import, on purpose.**
 * `tip4urTimeCsv` is a leaf module that will want to PRINT an install number,
 * and importing it here to borrow one function would close exactly the kind of
 * cycle that cost a day on 2026-11-16: `panelMemberHelpers` ↔ `panelPlanMitre`
 * passed `tsc`, `vitest` and lint while the dev server answered 500. The two
 * formulas are pinned equal by a test instead, which cannot cycle.
 */
export function installSequenceKey(family: string, name: string, pipelineIndex: number): string {
  /* An unnamed item still needs a stable key, and its position in its own
     pipeline is the only thing it has. */
  const leaf = name.length > 0 ? name : `#${pipelineIndex}`;
  return `${family}|${leaf}`;
}

function phaseRank(phase: InstallPhase): number {
  return INSTALL_PHASE_ORDER.indexOf(phase);
}

/** The sort fields, outermost first. Every one is "lower installs earlier". */
function rankOf(item: InstallSequenceItem): number[] {
  return [
    phaseRank(item.phase),
    item.groupRank ?? 0,
    item.storyIndex ?? 0,
    item.ringIndex ?? 0,
    item.wallIndex ?? 0,
    item.slotIndex ?? 0,
    item.bandIndex ?? 0,
    item.pipelineIndex,
  ];
}

export function compareInstallSequence(a: InstallSequenceItem, b: InstallSequenceItem): number {
  const ra = rankOf(a);
  const rb = rankOf(b);
  for (let i = 0; i < ra.length; i++) {
    const d = ra[i]! - rb[i]!;
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * ⚠ **Four digits, 1-based.** He wrote both `0000` and `0001`; it starts at
 * **0001**, because `0000` reads as "unset" wherever it turns up and a crew
 * should never see a panel that looks unassigned.
 *
 * Zero-padded to four so the numbers sort lexically and line up in a column on
 * a printed sheet. ⚠ A building past 9999 panels simply gets a fifth digit
 * rather than wrapping or truncating — the padding is for reading, and
 * silently reusing `0001` is the one thing that must not happen.
 */
export function formatInstallSequenceNumber(n: number): string {
  return String(n).padStart(4, "0");
}

/**
 * Every item's 1-based position, keyed by `installSequenceKey`.
 *
 * ⚠ **A duplicate key keeps its FIRST position rather than overwriting.** Two
 * items that key the same are the same panel as far as every consumer is
 * concerned, and taking the later one would mean the number on the drawing and
 * the number on the sheet could differ for one panel. It cannot happen today —
 * names are unique within a family — but it is the kind of thing that becomes
 * possible when a pipeline is added.
 */
export function computeInstallSequence(items: readonly InstallSequenceItem[]): Map<string, number> {
  const ordered = [...items].sort(compareInstallSequence);
  const byKey = new Map<string, number>();
  let n = 1;
  for (const item of ordered) {
    const key = installSequenceKey(item.family, item.name, item.pipelineIndex);
    if (byKey.has(key)) continue;
    byKey.set(key, n);
    n += 1;
  }
  return byKey;
}

/**
 * The numbers one fabrication sheet builds, as the sheet prints them —
 * ⚠ **a TAG on a shared sheet, never a group key.**
 *
 * A Shop Fabrication page covers every panel that is physically the same, and
 * that grouping is what keeps a Tiny House at roughly a dozen sheets instead
 * of 74. Keying a sheet on a unique number would un-group the entire packet
 * and retire B25's pusher-head order with it. So the sheet keeps saying what
 * to build, and adds the positions it covers.
 *
 * Sorted numerically, not in the group's own order, because the crew reads it
 * against a sequence.
 */
export function installNumbersForSheet(
  instanceKeys: readonly string[],
  sequence: ReadonlyMap<string, number>,
): string[] {
  return instanceKeys
    .map((key) => sequence.get(key))
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b)
    .map(formatInstallSequenceNumber);
}
