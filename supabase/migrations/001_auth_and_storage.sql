-- SPARQL-workbench: brukerprofiler + lagrede spørringer + faner
-- Kjøres i Supabase SQL-editor (eller via CLI). Idempotent der det er lett å få til.

-- ────────────────────────────────────────────────────────────────────────────
-- profiles
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  role       text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Innlogget bruker kan lese sin egen profil (rollen brukes i UI-et).
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Admin-operasjoner (brukerliste m.m.) går via secret-nøkkelen og forbigår RLS,
-- så vi trenger ingen admin-select-policy her.

grant select on public.profiles to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Ny bruker -> profilrad. aremjolsnes@gmail.com blir alltid admin.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when new.email = 'aremjolsnes@gmail.com' then 'admin'
      when coalesce(new.raw_user_meta_data ->> 'role', '') = 'admin' then 'admin'
      else 'member'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────────────
-- updated_at-hjelper
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- saved_queries
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.saved_queries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null,
  query         text not null,
  endpoint_name text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists saved_queries_user_updated_idx
  on public.saved_queries (user_id, updated_at desc);

alter table public.saved_queries enable row level security;

drop policy if exists "own saved_queries" on public.saved_queries;
create policy "own saved_queries" on public.saved_queries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_saved_queries_updated on public.saved_queries;
create trigger t_saved_queries_updated
  before update on public.saved_queries
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.saved_queries to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- user_tabs  (hele fane-arrayen som én blob per bruker)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_tabs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '[]'::jsonb,
  active_id  text,
  updated_at timestamptz not null default now()
);

alter table public.user_tabs enable row level security;

drop policy if exists "own user_tabs" on public.user_tabs;
create policy "own user_tabs" on public.user_tabs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists t_user_tabs_updated on public.user_tabs;
create trigger t_user_tabs_updated
  before update on public.user_tabs
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.user_tabs to authenticated;
