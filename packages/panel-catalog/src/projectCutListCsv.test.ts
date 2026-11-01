import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";
import { buildProjectCutListCsv, type ExportableAssembly } from "./projectCutListCsv";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { buildGablePanelMembers } from "./gablePanelMembers";
import { computePanelCutList } from "./panelCutList";

/**
 * ⚠ **CSV's hard part is the quoting, and a cut list contains every character
 * that breaks it.**
 *
 * Commas live in the cut notes, double quotes in every inch mark (`47½"`),
 * and a long note can run to a newline. Each one, got wrong, shifts a column
 * silently — which on a cut list means a shop reading one part's length
 * against another part's angle. So these tests are mostly about the
 * characters, not about the arithmetic.
 */

const DEPTH_IN = 15.5;

function assembly(over: Partial<ExportableAssembly> = {}): ExportableAssembly {
  return {
    panelType: "Wall panel",
    label: 'Standard 48"',
    widthIn: 48,
    heightIn: 96,
    copies: 7,
    usedAt: "N1, N3, E2",
    members: buildStandardPanelMembers(48, DEPTH_IN, 96, false),
    ...over,
  };
}

function csv(assemblies: ExportableAssembly[]): string {
  return buildProjectCutListCsv({
    projectName: "Untitled Project",
    siteName: "Site not set",
    dateIso: "2026-11-01",
    assemblies,
  });
}

/** Parse a CSV the way a strict reader would, so the tests check the FILE
 * rather than the string we happened to build. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const body = text.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // part of CRLF
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

describe("⚠ the project cut list, as a file a spreadsheet can actually open", () => {
  it("⚠ leads with a UTF-8 BOM, because every length has a typographic fraction in it", () => {
    /* Excel on Windows opens a BOM-less UTF-8 file as the system codepage,
       so `47½"` arrives as `47Â½"` and a whole column of dimensions is
       mojibake. Three bytes, ignored by every other reader. */
    const text = csv([assembly()]);
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toContain("½");
  });

  it("⚠ round-trips through a strict parser with every row the same width", () => {
    /* The one thing a silently-broken quote does is change a row's field
       count. Nothing else in these tests would catch it. */
    const rows = parseCsv(csv([assembly(), assembly({ panelType: "Gable", label: "Gable 48\"", members: buildGablePanelMembers(48, DEPTH_IN, 48, 72, false) })]));
    const headerIndex = rows.findIndex((r) => r[0] === "Panel type");
    expect(headerIndex).toBeGreaterThan(0);
    const width = rows[headerIndex]!.length;
    expect(width).toBe(15);
    for (const row of rows.slice(headerIndex + 1)) {
      if (row.length === 1 && row[0] === "") continue;
      expect({ row: row[1], n: row.length }).toEqual({ row: row[1], n: width });
    }
  });

  it("⚠ a cut note full of commas and inch marks survives intact", () => {
    /* A brace's note is the worst case this app produces: it contains
       commas, a double quote in every measurement, and a semicolon-joined
       clause. It has to come back out of the file byte for byte. */
    const members = buildGablePanelMembers(48, DEPTH_IN, 48, 72, false);
    const rows = parseCsv(csv([assembly({ members })]));
    const header = rows.find((r) => r[0] === "Panel type")!;
    const noteColumn = header.indexOf("How to cut it");
    const lengthColumn = header.indexOf("Length");

    const source = computePanelCutList(members);
    const expectedNotes = source.map((r) => r.cutNote).filter((n) => n.length > 0);
    expect(expectedNotes.length).toBeGreaterThan(0);
    const fileNotes = rows.slice(rows.indexOf(header) + 1).map((r) => r[noteColumn]).filter((n) => n && n.length > 0);
    for (const note of expectedNotes) expect(fileNotes).toContain(note);

    // And the length column really does carry the inch mark, unescaped.
    const lengths = rows.slice(rows.indexOf(header) + 1).map((r) => r[lengthColumn]!);
    expect(lengths.some((l) => l.includes('"'))).toBe(true);
  });

  it("⚠ QUANTITY is given twice, and the two are different numbers", () => {
    /* A sheet is an instruction for building ONE panel; a purchase is for
       all of them. Conflating the two is how a job comes up short. */
    const rows = parseCsv(csv([assembly({ copies: 7 })]));
    const header = rows.find((r) => r[0] === "Panel type")!;
    const per = header.indexOf("Qty per panel");
    const total = header.indexOf("Qty total");
    const data = rows.slice(rows.indexOf(header) + 1).filter((r) => r.length === header.length);
    expect(data.length).toBeGreaterThan(0);
    for (const row of data) {
      expect(Number(row[total])).toBe(Number(row[per]) * 7);
    }
  });

  it("⚠ LENGTH is given twice too: the label a saw is set to, and a number a spreadsheet can sum", () => {
    const rows = parseCsv(csv([assembly()]));
    const header = rows.find((r) => r[0] === "Panel type")!;
    const label = header.indexOf("Length");
    const decimal = header.indexOf("Length (in)");
    const data = rows.slice(rows.indexOf(header) + 1).filter((r) => r.length === header.length);
    for (const row of data) {
      // Every decimal parses as a number, which `47½"` does not.
      expect({ l: row[label], ok: Number.isFinite(Number(row[decimal])) }).toEqual({ l: row[label], ok: true });
      expect(Number(row[decimal])).toBeGreaterThan(0);
    }
  });

  it("names the building above the header, not below the data", () => {
    const rows = parseCsv(csv([assembly()]));
    expect(rows[0]![0]).toContain("Building Integrity");
    expect(rows.findIndex((r) => r[0] === "Project")).toBeLessThan(rows.findIndex((r) => r[0] === "Panel type"));
    expect(rows.find((r) => r[0] === "Exported")![1]).toBe("2026-11-01");
  });

  it("an empty building exports a header and no parts, rather than throwing", () => {
    const rows = parseCsv(csv([]));
    const header = rows.find((r) => r[0] === "Panel type");
    expect(header).toBeDefined();
    expect(rows.slice(rows.indexOf(header!) + 1).filter((r) => r.length === header!.length)).toEqual([]);
  });
});

describe("the CSV writer itself", () => {
  it("quotes exactly the fields that need it, and doubles inner quotes", () => {
    const text = buildCsv(["a", "b"], [["plain", 'has "quotes"'], ["has,comma", "has\nnewline"], [" padded ", 12]], {
      byteOrderMark: false,
    });
    expect(text).toBe('a,b\r\nplain,"has ""quotes"""\r\n"has,comma","has\nnewline"\r\n" padded ",12\r\n');
  });

  it("writes null and undefined as empty, not as the words", () => {
    expect(buildCsv(["a", "b"], [[null, undefined]], { byteOrderMark: false })).toBe("a,b\r\n,\r\n");
  });
});
