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
  fastenerWeightNote: string;
  plasterNote: string | null;
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
  fastenerWeightNote,
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
          <tr>
            <td>Fasteners</td>
            <td>{fastenerWeightNote}</td>
          </tr>
          {plasterNote && (
            <tr>
              <td>Plaster finish</td>
              <td className={styles.pendingCell}>{plasterNote}</td>
            </tr>
          )}
        </tbody>
      </table>
    </SheetTitleBlock>
  );
}
