import type { PanelMember } from "./componentSchema";
import { buildCsv, type CsvCell } from "./csv";
import { computePanelCutList } from "./panelCutList";

/**
 * ⚠ **ONE FABRICATED ASSEMBLY, flattened to what an export needs.**
 *
 * Every fabrication group in this app is a different shape — a wall panel
 * group carries instances with slot ids, a floor panel group carries a run
 * and a plan, a beam group carries a covered length. What an export wants
 * from all of them is the same five things, so the caller reduces its own
 * groups to this and the exporters stop caring which pipeline produced what.
 *
 * ⚠ **This is deliberately the shape a DXF or a spreadsheet export would
 * want too**, not a CSV-specific one. The next export reads the same list.
 */
export interface ExportableAssembly {
  /** "Standard", "Floor Panel", "Truss Plate" — the family, for grouping. */
  panelType: string;
  /** What its own Shop Fabrication sheet is titled. */
  label: string;
  widthIn: number;
  heightIn: number;
  /** How many identical copies the building needs. */
  copies: number;
  /** Where they go, as the sheet names them: "N1, N3, E2". */
  usedAt: string;
  members: PanelMember[];
}

export interface ProjectCutListCsvInput {
  projectName: string;
  siteName: string;
  /** ISO date, for the file's own header row. */
  dateIso: string;
  assemblies: readonly ExportableAssembly[];
}

/**
 * ⚠ **THE PROJECT'S WHOLE CUT LIST, as one flat table.**
 *
 * Every Shop Fabrication sheet already computes its own cut list; this is
 * the same rows, from the same `computePanelCutList`, for every assembly at
 * once. A shop opens one file and sorts it however they are actually
 * working — by material to pull stock, by length to gang-cut, by panel to
 * build.
 *
 * ⚠ **Two quantity columns, and the difference matters.** `Qty per panel` is
 * what the sheet shows; `Qty total` multiplies it by how many copies the
 * building needs. A sheet is an instruction for building ONE; a purchase is
 * for all of them, and conflating the two is how a job comes up short.
 *
 * ⚠ **Two length columns too.** `Length` is what the sheet prints and a saw
 * is set to (`47½"`, or a long point on a bevel); `Length (in)` is the same
 * figure as a plain decimal, because a spreadsheet cannot sum `47½"`. They
 * come from the same member, so they cannot disagree.
 */
export function buildProjectCutListCsv(input: ProjectCutListCsvInput): string {
  const headers = [
    "Panel type",
    "Panel",
    "Width (in)",
    "Height (in)",
    "Copies",
    "Used at",
    "Letter",
    "Part",
    "Material",
    "Qty per panel",
    "Qty total",
    "Length",
    "Length (in)",
    "Angle",
    "How to cut it",
  ];

  const rows: CsvCell[][] = [];
  for (const assembly of input.assemblies) {
    for (const row of computePanelCutList(assembly.members)) {
      /* The decimal beside the printed label. Taken from the first member
         sharing this letter, which is the one the label was formatted from —
         a letter exists precisely because its members are identical. */
      const lengthIn = row.members[0]?.actualDimsIn.lengthIn;
      rows.push([
        assembly.panelType,
        assembly.label,
        round(assembly.widthIn),
        round(assembly.heightIn),
        assembly.copies,
        assembly.usedAt,
        row.letter,
        row.partLabel,
        row.materialLabel,
        row.qty,
        row.qty * assembly.copies,
        row.lengthLabel,
        lengthIn === undefined ? "" : round(lengthIn),
        row.angleLabel,
        row.cutNote,
      ]);
    }
  }

  return buildCsv(headers, rows, {
    preamble: [
      ["Building Integrity — project cut list"],
      ["Project", input.projectName],
      ["Site", input.siteName],
      ["Exported", input.dateIso],
      [
        "Note",
        "Fabricator document, not engineer-stamped. Every length is the piece AS CUT — a bevelled piece is given at its LONG POINT, with the angle in its own column.",
      ],
      [],
    ],
  });
}

/** Inches to 1/1000, which is finer than anything this app cuts to and keeps
 * a spreadsheet from showing 47.624999999999996. */
function round(valueIn: number): number {
  return Math.round(valueIn * 1000) / 1000;
}
