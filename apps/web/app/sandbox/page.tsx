"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  computeAssemblyPerm,
  computeCarbonRange,
  computePrice,
  computeStrawWeight,
  toReviewLog,
  validateVaporOpenness,
  type PriceablePanelType,
  type Season,
} from "@building-integrity/calc-engine";
import {
  carbonFractionOfDryMass,
  fastenerTableStatus,
  looseDensePackDefaultThicknessIn,
  looseDensePackThicknessOptionsIn,
  looseDensePackWidthIn,
  shearLoadCapacity,
  squareBalePanel,
  standardPanelHeightIn,
  strawMoistureContent,
  targetDensityKgM3,
  wallAssemblyLayers,
  type ConstructionMethod,
} from "@building-integrity/panel-catalog";
import styles from "./page.module.css";

const interiorLayers = wallAssemblyLayers.filter((l) => l.side === "interior");
const exteriorLayers = wallAssemblyLayers.filter((l) => l.side === "exterior");

const FT_TO_IN = 12;
const LB_FT3_TO_KG_M3 = 16.018463;

export default function PanelCalcSandbox() {
  const [method, setMethod] = useState<ConstructionMethod>("loose-dense-pack");
  const [thicknessIn, setThicknessIn] = useState(looseDensePackDefaultThicknessIn.value);
  const [densityLbFt3, setDensityLbFt3] = useState(
    Math.round((targetDensityKgM3.value / LB_FT3_TO_KG_M3) * 10) / 10,
  );
  const [wallRunLengthFt, setWallRunLengthFt] = useState(20);
  const [wallHeightFt, setWallHeightFt] = useState(standardPanelHeightIn.value / 12);
  const [panelType, setPanelType] = useState<PriceablePanelType>("standard");
  const [interiorId, setInteriorId] = useState(interiorLayers[1]!.id); // Intello Plus
  const [exteriorId, setExteriorId] = useState(exteriorLayers[1]!.id); // Mento
  const [season, setSeason] = useState<Season>("winter");

  const interior = interiorLayers.find((l) => l.id === interiorId)!;
  const exterior = exteriorLayers.find((l) => l.id === exteriorId)!;

  const isSquareBale = method === "square-bale-reference";
  const effectiveThicknessIn = isSquareBale ? squareBalePanel.thicknessIn : thicknessIn;

  const weight = useMemo(
    () =>
      computeStrawWeight(
        wallRunLengthFt * FT_TO_IN,
        effectiveThicknessIn,
        wallHeightFt * FT_TO_IN,
        densityLbFt3 * LB_FT3_TO_KG_M3,
      ),
    [wallRunLengthFt, effectiveThicknessIn, wallHeightFt, densityLbFt3],
  );

  const price = useMemo(
    () =>
      computePrice([
        { type: panelType, areaSqFt: wallRunLengthFt * wallHeightFt },
      ]),
    [panelType, wallRunLengthFt, wallHeightFt],
  );

  const carbonRange = useMemo(
    () =>
      computeCarbonRange(
        weight.weightKg,
        strawMoistureContent,
        carbonFractionOfDryMass.value,
      ),
    [weight.weightKg],
  );

  const permResult = useMemo(
    () => computeAssemblyPerm(interior, exterior, season),
    [interior, exterior, season],
  );
  const vaporCheck = useMemo(
    () => validateVaporOpenness(interior, exterior, season),
    [interior, exterior, season],
  );

  const reviewLog = useMemo(() => {
    const entries = toReviewLog([
      { label: "Target density", ...targetDensityKgM3 },
      ...(isSquareBale
        ? []
        : [
            { label: "Panel width (loose dense-pack)", ...looseDensePackWidthIn },
            { label: "Default panel thickness", ...looseDensePackDefaultThicknessIn },
          ]),
      { ...interior, label: "Interior finish: " + interior.label },
      { ...exterior, label: "Exterior finish: " + exterior.label },
      { label: "Fastener spacing table", ...fastenerTableStatus },
      { label: "Shear / load capacity", ...shearLoadCapacity },
      { label: "Carbon fraction of dry mass", ...carbonFractionOfDryMass },
    ]);
    // de-duplicate identical notes (e.g. fastener table only needs to show once)
    return entries.filter(
      (e, i) => entries.findIndex((o) => o.note === e.note) === i,
    );
  }, [interior, exterior, isSquareBale]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Panel Calculation Sandbox</h1>
        <p className={styles.disclaimer}>
          Reference-only. Not engineered, not fabricator-produced. See Review
          Log below for every unconfirmed value used in this calculation.
        </p>
        <p className={styles.note}>
          <Link href="/">← Back to the layout editor</Link>
        </p>

        <section>
          <h2>Construction</h2>
          <label>
            Method{" "}
            <select
              id="method-select"
              value={method}
              onChange={(e) => setMethod(e.target.value as ConstructionMethod)}
            >
              <option value="loose-dense-pack">Loose Dense-Pack</option>
              <option value="square-bale-reference">
                Square Bale (reference/layout only)
              </option>
            </select>
          </label>
          {isSquareBale && (
            <p className={styles.note}>
              Square bale: width/thickness locked at {squareBalePanel.widthIn}
              &quot; x {squareBalePanel.thicknessIn}&quot;. Reference/layout
              mode only — not fabricated to anymore, calculations below are
              illustrative, not the fully-supported engine.
            </p>
          )}
          {!isSquareBale && (
            <label>
              Thickness (in){" "}
              <select
                id="thickness-select"
                value={thicknessIn}
                onChange={(e) => setThicknessIn(Number(e.target.value))}
              >
                {looseDensePackThicknessOptionsIn.map((t) => (
                  <option key={t} value={t}>
                    {t}&quot;
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Target density (lb/ft3){" "}
            <input
              type="number"
              value={densityLbFt3}
              onChange={(e) => setDensityLbFt3(Number(e.target.value))}
            />
          </label>
        </section>

        <section>
          <h2>Wall run</h2>
          <label>
            Length (ft){" "}
            <input
              type="number"
              value={wallRunLengthFt}
              onChange={(e) => setWallRunLengthFt(Number(e.target.value))}
            />
          </label>
          <label>
            Height (ft){" "}
            <input
              type="number"
              value={wallHeightFt}
              onChange={(e) => setWallHeightFt(Number(e.target.value))}
            />
          </label>
          <p className={styles.note}>
            Default 10ft (120in) is Panel Set 1&apos;s confirmed standard panel
            height.
          </p>
          <label>
            Panel type (pricing){" "}
            <select
              id="panel-type-select"
              value={panelType}
              onChange={(e) => setPanelType(e.target.value as PriceablePanelType)}
            >
              <option value="standard">Standard ($28/sqft)</option>
              <option value="column">Column ($36/sqft)</option>
              <option value="roof">Roof ($42/sqft)</option>
            </select>
          </label>
        </section>

        <section>
          <h2>Wall assembly (vapor check)</h2>
          <label>
            Interior finish{" "}
            <select id="interior-select" value={interiorId} onChange={(e) => setInteriorId(e.target.value)}>
              {interiorLayers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Exterior finish{" "}
            <select id="exterior-select" value={exteriorId} onChange={(e) => setExteriorId(e.target.value)}>
              {exteriorLayers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Season{" "}
            <select id="season-select" value={season} onChange={(e) => setSeason(e.target.value as Season)}>
              <option value="winter">Winter</option>
              <option value="summer">Summer</option>
            </select>
          </label>
        </section>

        <section>
          <h2>Results</h2>
          <table className={styles.results}>
            <tbody>
              <tr>
                <td>Straw-core weight</td>
                <td>
                  {weight.weightLb.toFixed(1)} lb ({weight.weightKg.toFixed(1)} kg)
                  <span className={styles.note}> — wood + fasteners not modeled</span>
                </td>
              </tr>
              <tr>
                <td>Price</td>
                <td>${price.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Carbon sequestered</td>
                <td>
                  {carbonRange.atStandardMoisture.carbonLb.toFixed(1)} lb (
                  {carbonRange.atStandardMoisture.carbonKg.toFixed(1)} kg) @{" "}
                  {(strawMoistureContent.standard * 100).toFixed(0)}% moisture (standard)
                  <br />
                  <span className={styles.note}>
                    Range across {(strawMoistureContent.min * 100).toFixed(0)}%–
                    {(strawMoistureContent.max * 100).toFixed(0)}% moisture:{" "}
                    {carbonRange.atMaxMoisture.carbonLb.toFixed(1)}–
                    {carbonRange.atMinMoisture.carbonLb.toFixed(1)} lb (
                    {carbonRange.atMaxMoisture.carbonKg.toFixed(1)}–
                    {carbonRange.atMinMoisture.carbonKg.toFixed(1)} kg).{" "}
                    <span className={styles.pending}>
                      Uses a {(carbonFractionOfDryMass.value * 100).toFixed(0)}% carbon-of-dry-mass
                      reference figure — see Review Log.
                    </span>
                  </span>
                </td>
              </tr>
              <tr>
                <td>Shear / load capacity</td>
                <td className={styles.pending}>not yet modeled — {shearLoadCapacity.note}</td>
              </tr>
              <tr>
                <td>Assembly permeance ({season})</td>
                <td>
                  {permResult.computable
                    ? `${permResult.permTotal!.toFixed(2)} perm`
                    : "not computable — one or both finishes lack a numeric perm rating"}
                </td>
              </tr>
              <tr>
                <td>Vapor-openness rule</td>
                <td className={vaporCheck.passes === false ? styles.fail : undefined}>
                  {vaporCheck.computable
                    ? vaporCheck.passes
                      ? "PASS — exterior is more vapor-open than interior"
                      : "FAIL — exterior is not more vapor-open than interior"
                    : "not computable — one or both finishes lack a numeric perm rating"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Review Log — Items for Engineer/Contractor Review</h2>
          {reviewLog.length === 0 ? (
            <p>No pending values used in this calculation.</p>
          ) : (
            <ul>
              {reviewLog.map((entry, i) => (
                <li key={i}>
                  <strong>{entry.label}:</strong> {entry.note}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
