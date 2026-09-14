import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatTitleBlockDate, parseSaveTimestamp, resolveTitleBlockDate, titleBlockDateLabel } from "./titleBlockDate";

const NOW = new Date("2026-09-13T15:00:00.000Z");
const SAVED_2025 = "2025-03-14T12:00:00.000Z";
const CLOUD_2024 = "2024-11-02T12:00:00.000Z";

/** Every input the strict rule must treat as "no usable date". */
const UNUSABLE_SAVED_AT: [string, unknown][] = [
  ["missing", undefined],
  ["empty", ""],
  ["whitespace", "   "],
  ["garbage", "not a date"],
  ["a bare year", "2025"],
  ["the string 0", "0"],
  ["a numeric string", "1742000000000"],
  ["a number", 1742000000000],
  ["null", null],
  ["a date-time with no zone", "2025-03-14T12:00:00"],
  ["a date-time with no zone and no seconds", "2025-03-14T12:00"],
  ["a space instead of T", "2025-03-14 12:00:00Z"],
  ["a human-readable date", "Mar 14, 2025"],
  ["surrounding whitespace", " 2025-03-14 "],
  ["Feb 30 (date only)", "2025-02-30"],
  ["Feb 30 (date-time)", "2025-02-30T12:00:00Z"],
  ["Feb 29 in a non-leap year", "2023-02-29"],
  ["month 13", "2025-13-01"],
  ["day 0", "2025-03-00"],
  ["hour 24", "2025-03-14T24:00:00Z"],
  ["minute 60", "2025-03-14T12:60:00Z"],
  ["second 60", "2025-03-14T12:00:60Z"],
  ["an out-of-range offset", "2025-03-14T12:00:00+24:00"],
  ["an offset without a colon", "2025-03-14T12:00:00+0530"],
  ["an unpadded month", "2025-3-14"],
];

describe("resolveTitleBlockDate", () => {
  it("uses a loaded file's savedAt, not today", () => {
    const resolved = resolveTitleBlockDate({ lastSave: { savedAt: SAVED_2025, source: "local-file" }, now: NOW });
    expect(resolved.source).toBe("local-file");
    expect(resolved.date?.toISOString()).toBe(SAVED_2025);
  });

  it("uses today for a design that has never been saved or loaded", () => {
    const resolved = resolveTitleBlockDate({ lastSave: null, now: NOW });
    expect(resolved.source).toBe("today");
    expect(resolved.date?.getTime()).toBe(NOW.getTime());
    expect(titleBlockDateLabel(resolved)).toBe(formatTitleBlockDate(NOW));
  });

  it.each(UNUSABLE_SAVED_AT)("a loaded file whose savedAt is %s prints exactly \"Date not recorded\", not today", (_label, savedAt) => {
    const resolved = resolveTitleBlockDate({ lastSave: { savedAt: savedAt as string | undefined, source: "local-file" }, now: NOW });
    expect(resolved.source).toBe("local-file-unrecorded");
    expect(resolved.date).toBeUndefined();
    expect(titleBlockDateLabel(resolved)).toBe("Date not recorded");
  });

  it.each(UNUSABLE_SAVED_AT)("a cloud version whose created_at is %s also prints \"Date not recorded\", never today", (_label, createdAt) => {
    const resolved = resolveTitleBlockDate({ lastSave: { savedAt: createdAt as string | undefined, source: "cloud-version" }, now: NOW });
    expect(resolved.source).toBe("cloud-version-unrecorded");
    expect(titleBlockDateLabel(resolved)).toBe("Date not recorded");
  });

  it("uses a cloud version's created_at", () => {
    const resolved = resolveTitleBlockDate({ lastSave: { savedAt: CLOUD_2024, source: "cloud-version" }, now: NOW });
    expect(resolved.source).toBe("cloud-version");
    expect(resolved.date?.toISOString()).toBe(CLOUD_2024);
  });

  it("accepts PostgREST's created_at exactly as PostgreSQL 17.4 (UTC) serialises it", () => {
    // Captured from the local 0006 harness: to_json(timestamptz) in a UTC session.
    const resolved = resolveTitleBlockDate({ lastSave: { savedAt: "2026-09-14T13:05:41.611591+00:00", source: "cloud-version" }, now: NOW });
    expect(resolved.source).toBe("cloud-version");
    expect(resolved.date?.toISOString()).toBe("2026-09-14T13:05:41.611Z");
  });

  it("has no precedence: whichever writer supplied lastSave is the whole answer", () => {
    // The Stage 0 resolver ranked cloud above local. The two regression tests
    // for that break live in cloud/documentSession.test.ts, which drives the
    // real sequence of writers; here, only that source is reported as given.
    expect(resolveTitleBlockDate({ lastSave: { savedAt: SAVED_2025, source: "local-file" }, now: NOW }).source).toBe("local-file");
    expect(resolveTitleBlockDate({ lastSave: { savedAt: SAVED_2025, source: "cloud-version" }, now: NOW }).source).toBe("cloud-version");
  });
});

describe("parseSaveTimestamp: accepted shapes", () => {
  it.each([
    ["the app's own toISOString output", "2025-03-14T12:00:00.000Z", Date.UTC(2025, 2, 14, 12, 0, 0, 0)],
    ["no fraction", "2025-03-14T12:00:00Z", Date.UTC(2025, 2, 14, 12, 0, 0)],
    ["no seconds", "2025-03-14T12:00Z", Date.UTC(2025, 2, 14, 12, 0)],
    ["a long fraction (truncated to ms)", "2025-03-14T12:00:00.123999Z", Date.UTC(2025, 2, 14, 12, 0, 0, 123)],
    ["a positive offset", "2025-03-14T12:00:00+05:30", Date.UTC(2025, 2, 14, 6, 30)],
    ["a negative offset", "2025-03-14T12:00:00-08:00", Date.UTC(2025, 2, 14, 20, 0)],
    ["an offset that crosses midnight", "2025-03-14T23:30:00-02:00", Date.UTC(2025, 2, 15, 1, 30)],
    ["Feb 29 in a leap year", "2024-02-29T00:00:00Z", Date.UTC(2024, 1, 29)],
  ])("uses %s as that exact instant", (_label, value, expectedMs) => {
    expect(parseSaveTimestamp(value)?.getTime()).toBe(expectedMs);
  });

  it("does not map two-digit years onto the 1900s", () => {
    expect(parseSaveTimestamp("0025-03-14T00:00:00Z")?.getUTCFullYear()).toBe(25);
  });

  it.each(UNUSABLE_SAVED_AT)("rejects %s", (_label, value) => {
    expect(parseSaveTimestamp(value)).toBeUndefined();
  });
});

/*
 * Timezone coverage runs inside the normal `vitest run`, not a separate
 * TZ=... invocation: Node re-reads `process.env.TZ` when it is assigned, and
 * vitest runs each test file in its own worker, so switching it in beforeAll
 * changes local time for this file only. Each suite first asserts the switch
 * really took effect (via the zone's known March offset), so a platform where
 * it silently did nothing fails loudly instead of passing in UTC.
 */
const TIME_ZONES: [string, number][] = [
  // [zone, getTimezoneOffset() in minutes on 2025-03-14]
  ["America/Los_Angeles", 420], // PDT, UTC-7
  ["Pacific/Auckland", -780], // NZDT, UTC+13
  ["UTC", 0],
];

describe.each(TIME_ZONES)("in %s", (zone, expectedOffsetMinutes) => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("really is running in that zone", () => {
    expect(new Date(2025, 2, 14).getTimezoneOffset()).toBe(expectedOffsetMinutes);
  });

  it('shows a hand-written "2025-03-14" as Mar 14, 2025', () => {
    const resolved = resolveTitleBlockDate({ lastSave: { source: "local-file", savedAt: "2025-03-14" }, now: NOW });
    expect(resolved.source).toBe("local-file");
    expect([resolved.date?.getFullYear(), resolved.date?.getMonth(), resolved.date?.getDate()]).toEqual([2025, 2, 14]);
    expect(titleBlockDateLabel(resolved)).toBe(formatTitleBlockDate(new Date(2025, 2, 14, 12)));
  });

  it("uses a zoned date-time as its exact instant, shown on that instant's local day", () => {
    // 20:00Z is still Mar 14 in LA and UTC, but already Mar 15 in Auckland.
    const date = parseSaveTimestamp("2025-03-14T20:00:00Z");
    expect(date?.getTime()).toBe(Date.UTC(2025, 2, 14, 20));
    expect(date?.getDate()).toBe(zone === "Pacific/Auckland" ? 15 : 14);
  });

  it.each([["2025"], ["0"]])('treats the formerly misread "%s" as Date not recorded', (savedAt) => {
    expect(titleBlockDateLabel(resolveTitleBlockDate({ lastSave: { source: "local-file", savedAt }, now: NOW }))).toBe("Date not recorded");
  });
});
