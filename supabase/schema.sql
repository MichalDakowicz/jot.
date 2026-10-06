-- Jot. — full backend schema.
-- Paste into Supabase Studio → SQL editor → Run. Safe to re-run.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────── tables

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  year_label text not null default 'First year',
  avatar_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  code text not null default '',
  prof text not null default '',
  tint smallint not null default 0 check (tint between 0 and 11),
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

-- One index per colour way in theme/tokens.ts TINTS. A database made when
-- there were five still holds the old check, which refuses every newer colour.
alter table public.notebooks drop constraint if exists notebooks_tint_check;
alter table public.notebooks add constraint notebooks_tint_check check (tint between 0 and 11);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  title text not null default 'Untitled note',
  body text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  starts_at time not null,
  room text not null default ''
);

create index if not exists notebooks_user_idx on public.notebooks (user_id, position);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_notebook_idx on public.notes (notebook_id);
create index if not exists class_sessions_user_day_idx on public.class_sessions (user_id, weekday, starts_at);

-- Full-text search over titles and bodies, for when a term grows past
-- what the client filters comfortably.
create index if not exists notes_fts_idx
  on public.notes using gin (to_tsvector('english', title || ' ' || body));

-- ───────────────────────────────────────────── keep updated_at honest

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────── tags out of the note text

-- Tags used to be #words in the body. They are a column now, set in the row
-- under a note's title. A database from before gets the column once, filled
-- from the #words already written; the text itself is left as it was. Only
-- when the column is new, so a tag taken off a note later does not come back
-- the next time this file is run.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notes' and column_name = 'tags'
  ) then
    return;
  end if;

  alter table public.notes add column tags text[] not null default '{}';

  -- Filling the column is not an edit: "edited 3 days ago" stays true.
  alter table public.notes disable trigger notes_touch_updated_at;
  update public.notes n
  set tags = coalesce((
    select array_agg(found.tag order by found.first)
    from (
      select lower(m.hit[2]) as tag, min(m.ord) as first
      from regexp_matches(n.body, '(^|\s)#([a-z0-9-]+)', 'gi') with ordinality as m(hit, ord)
      group by lower(m.hit[2])
    ) found
  ), '{}')
  where n.body ~* '(^|\s)#[a-z0-9-]+';
  alter table public.notes enable trigger notes_touch_updated_at;
end
$$;

-- ─────────────────────────────────────── a profile row for every signup

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ──────────────────────────────────────────────── row level security

alter table public.profiles enable row level security;
alter table public.notebooks enable row level security;
alter table public.notes enable row level security;
alter table public.class_sessions enable row level security;

drop policy if exists "profiles are private" on public.profiles;
create policy "profiles are private" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own notebooks" on public.notebooks;
create policy "own notebooks" on public.notebooks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own classes" on public.class_sessions;
create policy "own classes" on public.class_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────── realtime

-- The app listens for changes to these, so an edit on the website shows up
-- on an open phone, and the other way round. Row level security above
-- decides which changes each listener is sent. Deletes are not checked
-- against it, which is why replica identity stays the default: a delete
-- carries the row's id and nothing else.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array array['notebooks', 'notes', 'class_sessions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────── storage

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

-- Both buckets are laid out as <user-id>/<file>, so the first path
-- segment is the owner check.
drop policy if exists "own avatar files" on storage.objects;
create policy "own avatar files" on storage.objects
  for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own export files" on storage.objects;
create policy "own export files" on storage.objects
  for all
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
