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
}

export interface FastenerSpacingRow {
  connection: string;
  fastener: string;
  spacing: string;
  note?: string;
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
