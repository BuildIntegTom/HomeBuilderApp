-- Stage 6B — a live share link is also an invitation to sign up.
--
-- > "the link is the invite to sign up too. lets do that."
-- >   — Tommy, 2026-11-08
--
-- This closes the gap 0011 shipped with and named in its own notes: signing up
-- was invite-only, so a shared link only worked for somebody who ALREADY had an
-- account — the person who least needs one. The whole flow Tommy described
-- (a company hands a client a link, the client signs up, the client watches the
-- building) stopped at its second step.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION IS, AND WHAT IT DELIBERATELY IS NOT
-- ---------------------------------------------------------------------------
--
-- It adds ONE read-only function. It creates no table, no policy and no grant
-- of access to anything, and it does not create accounts: Supabase's auth
-- schema is not ours to write, and account creation stays where it already is,
-- in a route handler holding the service-role key.
--
-- What the database contributes is the only part that must not be decided in
-- application code: WHETHER A GIVEN TOKEN AUTHORISES A SIGN-UP AT ALL, and if
-- so, whether it names the address. A route that answered that for itself
-- would be a second implementation of "is this link live", and the two would
-- drift — which is the whole reason `share_link_is_live` exists as a function
-- rather than as a predicate copied into each caller.
--
-- ---------------------------------------------------------------------------
-- ⚠ THE ONE REAL HAZARD HERE: THIS FUNCTION RETURNS THE EMAIL ADDRESS
-- ---------------------------------------------------------------------------
--
-- `share_link_preview` (0011) deliberately returns `locked_to_email` as a
-- BOOLEAN. Its own comment says why: a link forwarded to the wrong person must
-- not tell them whose link they are holding, or a stray URL becomes an
-- email-address disclosure.
--
-- This function returns `locked_email` IN FULL, and it has to. The decision it
-- exists to support is whether a new account's address may be marked confirmed
-- without the person proving they own it — and that is only safe when the LINK
-- names the address, exactly as an invite does. The caller cannot make that
-- judgement from a boolean.
--
-- So the rule, which is not expressible in SQL and therefore has to be written
-- down here and enforced by review:
--
--   ⚠ **CALL THIS ONLY FROM THE SIGN-UP ROUTE HANDLER, AND NEVER PUT ITS
--     `locked_email` IN A RESPONSE BODY.** It is granted to `anon` because the
--     visitor signing up is not yet authenticated, not because a page may ask
--     it. The page's question is answered by `share_link_preview`, which is
--     one function away in this same schema and returns a boolean. These two
--     sitting side by side is an invitation to the wrong copy-paste, and this
--     paragraph is the guard rail.
--
-- The exposure if that rule is broken: anyone holding a forwarded link learns
-- the address it was issued to. Not catastrophic, and bounded to one address —
-- but it is a disclosure nobody chose, and it would be invisible.
--
-- ---------------------------------------------------------------------------
-- WHY NOT JUST WIDEN share_link_preview
-- ---------------------------------------------------------------------------
--
-- Because then the page would have the address. The split is the point: the
-- function a browser calls cannot disclose it, and the function that can is
-- called only by a server holding a service-role key. Two functions with two
-- audiences beats one function with a flag, because a flag can be passed `true`
-- by accident and a grant cannot.
-- ---------------------------------------------------------------------------

begin;

create or replace function public.share_link_permits_signup(p_token_hash text)
returns table (permitted boolean, locked_email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.share_links;
begin
  select * into v_link from public.share_links s where s.token_hash = p_token_hash;

  -- ⚠ ONE answer for "no such link", "revoked" and "expired", and no reason
  -- field at all. A sign-up form has nothing useful to do with the
  -- distinction, and `share_link_preview` has already drawn it for the page
  -- the visitor is looking at. Withholding it here means a caller probing
  -- tokens against this function learns strictly less than one probing the
  -- preview, which is the right direction for the function that is reachable
  -- with a service-role key behind it.
  if not found or not public.share_link_is_live(v_link) then
    return query select false, null::text;
    return;
  end if;

  -- ⚠ `share_link_is_live` is REUSED, not restated. It is 0011's single
  -- expression of "not revoked and not expired"; a second copy here would be
  -- one `<=` away from letting an expired link mint accounts, and nothing
  -- would notice until it did.
  return query select true, v_link.locked_email;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Start from nothing and grant exactly, as 0006, 0008 and 0011 do:
-- Supabase's defaults are broad on new functions.
--
-- `anon` gets execute because the person signing up is BY DEFINITION not yet
-- authenticated. `service_role` gets nothing — the route handler calls this on
-- the request's own (anon) client, and keeping service_role off it means a
-- stolen service key buys no new reach here.
-- ---------------------------------------------------------------------------
revoke all on function public.share_link_permits_signup(text) from public;
revoke all on function public.share_link_permits_signup(text) from service_role;
grant execute on function public.share_link_permits_signup(text) to anon;
grant execute on function public.share_link_permits_signup(text) to authenticated;

commit;
