import type { CornerId, Footprint, PanelSlot } from "@building-integrity/geometry";
import SheetTitleBlock from "./SheetTitleBlock";
import PlanViewDiagram from "./PlanViewDiagram";
import PlanViewLedger from "./PlanViewLedger";
import type { PanelInstance } from "./panelInstances";
import type { ViewerRole } from "./viewerRole";

export interface PlanViewPageProps {
  footprint: Footprint;
  wallSlots: Record<string, PanelSlot[]>;
  wallStartOffsetIn: Record<string, number>;
  thicknessIn: number;
  allInstances: PanelInstance[];
  /**
   * ⚠ **THE PANEL'S OWN NUMBER — `0042` — by instance name. B36 stride 3,
   * 2026-11-18: *"the label IS the number"*.**
   *
   * Handed in, every panel on this drawing is labelled by its NUMBER rather
   * than by `N3`, which is its LOCATION and is a separate fact. Omitted, the
   * drawing falls back to the location labels it has always shown — which is
   * what a caller with no project context should get, rather than blanks.
   */
  panelNumberByName?: ReadonlyMap<string, string>;
  primaryCornerIds: Set<CornerId>;
  leastAccessibleCorner: CornerId;
  /** Stage 3 — see PlanViewDiagram's own prop doc. */
  wallUnbuiltSpansIn?: Record<string, { fromIn: number; toIn: number }[]>;
  role: ViewerRole;
}

/**
 * Printable 2D plan view (Tommy: "is there a way to print plan view?") —
 * the whole footprint + panel layout as a to-scale SVG, with a panel-type
 * ledger (swatch + label + count) in the title-block's own side-diagram
 * zone, same layout convention the Shop Fabrication sheets use (calls
 * SheetTitleBlock directly, bypassing DetailGuidePage, which has no
 * sideDiagram slot).
 */
export default function PlanViewPage({
  footprint,
  wallSlots,
  wallStartOffsetIn,
  thicknessIn,
  allInstances,
  panelNumberByName,
  primaryCornerIds,
  leastAccessibleCorner,
  wallUnbuiltSpansIn,
  role,
}: PlanViewPageProps) {
  return (
    <SheetTitleBlock
      title="Plan View"
      description="To-scale 2D floor plan, with every panel colored by type and labeled with its own ID."
      role={role}
      sideDiagram={<PlanViewLedger wallSlots={wallSlots} />}
    >
      <PlanViewDiagram
        footprint={footprint}
        wallSlots={wallSlots}
        wallStartOffsetIn={wallStartOffsetIn}
        thicknessIn={thicknessIn}
        allInstances={allInstances}
        panelNumberByName={panelNumberByName}
        primaryCornerIds={primaryCornerIds}
        leastAccessibleCorner={leastAccessibleCorner}
        wallUnbuiltSpansIn={wallUnbuiltSpansIn}
      />
    </SheetTitleBlock>
  );
}
