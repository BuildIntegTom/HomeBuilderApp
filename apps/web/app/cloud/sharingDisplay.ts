import { parseSaveTimestamp } from "../titleBlockDate";
import {
  FOLDER_LABEL,
  type AccessGrantRow,
  type CloudFolder,
  type CompanyShareStatus,
  type PersonShareStatus,
  type SharedProjectRow,
  type SharedReach,
} from "./cloudTypes";

/**
 * Stage 3B's words: the Shared tab, the access list, the share form, and the
 * answers a share gets. Pure, so every label is testable without a browser,
 * and imported by the routes too, so the server's messages and the UI's
 * wording cannot drift apart.
 *
 * Spec: "Stage 3 plan — Collaboration" → "Who sees what", "Folder moves by a
 * collaborator", "Saving as a collaborator", "The owner's access list, and
 * sharing UI". It decides NOTHING about permission: every Remove it offers is
 * also checked by the database (collaborators_delete), and a refusal is shown.
 */

// ---------------------------------------------------------------------------
// The Shared tab
// ---------------------------------------------------------------------------

export const SHARED_TAB_LABEL = "Shared with us";

/** "shared with you by Bob" / "shared with Rare Forms by Bob" / "you created it". */
export function reachText(reach: SharedReach): string {
  if (reach.via === "creator") return "you created it";
  const by = reach.grantedByName ?? "someone";
  if (reach.via === "person") return `shared with you by ${by}`;
  return `shared with ${reach.granteeName} by ${by}`;
}

/**
 * Every way the project reached you, oldest first, as one line. A project
 * shared with you personally AND with your company is listed once, with both
 * reasons (3B edge case). Identical wordings collapse.
 */
export function reachSummary(reachedVia: readonly SharedReach[]): string {
  const seen: string[] = [];
  for (const reach of reachedVia) {
    const text = reachText(reach);
    if (!seen.includes(text)) seen.push(text);
  }
  return seen.join(" · ");
}

/** The owner's filing, which is the only filing a shared project has (11). */
export function ownerFilingText(ownerCompanyName: string, folder: CloudFolder): string {
  return `Owned by ${ownerNameOrGap(ownerCompanyName)} › ${FOLDER_LABEL[folder]}`;
}

/** "Owned by Building Integrity › Proposals · shared with you by Bob". */
export function sharedRowDetail(row: Pick<SharedProjectRow, "ownerCompanyName" | "folder" | "reachedVia">): string {
  const reasons = reachSummary(row.reachedVia);
  const filing = ownerFilingText(row.ownerCompanyName, row.folder);
  return reasons ? `${filing} · ${reasons}` : filing;
}

/** The Move to… picker's heading, so nobody thinks they are filing into their own company. */
export function refileHeading(ownerCompanyName: string): string {
  return `Refile in ${ownerNameOrGap(ownerCompanyName)}'s folders`;
}

export const SHARED_EMPTY_MESSAGE = "Nothing is shared with you here yet.";
export const SHARED_OTHER_COMPANIES_MESSAGE = "Projects shared with your other companies appear when you act as them.";

/**
 * The empty state. The second sentence only when there IS another company to
 * act as: a company grant to one of them is not listed under this one.
 */
export function sharedEmptyLines(entitlementCount: number): string[] {
  return entitlementCount > 1 ? [SHARED_EMPTY_MESSAGE, SHARED_OTHER_COMPANIES_MESSAGE] : [SHARED_EMPTY_MESSAGE];
}

/** An owner name the helper could not return is a visible gap, never a blank. */
export function ownerNameOrGap(name: string | null | undefined): string {
  return name && name.trim().length > 0 ? name : "(owner name not available)";
}

// ---------------------------------------------------------------------------
// The access list
// ---------------------------------------------------------------------------

/** The fixed first line, with no control (answer 14). */
export function ownerAccessLine(ownerCompanyName: string): string {
  const owner = ownerNameOrGap(ownerCompanyName);
  return `${owner} owns this project. Every ${owner} member has access, and only a platform admin can delete it.`;
}

export const NAMES_AS_SHARED_NOTE = "Names are as they were when each share was made.";

/** "Sep 14, 2026". A date the strict parser rejects says so. */
export function grantDate(createdAt: string): string {
  const date = parseSaveTimestamp(createdAt);
  if (!date) return "date not recorded";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export interface AccessRowText {
  /** The grantee, as shared. */
  name: string;
  /** "(person)", "(company: every current and future member)", or "" for a creator. */
  kindNote: string;
  /** "shared by Bob · Sep 14, 2026" or "created this project". */
  detail: string;
}

/**
 * One access-list row:
 *   "Frank (person) — shared by Bob · Sep 14, 2026"
 *   "Rare Forms (company: every current and future member) — shared by Bob · Sep 14, 2026"
 *   "Dave — created this project"
 * "shared by Frank" makes NO claim about whether Frank still has access
 * (Open Item 1, as corrected by the 3A review): nothing an ordinary member can
 * read supports that claim either way.
 */
export function accessRowText(row: Pick<AccessGrantRow, "kind" | "granteeKind" | "granteeName" | "granteeIsConsortium" | "grantedByName" | "createdAt">): AccessRowText {
  if (row.kind === "creator") return { name: row.granteeName, kindNote: "", detail: "created this project" };
  const kindNote =
    row.granteeKind === "person"
      ? "(person)"
      : row.granteeIsConsortium
        ? `(company: ${row.granteeName}'s own members, not the whole co-operative)`
        : "(company: every current and future member)";
  return { name: row.granteeName, kindNote, detail: `shared by ${row.grantedByName ?? "someone"} · ${grantDate(row.createdAt)}` };
}

export function accessRowLine(row: Parameters<typeof accessRowText>[0]): string {
  const t = accessRowText(row);
  return `${t.name}${t.kindNote ? ` ${t.kindNote}` : ""} — ${t.detail}`;
}

/**
 * Whether to show Remove. Only where the database would allow it: an owner
 * member or platform admin (any grant), or the person who made this grant.
 * The route computes `canRemove` from the verified session; this is the one
 * place the UI reads it, so a test can pin that nothing else shows the button.
 */
export function showRemove(row: Pick<AccessGrantRow, "canRemove">): boolean {
  return row.canRemove === true;
}

export const REMOVE_REFUSED_MESSAGE = "You can remove only the shares you made, or this share is already gone. Nothing was changed.";

export interface CascadeOffer {
  /** The grants that would also be removed: exactly the ones on screen. */
  grantIds: string[];
  /** "Also remove the 1 share Frank made" */
  label: string;
  /** Who those shares went to, as shared. */
  recipients: string[];
  /** Pre-ticked (Open Item 1, Tommy 2026-09-14). */
  defaultChecked: true;
}

/**
 * Removing a PERSONAL grant offers to remove the shares that person made on
 * this project too, pre-ticked. Removing a company grant offers nothing:
 * `granted_by` records a person, not the company they acted through.
 *
 * Only shares the remover could actually remove are offered (for a
 * collaborator removing their own grant to Frank, Frank's shares are not
 * theirs to remove), and only the ones on screen, so nothing the remover never
 * saw is removed.
 */
export function cascadeOffer(row: AccessGrantRow, grants: readonly AccessGrantRow[]): CascadeOffer | null {
  if (row.granteeKind !== "person") return null;
  const made = new Set(row.sharesMadeByGrantee);
  const offered = grants.filter((g) => g.grantId !== row.grantId && made.has(g.grantId) && g.canRemove);
  if (offered.length === 0) return null;
  const n = offered.length;
  return {
    grantIds: offered.map((g) => g.grantId),
    label: `Also remove the ${n === 1 ? "1 share" : `${n} shares`} ${row.granteeName} made`,
    recipients: offered.map((g) => g.granteeName),
    defaultChecked: true,
  };
}

/** What a successful removal says. Claims nothing about other ways in. */
export function removedMessage(granteeName: string, alsoRemoved: number, alsoNotRemoved: number): string {
  const parts = [`Removed the share with ${granteeName}.`];
  if (alsoRemoved > 0) parts.push(`Also removed ${alsoRemoved === 1 ? "1 share" : `${alsoRemoved} shares`} they made.`);
  if (alsoNotRemoved > 0) {
    parts.push(`${alsoNotRemoved === 1 ? "1 share they made was" : `${alsoNotRemoved} shares they made were`} already gone or not yours to remove.`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// The share form, and what a share answers
// ---------------------------------------------------------------------------

export const SHARE_ACCESS_LINE = "They get full edit access, costs included, and can share it onward.";

/** The company line: the Seed wording for a grant to the consortium company. */
export function companyShareLine(companyName: string, isConsortium: boolean): string {
  return isConsortium
    ? `${companyName}'s own members, not the whole co-operative.`
    : `…every current and future member of ${companyName}.`;
}

export const NO_ACCOUNT_MESSAGE = "No account uses that email. Invite them to a company first; nothing was shared.";

export interface ShareMessageContext {
  /** The grantee's name as the grant recorded it, or what was typed/picked. */
  target: string;
  ownerCompanyName: string;
}

export function shareStatusMessage(kind: "person" | "company", status: PersonShareStatus | CompanyShareStatus, ctx: ShareMessageContext): string {
  const owner = ownerNameOrGap(ctx.ownerCompanyName);
  switch (status) {
    case "shared":
      return `Shared with ${ctx.target}.`;
    case "already-shared":
      return `It's already shared with ${ctx.target}. Nothing was changed; the original share stands.`;
    case "no-account":
      return NO_ACCOUNT_MESSAGE;
    case "self":
      return "That's your own email, and you already have access. Nothing was shared.";
    case "already-member":
      return `They're a ${owner} member and already have access.`;
    case "owner-company":
      return `${owner} owns this project, so its members already have access. Nothing was shared.`;
    case "not-shareable":
      return kind === "company" ? "That company isn't one you can share with. Nothing was shared." : "Nothing was shared.";
  }
}

export const PERSON_SHARE_STATUSES: readonly PersonShareStatus[] = ["shared", "already-shared", "no-account", "self", "already-member"];
export const COMPANY_SHARE_STATUSES: readonly CompanyShareStatus[] = ["shared", "already-shared", "owner-company", "not-shareable"];

// ---------------------------------------------------------------------------
// Saving as a collaborator
// ---------------------------------------------------------------------------

/** Save as new cloud project while another company's project is open. */
export function copyOwnedByLine(actingAsName: string, ownerCompanyName: string): string {
  return `This saves a copy, owned by ${actingAsName}; ${ownerNameOrGap(ownerCompanyName)}'s project is unchanged.`;
}
