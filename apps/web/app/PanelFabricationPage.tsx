import type { ReactNode } from "react";
import { computePanelCutList, type PanelMember, type PanelStructuralStatus } from "@building-integrity/panel-catalog";
import type { PanelWeightBreakdown } from "@building-integrity/calc-engine";
import SheetTitleBlock from "./SheetTitleBlock";
import { tintTowardsWhite } from "./panelSheetIdentity";
import PanelElevationDiagram from "./PanelElevationDiagram";
import type { CompassDirection } from "@building-integrity/geometry";
import { compassLabelColor } from "./compassLabelColor";
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
  /**
   * ⚠ **THIS COPY'S OWN PANEL NUMBER — `"0042"` — B35, merged by B36 stride 2
   * on 2026-11-18.**
   *
   * > *"Renaming all of the panels to go from point of least accessability,
   * > clockwise, from out to in, from bottom to top by label of 0000, 0001,
   * > 0002, etc."* — Tommy, 2026-11-16
   *
   * ⚠ **It is a TAG on a shared sheet, never a group key, and that is the
   * decision this field represents.** A Shop Fabrication page covers every
   * panel that is physically the same — which is what keeps a Tiny House at
   * roughly a dozen sheets instead of 74, and what makes B25's pusher-head
   * order mean anything. Making a unique number the identity of a SHEET would
   * un-group the whole packet. So the sheet goes on saying what to build, and
   * lists the panels it covers.
   *
   * ⚠ **It used to be `installNumber`, a POSITION, printed beside a separate
   * four-digit crew code that was an IDENTITY.** One number now: provisional
   * while the design is being drawn, frozen the moment the project is issued
   * for fabrication. Undefined for a panel drawn AFTER an issue, which shows
   * no number rather than one that already belongs to a different panel.
   */
  panelNumber?: string;
  /**
   * ⚠ **Which step of the install this copy is — the ORDER, kept apart from
   * the number above.** A plain integer, printed as "step 42 of 134" and never
   * zero-padded: two four-digit tokens on one chip is exactly the confusion
   * B36 stride 2 exists to end.
   */
  installStep?: number;
  /**
   * The compass direction of this copy's own wall, for the chip's colour.
   * Undefined for anything that does not face a compass point — a deck
   * panel, a beam — which gets a plainly non-compass chip rather than a
   * wrong one.
   */
  direction?: CompassDirection;
}

/**
 * ⚠ **How this sheet's numbers should be READ — B36 stride 2.** A four-digit
 * number on a printed sheet is taken as permanent whether it is or not, so the
 * sheet says which. Omitted, the sheet prints the numbers with no claim about
 * them, which is what a caller with no project context should do.
 */
export interface PanelNumberContext {
  /** True once the project has been issued, i.e. the numbers are frozen. */
  issued: boolean;
  /** ISO, or null when the ledger exists but nobody recorded the date. */
  issuedAt: string | null;
  /** The "of 134" in "step 42 of 134". */
  installStepTotal: number;
}

export interface PanelFabricationPageProps {
  title: string;
  /** ⚠ B36 stride 2 — see `PanelNumberContext`. */
  panelNumbers?: PanelNumberContext;
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
  /** B25 — the catalog type's own label (`Standard Panel`), shown beside the
   * colour swatch. The `title` carries the DISTINCT name now, so without this
   * a sheet would no longer say anywhere which type it belongs to. */
  typeLabel?: string;
  /** B25 — the type's colour from `panelColors.ts`, or null for a type the
   * plan has never drawn (floor, roof, truss plate, box beam), which gets no
   * band rather than an invented colour. */
  accentColor?: string | null;
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
  panelNumbers,
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
  typeLabel,
  accentColor,
  role,
}: PanelFabricationPageProps) {
  const cutList = computePanelCutList(members);
  const accent =
    accentColor != null && typeLabel !== undefined
      ? { color: accentColor, tint: tintTowardsWhite(accentColor), label: typeLabel }
      : undefined;

  return (
    <SheetTitleBlock
      title={title}
      description={panelDescription}
      role={role}
      accent={accent}
      /* ⚠ THE SHOP DRAWING IMAGE IS THE 3D VIEW, WITH ITS LETTERS. Tommy,
         2026-10-11: *"the shop drawing image of each panel should be what that
         panel looks like from the exterior up and left tilted as it would
         appear when isolated in the 3D view"* — and, told that swapping to 3D
         would cost the lettered badges that tie each cut-list row to a piece in
         the picture, he asked for both. So the badges are projected onto it;
         see `PanelElevationDiagram`'s `view` prop for why that is the same
         diagram rather than a second one. */
      sideDiagram={
        <PanelElevationDiagram members={members} widthIn={widthIn} heightIn={heightIn} compact view="axonometric" />
      }
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
        {/* ⚠ **B36 stride 3 — THE LABEL IS THE NUMBER, and the wall is a
            separate field beside it.** The bold token is the panel's own
            number; the lighter one is where it goes (`N3`, the third panel
            along a north-facing wall). They are never concatenated, because
            one of them moves when the design changes and the other does not.

            ⚠ **Sorted by the install STEP, not by the number**, so the chips
            read in the order a crew hangs them even after an issue has frozen
            numbers that no longer run consecutively. The order is carried by
            POSITION on the sheet plus the "step N of M" line below — not by a
            second four-digit token on the chip, which is what made a position
            and an identity indistinguishable before this stride.

            Copies with no number keep their location chip rather than being
            dropped — a missing panel reads as a panel nobody has to build. */}
        {instances.some((inst) => inst.panelNumber !== undefined) ? (
          <>
            <ul className={styles.instanceChips}>
              {[...instances]
                .sort((a, b) => (a.installStep ?? Infinity) - (b.installStep ?? Infinity))
                .map((inst) => {
                  const color = compassLabelColor(inst.direction);
                  return (
                    <li
                      key={inst.name}
                      className={styles.instanceChip}
                      style={{ background: color.background, color: color.foreground }}
                      title={`Panel ${inst.panelNumber ?? "(not yet numbered)"} at ${inst.name}${
                        inst.direction ? ` · ${inst.direction} wall — ${color.note}` : ""
                      }${inst.installStep !== undefined ? ` · install step ${inst.installStep}` : ""}`}
                    >
                      <span className={styles.instanceChipNumber}>{inst.panelNumber ?? "—"}</span>
                      <span className={styles.instanceChipName}>
                        {inst.name}
                        {inst.isSafetyOctCorner && " (safety-oct-corner)"}
                      </span>
                    </li>
                  );
                })}
            </ul>
            {/* ⚠ **THE INSTALL ORDER, ON ITS OWN LINE.** It is the one fact on
                this sheet that is allowed to move, so it is stated as an order
                ("step 42") rather than printed as a number on the chip. */}
            {instances.some((inst) => inst.installStep !== undefined) && (
              <p className={styles.note}>
                In install order:{" "}
                {[...instances]
                  .map((inst) => inst.installStep)
                  .filter((step): step is number => step !== undefined)
                  .sort((a, b) => a - b)
                  .map((step) => `step ${step}`)
                  .join(", ")}
                {panelNumbers ? ` of ${panelNumbers.installStepTotal}` : ""} — counted from the point of least
                accessibility, clockwise, out to in, bottom to top. <strong>This order is not the number</strong>: it
                recomputes whenever the design changes.
              </p>
            )}
            <p className={styles.note}>
              The bold token is the panel&apos;s own <strong>number</strong>, and the lighter one beside it is{" "}
              <strong>where it goes</strong> — two separate facts, never one label.{" "}
              {panelNumbers === undefined ? (
                "Whether these numbers are frozen is not known on this sheet."
              ) : panelNumbers.issued ? (
                <>
                  <strong>These numbers are issued and permanent</strong>
                  {panelNumbers.issuedAt === null
                    ? " (issued before the app recorded the date)"
                    : ` (issued ${new Date(panelNumbers.issuedAt).toLocaleDateString()})`}
                  : each panel keeps its number whatever the design does. A chip reading “—” is a panel drawn
                  since the issue, which has no number yet rather than a borrowed one.
                </>
              ) : (
                <>
                  <strong>These numbers are PROVISIONAL</strong> — the project has not been issued for fabrication,
                  so they still move when the design changes. Issue it to freeze them.
                </>
              )}{" "}
              The chip&apos;s colour is its wall&apos;s compass direction, and the letters beside it say the same thing
              for a black-and-white print.
            </p>
          </>
        ) : (
          <p className={styles.note}>
            {instances.map((inst, i) => (
              <span key={inst.name}>
                {i > 0 && ", "}
                {inst.name}
                {inst.isSafetyOctCorner && " (safety-oct-corner)"}
              </span>
            ))}
          </p>
        )}
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
