# The PBM Inspo UI Queue — opened 2026-11-05

The B-queue is a FABRICATION queue: it makes the app cut the right parts. This
one is a different animal — it is about the app being usable by someone who is
not Tommy. Keeping them apart on purpose, because they trade off differently:
a fabrication item is wrong or right, a UI item is better or worse, and mixing
them means the arguable work keeps pre-empting the decidable work.

Source: `pbm-designer-teardown-2026-11-05.md`, his answers the same day.
Numbering is **U1–U9**, matching the teardown's own 1–9 so the two documents
can be read side by side.

---

## Status at a glance

| | item | his word | state |
| --- | --- | --- | --- |
| **U1** | Starter templates | *"brilliant"* — 6 prefabs named | **specced, one input missing** |
| **U2** | Dimension handles on the model | *"genius move"* — 5 handles named | **specced, one risk to settle** |
| **U3** | Per-tool first-use tutorial | yes — *"how would the remembering work?"* | **answered below, ready** |
| **U4** | HIDE tab + Reset View | yes | **ready** |
| **U5** | Site around the building, as a toggle | yes | **ready** |
| **U6** | Props for scale | yes | **ready** |
| **U7** | Share a design by link | yes | **ready, but it is a sharing decision** |
| **U8** | A named path through the app | **Edit → View → Price → Print**, static arrows | **answered, ready** |
| **U9** | Template thumbnails ARE renders | *"absolutely totally awesome"* | **ready, rides on U1** |

Nothing here is blocked by anything in the B-queue, and nothing in the B-queue
is blocked by anything here.

**The order I would build them in**, which is not the numbering:

1. **U4** (hide tab, Reset View) — an afternoon, and it makes every demo of the
   rest better.
2. **U8** (`Edit → View → Price → Print` + static arrows) — small, and it
   renames two buttons, so it should happen before U3 writes any tutorial card
   that names a button.
3. **U1 + U9** (templates with rendered thumbnails) — the biggest single change
   to what a stranger sees, and it needs no new engine.
4. **U6, U5** (props, then the site toggle) — cheap realism, in that order
   because a 6 ft figure tells a client more than grass does.
5. **U2** (dimension handles) — the resize SEAM first, the handle second; see
   its entry.
6. **U3** (tutorials) — once the names and the tools have stopped moving.
7. **U7** (share links) — last, because it is a sharing decision and not a UI
   one.

---

## U1 — Starter templates

> *"6 prefabs include - Tiny House (16x24' shed roof with tall north wall), the
> Tank (24x48 gable roof), octagon (16' or 32' diameters sub options), Cindy
> (see buildinteg.com/cindy for floor plan), square courtyard octagon
> courtyard, or draw your own, log in OR (if logged in) open from cloud."*

Eight tiles: six prefabs, plus **Draw your own** and **Open from cloud** (which
reads *Sign in to open a saved design* when signed out — see
[`backend_stage1_live`], Stages 0–4 are live so the cloud half already exists).

| tile | what it is | what the app already has |
| --- | --- | --- |
| **Tiny House** | 16 × 24 ft, **shed roof, tall wall to the NORTH** | shed roof + tall-wall derivation, both built |
| **The Tank** | 24 × 48 ft, gable roof | gable + ridge column, built |
| **Octagon** | 16 ft **or** 32 ft across — one tile, two sub-options | octagon footprint, built |
| **The Cindy** | his Panel-Ready Plan — 1650 sqft, 3 bed / 2 bath ranch, sloped roof | **plan received 2026-11-05**, see below |
| **Square courtyard** | courtyard building, square | courtyard, built |
| **Octagon courtyard** | courtyard building, octagonal | concentric rings, built |

### The Cindy's dimensions, read off the plan he sent 2026-11-05

He sent the **MAIN FLOOR TOE UP PLAN** at 1/8" = 1'-0", with the panel
schedule above it (**TOTAL PANELS: 74** — N, S, E and W runs, most at 39").
What I can read off it with confidence, and what I cannot:

**Read, and it closes on itself:**

| run | dimension | the chain that proves it |
| --- | --- | --- |
| overall width | **55'-3"** | 32'-6" + 3'-3" + 19'-6" = 55'-3" along the top |
| | | 33'-8" + 21'-7" = 55'-3" along the bottom |
| overall depth | **34'-10"** (= **418"**, which the plan also states) | 14'-2" + 3'-3" + 14'-2" + 3'-3" = 34'-10" down the right |
| bottom right leg | 21'-7" | 2'-1" + 3'-3" + 16'-3" = 21'-7" |
| right inner face | 31'-7" | inside the 34'-10" overall |

Both perimeter chains sum exactly, which is the check worth having: the plan is
internally consistent, so these are measurements rather than my reading of a
drawing.

⚠ **It is NOT a rectangle, and the shape is the part I will not guess at.**
There is a notch in the right-hand wall — the 3'-3" gaps between the two
14'-2" runs — and a step near the bottom where the 2'-1" and 3'-3"
dimensions sit, with a `3 1/2" / 7" / 3 1/2"` wall-thickness callout at the top
of the notch. From one screenshot at this scale I can see THAT the outline
steps; I cannot tell which of those segments are straw-panel walls, which are
the toe-up only, and which way the 7" callout runs. Drawing it wrong would put
a wall length in the app that nobody measured, which is the one thing this app
refuses to do.

**So, to finish the Cindy tile I need one of:** the plan as a PDF or DWG/DXF
rather than a screenshot, OR the wall RUN list the way the app thinks of it
(each wall, its length, and which way it turns) — and the panel schedule you
already have at the top of that sheet would then check my work, panel for
panel, against its 74.

⚠ Also worth a fix on the website while you think of it: `buildinteg.com/cindy`
404s. The page lives at `/the-cindy`. People will type the short one.

⚠ **Each tile is a real drawn design, not a parameter preset.** It arrives with
its footprint, roof and panels already on it, so the first thing a new user sees
is a finished building they can change. That is the whole value — and it lands
cleanly on the *tile once on first draw, direct manipulation after* model
(`tile_once_editing_model`): a template IS the first draw.

**Cost:** small. The pieces all exist; this is a saved-design list with pictures.

## U9 — and the thumbnails are renders of those exact buildings

> *"Number one's response would be so cool to see thumbnail models of that enter
> that building."*

Each tile's picture is a render of **that** building from the same camera angle,
and the tile animates into the live model when picked. `captureMode` already
takes a 3D PNG for the Project Summary, so a saved design can carry its own
thumbnail with no new rendering code. Do it as part of U1, not after.

---

## U2 — Dimension handles on the model

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
panel setting tiling ordering issues here."* Yes — and the answer is already
decided, it just has to be honoured rather than rediscovered:

- Changing **width or depth** changes wall length, which means a retile. Under
  `tile_once_editing_model` a retile is NOT automatic after the first draw, and
  under `panel_type_transition_and_reservations` an opening-anchor retile has
  already lost panels once on a 43'9" × 33' building.
- Changing **height** or either roof handle must **re-derive the roof** —
  `roof_follows_the_shape` records that stored shed profile positions are
  absolute inches and go stale, with **two paths that still bypass the
  re-derivation**. A drag handle would be a third unless it goes through the
  same seam.

So U2's first stride is not the handle. It is: **make resize go through one
seam that retiles and re-derives, and close those two bypass paths.** The handle
is the easy half and should be built second, on top of a resize that is already
honest. Otherwise the most inviting control in the app is the one most likely to
quietly drop a panel.

**Cost:** medium, and front-loaded into the seam rather than the UI.

---

## U3 — A per-tool first-use tutorial

⚠ **The step names change under U8**, so write the cards after U8 lands or the
first thing a new user is taught is a button name that no longer exists.


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

## U4 — A `← HIDE` tab for the left bar, and Reset View

Two single-afternoon wins. The 3D view fights the left bar for width; a hide tab
gives the model the whole screen for a client walkthrough. Reset View saves
every user who has orbited themselves under the floor. **Cost:** tiny.

## U5 — A site around the building, as a toggle

Grass, sky, horizon, a shadow. ⚠ **Defaulted OFF for the fabricator role and ON
for a client-facing one**, so a shop drawing never gains scenery and a homeowner
never sees a grey void. The ground plane is already written and deliberately
disabled (2026-10-29, *"it blocks the floor panels from being visible"*) — this
is that decision revisited with a switch instead of a deletion, and the floor
panels are exactly why it must stay a switch.

## U6 — Props for scale

A 6 ft figure, a car, a tree. The cheapest realism in their whole product, and
the one thing that tells a client whether a 12 ft wall is big.

## U7 — Share a design by link

A `?shareid=` URL, no account needed to view. The backend for this is live.
⚠ **It is a sharing decision, not a feature decision**: a link showing the
client render is a different object from one showing the cut list and the
prices. Decide what a shared link contains BEFORE building the button — and
read the backend's own notes first, because an unlisted URL is public to anyone
it is forwarded to.

---

## U8 — A named path through the app — **answered 2026-11-05**

> *"I've been trying to kind of get at that with how the buttons are ordered and
> all always visible. Maybe... We can meld these ideas into basically how it is
> right now except with arrows between each button. I suppose with the autodraw
> a preplan one would start in 3D framed... Which is now titled View. Let's
> interview about this one."*

What he is describing is not PBM's wizard — it is the bar he already has, with
the ORDER made visible. The bar stays flat and always-available (every door
open, `ui_overhaul_architecture`), and arrows between the buttons say which way
the work usually runs. A starter template (U1) would land you further along that
path than a blank canvas does, which is why he raises the two together.

**His three answers:**

1. **The steps are `Edit → View → Price → Print`.** Note what he changed: not
   today's names (Design) and not my verbs (Draw it). **Edit** is the honest
   word for a door you come back to — you do not draw a building once and leave
   drawing behind, you edit it all the way to the shop. And **Price** replaces
   **Summary**, which named the page rather than the reason you open it.
   ⚠ This renames two live buttons: Design → Edit, Summary → Price.
2. **The arrows just sit there.** Static chevrons. No step is ever marked
   "done", nothing glows, nothing is clickable — so there is no state for the
   app to be wrong about, and no newcomer is told they have finished something
   they have not. The bar stays flat and always-available
   (`ui_overhaul_architecture`): every door open, with the usual direction
   drawn between them.
3. **A starter template lands you in View — the 3D framed model.** The template
   animates in and you are looking at a finished building. This is what ties
   U1 and U8 together: the template puts you two steps along the path rather
   than at a blank canvas, and the path is there to tell you where you are.

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
