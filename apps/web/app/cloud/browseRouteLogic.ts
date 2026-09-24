import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BROWSE_CANNOT_SHOW_MESSAGE,
  BROWSE_LIST_REFUSED_MESSAGE,
  BROWSE_NOT_FOUND_MESSAGE,
  BROWSE_PROJECT_NOT_FOUND_MESSAGE,
} from "./browseDisplay";
import {
  isCloudFolder,
  type BrowseAccess,
  type BrowseCompaniesResponse,
  type BrowseProjectRow,
  type BrowseProjectsResponse,
  type BrowseVersionResponse,
  type BrowseVersionRow,
  type BrowseVersionsResponse,
  type CloudFolder,
  type CloudVersionKind,
} from "./cloudTypes";
import { ProjectRouteError, isUuid } from "./projectRouteLogic";

/**
 * The logic behind /api/browse/**, with the Supabase client passed in — the
 * same arrangement as `projectRouteLogic.ts`, and for the same reason: the
 * route files import `next/headers` through serverSession, and this is what the
 * unit tests drive with a mocked client.
 *
 * FOUR RULES THIS FILE EXISTS TO KEEP, EACH OF WHICH WOULD BE A HOLE IF BROKEN:
 *
 * 1. **The session client only. No admin client, ever.** Every function here
 *    takes the JWT-bound client from `requireCloudSession()`. The browse
 *    functions are SECURITY DEFINER and check seed entitlement, the browse set
 *    and `meets_required_aal()` for themselves, so `auth.uid()` must be the
 *    real caller's. A service-role client would make all four of those checks
 *    pass for anybody. `browseRouteLogic.test.ts` asserts, by reading the route
 *    files, that none of them mentions `createSupabaseAdminClient` or
 *    `service_role`.
 *
 * 2. **Nothing here selects `document` from `project_versions`.** The ONLY
 *    document this file can reach is `browse_version`'s return value, which is
 *    already redacted by `browse_redact` inside the database. There is no
 *    "read it raw, redact it in TypeScript" step, because the publishable key
 *    ships in the browser bundle and such a step could be gone around.
 *
 * 3. **`0A000` is "this version can't be shown", and it NEVER falls back to a
 *    Stage 2 read.** That SQLSTATE is the redactor refusing a file format it
 *    has no classification for — the fail-closed case, and the whole point of
 *    the future-schema guard. Reaching for `GET /api/projects/[id]/versions/
 *    [versionId]` when it happens would serve the UNTOUCHED stored document
 *    across a company line. See `mapBrowseDbError`.
 *
 * 4. **Ids are validated before use, and no database text is surfaced.** A
 *    malformed id is a 404 that reads exactly like "not found", so these routes
 *    cannot be used to learn which project ids exist; an unmapped Postgres
 *    error is rethrown and becomes a 500 with no Postgres message in it.
 */

export type BrowseOperation = "companies" | "projects" | "versions" | "version";

interface DbError {
  code?: string;
  message?: string;
}

/**
 * Database errors, as the person should read them. The codes are the ones 0009
 * raises, confirmed by running them on local PostgreSQL 17.4 rather than read
 * off the migration and hoped for:
 *
 *   0A000  the redactor refuses to serve: an unclassified file format, a
 *          document whose own schemaVersion disagrees with its recorded one, or
 *          a cost field that survived redaction.
 *   42501  "not found, or you cannot browse it" — one uniform refusal covering
 *          not entitled, not in the browse set, and no such version, so it
 *          cannot be used to probe which ids exist.
 *   22023  a folder that is not one of the three.
 *
 * THE 0A000 BRANCH IS THE IMPORTANT ONE. It is mapped to its own message and
 * its own status, and the caller must treat it as final. It is emphatically not
 * a reason to try another route.
 */
export function mapBrowseDbError(error: DbError, operation: BrowseOperation): ProjectRouteError | null {
  switch (error.code) {
    case "0A000":
      // 422: the version exists and was found, and the server will not produce
      // a form of it you may see. Never 404 (which would read as "try
      // somewhere else") and never 500 (which would read as a bug to retry).
      return new ProjectRouteError(422, BROWSE_CANNOT_SHOW_MESSAGE);
    case "42501":
    case "22P02": // not a uuid; the routes check first, this is the backstop
    case "PGRST116": // .single() with no row
      if (operation === "companies" || operation === "projects") return new ProjectRouteError(403, BROWSE_LIST_REFUSED_MESSAGE);
      if (operation === "versions") return new ProjectRouteError(404, BROWSE_PROJECT_NOT_FOUND_MESSAGE);
      return new ProjectRouteError(404, BROWSE_NOT_FOUND_MESSAGE);
    case "22023":
      return new ProjectRouteError(400, "That isn't one of the three folders");
    default:
      // Unmapped: rethrown as-is, which errorResponse turns into a 500 without
      // echoing a Postgres message.
      return null;
  }
}

function fail(error: DbError, operation: BrowseOperation): never {
  throw mapBrowseDbError(error, operation) ?? error;
}

/** A path segment id: malformed reads exactly the same as not found. */
function requireBrowseId(value: string, notFoundMessage: string): string {
  if (!isUuid(value)) throw new ProjectRouteError(404, notFoundMessage);
  return value;
}

// ---------------------------------------------------------------------------
// GET /api/browse/companies
// ---------------------------------------------------------------------------

/**
 * The member companies, by name. `browse_companies()` returns a caller who is
 * not seed-entitled NO ROWS (not an error), which is the "neither sees nor is
 * seen" branch: an empty list here is a real answer, and the tab is not offered
 * in that state anyway.
 */
export async function browseCompanies(db: SupabaseClient): Promise<BrowseCompaniesResponse> {
  const { data, error } = await db.rpc("browse_companies");
  if (error) fail(error, "companies");
  const rows = (data ?? []) as { id: string; name: string }[];
  return { companies: rows.map((r) => ({ id: r.id, name: r.name })) };
}

// ---------------------------------------------------------------------------
// GET /api/browse/projects?company=&folder=
// ---------------------------------------------------------------------------

interface BrowseProjectRecord {
  project_id: string;
  name: string;
  folder: CloudFolder;
  head_version_number: number;
  head_version_id: string | null;
  head_author_name: string | null;
  head_schema_version: number | null;
  head_redaction_known: boolean;
  updated_at: string;
  owner_company_id: string;
  owner_company_name: string;
  access: string;
}

export async function browseProjects(db: SupabaseClient, companyParam: unknown, folderParam: unknown): Promise<BrowseProjectsResponse> {
  let company: string | null = null;
  if (typeof companyParam === "string" && companyParam.length > 0) {
    // A malformed company id is the client's own mistake and cannot be
    // mistaken for a refusal, so it is a plain 400 rather than an empty list.
    if (!isUuid(companyParam)) throw new ProjectRouteError(400, "That request named something that isn't a valid company id.");
    company = companyParam;
  }
  let folder: CloudFolder | null = null;
  if (folderParam !== undefined && folderParam !== null && folderParam !== "") {
    if (!isCloudFolder(folderParam)) throw new ProjectRouteError(400, "That isn't one of the three folders");
    folder = folderParam;
  }

  const { data, error } = await db.rpc("browse_projects", { p_company: company, p_folder: folder });
  if (error) fail(error, "projects");
  const rows = (data ?? []) as BrowseProjectRecord[];

  const projects: BrowseProjectRow[] = rows.map((r) => ({
    projectId: r.project_id,
    name: r.name,
    folder: r.folder,
    headVersionNumber: r.head_version_number,
    headVersionId: r.head_version_id,
    headAuthorName: r.head_author_name,
    headSchemaVersion: r.head_schema_version,
    headRedactionKnown: Boolean(r.head_redaction_known),
    updatedAt: r.updated_at,
    ownerCompanyId: r.owner_company_id,
    ownerCompanyName: r.owner_company_name,
    // Anything the database does not call `full` opens through the redactor.
    // Defaulting the other way would open a mislabelled row with costs.
    access: (r.access === "full" ? "full" : "redacted") satisfies BrowseAccess,
  }));

  const named = company ? projects.find((p) => p.ownerCompanyId === company) : undefined;
  return {
    company: company ? { id: company, name: named?.ownerCompanyName ?? "" } : null,
    folder,
    projects,
  };
}

// ---------------------------------------------------------------------------
// GET /api/browse/projects/[id]/versions
// ---------------------------------------------------------------------------

interface BrowseVersionRecord {
  version_id: string;
  version_number: number;
  parent_version_id: string | null;
  kind: CloudVersionKind;
  label: string | null;
  author_name: string | null;
  created_at: string;
  schema_version: number;
  redaction_known: boolean;
  project_name: string | null;
}

export async function browseVersions(db: SupabaseClient, projectIdParam: string): Promise<BrowseVersionsResponse> {
  const projectId = requireBrowseId(projectIdParam, BROWSE_PROJECT_NOT_FOUND_MESSAGE);
  const { data, error } = await db.rpc("browse_versions", { p_project: projectId });
  if (error) fail(error, "versions");
  const rows = (data ?? []) as BrowseVersionRecord[];

  const versions: BrowseVersionRow[] = rows.map((r) => ({
    versionId: r.version_id,
    versionNumber: r.version_number,
    parentVersionId: r.parent_version_id,
    kind: r.kind,
    // Pinned to null HERE as well as in SQL. `browse_versions` returns
    // null::text for it; this is the second lock on the same door, so a future
    // edit to the function cannot start a label flowing to the browser through
    // a route that simply passed the column along.
    label: null,
    authorName: r.author_name,
    createdAt: r.created_at,
    schemaVersion: r.schema_version,
    redactionKnown: Boolean(r.redaction_known),
    projectName: r.project_name,
  }));

  return { projectId, versions };
}

// ---------------------------------------------------------------------------
// GET /api/browse/projects/[id]/versions/[versionId]
// ---------------------------------------------------------------------------

interface BrowseVersionDocumentRecord {
  project_id: string;
  folder: CloudFolder;
  owner_company_id: string;
  owner_company_name: string;
  version_id: string;
  version_number: number;
  kind: CloudVersionKind;
  label: string | null;
  author_name: string | null;
  created_at: string;
  schema_version: number;
  document: unknown;
}

/**
 * THE ONLY WAY A BROWSED DOCUMENT IS SERVED, and it is `browse_version`, which
 * always redacts. There is deliberately no branch here that reads
 * `project_versions.document` — not for a `full` row, not for a platform admin,
 * not as a fallback when the redactor refuses. A row the caller can read in
 * full is opened by the CLIENT through the Stage 2 route instead, which is a
 * different request with its own RLS behind it.
 */
export async function browseVersion(db: SupabaseClient, projectIdParam: string, versionIdParam: string): Promise<BrowseVersionResponse> {
  const projectId = requireBrowseId(projectIdParam, BROWSE_NOT_FOUND_MESSAGE);
  const versionId = requireBrowseId(versionIdParam, BROWSE_NOT_FOUND_MESSAGE);

  const { data, error } = await db.rpc("browse_version", { p_project: projectId, p_version: versionId });
  if (error) fail(error, "version");
  const rows = (data ?? []) as BrowseVersionDocumentRecord[];
  const row = rows[0];
  if (!row) throw new ProjectRouteError(404, BROWSE_NOT_FOUND_MESSAGE);

  return {
    projectId: row.project_id,
    folder: row.folder,
    ownerCompanyId: row.owner_company_id,
    ownerCompanyName: row.owner_company_name,
    versionId: row.version_id,
    versionNumber: row.version_number,
    kind: row.kind,
    authorName: row.author_name,
    createdAt: row.created_at,
    schemaVersion: row.schema_version,
    // `label` is deliberately NOT copied out of the row: the browse path never
    // carries a save note, and there is no field on the response to put one in.
    document: row.document,
  };
}
