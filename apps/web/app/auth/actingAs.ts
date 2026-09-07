/**
 * "Acting as" — the pure half.
 *
 * The spec's rule, which this file exists to hold in one testable place:
 *
 *   > The switcher selects among entitlements you already hold; it never
 *   > creates one.
 *
 * Nothing here talks to Supabase. It takes the rows a person actually has and
 * answers two questions: which companies may this person act as, and which one
 * are they acting as right now. `serverSession.ts` feeds it real rows;
 * `actingAs.test.ts` feeds it fixtures. The same rules are enforced a second
 * time in the database (`public.can_act_as`, supabase/migrations/0002) — this
 * is not the security boundary, it is the part the UI and the route handlers
 * agree on. If the two ever disagree, the database wins.
 */

export type MembershipLevel = "member" | "admin";

export interface CompanyRow {
  id: string;
  name: string;
  /** Consortium membership set (spec decision 19). */
  isSeedMember: boolean;
  /** Exactly one company is the consortium itself — The Seed Collaborative. */
  isConsortium: boolean;
}

export interface MembershipRow {
  companyId: string;
  level: MembershipLevel;
  /** `memberships.is_default` — drives the acting-as company at sign-in. */
  isDefault: boolean;
}

/**
 * How a person came to be allowed to act as a company. The distinction is not
 * cosmetic: `membership` means the company is yours, `consortium` means you are
 * a member of *a* member company and so may act as The Seed Collaborative
 * without holding a Seed membership row.
 */
export type EntitlementSource = "membership" | "consortium" | "platform-admin";

export interface Entitlement {
  companyId: string;
  companyName: string;
  source: EntitlementSource;
  /**
   * Your level *at that company*. Null when the entitlement does not come from
   * a membership — a Building Integrity member acting as Seed is not a Seed
   * member and holds no admin powers there.
   */
  level: MembershipLevel | null;
  /** True for the one company `memberships.is_default` points at. */
  isDefault: boolean;
}

export interface EntitlementInput {
  memberships: MembershipRow[];
  /** Every company row the caller can see. Extra rows are ignored, not trusted. */
  companies: CompanyRow[];
  isPlatformAdmin: boolean;
}

/**
 * Which companies may this person act as?
 *
 * Ordered for display: your own companies alphabetically, then the consortium
 * entry, then (platform admin only) everything else. The order is part of the
 * contract because the switcher renders it directly.
 */
export function computeEntitlements({
  memberships,
  companies,
  isPlatformAdmin,
}: EntitlementInput): Entitlement[] {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const entitlements: Entitlement[] = [];
  const seen = new Set<string>();

  const own = memberships
    .map((m) => ({ membership: m, company: byId.get(m.companyId) }))
    .filter((pair): pair is { membership: MembershipRow; company: CompanyRow } => Boolean(pair.company))
    .sort((a, b) => a.company.name.localeCompare(b.company.name));

  for (const { membership, company } of own) {
    entitlements.push({
      companyId: company.id,
      companyName: company.name,
      source: "membership",
      level: membership.level,
      isDefault: membership.isDefault,
    });
    seen.add(company.id);
  }

  // "Membership in any member company entitles you to act as the Seed
  // Collaborative." Being at Building Integrity is what puts the entry in front
  // of you. The false branch is real and deliberate: someone whose companies
  // all have isSeedMember = false gets no consortium entry at all, and there is
  // no client-side way to conjure one.
  const consortium = companies.find((c) => c.isConsortium);
  const seedEntitled = own.some(({ company }) => company.isSeedMember);
  if (consortium && seedEntitled && !seen.has(consortium.id)) {
    entitlements.push({
      companyId: consortium.id,
      companyName: consortium.name,
      source: "consortium",
      level: null,
      isDefault: false,
    });
    seen.add(consortium.id);
  }

  if (isPlatformAdmin) {
    for (const company of [...companies].sort((a, b) => a.name.localeCompare(b.name))) {
      if (seen.has(company.id)) continue;
      entitlements.push({
        companyId: company.id,
        companyName: company.name,
        source: "platform-admin",
        level: null,
        isDefault: false,
      });
      seen.add(company.id);
    }
  }

  return entitlements;
}

export function canActAs(entitlements: Entitlement[], companyId: string | null | undefined): boolean {
  if (!companyId) return false;
  return entitlements.some((e) => e.companyId === companyId);
}

/**
 * Which entitlement is the default one to land on at sign-in?
 *
 * `memberships.is_default` first — that is the column the spec puts in charge,
 * and it is what makes "the Seed toggle starts off unless the Seed Collaborative
 * is your default company" true without a special case. Failing that, the first
 * company you actually belong to; failing that, whatever you can act as at all.
 */
export function defaultEntitlement(entitlements: Entitlement[]): Entitlement | null {
  return (
    entitlements.find((e) => e.isDefault) ??
    entitlements.find((e) => e.source === "membership") ??
    entitlements[0] ??
    null
  );
}

export type ActingAsResolution =
  /** The client asked for a company it genuinely holds. */
  | { kind: "requested"; companyId: string; entitlement: Entitlement }
  /** Nothing was asked for; this is the default company. */
  | { kind: "default"; companyId: string; entitlement: Entitlement }
  /**
   * Something was asked for and refused — a forged value, or a membership
   * revoked mid-session. `rejectedCompanyId` is what was refused; the session
   * continues at `companyId`, which is a company the person really does hold.
   */
  | { kind: "fallback"; companyId: string; entitlement: Entitlement; rejectedCompanyId: string }
  /** No entitlements at all: a signed-in user with zero memberships. */
  | { kind: "none"; rejectedCompanyId: string | null };

/**
 * Resolve a *claimed* acting-as company against what the person actually holds.
 *
 * The claim arrives from the client (a cookie), so it is an input to be checked,
 * never a fact. Two different callers want two different things from a bad
 * claim, so this function reports rather than decides:
 *
 *  - a session read wants to carry on sensibly → use `kind === "fallback"`'s
 *    `companyId` and tell the user the switcher moved;
 *  - a write route wants to refuse → treat anything other than `"requested"`
 *    (when a claim was made) as a 403.
 */
export function resolveActingAs(
  entitlements: Entitlement[],
  requestedCompanyId: string | null | undefined,
): ActingAsResolution {
  const requested = requestedCompanyId
    ? entitlements.find((e) => e.companyId === requestedCompanyId)
    : undefined;

  if (requested) {
    return { kind: "requested", companyId: requested.companyId, entitlement: requested };
  }

  const fallback = defaultEntitlement(entitlements);
  if (!fallback) {
    return { kind: "none", rejectedCompanyId: requestedCompanyId ?? null };
  }

  if (requestedCompanyId) {
    return {
      kind: "fallback",
      companyId: fallback.companyId,
      entitlement: fallback,
      rejectedCompanyId: requestedCompanyId,
    };
  }

  return { kind: "default", companyId: fallback.companyId, entitlement: fallback };
}

/**
 * Is this person a company admin *of the company they are acting as*? Level is
 * per-membership (decision 1: admin at one company and a plain member at
 * another is normal), so this question can only be asked of a pair.
 */
export function isAdminOfActingAsCompany(entitlement: Entitlement | null): boolean {
  return entitlement?.source === "membership" && entitlement.level === "admin";
}
