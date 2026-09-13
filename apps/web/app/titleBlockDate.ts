/**
 * The date a printed sheet's title block shows: the date the design was
 * SAVED, never the date it happened to be printed (Tommy, 2026-09-06 — spec
 * "Backend, Accounts & Project Sharing" > Project name / site / date).
 *
 * Resolution order:
 *
 *   1. Cloud version opened  -> `project_versions.created_at`  (Stage 2 — nothing
 *                                passes this yet; the slot exists so Stage 2
 *                                only has to supply the value, not re-plumb)
 *   2. Local file loaded     -> that file's `ProjectFile.savedAt` (every guest;
 *                                also the file just written by Save Project).
 *                                If the file has no USABLE savedAt, the sheet
 *                                says "Date not recorded" (Tommy, 2026-09-13)
 *                                — it does NOT fall back to today, because a
 *                                today's date on a design of unknown age looks
 *                                authoritative and is exactly the defect this
 *                                replaces.
 *   3. Never saved or loaded -> today
 *
 * Every file this app itself writes carries a full ISO `savedAt` in UTC, so
 * "Date not recorded" only ever appears for files the app did not produce
 * (hand-edited, damaged, or from some other tool).
 */

export type TitleBlockDateSource = "cloud-version" | "local-file" | "local-file-unrecorded" | "today";

/** Exact title-block text for a loaded file with no usable save date. */
export const DATE_NOT_RECORDED_LABEL = "Date not recorded";

export interface TitleBlockDateInputs {
  /** Stage 2: the opened cloud version's `created_at`. It goes through the
   * same strict parse below, so Stage 2 must confirm the value arrives as a
   * full ISO date-time with a zone (PostgREST's `+00:00` form qualifies). */
  cloudVersionCreatedAt?: string;
  /** The local file most recently loaded or saved this session; undefined if
   * none. Its own `savedAt` may be missing or unusable. */
  localFile?: { savedAt: string | undefined };
  now: Date;
}

export type ResolvedTitleBlockDate =
  | { source: "cloud-version" | "local-file" | "today"; date: Date }
  | { source: "local-file-unrecorded"; date: undefined };

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

export function resolveTitleBlockDate({ cloudVersionCreatedAt, localFile, now }: TitleBlockDateInputs): ResolvedTitleBlockDate {
  const cloud = parseSaveTimestamp(cloudVersionCreatedAt);
  if (cloud) return { source: "cloud-version", date: cloud };
  if (localFile) {
    const saved = parseSaveTimestamp(localFile.savedAt);
    return saved ? { source: "local-file", date: saved } : { source: "local-file-unrecorded", date: undefined };
  }
  return { source: "today", date: now };
}

/** The title block's existing display format (unchanged by this fix). */
export function formatTitleBlockDate(date: Date): string {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** The exact text the title block's DATE cell prints. */
export function titleBlockDateLabel(resolved: ResolvedTitleBlockDate): string {
  return resolved.date ? formatTitleBlockDate(resolved.date) : DATE_NOT_RECORDED_LABEL;
}
