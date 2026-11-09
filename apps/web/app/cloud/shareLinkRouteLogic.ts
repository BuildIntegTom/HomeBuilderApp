import type { SupabaseClient } from "@supabase/supabase-js";
import { PROJECT_NOT_FOUND_MESSAGE, ProjectRouteError, isUuid, type Body } from "./projectRouteLogic";
import {
  CLAIM_INVALID_MESSAGE,
  CLAIM_NOT_SIGNED_IN_MESSAGE,
  CLAIM_UNATTRIBUTABLE_MESSAGE,
  CLAIM_WRONG_EMAIL_MESSAGE,
  LINKS_LIST_REFUSED_MESSAGE,
  MINT_EXPIRY_MESSAGE,
  MINT_REFUSED_MESSAGE,
  MINT_UNATTRIBUTABLE_MESSAGE,
  REVOKE_REFUSED_MESSAGE,
  type ClaimStatus,
  type ShareLinkPreviewReason,
} from "./shareLinkDisplay";

/**
 * The logic behind Stage 6's routes, with the Supabase client passed in, in
 * the same shape as `sharingRouteLogic.ts`:
 *
 *   GET    /api/projects/[id]/share-links    listShareLinks
 *   POST   /api/projects/[id]/share-links    createShareLink
 *   DELETE /api/share-links/[id]             revokeShareLink
 *   POST   /api/share-links/preview          previewShareLink   (anon)
 *   POST   /api/share-links/claim            claimShareLink
 *
 * NO FUNCTION HERE ACCEPTS AN ADMIN CLIENT, for the reason sharingRouteLogic
 * gives: 0011's functions and the RLS policies are the access control, and a
 * service-role client would walk straight past both. `create_share_link` and
 * `claim_share_link` are `security definer` precisely so they can do their one
 * job without the caller holding table rights — handing them an admin client
 * would defeat the design rather than help it.
 *
 * ⚠ `share_links` is never SELECTed directly anywhere in this file. Reading it
 * goes through `project_share_links`, which is `security invoker` and so sits
 * behind the table's own policy. A `.from("share_links")` here would be a
 * second, unpoliced read path.
 *
 * No database message is ever forwarded: every mapped SQLSTATE gets our own
 * words, and anything unmapped is thrown as-is for errorResponse's generic
 * 500.
 */

interface DbError {
  code?: string;
  message?: string;
}

export type ShareLinkOperation = "mint" | "list" | "revoke" | "preview" | "claim";

/** 0011's SQLSTATEs. See shareLinkDisplay for why two of these collide. */
export function mapShareLinkDbError(error: DbError, operation: ShareLinkOperation): ProjectRouteError | null {
  switch (error.code) {
    case "28000":
      // claim_share_link with no auth.uid(). Should be unreachable behind
      // requireCloudSession, kept because the database is the real authority.
      return new ProjectRouteError(401, CLAIM_NOT_SIGNED_IN_MESSAGE);
    case "42501":
    case "22P02":
    case "PGRST116":
      switch (operation) {
        case "mint":
          // One answer for "no such project" and "not yours", so a project id
          // cannot be probed by trying to mint a link for it.
          return new ProjectRouteError(404, MINT_REFUSED_MESSAGE);
        case "list":
          return new ProjectRouteError(404, PROJECT_NOT_FOUND_MESSAGE);
        case "revoke":
          return new ProjectRouteError(404, REVOKE_REFUSED_MESSAGE);
        case "claim":
          // See CLAIM_WRONG_EMAIL_MESSAGE: the two-factor branch that shares
          // this code is refused upstream by requireCloudSession.
          return new ProjectRouteError(403, CLAIM_WRONG_EMAIL_MESSAGE);
        case "preview":
          return new ProjectRouteError(400, CLAIM_INVALID_MESSAGE);
      }
      return null;
    case "22023":
      // mint: a blank token hash or an expiry in the past — both ours to get
      // right, so the message names the only one a caller can cause.
      // claim: not valid / revoked / expired, indistinguishable by code.
      return operation === "mint"
        ? new ProjectRouteError(400, MINT_EXPIRY_MESSAGE)
        : new ProjectRouteError(410, CLAIM_INVALID_MESSAGE);
    case "23514":
      return operation === "mint"
        ? new ProjectRouteError(409, MINT_UNATTRIBUTABLE_MESSAGE)
        : new ProjectRouteError(409, CLAIM_UNATTRIBUTABLE_MESSAGE);
    default:
      return null;
  }
}

function fail(error: DbError, operation: ShareLinkOperation): never {
  throw mapShareLinkDbError(error, operation) ?? error;
}

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/share-links
// ---------------------------------------------------------------------------

export interface MintedShareLink {
  linkId: string;
  expiresAt: string;
  lockedEmail: string | null;
  grantsWrite: boolean;
}

interface MintRecord {
  link_id: string;
  expires_at: string;
  locked_email: string | null;
  grants_write: boolean;
}

/**
 * ⚠ Takes the token HASH, never the token. The raw token is generated in the
 * route handler, returned to the minter once, and deliberately not passed
 * through this layer: a function that has never seen it cannot log it, and
 * cannot grow a caller that stores it.
 */
export async function createShareLink(
  db: SupabaseClient,
  projectIdParam: string,
  tokenHash: string,
  expiresAt: Date,
  options: { lockedEmail?: string | null; grantsWrite?: boolean } = {},
): Promise<MintedShareLink> {
  if (!isUuid(projectIdParam)) throw new ProjectRouteError(404, MINT_REFUSED_MESSAGE);
  const { data, error } = await db
    .rpc("create_share_link", {
      p_project: projectIdParam,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt.toISOString(),
      p_locked_email: options.lockedEmail ?? null,
      /* ⚠ Defaults to FALSE here as well as in the database. The column
         default is the guarantee (0011's post-flight asserts it), but a route
         that passed `undefined` through would rely on PostgREST omitting the
         argument, which is one library upgrade away from sending `null` and
         turning the default into a NOT NULL violation — or worse, from some
         future refactor supplying `true`. View-only is the safe direction, so
         it is stated. */
      p_grants_write: options.grantsWrite === true,
    })
    .maybeSingle<MintRecord>();
  if (error) fail(error, "mint");
  if (!data) throw new ProjectRouteError(404, MINT_REFUSED_MESSAGE);
  return {
    linkId: data.link_id,
    expiresAt: data.expires_at,
    lockedEmail: data.locked_email ?? null,
    grantsWrite: data.grants_write,
  };
}

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/share-links
// ---------------------------------------------------------------------------

export interface ShareLinkClaim {
  grantId: string;
  granteeName: string;
  canWrite: boolean;
  claimedAt: string;
}

export interface ShareLinkRow {
  linkId: string;
  createdByName: string | null;
  createdByYou: boolean;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lockedEmail: string | null;
  grantsWrite: boolean;
  isLive: boolean;
  claims: ShareLinkClaim[];
}

interface LinkRecord {
  link_id: string;
  created_by_name: string | null;
  created_by_you: boolean;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  locked_email: string | null;
  grants_write: boolean;
  is_live: boolean;
  claims: { grant_id: string; grantee_name: string; can_write: boolean; claimed_at: string }[] | null;
}

export async function listShareLinks(db: SupabaseClient, projectIdParam: string): Promise<{ links: ShareLinkRow[] }> {
  if (!isUuid(projectIdParam)) throw new ProjectRouteError(404, PROJECT_NOT_FOUND_MESSAGE);
  const { data, error } = await db.rpc("project_share_links", { p_project: projectIdParam });
  if (error) {
    // A refusal to LIST is not a missing project — the caller got here by
    // opening a project they can read. Distinguished from mint's 404 so the
    // editor can tell them to reload rather than that the project is gone.
    const mapped = mapShareLinkDbError(error, "list");
    throw mapped ?? new ProjectRouteError(403, LINKS_LIST_REFUSED_MESSAGE);
  }
  const links = ((data ?? []) as LinkRecord[]).map((r) => ({
    linkId: r.link_id,
    createdByName: r.created_by_name ?? null,
    createdByYou: r.created_by_you,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at ?? null,
    lockedEmail: r.locked_email ?? null,
    grantsWrite: r.grants_write,
    isLive: r.is_live,
    claims: (r.claims ?? []).map((c) => ({
      grantId: c.grant_id,
      granteeName: c.grantee_name,
      canWrite: c.can_write,
      claimedAt: c.claimed_at,
    })),
  }));
  return { links };
}

// ---------------------------------------------------------------------------
// DELETE /api/share-links/[id]
// ---------------------------------------------------------------------------

export interface RevokedShareLink {
  linkId: string;
  revokedAt: string;
}

export async function revokeShareLink(db: SupabaseClient, linkIdParam: string): Promise<RevokedShareLink> {
  if (!isUuid(linkIdParam)) throw new ProjectRouteError(404, REVOKE_REFUSED_MESSAGE);
  const { data, error } = await db
    .rpc("revoke_share_link", { p_link: linkIdParam })
    .maybeSingle<{ link_id: string; revoked_at: string }>();
  if (error) fail(error, "revoke");
  if (!data) throw new ProjectRouteError(404, REVOKE_REFUSED_MESSAGE);
  return { linkId: data.link_id, revokedAt: data.revoked_at };
}

// ---------------------------------------------------------------------------
// POST /api/share-links/preview  —  THE ONLY ANON-REACHABLE ONE
// ---------------------------------------------------------------------------

export interface ShareLinkPreview {
  valid: boolean;
  reason: ShareLinkPreviewReason | null;
  projectName: string | null;
  ownerCompanyName: string | null;
  sharedByName: string | null;
  lockedToEmail: boolean;
  grantsWrite: boolean;
  expiresAt: string | null;
}

interface PreviewRecord {
  valid: boolean;
  reason: string | null;
  project_name: string | null;
  owner_company_name: string | null;
  shared_by_name: string | null;
  locked_to_email: boolean | null;
  grants_write: boolean | null;
  expires_at: string | null;
}

const PREVIEW_REASONS: readonly string[] = ["not_found", "revoked", "expired"];

/**
 * ⚠ A visitor with no account calls this, so it is the one place in Stage 6
 * where an unauthenticated request reaches the database. What it may learn is
 * bounded by the FUNCTION, not by this route: 0011 returns four strings, two
 * booleans and a timestamp, and deliberately **no project id, no version, no
 * document, no panel and no price**.
 *
 * ⚠ `lockedToEmail` is a BOOLEAN, not the address. A link forwarded to the
 * wrong person must not tell them whose link they are holding — that would
 * turn a stray URL into an email-address disclosure. The database makes that
 * choice (`v_link.locked_email is not null`); this type keeps it, and the
 * boolean name is what stops a later edit from "helpfully" passing the string
 * through.
 */
export async function previewShareLink(db: SupabaseClient, tokenHash: string): Promise<ShareLinkPreview> {
  const { data, error } = await db.rpc("share_link_preview", { p_token_hash: tokenHash }).maybeSingle<PreviewRecord>();
  if (error) fail(error, "preview");
  if (!data) {
    // No row at all should be impossible — the function always returns one —
    // so treat it as the same dead end rather than a 500 the visitor cannot
    // act on.
    return notFoundPreview();
  }
  const reason = data.reason && PREVIEW_REASONS.includes(data.reason) ? (data.reason as ShareLinkPreviewReason) : null;
  if (!data.valid && reason === null) return notFoundPreview();
  return {
    valid: data.valid === true,
    reason: data.valid ? null : reason,
    projectName: data.project_name ?? null,
    ownerCompanyName: data.owner_company_name ?? null,
    sharedByName: data.shared_by_name ?? null,
    lockedToEmail: data.locked_to_email === true,
    grantsWrite: data.grants_write === true,
    expiresAt: data.expires_at ?? null,
  };
}

function notFoundPreview(): ShareLinkPreview {
  return {
    valid: false,
    reason: "not_found",
    projectName: null,
    ownerCompanyName: null,
    sharedByName: null,
    lockedToEmail: false,
    grantsWrite: false,
    expiresAt: null,
  };
}

// ---------------------------------------------------------------------------
// POST /api/share-links/claim
// ---------------------------------------------------------------------------

export interface ClaimResult {
  status: ClaimStatus;
  projectId: string;
  grantId: string | null;
  canWrite: boolean;
}

interface ClaimRecord {
  status: string;
  project_id: string;
  grant_id: string | null;
  can_write: boolean;
}

const CLAIM_STATUSES: readonly string[] = ["claimed", "already-claimed", "already-has-access"];

export async function claimShareLink(db: SupabaseClient, tokenHash: string): Promise<ClaimResult> {
  const { data, error } = await db.rpc("claim_share_link", { p_token_hash: tokenHash }).maybeSingle<ClaimRecord>();
  if (error) fail(error, "claim");
  if (!data || !CLAIM_STATUSES.includes(data.status)) {
    /* ⚠ An unrecognised status is a 500, NOT a cheerful default. A claim
       either produced access or it did not, and the one thing this route must
       never do is tell somebody they are in when the database said something
       this code does not understand. */
    throw new ProjectRouteError(500, CLAIM_INVALID_MESSAGE);
  }
  return {
    status: data.status as ClaimStatus,
    projectId: data.project_id,
    grantId: data.grant_id ?? null,
    canWrite: data.can_write === true,
  };
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

export const MINT_EMAIL_INVALID_MESSAGE = 'That doesn\'t look like an email address. Leave it blank for a link anyone can open, or fix it. No link was made.';

export interface MintRequest {
  lockedEmail: string | null;
  grantsWrite: boolean;
}

/**
 * The mint body. Both fields are optional and both default to the cautious
 * answer: no lock (because requiring one would block the flow Tommy asked
 * for) and **no write** (because handing out edit rights by omission is the
 * one mistake here that cannot be taken back once somebody has saved).
 */
export function parseMintRequest(body: Body): MintRequest {
  const raw = body.lockedEmail;
  let lockedEmail: string | null = null;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const trimmed = raw.trim().toLowerCase();
    /* Deliberately loose: one @, something either side, no whitespace. The
       database normalises and the real check is whether the claimant's own
       verified address matches, so a stricter pattern here would only reject
       valid addresses the app has no business judging. */
    if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) throw new ProjectRouteError(400, MINT_EMAIL_INVALID_MESSAGE);
    lockedEmail = trimmed;
  } else if (raw !== undefined && raw !== null && typeof raw !== "string") {
    throw new ProjectRouteError(400, MINT_EMAIL_INVALID_MESSAGE);
  }
  return { lockedEmail, grantsWrite: body.grantsWrite === true };
}

export const TOKEN_REQUIRED_MESSAGE = "That link isn't valid. Check you copied the whole thing.";

/** The token out of a preview or claim body. */
export function requireToken(body: Body): string {
  const token = body.token;
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new ProjectRouteError(400, TOKEN_REQUIRED_MESSAGE);
  }
  return token.trim();
}
