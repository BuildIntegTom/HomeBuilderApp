import { computeGapEnd, computeSafetyEnd } from "./gapPlacement";
import { cornerTurnAngleRad, footprintIsAllRightAngles, isConvexCorner, isRightAngleCorner } from "./cornerAngle";
import { reconcileBracedPlacement } from "./bracedPlacement";
import { getOpeningAnchors, markSafetyCorner, retileWithOpenings, tileWall } from "./tiling";
import type { BracePattern, CornerId, Footprint, PanelSlot, Wall, WallEnd } from "./types";

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
): Record<string, PanelSlot[]> {
  const next: Record<string, PanelSlot[]> = {};
  const ownership = cornerOwnership(fp, primary, thicknessIn);
  const mitered = isMiteredShape(fp);
  for (const wall of fp.walls) {
    const gapEnd = gapEndFor(fp, wall, leastAccessible);
    const { start, end } = ownership[wall.id]!;
    const lengthIn = wall.lengthFt * 12 - start.insetAmount - end.insetAmount + start.extraLengthIn + end.extraLengthIn;
    // Octagon (and other mitered shapes) never borrow-and-split a standard
    // panel for the gap — Tommy: no standard-safety panels for octagons.
    const slots = tileWall(lengthIn, standardWidthIn, cornerPanelWidthIn, gapEnd, start.hasCorner, end.hasCorner, !mitered)
      .slots;
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
): PanelSlot[] {
  if (!oldSlots) {
    return tileWall(wallLengthIn, standardWidthIn, cornerPanelWidthIn, gapEnd, hasCornerStart, hasCornerEnd, allowBorrow)
      .slots;
  }
  return retileWithOpenings(
    wallLengthIn,
    standardWidthIn,
    cornerPanelWidthIn,
    gapEnd,
    hasCornerStart,
    hasCornerEnd,
    getOpeningAnchors(oldSlots),
    allowBorrow,
  ).slots;
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
): Record<string, PanelSlot[]> {
  const next: Record<string, PanelSlot[]> = {};
  const ownership = cornerOwnership(fp, primary, thicknessIn);
  const mitered = isMiteredShape(fp);
  for (const wall of fp.walls) {
    const gapEnd = gapEndFor(fp, wall, leastAccessible);
    const { start, end } = ownership[wall.id]!;
    const lengthIn = wall.lengthFt * 12 - start.insetAmount - end.insetAmount + start.extraLengthIn + end.extraLengthIn;
    const oldSlots = oldSlotsByNewWallId[wall.id];
    const slots = tileOneWallPreservingOpenings(
      oldSlots,
      lengthIn,
      standardWidthIn,
      cornerPanelWidthIn,
      gapEnd,
      start.hasCorner,
      end.hasCorner,
      !mitered,
    );
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
  return next;
}

export interface WallGeometry {
  hasCornerStart: boolean;
  hasCornerEnd: boolean;
  gapEnd: WallEnd;
  lengthIn: number;
  allowBorrow: boolean;
}

/** Everything needed to re-tile one specific wall (as opposed to `retile`,
 * which rebuilds every wall) — shared by the opening-toggle/window-resize
 * handlers, which only need to redo the one wall a user interacted with. */
export function wallGeometryFor(
  footprint: Footprint,
  wallId: string,
  primaryCornerIds: Set<string>,
  leastAccessibleCorner: CornerId,
  thicknessIn: number,
): WallGeometry | null {
  const wall = footprint.walls.find((w) => w.id === wallId);
  if (!wall) return null;
  const { start, end } = cornerOwnership(footprint, primaryCornerIds, thicknessIn)[wall.id]!;
  const gapEnd = gapEndFor(footprint, wall, leastAccessibleCorner);
  const lengthIn = wall.lengthFt * 12 - start.insetAmount - end.insetAmount + start.extraLengthIn + end.extraLengthIn;
  const allowBorrow = !isMiteredShape(footprint);
  return { hasCornerStart: start.hasCorner, hasCornerEnd: end.hasCorner, gapEnd, lengthIn, allowBorrow };
}
