import { describe, expect, it } from "vitest";
import { NAMED_PANEL_TYPE_COLORS } from "./panelColors";
import {
  comparePanelSheets,
  contrastWithBlack,
  distinctPanelName,
  panelSheetAccentColor,
  panelSheetFigureLabel,
  panelSheetHeightLabel,
  panelSheetWidthBucket,
  relativeLuminance,
  tintTowardsWhite,
  type PanelSheetIdentity,
} from "./panelSheetIdentity";

const base: PanelSheetIdentity = {
  panelTypeId: "standard",
  panelTypeLabel: "Standard Panel",
  widthIn: 48,
  heightIn: 96,
};

const id = (over: Partial<PanelSheetIdentity>): PanelSheetIdentity => ({ ...base, ...over });
const sortable = (over: Partial<PanelSheetIdentity>, uniqueKey = "k") => ({ identity: id(over), uniqueKey });

describe("panelSheetHeightLabel", () => {
  it("⚠ says 10' where he says 10 ft — a whole foot carries no inches", () => {
    /* *"I would rather see on a shop fabrication sheet. 10 ft super carrot"* —
       `formatFeetInches` would spell this `10'-0"`, which is the figure he is
       replacing, not the one he asked for. */
    expect(panelSheetHeightLabel(120, "imperial")).toBe("10'");
    expect(panelSheetHeightLabel(96, "imperial")).toBe("8'");
  });

  it("keeps the inches when there are any, and the eighths when there are those", () => {
    expect(panelSheetHeightLabel(112, "imperial")).toBe("9'4\"");
    expect(panelSheetHeightLabel(97.5, "imperial")).toBe("8'1½\"");
    /* A gable tile's own rise above the eave can be under a foot. */
    expect(panelSheetHeightLabel(7.25, "imperial")).toBe("7¼\"");
  });

  it("metric falls through to the shared mm formatter", () => {
    expect(panelSheetHeightLabel(96, "metric")).toBe("2438mm");
  });
});

describe("panelSheetFigureLabel", () => {
  it("⚠ names the carrot, which is the whole point of B25", () => {
    /* Both of these read "Standard Panel 48in" today, on two separate
       sheets, and are told apart only by opening them. */
    expect(panelSheetFigureLabel(id({ braceFigure: "super-carrot", bracePairHalf: "left" }))).toBe("Super Carrot (L)");
    expect(panelSheetFigureLabel(id({ braceFigure: "little-carrot", bracePairHalf: "right" }))).toBe("Little Carrot (R)");
    expect(panelSheetFigureLabel(id({ braceFigure: "big-carrot" }))).toBe("Big Carrot");
  });

  it("⚠ the pair HALF is in the name — two mirror images must not share one", () => {
    const left = panelSheetFigureLabel(id({ braceFigure: "super-carrot", bracePairHalf: "left" }));
    const right = panelSheetFigureLabel(id({ braceFigure: "super-carrot", bracePairHalf: "right" }));
    expect(left).not.toBe(right);
  });

  it("falls back to the pattern when the half carries no carrot of its own", () => {
    expect(panelSheetFigureLabel(id({ bracePairPattern: "nailer" }))).toBe("Vertical Nailers");
    expect(panelSheetFigureLabel(id({ bracePairPattern: "braced", bracePairHalf: "left" }))).toBe("Braced Pair (L)");
  });

  it("tells the four braced styles apart, which the document index never did", () => {
    /* The page index said "Braced Panel" for all four; only the sticky note
       and the sheet title knew the difference. */
    const braced = (bracedPattern: "chevron" | "hatch", bracedMirrored: boolean) =>
      panelSheetFigureLabel(id({ panelTypeId: "braced", panelTypeLabel: "Braced Panel", bracedPattern, bracedMirrored }));
    expect([braced("chevron", false), braced("chevron", true), braced("hatch", false), braced("hatch", true)]).toEqual([
      "Chevron Braced",
      "Chevron Braced (Mirrored)",
      "Hatch Forward",
      "Hatch Back",
    ]);
  });

  it("drops a trailing “Panel” and otherwise uses the catalog's own label", () => {
    expect(panelSheetFigureLabel(id({ panelTypeId: "column", panelTypeLabel: "Column Panel" }))).toBe("Column");
    expect(panelSheetFigureLabel(id({ panelTypeId: "gable", panelTypeLabel: "Gable End Panel" }))).toBe("Gable End");
  });
});

describe("distinctPanelName", () => {
  it("⚠ reads the way he asked for it: height, figure, width", () => {
    expect(distinctPanelName(id({ heightIn: 120, braceFigure: "super-carrot" }), "imperial")).toBe("10' Super Carrot 48\"");
    expect(distinctPanelName(id({ heightIn: 96, braceFigure: "little-carrot" }), "imperial")).toBe("8' Little Carrot 48\"");
  });

  it("marks a hand-edited panel, which is its own part under B19", () => {
    expect(distinctPanelName(id({ braceFigure: "super-carrot", isEdited: true }), "imperial")).toBe(
      "8' Super Carrot 48\" (edited)",
    );
  });

  it("⚠ no two differently-grouped panels can end up with the same name", () => {
    /* Every field below is one `groupKeyFor` already splits sheets on, so a
       collision here would mean two separate sheets with one name. */
    const names = [
      id({ braceFigure: "super-carrot", bracePairHalf: "left" }),
      id({ braceFigure: "super-carrot", bracePairHalf: "right" }),
      id({ braceFigure: "little-carrot", bracePairHalf: "left" }),
      id({ braceFigure: "super-carrot", bracePairHalf: "left", widthIn: 24 }),
      id({ braceFigure: "super-carrot", bracePairHalf: "left", heightIn: 120 }),
      id({ braceFigure: "super-carrot", bracePairHalf: "left", isEdited: true }),
      id({ panelTypeId: "braced", panelTypeLabel: "Braced Panel", bracedPattern: "hatch", bracedMirrored: false }),
      id({ panelTypeId: "braced", panelTypeLabel: "Braced Panel", bracedPattern: "hatch", bracedMirrored: true }),
    ].map((i) => distinctPanelName(i, "imperial"));
    expect(new Set(names).size).toBe(names.length);
  });

  it("is derived from the same fields and so cannot go stale", () => {
    /* His *"not from a memory file"* rule, applied to the name: change the
       figure and the name changes with it, with nothing to migrate. */
    const panel = id({ braceFigure: "super-carrot" });
    expect(distinctPanelName(panel, "imperial")).toContain("Super Carrot");
    expect(distinctPanelName({ ...panel, braceFigure: "little-carrot" }, "imperial")).toContain("Little Carrot");
  });
});

describe("⚠ B25 sheet order — 48in and under first, then height, then figure", () => {
  it("puts the whole ≤48in bucket ahead of everything wider, whatever its height", () => {
    /* *"prioritizing all widths 48\" or less, then height, then figure, then
       more than 48\" widths"* — a 10ft 48in panel still precedes a 7ft 72in
       one, because the bucket is the first key. */
    const order = [sortable({ widthIn: 72, heightIn: 84 }, "wide-short"), sortable({ widthIn: 48, heightIn: 120 }, "narrow-tall")]
      .sort(comparePanelSheets)
      .map((s) => s.uniqueKey);
    expect(order).toEqual(["narrow-tall", "wide-short"]);
  });

  it("⚠ 48in itself is in the FIRST bucket — it is the wall module", () => {
    expect([panelSheetWidthBucket(48), panelSheetWidthBucket(48.0000001), panelSheetWidthBucket(48.5)]).toEqual([0, 0, 1]);
  });

  it("sorts by height inside a bucket, shortest first", () => {
    const order = [sortable({ heightIn: 120 }, "tall"), sortable({ heightIn: 84 }, "short"), sortable({ heightIn: 96 }, "mid")]
      .sort(comparePanelSheets)
      .map((s) => s.uniqueKey);
    expect(order).toEqual(["short", "mid", "tall"]);
  });

  it("then by figure, so one height's sheets read as a family", () => {
    const order = [
      sortable({ braceFigure: "super-carrot" }, "super"),
      sortable({ braceFigure: "little-carrot" }, "little"),
      sortable({ braceFigure: "big-carrot" }, "big"),
    ]
      .sort(comparePanelSheets)
      .map((s) => s.uniqueKey);
    expect(order).toEqual(["big", "little", "super"]);
  });

  it("⚠ and last by WIDTH, which is what the pusher head actually cares about", () => {
    /* *"switching the pusher head on the pusher is a step of the process that
       takes time, so minimizing pusher head changes via similar width panels
       with be ideal."* His three keys leave width free; this is the tiebreak
       that honours the reason behind them without disturbing the keys. */
    const order = [
      sortable({ widthIn: 36, braceFigure: "super-carrot" }, "w36"),
      sortable({ widthIn: 12, braceFigure: "super-carrot" }, "w12"),
      sortable({ widthIn: 48, braceFigure: "super-carrot" }, "w48"),
    ]
      .sort(comparePanelSheets)
      .map((s) => s.uniqueKey);
    expect(order).toEqual(["w12", "w36", "w48"]);
  });

  it("⚠ is a TOTAL order — the packet cannot shuffle between two renders", () => {
    const sheets = [sortable({}, "b"), sortable({}, "a"), sortable({}, "c")];
    expect([...sheets].sort(comparePanelSheets).map((s) => s.uniqueKey)).toEqual(["a", "b", "c"]);
    expect(comparePanelSheets(sheets[0]!, sheets[0]!)).toBe(0);
  });

  it("⚠ the type is no longer the primary key — types interleave now", () => {
    /* The order used to be `SHOP_DRAWING_PANEL_TYPES`' hardcoded array first,
       so every Standard sheet preceded every Corner one. Under his rule an
       8ft Corner sits between two 8ft Standards if the figures fall that way.
       Recorded as a test because it is the visible consequence of his
       *"why not just make it easy for the shop"*. */
    const order = [
      sortable({ panelTypeId: "standard", panelTypeLabel: "Standard Panel", braceFigure: "super-carrot" }, "std-super"),
      sortable({ panelTypeId: "corner", panelTypeLabel: "Corner Panel", widthIn: 15.5 }, "corner"),
      sortable({ panelTypeId: "standard", panelTypeLabel: "Standard Panel", braceFigure: "big-carrot" }, "std-big"),
    ]
      .sort(comparePanelSheets)
      .map((s) => s.uniqueKey);
    expect(order).toEqual(["std-big", "corner", "std-super"]);
  });
});

describe("⚠ B25 colour — from panelColors.ts, and legible printed in greyscale", () => {
  it("reuses the plan/legend/right-click colour for every type that has one", () => {
    for (const [namedType, hex] of Object.entries(NAMED_PANEL_TYPE_COLORS)) {
      expect({ namedType, color: panelSheetAccentColor(namedType) }).toEqual({ namedType, color: hex });
    }
  });

  it("⚠ refuses a colour rather than inventing one for a type the plan never draws", () => {
    /* Floor panels, roof panels, truss plate and box beam have no palette
       entry. A default here would be a second palette by the back door. */
    for (const unpainted of ["floor", "roof", "truss-plate", "box-beam", "tilted-gable"]) {
      expect({ unpainted, color: panelSheetAccentColor(unpainted) }).toEqual({ unpainted, color: null });
    }
  });

  it("⚠ every type's band holds black text at better than 7:1, in colour", () => {
    for (const hex of Object.values(NAMED_PANEL_TYPE_COLORS)) {
      const tint = tintTowardsWhite(hex);
      expect({ hex, ok: contrastWithBlack(tint) >= 7 }).toEqual({ hex, ok: true });
    }
  });

  it("⚠ and in GREYSCALE, which is how these sheets get printed", () => {
    /* The tint is the fact that has to survive the printer. Luminance IS the
       greyscale value, so a band that passes on luminance passes on paper —
       0.70 is the floor every band clears: the tightest measured is the
       Safety-Oct-Corner brown at 0.735, which still holds black text at
       15.7:1. Honest about what this check is — WCAG luminance IS the
       greyscale value, so this is the same arithmetic as the test above
       expressed as "the band stays light" rather than as a contrast ratio. */
    for (const hex of Object.values(NAMED_PANEL_TYPE_COLORS)) {
      const luma = relativeLuminance(tintTowardsWhite(hex));
      expect({ hex, light: luma >= 0.7 }).toEqual({ hex, light: true });
    }
  });

  it("⚠ full strength would NOT survive it — which is why the band is tinted", () => {
    /* Measured, not assumed: the braced purple and the door brown both fail
       black text at full strength, so the solid colour is carried by a small
       swatch beside the name and the band itself is the tint. */
    expect(contrastWithBlack(NAMED_PANEL_TYPE_COLORS.braced)).toBeLessThan(7);
    expect(contrastWithBlack(NAMED_PANEL_TYPE_COLORS["safety-oct-corner"])).toBeLessThan(7);
  });

  it("the tint is still the type's own hue, not a wash of grey", () => {
    /* A Braced band must read as the purple he knows from the plan. */
    const tint = tintTowardsWhite(NAMED_PANEL_TYPE_COLORS.braced);
    expect(tint).toBe("#f1e5f5");
    const { r, g, b } = { r: 0xf1, g: 0xe5, b: 0xf5 };
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(8);
  });
});
