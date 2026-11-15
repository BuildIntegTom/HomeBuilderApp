import { buildCsv } from "./csv";
import type { ExportableAssembly } from "./projectCutListCsv";
import { assemblyFaceSqFt } from "./shopItemFace";

/**
 * ⚠ **THE PANEL LIST TIP4URTIME READS, one row per PHYSICAL PANEL.**
 *
 * Tip4urTime is the crew time clock and profit-sharing app: crews claim
 * panels as they build them, and it tracks panels and square footage per
 * person and per house. Tommy's brief, 2026-11-14.
 *
 * ⚠ **Per panel, not per drawing.** Every other export in this app is per
 * unique ASSEMBLY — one sheet covering N identical panels — because that is
 * what a shop builds from. This one is the opposite: *"A design with 12
 * copies of one assembly is 12 rows with 12 different codes."* A crew member
 * claims one physical panel, so collapsing copies would collapse their pay.
 *
 * ⚠ **Nothing here is capped or abbreviated.** Every bounded list in this app
 * — the Review Log's `LIST_LIMIT`, `describeUsedAt`'s twelve names, the shop
 * sheets' "and N more" — exists because a person reads it. This file is read
 * by a program that pays people, and a truncation habit copied in from its
 * neighbours would silently drop a crew's work.
 *
 * ⚠ **No `Used at` column, deliberately.** His words: that header marks the
 * old cut-list format and changes how the file is read. `projectCutListCsv`
 * is the file that has one.
 *
 * ⚠ **No BOM.** `buildCsv` leads with one by default because the cut list is
 * opened in Excel and a BOM-less UTF-8 file turns `47½"` into mojibake there.
 * This file is parsed by a program, where a BOM lands inside the first header
 * cell, so it is turned off. The two files have different readers and
 * therefore different answers.
 *
 * ⚠ **It carries panel data only** — no client name, no address, no price.
 * The input type is the enforcement: a caller cannot leak what it cannot
 * pass. That matters because this same function is meant to be served from a
 * revocable sync link later, and a filter you have to remember is a filter
 * that gets forgotten.
 */

/** The hard ceiling on a panel code, from his spec. */
export const TIP4URTIME_CODE_MAX_LENGTH = 40;

export interface Tip4urTimePanel {
  /** Unique within the project, stable across exports, <=40 chars. */
  code: string;
  /** The app's own descriptive type — see `ExportableAssembly.typeName`. */
  panelType: string;
  /** Friendly locator, blank when there is none. The panel's own stencilled
   *  name (`N3`, `F12`) — what a crew reads off the panel in the shop. */
  label: string;
  widthIn: number;
  heightIn: number;
  /**
   * ⚠ **THE FACE A CREW IS CREDITED FOR, and it is NOT `widthIn x heightIn`
   * any more.** His 2026-11-15 answer to a question this file raised itself:
   *
   * > *"Square feet should be the piece's largest face ... for that same gap,
   * > the sheet: 15.5in x 120in = 12.9 sq ft."*
   *
   * A straw panel's is still its standing face, so for every panel row this
   * is exactly the old arithmetic. A SHOP ITEM's is its largest — which is
   * why it is carried as its own field rather than recomputed from the two
   * dimensions beside it: a Safety Gap's row reads 3/4in by 10ft and 12.9 sq
   * ft, and those three numbers do not multiply out. They are not supposed
   * to. The missing dimension is the 15.5in through the wall, and it is
   * deliberately not a column — *"Tip4urTime imports whatever the file says;
   * nothing changes on its side."*
   *
   * See `assemblyFaceSqFt` for the switch and why `countsAsPanel` is it.
   */
  sqFt: number;
  /**
   * ⚠ **Whether it counts toward a crew's PANEL COUNT.** Everything in
   * this file is fabricated, claimable and earns its square footage; this
   * column is the one difference.
   *
   * > *"Safety gaps should also populate in the things to make in the shop as
   * > well as beams and stuff like that. Those simply don't count as panels.
   * > But maybe they count as surface area! It should show that they have
   * > done it and claimed it, it just doesn't count for panel count. That's
   * > all."* — Tommy, 2026-11-14
   *
   * It matters on the crew side beyond a tally: Tip4urTime's builder titles
   * are a curve in PANELS (level n at 2·n²), so a ¾ in filler strip
   * advancing someone toward a career title is the thing being ruled out.
   */
  countsAsPanel: boolean;
}

export interface Tip4urTimeExportInput {
  projectName: string;
  /** Permanent, and unchanged by renaming the project. */
  projectId: string;
  panels: readonly Tip4urTimePanel[];
}

/**
 * Face area in square feet: *"a plain number with up to 2 decimals, no units
 * and no thousands separators (32 or 32.5)."*
 *
 * `Number(...)` after the fixed-2 rounding is what drops a trailing zero, so
 * a whole number writes as `32` rather than `32.00`, which is his own
 * example.
 */
export function tip4urTimeSqFt(sqFt: number): number {
  return Number(sqFt.toFixed(2));
}

/**
 * ⚠ **THE LEDGER THAT MAKES A CODE STABLE.**
 *
 * His requirement is that the same panel keeps the same code on every export,
 * that existing panels are never renumbered, and that re-imports match on it.
 * No DERIVATION survives an insert — a panel's stencilled name is sequential
 * along its wall, so inserting one upstream shifts every name below it. So
 * the code has to be remembered.
 *
 * ⚠ **It is remembered at the FIRST EXPORT, not written when the panel is
 * drawn.** That is his own reasoning turned into a seam:
 *
 * > *"Once we start building a project there shouldn't be any edits that
 * > happen... If we're building a project that means it's been approved."*
 *
 * Exporting to Tip4urTime IS the project going to a crew, so stamping at that
 * moment is stamping at approval. A design that never goes to a crew never
 * grows the field, and no migration runs for one.
 *
 * ⚠ **`nextSeq` never goes backwards**, so a deleted panel's number is never
 * reissued to a different panel. That is the failure a crew would feel in
 * their pay, and it is cheap to make impossible.
 *
 * ⚠ **This is a join key, not a panel name.** It must never reach a shop
 * sheet. His standing rule that panel identity is DERIVED — *"not from a
 * memory file"* — governs what the shop reads; this is invisible in the app
 * and in the packet, which is why the rule is untouched rather than excepted.
 */
export interface PanelCodeLedger {
  /** Key (see `panelCodeKey`) to the code it was stamped with. */
  codesByKey: Record<string, string>;
  /** The next number to issue. Monotonic. */
  nextSeq: number;
}

export const EMPTY_PANEL_CODE_LEDGER: PanelCodeLedger = { codesByKey: {}, nextSeq: 1 };

/**
 * ⚠ **The key is scoped by family as well as by name**, because the stencil
 * names are only unique WITHIN a pipeline — a wall panel and a deck panel can
 * both be the first of their run. Two families sharing a name would otherwise
 * share a code, and a crew would be paid once for two panels.
 */
export function panelCodeKey(panelFamily: string, instanceName: string, indexWithinGroup: number): string {
  /* An instance with no name of its own still needs a stable key, and its
     position within its own group is the only thing it has. */
  const leaf = instanceName.length > 0 ? instanceName : `#${indexWithinGroup}`;
  return `${panelFamily}|${leaf}`;
}

function formatCode(seq: number): string {
  /* Zero-padded to four so a project's codes sort lexically for as long as
     anyone would read them, and far inside the 40-character ceiling even
     when a building runs past 9999 panels. */
  return `P-${String(seq).padStart(4, "0")}`;
}

/**
 * Every key that has no code yet takes the next one. **Existing keys are
 * never touched**, which is the whole point and is what his acceptance check
 * tests: export, make an unrelated edit, re-export, every existing panel
 * kept its code and only new panels are new rows.
 */
export function stampPanelCodes(keys: readonly string[], ledger: PanelCodeLedger): PanelCodeLedger {
  let nextSeq = ledger.nextSeq;
  let changed = false;
  const codesByKey = { ...ledger.codesByKey };
  for (const key of keys) {
    if (codesByKey[key] !== undefined) continue;
    codesByKey[key] = formatCode(nextSeq);
    nextSeq += 1;
    changed = true;
  }
  /* The same object back when nothing moved, so a caller can skip a save. */
  return changed ? { codesByKey, nextSeq } : ledger;
}

/**
 * One entry per physical panel, in the order the building's own pipelines
 * produce them — walls, then roof bearing, then beams, then decks.
 *
 * ⚠ It reads `instanceNames`, whose length always equals `copies`, so the row
 * count is the panel count by construction rather than by agreement.
 */
export function tip4urTimePanelKeys(assemblies: readonly ExportableAssembly[]): string[] {
  const keys: string[] = [];
  for (const assembly of assemblies) {
    assembly.instanceNames.forEach((name, i) => keys.push(panelCodeKey(assembly.panelType, name, i)));
  }
  return keys;
}

export function tip4urTimePanels(
  assemblies: readonly ExportableAssembly[],
  ledger: PanelCodeLedger,
): Tip4urTimePanel[] {
  const panels: Tip4urTimePanel[] = [];
  for (const assembly of assemblies) {
    assembly.instanceNames.forEach((name, i) => {
      const key = panelCodeKey(assembly.panelType, name, i);
      panels.push({
        code: ledger.codesByKey[key] ?? "",
        panelType: assembly.typeName,
        label: name,
        widthIn: assembly.widthIn,
        heightIn: assembly.heightIn,
        sqFt: assemblyFaceSqFt(assembly),
        countsAsPanel: assembly.countsAsPanel,
      });
    });
  }
  return panels;
}

/**
 * What a crew's app would refuse, checked here so it is refused before the
 * file leaves rather than after it arrives: his own acceptance check, as
 * code. Returns the problems, empty when there are none.
 */
export function tip4urTimeExportProblems(input: Tip4urTimeExportInput): string[] {
  const problems: string[] = [];
  if (input.projectId.trim().length === 0) problems.push("The project has no permanent id.");
  const seen = new Set<string>();
  for (const panel of input.panels) {
    if (panel.code.length === 0) {
      problems.push(`${panel.label || "a panel"} has no code.`);
    } else if (panel.code.length > TIP4URTIME_CODE_MAX_LENGTH) {
      problems.push(`Code ${panel.code} is longer than ${TIP4URTIME_CODE_MAX_LENGTH} characters.`);
    } else if (seen.has(panel.code)) {
      problems.push(`Code ${panel.code} is used by more than one panel.`);
    }
    seen.add(panel.code);
    if (!(tip4urTimeSqFt(panel.sqFt) > 0)) {
      problems.push(`${panel.label || panel.code} has no face area.`);
    }
  }
  return problems;
}

export const TIP4URTIME_HEADERS = [
  "Panel code",
  "Panel type",
  "Label",
  "Width (in)",
  "Height (in)",
  "Sq ft",
  /* ⚠ Added after his first brief, so a reader that predates it sees one
     extra column rather than a changed one. A missing column means 1. */
  "Counts as panel",
] as const;

export function buildTip4urTimeCsv(input: Tip4urTimeExportInput): string {
  return buildCsv(
    [...TIP4URTIME_HEADERS],
    input.panels.map((panel) => [
      panel.code,
      panel.panelType,
      panel.label,
      Number(panel.widthIn.toFixed(2)),
      Number(panel.heightIn.toFixed(2)),
      tip4urTimeSqFt(panel.sqFt),
      panel.countsAsPanel ? 1 : 0,
    ]),
    {
      /* See this module's own doc comment: a program reads this, and a BOM
         lands inside the first header cell. */
      byteOrderMark: false,
      preamble: [
        ["Project", input.projectName],
        ["Project ID", input.projectId],
      ],
    },
  );
}
