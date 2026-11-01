/**
 * ⚠ **ONE CSV WRITER, because the hard part of CSV is the quoting and
 * nobody should write it twice.**
 *
 * A cut list is full of the three characters that break a naive
 * `rows.map(r => r.join(","))`: commas in a cut note, double quotes in an
 * inch mark (`47½"`), and newlines wherever a note runs long. Getting any of
 * them wrong shifts a column silently, which on a cut list means a shop
 * reading one part's length against another part's angle.
 *
 * RFC 4180 to the letter:
 *
 *  - a field is quoted when it contains `,`, `"`, CR or LF, or has leading or
 *    trailing whitespace a reader would otherwise eat;
 *  - a `"` inside a quoted field is doubled;
 *  - rows end CRLF, which is what the spec says and what Excel expects.
 *
 * ⚠ **And it leads with a UTF-8 BOM.** Every length in this app is written
 * with real typographic fractions (`47½"`), and Excel on Windows opens a
 * BOM-less UTF-8 file as the system codepage — so `½` arrives as `Â½` and a
 * whole column of dimensions reads as mojibake. The BOM costs three bytes
 * and is ignored by every other reader.
 */

/** Characters that force a field to be quoted. */
function needsQuoting(field: string): boolean {
  return /[",\r\n]/.test(field) || field !== field.trim();
}

function escapeField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return needsQuoting(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export type CsvCell = string | number | null | undefined;

export interface CsvOptions {
  /**
   * Lead with a UTF-8 byte order mark. On by default and it should stay on
   * for anything a person opens in Excel — see this module's doc comment.
   */
  byteOrderMark?: boolean;
  /**
   * Rows written ABOVE the header: what building this is, when it was
   * exported, what the numbers mean.
   *
   * ⚠ Above rather than below, so a reader that skips N lines can skip them
   * and a person opening the file sees what it is before they see a single
   * part. They go through the same escaping as everything else, which is the
   * point of putting them here rather than letting each caller splice its own
   * text onto the front and get the quoting wrong.
   */
  preamble?: readonly (readonly CsvCell[])[];
}

/** One table, as CSV text. */
export function buildCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[], options: CsvOptions = {}): string {
  const lines: string[] = [];
  for (const row of options.preamble ?? []) lines.push(row.map(escapeField).join(","));
  lines.push(headers.map(escapeField).join(","));
  for (const row of rows) lines.push(row.map(escapeField).join(","));
  /* ⚠ A trailing CRLF, so the last row is a complete record rather than one
     a strict reader has to guess at. */
  return `${options.byteOrderMark === false ? "" : "﻿"}${lines.join("\r\n")}\r\n`;
}

/** The MIME type and extension a CSV download should carry. */
export const CSV_MIME_TYPE = "text/csv;charset=utf-8";
