import { parseSaveTimestamp } from "../titleBlockDate";
import type { MembershipLevel } from "./actingAs";
import type { CompanyMemberSummary, MemberActionSummary } from "./types";

/**
 * The People & activity section: what each member's row says, and who may
 * change whose level. Pure, so every label and every permission-display rule is
 * testable without a browser, and imported by the members route too, so the
 * server's shape and the UI's wording cannot drift apart.
 *
 * Spec: "People & activity page (2026-09-20)", approved 2026-09-20 with all
 * five Open Items answered.
 *
 * Three rules this file exists to keep:
 *
 *  1. EVERY COUNT AND LIST IS PER COMPANY, AND SAYS SO. `project_versions_select`
 *     is `can_read_project`, so a company admin can only ever count a member's
 *     versions in that company's own projects. An unlabelled "total" would be
 *     silently wrong for everyone but a platform admin — the exact failure the
 *     flag convention exists to prevent.
 *  2. A NAME BESIDE AN ACTION COMES FROM THE `author_name` SNAPSHOT, never from
 *     a profile row looked up by `author_id`. Once a leaver's membership is
 *     revoked, `user_profiles_select` stops showing their profile to their
 *     former colleagues, so a join-on-read goes blank precisely when
 *     attribution matters (decision 6, and 0006's own comment). Actions are
 *     COUNTED by `author_id` (a uuid comparison needs no profile read) and
 *     LABELLED by `author_name`.
 *  3. NOTHING HERE DECIDES PERMISSION. Every button this file offers is also
 *     checked by the database — `memberships_update` (0002),
 *     `guard_membership_self_update` and `guard_last_company_admin` (0001) —
 *     and a refusal is shown in words rather than hidden behind a dead button.
 */

// ---------------------------------------------------------------------------
// Administrative caps. Neither is a building value.
// ---------------------------------------------------------------------------

/** How many recent actions a member's row offers. Spec: "Cap the action list at 5 per member". */
export const RECENT_ACTIONS_PER_MEMBER = 5;

/**
 * How many version rows one request reads to build every member's count and
 * recent actions. One read for the whole company rather than one per member.
 *
 * When a company has more versions than this, the scan is capped and the counts
 * it produces are LOWER BOUNDS. That is said out loud ("at least 1,000 versions
 * …") rather than shown as a total it is not.
 */
export const VERSION_SCAN_CAP = 1000;

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

/** A membership start the strict parser rejects. A visible gap, never today. */
export const MEMBER_SINCE_UNRECORDED = "Member since not recorded";

/** The few words the page carries about what "member since" actually measures. */
export const MEMBER_SINCE_NOTE =
  "“Member since” is when this membership started, not when the account was created. Someone removed and invited back dates from the new invite.";

/** The `kind` caveat, the same one Version history carries. */
export const ACTION_KIND_NOTE =
  "Saves and renames are the only things the app records. A rename is labelled from the version’s kind; it is not proof of what changed.";

/** Said once, because RLS decides it and an unlabelled total would be wrong. */
export function scopeNote(companyName: string): string {
  return `Counts and actions cover ${companyNameOrGap(companyName)}’s own projects only — not work done at another company, or on a project shared with this one.`;
}

/** `guard_last_company_admin` (0001), in plain words. */
export const LAST_ADMIN_REFUSAL = "A company must keep at least one admin. Promote someone else first.";

/** `guard_membership_self_update` (0001), in plain words. */
export const NOT_ADMIN_REFUSAL = "Only a company admin can change someone’s level.";

/** What Make admin grants, named before it is granted. Nothing here is undoable by accident. */
export const PROMOTE_GRANTS = "An admin can invite and remove people, change levels, and download the company backup.";

export const PROMOTE_LABEL = "Make admin";
export const DEMOTE_LABEL = "Remove admin";

/** A company name the session could not supply is a visible gap, never a blank. */
export function companyNameOrGap(name: string | null | undefined): string {
  return name && name.trim().length > 0 ? name : "this company";
}

/** An empty project name renders as a visible gap, as the cloud tree does. */
export function projectNameOrGap(name: string | null | undefined): string {
  return name && name.trim().length > 0 ? name : "(untitled)";
}

// ---------------------------------------------------------------------------
// "Member since"
// ---------------------------------------------------------------------------

/**
 * "Member since Sep 14, 2026" — the MEMBERSHIP's start, not the account's.
 *
 * A value the strict parser rejects shows the gap instead. It never collapses
 * to today: a tenure that reads as "since today" for a five-year member is the
 * same defect as a title block dating an old design with today's date.
 */
export function memberSinceLabel(createdAt: string | null | undefined): string {
  const date = parseSaveTimestamp(createdAt);
  if (!date) return MEMBER_SINCE_UNRECORDED;
  return `Member since ${date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
}

// ---------------------------------------------------------------------------
// "Edits", scoped honestly
// ---------------------------------------------------------------------------

/**
 * "3 versions saved in Building Integrity's projects."
 *
 * `exact` is false when the company has more versions than one scan reads, and
 * the label then says "at least", because the number is a floor rather than a
 * total.
 */
export function versionCountLabel(count: number, exact: boolean, companyName: string | null): string {
  const where = `in ${companyNameOrGap(companyName)}’s projects`;
  if (count === 0) {
    return exact
      ? `No versions saved ${where}`
      : `No versions among the most recent ${VERSION_SCAN_CAP} saved ${where}`;
  }
  const versions = count === 1 ? "1 version" : `${count} versions`;
  return exact ? `${versions} saved ${where}` : `At least ${versions} saved ${where}`;
}

// ---------------------------------------------------------------------------
// Action rows
// ---------------------------------------------------------------------------

/** "Saved Smith House v7" / "Renamed Smith House (v7)". */
export function actionTitle(action: Pick<MemberActionSummary, "kind" | "projectName" | "versionNumber">): string {
  const name = projectNameOrGap(action.projectName);
  // The new name lives in the document, which this page never reads. So a
  // rename is named by its project and labelled as a rename, rather than
  // guessing at what it was renamed to.
  return action.kind === "rename" ? `Renamed ${name} (v${action.versionNumber})` : `Saved ${name} v${action.versionNumber}`;
}

/** The action's date, or a visible gap if the stored timestamp is unusable. */
export function actionWhen(createdAt: string): string {
  const date = parseSaveTimestamp(createdAt);
  if (!date) return "date not recorded";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * The whole row: "Saved Smith House v7 · Sep 14, 2026".
 *
 * `recordedAs` is appended only when the snapshot name differs from the name
 * the person goes by now — it is the snapshot that is true about the save, and
 * it is never re-resolved from a profile.
 */
export function actionLine(action: MemberActionSummary, memberDisplayName?: string): string {
  const base = `${actionTitle(action)} · ${actionWhen(action.createdAt)}`;
  const snapshot = action.authorName.trim();
  if (!snapshot) return `${base} · author not recorded`;
  if (memberDisplayName && snapshot !== memberDisplayName.trim()) return `${base} · recorded as ${snapshot}`;
  return base;
}

/** "Latest actions (3)" / "No saves or renames here yet". */
export function actionsToggleLabel(count: number): string {
  return count === 0 ? "No saves or renames here yet" : `Latest actions (${count})`;
}

// ---------------------------------------------------------------------------
// Who may change whose level
// ---------------------------------------------------------------------------

/**
 * A company admin here — INCLUDING a platform admin acting as this company.
 *
 * This is the same question the memberships and invites policies ask
 * (`is_company_admin(company_id) or is_platform_admin()`), and the reason it is
 * not `actingAsLevel === "admin"` is the 2026-09-14 session-membership fix: a
 * platform admin holds no admin MEMBERSHIP at a company they administer by
 * platform right, so gating on the level alone hid the people list, the invite
 * form and now these buttons from them — invisibly, because everything looked
 * fine to everyone else.
 */
export function isAdminHereFor(view: {
  actingAsLevel: MembershipLevel | null;
  actingAsCompanyId: string | null;
  isPlatformAdmin: boolean;
}): boolean {
  return view.actingAsLevel === "admin" || (view.isPlatformAdmin && Boolean(view.actingAsCompanyId));
}

export type LevelControl =
  | { kind: "none" }
  | { kind: "promote"; label: string; confirm: string }
  | { kind: "demote"; label: string; refusal: string | null };

/**
 * Which level button a row shows, if any.
 *
 *  - Not an admin here: NONE. A plain member sees their own row and its stats,
 *    and no control at all — which is also what the database would tell them.
 *  - A member: Make admin, behind one confirmation naming what it grants.
 *  - An admin: Remove admin. Their own row included: a company admin may change
 *    their own level (`guard_membership_self_update` returns early for
 *    `is_company_admin(old.company_id)`), and the only thing standing in the way
 *    is the last-admin guard.
 *  - The last admin of the company: the button stays, with the refusal in words
 *    beside it. The database is still the one that refuses; this only means
 *    nobody has to press a button to find out.
 *
 * `adminCount` is the number of admins on the list as loaded. For a plain
 * member the list is their own row alone, but they get no control anyway.
 */
export function levelControl(
  member: Pick<CompanyMemberSummary, "level">,
  context: { isAdminHere: boolean; adminCount: number },
): LevelControl {
  if (!context.isAdminHere) return { kind: "none" };
  if (member.level === "member") return { kind: "promote", label: PROMOTE_LABEL, confirm: PROMOTE_GRANTS };
  return { kind: "demote", label: DEMOTE_LABEL, refusal: context.adminCount <= 1 ? LAST_ADMIN_REFUSAL : null };
}

export function adminCountOf(members: readonly Pick<CompanyMemberSummary, "level">[]): number {
  return members.filter((m) => m.level === "admin").length;
}

/** Whether the Remove button shows. Same gate as the level buttons. */
export function canRemoveMember(context: { isAdminHere: boolean }): boolean {
  return context.isAdminHere;
}

/**
 * A database refusal, in the words the page shows. The guards raise real
 * messages; these are the two a person can actually provoke from this page.
 */
export function levelErrorMessage(message: string | null | undefined): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("at least one admin")) return LAST_ADMIN_REFUSAL;
  if (text.includes("only a company admin")) return NOT_ADMIN_REFUSAL;
  return message && message.trim().length > 0 ? message : "Couldn’t change that level";
}

// ---------------------------------------------------------------------------
// Building the summaries (used by GET /api/companies/[id]/members)
// ---------------------------------------------------------------------------

export interface MembershipRowInput {
  id: string;
  user_id: string;
  level: MembershipLevel;
  created_at: string | null;
}

export interface ProfileRowInput {
  id: string;
  email: string | null;
  display_name: string | null;
}

export interface ProjectRowInput {
  id: string;
  name: string | null;
}

export interface VersionRowInput {
  id: string;
  project_id: string;
  author_id: string | null;
  /** The snapshot. The only source of a name beside an action. */
  author_name: string | null;
  kind: string;
  version_number: number;
  created_at: string;
}

function sortKey(createdAt: string): number {
  const date = parseSaveTimestamp(createdAt);
  return date ? date.getTime() : Number.NEGATIVE_INFINITY;
}

/**
 * Assemble one row per membership.
 *
 * `projects` is this company's projects, so a version belonging to any other
 * project is dropped here as well as by RLS — the per-company scoping is a
 * property of the data this builds from, not a filter someone has to remember.
 */
export function buildMemberSummaries(input: {
  memberships: readonly MembershipRowInput[];
  profiles: readonly ProfileRowInput[];
  projects: readonly ProjectRowInput[];
  versions: readonly VersionRowInput[];
  /** True when the version scan hit VERSION_SCAN_CAP, so counts are floors. */
  scanCapped: boolean;
}): CompanyMemberSummary[] {
  const profileById = new Map(input.profiles.map((p) => [p.id, p]));
  const projectNameById = new Map(input.projects.map((p) => [p.id, p.name ?? ""]));

  const inThisCompany = input.versions.filter((v) => projectNameById.has(v.project_id));
  const byAuthor = new Map<string, VersionRowInput[]>();
  for (const version of inThisCompany) {
    if (!version.author_id) continue; // a deleted account's uuid names nobody on this list
    const list = byAuthor.get(version.author_id);
    if (list) list.push(version);
    else byAuthor.set(version.author_id, [version]);
  }

  return input.memberships.map((membership) => {
    const profile = profileById.get(membership.user_id);
    const authored = byAuthor.get(membership.user_id) ?? [];
    const recent = [...authored]
      .sort((a, b) => sortKey(b.created_at) - sortKey(a.created_at))
      .slice(0, RECENT_ACTIONS_PER_MEMBER)
      .map(
        (v): MemberActionSummary => ({
          versionId: v.id,
          kind: v.kind === "rename" ? "rename" : "save",
          projectName: projectNameById.get(v.project_id) ?? "",
          versionNumber: v.version_number,
          createdAt: v.created_at,
          // The snapshot, never a profile read keyed by author_id.
          authorName: v.author_name ?? "",
        }),
      );

    return {
      membershipId: membership.id,
      userId: membership.user_id,
      email: profile?.email ?? "",
      displayName: profile?.display_name ?? "",
      level: membership.level,
      memberSince: membership.created_at ?? null,
      versionCount: authored.length,
      versionCountExact: !input.scanCapped,
      recentActions: recent,
    };
  });
}
