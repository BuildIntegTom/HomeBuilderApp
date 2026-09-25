import { FOLDER_LABEL, displayProjectName, type DeletePreviewResponse, type DeleteProjectResponse } from "./cloudTypes";

/**
 * Stage 5, first slice: the words for permanently deleting a WHOLE project.
 *
 * Pure, and imported by BOTH the route and the note, so a refusal the server
 * words and a warning the browser words cannot drift apart — the same
 * arrangement as `sharingDisplay.ts`.
 *
 * It decides nothing. `projects_delete` (0006) is the gate:
 *
 *   create policy projects_delete on public.projects
 *     for delete to authenticated
 *     using (public.is_platform_admin());
 *
 * Everything here is the courtesy on top of it. In particular THE TYPED
 * CONFIRMATION IS NOT A PERMISSION CHECK: it is an interlock against a slip,
 * and a platform admin who wanted to could delete the row through PostgREST
 * without typing anything. That is fine, and it is why the typing is not the
 * thing keeping anybody's work safe — the policy is.
 *
 * Every refusal says what happened AND what was not changed, because the one
 * thing someone needs to know after a failed delete is whether their project
 * is still there.
 */

// ---------------------------------------------------------------------------
// Refusals. Each names what was NOT changed.
// ---------------------------------------------------------------------------

/** The route's fail-closed answer: the session does not say platform admin.
 * The database would refuse it too (zero rows); this is the honest message
 * instead of a silent no-op. */
export const DELETE_NOT_ADMIN_MESSAGE =
  "Only a platform admin can permanently delete a project. Nothing was deleted.";

/** Zero affected rows, or a project that cannot be read. One answer for "no
 * such project" and "not yours", so an id cannot be probed through deletion. */
export const DELETE_REFUSED_MESSAGE = "That project doesn't exist, or you can't delete it. Nothing was deleted.";

export const DELETE_CONFIRM_REQUIRED_MESSAGE =
  "Type the project's name exactly to confirm the delete. Nothing was deleted.";

/**
 * The typed text is not this project's name. Covers both a typo and a rename
 * that landed while the confirmation box was open, because from here the two
 * are the same fact: the name you are confirming is not the name it has.
 */
export function deleteNameMismatchMessage(currentName: string): string {
  return `That isn't this project's name, so nothing was deleted. It is called ${quoted(currentName)} right now — if somebody renamed it while this was open, check you still mean to delete it.`;
}

export const DELETE_PREVIEW_REFUSED_MESSAGE =
  "Couldn't read what deleting that project would destroy, so it isn't safe to offer the delete. Nothing was deleted.";

// ---------------------------------------------------------------------------
// The warning: what will be destroyed, and how much of it.
// ---------------------------------------------------------------------------

export const DELETE_BUTTON_LABEL = "Delete…";

export const DELETE_CONFIRM_LABEL = "Permanently delete this project";

/**
 * The heading. It says permanent and it says whose, because the person doing
 * this can delete any company's project, not only their own.
 */
export function deleteHeading(projectName: string, ownerCompanyName: string): string {
  const owner = ownerCompanyName.trim().length > 0 ? ownerCompanyName : "a company whose name couldn't be read";
  return `Permanently delete ${quoted(displayProjectName(projectName))}, owned by ${owner}?`;
}

export const DELETE_IRREVERSIBLE_LINE =
  "This cannot be undone. There is no restore, no archive and no backup taken for you: once it is gone, the only copies are the files somebody has already downloaded.";

export const DELETE_ARCHIVE_LINE =
  "Past Projects is the archive. If you only want it out of the way, Move to… › Past Projects keeps every version.";

/**
 * "12 versions", "1 version", or the visible gap when the count could not be
 * read. Never "0 versions" from a failed read.
 */
export function countPhrase(count: number | null, singular: string, plural: string): string {
  if (count === null) return `an unknown number of ${plural} (they couldn't be counted)`;
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * The destruction list, one bullet each. Versions, grants and access requests
 * are the three things that cascade off a project — nothing else in the schema
 * references one — so this list is complete, not a sample.
 */
export function deleteFootprintLines(preview: DeletePreviewResponse): string[] {
  return [
    `The project itself, filed under ${FOLDER_LABEL[preview.folder]}, and its whole history: ${countPhrase(preview.versionCount, "saved version", "saved versions")}, up to v${preview.headVersionNumber}.`,
    `${capitalize(countPhrase(preview.grantCount, "share with a person or a company", "shares with people or companies"))}. The people they reached lose this project.`,
    `${capitalize(countPhrase(preview.accessRequestCount, "access request", "access requests"))} made on it, answered or not.`,
  ];
}

/** What to type, said plainly, including the awkward case of a project with no
 * name at all — where the phrase is the same `(untitled)` the tree shows. */
export function deleteConfirmPrompt(confirmationPhrase: string): string {
  return `To confirm, type the project's name exactly: ${confirmationPhrase}`;
}

export const DELETE_UNTITLED_HINT =
  "This project has no name, so type the gap marker shown above, brackets included — that is what the tree calls it.";

// ---------------------------------------------------------------------------
// Success. It says what went, and what did not.
// ---------------------------------------------------------------------------

export function deletedMessage(result: DeleteProjectResponse): string {
  const owner = result.ownerCompanyName.trim().length > 0 ? result.ownerCompanyName : "its company";
  return (
    `Deleted ${quoted(displayProjectName(result.projectName))} permanently from ${owner}. ` +
    `With it went ${countPhrase(result.deletedVersions, "saved version", "saved versions")}, ` +
    `${countPhrase(result.deletedGrants, "share", "shares")} and ` +
    `${countPhrase(result.deletedAccessRequests, "access request", "access requests")}. ` +
    `Nothing else was touched.`
  );
}

/**
 * The project just deleted was the one open in this editor. The design on
 * screen is NOT replaced and its title-block date does not move (only the four
 * date writers move it); what goes is the attachment, exactly as an account
 * change detaches without replacing.
 */
export const DELETED_WAS_OPEN_HERE_LINE =
  "It was the project open in this editor. The design on screen was not changed and is still yours to save — but it is no longer attached to a cloud project, so Save to cloud will offer to make a new one.";

// ---------------------------------------------------------------------------

function quoted(text: string): string {
  return `"${text}"`;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}
