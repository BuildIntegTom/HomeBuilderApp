export type CatalogStatus = "confirmed" | "pending-BI-confirmation";

/**
 * Wraps any spec-derived number/value with where it stands. `note` should
 * point back to the reason (spec quote, open item) so it's traceable.
 */
export interface CatalogValue<T> {
  value: T;
  status: CatalogStatus;
  note: string;
}

export type ConstructionMethod = "square-bale-reference" | "loose-dense-pack";

/** A min/max bound in inches — same traceability shape as `CatalogValue`,
 * just for a range instead of a single number (e.g. a manufacturer's
 * possible-panel-size spec sheet). */
export interface CatalogRange {
  minIn: number;
  maxIn: number;
  status: CatalogStatus;
  note: string;
}

/** Any structural figure (load-bearing, shear) with no real number yet —
 * unlike CatalogValue, there's deliberately no `value` field: inventing a
 * placeholder for straw-panel structural capacity (unlike, say, a
 * standard concrete/steel product) has no reasonable industry analog to
 * fall back on, so this just surfaces the open item honestly. */
export interface PanelStructuralStatus {
  status: CatalogStatus;
  note: string;
}

export interface PanelTypeDef {
  id:
    | "standard"
    | "corner"
    | "column"
    | "braced"
    | "header"
    | "sill"
    | "inclined-gable"
    | "gable"
    | "jack-stud"
    | "safety-gap";
  label: string;
  description: string;
  loadBearingCapacity: PanelStructuralStatus;
  shearValue: PanelStructuralStatus;
}

export interface FastenerSpacingRow {
  connection: string;
  fastener: string;
  spacing: string;
  note?: string;
}

export interface FoundationLoadPathStep {
  label: string;
  description: string;
  /** Matches a `connection` in `fastenerSpacingTable` when this step has a
   * modeled fastener — omitted for steps that aren't a fastened connection
   * (e.g. the pier itself) or whose fastener isn't modeled yet. */
  fastenerConnection?: string;
}

/** "both" is for accessory products (tapes) that aren't inherently
 * one-sided — Tommy: "also include Tescon Vana as a check mark," used to
 * seal interior membrane seams but conceptually available on either
 * checkbox list. */
export type AssemblySide = "interior" | "exterior" | "both";

/** How much of a checked product the current building needs, auto-derived
 * from its real geometry (Tommy: "when checked on a product, i want to
 * autofill the most efficient way to use that product in the house") —
 * present only on products with a computable purchase quantity; a plain
 * finish coat like clay/lime plaster has none (its material quantity is
 * already tracked by the separate Plaster Master calc). */
export type ProductCoverageRule =
  | { kind: "opening-sill-perimeter" }
  | { kind: "wall-and-roof-interior-surface" }
  | { kind: "seam-tape-for"; coveredProductId: string };

export interface WallAssemblyLayer {
  id: string;
  side: AssemblySide;
  label: string;
  /** Perm rating in winter/low-RH conditions, null if the spec gives no number for this layer. */
  permWinter: number | null;
  /** Perm rating in summer/high-RH conditions, null if fixed or unrated. */
  permSummer: number | null;
  status: CatalogStatus;
  note: string;
  coverageRule?: ProductCoverageRule;
  /** Roll width (in) — only for roll goods needing seam-count tiling
   * (Intello). Tape products (Exto Seal, Tescon Vana) don't need this;
   * they're purchased by linear length alone, not tiled. */
  rollWidthIn?: number;
  /** 3D Wraps view skin color (CSS color string) — omitted means this
   * product gets no on-screen overlay (e.g. Tescon Vana: quantity-only,
   * no continuous-seam 3D geometry in this first pass). */
  skinColor?: string;
}
