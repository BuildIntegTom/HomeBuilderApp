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
  | "braced";

export interface PanelSlot {
  type: PanelSlotType;
  widthIn: number;
}

export type WallEnd = "start" | "end";
