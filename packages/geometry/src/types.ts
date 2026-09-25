export interface Point {
  x: number;
  y: number;
}

/**
 * Corner ids, in order going around the footprint. Widened from a fixed
 * 4-corner union to a generic string so N-sided polygons (octagon,
 * bump-outs) can use their own id scheme — rectangle generation keeps
 * "A"/"B"/"C"/"D" for continuity, octagon uses "0".."7".
 */
export type CornerId = string;

export interface Corner {
  id: CornerId;
  point: Point;
}

export type WallId = string;

export interface Wall {
  id: WallId;
  startCorner: CornerId;
  endCorner: CornerId;
  lengthFt: number;
}

export interface Footprint {
  corners: Corner[];
  walls: Wall[];
}

export type PanelSlotType =
  | "corner"
  | "safety-oct-corner"
  | "standard"
  | "safety-gap"
  | "window"
  | "door"
  | "braced"
  | "column"
  | "big-header";

/** Declared locally rather than imported from panel-catalog's own
 * `BracePattern` — `packages/geometry` doesn't depend on
 * `packages/panel-catalog` (same reason `SAFETY_GAP_WIDTH_IN` is
 * duplicated rather than imported there). Kept in sync by hand; see
 * `PanelSlot.bracedPattern`. */
export type BracePattern = "chevron" | "hatch";

export interface PanelSlot {
  type: PanelSlotType;
  widthIn: number;
  /** A slot can carry a second type alongside its primary one (Tommy: "have
   * multiple types of panels be represented in a particular panel") — e.g.
   * a safety-gap panel near a corner that also satisfies the braced-panel
   * placement rule, instead of needing two separate adjacent panels.
   * Undefined = single-type slot, the overwhelmingly common case. */
  secondaryType?: PanelSlotType;
  /** Only meaningful for "window" slots (Tommy: "an option for 5 different
   * standard window heights, and that should determine the height of the
   * windows... i want each window individually adjustable") — this
   * window's own Rough Opening height (sill-top to header-bottom).
   * Undefined = not yet customized, falls back to the project's default
   * (`standardWindowHeightDefaultIn` in panel-catalog's data.ts), same
   * "absent = default" convention as `secondaryType`. Doors don't use
   * this — a door's RO height is always the confirmed
   * `computeDoorRoughOpeningHeightIn` formula, not user-adjustable. */
  heightIn?: number;
  /** Only meaningful for "window" slots — this window's own sill height
   * (floor to Rough Opening bottom), draggable independently of `heightIn`
   * (the RO's own height, i.e. its top edge) via the 3D Sill & Header drag
   * tool. Undefined = not yet customized, falls back to the project's
   * default (`sillDefaultHeightIn` in panel-catalog's data.ts), same
   * "absent = default" convention as `heightIn`. Doors don't use this —
   * a door's RO always starts at the floor (bottomZIn = 0). */
  sillHeightIn?: number;
  /** Only meaningful for "braced" slots — which diagonal-brace pattern and
   * left/right orientation this specific panel uses (Tommy: "I want this
   * editor to be quite flexible... include each panel style for braced
   * panels in the click-through cycle... allows the user to change each
   * panel"). Undefined on a "braced" slot means "not yet decided" — falls
   * back to the project's global default (see `applyBracedPlacement`'s
   * `defaultPattern`/`defaultMirrored`), same "absent = default" convention
   * as `heightIn`/`sillHeightIn` above; this should only actually happen
   * for legacy data predating this field. */
  bracedPattern?: BracePattern;
  /** See `bracedPattern` — false/undefined = the pattern's own base
   * orientation (chevron points "<", hatch runs "/"); true = mirrored
   * (chevron points ">", hatch runs "\"). */
  bracedMirrored?: boolean;
  /** Independent vertical zones within this column, bottom-to-top (Tommy:
   * "the panels above and below a beam are their own unique panels" — and,
   * separately, a wall taller than the project's own max panel height
   * auto-splits the same way). Additive/optional — every horizontal/
   * structural consumer of PanelSlot (retile, tiling, corner ownership,
   * braced placement) only ever reads this slot's own top-level fields, so
   * an absent `zones` is invisible to all of them; a real `zones` array
   * always keeps `zones[0]` (the bottom-most zone) mirrored onto this
   * slot's own top-level type/heightIn/sillHeightIn/bracedPattern/
   * bracedMirrored/secondaryType (see panelSlotZones.ts's own
   * zoneFromSlot/applyZonesToSlot), which is what makes that invisibility
   * safe rather than just silently stale. */
  zones?: PanelSlotZone[];
  /** This slot's own explicitly user-dragged width (Tommy: "when you click
   * and drag a panel, it moves, snapping... to other panels' edges" — a
   * standard/braced slot's own widthIn is normally always freshly re-
   * derived by the tiling engine on every retile; this is the one
   * exception, a fixed-width reservation that survives an unrelated retile
   * elsewhere on the wall instead of resetting back to the tiling engine's
   * own computed width. Only ever set on a "standard" or "braced" slot —
   * see reconcileBracedPlacement, which is what re-applies it (forcing
   * `widthIn` back to this value and shedding the difference to the
   * nearest still-unlocked standard-family neighbor) after every retile.
   * Undefined = today's exact behavior, a slot's width is always whatever
   * the tiling engine currently computes. */
  lockedWidthIn?: number;
  /** Only meaningful for "big-header" slots (Tommy: "2 with the option to
   * have a sill under it as an option in the left bar but default not") —
   * a Big Header normally has no sill (it can span double doors, large
   * openings, conditioned garages), but a sill panel can be opted in
   * underneath it. Undefined/false = no sill, the default. */
  includeSillOnBigHeader?: boolean;
}

/** One independently-editable vertical zone of a PanelSlot column — same
 * fields as PanelSlot's own per-zone data, minus widthIn (shared by every
 * zone in the column) and minus `zones` itself (zones don't nest). */
export interface PanelSlotZone {
  type: PanelSlotType;
  secondaryType?: PanelSlotType;
  heightIn?: number;
  sillHeightIn?: number;
  bracedPattern?: BracePattern;
  bracedMirrored?: boolean;
}

/**
 * A whole-building horizontal slice (Tommy: "maybe it sees the ground
 * level, and then can shift upward to the next ring of panels at a
 * particular height") — one ring of panels spanning every wall at a shared
 * height range, with its own independently-editable `wallSlots`. Ground
 * floor is always `stories[0]`; additional stories are appended as real,
 * separately-stored data (never the same object reference another story
 * points at) rather than mirroring another story's slots by reference.
 */
export interface Story {
  /** Deliberately a 2-member union, not a generic string — caps this at
   * today's ground+one-additional-story cardinality. Widening to a plain
   * string id is the natural seam for a future N-story pass. */
  id: "ground" | "second";
  label: string;
  wallHeightFt: number;
  wallSlots: Record<WallId, PanelSlot[]>;
}

export type WallEnd = "start" | "end";

/**
 * How much of one wall is deliberately NOT built (Tommy: "an addition tool
 * setting or stop wall tool so that it is possible to make incomplete
 * walls") — inches measured in from each end of the wall, on the 1/8in
 * grid. The footprint polygon stays closed either way: "incomplete" is a
 * property of the panel RUN, never of the shape.
 *
 * **Declared in Stage 0 of Project Smearforn and read by nothing yet.** It
 * ships with the v24->v25 file bump so the format settles once, and Stage 3
 * is what teaches `wallGeometryFor` to subtract it. An absent record means
 * a fully panelized wall, which is every existing project.
 */
export interface WallRunStop {
  startStopIn: number;
  endStopIn: number;
}
