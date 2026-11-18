import { describe, expect, it } from "vitest";
import type { ExportableAssembly } from "./projectCutListCsv";
import {
  buildTip4urTimeCsv,
  TIP4URTIME_CODE_MAX_LENGTH,
  tip4urTimeExportProblems,
  tip4urTimePanels,
  tip4urTimeSqFt,
} from "./tip4urTimeCsv";
import { panelKey } from "./panelKey";
import {
  EMPTY_PANEL_NUMBER_LEDGER,
  panelNumberKeys,
  stampPanelNumbers,
  type PanelNumberLedger,
} from "./panelNumber";

/* ⚠ **B36 stride 2 — the ledger left this module, and its format changed.**
   A panel's one number is `0042`, not `P-0042`, and it is issued in INSTALL
   order rather than in the export pipeline's. These two helpers keep the
   fixtures below about the export rather than about the ledger: `stamp` issues
   numbers (with no install order handed in, so the pipeline order IS the
   order), and `numbers` is what `tip4urTimePanels` now takes — a plain
   number-by-key map, because printing a row has no business holding a
   ledger. */
const stamp = (assemblies: ExportableAssembly[], ledger: PanelNumberLedger = EMPTY_PANEL_NUMBER_LEDGER) =>
  stampPanelNumbers(panelNumberKeys(assemblies), ledger, new Map());
const numbers = (ledger: PanelNumberLedger) => new Map(Object.entries(ledger.codesByKey));

/** Only the fields this export reads; `members` is irrelevant here and a
 *  single empty one keeps the fixtures about the thing being tested. */
function assembly(
  panelType: string,
  typeName: string,
  instanceNames: string[],
  widthIn = 48,
  heightIn = 96,
  countsAsPanel = true,
  depthIn = 15.5,
): ExportableAssembly {
  return {
    panelType,
    typeName,
    label: `${typeName} ${widthIn}in`,
    widthIn,
    heightIn,
    depthIn,
    copies: instanceNames.length,
    usedAt: instanceNames.join(", "),
    instanceNames,
    countsAsPanel,
    members: [],
  };
}

describe("tip4urTimeSqFt", () => {
  it("is a plain number with up to 2 decimals, no trailing zeros", () => {
    /* His own examples: 32 and 32.5, never 32.00. */
    expect(tip4urTimeSqFt((48 * 96) / 144)).toBe(32);
    expect(tip4urTimeSqFt((48 * 97.5) / 144)).toBe(32.5);
    expect(String(tip4urTimeSqFt((48 * 96) / 144))).toBe("32");
    expect(String(tip4urTimeSqFt((40.125 * 96) / 144))).toBe("26.75");
  });
});

describe("\u26a0 a SHOP ITEM is measured by its largest face \u2014 his 2026-11-15 acceptance check", () => {
  it("a safety gap reads 12.9 sq ft, not the 0.63 the elevation gives", () => {
    /* His own numbers, verbatim: *"For a safety gap that is the plywood seen
       edge-on: 0.75in x 120in = 0.63 sq ft. He wants the piece's largest face
       instead \u2014 for that same gap, the sheet: 15.5in x 120in = 12.9 sq ft."*
       This is the test the whole change exists to pass. */
    const gap = assembly("Wall panel", "Safety Gap", ["N4"], 0.75, 120, false, 15.5);
    const ledger = stamp([gap]);
    const [row] = tip4urTimePanels([gap], numbers(ledger));
    expect(tip4urTimeSqFt(row.sqFt)).toBe(12.92);
    expect(row.countsAsPanel).toBe(false);
    /* The two dimensions on the row are unchanged \u2014 a crew still reads a
       3/4in by 10ft piece off it. The sq ft deliberately does not multiply
       out from them; the 15.5in depth is the missing factor. */
    expect([row.widthIn, row.heightIn]).toEqual([0.75, 120]);
  });

  it("a STRAW PANEL is untouched, even when its largest face is through the wall", () => {
    /* *"Shop items only. Straw panels keep their elevation face, unchanged."*
       A 48in gable tile only 12in tall in a 15.5in wall has its biggest face
       lying down (48 x 15.5 = 5.17) rather than standing (48 x 12 = 4) \u2014 so a
       plain `max` would have quietly re-measured the top of every gable row. */
    const tile = assembly("Wall panel", "Gable End Panel", ["G1"], 48, 12, true, 15.5);
    const ledger = stamp([tile]);
    const [row] = tip4urTimePanels([tile], numbers(ledger));
    expect(tip4urTimeSqFt(row.sqFt)).toBe(4);
  });
});

describe("⚠ one row per PHYSICAL panel, not per drawing", () => {
  it("a design with 12 copies of one assembly is 12 rows", () => {
    /* His words, and the one way this export differs from every other in the
       app: a crew member claims one panel, so collapsing copies would
       collapse their pay. */
    const names = Array.from({ length: 12 }, (_, i) => `N${i + 1}`);
    const assemblies = [assembly("Wall panel", "Standard Panel", names)];
    const ledger = stamp(assemblies);
    const panels = tip4urTimePanels(assemblies, numbers(ledger));
    expect(panels).toHaveLength(12);
    expect(new Set(panels.map((p) => p.code)).size).toBe(12);
    expect(panels.map((p) => p.label)).toEqual(names);
  });

  it("nothing is capped — a 300-panel building is 300 rows", () => {
    /* ⚠ Every other list in this app is bounded because a person reads it.
       This one is read by a program that pays people. */
    const names = Array.from({ length: 300 }, (_, i) => `R${i + 1}`);
    const assemblies = [assembly("Deck panel", "Roof Panel", names)];
    const ledger = stamp(assemblies);
    expect(tip4urTimePanels(assemblies, numbers(ledger))).toHaveLength(300);
    expect(buildTip4urTimeCsv({ projectName: "P", projectId: "id", panels: tip4urTimePanels(assemblies, numbers(ledger)) })
      .trimEnd()
      .split("\r\n")).toHaveLength(303); // 2 preamble + 1 header + 300
  });
});

describe("⚠ the panel code is stable — his acceptance check, as a test", () => {
  /* > "Export a project, re-export it after an unrelated edit, and confirm
     >  every existing panel kept its code and only new panels are new rows." */
  const before = [
    assembly("Wall panel", "Standard Panel", ["N1", "N2", "N3"]),
    assembly("Deck panel", "Floor Panel", ["F1", "F2"]),
  ];

  it("an unrelated edit keeps every existing code and only adds new ones", () => {
    const ledger1 = stamp(before);
    const first = tip4urTimePanels(before, numbers(ledger1));

    /* The "unrelated edit": the ROOF gains panels and a wall panel's size
       changes. Neither touches the identity of the panels that already
       exist. */
    const after = [
      assembly("Wall panel", "Standard Panel", ["N1", "N2", "N3"], 44),
      assembly("Deck panel", "Floor Panel", ["F1", "F2"]),
      assembly("Deck panel", "Roof Panel", ["R1", "R2"]),
    ];
    const ledger2 = stamp(after, ledger1);
    const second = tip4urTimePanels(after, numbers(ledger2));

    const codeOf = (panels: typeof first, label: string) => panels.find((p) => p.label === label)!.code;
    for (const label of ["N1", "N2", "N3", "F1", "F2"]) {
      expect({ label, code: codeOf(second, label) }).toEqual({ label, code: codeOf(first, label) });
    }
    /* ...and the two genuinely new panels are the only new codes. */
    const newCodes = second.filter((p) => !first.some((f) => f.code === p.code));
    expect(newCodes.map((p) => p.label)).toEqual(["R1", "R2"]);
  });

  it("⚠ a deleted panel's number is never reissued to a different panel", () => {
    /* The failure a crew would feel in their pay. `nextSeq` is monotonic, so
       the ledger can only ever grow. */
    const ledger1 = stamp(before);
    const n3 = ledger1.codesByKey[panelKey("Wall panel", "N3", 2)];
    const shrunk = [assembly("Wall panel", "Standard Panel", ["N1", "N2"])];
    const ledger2 = stamp(shrunk, ledger1);
    const grown = [assembly("Wall panel", "Standard Panel", ["N1", "N2"]), assembly("Deck panel", "Floor Panel", ["F9"])];
    const ledger3 = stamp(grown, ledger2);
    expect(ledger3.codesByKey[panelKey("Deck panel", "F9", 0)]).not.toBe(n3);
    expect(ledger3.nextSeq).toBeGreaterThan(ledger1.nextSeq);
  });

  it("re-exporting with nothing changed mints nothing and returns the same ledger", () => {
    const ledger1 = stamp(before);
    const ledger2 = stamp(before, ledger1);
    /* Reference equality on purpose — the caller skips a save on it. */
    expect(ledger2).toBe(ledger1);
  });

  it("⚠ two families sharing a stencil name do NOT share a code", () => {
    /* Stencil names are unique within a pipeline, not across them. Without
       the family in the key a wall panel and a deck panel both called N1
       would be one panel, and a crew would be paid once for two. */
    const assemblies = [
      assembly("Wall panel", "Standard Panel", ["N1"]),
      assembly("Deck panel", "Floor Panel", ["N1"]),
    ];
    const ledger = stamp(assemblies);
    const panels = tip4urTimePanels(assemblies, numbers(ledger));
    expect(panels[0]!.code).not.toBe(panels[1]!.code);
  });
});

/** The separator this file writes, as a constant — so no test has to spell
 *  a CRLF escape inside a patched string literal. */
const CRLF = String.fromCharCode(13, 10);

describe("⚠ the file's own shape", () => {
  const assemblies = [assembly("Wall panel", "Standard Panel", ["N1", "N2"])];
  const ledger = stamp(assemblies);
  const csv = buildTip4urTimeCsv({
    projectName: "Rogers-Sehorn ADU",
    projectId: "abc-123",
    panels: tip4urTimePanels(assemblies, numbers(ledger)),
  });
  const lines = csv.trimEnd().split("\r\n");

  it("leads with the two header rows he specified, then the column header", () => {
    expect(lines[0]).toBe("Project,Rogers-Sehorn ADU");
    expect(lines[1]).toBe("Project ID,abc-123");
    expect(lines[2]).toBe(
      "Panel code,Panel type,Label,Width (in),Height (in),Sq ft,Counts as panel,Install step",
    );
  });

  it("⚠ has NO column named 'Used at'", () => {
    /* His words: that header marks the old cut-list format and changes how
       the file is read. `projectCutListCsv` is the file that has one. */
    expect(csv).not.toContain("Used at");
  });

  it("⚠ carries NO byte order mark", () => {
    /* `buildCsv` leads with one by default, because the cut list is opened in
       Excel. This file is parsed by a program, where a BOM lands inside the
       first header cell. */
    expect(csv.startsWith("﻿")).toBe(false);
    expect(csv.startsWith("Project,")).toBe(true);
  });

  it("writes a row per panel with a plain numeric square footage", () => {
    /* ⚠ The trailing empty cell is `Install step` with no sequence passed —
       the column is always THERE, so a reader never has to handle a missing
       one, and a blank is an honest "this export did not place it" rather than
       a guessed position.

       ⚠ **And the code reads `0001`, not `P-0001`** — B36 stride 2. The prefix
       existed while this was a join key nobody saw; it is now the token the
       shop stencils, and his shop has no hyphen stencil. */
    expect(lines[3]).toBe("0001,Standard Panel,N1,48,96,32,1,");
    expect(lines[4]).toBe("0002,Standard Panel,N2,48,96,32,1,");
  });

  it("⚠ carries the install STEP when one is handed in — B35, unpadded by B36", () => {
    /* ⚠ **`7`, not `0007`, and that is the fix.** A zero-padded step beside a
       zero-padded panel number was two four-digit tokens on one row with
       nothing to tell a reader which was the identity. */
    const sequence = new Map([
      [panelKey("Wall panel", "N1", 0), 7],
      [panelKey("Wall panel", "N2", 1), 8],
    ]);
    const withSequence = buildTip4urTimeCsv({
      projectName: "P",
      projectId: "id",
      panels: tip4urTimePanels(assemblies, numbers(ledger), sequence),
    })
      .trimEnd()
      .split(CRLF);
    expect(withSequence[3]!.endsWith(",1,7")).toBe(true);
    expect(withSequence[4]!.endsWith(",1,8")).toBe(true);
  });

  it("⚠ the two columns mean OPPOSITE things, and now they do not even LOOK alike", () => {
    /* `Panel code` is stamped once and stored so it can never move — that is
       what a crew's pay hangs on. The install step renumbers the moment the
       design changes. A crew app sorts by one and joins on the other; swapping
       the roles is the one mistake that would cost somebody money, and the
       four-digit string versus the plain integer is what makes that visible on
       the row rather than only in a doc comment. */
    const sequence = new Map([[panelKey("Wall panel", "N1", 0), 7]]);
    const rows = tip4urTimePanels(assemblies, numbers(ledger), sequence);
    expect(rows[0]!.code).toBe("0001");
    expect(rows[0]!.installStep).toBe(7);
    /* And a panel the sequence has not placed keeps its number and gets no
       invented position — null, not 0, which would sort first and read as
       "install this before everything else". */
    expect(rows[1]!.code).toBe("0002");
    expect(rows[1]!.installStep).toBe(null);
  });

  it("quotes a project name containing a comma rather than shifting a column", () => {
    const quoted = buildTip4urTimeCsv({ projectName: "Smith, Jane", projectId: "x", panels: [] });
    expect(quoted.split("\r\n")[0]).toBe('Project,"Smith, Jane"');
  });
});

describe("tip4urTimeExportProblems — his acceptance check, enforced before the file leaves", () => {
  const ok = { code: "0001", panelType: "Standard Panel", label: "N1", widthIn: 48, heightIn: 96, sqFt: (48 * 96) / 144, countsAsPanel: true, installStep: 1 };

  it("passes a sound export", () => {
    expect(tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels: [ok] })).toEqual([]);
  });

  it("catches a missing project id, a duplicate code, an over-long code and a zero area", () => {
    expect(tip4urTimeExportProblems({ projectName: "P", projectId: "  ", panels: [ok] })).toHaveLength(1);
    expect(
      tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels: [ok, { ...ok, label: "N2" }] }),
    ).toHaveLength(1);
    expect(
      tip4urTimeExportProblems({
        projectName: "P",
        projectId: "id",
        panels: [{ ...ok, code: "x".repeat(TIP4URTIME_CODE_MAX_LENGTH + 1) }],
      }),
    ).toHaveLength(1);
    /* \u26a0 **`sqFt` IS WHAT IS CHECKED NOW, not `heightIn` x `widthIn`.** A
       shop item's area comes off its largest face, so a row CAN carry a real
       area with a zero in one of its two printed dimensions \u2014 and a row with
       both dimensions set can still have no area. Zeroing the height used to
       be the same thing as zeroing the area; it is not any more, which is
       exactly why this guard had to follow the field it is guarding. */
    expect(
      tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels: [{ ...ok, sqFt: 0 }] }),
    ).toHaveLength(1);
    expect(
      tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels: [{ ...ok, heightIn: 0 }] }),
    ).toEqual([]);
  });

  it("catches a panel that never got a number", () => {
    expect(tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels: [{ ...ok, code: "" }] })).toHaveLength(1);
  });

  it("⚠ counts unnumbered panels ONCE — a project not yet issued is one problem, not 134", () => {
    /* It used to push a line per panel, so the notice opened with three
       identical sentences and never said the actual reason. */
    const none = Array.from({ length: 134 }, (_, i) => ({ ...ok, code: "", label: `N${i + 1}` }));
    const problems = tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels: none });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("134 panels have no number yet");
  });
});

describe("⚠ a Safety Gap is claimable, earns its square footage, and is NOT a panel", () => {
  /* > "Safety gaps should also populate in the things to make in the shop as
     >  well as beams and stuff like that. Those simply don't count as panels.
     >  But maybe they count as surface area! It should show that they have
     >  done it and claimed it, it just doesn't count for panel count."
     The row has to EXIST for a crew to claim it, which is why this is a
     column and not a filter. */
  const assemblies = [
    assembly("Wall panel", "Standard Panel", ["N1"]),
    assembly("Wall panel", "Safety Gap", ["N2"], 0.75, 120, false),
    assembly("Roof bearing", "Box Beam", ["B1"], 240, 15.5, false),
  ];
  const ledger = stamp(assemblies);
  const panels = tip4urTimePanels(assemblies, numbers(ledger));

  it("exports a row for it, with its own code", () => {
    expect(panels).toHaveLength(3);
    expect(new Set(panels.map((p) => p.code)).size).toBe(3);
  });

  it("writes 0 in the last column for the gap and the beam, 1 for the panel", () => {
    const csv = buildTip4urTimeCsv({ projectName: "P", projectId: "id", panels });
    const lines = csv.trimEnd().split("\r\n");
    /* ⚠ `Counts as panel` is no longer the LAST column — `Install step`
       follows it — so these read the counts column by position rather than
       by being last. A test that asserts "ends with" is a test that breaks
       every time a column is appended, and appending is how this file stays
       readable by a crew app that predates the column. */
    const countsCell = (line: string) => line.split(",").at(-2);
    expect(countsCell(lines[3]!)).toBe("1");
    /* \u26a0 **12.92, AND IT USED TO SAY 0.63 \u2014 his 2026-11-15 answer, in one
       row.** This line is the acceptance check for the whole change: *"Its
       row should show about 12.9 in Sq ft (not 0.63) and 0 in Counts as
       panel."* The two dimensions beside it are unchanged and deliberately
       do not multiply out to it \u2014 the missing factor is the 15.5in through
       the wall, which is not a column. */
    expect(lines[4]).toBe("0002,Safety Gap,N2,0.75,120,12.92,0,");
    expect(countsCell(lines[5]!)).toBe("0");
  });

  it("still carries a real square footage, because a crew earns it \u2014 now the SHEET's", () => {
    /* It always carried one; the question this file raised on 2026-11-14 was
       whether 0.63 was the right one, and his answer was no. A crew claiming
       a safety gap is handling a 15.5in x 10ft sheet of plywood and is
       credited for it. */
    const gap = panels.find((row) => row.panelType === "Safety Gap")!;
    expect(tip4urTimeSqFt(gap.sqFt)).toBe(12.92);
    expect(tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels })).toEqual([]);
  });
});
