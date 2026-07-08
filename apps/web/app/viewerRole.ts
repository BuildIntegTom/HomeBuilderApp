export type ViewerRole = "public" | "fabricator" | "admin";

export interface RoleDisclaimer {
  label: string;
  text: string;
}

/** What the title-block disclaimer says for each viewer role. There's no
 * real login yet — this is a local "viewing as" toggle so the role-based
 * title-block distinction (Tommy's spec) can be previewed and reviewed
 * now, ahead of building actual fabricator/admin accounts. */
export const roleDisclaimers: Record<ViewerRole, RoleDisclaimer> = {
  public: {
    label: "Public",
    text: "Reference-only. Not engineered, not fabricator-produced. For discussion with a licensed professional before construction.",
  },
  fabricator: {
    label: "Fabricator",
    text: "Fabricator proposal — Building Integrity. Not yet engineer-stamped; do not construct from this document alone.",
  },
  admin: {
    label: "Admin",
    text: "Internal admin view — fabricator proposal, not yet engineer-stamped. Catalog status shown inline throughout.",
  },
};
