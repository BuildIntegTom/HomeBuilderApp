# Prompt for the Tip4urTime repo — the strawpanels.com panel export now exists

Paste everything below the line into a Claude Code session opened at
`Desktop\Tip4urTime Repo\labor-arcade-handoff\labor-arcade`.

---

The strawpanels.com panelizer now has the panel-list export that `SPEC.md`
section 9 was waiting on. It shipped 2026-11-14. Read `lib/panelImport.ts`,
`docs/SPEC.md` section 9, and `app/panels/page.tsx` first — the importer
already accepts this file loosely, so most of this task is tightening it onto
the real format and acting on two decisions that only the panelizer could
answer.

## The file, exactly as it is now emitted

UTF-8, **no byte order mark** (deliberate — a BOM lands inside the first header
cell of a file a program parses), CRLF line endings, RFC 4180 quoting.

```
Project,Rogers-Sehorn ADU
Project ID,8f1c2a44-6b0e-4d91-9a3c-11d5e7c20b7e
Panel code,Panel type,Label,Width (in),Height (in),Sq ft,Counts as panel
P-0001,Standard Panel,N1,48,96,32,1
P-0002,Super Carrot Panel,N2,48,96,32,1
P-0084,Safety Gap,N14,0.75,120,0.63,0
```

- **`Project ID`** is new and is the thing to key on. It is a permanent id that
  does not change when the project is renamed. The current importer only reads
  the `Project,<name>` row, so renaming a project in the panelizer creates a
  second project in Tip4urTime on the next import. Match on the id, fall back
  to the name only when there is no id row (older files), and when an id
  matches a project whose name has changed, **update the name rather than
  forking the project**.
- **`Panel code`** is stable by construction. The panelizer stamps it at the
  first export and stores it from then on; existing panels are never
  renumbered, and a deleted panel's number is never reissued. So a re-import
  really can be matched purely on code, which is what section 9 already
  assumes. Codes look like `P-0001`, ≤40 characters.
- **`Panel type`** is the app's own descriptive type name — about a dozen of
  them: `Standard Panel`, `Super Carrot Panel`, `Little Carrot Panel`,
  `Corner Panel`, `Column Panel`, `Safety Gap`, `Window Panel`, `Door Panel`,
  `Big Header`, `Gable Panel`, `Gable Peak Panel`, `Floor Panel`,
  `Roof Panel`, `Tilted Gable Panel`, `Box Beam`, `Truss Plate`,
  `Mid-Wall Beam`, `Spanning Header`. **Do not hard-code this list** and do
  not switch behaviour on it — treat it as a display string. The one piece of
  behaviour you need comes from its own column instead, below.
- **`Label`** is the panel's stencilled name (`N1`, `F12`, `T6`) — what a crew
  reads off the panel in the shop. It can be blank.
- **`Sq ft`** is the panel's face area in elevation, a plain number with up to
  two decimals, no units, no thousands separator. Always above 0.
- **There is no `Used at` column**, by design.

## Decision 1 — `Counts as panel`, and what it is for

Tommy, 2026-11-14:

> *"Safety gaps should also populate in the things to make in the shop as well
> as beams and stuff like that. Those simply don't count as panels. But maybe
> they count as surface area! It should show that they have done it and claimed
> it, it just doesn't count for panel count. That's all."*

So the file carries a trailing **`Counts as panel`** column, `1` or `0`.
A Safety Gap is `0`; everything else is `1` today, and beams and other
non-panel shop items will be `0` as they are added.

What that has to mean in Tip4urTime, concretely:

- A `0` row is **imported, listed, and claimable** like any other. A crew
  member who built it claims it and it shows in their history.
- Its **square footage counts** in every square-footage total: per person, per
  project, the pot, the calendar, the leaderboard.
- Its **panel count does not count** — anywhere a number of panels is shown or
  used. That is: the project progress bar (`panels with a claim / panels in the
  project`), the crew day cell's panel count, `panels made` on the career
  stats, `panels per day`, and **the builder-title curve**, whose levels are
  defined in panels (`level n starts at 2·n² panels`). Letting a ¾in filler
  strip advance someone toward "Godly Master Builder" is exactly what he is
  ruling out.
- Treat a missing column as `1`, so an older file still imports.

⚠ **Check `lib/calc.ts` and `scripts/check-math.ts` for every place a panel is
counted by `panels.length` or by counting claim rows.** That is where this
decision will quietly fail to apply. Add hand-worked math checks that pin a
project containing one `0` row: its square footage includes the strip, its
panel count and progress bar denominator do not.

⚠ **One number to sanity-check and report back, not to fix here.** A Safety Gap
exports as `0.75 x 120 = 0.63 sq ft`, because the panelizer measures every
panel's face in elevation and a safety gap's face is the sheet seen edge-on.
The plywood sheet itself is panel-depth by panel-height — about 12.9 sq ft for
the same part. The panelizer is internally consistent (it prices the same face
at one flat rate), so **do not change it on this side**; just note in your
report which figure a crew would think they earned, so Tommy can decide.

## Decision 2 — drop the cut-list fallback

`readPanelFile` accepts the panelizer's cut-list CSV as a second shape, and
only when every assembly names all of its copies, because `Used at` caps at
twelve names. That existed because the panel list did not. It does now, and the
cut list is the wrong file for this job on purpose: it is one row per **cut**
and groups identical panels onto one assembly, so it cannot distinguish the
twelve physical panels a crew claims individually.

Remove that branch and replace it with a refusal that names the fix: *"This is
the cut list. Export the panel list for Tip4urTime from strawpanels.com
instead."* Keep the loose header matching on the panel-list path — a file from
an older panelizer build, without `Project ID` or `Counts as panel`, must still
import.

## Design for the sync link, do not build it

Tommy's plan is that each company account eventually gets a **private,
revocable sync link** — a URL on strawpanels.com that returns this same CSV for
one project (or a list of the company's current, unfinished projects), so
Tip4urTime can refresh without anyone uploading a file. On the panelizer side
the whole export already sits behind one function that takes only panel data,
so serving it at a URL is a small change there.

What this repo needs now is only that the import path not assume a file picker:
put the parse-and-upsert step behind a function that takes CSV **text** plus
the acting company, so a later "Refresh from strawpanels.com" button can call
the same code with a fetched body. No endpoint, no credentials, no polling in
this task.

⚠ **The link will expose panel data only** — no client names, addresses or
prices — and the file above is already that shape. Do not add a column to it
from this side, and do not infer anything about a client from a project name.

## Update the spec

`docs/SPEC.md` section 9 records the export as *"strawpanels.com does not
export this yet"*, and the open-questions list (near the end) still has
*"The strawpanels.com panel-list export: column names and whether it carries
the project name."* Both are answered now — record the real format, the
permanent project id, and the `Counts as panel` rule as DECIDED 2026-11-14.

## Checks

The repo's own gates: `npx tsc --noEmit`, the math checks in
`scripts/check-math.ts`, and the browser checks at phone width. Add:

1. A round-trip of the exact file above: 3 panels in, 2 counting, square
   footage 64.63, panel count 2, progress bar denominator 2.
2. A re-import after the panelizer added a panel and renamed the project:
   same project row, name updated, existing claims intact, one new panel.
3. A cut-list file is refused with the new message.

Deploy is `npx vercel deploy --prod` from the repo folder — there is no git
remote. **Do not deploy or run production SQL**; Tommy pastes migrations
himself.
