/**
 * The date a printed sheet's title block shows: the date the design was
 * SAVED, never the date it happened to be printed (Tommy, 2026-09-06 — spec
 * "Backend, Accounts & Project Sharing" > Project name / site / date).
 *
 * LAST SAVE WINS (Stage 2B, spec "The cloud row of the date table"). Stage 0
 * ranked a cloud date above a local one, which broke as soon as one session
 * touched both: open a cloud version, then Load a 2025 file, and the sheet
 * dated the 2025 design with the cloud save time. There is now ONE value,
 * `titleBlockSave`, and exactly four writers overwrite it:
 *
 *   Load Project (local file)       -> that file's `ProjectFile.savedAt`
 *   Save Project (local download)   -> the `savedAt` just written into the file
 *   Open from cloud                 -> that version's `created_at` column
 *   Save to cloud / Save as new     -> the new version's `created_at` AS
 *                                      RETURNED BY THE DATABASE, never the
 *                                      browser clock
 *
 * A failed or refused action writes nothing. Whichever writer ran last has
 * already overwritten the value, so there is nothing to rank here.
 *
 * `null` means never saved or loaded this session: the sheet shows today.
 * A PRESENT value whose `savedAt` is missing or unusable prints "Date not
 * recorded" (Tommy, 2026-09-13) — it never collapses to today, because
 * today's date on a design of unknown age looks authoritative and is exactly
 * the defect this replaces.
 *
 * Every file this app itself writes carries a full ISO `savedAt` in UTC, and
 * PostgREST sends `created_at` as e.g. `2026-09-14T13:05:41.611591+00:00`
 * (confirmed against PostgreSQL 17.4 in UTC), so "Date not recorded" only
 * appears for values the app did not produce.
 */

export type TitleBlockSaveSource = "local-file" | "cloud-version";

/** The last action that saved or replaced the design. */
export interface TitleBlockSave {
  savedAt: string | undefined;
  source: TitleBlockSaveSource;
}

export type TitleBlockDateSource =
  | "cloud-version"
  | "local-file"
  | "local-file-unrecorded"
  | "cloud-version-unrecorded"
  | "today";

/** Exact title-block text for a save with no usable date. */
export const DATE_NOT_RECORDED_LABEL = "Date not recorded";

export interface TitleBlockDateInputs {
  /** The single `titleBlockSave` value; null if nothing was saved or loaded. */
  lastSave: TitleBlockSave | null;
  now: Date;
}

export type ResolvedTitleBlockDate =
  | { source: "cloud-version" | "local-file" | "today"; date: Date }
  | { source: "local-file-unrecorded" | "cloud-version-unrecorded"; date: undefined };

/*
 * Strict timestamp rule — only two shapes are usable, everything else is
 * treated as no date at all:
 *
 *   A. Full ISO date-time WITH a zone: `YYYY-MM-DDTHH:MM[:SS[.fraction]]`
 *      followed by `Z` or `±HH:MM`. An exact instant; used as-is.
 *   B. Date only: `YYYY-MM-DD`. That calendar day in LOCAL time, so a
 *      hand-written "2025-03-14" reads Mar 14 in every timezone. (The
 *      built-in `new Date("2025-03-14")` parses it as UTC midnight, which is
 *      Mar 13 west of Greenwich.)
 *
 * Rejected on purpose: a bare year ("2025" -> Dec 31, 2024 in the Americas
 * via `new Date`), numbers and numeric strings ("0" -> Jan 1, 2000), a
 * date-time with no zone (ambiguous: whose clock?), any other format, and
 * impossible calendar values (2025-02-30, month 13, 24:00, minute 60).
 *
 * Both shapes are assembled field by field rather than handed to
 * `new Date(string)`, so no engine-specific string parsing is involved.
 */
const DATE_TIME_WITH_ZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

/** A usable Date from a stored timestamp under the strict rule above, or undefined. */
export function parseSaveTimestamp(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;

  const dateTime = DATE_TIME_WITH_ZONE.exec(value);
  if (dateTime) {
    const [, y, mo, d, h, mi, s = "0", fraction = "", sign, offsetH = "0", offsetM = "0"] = dateTime;
    const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);
    if (!isRealCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return undefined;
    if (Number(offsetH) > 23 || Number(offsetM) > 59) return undefined;
    const ms = fraction ? Math.floor(Number(fraction) * 1000) : 0;
    // setUTCFullYear, not Date.UTC: Date.UTC maps years 0-99 onto 1900-1999.
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, ms);
    const offsetMinutes = (sign === "-" ? -1 : 1) * (Number(offsetH) * 60 + Number(offsetM));
    return new Date(date.getTime() - offsetMinutes * 60_000);
  }

  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    if (!isRealCalendarDate(year, month, day)) return undefined;
    const date = new Date(0);
    date.setFullYear(year, month - 1, day); // local calendar day
    date.setHours(0, 0, 0, 0);
    return date;
  }

  return undefined;
}

export function resolveTitleBlockDate({ lastSave, now }: TitleBlockDateInputs): ResolvedTitleBlockDate {
  if (!lastSave) return { source: "today", date: now };
  const saved = parseSaveTimestamp(lastSave.savedAt);
  if (saved) return { source: lastSave.source, date: saved };
  // A present value with an unusable savedAt NEVER collapses to today.
  return {
    source: lastSave.source === "cloud-version" ? "cloud-version-unrecorded" : "local-file-unrecorded",
    date: undefined,
  };
}

/** The title block's existing display format (unchanged by this fix). */
export function formatTitleBlockDate(date: Date): string {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** The exact text the title block's DATE cell prints. */
export function titleBlockDateLabel(resolved: ResolvedTitleBlockDate): string {
  return resolved.date ? formatTitleBlockDate(resolved.date) : DATE_NOT_RECORDED_LABEL;
}
