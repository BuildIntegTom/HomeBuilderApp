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
        primaryCornerIds={primaryCornerIds}
        leastAccessibleCorner={leastAccessibleCorner}
        wallUnbuiltSpansIn={wallUnbuiltSpansIn}
      />
    </SheetTitleBlock>
  );
}
