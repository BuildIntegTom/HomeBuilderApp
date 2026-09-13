import { roleDisclaimers, type RoleDisclaimer, type ViewerRole } from "./viewerRole";

/** What the app footer shows for a viewer role: `roleDisclaimers[role]`,
 * verbatim, by reference. The footer relocates the disclaimer; it never
 * rewords it (spec: "Top Bar & App Chrome", the footer legal bar). Those
 * strings are the app's legal posture, so there is deliberately no
 * shortened, badge, or footer-specific variant here. The length problem
 * (~200 characters against a 24px strip with an 11px floor) is solved in
 * layout, in AppFooter, not by writing a second, shorter text. */
export function footerDisclaimerFor(role: ViewerRole): RoleDisclaimer {
  return roleDisclaimers[role];
}

/** The id tying the footer's expand button to the full-text panel it
 * controls (`aria-controls`). */
export const FOOTER_FULL_TEXT_ID = "app-footer-disclaimer-full-text";
