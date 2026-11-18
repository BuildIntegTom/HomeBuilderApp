import { buildCsv } from "./csv";
import { panelKey } from "./panelKey";
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
  /**
   * ⚠ **THE PANEL NUMBER — `"0042"` — and since B36 stride 2 it is the
   * SAME number the app shows, the sheet prints and the shop stencils.**
   *
   * It used to be `P-0042`, a join key nobody saw, counted in the export
   * pipeline's order while a second four-digit number counted in install
   * order. One number now, issued in install order and stored: see
   * `panelNumber.ts` for the rule and for why the prefix went.
   *
   * Unique within the project, stable across exports, <=40 chars.
   */
  code: string;
  /** The app's own descriptive type — see `ExportableAssembly.typeName`. */
  panelType: string;
  /**
   * ⚠ **WHERE the panel goes — its LOCATION, not its identity.** `N3` is the
   * third panel along a north-facing wall; `F12` the twelfth of the floor run.
   * Blank when there is none.
   *
   * ⚠ **B36 stride 3 split these two apart, and this column is the half that
   * is allowed to move.** Insert one window upstream and `N3` becomes `N4`
   * while `code` does not budge — which is exactly why a crew app must join on
   * `code` and show this only as a human locator. They are two columns rather
   * than one token precisely so nothing has to parse a wall out of a name.
   */
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
  /**
   * ⚠ **WHICH STEP OF THE INSTALL IT IS — `42`, meaning "step 42 of 134" —
   * or `null` for an item the sequence does not place.**
   *
   * It runs from the point of least accessibility, clockwise, out to in,
   * bottom to top (`installSequence`), which is his own order and the same one
   * that already drives the truck load.
   *
   * ⚠ **It is a PLAIN INTEGER, deliberately not zero-padded, and that is a
   * fix rather than a style choice.** B35 wrote it as `"0042"`, which made an
   * ORDER look exactly like an IDENTITY sitting next to one — two four-digit
   * numbers on the same row for the same panel, and a reader with no way to
   * tell which was which. A crew app sorts by this and joins on `code`;
   * swapping the two roles is the one mistake that would cost somebody money,
   * and now the two do not even look alike.
   */
  installStep: number | null;
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

/* ⚠ **THE LEDGER MOVED OUT — B36 stride 2, 2026-11-18.** `PanelCodeLedger`,
   `EMPTY_PANEL_CODE_LEDGER`, `panelCodeKey`, `stampPanelCodes` and
   `tip4urTimePanelKeys` all lived here, which is why a panel's one permanent
   number was called "the Tip4urTime code" and was shaped by one export's
   needs. They are `panelNumber.ts` now, because the number is the app's and
   this file is only one of the places that prints it. */

/**
 * One row per physical panel, in the order the building's own pipelines
 * produce them — walls, then roof bearing, then beams, then decks.
 *
 * ⚠ It reads `instanceNames`, whose length always equals `copies`, so the row
 * count is the panel count by construction rather than by agreement.
 */
export function tip4urTimePanels(
  assemblies: readonly ExportableAssembly[],
  /** The issued panel numbers, by `panelKey` — see `panelNumbering`. */
  numberByKey: ReadonlyMap<string, string>,
  /**
   * The install sequence, keyed the same way. Omitted, every row's
   * `installStep` is null and the column still appears, so a reader never has
   * to handle a missing one.
   */
  installOrder?: ReadonlyMap<string, number>,
): Tip4urTimePanel[] {
  const panels: Tip4urTimePanel[] = [];
  for (const assembly of assemblies) {
    assembly.instanceNames.forEach((name, i) => {
      const key = panelKey(assembly.panelType, name, i);
      panels.push({
        code: numberByKey.get(key) ?? "",
        /* Null rather than a guessed step when the sequence has not heard of
           this key — an invented position is worse than none. */
        installStep: installOrder?.get(key) ?? null,
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
  /* ⚠ **Counted ONCE rather than per panel, and that is a B36 fix.** An
     unnumbered panel is a project that has not been issued, not 134 separate
     bad codes — and the old loop said "a panel has no code" once per panel,
     which both buried the real reason and made the first three lines of the
     notice identical. */
  const unnumbered = input.panels.filter((panel) => panel.code.length === 0).length;
  if (unnumbered > 0) {
    problems.push(
      `${unnumbered} panel${unnumbered === 1 ? " has" : "s have"} no number yet — issue the project for ` +
        "fabrication first.",
    );
  }
  const seen = new Set<string>();
  for (const panel of input.panels) {
    if (panel.code.length === 0) {
      /* Already counted above. */
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
  /* ⚠ B35, RENAMED by B36 stride 2. Still last, so an existing reader sees
     the same column position — but it now says "step" and carries a plain
     integer, because "Install no" beside "Panel code" was two four-digit
     numbers for one panel with nothing to tell them apart. It is a sort key,
     not a join key: see `Tip4urTimePanel.installStep`. */
  "Install step",
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
      /* Blank, not 0: a zero would sort first and read as "the first thing you
         install", which is the opposite of "this has no place in the order". */
      panel.installStep ?? "",
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
