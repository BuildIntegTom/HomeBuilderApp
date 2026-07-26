import type {
  CatalogRange,
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
  note: "Two 18\" bales + two 1.5\" studs, width/thickness locked together — a fully supported panelization type, fabricated the same as any other panel.",
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

export const sillDefaultHeightIn: CatalogValue<number> = {
  value: 32,
  status: "confirmed",
  note: "Tommy: \"sill panels are almost always 32in tall\" — a sill is otherwise a short Standard Panel (same construction, just this default height instead of the full wall height).",
};

// --- Panel size limits ------------------------------------------------------
// Source: a manufacturer's "possible sizes" spec sheet Tommy supplied
// (metric), translated to the app's own nearest-1/8in convention
// (formatImperialFractionIn) and confirmed with Tommy. Two ceilings were
// deliberately raised above the manufacturer's own numbers so the app's
// existing defaults stay valid — see each note below.

export const panelThicknessInRange: CatalogRange = {
  minIn: 11.75,
  maxIn: 15.75,
  status: "confirmed",
  note: "300-400mm on the mfr spec sheet, translated 1:1 (11¾\"-15¾\"). Covers Standard/Braced/Column/Inclined panel thickness — the app's own 14/15.5/15.75in thickness options all already fall inside this range.",
};

export const panelWidthInRange: CatalogRange = {
  minIn: 15.75,
  maxIn: 48,
  status: "confirmed",
  note: "Mfr spec sheet gives 400-850mm (15¾\"-33½\") for Standard/Braced/Column/Inclined panel width. Tommy raised the max to 48in so the app's existing 40in standard-width default (and Square Bale Panels' fixed 39in) stay valid — the mfr's own 33.5in max is not enforced here.",
};

export const panelHeightInRange: CatalogRange = {
  minIn: 15.75,
  maxIn: 144,
  status: "confirmed",
  note: "Mfr spec sheet gives 400-3000mm (15¾\"-118⅛\") for Standard/Braced/Column/Inclined panel height (i.e. wall height). Tommy raised the max to 144in (12ft) so the app's existing 120in/10ft wall-height default stays valid — the mfr's own 118.125in max is not enforced here.",
};

export const columnMinWidthIn = 16.75;
// 424mm on the mfr spec sheet (16.7in, rounds to 16¾\" at nearest 1/8in) —
// already satisfied today: Column's real built width (COLUMN_TOTAL_WIDTH_IN,
// see columnPanelMembers.ts) is 25.5in, comfortably above this floor.

export const lintelWidthInRange: CatalogRange = {
  minIn: 15.75,
  maxIn: 118.125,
  status: "confirmed",
  note: "400-3000mm on the mfr spec sheet (15¾\"-118⅛\"), translated 1:1 — no conflict with any existing default (door/window widths are well under this ceiling).",
};

export const sillHeaderHeightInRange: CatalogRange = {
  minIn: 16.75,
  maxIn: 33.5,
  status: "confirmed",
  note: "424-850mm on the mfr spec sheet (16¾\"-33½\") — governs a sill panel's own height/depth (sillDefaultHeightIn's 32in default already fits) and the derived header depth (computeHeaderHeightIn) once sill height becomes independently draggable per window.",
};

export const sillMinWidthIn = 23.625;
// 600mm on the mfr spec sheet (23.622in, rounds to 23⅝\" at nearest 1/8in).

export const doorRoughOpeningSelectedHeightIn: CatalogValue<number> = {
  value: 82.5,
  status: "confirmed",
  note: "Tommy: default selected door Rough Opening height (the door unit's own spec height) — see computeDoorRoughOpeningHeightIn, which subtracts the toe-up height to get the real built RO height.",
};

export const toeUpHeightIn: CatalogValue<number> = {
  value: 1.5,
  status: "confirmed",
  note: "Tommy: \"toe up height (usually 1.5in)\" — the floor-to-wall-panel toe-up member's height, subtracted from the selected door RO height to get the real built door RO height (and jack stud height).",
};

/** Header height has no confirmed real formula yet (unlike the door RO
 * height above) — an illustrative default shared by every header/opening-
 * assembly preview (Shop Drawing pages, Building3DView) so they all agree
 * on the same number rather than each picking their own. */
export const headerPreviewHeightIn: CatalogValue<number> = {
  value: 18,
  status: "pending-BI-confirmation",
  note: "Illustrative default — headers don't have their own confirmed real height yet (same gap as the jack stud's own placement mechanism).",
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
//
// Two genuinely different IRC R602.10 concepts, previously conflated into
// one number — researched directly for this rewrite (see PR discussion):
//
// - BRACED WALL PANEL spacing: how far apart the individual braced panels
//   are ALONG one wall line (this is what `applyBracedPlacement` actually
//   places) — IRC R602.10.2.2: for intermittent bracing methods in Seismic
//   Design Category A/B/C, adjacent braced wall panels may be no more than
//   20ft apart, and a panel must start within 10ft of each end of the wall
//   line. Higher categories (D0-D2) don't tighten this spacing number
//   directly in the code — they instead raise the required AMOUNT/length
//   of bracing per line (a percentage-of-wall-length calculation this app
//   doesn't model), so `seismicBracedPanelSpacingFt`'s 3-tier "high/
//   moderate/low" scheme below is Building Integrity's own simplified
//   PROXY for that (tighter panel spacing -> more braced panels -> more
//   shear capacity), not a literal code table lookup.
// - BRACED WALL LINE spacing: how far apart two PARALLEL wall lines
//   needing bracing can be, in plan — a completely separate number (this
//   app doesn't check it geometrically yet; `bracedWallLineSpacingFt`
//   below is informational). IRC Table R602.10.1.3 (2021 IRC): up to 60ft
//   for lower/wind-governed categories; R602.10.1.1's older SDC D0-D2 rule
//   caps this at 25ft per story (both directions), with an exception up to
//   35ft for a single room <=900sqft per dwelling unit.
//
// Every number here varies by exact bracing method, wind exposure, story
// count, and adopted code EDITION/jurisdiction amendment — treat these as
// a reasonable illustrative default, not a substitute for a real R602.10
// (or local equivalent) calculation by the project's engineer/plan
// reviewer.

export type SeismicZone = "high" | "moderate" | "low";

/** Braced WALL PANEL spacing (within one wall line) — drives
 * `applyBracedPlacement`'s actual periodic brace placement. Capped at the
 * real IRC R602.10.2.2 max (20ft, SDC A/B/C, intermittent bracing) for the
 * "low" tier; moderate/high tighten further as BI's own simplified proxy
 * for rising seismic demand (see the block comment above). */
export const seismicBracedPanelSpacingFt: Record<SeismicZone, number> = {
  high: 12,
  moderate: 16,
  low: 20,
};

export const seismicBracedPanelSpacingStatus = {
  status: "pending-BI-confirmation" as const,
  note:
    "Braced WALL PANEL spacing (distance between individual braced panels along one wall line) — low=20ft matches " +
    "IRC R602.10.2.2's real max for intermittent bracing in Seismic Design Category A/B/C; moderate=16ft/high=12ft " +
    "are Building Integrity's own tightening as a simplified proxy for higher seismic demand (real code raises the " +
    "required bracing AMOUNT/percentage in SDC D0-D2, not this spacing number directly). Not a substitute for a " +
    "jurisdiction- and method-specific R602.10 calculation.",
};

/** Braced WALL LINE spacing (distance between parallel wall lines needing
 * bracing, in plan) — a DIFFERENT limit than the panel spacing above, not
 * yet geometrically checked by this app (informational only). */
export const bracedWallLineSpacingFt: Record<SeismicZone, number> = {
  high: 25,
  moderate: 45,
  low: 60,
};

export const bracedWallLineSpacingStatus = {
  status: "pending-BI-confirmation" as const,
  note:
    "Braced WALL LINE spacing (distance between parallel wall lines, not between panels within one line) — low/" +
    "moderate=60/45ft interpolates IRC Table R602.10.1.3's wind/lower-Seismic-Design-Category allowance (up to " +
    "60ft); high=25ft matches the older SDC D0-D2 per-story cap (R602.10.1.1), which also allows a one-time " +
    "exception up to 35ft for a single room <=900sqft per dwelling unit (not modeled here). Not yet checked " +
    "against the drawn footprint — informational only. Code editions vary this figure; confirm against the " +
    "project's adopted code/jurisdiction.",
};

// --- Windows -------------------------------------------------------------------

export const standardWindowWidthsIn: CatalogValue<number[]> = {
  value: [24, 30, 36, 48, 60, 72],
  status: "pending-BI-confirmation",
  note: "Common construction window widths — not spec-given or Building-Integrity-sourced yet.",
};

export const windowHeaderWidthInRange: CatalogRange = {
  minIn: 24,
  maxIn: 120,
  status: "pending-BI-confirmation",
  note: "Tommy: window headers 'can be however wide up to 10 ft wide.' Floor matches today's smallest reachable window width; the 120in (10ft) ceiling is Tommy's own stated spec, not mfr-sourced like lintelWidthInRange's 118.125in.",
};

/** 5 standard window heights (Tommy: "an option for 5 different standard
 * window heights, and that should determine the height of the windows") —
 * a project-wide setting (like `standardWidthIn`), not per-window, same
 * unsourced-but-reasonable status as `standardWindowWidthsIn` above. This
 * IS the window's own Rough Opening height (sill-top to header-bottom) —
 * see `computeWindowHeaderHeightIn`, which derives the header's real
 * height from it (wall height minus this RO's own top elevation). */
export const standardWindowHeightsIn: CatalogValue<number[]> = {
  value: [24, 36, 48, 60, 72],
  status: "pending-BI-confirmation",
  note: "Common construction window heights — not spec-given or Building-Integrity-sourced yet, same status as standardWindowWidthsIn.",
};

export const standardWindowHeightDefaultIn: CatalogValue<number> = {
  value: 48,
  status: "pending-BI-confirmation",
  note: "Default among the 5 standard window height options — a common mid-size residential window height, not independently confirmed.",
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

/**
 * Real, globally-purchasable ground-screw products (Tommy: "pick the top 3
 * options you see online especially if between them they can be bought all
 * around the world, and include them as sub objects with their relative
 * specs") — researched directly (manufacturer sites + ICC-ES/DIBt approval
 * documents), replacing the single unsourced 6kN placeholder below. Every
 * manufacturer publishes capacity as soil/torque/length/diameter-dependent
 * (not one flat number), so `representativeCapacityKN` is each product's
 * own published CEILING figure for its line (see `capacityBasis` for what
 * it actually represents) — not a substitute for that manufacturer's own
 * site-specific load tables.
 */
export interface GroundScrewProductDef {
  id: string;
  manufacturer: string;
  model: string;
  originCountry: string;
  diameterMm: number;
  /** Fully self-describing (not a bare number) — e.g. "1600-2000mm" or "per
   * design load" — since not every product publishes a simple mm range. */
  lengthMmRange: string;
  representativeCapacityKN: number;
  capacityBasis: string;
  availabilityNote: string;
  status: CatalogStatus;
  note: string;
}

export const groundScrewProducts: GroundScrewProductDef[] = [
  {
    id: "stopdigging-sgu",
    manufacturer: "StopDigging",
    model: "SGU",
    originCountry: "Sweden (design); distributed in Sweden, UK, Norway, Germany, Denmark, Switzerland, Finland, Netherlands, New Zealand, Australia, Canada, USA",
    diameterMm: 67,
    lengthMmRange: "sized per design load (no fixed length published)",
    representativeCapacityKN: 6,
    capacityBasis: "tested compression capacity (612kg) for the base SGU model — also rated 4.5kN tensile / 2.5kN lateral",
    availabilityNote: "Confirmed active distribution in 12 countries across Europe, Oceania, and North America — the broadest confirmed footprint of these 3.",
    status: "confirmed",
    note: "Light-duty, deck/shed-scale reference point — closest match to this catalog's original placeholder figure, now a sourced real product instead of an unsourced guess.",
  },
  {
    id: "ags-model-3",
    manufacturer: "American Ground Screw (AGS)",
    model: "Model 3",
    originCountry: "USA",
    diameterMm: 76,
    lengthMmRange: "1600-2000mm",
    representativeCapacityKN: 200,
    capacityBasis: "ICC-ESR-4160 certified ultimate compression ceiling across the model's diameter/length range (up to 45 kips / ~200kN compression, 20+ kips / ~89kN uplift)",
    availabilityNote: "ICC-ESR-4160 certified — accepted by building departments in all 50 US states without extra engineering letters or special inspection. Primary confirmed market is the USA.",
    status: "confirmed",
    note: "The only one of these 3 with a US model-code evaluation report (ESR-4160) backing it — best fit when the project needs a code-recognized citation, not just a manufacturer claim.",
  },
  {
    id: "krinner-v89",
    manufacturer: "Krinner Schraubfundamente",
    model: "V89 (V-series)",
    originCountry: "Germany",
    diameterMm: 89,
    lengthMmRange: "300-2000mm (extendable)",
    representativeCapacityKN: 200,
    capacityBasis: "DIBt-approved (German national technical approval) for structural loads; Krinner's own V89/V114/V140 test rig is rated to 200kN",
    availabilityNote: "Krinner states the product line is available worldwide, with confirmed distribution through dealers in the US (e.g. Rexel) in addition to Europe.",
    status: "confirmed",
    note: "Krinner's own site states worldwide availability — the strongest single-manufacturer global claim of these 3, though StopDigging's confirmed country list is broader.",
  },
];

export const groundScrewProductsStatus = {
  status: "pending-BI-confirmation" as const,
  note:
    "3 real products researched directly from manufacturer/certification sources (not Building-Integrity-sourced) — a starting reference set, not an exhaustive market survey. Every figure above is each " +
    "manufacturer's own published ceiling/test rating, not a site-specific allowable value; an actual project still needs that manufacturer's own load table + a site soil report/torque correlation.",
};

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
      unit: "kN (ultimate, per screw) — light-duty default; see groundScrewProducts for 2 higher-capacity, code-certified options",
      status: "pending-BI-confirmation",
      note: "Matches StopDigging's SGU model (see groundScrewProducts) as the default light-duty reference — American Ground Screw's Model 3 (ICC-ESR-4160) and Krinner's V89 both rate to a ~200kN ceiling for heavier point loads. Still needs Building Integrity's own product spec + site soil report before a real design.",
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
      "addition to girts — always fabricated 25.5in wide (Tommy). The wall-slot reserved for a Column Panel is " +
      "always this same 25.5in (COLUMN_TOTAL_WIDTH_IN) — converting a panel to Column via the click-cycle " +
      "re-tiles the rest of the wall around exactly that reservation, so the standard panels on either side " +
      "always close up flush with no unaccounted gap.",
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
    description:
      "Above-opening beam-bearing panel. Gets a Plywood Jack Stud (\"jack sheet\") on each side of the rough " +
      "opening — 3/4in plywood, panel-depth wide, full rough-opening height, screwed to the adjacent wall panel " +
      "with 2x 4in T25 #9 screws every 6in. See the Plywood Jack Stud detail page for its own geometry/fasteners.",
    loadBearingCapacity: {
      status: "pending-BI-confirmation",
      note: `The header BEAM (double 2x6, or 2x8 for spans to 12ft) carries the actual opening load, not the panel skin itself. ${STRUCTURAL_PENDING_NOTE}`,
    },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
  },
  {
    id: "sill",
    label: "Sill",
    description:
      "Below-opening panel. Shares the same pair of Plywood Jack Studs as the header above it (same rough " +
      "opening) — see the Plywood Jack Stud detail page.",
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
    id: "gable",
    label: "Gable End Panel",
    description:
      "Wall panel forming the triangular gable end below the roof — a Standard Panel core, but the top plate is " +
      "cut at the roof pitch instead of flat, so the envelope is trapezoidal, not rectangular. Each instance has " +
      "two distinct edge-stud heights (low edge / high edge, whichever end sits closer to the ridge), each with " +
      "an angle-cut top (modeled as a plain box, not the true bevel). The top plate 2x4s are mitered to the same " +
      "angle and face-fastened to the top plywood skin, which is rip-cut at that angle — the schema reports the " +
      "rip angle and rip length for that skin. Low/high edge heights are supplied manually per instance for now; " +
      "there's no roof/ridge system yet to derive them from a pitch automatically. Distinct from \"Inclined / " +
      "Gable\" above, which is a roof-slope (sloped roof surface) panel, not a gable end wall panel.",
    loadBearingCapacity: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
  },
  {
    id: "jack-stud",
    label: "Plywood Jack Stud",
    description:
      "3/4in plywood \"jack sheet,\" panel-depth wide, standing the full rough-opening height under a header — a " +
      "plywood substitute for a dimensional-lumber jack stud. One on each side of a window/door rough opening, " +
      "screwed to the adjacent wall panel with 2x 4in T25 #9 screws every 6in. See the Header/Sill panel " +
      "descriptions above.",
    loadBearingCapacity: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
  },
  {
    id: "safety-gap",
    label: "Safety / Gap Panel",
    description:
      "Dimensional-tolerance absorption panel: NOT an altered Standard Panel (Tommy) — no studs, plates, or " +
      "girts, just a single 3/4\" plywood sheet (panel-depth wide, full panel height), regardless of how much " +
      "wall-run width the tiling reserves for this slot. That reserved width is normally set dynamically to " +
      "absorb whatever length is left over after fitting standard panels along the wall, placed farthest from " +
      "the site's least-accessible side. When it also satisfies the corner-touching braced-panel requirement " +
      "(Tommy: \"maintain the rules of the safety panel, but have it combine with the braced panel near " +
      "corners\") its reserved width becomes fixed at standard width + 3/4\" instead, denoted as \"standard + " +
      "3/4in safety gap\" — the wall's remaining length shifts onto the nearest standard panel in that case, and " +
      "the panel renders hashed (its own orange over the braced panel's purple) to show both roles. Applies to " +
      "roof panels too. A combined panel doesn't yet get the Braced Panel's own real bracing modeled in 3D — " +
      "it's still tracked as a Safety/Gap panel structurally, just flagged as also brace-placed. See the " +
      "Material Totals page for its 3/4\" plywood contribution.",
    loadBearingCapacity: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
    shearValue: { status: "pending-BI-confirmation", note: STRUCTURAL_PENDING_NOTE },
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
    coverageRule: { kind: "wall-and-roof-interior-surface" },
    rollWidthIn: 59.06, // 1.5m — pro clima's common Intello Plus roll width.
    skinColor: "#7fb8e0",
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
  // --- Accessory products (Tommy: "check boxes that we will begin to build
  // the repitior of") — not a whole-assembly vapor layer, so both are
  // unrated (permWinter/permSummer null); their purpose is a computable
  // purchase quantity (coverageRule below), not the perm check.
  {
    id: "exto-seal",
    side: "both",
    label: "Exto Seal (window/door sill tape)",
    permWinter: null,
    permSummer: null,
    status: "pending-BI-confirmation",
    note: "300mm x 20m (65.6ft) roll is a common SKU — Building Integrity hasn't confirmed which exact width/length they'd spec. Not a whole-assembly vapor layer, so no perm rating applies.",
    coverageRule: { kind: "opening-sill-perimeter" },
    skinColor: "#e0a83f",
  },
  {
    id: "tescon-vana",
    side: "both",
    label: "Tescon Vana (seam/connection tape)",
    permWinter: null,
    permSummer: null,
    status: "pending-BI-confirmation",
    note: "60mm x 30m (98.4ft) roll is a common SKU — Building Integrity hasn't confirmed which exact width they'd spec. Not a whole-assembly vapor layer, so no perm rating applies.",
    coverageRule: { kind: "seam-tape-for", coveredProductId: "intello-plus" },
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

// --- Roof --------------------------------------------------------------------
//
// Roof is its own system, parallel to the Floor tab's joist catalog above —
// not a wall panel type. There's always a bearing member on top of the wall
// panels: a truss plate (truss roof) or a box beam (structural-panel roof).
// Both are flagged to model later (Tommy) — only the inset/height/offset
// numbers below are tracked for now; no truss/box-beam geometry exists yet.

export type RoofSystemType = "truss" | "structural-panel";

export interface RoofSystemTypeDef {
  id: RoofSystemType;
  label: string;
  description: string;
}

export const roofSystemTypes: RoofSystemTypeDef[] = [
  {
    id: "truss",
    label: "Truss",
    description: "Prefab roof trusses bear on a truss plate running atop the wall panels.",
  },
  {
    id: "structural-panel",
    label: "Structural Panel (Box Beam)",
    description:
      "Roof is built from structural panels rather than trusses — needs a roof-catcher beam spanning between the " +
      "two Gable End Panels' peaks, bearing on Column Panels (see the Roof-catcher-beam depth offset input below).",
  },
];

/** Tommy: "how fat the truss bottoms are — default of 5.5in from flush with
 * the edge of the floor plan line." Read as the truss bottom chord's own
 * depth doubling as this inset amount (one editable number, not confirmed as
 * two separate figures) — user-editable in the Roof tab, not a fixed
 * constant. */
export const trussPlateInsetDefaultIn: CatalogValue<number> = {
  value: 5.5,
  status: "pending-BI-confirmation",
  note: "Tommy: default 5.5in inset from flush with the wall's exterior/floor-plan line. User-editable per project.",
};

/** Energy-heel (raised-heel) truss seat default (Tommy: "have the truss
 * seat be the full panel width AND THEN go vertical for 6in (adjustable)").
 * Real-world energy-heel trusses typically run 6in-15in (9in-10in minimum
 * for full-depth R-30 insulation over the plate) — 6in is the low end of
 * that range, matching Tommy's own requested default. User-editable in the
 * Roof tab; 0 disables the heel entirely. */
export const gableHeelHeightDefaultIn: CatalogValue<number> = {
  value: 6,
  status: "pending-BI-confirmation",
  note: "Tommy: default 6in energy-heel truss seat height, adjustable. Typical real-world range is 6in-15in.",
};

/**
 * Preset choices for the bearing member's (truss bottom/roof-catcher beam)
 * "bottom edge reference" — Tommy: "the bottom edge reference should have an
 * option of being 1) on the primary edge 2) 3.5in in from the adjacent
 * walls primary edge or 3) default - 5.5in from adjacent walls primary
 * edge." Replaces free-typed inset values with these 3 named options (the
 * 5.5in default matches trussPlateInsetDefaultIn above); 3.5in is a single
 * 2x4's actual width, a plausible "one stud in" reference.
 */
export const bearingEdgeReferenceOptions = [
  { id: "primary-edge", label: "Primary edge (flush)", insetIn: 0 },
  { id: "3.5in-in", label: "3.5in in", insetIn: 3.5 },
  { id: "5.5in-in-default", label: "5.5in in (default)", insetIn: 5.5 },
] as const;

export type BearingEdgeReferenceId = (typeof bearingEdgeReferenceOptions)[number]["id"];

export const roofBearingMemberNote =
  "There's always a bearing member on top of the wall panels — a truss plate (see trussPlateMembers.ts), a box " +
  "beam (2nd-story walls only, per-wall choice — see boxBeamMembers.ts), or a roof-catcher beam spanning between " +
  "the two Gable End Column Panels (structural-panel roof, \"Built-up 3-ply 2x12\" shape — see " +
  "roofCatcherBeamMembers.ts; the other beam shape options remain labels only). A 2nd-story wall defaults to a " +
  "Truss Plate unless Box Beam is turned on for it (see that wall's own elevation view, or the Ring buttons below).";

/** Shape options for the structural-panel roof's catcher beam — only
 * "Built-up 3-ply 2x12" (Tommy: "spawn in 3 2x12 dimensional lumber pieces
 * that span a maximum of 12'") has real modeled geometry (see
 * buildRoofCatcherBeamMembers in roofCatcherBeamMembers.ts); the rest remain
 * labels only, no real geometry/engineering behind them yet. */
export const roofCatcherBeamShapeOptions = [
  "4x12 solid sawn",
  "Built-up 2-ply 2x12",
  "Built-up 3-ply 2x12",
  "LVL 1-3/4in x 11-7/8in",
  "Steel I-beam",
] as const;

export type RoofCatcherBeamShape = (typeof roofCatcherBeamShapeOptions)[number];

export const roofCatcherBeamShapeDefault: RoofCatcherBeamShape = "Built-up 3-ply 2x12";

/** Timber HP is a real wood-fiber board insulation product — fills the
 * truss plate's open cavity on single-story buildings (see
 * trussPlateMembers.ts). Tommy: "its qualities should be calculated as we
 * will build this material in more" — density here is a placeholder
 * general reference for wood-fiber board (~1.9-3.4 lb/ft3 typical range),
 * not yet a Building Integrity-confirmed spec sheet value. */
export const timberHpDensityLbFt3: CatalogValue<number> = {
  value: 2.4,
  status: "pending-BI-confirmation",
  note:
    "Placeholder general reference for wood-fiber board insulation (~1.9-3.4 lb/ft3 typical range) — not yet a " +
    "Building Integrity-confirmed spec sheet value for the specific Timber HP product. Tommy: \"we will build " +
    "this material in more.\"",
};

/** Blown into the two-story box beam's hollow cavity (see
 * boxBeamMembers.ts). Standard published dense-pack cellulose installed-
 * density reference for closed wall cavities. */
export const densePackCelluloseDensityLbFt3: CatalogValue<number> = {
  value: 3.5,
  status: "pending-BI-confirmation",
  note:
    "Standard published dense-pack cellulose installed-density reference (~3.0-3.5 lb/ft3 for closed wall " +
    "cavities, common insulation-industry installation standard) — not yet a Building Integrity-confirmed figure " +
    "for this specific box-beam application.",
};

// --- Shipping ---------------------------------------------------------------

export interface TruckBedSpec {
  id: string;
  label: string;
  /** Usable cargo envelope — front-to-back, side-to-side, floor-to-ceiling. */
  interiorLengthIn: number;
  interiorWidthIn: number;
  interiorHeightIn: number;
}

/**
 * The most common size of each of the 3 requested trailer types (Tommy:
 * "which truck bed size are we using... pull numbers for volume for 1) the
 * most popular conestoga size 2) the most common flat bed and 3) most
 * common type of box trailer") — industry-typical published dimensions,
 * not a specific manufacturer's spec sheet or Building-Integrity-confirmed
 * figure. A wall panel's own 10ft (120in) standard height is taller than
 * every one of these trailers' own cross-section (width/height, ~100in
 * each) — it can only fit lying flat with that 120in dimension running
 * along the trailer's LENGTH (48-53ft), not its width or height — see
 * `computeTruckLoads`.
 */
export const truckBedTypes: CatalogValue<TruckBedSpec[]> = {
  value: [
    {
      id: "conestoga-53",
      label: "Conestoga (53ft) — most popular size",
      interiorLengthIn: 636, // 53ft
      interiorWidthIn: 98, // 102in deck, less for the tarp's own track rails
      interiorHeightIn: 100, // door/cargo height under the tarp, ~98-102in typical
    },
    {
      id: "flatbed-48",
      label: "Flatbed (48ft) — most common size",
      interiorLengthIn: 576, // 48ft, the industry-favorite length
      interiorWidthIn: 102, // full deck width, no side walls
      interiorHeightIn: 102, // legal 13'6" (162in) height limit minus a 60in (5ft) deck height
    },
    {
      id: "dry-van-53",
      label: "Dry Van / Box Trailer (53ft) — most common type",
      interiorLengthIn: 630, // ~52'6" typical interior
      interiorWidthIn: 100,
      interiorHeightIn: 108, // 9ft typical interior height
    },
  ],
  status: "pending-BI-confirmation",
  note:
    "Industry-typical published interior dimensions for the most common size of each trailer type — cross-" +
    "referenced against multiple trucking-industry equipment guides, not a specific manufacturer's spec sheet or " +
    "a Building-Integrity-confirmed figure. Real trailers vary by manufacturer/model.",
};

/** 3in clearance on every side of each stack (Tommy: "always keep in mind a
 * 3in buffer on all sides of each stack") — shared between neighbors (one
 * 3in gap between any two things, stack-to-stack or stack-to-wall), not
 * doubled. */
export const shippingStackBufferIn: CatalogValue<number> = {
  value: 3,
  status: "confirmed",
  note: "Tommy: \"always keep in mind a 3in buffer on all sides of each stack.\"",
};

/** Shipping cost = trucks (computed from the stacking calculation) x miles
 * (one-way, editable) x this rate (editable) — Tommy: "a changeable
 * equation for how many trucks x how many miles x a changeable dollars per
 * hour that defaults at $6/mile one way." The $6 default is given in
 * dollars-per-MILE, not per hour (the two phrasings conflicted; $6/mile is
 * the one with a concrete number attached, confirmed with Tommy). */
export const shippingRatePerMileDefault: CatalogValue<number> = {
  value: 6,
  status: "pending-BI-confirmation",
  note: "Tommy: \"a changeable... dollars per [mile] that defaults at $6/mile one way.\"",
};

// --- Plaster Master -----------------------------------------------------------

/** Cu-ft-per-purchase-unit reference, straight from Tommy's "Faster Plaster
 * Calculator" spreadsheet's own "Cubic Footage Quick Ref." table. */
export const plasterCubicFootageRef = {
  bucketCuFt: { value: 0.5, status: "confirmed" as const, note: "Spreadsheet: \"Bucket\" 0.5 cu ft — NFW best practice, only filled to 4 gal." },
  bagCuFt: {
    value: 1.25,
    status: "confirmed" as const,
    note: "Spreadsheet: \"Bag (Clay)\" and \"Bag (Lime)\" both 1.25 cu ft (\"Getting 2-1/2 buckets from a bag\").",
  },
  tub110GalCuFt: {
    value: 17.11,
    status: "confirmed" as const,
    note: "Spreadsheet's own \"110 gal tub\" divisor — a practical field-use figure (buckets filled only to 4 gal, per NFW best practice), not a pure 110gal-to-cuft geometric conversion, so it doesn't exactly reconcile with the bucket/bag figures above. Reproduced as given.",
  },
};

/** Default mix ratios by volume ("Parts"), from the spreadsheet's own "Key"
 * section. Base Coat parts are identical for both interior/exterior (the
 * spreadsheet gives one Base Coat recipe, used straight-onto-the-straw on
 * either side); Finish Coat only ever gave a Sand:Lime recipe in the
 * source, so the interior (clay-plaster) Finish Coat's Sand:Clay default is
 * this app's own adaptation (same 3:1 structure, clay in place of lime) —
 * confirmed with Tommy as the desired default, fully user-editable either
 * way. */
export const plasterMixPartsDefaults = {
  baseCoat: {
    value: { sand: 3.5, clay: 1, lime: 0.25, straw: 1 },
    status: "confirmed" as const,
    note: "Spreadsheet \"Key\" — Base 1: Sand 3.5, Clay 1, Lime 0.25, Chopped Straw 1.",
  },
  finishCoatClay: {
    value: { sand: 3, clay: 1, lime: 0, straw: 0 },
    status: "pending-BI-confirmation" as const,
    note: "This app's own adaptation for a clay-bound finish coat (interior/clay-plaster default) — the spreadsheet's \"Key\" only gives a Finish recipe of Sand 3 : Lime 1, no clay-finish preset. Same 3:1 structure, clay swapped in for lime. Fully editable.",
  },
  finishCoatLime: {
    value: { sand: 3, clay: 0, lime: 1, straw: 0 },
    status: "confirmed" as const,
    note: "Spreadsheet \"Key\" — Finish: Sand 3, Lime 1 (no clay/straw).",
  },
};

/** Default coat thicknesses, matching the spreadsheet's own worked example
 * ("Copy of TEMPLATE" sheet: Base 0.75in, Finish 0.25in). Editable per
 * side/coat. */
export const plasterCoatThicknessInDefaults = {
  base: { value: 0.75, status: "confirmed" as const, note: "Spreadsheet's own worked example: Base Coat 0.75in." },
  finish: { value: 0.25, status: "confirmed" as const, note: "Spreadsheet's own worked example: Finish Coat 0.25in." },
};

/** Labor-hours reference constants, from the spreadsheet's own "Time"
 * table: each rough opening (door/window) gets a 15 sqft "edge" (trim/
 * cutting-in) allowance carved out of the total area, billed at a slower
 * rate than the open "field" area. */
export const plasterLaborRatesRef = {
  roughOpeningEdgeAllowanceSqFt: {
    value: 15,
    status: "confirmed" as const,
    note: "Spreadsheet: each RO's own edge/trim area = # ROs x 15 sqft, subtracted from the room's total to get the open \"field\" area.",
  },
  fieldHrsPerSqFt: {
    value: 0.02,
    status: "confirmed" as const,
    note: "Spreadsheet's own Time table: field-area hours = field sqft x 0.02.",
  },
  edgeHrsPerSqFt: {
    value: 0.04,
    status: "confirmed" as const,
    note: "Spreadsheet's own Time table: edge-area (near ROs) hours = edge sqft x 0.04 — double the field rate, slower detail/cutting-in work.",
  },
};

/** Material + labor prices — the source spreadsheet has no pricing at all
 * (materials/quantities only), so every default here is this app's own
 * researched industry-typical placeholder (WebSearch, mid-2026), not a
 * Building-Integrity-confirmed figure. All editable in the Plaster Master
 * page. */
export const plasterPriceDefaults = {
  sandPricePerCuYd: {
    value: 45,
    status: "pending-BI-confirmation" as const,
    note: "Typical mason sand, ~$20-60/cu yd depending on region/quantity (excludes delivery) — e.g. hellogravel.com, bridgewaterfarm.com 2026 pricing guides.",
  },
  clayPricePerBag: {
    value: 19,
    status: "pending-BI-confirmation" as const,
    note: "OM-4 ball clay, 50lb bag (matches the spreadsheet's own \"Clay is OM-4 from VT Ceramics Supply\" note) — ~$7.50-19/bag across ceramics suppliers; used the higher end since this is a ceramics-grade product, not bulk construction clay.",
  },
  limePricePerBag: {
    value: 10,
    status: "pending-BI-confirmation" as const,
    note: "Type \"S\" mason's hydrated lime, 50lb bag (matches the spreadsheet's own \"Type 'S' Mason's Lime\" note) — ~$8-15/bag typical.",
  },
  strawPricePerCuFt: {
    value: 1.25,
    status: "pending-BI-confirmation" as const,
    note: "Derived from a typical $5-15 straw bale (~5.25 cu ft for a standard 14x18x36in 2-string bale) — the spreadsheet never gives chopped straw its own bag/bale purchase unit, so this app prices it directly by the cu ft.",
  },
  laborRatePerHour: {
    value: 45,
    status: "pending-BI-confirmation" as const,
    note: "Mid-range for skilled natural-plaster labor — published rates for plastering generally run ~$30-100/hr depending on region and finish difficulty.",
  },
};
