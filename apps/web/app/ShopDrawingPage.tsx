import type { PanelStructuralStatus } from "@building-integrity/panel-catalog";
import type { PanelWeightBreakdown } from "@building-integrity/calc-engine";
import SheetTitleBlock from "./SheetTitleBlock";
import type { ViewerRole } from "./viewerRole";
import styles from "./ShopDrawingPage.module.css";

export interface ShopDrawingBomPart {
  label: string;
  qty: number;
  dimensions: string;
}

export interface ShopDrawingInstance {
  name: string;
  slotType: string;
  widthIn: number;
  weightBreakdown: PanelWeightBreakdown;
}

export interface ShopDrawingPageProps {
  title: string;
  panelDescription: string;
  standardWidthIn: number;
  thicknessIn: number;
  heightIn: number;
  loadBearingCapacity: PanelStructuralStatus;
  shearValue: PanelStructuralStatus;
  /** undefined = no BOM exists yet for this panel type (e.g. corner, safety-gap). */
  bomParts?: ShopDrawingBomPart[];
  bomNote?: string;
  instances: ShopDrawingInstance[];
  role: ViewerRole;
}

/** Placeholder standard-panel reference drawing: real dimensions, but no
 * labeled parts yet — Tommy is providing the actual shop-drawing reference
 * images/part labels separately. */
function StandardPanelPlaceholder({ widthIn, heightIn, thicknessIn }: { widthIn: number; heightIn: number; thicknessIn: number }) {
  const w = 200;
  const h = Math.min(320, w * (heightIn / widthIn));
  return (
    <svg viewBox="0 0 360 360" style={{ width: "100%", maxWidth: 360, height: "auto" }} role="img" aria-label="Standard panel placeholder diagram">
      <rect x={80} y={20} width={w} height={h} fill="#d9c9a3" stroke="#8a6a3a" strokeWidth={2} />
      <line x1={80} y1={h + 30} x2={80 + w} y2={h + 30} stroke="#999" strokeWidth={1} />
      <text x={80 + w / 2} y={h + 46} fontSize="12" textAnchor="middle" fill="#333">
        {widthIn}&quot; wide
      </text>
      <line x1={60} y1={20} x2={60} y2={20 + h} stroke="#999" strokeWidth={1} />
      <text x={40} y={20 + h / 2} fontSize="12" textAnchor="middle" fill="#333" transform={`rotate(-90 40 ${20 + h / 2})`}>
        {heightIn}&quot; tall
      </text>
      <text x={80 + w / 2} y={20 + h / 2} fontSize="12" textAnchor="middle" fill="#a67c00">
        {thicknessIn}&quot; thick
      </text>
      <text x={80 + w / 2} y={h + 70} fontSize="11" textAnchor="middle" fill="#a67c00">
        Reference drawing pending — Tommy to provide labeled parts
      </text>
    </svg>
  );
}

/** One panel type's "sheet": a standard-panel reference diagram (placeholder
 * until real shop-drawing images are provided), load-bearing/shear values,
 * the wood BOM's part sizes (when one exists), and a full per-instance
 * table — every individual panel of this type currently in the design,
 * named the way a real shop drawing would (e.g. "AB-1", "AB-2"), each with
 * its own straw-only and full weight breakdown. Title/description/
 * disclaimer live in the shared title-block strip (SheetTitleBlock). */
export default function ShopDrawingPage({
  title,
  panelDescription,
  standardWidthIn,
  thicknessIn,
  heightIn,
  loadBearingCapacity,
  shearValue,
  bomParts,
  bomNote,
  instances,
  role,
}: ShopDrawingPageProps) {
  return (
    <SheetTitleBlock title={title} description={panelDescription} role={role}>
      <div className={styles.diagram}>
        <StandardPanelPlaceholder widthIn={standardWidthIn} heightIn={heightIn} thicknessIn={thicknessIn} />
      </div>

      <div>
        <h4 className={styles.sectionHeading}>Structural values</h4>
        <table className={styles.table}>
          <tbody>
            <tr>
              <td>Load-bearing capacity</td>
              <td className={styles.pendingCell}>not yet modeled — {loadBearingCapacity.note}</td>
            </tr>
            <tr>
              <td>Shear value</td>
              <td className={styles.pendingCell}>not yet modeled — {shearValue.note}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {bomParts && bomParts.length > 0 && (
        <div>
          <h4 className={styles.sectionHeading}>Standard panel parts (BOM)</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Part</th>
                <th>Qty</th>
                <th>Dimensions</th>
              </tr>
            </thead>
            <tbody>
              {bomParts.map((part) => (
                <tr key={part.label}>
                  <td>{part.label}</td>
                  <td>{part.qty}</td>
                  <td>{part.dimensions}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bomNote && <p className={styles.note}>{bomNote}</p>}
        </div>
      )}

      <div>
        <h4 className={styles.sectionHeading}>Individual panels ({instances.length})</h4>
        {instances.length === 0 ? (
          <p className={styles.note}>No panels of this type in the current design.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Panel</th>
                <th>Width</th>
                <th>Straw only</th>
                <th>Full weight (modeled)</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => (
                <tr key={inst.name}>
                  <td>
                    {inst.name}
                    {inst.slotType !== "standard" && inst.slotType !== "corner" && inst.slotType !== "braced" && inst.slotType !== "safety-gap" ? (
                      <span className={styles.note}> ({inst.slotType})</span>
                    ) : null}
                  </td>
                  <td>{inst.widthIn}&quot;</td>
                  <td>
                    {inst.weightBreakdown.strawOnlyWeightLb.toFixed(1)} lb (
                    {inst.weightBreakdown.strawOnlyWeightKg.toFixed(1)} kg)
                  </td>
                  <td>
                    {inst.weightBreakdown.totalModeledWeightLb.toFixed(1)} lb (
                    {inst.weightBreakdown.totalModeledWeightKg.toFixed(1)} kg)
                    <br />
                    <span className={styles.note}>
                      {inst.weightBreakdown.components
                        .map((c) => `${c.label}: ${c.weightLb === null ? "not modeled" : `${c.weightLb.toFixed(1)} lb`}`)
                        .join(" · ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </SheetTitleBlock>
  );
}
