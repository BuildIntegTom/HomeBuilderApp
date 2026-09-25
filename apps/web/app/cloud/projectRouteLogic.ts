import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entitlement } from "../auth/actingAs";
import {
  DOCUMENT_TOO_LARGE_MESSAGE,
  NAME_LENGTH_MESSAGE,
  NO_COMPANY_MESSAGE,
  actingAsChangedMessage,
  isCloudFolder,
  type CloudFolder,
  type CloudProjectRow,
  type CloudVersionResponse,
  type CreateProjectResponse,
  PROJECT_NAME_MAX_CHARS,
  type CloudVersionKind,
  type CloudVersionRow,
  type InterveningVersion,
  type ListProjectsResponse,
  type ListVersionsResponse,
  type MoveProjectResponse,
  type RenameProjectResponse,
  type SaveVersionResponse,
} from "./cloudTypes";

/**
 * The logic behind /api/projects/**, with the Supabase client passed in.
 *
 * Kept out of the route files for one reason: those import `next/headers`
 * through serverSession, and this is what the unit tests drive with a mocked
 * client. The routes are thin wrappers that pass `requireSession()`'s
 * JWT-bound client, so RLS is the access control.
 *
 * NO FUNCTION HERE ACCEPTS AN ADMIN CLIENT, and no route that calls one
 * imports createSupabaseAdminClient. 0006 grants service_role nothing on these
 * tables anyway.
 *
 * The acting-as company only ever decides where a NEW project goes and which
 * tree is listed. Saving into an existing project, moving it, and opening it
 * are decided by the database from the project's own ownership.
 */

export class ProjectRouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const PROJECT_NOT_FOUND_MESSAGE = "That project doesn't exist, or you can't open it.";
export const VERSION_NOT_FOUND_MESSAGE = "That project version doesn't exist, or you can't open it.";
export const SAVE_ACCESS_LOST_MESSAGE =
  "You can't save to this project any more. Your access to it may have been removed. Nothing was saved; your design is still on screen, and Download project file keeps a copy.";
export const LIST_REFUSED_MESSAGE =
  "Couldn't list this company's projects. Your access may have changed; reload the page and try again.";
export const INVALID_ID_MESSAGE = "That request named something that isn't a valid id. Nothing was saved or changed.";
export const RENAME_NOT_FOUND_MESSAGE = "That project doesn't exist, or you can't rename it. Nothing was changed.";

export type Body = Record<string, unknown>;

interface DbError {
  code?: string;
  message?: string;
}

/**
 * Every id in these tables is a uuid. Checked up front so a malformed one is a
 * plain 400 (body) or 404 (path) instead of reaching Postgres as 22P02 and
 * coming back as a misleading "access lost" or "starting version" message.
 * Any hex uuid is accepted, not only v4: seeded rows need not be random.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** A path segment id: malformed reads the same as not found. */
function requirePathId(value: string, notFoundMessage: string): string {
  if (!isUuid(value)) throw new ProjectRouteError(404, notFoundMessage);
  return value;
}

/** A body id: malformed is the client's mistake, so 400. */
function requireBodyId(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0) throw new ProjectRouteError(400, `Missing "${key}"`);
  if (!isUuid(value.trim())) throw new ProjectRouteError(400, `"${key}" isn't a valid id. Nothing was saved or changed.`);
  return value.trim();
}

export type CreateTargetCheck =
  | { ok: true; companyId: string; companyName: string }
  | { ok: false; status: 403 | 409; message: string };

/**
 * Which company a new project is created in: the VERIFIED acting-as company,
 * never the one the client names. The client's `expectedCompanyId` is the
 * company its dialog displayed; a mismatch means the cookie changed under it
 * (the cookie is per browser, not per tab), and the answer is a visible 409
 * rather than a save into a folder the person never saw.
 *
 * Mismatch is checked first on purpose: someone who switched to Seed in another
 * tab should be told THAT, which is the thing they can act on.
 *
 * STAGE 3D: a `consortium` entitlement is no longer refused (answer 1). This
 * opens ONE company and no other, structurally rather than by a name check:
 * `computeEntitlements` builds the `consortium` source only for the single
 * company flagged `isConsortium`, and the entitlement itself came from
 * `loadSession`, which re-verifies it against real rows on every request. Every
 * other wrong-company create is still refused — by the 409 above when the cookie
 * moved under the dialog, and by the database otherwise.
 *
 * THE DATABASE REMAINS THE GATE, not this function: `projects_insert` (0008)
 * admits `company_id = consortium_company_id() and is_seed_entitled()`, so an
 * account that is not seed-entitled is refused there and comes back as 42501 →
 * "You can't create a project in that company. Nothing was saved."
 */
export function checkCreateTarget(actingAs: Entitlement | null, expectedCompanyId: string): CreateTargetCheck {
  if (!actingAs) return { ok: false, status: 403, message: NO_COMPANY_MESSAGE };
  if (actingAs.companyId !== expectedCompanyId) {
    return { ok: false, status: 409, message: actingAsChangedMessage(actingAs.companyName) };
  }
  return { ok: true, companyId: actingAs.companyId, companyName: actingAs.companyName };
}

/** Shape only (spec: no deep validation, no redaction on the server — 22). */
export function validateProjectDocument(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectRouteError(400, "A project document must be a JSON object");
  }
  const doc = value as Record<string, unknown>;
  if (typeof doc.schemaVersion !== "number" || !Number.isInteger(doc.schemaVersion)) {
    throw new ProjectRouteError(400, 'A project document must carry an integer "schemaVersion"');
  }
  if (!doc.state || typeof doc.state !== "object" || Array.isArray(doc.state)) {
    throw new ProjectRouteError(400, 'A project document must carry a "state" object');
  }
  return doc;
}

/** The optional note typed at save time: blank means none, 1–200 characters
 * otherwise (the `label` column's own check). */
export function readLabel(body: Body): string | null {
  const value = body.label;
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new ProjectRouteError(400, '"label" must be a string');
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if ([...trimmed].length > 200) throw new ProjectRouteError(400, "A note can be at most 200 characters. Nothing was saved.");
  return trimmed;
}

function readFolder(value: unknown, fallback?: CloudFolder): CloudFolder {
  if ((value === undefined || value === null) && fallback) return fallback;
  if (!isCloudFolder(value)) throw new ProjectRouteError(400, "That isn't one of the three folders");
  return value;
}

export const BACKUP_REFUSED_MESSAGE =
  "Couldn't read this company's projects for the backup. Your access may have changed; reload the page and try again. No file was saved.";

/** 2C adds `history` (the version list) and `rename`; 2D adds `backup`. */
export type Operation = "list" | "create" | "save" | "move" | "read" | "history" | "rename" | "backup";

/** The 404 each path-id operation gives, whatever the cause. */
function notFoundFor(operation: Operation): ProjectRouteError {
  if (operation === "read") return new ProjectRouteError(404, VERSION_NOT_FOUND_MESSAGE);
  if (operation === "rename") return new ProjectRouteError(404, RENAME_NOT_FOUND_MESSAGE);
  return new ProjectRouteError(404, PROJECT_NOT_FOUND_MESSAGE);
}

/**
 * Database errors, as the person should read them. The codes are the ones 0006
 * raises (confirmed against the local harness): 42501 for "no such project, or
 * not yours" and for RLS refusals; 23514 for the document, label, folder and
 * lineage checks. Anything unmapped returns null and is thrown as-is, which
 * errorResponse turns into a 500 without echoing a Postgres message.
 */
export function mapProjectDbError(error: DbError, operation: Operation): ProjectRouteError | null {
  const message = error.message ?? "";
  switch (error.code) {
    case "22P02": // not a uuid (the routes check up front; this is the backstop)
    case "PGRST116": // .single() with no row
      if (operation === "backup") return new ProjectRouteError(403, BACKUP_REFUSED_MESSAGE);
      if (operation === "list") return new ProjectRouteError(403, LIST_REFUSED_MESSAGE);
      if (operation === "create" || operation === "save") return new ProjectRouteError(400, INVALID_ID_MESSAGE);
      return notFoundFor(operation);
    case "42501":
      if (operation === "backup") return new ProjectRouteError(403, BACKUP_REFUSED_MESSAGE);
      if (operation === "list") return new ProjectRouteError(403, LIST_REFUSED_MESSAGE);
      if (operation === "create") return new ProjectRouteError(403, "You can't create a project in that company. Nothing was saved.");
      if (operation === "save") return new ProjectRouteError(403, SAVE_ACCESS_LOST_MESSAGE);
      // move, read, history, rename: "not yours" reads the same as "no such
      // project" (rename_project raises one 42501 for both), so it cannot be
      // used to probe whether an id exists.
      return notFoundFor(operation);
    case "22023":
      // rename_project's name-length check. The route checks first; this is
      // the backstop for a name the database trims differently.
      if (operation === "rename") return new ProjectRouteError(400, NAME_LENGTH_MESSAGE);
      return null;
    case "23514":
      if (/byte limit/.test(message)) return new ProjectRouteError(413, DOCUMENT_TOO_LARGE_MESSAGE);
      if (/label_check/.test(message)) return new ProjectRouteError(400, "A note can be at most 200 characters. Nothing was saved.");
      if (/folder_check/.test(message)) return new ProjectRouteError(400, "That isn't one of the three folders");
      if (/parent/.test(message)) {
        return new ProjectRouteError(409, "This save's starting version doesn't belong to this project. Nothing was saved.");
      }
      return new ProjectRouteError(400, "The cloud refused that project document. Nothing was saved.");
    case "23505":
      return new ProjectRouteError(409, "Another save landed at the same moment. Nothing was saved; try again.");
    default:
      return null;
  }
}

function fail(error: DbError, operation: Operation): never {
  throw mapProjectDbError(error, operation) ?? error;
}

// ---------------------------------------------------------------------------
// GET /api/projects?folder=
// ---------------------------------------------------------------------------

interface ProjectRecord {
  id: string;
  name: string;
  folder: CloudFolder;
  head_version_number: number;
  updated_at: string;
}

interface HeadRecord {
  id: string;
  project_id: string;
  version_number: number;
  author_name: string;
}

/** PostgREST puts `or=` in the URL; keep each request comfortably short. An
 * administrative number, not a building value. */
const HEAD_LOOKUP_CHUNK = 40;

export async function listProjects(db: SupabaseClient, actingAs: Entitlement | null, folderParam: unknown): Promise<ListProjectsResponse> {
  const folder = readFolder(folderParam, "current");
  if (!actingAs) return { company: null, folder, projects: [], unavailable: "no-company" };
  const company = { id: actingAs.companyId, name: actingAs.companyName };
  // RLS would return nothing here anyway (no Seed membership row). Said in
  // words instead of an empty tree dressed up as a real one.
  if (actingAs.source === "consortium") return { company, folder, projects: [], unavailable: "consortium" };

  // Named columns only. The listing never selects `document`.
  const { data, error } = await db
    .from("projects")
    .select("id, name, folder, head_version_number, updated_at")
    .eq("company_id", actingAs.companyId)
    .eq("folder", folder)
    .order("updated_at", { ascending: false });
  if (error) fail(error, "list");
  const projects = (data ?? []) as ProjectRecord[];

  // The row reads "name · v7 · Virgil · 2 hours ago", and Open is head-only,
  // so each row needs its head version's id and author — still no document.
  const heads = new Map<string, HeadRecord>();
  for (let i = 0; i < projects.length; i += HEAD_LOOKUP_CHUNK) {
    const chunk = projects.slice(i, i + HEAD_LOOKUP_CHUNK);
    // BUILT ONLY FROM VALUES THE DATABASE JUST RETURNED: each `id` is a uuid
    // from the projects query above and each `head_version_number` an integer
    // column. This string is PostgREST filter syntax, so a client-supplied
    // value spliced in here could rewrite the filter. Never build it from
    // request input; filter with .eq()/.in() for anything that came from a
    // client.
    const filter = chunk.map((p) => `and(project_id.eq.${p.id},version_number.eq.${p.head_version_number})`).join(",");
    const { data: headRows, error: headError } = await db
      .from("project_versions")
      .select("id, project_id, version_number, author_name")
      .or(filter);
    if (headError) fail(headError, "list");
    for (const h of (headRows ?? []) as HeadRecord[]) heads.set(h.project_id, h);
  }

  const rows: CloudProjectRow[] = projects.map((p) => {
    const head = heads.get(p.id);
    return {
      id: p.id,
      name: p.name,
      folder: p.folder,
      headVersionNumber: p.head_version_number,
      headVersionId: head && head.version_number === p.head_version_number ? head.id : null,
      headAuthorName: head && head.version_number === p.head_version_number ? head.author_name : null,
      updatedAt: p.updated_at,
    };
  });

  return { company, folder, projects: rows, unavailable: null };
}

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------

export async function createProject(db: SupabaseClient, actingAs: Entitlement | null, body: Body): Promise<CreateProjectResponse> {
  const expectedCompanyId = requireBodyId(body, "expectedCompanyId");
  const target = checkCreateTarget(actingAs, expectedCompanyId);
  if (!target.ok) throw new ProjectRouteError(target.status, target.message);

  const folder = readFolder(body.folder, "current");
  const label = readLabel(body);
  const document = validateProjectDocument(body.document);

  // One RPC, never two inserts: the project row and version 1 land together.
  const { data, error } = await db
    .rpc("create_project", { p_company_id: target.companyId, p_folder: folder, p_document: document, p_label: label })
    .single();
  if (error) fail(error, "create");
  const row = data as { project_id: string; version_id: string; version_number: number; created_at: string };

  return {
    projectId: row.project_id,
    versionId: row.version_id,
    versionNumber: row.version_number,
    createdAt: row.created_at,
    companyId: target.companyId,
    companyName: target.companyName,
    folder,
  };
}

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/versions
// ---------------------------------------------------------------------------

interface InterveningRecord {
  version_number: number;
  author_name: string;
  created_at: string;
  kind: "save" | "rename";
  project_name: string | null;
}

export async function saveVersion(db: SupabaseClient, projectIdParam: string, body: Body): Promise<SaveVersionResponse> {
  const projectId = requirePathId(projectIdParam, PROJECT_NOT_FOUND_MESSAGE);
  const parentVersionId = requireBodyId(body, "parentVersionId");
  const label = readLabel(body);
  const document = validateProjectDocument(body.document);

  const { data, error } = await db
    .rpc("save_project_version", {
      p_project_id: projectId,
      p_parent_version_id: parentVersionId,
      p_document: document,
      p_label: label,
    })
    .single();
  if (error) fail(error, "save");
  const row = data as { version_id: string; version_number: number; created_at: string; head_before: number; diverged: boolean };

  let baseVersionNumber: number | null = null;
  let intervening: InterveningVersion[] = [];

  // The save has ALREADY SUCCEEDED here. These reads only enrich the notice,
  // so a failure in them must not turn a kept save into a reported error.
  if (row.diverged) {
    try {
      const parent = await db.from("project_versions").select("version_number").eq("id", parentVersionId).maybeSingle();
      baseVersionNumber = (parent.data as { version_number: number } | null)?.version_number ?? null;
      if (baseVersionNumber !== null) {
        const { data: rows } = await db
          .from("project_versions")
          .select("version_number, author_name, created_at, kind, project_name:document->state->>projectName")
          .eq("project_id", projectId)
          .gt("version_number", baseVersionNumber)
          .lt("version_number", row.version_number)
          .order("version_number", { ascending: true });
        intervening = ((rows ?? []) as InterveningRecord[]).map((r) => ({
          versionNumber: r.version_number,
          authorName: r.author_name,
          createdAt: r.created_at,
          kind: r.kind,
          projectName: r.project_name ?? "",
        }));
      }
    } catch {
      intervening = [];
    }
  }

  return {
    projectId,
    versionId: row.version_id,
    versionNumber: row.version_number,
    createdAt: row.created_at,
    headBefore: row.head_before,
    diverged: row.diverged,
    baseVersionNumber,
    intervening,
  };
}

// ---------------------------------------------------------------------------
// PATCH /api/projects/[id]
// ---------------------------------------------------------------------------

export async function moveProject(db: SupabaseClient, projectIdParam: string, body: Body): Promise<MoveProjectResponse> {
  const projectId = requirePathId(projectIdParam, PROJECT_NOT_FOUND_MESSAGE);
  const folder = readFolder(body.folder);
  // An RLS-denied UPDATE is silent (0002's note), so the affected rows are the
  // answer: zero means not found, whatever the reason.
  const { data, error } = await db.from("projects").update({ folder }).eq("id", projectId).select("id, folder");
  if (error) fail(error, "move");
  if (!data || data.length === 0) throw new ProjectRouteError(404, PROJECT_NOT_FOUND_MESSAGE);
  return { projectId, folder };
}

/**
 * The owning company's name, for display. Stage 3B: through
 * `project_owner_company_name` (0008), NOT a `companies` read — companies_select
 * hides the owner's row from a collaborator from another company, so a plain
 * read showed them a blank owner. The helper returns the name only when the
 * caller can read the project. Enrichment: a failure is an empty name, which
 * the UI shows as a visible gap, and the project read above has already
 * decided access.
 */
export async function ownerCompanyName(db: SupabaseClient, projectId: string): Promise<string> {
  try {
    const { data, error } = await db.rpc("project_owner_company_name", { p_project: projectId });
    return !error && typeof data === "string" ? data : "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/versions — Stage 2C, Version history
// ---------------------------------------------------------------------------

interface VersionListRecord {
  id: string;
  version_number: number;
  parent_version_id: string | null;
  kind: CloudVersionKind;
  label: string | null;
  author_name: string;
  created_at: string;
  schema_version: number;
}

/** Named columns. `document` is NEVER in this list. */
export const VERSION_LIST_COLUMNS = "id, version_number, parent_version_id, kind, label, author_name, created_at, schema_version";

export async function listVersions(db: SupabaseClient, projectIdParam: string): Promise<ListVersionsResponse> {
  // Unreadable, nonexistent and malformed are the same 404.
  const projectId = requirePathId(projectIdParam, PROJECT_NOT_FOUND_MESSAGE);

  const { data: project, error: projectError } = await db
    .from("projects")
    .select("id, company_id, name, folder, head_version_number")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) fail(projectError, "history");
  if (!project) throw new ProjectRouteError(404, PROJECT_NOT_FOUND_MESSAGE);
  const p = project as { id: string; company_id: string; name: string; folder: CloudFolder; head_version_number: number };

  const { data: rows, error } = await db
    .from("project_versions")
    .select(VERSION_LIST_COLUMNS)
    .eq("project_id", projectId)
    .order("version_number", { ascending: false });
  if (error) fail(error, "history");
  const records = (rows ?? []) as VersionListRecord[];

  // "Renamed to '…'" needs the name each rename carries, which lives only in
  // its document. One JSON-path extract, for RENAME ROWS ONLY, so the
  // database reads no save's document to draw this list; the document itself
  // never leaves the database. The id is the validated path id, passed with
  // .eq(), never spliced into a filter string. If it fails the rows still say
  // "Renamed", without a name: a visible gap, not a substituted one.
  const renamedTo = new Map<string, string>();
  if (records.some((r) => r.kind === "rename")) {
    try {
      const { data: names, error: namesError } = await db
        .from("project_versions")
        .select("id, project_name:document->state->>projectName")
        .eq("project_id", projectId)
        .eq("kind", "rename");
      if (!namesError) {
        for (const n of (names ?? []) as { id: string; project_name: string | null }[]) renamedTo.set(n.id, n.project_name ?? "");
      }
    } catch {
      // Enrichment only; the list stands without it.
    }
  }

  const companyName = await ownerCompanyName(db, projectId);

  const numberById = new Map(records.map((r) => [r.id, r.version_number]));
  const versions: CloudVersionRow[] = records.map((r) => ({
    versionId: r.id,
    versionNumber: r.version_number,
    parentVersionId: r.parent_version_id,
    parentVersionNumber: r.parent_version_id ? (numberById.get(r.parent_version_id) ?? null) : null,
    kind: r.kind,
    label: r.label,
    authorName: r.author_name,
    createdAt: r.created_at,
    schemaVersion: r.schema_version,
    renamedTo: r.kind === "rename" ? (renamedTo.get(r.id) ?? null) : null,
  }));

  // A save can land between the two reads; the newest row is then the head.
  const headVersionNumber = Math.max(p.head_version_number, versions[0]?.versionNumber ?? 0);

  return {
    projectId: p.id,
    companyId: p.company_id,
    companyName,
    projectName: p.name,
    folder: p.folder,
    headVersionNumber,
    versions,
    notListedCount: Math.max(0, headVersionNumber - versions.length),
  };
}

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/rename — Stage 2C
// ---------------------------------------------------------------------------

/** 1–200 characters after trimming, counted as the database counts them
 * (code points, `char_length`). */
export function readProjectName(body: Body): string {
  const value = body.name;
  if (typeof value !== "string") throw new ProjectRouteError(400, NAME_LENGTH_MESSAGE);
  const trimmed = value.trim();
  const length = [...trimmed].length;
  if (length < 1 || length > PROJECT_NAME_MAX_CHARS) throw new ProjectRouteError(400, NAME_LENGTH_MESSAGE);
  return trimmed;
}

/**
 * Renaming appends a `kind = 'rename'` version (Open Item 3): a row-only
 * rename would be undone by the next save, because the row takes its name
 * from the head document. One RPC, which copies the head under the
 * project-row lock and replaces only `state.projectName`.
 */
export async function renameProject(db: SupabaseClient, projectIdParam: string, body: Body): Promise<RenameProjectResponse> {
  const projectId = requirePathId(projectIdParam, RENAME_NOT_FOUND_MESSAGE);
  const name = readProjectName(body);

  const { data, error } = await db.rpc("rename_project", { p_project_id: projectId, p_name: name }).single();
  if (error) fail(error, "rename");
  const row = data as { version_id: string; version_number: number; created_at: string };

  return {
    projectId,
    name,
    versionId: row.version_id,
    versionNumber: row.version_number,
    createdAt: row.created_at,
    renamedFromVersionNumber: row.version_number - 1,
  };
}

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/versions/[versionId]
// ---------------------------------------------------------------------------

interface VersionRecord {
  id: string;
  project_id: string;
  version_number: number;
  created_at: string;
  schema_version: number;
  author_name: string;
  document: unknown;
}

export async function getVersion(db: SupabaseClient, projectIdParam: string, versionIdParam: string): Promise<CloudVersionResponse> {
  // Unreadable, nonexistent and malformed are the same 404, with the same message.
  const projectId = requirePathId(projectIdParam, VERSION_NOT_FOUND_MESSAGE);
  const versionId = requirePathId(versionIdParam, VERSION_NOT_FOUND_MESSAGE);

  const { data: version, error } = await db
    .from("project_versions")
    .select("id, project_id, version_number, created_at, schema_version, author_name, document")
    .eq("project_id", projectId)
    .eq("id", versionId)
    .maybeSingle();
  if (error) fail(error, "read");
  if (!version) throw new ProjectRouteError(404, VERSION_NOT_FOUND_MESSAGE);
  const v = version as VersionRecord;

  const { data: project, error: projectError } = await db
    .from("projects")
    .select("id, company_id, name, folder, head_version_number")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) fail(projectError, "read");
  if (!project) throw new ProjectRouteError(404, VERSION_NOT_FOUND_MESSAGE);
  const p = project as { id: string; company_id: string; name: string; folder: CloudFolder; head_version_number: number };

  const companyName = await ownerCompanyName(db, projectId);

  return {
    projectId: p.id,
    companyId: p.company_id,
    companyName,
    folder: p.folder,
    projectName: p.name,
    headVersionNumber: p.head_version_number,
    versionId: v.id,
    versionNumber: v.version_number,
    createdAt: v.created_at,
    schemaVersion: v.schema_version,
    authorName: v.author_name,
    document: v.document,
  };
}
