import { PLATE_2X4_WIDTH_IN } from "./panelMemberHelpers";
import {
  FLOOR_ROOF_EDGE_PANEL_WIDTH_IN,
  JOIST_2X6_THICKNESS_IN,
  FLOOR_ROOF_PANEL_WIDTH_IN,
  FLOOR_ROOF_RUN_CLOSER_WIDTH_IN,
  firstPlywoodSheetWidthIn,
  lastTrueSheetSeamIn,
  planFloorRoofPanelWidthsIn,
} from "./floorRoofPanelMembers";

/** What a panel is doing in the run, which is what makes two panels of the
 * same width still worth telling apart on a sheet. */
export type FloorRoofPanelRole = "edge" | "field" | "closer" | "remainder";

export interface FloorRoofPanelInstance {
  /** `F1`/`R1`, numbered along the run.
   *
   * Confirmed by Tommy 2026-10-23: *"F1 R1 etc naming stragy is great, I like
   * it."* Wall panels carry a compass direction because a wall has one; a
   * floor panel does not, so this is the simplest series that still reads as
   * a floor panel. */
  name: string;
  widthIn: number;
  /** Distance from the run's start to this panel's near edge. */
  atIn: number;
  role: FloorRoofPanelRole;
}

/**
 * ⚠ **This plans the RUN, and nothing else builds a panel from it.**
 *
 * It used to return `groups`, each with its own `members` built straight from
 * `buildFloorRoofPanelSchema` — and that was one of the two disagreeing floor
 * and roof plans `computeDeckPanelTakeoff` exists to replace. A group here
 * knew nothing about the column girts under a ridge post or a roof panel's
 * bearing seat, so the sheet printed from it described a different panel from
 * the one the 3D view drew.
 *
 * Grouping identical panels and building their members is now the takeoff's
 * single job. What stays here is what only the RUN knows: how wide each panel
 * is, what each one is doing in the row, what it is called, how the sheathing
 * above lands on the seams, and which panels came out too narrow to build.
 */
export interface FloorRoofPanelRunPlan {
  instances: FloorRoofPanelInstance[];
  /** How wide to trim the first sheet so every sheet after it lands on a
   * seam. Null when no seam falls within one sheet. */
  firstSheetWidthIn: number | null;
  /** How many 8ft sheets the run takes, first trimmed sheet included. */
  sheetCount: number;
  /** How far down the run the sheets keep landing on a panel seam. Past it
   * the installer cuts, the same as they cut the first sheet — see
   * `lastTrueSheetSeamIn`. */
  lastTrueSheetSeamIn: number | null;
  narrowestWidthIn: number;
  /** Every planned panel narrower than its own members — see
   * `floorRoofPanelMinimumWidthIn`. Empty on a run that works. */
  impossiblePanels: FloorRoofPanelInstance[];
  /** ⚠ Set when `impossiblePanels` is non-empty. The run is still returned
   * in full rather than refused, because a 20ft floor is an ordinary thing to
   * want and the fix is a decision about panel widths, not an error. */
  impossibleWarning: string | null;
  /** Non-null when the run cannot be panelised at all, in words rather than
   * a silent empty list. */
  refusal: string | null;
}

/**
 * The narrowest panel that can physically be built, by kind.
 *
 * ⚠ **Measured, not decided.** Nobody has given floor or roof panels a
 * minimum width the way walls have `fabricationMinPanelWidthIn` (24in, his).
 * So this is the width below which the builder's own members stop fitting:
 *
 * - A panel's two joists are 1.5in of width each, so **3in** is the floor for
 *   any panel at all. At 2.25in the left and right joists measurably OVERLAP
 *   (x 0–1.5 against x 0.75–2.25) and members overflow the panel box by
 *   1.25in.
 * - A structural girt adds two 2x4s laid side by side across the width, 3.5in
 *   each, so a panel carrying one needs **7in**. At exactly 7in they fit edge
 *   to edge with nothing to spare.
 *
 * This is a hard geometric limit, not a judgement about what is sensible to
 * fabricate — an 8in panel fits together and may still be a silly thing to
 * build. That call is his.
 */
export function floorRoofPanelMinimumWidthIn(hasStructuralGirt: boolean): number {
  return hasStructuralGirt ? 2 * PLATE_2X4_WIDTH_IN : 2 * JOIST_2X6_THICKNESS_IN;
}

function roleOf(widthIn: number, index: number, count: number): FloorRoofPanelRole {
  if (index === 0 || index === count - 1) return "edge";
  if (Math.abs(widthIn - FLOOR_ROOF_PANEL_WIDTH_IN) < 1e-9) return "field";
  if (Math.abs(widthIn - FLOOR_ROOF_RUN_CLOSER_WIDTH_IN) < 1e-9) return "closer";
  return "remainder";
}

export interface FloorRoofPanelRunOptions {
  kind: "floor" | "roof";
  /** Along the building — how far the row of panels repeats. */
  runLengthIn: number;
  /** What one panel has to reach, which is the panel's own length. */
  spanIn: number;
  /**
   * The wall's thickness, which is ALSO how wide the two edge panels are:
   * *"The edge panels for floors and roofs still have to be 15.5" because
   * thata the wall thickness."* — Tommy, 2026-10-23.
   *
   * ⚠ So a building with a deeper wall gets wider edge panels, here as well
   * as in the 3D view. This used to pass the catalog's 15.5in DEFAULT to
   * `planFloorRoofPanelWidthsIn` while the view passed the real depth, which
   * is how a shop sheet could describe a different set of widths from the
   * panels on screen on any building not 15.5in thick.
   */
  depthIn?: number;
  /** Roof only. Without it the panels carry no caps, because a cap's
   * geometry is the pitch. */
  pitchIn12?: number;
  /** Floor only, and passed straight through: which span ends have a wall
   * above. */
  structuralGirtEnds?: ("start" | "end")[];
}

/**
 * Every floor (or roof) panel one building needs, grouped so that one shop
 * sheet covers every exact copy — the same bargain the wall panels own
 * fabrication groups make.
 *
 * ⚠ **The panels fill the run exactly and no girt runs along its edges —
 * SETTLED, where this used to be an open flag.** The flag read: the edge
 * panel is 13.25in *"precisely so that the panel plus its 2.25in structural
 * girt comes to the 15.5in wall depth"*, and nothing allocated run for a girt
 * under a wall PARALLEL to the panels. Both halves are now answered and the
 * answer is no girt:
 *
 * - The edge panel is `FLOOR_ROOF_EDGE_PANEL_WIDTH_IN` = **15.5in, the full
 *   wall depth**, not 13.25 — *"The edge panels for floors and roofs still
 *   have to be 15.5" because thata the wall thickness."* The subtraction that
 *   made room for an edge girt was removed with the girt.
 * - *"The walls that sit overtop one span of a panel do not need more than
 *   the one structural girt at the end."* A parallel wall lands square on
 *   that 15.5in edge panel, whose two joists run its whole length directly
 *   under both toe-up boards, so its load is already on framing end to end.
 *
 * ⚠ What a wall CROSSING the panels needs is a different part and it exists:
 * a pair of girts at the bearing end, one under each toe-up board — see
 * `wallBearingGirtStationsIn` (B23). That pair lives inside the panel's own
 * length and still costs the run nothing.
 */
export function planFloorRoofPanelRun(options: FloorRoofPanelRunOptions): FloorRoofPanelRunPlan {
  const edgeWidthIn = options.depthIn ?? FLOOR_ROOF_EDGE_PANEL_WIDTH_IN;
  const empty = {
    instances: [],
    firstSheetWidthIn: null,
    sheetCount: 0,
    lastTrueSheetSeamIn: null,
    narrowestWidthIn: 0,
    impossiblePanels: [],
    impossibleWarning: null,
  };

  if (!(options.runLengthIn > 0) || !(options.spanIn > 0)) {
    return { ...empty, refusal: "This building has no run or span to lay panels across yet." };
  }

  const widths = planFloorRoofPanelWidthsIn(options.runLengthIn, edgeWidthIn);
  if (widths === null) {
    return {
      ...empty,
      refusal:
        `A ${(options.runLengthIn / 12).toFixed(1)}ft run is shorter than the two ` +
        `${edgeWidthIn}in edge panels it has to start and end with ` +
        `(${(2 * edgeWidthIn).toFixed(2)}in), so it cannot be panelised at all.`,
    };
  }

  const prefix = options.kind === "floor" ? "F" : "R";
  const instances: FloorRoofPanelInstance[] = [];
  let atIn = 0;
  widths.forEach((widthIn, index) => {
    instances.push({
      name: `${prefix}${index + 1}`,
      widthIn,
      atIn,
      role: roleOf(widthIn, index, widths.length),
    });
    atIn += widthIn;
  });

  const firstSheetWidthIn = firstPlywoodSheetWidthIn(widths);
  const narrowestWidthIn = Math.min(...widths);
  const hasGirt = options.kind === "floor" && (options.structuralGirtEnds ?? ["start", "end"]).length > 0;
  const minimumIn = floorRoofPanelMinimumWidthIn(hasGirt);
  const impossiblePanels = instances.filter((i) => i.widthIn < minimumIn - 1e-9);

  return {
    instances,
    firstSheetWidthIn,
    lastTrueSheetSeamIn: lastTrueSheetSeamIn(widths),
    sheetCount:
      firstSheetWidthIn === null
        ? Math.ceil(options.runLengthIn / 96)
        : 1 + Math.ceil((options.runLengthIn - firstSheetWidthIn) / 96),
    narrowestWidthIn,
    impossiblePanels,
    impossibleWarning:
      impossiblePanels.length === 0
        ? null
        : `${impossiblePanels.map((i) => `${i.name} (${i.widthIn}in)`).join(", ")} ` +
          `${impossiblePanels.length === 1 ? "is" : "are"} narrower than ${minimumIn}in, which is what ` +
          (hasGirt
            ? "the structural girt's two side-by-side 2x4s alone measure"
            : "the panel's own two joists alone measure") +
          `. Below that the members overlap and spill outside the panel. A ` +
          `${(options.runLengthIn / 12).toFixed(1)}ft run leaves this much over after its full panels, so ` +
          "either the run changes or a panel width does — and no minimum width has been set for " +
          "floor and roof panels yet, so nothing here decides that for you.",
    refusal: null,
  };
}
