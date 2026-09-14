import type { SupabaseClient } from "@supabase/supabase-js";
import type { Entitlement } from "../auth/actingAs";
import type { BackupPageResponse, BackupVersionEntry, CloudFolder, CloudVersionKind } from "./cloudTypes";
import { ProjectRouteError, VERSION_LIST_COLUMNS, isUuid, mapProjectDbError } from "./projectRouteLogic";

/**
 * Stage 2D: GET /api/companies/[id]/backup?after=&limit= — the company backup,
 * one page at a time. The browser writes the zip (companyBackup.ts); this only
 * hands it versions. Spec: "Stage 2 plan", "Company backup (29) — concrete shape".
 *
 * WHY PAGED. A version's document may be up to 4 MB and a company may hold
 * thousands of versions, while a Vercel function response is capped at about
 * 4.5 MB. So no response here ever carries more than BACKUP_PAGE_BYTE_BUDGET of
 * JSON (or one version on its own), and never more than BACKUP_PAGE_MAX_VERSIONS
 * versions.
 *
 * WHAT DECIDES ACCESS. The session's own JWT-bound client, so RLS is the access
 * control; NO ADMIN CLIENT, as for every Stage 2 route. The admin-only check
 * below is a CONVENIENCE GATE, not a security one (Open Item 4): any member can
 * already open every version of their company's projects one at a time.
 *
 * WHAT IT COVERS: every version of every project the company OWNS
 * (`projects.company_id`). The `company_id` filter is load-bearing, not
 * decoration: RLS lets a platform admin read every company's projects, so
 * without it a platform admin's Building Integrity backup would carry Rare
 * Forms' designs too. Granted projects join in Stage 3; nothing is visible
 * through browsing in Stage 2.
 *
 * PAGING ORDER AND CURSOR. Projects by id, then versions by number, and `after`
 * is "<project id>:<version number>" of the last version already received.
 * Every filter is `.eq()` / `.gt()` on a validated uuid or integer; nothing
 * from the request is spliced into a PostgREST filter string. A save that lands
 * mid-backup on a project not yet finished is included; one on a project
 * already passed is not, which is "as of when that project was read".
 */

/** Administrative numbers, not building values. */
export const BACKUP_PAGE_DEFAULT_VERSIONS = 25;
export const BACKUP_PAGE_MAX_VERSIONS = 50;
/** JSON bytes per page, leaving headroom under Vercel's ~4.5 MB response limit. */
export const BACKUP_PAGE_BYTE_BUDGET = 4_000_000;
/**
 * A single version bigger than this is not sent at all: it would breach the
 * platform limit and fail as an opaque error. 0006 refuses a document over
 * 4 MB of `document::text`, and the minified JSON sent here is never longer
 * than that, so this is a guard that should never fire.
 */
export const BACKUP_SINGLE_VERSION_HARD_LIMIT = 4_400_000;

export const BACKUP_COMPANY_NOT_FOUND_MESSAGE = "That company doesn't exist, or you can't back it up.";
export const BACKUP_CURSOR_MESSAGE = "That backup page request isn't valid. No file was saved; start the backup again.";

export type BackupAccessCheck =
  | { ok: true; companyId: string; companyName: string }
  | { ok: false; status: 403 | 409; message: string };

/**
 * Who may download a company's backup: a company admin of the VERIFIED
 * acting-as company, or a platform admin acting as it. The same rule as the
 * account panel's `isAdminHere`, so the entry and the route agree.
 *
 * The path names a company; it must be the acting-as company. Checked against
 * the verified acting-as company rather than against any entitlement
 * (`requireEntitlement`), which is narrower: the acting-as company is itself
 * resolved from the entitlements. A mismatch is the per-browser cookie
 * changing under this tab, answered with a visible 409 exactly as a create is.
 */
export function checkBackupAccess(actingAs: Entitlement | null, isPlatformAdmin: boolean, companyId: string): BackupAccessCheck {
  if (!actingAs) {
    return { ok: false, status: 403, message: "You aren't acting as a company, so there's no company backup to download." };
  }
  if (actingAs.companyId !== companyId) {
    return {
      ok: false,
      status: 409,
      message: `You're now acting as ${actingAs.companyName} (changed in another tab). The backup stopped; no file was saved.`,
    };
  }
  const isCompanyAdmin = actingAs.source === "membership" && actingAs.level === "admin";
  if (!isCompanyAdmin && !isPlatformAdmin) {
    return {
      ok: false,
      status: 403,
      message: `Only a company admin of ${actingAs.companyName} can download its backup.`,
    };
  }
  return { ok: true, companyId: actingAs.companyId, companyName: actingAs.companyName };
}

export interface BackupCursor {
  projectId: string;
  versionNumber: number;
}

export function formatBackupCursor(cursor: BackupCursor): string {
  return `${cursor.projectId}:${cursor.versionNumber}`;
}

/** Absent or empty is the first page. Anything malformed is a 400. */
export function parseBackupCursor(value: string | null | undefined): BackupCursor | null {
  if (value === null || value === undefined || value === "") return null;
  const match = /^([0-9a-f-]{36}):(\d{1,9})$/i.exec(value);
  if (!match || !isUuid(match[1])) throw new ProjectRouteError(400, BACKUP_CURSOR_MESSAGE);
  return { projectId: match[1], versionNumber: Number(match[2]) };
}

/** Default 25, at most 50. A non-integer or a value below 1 is a 400. */
export function parseBackupLimit(value: string | null | undefined): number {
  if (value === null || value === undefined || value === "") return BACKUP_PAGE_DEFAULT_VERSIONS;
  if (!/^\d{1,6}$/.test(value) || Number(value) < 1) throw new ProjectRouteError(400, BACKUP_CURSOR_MESSAGE);
  return Math.min(Number(value), BACKUP_PAGE_MAX_VERSIONS);
}

interface ProjectRecord {
  id: string;
  name: string;
  folder: CloudFolder;
  head_version_number: number;
}

interface VersionMetaRecord {
  id: string;
  version_number: number;
  parent_version_id: string | null;
  kind: CloudVersionKind;
  label: string | null;
  author_name: string;
  created_at: string;
  schema_version: number;
}

const PROJECT_COLUMNS = "id, name, folder, head_version_number";

function fail(error: { code?: string; message?: string }): never {
  throw mapProjectDbError(error, "backup") ?? error;
}

export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export interface BackupCaller {
  actingAs: Entitlement | null;
  user: { id: string; email: string; displayName: string; isPlatformAdmin: boolean };
}

export async function readBackupPage(
  db: SupabaseClient,
  caller: BackupCaller,
  companyIdParam: string,
  query: { after?: string | null; limit?: string | null },
  now: () => Date = () => new Date(),
): Promise<BackupPageResponse> {
  // A malformed company id reads the same as one you can't back up.
  if (!isUuid(companyIdParam)) throw new ProjectRouteError(404, BACKUP_COMPANY_NOT_FOUND_MESSAGE);
  const access = checkBackupAccess(caller.actingAs, caller.user.isPlatformAdmin, companyIdParam);
  if (!access.ok) throw new ProjectRouteError(access.status, access.message);
  const companyId = access.companyId;

  const cursor = parseBackupCursor(query.after);
  const limit = parseBackupLimit(query.limit);

  let projectCount: number | null = null;
  if (!cursor) {
    const { count, error } = await db.from("projects").select("id", { count: "exact", head: true }).eq("company_id", companyId);
    if (error) fail(error);
    projectCount = count ?? null;
  }

  const nextProject = async (afterId: string | null): Promise<ProjectRecord | null> => {
    let request = db.from("projects").select(PROJECT_COLUMNS).eq("company_id", companyId);
    if (afterId) request = request.gt("id", afterId);
    const { data, error } = await request.order("id", { ascending: true }).limit(1);
    if (error) fail(error);
    return ((data ?? []) as ProjectRecord[])[0] ?? null;
  };

  let project: ProjectRecord | null;
  let afterNumber = 0;
  if (cursor) {
    const { data, error } = await db
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("company_id", companyId)
      .eq("id", cursor.projectId)
      .maybeSingle();
    if (error) fail(error);
    if (data) {
      project = data as ProjectRecord;
      afterNumber = cursor.versionNumber;
    } else {
      // Deleted (platform admin) since the last page, or not this company's:
      // carry on from the next project either way.
      project = await nextProject(cursor.projectId);
    }
  } else {
    project = await nextProject(null);
  }

  const versions: BackupVersionEntry[] = [];
  let bytes = 0;
  let pageFull = false;

  while (project && !pageFull) {
    const want = limit - versions.length;
    // Named columns: the metadata read never selects `document`.
    const { data: metaRows, error: metaError } = await db
      .from("project_versions")
      .select(VERSION_LIST_COLUMNS)
      .eq("project_id", project.id)
      .gt("version_number", afterNumber)
      .order("version_number", { ascending: true })
      .limit(want);
    if (metaError) fail(metaError);
    const metas = (metaRows ?? []) as VersionMetaRecord[];

    for (const meta of metas) {
      // One document per read, so a page can stop the moment the next one
      // would push it over the byte budget, having fetched at most one extra.
      const { data: docRow, error: docError } = await db
        .from("project_versions")
        .select("document")
        .eq("project_id", project.id)
        .eq("id", meta.id)
        .maybeSingle();
      if (docError) fail(docError);

      const entry: BackupVersionEntry = {
        projectId: project.id,
        projectName: project.name,
        folder: project.folder,
        projectHeadVersionNumber: project.head_version_number,
        versionId: meta.id,
        versionNumber: meta.version_number,
        parentVersionId: meta.parent_version_id,
        kind: meta.kind,
        label: meta.label,
        authorName: meta.author_name,
        createdAt: meta.created_at,
        schemaVersion: meta.schema_version,
        document: docRow ? (docRow as { document: unknown }).document : null,
        omitted: docRow ? null : "missing",
      };
      let size = jsonByteLength(entry);
      if (size > BACKUP_SINGLE_VERSION_HARD_LIMIT) {
        entry.document = null;
        entry.omitted = "too-large";
        size = jsonByteLength(entry);
      }
      // The first version always goes, so a page always advances.
      if (versions.length > 0 && bytes + size + 1 > BACKUP_PAGE_BYTE_BUDGET) {
        pageFull = true;
        break;
      }
      versions.push(entry);
      bytes += size + 1;
    }
    if (pageFull) break;

    if (metas.length < want) {
      // This project has nothing more after `afterNumber`.
      project = await nextProject(project.id);
      afterNumber = 0;
    } else {
      pageFull = true;
    }
  }

  const done = project === null;
  const last = versions[versions.length - 1];
  return {
    company: { id: companyId, name: access.companyName },
    exportedBy: { id: caller.user.id, email: caller.user.email, displayName: caller.user.displayName },
    serverTime: now().toISOString(),
    projectCount,
    versions,
    nextAfter: done || !last ? null : formatBackupCursor({ projectId: last.projectId, versionNumber: last.versionNumber }),
    done,
  };
}
