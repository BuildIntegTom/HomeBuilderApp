import { describe, expect, it } from "vitest";
import {
  buildStandardPanelMembers,
  buildBracedPanelMembers,
  buildGablePanelMembers,
  buildWindowHeaderMembers,
  type ExportableAssembly,
} from "@building-integrity/panel-catalog";
import { buildProjectPanelDxf, layOutProjectPanels } from "./projectPanelDxf";

/**
 * ⚠ **A WRONG DXF IS A VALID DXF.**
 *
 * Nothing about the format complains if the geometry is nonsense — a reader
 * opens the file, draws what it is told, and reports no error. The structural
 * tests live in `packages/panel-catalog/src/dxf.test.ts`; these are about
 * whether the drawing is of the right thing.
 *
 * ⚠ **The test that earned its place is the first one.** Measured on a drawn
 * building before it existed: **725 of 746 member polylines fell outside
 * their own panel outline.** `projectMemberShapes` is Y-DOWN and DXF is
 * Y-UP, so a member handed `z => -z` comes back spanning `[-(z + h), -z]`,
 * and an outline written as "from the base DOWN by the panel height" ends up
 * on the opposite side of the baseline from the parts it contains. The file
 * was perfectly well-formed the whole time.
 */

const DEPTH_IN = 15.5;

function assembly(over: Partial<ExportableAssembly> = {}): ExportableAssembly {
  return {
    panelType: "Wall panel",
    label: 'Standard 48"',
    widthIn: 48,
    heightIn: 96,
    copies: 3,
    usedAt: "N1, N3",
    members: buildStandardPanelMembers(48, DEPTH_IN, 96, false),
    ...over,
  };
}

const ASSEMBLIES: ExportableAssembly[] = [
  assembly(),
  assembly({
    label: 'Braced Panel 48"',
    members: buildBracedPanelMembers(48, DEPTH_IN, 96, false, "chevron", false),
  }),
  assembly({
    panelType: "Gable",
    label: 'Gable End Panel 48"',
    heightIn: 72,
    members: buildGablePanelMembers(48, DEPTH_IN, 48, 72, false),
  }),
  assembly({
    label: 'Header (Lintel) 40"',
    widthIn: 40,
    heightIn: 24,
    members: buildWindowHeaderMembers(40, DEPTH_IN, 24),
  }),
  /* A wide one, to force the grid to wrap. */
  assembly({ label: 'Standard 240"', widthIn: 240, members: buildStandardPanelMembers(240, DEPTH_IN, 96, false) }),
  assembly({ label: 'Standard 240" b', widthIn: 240, members: buildStandardPanelMembers(240, DEPTH_IN, 96, false) }),
  assembly({ label: 'Standard 240" c', widthIn: 240, members: buildStandardPanelMembers(240, DEPTH_IN, 96, false) }),
];

interface Poly {
  layer: string;
  points: { x: number; y: number }[];
}

function readPolylines(dxf: string): Poly[] {
  const body = dxf.split("\n").slice(0, -1);
  const pairs: [number, string][] = [];
  for (let i = 0; i + 1 < body.length + 1; i += 2) pairs.push([Number(body[i]), body[i + 1]!]);
  const out: Poly[] = [];
  let current: Poly | null = null;
  for (let i = 0; i < pairs.length; i++) {
    const [code, value] = pairs[i]!;
    if (code === 0 && value === "POLYLINE") current = { layer: pairs[i + 1]![1], points: [] };
    else if (code === 0 && value === "VERTEX" && current) {
      current.points.push({ x: Number(pairs[i + 2]![1]), y: Number(pairs[i + 3]![1]) });
    } else if (code === 0 && value === "SEQEND" && current) {
      out.push(current);
      current = null;
    }
  }
  return out;
}

const bbox = (points: { x: number; y: number }[]) => ({
  x0: Math.min(...points.map((p) => p.x)),
  x1: Math.max(...points.map((p) => p.x)),
  y0: Math.min(...points.map((p) => p.y)),
  y1: Math.max(...points.map((p) => p.y)),
});

function dxf(assemblies: ExportableAssembly[] = ASSEMBLIES): string {
  return buildProjectPanelDxf({
    projectName: "Untitled Project",
    siteName: "Site not set",
    dateIso: "2026-11-01",
    assemblies,
  });
}

describe("⚠ the panel DXF is a drawing of the right thing", () => {
  it("⚠ EVERY member lands inside its own panel's CELL, and no two cells touch", () => {
    /* ⚠ **The cell, not the outline**, and the difference is real rather
       than a loosened test: a roof panel's plumb-cut fascia hangs BELOW its
       own span, and an eave cap's seat reaches past the panel's end — the
       catalogue says so outright. The outline states the panel's nominal
       size; the cell is whatever has to fit.

       Checked against the LAYOUT rather than by guessing which polyline in
       the file belongs to which panel — which is why the layout is its own
       function. Measured before it was right: 725 of 746 members outside
       their own panel, and five overlapping cells. */
    const placed = layOutProjectPanels(ASSEMBLIES);
    expect(placed.length).toBe(ASSEMBLIES.length);

    const EPS = 1e-6;
    for (const panel of placed) {
      const points = [...panel.outline, ...panel.shapes.flatMap((s) => s.points)];
      expect(points.length).toBeGreaterThan(8);
      for (const pt of points) {
        expect({
          label: panel.assembly.label,
          inside:
            pt.x >= panel.cell.x0 - EPS &&
            pt.x <= panel.cell.x1 + EPS &&
            pt.y >= panel.cell.y0 - EPS &&
            pt.y <= panel.cell.y1 + EPS,
        }).toEqual({ label: panel.assembly.label, inside: true });
      }
    }

    const clashes: string[] = [];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!.cell;
        const b = placed[j]!.cell;
        if (a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS) {
          clashes.push(`${placed[i]!.assembly.label} x ${placed[j]!.assembly.label}`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it("⚠ a TALL row after a short one does not climb back into it", () => {
    /* The exact shape of the second bug: rows used to stand UP from a
       baseline dropped by the PREVIOUS row's height. Four short panels then
       one very tall one, wide enough to wrap, reproduces it. */
    const short = assembly({ label: "Short", widthIn: 220, heightIn: 24, members: buildWindowHeaderMembers(220, DEPTH_IN, 24) });
    const tall = assembly({ label: "Tall", widthIn: 220, heightIn: 240, members: buildStandardPanelMembers(220, DEPTH_IN, 240, false) });
    const placed = layOutProjectPanels([short, { ...short, label: "Short b" }, tall, { ...tall, label: "Tall b" }]);
    const EPS = 1e-6;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!.cell;
        const b = placed[j]!.cell;
        const overlap = a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;
        expect({ pair: `${placed[i]!.assembly.label}/${placed[j]!.assembly.label}`, overlap }).toEqual({
          pair: `${placed[i]!.assembly.label}/${placed[j]!.assembly.label}`,
          overlap: false,
        });
      }
    }
  });

  it("⚠ an outline is the panel's REAL size, to the thousandth", () => {
    /* A drawing at the wrong scale is the other failure a valid DXF hides. */
    const outlines = readPolylines(dxf()).filter((p) => p.layer === "PANEL_OUTLINE").map((p) => bbox(p.points));
    const sizes = outlines.map((o) => `${(o.x1 - o.x0).toFixed(3)}x${(o.y1 - o.y0).toFixed(3)}`).sort();
    const expected = ASSEMBLIES.map((a) => `${a.widthIn.toFixed(3)}x${a.heightIn.toFixed(3)}`).sort();
    expect(sizes).toEqual(expected);
  });

  it("a tilted member comes through as a real polygon, not a bounding box", () => {
    /* A braced panel's diagonal is the whole reason this reads
       `projectMemberShapes` rather than three extents. */
    const braced = readPolylines(
      dxf([assembly({ label: "Braced", members: buildBracedPanelMembers(48, DEPTH_IN, 96, false, "chevron", false) })]),
    ).filter((p) => p.layer === "LUMBER");
    const slanted = braced.filter((p) => {
      const xs = new Set(p.points.map((pt) => pt.x.toFixed(4)));
      const ys = new Set(p.points.map((pt) => pt.y.toFixed(4)));
      // A rectangle has exactly two distinct x and two distinct y.
      return xs.size > 2 || ys.size > 2;
    });
    expect(slanted.length).toBeGreaterThan(0);
  });

  it("every panel gets a label, and the title block says the units", () => {
    const text = dxf();
    expect(text).toContain("ALL DIMENSIONS IN INCHES");
    for (const a of ASSEMBLIES) expect(text).toContain(a.label);
    expect(text).toContain("x3");
  });

  it("an empty building still produces a readable file", () => {
    const text = dxf([]);
    expect(text).toContain("EOF");
    expect(readPolylines(text)).toEqual([]);
  });
});
