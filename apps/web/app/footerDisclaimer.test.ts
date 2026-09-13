import { describe, expect, it } from "vitest";
import { footerDisclaimerFor } from "./footerDisclaimer";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";

const roles = Object.keys(roleDisclaimers) as ViewerRole[];

describe("footerDisclaimerFor", () => {
  it("covers all four viewer roles", () => {
    expect(roles.sort()).toEqual(["admin", "engineer", "fabricator", "public"]);
  });

  it("returns each role's disclaimer verbatim — never a reworded or shortened copy", () => {
    for (const role of roles) {
      const shown = footerDisclaimerFor(role);
      // Same object, so the footer cannot drift from the title block's text.
      expect(shown).toBe(roleDisclaimers[role]);
      expect(shown.text).toBe(roleDisclaimers[role].text);
      expect(shown.label).toBe(roleDisclaimers[role].label);
    }
  });

  it("shows a different disclaimer for each role, so a role change is visible in the footer", () => {
    const texts = new Set(roles.map((role) => footerDisclaimerFor(role).text));
    expect(texts.size).toBe(roles.length);
  });
});
