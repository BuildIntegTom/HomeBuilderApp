/**
 * Stage 7 verification — the proposals migration, end to end, against a REAL
 * Postgres that is not yours.
 *
 * ⚠ **This never touches the Supabase project.** It starts an in-process
 * Postgres (PGlite), applies `tests/local_shim.sql` and then every migration in
 * `migrations/` in order, and exercises `0014`'s four functions against it.
 * Nothing here can reach a hosted database: there is no connection string.
 *
 * That is why it exists rather than another `*.test.sql` in this folder. The
 * SQL verification scripts beside it have to be pointed at a staging project by
 * hand, and the one thing this migration most needed proving — that a document
 * accepted by `submit_proposal` can actually be adopted — is a round trip
 * through three triggers. Run as a script it is one command and no setup.
 *
 * It found a real defect on its first run: a design with no `state` key
 * submitted happily and then could not be adopted at all, because
 * `prepare_project_version` refuses it and `adopt_proposal` inserts through
 * that trigger. `refuse_unusable_proposal` is the fix.
 *
 * Running it:
 *
 *     npm i @electric-sql/pglite      # once, anywhere
 *     node supabase/tests/stage7_proposals.pglite.mjs
 *
 * It prints one line per assertion and exits non-zero on the first failure
 * group. `REPO` below is the only thing to change if you move the checkout.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const REPO = process.env.BI_REPO ?? "C:/Users/Tommy/Desktop/Claude";
const MIG = path.join(REPO, "supabase/migrations");
const read = (p) => fs.readFileSync(p, "utf8");

const db = await PGlite.create();
const fails = [];
const ok = (name) => console.log("  PASS  " + name);
const bad = (name, why) => { fails.push(name + " - " + why); console.log("  FAIL  " + name + " - " + why); };

await db.exec(read(path.join(REPO, "supabase/tests/local_shim.sql")));
const files = fs.readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  try { await db.exec(read(path.join(MIG, f))); console.log("applied " + f); }
  catch (e) { console.log("APPLY FAILED " + f + ": " + e.message); process.exit(1); }
}

/* Session-level (false), NOT transaction-local (true): PGlite runs each
   query in its own implicit transaction, so `true` is gone by the next call
   and every function sees auth.uid() = null. */
const asUser = (uid) => db.exec(`select set_config('request.jwt.claims', '{"sub":"${uid}"}', false);`);
const asAnon = () => db.exec(`select set_config('request.jwt.claims', '', false);`);
const q = (sql, params) => db.query(sql, params);

const U_A = "11111111-1111-1111-1111-111111111111";
const U_B = "22222222-2222-2222-2222-222222222222";
const CO_A = "aaaaaaaa-0000-0000-0000-000000000001";
const CO_B = "bbbbbbbb-0000-0000-0000-000000000002";

await db.exec(`
  insert into auth.users (id, email) values ('${U_A}', 'a@example.com'), ('${U_B}', 'b@example.com');
  insert into public.companies (id, name) values ('${CO_A}', 'Building Integrity'), ('${CO_B}', 'Other Co');
  insert into public.memberships (user_id, company_id, level) values
    ('${U_A}', '${CO_A}', 'admin'), ('${U_B}', '${CO_B}', 'admin');
`);

/* The REAL shape `prepare_project_version` demands: an object with a `state`
   object and an integer `schemaVersion`. The first run of this harness used a
   made-up shape, which submitted happily and then could not be adopted at all
   - which is how the missing validation in submit_proposal was found. */
const DOC = JSON.stringify({ schemaVersion: 26, state: { projectName: "Rogers-Sehorn ADU", footprint: {} } });
const BAD_SHAPE = JSON.stringify({ schemaVersion: 26, projectName: "no state key" });
const BAD_VERSION = JSON.stringify({ state: {} });
const HASH = "a".repeat(64);
const FUTURE = "now() + interval '30 days'";

console.log("\n--- submit (anonymous) ---");
await asAnon();
try {
  const r = await q(`select * from public.submit_proposal($1, $2::jsonb, ${FUTURE}, $3, $4)`,
    [HASH, DOC, "  Jane Rogers  ", "  jane@example.com "]);
  r.rows[0].proposal_id ? ok("anon can submit") : bad("anon can submit", "no id");
} catch (e) { bad("anon can submit", e.message); }

try {
  const r = await q(`select submitter_name, submitter_email from public.proposals where token_hash = $1`, [HASH]);
  const row = r.rows[0];
  row.submitter_name === "Jane Rogers" && row.submitter_email === "jane@example.com"
    ? ok("name and email are trimmed") : bad("name and email are trimmed", JSON.stringify(row));
} catch (e) { bad("name and email are trimmed", e.message); }

const refusals = [
  ["a past expiry is refused", `select public.submit_proposal($1, $2::jsonb, now() - interval '1 day')`, ["b".repeat(64), DOC]],
  ["a null document is refused", `select public.submit_proposal($1, null, ${FUTURE})`, ["c".repeat(64)]],
  ["a blank token is refused", `select public.submit_proposal('   ', $1::jsonb, ${FUTURE})`, [DOC]],
  ["a duplicate token is refused", `select public.submit_proposal($1, $2::jsonb, ${FUTURE})`, [HASH, DOC]],
  ["a design with no state object is refused", `select public.submit_proposal($1, $2::jsonb, ${FUTURE})`, ["1".repeat(64), BAD_SHAPE]],
  ["a design with no schemaVersion is refused", `select public.submit_proposal($1, $2::jsonb, ${FUTURE})`, ["2".repeat(64), BAD_VERSION]],
  ["a design that is not an object is refused", `select public.submit_proposal($1, $2::jsonb, ${FUTURE})`, ["3".repeat(64), "[]"]],
];
for (const [name, sql, params] of refusals) {
  try { await q(sql, params); bad(name, "it was accepted"); } catch { ok(name); }
}

console.log("\n--- preview ---");
await asAnon();
try {
  const r = await q(`select * from public.proposal_preview($1)`, [HASH]);
  const row = r.rows[0];
  row.found === true && row.submitter_name === "Jane Rogers" && row.adopted === false
    ? ok("anon preview shows sender and not-adopted") : bad("anon preview", JSON.stringify(row));
  "document" in row ? bad("preview never returns the document", "it has a document column") : ok("preview never returns the document");
  "submitter_email" in row ? bad("preview never returns the email", "it has an email column") : ok("preview never returns the email");
} catch (e) { bad("anon preview", e.message); }

try {
  const r = await q(`select found from public.proposal_preview($1)`, ["z".repeat(64)]);
  r.rows[0].found === false ? ok("unknown token previews as not-found") : bad("unknown token", "found=true");
} catch (e) { bad("unknown token", e.message); }

console.log("\n--- document ---");
await asAnon();
try { await q(`select * from public.proposal_document($1)`, [HASH]); bad("anon cannot read the document", "it was allowed"); }
catch { ok("anon cannot read the document"); }

await asUser(U_B);
try {
  const r = await q(`select found, document from public.proposal_document($1)`, [HASH]);
  r.rows[0].found === true && r.rows[0].document.state.projectName === "Rogers-Sehorn ADU"
    ? ok("any signed-in account can read the document") : bad("signed-in document read", JSON.stringify(r.rows[0]));
} catch (e) { bad("signed-in document read", e.message); }

console.log("\n--- adopt ---");
await asUser(U_A);
try { await q(`select * from public.adopt_proposal($1, $2)`, [HASH, CO_B]); bad("non-member cannot adopt", "it was allowed"); }
catch { ok("non-member cannot adopt"); }

let adoptedProjectId = null;
try {
  const r = await q(`select * from public.adopt_proposal($1, $2)`, [HASH, CO_A]);
  adoptedProjectId = r.rows[0].project_id;
  r.rows[0].version_number === 1 ? ok("a member adopts it and gets v1") : bad("adopt", JSON.stringify(r.rows[0]));
} catch (e) { bad("adopt", e.message); }

try {
  const r = await q(`select folder, name, company_id, created_by from public.projects where id = $1`, [adoptedProjectId]);
  const row = r.rows[0];
  row.folder === "proposals" ? ok("it lands in the proposals folder") : bad("folder", row.folder);
  row.name === "Rogers-Sehorn ADU" ? ok("the head name is mirrored by the trigger") : bad("name", row.name);
  row.created_by === U_A ? ok("created_by is the adopter") : bad("created_by", row.created_by);
} catch (e) { bad("adopted project row", e.message); }

try {
  const r = await q(`select label, author_name from public.project_versions where project_id = $1`, [adoptedProjectId]);
  r.rows[0].label === "Adopted from a proposal by Jane Rogers"
    ? ok("v1 says where it came from") : bad("v1 label", JSON.stringify(r.rows[0]));
} catch (e) { bad("v1 label", e.message); }

try { await q(`select * from public.adopt_proposal($1, $2)`, [HASH, CO_A]); bad("adoption is once", "a second adopt was allowed"); }
catch (e) { /already adopted/.test(e.message) ? ok("adoption is once, and names who got there first") : bad("adoption is once", e.message); }

await asAnon();
try {
  const r = await q(`select found, adopted, adopted_by_company_name from public.proposal_preview($1)`, [HASH]);
  const row = r.rows[0];
  row.found === true && row.adopted === true && row.adopted_by_company_name === "Building Integrity"
    ? ok("the sender can see it was adopted, and by whom") : bad("post-adopt preview", JSON.stringify(row));
} catch (e) { bad("post-adopt preview", e.message); }

console.log("\n--- expiry ---");
const H2 = "d".repeat(64);
await asAnon();
await q(`select public.submit_proposal($1, $2::jsonb, now() + interval '1 hour')`, [H2, DOC]);
/* Both timestamps move: `proposals_expires_after_creation` is a real
   constraint and an expired row still has to satisfy it. */
await db.exec(`update public.proposals
                  set created_at = now() - interval '2 days',
                      expires_at = now() - interval '1 second'
                where token_hash = '${H2}';`);
try {
  const r = await q(`select found from public.proposal_preview($1)`, [H2]);
  r.rows[0].found === false ? ok("an expired proposal previews as not-found") : bad("expired preview", "found=true");
} catch (e) { bad("expired preview", e.message); }
await asUser(U_A);
try { await q(`select * from public.adopt_proposal($1, $2)`, [H2, CO_A]); bad("an expired proposal cannot be adopted", "it was allowed"); }
catch { ok("an expired proposal cannot be adopted"); }

console.log("\n--- size cap ---");
/* A VALID-SHAPED 5MB design, so the size check is what refuses it rather
   than the shape check two lines above it. */
const BIG = JSON.stringify({ schemaVersion: 26, state: { blob: "x".repeat(5 * 1024 * 1024) } });
await asAnon();
try { await q(`select public.submit_proposal($1, $2::jsonb, ${FUTURE})`, ["e".repeat(64), BIG]); bad("a 5MB design is refused", "it was accepted"); }
catch (e) { /at most/.test(e.message) ? ok("a 5MB design is refused, by size") : bad("size cap", e.message); }

console.log("\n--- direct table access ---");
for (const [role, uid] of [["anon", null], ["authenticated", U_B]]) {
  if (uid) { await asUser(uid); } else { await asAnon(); }
  const probes = [
    ["select", `select * from public.proposals`],
    ["insert", `insert into public.proposals (token_hash, document, expires_at) values ('f' || repeat('0', 63), '{}'::jsonb, now() + interval '1 day')`],
    ["update", `update public.proposals set submitter_name = 'hacked'`],
    ["delete", `delete from public.proposals`],
  ];
  for (const [what, sql] of probes) {
    try {
      await db.exec(`set role ${role};`);
      const r = await db.query(sql);
      const rows = r.rows ? r.rows.length : 0;
      const affected = r.affectedRows ?? 0;
      (what === "select" ? rows === 0 : affected === 0)
        ? ok(`${role} direct ${what} sees/changes nothing`)
        : bad(`${role} direct ${what}`, `rows=${rows} affected=${affected}`);
    } catch { ok(`${role} direct ${what} is refused`); }
    await db.exec("reset role;");
  }
}

console.log("\n" + (fails.length === 0 ? "ALL PASSED" : `${fails.length} FAILED:\n - ` + fails.join("\n - ")));
process.exit(fails.length === 0 ? 0 : 1);
