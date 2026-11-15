# The sync link — status, and what to build against

**Short answer: the sync link does not exist yet. Nothing on strawpanels.com
serves a CSV at a URL.** Don't wait on it — there is nothing to point at.

What *does* exist, as of 2026-11-14:

- The **file**. Panel list, one row per physical panel, stable codes,
  `Counts as panel` column. It downloads today from **Print → Export for
  Tip4urTime**.
- The export sits **behind one function that takes panel data only** — no
  client name, no address, no price. That was the condition for serving it at
  a URL later, and it is met. Serving it is a small change *on my side*.
- The **share-link machinery** it will reuse is already live: tokens are
  SHA-256-hashed, stored per project, revocable, and carry an expiry.

So: **upload is the path today.** The coder should not build a fetch against
a URL that does not exist.

---

## The one thing worth doing now, so nothing is wasted

Put the **parse-and-upsert step behind a function that takes CSV text**, plus
the acting company — not a `File`, not a form event.

```ts
// today:   onFileChosen(file) -> readPanelFile(await file.text())
// instead: importPanelCsv(text: string, companyId: string): ImportResult
```

Then a later "Refresh from strawpanels.com" button calls the *same* function
with a fetched body instead of a file's text. That is the whole of the
"design for it" work. No endpoint, no credentials, no polling, no retry logic.

---

## The contract it will have, when it exists

Stated so the client side can be shaped correctly, **not so it can be called
yet.**

```
GET  https://strawpanels.com/api/sync/<token>            -> text/csv
```

- `<token>` is opaque, ~43 characters of base64url. Treat it as a secret:
  **whoever holds it can read that project's panel list.**
- The body is **byte-identical to the downloaded file** — same preamble rows,
  same columns, same `Counts as panel`. One format, one parser, one set of
  tests. If those two ever differ, that is a bug on my side.
- Responses to expect: `200` with the CSV; `404` for an unknown, revoked or
  expired token (**one answer for all three**, deliberately — a probe must not
  learn which); `304` if you send `If-None-Match` and nothing changed.
- It will carry **panel data only**. No client names, no addresses, no prices.
  That is enforced by the function's input type, not by a filter somebody has
  to remember.
- It is **revocable**, from the project's Sharing panel, and it **expires**.
  A sync that starts failing with `404` is the normal end of life for one, not
  an incident — surface it as "this link was turned off" and ask for a new one.

⚠ **Two things that are NOT decided**, and the Tip4urTime side should not
assume either:

1. **Per-project or per-company.** The brief says *"this same CSV for one
   project, or a list of the company's current (not finished) projects"*. The
   second shape has no design yet. Build for one project per link; a company
   feed, if it happens, will be a second endpoint, not a changed one.
2. **Refresh cadence.** Nothing polls. When the link exists, a manual
   "Refresh" button is the first version — a scheduled pull needs a
   conversation about rate limiting that has not happened.

---

## What to tell him

> The sync link isn't built yet — upload is the path for now. Make the import
> take CSV **text** rather than a file, so swapping the source later is one
> line, and don't write any fetch code against it. The format will be
> byte-identical to the file you already import, so your parser and tests are
> the ones that will serve it.
