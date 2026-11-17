import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ⚠ **The paste-ready copy must not drift from the migration.**
 *
 * `Claude outputs/0014_proposals.txt` exists because Tommy applies migrations
 * by hand and his phone will not open a `.sql` file. A `.txt` copy that has
 * fallen behind the `.sql` is the worst possible object in this repo: it looks
 * authoritative, it pastes cleanly, and what reaches the database is not what
 * the tests were run against. So it is pinned byte for byte.
 *
 * ⚠ Byte for byte INCLUDING line endings — a copy that differs even there was
 * made by a different route than the one this test assumes, and the next
 * question after "why is it different" is always "what else is".
 *
 * ⚠ **The apply document's own SQL is checked elsewhere, and by RUNNING it**:
 * `supabase/tests/stage7_flight_checks.pglite.mjs` pulls every SQL block out
 * of `apply-0014-proposals-2026-11-14.md` and executes it against a real
 * Postgres. That is what found the pre-flight erroring outright on Postgres
 * 17, which is what Supabase runs.
 */
const REPO = path.resolve(__dirname, "../../../..");
const APPLY_DOC = "Claude outputs/apply-0014-proposals-2026-11-14.md";
/** The fence the harness splits on, built rather than written so this file can
 *  mention it without closing its own comment. */
const SQL_FENCE = "```" + "sql";

describe("⚠ the SQL Tommy pastes is the SQL the tests ran against", () => {
  it("the .txt he pastes is byte-identical to 0014_proposals.sql", () => {
    const source = readFileSync(path.join(REPO, "supabase/migrations/0014_proposals.sql"));
    const paste = readFileSync(path.join(REPO, "Claude outputs/0014_proposals.txt"));
    expect(paste.equals(source)).toBe(true);
  });

  it("⚠ the apply document still holds the SQL the harness runs", () => {
    /* The harness takes the SQL blocks BY POSITION: the first is the
       pre-flight, which it runs against a database WITHOUT 0014, and the rest
       against one with it. Renaming this file or reordering its blocks breaks
       that silently — the harness would check the wrong thing and still pass. */
    const doc = readFileSync(path.join(REPO, APPLY_DOC), "utf8");
    const blocks = doc.split(SQL_FENCE).slice(1).map((part) => part.split("```")[0] ?? "");
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    expect(blocks[0]).toContain("proposals table NOT already here");
  });

  it("⚠ the pre-flight does not use the subquery that errors on Postgres 17", () => {
    /* Found by running it: `conname like '%folder%'` on `public.projects`
       matches TWO constraints once NOT NULL became catalogued in
       `pg_constraint` (PG17), so the scalar subquery raises "more than one row
       returned by a subquery used as an expression" and the whole pre-flight
       fails — on the database it was written for. */
    const doc = readFileSync(path.join(REPO, APPLY_DOC), "utf8");
    expect(doc).not.toContain("conname like '%folder%'");
    expect(doc).toContain("contype = 'c'");
  });
});
