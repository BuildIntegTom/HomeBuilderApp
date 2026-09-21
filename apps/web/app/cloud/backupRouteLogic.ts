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
 * WHAT IT COVERS — TWO SOURCES SINCE STAGE 3E:
 *   1. `owned`   — every version of every project the company OWNS
 *                  (`projects.company_id`), which is all Stage 2D covered;
 *   2. `granted` — every version of every project GRANTED TO THAT COMPANY
 *                  (a `collaborators` row with `grantee_company_id` = it).
 *
 * Both filters are load-bearing, not decoration: RLS lets a platform admin read
 * every company's projects AND every grant, so without them a platform admin's
 * Building Integrity backup would carry Rare Forms' designs and Rare Forms'
 * shares too.
 *
 * WHAT IT STILL DOES NOT COVER. A PERSONAL grant (`grantee_user_id`) is in no
 * company's backup but the owner's (Open Item 2): it belongs to a person, and
 * `.eq('grantee_company_id', …)` never matches such a row. Nothing visible only
 * through browsing is here either, because browsing does not exist (Stage 4).
 * So a backup still holds only what its own company could already export by
 * hand, one version at a time (decision 29).
 *
 * PAGING ORDER AND CURSOR — ONE TOTAL ORDER OVER BOTH SOURCES.
 * Versions are ordered by (phase, project id, version number), with the whole
 * `owned` phase before the whole `granted` phase. `after` is
 * "<phase>:<project id>:<version number>" of the last version already received,
 * and A CURSOR WITH NO PHASE READS AS `owned`, so a backup already in progress
 * survives a deploy.
 *
 * WHY IT CANNOT SKIP OR DUPLICATE. That triple is a total order, and every
 * resumption is defined as "the next version after this one IN THAT ORDER":
 * within the cursor's project, versions `.gt(version_number)`; then projects
 * `.gt(id)` within the cursor's phase; then, once that phase is exhausted, the
 * next phase from its beginning. Each step is strictly forward, so no version
 * can be visited twice, and no step jumps over an intervening version. A
 * project that is BOTH owned and granted appears ONCE, in the owned phase only:
 * the granted walk skips any project whose `company_id` is the backing-up
 * company, and that test is on the row the database returned, so it gives the
 * same answer on every page.
 *
 * Every filter is `.eq()` / `.gt()` on a validated uuid or integer; nothing
 * from the request is spliced into a PostgREST filter string. A save that lands
 * mid-backup on a project not yet finished is included; one on a project
 * already passed is not, which is "as of when that project was read".
 *
 * A GRANT REMOVED MID-BACKUP is the granted phase's version of a project
 * deleted mid-backup: the project is no longer readable, so the walk carries on
 * from the next granted project. The browser's completeness check applies only
 * to the projects it actually received versions of.
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
/**
 * Documents are read this many at a time, in parallel, rather than one after
 * another (up to ~53 sequential reads a page before). A page may fetch up to
 * one batch of documents it then leaves out (when the budget is crossed at
 * the first version of a batch); they are simply read again for the next page.
 */
export const BACKUP_DOCUMENT_BATCH_SIZE = 5;

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

/** The two sources, in the order they are walked. */
export type BackupPhase = "owned" | "granted";

export interface BackupCursor {
  phase: BackupPhase;
  projectId: string;
  versionNumber: number;
}

export function formatBackupCursor(cursor: BackupCursor): string {
  return `${cursor.phase}:${cursor.projectId}:${cursor.versionNumber}`;
}

/**
 * Absent or empty is the first page. Anything malformed is a 400.
 *
 * A PHASE-LESS "<project>:<n>" IS READ AS `owned`, which is exactly Stage 2D's
 * cursor: a browser part-way through a backup when this deploys asks for its
 * next page in the old shape and is answered correctly, then receives phased
 * cursors from here on.
 */
export function parseBackupCursor(value: string | null | undefined): BackupCursor | null {
  if (value === null || value === undefined || value === "") return null;
  const match = /^(?:(owned|granted):)?([0-9a-f-]{36}):(\d{1,9})$/i.exec(value);
  if (!match || !isUuid(match[2])) throw new ProjectRouteError(400, BACKUP_CURSOR_MESSAGE);
  const phase = (match[1]?.toLowerCase() ?? "owned") as BackupPhase;
  return { phase, projectId: match[2], versionNumber: Number(match[3]) };
}

/** Default 25, at most 50. A non-integer or a value below 1 is a 400. */
export function parseBackupLimit(value: string | null | undefined): number {
  if (value === null || value === undefined || value === "") return BACKUP_PAGE_DEFAULT_VERSIONS;
  if (!/^\d{1,6}$/.test(value) || Number(value) < 1) throw new ProjectRouteError(400, BACKUP_CURSOR_MESSAGE);
  return Math.min(Number(value), BACKUP_PAGE_MAX_VERSIONS);
}

interface ProjectRecord {
  id: string;
  /** 3E: the owner. For a granted project this is ANOTHER company. */
  company_id: string;
  name: string;
  folder: CloudFolder;
  head_version_number: number;
}

/** A project the walk is currently on, and which source it came from. */
interface PhaseProject {
  phase: BackupPhase;
  record: ProjectRecord;
  /** Null for an owned project; the other company for a granted one. */
  ownerCompany: { id: string; name: string } | null;
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

const PROJECT_COLUMNS = "id, company_id, name, folder, head_version_number";

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
  let grantedProjectCount: number | null = null;
  if (!cursor) {
    const { count, error } = await db.from("projects").select("id", { count: "exact", head: true }).eq("company_id", companyId);
    if (error) fail(error);
    projectCount = count ?? null;
    // One grant row per project per company (0008's unique index), so counting
    // rows counts projects. An upper bound only: see the field's own note.
    const { count: granted, error: grantError } = await db
      .from("collaborators")
      .select("project_id", { count: "exact", head: true })
      .eq("grantee_company_id", companyId);
    if (grantError) fail(grantError);
    grantedProjectCount = granted ?? null;
  }

  // --- the owned source -----------------------------------------------------
  const nextOwnedProject = async (afterId: string | null): Promise<ProjectRecord | null> => {
    let request = db.from("projects").select(PROJECT_COLUMNS).eq("company_id", companyId);
    if (afterId) request = request.gt("id", afterId);
    const { data, error } = await request.order("id", { ascending: true }).limit(1);
    if (error) fail(error);
    return ((data ?? []) as ProjectRecord[])[0] ?? null;
  };

  // --- the granted source ---------------------------------------------------
  /**
   * The owning company's NAME, through `project_owner_company_name` (0008) and
   * not a `companies` read: `companies_select` hides the owner's row from a
   * company that merely holds a grant, so a plain read would put a blank owner
   * in the manifest. A failure is an empty name — a visible gap, never a
   * substituted one — because the grant, not this name, decided access.
   */
  const ownerCompanyName = async (projectId: string): Promise<string> => {
    try {
      const { data, error } = await db.rpc("project_owner_company_name", { p_project: projectId });
      return !error && typeof data === "string" ? data : "";
    } catch {
      return "";
    }
  };

  /** The next project id granted TO THIS COMPANY after `afterId`. */
  const nextGrantedProjectId = async (afterId: string | null): Promise<string | null> => {
    let request = db.from("collaborators").select("project_id").eq("grantee_company_id", companyId);
    if (afterId) request = request.gt("project_id", afterId);
    const { data, error } = await request.order("project_id", { ascending: true }).limit(1);
    if (error) fail(error);
    return ((data ?? []) as { project_id: string }[])[0]?.project_id ?? null;
  };

  /** Does a COMPANY grant on this project still reach this company? */
  const holdsCompanyGrant = async (projectId: string): Promise<boolean> => {
    const { data, error } = await db
      .from("collaborators")
      .select("project_id")
      .eq("grantee_company_id", companyId)
      .eq("project_id", projectId)
      .limit(1);
    if (error) fail(error);
    return ((data ?? []) as unknown[]).length > 0;
  };

  /**
   * A granted project, or null when it must be skipped. NO `company_id` filter
   * here — the whole point is that another company owns it — so the grant read
   * above is what admits it, and RLS is the gate underneath.
   *
   * Null in two cases, both of which the walk simply steps past:
   *  - the project is gone, or no longer readable (a grant removed mid-backup);
   *  - the backing-up company OWNS it, so the owned phase already has it. That
   *    cannot arise today (`share_project_with_company` refuses `owner-company`)
   *    but a duplicate file in a backup is worse than a wasted read.
   */
  const grantedProject = async (projectId: string): Promise<PhaseProject | null> => {
    const { data, error } = await db.from("projects").select(PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
    if (error) fail(error);
    const record = (data ?? null) as ProjectRecord | null;
    if (!record || record.company_id === companyId) return null;
    return { phase: "granted", record, ownerCompany: { id: record.company_id, name: await ownerCompanyName(record.id) } };
  };

  const nextGrantedProject = async (afterId: string | null): Promise<PhaseProject | null> => {
    let from = afterId;
    for (;;) {
      const id = await nextGrantedProjectId(from);
      if (!id) return null;
      const project = await grantedProject(id);
      if (project) return project;
      from = id;
    }
  };

  /**
   * The next project in the total order, crossing the phase boundary when the
   * owned phase runs out. `from` is null for the very first project.
   */
  const advance = async (from: { phase: BackupPhase; projectId: string } | null): Promise<PhaseProject | null> => {
    if (from === null || from.phase === "owned") {
      const owned = await nextOwnedProject(from?.projectId ?? null);
      if (owned) return { phase: "owned", record: owned, ownerCompany: null };
      return nextGrantedProject(null);
    }
    return nextGrantedProject(from.projectId);
  };

  let current: PhaseProject | null;
  let afterNumber = 0;
  if (cursor && cursor.phase === "owned") {
    const { data, error } = await db
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("company_id", companyId)
      .eq("id", cursor.projectId)
      .maybeSingle();
    if (error) fail(error);
    if (data) {
      current = { phase: "owned", record: data as ProjectRecord, ownerCompany: null };
      afterNumber = cursor.versionNumber;
    } else {
      // Deleted (platform admin) since the last page, or not this company's:
      // carry on from the next project either way.
      current = await advance({ phase: "owned", projectId: cursor.projectId });
    }
  } else if (cursor) {
    // THE GRANT IS CHECKED BEFORE THE PROJECT IS READ, and that check is what
    // stops a cursor being used as a way in: `after` comes from the browser, so
    // without it a platform admin acting as one company could name any project
    // id at all and have this route page out its versions. With it, a granted
    // cursor reads only a project this company really holds a grant on.
    const held = await holdsCompanyGrant(cursor.projectId);
    const resumed = held ? await grantedProject(cursor.projectId) : null;
    if (resumed) {
      current = resumed;
      afterNumber = cursor.versionNumber;
    } else {
      current = await advance({ phase: "granted", projectId: cursor.projectId });
    }
  } else {
    current = await advance(null);
  }

  const versions: BackupVersionEntry[] = [];
  let bytes = 0;
  let pageFull = false;

  while (current && !pageFull) {
    const { phase, record: project, ownerCompany } = current;
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

    for (let start = 0; start < metas.length && !pageFull; start += BACKUP_DOCUMENT_BATCH_SIZE) {
      const batch = metas.slice(start, start + BACKUP_DOCUMENT_BATCH_SIZE);
      // One read per document (`.eq()` on the project and the version id), a
      // small batch of them in parallel. The budget check below still walks
      // the batch in version order, so a page stops before the first version
      // that would take it over, and the cursor is the last one included.
      const docRows = await Promise.all(
        batch.map(async (meta) => {
          const { data, error } = await db
            .from("project_versions")
            .select("document")
            .eq("project_id", project.id)
            .eq("id", meta.id)
            .maybeSingle();
          if (error) fail(error);
          return data as { document: unknown } | null;
        }),
      );

      for (let i = 0; i < batch.length; i++) {
        const meta = batch[i];
        const docRow = docRows[i];
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
          document: docRow ? docRow.document : null,
          omitted: docRow ? null : "missing",
          ownership: phase,
          ownerCompany,
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
    }
    if (pageFull) break;

    if (metas.length < want) {
      // This project has nothing more after `afterNumber`: step forward in the
      // total order, which crosses into the granted phase when owned runs out.
      current = await advance({ phase, projectId: project.id });
      afterNumber = 0;
    } else {
      pageFull = true;
    }
  }

  const done = current === null;
  const last = versions[versions.length - 1];
  return {
    company: { id: companyId, name: access.companyName },
    exportedBy: { id: caller.user.id, email: caller.user.email, displayName: caller.user.displayName },
    serverTime: now().toISOString(),
    projectCount,
    grantedProjectCount,
    versions,
    // The cursor carries the LAST ENTRY'S OWN PHASE, so a page that crosses the
    // owned/granted seam resumes on the right side of it.
    nextAfter:
      done || !last ? null : formatBackupCursor({ phase: last.ownership, projectId: last.projectId, versionNumber: last.versionNumber }),
    done,
  };
}
