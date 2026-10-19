# strawpanels.com — the cutover, in the order that does not break sign-in

The repo side is done and pushed. What is left is three dashboards, and **the
order matters**: two of the steps break authentication if they are done in the
wrong sequence.

## What the code already does, so you know what you are changing

The app was already domain-agnostic. One variable carries the whole decision:

```
NEXT_PUBLIC_SITE_URL   (falls back to the request's own origin if unset)
```

Two things read it, and they fail **differently** — worth knowing, because only
one of them can actually break:

| Reads it | If it is stale | If Supabase disagrees with it |
|---|---|---|
| Password-reset link's `redirectTo` | link points at the old host | ⚠ **no reset email is sent at all** |
| Company-invite link (a string shown once in the UI) | link points at the old host | unaffected — Supabase never sees it |

Only the password reset goes through Supabase's **redirect allowlist**, and
Supabase refuses a `redirectTo` that is not on it. That is the one real
breakage in this cutover.

⚠ **That refusal used to be silent.** The route discarded Supabase's result and
answered "ok" regardless, so a refused redirect, a hit email rate limit and a
genuinely sent email all looked identical. Fixed on 2026-10-18 — it now reports
which kind of failure it was, without ever revealing whether the address has an
account. (Supabase answers success for an unknown address by design; that is
its own enumeration defence, which is why surfacing everything else leaks
nothing.)

## ⚠ Pick the apex, and redirect www to it — this is not cosmetic

**The session cookie is host-only.** `serverSession.ts` sets no `domain`, so
`strawpanels.com` and `www.strawpanels.com` **do not share a sign-in**. Someone
who signs in on one and then lands on the other is simply signed out, with
nothing on screen explaining why.

So one host has to be canonical and the other must redirect to it — at Vercel,
not in code. The apex is the recommendation: it is what you will say out loud,
and short names matter for the audience you picked the name for.

`.env.example` now says `https://strawpanels.com`. If you would rather have www,
change that line and swap the two hosts in steps 1 and 4 below.

---

## The order

### 1. Vercel — add both hosts

Project → Settings → Domains. Add **`strawpanels.com`** and
**`www.strawpanels.com`**. Set the apex as the primary so Vercel issues the
www → apex redirect for you.

Vercel will show the exact DNS records to create. **Use what it shows you**,
not what anyone remembers: historically an `A` record for the apex pointing at
`76.76.21.21` and a `CNAME` for `www` pointing at `cname.vercel-dns.com`, but
read the page rather than trusting that sentence.

### 2. Squarespace Domains — create those records

In the domain's DNS settings, add exactly the records from step 1. Leave the
existing `.vercel.app` URL alone; it keeps working, which is what lets you test
without being locked out.

Then wait for Vercel to show both domains as valid and issue the certificate.
Nothing below works until it does.

### 3. Supabase — the allowlist, BEFORE the env var

Dashboard → Authentication → **URL Configuration**:

- **Site URL**: `https://strawpanels.com` — this is also what the email
  templates use for `{{ .SiteURL }}`.
- **Redirect URLs**: add `https://strawpanels.com/**` and
  `https://www.strawpanels.com/**`.
  ⚠ **Keep the existing `.vercel.app` entry** until the end. Removing it in the
  same sitting is how you lock yourself out mid-cutover with no way back.

### 4. Vercel — the environment variable, and a redeploy

Project → Settings → Environment Variables:

```
NEXT_PUBLIC_SITE_URL = https://strawpanels.com
```

⚠ **Then redeploy.** `NEXT_PUBLIC_*` is inlined at build time — changing the
variable does nothing to the deployment already running.

⚠ **Step 3 must come first.** If the env var points at a host the allowlist does
not carry, password reset stops working — loudly now, but still stopped.

### 5. Check it, on the real domain

1. `https://www.strawpanels.com` lands on `https://strawpanels.com`.
2. Sign in. Reload. Still signed in.
3. **Password reset** — ask for one, and confirm the email arrives and its link
   lands on `strawpanels.com/reset-password`. This is the step that proves
   step 3 worked.
4. Create a company invite and read the link text — it should say
   `strawpanels.com`, not `.vercel.app`.

### 6. Afterwards, not during

Once all four checks pass, you can remove the `.vercel.app` entry from the
Supabase redirect list if you want it tidy. There is no need to.

---

## Two things this does not fix

- **The email rate limit.** You said you are already at it, and the built-in
  SMTP is meant for development volumes. Custom SMTP (Resend, Postmark or SES)
  is a separate job and is in the queue. One upside of today's change: hitting
  that limit now says so instead of showing "check your email".
- **`strawpanel.app`**, which you also liked. Nothing here depends on it; if you
  buy it later it is a second domain in step 1 pointing at the same project, and
  it does **not** need adding to the Supabase allowlist unless you intend people
  to sign in on it.
