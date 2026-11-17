import type { SupabaseClient } from "@supabase/supabase-js";
import { ProjectRouteError } from "./projectRouteLogic";

/**
 * Stage 7's four calls, with the Supabase client passed in — the same shape as
 * `shareLinkRouteLogic.ts`, and for the same reasons.
 *
 *   submitProposal    anon          a design, from somebody with no account
 *   previewProposal   anon          who sent it, when, adopted or not
 *   readProposal      authenticated the design itself
 *   adoptProposal     authenticated it becomes a real project
 *
 * ⚠ **NO FUNCTION HERE ACCEPTS AN ADMIN CLIENT.** 0014's functions and their
 * grants ARE the access control — the `proposals` table has RLS on and not one
 * policy, so a service-role client would walk straight past the only rules
 * there are. The migration grants `service_role` nothing on purpose; this file
 * is the other half of that decision.
 *
 * ⚠ **The token is hashed before it leaves this process, never sent raw.** The
 * caller passes an already-hashed token (`hashProposalToken`), the same
 * contract 0011's share-link routes have, so the raw token exists in the URL
 * and in the user's hands and nowhere else.
 *
 * No database message is ever forwarded to a client: every mapped SQLSTATE
 * gets our own words, and anything unmapped is thrown as-is for the generic
 * 500.
 */

export const PROPOSAL_NOT_LIVE_MESSAGE =
  "That proposal link is not live. It may have been mistyped, or it may have expired.";
export const PROPOSAL_SIGN_IN_MESSAGE = "Sign in to open a proposal.";
export const PROPOSAL_NOT_A_MEMBER_MESSAGE = "You are not a member of that company.";
export const PROPOSAL_ALREADY_ADOPTED_MESSAGE =
  "That proposal has already been adopted. Only one company can take it up.";
export const PROPOSAL_REFUSED_MESSAGE =
  "That design could not be sent as a proposal. It may be too large, or saved in a format this app no longer writes.";
/**
 * ⚠ **The migration is not applied on this deployment.**
 *
 * `0014` is applied by hand, so there is a real window in which this code is
 * deployed and the four functions do not exist yet. Without this the sender
 * gets a generic 500 and the page says "Couldn't make a proposal link", which
 * sends whoever is debugging it looking at the route rather than at the
 * database. It is a deployment state, not a fault, and it says so.
 */
export const PROPOSAL_NOT_MIGRATED_MESSAGE =
  "Proposals aren't switched on for this site yet. Nothing is wrong with your design — the feature is waiting on a database update.";

interface DbError {
  code?: string;
  message?: string;
}

export type ProposalOperation = "submit" | "preview" | "read" | "adopt";

/**
 * 0014's SQLSTATEs.
 *
 * ⚠ `unique_violation` means two different things here and the operation is
 * what tells them apart: on `submit` it is a token collision (astronomically
 * unlikely, and retrying is the honest answer), on `adopt` it is somebody
 * else having got there first. The same collision `shareLinkDisplay` documents
 * for its own two codes.
 */
export function mapProposalDbError(error: DbError, operation: ProposalOperation): ProjectRouteError | null {
  switch (error.code) {
    /* `42883` is Postgres' own "function does not exist"; `PGRST202` is
       PostgREST failing to find it in the schema cache, which is what a
       Supabase client actually sees. Both mean the same thing here. */
    case "42883":
    case "PGRST202":
      return new ProjectRouteError(503, PROPOSAL_NOT_MIGRATED_MESSAGE);
    case "28000":
    case "42501":
      return new ProjectRouteError(
        403,
        operation === "adopt" && /member/i.test(error.message ?? "")
          ? PROPOSAL_NOT_A_MEMBER_MESSAGE
          : PROPOSAL_SIGN_IN_MESSAGE,
      );
    case "02000":
      return new ProjectRouteError(404, PROPOSAL_NOT_LIVE_MESSAGE);
    case "23505":
      return operation === "adopt"
        ? new ProjectRouteError(409, PROPOSAL_ALREADY_ADOPTED_MESSAGE)
        : new ProjectRouteError(409, PROPOSAL_REFUSED_MESSAGE);
    case "23514":
      return new ProjectRouteError(400, PROPOSAL_REFUSED_MESSAGE);
    default:
      return null;
  }
}

function raise(error: DbError, operation: ProposalOperation): never {
  const mapped = mapProposalDbError(error, operation);
  if (mapped) throw mapped;
  throw new Error(error.message ?? "proposal operation failed");
}

export interface SubmitProposalResult {
  proposalId: string;
  expiresAt: string;
}

/**
 * ⚠ The ONLY unauthenticated write in this app. See 0014's own header for what
 * is and is not mitigated; the one that is not is rate limiting, and it has to
 * be solved in front of this function rather than inside it.
 */
export async function submitProposal(
  db: SupabaseClient,
  tokenHash: string,
  document: unknown,
  expiresAt: Date,
  submitter: { name?: string | null; email?: string | null } = {},
): Promise<SubmitProposalResult> {
  const { data, error } = await db
    .rpc("submit_proposal", {
      p_token_hash: tokenHash,
      p_document: document,
      p_expires_at: expiresAt.toISOString(),
      p_submitter_name: submitter.name ?? null,
      p_submitter_email: submitter.email ?? null,
    })
    .single();
  if (error) raise(error, "submit");
  const row = data as { proposal_id: string; expires_at: string };
  return { proposalId: row.proposal_id, expiresAt: row.expires_at };
}

export interface ProposalPreview {
  found: boolean;
  submitterName: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  adopted: boolean;
  adoptedAt: string | null;
  adoptedByCompanyName: string | null;
}

/**
 * ⚠ Never the document, and never the submitter's address — the database does
 * not return either, so this cannot leak them even by accident. That split is
 * the same one 0013's warning is about, drawn one layer down where a mistake
 * here cannot undo it.
 */
export async function previewProposal(db: SupabaseClient, tokenHash: string): Promise<ProposalPreview> {
  const { data, error } = await db.rpc("proposal_preview", { p_token_hash: tokenHash }).single();
  if (error) raise(error, "preview");
  const row = data as {
    found: boolean;
    submitter_name: string | null;
    created_at: string | null;
    expires_at: string | null;
    adopted: boolean;
    adopted_at: string | null;
    adopted_by_company_name: string | null;
  };
  return {
    found: row.found,
    submitterName: row.submitter_name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    adopted: row.adopted,
    adoptedAt: row.adopted_at,
    adoptedByCompanyName: row.adopted_by_company_name,
  };
}

export interface ProposalDocument {
  found: boolean;
  document: unknown;
  submitterName: string | null;
  createdAt: string | null;
  adopted: boolean;
}

/** Authenticated only. Any signed-in account holding the token — see 0014's
 *  header for why this is a sign-in rather than a grant. */
export async function readProposal(db: SupabaseClient, tokenHash: string): Promise<ProposalDocument> {
  const { data, error } = await db.rpc("proposal_document", { p_token_hash: tokenHash }).single();
  if (error) raise(error, "read");
  const row = data as {
    found: boolean;
    document: unknown;
    submitter_name: string | null;
    created_at: string | null;
    adopted: boolean;
  };
  return {
    found: row.found,
    document: row.document,
    submitterName: row.submitter_name,
    createdAt: row.created_at,
    adopted: row.adopted,
  };
}

export interface AdoptedProposal {
  projectId: string;
  versionId: string;
  versionNumber: number;
}

/** The proposal becomes a real project in the `proposals` folder. Once. */
export async function adoptProposal(
  db: SupabaseClient,
  tokenHash: string,
  companyId: string,
): Promise<AdoptedProposal> {
  const { data, error } = await db
    .rpc("adopt_proposal", { p_token_hash: tokenHash, p_company_id: companyId })
    .single();
  if (error) raise(error, "adopt");
  const row = data as { project_id: string; version_id: string; version_number: number };
  return { projectId: row.project_id, versionId: row.version_id, versionNumber: row.version_number };
}
