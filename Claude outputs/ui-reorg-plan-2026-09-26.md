> **STAGING NOTE — read first, then delete this block.**
>
> This file is a **new top-level section for `building_integrity_app_spec.md`**, staged outside the
> spec doc because the worktree it was meant to be written in could not be created: **the Bash tool
> is disabled in this session**, so `git worktree add -b ui-reorg-plan …` could not be run. Nothing
> in the main checkout was edited — it is still at `a192b59`, and this file sits in the already-
> untracked `Claude outputs/` directory.
>
> **To apply:** create the worktree, then append everything below the `---` rule into
> `building_integrity_app_spec.md` immediately **before** the `## Provisional Values — the `status`
> flag convention` section (i.e. in the same slot the Top Bar & App Chrome section occupies now,
> after it), and add the two Open Items marked **`→ ## Open Items`** at the end of this file to the
> doc's own global `## Open Items` list.

---

## Top Bar & Navigation Reorganisation (2026-09-26) — PLANNED, NOTHING BUILT

Tommy, 2026-09-26:

> *"Can we hide the acting as: under the account drop down?*
>
> *I want the top bar to read Building Integrity, Account, Projects, Design, View, Print, Summary, Walls, Floor, Roof, Foundation, Settings.*
>
> *Design, View, and Summary should look and function similar to how the Acting As button does right now, each of those words. For example (all caps dark grey) Design (First Letter Cap and Black)Plan View. Each of these three drop down buttons along with print will only show the current page under it's button menu. For example with the Design Plan View open, View and Summary just show view and Summary. When View 3D Framed is chosen, the menu looks like Design View 3D Framed Summary Print. Clicking on print shows a fleshed out printing customization "editor".*
>
> *View, where the 3D box, 3d framed, and membranes editors/viewers live. To the right of that is Print, where all of the printables live - this alleviates them from being in the right side bar. Let's get rid of the right side bar and move single wall run into the panelizer tab (speaking of which where is it? We should move the content of the panelizer into the settings in the top right). Put the read me as it's own cute little icon next to the ? On the left bar on the bottom. I want report bug / request feature also as an icon near the ?.*
>
> *Let's hide the Role options under account menu.*
>
> *Summary tab holds the project summary, project totals, material totals, shipping, plaster master, door and window ROs. Instead of pop up sticky notes, this fills the editor page."*

**Sequencing — his order, his words: *"Admin tooling would be nice to finish, then UI changes, then ring structures."*** So this workstream starts after the remaining admin-tooling pieces (platform-wide backup, single-version delete — which needs its own design, since it leaves `head_version_number` stale and breaks the `parent_version_id` chain — and the platform-admin cross-company UI), and it sits **ahead of** the Concentric Wall Rings workstream. The 51–75in corner-geometry fix also lands with admin tooling and is unaffected by anything here.

**This is a presentation change and nothing else. It introduces no real-world building value of any kind** — see the flags check at the end, which is vacuously clean and says so explicitly.

### "Speaking of which, where is it?" — the Panelizer, answered

**It is not a tab and never has been. It is a menu item inside `Project ▾`.** `TopBar.tsx:413-420` renders a `Panelizer` button inside the Project note, which opens a second `StickyNote` (`TopBar.tsx:428-430`) holding `panelizerContent` (`page.tsx:6304-6727`). That is why it is hard to find: it is **two levels deep behind a menu named after files**, and its own doc comment describes it as *"the keyhole to getting down to what editor tools are needed for this user's project"* — i.e. the most consequential control in the app, filed under Save/Load.

**So his instruction and the defect agree, and the move is the fix, not a preference.** Panelizer content goes to Settings, one level deep, with Site Properties and the Single Wall Run sandbox beside it.

### THE CENTRAL REQUIREMENT — "let's make sure nothing is lost"

**That is a checkable claim, and making it checkable is this plan's main job.** The inventory below was built by **reading the code**, not by reasoning about what an app like this probably has. Every row has a destination or is named as an Open Item. **This inventory is the acceptance criterion for the whole workstream** and it is what a reviewer checks against.

**A navigation change has one specific failure mode: something stops being reachable and nobody notices.** It does not throw, it does not render wrong, and it does not fail a unit test — the same fail-quiet class this log has already paid for twice (`orderedWallCycle` returning `null` and emitting no floor framing; the account control sitting 677px off-screen while its own doc comment claimed "always visible"). **The staging below is arranged so the right sidebar — today's home for every printable — is the last thing deleted**, which means there is a working fallback in front of the user during every intermediate stage.

#### 1. Top bar today → top bar tomorrow

Source: `TopBar.tsx` (`OpenMenu = "project" | "site" | "panelizer" | "role" | "settings"`), plus `AccountControl.tsx`, which owns its own note.

| # | On the bar today | Lands |
|---|---|---|
| 1 | Wordmark `Building Integrity` — text, `--bi-primary`, **shown only at ≥1200px** | Unchanged position. ⚠ It is item 1 of his twelve, so it is now part of the width problem — see §5 |
| 2 | `AccountControl`: the bordered chip (`ACTING AS` caption + company `<select>`, 220px / 280px cap) **plus** the `Account` / `Sign in` button | **Account** — ⚠ **but the acting-as company must stay legible on the bar; this reverses a standing safety decision. See §4 and Open Items** |
| 3 | `Project ▾` | **Projects** (rename only; contents below) |
| 4 | Middle nav `Wall · Foundation · Floor · Roof` (≥1200px), rendered from `editorTabsInScope(enabledTabs)` | **Walls · Floor · Roof · Foundation** — ⚠ the keyhole rule interacts with his "stay visible" answer; Open Item |
| 5 | `Role: <label> ▾` (`roleControlLabel`) | **Into the Account menu** as its own labelled group |
| 6 | `⚙` icon button | **Settings**, which now absorbs Site + Panelizer + Single Wall Run |
| — | *(new)* | **Design**, **View**, **Summary**, **Print** — four new bar controls, §2 and §3 |

#### 2. `Project ▾` note today → `Projects` and `Settings`

| Item in the note (source) | Lands |
|---|---|
| `cloud.statusLines` — which cloud project is open, and that saves still go to it | Projects |
| `cloud.refile` — `Move to…` folder `<select>` with the owner's folder tree as the optgroup heading | Projects |
| `This computer` section heading | Projects |
| `Save Project` (JSON download; **not rendered while browsing another company's design** — Stage 4B) | Projects |
| `Load Project` (file input, never sign-in-gated) | Projects |
| `sign-in-prompt` line → dispatches `OPEN_ACCOUNT_CONTROL_EVENT` | Projects (⚠ it opens the Account control — the event must still find its button once that control moves) |
| `Save to cloud` / `Save as new cloud project…` / `Open from cloud…` / `Version history` / `Sharing…` | Projects |
| **`Site Properties`** → opens the `site` note | **Settings › Site** (his answer 2: *Site goes into Settings*) |
| **`Panelizer`** → opens the `panelizer` note | **Settings › Panelizer** (his words) |

#### 3. `Site Properties` note (`siteContent`, `page.tsx:6201-6293`) → Settings › Site

Every control, in order: `Project name` · `Zip code` · `Seismic zone` (with the braced-PANEL-vs-braced-LINE spacing note and `bracedWallLineSpacingStatus.note`) · `Foundation type` (with the slab/pier guardrail that clears `floorSystemId`) · `Pier spacing` *(only when `usesPierGrid`)* · `Ground screw product` button group + the selected product's spec paragraph + `groundScrewProductsStatus.note` *(only when `foundationTypeId === "ground-screw"`)* · the foundation `vaporNote`, styled `pending` when `status === "pending-BI-confirmation"`.

**⚠ Two things to carry, not re-type.** `seismicBracedPanelSpacingFt`, `bracedWallLineSpacingFt`, `groundScrewProducts` and every `foundationTypes` entry are catalog values with `status`/`note`. **They move by reference or they do not move.** And `Project name` is arguably a *Projects* field rather than a *Settings* field — it names the cloud project and prints in every `SheetTitleBlock`. Small, real, and his list does not cover it → Open Item.

#### 4. `Panelizer` note (`panelizerContent`, `page.tsx:6304-6727`) → Settings › Panelizer

Every control, in order: the keyhole prose · **Scope of work** checkboxes `Floors` `Walls` `Roof` `Foundation` (with `isLastEnabledScopeBranch` refusing to uncheck the last one, `LAST_SCOPE_BRANCH_TITLE` on hover) · **Floor type** group *(when `floorsEnabled`)* · **Roof system type** group *(when `roofEnabled`)*, including the note that gable panels/beam is now a per-wall Elevation toggle · `Standard width (in)` · `Thickness` `<select>` over `looseDensePackThicknessOptionsIn` · `Target density (lb/ft3)` · `Wall height` + the *"Default 10ft (120in) is Panel Set 1's confirmed standard panel height"* note · `Max panel height (in)` + the auto-split note · `Include exterior nailer` checkbox · **Jack stud construction** group · **Panelization type** group (3 types) · **Default bracing style** group · **Square bale stud configuration** group *(conditional; the Square Bale button also locks `Thickness` to the bale's fixed dimension)* · **Timber frame curtain panel type** group *(conditional)*.

**Contents unchanged. Position only.** Same reference-not-retype rule as above: `looseDensePackThicknessOptionsIn`, `targetDensityKgM3`, `fabricationMinPanelWidthIn`, `panelWidthInRange` and the Square Bale constants all stay exactly where they live.

#### 5. `Role: ▾` note → the Account menu

| Item | Lands |
|---|---|
| The prose line *"Changes which disclaimer prints; it is not a permission."* | Account menu, **kept and made prominent** — it is the only thing on screen that separates the two axes |
| Four role options from `roleOptions`, each rendering `roleDisclaimers[r].label` and **`roleDisclaimers[r].text` verbatim** | Account menu, verbatim |
| The collapsed control's `title={roleDisclaimers[role].text}` | Whatever the Account menu's role group collapses to keeps it |

**⚠ `roleDisclaimers` strings are the app's legal posture. They may be relocated; they may never be reworded.** That is a standing constraint (Top Bar & App Chrome section, footer rules) and this workstream does not touch them, does not re-wrap them, and does not shorten them to fit a menu. `AppFooter` and `SheetTitleBlock` keep rendering them by reference, so no printed or footer disclaimer changes.

**What else depends on the Role control being top-level — checked, and the answer is one thing:** `settingsMenuHasAdminGroup(role)` gates the Settings menu's Admin Options group, and `role` gates which Detail Guide / Shop Drawing pages exist at all (`relevantDetailPages` excludes fabricator pages when `role === "public"` and adds Assembly Performance only for `engineer`). **So changing role changes what is in Print and Summary.** Nothing breaks, but a role switch buried one level deeper now silently changes the sheet list — worth a line in the menu, and worth a harness assertion (§11).

#### 6. `⚙ Settings` note today → Settings

| Item | Lands |
|---|---|
| `UnitSystemSwitch` — Imperial / Metric, display-only by explicit decision | Settings (unchanged) |
| `Admin Options` → `Show All Detail Pages` checkbox + its note, gated `role !== "public"` via `settingsMenuHasAdminGroup` | Settings (unchanged, same gate) |
| *(new)* Site · Panelizer · Single Wall Run | Settings, per §3, §4 and §8 |

#### 7. The view dial → **Design** and **View** (his answer 1)

`ViewerDial.tsx` is **one** dial with five stop kinds. Splitting it is the substance of the first build stage.

| `ViewerStop` kind | Label today | Lands |
|---|---|---|
| `plan` | `2D Floor Plan` | **Design › Plan View** — ⚠ two names for one thing, see below |
| `elevation` (one per `footprint.walls`, in footprint order) | `Elevation: AB` | **Design › Elevation: AB** … one entry per wall |
| `3d-framed` | `3D Framed` | **View › 3D Framed** |
| `3d-boxes` | `3D Boxes` | **View › 3D Boxes** |
| `3d-wraps` | **`Membranes`** | **View › Membranes** |
| The dial's scroll-wheel cycling + `useRustleSound()` on every step | — | **⚠ LOST if the dial is simply replaced by two menus.** See §9 — this is exactly the kind of row that disappears quietly |
| `disabled={editorTab !== "wall" || !footprint}` | — | Open Item: what Design/View do on the Floor/Roof/Foundation tabs |

**⚠ Two recorded decisions live in `ViewerDial.tsx`'s doc comment and neither may be silently discarded:**

1. **`"3D Wraps"` was renamed to `Membranes` at Tommy's request; the internal stop kind `"3d-wraps"` was deliberately left unchanged.** The user-facing word is `Membranes` and the internal key is `3d-wraps`. Do not "tidy" either half.
2. **The stop order is his: plan, then each wall's elevation in compass order, then the 3D modes** — *"cycle the wall view options… starting at the top and going clockwise, and the wheel moves onto 3D views."* The split must preserve that order **within** each menu; it is why Design lists Plan View first and View lists Framed → Boxes → Membranes.

**⚠ `2D Floor Plan` vs `Plan View`.** His example writes `Plan View`, the dial says `2D Floor Plan`, and the printed sheet id `detail-plan-view` is already labelled `Plan View`. **Recommendation: one name, `Plan View`, everywhere** — it matches his words and the existing sheet. It is a visible string change he did not explicitly ask for, so it is a (small) Open Item rather than a decision taken here. Note the dial's `title` attribute enumerates all five labels and changes with it, **and the existing Smearforn harnesses locate the view dial by these strings** (§11).

**One writer, two presentations.** `handleViewerStopChange` (`page.tsx:1848-1862`) is the only thing that writes `elevationViewWallId`, `viewMode`, `simplified3D` and `showWraps`, and `currentViewerStop` (`:1839-1847`) is the only thing that reads them back. **Both new menus call the same function with their own subset of `viewerStops`, and `currentViewerStop` stays the single source for which menu is the owner.** No second copy of that state machine — the same rule `editorTabs.ts` already enforces for the nav and the tab dial.

**This split also decides what the left sidebar shows,** because Region 3's content keys off exactly those flags: `elevationWall` → `elevationControls`; `viewMode === "3d" && showWraps` → `wallAssemblyControls`; `viewMode === "plan"` → the toolbar portals + `DrawingToolPen` + `PanelLegend`; `viewMode === "3d"` → the Orbit / Edit / Sill & Header group. **Nothing about Region 3 changes if the writer stays single.** That is the main reason this split is cheaper than it looks.

#### 8. The right sidebar — every occupant, and where each goes

**"Get rid of the right side bar" means deleting `SectionCarousel` (a `position: fixed` 170px strip spanning `--topbar-height` to the bottom edge) and `page.module.css`'s matching `.editorRightSpacer` (170px of reserved flex space).** The canvas gains 170px. Here is everything in it:

| Occupant (source) | Lands |
|---|---|
| **Header slot** `Export PDF (n)` button → `handleExportSelectedPdf` (opens whatever is unopened, marks `data-print-target`, prints, restores prior open state) | **Print** |
| **Header slot** `Choose sections ▾` picker — a checkbox per `exportableSections` = `Project Summary` + every `relevantDetailPages` entry; `manualExportIds` is `null` until touched, then stops tracking `openNoteIds` | **Print** — this is the seed of the "customization editor" (§10) |
| **Header slot** `Page size` `<select>` — `Letter (11x8.5in)` / `Tabloid (17x11in)` (`printPageSizeId`) | **Print** |
| **Section cards** `allNoteSections` = `Project Summary`, `Project Totals`, `Review Log`, then every `relevantDetailPages` entry | Split: Summary / Print / the Review Log icon — see §9 |
| **Card colour coding** — shop-fab pages (`id` starts `shop` or `detail-box-beam`) light green / purple outline; rough-opening pages (`detail-door-ro`, `detail-window-ro`) light blue / blue border; both his explicit requests | **Carried into Print's sheet list.** A colour that encodes "this is a fabricator sheet" is closer to a drawing semantic than to chrome; it does not get re-skinned away |
| **Footer slot** `Single Wall Run Calculation Sandbox →` (`/sandbox`) | **Settings** (his answer 3 — *one destination, nothing free-floating*) |
| **Footer slot** `Read Me →` (`/read-me`) | **Left bar icon** (§9) |
| **Footer slot** `Report Bug / Request Feature →` (`/report-bug`) | **Left bar icon**, as a sticky note (§9) |
| `.editorRightSpacer` 170px layout reservation | Deleted; the canvas takes the width |

**⚠ `170px` is one of the three Stitch tokens that were already this app's own numbers** (`tray-width: 170px` = `SectionCarousel.module.css` = `.editorRightSpacer`). Deleting the tray retires that token's consumers; the Stitch mockups' part-2 tray no longer describes this app. Record it so nobody "restores the tray to match the mockup" later.

#### 9. Sticky notes and sections today → Summary, Print, or an icon

`allNoteSections` is the carousel's list; `formalDocumentNoteIds` is the subset the packet covers (`Project Summary` + every `relevantDetailPages` entry — *not* the live editing panels).

**Tommy's Summary list is six items. There are far more than six sections. That gap is the whole "nothing is lost" risk, so it is enumerated exhaustively.**

| Section id | Label | In his Summary list? | Lands |
|---|---|---|---|
| `detail-summary` | Project Summary | **yes** | **Summary** (and stays a printable) |
| `project-totals` | Project Totals | **yes** | **Summary** (not a printable today — excluded from `formalDocumentNoteIds` — but has its own 🖶) |
| `review-log` | **Review Log — Items for Engineer/Contractor Review** | no | **Its own left-bar icon — DECIDED 2026-09-26, see §9a** |
| `detail-material-totals` | Material Totals | **yes** | **Summary** + Print |
| `detail-shipping` | Shipping | **yes** | **Summary** + Print |
| `detail-plaster-master` | Plaster Master | **yes** | **Summary** + Print |
| `detail-door-ro` | Door Rough Opening | **yes** | **Summary** + Print |
| `detail-window-ro` | Window Rough Opening | **yes** | **Summary** + Print |
| `detail-assembly-performance` | Assembly Performance *(role `engineer` only)* | **no** | **Print.** ⚠ It is the engineer's own reference card — permeance plus the confirmed straw target moisture. Losing it for the one role that needs it would be a real loss |
| `detail-foundation` | Foundation: *«type»* | no | Print |
| `detail-floor` | Floor: *«joist type»* | no | Print |
| `detail-floor-assembly` | Floor: Full Assembly | no | Print |
| `detail-floor-corner` | Floor: Corner & Perimeter Sequencing | no | Print |
| `detail-floor-addon` | Floor: Perpendicular 2x4 Add-On Layer | no | Print |
| `detail-bale-foundation` | Floor: Bale Foundation | no | Print |
| `detail-floor-thermal-slab` | Floor: Thermally Broken Slab | no | Print |
| `detail-truss-plate` | Roof: Truss Plate *(Single-Story)* | no | Print |
| `detail-roof-truss-layout` | Roof: Truss Layout | no | Print |
| `detail-box-beam` | Box Beam | no | Print |
| `detail-plan-view` | Plan View *(the printed sheet, not the editor view)* | no | Print |
| `shop-jack-stud` | Shop Drawing: Jack-Stud *(preview-only; `role !== "public"`)* | no | Print |
| `shop-fab-*` | Panel Fabrication: *«type» «width»in («n» copies)* — one per `panelFabricationGroups` entry | no | Print |
| `shop-fab-*` | Panel Fabrication: roof-bearing groups — one per `roofBearingFabricationGroups` entry | no | Print |
| `shop-fab-*` | Panel Fabrication: Box Beam / Big Header (Mid-Wall Beam) — one per `midWallBondBeamFabricationGroups` entry | no | Print |
| `selected-panel` | `Panel: «wall» #«n» — «type»` — **docked, selection-driven, not in the carousel at all** | n/a | **Stays exactly where it is**, bottom of the left bar above the `?` (his own placement request) |

**The rule that resolves the overlap, stated so it is not improvised:** **Summary is a reading surface; Print is a packet-assembly surface. A section may appear in both, and `formalDocumentNoteIds` membership is what makes it printable.** Five of his six Summary items are already printables; that is not a conflict, it is the same content reached for two purposes.

**Also carried, or it is lost:**

- **The per-note 🖶 print button** and `handlePrintNote` (`data-print-mode="page"` + `data-print-target`) — 27 call sites today, including `project-totals` and `review-log`, which the packet does **not** cover. **The only way to print the Review Log today is that button.**
- **`fullscreenNoteId`, `noteOpenOrder`, the cascade offsets, and note dragging** — a full-page Summary makes fullscreen-a-note meaningless *for the sections that move into it*, and irrelevant for the rest. **But `selected-panel` still uses `isFullscreen`,** so `StickyNote`'s fullscreen path stays.
- **`?openNote=<id>` deep linking** (`page.tsx:5810-5815`) — the `/report-bug` page links `/?openNote=review-log`. **That link must keep working** after the Review Log becomes an icon.
- **`cloud.notes`** — the save dialog, Open from cloud, and the save notice. Chrome, never printed, unaffected by any of this.

##### 9a. The left bar's bottom cluster — DECIDED 2026-09-26

Tommy, 2026-09-26:

> *"Let's make a cute fat outline of a log icon with the word review on it (review log lol) and add that near the ? On the bottom left."*

> *"Report bug / feature request backend sounds like a great idea. Right now it goes to a note that is easy enough right now - referring people to email me. Let's consider backend improvements to that as a flagged thing to do later. For now, can we add a cute outline of a bug that opens up a sticky note with the current page contents on it?"*

**So the bottom-left cluster becomes four icons, in the same outline style as the existing `?`:**

| Icon | Opens | Note |
|---|---|---|
| `?` | `PageFeaturesButton` — the per-tab `pageFeatures` list | Already built. Unchanged, still bottom-pinned by `marginTop: auto` |
| **Review** — *"a cute fat outline of a log icon with the word review on it"* | The **Review Log** section | **This closes the gap this plan flagged.** Safety-relevant output now has its own front door in the chrome, not a slot inside Summary or Print |
| **Bug** — *"a cute outline of a bug"* | A **sticky note** carrying the existing report-bug content **plus the current page's name** | Backend deferred — see the flagged item below |
| **Read Me** — *"its own cute little icon"* | The **Read Me** content | §9b on why a note rather than a navigation |

**Why the Review Log icon is the right answer and not just a convenient one.** The Review Log is `toReviewLog()`'s output — *"Items for Engineer/Contractor Review"* — which is where every `pending-BI-confirmation` value and every sub-minimum panel width surfaces. **Flags-check point 5 requires that gaps surface where a human reviewer expects them.** A section reachable only by scrolling a 170px strip that is about to be deleted was already the weak link; giving it a permanent icon strengthens point 5 rather than merely relocating it.

**The bug note — two hard constraints.**

1. **The existing wording is preserved verbatim.** `/report-bug/page.tsx` already exists as a real route: a heading, an attribution line, two sections (*"Found a bug or glitch?"* / *"Have an idea for a feature?"*) each with a numbered ask and a `FOR EXAMPLE:` block, a closing *"Please include the date noticed/idea conceived and send to:"* line with a `mailto:` address that **is already in the file**, and two links (back to the editor, and `/?openNote=review-log`). **Reuse that content by reference; do not rewrite, tighten or "improve" it, and introduce no address that is not already there.** The `Review Log` link inside it should now point at the same surface the new Review icon opens.
2. **The page context must be honest, and it is not telemetry.** *"a sticky note with the current page contents on it"* is read as: **the note names the view the user was on when they opened it**, so the email he receives has context. Name it **as the app itself labels it** — the active `ViewerStop` label (`Plan View` / `Elevation: AB` / `3D Framed` / `3D Boxes` / `Membranes`), the active editor tab from `EDITOR_TAB_LABEL`, and — once they exist — `Summary`/`Print` when one of those owns the surface. **No version string, no user agent, no viewport dump, no diagnostic payload, no auto-send.** He asked for a note, not a reporter. *(If he meant only "the note as it currently reads", dropping the context line is a one-line change.)*

**FLAGGED FOR LATER — a report-bug/feature-request backend.** His words: *"Let's consider backend improvements to that as a flagged thing to do later."* Recorded here in the same style as the buck window and the SketchUp/DC export: **a decided deferral, not an open question.** What a later decision would need to answer, so that it is informed when it happens: **where a report goes** (a table, an email relay, or an issue tracker); **whether it needs its own table with RLS** — and if so, that every existing RLS pattern here is company-scoped while a bug report is not obviously a company's property; **whether the reporter's identity is attached**, which is a privacy question and not a schema one, and which interacts with the fact that reports can arrive from signed-out guests; and **whether anything from the project state travels with the report**, which would make a bug report a data export and put it straight into the redaction model's territory. **None of that is designed here and nothing in this workstream touches `supabase/`.**

##### 9b. Read Me and the bug note: notes, not navigations — and the reason is a real hazard

**Both `/read-me` and `/report-bug` are Next routes today**, linked from the tray footer. **There is no `localStorage` or `sessionStorage` anywhere in `apps/web/app` — verified by search, zero matches.** So **navigating to either route and coming back loses the entire in-memory design** unless it was saved to a file or the cloud first.

**That hazard exists today.** But this pass (a) deletes the tray those links live in, and (b) promotes them to always-visible icons in the editor chrome — i.e. makes them *more* likely to be clicked mid-drawing. **Recommendation: render both as sticky notes inside the editor, reusing the routes' content, and keep the routes in place** for direct linking and for printing. That is also exactly what Tommy asked for on the bug icon, so it is consistent rather than inventive.

**⚠ Two things in the Read Me content to handle, not flatten:** it carries a **liability statement** (*"anything coming from this app that you want to produce is your liability"*) — legal-posture text in the same family as `roleDisclaimers`, so **verbatim, never reworded** — and a **Venmo QR `Image` plus an "Open as PDF" link**. A QR code that renders too small to scan is a broken feature, so if Read Me becomes a note the QR needs the note's fullscreen path or its existing PDF link, whichever is verified to scan. *(Read Me as a note rather than a navigation is a recommendation, not something he said — Open Item.)*

#### 10. The left bar today, in full

`page.module.css`'s `.editorSidebar` — 240px, narrowing to 64px at ≤600px — in its documented four regions:

| Region | Contents | Lands |
|---|---|---|
| top | Load-error paragraph (`loadError`) | Unchanged |
| **1** (fixed height, deliberately) | `ViewerDial` + the OS-fullscreen `⤢`/`⤡` button | **⚠ The dial is the below-breakpoint form of Design/View — see §5. The fullscreen button stays** |
| **2** (fixed) | `EditorToolbar` → `EditorTabDial` (below 1200px only) | Unchanged; it is still the below-1200px form of the tab nav |
| **3** (varies) | `elevationControls` · `wallAssemblyControls` · `foundationControls` · `baleFoundationControls` · `floorToolsControls` · `roofTrussControls` · `roofToolsControls` · plan mode's toolbar portal + `DrawingToolPen` + secondary portal + `PanelLegend` · 3D mode's Orbit / Edit / Sill & Header group | **Unchanged — and that is a finding, not an assumption: Region 3 keys off `elevationWall` / `viewMode` / `showWraps`, which the Design/View split preserves exactly** |
| **4** (bottom-pinned) | the docked `Selected Panel` note + `PageFeaturesButton` (`?`) | Unchanged, **plus the three new icons** (§9a) |
| canvas overlays (not sidebar) | `CompassWidget` in `.compassDock`, `PanelLegend variant="overlay"` in `.legendDock` | Unchanged |

**⚠ Region 1's "height never varies" property is load-bearing** and was fixed deliberately once already. If the dial leaves Region 1 at ≥1200px the region's height changes **at a breakpoint rather than during use**, which is the same trade already accepted for `EditorToolbar` — acceptable, and it must be stated in the code rather than discovered.

#### 11. The label pattern — the precise rule

**What "look like the Acting As button" means, read off the CSS rather than guessed.** `AccountControl.module.css`: `.actingAsLabel` is **11px / 600 weight / `text-transform: uppercase` / `letter-spacing: 0.01em` / `--bi-on-surface-muted`** (his "all caps dark grey"), and the value is **13px / 600 / `--bi-on-surface`** (his "black"). **Reuse those two type treatments.** Do **not** reuse the rest of the control: the acting-as value is a `<select>` inside a bordered chip, whereas Design/View/Summary/Print are buttons that open `StickyNote` menus. **Take the typography, not the chip and not the select.**

**The owner rule — stated precisely, because his example implies it without stating it:**

- **Exactly one of Design / View / Summary / Print owns the editor surface at any moment.** Ownership is derived, never stored twice: `Design` owns when the surface is the drawing and `currentViewerStop.kind` is `plan` or `elevation`; `View` owns when it is `3d-framed`, `3d-boxes` or `3d-wraps`; `Summary` and `Print` own when their full page fills the editor.
- **The owner renders two parts:** `LABEL` in the caption treatment, then the current value in the value treatment, Title Case. **The other three render the bare word** in the ordinary control treatment.
- **So his two examples come out exactly as he wrote them:** `DESIGN Plan View · View · Summary · Print`, and after choosing 3D Framed, `Design · VIEW 3D Framed · Summary · Print`.
- **Summary's value is the summary section being read** — `SUMMARY Material Totals`. Summary opens on `Project Summary`, so there is always a real section label and **no default word has to be invented.**
- **Print shows no value, even when active.** He never gives Print one, and Print is one editor rather than a set of pages you are "on". It is marked active the way the nav tabs already are: **navy text plus a 2px underline, never by weight**, so switching never changes the bar's width. *(Stated as the reading; low-risk, worth one word from Tommy.)*

**⚠ The menu-contents sentence has two readings and only one is usable.** *"Each of these three drop down buttons along with print will only show the current page under it's button menu."* Read literally, a menu would list exactly one item — the page you are already on — which makes it impossible to change page. **Rejected on that ground.** The usable reading, and the one his own example supports (*"View and Summary just show view and Summary"* is about the **bar text**): **each menu lists its own stops and only its own stops, with the current one marked; the two-part LABEL+Value treatment appears on the bar only for the menu that owns the active page.** That is what "only show the current page under its button" is describing — the bar, not the menu body.

#### 12. ⚠ The width budget is already spent — the riskiest assumption in this plan

**His bar is twelve controls. The current bar needed a third breakpoint to fit six.** From this log's own measurements:

- At **768px**, Stage 1's bar (no wordmark, no nav) needed 694px in a 728px row — **34px spare**.
- The wordmark (132px) plus four tabs (~250px) is roughly **380px** more, which is **why the nav sits at 1200px and not at `md`** — Tommy's own 2026-09-13 decision, made because the only place that width could have come from was the acting-as company name, which the Stage 1 fix exists to protect.
- At exactly 1200px with all four tabs and four companies, the nav measured **254px** and the company name **270px**, with the bar fitting and little to spare.

**Design + View + Summary + Print add four more controls, one of which carries a two-part label up to the width of `Elevation: AB` or `3D Framed`.** On those recorded figures that is plausibly another **350–400px**, i.e. a bar wanting **~1550–1600px**. **No number here is measured — that is the point.** **And Tommy's own everyday viewport is 710px**, where today the nav and wordmark are already shed and `EditorTabDial` is doing the job.

**So: the twelve-item bar cannot exist at his own width, and it is not yet known to exist at 1200px.** Two consequences, both structural:

1. **Measurement comes first, in the same headless-Chrome way the 1200px breakpoint was established** — at 360, 710, 768, 1200, 1440 and 1600, signed out and with four companies, every role, every scope combination. **The measurement is a deliverable of the first stage, not a follow-up.**
2. **The shed order must be extended, and the existing one is not negotiable:** the acting-as company name, the file menu, the role control and Settings are **never shed at any width**, and *"truncated but present beats absent"* is the entire lesson of the 2026-09-13 bug. **Recommendation: Design/View/Summary/Print shed together into the left sidebar below the breakpoint, exactly as the tab nav already sheds into `EditorTabDial` — and the sidebar's existing `ViewerDial` is already the Design+View form of it.** One shared definition, two presentations, one CSS condition (not an opposed pair — a fractional viewport width under browser zoom fails both), never both and never neither. That also **keeps the scroll-wheel and the rustle sound alive at Tommy's own width**, which is the §7 row that would otherwise vanish.

**⚠ Do not invent a fourth breakpoint casually.** The bar has 1200 and 768 plus a 360px floor, written in one commented block in `TopBar.module.css`, and this log has an explicit "do not invent a fourth number" rule. If the measurement says the new group needs its own width, **that is a decision for Tommy with the measurement in hand**, the same way 1200px was.

#### 13. Summary and Print as full pages, with the edit tabs still live (his answer 4)

His answer: **Summary and Print fill the editor, and Walls/Floor/Roof/Foundation stay visible and clickable — clicking any of them returns you to the drawing. Not a modal mode.**

**What that requires of state, established by reading where the state lives:**

- **Add one piece of state — the editor surface: `"drawing" | "summary" | "print"`.** Nothing else moves. `editorTab`, `elevationViewWallId`, `viewMode`, `simplified3D`, `showWraps`, `viewedStoryId` and `selectedSlot` all stay in `page.tsx` and are not touched by opening Summary or Print, so returning restores the exact view — **including the current wall and the current story.**
- **⚠ But the drawing must be HIDDEN, not unmounted, and here is the concrete reason.** `FootprintCanvas` holds `viewOffset` and `viewScale` (pan and zoom), `showPanelLabels`, and the whole measuring-tool state **in its own component state**. `Building3DView` holds its camera the same way. **Unmounting the editor to show Summary silently resets the user's pan, zoom, label toggle and 3D camera** — a "nothing is lost" failure that no unit test would catch and that looks like a glitch rather than a bug. Lifting that state into `page.tsx` is the alternative and is much larger. **Hide it.**
- **Clicking an edit tab sets the surface back to `"drawing"` and sets `editorTab` in one action.** That is his "clicking any of them returns to the drawing", and it needs no new mechanism.
- **The four tabs stay visible while Summary/Print own the surface** — so the bar's tab group is not conditional on the surface.

**⚠ This collides with the keyhole, and the collision is real.** `editorTabsInScope(enabledTabs)` makes a ruled-out tab **absent** from the nav, by explicit decision (*"A ruled-out tab is absent from the nav"*), and **Smearforn Stage 0 turned Floor and Foundation OFF by default** — *"I would like the turn off the floor and foundation tools as default for now… This setting should still be visible, but perhaps it's somewhere in settings."* **So on a brand-new project today, two of the four tabs he lists do not exist on the bar.** Three possible readings, and this plan takes none of them on its own authority:

- (a) **Keep the keyhole.** The bar shows only in-scope tabs; his list describes the all-checked case. Smallest, changes nothing, and stays consistent with an existing decision.
- (b) **Always show all four**, and clicking an out-of-scope tab turns that scope branch on. Matches his list literally, but makes the tab bar a second writer of the Panelizer's scope state.
- (c) Always show all four, out-of-scope ones inert — **rejected here**, because "shown and inert" is the exact thing the existing decision rejected.

**Recommendation: (a), because it preserves a decision already taken and his answer 4 was about Summary/Print not stealing the tabs, not about the keyhole.** → **Open Item.** *(And note the Panelizer's scope checkboxes are what would drive (b), which is another reason the Panelizer belongs somewhere findable — §0.)*

#### 14. Print — what exists, and what a "fleshed out printing customization editor" is

**What exists today, in full:** the three tray-header controls (`Export PDF (n)`, `Choose sections ▾` over `exportableSections`, `Page size` Letter/Tabloid), the per-note `🖶` button on 27 sections via `handlePrintNote`, `openDetailPageIds` / `manualExportIds` / `effectiveExportIds` (default = "whatever is currently open", until the user touches the picker, after which it is an explicit set), the open-print-restore dance in `handleExportSelectedPdf`, the last-target marking that makes the packet's "no page break after the final section" rule work, `SheetTitleBlock` on the formal sheets, and `showAllDetailPages` (admin/fabricator) which widens the sheet list.

**Print's content is therefore already specified: it is `exportableSections` plus those three controls plus the per-sheet print button.** That part is a relocation and is fully spec'd by the inventory above.

**"Customization" is the least specified part of his whole request, and this plan says so rather than designing it.** What it plausibly covers, offered as a menu of candidates for him to choose from and **not** as a design: **which sheets** (already exists — `Choose sections`); **what order** (does not exist; sheets print in `relevantDetailPages` order, which is derived from what the design contains); **per-sheet options** (page size is global today, not per sheet); **a cover sheet / packet title**; **and the numbered continuation sheets that are already decided-but-not-built** — *"each continuation page is a real framed sheet with its own title block, numbered 'Sheet 2 of 3'"* — which is where the known page-overflow problem lives (Shipping, Plaster Master and Project Summary each run 1–2.5 pages over on any page size).

**⚠ Recommendation: Print ships as a full page holding exactly today's controls (stage U5), and the customization editor is its own later stage with its own plan (U6).** Two reasons: he described it in one clause, and the honest print blocker is pagination, not the picker — *"pagination is still unconfirmed: page breaks, fragmentation, and the packet blank-page fix are only observable in a real print preview."* **A customization editor built on top of unverified pagination would let a user arrange sheets that do not paginate.**

### Staged build order — smallest first, riskiest assumption tested earliest

| Stage | What it is | Independently shippable? | What it proves |
|---|---|---|---|
| **U0** | **The left-bar icon cluster, and Single Wall Run into Settings.** Read Me, Report Bug (as a note, with the current-view line) and the Review Log icons beside the `?`; the sandbox link moves into Settings. **The tray stays**; nothing about the top bar changes. | **Yes — and this is the recommended early slice.** | That the cluster reads as a cluster at 240px and at 64px, and it gives the **Review Log a permanent front door before anything is deleted.** |
| **U1** | **The label pattern + the Design/View split, WITH the measurement. ⇦ THE "PROVE THE NAVIGATION MODEL WORKS" STAGE.** Two bar menus over one `handleViewerStopChange`; the LABEL+Value owner rule; the sidebar keeps `ViewerDial` below the breakpoint; **the shed order measured and published** at 360/710/768/1200/1440/1600 × four companies × four roles. No content moves; Summary and Print are not yet pages. | Yes. | **The riskiest assumption in the plan: that twelve controls can share this bar without re-creating the 2026-09-13 overflow bug.** It is tested here, cheaply, before four sections depend on it. If it is false, it is false here, and the answer is a decision for Tommy with numbers in hand — not a workaround invented mid-build. |
| **U2** | **Account absorbs Acting As and Role.** Two labelled groups in the account note; `roleDisclaimers` verbatim; the acting-as company **still legible on the bar** per §4's resolution. | Yes. | **Blocked on Tommy's explicit sign-off** — it reverses a documented safety decision (Open Items). |
| **U3** | **Settings absorbs Site and Panelizer.** Straight relocation of `siteContent` and `panelizerContent`; catalog values move by reference. | Yes. | Answers *"where is it?"* permanently, and puts the keyhole one level deep instead of two. |
| **U4** | **Summary as a full page.** The `editorSurface` state; the drawing **hidden, not unmounted**; the four edit tabs stay live and return you to the drawing; his six sections plus the rest per §9. | Yes. | That leaving and returning preserves pan, zoom, the selected wall and the story — the thing §13 says a naive implementation breaks silently. |
| **U5** | **Print as a full page, and ONLY NOW is the right sidebar deleted.** Every printable, `Export PDF`, `Choose sections`, `Page size`, the per-sheet `🖶`, the card colour coding; `SectionCarousel` and `.editorRightSpacer` removed; canvas gains 170px. | Yes. | **The tray is the safety net until here.** Nothing can become unreachable in an intermediate stage, because the old door is still open in every one of them. |
| **U6** | **The printing customization editor.** Sheet order, per-sheet options, cover sheet — **its own plan when reached**, and it wants the numbered-continuation-sheet pagination under it first. | Yes, and it must be. | Least specified part of the request; see §14. |

**U0 → U1 is the spine, and U5 is the point of no return.** U2, U3 and U4 are each independently orderable between them. **U0 can ship on its own at any time, including before admin tooling finishes** — it touches no shared surface, and the Review Log's front door has value the moment it exists. **U2 cannot start without Tommy's answer.**

### How big is this, honestly

**Roughly all of Smearforn Stages 0–3 — on the order of a week of agent work — with U6 excluded.** Against the ring workstream's ~3× Smearforn, this is about a third of that. Breaking it down: **U0 is the smallest real slice in the plan** (a day or so); **U1 is deceptively mid-sized** because the measurement and the shed order are most of it, not the menus; **U2 and U3 are relocations** and are genuinely small *if* U2's decision has already been made; **U4 and U5 together are the bulk**, more than half the total.

**Is any of it riskier than it looks? Yes, four things, and they are the reason for the staging:**

1. **The failure mode is unreachability, and unreachability is silent.** No error, no wrong number, no failing test. This app has already paid for this class twice (`orderedWallCycle` drawing no floor framing; the account control 677px off-screen while its own comment claimed otherwise). **The inventory plus a reachability harness is the mitigation, and neither is optional.**
2. **The width budget is already spent (§12).** The bar needed a third breakpoint to fit six controls; his list is twelve. **This is the single most likely thing to stop the plan mid-flight**, which is exactly why U1 measures it before anything depends on it.
3. **The three existing Smearforn harnesses will break.** They locate the view dial and the editor chrome by the strings and DOM this pass rewrites — and this log's own Open Items record the lesson: *"a reader keyed to an incidental element fails on legitimate data, and it fails by returning nothing rather than by raising anything."* **Fixing those locators is in scope for whichever stage breaks them, not a follow-up**, or the repo loses the harnesses that caught what unit tests could not.
4. **Every stage touches `page.tsx`, which is ~10,300 lines and on which ESLint OOMs at the default heap.** `apps/web/AGENTS.md` governs: typecheck **both** projects, run lint from `apps/web` with the raised heap, and **measure a lint delta including severity-1 warnings** against the base commit, because this file carries pre-existing errors (94 as of 2026-09-25) and a raw total means nothing.

### How it gets verified — a reachability harness

**A reorganisation's real risk is unreachability, which is exactly what a browser harness can walk.** The three in-repo harnesses (`apps/web/harness/smearforn-stage-0-1/`, `-stage-2/`, `-stage-3/`) are the standard: a CDP session against a real dev server, checked-in `evidence.json` and screenshots, `record()` **throwing** when given no expectation, a non-zero exit on any false expectation, **and both outcomes measured rather than assumed.** A `ui-reorg` harness should meet that bar and assert:

- **Reachability is exhaustive and counted, not sampled.** From a cold load, every id in `allNoteSections` and every `exportableSections` entry is reachable, and **the number of reachable sheet ids equals `relevantDetailPages.length + 3`** — a count, so a silently dropped section fails the run instead of going unnoticed. Repeat **per role** (`public` / `fabricator` / `admin` / `engineer`), since role changes the sheet list, and with `Show All Detail Pages` both off and on.
- **Every inventory row has a click path.** Site Properties, every Panelizer control group, Single Wall Run, the Review Log, Read Me, the bug note, Project Totals, and each of Tommy's six Summary sections — reached, and screenshotted.
- **The bar fits, at every width.** Zero page and row overflow at **360, 710, 768, 1200, 1440, 1600**, signed out and with four companies, all four roles, all four scope branches; top bar exactly 56px; footer exactly 24px; the acting-as company **inside the viewport at every width** — the assertion the 2026-09-13 bug exists to make permanent.
- **Exactly one presentation of each control at every width.** One of {bar tab group, `EditorTabDial`}; one of {bar Design/View menus, sidebar `ViewerDial`} — never both, never neither, checked at 1199 and 1200 and under a fractional zoom width.
- **The owner rule renders exactly as he wrote it.** `DESIGN Plan View · View · Summary · Print`, then `Design · VIEW 3D Framed · Summary · Print`, read out of the DOM.
- **Return-from-Summary preserves the drawing.** Pan and zoom (read the canvas transform), the selected wall, the story, and the 3D camera are identical before and after a Summary → tab-click round trip. **This is the assertion that catches the unmount-versus-hide mistake.**
- **`?openNote=review-log` still opens the Review Log**, since `/report-bug`'s own link depends on it.
- **The `🖶` path still prints one section**, and `Export PDF` still restores the prior open state afterwards.

### Flags check — run against this plan

Per the 6-point discipline. **This plan introduces zero new `CatalogValue`s and zero real-world building numbers, and that is not a coincidence — it is the test of whether the plan stayed in its lane.** If a presentation change ever finds itself needing a dimension, a density, a fastener spacing or a price, something has gone wrong.

1. **Every real-world number in the diff carries a `status` and a `note`** — **there are none.** Every number in this section is a layout measurement (56px, 24px, 240px, 170px, 64px, 220px, 280px, 360/710/768/1200/1440/1600px) or a count of sections. Same argument the Top Bar & App Chrome section already makes for its own figures.
2. **Anything marked `confirmed` that is actually interpreted?** Nothing is being marked. **⚠ The live risk here is different and specific: Site Properties and the Panelizer are the two densest displays of flagged catalog values in the app** — `seismicBracedPanelSpacingFt`, `bracedWallLineSpacingFt`, `groundScrewProductsStatus`, the `foundationTypes` vapor notes, `looseDensePackThicknessOptionsIn`, `targetDensityKgM3`, `fabricationMinPanelWidthIn`, `panelWidthInRange`, and the *"Default 10ft (120in) is Panel Set 1's confirmed standard panel height"* note. **Both move wholesale into Settings. They move BY REFERENCE. Not one value, one note, one `status` or one `pending` style is re-typed, re-rounded or re-worded in transit.** A relocation is the easiest possible moment to silently retype a number, which is why it is written down as a rule rather than assumed.
3. **Notes trace to a source?** Every figure quoted is read out of the code or out of this log's own measurement records, cited in place.
4. **Structural figures using `PanelStructuralStatus` with no invented value?** None is touched. `STRUCTURAL_PENDING_NOTE` stays where it is; the Selected Panel note's Material Specs block (straw density, framing size) moves nowhere.
5. **Do the gaps surface in the review log?** **This is the point this plan actively improves.** The Review Log is `toReviewLog()`'s pending-value output and today it is reachable only through a 170px strip that this pass deletes. **It now gets its own permanent icon in the chrome (§9a), plus a kept `?openNote=review-log` deep link, plus a harness assertion that it is reachable in every role.** Nothing new reaches the Review Log and nothing leaves it.
6. **Is the code treating open decisions as provisional?** Yes, and two in particular: **the acting-as visibility reversal (U2) does not get built until Tommy answers**, and **the keyhole question (§13) does not get resolved by whichever branch is easier to code.** Also: `roleDisclaimers` and the Read Me liability text are **relocated, never reworded** — *"editing one is a legal change wearing a layout change's clothes."*

**Not in scope, explicitly, for any stage:** anything in `supabase/`, `apps/web/app/auth/**`'s session logic or `apps/web/app/cloud/**`; `PROJECT_FILE_VERSION`; the Privacy Policy and Legal Disclaimer documents; any wording in `viewerRole.ts`; any catalog value; the canvas, the drawing semantics, the member colours, the panel colour legend or the floor opacity bands; the *contents* of any tool section in the left sidebar's Region 3; the report-bug backend; the numbered continuation sheets; and **the printing customization editor beyond U5's relocation of today's controls.**

### Open Items — Top Bar & Navigation Reorganisation

- **⚠⚠ Hiding Acting As under Account reverses a standing safety decision, and it needs Tommy's explicit yes.** This log states it twice, with a reason rather than a preference: the acting-as company must be *"visible at all times, not buried in a menu,"* because the failure it prevents — **saving a project into the wrong company's folder tree — is silent, plausible, and noticed later by someone else.** The rejected-options list is even blunter: *"Absorbed into the ⚙ settings icon. Directly violates 'visible at all times, not buried in a menu.' Not a trade-off; a contradiction of a decision already taken. **Do not build this even as an interim.**"* His new instruction is *"hide the acting as: under the account drop down"*, which is the same move to a different menu. **Recommendation, which may be what he means anyway: move the SWITCHER into the Account menu while keeping the acting-as COMPANY NAME on the bar** — e.g. the Account button itself reads the company by name, so the chip's clutter goes and the safety property survives. That satisfies both his instruction and the decision. **If he wants the name gone from the bar entirely, that is his call to make knowingly, and it should be recorded here as a reversal with his reason, not slipped in as a layout tidy-up.**
- **⚠ Nesting Role inside Account puts the two role axes in one menu, which a prior decision forbids.** *"Permission lives in the identity zone, the viewer role in the presentation zone… They must never read as two levels of one thing"*, and the rejected right-end placement was rejected partly for making them *"two matched dropdowns."* **Putting one INSIDE the other is a stronger version of exactly that.** He asked for it, so the question is only how to mitigate: **two separately headed groups in the note, with the *"changes which disclaimer prints; it is not a permission"* line kept and given prominence.** Confirm that is enough for him.
- **Does the tab bar always show all four edit tabs, or does the Panelizer keyhole still hide out-of-scope ones?** §13. His list names all four; Smearforn Stage 0 leaves **Floor and Foundation off by default**, so a new project shows two. **Recommendation: keep the keyhole** (option a) — it preserves an existing decision, and his answer was about Summary/Print not stealing the tabs. Option (b), clicking an absent tab to enable its scope, is defensible but makes the tab bar a second writer of the Panelizer's state.
- **Does the twelve-item bar fit, and if not, what sheds?** §12. **Not answerable without measurement, and the measurement is U1's deliverable.** If it needs a fourth breakpoint, that is his decision with numbers in hand, the same way 1200px was. **Recommendation for the below-breakpoint form: the four new menus shed into the sidebar, where `ViewerDial` already is.**
- **Is `2D Floor Plan` renamed to `Plan View`?** His example says `Plan View`; the dial says `2D Floor Plan`; the printed sheet is already `Plan View`. **Recommendation: one name, `Plan View`.** It is a visible string he did not explicitly ask to change, and it changes the dial's `title` and the harness locators.
- **Does Print show a value on the bar when active?** He gives values for Design, View and Summary only. **Recommendation: no value; active styling only** (navy + underline, as the nav tabs already do).
- **Should the view dial's scroll-wheel cycling and its rustle sound survive at desktop width?** §7. The wheel and `useRustleSound` are dial-only affordances and are **lost if the dial is simply replaced by two menus.** The recommendation in §12 (dial survives as the below-breakpoint form) keeps them at Tommy's own 710px; whether the rustle should also play on a menu selection at ≥1200px is his call. *(This is also still the open question from 2026-09-13 — whether the tab dial should survive at desktop width at all.)*
- **Does `Project name` belong in Settings › Site, or in Projects?** It names the cloud project and prints in every title block, and it currently sits in Site Properties purely because that is where it was put.
- **Read Me as a sticky note, or as the navigation it is today?** §9b. **Recommendation: a note**, because there is no `localStorage` anywhere and navigating away loses an unsaved design — a hazard this pass makes more likely by promoting the link to an always-visible icon. If it stays a navigation, the QR and the liability text are unaffected; if it becomes a note, the **Venmo QR must still render large enough to scan**.
- **What do Design and View do on the Floor / Roof / Foundation tabs?** `ViewerDial` is `disabled` unless `editorTab === "wall" && footprint`. **Recommendation: mirror today's behaviour exactly** (the menus present but inert, with the reason in their `title`) rather than having a View selection silently switch the editor tab. Edge case either way: the Panelizer can rule Walls out of scope entirely, in which case Design and View have nothing to offer at all.
- **FLAGGED FOR LATER, not an open question: a report-bug / feature-request backend.** His words: *"Let's consider backend improvements to that as a flagged thing to do later."* What a later decision must answer is written out in §9a — where a report goes, whether it needs its own table and RLS (and that every RLS pattern here is company-scoped while a bug report is not obviously a company's property), whether the reporter's identity is attached (a privacy question, and reports can come from signed-out guests), and whether any project state travels with it (which would make it a data export and put it inside the redaction model). **Nothing in this workstream touches `supabase/`.**

### Handoff to the coder — U0 and U1 only

**⚠ U2 through U6 are NOT handed off.** U2 is blocked on Tommy's answer about acting-as visibility; U3 is specced but should follow U1 so it lands on a measured bar; U4 and U5 are specced above but are the bulk of the work and should be re-read against U1's measurements before starting; U6 needs its own plan and wants the numbered-continuation-sheet pagination under it.

**U0 — the left-bar icon cluster, and Single Wall Run into Settings.**

*Scope:* add three outline icons beside the existing `?` at the bottom of the editor sidebar — **Review** (a fat outline log with the word "review" on it), **Bug** (a cute outline bug), **Read Me** — and move the Single Wall Run sandbox link out of the tray footer into the Settings menu. **The tray stays. The top bar does not change.**

*Files likely affected:* `apps/web/app/page.tsx` (the Region 4 bottom cluster at ~8290 and ~8559; the tray `footer` slot at ~10368; wiring the Review icon to `handleToggleNote("review-log")`), `apps/web/app/TopBar.tsx` (the Settings note gains the sandbox link), a new small icon component or components alongside `PageFeaturesButton.tsx` (**inline SVG, not a webfont** — the existing `GearIcon` is the precedent and the reason is recorded: no network dependency, no FOUT, no licensing question), a new note component or notes reusing `/read-me` and `/report-bug` content, `page.module.css` if the 64px sidebar needs the cluster to wrap.

*Acceptance:*
- All four icons are visible and operable at **240px and at 64px** sidebar width, and at 360px viewport width, without overlapping the docked `Selected Panel` note above them.
- The Review icon opens the **Review Log** section, and `?openNote=review-log` still works.
- The bug note carries **the existing `/report-bug` wording verbatim**, including its existing `mailto:` address, **plus one line naming the current view** as the app labels it (the active `ViewerStop` label and the active `EDITOR_TAB_LABEL`). **No version string, no user agent, no viewport figures, no auto-send.**
- The Read Me surface carries its **liability statement verbatim** and a **scannable** QR (or its existing PDF link).
- Single Wall Run is reachable from Settings; **the tray footer link may be removed only once it is.**
- Each icon has a real `aria-label` **and** a `title` — the icon-only rule from the Top Bar section.
- `npx tsc --noEmit` clean **in both `apps/web` and `packages/geometry`**; `npx vitest run` green; **lint delta zero including severity-1 warnings**, measured per `apps/web/AGENTS.md`.

*Edge cases worth testing:* the 64px sidebar (does the cluster wrap or overflow?); a `Selected Panel` note open at the same time as an icon's note; the Review Log **empty** (no pending items) versus full; signed out; `role === "public"`, where the sheet list is shorter; the bug note opened from an elevation view, from 3D Membranes, and from the Roof tab — the context line must name each correctly.

*Explicitly NOT in U0:* deleting the tray; any top-bar change; the Design/View split; Summary or Print as pages; the report-bug backend; touching `supabase/`, `auth`'s session logic or `cloud/**`.

**U1 — the label pattern, the Design/View split, and the measurement.**

*Scope:* split `ViewerDial`'s stops into two top-bar menus (**Design** = Plan View + every wall elevation; **View** = 3D Framed, 3D Boxes, Membranes) rendering the LABEL+Value owner pattern; keep the sidebar `ViewerDial` as the below-breakpoint form; **and produce the width measurement and shed order as a checked-in artefact.**

*Files likely affected:* `apps/web/app/TopBar.tsx` and `TopBar.module.css` (two new menus, the two-part label treatment, the shed rules), `apps/web/app/ViewerDial.tsx` (its stop list is now filtered by the caller; **the `Membranes` label and the `3d-wraps` key both stay exactly as they are**), a new small module in the shape of `editorTabs.ts` holding the one shared definition of the stops and which menu owns which — so the bar and the dial can never disagree, `apps/web/app/page.tsx` (passes the two subsets; `handleViewerStopChange` stays the only writer), `apps/web/app/EditorToolbar.module.css` if the dial's breakpoint rule moves, plus the three `apps/web/harness/smearforn-stage-*/run.mjs` locators that read the view dial.

*Acceptance:*
- The bar renders **exactly** `DESIGN Plan View · View · Summary · Print`, and after choosing 3D Framed, `Design · VIEW 3D Framed · Summary · Print` — asserted from the DOM, not eyeballed.
- The caption uses the **same 11px/600/uppercase/`--bi-on-surface-muted`** treatment as `.actingAsLabel` and the value the same **13px/600/`--bi-on-surface`** as the acting-as value.
- **Exactly one** of {bar Design/View menus, sidebar `ViewerDial`} is present at every width, from one CSS condition — **checked at 1199, 1200 and a fractional zoom width**.
- Every stop reachable from the dial is reachable from the menus and vice versa, **including one elevation entry per wall**, in footprint order.
- Region 3 of the sidebar renders **identically** for every stop before and after the change — the direct test that the single-writer property held.
- **Zero page and row overflow** at 360, 710, 768, 1200, 1440 and 1600, signed out and with four companies, all four roles, all scope combinations, with the acting-as company inside the viewport at every one.
- **The measurement is checked in** (a harness `evidence.json`, as the Smearforn harnesses do) — not summarised in a commit message.
- Same gate as U0: both typechecks, `vitest`, zero lint delta including warnings.

*Edge cases worth testing:* no footprint drawn (the dial is `disabled` today — the menus must behave the same); `editorTab !== "wall"`; Walls ruled out of scope entirely by the Panelizer; a footprint with many walls (an octagon gives eight elevation entries — does the Design menu scroll?); a single-wall-run project; a two-story project, where the elevation stops are the same but the story selection is not; and browser zoom, which is what the single-CSS-condition rule exists for.

*The one thing most likely to be got wrong:* **introducing a second writer of the view state.** `viewMode`, `simplified3D`, `showWraps` and `elevationViewWallId` are four flags that encode five stops, and `handleViewerStopChange` is the only function that sets them consistently. Two menus each setting their own subset is exactly how `showWraps` ends up true on a plan view. **One writer, one reader (`currentViewerStop`), two presentations** — the same discipline `editorTabs.ts` already enforces for the tabs.

---

**→ `## Open Items`** — add these two lines to the doc's own global Open Items list:

- **⚠ Top bar & navigation reorganisation — two questions blocking a stage, and eight smaller ones**, in that section's own "Open Items — Top Bar & Navigation Reorganisation". The blocking pair: **hiding Acting As under Account reverses the "visible at all times, not buried in a menu" decision** (recommendation: move the switcher, keep the company name on the bar) and **nesting Role inside Account puts the two role axes in one menu**, which a prior decision forbids. Also open: whether the keyhole still hides out-of-scope edit tabs, **whether a twelve-item top bar fits at all** (unmeasured — U1's deliverable), the `2D Floor Plan` → `Plan View` rename, whether Print shows a value when active, whether the view dial's wheel and rustle sound survive at desktop width, where `Project name` belongs, whether Read Me becomes a note, and what Design/View do on the non-Wall tabs.
- **Report bug / feature request backend — FLAGGED FOR LATER by Tommy (2026-09-26), not an open question.** *"Right now it goes to a note that is easy enough… Let's consider backend improvements to that as a flagged thing to do later."* The near-term surface is a sticky note carrying the existing `/report-bug` wording verbatim plus the current view's name. What a later decision needs to answer is written out in the reorganisation section: where a report goes, whether it needs its own table and RLS (every existing RLS pattern is company-scoped; a bug report is not obviously a company's property), whether the reporter's identity is attached (reports can come from signed-out guests), and whether any project state travels with it — which would make a bug report a data export and put it inside the redaction model.
