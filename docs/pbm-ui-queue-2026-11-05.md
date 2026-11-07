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
| **U2** | Named path, static arrows | **Edit → View → Price → Print** | **answered, ready** |
| **U3** | Starter templates + rendered thumbnails | *"brilliant"*, *"absolutely totally awesome"* | **specced and unblocked — Cindy ships as its overall rectangle, 2026-11-06** |
| **U4** | Props for scale | yes | **ready** |
| **U5** | Site toggle | yes | **ready** |
| **U6** | Dimension handles | *"genius move"* — 5 handles named | **specced, one risk to settle first** |
| **U7** | Per-tool tutorial | yes — *"how would the remembering work?"* | **answered below; follows U2** |
| **U8** | Share by link | yes | **ready, but it is a sharing decision** |

Nothing here is blocked by anything in the B-queue, and nothing in the B-queue
is blocked by anything here. **The B-queue goes first** — his call, 2026-11-06.

**Why this order:**

- **U1** is an afternoon, and it makes every demo of everything below it better.
- **U2** is small and **renames two live buttons**, so it must precede U7, or
  the first thing a new user is taught is a button name that no longer exists.
- **U3** is the biggest single change to what a stranger sees, and it needs no
  new engine.
- **U4 before U5**, because a 6 ft figure tells a client more than grass does.
- **U6** is front-loaded into a seam, not a UI — see its entry.
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

## U5 — A site around the building, as a toggle

Grass, sky, horizon, a shadow. ⚠ **Defaulted OFF for the fabricator role and ON
for a client-facing one**, so a shop drawing never gains scenery and a homeowner
never sees a grey void. The ground plane is already written and deliberately
disabled (2026-10-29, *"it blocks the floor panels from being visible"*) — this
is that decision revisited with a switch instead of a deletion, and the floor
panels are exactly why it must stay a switch.

---

## U6 — Dimension handles on the model

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
