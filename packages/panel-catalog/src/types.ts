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

export type AssemblySide = "interior" | "exterior";

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
}
