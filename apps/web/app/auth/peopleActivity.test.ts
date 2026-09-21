import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ACTION_KIND_NOTE,
  LAST_ADMIN_REFUSAL,
  MEMBER_SINCE_NOTE,
  MEMBER_SINCE_UNRECORDED,
  NOT_ADMIN_REFUSAL,
  PROMOTE_GRANTS,
  RECENT_ACTIONS_PER_MEMBER,
  VERSION_SCAN_CAP,
  actionLine,
  actionTitle,
  actionsToggleLabel,
  adminCountOf,
  buildMemberSummaries,
  canRemoveMember,
  isAdminHereFor,
  levelControl,
  levelErrorMessage,
  memberSinceLabel,
  scopeNote,
  versionCountLabel,
  type MembershipRowInput,
  type VersionRowInput,
} from "./peopleActivity";
import type { CompanyMemberSummary } from "./types";

const here = dirname(fileURLToPath(import.meta.url));
const source = (path: string) => readFileSync(join(here, path), "utf8");

// ---------------------------------------------------------------------------
// "Member since" — the membership's start, and never today
// ---------------------------------------------------------------------------

describe("memberSinceLabel", () => {
  it("reads the membership's own start date", () => {
    const label = memberSinceLabel("2026-09-14T13:05:41.611591+00:00");
    expect(label.startsWith("Member since ")).toBe(true);
    expect(label).toContain("2026");
  });

  it("formats a PostgREST timestamp the same way a plain date is formatted", () => {
    expect(memberSinceLabel("2026-09-14T00:00:00.000000+00:00").length).toBeGreaterThan("Member since ".length);
    expect(memberSinceLabel("2026-09-14")).toBe(
      `Member since ${new Date(2026, 8, 14).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}`,
    );
  });

  it.each([
    ["a date the strict parser rejects", "14/09/2026"],
    ["an impossible calendar date", "2026-02-30"],
    ["a bare year", "2026"],
    ["a timestamp with no zone", "2026-09-14T13:05:41"],
    ["an empty string", ""],
    ["null", null],
    ["undefined", undefined],
  ])("shows a visible gap for %s, never today's date", (_case, value) => {
    const label = memberSinceLabel(value as string | null | undefined);
    expect(label).toBe(MEMBER_SINCE_UNRECORDED);
    // The defect this prevents: a five-year member's row reading "since today".
    const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    expect(label).not.toContain(today);
  });

  it("says on the page that this is the membership's start and that a re-invite resets it", () => {
    expect(MEMBER_SINCE_NOTE).toContain("membership started");
    expect(MEMBER_SINCE_NOTE).toContain("not when the account was created");
    expect(MEMBER_SINCE_NOTE.toLowerCase()).toContain("invited back");
  });
});

// ---------------------------------------------------------------------------
// Counts are per company, and say so
// ---------------------------------------------------------------------------

describe("versionCountLabel", () => {
  it("names the company every count belongs to", () => {
    expect(versionCountLabel(3, true, "Building Integrity")).toBe(
      "3 versions saved in Building Integrity’s projects",
    );
    expect(versionCountLabel(1, true, "Rare Forms")).toBe("1 version saved in Rare Forms’s projects");
    expect(versionCountLabel(0, true, "Rare Forms")).toBe("No versions saved in Rare Forms’s projects");
  });

  it("never presents a count as a bare total", () => {
    for (const count of [0, 1, 7]) {
      expect(versionCountLabel(count, true, "Building Integrity")).toContain("Building Integrity");
      expect(versionCountLabel(count, true, "Building Integrity")).not.toMatch(/\btotal\b/i);
    }
  });

  it("says 'at least' when the scan was capped, because the number is a floor", () => {
    expect(versionCountLabel(12, false, "Building Integrity")).toBe(
      "At least 12 versions saved in Building Integrity’s projects",
    );
    expect(versionCountLabel(0, false, "Building Integrity")).toContain(`most recent ${VERSION_SCAN_CAP}`);
  });

  it("shows a gap rather than a blank when the company name is missing", () => {
    expect(versionCountLabel(2, true, null)).toBe("2 versions saved in this company’s projects");
  });

  it("states the scope in words on the page too", () => {
    const note = scopeNote("Building Integrity");
    expect(note).toContain("Building Integrity");
    expect(note).toContain("own projects only");
    expect(note).toContain("shared");
  });
});

// ---------------------------------------------------------------------------
// Action rows: saves and renames only, labelled, never trusted
// ---------------------------------------------------------------------------

const action = (over: Partial<Parameters<typeof actionLine>[0]> = {}) => ({
  versionId: "v1",
  kind: "save" as const,
  projectName: "Smith House",
  versionNumber: 7,
  createdAt: "2026-09-14T13:05:41.611591+00:00",
  authorName: "Virgil",
  ...over,
});

describe("action rows", () => {
  it("labels a save with its project and version", () => {
    expect(actionTitle(action())).toBe("Saved Smith House v7");
  });

  it("labels a rename as a rename rather than collapsing it into a save", () => {
    expect(actionTitle(action({ kind: "rename" }))).toBe("Renamed Smith House (v7)");
    expect(ACTION_KIND_NOTE).toContain("not proof of what changed");
  });

  it("carries the kind caveat and says saves and renames are all that is recorded", () => {
    expect(ACTION_KIND_NOTE.toLowerCase()).toContain("saves and renames are the only things");
  });

  it("shows a visible gap for a project with no name", () => {
    expect(actionTitle(action({ projectName: "" }))).toBe("Saved (untitled) v7");
  });

  it("shows a visible gap for an unusable timestamp instead of today", () => {
    expect(actionLine(action({ createdAt: "whenever" }))).toContain("date not recorded");
  });

  it("uses the author_name snapshot when it differs from the person's current name", () => {
    expect(actionLine(action({ authorName: "V. Ramirez" }), "Virgil")).toContain("recorded as V. Ramirez");
    expect(actionLine(action({ authorName: "Virgil" }), "Virgil")).not.toContain("recorded as");
  });

  it("says so when even the snapshot is empty, rather than inventing a name", () => {
    expect(actionLine(action({ authorName: "" }), "Virgil")).toContain("author not recorded");
  });

  it("offers an honest empty state", () => {
    expect(actionsToggleLabel(0)).toBe("No saves or renames here yet");
    expect(actionsToggleLabel(3)).toBe("Latest actions (3)");
  });
});

// ---------------------------------------------------------------------------
// Who sees which button
// ---------------------------------------------------------------------------

const PLATFORM_ADMIN_AT_RF = { actingAsLevel: null, actingAsCompanyId: "rf", isPlatformAdmin: true };
const COMPANY_ADMIN = { actingAsLevel: "admin" as const, actingAsCompanyId: "bi", isPlatformAdmin: false };
const PLAIN_MEMBER = { actingAsLevel: "member" as const, actingAsCompanyId: "bi", isPlatformAdmin: false };

const member = (over: Partial<CompanyMemberSummary> = {}): CompanyMemberSummary => ({
  membershipId: "m1",
  userId: "u1",
  email: "m@bi.test",
  displayName: "M",
  level: "member",
  memberSince: "2026-09-14T13:05:41.611591+00:00",
  versionCount: 3,
  versionCountExact: true,
  recentActions: [],
  ...over,
});

describe("isAdminHereFor", () => {
  it("is true for a company admin at the company they are acting as", () => {
    expect(isAdminHereFor(COMPANY_ADMIN)).toBe(true);
  });

  it("is true for a platform admin acting as a company they hold no membership at", () => {
    // THE MUTATION CHECK. Gating on `actingAsLevel === "admin"` instead of this
    // passes every other test in this file and hides the whole section from a
    // platform admin — the 2026-09-14 bug, invisible to everyone else.
    expect(isAdminHereFor(PLATFORM_ADMIN_AT_RF)).toBe(true);
    expect(PLATFORM_ADMIN_AT_RF.actingAsLevel === "admin").toBe(false);
  });

  it("is false for a plain member, and for a platform admin acting as nobody", () => {
    expect(isAdminHereFor(PLAIN_MEMBER)).toBe(false);
    expect(isAdminHereFor({ actingAsLevel: null, actingAsCompanyId: null, isPlatformAdmin: true })).toBe(false);
  });
});

describe("levelControl", () => {
  const asAdmin = { isAdminHere: true, adminCount: 2 };

  it("offers Make admin on a member's row, behind a confirmation naming what it grants", () => {
    const control = levelControl(member({ level: "member" }), asAdmin);
    expect(control.kind).toBe("promote");
    if (control.kind !== "promote") throw new Error("unreachable");
    expect(control.label).toBe("Make admin");
    expect(control.confirm).toBe(PROMOTE_GRANTS);
    expect(PROMOTE_GRANTS).toContain("invite and remove people");
    expect(PROMOTE_GRANTS).toContain("company backup");
  });

  it("offers Remove admin on an admin's row when another admin remains", () => {
    const control = levelControl(member({ level: "admin" }), asAdmin);
    expect(control).toEqual({ kind: "demote", label: "Remove admin", refusal: null });
  });

  it("shows the last admin the refusal in words instead of a dead button", () => {
    const control = levelControl(member({ level: "admin" }), { isAdminHere: true, adminCount: 1 });
    if (control.kind !== "demote") throw new Error("unreachable");
    expect(control.refusal).toBe(LAST_ADMIN_REFUSAL);
    expect(control.refusal).toContain("keep at least one admin");
    expect(control.refusal).toContain("Promote someone else first");
    // The button is still offered: the database is the one that refuses.
    expect(control.label).toBe("Remove admin");
  });

  it("lets a company admin demote themselves when another admin exists", () => {
    // guard_membership_self_update returns early for is_company_admin, so an
    // admin's own row is not a special case — only the last-admin guard is.
    expect(levelControl(member({ level: "admin", membershipId: "mine" }), asAdmin).kind).toBe("demote");
  });

  it("gives a plain member no level button on any row, their own included", () => {
    const notAdmin = { isAdminHere: false, adminCount: 1 };
    expect(levelControl(member({ level: "member" }), notAdmin)).toEqual({ kind: "none" });
    expect(levelControl(member({ level: "admin" }), notAdmin)).toEqual({ kind: "none" });
    expect(canRemoveMember(notAdmin)).toBe(false);
  });

  it("gives a platform admin acting as a company the same buttons as a company admin", () => {
    const context = { isAdminHere: isAdminHereFor(PLATFORM_ADMIN_AT_RF), adminCount: 2 };
    expect(levelControl(member({ level: "member" }), context).kind).toBe("promote");
    expect(canRemoveMember(context)).toBe(true);
  });

  it("counts the admins on the list as loaded", () => {
    expect(adminCountOf([member({ level: "admin" }), member({ level: "member" }), member({ level: "admin" })])).toBe(2);
  });
});

describe("levelErrorMessage", () => {
  it("turns the last-admin guard into the page's own words", () => {
    expect(levelErrorMessage("a company must keep at least one admin")).toBe(LAST_ADMIN_REFUSAL);
  });

  it("turns the self-update guard into plain words", () => {
    expect(levelErrorMessage("only a company admin can change a membership's level")).toBe(NOT_ADMIN_REFUSAL);
  });

  it("passes anything else through rather than inventing a reason", () => {
    expect(levelErrorMessage("You can't change that membership")).toBe("You can't change that membership");
    expect(levelErrorMessage(null)).toBe("Couldn’t change that level");
  });
});

// ---------------------------------------------------------------------------
// Building the rows: per-company scoping, and the leaver trap
// ---------------------------------------------------------------------------

const MEMBERSHIPS: MembershipRowInput[] = [
  { id: "m1", user_id: "u1", level: "admin", created_at: "2026-09-01T10:00:00+00:00" },
  { id: "m2", user_id: "u2", level: "member", created_at: "2026-09-14T10:00:00+00:00" },
];

const version = (over: Partial<VersionRowInput> = {}): VersionRowInput => ({
  id: "v1",
  project_id: "p1",
  author_id: "u1",
  author_name: "Alice",
  kind: "save",
  version_number: 1,
  created_at: "2026-09-10T10:00:00+00:00",
  ...over,
});

describe("buildMemberSummaries", () => {
  const base = {
    memberships: MEMBERSHIPS,
    profiles: [
      { id: "u1", email: "a@bi.test", display_name: "Alice" },
      { id: "u2", email: "b@bi.test", display_name: "Bob" },
    ],
    projects: [{ id: "p1", name: "Smith House" }],
    scanCapped: false,
  };

  it("counts each person's versions and carries their membership start", () => {
    const rows = buildMemberSummaries({
      ...base,
      versions: [version({ id: "a" }), version({ id: "b", version_number: 2 }), version({ id: "c", author_id: "u2" })],
    });
    expect(rows.map((r) => [r.email, r.versionCount])).toEqual([
      ["a@bi.test", 2],
      ["b@bi.test", 1],
    ]);
    expect(rows[1].memberSince).toBe("2026-09-14T10:00:00+00:00");
    expect(rows[0].level).toBe("admin");
  });

  it("does NOT count a version in another company's project", () => {
    // The per-company rule, working: `projects` is this company's projects, so
    // a version from a project shared with this company — or from the author's
    // work at another company — is not in this count.
    const rows = buildMemberSummaries({
      ...base,
      versions: [version({ id: "mine" }), version({ id: "elsewhere", project_id: "other-company-project" })],
    });
    expect(rows[0].versionCount).toBe(1);
    expect(rows[0].recentActions.map((a) => a.versionId)).toEqual(["mine"]);
  });

  it("marks the count inexact when the scan was capped", () => {
    const rows = buildMemberSummaries({ ...base, versions: [version()], scanCapped: true });
    expect(rows[0].versionCountExact).toBe(false);
    expect(versionCountLabel(rows[0].versionCount, rows[0].versionCountExact, "Building Integrity")).toContain(
      "At least",
    );
  });

  it("lists the newest actions first and caps them", () => {
    const versions = Array.from({ length: RECENT_ACTIONS_PER_MEMBER + 3 }, (_, i) =>
      version({ id: `v${i}`, version_number: i + 1, created_at: `2026-09-0${(i % 9) + 1}T10:00:00+00:00` }),
    );
    const rows = buildMemberSummaries({ ...base, versions });
    expect(rows[0].recentActions).toHaveLength(RECENT_ACTIONS_PER_MEMBER);
    const times = rows[0].recentActions.map((a) => a.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("labels an action from the author_name snapshot, not from the profile row", () => {
    const rows = buildMemberSummaries({
      ...base,
      // The person has since renamed themselves; the snapshot is what was true
      // when they saved, and it is what the row shows.
      versions: [version({ author_name: "A. Smith" })],
    });
    expect(rows[0].recentActions[0].authorName).toBe("A. Smith");
    expect(rows[0].displayName).toBe("Alice");
  });

  it("ignores a version whose author id names nobody", () => {
    const rows = buildMemberSummaries({ ...base, versions: [version({ author_id: null })] });
    expect(rows.every((r) => r.versionCount === 0)).toBe(true);
  });

  it("leaves a leaver off the list while their work keeps their name", () => {
    // A leaver has no membership, so no row. The version they authored is still
    // there, still carrying author_name — it is simply nobody's row on a list
    // built from memberships.
    const rows = buildMemberSummaries({ ...base, versions: [version({ author_id: "gone", author_name: "Nick" })] });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.recentActions.length === 0)).toBe(true);
  });

  it("shows a gap rather than a blank for a member with no readable profile", () => {
    const rows = buildMemberSummaries({ ...base, profiles: [], versions: [] });
    expect(rows[0].email).toBe("");
    expect(rows[0].displayName).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Source-level rules (the style sharingRouteLogic.test.ts established)
// ---------------------------------------------------------------------------

describe("the rules this page must not break", () => {
  const routeSource = source("../api/companies/[id]/members/route.ts");
  const panelSource = source("./AccountPanel.tsx");
  const moduleSource = source("./peopleActivity.ts");

  it("never resolves an action's author id to a profile row", () => {
    // The leaver trap (decision 6). The only user_profiles read is keyed by the
    // membership user ids the database just returned, never by author_id.
    const reads = routeSource.match(/from\("user_profiles"\)[\s\S]{0,200}/g) ?? [];
    expect(reads).toHaveLength(1);
    expect(reads[0]).toContain('.in("id", userIds)');
    expect(reads[0]).not.toContain("author");
    expect(moduleSource).not.toContain('from("user_profiles")');
  });

  it("never selects a document", () => {
    const selects = routeSource.match(/\.select\([^)]*\)/g) ?? [];
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) expect(select).not.toContain("document");
  });

  it("scopes the version scan to this company's projects, by id and not by string splicing", () => {
    expect(routeSource).toContain('.eq("company_id", companyId)');
    expect(routeSource).toContain('.in("project_id", projectIds)');
    expect(routeSource).toContain(".limit(VERSION_SCAN_CAP)");
  });

  it("uses the session client and asks the policies, not the entitlements", () => {
    // Both words appear in the route's own comment explaining why it does NOT
    // use them, so this asks about the code rather than the prose.
    const code = routeSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).toContain("await requireSession()");
    expect(code).not.toContain("requireEntitlement");
    expect(code).not.toContain("entitlements");
    // The admin client would bypass the boundary this page relies on.
    expect(code).not.toContain("service_role");
    expect(code).not.toContain("AdminClient");
  });

  it("adds no route for promotion: the panel calls the one that already took a level", () => {
    expect(panelSource).toContain("/api/memberships/${membershipId}");
    expect(panelSource).toContain('JSON.stringify({ level })');
  });

  it("gates the buttons on isAdminHereFor rather than on the acting-as level", () => {
    expect(panelSource).toContain("isAdminHereFor({");
    expect(panelSource).not.toContain('session.actingAsLevel === "admin"');
  });
});
