-- Stage 1 — creating a company, and its first admin, in one call.
--
-- Decision 27, in full: "Creating a new company: company admins at any member
-- company, plus platform admin. The creator names the company and invites its
-- first admin by email; the creator gets no standing access to the company they
-- created — creating is not joining."
--
-- WHY THIS IS A FUNCTION AND NOT TWO POLICIES. The first invite to a company
-- has to be written at a moment when nobody administers that company, so no
-- policy phrased in terms of "an admin of this company" can authorize it. The
-- previous attempt handed the creator a temporary window — visible until the
-- first admin accepted — and Tommy chose this instead, which is the better
-- answer: the creator gets literally no standing access at any point, and the
-- spec is satisfied as written rather than reinterpreted.
--
-- It also removes two things a window has to be right about and this does not
-- have to be right about at all: an invite issued at level 'member' would have
-- held the window open forever, and invites minted inside a window outlive it.
-- Neither can exist here, because there is no window.
--
-- The third — a founder addressing the first-admin invite to themselves — is
-- NOT free, and an earlier version of this comment claimed it was. Nothing
-- about the shape of this function prevents it: put your own address in, redeem
-- the link you were handed back, and "creating is not joining" is false one
-- click later. It is refused explicitly below, and asserted in the suite.
--
-- Same shape as public.redeem_invite (0003): a SECURITY DEFINER function is how
-- this schema expresses "an operation whose authorization cannot be written as a
-- rule about a row that already exists". Both check their own precondition and
-- neither takes a user id — auth.uid() is the caller, and cannot be claimed.
-- 0002 records why FORCE ROW LEVEL SECURITY is off, which is what lets these
-- two write rows their caller could not write directly.

create or replace function public.create_company_with_first_admin(
  p_name text,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Decision 27's own condition, checked here because it is the only place it
  -- can be. `is_company_admin_anywhere` reads "an admin at any MEMBER company",
  -- which is the spec's wording, not "an admin anywhere at all".
  if not (public.is_company_admin_anywhere() or public.is_platform_admin()) then
    raise exception 'only a company admin or a platform admin can create a company'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'a company needs a name' using errcode = '22023';
  end if;
  if coalesce(btrim(p_email), '') = '' then
    raise exception 'a new company needs a first admin to invite' using errcode = '22023';
  end if;

  -- "Creating is not joining" (decision 27), enforced rather than assumed.
  --
  -- Without this the founder can address the first-admin invite to their own
  -- email and redeem it, arriving as admin of the company they just created.
  -- It is not a cross-tenant hole — they must already be a company admin at a
  -- member company, and they end up administering an empty company — but it is
  -- the exact sentence decision 27 is made of, so it is checked here rather
  -- than described as impossible in four documents.
  --
  -- IS NOT DISTINCT FROM rather than a plain comparison: auth.users.email is
  -- nullable on Supabase (phone signup, anonymous, some SSO), and a null on
  -- either side must not silently skip the check.
  if lower(btrim(p_email)) is not distinct from (
       select lower(btrim(u.email)) from auth.users u where u.id = auth.uid()
     ) then
    raise exception 'you cannot invite yourself as the first admin of a company you are creating'
      using errcode = '42501';
  end if;
  -- An expiry, but no ceiling on one. A caller reaching this function directly
  -- rather than through the route could ask for an invite good for a decade.
  -- Deliberately left as it is: the invites_insert policy allows a company
  -- admin exactly the same latitude for every other invite, so clamping only
  -- here would be an inconsistency rather than a fix, and picking a maximum
  -- would be inventing a second number beside one already flagged as guessed.
  -- Recorded in the spec beside INVITE_EXPIRY_DAYS instead.
  if p_expires_at <= now() then
    raise exception 'that invite would already have expired' using errcode = '22023';
  end if;

  -- is_seed_member and is_consortium are left false. Putting a company into the
  -- co-operative is a decision Tommy makes (spec: "a real decision for Tommy,
  -- not a flag flip someone makes quietly"), and guard_company_flags in 0001
  -- refuses them from anyone but a platform admin regardless.
  insert into public.companies (name, created_by)
  values (btrim(p_name), auth.uid())
  returning id into v_company_id;

  -- Level is 'admin', not a parameter. The point of this call is to hand the
  -- company to someone; a first invite at 'member' would create a company that
  -- nobody can ever administer, which is the failure the window version could
  -- be talked into.
  insert into public.invites (email, company_id, level, token_hash, expires_at, created_by)
  values (lower(btrim(p_email)), v_company_id, 'admin', p_token_hash, p_expires_at, auth.uid())
  returning id into v_invite_id;

  -- Deliberately NOT returning the company id. The creator has no access to
  -- that company and no reason to hold a handle on it; the invite id is all the
  -- UI needs, and it is the thing they may legitimately withdraw... which they
  -- cannot, either, since invites_delete asks for an admin of that company.
  -- That is correct and is the price of "no standing access": a mistyped first
  -- invite is reissued by a platform admin, not by the founder.
  return v_invite_id;
end;
$$;

revoke all on function public.create_company_with_first_admin(text, text, text, timestamptz) from public;
revoke all on function public.create_company_with_first_admin(text, text, text, timestamptz) from anon;
grant execute on function public.create_company_with_first_admin(text, text, text, timestamptz) to authenticated;

-- A note worth keeping, because it cost an afternoon and the reason usually
-- given for it is wrong.
--
-- An `insert ... returning` on a table with RLS evaluates the SELECT policy
-- against the row being written. If that policy calls a function which looks the
-- row up, the function CANNOT SEE IT — not because the function is STABLE, but
-- because a snapshot taken part-way through a command has its command counter
-- equal to the current command id, and the new tuple's cmin equals that too, so
-- the tuple is invisible to anything running inside the command that wrote it.
-- Marking the function VOLATILE does not help. The insert then fails with "new
-- row violates row-level security policy", which is a confusing thing to be
-- told about a row you were permitted to write.
--
-- It does not bite here, because this function is SECURITY DEFINER and its
-- insert is not policy-checked at all. It bit the version of companies_select
-- that tried to admit the creator to their own new row, and it will bite the
-- next person who writes a policy function that reads the table it guards.
