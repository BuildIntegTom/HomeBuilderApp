"use client";

import type { PlasterCoatInputs, PlasterCoatResult } from "./plasterTypes";

export interface PlasterCoatEditorProps {
  title: string;
  coat: PlasterCoatInputs;
  onThicknessChange: (thicknessIn: number) => void;
  onPartChange: (part: "sand" | "clay" | "lime" | "straw", value: number) => void;
  result: PlasterCoatResult;
}

const MATERIAL_LABELS = { sand: "Sand", clay: "Clay", lime: "Lime", straw: "Chopped Straw" } as const;
const MATERIALS = Object.keys(MATERIAL_LABELS) as (keyof typeof MATERIAL_LABELS)[];

/**
 * One Base or Finish coat's editable mix (thickness + sand/clay/lime/straw
 * "Parts" ratio, matching Tommy's "Faster Plaster Calculator" spreadsheet's
 * own red-outlined input cells) alongside its computed materials (cu ft,
 * buckets, bags, cu yd, 110-gal tubs) and cost — see plasterTypes.ts for
 * the shared calc, and packages/calc-engine/src/plaster.ts for the formulas.
 */
export default function PlasterCoatEditor({ title, coat, onThicknessChange, onPartChange, result }: PlasterCoatEditorProps) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10, marginBottom: 10, width: "100%" }}>
      <p style={{ fontWeight: 700, margin: "0 0 6px" }}>{title}</p>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 13 }}>
        Thickness (in)
        <input
          type="number"
          min="0"
          step="0.0625"
          value={coat.thicknessIn}
          onChange={(e) => onThicknessChange(Number(e.target.value))}
          style={{ width: 64 }}
        />
      </label>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Material</th>
            <th style={{ textAlign: "right" }}>Parts</th>
            <th style={{ textAlign: "right" }}>Cu Ft</th>
            <th style={{ textAlign: "right" }}>Buckets</th>
            <th style={{ textAlign: "right" }}>Bags</th>
            <th style={{ textAlign: "right" }}>Cu Yd</th>
            <th style={{ textAlign: "right" }}>110gal Tub</th>
          </tr>
        </thead>
        <tbody>
          {MATERIALS.map((material) => (
            <tr key={material}>
              <td>{MATERIAL_LABELS[material]}</td>
              <td style={{ textAlign: "right" }}>
                <input
                  type="number"
                  min="0"
                  step="0.05"
                  value={coat.parts[material]}
                  onChange={(e) => onPartChange(material, Number(e.target.value))}
                  style={{ width: 56 }}
                />
              </td>
              <td style={{ textAlign: "right" }}>{result.mixCuFt[material].toFixed(2)}</td>
              <td style={{ textAlign: "right" }}>{result.buckets[material].toFixed(1)}</td>
              <td style={{ textAlign: "right" }}>
                {material === "clay" ? result.bagsClay.toFixed(1) : material === "lime" ? result.bagsLime.toFixed(1) : "—"}
              </td>
              <td style={{ textAlign: "right" }}>{material === "sand" ? result.sandCuYd.toFixed(2) : "—"}</td>
              <td style={{ textAlign: "right" }}>{result.tubs[material].toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 13, margin: "6px 0 0" }}>
        Total: {result.cuFt.toFixed(2)} cu ft — <strong>${result.materialCost.toFixed(2)}</strong> material cost
      </p>
    </div>
  );
}
