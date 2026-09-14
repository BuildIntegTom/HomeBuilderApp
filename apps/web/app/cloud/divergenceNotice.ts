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
 * The spec's "[Open version history]" link is a button the editor renders
 * beside this text (Stage 2C), not part of the string.
 *
 * STARTED FROM AN OLDER VERSION (2C). When the base was opened on purpose
 * while newer versions already existed (`latestKnownVersionNumber` >
 * `baseVersionNumber`), those versions were NOT "saved while you had this
 * project open", so the 2B sentence would be false. That case gets its own
 * wording: which version the save starts from, which versions it does not
 * build on, and only then anything genuinely saved since the open.
 */
export interface DivergenceNoticeInput {
  versionNumber: number;
  diverged: boolean;
  headBefore: number;
  /** The version this editor started from (the client's base). */
  baseVersionNumber: number;
  /** The head this editor knew of when base was set (cloudContext). Omitted
   * or equal to base: the 2B wording, unchanged. */
  latestKnownVersionNumber?: number;
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

/** "version 4" or "versions 4–7". */
export function versionRange(from: number, to: number): string {
  return from === to ? `version ${from}` : `versions ${from}–${to}`;
}

export function divergenceNotice(input: DivergenceNoticeInput): DivergenceNotice {
  const headline = `Saved as version ${input.versionNumber}.`;
  if (!input.diverged) return { headline, detail: null };
  const knownHead = input.latestKnownVersionNumber ?? input.baseVersionNumber;
  if (knownHead > input.baseVersionNumber) return { headline, detail: startedFromOlderDetail(input, knownHead) };

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

/**
 * The save started from a version older than the head this editor already
 * knew about, e.g. v3 opened from Version history while v7 was the latest:
 *
 *   It starts from version 3, which you opened, not from version 7, the latest
 *   when you opened it, so it doesn't build on versions 4–7. Every version is
 *   kept; nothing was overwritten.
 *
 * Versions saved AFTER the open are then named the 2B way ("Since you opened
 * it, 1 other version was saved: version 8 by Virgil, 2:14 pm."). A rename in
 * either range that this save set back is said once.
 */
function startedFromOlderDetail(input: DivergenceNoticeInput, knownHead: number): string {
  const base = input.baseVersionNumber;
  const sinceRows = input.intervening.filter((v) => v.versionNumber > knownHead);
  // Rows first; if they could not be read back, the numbers still give the count.
  const sinceCount = sinceRows.length > 0 ? sinceRows.length : Math.max(0, input.headBefore - knownHead);
  const latestSince = sinceRows[sinceRows.length - 1];

  let text = `It starts from version ${base}, which you opened, not from version ${knownHead}, the latest when you opened it, so it doesn't build on ${versionRange(base + 1, knownHead)}.`;

  if (sinceCount > 0) {
    let what: string;
    if (sinceCount === 1 && latestSince) {
      what = `1 other version was saved: version ${latestSince.versionNumber} by ${latestSince.authorName}, ${input.formatTime(latestSince.createdAt)}`;
    } else if (latestSince) {
      what = `${sinceCount} other versions were saved, the latest by ${latestSince.authorName} at ${input.formatTime(latestSince.createdAt)}`;
    } else {
      what = sinceCount === 1 ? "1 other version was saved" : `${sinceCount} other versions were saved`;
    }
    text += ` Since you opened it, ${what}.`;
  }

  const renames = input.intervening.filter((v) => v.kind === "rename");
  const lastRename = renames[renames.length - 1];
  if (lastRename && lastRename.projectName !== input.savedProjectName) {
    text += ` Your save set the name back to ${quoted(input.savedProjectName)} (version ${lastRename.versionNumber} had renamed it to ${quoted(lastRename.projectName)}).`;
  }

  const others = Math.max(knownHead - base + sinceCount, input.headBefore - base, 1);
  text += others === 1 ? " Both are kept; nothing was overwritten." : " Every version is kept; nothing was overwritten.";
  return text;
}
