# Draft message to Larry — 2026-11-23

Subject: **K panel brace ends — I think the analysis assumed a joint we don't build**

---

Larry,

Read the whole thing. Before you spend more on the steel plates, I think one
assumption in there doesn't match how we actually cut the panels, and it's the
assumption that sent you to steel.

**The brace end.** The analysis takes the diagonal as lying flush in the frame
plane, so no member overlaps another and there's no face to screw through. We
don't build it that way. A brace end is a **true plumb cut flush to the stud's
own face**. A screw driven **level through the stud** then travels in the plane
of the panel, enters that cut face, and runs **lengthwise into the brace** — not
through its 1½in thickness. The depth available that way is the brace's 3½in
width divided by the sine of its slope, which is over 5in on a typical brace.

**So the penetration arithmetic comes out differently.** ESR-2442 lists the
5/16 x 4in RSS at 3⅞in under the head, not 4in. Through a 1½in stud that leaves
**2.375in**, against 6D = 6 x 0.276 = **1.656in**. Penetration isn't the binding
constraint, and 2.375in is also exactly Table 3's minimum row for this screw —
so it qualifies for the tabulated value, with **zero margin**. (That zero is
worth knowing in its own right: any thickening of the side member, a skin the
screw has to cross, or a head left standing proud, drops us off the table and
onto the calculated values.)

**Which means two of the three reasons for abandoning screws may not apply to
our panel:** the screw is driven perpendicular to the side member's face, so
it's inside the report's scope rather than an inclined screw outside it; and
5/16 reaches penetration without lapping the diagonal or dropping to ¼in.

**Your corner crowding is a separate matter and I'm not claiming it's solved.**
That looks like a property of the K's topology — two diagonals landing on one
chord at mid-height — rather than of the screw, and nothing above makes it go
away.

**On EcoCocon: I'm confident they predrill.** That's also what we already
specify — "two 5/16 GRKs each end, predrilled and driven" has been our shop
instruction since October. Splitting is what drives the big self-drilled spacing
and end distances; a lead hole takes out the wedging that splits. Your own
write-up says it in passing — *"predrilling relaxes the edge distances if you
need it"* — and then moves on. **Does ESR-2442 allow predrilling for the RSS
line, or does that take us off its tables and onto NDS Chapter 12 values for a
lag-type connection?** You have the report and I don't.

---

## Two questions where your answer moves our numbers a lot

**1. Does C_eg apply to this joint?** Our screw enters a cut face and runs
lengthwise into the member, which looks like the geometry the end-grain factor
exists for. We've been taking C_eg = 1.0. If it should be 0.67, our brace-end
capacities drop by a third — and since we're sitting exactly on Table 3's
minimum penetration with no margin, that's not a rounding question.

**2. Does predrilling buy back the corner spacing?** We've been taking C_Δ = 1.0
on the grounds that our spacings are well above Table 5's minimums. Your corner
note says the opposite is true at the most heavily loaded joint in the panel.

Both of those are one sentence from you and neither needs a test program.

## Two catches in the numbers themselves

**3 panels vs 4.** You wrote "3 or 4 such panels." At 4 the four 5/16 screws
into the LVL top plate are about 225 lb each and fine. **At 3 they're about
300 lb against roughly 290 lb of capacity** — so a three-panel wall wants a
fifth screw, or we set a rule of at least four K panels per 40ft wall. Worth
deciding which, because four per panel is what we build today.

**Plates on both faces.** When you say the 8 x 10s go on the inside as well as
the outside — do you mean one per frame on each frame's outer face (6 plates a
panel, which is what the drawing shows), or **both faces of every joint, 12
plates and about 176 nails a panel?** The second would resolve the one-sided
eccentricity your write-up flags, but it buries a plate in the straw cavity.

## One more thing worth moving up the test program

Your note that the straw may brace the diagonal against buckling through the
thickness takes the compression capacity from about **980 lb to about 4,700 lb**.
That's a 4.8x swing and it's the largest single uncertainty in the whole
analysis — bigger than the connection choice. If a racking test settles it
early, it may change which connection we even need, since at 980 lb the
three-panel wall is marginal and at 4,700 it isn't close.

Happy to build a prototype either way — but I'd rather know whether screws are
back on the table before we tool up for plates and a connector nailer.

Tommy

---

**Attached:** a screen from the fabricator app — the Shear Derivation sheet it
produces for a 16 × 24 building. It's the capacity half in the units your
demand calc is already in, per brace and per wall line in lb/ft, with every
input labelled for where it came from. Note the line under "Per brace": each
brace is taken as a pin-ended strut buckling about its 1½in dimension *because
nothing restrains it out of the wall's plane* — i.e. we are not crediting the
straw. That is the 980 lb end of the swing above. If a racking test moves it,
every number on that sheet moves with it.

The sheet's own header says what it won't do: *"This sheet reports CAPACITY
only. It does not name a seismic zone or a design category, because a rating is
capacity measured against DEMAND and this app has no demand figures."* Your
115 mph / Exposure C / SDC A–B envelope is the first demand number anyone has
given it. If you're happy for me to use it, the app can start saying when a
building is inside the envelope you've analysed — and, just as usefully, refuse
when it isn't.
