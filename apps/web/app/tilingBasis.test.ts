import { describe, expect, it } from "vitest";
import {
  CONTROLS_WITHOUT_A_SETTINGS_ROW,
  TILING_BASIS_CONTROL,
  TILING_BASIS_FIELD_LABELS,
  pendingTilingControls,
  pendingTilingSummary,
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
      tilingBasisDifferences(BASIS, { ...BASIS, thicknessIn: 14, cornerWidthIn: 39 }).sort(),
    ).toEqual(["cornerWidthIn", "thicknessIn"]);
  });

  it("⚠ `bracedSpacingIn` moves and NOTHING is reported — B22, 2026-11-04", () => {
    /* This assertion is the inverse of what the line above used to say, and
       the inversion is the point. The field is still saved and still written,
       because the basis is a file schema and dropping a field is a migration.
       But its last reader — `applyAdditionalRowBracedPattern` — retired with
       the rule, so a Repanelize would no longer move one panel on account of
       it. A caution marker over a change that does nothing teaches a user to
       ignore the markers that mean something. */
    expect(tilingBasisDifferences(BASIS, { ...BASIS, bracedSpacingIn: 144 })).toEqual([]);
    /* ...and it is still WATCHED in the sense that matters: changing it
       alongside a real field does not hide the real one. */
    expect(tilingBasisDifferences(BASIS, { ...BASIS, bracedSpacingIn: 144, thicknessIn: 14 })).toEqual(["thicknessIn"]);
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
    /* ⚠ The walk still covers the WHOLE shape — that is what keeps a newly
       added field from being silently unwatched. What changed in B22 is that
       one field is expected to report nothing rather than itself, and it has
       to be named here to be excused. A second dead field could not slip in
       behind it: it would fail this test until somebody wrote it down. */
    const REPORTS_NOTHING = new Set<TilingBasisField>(["bracedSpacingIn"]);
    for (const field of fields) {
      expect({ field, out: tilingBasisDifferences(BASIS, changed[field]) }).toEqual({
        field,
        out: REPORTS_NOTHING.has(field) ? [] : [field],
      });
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

  it("maps every field to a control, so nothing pending is unreportable", () => {
    for (const field of Object.keys(TILING_BASIS_FIELD_LABELS) as TilingBasisField[]) {
      expect(TILING_BASIS_CONTROL[field]).toBeTruthy();
    }
  });

  it("collapses the two panelization-type fields onto one control", () => {
    // The user changed ONE control; marking two would read as two problems.
    expect([...pendingTilingControls(["cornerWidthIn", "cornerMayWiden"])]).toEqual(["panelization-type"]);
    expect([...pendingTilingControls(["bracedDefaultPattern", "bracedDefaultMirrored"])]).toEqual(["bracing-style"]);
  });

  it("⚠ a field whose control has no Settings row is still named in the summary", () => {
    // The least-accessible corner is clicked on the plan, not set in a field,
    // so there is nothing to hang a marker on. If the summary did not name it
    // the change would be invisible — the exact failure this feature exists
    // to prevent.
    const diffs: TilingBasisField[] = ["leastAccessibleCorner"];
    const control = TILING_BASIS_CONTROL.leastAccessibleCorner;
    expect(CONTROLS_WITHOUT_A_SETTINGS_ROW.has(control)).toBe(true);
    expect(pendingTilingSummary(diffs)).toBe("Least-accessible corner");
  });

  it("the summary names each control once, not each field", () => {
    expect(pendingTilingSummary(["cornerWidthIn", "cornerMayWiden"])).toBe("Panelization type");
    expect(pendingTilingSummary(["standardWidthIn", "thicknessIn"])).toBe("Standard width, Thickness");
    expect(pendingTilingSummary([])).toBeNull();
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
