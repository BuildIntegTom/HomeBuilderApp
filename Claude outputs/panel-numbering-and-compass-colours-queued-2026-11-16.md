# B35 — Sequential panel numbers, and compass-coloured labels

**Queued 2026-11-16 at his request: *"give me a sanity check on this change and
lets consider it to be planned and added to the queue."* Nothing is built.**

> *"I was looking at the upload file for t4t and i honestly really liked how it
> gives the panels name. this is going to be a bit odd... but could we consider
> renaming all of the panels to go from point of least accessability,
> clockwise, from out to in, from bottom to top by label of 0000, 0001, 0002,
> etc. To make it visually easy to read, lets color code each compass direction
> the same color as chinese fungshei recommendations. so if the point of least
> accessability is nw on a square house, then the first panel of the run is
> 0001 and its label is colored blue (or whatever fengshu color for north is)."*
> — Tommy, 2026-11-16

---

## ✅ THE SANITY CHECK, SHORT VERSION

**The ordering half is sound and mostly already built. The naming half has one
serious problem and three collisions with decisions he has already made.**

Taking it in the order that matters:

| | verdict |
| --- | --- |
| **The ORDER he describes** | ✅ **Already exists.** Not a new idea in the app — his own, from the truck-loading work. |
| **"Clockwise"** | ✅ **Already the walk direction.** Nothing to decide. |
| **A global sequential NUMBER as the panel's name** | ⚠ **This is the problem.** It renumbers. The very thing he liked about the T4T codes is that they cannot. |
| **One number per panel vs. the shop packet** | ⚠ **Collides with grouping**: a Tiny House goes from ~12 fabrication sheets to 84. |
| **A number INSTEAD of the name** | ⚠ **Collides with B25**, his own 2026-11-04 ask that every sheet say what it is. |
| **Compass colours** | ⚠ **Collides with the TYPE colours** already on those sheets, and three of the eight Feng Shui colours cannot be printed on white paper. |
| **"Out to in"** | ✅ Fine, and only means anything on a courtyard. One known trap. |

---

## ✅ What already exists — the good news, and it is most of the ordering

**"Point of least accessibility" is already a real field in this app, already
his, and already persisted with the project.** `leastAccessibleCorner` is set
by the user (defaults to corner `A`), saved in the project file, and already
drives two things: the **truck load order** and **draw-time bracing's start
end**.

And `computePanelLoadOrder` already does precisely what he just described:

> *"The stack order must correlate to the point of least accessability. If the
> PLA is on the top left (NW) then that panel on the corner is the top of the
> first stack, and it's row stacked under it"* — Tommy, earlier

It rotates the wall ring to start at whichever wall begins at that corner and
walks the whole perimeter from there.

⚠ **And "clockwise" is already the direction.** The footprint's wall ring is a
consistent perimeter traversal, `wallCompassDirection` treats **screen-up as
North**, and a rectangle is built `A(0,0) → B(w,0) → C(w,d) → D(0,d)` — which
on a y-down plan is top-left → top-right → bottom-right → bottom-left, i.e.
**clockwise as drawn**. So his instruction matches the existing walk with
nothing to reverse.

**So the ordering spine of this change is a label on a sequence the app already
computes.** That is a much smaller job than it sounds.

---

## ⚠ THE ONE SERIOUS PROBLEM: a sequential number RENUMBERS

This is the thing to decide before anything else, because it decides whether
the feature is small or needs a migration.

A number that counts along the install sequence is a **position**, not an
identity. Insert one window on the north wall and **every panel after it
shifts by one**. Drag a wall longer, change the panel width setting, turn on
safety gaps — same. A crew holding a cut sheet for `0042` would be holding a
sheet for a different panel than the one the app now calls `0042`.

⚠ **And this is exactly the problem the Tip4urTime export already solved —
which is almost certainly what he actually liked about it.** That code is
**stamped at first export and stored from then on, specifically so it can never
renumber**, and it is a join key rather than a name. The stability he admired
comes from *storing* it, not from the numbering scheme.

That leaves three honest options:

1. **Derive it and call it what it is — a position.** `0042` prints as the
   install-sequence position *for this revision*, with that said on the sheet,
   and the stored T4T code stays the thing that identifies a panel across
   revisions. **Smallest change, no migration, no new stored state, and it does
   not touch his derived-identity rule** (*"not from a memory file"*). The cost
   is that the numbers are only good for the packet you printed.
2. **Store it, like the T4T code.** Stable forever, but it is stored panel
   identity, which is the rule he set — so it would need him to say the rule
   bends here, plus a migration and a "renumber this project" command for when
   a design changes enough that the sequence is nonsense.
3. **Both**: derive the install number for the packet, and keep the stored code
   as the identity. This is option 1 with the relationship stated plainly on
   the sheet.

**Recommendation: option 1 (or 3, which is the same thing described better).**
An install-order number is genuinely useful *as* an install order — it tells
the crew what comes off the truck next — and that is worth having even though
it moves when the design does.

---

## ⚠ Three collisions with decisions he has already made

### 1. The shop packet GROUPS identical panels. Unique numbers un-group it.

A Shop Fabrication page today covers **every panel that is physically the
same** — that is what `groupKeyFor` is for, and getting it wrong has produced a
real defect three separate times (all sixteen octagon corner panels sharing one
sheet, so half would have been built mirrored). On a Tiny House that is roughly
a dozen sheets for 74 panels.

Give every panel a unique name and, if the name becomes the group key, **every
panel gets its own sheet: 74 sheets instead of a dozen**, and his pusher-head
sheet order (≤48″ first, B25) loses its meaning.

**Recommendation: the number is a per-instance TAG, not a group key.** The
shared sheet keeps saying what to build and adds a line: *"this sheet builds
0007, 0012, 0019, 0044."* The crew reads the number off the panel-location
drawing; the shop reads the sheet. Nothing un-groups.

### 2. A number does not tell the shop what to build — and B25 was about exactly that

On 2026-11-04 he asked for the opposite of anonymity: **height + distinct name
+ type colour on every panel sheet**, which is why a sheet says
`10' Super Carrot (L) 48"` rather than a code. `0042` tells a crew *where it
goes*; it does not tell a cutter *what it is*.

**Recommendation: additive, not a rename.** The number joins the name, it does
not replace it: `0042 · 10' Super Carrot (L) 48"`. His word was *"renaming"*,
so this is the one place I am reading past his literal ask — flagged rather
than done quietly.

### 3. The app already colour-codes panels. A second colour system means two meanings for green.

Panel sheets already carry **type colour** — box beam green, truss plate blue,
floor and roof sheet colours (B25 / B27 / B28). Feng Shui green for East and
blue for North would collide with both.

**Recommendation: the direction colour goes on the LABEL CHIP only**, and the
type colour stays on the panel body where it already is. Two colour systems in
two places, never the same pixel. Worth him confirming, because it is his eye
that has to read it.

---

## ⚠ The Feng Shui palette: three of the eight cannot be printed

The canonical bagua element colours by direction, and the problem with each:

| direction | element | canonical | ⚠ problem | print-safe proposal |
| --- | --- | --- | --- | --- |
| **N** | Water | **black**, dark blue | He said blue. Blue is water's *second* colour; canonical is black, which is also the ink colour. | **dark blue** — his instinct, and defensible |
| **NE** | Earth | beige / sandy | Nearly invisible on white | **tan / ochre**, darkened |
| **E** | Wood | green | — | **green** |
| **SE** | Wood | green or purple | Would be identical to E | **purple** (the usual SE alternate) |
| **S** | Fire | red | ⚠ red-vs-green is the commonest colour-blind pair, and S sits opposite N not E | **red** |
| **SW** | Earth | pink / light brown | Pale | **rose**, darkened |
| **W** | Metal | **white** | ⚠ Invisible on a white sheet | **slate with a dark outline** |
| **NW** | Metal | **grey**, white | ⚠ Reads as "disabled" in every UI | **steel grey, outlined** |

⚠ **Two rules that have to come with it, whatever the palette:**

- **The compass letter stays on the chip.** Colour is never the only carrier of
  the information — not for a colour-blind crew member, not for a photocopied
  sheet, not for a sheet faxed to a supplier.
- **It has to survive being printed in black and white**, because the shop
  packet will be. Which is the same rule.

---

## ⚠ Four things his instruction does not yet settle

1. **Which items get numbers?** Wall panels only, or also floor panels, roof
   panels, truss plates, box beams and mid-wall beams? ⚠ **And safety gaps**,
   which by his own 2026-11-14 decision *"simply don't count as panels"* but
   **are** shop items. If the sequence is the install order, the floor deck
   installs first (his packet order: floor → walls → truss plate → roof), so a
   strict bottom-to-top sequence numbers the whole floor deck before panel
   `0001` of any wall.
2. **`0000` or `0001`?** He wrote both. **Recommendation: `0001`** — `0000`
   reads as "unset" wherever it appears.
3. **"Out to in"** only means something on a courtyard or concentric building.
   ⚠ And there is a known trap: the **inner ring winds the opposite way**, so
   "clockwise" has to be defined *in plan*, not in loop order — the same hazard
   that made compass directions come out backwards on the inner ring in
   October. Ring-major (finish the outer ring, then the inner) is the obvious
   reading of his words and matches install order.
4. **Everything that cites a panel name today changes with it** — the Review
   Log, the elevation drawings, the overlap reports, the spanning-header sheets
   (*"East wall — spans E4, E5"*) and the Tip4urTime export's own name column.
   Either they all switch, or the app has two vocabularies, which is the exact
   problem `wallDisplayLabel` was written to end.

---

## What I would build, if he takes the recommendations

Three strides, none large, because the ordering already exists:

1. **The number.** Extend `computePanelLoadOrder` to cover stories and the
   non-wall shop items, derive a 4-digit install-sequence position from it, and
   put it on the panel-location drawing and as a tag line on each shared
   fabrication sheet. No stored state, no migration.
2. **The chip.** Compass letter + print-safe direction colour, on the label
   chip only, with the type colour untouched. One shared component so the plan,
   the elevation and the sheet cannot disagree.
3. **The crew export.** Add the install-sequence column to the Tip4urTime CSV
   beside the stored code, so the crew app can sort by truck order while the
   stored code stays the join key.

⚠ **Not in scope unless he says so:** making the number a stored identity,
re-grouping the shop packet, or removing the distinct names.
