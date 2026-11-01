import type { ExportableAssembly, PanelMember } from "@building-integrity/panel-catalog";

/**
 * ⚠ **EVERY FABRICATED ASSEMBLY IN THE BUILDING, in one list, in one shape.**
 *
 * The app plans its parts through six separate pipelines, and each one's
 * groups look different: a wall panel group carries `instances` with slot
 * ids, a floor or roof panel group carries a run and a sheathing plan, a beam
 * group carries a covered length, the cross-tilted row carries a wall
 * direction. An export does not care about any of that — it wants the panel's
 * name, its size, how many the building needs, where they go, and its
 * members.
 *
 * ⚠ **This is the seam the other exports will come through too.** A CSV is
 * the first consumer; a DXF or a spreadsheet wants the same five things. The
 * cost of adding one is then a renderer, not another walk of six pipelines —
 * and, more to the point, a second walk is how two exports come to disagree
 * about what the building contains, which is the defect this codebase keeps
 * finding (see `deckPanelTakeoff`, `crossTiltTakeoff`).
 *
 * ⚠ **`copies` is the number INSTALLED, not the number of sheets.** A
 * fabrication group is one drawing covering N identical panels. A cut list
 * tells a shop how to build one; a purchase needs all N. Conflating them is
 * how a job comes up short, so the two travel separately all the way into
 * the file.
 */

/** The smallest thing each of the app's six group shapes has in common. */
interface GroupLike {
  members: PanelMember[];
  instances: readonly { name?: string }[];
}

export interface AssemblyDescriptor<T extends GroupLike> {
  /** The family, for grouping and for the CSV's first column. */
  panelType: string;
  groups: readonly T[];
  label: (group: T) => string;
  widthIn: (group: T) => number;
  heightIn: (group: T) => number;
}

/**
 * ⚠ Where the copies go, as the sheets name them — and **capped**, because a
 * 40ft run's roof row puts 20 names in one cell and a spreadsheet column
 * becomes unreadable. The count is already its own column, so the names are
 * a locator rather than a tally.
 */
const USED_AT_MAX_NAMES = 12;

export function describeUsedAt(instances: readonly { name?: string }[]): string {
  const names = instances.map((i) => i.name).filter((n): n is string => typeof n === "string" && n.length > 0);
  if (names.length === 0) return "";
  if (names.length <= USED_AT_MAX_NAMES) return names.join(", ");
  return `${names.slice(0, USED_AT_MAX_NAMES).join(", ")} … (+${names.length - USED_AT_MAX_NAMES} more)`;
}

export function toExportableAssemblies<T extends GroupLike>(descriptor: AssemblyDescriptor<T>): ExportableAssembly[] {
  return descriptor.groups
    /* ⚠ A group with no installed copies is a drawing of nothing. It can
       happen — a run clamped to zero leaves a group whose instances were all
       dropped — and exporting its parts would put real stock on a purchase
       list for a panel the building does not have. */
    .filter((group) => group.instances.length > 0 && group.members.length > 0)
    .map((group) => ({
      panelType: descriptor.panelType,
      label: descriptor.label(group),
      widthIn: descriptor.widthIn(group),
      heightIn: descriptor.heightIn(group),
      copies: group.instances.length,
      usedAt: describeUsedAt(group.instances),
      members: group.members,
    }));
}
