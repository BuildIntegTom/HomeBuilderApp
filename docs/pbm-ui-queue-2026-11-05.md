# The PBM Inspo UI Queue — opened 2026-11-05, renumbered 2026-11-06

The B-queue is a FABRICATION queue: it makes the app cut the right parts. This
one is a different animal — it is about the app being usable by someone who is
not Tommy. Keeping them apart on purpose, because they trade off differently:
a fabrication item is wrong or right, a UI item is better or worse, and mixing
them means the arguable work keeps pre-empting the decidable work.

Source: `pbm-designer-teardown-2026-11-05.md`, his answers 2026-11-05/06.

⚠ **U1–U8 are now the BUILD ORDER, not the teardown's order** — his call,
2026-11-06: *"Can you switch the names so it's easy to keep in sequence?"* So
the number IS the queue position: do U1, then U2, and so on. The teardown
document still numbers things its own way, so this table is the bridge between
them. Nine teardown items became eight queue items, because templates and their
thumbnails are one piece of work.

| this queue | teardown § | item |
| --- | --- | --- |
| **U1** | 4 | A `← HIDE` tab for the left bar, and Reset View |
| **U2** | 8 | A named path: `Edit → View → Price → Print` |
| **U3** | 1 + 9 | Starter templates, with thumbnails that are real renders |
| **U4** | 6 | Props for scale |
| **U5** | 5 | A site around the building, as a toggle |
| **U6** | 2 | Dimension handles on the model |
| **U7** | 3 | A per-tool first-use tutorial |
| **U8** | 7 | Share a design by link |

---

## Status at a glance

| | item | his word | state |
| --- | --- | --- | --- |
| **U1** | HIDE tab + Reset View | yes | **BUILT 2026-11-06** — see the record at the end |
| **U2** | Named path, static arrows | **Edit → View → Price → Print** | **BUILT 2026-11-06 — and it made the bar 49px narrower** |
| **U3** | Starter templates + rendered thumbnails | *"brilliant"*, *"absolutely totally awesome"* | **STRIDE 1 BUILT 2026-11-07** — eight tiles, real buildings, real plan previews. The 3D render thumbnails are stride 2. |
| **U4** | Props for scale | yes | **BUILT 2026-11-07** — a 6-foot person, a car and a tree; default ON for Public, OFF for everyone else |
| **U5** | Site toggle | yes | **BUILT 2026-11-07** — sky, lawn, horizon and a real sun shadow; the ground plane is back as a switch and sits under the floor deck |
| **U6** | Dimension handles | *"genius move"* — 5 handles named | **BUILT 2026-11-07** — the resize seam, four roof bypasses closed, and FOUR of the five handles; the peak slider is built and held back behind a pre-existing crash |
| **U7** | Per-tool tutorial | yes — *"how would the remembering work?"* | **answered below; follows U2** |
| **U8** | Share by link | yes | **ready, but it is a sharing decision** |

Nothing here is blocked by anything in the B-queue, and nothing in the B-queue
is blocked by anything here. **The B-queue goes first** — his call, 2026-11-06.

**Why this order:**

- ~~**U1**~~ **DONE 2026-11-06.** An afternoon, and it makes every demo of
  everything below it better.
- ~~**U2**~~ **DONE 2026-11-06.** It was small and renamed two live buttons, so it had to precede U7, or
  the first thing a new user is taught is a button name that no longer exists.
- ~~**U3**~~ **STRIDE 1 DONE 2026-11-07.** The biggest single change to what a
  stranger sees, and it needed no new engine — his own dimensions produced
  his own roofs.
- ~~**U4**~~ **DONE 2026-11-07.** Before U5, because a 6 ft figure tells a
  client more than grass does — and it settled the role-default question U5
  also has to answer, in a shape U5 can copy.
- ~~**U5**~~ **DONE 2026-11-07.** It copied U4's tri-state unchanged, and U4's
  props gained shadows out of it.
- ~~**U6**~~ **DONE 2026-11-07**, seam first as planned. The seam found two more
  roof bypasses than the notes recorded, and the handles found a pre-existing
  crash that holds the fifth one back.
- ~~**U6** is front-loaded into a seam, not a UI — see its entry.~~ **It was,
  and it paid: the badges took a fraction of the seam's effort because every
  one of them commits through it.**
- **U7** once the names and the tools have stopped moving.
- **U8** last, because it is a sharing decision and not a UI one.

---

## U1 — A `← HIDE` tab for the left bar, and Reset View

Two single-afternoon wins. The 3D view fights the left bar for width; a hide tab
gives the model the whole screen for a client walkthrough. Reset View saves
every user who has orbited themselves under the floor — and the panel editor has
wanted one since B30, where the camera can be dragged until the panel is edge
on. **Cost:** tiny. **Risk:** none.

---

## U2 — A named path through the app — **answered 2026-11-05**

> *"I've been trying to kind of get at that with how the buttons are ordered and
> all always visible. Maybe... We can meld these ideas into basically how it is
> right now except with arrows between each button. I suppose with the autodraw
> a preplan one would start in 3D framed... Which is now titled View."*

Not PBM's wizard — the bar he already has, with the ORDER made visible. The bar
stays flat and always-available (every door open, `ui_overhaul_architecture`),
and arrows between the buttons say which way the work usually runs.

**His three answers:**

1. **The steps are `Edit → View → Price → Print`.** Note what he changed: not
   today's names (Design) and not my verbs (Draw it). **Edit** is the honest
   word for a door you come back to — you do not draw a building once and leave
   drawing behind, you edit it all the way to the shop. And **Price** replaces
   **Summary**, which named the page rather than the reason you open it.
   ⚠ This renames two live buttons: **Design → Edit**, **Summary → Price**.
2. **The arrows just sit there.** Static chevrons. No step is ever marked
   "done", nothing glows, nothing is clickable — so there is no state for the
   app to be wrong about, and no newcomer is told they have finished something
   they have not.
3. **A starter template lands you in View — the 3D framed model.** The template
   animates in and you are looking at a finished building. That is what ties U2
   to U3: the template puts you two steps along the path rather than at a blank
   canvas, and the path is there to tell you where you are.

---

## U3 — Starter templates, and their thumbnails are real renders

> *"6 prefabs include - Tiny House (16x24' shed roof with tall north wall), the
> Tank (24x48 gable roof), octagon (16' or 32' diameters sub options), Cindy
> (see buildinteg.com/cindy for floor plan), square courtyard octagon
> courtyard, or draw your own, log in OR (if logged in) open from cloud."*
>
> *"Number one's response would be so cool to see thumbnail models of that enter
> that building."*

Eight tiles: six prefabs, plus **Draw your own** and **Open from cloud** (which
reads *Sign in to open a saved design* when signed out — see
`backend_stage1_live`; Stages 0–4 are live, so the cloud half already exists).

| tile | what it is | what the app already has |
| --- | --- | --- |
| **Tiny House** | 16 × 24 ft, **shed roof, tall wall to the NORTH** | shed roof + tall-wall derivation, both built |
| **The Tank** | 24 × 48 ft, gable roof | gable + ridge column, built |
| **Octagon** | 16 ft **or** 32 ft across — one tile, two sub-options | octagon footprint, built |
| **The Cindy** | his Panel-Ready Plan — 1650 sqft, 3 bed / 2 bath ranch | 55'-3" x 34'-10" at 15.5"; notch and step deferred, see below |
| **Square courtyard** | courtyard building, square | courtyard, built |
| **Octagon courtyard** | courtyard building, octagonal | concentric rings, built |

⚠ **Each tile is a real drawn design, not a parameter preset.** It arrives with
its footprint, roof and panels already on it, so the first thing a new user sees
is a finished building they can change. That is the whole value — and it lands
cleanly on the *tile once on first draw, direct manipulation after* model
(`tile_once_editing_model`): a template IS the first draw.

**The thumbnails are renders of those exact buildings**, from the same camera
angle, and the tile animates into the live model when picked. `captureMode`
already takes a 3D PNG for the Project Summary, so a saved design can carry its
own thumbnail with no new rendering code.

### The Cindy

He sent the **MAIN FLOOR TOE UP PLAN** at 1/8" = 1'-0" on 2026-11-05.

⚠ **The panel schedule on that sheet is reference, not requirement.** His call,
2026-11-06: *"Panel measurements or count even are not necessary here, only
where doors and windows are — we are free to repanelize the rest based on the
main toe up plan"*, and then, to be unmistakable: *"we can repanelize Cindy,
just use same window and door slots."* So the sheet's 74 panels at 39" are
somebody else's tiling of these walls; the panelizer re-tiles them itself, which
is the whole point of the app. **The openings are the fixed part** — same
window and door slots, same positions along the wall — and everything between
them is the panelizer's to lay out.

**Wall thickness: 15.5"**, his call the same day — the standard panel depth, so
the Cindy needs no special section.

**Dimensions read off the plan, and both perimeter chains close exactly:**

| run | dimension | the chain that proves it |
| --- | --- | --- |
| overall width | **55'-3"** | 32'-6" + 3'-3" + 19'-6" along the top |
| | | 33'-8" + 21'-7" along the bottom |
| overall depth | **34'-10"** (= **418"**, which the plan also states) | 14'-2" + 3'-3" + 14'-2" + 3'-3" down the right |
| bottom right leg | 21'-7" | 2'-1" + 3'-3" + 16'-3" |
| right inner face | 31'-7" | inside the 34'-10" overall |

That both chains sum exactly is the check worth having: the plan is internally
consistent, so these are measurements rather than my reading of a drawing.

### The Cindy, as it will actually ship — his call, 2026-11-06

> *"Use your best judgment from the knowledge that you have for Cindy. We can
> finesse it later. Let's just get something up there for now."*

So the tile is **not blocked** on anything. Stride 1 is this, and every number
in it is one he gave:

| | stride 1 | why |
| --- | --- | --- |
| **outline** | the overall rectangle, **55'-3" x 34'-10"** | both perimeter chains close on those two numbers, and they are measurements rather than my reading of a drawing |
| **wall thickness** | **15.5"** | his call, the standard panel depth |
| **roof** | the app's 4:12 default | no roof is dimensioned on a toe-up plan |
| **openings** | whatever the panelizer auto-spawns — 4 ft on the dead-south wall, 2 ft elsewhere | an existing confirmed rule (`auto_spawned_windows`), not an invented schedule |
| **panels** | re-tiled from scratch | his call: *"we can repanelize Cindy, just use same window and door slots"* |

⚠ **What stride 1 deliberately does NOT have, and why it is deferred rather
than guessed.** The real plan is not a rectangle: there is a notch in the
right-hand wall (the 3'-3" gaps between the two 14'-2" runs) and a step near
the bottom where the 2'-1" and 3'-3" dimensions sit. From one screenshot at
1/8" = 1'-0" it is clear THAT it steps; which segments are walls and which way
they turn is not. His standing rule is that a wall length has to be exact
(`dimensional_tightness_principle`), so the notch and the step wait for a
PDF/DXF or a wall-run list — they are not approximated into the template. A
rectangle at his two overall dimensions is a true simplification; a notch at
invented lengths would be a false building.

Same for the openings: the positions ARE the fixed part of this plan by his own
words, and nothing here pretends to know them. The auto-spawn rule puts windows
and doors on the template so a stranger sees a finished house, and replacing
them with the real schedule later changes no panel geometry — openings re-tile
their own wall.

**To finesse it:** a wall-run list (each wall, its length, which way it turns,
and the openings on it) or a PDF/DXF of that sheet closes the notch, the step
and the opening schedule in one pass.

⚠ Also worth a fix on the website while you think of it: `buildinteg.com/cindy`
404s. The page lives at `/the-cindy`. People will type the short one.

**Cost:** small. The pieces all exist; this is a saved-design list with pictures.

---

## U4 — Props for scale

A 6 ft figure, a car, a tree. The cheapest realism in their whole product, and
the one thing that tells a client whether a 12 ft wall is big.

---

## U5 — ~~A site around the building, as a toggle~~ **BUILT 2026-11-07** — see the record at the end

Grass, sky, horizon, a shadow. ⚠ **Defaulted OFF for the fabricator role and ON
for a client-facing one**, so a shop drawing never gains scenery and a homeowner
never sees a grey void. The ground plane is already written and deliberately
disabled (2026-10-29, *"it blocks the floor panels from being visible"*) — this
is that decision revisited with a switch instead of a deletion, and the floor
panels are exactly why it must stay a switch.

---

## U6 — ~~Dimension handles on the model~~ **BUILT 2026-11-07** — see the record at the end

> *"Nothing crazy, but height (oh boy maybe we run into panel setting tiling
> ordering issues here), width, depth of building, as well as the roof slider
> (slides the peak position), and I guess roof height too."*

Five handles, floating on the model, each editable in place:

1. **Width** 2. **Depth** 3. **Wall height**
4. **Roof peak position** — a slider along the span, which is the shed↔gable
   continuum made draggable
5. **Roof height**

⚠ **The typed value stays the master.** The drag is the convenience; the number
is the truth, and it still takes ⅛″ and feet-inches. Same rule the panel
editor's drag was built under (B29/B30): the gesture proposes, the arithmetic
disposes.

⚠ **His own worry is the real one, and it has a name.** *"Maybe we run into
panel setting tiling ordering issues here."* Yes:

- Changing **width or depth** changes wall length, which means a retile. Under
  `tile_once_editing_model` a retile is NOT automatic after the first draw, and
  under `panel_type_transition_and_reservations` an opening-anchor retile has
  already lost panels once on a 43'9" × 33' building.
- Changing **height** or either roof handle must **re-derive the roof** —
  `roof_follows_the_shape` records that stored shed profile positions are
  absolute inches and go stale, with **two paths that still bypass the
  re-derivation**. A drag handle would be a third unless it goes through the
  same seam.

So U6's first stride is not the handle. It is: **make resize go through one
seam that retiles and re-derives, and close those two bypass paths.** The handle
is the easy half and should be built second, on top of a resize that is already
honest. Otherwise the most inviting control in the app is the one most likely to
quietly drop a panel.

**Cost:** medium, and front-loaded into the seam rather than the UI.

---

## U7 — A per-tool first-use tutorial

⚠ **Follows U2**, which renames two buttons. Write the cards after the names
have stopped moving.

> *"I think this is a great idea, especially if it's remembered in their cache
> or something and that's easy. How would the remembering part work?"*

**How the remembering works, honestly, with what it costs:**

- **Signed out — `localStorage`.** One key, e.g.
  `bi.tutorialsSeen = {"panel-editor": 2, "panelizer": 1}` — the tool's id
  against the version of its tutorial that was seen. Survives reloads and
  closing the browser. ⚠ It does **not** survive clearing site data, a private
  window, or a different browser or machine: the same person on their phone
  sees it again. That is the honest limit of "their cache".
- **Signed in — the backend.** Same object, stored against the user, so it
  follows them everywhere. Stages 0–4 are live, so this is one small column (a
  `jsonb`) and one more thing the session already loads — not a new system.
- **Both at once, merged.** Read `localStorage` first so the card never flashes
  while the session loads; reconcile on sign-in by taking the higher version per
  tool. Anything a signed-out user dismissed stays dismissed when they sign in.
- **Versioned, not boolean.** `2` rather than `true` means that when a tool
  genuinely changes, bumping its number shows the card once more to people who
  have been using the app for months — which is exactly what should happen when
  the right-click menu or the panel editor gains something.
- **Always reachable afterwards:** the `?` on the tool reopens its cards. A
  tutorial you cannot get back is a tutorial you resent dismissing.

Three illustrated cards per tool, DONE and a link to general help. The tools
that need it most are the ones only discoverable if somebody tells you: the
**right-click panel menu**, the **panel editor**, and **Settings > Panelizer**.

**Cost:** medium — the writing is the work, not the code.

---

## U8 — Share a design by link

A `?shareid=` URL, no account needed to view. The backend for this is live.
⚠ **It is a sharing decision, not a feature decision**: a link showing the
client render is a different object from one showing the cut list and the
prices. Decide what a shared link contains BEFORE building the button — and
read the backend's own notes first, because an unlisted URL is public to anyone
it is forwarded to.

---

## What this queue is NOT taking from PBM

- **Their quote flow.** Handing a customer to a phone call is a step backwards
  from a priced takeoff.
- **Dropdown-only pitch.** Theirs offers `3:12` from a list; ours takes a real
  number, which matters once a roof has to be cut.
- **Their dimension entry** — `30'` in a box with no fractions would break the
  ⅛″ rule this app is built on.
- **Tutorial modals every time.** First use only, dismissible for good, and
  reachable again from the `?`.

## The caveat that still stands

⚠ I used the dealer's live configurator as a visitor and **did not submit the
quote form**, so I have not seen what a customer receives afterwards. If that
follow-up contains a priced bill of materials, the *"we produce a price, they
produce a phone call"* comparison is weaker than it reads — worth re-checking
before anyone repeats it in a meeting.

---

## U1 — BUILT 2026-11-06: the tools fold away, and the camera comes back

Three pieces, and the third is what makes the first one mean anything.

### The `← HIDE` tab

A tab on the canvas's own left edge, `leftBarHidden` local state, reading
`← HIDE` / `SHOW →`. It lives in `.editorCanvasLayer`'s coordinate space rather
than the sidebar's, because when the bar is folded there IS no sidebar box to
hang off and a tab that moves house between its two states is a tab that
drifts. Here it sits at the canvas's left edge in both states and only the
arrow turns.

⚠ **Local state, deliberately not in `ProjectState`** — the same two reasons
`editorSurface` beside it gives: loading somebody's project must not fold their
tools away, and undo must never undo *how wide the drawing is*.

⚠ **`aria-hidden` is NOT applied when the user folds it.** A bar hidden because
the surface has no sidebar is gone; a bar the user folded is still part of the
page and its tab says so through `aria-expanded`. Marking it `aria-hidden`
would make a reversible fold read as a deletion.

### The 3D view fills its column

Without this the tab folds 240px away and **the model stays exactly as big as
it was**, which is not what the tab is for: *"the 3D view fights the left bar
for width."* `Building3DView`'s two wrappers were hard `width: 720`; the
interactive one is now `100%` and only the CAPTURE canvas keeps 720x480,
because that figure is the Project Summary PNG's own size. r3f resizes its
drawing buffer to the element, so nothing else had to know.

**Measured in the browser:** 783px of canvas with the bar, **1023px without**.
The capture canvas stayed at 720 beside it, parked at `left: -9999px`, exactly
as it should.

⚠ Note what this does NOT touch: the plan, floor, foundation and elevation
canvases are all still `CANVAS_WIDTH = 720`, and `elevationViewport.ts` already
calls that *"five copies of the same problem."* This is one of the five, taken
because it is the one the HIDE tab exists to serve.

### Reset view

On the 3D view (beside the exports) and in the panel editor's left bar.

⚠ **Not `controls.reset()`.** Three's own reset restores the target the
controls were CONSTRUCTED with — the origin — not the building's centre, so it
would aim the camera at the corner of the world. Both handlers instead set the
same two values their Canvas mounts with: `cameraPosition` and the default
target, then `update()`.

⚠ The building's one also clears `orbitTargetOverride`. A double-click on a
panel promotes that panel's centre into it, and leaving it set would reset the
camera to a position that no longer matches what it is pointed at.

⚠ **Outside the `browsing` gate** the OBJ/COLLADA exports sit behind. A browsed
design is *"design yes, money no"*; putting the camera back is neither — it is
how you look at the thing at all.

⚠ **The panel editor's button is a plain `<button>`, not `barButton`.** That is
a lint finding, not a style choice: `barButton` is a helper CALLED during
render, so handing it a handler that reads `controlsRef` makes the React
Compiler lint see a ref read in render. `react-hooks/refs` went 29 → 30, which
this repo's gate says may never happen. Inline as a JSX prop it is not flagged,
which is also why `Building3DView`'s identical handler never was.

### What was verified, and what was not

- **Verified in the running app:** the tab toggles both ways (`aria-expanded`
  flips, the bar's computed `display` goes `flex` → `none` → `flex`), the 3D
  canvas measures 783 → 1023, the 3D view's **Reset view** button renders and
  clicking it raises nothing in the console.
- ⚠ **Not verified in the browser:** that the camera visibly snaps back.
  Neither a real drag nor synthesised pointer events orbit drei's
  `OrbitControls` in the pane (three calls `setPointerCapture`, which a
  synthetic pointer has no id for), so there was no "before" to compare a
  reset against. The handler is five lines and typechecks; what is untested is
  the eye.
- ⚠ **Not verified in the browser:** the panel editor's own Reset view button.
  The right-click menu opens and its `Panel editor…` item is there, but the
  item does not activate under synthetic events, so the editor never mounted.
  Same handler shape as the one above.

Gates: 3749 tests / 203 files, typecheck clean in all four projects, lint
**169 / 119 / 50 — every rule byte-identical** after the `refs` fix above.

---

## U2 — BUILT 2026-11-06: the path is named, and the bar got NARROWER

> *"We can meld these ideas into basically how it is right now except with
> arrows between each button."* — Tommy, 2026-11-05

Three things: two renames, three chevrons, and one bug the chevrons found.

### The two renames

`Design → Edit` and `Summary → Price`, his own words.

**Edit** is the honest name for a door you come back to — you do not draw a
building once and leave drawing behind, you edit it all the way to the shop.
**Price** replaces a word that named the page rather than the reason anybody
opens it.

⚠ **The menu's KEY is still `design`.** The same split `"Membranes"` /
`"3d-wraps"` already carries: a user-facing word was renamed and an internal
id was not. Renaming the id would reach `viewerMenuOwner`, `viewerMenuGroups`,
`viewerMenuEmptyReason`, every `data-view-menu` attribute and the width
harness that reads them, for no gain to anybody. Two tests pin both halves —
the word IS `Edit`, the key IS still `design` — because a rename that drifts
back is indistinguishable from a rename that never happened.

⚠ **Every sentence that named the old word moved with it.** `You are
designing — Wall` → `You are editing — Wall`; `Where to design:` → `Where to
edit:`; `You are reading the summary` → `You are on Price`; and Summary's
resting title now opens `What it costs:`. A tooltip naming a different word
than the button it hangs off is the exact drift B25 was written to stop, one
level up.

⚠ **FOR HIM: `Edit` now collides with the left bar's own `✎ Edit` tool**, the
wall-drawing edit mode. Two controls on one screen reading `Edit` and meaning
different things. Not resolved here — he picked the word knowing today's bar,
and if he wants a fix it is to rename the SIDEBAR tool, not to overrule the
word he chose for the path.

### The chevrons

`›` (U+203A), three of them, between `Edit ▾ › View ▾ › Price › Print`.

⚠ **Inert, and that is his second answer, not minimalism.** *"The arrows just
sit there."* No `onClick`, no `role`, no tab stop, no state — so **there is no
state here for the app to be wrong about**. Nothing is ever marked done, which
means a newcomer is never told he has finished a step he has not. They are
`aria-hidden` too: a screen reader already receives the four controls in
order, and hearing "greater-than sign" three times between them adds no fact
and three interruptions.

### Measured: adding arrows made the bar 49px narrower

This was expected to COST width. It paid.

| | before | after |
| --- | --- | --- |
| Edit / Design | 86.3px | **68.2px** |
| View | 73.8px | 73.8px |
| Price / Summary | 85.0px | **59.0px** |
| Print | 56.1px | 56.1px |
| four buttons | 301.1px | **257.0px** |
| + gaps and arrows | 331.1px (3 × 10px zone gap) | **282.0px** (3 arrows, 4px gaps) |

**−49.1px.** `Design → Edit` gave back 18.1px and `Summary → Price` 26.0px —
between them more than the 24.9px the three chevrons and their gaps cost. The
bar this change was expected to crowd has more room than before it.

The four are wrapped in `.pathGroup` purely so the group can run a 4px gap
where `zoneLeft` runs 10px; at the zone's own gap the chevrons would have cost
3 × (10 + glyph + 10) against a measured 34px of spare at 768px.

### ⚠ The bug the wrapper introduced, and how it showed up

The four path controls each carry `flex-shrink: 0`, so as direct children of
`zoneLeft` they could never be squeezed. Wrapped in a group that shrinks, they
could. Measured at 768px with `min-width: 0` on the wrapper: **the group
reported 225px while its contents needed 282px, and Print was drawn outside
its own container's box**, free to collide with `zoneRight`.

`flex-shrink: 0` on `.pathGroup` fixes it. The lesson is narrow and worth
keeping: **a wrapper added to change one property must inherit the layout
behaviour of what it wrapped.** It was found by measuring rather than by
looking — at 768px the clipped Print still *rendered* in the right place,
because a flex container does not clip by default. Nothing looked wrong.

### Verified in the running app

- The bar reads `Project | Edit › View › Price › Print | Role:` with Edit
  carrying the owner underline.
- **Edit**: word `Edit`, title `You are editing — Wall`, menu opens.
- **Price**: opens the summary (`PROJECT TOTALS` renders), title flips to
  `You are on Price — click to go back to the drawing`, `data-surface-owner`
  goes `true`, and clicking again returns to the drawing.
- **The arrows are inert**: 3 of them, all `aria-hidden="true"`, none
  tabbable, computed `pointer-events: none`.
- **No row overflow at 984px, 768px or 640px**, and the group no longer
  clips at any of them.

Gates: 3763 tests / 204 files, typecheck clean in all four projects, lint
**169 / 119 / 50 — every rule byte-identical**.

⚠ **U7 is now unblocked**: it was waiting on these two names stopping moving.

---

## U3 — BUILT 2026-11-07: eight tiles, and the roofs built themselves

> *"6 prefabs include - Tiny House (16x24' shed roof with tall north wall), the
> Tank (24x48 gable roof), octagon (16' or 32' diameters sub options), Cindy,
> square courtyard octagon courtyard, or draw your own, log in OR (if logged
> in) open from cloud."*

### The one thing worth knowing before the rest

**Nothing in `starterTemplates.ts` sets a roof.** `decideRoofForm` already
picks shed or peak from how far one run of panels reaches at 4:12 — his own
rule — so the Tiny House's 16 ft short walls get a **shed** and the Tank's
24 ft short walls get a **peak**, from the dimensions he gave and nothing
else. `simpleRoofPlanes` already defaults a shed's tall side north *"so the
roof faces south"*, so the tall north wall falls out too.

**Both of the roofs he named are consequences of both of the sizes he named.**
A tile that forced a roof form could disagree with the rule the rest of the
app builds roofs by, and then two of his own decisions would be fighting
inside one building. So none of them does, and a test says why.

⚠ **That is also why the Tiny House is stored `24 × 16` and not `16 × 24`.**
The short walls have to be the 16 ft pair for the span to reach as a shed,
*and* the building has to be wider than deep for `simpleRoofPlanes` to run its
ridge axis east-west — which is the condition under which "tall side north"
applies at all. Entered the other way round it is a shed falling WEST. Two
tests pin both halves.

### A template is a recipe, not a saved file

Every tile carries a footprint and nothing else: no girt style, no brace
pattern, no roof pitch, no panel width. The only non-geometry key anywhere is
the Cindy's `thicknessIn: 15.5`, because only the Cindy has a thickness of
his. **A frozen `ProjectState` would pin today's defaults into a building a
stranger opens next year** and quietly show them an app that no longer exists.
A test asserts the key list of every plan, so the first person to add a
convenience field has to argue for it.

Picking a tile goes through the same `commitNewFootprint` a drag does, so a
template cannot produce a building the drawing tools could not.

### `commitNewFootprint`, split out of `handleDraw`

`handleDraw` built its own footprint from a width and a depth. A courtyard
RING cannot be built that way — `addCourtyard` insets a finished footprint —
and going through `commitFootprintShapeChange` instead would have read
`footprint` out of state one tick before React had put the new one there,
which on the very first draw is `null`. Everything in that function was
already generic over the footprint; only the two lines that CHOSE one were
specific to a drag. The `retileCallSites` inventory follows the rename.

`handleDraw` also gained an explicit `shape`: the Octagon tile must build an
octagon whether or not the Octagon tool happens to be armed, and reading
`shapeTool` there would make one tile draw different buildings depending on
what the user last touched.

### Where it lives

It fills the canvas when the wall tab is on the plan with no footprint, no
elevation open, and it has not been dismissed. Those five terms are exactly
the screen that used to read *"Click and drag to draw the footprint"* — the
one screen in this app that asked a newcomer to already know what it wanted.

⚠ **Not gated on being a fresh session.** Delete a building and the picker
comes back, which is right: with no footprint there is nothing else for that
surface to show, and an empty stage with eight buildings on it beats an empty
stage.

⚠ **The cloud tile is shown signed out, never hidden** — it reads *Sign in to
open a saved design* and opens the sign-in, which is the honest label for what
the click does. Hiding it would leave a stranger believing this app has no
cloud. It reads the Project menu's own discriminated union rather than a bare
`signedIn`, so the tile and that menu cannot disagree the moment MFA is
pending.

### The pictures

Each tile draws the **real plan of the building that tile makes** —
`planOutlineLoopsFt` runs the same `footprintForPlan` the click runs, so a
picture cannot show a building the click does not produce. A courtyard is a
hole, not a second shape: one path, two subpaths, `fill-rule: evenodd`. The
fill is `PANEL_TYPE_COLORS.standard`, the same warm tan a Standard panel is
drawn in one click later.

⚠ **These are NOT the 3D renders he asked for.** *"so cool to see thumbnail
models of that enter that building"* — a model is stride 2, and the honest
description of what shipped is a true drawing at a lower fidelity rather than
a pretty picture of a different building. The *"enter that building"* half IS
here: picking a tile lands you in **View**, the 3D framed model, which is his
own third answer.

### ⚠ The layout bug, found by measuring

`.editorCanvasLayer` centres its child and clips the overflow — right for a
fixed 720x480 canvas, wrong for a grid as tall as it has tiles. Measured
before the fix: the picker laid out **1188px tall inside a shorter layer, its
box started at y = -128, and the whole first row was cut off above the top
edge** with no way to reach it. Centring something taller than its container
hides both ends of it. The picker now takes the layer's full height and
scrolls inside itself.

(Also: the component had to be renamed `StarterTemplatePicker` — on Windows,
`StarterTemplates.tsx` and `starterTemplates.ts` differ only in case and
TypeScript refuses the pair.)

### Verified in the running app, tile by tile

| tile | what the app actually produced |
| --- | --- |
| **Tiny House** | 85 panels, **12 tilted gable** — the cross-tilt row, which only a shed has. Its sheet reads **"T1: 0in along the N wall"**: the tall wall is north. |
| **The Tank** | 143 panels, **18 gable** — it took the peak. |
| **The Cindy** | 175 panels, and the plan's own dimension labels read **55'-3" and 34'-10"**. |
| **Square Courtyard** | 65 wall panels, **8 windows and 6 doors** — two loops of wall, so twice the openings. No gable row, which is right for a ring roof. |
| **Octagon Courtyard** | 79 wall panels, 8 windows, 3 doors, no refusal notice. |
| **Octagon** | 8 walls at both 16 ft and 32 ft; the sub-switch re-draws the tile's own picture. |
| **Draw your own** | dismisses the picker and the empty canvas is behind it. |

Every preview's drawn aspect was measured rather than eyeballed: Tiny House
126x84 (3:2), Tank 148x74 (2:1), Cindy 133x84 (1.583 against a true 1.586),
all three octagons square. No console errors anywhere in the run.

Gates: 3778 tests / 205 files, typecheck clean in all four projects, lint
**169 / 119 / 50 — every rule byte-identical**.

### What stride 2 is

1. **The 3D render thumbnails** — `captureMode` already takes a PNG of the
   Project Summary's model, so six captured once and stored is the shape of
   it, not new rendering code.
2. **The tile animating into the model**, rather than cutting to it.
3. **The Cindy's notch, step and real opening schedule**, which need a
   wall-run list or a DXF. ⚠ `buildinteg.com/cindy` still 404s; the page is at
   `/the-cindy`.

---

## U4 — BUILT 2026-11-07: three things of known size, standing outside

> *"A 6 ft figure, a car, a tree. The cheapest realism in their whole product,
> and the one thing that tells a client whether a 12 ft wall is big."*

A `Props for scale (person, car, tree)` tick in **3D Layers**, beside the straw
and the deck toggles.

### The one rule this feature lives or dies by

⚠ **A prop drawn at the wrong size is worse than no prop at all.** It does not
look broken — it just makes the building look bigger or smaller than it is, and
nothing else on screen contradicts it. So the size is not a constant with a
confident name; it is a **claim that gets measured**:

- `scaleProps.ts` states each prop's overall extent.
- `scaleProps.test.ts` **assembles the parts** — legs, torso, arms, head — and
  measures their bounding box against that statement.
- It then does it **a second time** against `drawnPart()`, the pure function
  that converts a part into the three.js primitive in FEET that actually
  reaches the scene. A figure that is 72in in the data and half that on screen
  is exactly the failure that can hide, so the drawn numbers are tested too,
  not just the stated ones.

The person is **6'-0" exactly**: legs 0–38in, torso 38–63in, head 63–72in.

### Which numbers are his, which are typical, which are chosen

Stated in one place (`SCALE_PROP_PROVENANCE`) that the on-screen note prints
**verbatim**, so the app cannot say something milder than the source does:

| prop | size | what kind of number that is |
| --- | --- | --- |
| **Person** | 6'-0" | **his**, and the one a client reads a wall against |
| **Car** | 16'-0" x 6'-0" x 4'-9", 111in wheelbase | **typical published dimensions for a mid-size sedan** — a 2025 Camry is 192.1 x 72.4 x 56.9in, an Accord 195.7 x 73.3 x 57.1in, a Model 3 185.8 x 72.8 x 56.8in; any of the three is this box within about 4in |
| **Tree** | 16'-0" tall, 10'-0" spread | **chosen, not measured.** A tree has no standard size. The note says so in those words |

⚠ **None of the three is a part.** No prop enters a takeoff, a price, a weight,
a fabrication sheet or an export — and that is structural, not a promise: the
OBJ and COLLADA exports build from `buildExportPanels()`, a data path, not a
walk of the three.js scene, so there is no route by which a human figure
reaches a cut list. `scaleProps.ts` imports nothing from the panel catalog.

⚠ **Props are grey on purpose**, and a test enforces it. Every panel colour in
this app is warm or saturated and lumber renders tan; a prop in that family
would read as a member at a glance. So they are desaturated cool greys — a
physical architectural model's own convention — with foliage the only colour in
the set, and `scaleProps.test.ts` asserts no prop colour equals any entry of
`PANEL_TYPE_COLORS`, `DECK_PANEL_COLORS` or `ASSEMBLY_COLORS`.

### The default is a TRI-STATE, and that is the interesting part

`showScalePropsOverride: boolean | null`. `null` means **follow the role**:
props are on for the client-facing **Public** view and off for Fabricator,
Admin and Engineer. The moment the user ticks the box themselves, their answer
sticks and the role stops deciding.

That is U5's own rule — *"defaulted OFF for the fabricator role and ON for a
client-facing one"* — applied to the first of the two toggles it governs, so
**U5 now has a worked pattern to copy rather than a question to re-answer.**

⚠ A plain boolean would have needed an effect to re-default it when the role
changed, and `react-hooks/set-state-in-effect` is a rule this app's lint gate
forbids from rising at all. The derived value needs no effect — and that is the
better reason anyway: there is no instant at which the stored state and the
role are out of step.

⚠ **Not forwarded to `captureMode`.** `BuildingSummaryRenderProps` takes design
data and no view toggles (`showStraw` is already absent for the same reason), so
the Project Summary's printed render never gains scenery — U5's *"a shop drawing
never gains scenery"* applied to the one document this view produces. One line
reverses it if he wants a figure in the client PDF.

⚠ **Props are out of the pointer path entirely** — a no-op `raycast` on every
mesh, not on the group above them, because the raycaster walks children
regardless of what the parent does. The 3D left-click selects a panel and the
right-click opens the panel menu; a figure standing in front of a wall must not
swallow either, and a tree must never become an orbit target.

### Three things found by measuring in the browser, not by looking

1. **The camera framed the building, so the car was drawn half past the edge of
   the canvas.** Measured on the 24 x 16 Tiny House. Turning props on now
   widens the camera's framing box via `scalePropsPlanBounds`, which is
   computed from the same placements the props are drawn at — so the camera
   cannot pull back to frame props that are somewhere else. The TARGET does not
   move: the building stays the subject. It costs the Cindy under 1.3x and a
   16ft octagon over 1.5x, which is correct — a 16ft car beside a 16ft octagon
   really is half the scene.
2. **All three props stood on the camera's own sight line**, because they were
   placed on the SE diagonal, and the tree stood in front of the person. The
   tree moved to the south face 22ft west of the figure; spreading them across
   two faces spreads them across the frame.
3. **⚠ The figure's 5in legs came out under a pixel wide and vanished**, so it
   read as a floating torso — i.e. as a person half his own height, which is
   the one mistake this feature cannot make. Legs are 7in now (a trousered
   thigh is about that anyway) and a test refuses any box part thinner than
   4.5in.

⚠ **The standoffs are real distances in feet and do NOT scale with the
building** — 4ft off the wall for the person, 5ft for the car. Scaling them
would hold every prop at the same share of the screen at every building size,
which is precisely the information a scale reference exists to destroy. On a
big building the figure SHOULD look small.

### Verified in the running app

- Role **Fabricator**: unticked, no props, and the note explains the default.
- Switching to **Public** with the box untouched: props appear, no effect, no
  flicker, and the tick follows.
- Unticking then switching role: the answer sticks.
- **The proportion check that is not an eyeball**: with the tree 16ft and the
  figure 6ft, the drawn ratio should be 2.67. Measured on screen at the opening
  camera: **126px to 47px = 2.68**.
- The car checks out against the building the same way: its 16ft length to the
  Tiny House's 24ft wall measured 1.29 against a true 1.5, the gap being the
  car sitting nearer the camera.
- Reset view puts the camera back at the widened framing. No console errors.

Gates: 3828 tests / 206 files, typecheck clean in all four projects.

---

## U5 — BUILT 2026-11-07: the void gets a sky, and the ground stops hiding the floor

> *"Grass, sky, a horizon and a shadow. Ours is a grey void — honest for a
> fabricator, cold for a client."*

One tick, `Site (sky, grass, horizon, shadow)`, in **3D Layers** beside U4's
props. Default **on for Public, off for Fabricator/Admin/Engineer**, as a
tri-state copied straight from U4 — `null` means follow the role, and a user's
own tick stops the role deciding. That was U5's open question and U4 answered
it; this item spent nothing re-answering it.

### The 2026-10-29 objection, as a number

⚠ He turned the ground plane off because *"it blocks the floor panels from
being visible and doesn't really illustrate anything for the user."* That was
right, and the cause is exact rather than aesthetic:

- `deckPanelTakeoff.ts` anchors a floor panel at `anchorYFt: 0` — *"The floor
  deck hangs below Z=0, the finished floor the walls stand on."*
- The view then tips each deck panel by `Math.PI / 2 − tiltRad`, which swings
  the panel's **15 1/2in depth from up to down**. So a floor deck occupies
  **Y = −15 1/2in to 0**, and a bale foundation hangs below the datum too.
- The old plane was drawn at **y = −0.05ft, i.e. −0.6in** — *inside* the floor
  system. It buried the whole deck and left the walls standing on nothing.

So the grass is **not** at a fixed offset. `siteGroundYFt` puts it **one inch
below the lowest point the scene actually draws**, measured off the same render
data that draws it and through the same rotation the renderer applies —
`deckGroupRotationX` is now exported from `site.ts` and used by
`Building3DView`, so there is one expression of that quarter turn rather than
two that can drift. `site.test.ts` checks "no member is below the grass"
against every floor system this app builds: floor panels, a bale foundation, a
bale foundation with the clay/steel bottom skin, both together, and no floor
system at all. The bound on a tilted member is deliberately **loose on the safe
side** — a brace reports a few inches deeper than it is, because a few inches of
extra lawn is nothing and a buried panel is the defect.

### The shadow took three goes, and the first two are worth writing down

**1. drei's `ContactShadows` renders nothing here.** It was the obvious choice —
it needs no change to any panel component, because it works by re-rendering the
scene with `scene.overrideMaterial`. In this app's three.js 0.185 / r3f 9.6 /
drei 10.7 combination it produced an empty texture. ⚠ Measured, not assumed:
with the shadow forced to **opaque red**, its frustum opened from 2.5ft to 50ft,
on a freshly reloaded page with no console error and no lost context, the lawn
was still untouched. Two real bugs were found and fixed on the way there and
neither was the cause:

- `scale={[w, h]}` is a **fresh array identity every render**, and drei keys its
  two `WebGLRenderTarget`s on it — so it was allocating a new pair of render
  targets every frame. A primitive `scale` is stable by value.
- A small positive `near` **clips drei's own blur quad**, which sits at distance
  0 from the shadow camera. It has to be 0; the thing that keeps the lawn out of
  its own shadow map is the plane's lift above the grass, not `near`.

**2. The shadow is three's own now: one casting light, one receiving ground, and
ONE caster — a solid prism of the footprint.** Not the frame. Two reasons, and
the second is the better one:

- Casting from the members would mean `castShadow` on every member mesh, which
  means editing `PanelMembersGroup`, the component the panel editor shares — and
  a depth pass over thousands of 1 1/2in sticks that comes out as aliased noise
  at any map size this app can afford.
- ⚠ **The real building is not a lattice.** It is solid straw-panel walls under
  plaster; the frame is a fabrication view of it. A client looking at the site
  toggle should see the shadow the finished building throws, which is its
  massing. The note on screen says so in those words, and a test checks it does.

The caster is invisible — `colorWrite` and `depthWrite` both off — and still
casts, because three's shadow pass swaps in its own depth material and checks
only `object.visible` and `material.visible`. Its outline is the real footprint
extruded, so an octagon or a notched plan throws its own shape. Its height is
the **top of the roof** where `simpleRoofPlanes` can answer and the top of the
walls where it cannot; walls alone would run about a quarter short on a gable,
which is the kind of wrongness nobody can name and everybody can feel.

**3. Two things that produced no shadow at all and looked like the same bug:**

- ⚠ **r3f writes `shadow-camera-left` and friends straight onto the camera and
  nothing recomputes its projection matrix**, so the frustum stayed at three's
  default ±5ft box and a 24ft building cast almost nothing. Fixed with an
  `onUpdate` that calls `updateProjectionMatrix`.
- ⚠ **The sun was at the camera's own azimuth.** `BIRDS_EYE_AZIMUTH_DEG` is 45°
  and the light has always sat at `[maxDim, maxDim × 2, maxDim]` — also 45°. A
  shadow cast from there falls **directly away from the viewer and hides behind
  the building**: it was real, correct and invisible until the view had been
  orbited most of the way round.

So the sun now has **two positions, and only the site moves it.**
`VOID_SUN_DIRECTION` is `[1, 2, 1]`, exactly what the scene has always carried,
and the fabricator's lighting is untouched. `SITE_SUN_DIRECTION` mirrors the X
to `[-1, 2, 1]`, which puts the shadow at **90° to the view** — beside the
building at the opening camera and visible through most of an orbit. A test
asserts both: that the site's sun throws its shadow more than 60° off the view
axis, and that the void sun is still literally `[1, 2, 1]`.

The cost is that one of the two faces a bird's-eye sees falls to ambient light
with the site on. That is a fair trade for a client view — differentiated faces
read as three-dimensional, equal ones read flat — and it is exactly why the
fabricator's own lighting was left where it was.

### The horizon is fog, not an edge

`OrbitControls` is mounted with no `maxPolarAngle`, so a user can swing down to
the horizon and past it. The lawn is twenty building-widths across (floored at
400ft, capped at 3000ft) and linear fog takes it to haze at just over half that,
so the lawn does not end, it dissolves. ⚠ Fog is a scene property and every
panel material takes it, so `nearFt` is `4 × maxDim` — the farthest corner of
the building at the opening camera is about `2.4 × maxDim` away, so **nothing on
the building is ever fogged there**, and a test says so.

⚠ The lawn is drawn with **64 × 64 segments and that is not cosmetic**: three's
fog is a per-vertex varying, so a single 6000ft quad shows a gradient
interpolated between four corners — a diagonal seam across the ground instead of
a horizon.

The sky is drei's `Sky`, a box scaled by `distance`, centred on the building via
a group because its own props accept no transform. Two constraints, both tested:
it has to **contain the lawn** (or the grass runs out through the side of the
sky) and its half-extent has to stay inside the camera's 10000ft far plane (or
it is clipped away entirely). 2.4 × the lawn radius satisfies both at every
building size, which is what the 3000ft cap on the radius is there to guarantee.

### Scenery, and nothing else

`SITE_PROVENANCE` is printed verbatim by the 3D Layers note, so the screen
cannot say something milder than the source file: no survey, no grade, no slope,
no soil, no setbacks, no orientation, no time of day. The sun is placed to light
the model, not to match an hour. The lawn's height is a drawing decision and not
a ground level — the building is not sited on anything. ⚠ **Not forwarded to
`captureMode`**, same as the straw and the props, so the Project Summary's
printed render never gains scenery; that is this item's own rule applied to
itself. And nothing here reaches a takeoff, a price, a weight, a sheet or an
export, structurally: the OBJ and COLLADA downloads build from
`buildExportPanels()`, a data path, not a walk of this scene.

⚠ Site colours are dull on purpose and a test enforces that none of them is a
panel colour — a bright lawn would compete with the frame in a view whose
subject is the frame. ⚠ The lawn has a no-op `raycast`: it is thousands of feet
across, and `Building3DView`'s `onPointerMissed` is what clears the Orbit tool's
re-centring, so a lawn that can be hit is a lawn that silently breaks a tool.

### One thing U4 gained from this

U4's props now `castShadow`. It is free with the site off — nothing in the scene
casts unless the site's own light is the one casting — and with the site on it
is what puts the 6'-0" figure, the car and the tree **on** the grass instead of
an inch above it.

### Verified in the running app

- Role **Fabricator**: unticked, grey void, lighting unchanged.
- Ticking it: sky, lawn, horizon and a shadow falling clear of the building.
- Unticking it: the void comes back exactly — no fog residue, no background
  colour, no shadow. r3f detaches `scene.fog` and `scene.background` cleanly.
- Switching to **Public** with the box already unticked: props came on (U4's
  tri-state, untouched) and the site stayed off. The answer sticks.
- Props and site together: the figure, the car and the tree each cast their own
  shadow onto the lawn.
- Orbited to the horizon: sky above, grass below, the two meeting in haze with
  no edge and no band.
- No console errors, no shadow acne, no peter-panning.

Gates: 3928 tests / 207 files, typecheck clean in all four projects, lint
169 / 119 / 50 — every rule byte-identical to the baseline.

---

## U6 — BUILT 2026-11-07: the seam first, then four of the five handles

> *"Nothing crazy, but height (oh boy maybe we run into panel setting tiling
> ordering issues here), width, depth of building, as well as the roof slider
> (slides the peak position), and I guess roof height too."*

⚠ **His parenthesis was the item.** The handles are a thin layer; the question
underneath them is what a width or depth change does to the panels and to the
roof. So stride 1 was the seam and stride 2 was the badges, in that order, and
the badges turned out to be about a day's less work because of it.

### Stride 1a — one way to change a building's size

Width and depth were reached through **four** handlers that each rebuilt the
footprint their own way: the typed wall-length editor (twice, once per shape),
the octagon size panel and the octagon wall drag. A dimension handle would have
been a fifth copy, and the first place a difference between them could hide.

`resizeBuildingBoxFt` is now the only one, and everything above goes through it.
In order, it:

1. **Refuses a shape without a box, out loud.** A bumped-out, split or
   courtyard plan has more than two degrees of freedom; regenerating it from two
   numbers would silently flatten it back to a rectangle.
2. **Snaps to the eighth** before anything is built from the number — B29/B30's
   rule applied to the building: *the gesture proposes, the arithmetic
   disposes.*
3. **Ignores a no-op.** A drag fires many times a second; under a sixteenth of
   an inch is not a move.
4. **Resizes panels rather than re-tiling them, and re-derives the roof** —
   both through `applyShapeChange`, the one path that does those together.
5. ⚠ **Reports a refusal.** `resizeSlotsForShapeChange` returns null when a
   wall cannot shrink any further and **every caller used to swallow it
   silently.** On a typed field that reads as the number snapping back for no
   reason; on a drag handle it would read as the handle sticking.

⚠ The octagon still SOLVES rather than approximates: a typed or dragged
straight-wall length goes through `setStraightWall`, because an octagon's clip
falls out of `min(W, D)` and taking the dragged figure literally is the
2026-10-20 "weird numbers" bug.

### Stride 1b — the roof bypasses, and there were twice as many as the notes said

`roof_follows_the_shape` recorded **two** paths that replaced the footprint and
left the roof alone. Counting them found **four**:

| path | why it must re-derive | was it on the list? |
| --- | --- | --- |
| `handleKeepSplitRegion` | a drawn wall cuts the plan; the kept half renumbers every corner | yes |
| `commitFootprintShapeChange` | a courtyard flips whether gable ends are allowed at all | yes |
| **`handleAddBumpOut`** | `insertBumpOut` renumbers every wall | ⚠ **no** |
| **`handleDragWall`'s collapse branch** | a wall is removed and every survivor renumbered | ⚠ **no** |

All four go through `withRederivedRoof` now, which re-derives
**unconditionally** rather than asking `roofShapeChangeVerdict`. ⚠ That is
deliberate and worth keeping: **the verdict decides by comparing gable-end wall
IDS, and all four of these paths renumber walls.** An id that matches across a
renumber is not the same wall — a second bump-out on an already-numeric plan can
hand back `"0"` and `"4"` for two walls that have nothing to do with the two
that carried those names. A gable profile keyed to such an id is not a roofline
anybody shaped; it is stale state, and keeping it is how one wall stays a shed
while its opposite becomes a gable.

⚠ **`footprintChangeSeam.test.ts` is the guard that keeps it closed.** Every
`setFootprint` in `page.tsx` is attributed to its handler and must be classified
— `SEAM`, `REDERIVES`, `DRAW` or `LOADS` — and the test checks the handler's body
really contains the call its class claims. A new one fails until it is named.
That is what stops U6's own handles, or the next gesture after them, becoming
bypass number five. The count went **down**, twelve sites to nine, because the
three box-resize paths collapsed into one.

⚠ `applyProjectState` is the one site that must NOT re-derive, and there is a
test saying so: a saved file carries its own roof, and re-deriving would
overwrite a roofline the user shaped — silently, on open.

### Stride 2 — four badges on the model

Each floats at its own point and offers the same number three ways: **chevrons**
for a step, a **pointer drag** for a sweep, and a **typed field** for the truth.
The typed field is the master; a drag never writes a number of its own.

⚠ **The drag projects per gesture, not at a fixed sensitivity.** The same world
foot is a different number of pixels depending on where the camera is, and the
user can orbit between drags — so pointer-down takes the handle's own axis,
projects it to screen, and the drag is a dot product along it. An axis pointing
nearly at the camera is refused rather than running away with the building.
Measured: dragging Depth 38px gave 16'-0" → **13'-0¾"**, a clean eighth.

⚠ **The handles own no resize logic.** Width and depth go to
`handleEditWallLength`, which routes to the stride-1 seam; the height goes to
the same handler the sidebar's height field calls; the ridge rise goes to
`roofProfilePointHeightsFt`. They cannot drift from the typed path because they
ARE the typed path.

⚠ **The roof handles only appear on a single-point roofline.** With two or three
profile points the roof has been shaped by hand and "the ridge" is not point
zero — a badge claiming otherwise would move whichever point happens to be
first.

Default **on for Fabricator, Admin and Engineer and off for Public** — the same
tri-state U4 and U5 use, inverted, because these are controls rather than
scenery and a client should not be offered five ways to resize the building.

### ⚠ The fifth handle is built, tested and HELD BACK

The peak slider — *"the roof slider (slides the peak position)"* — is finished
and is not shipped. A gable peak stored too close to a wall's end produces a
gable row containing a **zero-height tile**, and `buildGablePanelMembers`
**throws** on it during render rather than refusing. That takes the **whole
page** down, not just the 3D stop, because `BuildingSummaryRender` keeps a
`Building3DView` mounted off-screen at all times.

Measured on a 24 × 16 Tiny House: **0in fine, 12in crash, 24in crash, 36in
crash, 48in fine.**

⚠ **The fault is older than this control and nothing here caused it.** The
elevation editor's own Position slider has shipped for weeks with `step={1}` and
reaches every one of those values; that is how it was confirmed pre-existing,
with the 3D view never opened.

⚠ **And the first fix attempt was wrong, which is why the handle is out rather
than fenced.** It snapped the peak clear of the 24in shed-snap threshold — a
defensible rule on its own terms, since inside that band the roof IS a shed at
the end and a badge reading `0'-1"` is lying about the model. But the 36in crash
was already measured and on the page, and 24in is not clear of 36in. Picking a
different number would have been guessing at a building value. So the control
waits for the defect, behind `PEAK_HANDLE_ENABLED`, with its geometry still
under test so it comes back working rather than rotting. The defect is written
up as its own task with the reproduction, the measurements and the two candidate
fix sites.

### Verified in the running app

- Four badges on a Tiny House: Width 24'-0", Depth 16'-0", Wall height 10'-0",
  Ridge rise 5'-4" — the rise being exactly 16ft × 4/12.
- Chevron: Width 24'-0" → 25'-0", through the whole seam.
- Drag: Width 25'-0" → 33'-2" and Depth 16'-0" → 13'-0¾", both snapped.
- Ridge rise and Wall height stepped cleanly, the model grew, no console error
  after a deliberate marker.
- ⚠ A collision the unit test missed: the height badge first hung off the depth
  wall's top plate, which on a one-storey building is within inches of the eave,
  so it landed under the peak slider. The fixture had the eave a foot above the
  wall and showed nothing. The height badge now avoids the gable's wall, and the
  overlap test runs over seven layouts including eave-at-top-plate.

Gates: 3994 tests / 210 files, typecheck clean in all four projects, lint
169 / 119 / 50 — every rule byte-identical to the baseline.
