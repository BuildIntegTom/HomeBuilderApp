# B36 — the panel's name is its number

**Queued 2026-11-17.** His ask:

> *"names that say what the wall does might be good? like i or e or x for
> interior exterior? im open to how you think logically the best way to
> approach this would be. gosh i do like the 0001 naming convention though...
> true true confusing if panels move around and such but like... who cares if
> at the begining of the design the panels jump around drastically. if there
> was some fool proof way to make 0001 naming scheme work id be open to it."*

**Short answer: he can have the 0001 scheme, and the foolproof mechanism is
already built — it is the Tip4urTime code.** The work is making it the panel's
label everywhere instead of only in the crew CSV, and un-jamming the ambiguous
token that currently serves as the key for everything.

---

## ⚠ First, a real defect this question uncovered

The ambiguity is **not cosmetic**. The concatenated name is the KEY that both
numbering systems are stored against, and the two key builders are byte-identical
formulas:

```ts
// tip4urTimeCsv.ts            // installSequence.ts
`${panelFamily}|${leaf}`       `${family}|${leaf}`
```

A panel's name is `` `${series}${panelNumber}` `` (`panelInstances.ts:430`), so:

```
wall "C2", panel 1   ->  "C2" + "1"   ->  C21
wall "C",  panel 21  ->  "C"  + "21"  ->  C21
```

**Measured, not argued.** Stamping both through the real ledger:

```
codes stamped for the two panels: {"Wall panel|C21":"P-0001"}   nextSeq 2
```

**Two different panels, one code.** That is the exact failure the Tip4urTime
module warns about in its own comment — *"share a code, and a crew would be paid
once for two panels"* — and it is reachable through the ordinary naming rule
rather than through any mistake. The compass series does it too: `N2`+`1` and
`N`+`21` are both `N21`.

### How reachable is it today?

It needs **a wall with 21+ panels AND a second wall in the same series**.

- 21 panels at 48in is roughly an **84ft** wall. The Cindy, the longest tile, is
  55'-3" ≈ 14 panels.
- A second wall in a series comes from a bump-out (`N` → `N2`) or a second
  interior wall (`C` → `C2`).
- ⚠ **The Multiplex now ships with `C`, `C2` and `C3` by default**, so half the
  condition is the normal case as of stride 3c.

So: **not reachable on today's eight tiles, and one bump-out on a long building
away.** It is latent, not live — which is why this is a queued plan and not a
hotfix, and why it should not sit in the queue indefinitely either.

---

## There are THREE numbering systems on the same panels right now

| | what it is | derived or frozen | where it shows |
| --- | --- | --- | --- |
| **Name** `C21` | which wall, which position along it | derived | every drawing, sheet, export |
| **Install number** `0042` | position in the install sequence (B35) | **derived** | the coloured chip |
| **Tip4urTime code** `P-0042` | the panel's identity to a crew | **frozen at export** | the crew CSV only |

⚠ **A panel can be install-number `0042` and code `P-0017` at the same time.**
Two four-digit numbers, same panel, different values, shown to two different
crews. That is a bigger practical hazard than `C21` ever was, and nobody has
hit it yet only because the Tip4urTime export is new.

---

## ⚠ The idea that resolves it: a number is an IDENTITY, an order is an ORDER

B35 made the install number both at once, which is why "panels move around"
feels like a problem. Split them and his instinct is exactly right:

- **The number identifies the panel.** It must never change once somebody has
  acted on it — and before that, nobody cares what it is. *"Who cares if at the
  beginning of the design the panels jump around drastically."*
- **The install order is a separate fact** — "step 42 of 134" — recomputed
  freely forever, because it describes the build, not the part.

### The foolproof rule already exists, written down and shipped

`stampPanelCodes` + `PanelCodeLedger`, from the Tip4urTime work of 2026-11-14:

1. **While designing**: nothing is stamped. Numbers are derived, and they jump.
2. **At issue** — the project going to a crew — every panel without a number
   takes the next one, and the ledger is stored with the project.
3. **After that**: a stamped panel keeps its number *forever*. A new panel takes
   the next unused number. **A deleted panel's number is retired, never reused.**

That is the whole of "foolproof", and it is already the rule the crew export
runs on. The only reason it feels absent is that it lives in one export instead
of being the panel's name.

---

## What I'd do about the letters, and why not his first instincts

**His `i` / `e` / `x` for interior / exterior:** half of it is redundant and half
of it is a shop-floor hazard.

- An **exterior** wall already carries a compass direction (`N`, `SE`, …), which
  is what tells a crew *which wall to walk to*. Adding `e` says nothing the
  letter did not.
- **`I` is a bad character on a printed label** — it reads as `1`, and `I1`
  reads as `11`. That is a real fabrication risk and it is the concrete reason
  to keep **`C`** rather than inertia. (`X` is fine as a character but means
  nothing to a framer.)

**Names that say what the wall does** (`RIDGE1`, `PURLIN-W1`) are the one option
I'd argue against hardest, even though he raised it first: **a wall's job
changes when the roof changes.** Flatten the pitch and a purlin wall may no
longer be under a purlin; slide the ridge and the centre wall stops carrying it.
This app has already been bitten by exactly that class of bug — a stored shed
profile position that went stale when the building was resized — and the
standing rule from the panel-identity work is that identity is **derived, not
stored**. A functional name that has gone stale is worse than an ambiguous one,
because it is confidently wrong.

**So the wall keeps its compass letter or its `C`**, and it stops being jammed
against a digit.

---

## The plan — three strides

### ✅ Stride 1 — close the collision. BUILT 2026-11-18, and smaller than planned

⚠ **Two things measured after this plan was written changed the fix.**

1. **A separator is ruled out by the shop.** *"I have spray paint stencils in
   the shop, and there is no huphen stencil. So let's drop the hyphen."*
   (2026-09-24). `C2-1` was my first option above; strike it.
2. **The compass series can never collide.** `panelInstances` counts per
   SERIES, not per wall, so two north-facing walls share one `N1`…`N12` run and
   no `N2` series is ever generated. The doc comment claiming the numeric
   suffix "matched a second N wall" was describing something that does not
   exist. **The whole collision lived in `interiorWallSeries` alone.**

So the fix is one function: later walls take a **letter** — `C`, `CB`, `CC`, …
doubling to `CAA` past the 26th rather than reaching for a digit. A name is
then letters-then-digits and parses one way only. `isCompassDirection` moved
with it (`/^C\d+$/` would have let a letter suffix through and painted an
interior wall with a compass colour).

⚠ **Not migrated, and the reason is the defect itself: the old key format
cannot be parsed back.** A code stamped against an old `C2`-series key is
orphaned and reissued on the next export. One day of exposure, nothing in
fabrication.

### ~~Stride 1 — close the collision (correctness, small)~~ — as originally planned

Make the key carry the wall and the index as **separate fields** rather than one
concatenated token:

```
`${family}|${wallId}|${indexWithinWall}`     instead of     `${family}|${name}`
```

⚠ **This orphans every code already stamped**, because the ledger is keyed by
the old string. It needs a migration that remaps old keys to new ones, and the
migration has to be exact: a code that fails to remap is a panel that silently
gets a *second* number. Pin it with a test that stamps under the old format,
migrates, and asserts every code survived with the same value.

### ✅ Stride 2 — one number, not two. BUILT 2026-11-18

Done as planned, and **the hazard was worse than this doc said.** The two
four-digit numbers did not merely coexist: they counted in **different
orders**. Crew codes were stamped walking the EXPORT PIPELINE's list (walls,
roof bearing, beams, decks) while B35's install number counted in his own
install order, so on a 16ft Tiny House `P-0028` and install `0028` were
different panels from the very first export. That is the literal answer to
*"wheres the 0028?"*.

**The fix that makes the merge invisible: numbers are stamped IN INSTALL
ORDER.** A provisional number is the install position; stamping walks the same
order; so the number a person already read is the number that gets frozen.
Measured live on the Tiny House: 86 panels, press **Issue for fabrication**,
**zero numbers moved.**

What shipped:

- `panelNumber.ts` (panel-catalog) — the ledger, moved out of
  `tip4urTimeCsv.ts` where it had been living as one export's private join key.
  `panelNumbering()` returns the stored number once issued and the install
  position until then, plus `awaiting` and `retired`.
- `panelKey.ts` — ONE key formula. `panelCodeKey` and
  `installSequenceKey` were byte-identical bodies in two modules that could not
  import each other, kept equal by a test. Both deleted.
- **`formatInstallSequenceNumber` DELETED.** An install step is a plain
  integer now, printed *"step 42 of 134"*. The zero-padding was the whole
  mechanism of the confusion — it made an ORDER look exactly like an
  IDENTITY sitting next to one.
- Format `0042`, not `P-0042`: it is the token the shop stencils and there is
  no hyphen stencil. Migrated exactly on load — `P-` is a prefix that
  parses back, which is precisely what stride 1's ambiguous `C21` was not.
- Three doors issue: **Issue for fabrication** (explicit), the Tip4urTime
  export, and a packet PDF **that contains a fabrication sheet** — gated
  on the sheets so emailing a client the Project Summary does not freeze a
  design still being drawn.
- CSV: `Panel code` carries `0042`; the last column is renamed `Install no`
  — `Install step` and carries a plain integer. ⚠ **The crew app's
  importer needs to know about both**, and that is the one cross-repo cost of
  this stride.

⚠ **One defect found in the browser and nowhere else**: `toReviewLog`
keeps only `pending-BI-confirmation` entries, so the issued-state entry (filed
as `confirmed`) rendered in no build at all while `tsc`, `vitest` and lint all
passed. The filter is right and the entry was wrong: a cleanly issued project
is not a review item, so the log now says nothing then, and raises a line only
for panels with no number or numbers with no panel.

### ✅ Stride 3 — the label is the number. BUILT 2026-11-18

The number is the label on the plan canvas, the Plan View sheet, every wall
elevation, the 3D view and every fabrication sheet's chips; `N3` sits beside it
as its own **location** field. Verified live: the plan and the N elevation
label every panel `0014`, `0015`, `0018+0019` — **no old-style label
survives anywhere in either drawing.**

- `PanelInstance.panelNumber` — the `3` of `N3` — is renamed
  **`indexInSeries`**. It had the same name as the new concept and means the
  opposite kind of thing.
- `combinedPanelLabel(instances, numbers?)` labels by number when handed
  numbers. ⚠ **It falls back to the location label when ANY instance in the
  group lacks a number**, because a half-numbered token would read as a number
  for one panel and as a location for the other, in one string.
- Numbers in a joined label are **sorted ascending**. Found on a real plan: a
  window slot's header and sill arrive header-first and rendered `0019+0018`,
  which reads as a typo.
- ⚠ **ONE place still concatenates, and it is forced**: an OBJ/SketchUp
  group name is a single string with nowhere to put a second field, so it is
  `0042_N3` — number first so the Outliner sorts in panel order.
- The CSV already had the two as separate columns (`Panel code`, `Label`); only
  the doc comment changed, to say that `Label` is a LOCATION and is allowed to
  move while `code` is not.

The panel's **distinct name** (`8' Super Carrot`) is untouched: that says what
the panel *is*, which is a third thing again and already works.

---

## What this does NOT change

- The compass colours on the chip (B35) — a location still has a direction.
- Fabrication grouping, which gathers physically identical panels and sorts by
  shape, not by name.
- The distinct-name scheme for panel types.
- Any existing project: stride 2's `P-` migration is exact and idempotent,
  and stride 1 deliberately did not migrate (its key format cannot be parsed
  back, which is the defect itself).
