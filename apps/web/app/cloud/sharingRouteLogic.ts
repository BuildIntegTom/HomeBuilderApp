import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entitlement } from "../auth/actingAs";
import { listPendingRequests } from "./accessRequestRouteLogic";
import {
  isCloudFolder,
  type AccessGrantRow,
  type CompanyShareStatus,
  type ListSharedProjectsResponse,
  type PersonShareStatus,
  type ProjectAccessResponse,
  type RemoveGrantResponse,
  type ShareResponse,
  type ShareableCompaniesResponse,
  type SharedProjectRow,
  type SharedReach,
} from "./cloudTypes";
import { PROJECT_NOT_FOUND_MESSAGE, ProjectRouteError, isUuid, type Body } from "./projectRouteLogic";
import { COMPANY_SHARE_STATUSES, PERSON_SHARE_STATUSES, REMOVE_REFUSED_MESSAGE, shareStatusMessage } from "./sharingDisplay";

/**
 * The logic behind Stage 3B's routes, with the Supabase client passed in, in
 * the same shape as projectRouteLogic.ts:
 *
 *   GET    /api/projects/shared                   listSharedProjects
 *   GET    /api/projects/[id]/access              getProjectAccess
 *   POST   /api/projects/[id]/access              shareProject
 *   DELETE /api/projects/[id]/access/[grantId]    removeGrant
 *   GET    /api/companies/shareable               listShareableCompanies
 *
 * NO FUNCTION HERE ACCEPTS AN ADMIN CLIENT. The session's JWT-bound client is
 * the only one, so RLS and 0008's functions are the access control: a grant is
 * written only by share_project_with_person / share_project_with_company, and
 * removed only through collaborators_delete. `canRemove` below is computed for
 * the button; the database decides.
 *
 * No database message is ever forwarded: every mapped SQLSTATE gets our own
 * words, and anything unmapped is thrown as-is for errorResponse's generic 500.
 */

interface DbError {
  code?: string;
  message?: string;
}

/** Who is asking, from the verified session (never from the request). */
export interface SharingViewer {
  userId: string;
  isPlatformAdmin: boolean;
  entitlements: readonly Entitlement[];
  actingAs: Entitlement | null;
}

export const SHARE_NOT_FOUND_MESSAGE = "That project doesn't exist, or you can't share it. Nothing was shared.";
export const SHARED_LIST_REFUSED_MESSAGE =
  "Couldn't list the projects shared with you. Your access may have changed; reload the page and try again.";
export const SHAREABLE_REFUSED_MESSAGE = "Couldn't list the companies you can share with. Reload the page and try again.";
export const SHARE_EMAIL_REQUIRED_MESSAGE = "Enter the email address of the person to share with. Nothing was shared.";
export const SHARE_EMAIL_AMBIGUOUS_MESSAGE =
  "More than one account uses that email, so nothing was shared. A platform admin needs to sort that out.";
export const SHARE_UNATTRIBUTABLE_MESSAGE =
  "That share couldn't be recorded because an account has no name or email. Nothing was shared.";
export const SHARE_KIND_MESSAGE = 'Choose whether to share with a person or a company ("kind": "person" or "company"). Nothing was shared.';
export const SHARE_COMPANY_ID_MESSAGE = "Pick a company to share with. Nothing was shared.";
export const ALSO_REMOVE_MESSAGE = '"alsoRemove" must be a list of share ids. Nothing was changed.';

export { REMOVE_REFUSED_MESSAGE };

export type SharingOperation = "shared-list" | "access" | "share" | "remove" | "shareable";

/** The 404 / 403 each operation gives when the database says "not yours". */
function refusalFor(operation: SharingOperation): ProjectRouteError {
  switch (operation) {
    case "shared-list":
      return new ProjectRouteError(403, SHARED_LIST_REFUSED_MESSAGE);
    case "shareable":
      return new ProjectRouteError(403, SHAREABLE_REFUSED_MESSAGE);
    case "share":
      // One answer for "no such project" and "not yours" (0008 raises one
      // 42501 for both), so a project id cannot be probed through sharing.
      return new ProjectRouteError(404, SHARE_NOT_FOUND_MESSAGE);
    case "remove":
      return new ProjectRouteError(404, REMOVE_REFUSED_MESSAGE);
    case "access":
      return new ProjectRouteError(404, PROJECT_NOT_FOUND_MESSAGE);
  }
}

/**
 * 0008's SQLSTATEs, confirmed on local PostgreSQL 17.4 (stage3b probe):
 *   42501  share_*: "project not found, or you cannot share it" (also below
 *          the required assurance level); shareable_companies below aal.
 *   22023  share_project_with_person: blank email.
 *   21000  share_project_with_person: two accounts share that email.
 *   23514  share_*: an account has no name or email to snapshot.
 * Plus PostgREST's PGRST116 (.single() with no row) and 22P02 (not a uuid:
 * checked up front, this is the backstop).
 */
export function mapSharingDbError(error: DbError, operation: SharingOperation): ProjectRouteError | null {
  switch (error.code) {
    case "42501":
    case "22P02":
    case "PGRST116":
      return refusalFor(operation);
    case "22023":
      return operation === "share" ? new ProjectRouteError(400, SHARE_EMAIL_REQUIRED_MESSAGE) : null;
    case "21000":
      return operation === "share" ? new ProjectRouteError(409, SHARE_EMAIL_AMBIGUOUS_MESSAGE) : null;
    case "23514":
      return operation === "share" ? new ProjectRouteError(409, SHARE_UNATTRIBUTABLE_MESSAGE) : null;
    default:
      return null;
  }
}

function fail(error: DbError, operation: SharingOperation): never {
  throw mapSharingDbError(error, operation) ?? error;
}

/** Owner member (any grant) or platform admin: the first two branches of collaborators_delete. */
export function isOwnerSide(viewer: SharingViewer, ownerCompanyId: string): boolean {
  return viewer.isPlatformAdmin || viewer.entitlements.some((e) => e.companyId === ownerCompanyId && e.source === "membership");
}

/**
 * A DELETE may carry no body at all (hand-test step 6 sends none). Empty is
 * `{}`; anything present must be a JSON object.
 */
export function parseOptionalJsonBody(text: string): Body {
  if (text.trim().length === 0) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ProjectRouteError(400, "Expected a JSON body. Nothing was changed.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectRouteError(400, "Expected a JSON object. Nothing was changed.");
  }
  return value as Body;
}

// ---------------------------------------------------------------------------
// GET /api/projects/shared
// ---------------------------------------------------------------------------

interface SharedRecord {
  project_id: string;
  name: string;
  folder: string;
  head_version_number: number;
  head_version_id: string | null;
  head_author_name: string | null;
  updated_at: string;
  owner_company_id: string;
  owner_company_name: string | null;
  reached_via: { via: string; grantee_name: string; granted_by_name: string | null; created_at: string }[] | null;
}

function readReach(entry: SharedRecord["reached_via"] extends (infer E)[] | null ? E : never): SharedReach | null {
  if (entry.via !== "person" && entry.via !== "company" && entry.via !== "creator") return null;
  return { via: entry.via, granteeName: entry.grantee_name, grantedByName: entry.granted_by_name ?? null, createdAt: entry.created_at };
}

/**
 * The acting-as id is the VERIFIED one from loadSession, or null for an account
 * with no membership (personal grants only). list_shared_projects filters the
 * grants itself (0008), so an owner member's view of every grant on their own
 * projects never shows up here as "shared with us".
 */
export async function listSharedProjects(db: SupabaseClient, actingAs: Entitlement | null): Promise<ListSharedProjectsResponse> {
  const { data, error } = await db.rpc("list_shared_projects", { p_acting_as: actingAs?.companyId ?? null });
  if (error) fail(error, "shared-list");
  const projects: SharedProjectRow[] = [];
  for (const r of (data ?? []) as SharedRecord[]) {
    if (!isCloudFolder(r.folder)) continue;
    projects.push({
      id: r.project_id,
      name: r.name,
      folder: r.folder,
      headVersionNumber: r.head_version_number,
      headVersionId: r.head_version_id,
      headAuthorName: r.head_author_name,
      updatedAt: r.updated_at,
      ownerCompanyId: r.owner_company_id,
      ownerCompanyName: r.owner_company_name ?? "",
      reachedVia: (r.reached_via ?? []).map(readReach).filter((x): x is SharedReach => x !== null),
    });
  }
  return { actingAs: actingAs ? { id: actingAs.companyId, name: actingAs.companyName } : null, projects };
}

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/access
// ---------------------------------------------------------------------------

/** Named columns. */
export const ACCESS_COLUMNS = "id, kind, grantee_user_id, grantee_company_id, granted_by, granted_by_name, grantee_name, created_at";

interface GrantRecord {
  id: string;
  kind: "shared" | "creator";
  grantee_user_id: string | null;
  grantee_company_id: string | null;
  granted_by: string | null;
  granted_by_name: string | null;
  grantee_name: string;
  created_at: string;
}

/** Enrichment only: the Seed wording. A failure reads as "not the consortium". */
async function consortiumCompanyId(db: SupabaseClient): Promise<string | null> {
  try {
    const { data, error } = await db.rpc("consortium_company_id");
    return !error && typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

export async function getProjectAccess(db: SupabaseClient, viewer: SharingViewer, projectIdParam: string): Promise<ProjectAccessResponse> {
  // Unreadable, nonexistent and malformed are the same 404.
  if (!isUuid(projectIdParam)) throw new ProjectRouteError(404, PROJECT_NOT_FOUND_MESSAGE);
  const projectId = projectIdParam;

  const { data: project, error: projectError } = await db.from("projects").select("id, company_id, name").eq("id", projectId).maybeSingle();
  if (projectError) fail(projectError, "access");
  if (!project) throw new ProjectRouteError(404, PROJECT_NOT_FOUND_MESSAGE);
  const p = project as { id: string; company_id: string; name: string };

  // Through the helper: companies_select hides the owner from a collaborator.
  const { data: ownerName, error: ownerError } = await db.rpc("project_owner_company_name", { p_project: projectId });
  if (ownerError) fail(ownerError, "access");
  if (typeof ownerName !== "string") throw new ProjectRouteError(404, PROJECT_NOT_FOUND_MESSAGE);

  const { data: rows, error } = await db
    .from("collaborators")
    .select(ACCESS_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) fail(error, "access");
  const records = (rows ?? []) as GrantRecord[];

  const consortiumId = records.some((r) => r.grantee_company_id) ? await consortiumCompanyId(db) : null;
  const ownerSide = isOwnerSide(viewer, p.company_id);

  const grants: AccessGrantRow[] = records.map((r) => ({
    grantId: r.id,
    kind: r.kind,
    granteeKind: r.grantee_user_id ? "person" : "company",
    granteeName: r.grantee_name,
    granteeIsConsortium: Boolean(r.grantee_company_id && consortiumId && r.grantee_company_id === consortiumId),
    grantedByName: r.granted_by_name,
    grantedByYou: r.granted_by !== null && r.granted_by === viewer.userId,
    isYou: r.grantee_user_id !== null && r.grantee_user_id === viewer.userId,
    createdAt: r.created_at,
    canRemove: ownerSide || (r.granted_by !== null && r.granted_by === viewer.userId),
    sharesMadeByGrantee: r.grantee_user_id ? records.filter((o) => o.granted_by === r.grantee_user_id).map((o) => o.id) : [],
  }));

  // Stage 4C. Pending access requests, ABOVE the grant rows and OWNER-SIDE
  // ONLY. Deliberately part of this response rather than a parallel surface:
  // "where owners see them" is the project's existing Access… note, and a
  // granted request becomes an ordinary grant in the very list below it.
  // `collab_requests_select` is the gate underneath; not asking at all when
  // the viewer is not owner-side keeps a collaborator's read from even
  // touching the table.
  const requests = ownerSide ? await listPendingRequests(db, projectId) : [];

  return {
    projectId: p.id,
    projectName: p.name,
    owner: { id: p.company_id, name: ownerName },
    viewerIsOwnerSide: ownerSide,
    grants,
    requests,
  };
}

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/access
// ---------------------------------------------------------------------------

async function ownerNameFor(db: SupabaseClient, projectId: string): Promise<string> {
  try {
    const { data } = await db.rpc("project_owner_company_name", { p_project: projectId });
    return typeof data === "string" ? data : "";
  } catch {
    return "";
  }
}

async function granteeNameFor(db: SupabaseClient, grantId: string | null): Promise<string | null> {
  if (!grantId) return null;
  try {
    const { data } = await db.from("collaborators").select("grantee_name").eq("id", grantId).maybeSingle();
    return (data as { grantee_name: string } | null)?.grantee_name ?? null;
  } catch {
    return null;
  }
}

/**
 * `{ kind: "person", email }` or `{ kind: "company", companyId }`. The status
 * is an answer, not an error: `shared` is 201 at the route and every other
 * status 200, each with its message.
 */
export async function shareProject(db: SupabaseClient, projectIdParam: string, body: Body): Promise<ShareResponse> {
  if (!isUuid(projectIdParam)) throw new ProjectRouteError(404, SHARE_NOT_FOUND_MESSAGE);
  const projectId = projectIdParam;
  const kind = body.kind;
  if (kind !== "person" && kind !== "company") throw new ProjectRouteError(400, SHARE_KIND_MESSAGE);

  let typed: string;
  let reply: { status: string; grant_id: string | null };
  if (kind === "person") {
    const email = body.email;
    if (typeof email !== "string" || email.trim().length === 0) throw new ProjectRouteError(400, SHARE_EMAIL_REQUIRED_MESSAGE);
    typed = email.trim();
    // Passed as a parameter; the function lower()s and btrim()s it itself.
    const { data, error } = await db.rpc("share_project_with_person", { p_project: projectId, p_email: typed }).single();
    if (error) fail(error, "share");
    reply = data as { status: string; grant_id: string | null };
    if (!(PERSON_SHARE_STATUSES as readonly string[]).includes(reply.status)) throw new Error(`unexpected share status ${reply.status}`);
  } else {
    const companyId = body.companyId;
    if (typeof companyId !== "string" || !isUuid(companyId.trim())) throw new ProjectRouteError(400, SHARE_COMPANY_ID_MESSAGE);
    typed = "that company";
    const { data, error } = await db.rpc("share_project_with_company", { p_project: projectId, p_company: companyId.trim() }).single();
    if (error) fail(error, "share");
    reply = data as { status: string; grant_id: string | null };
    if (!(COMPANY_SHARE_STATUSES as readonly string[]).includes(reply.status)) throw new Error(`unexpected share status ${reply.status}`);
  }

  const status = reply.status as PersonShareStatus | CompanyShareStatus;
  // The grant's own name snapshot when there is one; the owner's name only
  // for the two answers that mention it. Both are enrichment: the share has
  // already been decided.
  const target = (await granteeNameFor(db, reply.grant_id)) ?? typed;
  const ownerCompanyName = status === "already-member" || status === "owner-company" ? await ownerNameFor(db, projectId) : "";

  return { kind, status, grantId: reply.grant_id ?? null, message: shareStatusMessage(kind, status, { target, ownerCompanyName }) };
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id]/access/[grantId]
// ---------------------------------------------------------------------------

function readAlsoRemove(body: Body, grantId: string): string[] {
  const value = body.alsoRemove;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && isUuid(v))) throw new ProjectRouteError(400, ALSO_REMOVE_MESSAGE);
  return [...new Set(value as string[])].filter((id) => id !== grantId);
}

/**
 * Deletes through RLS (collaborators_delete). Zero rows is 404 with one
 * message, whatever the reason: not yours to remove, or already gone.
 *
 * `alsoRemove` is the pre-ticked offer: the ids of the shares the removed
 * PERSON made, exactly as the access list showed them. They are deleted only
 * where `granted_by` is that person — so a stray id removes nothing — and only
 * after the main removal succeeded. Each is still subject to RLS.
 */
export async function removeGrant(db: SupabaseClient, projectIdParam: string, grantIdParam: string, body: Body): Promise<RemoveGrantResponse> {
  if (!isUuid(projectIdParam) || !isUuid(grantIdParam)) throw new ProjectRouteError(404, REMOVE_REFUSED_MESSAGE);
  const projectId = projectIdParam;
  const grantId = grantIdParam;
  const alsoRemove = readAlsoRemove(body, grantId);

  // Who this grant is to: needed to scope the offer. Unreadable is the same 404.
  const { data: target, error: readError } = await db
    .from("collaborators")
    .select("id, grantee_user_id")
    .eq("id", grantId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (readError) fail(readError, "remove");
  if (!target) throw new ProjectRouteError(404, REMOVE_REFUSED_MESSAGE);
  const granteeUserId = (target as { grantee_user_id: string | null }).grantee_user_id;

  const { data: deleted, error } = await db.from("collaborators").delete().eq("id", grantId).eq("project_id", projectId).select("id");
  if (error) fail(error, "remove");
  if (!deleted || deleted.length === 0) throw new ProjectRouteError(404, REMOVE_REFUSED_MESSAGE);

  let alsoRemoved = 0;
  if (alsoRemove.length > 0 && granteeUserId) {
    // The main removal has ALREADY happened; a failure here is reported as a
    // count, not turned into an error that suggests nothing changed.
    try {
      const { data: more, error: moreError } = await db
        .from("collaborators")
        .delete()
        .eq("project_id", projectId)
        .eq("granted_by", granteeUserId)
        .in("id", alsoRemove)
        .select("id");
      if (!moreError) alsoRemoved = (more ?? []).length;
    } catch {
      alsoRemoved = 0;
    }
  }

  return { removedGrantId: grantId, alsoRemoved, alsoNotRemoved: alsoRemove.length - alsoRemoved };
}

// ---------------------------------------------------------------------------
// GET /api/companies/shareable
// ---------------------------------------------------------------------------

export async function listShareableCompanies(db: SupabaseClient): Promise<ShareableCompaniesResponse> {
  const { data, error } = await db.rpc("shareable_companies");
  if (error) fail(error, "shareable");
  const rows = (data ?? []) as { id: string; name: string }[];
  const consortiumId = rows.length > 0 ? await consortiumCompanyId(db) : null;
  return { companies: rows.map((r) => ({ id: r.id, name: r.name, isConsortium: consortiumId !== null && r.id === consortiumId })) };
}
