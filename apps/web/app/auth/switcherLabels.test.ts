import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Entitlement } from "./actingAs";
import { entitlementTag, switcherLabels } from "./switcherLabels";

const ent = (companyId: string, companyName: string, source: Entitlement["source"], level: Entitlement["level"] = null): Entitlement => ({
  companyId,
  companyName,
  source,
  level,
  isDefault: false,
  // Stage 4B: acting as the consortium is what offers the browse tab.
  isConsortium: source === "consortium",
});

describe("switcherLabels", () => {
  it("leaves an ordinary member's list exactly as it was", () => {
    expect(
      switcherLabels([ent("bi", "Building Integrity", "membership", "member"), ent("seed", "The Seed Collaborative", "consortium")]),
    ).toEqual(["Building Integrity", "The Seed Collaborative (consortium)"]);
  });

  it("keeps a company admin's own company unlabelled when it appears once", () => {
    expect(switcherLabels([ent("bi", "Building Integrity", "membership", "admin")])).toEqual(["Building Integrity"]);
  });

  it("keeps the platform admin tag on companies reached only as platform admin", () => {
    expect(
      switcherLabels([ent("bi", "Building Integrity", "membership", "admin"), ent("rf", "Rare Forms", "platform-admin")]),
    ).toEqual(["Building Integrity", "Rare Forms (platform admin)"]);
  });

  it("labels EVERY entry of a company that appears more than once, by source and level", () => {
    expect(
      switcherLabels([
        ent("bi", "Building Integrity", "membership", "admin"),
        ent("bi", "Building Integrity", "platform-admin"),
        ent("rf", "Rare Forms", "platform-admin"),
      ]),
    ).toEqual(["Building Integrity (company admin)", "Building Integrity (platform admin)", "Rare Forms (platform admin)"]);
    expect(
      switcherLabels([ent("bi", "Building Integrity", "membership", "member"), ent("bi", "Building Integrity", "membership", "admin")]),
    ).toEqual(["Building Integrity (member)", "Building Integrity (company admin)"]);
  });

  it("tags each source and level", () => {
    expect(entitlementTag(ent("x", "X", "membership", "admin"))).toBe("company admin");
    expect(entitlementTag(ent("x", "X", "membership", "member"))).toBe("member");
    expect(entitlementTag(ent("x", "X", "consortium"))).toBe("consortium");
    expect(entitlementTag(ent("x", "X", "platform-admin"))).toBe("platform admin");
  });

  it("returns nothing for no entitlements", () => {
    expect(switcherLabels([])).toEqual([]);
  });
});

describe("the session's memberships read", () => {
  // The duplicate entries Tommy saw came from here: memberships_select lets a
  // company admin and a platform admin read other people's rows, and the read
  // relied on RLS alone.
  it("filters memberships to the signed-in user rather than trusting RLS to", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, "serverSession.ts"), "utf8");
    expect(source).toMatch(/from\("memberships"\)\s*\.select\("company_id, level, is_default"\)\s*\.eq\("user_id", authUser\.id\)/);
  });
});
