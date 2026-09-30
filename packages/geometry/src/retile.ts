import { computeGapEnd, computeSafetyEnd } from "./gapPlacement";
import { cornerTurnAngleRad, footprintIsAllRightAngles, isConvexCorner, isRightAngleCorner } from "./cornerAngle";
import { reconcileBracedPlacement } from "./bracedPlacement";
import { getOpeningAnchors, markSafetyCorner, retileWithOpenings, tileWall, type OpeningAnchor } from "./tiling";
import { wallCompassDirection } from "./wallCompassDirection";
import { wallFabricationLengthIn } from "./eighths";
import { applyWallRunStop, hasWallRunStop } from "./wallRunStop";
import {
  EMPTY_RUN_STOP_OPENING_MEMORY,
  mergeRunStopOpenings,
  partitionOpeningsByRunStop,
  type RunStopOpeningMemory,
} from "./runStopOpenings";
import type { BracePattern, CornerId, Footprint, PanelSlot, Wall, WallEnd, WallRunStop } from "./types";

/** The project's seismic-zone-driven suggestion for brand-new braced-panel
 * positions (Tommy: "softly decouple [seismic auto-population] to be an
 * original suggestion for autopopulating panels, but then allows the user
 * to change each panel") — bundled since `retile`/`retilePreservingOpenings`
 * both need all 3 together, purely to seed NEW standard-slot positions;
 * existing per-wall braced decisions are preserved via
 * `reconcileBracedPlacement`, not re-derived from this every time. */
export interface BracedSeed {
  spacingIn: number;
  defaultPattern: BracePattern;
  defaultMirrored: boolean;
}

/** A fresh wall's own soft-default door/window suggestion (Tommy: "one
 * window on every row of slots... one door on the first level of the
 * east, south, and west faces") — bundled the same way `BracedSeed` is,
 * purely to seed brand-new wall positions; an existing wall's own
 * openings are never touched, same "already decided" precedent
 * `reconcileBracedPlacement` follows at the per-panel level. `randomFn`
 * defaults to `Math.random` — injectable for deterministic tests.
 * Omitted entirely (undefined) = today's exact behavior, no default
 * openings at all. */
export interface OpeningSeed {
  randomFn?: () => number;
}

/**
 * A fresh wall's own default door/window pick (Tommy's own confirmed
 * scope): every wall gets 1 default window; a wall facing exactly East,
 * South, or West (via `wallCompassDirection`) also gets 1 default door.
 * Only ever called on a wall with no prior slots (see `retile`/
 * `tileOneWallPreservingOpenings`'s own `oldSlots === undefined` branch) —
 * `plainSlots` is `tileWall`'s own freshly-tiled output, so every
 * non-corner/gap slot is still plain "standard" here; bracing itself
 * hasn't been decided yet (that's `reconcileBracedPlacement`'s job,
 * called afterward), so it simply routes around whatever this reserves.
 *
 * Candidate positions exclude the first/last standard-family ordinal —
 * Rule 1 in `applyBracedPlacement` always claims those for the mandatory
 * corner-touching brace, and Tommy's own confirmed answer is that a
 * default opening may only take a periodic MID-RUN brace's spot, never a
 * corner one. A wall with fewer than 3 standard slots has no eligible
 * non-corner candidate at all — no default opening is seeded for it.
 */
function seedDefaultOpenings(plainSlots: PanelSlot[], wall: Wall, fp: Footprint, randomFn: () => number): OpeningAnchor[] {
  const standardSlotIndices: number[] = [];
  plainSlots.forEach((slot, slotIndex) => {
    if (slot.type === "standard") standardSlotIndices.push(slotIndex);
  });
  const candidateOrdinals: number[] = [];
  for (let ordinal = 1; ordinal < standardSlotIndices.length - 1; ordinal++) candidateOrdinals.push(ordinal);

  const anchors: OpeningAnchor[] = [];
  const take = (type: "door" | "window") => {
    if (candidateOrdinals.length === 0) return;
    const pickAt = Math.floor(randomFn() * candidateOrdinals.length);
    const ordinal = candidateOrdinals.splice(pickAt, 1)[0]!;
    anchors.push({ beforeStandardCount: ordinal, type, widthIn: plainSlots[standardSlotIndices[ordinal]!]!.widthIn });
  };

  const facing = wallCompassDirection(wall, fp);
  if (facing === "E" || facing === "S" || facing === "W") take("door");
  take("window");
  return anchors;
}

export interface CornerEndOwnership {
  hasCorner: boolean;
  /** Subtracted from tiling length — thicknessIn for a normal (convex)
   * butt-joint loser, 0 for a winner or a reflex-corner loser (see below).
   * Explicit rather than derived from `hasCorner` because a reflex loser
   * needs no inset at all, unlike a convex loser. */
  insetAmount: number;
  /** Added to tiling length — thicknessIn at a reflex corner this end
   * wins, so its corner panel reaches flush with the other wall's interior
   * face. Always 0 otherwise. */
  extraLengthIn: number;
}

export interface CornerOwnership {
  start: CornerEndOwnership;
  end: CornerEndOwnership;
}

/**
 * Rectangles (and bump-outs built on one) use Tommy's site-wide
 * "least-accessible corner" marker to orient each wall's gap panel.
 * Mitered shapes (octagon) have no such marker — instead each wall
 * independently marks its own "left, standing outside" corner as the
 * safety end (see `computeSafetyEnd`), and that same corner panel becomes
 * a distinct safety-oct-corner slot (see `markSafetyCorner`).
 */
export function isMiteredShape(fp: Footprint): boolean {
  return !footprintIsAllRightAngles(fp);
}

export function gapEndFor(fp: Footprint, wall: Wall, leastAccessible: CornerId): WallEnd {
  return isMiteredShape(fp) ? computeSafetyEnd(wall, fp.corners) : computeGapEnd(wall, leastAccessible, fp.corners);
}

/**
 * At a plain CONVEX 90deg corner, only the locally shorter of the two
 * walls meeting there owns the corner panel — the longer one butts flush
 * against it (inset by wall thickness), no corner slot of its own there
 * (conventional framing through-wall/butt-wall convention). Ties are
 * broken by wall id so the result is deterministic.
 *
 * At a REFLEX (inside) 90deg corner — only possible once a bump-out
 * exists — that same "shorter wins, flat inset" rule doesn't work: the
 * owning wall's interior face doesn't cross the other wall's line within
 * that wall's own segment at all. Tommy's fix: the *original* (pre-
 * existing) wall always wins there, and its effective tiling length gets
 * one wall-thickness added so its corner panel reaches flush with the new
 * wall's interior face. The losing (new) wall must NOT also inset by a
 * wall-thickness the way a convex loser would — that was verified by
 * direct pixel measurement to leave a wall-thickness-sized gap where
 * neither panel renders anything, since the extension only fills the
 * winner's own thickness band, not the strip on the loser's side of the
 * vertex. Instead the loser just reaches its own natural endpoint
 * un-inset; combined with the winner's extension, the two panels then
 * meet exactly at the vertex with no gap. "Original" is derived from
 * `primaryCornerIds` (a wall counts as original if at least one of its two
 * endpoints is a primary corner) — falls back to locally-shorter-wins if
 * neither wall has a primary endpoint (e.g. a reflex corner between two
 * different bump-outs, a rare compound case).
 *
 * At a MITERED (non-90deg) corner — an octagon — both walls always own
 * their own corner panel there instead (symmetric), regardless of length.
 * This generalizes the old "shorter pair of a rectangle's 2 wall-pairs"
 * rule to any number of walls/corners: on a plain rectangle it reduces to
 * exactly the same 4 corners being owned by the same pair as before
 * (verified by hand).
 */
export function cornerOwnership(
  fp: Footprint,
  primary: Set<string>,
  thicknessIn: number,
): Record<string, CornerOwnership> {
  const ownership: Record<string, CornerOwnership> = {};
  for (const wall of fp.walls) {
    ownership[wall.id] = {
      start: { hasCorner: true, insetAmount: 0, extraLengthIn: 0 },
      end: { hasCorner: true, insetAmount: 0, extraLengthIn: 0 },
    };
  }

  for (const wall of fp.walls) {
    const nextWall = fp.walls.find((w) => w.startCorner === wall.endCorner);
    if (!nextWall) continue;
    const angle = cornerTurnAngleRad(wall, nextWall, fp.corners);
    if (!isRightAngleCorner(angle)) continue; // mitered — both keep owning (default above)

    const shorterWins = () =>
      wall.lengthFt !== nextWall.lengthFt ? wall.lengthFt < nextWall.lengthFt : wall.id < nextWall.id;

    if (isConvexCorner(wall, nextWall, fp.corners)) {
      const wallWins = shorterWins();
      ownership[wall.id]!.end = { hasCorner: wallWins, insetAmount: wallWins ? 0 : thicknessIn, extraLengthIn: 0 };
      ownership[nextWall.id]!.start = {
        hasCorner: !wallWins,
        insetAmount: !wallWins ? 0 : thicknessIn,
        extraLengthIn: 0,
      };
    } else {
      const wallIsOriginal = primary.has(wall.startCorner) || primary.has(wall.endCorner);
      const nextIsOriginal = primary.has(nextWall.startCorner) || primary.has(nextWall.endCorner);
      const wallWins = wallIsOriginal !== nextIsOriginal ? wallIsOriginal : shorterWins();
      // Reflex: the loser gets insetAmount 0 (not thicknessIn) — see the
      // comment above for why a flat inset leaves a gap here.
      ownership[wall.id]!.end = { hasCorner: wallWins, insetAmount: 0, extraLengthIn: wallWins ? thicknessIn : 0 };
      ownership[nextWall.id]!.start = {
        hasCorner: !wallWins,
        insetAmount: 0,
        extraLengthIn: !wallWins ? thicknessIn : 0,
      };
    }
  }
  return ownership;
}

/**
 * Corner ownership, adjusted for Stage 3 run stops.
 *
 * **The orphan corner — Tommy's decision, 2026-09-25: the corner simply does
 * not exist.** When a wall stops at a corner it OWNS, its corner panel is not
 * built. The neighbour that BUTTS against that corner was still being inset
 * by a wall thickness to make room for it — butting into air, leaving a
 * thickness-wide empty notch with nothing marking it, and still drawing an
 * "adjacent wall" filler sliver for a corner panel that no longer exists.
 * That is the same phantom Stage 3 removed on the stopped wall itself,
 * surviving on the other side of the corner.
 *
 * So: **neither wall builds a corner there, and the butting neighbour runs
 * out to its own true end** instead of insetting into nothing. Chosen over
 * transferring ownership to the neighbour.
 *
 * ### Why this is safe to do in ONE pass
 *
 * This is the first thing in Stage 3 where a stop on one wall changes
 * another wall's tiling, so the determinism argument matters:
 *
 * - **Only a CONVEX corner's loser carries an inset at all.** A reflex
 *   loser's `insetAmount` is already 0 by construction (see
 *   `cornerOwnership`), so reflex corners are untouched here — asserted in
 *   the tests rather than assumed.
 * - **The adjustment only ever makes a wall LONGER.** It can therefore never
 *   turn a wall that was buildable into a fully-stopped one, so no wall's
 *   own "is my corner built" answer can change as a result of another wall's
 *   adjustment. One pass reaches a fixed point; there is no iteration and no
 *   order dependence.
 * - **"Is this wall's corner built at this end" is read off BASE ownership
 *   and this wall's own stop only** — never off an already-adjusted value —
 *   which is what keeps the above true.
 * - **The merged-corner case cannot collide with this.** `resolveCorners`
 *   merges only when a wall owns corners at BOTH ends, and a stop at either
 *   end removes that end's corner, so a stopped wall never merges.
 *
 * An absent or all-zero stop map returns `cornerOwnership`'s own result
 * unchanged, which is every project saved before Stage 3.
 */
export function cornerOwnershipWithRunStops(
  fp: Footprint,
  primary: Set<string>,
  thicknessIn: number,
  runStopsByWallId?: Record<string, WallRunStop>,
): Record<string, CornerOwnership> {
  const base = cornerOwnership(fp, primary, thicknessIn);
  if (!runStopsByWallId || Object.keys(runStopsByWallId).length === 0) return base;

  /** Is the corner this wall owns at `end` actually BUILT? Read off base
   * ownership plus this wall's own stop — deliberately not off anything this
   * function has already adjusted. */
  const cornerIsBuilt = (wall: Wall, end: WallEnd): boolean => {
    const own = base[wall.id]!;
    if (!own[end].hasCorner) return false;
    const stop = runStopsByWallId[wall.id];
    if (!hasWallRunStop(stop)) return true;
    const baseLengthIn =
      wallFabricationLengthIn(wall) - own.start.insetAmount - own.end.insetAmount + own.start.extraLengthIn + own.end.extraLengthIn;
    const run = applyWallRunStop(
      { lengthIn: baseLengthIn, hasCornerStart: own.start.hasCorner, hasCornerEnd: own.end.hasCorner },
      stop,
    );
    return end === "start" ? run.hasCornerStart : run.hasCornerEnd;
  };

  const adjusted: Record<string, CornerOwnership> = {};
  for (const [id, own] of Object.entries(base)) {
    adjusted[id] = { start: { ...own.start }, end: { ...own.end } };
  }

  for (const wall of fp.walls) {
    const nextWall = fp.walls.find((w) => w.startCorner === wall.endCorner);
    if (!nextWall) continue;
    // `wall` owns this shared corner and is not building it -> `nextWall`
    // stops insetting into the space that corner panel would have filled.
    if (base[wall.id]!.end.hasCorner && !cornerIsBuilt(wall, "end")) {
      adjusted[nextWall.id]!.start.insetAmount = 0;
    }
    // ...and the mirror image, when the NEXT wall is the owner.
    if (base[nextWall.id]!.start.hasCorner && !cornerIsBuilt(nextWall, "start")) {
      adjusted[wall.id]!.end.insetAmount = 0;
    }
  }
  return adjusted;
}

/**
 * The ONE place a wall's tiling length and per-end corner flags are derived
 * from its corner ownership plus its Stage 3 run stop (if any) — shared by
 * `retile`, `retilePreservingOpenings`, `wallGeometryFor` and
 * `panelSlotBoxes3D` so those four can never disagree about how long a
 * wall's run is or where it starts. `panelSlotBoxes3D` learned that lesson
 * the expensive way once already (see its own doc comment on the
 * "long wall's panels are spaced out" bug), and a run stop is exactly the
 * kind of adjustment that would reproduce it: its defensive rescale would
 * silently STRETCH every panel on a stopped wall to fill the gap.
 *
 * `runStop` undefined (every project ever saved) returns today's numbers
 * unchanged.
 */
export function wallRunFor(wall: Wall, ownership: CornerOwnership, runStop?: WallRunStop) {
  const { start, end } = ownership;
  const lengthIn =
    wallFabricationLengthIn(wall) - start.insetAmount - end.insetAmount + start.extraLengthIn + end.extraLengthIn;
  return applyWallRunStop({ lengthIn, hasCornerStart: start.hasCorner, hasCornerEnd: end.hasCorner }, runStop);
}

/** Re-tiles every wall of a footprint from scratch — discards any existing
 * openings, since re-deriving corner ownership can change every wall's
 * available length. Used after any structural change (draw, bump-out,
 * wall-length edit, least-accessible-corner change). Braced-panel choices
 * are discarded right along with openings here (no prior wall to preserve
 * from — every standard slot gets freshly seeded via `bracedSeed`), same
 * as this function has always fully rebuilt everything else. */
export function retile(
  fp: Footprint,
  leastAccessible: CornerId,
  primary: Set<string>,
  standardWidthIn: number,
  cornerPanelWidthIn: number,
  thicknessIn: number,
  bracedSeed: BracedSeed,
  openingSeed?: OpeningSeed,
  runStopsByWallId?: Record<string, WallRunStop>,
  /** False when this panelization's corner panel cannot be fabricated off its
   * nominal width (Square Bale's 39in whole-bale corner) — see
   * `resolveCorners`' own doc comment in tiling.ts. */
  cornerMayWiden = true,
): Record<string, PanelSlot[]> {
  const next: Record<string, PanelSlot[]> = {};
  const ownership = cornerOwnershipWithRunStops(fp, primary, thicknessIn, runStopsByWallId);
  const mitered = isMiteredShape(fp);
  const randomFn = openingSeed?.randomFn ?? Math.random;
  for (const wall of fp.walls) {
    const gapEnd = gapEndFor(fp, wall, leastAccessible);
    const run = wallRunFor(wall, ownership[wall.id]!, runStopsByWallId?.[wall.id]);
    const { lengthIn, hasCornerStart, hasCornerEnd } = run;
    const start = { hasCorner: hasCornerStart };
    const end = { hasCorner: hasCornerEnd };
    // Octagon (and other mitered shapes) never borrow-and-split a standard
    // panel for the gap — Tommy: no standard-safety panels for octagons.
    const plainSlots = tileWall(
      lengthIn,
      standardWidthIn,
      cornerPanelWidthIn,
      gapEnd,
      start.hasCorner,
      end.hasCorner,
      !mitered,
      cornerMayWiden,
    ).slots;
    const seedAnchors = openingSeed ? seedDefaultOpenings(plainSlots, wall, fp, randomFn) : [];
    const slots =
      seedAnchors.length > 0
        ? retileWithOpenings(
            lengthIn,
            standardWidthIn,
            cornerPanelWidthIn,
            gapEnd,
            start.hasCorner,
            end.hasCorner,
            seedAnchors,
            !mitered,
            cornerMayWiden,
          ).slots
        : plainSlots;
    const seeded = reconcileBracedPlacement(
      undefined,
      slots,
      bracedSeed.spacingIn,
      standardWidthIn,
      bracedSeed.defaultPattern,
      bracedSeed.defaultMirrored,
    );
    next[wall.id] = mitered ? markSafetyCorner(seeded, gapEnd) : seeded;
  }
  return next;
}

/** Re-tiles one wall, reusing `oldSlots`' existing openings via the same
 * anchor mechanism `handleSetWindowWidth`/`handleToggleOpening` already
 * use for a single-wall re-tile — falls back to a plain (opening-free)
 * tile when no old slots are supplied (a brand-new wall, or one whose old
 * openings don't carry forward — see `retilePreservingOpenings`). */
function tileOneWallPreservingOpenings(
  oldSlots: PanelSlot[] | undefined,
  wallLengthIn: number,
  standardWidthIn: number,
  cornerPanelWidthIn: number,
  gapEnd: WallEnd,
  hasCornerStart: boolean,
  hasCornerEnd: boolean,
  allowBorrow: boolean,
  wall: Wall,
  fp: Footprint,
  openingSeed?: OpeningSeed,
  cornerMayWiden = true,
  /** Present only for a wall carrying a run stop — see `WallRunStopContext`
   * and `runStopOpenings.ts`. Absent (every unstopped wall, and every project
   * saved before Stage 3) means the old openings are reused exactly as they
   * always were, byte-identical. */
  runStop?: WallRunStopContext,
): { slots: PanelSlot[]; memory: RunStopOpeningMemory } {
  if (!oldSlots) {
    const plainSlots = tileWall(
      wallLengthIn,
      standardWidthIn,
      cornerPanelWidthIn,
      gapEnd,
      hasCornerStart,
      hasCornerEnd,
      allowBorrow,
      cornerMayWiden,
    ).slots;
    const seedAnchors = openingSeed ? seedDefaultOpenings(plainSlots, wall, fp, openingSeed.randomFn ?? Math.random) : [];
    // Seeded against the plain tiling of the run that is actually BUILT
    // (`wallLengthIn` already has the stop taken out of it), so a freshly
    // seeded opening is inside the built span by construction and there is
    // nothing to withhold. A wall with no old counterpart also has no memory
    // to restore — the same rule that makes it lose its openings.
    if (seedAnchors.length === 0) return { slots: plainSlots, memory: EMPTY_RUN_STOP_OPENING_MEMORY };
    return {
      slots: retileWithOpenings(
        wallLengthIn,
        standardWidthIn,
        cornerPanelWidthIn,
        gapEnd,
        hasCornerStart,
        hasCornerEnd,
        seedAnchors,
        allowBorrow,
        cornerMayWiden,
      ).slots,
      memory: EMPTY_RUN_STOP_OPENING_MEMORY,
    };
  }
  // Everything this wall is MEANT to have: what it currently builds, plus
  // anything an earlier stop withheld. Reducing or clearing the stop is what
  // lets the withheld ones back in, and they come back by their own original
  // anchors — see `mergeRunStopOpenings`.
  const intended = mergeRunStopOpenings(getOpeningAnchors(oldSlots), runStop?.remembered);
  const { kept, memory } = runStop
    ? partitionOpeningsByRunStop({
        basisLengthIn: runStop.basisLengthIn,
        basisHasCornerStart: runStop.basisHasCornerStart,
        basisHasCornerEnd: runStop.basisHasCornerEnd,
        builtLengthIn: wallLengthIn,
        builtHasCornerStart: hasCornerStart,
        builtHasCornerEnd: hasCornerEnd,
        startStopIn: runStop.startStopIn,
        endStopIn: runStop.endStopIn,
        standardWidthIn,
        cornerWidthIn: cornerPanelWidthIn,
        gapEnd,
        allowBorrow,
        cornerMayWiden,
        openings: intended,
      })
    : { kept: intended, memory: EMPTY_RUN_STOP_OPENING_MEMORY };
  return {
    slots: retileWithOpenings(
      wallLengthIn,
      standardWidthIn,
      cornerPanelWidthIn,
      gapEnd,
      hasCornerStart,
      hasCornerEnd,
      kept,
      allowBorrow,
      cornerMayWiden,
    ).slots,
    memory,
  };
}

/** Same as `retile`, but preserves each wall's existing window/door/column
 * openings wherever the caller can identify a corresponding old wall for
 * it (Tommy: "make a surefire way that... panelization rules... dont
 * produce panels that adhere to the primary floor layout" — bump-out/
 * drag-wall/wall-length-edit no longer wipe every OTHER wall's openings
 * just because one wall changed elsewhere). `oldSlotsByNewWallId` is keyed
 * by the NEW footprint's wall ids — the caller resolves the old-to-new
 * correlation, since it differs by operation: an id-stable operation
 * (dragWall, editWallLength) can pass its old `baseWallSlots` straight
 * through unmodified, since ids never change; `insertBumpOut` (which
 * renumbers every id) needs an exact-point-pair lookup first — see
 * `handleAddBumpOut` in page.tsx. A missing entry (undefined) means "no
 * old counterpart" — that wall gets plain-tiled with no openings, same as
 * `retile`. */
export function retilePreservingOpenings(
  fp: Footprint,
  leastAccessible: CornerId,
  primary: Set<string>,
  standardWidthIn: number,
  cornerPanelWidthIn: number,
  thicknessIn: number,
  oldSlotsByNewWallId: Record<string, PanelSlot[] | undefined>,
  bracedSeed: BracedSeed,
  openingSeed?: OpeningSeed,
  runStopsByWallId?: Record<string, WallRunStop>,
  /** See `retile`'s own parameter of the same name. */
  cornerMayWiden = true,
): Record<string, PanelSlot[]> {
  return retilePreservingOpeningsWithRunStopMemory(
    fp,
    leastAccessible,
    primary,
    standardWidthIn,
    cornerPanelWidthIn,
    thicknessIn,
    oldSlotsByNewWallId,
    bracedSeed,
    openingSeed,
    runStopsByWallId,
    cornerMayWiden,
  ).slotsByWallId;
}

/** What a stopped wall hands `partitionOpeningsByRunStop` — the basis run the
 * stop is measured in, the stop itself, and whatever a previous stop already
 * withheld on this wall. */
interface WallRunStopContext {
  basisLengthIn: number;
  basisHasCornerStart: boolean;
  basisHasCornerEnd: boolean;
  startStopIn: number;
  endStopIn: number;
  remembered: RunStopOpeningMemory | undefined;
}

export interface RetileWithRunStopMemoryResult {
  slotsByWallId: Record<string, PanelSlot[]>;
  /** Per wall, the openings an unbuilt span swallowed — **not built and not
   * deleted** — together with the pre-stop order restore needs to put them
   * back beside the survivors (see `RunStopOpeningMemory`). A wall with
   * nothing withheld has no entry at all, so an unstopped project's map is
   * `{}`, exactly as it was before this existed.
   *
   * ⚠ **A caller that writes `slotsByWallId` back must write this back too.**
   * They are two halves of one answer: the slots say what is built, this says
   * what was set aside so it can come back. Keeping the first and dropping
   * the second is exactly the window-data loss Tommy's "drop them, and
   * remember" decision rules out.
   *
   * ⚠ **A wall id that is no longer in `fp.walls` must not be carried
   * forward.** A stale entry would attach to a NEW wall that later reuses the
   * id and resurrect a window on an unrelated wall — see the prune in
   * `projectStateNow` in page.tsx. This function only ever emits ids it was
   * given walls for; the hazard is on the caller's side of the state. */
  unbuiltOpeningsByWallId: Record<string, RunStopOpeningMemory>;
}

/**
 * `retilePreservingOpenings` plus Stage 3's run-stop opening memory (Tommy,
 * 2026-09-29: **"Drop them, and remember"**).
 *
 * An opening that falls inside a wall's unbuilt span is not built — it leaves
 * the slot list, and with it the cut list, the fabrication groups and the
 * shop drawings, because an unbuilt section of wall has no window in it. It
 * is returned in `unbuiltOpeningsByWallId` instead, and handing that same
 * record back in on a later re-tile is what restores it exactly — width,
 * height, sill height, zones, braced style, every field its `OpeningAnchor`
 * carries — the moment the stop no longer covers it.
 *
 * See `runStopOpenings.ts` for how "inside the unbuilt span" is derived (the
 * anchors are ordinals, not distances), for the measurement behind Tommy's
 * 174in, for why the surviving openings are never re-anchored for the BUILT
 * run, and for the pre-stop order the memory has to carry so that restoring
 * cannot put two openings back in each other's places.
 *
 * An unstopped wall takes no new code path at all: `partitionOpeningsByRunStop`
 * returns its input array before it tiles anything.
 *
 * ### The one place this feature DOES lose window data, stated rather than left
 * silent
 *
 * A wall with **no old counterpart** — `oldSlotsByNewWallId[wall.id]` absent —
 * is plain-tiled with no openings at all, and the caller's id remap (see
 * `handleAddBumpOut` and the collapse branch of the wall drag in page.tsx)
 * drops that wall's run-stop memory along with its openings. So a bump-out or
 * a corner collapse that destroys a wall's run destroys anything a stop on it
 * had set aside, permanently. That is a genuine deletion inside a feature
 * whose promise is "never deleted", and it is deliberate: the wall's old run
 * no longer exists as a run, so there is no basis to measure a remembered
 * opening's position against and no honest place to put it back. It matches
 * how the same operations already treat the wall's BUILT openings, which they
 * also drop. **If this is ever revisited, the fix is on the caller's side —
 * a real old-to-new wall correlation — not here.**
 */
export function retilePreservingOpeningsWithRunStopMemory(
  fp: Footprint,
  leastAccessible: CornerId,
  primary: Set<string>,
  standardWidthIn: number,
  cornerPanelWidthIn: number,
  thicknessIn: number,
  oldSlotsByNewWallId: Record<string, PanelSlot[] | undefined>,
  bracedSeed: BracedSeed,
  openingSeed?: OpeningSeed,
  runStopsByWallId?: Record<string, WallRunStop>,
  /** See `retile`'s own parameter of the same name. */
  cornerMayWiden = true,
  /** What an earlier stop on each wall withheld. Omitted (every caller that
   * predates this, and every unstopped project) means nothing to restore. */
  unbuiltOpeningsByWallId?: Record<string, RunStopOpeningMemory>,
): RetileWithRunStopMemoryResult {
  const next: Record<string, PanelSlot[]> = {};
  const unbuiltOut: Record<string, RunStopOpeningMemory> = {};
  const ownership = cornerOwnershipWithRunStops(fp, primary, thicknessIn, runStopsByWallId);
  const mitered = isMiteredShape(fp);
  for (const wall of fp.walls) {
    const gapEnd = gapEndFor(fp, wall, leastAccessible);
    const runStop = runStopsByWallId?.[wall.id];
    const run = wallRunFor(wall, ownership[wall.id]!, runStop);
    const { lengthIn, hasCornerStart, hasCornerEnd } = run;
    const start = { hasCorner: hasCornerStart };
    const end = { hasCorner: hasCornerEnd };
    const oldSlots = oldSlotsByNewWallId[wall.id];
    // The BASIS run — this wall with its own stop removed but every other
    // wall's still applied, which is the coordinate a stop is measured in
    // (`wallRunStopBasisIn` in page.tsx takes exactly the same view). Built
    // from the SAME orphan-adjusted ownership as `run`, so the two cannot
    // disagree about where this wall's line begins.
    const basis = wallRunFor(wall, ownership[wall.id]!, undefined);
    const hasStop = hasWallRunStop(runStop) || (unbuiltOpeningsByWallId?.[wall.id]?.unbuilt.length ?? 0) > 0;
    const { slots, memory } = tileOneWallPreservingOpenings(
      oldSlots,
      lengthIn,
      standardWidthIn,
      cornerPanelWidthIn,
      gapEnd,
      start.hasCorner,
      end.hasCorner,
      !mitered,
      wall,
      fp,
      openingSeed,
      cornerMayWiden,
      hasStop
        ? {
            basisLengthIn: basis.lengthIn,
            basisHasCornerStart: basis.hasCornerStart,
            basisHasCornerEnd: basis.hasCornerEnd,
            startStopIn: run.startStopIn,
            endStopIn: run.endStopIn,
            remembered: unbuiltOpeningsByWallId?.[wall.id],
          }
        : undefined,
    );
    if (memory.unbuilt.length > 0) unbuiltOut[wall.id] = memory;
    // Preserves this wall's own prior braced-panel decisions (type, style,
    // mirror) by position, seeding only genuinely new standard-slot
    // positions via `bracedSeed` — see `reconcileBracedPlacement`'s own
    // doc comment. `oldSlots` undefined (no old counterpart for this wall
    // id) means every standard slot here is new — full fresh seed, same
    // as `retile`.
    const reconciled = reconcileBracedPlacement(
      oldSlots,
      slots,
      bracedSeed.spacingIn,
      standardWidthIn,
      bracedSeed.defaultPattern,
      bracedSeed.defaultMirrored,
    );
    next[wall.id] = mitered ? markSafetyCorner(reconciled, gapEnd) : reconciled;
  }
  return { slotsByWallId: next, unbuiltOpeningsByWallId: unbuiltOut };
}

export interface WallGeometry {
  /** Does this wall BUILD a corner panel at this end — corner ownership AND
   * no run stop there. This is what the tiler wants. */
  hasCornerStart: boolean;
  hasCornerEnd: boolean;
  /** Does this wall OWN the corner at this end, ignoring any run stop.
   * Distinct from `hasCorner*` and the distinction matters on screen: a
   * stop does not change the NEIGHBOUR, so where the neighbour owns the
   * corner its panel is still physically there and the elevation still
   * draws the "adjacent wall" filler sliver for it — with the unbuilt span
   * drawn between that sliver and this wall's own run. */
  ownsCornerStart: boolean;
  ownsCornerEnd: boolean;
  /** How far this wall's run is inset at each end because the NEIGHBOUR's
   * corner panel occupies it — already adjusted for the orphan-corner rule,
   * so it is 0 when that neighbour is not building the corner after all.
   * `> 0` is the right test for "draw the adjacent-wall filler sliver". */
  startInsetIn: number;
  endInsetIn: number;
  /** Where this wall's panel run begins, in inches from the wall's own TRUE
   * start corner: the butt-joint inset (or a negative reflex extension)
   * plus any start stop. Every renderer that places this wall's content —
   * the printable plan, the live canvas, the panel snap lines, the gable
   * column alignment — measures from here. */
  runStartOffsetIn: number;
  /** The mirror of `runStartOffsetIn`, measured in from the wall's TRUE end
   * corner. `wallFabricationLengthIn(wall) - runEndOffsetIn` is where the
   * run finishes. */
  runEndOffsetIn: number;
  gapEnd: WallEnd;
  /** The length actually tiled — already reduced by any run stop. */
  lengthIn: number;
  allowBorrow: boolean;
  /**
   * What this wall would tile at with **no stop anywhere in the building** —
   * corner ownership only, before the orphan-corner rule is applied.
   *
   * **⚠ The sum invariant is NOT stated against this.** It used to say
   * `Σ slot widths + startStopIn + endStopIn === unstoppedLengthIn`, and
   * that is measurably false on any wall whose neighbour is stopped at their
   * shared corner: the orphan rule lets that wall grow by a wall thickness,
   * so the left side exceeds this by exactly that much (344.5 vs 329 on a
   * 30x20 rectangle). Following the old sentence literally is what made the
   * first refusal reject every legitimate stop that reached a corner — the
   * browser harness had to catch it.
   *
   * **The invariant that IS true, and the one to write tests against:**
   *
   *   `Σ slot widths === wallGeometryFor(wall, currentStops).lengthIn`
   *
   * i.e. against this wall's CURRENT tiling length under the CURRENT stop
   * map. That holds unconditionally, orphan adjustment included.
   *
   * This field survives for the narrower job it is still right for: as the
   * basis a stop on THIS wall is measured and clamped against, and as the
   * "what would it have been" figure a Review Log entry quotes. See
   * `wallRunStopBasisIn` in page.tsx, which is careful to take this with
   * other walls' stops applied and only this wall's own removed.
   */
  unstoppedLengthIn: number;
  /** Inches deliberately not built at each end — 0/0 for a normal wall. */
  startStopIn: number;
  endStopIn: number;
  /** The stored stops asked for more than the wall has and were reduced to
   * fit. Surfaced in the Review Log rather than corrected silently. */
  stopClamped: boolean;
  /** Nothing at all is built on this wall. */
  fullyStopped: boolean;
}

/** Everything needed to re-tile one specific wall (as opposed to `retile`,
 * which rebuilds every wall) — shared by the opening-toggle/window-resize
 * handlers, which only need to redo the one wall a user interacted with.
 *
 * **Takes the WHOLE stop map, not just this wall's own record**, and that is
 * load-bearing rather than convenient: since the orphan-corner rule, a stop
 * on the NEIGHBOUR changes this wall's inset (see
 * `cornerOwnershipWithRunStops`). Omitted — the default, and every
 * pre-Stage-3 project — it changes nothing at all. See `wallRunStop.ts` for
 * what a stop is measured from. */
export function wallGeometryFor(
  footprint: Footprint,
  wallId: string,
  primaryCornerIds: Set<string>,
  leastAccessibleCorner: CornerId,
  thicknessIn: number,
  runStopsByWallId?: Record<string, WallRunStop>,
): WallGeometry | null {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const runStop = runStopsByWallId?.[wallId];
  const ownership = cornerOwnershipWithRunStops(footprint, primaryCornerIds, thicknessIn, runStopsByWallId)[wall.id]!;
  // The UNSTOPPED baseline has to come off unadjusted ownership, or a
  // neighbour's stop would silently move this wall's "what it would have
  // been" figure — which is the number the sum invariant is stated against.
  const baseOwnership = cornerOwnership(footprint, primaryCornerIds, thicknessIn)[wall.id]!;
  const gapEnd = gapEndFor(footprint, wall, leastAccessibleCorner);
  // `wallFabricationLengthIn`, not `lengthFt * 12`: the tiled length has to
  // be a whole number of eighths or the panels can never sum to it. Both
  // adjustments are wall thicknesses (14 / 15.5 / 15.75in), all themselves
  // whole eighths, so the result stays on the grid. A run stop is on the
  // grid too, so the shortened run still is.
  const unstopped = wallRunFor(wall, baseOwnership, undefined);
  const run = wallRunFor(wall, ownership, runStop);
  const allowBorrow = !isMiteredShape(footprint);
  return {
    hasCornerStart: run.hasCornerStart,
    hasCornerEnd: run.hasCornerEnd,
    ownsCornerStart: ownership.start.hasCorner,
    ownsCornerEnd: ownership.end.hasCorner,
    // The ADJUSTED insets. `> 0` is exactly "the neighbour's corner panel
    // really is sitting in this end of my line", which is the only thing
    // that should make the elevation draw an adjacent-wall filler sliver.
    startInsetIn: ownership.start.insetAmount,
    endInsetIn: ownership.end.insetAmount,
    runStartOffsetIn:
      (ownership.start.extraLengthIn > 0 ? -ownership.start.extraLengthIn : ownership.start.insetAmount) +
      run.startStopIn,
    runEndOffsetIn:
      (ownership.end.extraLengthIn > 0 ? -ownership.end.extraLengthIn : ownership.end.insetAmount) + run.endStopIn,
    gapEnd,
    lengthIn: run.lengthIn,
    allowBorrow,
    unstoppedLengthIn: unstopped.lengthIn,
    startStopIn: run.startStopIn,
    endStopIn: run.endStopIn,
    stopClamped: run.clamped,
    fullyStopped: run.fullyStopped,
  };
}
