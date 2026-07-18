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
  | "column";

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
}

export type WallEnd = "start" | "end";
