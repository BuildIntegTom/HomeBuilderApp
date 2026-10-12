> **STAGING NOTE — read first, then delete this block.**
>
> This file is an **extension of the existing `### Stage 5 plan — admin tooling, first slice:
> PERMANENT-DELETE UI (2026-09-25) — BUILT` section** of `building_integrity_app_spec.md`, staged
> outside the spec doc because the worktree it was meant to be written in could not be created:
> **the `Bash` tool is disabled in this session**, so
> `git worktree add -b admin-tooling-plan …` could not be run. Nothing in the main checkout was
> edited — it is still at `b13768a`, and this file sits in the already-untracked `Claude outputs/`
> directory. (A previous planner hit the same wall and staged `ui-reorg-plan-2026-09-26.md` here.)
>
> **Revision 2, 2026-09-27**, after Tommy reversed the redaction decision. The reversal is recorded
> in section 1 **beside his earlier answer, not in place of it.**
>
> **To apply, two edits:**
>
> 1. **Append** everything below the `---` rule to the **end of the Stage 5 section** — i.e. after
>    its `#### Flags check: clean, run against the built diff (2026-09-25)` block (spec line ~2608)
>    and **before** `## Project Smearforn — drawing a real job (2026-09-24)` (~2610). Do **not**
>    start a new top-level section; Stage 5 now has a home and these are its remaining slices.
> 2. **Replace two bullets** in that section's existing `#### Not in scope, and deliberately not
>    built` list (spec lines ~2594–2595), so they point forward instead of restating:
>
>    - Replace the **"Single-version delete."** bullet with:
>      `- **Single-version delete — DEFERRED by Tommy 2026-09-27, not merely unbuilt.** See "Single-version delete — deferred" below for his reason and for the two cheaper shapes that were on the table. The suite still pins that it raises 42501 for a platform admin.`
>    - Replace the **"The platform-wide backup (Stage 5, separate)."** bullet with:
>      `- **The platform-wide backup** — now designed; see "Stage 5, second slice: the platform-wide backup" below. Still unbuilt. **No migration.**`

---

### Stage 5 — the remaining slices, scoped 2026-09-27

Build order confirmed by Tommy, 2026-09-27: *"Admin tooling would be nice to finish, then UI
changes, then ring structures."* Two pieces were outstanding. **One is now closed by his decision
and one is designed below**, so after this Stage 5 has a single remaining slice rather than two.

---

#### Single-version delete — DEFERRED, 2026-09-27, with his reason recorded

Asked directly whether it earned its complexity, Tommy chose *"Defer it — not worth the complexity
yet."* This is a **flagged deferral, not an Open Item awaiting an answer** — the same shape as the
buck window option, the company logos and the bug-report backend. Nothing is to be designed for it
until he reopens it.

**The door stays shut, and stays tested.** `refuse_project_version_change` (0006) keeps raising
42501 on any direct version delete, platform admin included, and section 3 of
`supabase/tests/stage5_rls.test.sql` keeps asserting that for a middle version, the head and
version 1 — plus the TRUNCATE route around it. **Neither is to be relaxed or removed as
"dead weight" by a later pass.** That assertion is the thing that stops "the delete UI shipped"
from quietly coming to mean this too.

**Why deferred** — the durable part, so a future decision starts informed:

1. **Whole-project delete already does what he actually asked for.** His original ask was *"be able
   to delete some of the drafts/test projects,"* and the first slice does exactly that, including
   across companies. Nothing shipped is waiting on a version-level delete.
2. **A middle-of-chain delete leaves `head_version_number` stale and breaks a `parent_version_id`
   link** — the hazard 0006's own comment named and the spec has carried at `:726` since Stage 2.
   Neither is cosmetic: `rename_project` (0006:570–585) reads the head row **by number** and raises
   *"project not found, or you cannot save to it"* when it is missing, so a stale head makes a
   project permanently unrenameable **with a message about permissions that is not true**.
3. **It would need a hand-pasted migration**, and every migration costs Tommy a paste into the
   Supabase SQL editor with pre-flight and post-flight checks in `supabase/README.md` (see `0009`
   and `0010`). The first slice needed none, and neither does the backup below. That asymmetry is
   most of the cost difference.
4. **It would break a shipped feature outright — the decisive argument, and it was found in the code
   rather than reasoned about.** `companyBackup.ts:238–241` states the assumption in words:
   *"versions are numbered 1..head with no gaps (no single-version delete exists in Stage 2), so a
   missing number is a version the zip lacks"* — and `collectCompanyBackup` treats a missing number
   as a hard failure with **no file at all**. One deleted middle version would therefore stop that
   company's backup producing anything, which is the worst possible way to learn about it.

**The two cheaper shapes that were on the table**, recorded so the next decision does not start
from scratch:

- **Head-version-only** — "undo that save". The tip has no children, so nothing is orphaned and no
  re-link decision arises; version numbers stay contiguous **so the company backup keeps working
  unchanged**, which is the decisive difference from the general case. The head pointer moves back
  one, and `projects.name` / `updated_at` have to be recomputed from the new head's document or the
  tree keeps showing the deleted version's name. Its own residual hazard, unresolved: the next save
  **reuses** the number just freed, so two different documents will have been "version 7" at
  different times — and that number is what the backup's file names, the divergence notice and any
  zip already downloaded all quote.
- **Full any-version** — needs the re-link-or-gap decision first (re-pointing a child at its
  grandparent is an `UPDATE` of `project_versions`, which `authenticated` holds no grant for at all
  and which the append-only trigger refuses for everyone, and re-pointing version 2's parent to
  null would violate `project_versions_parent_iff_not_first`), plus a full audit of everything
  walking the chain. That audit is not small: `head_version_number` alone is read by
  `apply_project_version_head`, `guard_project_columns`, `rename_project`,
  `prepare_project_version`, `browse_projects`, `listProjects`, `listVersions`, `readVersion`, the
  backup route and three RLS suites, and `parent_version_id` by `listVersions`,
  `save_project_version`, `browse_versions`, the backup manifest and `divergenceNotice`'s
  arithmetic. Several of those produce a **confidently wrong sentence** rather than an error when a
  number is missing — `historySummary` would print *"every version is still kept"* about a version
  that was deleted, and `divergenceNotice` would name *"versions 4–7"* when 5 no longer exists.

---

### Stage 5 plan — second slice: THE PLATFORM-WIDE BACKUP (2026-09-27) — PLANNED, NOTHING BUILT

Stage 2's plan set the split — *"company backup with stage 2, platform backup with stage 5"* — and
`:1197` records "not in scope: platform backup, granted projects, restore". Granted projects
arrived in 3E. This is the platform backup. **Restore is still not in scope**, and section 8 says
what that does and does not mean.

This extends the shipped company backup rather than inventing anything: the route contract, the
cursor discipline, the zip writer, the manifest and the "no file unless it completed" rule are all
2D's and 3E's, generalised over companies. **It needs no migration** — section 5.

#### 1. The central question, asked, answered, and then REVERSED on evidence — 2026-09-27

A platform backup crosses company lines by definition, so it had to be asked rather than assumed.
**Both of Tommy's answers are kept here, in order, because the sequence is the point: he chose the
cautious option first, was shown why it did not work, and changed his mind on evidence.**

**First answer — redact across the company line, conditionally.** Offered the choice, he said:
*"Option number three sounds good as long as those files can repopulate the actual building
structure"* — i.e. his own company's projects complete and restorable, every other company's
redacted exactly as a browse redacts them, **conditional on the building surviving the redaction.**

**Then the condition was tested against the code, and it failed.** `priceModifier` is in
`REQUIRED_STATE_KEYS` (`projectFile.ts:398`), so `parseProjectFile` refuses a redacted document
outright with `That file is missing the "priceModifier" field.` The file picker uses that strict
parser (`page.tsx:2084`); `parseRedactedProjectFile`, which excuses the key and holds it as `NaN`,
is wired only into the browse path (`useCloudProjects.tsx:896`). **So a redacted backup file could
not be opened by Load Project at all** — not "opens with a gap", but does not open.

**Second answer, and the decision: DO NOT REDACT. Full contents, every company.** Offered the three
ways out — teach Load Project to accept redacted files, label them as not loadable, or stop
redacting — he chose the third: ***"Don't redact at all then — back to full contents."***

**His rationale, recorded because it is the durable part: if a redacted file cannot be restored, the
redaction defeats the purpose of a backup.** A backup you cannot restore from is not a backup; it is
a listing. That is the whole answer to "what would a redacted platform backup be *for*", and it is
"not much".

**⚠ Why this is defensible, and not a guarantee casually dropped.** Redacting the cross-company half
**was never a security boundary and could not have been one.** `projects_select` and
`project_versions_select` (0006) both include `is_platform_admin()`, so the same person already
obtains any company's raw document from PostgREST one version at a time, with the publishable key
that ships in the browser. An unredacted platform backup therefore **widens nobody's access**; it
makes a bulk artifact match access that already exists. The redactor's own guarantee — which has so
far been absolute — is **untouched**: `browse_redact` and `browse_version` are not modified, not
called, and not gone around, and the browse path still strips `state.priceModifier` for every
cross-company read by a non-platform-admin. This slice simply is not on that path.

**⚠ The residual, stated honestly rather than argued away: this is a custody concern even though it
is not an access concern.** A single zip in `Downloads` holding every company's cost information is
a different kind of object from the same information reachable one version at a time behind a login
— it can be copied, attached to an email, or left on a laptop. Nothing in this design mitigates
that, and nothing pretends to. What it does is **say so, in the manifest's own notes and on the
screen that offers the download**, in the voice 2D already uses for "Removing a share later does not
reach a backup already taken."

**Two related answers, also given 2026-09-27 and now largely moot — kept because they are decided
questions rather than open ones:**

- **A project he holds only a *grant* on comes out in full: *"Yes — a share is a share."*** Consistent
  with 3E's company backup, which already puts granted projects in the zip complete. Trivially
  satisfied now that nothing is redacted.
- **"Your own company" means a company he is genuinely a member of**, not whichever company the
  acting-as cookie happens to be on. His acceptance of the recommended default. It no longer gates
  redaction, but it is the right definition of that line if a future feature needs one, and it is
  now settled rather than open.

#### 2. Restorability is the promise now, so it gets a named acceptance criterion

With nothing redacted, **every file in the zip is a plain `ProjectFile` that Load Project opens** —
which is a stronger and simpler claim than the redacted round trip would have been, and it is the
one thing the artifact exists to deliver. It gets a test with a name:

**`platformBackupRoundTrip.test.ts`** — take a real serialized project (the fixture style
`redaction.test.ts` already uses, `serializeProject` on a built state), write it through
`projectFileText` exactly as the zip writes it, read it back with **plain `parseProjectFile`**, and
assert:

- the parse **succeeds** — no excused keys, no redacted parse path, no `costsRedacted`;
- the parsed state is **deep-equal to the original**, `priceModifier` included, with the `Set`-valued
  keys (`checkedInteriorIds`, `checkedExteriorIds`) compared as sets;
- `savedAt` survives verbatim, so the title-block date of a restored file is the one that was saved;
- and a **negative control**: a document with `priceModifier` removed is **refused** by
  `parseProjectFile` with the missing-field message. That is the assertion that pins *why* the
  redaction was abandoned, so a future pass cannot quietly reintroduce it and believe the files
  still open.

No database, no browser, no route. It ships first (section 9, Stage A).

**⚠ The claim this test makes is about today's file format.** It asserts a v25 document round-trips.
A later format bump must re-run it; `classifyCloudSchemaVersion` is what already tells the manifest
which versions fall outside this app's window, and those are included raw and marked, as in 2D.

#### 3. Scale — what a zip of everything actually costs

The company backup builds one zip **in browser memory**: `createZipCollector` accumulates compressed
chunks in an array and `runCompanyBackup` turns them into a single `Blob` only after the last page
arrives. A platform backup is every company, every project, every version.

- **The route is not the problem.** Paging is unchanged: `BACKUP_PAGE_BYTE_BUDGET` 4,000,000 keeps
  every response under Vercel's ~4.5 MB limit, at most `BACKUP_PAGE_MAX_VERSIONS` = 50 versions a
  page, with `BACKUP_DOCUMENT_BATCH_SIZE` = 5 documents read in parallel. No single request grows
  with the size of the platform, so no route timeout is introduced.
- **The number of round trips does grow.** ~25 versions a request means a platform with 5,000
  versions is ~200 sequential requests. That is minutes, not seconds. It needs the progress line and
  the Cancel that 2D already has, and **the tab has to stay open** — say so in the UI, since this is
  the first operation in the app long enough for that to be a real instruction.
- **Memory is the real limit, and it is not solved — it is bounded and reported.** Keep the
  in-memory collector (it is tested, and `fflate` compresses these JSON documents well), and add a
  ceiling:
  - the preview mode reports `versionCount` and `byteEstimate` for the whole platform, and the UI
    shows both **before** starting;
  - a new administrative constant `PLATFORM_BACKUP_BYTE_CEILING` stops the run when compressed
    bytes exceed it, with the honest message and **no file**: *"This platform backup passed N MB and
    stopped; no file was saved. Back up company by company instead — Account ▾ → <company> —
    people."* The fallback is a feature that already works.
  - **Streaming to disk is explicitly out of scope for this pass.** The File System Access API would
    remove the ceiling, it is Chrome-only, it needs a user gesture held across minutes, and it is a
    second download path to test. Recorded, not built.
- **The 255-character path budget survives, but only because the layout was chosen for it.** The 3E
  worst case was 255 of 260 with `shared/<30>/`; naively adding `companies/<30>/` on top of 3E's
  layout gives **296 and is over**. The layout in section 4 replaces the top-level segment rather
  than nesting under it, and it is computed here rather than hoped:
  `C:\Users\Tommy\Downloads\` (25) + `platform-backup--2026-09-13T1402Z\` (34) + `<company-30>\`
  (31) + `proposals\` (10) + `<project-60>--<36-char id>\` (99) + `v0007--2026-09-13T1402Z.json`
  (28) = **227, with 33 to spare.** Any future segment must redo this arithmetic; the 3E note is the
  precedent for why.

#### 4. What goes in, and how it is laid out

```
manifest.json
<company-slug>/<folder>/<project-name-slug>--<project-id>/v0007--2026-09-13T1402Z.json
```

- **Owner-partitioned, and that dissolves 3E's hardest problem.** In a platform backup every
  project appears exactly once, under the company that owns it, so **`shared/` does not exist here
  at all** and the 3E finding that a granted project must not be duplicated under it cannot
  recur — there is no second place to put it. A project Building Integrity holds a grant on is in
  the zip once, under its owner, complete.
- **The company slug is capped at `BACKUP_COMPANY_SLUG_MAX_CHARS` (30)**, reusing 2D's constant and
  its reason.
- **The folder segment stays** (`current` / `past` / `proposals`), because it is the owner's own
  filing and here every project is under its owner.
- **Each file is the stored `ProjectFile` as 2-space JSON**, written by `projectFileText`, exactly
  as 2D writes it — **complete, every company, no exceptions.** Labels are served, because this is
  the ordinary read path, not the browse path that drops them.
- **Companies with no projects** get **no directory** (a zip has no empty folders) but **are named
  in the manifest**, so "Rare Forms is missing" and "Rare Forms has nothing" are distinguishable.
  That distinction is the whole point of listing them.

**The manifest** is 2D's `BackupManifest` with `formatVersion` **3** and these additions:

| field | why |
| --- | --- |
| `format: "building-integrity-platform-backup"` | a different artifact from a company backup; a reader must not mistake one for the other |
| `companies: [{ id, name, projectsIncluded, versionsIncluded }]` | every company, including ones with nothing |
| `projectsExpected: number \| null` / `projectsIncluded: number` | see the defect below |
| `notes[]` | extended, in 2D's voice: that this holds **every company's** documents **complete, cost fields included**; that it is the same information a platform admin can already read one version at a time, so it grants nothing new but **concentrates it in one file**; and 2D's existing sentence that a zip cannot be recalled |

**What is NOT in it, because the redaction is gone:** no `redacted` flag, no `removedPaths`, no
`labelServed`. **2D's `opensWithLoadProject` stays** — but only for the reason it already exists, the
file-format window (`classifyCloudSchemaVersion`), and **it is `true` for every version inside that
window.** Nothing in this slice makes it false.

**Grants are not copied and not recorded.** `collaborators_select` would serve them to a platform
admin, so it is available if he ever wants it, but 2D's manifest does not record grants and this
slice does not add them. Out of scope, deliberately.

**⚠ A defect found by reading 2D, and it applies to 2D as well.** `collectCompanyBackup` writes
`projectCount: runs.size` into the manifest — **what it received**, not what it expected. The first
page's `projectCount` is used for the progress line and then discarded. So a project the walk
skipped entirely (deleted mid-backup, or unreadable) **leaves no trace in the manifest at all**: the
count agrees with itself. The platform manifest carries **both** `projectsExpected` (from the first
page, `number | null`) and `projectsIncluded`, and a note whenever they differ. **Fixing 2D's own
manifest is not in scope for this pass**, but it is recorded here so it is not re-discovered.

#### 5. Does it need a migration? **NO — zero migrations, zero hand-pastes. Re-derived, not assumed.**

The reversal removed the only thing a migration was for. Revision 1 of this plan proposed an `0011`
holding one definer function whose job was to express the unredacted/redacted split **inside the
database**, because the split was a rule about what may cross a company line and rules like that do
not belong in a route. **With nothing redacted, there is no split to express**, and what remains is
an ordinary read that RLS already permits — exactly the position the delete slice was in.

**Every read this slice needs, checked against the migrations rather than remembered:**

| what the walk reads | what serves it | admits a platform admin? |
| --- | --- | --- |
| every company's `id`, `name` | `companies_select` (0002:279–289) | **yes** — `or public.is_platform_admin()` |
| every project row | `projects_select` (0006) | **yes** — `is_member_of(company_id) or is_platform_admin()` |
| every version's metadata **and `document`** | `project_versions_select` (0006) → `can_read_project` | **yes** — `can_read_project` includes `is_platform_admin()` |
| counts for the preview | the same three policies, `count: exact, head: true` | **yes** |
| *(if grants were ever recorded)* | `collaborators_select` (0008:824) → `can_read_project`; `collab_requests_select` (0009:776) names `is_platform_admin()` outright | **yes, both** |

The restrictive `*_require_aal` policies still apply on top, which is correct and unchanged: an
**enrolled** platform admin on a password-only session reads nothing, exactly as
`stage5_rls.test.sql` section 4 asserts for the delete.

**So there is no `0011`, and Tommy is asked to paste no SQL.** This is the second Stage 5 slice in a
row where the database work turned out to be already done — and, as with the first, **that is
verified rather than assumed**, by the suite in section 10 that asserts the policy definitions
themselves rather than believing them.

**⚠ CORRECTION to revision 1 of this plan: `0010` IS applied to live.** Revision 1 called it an
unapplied prerequisite and costed this slice at two hand-pastes. That was wrong. **Tommy pasted
`0010` on 2026-09-25 and confirmed the post-flight himself** — `browse_schema_redaction` came back
with both rows, formats 24 and 25. So format 25 is classified on live, the redacted half was never
blocked on it, and the prerequisite was already met before the question arose. It is moot twice over
now, since nothing here calls `browse_redact` at all, but the correction is recorded rather than
silently edited out.

**No policy, function, trigger or grant is changed by this slice.** `browse_redact`,
`browse_version`, `refuse_project_version_change`, `can_read_project`, `can_write_project` and every
existing policy are untouched. `service_role` gets nothing, and the service role key is never shared
and never gets a `NEXT_PUBLIC_` prefix.

#### 6. Partial failure — one uniform policy, and it is 2D's, unchanged

Revision 1 proposed a **two-speed** policy (the caller's own company failing the whole backup, other
companies noted as gaps) and flagged it as extending Tommy's answer rather than recording it. **That
asymmetry was grounded in the restorability split, which is gone, so it is withdrawn.** Every
company's projects are now equally restorable, so they get equal treatment. The recommendation is a
single rule, and it distinguishes two things 2D already distinguishes:

- **A version that cannot be included fails the whole backup, with no file.** That covers 2D's
  `"missing"` (could not be read back) and `"too-large"`. It is a **hole inside a project**, it means
  a database read failed, and a restorable backup with a hole in it is worse than no backup because
  the hole is found later. 2D's contract, unchanged. *(The `"redaction-not-classified"` case revision
  1 invented is gone with the redaction.)*
- **A project or company that ceased to exist mid-run is a noted gap, and the backup completes.** The
  walk steps past it, as 3E's granted phase already does, and `projectsExpected` vs
  `projectsIncluded` is what makes the step visible. This is not a hole in a project; it is a thing
  that is no longer there. The 3E precedent is the one to avoid repeating — a grant revoked
  mid-backup aborted the whole run and produced no file, which for a platform-wide run over minutes
  would mean it effectively never completes.

**Every count stays `number | null`.** A count that could not be read prints as a visible gap, never
`0` — the delete slice's rule, for the same reason: on a screen about what you are about to rely on,
a wrong `0` reads as "there is nothing of this kind to lose".

#### 7. The walk, the cursor, and why it cannot skip or duplicate

Same discipline as `backupRouteLogic.ts`, one dimension wider. **There is no `owned`/`granted` phase
here** — the partition is by owner, so the phase collapses out.

- **One total order: `(company id, project id, version number)`.** Companies come from
  `companies_select`, ordered by `id`.
- **Cursor `"<company id>:<project id>:<version number>"`**, of the last version already received.
  Every resumption is defined as "the next version after this one **in that order**": within the
  project, `.gt(version_number)`; then projects `.gt(id)` within that company; then companies
  `.gt(id)` from the beginning. Each step is strictly forward, so nothing is visited twice and no
  step jumps an intervening version.
- **A company, project or version that has gone since the last page:** advance to the next thing in
  the order, exactly as 2D does for a deleted project.
- **No 2D cursor compatibility is needed** — different route, different shape, and a phase-less 2D
  cursor must be **rejected as malformed** here rather than guessed at.
- **Every filter is `.eq()` / `.gt()` on a validated uuid or integer.** Nothing from the request is
  spliced into a PostgREST filter string. The one place in this codebase that builds filter syntax
  (`listProjects`' `or(...)`) builds it **only from values the database just returned**, and says so
  in a comment; that rule holds here.
- **Access:** the route refuses any session that does not say platform admin
  (`cloudRouteSession.ts`'s existing `deleteViewerOf` is the precedent — a re-read of
  `user_profiles.is_platform_admin`), **and RLS refuses again.** The route check only ever refuses;
  it never permits. **No admin client anywhere on this path** — `0006` grants `service_role` nothing
  on either table.

#### 8. Not in scope for this slice

- **Restore.** Nothing reads a platform backup back into the cloud. Recovery is Load Project, one
  file at a time — which is exactly what section 2 proves works, for every company now. See Open
  Item 2.
- **Streaming the zip to disk** (File System Access API). Section 3.
- **Fixing 2D's `projectCount`** to distinguish expected from included. Section 4.
- **Recording grants or access requests in the manifest.** Section 4.
- **Personal grants as a source.** In an owner-partitioned backup they are not a source at all. 2D's
  Open Item 2 stays as it is.
- **Company, account or folder deletion.** Decisions 13 and 28; untouched.
- **Any change to `roleDisclaimers`**, the Privacy Policy or the Legal Disclaimer.
- **Single-version delete.** Deferred above.

#### 9. Staged build order — smallest first, each independently shippable

| stage | what | proves |
| --- | --- | --- |
| **A** | `platformBackupRoundTrip.test.ts` (section 2). Pure vitest, no route, no migration, no UI. | **That a backup file restores.** Cheapest thing in the plan and it gates everything else: an artifact you cannot open is not worth building. Its negative control also pins why the redaction was abandoned. |
| **B** | The walk and the cursor, **documents excluded**, plus a `preview` mode returning company/project/version counts and `byteEstimate`. No zip, no download. | **Ordering and scale — the riskiest assumption now.** No-skip/no-duplicate across all three boundaries, and the first real figure for whether one in-memory zip is viable at all. Ships something useful alone: a platform admin can see what is out there and how big it is. |
| **C** | `supabase/tests/stage5_platform_backup_rls.test.sql` — **no migration.** Asserts the five policies really do serve a platform admin and really do serve nobody else. | **That section 5's "no migration needed" claim is true.** This is the delete slice's own pattern: the capability is already enforced, so the work is proving it rather than adding it. |
| **D** | Zip, manifest `formatVersion` 3, the byte ceiling, the partial-failure policy, download. | The artifact. `backupZip.ts` unchanged; `companyBackup.ts`'s collector generalised. |
| **E** | UI entry (platform-admin only, beside the company backup in the account panel), progress, Cancel, the "keep this tab open" instruction, the pre-flight estimate, and the custody sentence from section 1. | Nothing new; 2D's controller with a second mode. |

**B and C are the two that matter now.** B tests the assumption that could still send this back to
the drawing board (that one zip of everything is a viable object); C tests the assumption that makes
it cheap (that no migration is needed). **A is first because it is nearly free and it gates the
purpose.**

#### 10. How it is verified — and the bar is the one a reviewer already set

- **Local RLS suite, in the style of `supabase/tests/stage5_rls.test.sql`:**
  `stage5_platform_backup_rls.test.sql`, with the same refuse-to-run guard, the same
  `pg_temp.assert` / `sqlstate_of` helpers, the same "count past RLS with a definer helper, not
  through the caller's own view" discipline, and the same cast (alice, bob, dave, frank, nick, pat,
  henry). **It adds no migration and depends on none** — the same sentence `stage5_rls.test.sql`
  opens with, and for the same reason.
- **⚠ Never against the live Supabase project.** Nothing in `supabase/tests/` and not
  `local_shim.sql` — the suites destroy rows on purpose and carry a refuse-to-run guard precisely
  because someone might.
- **Run order matters, and `supabase/README.md` already records why:** `stage4_rls.test.sql`
  **cannot pass** on a database with `0010` applied (its fail-closed assertion for format 25 is
  exactly what `0010` satisfies). So Stage 4 is verified on `0001`–`0009`, and this suite on
  `0001`–`0010`. **There is no `0011`.**
- **The bar.** For the delete slice, a reviewer **stood up PostgreSQL, ran the suite, then
  mutation-tested it four ways** to prove it could fail. Anything less leaves a suite that has only
  ever passed, which is the status the first slice shipped in and said so about.

**Mutation tests, named, because "we mutation-tested it" is not a claim without them.** The four
against `0011` in revision 1 are replaced by four against the policies the suite pins:

*The access suite (SQL):*
1. Widen `projects_select` to `true` → *"bob, an ordinary Building Integrity member, reads 0 of Rare
   Forms' projects"* must **fail**.
2. Drop the `is_platform_admin()` clause from `companies_select` → *"pat enumerates all four
   companies"* must **fail**.
3. Drop the restrictive `project_versions_require_aal` policy → *"an enrolled platform admin on an
   aal1 session reads 0 documents"* must **fail**.
4. `grant select on public.project_versions to service_role` → the *"`service_role` holds nothing"*
   assertion must **fail**.

*The route (vitest):*
5. Flip the platform-admin viewer check from refuse to permit → *"a company admin gets 403 and no
   page"* must **fail**.

*The walk (vitest):*
6. Drop the company-id tiebreak from the ordering → the no-duplicate/no-skip test must **fail**.
7. Default `projectsExpected` to `projectsIncluded` → the visible-gap test must **fail**.
8. Coerce an unreadable count to `0` → the `number | null` test must **fail**.

*The round trip (vitest):*
9. Change one geometry key in the fixture → the deep-equal assertion must **fail**.
10. Make the negative control pass a document **with** `priceModifier` removed → the
    refused-by-`parseProjectFile` assertion must **fail**.

#### 11. Honest size estimate — revised down by the reversal

Measured against the two things this log has real numbers for.

- **The delete slice** was about **a day of agent work, no migration** — a route, a hook, a display
  module, their tests and an SQL suite, on a capability the database already enforced.
- **The ring workstream** is **~3× all of Smearforn Stages 0–3**.

**This slice is roughly 2× the delete slice: 2 to 2½ days of agent work, and ZERO hand-pastes by
Tommy.** Stage by stage: **A** ~1–2 hours; **B** ~half a day; **C** ~half a day; **D** ~a day;
**E** ~half a day.

**Revision 1 estimated 2½–4 days plus two hand-pastes.** The reversal removed the migration, the
definer function, the two-speed failure policy, three manifest fields and the redacted parse path —
and the `0010` correction removed the second paste that was never needed. **It is the same shape as
Stage 2D, one dimension wider**, which is the fairest comparison. **Far smaller than the ring
workstream.**

**What would make it bigger:** if Stage B's real figures show one in-memory zip is not viable and
Tommy wants streaming to disk rather than a byte ceiling. That would add a day. It is not assumed.

#### Open Items — the platform backup (each with a recommended default)

Revision 1 had four. **Two are now answered** and are recorded as decisions in section 1 — grant-only
projects come out in full (*"a share is a share"*), and "your own company" means genuine membership.
Two remain:

1. **One zip, or one per company?** **Recommended default: one zip, with the byte ceiling of section
   3** — and the ceiling's message points at the per-company backup, which already works. The
   alternative (N sequential downloads) never hits a memory limit but produces a pile of files with
   no single manifest, and a manifest over the whole platform is most of what this is for.
   **Stage B's real numbers should be in front of him before he answers this**, which is why B comes
   before D.
2. **Is Load Project, one file at a time, enough of a restore?** *"As long as those files can
   repopulate the actual building structure"* was a restore question, and the answer is now yes for
   every company. **Recommended default: yes, and restore-into-the-cloud stays out of scope** — but
   his answer shapes the manifest *now*, because a future restore would need the parent chain, the
   ids and the folder, which it already carries. Worth confirming rather than assuming the manifest
   is enough.

#### Flags check — run against this plan: **vacuously clean, and deliberately so**

Per the 6-point discipline. **This is backend work and it introduces no real-world building value of
any kind**, which is stated explicitly rather than left implied.

1–4. **Clean, vacuously.** There is no real-world number in this plan to carry a `status` and a
`note`: no fastener spacing, no density, no load, no dimension, no cost figure. No `CatalogValue`,
`CatalogRange` or `PanelStructuralStatus` is in scope. `packages/panel-catalog/src/data.ts` is not
touched, and neither is `packages/geometry` or `packages/calc-engine`. The whole footprint is
`apps/web/app/cloud`, `apps/web/app/api` and `supabase/tests/`.

5. **Clean.** Nothing new reaches the Review Log. `toReviewLog()` is not in the diff.

6. **Clean.**
   - **Every number here is administrative:** page byte budget (4,000,000), page maximum (50),
     document batch size (5), company slug cap (30), the computed 227-character path budget, the new
     `PLATFORM_BACKUP_BYTE_CEILING`, manifest `formatVersion` 3, migration numbers, SQLSTATEs and
     HTTP statuses. **None is a claim about a building.**
   - **The one price-shaped thing in scope is `priceModifier`, and this plan copies it verbatim and
     computes nothing with it.** It is bytes in a file, not an input to arithmetic. The reversal in
     section 1 is precisely a decision *not* to alter a stored value.
   - **Nothing pending is treated as settled.** `0010`'s status is corrected to applied-and-confirmed
     rather than left as revision 1 had it. The restorability claim is scoped to today's file format
     and says so. The withdrawn two-speed failure policy is recorded as withdrawn, with its reason,
     rather than deleted. Single-version delete is recorded as deferred with its reason, and the test
     that keeps its door shut is named as not-to-be-removed.
   - **The convention's own principle is kept in four places:** every count is `number | null` so an
     unreadable count prints as a gap and never `0`; `projectsExpected` is carried beside
     `projectsIncluded` so a skipped project is visible instead of agreeing with itself; a company
     with nothing is named in the manifest rather than being indistinguishable from a company that
     went missing; and the custody residual of an unredacted platform-wide zip is stated in the
     manifest's notes and on screen rather than left for someone to notice.

---

### Coder handoff — Stage 5, second slice: the platform-wide backup

**Scope, one sentence.** Add a platform-admin-only backup that walks every company, every project
and every version and writes every document **complete** into one zip with a manifest, reusing the
company backup's route contract, cursor discipline, zip writer and "no file unless it completed"
rule.

**⚠ Read section 1 before writing anything.** Tommy chose to redact across company lines and then
**reversed it on evidence**. Nothing in this slice redacts. Do not reintroduce a redaction path, and
do not call `browse_redact` or `browse_version`.

**⚠ NO MIGRATION.** Section 5 derives this against the five policies. If you find yourself writing
`0011`, stop and say what for — it means a premise in section 5 is wrong, and that is worth knowing
rather than working around.

**Files likely affected**

- New: `apps/web/app/api/platform/backup/route.ts`; `apps/web/app/cloud/platformBackupRouteLogic.ts`
  + test; `apps/web/app/cloud/platformBackup.ts` + test;
  `apps/web/app/cloud/platformBackupRoundTrip.test.ts`;
  `apps/web/app/cloud/usePlatformBackup.ts`; `apps/web/app/cloud/PlatformBackupSection.tsx`;
  `supabase/tests/stage5_platform_backup_rls.test.sql`.
- Changed: `apps/web/app/cloud/cloudTypes.ts` (the page and manifest shapes);
  `apps/web/app/cloud/cloudRouteSession.ts` (reuse the platform-admin viewer, do not write a second
  one); `apps/web/app/auth/AccountPanel.tsx` / `AccountControl.tsx` (the entry);
  `supabase/README.md` (a Stage 5 second-slice section saying **no migration**, and how to run the
  new suite).
- **Probably not at all — check before changing:** `apps/web/app/cloud/backupZip.ts`.
- **Not to be touched:** `packages/*`, `data.ts`, `supabase/migrations/*`, `browse_redact`,
  `browse_version`, `refuse_project_version_change`, any existing RLS policy, `roleDisclaimers`.

**Acceptance criteria**

1. **A file from the zip opens with plain Load Project, and its state is identical** — section 2's
   assertions, including the negative control that a document missing `priceModifier` is refused.
2. Every document in the zip is **complete**: `state.priceModifier` present, label present, author
   name unmasked. No `redaction` marker anywhere in the archive.
3. The walk visits every version exactly once. No duplicates, no skips, across a page boundary that
   falls inside a project, between two projects, **and between two companies**.
4. **No access is a refusal, never a success.** A non-platform-admin gets nothing from the route,
   and RLS gives them nothing if they bypass it and go to PostgREST directly.
5. Every count in the response and the manifest is `number | null`; a count that could not be read
   prints as a gap.
6. `projectsExpected` and `projectsIncluded` are both in the manifest, with a note when they differ.
7. A failure or a cancel produces **no file** — including a cancel pressed after the last page has
   arrived (the bug `companyBackupRun.ts` records fixing).
8. The manifest's notes say, in sentences, that this holds every company's documents complete with
   cost fields included, and that it concentrates in one file what a platform admin could already
   read one version at a time. The download screen says it too.
9. `supabase/tests/stage5_platform_backup_rls.test.sql` passes on a database built from
   `0001`–`0010`, **and fails under each of mutations 1–4 in section 10.**
10. Lint **delta** of zero against the base commit, **warnings counted too** (`apps/web/AGENTS.md`),
    and `npx tsc --noEmit` in both `apps/web` and `packages/geometry`.

**Edge cases worth testing**

- A company with no projects (named in the manifest, no directory).
- A project with one version; a project whose head is version 1.
- A version **outside this app's file-format window** → included raw and marked
  `opensWithLoadProject: false`, for 2D's own reason. This is the only thing that sets that field
  false.
- A document at the 4 MB `prepare_project_version` limit; the `BACKUP_SINGLE_VERSION_HARD_LIMIT`
  guard that should never fire.
- A project deleted, or a whole company's last project deleted, mid-backup — the walk steps past;
  `projectsExpected` differs from `projectsIncluded`; there is still a file.
- **Two companies whose names slug identically** (e.g. "Rare Forms" and "rare-forms"). Unlike a
  project directory, a **company directory has no id in its name**, so this collision is reachable in
  a way 2D's never was. `claimUniquePath` must not silently overwrite — decide it deliberately, and
  consider whether the company id belongs in the segment after all (re-run the section 3 path
  arithmetic if it does).
- A company or project name that is pure punctuation or a Windows device name (`con`, `nul`) →
  `backupNameSlug` / `isWindowsSafePath`.
- A version `created_at` the strict parser rejects → `time-not-recorded`, never today's date.
- The platform admin's session losing `is_platform_admin` mid-backup → the next page refuses and
  there is no file.
- Two-factor: an **enrolled** platform admin on a password-only session gets nothing
  (`meets_required_aal()`), as `stage5_rls.test.sql` section 4 asserts for the delete.

**Explicitly NOT in scope for this pass**

Everything in section 8: restore, streaming to disk, fixing 2D's `projectCount`, recording grants in
the manifest, personal grants as a source, company/account/folder deletion, `roleDisclaimers`, the
Privacy Policy and the Legal Disclaimer. **And single-version delete, which is deferred — do not open
`refuse_project_version_change`, and do not weaken or delete section 3 of
`supabase/tests/stage5_rls.test.sql`.**

**Two process rules to carry**

1. **⚠ Never connect to the live Supabase project.** Nothing in `supabase/tests/` and not
   `local_shim.sql`. Verification is a local PostgreSQL only. The service role key is never shared
   and never gets a `NEXT_PUBLIC_` prefix.
2. **⚠ `git diff --cached --stat` before every commit, and stop if a file you did not edit
   appears.** A worktree with a stale index recently committed a revert of ~918 lines under a
   message about something else entirely.

**Open Items 1 and 2 are Tommy's to answer before Stage D**, and Stages A, B and C can all be built
without them. **Open Item 1 should be put to him with Stage B's real figures in hand**, not before.
