import { describe, expect, it } from "vitest";
import { buildDxf, DXF_MIME_TYPE } from "./dxf";

/**
 * ⚠ **DXF fails SILENTLY.** A wrong group code is skipped, not rejected — a
 * reader opens the file, draws nothing, and reports no error. So these tests
 * check the structure a reader actually walks, not just that a string came
 * back.
 */

/** Read a DXF back the way a reader does: alternating code/value lines. */
function pairs(text: string): [number, string][] {
  const lines = text.split("\n");
  const out: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    out.push([Number(lines[i]), lines[i + 1]!]);
  }
  return out;
}

const drawing = {
  layers: [
    { name: "LUMBER", colorIndex: 2 },
    { name: "PLYWOOD", colorIndex: 4 },
  ],
  polylines: [
    { layer: "LUMBER", closed: true, points: [{ x: 0, y: 0 }, { x: 48, y: 0 }, { x: 48, y: 96 }, { x: 0, y: 96 }] },
    { layer: "PLYWOOD", points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
  ],
  texts: [{ layer: "LUMBER", x: 0, y: -8, heightIn: 6, text: "Standard 48in" }],
};

describe("⚠ the DXF a shop actually opens", () => {
  it("⚠ every line is a group code / value pair, with no stray line", () => {
    /* The whole format is one long alternation. A single extra or missing
       line shifts every code after it and the rest of the file becomes
       nonsense that still parses. */
    const lines = buildDxf(drawing).split("\n");
    // A trailing empty line from the final newline is expected.
    expect(lines[lines.length - 1]).toBe("");
    expect((lines.length - 1) % 2).toBe(0);
    for (let i = 0; i < lines.length - 1; i += 2) {
      expect({ i, code: lines[i] }).toEqual({ i, code: String(Number(lines[i])) });
    }
  });

  it("⚠ the sections open and close in order and the file ends with EOF", () => {
    const p = pairs(buildDxf(drawing));
    const markers = p.filter(([code]) => code === 0).map(([, value]) => value);
    expect(markers[0]).toBe("SECTION");
    expect(markers[markers.length - 1]).toBe("EOF");
    expect(markers.filter((m) => m === "SECTION").length).toBe(markers.filter((m) => m === "ENDSEC").length);

    const sections = p.filter(([code, value], i) => code === 2 && p[i - 1]?.[1] === "SECTION").map(([, v]) => v);
    expect(sections).toEqual(["HEADER", "TABLES", "ENTITIES"]);
  });

  it("declares R12 and inches", () => {
    const text = buildDxf(drawing);
    expect(text).toContain("$ACADVER");
    expect(text).toContain("AC1009");
    expect(text).toContain("$INSUNITS");
  });

  it("⚠ every POLYLINE carries the 'vertices follow' flag and a SEQEND", () => {
    /* Code 66 is the single most common thing a hand-rolled DXF writer
       leaves out, and without it a reader treats the vertices as loose
       entities and draws nothing. */
    const p = pairs(buildDxf(drawing));
    const starts = p.map(([code, value], i) => (code === 0 && value === "POLYLINE" ? i : -1)).filter((i) => i >= 0);
    expect(starts.length).toBe(2);
    for (const start of starts) {
      const window = p.slice(start, start + 6);
      expect(window.some(([code, value]) => code === 66 && value === "1")).toBe(true);
    }
    expect(p.filter(([code, value]) => code === 0 && value === "SEQEND").length).toBe(2);
    expect(p.filter(([code, value]) => code === 0 && value === "VERTEX").length).toBe(6);
  });

  it("closed and open polylines differ by flag 70, and the geometry is NOT duplicated to close it", () => {
    /* Repeating the first point to close a shape is the other common
       hand-rolled mistake: it leaves a zero-length segment that some CAM
       packages treat as a pierce. */
    const p = pairs(buildDxf(drawing));
    /* Scan FORWARD from each POLYLINE rather than counting pairs backwards:
       the entity's own preamble is `0/POLYLINE, 8/layer, 66/1, 70/flag`, and
       a fixed offset is the sort of thing that silently stops matching the
       moment the writer gains a group code. */
    const flags = p
      .map(([code, value], i) => (code === 0 && value === "POLYLINE" ? i : -1))
      .filter((i) => i >= 0)
      .map((start) => p.slice(start, start + 6).find(([code]) => code === 70)![1]);
    expect(flags).toEqual(["1", "0"]);
    expect(p.filter(([code, value]) => code === 0 && value === "VERTEX").length).toBe(4 + 2);
  });

  it("⚠ reals are plain decimals, never exponent notation", () => {
    /* Some readers reject `1e-7` outright. */
    const text = buildDxf({
      ...drawing,
      polylines: [{ layer: "LUMBER", points: [{ x: 0.0000001, y: 1e21 }, { x: 1, y: 2 }] }],
    });
    expect(text).not.toMatch(/[eE][+-]\d/);
  });

  it("⚠ a newline inside a label cannot shift every code after it", () => {
    const text = buildDxf({ ...drawing, texts: [{ layer: "LUMBER", x: 0, y: 0, heightIn: 6, text: "two\nlines" }] });
    expect(text).toContain("two lines");
    const lines = text.split("\n");
    expect((lines.length - 1) % 2).toBe(0);
  });

  it("names every layer it draws on", () => {
    const text = buildDxf(drawing);
    const p = pairs(text);
    const declared = p.filter(([code], i) => code === 2 && p[i - 1]?.[1] === "LAYER").map(([, v]) => v);
    expect(declared).toEqual(["LUMBER", "PLYWOOD"]);
    const used = new Set(p.filter(([code]) => code === 8).map(([, v]) => v));
    for (const layer of used) expect(declared).toContain(layer);
  });

  it("skips a degenerate polyline and an empty label rather than writing a broken entity", () => {
    const text = buildDxf({
      layers: drawing.layers,
      polylines: [{ layer: "LUMBER", points: [{ x: 0, y: 0 }] }],
      texts: [{ layer: "LUMBER", x: 0, y: 0, heightIn: 6, text: "   " }],
    });
    expect(text).not.toContain("POLYLINE");
    expect(text).not.toContain("TEXT");
    expect(text).toContain("EOF");
  });

  it("has the mime type a browser download needs", () => {
    expect(DXF_MIME_TYPE).toBe("image/vnd.dxf");
  });
});
