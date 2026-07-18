import type { PanelMember } from "./componentSchema";
import { buildDoorHeaderMembers, buildWindowHeaderMembers } from "./headerMembers";
import { buildJackStudMembers, jackStudThicknessIn, type JackStudConfig } from "./jackStudMembers";
import { buildSillPanelMembers } from "./sillPanelMembers";
import { shiftTrapezoidCorners } from "./panelMemberHelpers";

function shiftAndPrefix(members: PanelMember[], deltaXIn: number, deltaZIn: number, idPrefix: string): PanelMember[] {
  return members.map((m) => ({
    ...m,
    memberId: `${idPrefix}${m.memberId}`,
    position: {
      ...m.position,
      xIn: m.position.xIn + deltaXIn,
      zIn: m.position.zIn + deltaZIn,
      // A true beveled brace's actual rendered geometry comes from these
      // ABSOLUTE panel-space corners (see memberLocalCornersIn), not from
      // position.xIn/zIn — shifting only the latter left a header's own
      // diagonal braces rendering at their original near-floor local Z
      // while the rest of the assembly correctly moved up to the header's
      // real height (Tommy: bracing "spawns awkwardly on the ground").
      trapezoidCornersIn: shiftTrapezoidCorners(m.position.trapezoidCornersIn, deltaXIn, deltaZIn),
    },
  }));
}

/**
 * Every real member for one whole window/door opening — header, both jack
 * studs, and (windows only) the sill(s) — combined into a single, correctly
 * Z-positioned `PanelMember[]` so a caller (Building3DView, a Shop Drawing
 * page) can render the whole assembly as one group instead of the 3
 * illustrative-height sub-previews shown separately on the Door/Window
 * Rough Opening detail pages. Tommy: "why arent the RO's, headers, and
 * sills spawning into the 3d drawing... if those are still placeholders
 * lets fill them in."
 *
 * `bottomZIn`/`jackStudSpanIn` are the caller's own — a door's jack studs
 * span its real Rough Opening height (see computeDoorRoughOpeningHeightIn),
 * floor to header-bottom (`bottomZIn` = 0); a window's span whatever's left
 * between its sill's top and the header's bottom, since window RO height
 * has no confirmed real formula yet (same "illustrative" gap noted
 * throughout headers/jack studs — see headerPreviewHeightIn in data.ts).
 *
 * `sillWidthsIn` is pre-split by the caller (via computeSillRunWidths in
 * packages/geometry — panel-catalog doesn't depend on geometry) and tiled
 * left-to-right starting just inside the left jack stud.
 */
export function buildOpeningAssemblyMembers(
  slotWidthIn: number,
  depthIn: number,
  sourceSlotType: "window" | "door",
  jackStudConfig: JackStudConfig,
  bottomZIn: number,
  jackStudSpanIn: number,
  headerHeightIn: number,
  sillHeightIn: number,
  sillWidthsIn: number[],
  includeNailer: boolean,
): PanelMember[] {
  const jackThicknessIn = jackStudThicknessIn(jackStudConfig);
  const headerZIn = bottomZIn + jackStudSpanIn;
  const members: PanelMember[] = [];

  const headerMembers =
    sourceSlotType === "door"
      ? buildDoorHeaderMembers(slotWidthIn, depthIn, headerHeightIn)
      : buildWindowHeaderMembers(slotWidthIn, depthIn, headerHeightIn);
  members.push(...shiftAndPrefix(headerMembers, 0, headerZIn, "header_"));

  if (jackStudSpanIn > 0) {
    members.push(...shiftAndPrefix(buildJackStudMembers(depthIn, jackStudSpanIn, jackStudConfig), 0, bottomZIn, "jack_left_"));
    members.push(
      ...shiftAndPrefix(buildJackStudMembers(depthIn, jackStudSpanIn, jackStudConfig), slotWidthIn - jackThicknessIn, bottomZIn, "jack_right_"),
    );
  }

  if (sourceSlotType === "window") {
    let cursorXIn = jackThicknessIn;
    sillWidthsIn.forEach((sillWidthIn, i) => {
      members.push(...shiftAndPrefix(buildSillPanelMembers(sillWidthIn, depthIn, sillHeightIn, includeNailer), cursorXIn, 0, `sill_${i}_`));
      cursorXIn += sillWidthIn;
    });
  }

  return members;
}
