# Export for Tip4urTime — queued 2026-11-14

**Status: QUEUED. Nothing built.** This is his brief, recorded verbatim in
substance, plus the conflicts I can already see so they get answered before
code rather than during it.

---

## What he asked for

A **"Export for Tip4urTime" CSV download on each project.**

> Tip4urTime is the crew time clock and profit-sharing app. Crews claim panels
> as they build them, and the app tracks panels and square footage per person
> and per house. It needs each project's panel list.

UTF-8 CSV, comma separated, standard quoting.

```
Project,<project name>
Project ID,<permanent project id>
Panel code,Panel type,Label,Width (in),Height (in),Sq ft
<one row per PHYSICAL panel>
```

**One row per physical panel — not per cut, not per assembly type.** A design
with 12 copies of one assembly is **12 rows with 12 different codes.**

| column | rule |
|---|---|
| **Panel code** | required · unique within the project · ≤40 chars · **STABLE**: the same panel gets the same code on every export, even after edits elsewhere. Never renumber existing panels; new panels get new codes. Re-imports match on this. |
| **Panel type** | required · e.g. Wall, Roof, Floor, Gable |
| **Label** | optional · friendly name, e.g. "North wall" · blank if none |
| **Width (in)**, **Height (in)** | finished panel size, inches |
| **Sq ft** | required · face area · plain number, ≤2 decimals, no units, no thousands separator (`32` or `32.5`) |
| **Project ID** | permanent, never changes, **even if the project is renamed** |

**Prohibitions, both load-bearing:**

- ⚠ **No column named `Used at`.** That name marks the old cut-list format and
  changes how the file is read.
- ⚠ **No caps, no abbreviated lists.** Every panel gets its own row. (This is
  the opposite of every other list in this app, which is bounded — the Review
  Log's `LIST_LIMIT = 8`, the shop sheets' "and N more". A truncation habit
  copied in here would silently drop a crew's pay.)

### Acceptance check (his)

Export a project, re-export after an **unrelated** edit, confirm every
existing panel kept its code and only new panels are new rows. Every code
unique, every Sq ft a number above 0.

### Later, not now — design for it

Each company account may get a private, **revocable "sync link"**: a secret
URL returning this same CSV for one project, or a list of the company's
**current (not finished)** projects, so Tip4urTime refreshes without an
upload.

- The link exposes **panel data only** — no client names, addresses or prices.
- **Keep the export behind one function** so serving it at a URL later is a
  small change.

---

## ⚠ Conflicts and gaps to settle before building

### 1. The stable code — ANSWERED 2026-11-14, and it is no longer an exception

I raised this as a conflict with his standing rule that **panel identity is
DERIVED, never stored** — *"not from a memory file."* His answer moved the
problem rather than overriding the rule:

> *"Once we start building a project there shouldn't be any edits that
> happen... If we're building a project that means it's been approved and high
> unlikelihood that it's going to change. However you want to handle that,
> have at it."* — Tommy, 2026-11-14

⚠ **Note what that does and does not say.** It says edits after approval are
rare; it does **not** say they are impossible, and his own acceptance check
re-exports after an edit. So the requirement stands — but the moment it starts
mattering is now named, and it is the **export itself**.

**Decision (delegated to me, recorded here): the code is STAMPED AT FIRST
EXPORT, then stored.**

- A panel has no code and needs none until someone exports. Nothing is stored,
  no migration runs, and a design that never goes to a crew never grows a
  field — which is why this is not the schema exception I first described.
- On export, every panel without a code gets the next one from a **per-project
  counter** stored alongside the id, and the project is saved. From then on
  those codes are fixed.
- Later edits: existing panels keep their codes, new panels take new ones from
  the counter, deleted panels simply stop appearing. **The counter never goes
  backwards, so a deleted panel's number is never reissued** to a different
  panel — which is the failure a crew would actually feel.
- Format `P-0001`, zero-padded, far inside the 40-char limit.

⚠ **This is not a panel name and must never appear on a shop sheet.** His
derived-identity rule governs what the shop reads — `8' Super Carrot`,
`8½" Header (Lintel) 40⅛"`. This is a join key for a different application,
invisible in the app and invisible in the packet. Keeping those two apart is
the whole reason the rule survives intact.

The export is also the honest place for it on his own reasoning: exporting to
Tip4urTime **is** the project going to build, so stamping at that moment is
stamping at approval.

### 2. Project ID for a project that was never saved — falls out of the same decision

Cloud projects have an id; a local-only design does not. Minted at first
export and stored, exactly as the panel codes are, so the second export agrees
with the first. Renaming must not touch it (his words).

### 3. "Panel type" — ANSWERED 2026-11-14: the app's own names

His brief said *"e.g. Wall, Roof, Floor, Gable"*, which I read as a coarse
four. He corrected it:

> *"I think the original coarse panel type stuff is out of date. I really like
> where we're headed with the current naming scheme with the apps dozen
> descriptive names."*

So the column carries the app's real type, not a bucket — Standard, Braced,
Corner, Column, Window, Door, Big Header, Gable End, Gable Peak, Cross-Tilt,
Floor, Roof, Truss Plate, Box Beam, Mid-Wall Beam, Safety Gap.

⚠ **Then `Panel type` and the distinct NAME are two different columns doing
different jobs, and the file should not collapse them.** `8' Super Carrot`
already encodes height, figure and hand; the type is the coarse class a crew
claims against. Keep the type machine-stable (the catalog's own id, title-
cased) and let `Label` carry the human string, since that is what a re-import
matches on and what a crew reads.

### 4. Sq ft above 0 — what about the panels that are not faces

A Safety Gap is a gap. A Truss Plate and a Box Beam are not wall faces. A
zero-width sliver can round to 0.00. His check says **every Sq ft is above 0**,
so either those are excluded from the export or they are not "physical panels"
for this purpose. Needs one sentence from him.

### 5. Where it reads from

`projectExportAssemblies.ts` is the **one list every file export reads**
(CSV shipped 2026-11-01, DXF after it). This export should read the same seam
rather than walking the project itself — but note that seam is **per unique
assembly**, and this file is **per instance**. The instance list exists
(`allPanelInstances`); the join is the work.

### 6. The sync link reuses the share-link machinery — CONFIRMED 2026-11-14

> *"I like your take on using current share link rather than secret."*

Migration `0011` already has revocable, expiring, SHA-256-hashed tokens with
`share_link_is_live`, and `0013` added anon-reachable signup against them. A
second secret-URL scheme would be two things to revoke. The "panel data only"
constraint argues for a dedicated RPC that returns **only** the export rows,
rather than a link that grants the project document.

---

## Shape it should take

One pure function, no DOM, no React:

```ts
export function buildTip4urTimeCsv(input: Tip4urTimeExportInput): string
```

with `Tip4urTimeExportInput` carrying **only** the project name, the project
id, and the panel rows — so that the "no client names, addresses or prices"
rule is enforced by the type rather than by remembering to filter. The
download button and, later, the route handler both call it.

---

*Related: `export_seam.md`, `panel_identity_is_derived.md`,
`share_links_and_signup.md`, `tip4urtime_app.md`.*
