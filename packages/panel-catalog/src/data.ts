import type {
  CatalogStatus,
  CatalogValue,
  FastenerSpacingRow,
  FoundationLoadPathStep,
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
  value: 25.5,
  status: "confirmed",
  note: "24in core + two 3/4in plywood side faces = 25.5in (Tommy: corner panels are built exactly like Column Panels — see columnPanelMembers.ts's COLUMN_TOTAL_WIDTH_IN).",
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

/** Per-pier-product load-bearing capacity — deliberately not a single
 * shared unit: each pier product is rated the way its own industry
 * actually rates it (helical piles: direct axial capacity in lb; ground
 * screws: often rated in kN; concrete piers: soil bearing pressure in psf,
 * applied over the pier's own base area), so comparing across types means
 * comparing the *unit* too, not just the number. */
export interface PierLoadCapacity {
  value: number;
  unit: string;
  status: CatalogStatus;
  note: string;
}

export interface FoundationTypeDef {
  id:
    | "crawlspace"
    | "concrete-pier"
    | "ground-screw"
    | "cinderblock-pier"
    | "rubble-trench-beam"
    | "concrete-block-stem-wall"
    | "slab"
    | "basement"
    | "root-cellar";
  label: string;
  vaporNote: string;
  status: "confirmed" | "pending-BI-confirmation";
  /** Full pier/slab-to-wall-plate load path, in order — empty where not
   * yet defined (mirrors `status`/`vaporNote` for the same foundation). */
  loadPath: FoundationLoadPathStep[];
  /** True for foundation types supported on a grid of discrete piers
   * (spaced per `pierSpacingOptionsFt`, perimeter + interior infill) rather
   * than a continuous footer — helical pile, ground screw, and cast
   * concrete piers all qualify. */
  usesPierGrid: boolean;
  /** Only present for pier-based foundations — see PierLoadCapacity. */
  loadCapacity?: PierLoadCapacity;
}

const crawlspaceLoadPath: FoundationLoadPathStep[] = [
  {
    label: "Helical screw pier",
    description: "Full-clearance vented crawlspace support, driven to depth/torque per site soil report (not modeled here).",
  },
  {
    label: "Pier to beam",
    description: "Wood beam bears on the pier cap.",
    fastenerConnection: "Pier to beam",
  },
  {
    label: "Beam to floor panel",
    description: "Floor panel bears on and fastens to the beam.",
    fastenerConnection: "Floor panel to beam",
  },
  {
    label: "Floor panel to toe-up",
    description: "Toe-up (ext./int. 2x4 with 1.5\" wood fiberboard between, for thermal continuity) fastens to the floor panel edge.",
    fastenerConnection: "Toe-up to floor panel",
  },
  {
    label: "Toe-up to wall panel",
    description: "Wall panel bottom plate fastens to the toe-up, completing the load path into the wall.",
    fastenerConnection: "Wall panel to toe-up",
  },
];

const concretePierLoadPath: FoundationLoadPathStep[] = [
  {
    label: "Concrete pier",
    description: "Cast-in-place (or precast) concrete pier, spaced per the pier grid, sized/depth per site soil report (not modeled here).",
  },
  {
    label: "Pier to beam",
    description: "Wood beam bears on the pier cap.",
    fastenerConnection: "Pier to beam",
  },
  {
    label: "Beam to floor panel",
    description: "Floor panel bears on and fastens to the beam.",
    fastenerConnection: "Floor panel to beam",
  },
  {
    label: "Floor panel to toe-up",
    description: "Toe-up (ext./int. 2x4 with 1.5\" wood fiberboard between, for thermal continuity) fastens to the floor panel edge.",
    fastenerConnection: "Toe-up to floor panel",
  },
  {
    label: "Toe-up to wall panel",
    description: "Wall panel bottom plate fastens to the toe-up, completing the load path into the wall.",
    fastenerConnection: "Wall panel to toe-up",
  },
];

const groundScrewLoadPath: FoundationLoadPathStep[] = [
  {
    label: "Ground screw",
    description: "Direct-drive ground screw (single large helix near the tip, no pre-drilling) — lighter-duty than a multi-helix helical pile, spaced per the pier grid, sized/depth per site soil report (not modeled here).",
  },
  {
    label: "Pier to beam",
    description: "Wood beam bears on the ground screw's bracket/cap.",
    fastenerConnection: "Pier to beam",
  },
  {
    label: "Beam to floor panel",
    description: "Floor panel bears on and fastens to the beam.",
    fastenerConnection: "Floor panel to beam",
  },
  {
    label: "Floor panel to toe-up",
    description: "Toe-up (ext./int. 2x4 with 1.5\" wood fiberboard between, for thermal continuity) fastens to the floor panel edge.",
    fastenerConnection: "Toe-up to floor panel",
  },
  {
    label: "Toe-up to wall panel",
    description: "Wall panel bottom plate fastens to the toe-up, completing the load path into the wall.",
    fastenerConnection: "Wall panel to toe-up",
  },
];

const cinderblockPierLoadPath: FoundationLoadPathStep[] = [
  {
    label: "Cinderblock pier",
    description: "Stacked CMU (concrete masonry unit) blocks, mortared and capped, spaced per the pier grid, sized/depth per site soil report (not modeled here).",
  },
  {
    label: "Pier to beam",
    description: "Wood beam bears on the pier cap.",
    fastenerConnection: "Pier to beam",
  },
  {
    label: "Beam to floor panel",
    description: "Floor panel bears on and fastens to the beam.",
    fastenerConnection: "Floor panel to beam",
  },
  {
    label: "Floor panel to toe-up",
    description: "Toe-up (ext./int. 2x4 with 1.5\" wood fiberboard between, for thermal continuity) fastens to the floor panel edge.",
    fastenerConnection: "Toe-up to floor panel",
  },
  {
    label: "Toe-up to wall panel",
    description: "Wall panel bottom plate fastens to the toe-up, completing the load path into the wall.",
    fastenerConnection: "Wall panel to toe-up",
  },
];

const rubbleTrenchBeamLoadPath: FoundationLoadPathStep[] = [
  {
    label: "Rubble trench",
    description: "Continuous trench, dug to frost depth, filled with drainage stone/rubble — depth/width per site soil report and frost line (not modeled here).",
  },
  {
    label: "Grade beam",
    description: "Continuous concrete grade beam poured on top of the trench, spanning its full length.",
  },
  {
    label: "Beam to floor panel",
    description: "Floor panel bears on and fastens to the grade beam.",
    fastenerConnection: "Floor panel to beam",
  },
  {
    label: "Floor panel to toe-up",
    description: "Toe-up (ext./int. 2x4 with 1.5\" wood fiberboard between, for thermal continuity) fastens to the floor panel edge.",
    fastenerConnection: "Toe-up to floor panel",
  },
  {
    label: "Toe-up to wall panel",
    description: "Wall panel bottom plate fastens to the toe-up, completing the load path into the wall.",
    fastenerConnection: "Wall panel to toe-up",
  },
];

const concreteBlockStemWallLoadPath: FoundationLoadPathStep[] = [
  {
    label: "Footer",
    description: "Continuous concrete footer, sized per site soil report (not modeled here), bears the stem wall.",
  },
  {
    label: "CMU stem wall",
    description: "Stacked, mortared CMU (concrete masonry unit) blocks rise from the footer to grade — a masonry alternative to a poured-concrete stem wall.",
  },
  {
    label: "Sill plate",
    description: "Sill plate anchored to the top of the stem wall.",
  },
  {
    label: "Sill plate to floor panel",
    description: "Floor panel bears on and fastens to the sill plate.",
    fastenerConnection: "Floor panel to beam",
  },
  {
    label: "Floor panel to toe-up",
    description: "Toe-up (ext./int. 2x4 with 1.5\" wood fiberboard between, for thermal continuity) fastens to the floor panel edge.",
    fastenerConnection: "Toe-up to floor panel",
  },
  {
    label: "Toe-up to wall panel",
    description: "Wall panel bottom plate fastens to the toe-up, completing the load path into the wall.",
    fastenerConnection: "Wall panel to toe-up",
  },
];

const slabLoadPath: FoundationLoadPathStep[] = [
  {
    label: "Footer",
    description: "9\" deep x 3'-0\" wide continuous concrete footer, bears the stem wall.",
  },
  {
    label: "Stem wall",
    description: "10\" thick concrete stem wall rises from the footer to grade.",
  },
  {
    label: "Thermal shelf (lip)",
    description: "6\" down from the top of the stem wall, the wall steps in 4\" horizontally, forming a shelf that carries the slab edge.",
  },
  {
    label: "EPS foam thermal break",
    description: "2\" EPS foam runs down the stem wall's exposed upper 6\" face, then turns to run horizontally across the shelf — isolating the slab from the stem wall on both the side and the bottom.",
  },
  {
    label: "Slab",
    description: "Poured on top of the foam. Because the shelf sits only 6\" below the stem wall's top edge while the foam plus slab together are thicker than that, the slab's top surface ends up above the stem wall's top.",
  },
];

export const foundationTypes: FoundationTypeDef[] = [
  {
    id: "crawlspace",
    label: "Vented crawlspace (helical pile)",
    vaporNote: "Floor is more vapor-open on the bottom (Mento-type layer) — full load path: helical pier -> wood beam -> floor panel -> toe-up -> wall panel bottom plate.",
    status: "confirmed",
    loadPath: crawlspaceLoadPath,
    usesPierGrid: true,
    loadCapacity: {
      value: 12000,
      unit: "lb (axial compression, per pile)",
      status: "pending-BI-confirmation",
      note: "Placeholder mid-range figure for a multi-helix residential helical pile (industry range ~4,000-30,000 lb depending on helix count/soil) — needs Building Integrity's own product spec + site soil report.",
    },
  },
  {
    id: "concrete-pier",
    label: "Concrete Pier (Poured Column)",
    vaporNote: "Same vapor logic as the helical-pier crawlspace (vented, more vapor-open on the bottom) — only the pier material/install method differs.",
    status: "pending-BI-confirmation",
    loadPath: concretePierLoadPath,
    usesPierGrid: true,
    loadCapacity: {
      value: 1500,
      unit: "psf (allowable soil bearing pressure, applied over the pier's own base area)",
      status: "pending-BI-confirmation",
      note: "IRC prescriptive default for undocumented/assumed soil (Table R401.4.1) — a real design needs an actual site soil report, not this default.",
    },
  },
  {
    id: "ground-screw",
    label: "Ground screw",
    vaporNote: "Same vapor logic as the helical-pier crawlspace (vented, more vapor-open on the bottom) — only the pier material/install method differs.",
    status: "pending-BI-confirmation",
    loadPath: groundScrewLoadPath,
    usesPierGrid: true,
    loadCapacity: {
      value: 6,
      unit: "kN (ultimate, per screw)",
      status: "pending-BI-confirmation",
      note: "Placeholder mid-range figure for a light-duty direct-drive ground screw (industry range ~2-15 kN ultimate depending on product/soil) — needs Building Integrity's own product spec + site soil report.",
    },
  },
  {
    id: "cinderblock-pier",
    label: "Cinderblock Pier",
    vaporNote: "Same vapor logic as the helical-pier crawlspace (vented, more vapor-open on the bottom) — only the pier material/install method differs.",
    status: "pending-BI-confirmation",
    loadPath: cinderblockPierLoadPath,
    usesPierGrid: true,
    loadCapacity: {
      value: 1500,
      unit: "psf (allowable soil bearing pressure, applied over the pier's own base area)",
      status: "pending-BI-confirmation",
      note: "Treated the same as a poured concrete pier's IRC prescriptive default (Table R401.4.1) pending Building Integrity's own product spec — a real design needs an actual site soil report, not this default.",
    },
  },
  {
    id: "rubble-trench-beam",
    label: "Rubble Trench w/ Beam",
    vaporNote: "Vapor logic not yet defined for this foundation type.",
    status: "pending-BI-confirmation",
    loadPath: rubbleTrenchBeamLoadPath,
    usesPierGrid: false,
  },
  {
    id: "concrete-block-stem-wall",
    label: "Concrete Block Stem Wall",
    vaporNote: "Vapor logic not yet defined for this foundation type.",
    status: "pending-BI-confirmation",
    loadPath: concreteBlockStemWallLoadPath,
    usesPierGrid: false,
  },
  {
    id: "slab",
    label: "Thermally broken slab",
    vaporNote: "Slab is isolated from the stem wall by a continuous wrap of 2\" EPS foam (side + bottom) — see the Detail Guide Page below for the full detail. Full vapor-perm modeling (like the wall assembly's) is still pending.",
    status: "pending-BI-confirmation",
    loadPath: slabLoadPath,
    usesPierGrid: false,
  },
  {
    id: "basement",
    label: "Unvented basement",
    vaporNote: "Vapor logic not yet defined for this foundation type.",
    status: "pending-BI-confirmation",
    loadPath: [],
    usesPierGrid: false,
  },
  {
    id: "root-cellar",
    label: "Root cellar",
    vaporNote: "Vapor logic not yet defined for this foundation type.",
    status: "pending-BI-confirmation",
    loadPath: [],
    usesPierGrid: false,
  },
];

// --- Pier grid spacing ------------------------------------------------------

export const pierSpacingOptionsFt = [6, 8, 10, 12] as const;

export const pierSpacingDefaultFt = 8;

export const pierSpacingStatus = {
  status: "confirmed" as const,
  note: "Pier grid spacing choices (Tommy) — applies to any pier-based foundation (helical or concrete).",
};

// --- Concrete embodied carbon ------------------------------------------------

const KG_M3_TO_KG_FT3 = 1 / 35.3147;

/** Cast concrete pier dimensions used for the embodied-carbon volume calc
 * — a placeholder until real sizing (depends on site soil report and
 * load) is available. */
export const concretePierDimensions = {
  diameterIn: 12,
  depthFt: 4,
  status: "pending-BI-confirmation" as const,
  note: "Placeholder pier size (12in diameter x 4ft depth) for the embodied-carbon calc — actual sizing depends on site soil report and load, not modeled here.",
};

export const concreteEmbodiedCarbonKgPerFt3: CatalogValue<number> = {
  value: 400 * KG_M3_TO_KG_FT3,
  status: "pending-BI-confirmation",
  note: "~400 kg CO2e/m3 for standard ready-mix concrete (common LCA literature range 300-450 kg CO2e/m3, e.g. ICE database), converted to kg CO2e/ft3 — needs Building Integrity's own mix design/supplier EPD before treating as final.",
};

// --- Thermally broken slab detail --------------------------------------------

/** Footer/stem-wall/lip/foam dimensions (Tommy) — slabThicknessIn and
 * stemWallHeightIn are the two assumed placeholders (not yet given):
 * slabThicknessIn is chosen so the slab, poured on 2in foam sitting on
 * the 6in-down shelf, clearly clears the stem wall's top edge, matching
 * the described detail; stemWallHeightIn is illustrative only (actual
 * height is site/frost-depth dependent, not modeled). */
export const slabFoundationDimensions = {
  footerDepthIn: 9,
  footerWidthIn: 36,
  stemWallThicknessIn: 10,
  stemWallHeightIn: 24,
  lipDepthFromTopIn: 6,
  lipShelfWidthIn: 4,
  epsFoamThicknessIn: 2,
  slabThicknessIn: 6,
  status: "pending-BI-confirmation" as const,
  note: "Footer (9in x 3'-0\"), stem wall thickness (10in), lip (6in down from top, 4in shelf), and EPS foam (2in) are confirmed (Tommy). Slab thickness (6in) and overall stem wall height (24in) are assumed placeholders, not yet given.",
};

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
  headerSillPerSqFt: 34,
  columnPerSqFt: 36,
  roofPerSqFt: 42,
  totalModifier: 1.3,
  status: "confirmed" as const,
  note: "Based on biggest face; total = sum(area x rate-by-type) x totalModifier. Corner/braced/header-sill rates (Tommy) price each panel by its own type instead of one user-selected rate for the whole project. Header/sill rate also covers door heads (a header panel starting at 82.5in off the ground, Tommy). totalModifier (default 1.3) is a fabricator/admin-only markup, editable in the UI — public viewers see the base material cost with no markup applied (Tommy).",
};

// --- Panel type roster --------------------------------------------------------

const STRUCTURAL_PENDING_NOTE =
  "Pending Building Integrity's own pre-engineering numbers. Possibly covered by \"For Baleheads Only\" NDS 2018 (ASD) ClearCalcs doc — still unconfirmed whether that's Building Integrity's own engineering.";

export const panelTypes: PanelTypeDef[] = [
  {
    id: "standard",
    label: "Standard",
    description: "Baseline wall panel.",
    loadBearingCapacity: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
  },
  {
    id: "corner",
    label: "Corner",
    description:
      "Corner connection panel — same construction as the Column Panel (Tommy): 24in standard-panel core + " +
      "3/4in plywood on both tall sides + 2x4 blocking every 16in, both sides, in addition to girts. 25.5in wide overall.",
    loadBearingCapacity: {
      status: "pending-BI-confirmation",
      note: `Bears load from 2 intersecting walls at the shared corner, not just 1. ${STRUCTURAL_PENDING_NOTE}`,
    },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
  },
  {
    id: "column",
    label: "Column",
    description:
      "Reinforced/plywood-sided, for >12' runs needing beam bearing under roof panels; not needed under trusses. " +
      "24in standard-panel core + 3/4in plywood on both tall sides + 2x4 blocking every 16in, both sides, in " +
      "addition to girts — always fabricated 25.5in wide (Tommy), regardless of the wall-slot width shown in the " +
      "2D editor (converting a panel to Column via the click-cycle keeps its prior slot width today; the " +
      "fabricated unit itself is fixed at 25.5in).",
    loadBearingCapacity: {
      status: "pending-BI-confirmation",
      note: `This type exists specifically for higher point-load bearing (roof beam reactions on long runs) — expected to rate above standard/corner once modeled. ${STRUCTURAL_PENDING_NOTE}`,
    },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
  },
  {
    id: "braced",
    label: "Braced Panel",
    description:
      "Standard-width panel with diagonal bracing carved into the finished compressed panel afterward (formerly called \"carrot panel\", deprecated in Panel Set 1). One braced panel touches each corner panel on every wall; additional braced panels are added along the run per seismic zone (high=8ft/moderate=12ft/low=16ft, Tommy). No longer flanks window openings (Tommy).",
    loadBearingCapacity: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
    shearValue: {
      status: "pending-BI-confirmation",
      note: `This type exists specifically to provide lateral/shear resistance (that's what the diagonal bracing is for) — seismic-zone spacing already governs how many are needed even without a numeric value yet. ${STRUCTURAL_PENDING_NOTE}`,
    },
  },
  {
    id: "header",
    label: "Header (Lintel)",
    description: "Above-opening beam-bearing panel.",
    loadBearingCapacity: {
      status: "pending-BI-confirmation",
      note: `The header BEAM (double 2x6, or 2x8 for spans to 12ft) carries the actual opening load, not the panel skin itself. ${STRUCTURAL_PENDING_NOTE}`,
    },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
  },
  {
    id: "sill",
    label: "Sill",
    description: "Below-opening panel.",
    loadBearingCapacity: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
  },
  {
    id: "inclined-gable",
    label: "Inclined / Gable",
    description: "Roof-slope panel.",
    loadBearingCapacity: {
      status: "pending-BI-confirmation",
      note: `Load path is roof loads (snow/wind/dead), not wall shear — beam sizing depends on roof angle (not yet modeled). ${STRUCTURAL_PENDING_NOTE}`,
    },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
  },
  {
    id: "safety-gap",
    label: "Safety / Gap Panel",
    description:
      "Dimensional-tolerance absorption panel: width normally set dynamically to absorb whatever length is left " +
      "over after fitting standard panels along the wall (a 3/4\" plywood buffer, held back 1 1/4\" from top/" +
      "bottom full-height, guards against install mistakes); placed farthest from the site's least-accessible " +
      "side. When it also satisfies the corner-touching braced-panel requirement (Tommy: \"maintain the rules of " +
      "the safety panel, but have it combine with the braced panel near corners\") its width becomes fixed at " +
      "standard width + 3/4\" instead, denoted as \"standard + 3/4in safety gap\" — the wall's remaining length " +
      "shifts onto the nearest standard panel in that case, and the panel renders hashed (its own orange over " +
      "the braced panel's purple) to show both roles. Applies to roof panels too. A combined panel doesn't yet " +
      "get the Braced Panel's own real member geometry/fastener modeling — it's still tracked as a Safety/Gap " +
      "panel structurally, just flagged as also brace-placed.",
    loadBearingCapacity: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
    shearValue: {
      status: "pending-BI-confirmation",
      note: `The 1/2" plywood skin gives a genuine strength bonus (confirmed via NFW's own notes) — but that bonus isn't the reason this panel exists (dimensional tolerance is) and isn't quantified yet. ${STRUCTURAL_PENDING_NOTE}`,
    },
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

// --- Suspended floor joist systems -----------------------------------------------

export interface FloorJoistTypeDef {
  id: "lvl-16" | "lvl-24" | "solid-pine";
  label: string;
  material: string;
  spacingIn: number;
  joistWidthIn: number;
  status: CatalogStatus;
  note: string;
}

export const floorJoistTypes: FloorJoistTypeDef[] = [
  {
    id: "lvl-16",
    label: "LVL @ 16\" o.c.",
    material: "LVL (laminated veneer lumber)",
    spacingIn: 16,
    joistWidthIn: 1.75,
    status: "confirmed",
    note: "Suspended floor joist option (Tommy): LVL, 16in on-center.",
  },
  {
    id: "lvl-24",
    label: "LVL @ 24\" o.c.",
    material: "LVL (laminated veneer lumber)",
    spacingIn: 24,
    joistWidthIn: 1.75,
    status: "confirmed",
    note: "Suspended floor joist option (Tommy): LVL, 24in on-center.",
  },
  {
    id: "solid-pine",
    label: "Solid Pine",
    material: "Solid pine dimensional lumber",
    spacingIn: 16,
    joistWidthIn: 1.5,
    status: "pending-BI-confirmation",
    note: "Spacing defaulted to 16in o.c. (Tommy specified LVL's 2 spacing options but not solid pine's own spacing) — confirm before treating as final.",
  },
];

/** How much shallower a field joist is than the wall panel's own thickness
 * — Tommy: "(panel thickness minus 4.5in) joist". */
export const FIELD_JOIST_DEPTH_REDUCTION_IN = 4.5;

export const floorRimJoistDetail = {
  thermalBreakGapIn: 1.5,
  status: "pending-BI-confirmation" as const,
  note: "Thermally-broken rim joist detail (Tommy), at each short end (symmetric, confirmed): edge-rim joist -> 1.5in insulated gap -> rim joist, transitioning into field joists (depth = panel thickness - 4.5in) at the selected type's o.c. spacing, running to the matching double-rim at the far end. Field-joist-to-field-joist bay width is shown at the type's actual o.c. spacing minus joist width (ordinary batt insulation) — the 1.5in gap is read here as the rim's own thermal-break detail specifically, not a literal fixed width for every field bay; confirm this reading before treating as final.",
};

export const perpendicular2x4Addition = {
  thicknessIn: 1.5,
  widthIn: 3.5,
  status: "confirmed" as const,
  note: "Optional 2x4 strapping run perpendicular to the joists (Tommy) — reduces thermal bridging by breaking the direct conductive path through the joists, creating a separate service/insulation cavity below them. Full build-up (cellulose fill, taped sheathing, splash-protection layer): see floorAddOnLayerLayers below.",
};

export const floorLongSideBlockingNote = {
  status: "pending-BI-confirmation" as const,
  note: "Solid blocking shown just under the panel along the long sides — the sides the joists run alongside (parallel to their own span), rather than land on (Tommy). Exact blocking spacing/sizing not yet specified.",
};

// --- Floor structure — full assembly ----------------------------------------

export interface FloorAssemblyLayerDef {
  id: string;
  label: string;
  description: string;
  status: CatalogStatus;
  note: string;
}

/** Full suspended-floor assembly, bottom to top (Tommy) — order matters,
 * used directly to drive the assembly cross-section diagram. */
export const floorAssemblyLayers: FloorAssemblyLayerDef[] = [
  {
    id: "pressure-treated-sill",
    label: "Pressure-treated boards",
    description: "Bottom-most framing member (sill/rim), pressure-treated for ground/moisture exposure.",
    status: "confirmed",
    note: "Tommy: full floor assembly, bottom to top.",
  },
  {
    id: "wire-mesh",
    label: "Galvanized welded wire mesh",
    description: "Stapled to the underside of the joist bays; openings no larger than 10mm x 10mm (rodent/pest barrier).",
    status: "confirmed",
    note: "Tommy.",
  },
  {
    id: "wood-fiber-board",
    label: "Vapor-permeable, water-resistant wood fiber board",
    description: "Lines the perimeter/rim face.",
    status: "confirmed",
    note: "Tommy.",
  },
  {
    id: "cellulose-fill",
    label: "Cellulose insulation",
    description: "Fills the joist bays. Substituted for rock wool per Tommy's direction.",
    status: "confirmed",
    note: "Tommy: \"Cellulose insulation (substituted for rock wool)\".",
  },
  {
    id: "structural-deck",
    label: "OSB or other structural boards",
    description: "Deck/sheathing on top of the joists.",
    status: "confirmed",
    note: "Tommy.",
  },
  {
    id: "air-sealing-tape",
    label: "Air sealing tape",
    description: "Applied at OSB seams for airtightness. If tongue-and-groove boards are used instead, taping isn't required but is recommended.",
    status: "confirmed",
    note: "Tommy.",
  },
  {
    id: "gap-sealing",
    label: "Gap sealing",
    description: "Any gaps from imprecise board cuts get sealed with air sealing tape, expanding foam, or a gap sealer.",
    status: "confirmed",
    note: "Tommy.",
  },
];

export const floorMeshOpeningMaxMm = {
  value: 10,
  status: "confirmed" as const,
  note: "Galvanized welded wire mesh openings no larger than 10mm x 10mm (rodent/pest barrier), Tommy.",
};

// --- Floor corner & perimeter insulation sequencing -------------------------

export const floorInsulationSequencingRule = {
  status: "confirmed" as const,
  note: "Insulate joist bays running parallel to the wall before the plywood deck is installed over them — once covered, that bay can't be packed anymore (Tommy).",
};

export const floorCornerCavityDetail = {
  fillMaterial: "Cellulose insulation",
  status: "confirmed" as const,
  note: "At the corner, between the doubled rim/perimeter framing members, the cavity is filled with cellulose (substituted for the book's ceramsite/clay pebble fill) rather than batt-style insulation, since the corner geometry doesn't lend itself to batts (Tommy). Plywood decking caps the corner cavity after the cellulose fill is placed.",
};

export const floorFieldBayDetail = {
  status: "confirmed" as const,
  note: "Interior field bays (parallel to the far wall) are packed with cellulose insulation before their plywood cap goes on — same before-decking rule as the corner and perimeter bays (Tommy).",
};

// --- Perpendicular 2x4 add-on layer ------------------------------------------

/** The optional perpendicular-2x4 layer's own build-up, bottom to top —
 * reuses FloorAssemblyLayerDef so its diagram/legend follow the same
 * pattern as the main floor assembly above. */
export const floorAddOnLayerLayers: FloorAssemblyLayerDef[] = [
  {
    id: "addon-2x4-strapping",
    label: "Perpendicular 2x4 strapping",
    description: "Secondary 2x joist layer laid perpendicular to the primary floor joists, sitting on top of the primary structure, directly under the wall base plate — reduces thermal bridging.",
    status: "confirmed",
    note: "Tommy.",
  },
  {
    id: "addon-cellulose-fill",
    label: "Cellulose insulation",
    description: "Packed between the perpendicular 2x4 members.",
    status: "confirmed",
    note: "Tommy.",
  },
  {
    id: "addon-sheathing",
    label: "OSB or plywood sheathing (taped)",
    description: "Sheathing over the top, seams sealed/taped — this is what the airtightness gain depends on.",
    status: "confirmed",
    note: "Tommy.",
  },
  {
    id: "addon-splash-protection",
    label: "OSB or plywood, taped (splash protection)",
    description: "Sits under the wall base plate for splash protection from floor water. The straw wall base gets an added insulation layer at this junction, further cutting thermal bridging.",
    status: "confirmed",
    note: "Tommy.",
  },
];
