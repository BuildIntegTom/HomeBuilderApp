import { describe, expect, it } from "vitest";
import {
  canActAs,
  computeEntitlements,
  defaultEntitlement,
  isAdminOfActingAsCompany,
  resolveActingAs,
  type CompanyRow,
  type MembershipRow,
} from "./actingAs";

// The four real companies (spec decision 16) plus one deliberately outside the
// consortium, because `is_seed_member = false` is the branch that has never run
// in production and is the one most likely to be got wrong.
const BI: CompanyRow = { id: "bi", name: "Building Integrity", isSeedMember: true, isConsortium: false };
const RF: CompanyRow = { id: "rf", name: "Rare Forms", isSeedMember: true, isConsortium: false };
const NF: CompanyRow = { id: "nf", name: "New Frameworks", isSeedMember: true, isConsortium: false };
const SEED: CompanyRow = { id: "seed", name: "The Seed Collaborative", isSeedMember: true, isConsortium: true };
const OUTSIDER: CompanyRow = { id: "out", name: "Outside Co", isSeedMember: false, isConsortium: false };

const ALL = [BI, RF, NF, SEED, OUTSIDER];

function member(companyId: string, isDefault = false): MembershipRow {
  return { companyId, level: "member", isDefault };
}
function admin(companyId: string, isDefault = false): MembershipRow {
  return { companyId, level: "admin", isDefault };
}

describe("computeEntitlements", () => {
  it("gives a member of a member company their own company plus the Seed Collaborative", () => {
    const entitlements = computeEntitlements({
      memberships: [member("bi", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(entitlements.map((e) => e.companyId)).toEqual(["bi", "seed"]);
    expect(entitlements[0]).toMatchObject({ source: "membership", level: "member", isDefault: true });
    // Acting as Seed without a Seed membership row confers no level there.
    expect(entitlements[1]).toMatchObject({ source: "consortium", level: null, isDefault: false });
  });

  it("gives a member of a NON-member company no path to the Seed Collaborative at all", () => {
    const entitlements = computeEntitlements({
      memberships: [member("out", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(entitlements.map((e) => e.companyId)).toEqual(["out"]);
    expect(canActAs(entitlements, "seed")).toBe(false);
  });

  it("does not duplicate the Seed entry for someone whose own company is the Seed Collaborative", () => {
    const entitlements = computeEntitlements({
      memberships: [member("seed", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(entitlements.map((e) => e.companyId)).toEqual(["seed"]);
    // It is theirs, not a browse entitlement — which is what makes "a Seed
    // member acting as Seed sees Seed's projects as their own" fall out later
    // rather than needing a special case.
    expect(entitlements[0].source).toBe("membership");
  });

  it("keeps level per membership: admin at one company, plain member at another", () => {
    const entitlements = computeEntitlements({
      memberships: [admin("bi", true), member("rf")],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(entitlements.map((e) => [e.companyId, e.level])).toEqual([
      ["bi", "admin"],
      ["rf", "member"],
      ["seed", null],
    ]);
    expect(isAdminOfActingAsCompany(entitlements[0])).toBe(true);
    expect(isAdminOfActingAsCompany(entitlements[1])).toBe(false);
    expect(isAdminOfActingAsCompany(entitlements[2])).toBe(false);
  });

  it("never invents an entitlement for a company you merely happen to be able to see", () => {
    // `companies` carries every row RLS let through. Seeing a name is not the
    // same as being allowed to act as it.
    const entitlements = computeEntitlements({
      memberships: [member("bi", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(canActAs(entitlements, "rf")).toBe(false);
    expect(canActAs(entitlements, "nf")).toBe(false);
    expect(canActAs(entitlements, "out")).toBe(false);
  });

  it("returns nothing for a signed-in user with zero memberships", () => {
    expect(
      computeEntitlements({ memberships: [], companies: ALL, isPlatformAdmin: false }),
    ).toEqual([]);
  });

  it("lets a platform admin act as any company, after their own", () => {
    const entitlements = computeEntitlements({
      memberships: [admin("bi", true)],
      companies: ALL,
      isPlatformAdmin: true,
    });

    expect(entitlements.map((e) => e.companyId)).toEqual(["bi", "seed", "nf", "out", "rf"]);
    expect(entitlements[0].source).toBe("membership");
    expect(entitlements[2].source).toBe("platform-admin");
    // Platform-admin reach is not a membership and carries no company level.
    expect(entitlements[2].level).toBeNull();
  });

  it("ignores a membership whose company row was not returned", () => {
    // A revoked or deleted company: the membership row may still be in hand
    // while the company is gone. It must not produce a nameless entitlement.
    const entitlements = computeEntitlements({
      memberships: [member("bi", true), member("ghost")],
      companies: [BI, SEED],
      isPlatformAdmin: false,
    });

    expect(entitlements.map((e) => e.companyId)).toEqual(["bi", "seed"]);
  });
});

describe("entitlements are not an authorization oracle", () => {
  // This block exists because of a real bug that reached two reviews.
  //
  // A route handler gated an operation on `session.entitlements`, reasoning that
  // it was about a company and entitlements are about companies. But
  // entitlements answer ONE question — "which company may I act as" — and they
  // are built from memberships. Any operation whose permission does not come
  // from a membership is refused by such a gate, silently and wrongly.
  //
  // The specific casualty: creating a company, where decision 27 says outright
  // that the creator gets no membership. Inviting the new company's first admin
  // 403'd for every user except a platform admin, who holds an entitlement to
  // every company — so the one account likely to hand-test it was the one
  // account for which it worked.
  //
  // These assertions pin the property that makes such a gate wrong, so the next
  // person who reaches for entitlements in a route sees why not.

  it("gives you nothing for a company you created but do not belong to", () => {
    // The founder's own view: they created OUTSIDER, hold no membership in it.
    const entitlements = computeEntitlements({
      memberships: [admin("bi", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(canActAs(entitlements, "out")).toBe(false);
    expect(entitlements.map((e) => e.companyId)).not.toContain("out");
  });

  it("gives a platform admin an entitlement to that same company", () => {
    // Which is exactly why an entitlement gate looks like it works when the
    // person testing it is the platform admin.
    const entitlements = computeEntitlements({
      memberships: [admin("bi", true)],
      companies: ALL,
      isPlatformAdmin: true,
    });

    expect(canActAs(entitlements, "out")).toBe(true);
    expect(entitlements.find((e) => e.companyId === "out")?.source).toBe("platform-admin");
  });

  it("says nothing about whether you may administer a company", () => {
    // An entitlement can carry level null (acting as the consortium without
    // being a member of it). "Has an entitlement" and "may administer" are
    // different questions and the first cannot answer the second.
    const entitlements = computeEntitlements({
      memberships: [member("bi", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    const seed = entitlements.find((e) => e.companyId === "seed");
    expect(canActAs(entitlements, "seed")).toBe(true);
    expect(seed?.level).toBeNull();
    expect(isAdminOfActingAsCompany(seed ?? null)).toBe(false);
  });
});

describe("defaultEntitlement", () => {
  it("follows memberships.is_default", () => {
    const entitlements = computeEntitlements({
      memberships: [member("bi"), member("rf", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(defaultEntitlement(entitlements)?.companyId).toBe("rf");
  });

  it("starts you acting as Seed when the Seed Collaborative IS your default company", () => {
    // Spec: "default seed flag status is off unless your default company is the
    // seed collaborative" — there is no separate toggle state to set here, the
    // default company simply is Seed.
    const entitlements = computeEntitlements({
      memberships: [member("bi"), member("seed", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(defaultEntitlement(entitlements)?.companyId).toBe("seed");
  });

  it("starts you acting as your own company, not Seed, when Seed is only an entitlement", () => {
    const entitlements = computeEntitlements({
      memberships: [member("bi", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(defaultEntitlement(entitlements)?.companyId).toBe("bi");
  });

  it("prefers a real membership over the consortium entry when no default is flagged", () => {
    const entitlements = computeEntitlements({
      memberships: [member("rf")].map((m) => ({ ...m, isDefault: false })),
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(defaultEntitlement(entitlements)?.companyId).toBe("rf");
  });

  it("is null when there is nothing to act as", () => {
    expect(defaultEntitlement([])).toBeNull();
  });
});

describe("resolveActingAs", () => {
  const entitlements = computeEntitlements({
    memberships: [member("bi", true), member("rf")],
    companies: ALL,
    isPlatformAdmin: false,
  });

  it("honours a claim the person actually holds", () => {
    const resolved = resolveActingAs(entitlements, "rf");
    expect(resolved).toMatchObject({ kind: "requested", companyId: "rf" });
  });

  it("honours a claim on the Seed Collaborative from a member company", () => {
    expect(resolveActingAs(entitlements, "seed")).toMatchObject({ kind: "requested", companyId: "seed" });
  });

  it("falls back to the default company when no claim is made", () => {
    expect(resolveActingAs(entitlements, null)).toMatchObject({ kind: "default", companyId: "bi" });
  });

  it("REFUSES a forged claim and reports what it refused", () => {
    // A client posting "I am acting as New Frameworks" straight at the API.
    const resolved = resolveActingAs(entitlements, "nf");
    expect(resolved.kind).toBe("fallback");
    expect(resolved).toMatchObject({ companyId: "bi", rejectedCompanyId: "nf" });
  });

  it("falls back cleanly when the acting-as membership is revoked mid-session", () => {
    // Same shape as a forgery from the resolver's point of view, which is the
    // point: the cookie is re-checked every request rather than trusted.
    const afterRevocation = computeEntitlements({
      memberships: [member("bi", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    const resolved = resolveActingAs(afterRevocation, "rf");
    expect(resolved).toMatchObject({ kind: "fallback", companyId: "bi", rejectedCompanyId: "rf" });
  });

  it("leaves a user with no memberships acting as nothing, rather than as someone", () => {
    expect(resolveActingAs([], "bi")).toEqual({ kind: "none", rejectedCompanyId: "bi" });
    expect(resolveActingAs([], null)).toEqual({ kind: "none", rejectedCompanyId: null });
  });

  it("still resolves for a user with exactly one entitlement", () => {
    // The switcher stays visible in this case; the resolution is not a special
    // case, only the rendering is.
    const single = computeEntitlements({
      memberships: [member("out", true)],
      companies: ALL,
      isPlatformAdmin: false,
    });

    expect(single).toHaveLength(1);
    expect(resolveActingAs(single, null)).toMatchObject({ kind: "default", companyId: "out" });
  });
});
