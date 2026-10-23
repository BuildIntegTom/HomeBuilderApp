# Floor and roof panels, then the octagon ring roof — queued 2026-10-22

Tommy, in his own words, setting the next block of work:

> *"Let's put all this in the queue: floor and roof panels complete with 3d
> rendering and [shop] fabrication pages, then octagon roof (tall inner wall
> inclined panels and shorter outer wall inclined panels with a roof panel
> in-between and then I guess triangle roof pieces around the corners). Part of
> roof install will include sleepers, membrane, and decking, and
> roofing/shingles or metal). All the materials listed there should have cut
> list and totals, an option to be worked in with the 3d membranes and or boxes
> editor - to be interviewed when we get there"*

Four things, in his order. The last line governs all of them: **the details are
to be interviewed when we get there, not guessed at now.**

---

## 1. Floor and roof panels — complete

"Complete" is doing real work in that sentence. A panel type is finished in this
app when it exists in four places, and every one of them already exists for wall
panels:

| | Where it lives today |
|---|---|
| The member geometry | `packages/panel-catalog/src/*Members.ts` |
| The 3D view | `Building3DView.tsx` — framed, boxes and membranes |
| The shop sheet | `PanelFabricationPage.tsx`, one page per unique panel |
| The cut list | the fabrication sheet's own list, with `shopCutNotes.ts` for angles and jig dimensions |

So "complete with 3d rendering and shop fabrication pages" means a floor panel
and a roof panel each need the same four, not just a shape in the model.

⚠ **The floor already has framing, and this is not starting from nothing.** The
Floor tab's rim and field framing shipped 2026-08-01, with a default floor type
and a clay/steel bottom skin through Plaster Master. What it does not have is a
PANEL — a fabricated unit with its own members, sheet, cut list and 3D form.

---

## 2. The octagon ring roof, as panels

His description is a parts list, and it matches the ring roof geometry committed
2026-10-22 exactly:

> *"tall inner wall inclined panels and shorter outer wall inclined panels with
> a roof panel in-between and then I guess triangle roof pieces around the
> corners"*

- **Tall inner wall inclined panels** — the inner ring carries the ridge, so its
  walls are the high ones. Already true in the geometry, and already tested:
  the slope runs outward, high at the courtyard, by his decision of 2026-10-22.
- **Shorter outer wall inclined panels** — the outer ring is the eave side.
- **A roof panel in-between** — one per plane. `ringRoofPlanes` already produces
  exactly these, with the rafter run, rise and true sloped area on each.
- **Triangle pieces around the corners** — the hips. ⚠ **These are the part the
  geometry does NOT yet name.** The planes meet at each corner of the ring, and
  nothing computes that joint. An octagon ring has eight of them; a rectangular
  one has four.

So three of the four parts have their geometry and the fourth is a known gap.

---

## 3. Roof build-up: sleepers, membrane, decking, roofing

> *"Part of roof install will include sleepers, membrane, and decking, and
> roofing/shingles or metal."*

Four layers above the panel, each needing its own quantities. ⚠ **Nothing in
the app models any of them today.** The membranes 3D view draws wall wraps, not
a roof build-up.

⚠ **Every number here is a real-world building value**, so the flags check in
`building_integrity_app_spec.md` applies to all of it: sleeper size and spacing,
membrane coverage and laps, decking thickness and sheet size, roofing exposure
and fastener counts. Anything not confirmed by Building Integrity ships marked
pending-BI-confirmation, the way the Shipping and Plaster Master defaults
already do.

---

## 4. Cut list and totals for all of it

> *"All the materials listed there should have cut list and totals."*

The cut list already handles dimensional lumber with lengths and angles, plus
the jig note for an inclined cut (his decisions of 2026-10-11 and 2026-10-13).
What it has never had is **sheet goods and rolls** — decking, membrane and
roofing are bought by the sheet or the roll, not cut to a length, so totals mean
coverage and waste rather than a list of pieces. That is a different kind of
line on the same page.

---

## 5. The 3D membranes / boxes option

> *"an option to be worked in with the 3d membranes and or boxes editor - to be
> interviewed when we get there"*

Both views exist: `simplified3D` is boxes, `showWraps` is membranes. Flagged as
his, deliberately unspecified, and **not to be designed until he is interviewed
on it.**

---

## What I would ask when we get there, written down so the interview is short

Not questions for now — his instruction was explicit. Recorded so they are not
rediscovered from scratch:

1. **Is a roof panel a panel, or a truss?** The wall panel is a fabricated box
   with its own frame. A roof panel between two rings might be the same thing,
   or it might be a rafter/truss assembly with decking over it — and the cut
   list is completely different either way.
2. **Do the corner triangles ship as panels, or are they cut on site?** Eight
   non-rectangular pieces per octagon ring is a lot of bespoke fabrication.
3. **Where does the build-up start?** Sleepers on top of the panel implies a
   vented cavity; decking straight on implies not. That decides whether the
   membrane goes under the sleepers or over the decking.
4. **Does the courtyard eave need a gutter?** The roof sheds outward, away from
   the courtyard, so the courtyard side is the HIGH side and has no eave — worth
   confirming that means no drainage detail there at all.

---

## Where this sits in the order

The wall-tools order from 2026-10-20 is finished: per-corner miter, draw-wall,
joint snapping, shape offset and the second loop are all built and pushed. The
ring roof's geometry went in on 2026-10-22.

What remains outstanding from earlier, separately from this block:

- the ring roof has **no pitch control and no 3D or elevation rendering** — it
  is correct geometry and numbers, not something you can look at yet;
- the **safety-gap anchor move** (his "inside of the last panel" restatement,
  with one question still open about whether the corner panel counts as the
  last panel);
- **custom SMTP** for strawpanels.com, since the built-in email limit is
  already being hit.
