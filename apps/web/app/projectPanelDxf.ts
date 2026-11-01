import {
  buildDxf,
  type DxfLayer,
  type DxfPolyline,
  type DxfText,
  type ExportableAssembly,
} from "@building-integrity/panel-catalog";
import { projectMemberShapes } from "./MemberElevationShapes";

/**
 * ⚠ **EVERY UNIQUE PANEL AS A TO-SCALE 2D ELEVATION, laid out on one
 * drawing.**
 *
 * The CSV tells a shop what to cut; this tells them what it looks like. One
 * panel per cell, in a grid, every member drawn as a closed polyline at full
 * size in inches, with the panel's own outline and a label under it.
 *
 * ⚠ **It reads `projectMemberShapes` — the SAME projection the Shop
 * Fabrication sheets draw.** That function already knows how to flatten a
 * plain box, a tilted box, a bevelled trapezoid brace and a plumb-cut
 * section into an elevation, and it is the one the sheets use. A second
 * projection written here would be a second opinion about what a panel looks
 * like, which is precisely the class of defect this codebase keeps finding
 * (`deckPanelTakeoff`, `crossTiltTakeoff`, the cut list vs the gable lift).
 *
 * ⚠ **A WRONG DXF IS A VALID DXF**, and this export proved it twice while
 * being written. Both times the file opened, drew, and reported nothing:
 *
 *  - `projectMemberShapes` is Y-DOWN and DXF is Y-UP, so a panel's parts came
 *    out on the opposite side of its baseline from its outline. Measured on a
 *    drawn building: **725 of 746 member polylines outside their own panel.**
 *  - Rows stood UP from a baseline and the next row dropped by the height of
 *    the row just finished — which clears the PREVIOUS row while the new one
 *    grows upward by its OWN. Measured: **five overlapping cells**, a 21ft
 *    floor panel lying across a truss plate.
 *
 * So the layout is a separate, tested function (`layOutProjectPanels`) and
 * this file only renders it.
 */

/** Layers, so a CAD user can switch material on and off, and a CAM operator
 * can cut one and ignore the rest. */
const LAYER_LUMBER = "LUMBER";
const LAYER_PLYWOOD = "PLYWOOD";
const LAYER_OUTLINE = "PANEL_OUTLINE";
const LAYER_LABEL = "LABELS";

const LAYERS: DxfLayer[] = [
  { name: LAYER_LUMBER, colorIndex: 2 },
  { name: LAYER_PLYWOOD, colorIndex: 4 },
  { name: LAYER_OUTLINE, colorIndex: 7 },
  { name: LAYER_LABEL, colorIndex: 3 },
];

/** Space between panels on the sheet, and how tall the labels are. Drawing
 * furniture, not building dimensions — nothing here is a fabrication figure. */
const GUTTER_IN = 24;
const LABEL_HEIGHT_IN = 6;
/** Wrap the grid at roughly this width, so the sheet stays squarish rather
 * than becoming one enormous row. */
const TARGET_SHEET_WIDTH_IN = 480;

export interface DrawnShape {
  layer: string;
  points: { x: number; y: number }[];
}

export interface PlacedPanel {
  assembly: ExportableAssembly;
  /** The panel's NOMINAL rectangle, in drawing coordinates. */
  outline: { x: number; y: number }[];
  /** Its members, projected and placed. */
  shapes: DrawnShape[];
  /**
   * ⚠ **The space this panel occupies, which is NOT its outline.**
   *
   * A member may legitimately stick out past the nominal rectangle, and two
   * do: a roof panel's plumb-cut fascia hangs BELOW its own span, and an eave
   * cap's seat reaches past the panel's end — the catalogue says so outright
   * (*"the seat extends beyond the panel's end, which is why its members sit
   * outside the panel box — that is the point of a cap"*). The outline states
   * the panel's size; the cell is what has to fit on the sheet.
   */
  cell: { x0: number; x1: number; y0: number; y1: number };
  /** The top of this panel's two label lines. */
  labelTopY: number;
}

/**
 * ⚠ **THE SHEET LAYOUT, as data rather than as a side effect of writing a
 * file** — so it can be checked without parsing DXF back out.
 *
 * ⚠ **A row hangs DOWN from its own top line.** Standing a row UP from a
 * baseline and dropping the next by the height of the row just finished
 * clears the PREVIOUS row's height while the new row grows upward by its
 * OWN, so any row taller than the one before it climbs back into it. Hanging
 * from a top line, a row occupies `[top - height, top]` whatever its height
 * is, and the next top clears it unconditionally.
 */
export function layOutProjectPanels(assemblies: readonly ExportableAssembly[]): PlacedPanel[] {
  /* ⚠ A panel with no size cannot be drawn to scale, and a zero-width cell
     would collapse the grid around it. Its parts are still in the CSV. */
  const drawable = assemblies.filter((a) => a.widthIn > 0 && a.heightIn > 0 && a.members.length > 0);

  /* Project once, into the panel's own frame: x right, z UP. */
  const projected = drawable.map((assembly) => {
    const shapes = projectMemberShapes(
      assembly.members,
      (xIn) => xIn,
      /* ⚠ Y-DOWN, which is what `projectMemberShapes` documents itself as
         requiring. The `z = -yDown` below is the ONE place it flips back.
         Doing it twice is how a drawing comes out mirrored, in a file that is
         otherwise perfectly well formed. */
      (zIn) => -zIn,
    ).map((shape) => ({
      layer: shape.member.material === "plywood" ? LAYER_PLYWOOD : LAYER_LUMBER,
      points:
        shape.kind === "rect"
          ? [
              { x: shape.rect!.xPx, z: -shape.rect!.yPx },
              { x: shape.rect!.xPx + shape.rect!.widthPx, z: -shape.rect!.yPx },
              { x: shape.rect!.xPx + shape.rect!.widthPx, z: -(shape.rect!.yPx + shape.rect!.heightPx) },
              { x: shape.rect!.xPx, z: -(shape.rect!.yPx + shape.rect!.heightPx) },
            ]
          : shape.points!.map((point) => ({ x: point.xPx, z: -point.yPx })),
    }));
    const xs = [0, assembly.widthIn, ...shapes.flatMap((s) => s.points.map((p) => p.x))];
    const zs = [0, assembly.heightIn, ...shapes.flatMap((s) => s.points.map((p) => p.z))];
    return {
      assembly,
      shapes,
      minXIn: Math.min(...xs),
      maxXIn: Math.max(...xs),
      minZIn: Math.min(...zs),
      maxZIn: Math.max(...zs),
    };
  });

  const out: PlacedPanel[] = [];
  let cursorXIn = 0;
  let rowTopIn = 0;
  let rowHeightIn = 0;

  /**
   * ⚠ **A cell has to be wide enough for its LABEL, not just its panel.**
   *
   * A 3/4in safety gap and a 25in header are real panels with 40-character
   * names under them, and on a first draft their labels ran straight through
   * each other: *"Header (Lintel) 25⅝\"Header (Lintel) 40⅛\""*. DXF `TEXT`
   * has no width, so nothing in the format prevents it.
   *
   * 0.6 x the glyph height is the usual rule of thumb for a monospaced-ish
   * average and is plenty here — it only ever makes a cell wider, so an
   * over-estimate costs white space and an under-estimate costs legibility.
   * Drawing furniture: nothing here is a fabrication figure.
   */
  const labelWidthIn = (panel: ExportableAssembly) =>
    Math.max(
      `${panel.label}  (x${panel.copies})`.length * LABEL_HEIGHT_IN * 0.6,
      `${panel.panelType} — ${panel.usedAt}`.length * LABEL_HEIGHT_IN * 0.7 * 0.6,
    );

  for (const item of projected) {
    const cellWidthIn = Math.max(item.maxXIn - item.minXIn, labelWidthIn(item.assembly));
    const cellHeightIn = item.maxZIn - item.minZIn;
    if (cursorXIn > 0 && cursorXIn + cellWidthIn > TARGET_SHEET_WIDTH_IN) {
      rowTopIn -= rowHeightIn + LABEL_HEIGHT_IN * 4 + GUTTER_IN;
      cursorXIn = 0;
      rowHeightIn = 0;
    }
    rowHeightIn = Math.max(rowHeightIn, cellHeightIn);

    /* The cell's top-left corner is pinned, so whatever hangs below or
       outside the nominal panel still hangs inside the cell. */
    const originXIn = cursorXIn - item.minXIn;
    const baseYIn = rowTopIn - item.maxZIn;
    const place = (xIn: number, zIn: number) => ({ x: originXIn + xIn, y: baseYIn + zIn });

    out.push({
      assembly: item.assembly,
      outline: [
        place(0, 0),
        place(item.assembly.widthIn, 0),
        place(item.assembly.widthIn, item.assembly.heightIn),
        place(0, item.assembly.heightIn),
      ],
      shapes: item.shapes.map((shape) => ({
        layer: shape.layer,
        points: shape.points.map((p) => place(p.x, p.z)),
      })),
      cell: { x0: cursorXIn, x1: cursorXIn + cellWidthIn, y0: rowTopIn - cellHeightIn, y1: rowTopIn },
      labelTopY: rowTopIn - cellHeightIn,
    });

    cursorXIn += cellWidthIn + GUTTER_IN;
  }
  return out;
}

export interface ProjectPanelDxfInput {
  projectName: string;
  siteName: string;
  dateIso: string;
  assemblies: readonly ExportableAssembly[];
}

export function buildProjectPanelDxf(input: ProjectPanelDxfInput): string {
  const polylines: DxfPolyline[] = [];
  const texts: DxfText[] = [];
  const placed = layOutProjectPanels(input.assemblies);

  for (const panel of placed) {
    polylines.push({ layer: LAYER_OUTLINE, closed: true, points: panel.outline });
    for (const shape of panel.shapes) {
      polylines.push({ layer: shape.layer, closed: true, points: shape.points });
    }
    /* The labels sit BELOW the cell, where a title block goes, rather than
       inside it where they would land on the framing. */
    texts.push({
      layer: LAYER_LABEL,
      x: panel.cell.x0,
      y: panel.labelTopY - LABEL_HEIGHT_IN * 1.4,
      heightIn: LABEL_HEIGHT_IN,
      text: `${panel.assembly.label}  (x${panel.assembly.copies})`,
    });
    texts.push({
      layer: LAYER_LABEL,
      x: panel.cell.x0,
      y: panel.labelTopY - LABEL_HEIGHT_IN * 2.6,
      heightIn: LABEL_HEIGHT_IN * 0.7,
      text: `${panel.assembly.panelType} — ${panel.assembly.usedAt || "not placed"}`,
    });
  }

  /* ⚠ The title block says the units in words. A DXF carries `$INSUNITS`,
     but a reader that predates it treats the numbers as bare drawing units,
     and a drawing whose scale depends on a header variable is one that will
     eventually be read at the wrong one. */
  texts.push({
    layer: LAYER_LABEL,
    x: 0,
    y: LABEL_HEIGHT_IN * 3,
    heightIn: LABEL_HEIGHT_IN * 1.6,
    text: `Building Integrity — ${input.projectName} — panel elevations — ALL DIMENSIONS IN INCHES`,
  });
  texts.push({
    layer: LAYER_LABEL,
    x: 0,
    y: LABEL_HEIGHT_IN * 1.2,
    heightIn: LABEL_HEIGHT_IN * 0.8,
    text: `${input.siteName} — exported ${input.dateIso} — fabricator document, not engineer-stamped — ${placed.length} unique panels`,
  });

  return buildDxf({ layers: LAYERS, polylines, texts });
}
