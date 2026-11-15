import { describe, expect, it } from "vitest";
import type { ExportableAssembly } from "./projectCutListCsv";
import {
  buildTip4urTimeCsv,
  EMPTY_PANEL_CODE_LEDGER,
  panelCodeKey,
  stampPanelCodes,
  TIP4URTIME_CODE_MAX_LENGTH,
  tip4urTimeExportProblems,
  tip4urTimePanelKeys,
  tip4urTimePanels,
  tip4urTimeSqFt,
} from "./tip4urTimeCsv";

/** Only the fields this export reads; `members` is irrelevant here and a
 *  single empty one keeps the fixtures about the thing being tested. */
function assembly(
  panelType: string,
  typeName: string,
  instanceNames: string[],
  widthIn = 48,
  heightIn = 96,
  countsAsPanel = true,
): ExportableAssembly {
  return {
    panelType,
    typeName,
    label: `${typeName} ${widthIn}in`,
    widthIn,
    heightIn,
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
    expect(tip4urTimeSqFt(48, 96)).toBe(32);
    expect(tip4urTimeSqFt(48, 97.5)).toBe(32.5);
    expect(String(tip4urTimeSqFt(48, 96))).toBe("32");
    expect(String(tip4urTimeSqFt(40.125, 96))).toBe("26.75");
  });
});

describe("⚠ one row per PHYSICAL panel, not per drawing", () => {
  it("a design with 12 copies of one assembly is 12 rows", () => {
    /* His words, and the one way this export differs from every other in the
       app: a crew member claims one panel, so collapsing copies would
       collapse their pay. */
    const names = Array.from({ length: 12 }, (_, i) => `N${i + 1}`);
    const assemblies = [assembly("Wall panel", "Standard Panel", names)];
    const ledger = stampPanelCodes(tip4urTimePanelKeys(assemblies), EMPTY_PANEL_CODE_LEDGER);
    const panels = tip4urTimePanels(assemblies, ledger);
    expect(panels).toHaveLength(12);
    expect(new Set(panels.map((p) => p.code)).size).toBe(12);
    expect(panels.map((p) => p.label)).toEqual(names);
  });

  it("nothing is capped — a 300-panel building is 300 rows", () => {
    /* ⚠ Every other list in this app is bounded because a person reads it.
       This one is read by a program that pays people. */
    const names = Array.from({ length: 300 }, (_, i) => `R${i + 1}`);
    const assemblies = [assembly("Deck panel", "Roof Panel", names)];
    const ledger = stampPanelCodes(tip4urTimePanelKeys(assemblies), EMPTY_PANEL_CODE_LEDGER);
    expect(tip4urTimePanels(assemblies, ledger)).toHaveLength(300);
    expect(buildTip4urTimeCsv({ projectName: "P", projectId: "id", panels: tip4urTimePanels(assemblies, ledger) })
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
    const ledger1 = stampPanelCodes(tip4urTimePanelKeys(before), EMPTY_PANEL_CODE_LEDGER);
    const first = tip4urTimePanels(before, ledger1);

    /* The "unrelated edit": the ROOF gains panels and a wall panel's size
       changes. Neither touches the identity of the panels that already
       exist. */
    const after = [
      assembly("Wall panel", "Standard Panel", ["N1", "N2", "N3"], 44),
      assembly("Deck panel", "Floor Panel", ["F1", "F2"]),
      assembly("Deck panel", "Roof Panel", ["R1", "R2"]),
    ];
    const ledger2 = stampPanelCodes(tip4urTimePanelKeys(after), ledger1);
    const second = tip4urTimePanels(after, ledger2);

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
    const ledger1 = stampPanelCodes(tip4urTimePanelKeys(before), EMPTY_PANEL_CODE_LEDGER);
    const n3 = ledger1.codesByKey[panelCodeKey("Wall panel", "N3", 2)];
    const shrunk = [assembly("Wall panel", "Standard Panel", ["N1", "N2"])];
    const ledger2 = stampPanelCodes(tip4urTimePanelKeys(shrunk), ledger1);
    const grown = [assembly("Wall panel", "Standard Panel", ["N1", "N2"]), assembly("Deck panel", "Floor Panel", ["F9"])];
    const ledger3 = stampPanelCodes(tip4urTimePanelKeys(grown), ledger2);
    expect(ledger3.codesByKey[panelCodeKey("Deck panel", "F9", 0)]).not.toBe(n3);
    expect(ledger3.nextSeq).toBeGreaterThan(ledger1.nextSeq);
  });

  it("re-exporting with nothing changed mints nothing and returns the same ledger", () => {
    const ledger1 = stampPanelCodes(tip4urTimePanelKeys(before), EMPTY_PANEL_CODE_LEDGER);
    const ledger2 = stampPanelCodes(tip4urTimePanelKeys(before), ledger1);
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
    const ledger = stampPanelCodes(tip4urTimePanelKeys(assemblies), EMPTY_PANEL_CODE_LEDGER);
    const panels = tip4urTimePanels(assemblies, ledger);
    expect(panels[0]!.code).not.toBe(panels[1]!.code);
  });
});

describe("⚠ the file's own shape", () => {
  const assemblies = [assembly("Wall panel", "Standard Panel", ["N1", "N2"])];
  const ledger = stampPanelCodes(tip4urTimePanelKeys(assemblies), EMPTY_PANEL_CODE_LEDGER);
  const csv = buildTip4urTimeCsv({
    projectName: "Rogers-Sehorn ADU",
    projectId: "abc-123",
    panels: tip4urTimePanels(assemblies, ledger),
  });
  const lines = csv.trimEnd().split("\r\n");

  it("leads with the two header rows he specified, then the column header", () => {
    expect(lines[0]).toBe("Project,Rogers-Sehorn ADU");
    expect(lines[1]).toBe("Project ID,abc-123");
    expect(lines[2]).toBe("Panel code,Panel type,Label,Width (in),Height (in),Sq ft,Counts as panel");
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
    expect(lines[3]).toBe("P-0001,Standard Panel,N1,48,96,32,1");
    expect(lines[4]).toBe("P-0002,Standard Panel,N2,48,96,32,1");
  });

  it("quotes a project name containing a comma rather than shifting a column", () => {
    const quoted = buildTip4urTimeCsv({ projectName: "Smith, Jane", projectId: "x", panels: [] });
    expect(quoted.split("\r\n")[0]).toBe('Project,"Smith, Jane"');
  });
});

describe("tip4urTimeExportProblems — his acceptance check, enforced before the file leaves", () => {
  const ok = { code: "P-0001", panelType: "Standard Panel", label: "N1", widthIn: 48, heightIn: 96, countsAsPanel: true };

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
    expect(
      tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels: [{ ...ok, heightIn: 0 }] }),
    ).toHaveLength(1);
  });

  it("catches a panel that never got a code", () => {
    expect(tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels: [{ ...ok, code: "" }] })).toHaveLength(1);
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
  const ledger = stampPanelCodes(tip4urTimePanelKeys(assemblies), EMPTY_PANEL_CODE_LEDGER);
  const panels = tip4urTimePanels(assemblies, ledger);

  it("exports a row for it, with its own code", () => {
    expect(panels).toHaveLength(3);
    expect(new Set(panels.map((p) => p.code)).size).toBe(3);
  });

  it("writes 0 in the last column for the gap and the beam, 1 for the panel", () => {
    const csv = buildTip4urTimeCsv({ projectName: "P", projectId: "id", panels });
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[3]!.endsWith(",1")).toBe(true);
    expect(lines[4]).toBe("P-0002,Safety Gap,N2,0.75,120,0.63,0");
    expect(lines[5]!.endsWith(",0")).toBe(true);
  });

  it("still carries a real square footage, because a crew earns it", () => {
    expect(tip4urTimeSqFt(0.75, 120)).toBe(0.63);
    expect(tip4urTimeExportProblems({ projectName: "P", projectId: "id", panels })).toEqual([]);
  });
});
