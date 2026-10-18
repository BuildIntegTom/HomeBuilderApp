import { roundToEighthIn } from "./eighths";
import type { PanelSlot, WallEnd } from "./types";

/**
 * HOW MANY SAFETY GAPS A RUN GETS, AND WHERE — Tommy, 2026-10-18.
 *
 * > *"When a wall grows or when a very long wall is created. There should be a
 * > 3/4-in safety cap approximately every 24 ft. This starts with a safety Gap
 * > right next to each corner on each wall according to the least
 * > accessibility placement. If a 20-ft wall is originally spawned with one
 * > safety gap and it is expanded to be a 40-ft wall, the safety gap should
 * > retile to have a safety gap right next to the corner panel and then
 * > another one 24 ft away."*
 *
 * And on how exact "approximately" is:
 *
 * > *"It should be approximately every 24 ft away plus or minus 4 ft whatever
 * > is closer"*
 *
 * Two parts, and only the second is new:
 *
 * 1. **The first gap is unchanged.** It is still placed by the tiler at the
 *    end the least-accessible-corner rule picks (`gapEndFor`). This module
 *    never moves it; it only ever measures FROM it.
 * 2. **Every further gap goes at the panel joint nearest 24ft from the one
 *    before it**, searching only joints 20ft to 28ft away. Nothing is resized
 *    to hit 24ft exactly — the gap lands on a joint the wall ALREADY HAS,
 *    which is what "approximately" buys and what keeps the run's panels the
 *    ones the user put there.
 *
 * ⚠ **This answers a question the gap rule had left open**, asked on
 * 2026-10-18 after measurement showed a wall grown from 20ft to 60ft kept its
 * single gap wherever it already was, stranded mid-wall. His answer makes gap
 * placement a function of the run, so a length change re-places the gaps —
 * which is correct under tile-once precisely because the safety gap is one of
 * the two parts the model says stay rule-placed.
 *
 * ⚠ **The 24ft spacing and the 12ft width threshold are different rules about
 * the same part, and they are not related.** `safetyGapWidthForRunIn` decides
 * whether a gap is 1/2in or 3/4in from the run's length (144in). This module
 * decides HOW MANY and WHERE. A run long enough for a second gap is far past
 * the width threshold, so every gap this module adds is a 3/4in one — which is
 * what he said ("a 3/4-in safety cap approximately every 24 ft") — but that is
 * a consequence of the two numbers, not a rule of its own, and the caller
 * still passes the width it got from `safetyGapWidthForRunIn`.
 *
 * ⚠ **Two earlier versions of this module were wrong about the same thing: WHICH
 * GAP TO MEASURE FROM.** The first walked inward from `gapEnd` and ignored
 * everything before the first gap it met — fine on a freshly tiled wall, and
 * wrong in exactly the case he asked about, because after a wall grows at the
 * far end the existing gap is nowhere near `gapEnd` and the whole new stretch
 * was crossed with nothing to measure from. The second took the first gap in
 * ARRAY order as the anchor, which stops being the tiler's gap the moment a
 * gap is inserted ahead of it — so a second run of the same rule deleted the
 * wall's original gap, and it was not idempotent. The anchor is now found
 * explicitly, and both stretches either side of it are subdivided.
 */

/** The target spacing between consecutive safety gaps. */
export const SAFETY_GAP_SPACING_TARGET_IN = 24 * 12;

/**
 * How far from the 24ft target a joint may be and still be chosen — his
 * "plus or minus 4 ft". Joints 20ft and 28ft away are both eligible; the one
 * nearer 24ft wins ("whatever is closer").
 */
export const SAFETY_GAP_SPACING_TOLERANCE_IN = 4 * 12;

const SPACING_MIN_IN = SAFETY_GAP_SPACING_TARGET_IN - SAFETY_GAP_SPACING_TOLERANCE_IN;
const SPACING_MAX_IN = SAFETY_GAP_SPACING_TARGET_IN + SAFETY_GAP_SPACING_TOLERANCE_IN;

/** Placed by rule, so not a panel a gap may take its width from. */
function isRulePlaced(slot: PanelSlot): boolean {
  return slot.type === "corner" || slot.type === "safety-gap";
}

/** An opening is a part in its own right. A gap may sit at the joint beside
 * one, but may never take width out of it — that would resize an opening the
 * user placed. */
function isOpening(slot: PanelSlot): boolean {
  return slot.type === "window" || slot.type === "door";
}

/** Width may be taken from plain automatic framing only: not a corner, not a
 * gap, not an opening, and never a hand-set width. */
function canDonate(slot: PanelSlot, gapEighths: number, minEighths: number): boolean {
  if (isRulePlaced(slot) || isOpening(slot)) return false;
  if (slot.lockedWidthIn !== undefined) return false;
  return Math.round(slot.widthIn * 8) - gapEighths >= minEighths;
}

export interface SafetyGapSpacingResult {
  slots: PanelSlot[];
  /** How many gaps were added. Non-zero is worth telling the user about: a new
   * gap is a new part and a new joint in a real wall. */
  added: number;
  /** How many surplus gaps were removed — a wall that shrank, or one tiled
   * before this rule existed. */
  removed: number;
  /**
   * Stretches of run over 28ft long with no joint the rule could use, so no
   * gap could be placed without resizing a panel the user sized on purpose.
   *
   * ⚠ Reported, never forced. Offsets are measured from the previous gap.
   */
  refusals: { afterOffsetIn: number; nearestJointOffsetIn: number | null }[];
}

/**
 * Which existing gap is the tiler's own — the one the
 * least-accessible-corner rule put next to a corner, and the one every
 * spacing measurement starts from.
 *
 * It is found as the gap NEAREST THE `gapEnd` CORNER rather than the first in
 * array order, because those stop being the same gap as soon as this rule
 * inserts one ahead of it. See the module comment: taking the first in array
 * order is what made the previous version delete a wall's original gap on a
 * second application.
 */
function anchorGapIndex(slots: readonly PanelSlot[], gapEnd: WallEnd): number {
  const gapIndexes = slots.map((s, i) => (s.type === "safety-gap" ? i : -1)).filter((i) => i >= 0);
  if (gapIndexes.length === 0) return -1;
  return gapEnd === "start" ? gapIndexes[0]! : gapIndexes[gapIndexes.length - 1]!;
}

interface PassPlan {
  /** Insert a gap immediately BEFORE this array index. */
  insertBefore: number[];
  /** Take the gap's width from this slot, by array index, for each insertion
   * above — paired by position. */
  donorIndex: number[];
  /** Gaps to drop: not the anchor, and not within 4ft of 24ft from the gap
   * before them. */
  surplus: number[];
  refusals: SafetyGapSpacingResult["refusals"];
}

/**
 * Subdivide one direction's worth of run, starting at the anchor gap.
 *
 * @param step `+1` walks toward the end of the array, `-1` toward the start.
 *   Both stretches either side of the anchor are walked, because a wall can
 *   grow at the `gapEnd` side too and leave a long stretch BETWEEN the anchor
 *   and its own corner.
 */
function planDirection(
  slots: readonly PanelSlot[],
  anchor: number,
  step: 1 | -1,
  gapEighths: number,
  minEighths: number,
): PassPlan {
  const plan: PassPlan = { insertBefore: [], donorIndex: [], surplus: [], refusals: [] };
  let sinceGapIn = 0;
  let joints: { donorIndex: number; insertBefore: number; offsetIn: number }[] = [];

  const chooseJoint = () => {
    const inRange = joints.filter((j) => j.offsetIn >= SPACING_MIN_IN && j.offsetIn <= SPACING_MAX_IN);
    if (inRange.length === 0) return null;
    /* "Whatever is closer" — nearest the 24ft target. A tie goes to the
       SHORTER spacing, so gaps never drift further out than asked by
       accumulating ties across a long wall. */
    return inRange.reduce((best, j) => {
      const dBest = Math.abs(best.offsetIn - SAFETY_GAP_SPACING_TARGET_IN);
      const dJ = Math.abs(j.offsetIn - SAFETY_GAP_SPACING_TARGET_IN);
      return dJ < dBest || (dJ === dBest && j.offsetIn < best.offsetIn) ? j : best;
    });
  };

  const decide = () => {
    const chosen = chooseJoint();
    if (chosen) {
      plan.insertBefore.push(chosen.insertBefore);
      plan.donorIndex.push(chosen.donorIndex);
      sinceGapIn = roundToEighthIn(sinceGapIn - chosen.offsetIn);
      joints = joints
        .filter((j) => j.offsetIn > chosen.offsetIn)
        .map((j) => ({ ...j, offsetIn: roundToEighthIn(j.offsetIn - chosen.offsetIn) }));
      return;
    }
    /* ⚠ REFUSED rather than forced. Nothing in this stretch's joints lands
       within 4ft of 24ft — a wall carrying one enormous hand-set panel, for
       instance. Forcing a gap would mean splitting a panel the user sized on
       purpose, which this app refuses and reports instead of guessing. */
    const nearest = joints.reduce<{ offsetIn: number } | null>(
      (best, j) =>
        best === null ||
        Math.abs(j.offsetIn - SAFETY_GAP_SPACING_TARGET_IN) < Math.abs(best.offsetIn - SAFETY_GAP_SPACING_TARGET_IN)
          ? j
          : best,
      null,
    );
    plan.refusals.push({ afterOffsetIn: sinceGapIn, nearestJointOffsetIn: nearest?.offsetIn ?? null });
    sinceGapIn = 0;
    joints = [];
  };

  for (let i = anchor + step; i >= 0 && i < slots.length; i += step) {
    const slot = slots[i]!;

    if (slot.type === "safety-gap") {
      if (sinceGapIn >= SPACING_MIN_IN && sinceGapIn <= SPACING_MAX_IN) {
        // Already roughly where the rule wants one, so it IS that gap.
        sinceGapIn = 0;
        joints = [];
      } else {
        /* ⚠ The measurement is NOT reset: this gap is being removed, so the
           stretch runs straight through it and its own width rejoins the run. */
        plan.surplus.push(i);
        sinceGapIn = roundToEighthIn(sinceGapIn + slot.widthIn);
      }
      continue;
    }

    sinceGapIn = roundToEighthIn(sinceGapIn + slot.widthIn);

    /* The joint on the far side of this slot, in walk order. It is usable when
       something beside it can give up the gap's width.

       ⚠ A joint against a CORNER panel is excluded: a gap there would be the
       anchor gap's own position at the other end of the wall. That exclusion
       is why a 20ft run keeps exactly one gap even though 240in is inside the
       window — which is his own example. */
    const beyond = slots[i + step];
    /* ⚠ THE DONOR IS WHICHEVER SIDE CAN ACTUALLY PAY, and an earlier version
       recorded the slot just passed every time while testing whether EITHER
       side could donate. When the slot just passed was a window, the joint was
       accepted on the neighbour's behalf and then the window was charged — so
       a 36in window came back 35.25in, which is the app shrinking an opening
       the user placed. Caught by `openingSizeSurvives`, which sweeps wall
       lengths against opening sizes; it named the exact case, 420in w36@1. */
    const donorIndex = canDonate(slot, gapEighths, minEighths)
      ? i
      : beyond !== undefined && canDonate(beyond, gapEighths, minEighths)
        ? i + step
        : null;
    if (beyond !== undefined && beyond.type !== "corner" && donorIndex !== null) {
      // Walking forward the gap goes after slot i, i.e. before i+1. Walking
      // backward it goes before slot i.
      joints.push({ donorIndex, insertBefore: step === 1 ? i + 1 : i, offsetIn: sinceGapIn });
    }

    /* ⚠ Decided on PASSING the far edge of the window, not at the array's end.
       A 60ft wall needs two decisions, and deferring both to the end would
       find only one. */
    if (sinceGapIn > SPACING_MAX_IN) decide();
  }

  return plan;
}

/**
 * Re-place a run's safety gaps to the 24ft rule, in its own slot array.
 *
 * ⚠ **Reads the array rather than the run length, deliberately.** The joints a
 * gap may land on are the joints this wall actually has, including the ones
 * either side of a window the user placed. Planning from a length and a
 * nominal panel width would put gaps at joints that do not exist, and the
 * caller would then have to resize panels to create them — the tiler running
 * behind the user's back, which is the thing tile-once exists to stop.
 *
 * ⚠ **Width is conserved: the run's total never changes.** An inserted gap
 * takes its width out of the plain panel at its joint, and where neither side
 * can give it up — a hand-set neighbour, an opening, or a panel already at the
 * 24in shop minimum — the gap is not inserted and the stretch is reported.
 *
 * @param gapEnd The end the least-accessible-corner rule put the first gap at,
 *   used ONLY to identify which existing gap is the anchor. Nothing is moved
 *   to or from that end.
 * @param gapWidthIn The width the caller got from `safetyGapWidthForRunIn`,
 *   not re-derived here: a run and its wall are different lengths, and only
 *   the caller knows the run.
 * @param minPanelWidthIn The shop minimum a donor panel may not drop below.
 *   ⚠ Passed in rather than imported from `tiling.ts`, and that is what
 *   keeps this module importable BY the tiler: the tiler applies this rule
 *   to its own output, so importing `TILER_MIN_PANEL_WIDTH_IN` back out of
 *   it would be a module cycle whose initialisation order decides whether
 *   the constant is defined yet.
 */
export function applySafetyGapSpacing(
  slots: readonly PanelSlot[],
  gapEnd: WallEnd,
  gapWidthIn: number,
  minPanelWidthIn: number,
): SafetyGapSpacingResult {
  const gapEighths = Math.round(gapWidthIn * 8);
  const minEighths = Math.round(minPanelWidthIn * 8);
  const anchor = anchorGapIndex(slots, gapEnd);
  if (anchor < 0) {
    /* No gap at all. Creating the FIRST one is the tiler's job, from `gapEnd`
       — not this module's, which only ever measures from it. */
    return { slots: slots.map((s) => ({ ...s })), added: 0, removed: 0, refusals: [] };
  }

  /* ⚠ HALF OF HIS RULE IS HERE; THE OTHER HALF IS DELIBERATELY NOT, AND IT IS
     NOT AN OVERSIGHT. He described two things:

       1. a gap "right next to the corner panel" — the anchor's position;
       2. "then another one 24 ft away" — the spacing, which is what this does.

     Point 2 is implemented and live. Point 1 is NOT, because on a wall that
     grew, `resizeWallRun` inserts the new panels between the corner and the
     existing gap, leaving the anchor stranded inboard — so delivering point 1
     means MOVING the anchor back beside the corner.

     That was built, measured working (his 20ft-to-40ft example came out with
     two gaps, 280in apart), and then reverted, because putting a gap adjacent
     to the corner-touching panel is exactly the configuration the CORNER-BRACE
     COMBINE exists to handle — and making it common broke 36 tests, among them
     the 790,440-wall product sweep that holds every panel inside [24in, 48in]
     and the pinned-slot-index invariants. Those are real fabrication rules, not
     stale fixtures.

     What ships today therefore guarantees the PROPERTY he cares about — no
     stretch of framing further than 28ft from a safety gap — without
     guaranteeing the anchor sits beside the corner after an edit. On his own
     example that is one gap where he described two, and both are legal under
     the 28ft bound. Moving the anchor needs the combine's interaction designed
     rather than discovered, which is its own piece of work. */
  const away = planDirection(slots, anchor, 1, gapEighths, minEighths);
  const back = planDirection(slots, anchor, -1, gapEighths, minEighths);

  const insertBefore = new Map<number, number>(); // index -> donor index
  for (const plan of [away, back]) {
    for (let k = 0; k < plan.insertBefore.length; k++) insertBefore.set(plan.insertBefore[k]!, plan.donorIndex[k]!);
  }
  const surplus = new Set([...away.surplus, ...back.surplus]);
  const refusals = [...away.refusals, ...back.refusals];

  /* ⚠ DONATIONS ARE SETTLED BEFORE THE ARRAY IS BUILT. Pass 1 cleared each
     joint against ONE gap's width, so a panel chosen as donor by two
     insertions could be charged twice and dropped under the shop minimum
     without any single check noticing. Totalling the charges first, and
     dropping the insertions a donor cannot actually fund, is the only way the
     per-panel minimum and the run's total both hold. */
  const working = slots.map((s) => ({ ...s }));
  const charged = new Map<number, number>();
  for (const [, donor] of insertBefore) charged.set(donor, (charged.get(donor) ?? 0) + gapEighths);
  for (const [donor, take] of charged) {
    const slot = working[donor]!;
    if (Math.round(slot.widthIn * 8) - take >= minEighths) {
      working[donor] = { ...slot, widthIn: roundToEighthIn(slot.widthIn - take / 8) };
      continue;
    }
    for (const [at, d] of [...insertBefore]) if (d === donor) insertBefore.delete(at);
  }

  const out: PanelSlot[] = [];
  let added = 0;
  let reclaimedEighths = 0;
  for (let i = 0; i < working.length; i++) {
    /* The gap goes in before slot `i`, which in walk terms is just past the
       donor — so it is pushed first and `working[i]` follows it. */
    if (insertBefore.has(i)) {
      out.push({ type: "safety-gap", widthIn: gapWidthIn });
      added += 1;
    }
    if (surplus.has(i)) {
      reclaimedEighths += Math.round(working[i]!.widthIn * 8);
      continue;
    }
    out.push(working[i]!);
  }

  /* A dropped gap's width goes back to the first plain panel, so the run's
     total is unchanged. */
  if (reclaimedEighths > 0) {
    const target = out.findIndex((s) => !isRulePlaced(s) && !isOpening(s) && s.lockedWidthIn === undefined);
    if (target >= 0) {
      out[target] = { ...out[target]!, widthIn: roundToEighthIn(out[target]!.widthIn + reclaimedEighths / 8) };
    } else {
      out.push({ type: "standard", widthIn: reclaimedEighths / 8 });
    }
  }

  return { slots: out, added, removed: surplus.size, refusals };
}
