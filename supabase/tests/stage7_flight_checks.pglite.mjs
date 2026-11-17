/**
 * ⚠ **The SQL in `Claude outputs/apply-0014-proposals-2026-11-14.md` is a
 * DELIVERABLE Tommy pastes into his live project by hand. This runs it.**
 *
 * The migration itself has a harness (`stage7_proposals.pglite.mjs`). The
 * apply doc's own pre-flight and post-flight blocks did not: they were written
 * alongside it and have not been re-run since, and a check nobody has run is
 * worse than no check, because it is read as reassurance. This extracts every
 * ```sql block from that document and executes it against a real Postgres —
 * the pre-flight against a database standing at 0013, the rest against one
 * with 0014 applied — so a block that has gone stale fails here rather than in
 * the Supabase SQL editor with nothing to compare against.
 *
 * It never touches the Supabase project: PGlite is in-process and there is no
 * connection string in this file.
 *
 *     npm i --no-save @electric-sql/pglite
 *     node supabase/tests/stage7_flight_checks.pglite.mjs
 *
 * ⚠ It asserts that each block RUNS and, where the block is a yes/no table,
 * that every answer is the expected one. It deliberately does NOT re-assert
 * what the migration does — that is the other harness's job, and two scripts
 * checking the same thing drift apart.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const REPO = process.env.BI_REPO ?? "C:/Users/Tommy/Desktop/Claude";
const MIG = path.join(REPO, "supabase/migrations");
const DOC = path.join(REPO, "Claude outputs/apply-0014-proposals-2026-11-14.md");
const read = (p) => fs.readFileSync(p, "utf8");

const fails = [];
const ok = (name) => console.log("  PASS  " + name);
const bad = (name, why) => {
  fails.push(name + " - " + why);
  console.log("  FAIL  " + name + " - " + why);
};

/** Every migration up to and including `upTo`, on a fresh database. */
async function dbUpTo(upTo) {
  const db = await PGlite.create();
  await db.exec(read(path.join(REPO, "supabase/tests/local_shim.sql")));
  for (const f of fs.readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) {
    if (f > upTo) break;
    await db.exec(read(path.join(MIG, f)));
  }
  return db;
}

/** The ```sql fences out of the apply doc, in order. */
function sqlBlocks() {
  const blocks = [];
  const re = /```sql\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(read(DOC))) !== null) blocks.push(m[1].trim());
  return blocks;
}

const blocks = sqlBlocks();
console.log(`found ${blocks.length} SQL blocks in the apply doc`);
if (blocks.length === 0) {
  console.log("FAILED: the apply doc has no SQL blocks — has it been renamed or rewritten?");
  process.exit(1);
}

/* ⚠ The FIRST block is the pre-flight, and it has to be run against a database
   that does NOT have 0014 yet — that is the whole situation it describes. */
console.log("--- pre-flight, against a database standing at 0013 ---");
{
  const db = await dbUpTo("0013_share_link_signup.sql");
  let rows;
  try {
    rows = (await db.query(blocks[0])).rows;
  } catch (e) {
    bad("pre-flight runs", e.message);
    rows = [];
  }
  if (rows.length > 0) {
    ok("pre-flight runs");
    for (const row of rows) {
      /* Every row of this block is `thing` / `present`, and every one must
         read `yes` on a database ready for 0014. */
      if (row.present === "yes") ok(`  ${row.thing}: yes`);
      else bad(`  ${row.thing}`, `got "${row.present}"`);
    }
  }
}

console.log("--- the rest, against a database with 0014 applied ---");
{
  const db = await dbUpTo("0014_proposals.sql");
  for (let i = 1; i < blocks.length; i++) {
    const label = `block ${i + 1}`;
    try {
      /* ⚠ `query` cannot take more than one statement, and one of these
         blocks is a whole round trip inside a transaction it rolls back.
         `exec` can, and returns one result per statement. */
      const multi = blocks[i].replace(/;\s*$/, "").includes(";");
      const results = multi ? await db.exec(blocks[i]) : [await db.query(blocks[i])];
      /* ⚠ EVERY statement's rows, not just the last one. The round-trip
         block's own answers are in the MIDDLE of it — reading only the last
         result there would report "0 rows, passed" for a block that had
         silently returned nothing at all. */
      const rows = results.flatMap((r) => r.rows ?? []);
      ok(`${label} runs (${rows.length} row${rows.length === 1 ? "" : "s"} across ${results.length})`);
      if (rows.length === 0) bad(`${label} returns something`, "no rows from any statement");
      for (const row of rows) {
        /* The yes/no tables again, wherever a block uses that shape. Blocks
           that return other shapes are only required to RUN — asserting their
           contents here would restate the migration harness. */
        if (typeof row.present === "string" && row.present !== "yes") {
          bad(`${label}: ${row.thing ?? "a row"}`, `got "${row.present}"`);
        }
        /* ⚠ The round trip's own promise, which the doc states in words
           underneath it: a proposal written and then previewed back. Without
           this the block would "pass" by merely not throwing. */
        if (typeof row.found === "boolean") {
          if (row.found === true) ok(`${label}: the round trip previews back`);
          else bad(`${label}: the round trip previews back`, "found = false");
          if (row.submitter_name === "Post-flight") ok(`${label}: the name came back`);
          else bad(`${label}: the name came back`, `got "${row.submitter_name}"`);
          if (row.adopted === false) ok(`${label}: and it is unadopted`);
          else bad(`${label}: and it is unadopted`, `got ${row.adopted}`);
        }
      }
    } catch (e) {
      bad(`${label} runs`, e.message);
    }
  }
}

console.log("");
if (fails.length) {
  console.log("FAILED:\n  " + fails.join("\n  "));
  process.exit(1);
}
console.log("ALL PASSED");
