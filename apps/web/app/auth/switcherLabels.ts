import type { Entitlement } from "./actingAs";

/**
 * The acting-as switcher's option labels, one per entitlement, in order.
 *
 * A company that appears once keeps the label it always had: the plain name
 * for your own company, "(consortium)" or "(platform admin)" otherwise, so an
 * ordinary member's list stays uncluttered.
 *
 * A company that appears more than once (same company id) gets EVERY entry
 * tagged by where it comes from: "(company admin)", "(member)",
 * "(consortium)" or "(platform admin)". `computeEntitlements` gives each
 * company one entry, so this should not happen; it did in production while
 * loadSession read other people's membership rows, and if it ever happens
 * again two identical names are the worst way to show it.
 */
export function entitlementTag(entitlement: Entitlement): string {
  switch (entitlement.source) {
    case "consortium":
      return "consortium";
    case "platform-admin":
      return "platform admin";
    default:
      return entitlement.level === "admin" ? "company admin" : "member";
  }
}

export function switcherLabels(entitlements: Entitlement[]): string[] {
  const counts = new Map<string, number>();
  for (const e of entitlements) counts.set(e.companyId, (counts.get(e.companyId) ?? 0) + 1);
  return entitlements.map((e) => {
    if ((counts.get(e.companyId) ?? 0) > 1) return `${e.companyName} (${entitlementTag(e)})`;
    // Said plainly rather than implied by styling: acting as the consortium
    // without being a member of it is a different thing from acting as your own
    // company, and from Stage 4 it is what shows you other companies' work.
    return e.source === "membership" ? e.companyName : `${e.companyName} (${entitlementTag(e)})`;
  });
}
