-- Persist consultant report/profile settings outside browser cache.
-- LocalStorage remains the offline cache; profiles.consultant_settings is the source
-- used after login/cache clear.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists consultant_settings jsonb not null default '{}'::jsonb;

alter table public.profiles enable row level security;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_authenticated_write" on public.profiles;
create policy "profiles_authenticated_write"
  on public.profiles for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
