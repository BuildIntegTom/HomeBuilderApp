import type { PanelMember } from "./componentSchema";
import { PLATE_2X4_WIDTH_IN } from "./panelMemberHelpers";
import {
  FLOOR_ROOF_EDGE_PANEL_WIDTH_IN,
  JOIST_2X6_THICKNESS_IN,
  FLOOR_ROOF_PANEL_WIDTH_IN,
  FLOOR_ROOF_RUN_CLOSER_WIDTH_IN,
  buildFloorRoofPanelSchema,
  firstPlywoodSheetWidthIn,
  planFloorRoofPanelWidthsIn,
  type FloorRoofPanelOptions,
} from "./floorRoofPanelMembers";

/** What a panel is doing in the run, which is what makes two panels of the
 * same width still worth telling apart on a sheet. */
export type FloorRoofPanelRole = "edge" | "field" | "closer" | "remainder";

export interface FloorRoofPanelInstance {
  /** `F1`/`R1`, numbered along the run.
   *
   * ⚠ A naming convention nobody has approved. Wall panels carry a compass
   * direction because a wall has one; a floor panel does not, so this is the
   * simplest series that still reads as a floor panel. */
  name: string;
  widthIn: number;
  /** Distance from the run's start to this panel's near edge. */
  atIn: number;
  role: FloorRoofPanelRole;
}

export interface FloorRoofPanelGroup {
  /** Stable per unique panel, for React keys and note ids. */
  key: string;
  widthIn: number;
  role: FloorRoofPanelRole;
  /** The schema's own member list, caps included on a pitched roof. */
  members: PanelMember[];
  spanIn: number;
  depthIn: number;
  instances: FloorRoofPanelInstance[];
}

export interface FloorRoofPanelRunPlan {
  instances: FloorRoofPanelInstance[];
  groups: FloorRoofPanelGroup[];
  /** How wide to trim the first sheet so every sheet after it lands on a
   * seam. Null when no seam falls within one sheet. */
  firstSheetWidthIn: number | null;
  /** How many 8ft sheets the run takes, first trimmed sheet included. */
  sheetCount: number;
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

const ROLE_ORDER: Record<FloorRoofPanelRole, number> = { edge: 0, field: 1, closer: 2, remainder: 3 };

export interface FloorRoofPanelRunOptions {
  kind: "floor" | "roof";
  /** Along the building — how far the row of panels repeats. */
  runLengthIn: number;
  /** What one panel has to reach, which is the panel's own length. */
  spanIn: number;
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
 * ⚠ **The panels fill the run exactly and leave no room for a girt along its
 * edges.** `FLOOR_ROOF_EDGE_PANEL_WIDTH_IN` is 13.25 precisely so that the
 * panel plus its 2.25in structural girt comes to the 15.5in wall depth, but
 * the girt the builder places runs across a panel's span END, inside the
 * panel's own length. A wall running PARALLEL to the panels would need a girt
 * along the run's edge, and nothing allocates width for one. Flagged rather
 * than guessed at: either the edge panels are narrowed for a girt that has to
 * be given its 2.25in of run, or they are not narrowed at all.
 */
export function planFloorRoofPanelRun(options: FloorRoofPanelRunOptions): FloorRoofPanelRunPlan {
  const depthIn = options.depthIn ?? 15.5;
  const empty = {
    instances: [],
    groups: [],
    firstSheetWidthIn: null,
    sheetCount: 0,
    narrowestWidthIn: 0,
    impossiblePanels: [],
    impossibleWarning: null,
  };

  if (!(options.runLengthIn > 0) || !(options.spanIn > 0)) {
    return { ...empty, refusal: "This building has no run or span to lay panels across yet." };
  }

  const widths = planFloorRoofPanelWidthsIn(options.runLengthIn, FLOOR_ROOF_EDGE_PANEL_WIDTH_IN);
  if (widths === null) {
    return {
      ...empty,
      refusal:
        `A ${(options.runLengthIn / 12).toFixed(1)}ft run is shorter than the two ` +
        `${FLOOR_ROOF_EDGE_PANEL_WIDTH_IN}in edge panels it has to start and end with ` +
        `(${(2 * FLOOR_ROOF_EDGE_PANEL_WIDTH_IN).toFixed(2)}in), so it cannot be panelised at all.`,
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

  const byKey = new Map<string, FloorRoofPanelInstance[]>();
  for (const instance of instances) {
    const key = `${instance.role}-${instance.widthIn}`;
    const existing = byKey.get(key);
    if (existing) existing.push(instance);
    else byKey.set(key, [instance]);
  }

  const groups: FloorRoofPanelGroup[] = [...byKey.entries()]
    .map(([key, groupInstances]) => {
      const first = groupInstances[0]!;
      const panelOptions: FloorRoofPanelOptions = {
        kind: options.kind,
        widthIn: first.widthIn,
        depthIn,
        lengthIn: options.spanIn,
        structuralGirtEnds: options.kind === "roof" ? [] : (options.structuralGirtEnds ?? ["start", "end"]),
      };
      return {
        key: `${options.kind}-${key}`,
        widthIn: first.widthIn,
        role: first.role,
        members: buildFloorRoofPanelSchema(panelOptions, options.kind === "roof" ? options.pitchIn12 : undefined)
          .members,
        spanIn: options.spanIn,
        depthIn,
        instances: groupInstances,
      };
    })
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || b.widthIn - a.widthIn);

  const firstSheetWidthIn = firstPlywoodSheetWidthIn(widths);
  const narrowestWidthIn = Math.min(...widths);
  const hasGirt = options.kind === "floor" && (options.structuralGirtEnds ?? ["start", "end"]).length > 0;
  const minimumIn = floorRoofPanelMinimumWidthIn(hasGirt);
  const impossiblePanels = instances.filter((i) => i.widthIn < minimumIn - 1e-9);

  return {
    instances,
    groups,
    firstSheetWidthIn,
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
