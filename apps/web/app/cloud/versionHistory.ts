import { displayProjectName, type CloudContext, type ListVersionsResponse } from "./cloudTypes";
import { versionRange } from "./divergenceNotice";
import type { RenameOutcome } from "./documentSession";
import { classifyCloudSchemaVersion, type CloudSchemaOutcome } from "./schemaOutcome";

/**
 * Stage 2C: what the Version history note shows, and the notes that opening an
 * older version or renaming leave behind. Pure, so every case is testable
 * without a browser. Spec: "Stage 2 plan", "UI" (Version history), "Opening a
 * version, and older app versions", "Name sync".
 */

export interface HistoryRowModel {
  versionId: string;
  versionNumber: number;
  /** "Saved", "Renamed to 'Smith Residence'", or "Renamed" if its name could
   * not be read back. A label only: `kind` is not proof of what changed. */
  title: string;
  authorName: string;
  createdAt: string;
  label: string | null;
  isLatest: boolean;
  /** This editor's base: "you started from this one". */
  isBase: boolean;
  /** The parent's number, only when it is not the version just before
   * (a save that started from an older version). */
  startedFromVersionNumber: number | null;
  schema: CloudSchemaOutcome["kind"];
  /** The out-of-window badge, or null. */
  badge: string | null;
  canOpen: boolean;
  /** Out-of-window versions offer the untouched stored file instead. */
  offerDownload: boolean;
}

const quoted = (name: string) => `'${displayProjectName(name)}'`;

export function buildHistoryRows(
  history: ListVersionsResponse,
  cloudContext: CloudContext | null,
  currentSchemaVersion: number,
): HistoryRowModel[] {
  const baseId = cloudContext && cloudContext.projectId === history.projectId ? cloudContext.baseVersionId : null;
  return history.versions.map((v) => {
    const outcome = classifyCloudSchemaVersion(v.schemaVersion, v.versionNumber, currentSchemaVersion);
    const inWindow = outcome.kind === "opens" || outcome.kind === "opens-via-migration";
    const badge =
      outcome.kind === "too-old"
        ? `Saved by an older app version (file format ${v.schemaVersion}); this app can't open it`
        : outcome.kind === "too-new"
          ? "Saved by a newer app version; reload the page to open it"
          : outcome.kind === "unreadable"
            ? "File format not recorded; this app can't open it"
            : null;
    return {
      versionId: v.versionId,
      versionNumber: v.versionNumber,
      title: v.kind === "rename" ? (v.renamedTo === null ? "Renamed" : `Renamed to ${quoted(v.renamedTo)}`) : "Saved",
      authorName: v.authorName.trim().length > 0 ? v.authorName : "author not recorded",
      createdAt: v.createdAt,
      label: v.label,
      isLatest: v.versionNumber === history.headVersionNumber,
      isBase: v.versionId === baseId,
      startedFromVersionNumber:
        v.parentVersionNumber !== null && v.parentVersionNumber !== v.versionNumber - 1 ? v.parentVersionNumber : null,
      schema: outcome.kind,
      badge,
      canOpen: inWindow,
      offerDownload: !inWindow,
    };
  });
}

/** The line under the history's title. Says so when the list is cut short. */
export function historySummary(history: ListVersionsResponse): string {
  const n = history.versions.length;
  const shown = n === 1 ? "1 version" : `${n} versions`;
  if (history.notListedCount === 0) return `${shown}, newest first. Every version is kept.`;
  const missing = history.notListedCount === 1 ? "1 older version isn't" : `${history.notListedCount} older versions aren't`;
  return `The newest ${shown} of ${history.headVersionNumber}. ${missing} listed here; every version is still kept.`;
}

/**
 * After opening a version older than the head from Version history. States
 * what the next Save to cloud will do, before it happens:
 *
 *   You opened version 3 of Smith House, saved by Virgil on Sep 12, 2026,
 *   2:14 pm. The latest is version 7. Save to cloud will add a new version
 *   that starts from version 3; versions 4–7 stay exactly as they are.
 *
 * Null when the version opened is the latest.
 */
export function openedOlderVersionNotice(input: {
  versionNumber: number;
  headVersionNumber: number;
  projectName: string;
  authorName: string;
  savedWhen: string;
}): string | null {
  if (input.headVersionNumber <= input.versionNumber) return null;
  const newer = versionRange(input.versionNumber + 1, input.headVersionNumber);
  const stays = input.headVersionNumber === input.versionNumber + 1 ? "stays exactly as it is" : "stay exactly as they are";
  return `You opened version ${input.versionNumber} of ${displayProjectName(input.projectName)}, saved by ${input.authorName} on ${input.savedWhen}. The latest is version ${input.headVersionNumber}. Save to cloud will add a new version that starts from version ${input.versionNumber}; ${newer} ${stays}.`;
}

/** The notice a successful rename leaves, worded by what it did to this editor. */
export function renameNotice(input: {
  outcome: RenameOutcome;
  name: string;
  versionNumber: number;
  renamedFromVersionNumber: number;
  /** This editor's base before the rename (only read for base-stays). */
  editorVersionNumber: number | null;
}): string {
  const { name, versionNumber, renamedFromVersionNumber } = input;
  const what = `Renamed to ${quoted(name)}. That added version ${versionNumber}: version ${renamedFromVersionNumber}, the latest, with only the name changed.`;
  switch (input.outcome) {
    case "not-open-here":
      return what;
    case "base-moved":
      return `${what} Your editor is on version ${versionNumber} now, and its project name reads ${quoted(name)}.`;
    case "base-stays":
      return `${what} Your editor stays on version ${input.editorVersionNumber}, the one you started from, so its title-block date is unchanged. Its project name now reads ${quoted(name)}, so your next save keeps the new name.`;
    case "late":
      return `${what} The design on screen was replaced while the rename was in progress, so it was not changed.`;
  }
}
