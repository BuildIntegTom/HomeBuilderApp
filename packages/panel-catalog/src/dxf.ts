/**
 * ⚠ **A MINIMAL, DELIBERATELY OLD-FASHIONED DXF WRITER.**
 *
 * This emits **R12 (`AC1009`)**, which is the most widely readable DXF there
 * is: AutoCAD, LibreCAD, QCAD, Inkscape, Illustrator, Fusion, a plasma
 * table's nesting software and every cheap CAM package all open it. Later
 * revisions add `LWPOLYLINE`, object handles, a `$HANDSEED` that has to stay
 * consistent, and an `OBJECTS` section — none of which buys a cut file
 * anything, and each of which is one more thing to get subtly wrong in a
 * format where a wrong group code is silently ignored rather than rejected.
 *
 * So: `POLYLINE`/`VERTEX`/`SEQEND` and `TEXT`, on named layers, and nothing
 * else.
 *
 * ⚠ **A DXF has no intrinsic unit.** `$INSUNITS` says inches, and readers
 * that predate it simply treat the numbers as drawing units — which are
 * inches, because that is what every dimension in this app already is. The
 * caller should also say so in a title block, because a drawing whose scale
 * depends on a header variable is a drawing that will eventually be read at
 * the wrong one.
 *
 * ⚠ **DXF is Y-UP.** Every 2D projection in this app is Y-down (an SVG
 * convention, see `projectMemberShapes`), so somebody has to flip. The
 * caller does it, once, rather than this writer doing it invisibly.
 */

export interface DxfLayer {
  name: string;
  /** AutoCAD Color Index. 1 red, 2 yellow, 3 green, 4 cyan, 5 blue, 6
   * magenta, 7 white/black, 8 dark grey. */
  colorIndex: number;
}

export interface DxfPolyline {
  layer: string;
  points: readonly { x: number; y: number }[];
  closed?: boolean;
}

export interface DxfText {
  layer: string;
  x: number;
  y: number;
  heightIn: number;
  text: string;
}

export interface DxfDrawing {
  layers: readonly DxfLayer[];
  polylines: readonly DxfPolyline[];
  texts: readonly DxfText[];
}

/** DXF reals: plain decimal, never exponent notation, which some readers
 * reject outright. */
function real(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  /* ⚠ **`toFixed` is not exponent-free.** At or past 1e21 it gives up and
     returns `1e+21`, which some readers reject outright and others read as
     1 — a coordinate off by twenty-one orders of magnitude, in a format that
     reports no error. Nothing in a building reaches that, which is exactly
     why it would never be noticed; clamped rather than trusted. */
  const clamped = Math.max(-1e20, Math.min(1e20, value));
  /* Keep the decimal point: `10` is a valid real to most readers but `10.0`
     is what every writer in the wild emits, and matching them costs nothing. */
  return clamped.toFixed(6);
}

/**
 * ⚠ DXF text is a single line in a format with no escaping worth the name.
 * A newline would end the group value and shift every code after it, so
 * control characters are stripped rather than escaped.
 */
function textValue(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim();
}

function pair(code: number, value: string | number): string {
  return `${code}\n${value}\n`;
}

export function buildDxf(drawing: DxfDrawing): string {
  let out = "";

  // ---- HEADER -----------------------------------------------------------
  out += pair(0, "SECTION") + pair(2, "HEADER");
  out += pair(9, "$ACADVER") + pair(1, "AC1009");
  /* 1 = inches. Unknown to R12 readers, which ignore it harmlessly. */
  out += pair(9, "$INSUNITS") + pair(70, 1);
  out += pair(0, "ENDSEC");

  // ---- TABLES: the layers -----------------------------------------------
  out += pair(0, "SECTION") + pair(2, "TABLES");
  out += pair(0, "TABLE") + pair(2, "LAYER") + pair(70, drawing.layers.length);
  for (const layer of drawing.layers) {
    out += pair(0, "LAYER") + pair(2, layer.name) + pair(70, 0) + pair(62, layer.colorIndex) + pair(6, "CONTINUOUS");
  }
  out += pair(0, "ENDTAB") + pair(0, "ENDSEC");

  // ---- ENTITIES ----------------------------------------------------------
  out += pair(0, "SECTION") + pair(2, "ENTITIES");
  for (const polyline of drawing.polylines) {
    if (polyline.points.length < 2) continue;
    out += pair(0, "POLYLINE") + pair(8, polyline.layer);
    /* 66 = "vertices follow", which R12 requires and which is the single
       most common thing a hand-rolled DXF writer leaves out. */
    out += pair(66, 1) + pair(70, polyline.closed ? 1 : 0);
    out += pair(10, "0.0") + pair(20, "0.0") + pair(30, "0.0");
    for (const point of polyline.points) {
      out += pair(0, "VERTEX") + pair(8, polyline.layer);
      out += pair(10, real(point.x)) + pair(20, real(point.y)) + pair(30, "0.0");
    }
    out += pair(0, "SEQEND") + pair(8, polyline.layer);
  }
  for (const text of drawing.texts) {
    const value = textValue(text.text);
    if (value.length === 0) continue;
    out += pair(0, "TEXT") + pair(8, text.layer);
    out += pair(10, real(text.x)) + pair(20, real(text.y)) + pair(30, "0.0");
    out += pair(40, real(text.heightIn)) + pair(1, value);
  }
  out += pair(0, "ENDSEC");

  out += pair(0, "EOF");
  return out;
}

export const DXF_MIME_TYPE = "image/vnd.dxf";
