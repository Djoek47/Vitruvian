-- Faberland Port: avatar packages sent from the Vitruvian headset app to the Faberland metaverse.
-- Body data is sensitive: RLS on, owners see only their own rows, anonymous uploads go
-- through the `vitruvian-port` Edge Function (service role) and are reachable only by claim code.

create table if not exists public.vitruvian_avatar_packages (
  id                uuid primary key default gen_random_uuid(),
  code              text unique not null,                 -- 8-char claim code (Crockford base32)
  profile_id        text not null,                        -- Body Passport profileId (stable per person)
  owner_user_id     uuid references auth.users (id) on delete cascade,  -- set when uploaded by a signed-in Faberland user
  package           jsonb not null,                       -- faberland.avatar-package@1
  digest            text,                                 -- package.integrity.digest (SHA-256)
  simulated         boolean not null default false,       -- emulator data: never fit real garments to it
  passport_updated_at timestamptz,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz,                          -- null for owned packages; 30 days for anonymous claim codes
  delete_token_hash text                                  -- sha256(deleteToken) for anonymous uploads
);

create index if not exists vitruvian_pkg_owner_idx on public.vitruvian_avatar_packages (owner_user_id, created_at desc);
create index if not exists vitruvian_pkg_profile_idx on public.vitruvian_avatar_packages (profile_id, created_at desc);

alter table public.vitruvian_avatar_packages enable row level security;

-- Signed-in users: read, add and delete ONLY their own avatar packages (history is append-only: no update policy).
create policy "own packages: select" on public.vitruvian_avatar_packages
  for select to authenticated using (owner_user_id = auth.uid());
create policy "own packages: insert" on public.vitruvian_avatar_packages
  for insert to authenticated with check (owner_user_id = auth.uid());
create policy "own packages: delete" on public.vitruvian_avatar_packages
  for delete to authenticated using (owner_user_id = auth.uid());
-- No anon policies: anonymous access exists only through the Edge Function (claim code).

-- Latest avatar per signed-in user (what the metaverse loads at login).
create or replace view public.vitruvian_latest_avatar with (security_invoker = true) as
  select distinct on (owner_user_id) *
  from public.vitruvian_avatar_packages
  where owner_user_id is not null
  order by owner_user_id, created_at desc;

-- Housekeeping: remove expired anonymous claim codes (schedule with pg_cron, or call manually).
create or replace function public.vitruvian_purge_expired() returns integer
language sql security definer set search_path = public as $$
  with d as (delete from public.vitruvian_avatar_packages where expires_at is not null and expires_at < now() returning 1)
  select count(*)::int from d;
$$;
