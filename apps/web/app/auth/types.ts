import type { Entitlement, MembershipLevel } from "./actingAs";

/**
 * The shape the server hands the browser. Shared by the route handlers and the
 * client provider, so both ends agree on what "signed in" looks like.
 *
 * Deliberately absent: anything about `ViewerRole`. Permission and viewer role
 * are two axes that must never be merged — the Role Selector stays a free
 * presentation toggle for anyone including guests, and no code path may derive
 * one of these from the other.
 */

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  isPlatformAdmin: boolean;
  /**
   * Two-factor is OPTIONAL for every account, platform admin included. This is
   * reported so the account panel can offer to turn it on; it is never required
   * anywhere, and its absence is not a defect to be fixed.
   */
  hasTwoFactor: boolean;
}

export interface SessionSnapshot {
  /** False when no Supabase project is configured: the editor still works. */
  backendConfigured: boolean;
  user: SessionUser | null;
  /**
   * The password was accepted but the second factor has not been presented yet.
   * Only ever true for an account that chose to enrol one — the database
   * refuses that session's reads (supabase/migrations/0004), so this tells the
   * UI to ask for the code rather than to render an empty-looking account.
   */
  mfaPending: boolean;
  /** Companies this person may act as. Empty for a guest. */
  entitlements: Entitlement[];
  /** The server-verified acting-as company. Never what the client claimed. */
  actingAsCompanyId: string | null;
  actingAsCompanyName: string | null;
  /** Your level at the acting-as company, or null if it is not yours. */
  actingAsLevel: MembershipLevel | null;
  /**
   * Set when the client asked to act as a company it does not hold — a forged
   * cookie, or a membership revoked mid-session. The session carries on at a
   * company the person really does hold, and the UI says so rather than
   * silently pretending nothing happened.
   */
  actingAsRejectedCompanyId: string | null;
}

export const GUEST_SESSION: SessionSnapshot = {
  backendConfigured: false,
  user: null,
  mfaPending: false,
  entitlements: [],
  actingAsCompanyId: null,
  actingAsCompanyName: null,
  actingAsLevel: null,
  actingAsRejectedCompanyId: null,
};

/**
 * One thing a member did: a save or a rename. That is the whole of what the app
 * records, and therefore the whole of what the People section shows (spec,
 * "People & activity page", Open Item 1 — answered yes by Tommy 2026-09-20).
 *
 * `authorName` is the snapshot taken at save time, never a profile looked up by
 * author id: a leaver's profile stops being visible to their former colleagues
 * the moment their membership is revoked.
 */
export interface MemberActionSummary {
  versionId: string;
  kind: "save" | "rename";
  projectName: string;
  versionNumber: number;
  createdAt: string;
  authorName: string;
}

export interface CompanyMemberSummary {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string;
  level: MembershipLevel;
  /** `memberships.created_at`: this MEMBERSHIP's start, not the account's. */
  memberSince: string | null;
  /** Versions authored IN THIS COMPANY'S PROJECTS. Never a cross-company total. */
  versionCount: number;
  /** False when the count is a floor rather than a total (the scan was capped). */
  versionCountExact: boolean;
  /** Newest first, capped. */
  recentActions: MemberActionSummary[];
}

export interface CompanyInviteSummary {
  id: string;
  email: string;
  level: MembershipLevel;
  expiresAt: string;
  acceptedAt: string | null;
}
