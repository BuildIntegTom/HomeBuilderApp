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
}

export type WallEnd = "start" | "end";
