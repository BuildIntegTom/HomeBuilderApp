import type { ReactNode } from "react";
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
  panelType: string;
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
  /** A real 3D model (built from actual member geometry), shown instead of
   * the flat placeholder diagram when provided — undefined = no member
   * geometry modeled yet for this panel type, falls back to the placeholder. */
  diagram3D?: ReactNode;
  /** First-pass NDS-based bearing/shear estimates (Tommy: "let's take a
   * stab at making some estimated engineering numbers") — shown alongside
   * (not instead of) the "not yet modeled" real-engineering status, since
   * a licensed engineer's real number is still pending either way.
   * Undefined = no estimate applies to this panel type. */
  estimatedBearingLb?: number;
  estimatedShearLb?: number;
  /** Which NDS method the bearing estimate used — "double stud pack" for
   * standard/braced/gable, "built-up plywood section" for column/corner
   * (their two full-height side plywood sheets act as a composite column,
   * not a lone stud — see computeBuiltUpColumnBearingCapacityLb). Defaults
   * to "double stud pack" for backward compatibility. */
  estimatedBearingMethodLabel?: string;
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
  diagram3D,
  estimatedBearingLb,
  estimatedShearLb,
  estimatedBearingMethodLabel = "double stud pack",
  instances,
  role,
}: ShopDrawingPageProps) {
  return (
    <SheetTitleBlock title={title} description={panelDescription} role={role}>
      <div className={styles.diagram}>
        {diagram3D ?? <StandardPanelPlaceholder widthIn={standardWidthIn} heightIn={heightIn} thicknessIn={thicknessIn} />}
      </div>

      <div>
        <h4 className={styles.sectionHeading}>Structural values</h4>
        {estimatedBearingLb !== undefined || estimatedShearLb !== undefined ? (
          <>
            <table className={styles.table}>
              <tbody>
                {estimatedBearingLb !== undefined && (
                  <tr>
                    <td>Estimated bearing capacity ({estimatedBearingMethodLabel})</td>
                    <td className={styles.note}>~{Math.round(estimatedBearingLb).toLocaleString()} lb</td>
                  </tr>
                )}
                {estimatedShearLb !== undefined && (
                  <tr>
                    <td>Estimated shear capacity (diagonal brace)</td>
                    <td className={styles.note}>~{Math.round(estimatedShearLb).toLocaleString()} lb</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className={styles.pendingCell}>
              Not yet modeled: real load-bearing capacity ({loadBearingCapacity.note}) and shear value (
              {shearValue.note}). The numbers above are Building Integrity&apos;s own first-pass engineering
              estimates (NDS sawn-lumber column-buckling method, applied to the diagonal brace / {estimatedBearingMethodLabel})
              — not a licensed engineer&apos;s calculation. Do not use for permitting or construction without
              independent structural review.
            </p>
          </>
        ) : (
          <p className={styles.pendingCell}>
            Not yet modeled — neither a real engineering value nor an estimate exists yet for this panel type.
            Load-bearing: {loadBearingCapacity.note} Shear: {shearValue.note}
          </p>
        )}
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
                    {inst.panelType === "safety-oct-corner" && <span className={styles.note}> (safety-oct-corner)</span>}
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
