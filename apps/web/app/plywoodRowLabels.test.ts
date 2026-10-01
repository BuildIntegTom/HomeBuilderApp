import { describe, expect, it } from "vitest";
import { GIRT_WEB_PLY_SPEC, SKIN_PLY_SPEC } from "@building-integrity/panel-catalog";
import { PLYWOOD_HALF_ROW_LABEL, PLYWOOD_THREE_QUARTER_ROW_LABEL } from "./plywoodRowLabels";

describe("the two plywood Material Totals / Project Summary row labels", () => {
  it("names the real CDX spec, ply count included, on BOTH rows", () => {
    expect(PLYWOOD_THREE_QUARTER_ROW_LABEL).toContain("3/4in 5-ply CDX");
    expect(PLYWOOD_HALF_ROW_LABEL).toContain("1/2in 3-ply CDX");
    for (const label of [PLYWOOD_THREE_QUARTER_ROW_LABEL, PLYWOOD_HALF_ROW_LABEL]) {
      expect(label).toContain("CDX");
    }
  });

  it("derives those specs from the catalog's own plySpec strings rather than restating them", () => {
    // If someone changes either spec in panel-catalog, the row follows. A
    // hard-coded label is exactly the drift this module exists to prevent.
    expect(SKIN_PLY_SPEC).toBe("3/4in_5ply_CDX");
    expect(GIRT_WEB_PLY_SPEC).toBe("1/2in_3ply_CDX");
  });

  it("stops the 1/2in row claiming to be only girt webs, now that short-run safety gaps are in it", () => {
    expect(PLYWOOD_HALF_ROW_LABEL).toContain("girt webs");
    expect(PLYWOOD_HALF_ROW_LABEL).toContain("safety gaps");
    // The old label, which is now a false statement about the contents.
    expect(PLYWOOD_HALF_ROW_LABEL).not.toBe("1/2in plywood (girt webs)");
  });

  it("names the long-run safety gap on the 3/4in row too, so the pair reads as a split", () => {
    expect(PLYWOOD_THREE_QUARTER_ROW_LABEL).toContain("long-run safety gaps");
  });
});
