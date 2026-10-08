import { describe, expect, it } from "vitest";
import {
  TILING_BASIS_FIELD_LABELS,
  tilingBasisDifferences,
  tilingBasisIsCurrent,
  type TilingBasis,
  type TilingBasisField,
} from "./tilingBasis";

const BASIS: TilingBasis = {
  standardWidthIn: 40,
  thicknessIn: 15.5,
  leastAccessibleCorner: "A",
  cornerWidthIn: 25.5,
  cornerMayWiden: true,
  bracedSpacingIn: 192,
  bracedDefaultPattern: "chevron",
  bracedDefaultMirrored: false,
};

describe("tilingBasisDifferences", () => {
  it("reports nothing when the live settings still match", () => {
    expect(tilingBasisDifferences(BASIS, { ...BASIS })).toEqual([]);
    expect(tilingBasisIsCurrent(BASIS, { ...BASIS })).toBe(true);
  });

  it("names exactly the fields that moved", () => {
    expect(tilingBasisDifferences(BASIS, { ...BASIS, standardWidthIn: 48 })).toEqual(["standardWidthIn"]);
    expect(tilingBasisDifferences(BASIS, { ...BASIS, leastAccessibleCorner: "C" })).toEqual(["leastAccessibleCorner"]);
    expect(
      tilingBasisDifferences(BASIS, { ...BASIS, thicknessIn: 14, bracedSpacingIn: 144 }).sort(),
    ).toEqual(["bracedSpacingIn", "thicknessIn"]);
  });

  it("catches a change in EVERY field, so none is silently unwatched", () => {
    // ⚠ Non-vacuity with teeth: a field added to TilingBasis but forgotten in
    // the comparison would make its change invisible, and the user would be
    // told nothing is pending when something is. This walks the whole shape.
    const changed: Record<TilingBasisField, TilingBasis> = {
      standardWidthIn: { ...BASIS, standardWidthIn: 24 },
      thicknessIn: { ...BASIS, thicknessIn: 15.75 },
      leastAccessibleCorner: { ...BASIS, leastAccessibleCorner: "B" },
      cornerWidthIn: { ...BASIS, cornerWidthIn: 39 },
      cornerMayWiden: { ...BASIS, cornerMayWiden: false },
      bracedSpacingIn: { ...BASIS, bracedSpacingIn: 144 },
      bracedDefaultPattern: { ...BASIS, bracedDefaultPattern: "hatch" },
      bracedDefaultMirrored: { ...BASIS, bracedDefaultMirrored: true },
    };
    const fields = Object.keys(TILING_BASIS_FIELD_LABELS) as TilingBasisField[];
    expect(Object.keys(changed).sort()).toEqual([...fields].sort());
    for (const field of fields) {
      expect(tilingBasisDifferences(BASIS, changed[field])).toEqual([field]);
    }
  });

  it("every field has a label, so a marker can always say what is pending", () => {
    for (const field of Object.keys(BASIS) as TilingBasisField[]) {
      expect(TILING_BASIS_FIELD_LABELS[field]).toBeTruthy();
    }
  });

  it("⚠ an absent basis claims nothing rather than claiming everything", () => {
    // Every project saved before R0 has no basis, and so does one with no
    // footprint. Reporting all eight fields as pending would be substituting
    // a value for a gap — the app's standing rule is the opposite.
    expect(tilingBasisDifferences(null, { ...BASIS, standardWidthIn: 48 })).toEqual([]);
    expect(tilingBasisDifferences(undefined, { ...BASIS, standardWidthIn: 48 })).toEqual([]);
    expect(tilingBasisIsCurrent(null, BASIS)).toBe("unknown");
    expect(tilingBasisIsCurrent(undefined, BASIS)).toBe("unknown");
  });

  it("does not raise a marker for a float artefact in a derived value", () => {
    // bracedSpacingIn is `seismicBracedPanelSpacingFt[zone] * 12`, so it can
    // come back as 191.99999999999997. Telling the user to repanelize for
    // that would be a lie about a change nobody made.
    expect(tilingBasisDifferences(BASIS, { ...BASIS, bracedSpacingIn: 192 - 1e-12 })).toEqual([]);
    // But a real eighth-inch difference is still a difference.
    expect(tilingBasisDifferences(BASIS, { ...BASIS, standardWidthIn: 40.125 })).toEqual(["standardWidthIn"]);
  });
});
