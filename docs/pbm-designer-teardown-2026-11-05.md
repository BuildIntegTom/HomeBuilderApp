# The PBM / ACT designer, used and taken apart — 2026-11-05

Larry's link: `portablebuildingsandmore.com/pbmdesigner`. The page is a wrapper;
the designer itself is **ACT Building Systems**, white-labelled per dealer, at
`pbm.actbuildingsystems.com`. I drove it as a customer would: picked a template,
read its tutorials, edited dimensions, opened the Openings tool, pressed Quote
and pressed Share.

⚠ **Know what it is before copying from it.** It is a **lead-capture
configurator for a steel-building dealer**. Its job ends at *"a salesperson will
call you"* — pressing QUOTE opens a name/company/site-address form and no price
is ever shown. Our app's job starts roughly where theirs stops: it has to cut
real parts. So the things worth taking are the ones about **how it feels to
use**, not how it is built.

---

## What it actually has

**Tool rail** (bottom, icon + word, one row): View · Dimensions · Edit ·
Leantos · Openings · Bays · Mezzanine · Props.

**Start:** *"Choose a starter template"* — a grid of 3D thumbnails, each a real
render of that building: Gable, Single slope, American Barn, Gambrel, and more.
No blank canvas.

**The scene:** sky, horizon, grass, trees, a shadow under the building, ribbed
steel textures on walls and roof. Dimension lines drawn on the ground with the
figure on them.

**Editing on the model:** circular badges float on each face — width, length,
height, pitch — with up/down chevrons beside them. The number is also in a
labelled text box in the side panel, written `30'`.

**Wizard spine:** the panel ends with a big **NEXT — Set colors and options**
button, so the whole thing is a path, not a toolbox.

**Chrome:** UNDO, RESET VIEW, a `?` help bubble in the corner, an `← HIDE` tab
that collapses the side panel to give the model the screen, and an **Options**
menu holding three view switches — Sheeting, Dimensions, Props.

**Teaching:** a first-run tour (orbit / pan / zoom, each with its own little
illustration), then **a separate illustrated tutorial per tool, the first time
you open that tool**, each ending in GENERAL HELP · DONE.

**Share:** a `?shareid=…` URL plus Email / Facebook / X. No account needed.

---

## What we already do better, and should not trade away

- **We produce a price and a cut list.** They produce a phone call.
- **Every figure of ours is derived from real member geometry.** Their model is
  a sales render.
- **Our documents are the product** — shop sheets, takeoffs, exports.
- **We refuse to invent numbers.** A pending-BI flag has no equivalent there.

---

## The upgrades worth taking, in the order I would do them

### 1. Starter templates instead of a blank canvas — **do this one first**

Their first screen is six buildings you can click. Ours is *"Click and drag to
draw the footprint."* For anyone who is not Tommy, that is the whole difference
between starting and not starting. A grid of six: Small Shed, Garage, ADU,
Barn, Two-Storey, Courtyard — each one a real drawn footprint with a roof and
panels already on it, so the first thing a new user sees is a finished building
they can change. We already have every piece; this is a saved-design list with
pictures.

**Cost:** small. **Risk:** none. **Meeting value:** very high — it is the first
thing anybody sees.

### 2. Dimension handles on the model itself

Their badges sit on the building and change its width, length, height and pitch
in place. We have exact numeric fields (which they do not — ours take ⅛″ and
feet-inches properly), but you have to find the right panel. Floating the same
three or four numbers on the 3D model, each editable in place, would cost us
nothing in precision and remove the hunt.

⚠ Ours must keep the typed value as the master — the drag is a convenience, the
number is the truth. That is the same rule the panel editor's stride 2 drag is
being built under.

**Cost:** medium. **Risk:** low.

### 3. A per-tool first-use tutorial

Not a manual — three illustrated cards the first time you open a tool, with
DONE and a link to general help. We have a Read Me and a `?`; we have nothing
that teaches a tool at the moment you first touch it. Our tools genuinely need
it more than theirs do: the right-click panel menu, the panel editor and the
Panelizer settings are all discoverable only if somebody tells you.

**Cost:** medium (the writing is the work, not the code). **Risk:** none.

### 4. A `← HIDE` tab for the side panel, and a Reset View button

Two single-afternoon wins. Our 3D view fights for width with the left bar; a
hide tab gives the model the whole screen for a client walkthrough. Reset View
is one line and saves every user who orbits themselves under the floor.

**Cost:** tiny. **Risk:** none.

### 5. A real site around the building, as a toggle

Grass, sky, a horizon and a shadow. Ours is a grey void — honest for a
fabricator, cold for a client. ⚠ **As a toggle, defaulted OFF in the fabricator
role and ON in a client-facing one**, so a shop drawing never gains scenery and
a homeowner never sees a grey void. The ground plane is already written and
deliberately disabled (2026-10-29, because it hid the floor panels) — this is
that decision revisited with a switch instead of a deletion.

**Cost:** medium. **Risk:** low, if it stays a toggle.

### 6. Props for scale — a person, a car, a tree

Their Props toggle is the cheapest realism in the whole product, and it is the
one thing that tells a client whether a 12ft wall is big. One 6ft figure beside
the building does more than any dimension line.

**Cost:** small. **Risk:** none.

### 7. Share a design by link

Their `?shareid=` sends a design to anyone with no account. We have the backend
for this already (Stages 0–4 are live) — what is missing is the one button and
a read-only URL. ⚠ Worth deciding deliberately **who can see what**: a shared
link showing the client render is a different thing from one showing the cut
list and the prices.

**Cost:** medium. **Risk:** real, because it is a sharing decision — see the
backend's own notes before building it.

### 8. A named path through the app, not a toolbox

Their NEXT button names the next step: *"Set colors and options."* Ours has
Design / View / Summary / Print, which is a filing system rather than a path.
A single **"What's next?"** strip — Draw it → Panelize it → Price it → Print it
— would give a first-time user a spine, and every one of those steps already
exists.

**Cost:** small. **Risk:** low. ⚠ Must not replace the existing tabs; it sits
beside them, because Tommy himself does not work in a line.

### 9. Starter-template thumbnails ARE renders, not icons

Worth stealing specifically: each template picture is a render of that exact
building from the same camera angle. We already capture a 3D PNG for the
Project Summary (`captureMode`), so a saved design could carry its own
thumbnail with no new rendering code.

**Cost:** small, on top of #1.

---

## What I would NOT take

- **Their quote flow.** Handing a customer to a phone call is a step backwards
  from a priced takeoff.
- **Dropdown-only pitch.** Theirs offers `3:12` from a list. Ours takes a real
  number, which matters once a roof has to be cut.
- **Their dimension entry.** `30'` in a text box with no fractions is fine for
  steel; it would break the ⅛″ rule this app is built on.
- **Tutorial modals that block the screen on every tool, every time.** First use
  only, and dismissible for good.

---

## One honest caveat

I used the dealer's live configurator as a visitor. I did not submit the quote
form, so I have not seen what a customer receives afterwards — if that
follow-up contains a priced bill of materials, the comparison in *"what we do
better"* above gets weaker and is worth re-checking before anyone repeats it in
a meeting.
