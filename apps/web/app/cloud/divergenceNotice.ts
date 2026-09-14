import { displayProjectName, type InterveningVersion } from "./cloudTypes";

/**
 * The divergence notice (decision 11), shown AFTER a save has succeeded. It
 * never blocks, never asks first, and never offers to undo: both versions are
 * kept. Spec wording, "The divergence notice":
 *
 *   Saved as version 8. While you had this project open, 1 other version was
 *   saved: version 7 by Virgil, 2:14 pm. You started from version 6. Both are
 *   kept; nothing was overwritten.
 *
 * The spec's "[Open version history]" link is not produced here: the version
 * list is Stage 2C and does not exist yet.
 */
export interface DivergenceNoticeInput {
  versionNumber: number;
  diverged: boolean;
  headBefore: number;
  /** The version this editor started from (the client's base). */
  baseVersionNumber: number;
  intervening: InterveningVersion[];
  /** The name this save wrote. */
  savedProjectName: string;
  /** How a created_at prints, e.g. "2:14 pm". Injected so tests are
   * timezone-free. */
  formatTime: (createdAt: string) => string;
}

export interface DivergenceNotice {
  headline: string;
  /** Null when nothing else was saved in between. */
  detail: string | null;
}

const quoted = (name: string) => `'${displayProjectName(name)}'`;

/**
 * A save that succeeded, but whose answer arrived after the design on screen
 * was replaced (a Load, an Open, a Save as new). The version is real and kept;
 * it just is not what this editor now shows, so the notice must not read as if
 * it were.
 */
export function replacedWhileSavingNotice(versionNumber: number, projectName: string, where: string | null): string {
  return `Saved as version ${versionNumber} of ${displayProjectName(projectName)}${where ? ` in ${where}` : ""}. The design on screen was replaced while that save was in progress, so this editor is not attached to that project; the design you see now was not changed.`;
}

/**
 * A save that succeeded for the design still on screen, but whose answer
 * arrived after a newer save from this same editor had already moved the base
 * on. Nothing was replaced; the editor simply stays on the newer version.
 */
export function movedOnSaveNotice(versionNumber: number, editorVersionNumber: number): string {
  return `Saved as version ${versionNumber}, but a newer save from this editor had already moved on; your editor stays on version ${editorVersionNumber}.`;
}

/**
 * Open is head-only, but the list can be stale: a newer version may have been
 * saved after it loaded — by a colleague, or by you in another tab, so the
 * wording names no one. The open still goes ahead (never blocking).
 */
export function staleOpenNotice(openedVersionNumber: number, headVersionNumber: number): string | null {
  if (headVersionNumber <= openedVersionNumber) return null;
  return `A newer version (v${headVersionNumber}) was saved after this list loaded. You opened v${openedVersionNumber}.`;
}

export function divergenceNotice(input: DivergenceNoticeInput): DivergenceNotice {
  const headline = `Saved as version ${input.versionNumber}.`;
  if (!input.diverged) return { headline, detail: null };

  // Prefer the rows the database returned; if they could not be read back,
  // the count still follows from the numbers, which never lie about this.
  const count = input.intervening.length > 0 ? input.intervening.length : Math.max(1, input.headBefore - input.baseVersionNumber);
  const latest = input.intervening[input.intervening.length - 1];

  // The most recent intervening rename, if this save put a different name back.
  const renames = input.intervening.filter((v) => v.kind === "rename");
  const lastRename = renames[renames.length - 1];
  const renameUndone = lastRename && lastRename.projectName !== input.savedProjectName ? lastRename : undefined;

  let what: string;
  if (count === 1 && latest) {
    what = `1 other version was saved: version ${latest.versionNumber} by ${latest.authorName}, ${input.formatTime(latest.createdAt)}`;
    if (renameUndone) what += `, a rename to ${quoted(renameUndone.projectName)}`;
  } else if (latest) {
    what = `${count} other versions were saved, the latest by ${latest.authorName} at ${input.formatTime(latest.createdAt)}`;
    if (renameUndone) what += `, including a rename to ${quoted(renameUndone.projectName)}`;
  } else {
    what = count === 1 ? "1 other version was saved" : `${count} other versions were saved`;
  }

  const kept = count === 1 ? "Both are kept; nothing was overwritten." : "Every version is kept; nothing was overwritten.";
  const nameBack = renameUndone ? ` Your save set the name back to ${quoted(input.savedProjectName)}.` : "";

  return {
    headline,
    detail: `While you had this project open, ${what}.${nameBack} You started from version ${input.baseVersionNumber}. ${kept}`,
  };
}
