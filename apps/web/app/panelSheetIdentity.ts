import { formatImperialFractionIn, formatLengthIn } from "@building-integrity/calc-engine";
import { bracedPanelDisplayLabel, type BraceFigure, type BracePairPattern, type BracePattern } from "@building-integrity/panel-catalog";
import { ASSEMBLY_COLORS, DECK_PANEL_COLORS, NAMED_PANEL_TYPE_COLORS } from "./panelColors";
import type { NamedPanelType } from "./panelInstances";

/**
 * **B25 — WHAT A SHOP FABRICATION SHEET CALLS ITSELF, AND WHAT ORDER THE
 * SHEETS COME OUT IN.**
 *
 * > *"I would rather see on a shop fabrication sheet. 10 ft super carrot ...
 * > That would almost tell me (specifically at least lol) how to build the
 * > entire thing without even looking at the rest of the paper. ... can we do a
 * > little bit of color coding for the different panel types incorporated into
 * > the fabrication sheets as well as the primary label being the height and
 * > distinct name of the panel as it appears in the panel library through the
 * > right click options"* — Tommy, 2026-11-03
 *
 * The label it replaces was `Panel Fabrication: Standard Panel 48in (12)` —
 * the type and the width, which is the **least** identifying pair the group
 * has. A Super Carrot and a Little Carrot both read *"Standard Panel 48in"*
 * and are told apart only by opening the sheet, even though `groupKeyFor`
 * correctly puts them on separate pages. Height, the figure and the pair half
 * were all absent.
 *
 * ⚠ **The name is DERIVED on every read, never stored.** It is his own *"not
 * from a memory file"* rule applied to the name itself: the fields it reads
 * (`braceFigure`, `bracePairHalf`, the braced pattern, the height, the width)
 * are the same ones `groupKeyFor` splits sheets by and the same ones the
 * member builders read, so a name can never describe a panel the builder no
 * longer makes. Nothing here is persisted and nothing reads a stored label.
 *
 * ⚠ **One function, three call sites.** page.tsx wrote this label out by hand
 * in three places — the document page index, the sticky-note header and the
 * sheet's own title — and they had already drifted (only the sticky note and
 * the title knew about braced patterns; the index said "Braced Panel" for all
 * four styles). All three now read one `distinctName` computed once per group.
 */

/** Just the height, in his own shorthand: `10'`, `9'4"`, `8'1½"`. Metric
 * falls through to the shared mm formatter, because the unit toggle is
 * display-only everywhere else too. */
export function panelSheetHeightLabel(heightIn: number, unitSystem: "imperial" | "metric"): string {
  if (unitSystem === "metric") return formatLengthIn(heightIn, unitSystem);
  const sign = heightIn < 0 ? "-" : "";
  const absIn = Math.abs(heightIn);
  const feet = Math.floor(absIn / 12);
  const remainderIn = absIn - feet * 12;
  /* Under 1/16in of a whole foot reads as the whole foot — the grid is
     eighths (see `formatImperialFractionIn`), so anything inside half an
     eighth would render as `0"` and spell `10'0"` where he says `10'`. */
  if (remainderIn < 1 / 16) return `${sign}${feet}'`;
  if (feet === 0) return `${sign}${formatImperialFractionIn(remainderIn)}`;
  return `${sign}${feet}'${formatImperialFractionIn(remainderIn)}`;
}

/**
 * Everything that makes one fabricated part different from another of the
 * same type — exactly the fields `groupKeyFor` already splits sheets on, so
 * two sheets can never share a name.
 */
export interface PanelSheetIdentity {
  panelTypeId: string;
  /** The catalog's own label for the type, e.g. `Standard Panel`. The
   * fallback when nothing more specific is known about the figure. */
  panelTypeLabel: string;
  widthIn: number;
  heightIn: number;
  /** Braced panels only — their four styles are four different parts. */
  bracedPattern?: BracePattern;
  bracedMirrored?: boolean;
  /** Standard panels carrying half of a brace pair (B15/B22). */
  bracePairPattern?: BracePairPattern;
  bracePairHalf?: "left" | "right";
  braceFigure?: BraceFigure;
  /** True when this group's members came from `editedMembers` rather than
   * from its pattern — a hand-edited panel is its own part (B19). */
  isEdited?: boolean;
  /** ⚠ This column is the Gable Peak Panel — see `isGablePeakColumn`. Its
   * sheet must not read "Column", or the shop is handed a page whose name
   * describes a different part from the one on it. */
  isGablePeak?: boolean;
}

/** His names for the three carrots, from `bracePairPatterns.ts`. */
const BRACE_FIGURE_LABELS: Record<BraceFigure, string> = {
  "super-carrot": "Super Carrot",
  "big-carrot": "Big Carrot",
  "little-carrot": "Little Carrot",
};

/** The pattern's own name, for a standard panel whose half carries no
 * carrot of its own — a Vertical Nailers panel has no figure at all, and
 * `braced` (Braced Pair) is one long diagonal across the pair. */
const BRACE_PAIR_PATTERN_LABELS: Record<BracePairPattern, string> = {
  superbrace: "Carrot",
  braced: "Braced Pair",
  nailer: "Vertical Nailers",
};

/**
 * The figure — the part of the name that says what the thing LOOKS like,
 * which is the half he is actually missing today.
 *
 * ⚠ **The pair half is in the name, and it has to be.** A pair's two panels
 * are mirror images and `groupKeyFor` already gives them separate sheets; two
 * sheets both reading *"Super Carrot"* would be the same defect this is
 * fixing, one level down. `(L)`/`(R)` rather than the words, to keep the
 * label short enough for a sticky-note header.
 */
export function panelSheetFigureLabel(identity: PanelSheetIdentity): string {
  const half = identity.bracePairHalf === "left" ? " (L)" : identity.bracePairHalf === "right" ? " (R)" : "";
  if (identity.panelTypeId === "braced" && identity.bracedPattern !== undefined && identity.bracedMirrored !== undefined) {
    /* `bracedPanelDisplayLabel` is the one that already knows Hatch Forward
       from Hatch Back. Its trailing " Panel" is dropped: the width and the
       height are right beside it and "Panel" is the one word on a panel
       fabrication sheet that distinguishes nothing. The lookahead matters:
       a mirrored style reads "Chevron Braced Panel (Mirrored)", so the word
       sits mid-string there and an end-anchored strip would miss it. */
    return bracedPanelDisplayLabel(identity.bracedPattern, identity.bracedMirrored).replace(/ Panel(?= \(|$)/, "");
  }
  if (identity.braceFigure !== undefined) return `${BRACE_FIGURE_LABELS[identity.braceFigure]}${half}`;
  if (identity.bracePairPattern !== undefined) return `${BRACE_PAIR_PATTERN_LABELS[identity.bracePairPattern]}${half}`;
  /* ⚠ Before the type label, because a Gable Peak IS a column by type and
     would otherwise be named one. Measured on The Tank: its sheet read
     "10' Column 25½"" for a panel carrying a plywood beam box and four 2x6
     packs that no wall column has. */
  if (identity.isGablePeak === true) return "Gable Peak";
  return identity.panelTypeLabel.replace(/ Panel$/, "");
}

/**
 * `10' Super Carrot (L) 48"` — height, then the figure, then the width, then
 * `(edited)` when the panel's members are its own rather than its pattern's.
 *
 * Width stays in the name even though he did not ask for it: he already reads
 * it there today, two panels of the same figure and height at different widths
 * are different parts, and it is the key the new sheet ORDER sorts on (see
 * `comparePanelSheets`).
 */
export function distinctPanelName(identity: PanelSheetIdentity, unitSystem: "imperial" | "metric"): string {
  const parts = [
    panelSheetHeightLabel(identity.heightIn, unitSystem),
    panelSheetFigureLabel(identity),
    formatLengthIn(identity.widthIn, unitSystem),
  ];
  if (identity.isEdited === true) parts.push("(edited)");
  return parts.join(" ");
}

/**
 * ⚠ **THE SHEET ORDER IS THE SHOP'S, NOT THE PLAN'S — his call, 2026-11-04.**
 *
 * > *"Let's order shop fabrication sheets prioritizing all widths 48" or less,
 * > then height, then figure, then more than 48" widths. That should catch all
 * > the panels as well as bundle similar panel widths - switching the pusher
 * > head on the pusher is a step of the process that takes time, so minimizing
 * > pusher head changes via similar width panels with be ideal."*
 *
 * So the keys, in his order:
 *
 * 1. **width bucket** — everything 48in and under first, everything over it
 *    after. (`<=`, not `<`: 48in is the wall module, so the common panel must
 *    land in the first bucket.)
 * 2. **height**, shortest first.
 * 3. **figure**, alphabetically by the name above.
 * 4. **width**, which is the only variable his three keys leave free — and
 *    the one his REASON is about. Adding it last puts two sheets of the same
 *    height and figure in pusher-head order without disturbing anything he
 *    specified. It is a tiebreak, not a fourth rule of his.
 * 5. the type id, then the group key, purely so the order is total and the
 *    packet is byte-stable between renders.
 *
 * ⚠ **This retires the type blocks.** The order used to be
 * `SHOP_DRAWING_PANEL_TYPES`' hardcoded array — standard, corner, braced,
 * safety-gap, header, sill, column, gable — then first-encountered within a
 * type, which followed wall order and slot order. Under his rule a 48in
 * Standard, a 48in Gable tile and a 25½in Corner of the same height are
 * neighbours, and the Standard sheets are no longer contiguous. He said so
 * himself: *"This is going to seem like a change but why not just make it easy
 * for the shop."* `SHOP_DRAWING_PANEL_TYPES` still decides which types get
 * sheets at all, and still orders the preview-only Jack Stud page — it just no
 * longer decides the packet's order.
 */
export const PUSHER_HEAD_WIDTH_BUCKET_IN = 48;

export interface PanelSheetSortable {
  identity: PanelSheetIdentity;
  /** The group's own unique key — the last tiebreak, so the sort is total. */
  uniqueKey: string;
}

export function panelSheetWidthBucket(widthIn: number): 0 | 1 {
  /* Tolerance is a 64th of an inch, not float epsilon: the grid is eighths
     (see `formatImperialFractionIn`), so a stored 48.0000001 IS the module and
     belongs in the first bucket. */
  return widthIn <= PUSHER_HEAD_WIDTH_BUCKET_IN + 1 / 64 ? 0 : 1;
}

export function comparePanelSheets(a: PanelSheetSortable, b: PanelSheetSortable): number {
  const bucket = panelSheetWidthBucket(a.identity.widthIn) - panelSheetWidthBucket(b.identity.widthIn);
  if (bucket !== 0) return bucket;
  const height = a.identity.heightIn - b.identity.heightIn;
  if (Math.abs(height) > 1e-9) return height;
  const figure = panelSheetFigureLabel(a.identity).localeCompare(panelSheetFigureLabel(b.identity));
  if (figure !== 0) return figure;
  const width = a.identity.widthIn - b.identity.widthIn;
  if (Math.abs(width) > 1e-9) return width;
  const type = a.identity.panelTypeId.localeCompare(b.identity.panelTypeId);
  if (type !== 0) return type;
  return a.uniqueKey.localeCompare(b.uniqueKey);
}

/**
 * ⚠ **The colour comes from `panelColors.ts`, and a second palette was
 * refused.** `PANEL_TYPE_COLORS` / `NAMED_PANEL_TYPE_COLORS` already drive the
 * plan canvas, the legend, the right-click menu's own swatches and the 3D
 * accents — so a Braced sheet banded in that purple is the purple he already
 * reads as braced on the plan. A fabrication-sheet palette of its own would be
 * two languages for one fact.
 *
 * ⚠ **Floor and roof were refused a colour until he gave one.** They are the
 * two types the plan has never drawn, so B25 returned null rather than picking
 * for him; on 2026-11-04 he said *"Floors should be dark grey and roofs light
 * brown"* and `DECK_PANEL_COLORS` is that answer. Truss plate and box beam
 * followed on 2026-11-05 — *"Box beam green and truss plate blue"* — so every
 * fabrication sheet in the packet carries a band now. Anything still unnamed
 * returns null rather than being given a default.
 */
export function panelSheetAccentColor(panelTypeId: string): string | null {
  if (panelTypeId === "floor" || panelTypeId === "roof") return DECK_PANEL_COLORS[panelTypeId];
  if (panelTypeId === "truss-plate" || panelTypeId === "box-beam") return ASSEMBLY_COLORS[panelTypeId];
  return NAMED_PANEL_TYPE_COLORS[panelTypeId as NamedPanelType] ?? null;
}

/**
 * The band's own fill: the type colour mixed back towards white.
 *
 * ⚠ **These sheets get printed, most of them in greyscale**, so the tint is
 * the fact that has to survive — a full-strength `#b06fc9` band behind black
 * text prints as a mid grey and the text goes with it. At `TINT_WEIGHT` every
 * type's band stays light enough for black body text at better than 7:1
 * contrast, in colour and in greyscale alike, and the full-strength colour is
 * carried by a solid swatch beside the name instead. `panelSheetIdentity.test.ts`
 * measures both for every type rather than trusting the eye.
 */
export const TINT_WEIGHT = 0.18;

export function tintTowardsWhite(hex: string, weight = TINT_WEIGHT): string {
  const { r, g, b } = parseHex(hex);
  const mix = (c: number) => Math.round(255 + (c - 255) * weight);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** sRGB relative luminance (WCAG 2.1), used by both checks below. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio against black text, which is what every one of these
 * sheets prints. */
export function contrastWithBlack(hex: string): number {
  return (relativeLuminance(hex) + 0.05) / 0.05;
}
