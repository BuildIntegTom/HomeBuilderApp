import type { ReactNode } from "react";
import { computePanelCutList, type PanelMember, type PanelStructuralStatus } from "@building-integrity/panel-catalog";
import type { PanelWeightBreakdown } from "@building-integrity/calc-engine";
import SheetTitleBlock from "./SheetTitleBlock";
import PanelElevationDiagram from "./PanelElevationDiagram";
import type { ViewerRole } from "./viewerRole";
import styles from "./PanelFabricationPage.module.css";

export interface PanelFabricationInstanceRef {
  name: string;
  isSafetyOctCorner?: boolean;
  /** Where this instance goes, in words, when its own name does not say.
   *
   * Written for Smearforn Stage 2b's spanning headers, whose names come from
   * a single building-wide series carrying **no direction at all** (`H1`, not
   * `EH1`) — so `H1` alone tells a shop nothing about where the panel
   * belongs, and the sheet has to. Carries the reciprocal on a spanned
   * panel's own sheet too ("Header above: H1"), because a shop reading one
   * sheet cannot see the other. */
  note?: string;
}

export interface PanelFabricationPageProps {
  title: string;
  panelDescription: ReactNode;
  widthIn: number;
  heightIn: number;
  /** Real member geometry for this one unique panel — feeds both the
   * to-scale elevation and the cut-list table below (each calls
   * computePanelCutList independently, so a letter always means the same
   * cut in both places without any extra plumbing). */
  members: PanelMember[];
  /** Every placed instance that is an exact copy of this unique panel
   * (Tommy: "group those up" — this page represents all of them at once). */
  instances: PanelFabricationInstanceRef[];
  weightBreakdown: PanelWeightBreakdown;
  loadBearingCapacity: PanelStructuralStatus;
  shearValue: PanelStructuralStatus;
  estimatedBearingLb?: number;
  estimatedShearLb?: number;
  estimatedBearingMethodLabel?: string;
  role: ViewerRole;
}

/**
 * One unique panel's shop fabrication sheet: a to-scale lettered elevation,
 * the materials cut list that letters match 1:1, which placed instances are
 * exact copies of this panel, the type-level structural estimate (unchanged
 * from ShopDrawingPage, just relocated), and a weight checker with a blank
 * line for the shop to write in the actual measured weight next to the
 * calculated one. Title/description/disclaimer live in the shared
 * title-block strip (SheetTitleBlock), same as every other detail page.
 */
export default function PanelFabricationPage({
  title,
  panelDescription,
  widthIn,
  heightIn,
  members,
  instances,
  weightBreakdown,
  loadBearingCapacity,
  shearValue,
  estimatedBearingLb,
  estimatedShearLb,
  estimatedBearingMethodLabel = "double stud pack",
  role,
}: PanelFabricationPageProps) {
  const cutList = computePanelCutList(members);

  return (
    <SheetTitleBlock
      title={title}
      description={panelDescription}
      role={role}
      sideDiagram={<PanelElevationDiagram members={members} widthIn={widthIn} heightIn={heightIn} compact />}
    >
      <div>
        <h4 className={styles.sectionHeading}>Materials cut list</h4>
        {cutList.length === 0 ? (
          <p className={styles.note}>No dimensional lumber or plywood members modeled for this panel.</p>
        ) : (
          /* ⚠ COLUMNS ARE TOMMY'S, 2026-10-11: *"using common denominational
             names for dimensional lumber like 2x4 as materials and then
             length(s) and angles where appropriate (for any inclined panel and
             with a note that clearly details how to cut it for the shop crew to
             be able to determine how to cut it"*.

             So Material is its own column (what you pull off the rack), Length
             is its own column (what you set the stop to), and the cut note is
             last and widest because it is a sentence, not a figure. The precise
             `row.dimensions` (t x w x l) is deliberately NOT shown: the nominal
             name plus the cut length is what a shop works from, and printing
             1.5" x 3.5" beside "2x4" is the same fact twice. */
          <table className={`${styles.table} ${styles.cutListTable}`}>
            <thead>
              <tr>
                <th>Letter</th>
                <th>Qty</th>
                <th>Part</th>
                <th>Material</th>
                <th>Length</th>
                <th>Angle</th>
                <th className={styles.cutNoteHeading}>How to cut it</th>
              </tr>
            </thead>
            <tbody>
              {cutList.map((row) => (
                <tr key={row.letter}>
                  <td className={styles.letterCell}>{row.letter}</td>
                  <td>{row.qty}</td>
                  <td>{row.partLabel}</td>
                  <td className={styles.materialCell}>{row.materialLabel}</td>
                  <td className={styles.lengthCell}>{row.lengthLabel}</td>
                  <td>{row.angleLabel}</td>
                  {/* Blank for a square crosscut rather than a sentence on every
                      row — the rows that need the saw reset have to stand out,
                      and they cannot if every row is talking. */}
                  <td className={styles.cutNoteCell}>{row.cutNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h4 className={styles.sectionHeading}>Also used at ({instances.length})</h4>
        <p className={styles.note}>
          {instances.map((inst, i) => (
            <span key={inst.name}>
              {i > 0 && ", "}
              {inst.name}
              {inst.isSafetyOctCorner && " (safety-oct-corner)"}
            </span>
          ))}
        </p>
        {/* One line per instance that carries a note — a spanning header's
            own wall and span in words, or a spanned panel's header above it.
            Printed, because it is the only place on a stack of one-dimensional
            sheets where a two-dimensional relationship survives. */}
        {instances.some((inst) => inst.note) && (
          <ul className={styles.note}>
            {instances
              .filter((inst) => inst.note)
              .map((inst) => (
                <li key={`note-${inst.name}`}>
                  <strong>{inst.name}</strong>: {inst.note}
                </li>
              ))}
          </ul>
        )}
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

      <div>
        <h4 className={styles.sectionHeading}>Weight checker</h4>
        <table className={styles.table}>
          <tbody>
            {weightBreakdown.components.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td>
                  {c.weightLb === null ? (
                    <span className={styles.pendingCell}>not modeled</span>
                  ) : (
                    `${c.weightLb.toFixed(1)} lb (${c.weightKg!.toFixed(1)} kg)`
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Total weight (calculated)</strong>
              </td>
              <td>
                <strong>
                  {weightBreakdown.totalModeledWeightLb.toFixed(1)} lb ({weightBreakdown.totalModeledWeightKg.toFixed(1)} kg)
                </strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p className={styles.signoffLine}>Actual total weight: _______________</p>
      </div>
    </SheetTitleBlock>
  );
}
