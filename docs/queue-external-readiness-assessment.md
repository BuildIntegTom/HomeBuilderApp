# QUEUED — honest scope assessment before February's external opening

**From Tommy, 2026-11-15. Not started.**

He wants an **unflinching** readiness assessment before strawpanels.com opens
to people outside Building Integrity. His framing, and it governs how this is
answered:

> *"This is not a status report to make me feel good; flag anything uncertain
> rather than guessing or reassuring me."*

> *"Answer each of these directly, using the actual code, schema, and git
> history — not impressions."*

⚠ **The brief is the deliverable's shape.** Eight questions, each answered
from evidence, closing with a **plain-language ready / not-ready list** that
gives every item *fine / needs work / unknown* **and a rough size in hours,
days or weeks** — he explicitly refused "should be okay".

---

## His eight questions, verbatim

1. **Multi-tenancy reality check.** Does the app currently assume a single
   company/org (Building Integrity) baked into defaults, pricing, materials, or
   auth — or is there already a real separate-organization/account concept?
   What would it concretely take to onboard a second company's data without it
   touching Building Integrity's?

2. **Known-bug inventory beyond Repanelize.** The Repanelize "discard locked
   widths" bug is already fixed. What other core panel-generation/editing flows
   (corner conditions, unusual bracing patterns, odd dimensions) have NOT been
   deliberately stress-tested? List them **by confidence level**, not just
   "seems fine."

3. **Data model stability.** Is the schema for panels/projects/jobs still
   actively changing? Based on the commit/migration history, what's the
   realistic date this settles, and what's still unsettled going into February?

4. **The strawpanels-to-Tip4urTime export contract.** There's a dedicated
   export path (a migration plus `panelImport.ts` on the T4T side) that
   Tip4urTime depends on. Is that export shape actually stable, or could it
   still change? If it changes, what breaks on the T4T side?

5. **Onboarding and support surface for a brand-new external user.** What
   exists today for account creation, docs/tutorials, and error states? When
   someone unfamiliar with the app's quirks hits a bug, do they get a clear
   message or a silent failure?

6. **Real test coverage vs. the evidence-JSON harness.** Which actual user
   workflows are covered by the automated/semi-automated evidence tests, and
   which are only ever manually eyeballed? Be specific about the gap.

7. **Concurrent use and performance unknowns.** Has this app been used by more
   than one person at the same time? Any known performance cliffs at scale
   (large panel counts, big projects)?

8. **Data isolation and security.** If more than one company's data ends up in
   this instance, what actually enforces that one company can't see another's?
   Is that enforced in the database itself, or only in app logic?

---

## What I already know that bears on the answers

Recorded here so the assessment starts from facts rather than re-deriving them,
**but none of it is a substitute for reading the code** — several of these are
exactly the kind of recollection his brief says not to trust.

- ⚠ **Question 4's premise is already slightly out of date, and he should be
  told plainly.** The export's *format* is unchanged, but on **2026-11-15 the
  meaning of its `Sq ft` column changed** — it is now the piece's largest face,
  not `Width x Height`. A T4T importer that recomputes that column is now wrong
  for every shop item. See
  `Claude outputs/tip4urtime-sq-ft-is-largest-face-2026-11-15.md`. That is a
  live example of the contract moving *without the schema moving*, which is the
  real answer to "could it still change".
- **Question 8 has a real answer in the database**, not only in app logic:
  `supabase/migrations/` carry RLS, and `0014_proposals.sql` deliberately has
  RLS on with **zero policies**, reachable only through four `security definer`
  functions. Whether that discipline holds across **all** tables is the thing
  to verify rather than assume.
- **Question 1 is the one I would expect to be worst.** Pricing defaults, the
  materials catalog and the fabricator proposal footer are Building Integrity's
  own, and a second company's rates would collide with
  `priceRates`/`shopItemRates` as catalog constants.
- **Question 5's account creation is known incomplete** — share-link signup is
  live but the "the link IS the invite" decision is unbuilt and blocked on one
  email-confirmation question.
- **Question 3**: migrations `0001`–`0013` are applied; **`0014` is written,
  PGlite-verified and NOT applied**. The project *document* schema is at v22
  with live migrations, which is itself evidence the model is still moving.

## Size

This is a **read-everything** job — schema, RLS, git history, the harness, the
export path — and its value is entirely in being evidence-backed rather than
impressionistic. Half a day minimum to do honestly; a day if question 2's
stress-testing gaps are to be listed by real confidence level rather than
guessed at.
