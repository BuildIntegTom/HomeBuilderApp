import type {
  CatalogValue,
  FastenerSpacingRow,
  PanelTypeDef,
  WallAssemblyLayer,
} from "./types";

// --- Panel geometry --------------------------------------------------------

export const squareBalePanel = {
  widthIn: 39,
  thicknessIn: 14,
  status: "confirmed" as const,
  note: "Two 18\" bales + two 1.5\" studs, width/thickness locked together. Reference/layout mode only, not fabricated to anymore.",
};

export const looseDensePackWidthIn: CatalogValue<number> = {
  value: 40,
  status: "confirmed",
  note: "40\" (Tommy) — updated default; panel sizes are meant to stay adjustable on the back end since this is still an engineering work in progress. NOTE: Panel Set 1's wood BOM (bottom/top plates, studs, girts) is dimensioned specifically for the 48\" panel, so computeStandardPanelWoodWeight() won't be exactly accurate for a 40\" panel until the BOM is made parametric to width — flagged in the Review Log.",
};

export const standardPanelHeightIn: CatalogValue<number> = {
  value: 120,
  status: "confirmed",
  note: "10'-0\" (120\"), per Panel Set 1 standard panel spec (Tommy): 118.5\" stud + 0.75\" top skin + 0.75\" bottom skin. Supersedes the earlier UI-only 8ft wall-height default.",
};

export const looseDensePackThicknessOptionsIn: number[] = [14, 15.5, 15.75];

export const looseDensePackDefaultThicknessIn: CatalogValue<number> = {
  value: 15.5,
  status: "pending-BI-confirmation",
  note: "15.5\" (14\" + one 2x4) is the temp. standard; 15.75\" matches 400mm exactly (a comparable European straw-panel producer's module) and divides a 4' sheet into 3 clean strips with zero waste. All three are legitimate, selectable options.",
};

export const cornerPanelWidthIn: CatalogValue<number> = {
  value: 24,
  status: "confirmed",
  note: "Corner panel width (Tommy).",
};

// --- Standard panel BOM (Panel Set 1, Tommy) ---------------------------------
// Applies to standard and braced panels (braced = standard panel with bracing
// carved in after fabrication — identical wood BOM). Corner and safety-gap
// panels don't have a BOM yet, so their wood contribution stays unmodeled.

export const standardPanelBom = {
  status: "confirmed" as const,
  note: "Panel Set 1 standard panel: 48\" wide x 120\" tall x 15.5\" deep. Formal Braced Panel spec write-up still pending next round, but this BOM and the placement rules were given directly.",
  bottomPlateSkin: { qty: 1, thicknessIn: 0.75, widthIn: 15.5, lengthIn: 48, material: "plywood" as const },
  bottomPlate2x4s: { qty: 2, lengthIn: 45, material: "lumber" as const },
  topPlateAssembly: { qty: 1, note: "Identical to bottom plate assembly (1 skin + 2x 2x4s), installed inverted." },
  studs: { qty: 4, lengthIn: 118.5, material: "lumber" as const },
  girts: {
    qty: 2,
    block: { lengthIn: 15.5, material: "lumber" as const },
    web: { thicknessIn: 0.5, widthIn: 8.75, lengthIn: 46, material: "plywood" as const },
  },
  nailer: {
    qty: 1,
    optional: true,
    thicknessIn: 1.5,
    widthIn: 3.5,
    lengthIn: 115.5,
    material: "lumber" as const,
    note: "\"With nailer\" vs \"bare standard\" — optional per Tommy's decisions log.",
  },
};

/** The panel width the BOM above is actually dimensioned for — compare against the selected standard width to know if the wood-weight calc is exact or approximate. */
export const standardPanelBomReferenceWidthIn = 48;

export const bomWidthMismatchWarning = {
  status: "pending-BI-confirmation" as const,
  note: `Selected standard width differs from Panel Set 1's reference width (${standardPanelBomReferenceWidthIn}in) that the wood BOM (plates, studs, girts) is actually dimensioned for — wood weight is an approximation at this width until the BOM is made parametric to panel width.`,
};

export const referenceDensities = {
  plywoodLbFt3: { value: 36, status: "confirmed" as const, note: "Plywood/OSB reference density." },
  framingLumberLbFt3: {
    value: 30,
    status: "pending-BI-confirmation" as const,
    note: "Midpoint of spec's given range (25-35 lb/ft3 @ 10% moisture) — no single confirmed value, so the calc uses the midpoint for this specific number while the BOM geometry itself is confirmed.",
  },
};

// --- Seismic bracing (Tommy) --------------------------------------------------

export type SeismicZone = "high" | "moderate" | "low";

export const seismicBracedPanelSpacingFt: Record<SeismicZone, number> = {
  high: 8,
  moderate: 12,
  low: 16,
};

export const seismicBracedPanelSpacingStatus = {
  status: "confirmed" as const,
  note: "High seismic = 8ft, moderate = 12ft, low = 16ft (Tommy) — replaces the spec's generic 4/8/12/16ft list with a concrete zone mapping.",
};

// --- Windows -------------------------------------------------------------------

export const standardWindowWidthsIn: CatalogValue<number[]> = {
  value: [24, 30, 36, 48, 60, 72],
  status: "pending-BI-confirmation",
  note: "Common construction window widths — not spec-given or Building-Integrity-sourced yet.",
};

// --- Foundation type ------------------------------------------------------------

export interface FoundationTypeDef {
  id: "crawlspace" | "slab" | "basement" | "root-cellar";
  label: string;
  vaporNote: string;
  status: "confirmed" | "pending-BI-confirmation";
}

export const foundationTypes: FoundationTypeDef[] = [
  {
    id: "crawlspace",
    label: "Vented crawlspace (helical screw piers)",
    vaporNote: "Floor is more vapor-open on the bottom (Mento-type layer) — full load path: helical pier -> wood beam -> floor panel -> toe-up -> wall panel bottom plate.",
    status: "confirmed",
  },
  {
    id: "slab",
    label: "Thermally broken slab",
    vaporNote: "Vapor logic not yet defined for this foundation type.",
    status: "pending-BI-confirmation",
  },
  {
    id: "basement",
    label: "Unvented basement",
    vaporNote: "Vapor logic not yet defined for this foundation type.",
    status: "pending-BI-confirmation",
  },
  {
    id: "root-cellar",
    label: "Root cellar",
    vaporNote: "Vapor logic not yet defined for this foundation type.",
    status: "pending-BI-confirmation",
  },
];

// --- Density ----------------------------------------------------------------

export const targetDensityKgM3: CatalogValue<number> = {
  value: 112.13,
  status: "confirmed",
  note: "7 lb/ft3 (Tommy) — supersedes the earlier ~4.7 lb/ft3 (75 kg/m3) literature-derived starting point. General optimal range 70-120 kg/m3; floor ~50 (collapse risk); ceiling ~150 (impractical, thermal falloff). A comparable European straw-panel producer's own WUFI reports model at 100 kg/m3.",
};

export const densityRangeKgM3 = {
  min: 70,
  max: 120,
  collapseFloor: 50,
  impracticalCeiling: 150,
  status: "confirmed" as const,
  note: "General optimal range and hard floor/ceiling from spec's density discussion.",
};

export const strawCoreVdrf: CatalogValue<number> = {
  value: 1.3,
  status: "confirmed",
  note: "Comparable producer's WUFI reports — confirms straw is non-limiting for vapor calcs.",
};

// --- Price -------------------------------------------------------------------

export const priceRates = {
  standardPerSqFt: 28,
  cornerPerSqFt: 36,
  bracedPerSqFt: 32,
  headerSillPerSqFt: 36,
  columnPerSqFt: 36,
  roofPerSqFt: 42,
  totalModifier: 1.3,
  status: "confirmed" as const,
  note: "Based on biggest face; total = sum(area x rate-by-type) x 1.3 modifier. Corner/braced/header-sill rates (Tommy) price each panel by its own type instead of one user-selected rate for the whole project.",
};

// --- Panel type roster --------------------------------------------------------

export const panelTypes: PanelTypeDef[] = [
  { id: "standard", label: "Standard", description: "Baseline wall panel." },
  { id: "corner", label: "Corner", description: "Corner connection panel." },
  {
    id: "column",
    label: "Column",
    description:
      "Reinforced/plywood-sided, for >12' runs needing beam bearing under roof panels; not needed under trusses.",
  },
  {
    id: "braced",
    label: "Braced Panel",
    description:
      "Standard-width panel with diagonal bracing carved into the finished compressed panel afterward (formerly called \"carrot panel\", deprecated in Panel Set 1). One braced panel touches each corner panel on every wall; additional braced panels are added along the run per seismic zone (high=8ft/moderate=12ft/low=16ft, Tommy). No longer flanks window openings (Tommy).",
  },
  { id: "header", label: "Header (Lintel)", description: "Above-opening beam-bearing panel." },
  { id: "sill", label: "Sill", description: "Below-opening panel." },
  { id: "inclined-gable", label: "Inclined / Gable", description: "Roof-slope panel." },
  {
    id: "safety-gap",
    label: "Safety / Gap Panel",
    description:
      "Dimensional-tolerance absorption panel: standard width minus 3/4\", plus 1/2\" plywood on one face, held back 1 1/4\" from top/bottom (full-height); placed farthest from the site's least-accessible side. Applies to roof panels too.",
  },
];

export const safetyGapPanelRules = {
  widthReductionIn: 0.75,
  plywoodThicknessIn: 0.5,
  plywoodHoldbackIn: 1.25,
  status: "confirmed" as const,
  note: "Fabrication detail (skin/holdback), not tiling width: plus 1/2\" plywood on one face, held back 1 1/4\" from top and bottom (full-height panels); sill panels hold back from bottom only; header panels hold back from top only. widthReductionIn is no longer used to size the gap panel — superseded by Tommy's variable-sizing rule (tileWall derives the gap width from actual leftover wall space instead of a fixed standard-width-minus-3/4\" formula).",
};

// --- Fasteners -----------------------------------------------------------------

export const fastenerSpacingTable: FastenerSpacingRow[] = [
  {
    connection: "Jack stud to panel",
    fastener: "GRK 5/16\"x4\" star drive washer head",
    spacing: "24\" o.c., interior & exterior",
  },
  {
    connection: "Panel to panel, interior",
    fastener: "GRK 5/16\"x4\" star drive washer head",
    spacing: "24\" o.c., staggered \"stitching\"/zipper pattern",
  },
  {
    connection: "Panel to panel, exterior",
    fastener: "GRK 5/16\"x4\" star drive washer head",
    spacing: "16\" o.c., staggered",
    note: "Building Integrity's resolved value — NFW's own two source docs conflicted at 6\" vs 18\".",
  },
  {
    connection: "Corner connection",
    fastener: "GRK 5/16\"x5 1/8\" star drive washer head",
    spacing: "18\" o.c., 45deg toe screw; paired at cross piece, 1\" edge distance, 1 1/2\" between pair",
  },
  {
    connection: "Pier to beam",
    fastener: "(4) Simpson SDS 1/4\"x4 1/2\"",
    spacing: "4 per connection",
  },
  {
    connection: "Floor panel to beam",
    fastener: "GRK 3/8\"x7 1/4\" or 8\" RSS",
    spacing: "12\" o.c., 45deg toe screw",
  },
  {
    connection: "Toe-up to floor panel",
    fastener: "16d nails",
    spacing: "12\" o.c. interior, 6\" o.c. exterior",
  },
  {
    connection: "Wall panel to toe-up",
    fastener: "GRK 5/16\"x5 1/8\" star drive washer head",
    spacing: "18\" o.c., 45deg toe screw, min. 3 per panel at exterior",
  },
];

export const fastenerTableStatus = {
  status: "pending-BI-confirmation" as const,
  note: "All values are NFW reference points — confirm against Building Integrity's own engineering before treating as final.",
};

// --- Wall assembly layers (vapor permeability) -----------------------------------

export const wallAssemblyLayers: WallAssemblyLayer[] = [
  {
    id: "clay-plaster",
    side: "interior",
    label: "Clay plaster direct-on-straw (paper + lath)",
    permWinter: null,
    permSummer: null,
    status: "pending-BI-confirmation",
    note: "No numeric perm rating given in spec yet.",
  },
  {
    id: "intello-plus",
    side: "interior",
    label: "Intello Plus (+ furring + drywall)",
    permWinter: 0.13,
    permSummer: 13.2,
    status: "confirmed",
    note: "Variable, 0.13-13.2 perm depending on season/RH.",
  },
  {
    id: "lime-plaster",
    side: "exterior",
    label: "Lime plaster direct-on-straw (paper + lath)",
    permWinter: null,
    permSummer: null,
    status: "pending-BI-confirmation",
    note: "No numeric perm rating given in spec yet.",
  },
  {
    id: "mento",
    side: "exterior",
    label: "Mento (+ furring + siding)",
    permWinter: 38,
    permSummer: 38,
    status: "confirmed",
    note: "Fixed 38 perm.",
  },
  {
    id: "timber-board",
    side: "exterior",
    label: "Timber board (wood-fiber insulation board, continuous thermal break)",
    permWinter: null,
    permSummer: null,
    status: "pending-BI-confirmation",
    note: "No numeric perm rating given in spec yet.",
  },
  {
    id: "plywood-adhero-3000",
    side: "exterior",
    label: "Plywood + Adhero 3000 (+ furring + siding) — needed near openings",
    permWinter: 8,
    permSummer: 8,
    status: "pending-BI-confirmation",
    note: "Adhero 3000 itself is rated 8 perm (fixed); the plywood component has no numeric perm rating in spec, so this assembly's total resistance is not fully modeled.",
  },
];

export const vaporValidationRule = {
  status: "confirmed" as const,
  note: "Flag any assembly where the exterior side isn't more vapor-open (higher perm) than the interior side. Permeability modeled as resistance-in-series: 1/perm_total = sum(1/perm_i), not perm itself.",
};

// --- Open items not yet modeled at all (surfaced directly, not guessed) ----------

export const shearLoadCapacity = {
  status: "pending-BI-confirmation" as const,
  note: "Pending Building Integrity's own pre-engineering numbers. Possibly covered by \"For Baleheads Only\" NDS 2018 (ASD) ClearCalcs doc — still unconfirmed whether that's Building Integrity's own engineering.",
};

// --- Carbon sequestration -------------------------------------------------------

export const carbonFractionOfDryMass: CatalogValue<number> = {
  value: 0.45,
  status: "pending-BI-confirmation",
  note: "~45% is a commonly cited dry-mass carbon content for cereal straw/plant biomass in carbon-accounting literature. This is a general reference figure, not a Building Integrity-sourced number — confirm before treating as final.",
};

export const strawMoistureContent = {
  standard: 0.15,
  min: 0.05,
  max: 0.2,
  status: "confirmed" as const,
  note: "Standard target moisture content 15%, sensitivity range 5-20% (Tommy). Convention: wet-basis — the fraction of the panel's total (as-weighed) straw weight that is water, i.e. dryWeight = moistWeight x (1 - moistureContent).",
};
