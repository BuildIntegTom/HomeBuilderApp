-- Stage 1 — invite preview and redemption.
--
-- Decision 3: invite-only, nobody self-registers. The two operations below are
-- the only ones in the system that a person outside every company can reach,
-- so both live in the database as SECURITY DEFINER functions rather than in a
-- route handler: the rules (unexpired, unused, addressed to you) are enforced
-- in one atomic place, and the route handler cannot skip them.
--
-- The raw token never reaches the database. The app hashes it (SHA-256) and
-- passes the hash, so a database dump does not contain usable invite links.

-- What the sign-up form needs in order to render: which company, which email,
-- and whether the link is still good. Callable by an unauthenticated visitor
-- because that is exactly who follows an invite link — and it discloses nothing
-- to anyone who does not already hold the token.
create or replace function public.invite_preview(p_token_hash text)
returns table (
  valid boolean,
  reason text,
  company_id uuid,
  company_name text,
  email text,
  level text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite public.invites;
  v_company public.companies;
begin
  select * into v_invite from public.invites i where i.token_hash = p_token_hash;

  if not found then
    return query select false, 'not_found', null::uuid, null::text, null::text, null::text;
    return;
  end if;

  select * into v_company from public.companies c where c.id = v_invite.company_id;

  if v_invite.accepted_at is not null then
    return query select false, 'already_used', v_company.id, v_company.name, v_invite.email, v_invite.level;
    return;
  end if;

  if v_invite.expires_at <= now() then
    return query select false, 'expired', v_company.id, v_company.name, v_invite.email, v_invite.level;
    return;
  end if;

  return query select true, null::text, v_company.id, v_company.name, v_invite.email, v_invite.level;
end;
$$;

-- Redeem. Runs as the newly-signed-in user, so auth.uid() is the real identity
-- and the caller cannot claim to be someone else — there is deliberately no
-- user-id parameter. `for update` makes the second of two simultaneous
-- redemptions of one token wait and then fail on accepted_at, which is the
-- "invite reused twice" edge case.
create or replace function public.redeem_invite(p_token_hash text)
returns table (company_id uuid, company_name text, level text)
language plpgsql
security definer
set search_path = public
as $$
-- The OUT columns are named company_id / level, which also name columns of
-- public.memberships. Without this, `on conflict (user_id, company_id)` below
-- resolves company_id to the OUT variable and fails as ambiguous. Columns win.
#variable_conflict use_column
declare
  v_invite public.invites;
  v_company public.companies;
  v_email text;
  v_level text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select u.email into v_email from auth.users u where u.id = auth.uid();

  select * into v_invite from public.invites i
   where i.token_hash = p_token_hash
   for update;

  if not found then
    raise exception 'invite not found' using errcode = '22023';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite has already been used' using errcode = '22023';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite has expired' using errcode = '22023';
  end if;
  if lower(btrim(v_invite.email)) <> lower(btrim(coalesce(v_email, ''))) then
    -- An invite is addressed to a person, not transferable to whoever opens it.
    raise exception 'invite was issued to a different email address' using errcode = '42501';
  end if;

  update public.invites i
     set accepted_at = now(), accepted_by = auth.uid()
   where i.id = v_invite.id;

  -- An existing account joining a second company is the normal multi-membership
  -- case (decision 1), not an error. is_default is left to the trigger in 0001:
  -- a first membership becomes the default, a second does not steal it.
  --
  -- DO NOTHING, not DO UPDATE SET level. Redeeming an invite is not a promotion
  -- mechanism, for two reasons and in that order:
  --
  --  1. It could not work. `do update set level` fires
  --     guard_membership_self_update, which refuses a level change from someone
  --     who is not yet an admin of that company — which the redeemer, by
  --     definition, is not. The old form failed closed but consumed nothing and
  --     showed the admin an error on a flow the code plainly meant to support.
  --  2. It should not work. An admin promoting an existing colleague edits that
  --     colleague's membership row, which they are allowed to do and which is
  --     attributable to them. Routing it through a link the colleague clicks
  --     makes a privilege change look like an acceptance.
  --
  -- Nothing is substituted silently: the level actually in force is read back
  -- and returned, so an admin who tried to promote by re-inviting sees the
  -- unchanged level in the answer rather than a confident wrong one.
  insert into public.memberships (user_id, company_id, level)
  values (auth.uid(), v_invite.company_id, v_invite.level)
  on conflict (user_id, company_id) do nothing;

  select m.level into v_level
  from public.memberships m
  where m.user_id = auth.uid() and m.company_id = v_invite.company_id;

  select * into v_company from public.companies c where c.id = v_invite.company_id;
  return query select v_company.id, v_company.name, v_level;
end;
$$;

revoke all on function public.invite_preview(text) from public;
revoke all on function public.redeem_invite(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
