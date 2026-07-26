import SheetTitleBlock from "./SheetTitleBlock";
import type { ViewerRole } from "./viewerRole";
import styles from "./DetailGuidePage.module.css";

export interface ProjectSummaryPageProps {
  role: ViewerRole;
  renderImageDataUrl: string | null;
  panelsTotal: number;
  panelsNote: string;
  openingsNote: string;
  totalWeightLb: number;
  totalWeightKg: number;
  weightNote: string;
  price: number;
  priceNote: string;
  carbonSequesteredLb: number;
  carbonSequesteredKg: number;
  netCO2eKg: number;
  netCO2eNote: string;
  /** Carbon Sequestered section (Tommy: "shows the equasion and output for
   * total weight of straw at 15% moisture content converted into lbs of
   * CO2e and its respective conversions") — the full straw-only breakdown,
   * standard (15%) moisture basis, plus EPA equivalency conversions. See
   * computeCarbonRange/computeCO2eEquivalencies in calc-engine. */
  strawMoistWeightLb: number;
  strawMoistureContentPct: number;
  strawDryWeightLb: number;
  strawCarbonFractionPct: number;
  strawCarbonLb: number;
  strawCO2eLb: number;
  strawCO2eKg: number;
  co2eEquivalentMilesDriven: number;
  co2eEquivalentLbCoalBurned: number;
  co2eEquivalentSmartphonesCharged: number;
  estimatedBearingLb: number;
  estimatedShearLb: number;
  permeanceLabel: string;
  vaporCheckLabel: string;
  vaporCheckPasses: boolean | null;
  /** Genuinely missing-from-any-total rollups this page adds (Tommy: "do a
   * full check on what might not be on this but should be"). */
  foundationConcreteNote: string | null;
  floorJoistNote: string | null;
  roofMaterialNote: string;
  plywoodThreeQuarterSheetCount: number;
  plywoodHalfSheetCount: number;
  strawBaleNote: string | null;
  /** Project-wide fastener counts by type (Tommy: "flesh out the fasteners
   * section to include the amount of 2in sheathing nails, #9 T25 screws,
   * 4in 5/16in GRK's, and 6in 5/16in GRK's") — one row per real fastener
   * type computeFastenerWeight/computeJackStudFastenerWeight can produce,
   * summed across every real placed panel/jack-stud in the project. Labels
   * are the raw calc-engine ones (see fastenerDisplayLabel below for the
   * user-facing translation). */
  fastenerItems: { label: string; count: number; totalWeightLb: number }[];
  fastenerTotalWeightLb: number;
  /** Panel types with no member geometry yet (gable/jack-stud preview-only
   * types) — same "honest gap" callout fastenerTotals already surfaced. */
  fastenerUnmodeledLabels: string[];
  plasterNote: string | null;
}

/** Translates computeFastenerWeight/computeJackStudFastenerWeight's own
 * technical labels into Tommy's terminology for this summary table — a
 * presentation-only mapping (the calc-engine labels themselves stay
 * unchanged, since they're also shown verbatim elsewhere, e.g. the
 * door/window RO detail notes). Falls back to the raw label for anything
 * not in this list, so a future new fastener type still shows up rather
 * than disappearing silently. */
const FASTENER_DISPLAY_LABELS: Record<string, string> = {
  "2in plywood nail (4in o.c., plates + girts)": "2in Sheathing Nails (plates + girts, 4in o.c.)",
  "3in GRK screw (girt bars, 8 each)": "3in 5/16in GRK Screws (girt bars)",
  "4in GRK screw (skins/girt webs, 8 each)": "4in 5/16in GRK Screws (skins/girt webs)",
  "6in GRK screw (braced-panel brace members, 4 each)": "6in 5/16in GRK Screws (braced-panel braces)",
  "4in T25 #9 screw (6in o.c. rows, 2 each)": "#9 T25 Screws, 4in (jack studs, 6in o.c.)",
};
function fastenerDisplayLabel(label: string): string {
  return FASTENER_DISPLAY_LABELS[label] ?? label;
}

/**
 * The first page in the document sequence (Tommy: "the first page is the
 * project summary page with all the totals for cost, all materials... and
 * a static 3d rendering image from a SE birdseye view"). Consolidates every
 * existing Project Totals row plus the rollups that were previously
 * computed somewhere but never surfaced as a single project-wide total
 * (foundation concrete, floor joist count, roof material weight, plywood
 * sheets, straw bales, fastener weight) — see page.tsx's plywoodAreaSqFt/
 * fastenerTotals/etc. for where each number comes from.
 */
export default function ProjectSummaryPage({
  role,
  renderImageDataUrl,
  panelsTotal,
  panelsNote,
  openingsNote,
  totalWeightLb,
  totalWeightKg,
  weightNote,
  price,
  priceNote,
  carbonSequesteredLb,
  carbonSequesteredKg,
  netCO2eKg,
  netCO2eNote,
  strawMoistWeightLb,
  strawMoistureContentPct,
  strawDryWeightLb,
  strawCarbonFractionPct,
  strawCarbonLb,
  strawCO2eLb,
  strawCO2eKg,
  co2eEquivalentMilesDriven,
  co2eEquivalentLbCoalBurned,
  co2eEquivalentSmartphonesCharged,
  estimatedBearingLb,
  estimatedShearLb,
  permeanceLabel,
  vaporCheckLabel,
  vaporCheckPasses,
  foundationConcreteNote,
  floorJoistNote,
  roofMaterialNote,
  plywoodThreeQuarterSheetCount,
  plywoodHalfSheetCount,
  strawBaleNote,
  fastenerItems,
  fastenerTotalWeightLb,
  fastenerUnmodeledLabels,
  plasterNote,
}: ProjectSummaryPageProps) {
  return (
    <SheetTitleBlock title="Project Summary" description="Whole-project totals, materials, and a static rendering." role={role}>
      <div className={styles.diagram}>
        {renderImageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={renderImageDataUrl}
            alt="Static SE bird's-eye rendering of the building"
            style={{ width: "100%", height: "auto", alignSelf: "flex-start", display: "block" }}
          />
        ) : (
          <p className={styles.note}>Draw a footprint to generate the static rendering.</p>
        )}
      </div>

      <h4 className={styles.sectionHeading}>Project totals</h4>
      <table className={styles.fastenerTable}>
        <tbody>
          <tr>
            <td>Panels</td>
            <td>
              {panelsTotal}
              <br />
              <span className={styles.note}>{panelsNote}</span>
            </td>
          </tr>
          <tr>
            <td>Openings</td>
            <td>{openingsNote}</td>
          </tr>
          <tr>
            <td>Total weight</td>
            <td>
              {totalWeightLb.toFixed(1)} lb ({totalWeightKg.toFixed(1)} kg)
              <br />
              <span className={styles.note}>{weightNote}</span>
            </td>
          </tr>
          <tr>
            <td>Price</td>
            <td>
              ${price.toFixed(2)}
              <br />
              <span className={styles.note}>{priceNote}</span>
            </td>
          </tr>
          <tr>
            <td>Carbon sequestered</td>
            <td>
              {carbonSequesteredLb.toFixed(1)} lb ({carbonSequesteredKg.toFixed(1)} kg)
            </td>
          </tr>
          <tr>
            <td>Net embodied carbon (CO2e)</td>
            <td>
              {netCO2eKg >= 0 ? "+" : ""}
              {netCO2eKg.toFixed(1)} kg CO2e
              <br />
              <span className={styles.note}>{netCO2eNote}</span>
            </td>
          </tr>
          <tr>
            <td>Estimated total bearing capacity</td>
            <td>~{Math.round(estimatedBearingLb).toLocaleString()} lb</td>
          </tr>
          <tr>
            <td>Estimated total shear capacity</td>
            <td>~{Math.round(estimatedShearLb).toLocaleString()} lb</td>
          </tr>
          <tr>
            <td>Assembly permeance</td>
            <td>{permeanceLabel}</td>
          </tr>
          <tr>
            <td>Vapor-openness rule</td>
            <td className={vaporCheckPasses === false ? styles.pendingCell : undefined}>{vaporCheckLabel}</td>
          </tr>
        </tbody>
      </table>

      <h4 className={styles.sectionHeading}>Carbon Sequestered</h4>
      <table className={styles.fastenerTable}>
        <tbody>
          <tr>
            <td>Straw weight (moist, as-built)</td>
            <td>{strawMoistWeightLb.toFixed(1)} lb</td>
          </tr>
          <tr>
            <td>Moisture content (standard)</td>
            <td>{strawMoistureContentPct.toFixed(0)}%</td>
          </tr>
          <tr>
            <td>Dry weight</td>
            <td>
              {strawMoistWeightLb.toFixed(1)} lb x (1 &minus; {strawMoistureContentPct.toFixed(0)}%) = {strawDryWeightLb.toFixed(1)} lb
            </td>
          </tr>
          <tr>
            <td>Carbon fraction of dry mass</td>
            <td>{strawCarbonFractionPct.toFixed(0)}%</td>
          </tr>
          <tr>
            <td>Carbon sequestered</td>
            <td>
              {strawDryWeightLb.toFixed(1)} lb x {strawCarbonFractionPct.toFixed(0)}% = {strawCarbonLb.toFixed(1)} lb carbon
            </td>
          </tr>
          <tr>
            <td>Converted to CO2e</td>
            <td>
              {strawCarbonLb.toFixed(1)} lb carbon x 44/12 (CO2/C molar mass ratio) ={" "}
              <strong>
                {strawCO2eLb.toFixed(1)} lb CO2e ({strawCO2eKg.toFixed(1)} kg)
              </strong>
            </td>
          </tr>
          <tr>
            <td>Equivalent to</td>
            <td>
              ~{Math.round(co2eEquivalentMilesDriven).toLocaleString()} miles driven by an average gas car
              <br />
              ~{Math.round(co2eEquivalentLbCoalBurned).toLocaleString()} lb of coal burned
              <br />~{Math.round(co2eEquivalentSmartphonesCharged).toLocaleString()} smartphones charged
              <br />
              <span className={styles.note}>
                Equivalency factors: EPA Greenhouse Gas Equivalencies Calculator (epa.gov/energy/greenhouse-gas-equivalencies-calculator),
                national-average reference data.
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <h4 className={styles.sectionHeading}>Materials</h4>
      <table className={styles.fastenerTable}>
        <tbody>
          <tr>
            <td>3/4in plywood</td>
            <td>{plywoodThreeQuarterSheetCount} sheets (4ft x 8ft)</td>
          </tr>
          <tr>
            <td>1/2in plywood (girt webs)</td>
            <td>{plywoodHalfSheetCount} sheets (4ft x 8ft)</td>
          </tr>
          {strawBaleNote && (
            <tr>
              <td>Straw bales</td>
              <td>{strawBaleNote}</td>
            </tr>
          )}
          {foundationConcreteNote && (
            <tr>
              <td>Foundation concrete</td>
              <td>{foundationConcreteNote}</td>
            </tr>
          )}
          {floorJoistNote && (
            <tr>
              <td>Floor joists</td>
              <td>{floorJoistNote}</td>
            </tr>
          )}
          <tr>
            <td>Roof-bearing insulation</td>
            <td>{roofMaterialNote}</td>
          </tr>
          {plasterNote && (
            <tr>
              <td>Plaster finish</td>
              <td className={styles.pendingCell}>{plasterNote}</td>
            </tr>
          )}
        </tbody>
      </table>

      <h4 className={styles.sectionHeading}>Fasteners</h4>
      {fastenerItems.length === 0 ? (
        <p className={styles.pendingCell}>No fasteners modeled yet for any placed panel.</p>
      ) : (
        <table className={styles.fastenerTable}>
          <thead>
            <tr>
              <th>Fastener</th>
              <th>Qty</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {fastenerItems.map((item) => (
              <tr key={item.label}>
                <td>{fastenerDisplayLabel(item.label)}</td>
                <td>{item.count.toLocaleString()}</td>
                <td>{item.totalWeightLb.toFixed(1)} lb</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td />
              <td>
                <strong>{fastenerTotalWeightLb.toFixed(1)} lb</strong>
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {fastenerUnmodeledLabels.length > 0 && (
        <p className={styles.pendingCell}>Not yet modeled for: {fastenerUnmodeledLabels.join(", ")}</p>
      )}
    </SheetTitleBlock>
  );
}
