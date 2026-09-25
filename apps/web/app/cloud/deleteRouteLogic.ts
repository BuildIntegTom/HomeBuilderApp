import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DELETE_CONFIRM_REQUIRED_MESSAGE,
  DELETE_NOT_ADMIN_MESSAGE,
  DELETE_PREVIEW_REFUSED_MESSAGE,
  DELETE_REFUSED_MESSAGE,
  deleteNameMismatchMessage,
} from "./deleteDisplay";
import { displayProjectName, type CloudFolder, type DeletePreviewResponse, type DeleteProjectResponse } from "./cloudTypes";
import { ProjectRouteError, isUuid, ownerCompanyName, type Body } from "./projectRouteLogic";

/**
 * Stage 5, first slice: permanently deleting a WHOLE project.
 *
 *   GET    /api/projects/[id]/deletion   previewProjectDelete
 *   DELETE /api/projects/[id]            deleteProject
 *
 * Same shape as `projectRouteLogic.ts` and `sharingRouteLogic.ts`: the
 * session's own JWT-bound client is passed in, and NOTHING HERE ACCEPTS AN
 * ADMIN CLIENT. 0006 grants `service_role` nothing on these tables at all.
 *
 * ── WHERE THE PERMISSION ACTUALLY LIVES ────────────────────────────────────
 *
 * In the database, and only there. 0006:
 *
 *   create policy projects_delete on public.projects
 *     for delete to authenticated
 *     using (public.is_platform_admin());
 *
 * and `refuse_project_version_change` lets a version die only as the cascade
 * from that delete (`is_privileged_caller() and pg_trigger_depth() > 1`). The
 * publishable key ships in the browser, so anything the database will serve,
 * PostgREST will serve directly: a check that lived here and nowhere else
 * would not be a check. `requireAdmin` below is FAIL-CLOSED HONESTY, not the
 * gate — it refuses, it never permits, and a caller who got past it still
 * deletes exactly zero rows unless the policy says otherwise.
 *
 * ── THE TYPED CONFIRMATION ─────────────────────────────────────────────────
 *
 * Also not a permission check. It is an interlock against deleting the wrong
 * project, and it is checked HERE, against the name the database holds at that
 * moment, rather than against whatever the browser thought the name was. That
 * is what makes it name a specific PROJECT and not just a string: a rename
 * landing while the box was open turns the delete into a refusal.
 */

interface DbError {
  code?: string;
  message?: string;
}

/** Who is asking, from the verified session — never from the request. */
export interface DeleteViewer {
  isPlatformAdmin: boolean;
}

export type DeleteOperation = "preview" | "delete";

/**
 * The route's fail-closed check. If it cannot be determined from the VERIFIED
 * session that the caller is a platform admin, refuse — including when there
 * is no user on the session at all.
 */
export function requireAdmin(viewer: DeleteViewer | null | undefined): void {
  if (viewer?.isPlatformAdmin === true) return;
  // The SAME message for the preview and for the delete: both say the delete
  // did not happen, and neither reveals whether the project exists.
  throw new ProjectRouteError(403, DELETE_NOT_ADMIN_MESSAGE);
}

/**
 * 0006's SQLSTATEs on this path. 42501 is both "RLS said no" and the version
 * guard's refusal; PGRST116 is `.single()` with no row; 22P02 is a malformed
 * uuid (checked up front, this is the backstop). Anything unmapped is thrown
 * as-is for errorResponse's generic 500 — no database message is ever
 * forwarded.
 *
 * ONE ANSWER for "no such project" and "not yours", so a project id cannot be
 * probed through deletion.
 */
export function mapDeleteDbError(error: DbError, operation: DeleteOperation): ProjectRouteError | null {
  switch (error.code) {
    case "42501":
    case "22P02":
    case "PGRST116":
      return new ProjectRouteError(404, operation === "preview" ? DELETE_PREVIEW_REFUSED_MESSAGE : DELETE_REFUSED_MESSAGE);
    default:
      return null;
  }
}

function fail(error: DbError, operation: DeleteOperation): never {
  throw mapDeleteDbError(error, operation) ?? error;
}

interface ProjectRecord {
  id: string;
  name: string;
  folder: CloudFolder;
  head_version_number: number;
}

const PROJECT_COLUMNS = "id, name, folder, head_version_number";

/**
 * One cascade table's row count, or null when it could not be read.
 *
 * A failed count is NEVER 0. The note prints the gap instead, because on this
 * screen a wrong 0 reads as "there is nothing of this kind to lose".
 */
async function countFor(db: SupabaseClient, table: "project_versions" | "collaborators" | "collab_requests", projectId: string) {
  try {
    const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq("project_id", projectId);
    if (error || typeof count !== "number") return null;
    return count;
  } catch {
    return null;
  }
}

/** The project row, or the operation's own 404. */
async function readProject(db: SupabaseClient, projectId: string, operation: DeleteOperation): Promise<ProjectRecord> {
  const { data, error } = await db.from("projects").select(PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
  if (error) fail(error, operation);
  if (!data) {
    throw new ProjectRouteError(404, operation === "preview" ? DELETE_PREVIEW_REFUSED_MESSAGE : DELETE_REFUSED_MESSAGE);
  }
  return data as unknown as ProjectRecord;
}

/**
 * The three cascade tables of 0006, 0008 and 0009 — the complete footprint of
 * a project delete. Read together so the note can say how much is at stake.
 */
async function footprint(db: SupabaseClient, projectId: string) {
  const [versionCount, grantCount, accessRequestCount] = await Promise.all([
    countFor(db, "project_versions", projectId),
    countFor(db, "collaborators", projectId),
    countFor(db, "collab_requests", projectId),
  ]);
  return { versionCount, grantCount, accessRequestCount };
}

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/deletion — what a delete would destroy
// ---------------------------------------------------------------------------

export async function previewProjectDelete(db: SupabaseClient, viewer: DeleteViewer, projectIdParam: string): Promise<DeletePreviewResponse> {
  requireAdmin(viewer);
  if (!isUuid(projectIdParam)) throw new ProjectRouteError(404, DELETE_PREVIEW_REFUSED_MESSAGE);
  const project = await readProject(db, projectIdParam, "preview");
  const counts = await footprint(db, projectIdParam);
  return {
    projectId: project.id,
    projectName: project.name,
    ownerCompanyName: await ownerCompanyName(db, projectIdParam),
    folder: project.folder,
    headVersionNumber: project.head_version_number,
    ...counts,
    // Computed from the name the database just gave us, so the phrase and the
    // check below can never disagree about what has to be typed.
    confirmationPhrase: displayProjectName(project.name),
  };
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id] — do it
// ---------------------------------------------------------------------------

/**
 * Does the typed text confirm THIS project?
 *
 * Compared against the name the database holds right now, after Unicode
 * normalisation and trimming the ends — the ends because trailing space is
 * invisible on screen and nobody can be asked to reproduce it, the middle
 * left alone because "Smith  House" and "Smith House" are different names and
 * this is the one moment to be fussy. Case-sensitive, deliberately.
 *
 * A project with no name is confirmed by typing the tree's own gap marker,
 * `(untitled)`. That is not a substituted name: it is the text on screen.
 */
export function confirmationMatches(typed: unknown, projectName: string): boolean {
  if (typeof typed !== "string") return false;
  const normalize = (value: string) => value.normalize("NFC").trim();
  const wanted = normalize(displayProjectName(projectName));
  return wanted.length > 0 && normalize(typed) === wanted;
}

export function readConfirmation(body: Body): string {
  const value = body.confirm;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProjectRouteError(400, DELETE_CONFIRM_REQUIRED_MESSAGE);
  }
  return value;
}

export async function deleteProject(
  db: SupabaseClient,
  viewer: DeleteViewer,
  projectIdParam: string,
  body: Body,
): Promise<DeleteProjectResponse> {
  requireAdmin(viewer);
  if (!isUuid(projectIdParam)) throw new ProjectRouteError(404, DELETE_REFUSED_MESSAGE);
  const typed = readConfirmation(body);

  // Read before deleting: the counts are only knowable while the rows exist,
  // and the name has to be the database's, not the browser's.
  const project = await readProject(db, projectIdParam, "delete");
  if (!confirmationMatches(typed, project.name)) {
    throw new ProjectRouteError(409, deleteNameMismatchMessage(displayProjectName(project.name)));
  }
  const counts = await footprint(db, projectIdParam);
  const owner = await ownerCompanyName(db, projectIdParam);

  // THE DELETE ITSELF. Unconditional on anything this file worked out:
  // projects_delete decides, and `refuse_project_version_change` decides
  // whether the version cascade is allowed to follow. An RLS-denied DELETE is
  // silent, so the affected rows are the answer — zero means refused, whatever
  // the reason, and the project is still there.
  const { data, error } = await db.from("projects").delete().eq("id", projectIdParam).select("id");
  if (error) fail(error, "delete");
  if (!data || data.length === 0) throw new ProjectRouteError(404, DELETE_REFUSED_MESSAGE);

  return {
    projectId: projectIdParam,
    projectName: project.name,
    ownerCompanyName: owner,
    deletedVersions: counts.versionCount,
    deletedGrants: counts.grantCount,
    deletedAccessRequests: counts.accessRequestCount,
  };
}
