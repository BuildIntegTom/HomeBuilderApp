# Engineer review, markup and sign-off — plan

> *"I want an engineer in their logged into their own company, which each
> other company can invite to be under that teams projects. I want them to be
> able to be able to make edits, highlight their changes, be able to add text
> even perhaps in red bubbles, and resin it as a save and an export."* —
> Tommy, 2026-10-26

Nothing built. This is the plan, and the questions it needs.

---

## 1. Why this one matters more than it looks

Every printed page in this app carries the same line:

> *Fabricator proposal — Building Integrity. Not yet engineer-stamped; do not
> construct from this document alone.*

That disclaimer is the app admitting what it cannot do. **This feature is the
thing that would let it come off** — which makes it the most consequential
feature on the queue, and the one where getting the record wrong does real
harm. A stamped drawing is a legal artefact. An app that lets a stamp drift
away from the geometry it was applied to is worse than an app with no stamp at
all.

⚠ So the single most important design rule here: **a sign-off binds to an
exact version, not to a project.** Everything below follows from that.

---

## 2. The three separable pieces

He described one thing, but it is three, and they can ship in this order:

| | | |
|---|---|---|
| **A. Cross-company access** | An engineer logged into *their own* company, invited onto another company's projects | Backend; builds on the sharing that already exists |
| **B. Markup** | Highlighted changes, text in red bubbles | Mostly front-end; needs a place to store annotations |
| **C. Sign-off** | *"resin it as a save and an export"* | Small to build, large to get right |

**A is the foundation.** B is useless without it, because a review nobody else
can see is a private sketch. C is the payoff.

---

## 3. A — cross-company access

The app already has per-company cloud projects and an access model
(`backend_stage1_live`, Stages 0–4). This is a **guest role on a project**,
not a new company structure:

- The engineer's identity stays in their own company. They do not get
  "a seat" in the host company.
- The host company invites a *user*, not an org — an engineer reviews for many
  builders and must not become a member of each one.
- The role is its own thing, not editor-plus-a-flag, because the permissions
  genuinely differ: an engineer may annotate and sign, which a builder's own
  editor may not.

⚠ **This is the same shape as the panel-library sharing** queued on 2026-10-25
(per company, with Seed Collaborative umbrellas). Both want "an identity in
one org, access into another". They should be one mechanism, designed once —
if they are built separately, the second one will be a near-copy with
different bugs.

**Questions**
1. Can an invited engineer see the whole project, or only the sheets they are
   asked to review?
2. Does the invitation expire?
3. Can an engineer invite a colleague from their own firm, or must the host do
   every invite?

---

## 4. B — markup

Two distinct things got described together, and they are not the same:

**"Make edits"** — the engineer changes the model itself. A different member,
a thicker beam, a column moved. ⚠ This is the dangerous one: it means two
parties editing one project, and the app has no merge story at all.

**"Highlight their changes, add text in red bubbles"** — annotation ON a
version. Nothing in the model changes; a layer of notes sits over it.

**Recommendation: build annotation first and treat edits separately.**
Annotations are additive, cannot corrupt a model, and deliver most of the
value — an engineer saying *"this beam wants to be a double"* in a red bubble
is a complete review. Letting them silently rebuild the model is how a builder
ends up fabricating something nobody checked.

If edits are wanted anyway, the honest form is **a proposed change the host
accepts or rejects**, not a direct write.

⚠ **"Highlight their changes" needs a definition.** If the engineer only
annotates, there are no changes to highlight — the bubbles *are* the review.
If they edit, highlighting means a diff between versions, which the app does
not compute today. Worth knowing which he pictured.

**Where annotations attach.** Each bubble should carry what it points at:
a panel id, a wall, a sheet, a member. Pinned to a screen position alone, a
bubble ends up floating over empty space the moment anything re-tiles.

**Questions**
4. Annotation only, or real edits too? If edits — proposed-and-accepted, or
   direct?
5. What can a bubble attach to: a sheet, a panel, a single member?
6. Do bubbles print? My assumption: yes, on the review export, and never on a
   fabricator's own sheet unless resolved.

---

## 5. C — sign-off, and the part to be careful about

> *"resin it as a save and an export"*

Read as **re-sign**: the engineer returns the reviewed project as both a saved
version and an exported document. The app's own disclaimer already names the
concept — *"not yet engineer-stamped"* — so a stamp has a place to go.

⚠ **A stamp binds to a version hash, never to a project.** Concretely:

- Signing freezes that exact model — geometry, panels, every number — and
  records who signed, when, and what they signed.
- **Any later change produces an unsigned version.** It does not "invalidate"
  the stamp; the stamp stays true of the thing it was applied to, and the new
  thing simply does not have one.
- The disclaimer line comes off **only** on an export of a signed version, and
  goes straight back on for anything derived from it.

That last point is the whole feature. Everything else is UI.

⚠ **What the app cannot promise.** Nothing here verifies that the signer is an
engineer, or licensed in the jurisdiction. The app records *a person asserted
this*. A stamp that looks official but checks nothing is worse than no stamp —
so the exported wording must say exactly what was and was not verified, and
that wording is Tommy's to write, not mine.

**Questions**
7. Is "sign" per project, per sheet, or per discipline?
8. What does the stamp show — name, firm, licence number, date, jurisdiction?
9. What happens to a signed version when the builder edits afterwards: a new
   unsigned version alongside it, or a warning first?
10. Does an engineer's sign-off need the host company to counter-accept?

---

## 6. Where it sits

Behind the roof work in progress, and ⚠ **behind the panel library's sharing
model**, which should be designed as the same mechanism rather than beside it.

The pieces this app already has that this leans on: per-company cloud projects
and their access rules, version history, the Review Log, and the disclaimer
itself — which is the thing this feature finally gets to switch off.
