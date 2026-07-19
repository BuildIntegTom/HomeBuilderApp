import type { PanelSlot } from "@building-integrity/geometry";
import { PANEL_LEGEND_ORDER, PANEL_TYPE_COLORS, PANEL_TYPE_LABELS } from "./panelColors";

export interface PlanViewLedgerProps {
  wallSlots: Record<string, PanelSlot[]>;
}

/**
 * The Plan View's own "ledger" for SheetTitleBlock's sideDiagram zone —
 * Tommy: "a ledger in the top title block area for panel types." A real
 * tally (swatch + label + placed count), not just a color key, so it
 * doubles as a quick panel-count reference alongside the plan itself.
 * Counted by whichever color is visually dominant on the plan for a
 * combined slot (`secondaryType ?? type`), matching `PlanViewDiagram`'s own
 * fill logic — a combined safety-gap+corner panel counts once, under
 * whichever type is its solid base color there.
 */
export default function PlanViewLedger({ wallSlots }: PlanViewLedgerProps) {
  const counts = new Map<PanelSlot["type"], number>();
  for (const slots of Object.values(wallSlots)) {
    for (const slot of slots) {
      const key = slot.secondaryType ?? slot.type;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return (
    <div style={{ width: "100%", fontSize: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.03em", color: "#555" }}>
        Panel Types
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {PANEL_LEGEND_ORDER.filter((type) => (counts.get(type) ?? 0) > 0).map((type) => (
            <tr key={type}>
              <td style={{ padding: "1px 4px 1px 0", width: 12 }}>
                <span style={{ display: "inline-block", width: 9, height: 9, background: PANEL_TYPE_COLORS[type], border: "1px solid #555" }} />
              </td>
              <td style={{ padding: "1px 4px 1px 0" }}>{PANEL_TYPE_LABELS[type]}</td>
              <td style={{ padding: "1px 0", textAlign: "right", fontWeight: 700 }}>{counts.get(type)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
