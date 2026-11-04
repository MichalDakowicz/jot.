-- Apply after schema.sql; safe to rerun on existing databases.
-- Explicitly published rows are readable by anyone, including without a session.
alter table public.notebooks add column if not exists is_public boolean not null default false;
alter table public.notes add column if not exists is_public boolean not null default false;

grant select on public.notebooks, public.notes to anon, authenticated;

drop policy if exists "public notebooks are readable" on public.notebooks;
create policy "public notebooks are readable" on public.notebooks
  for select to anon, authenticated using (is_public);

drop policy if exists "public notes are readable" on public.notes;
create policy "public notes are readable" on public.notes
  for select to anon, authenticated
  using (
    is_public or exists (
      select 1 from public.notebooks b
      where b.id = notes.notebook_id and b.user_id = notes.user_id and b.is_public
    )
  );

-- Existing owner-only write policies remain in force. Public SELECT access
-- never grants INSERT, UPDATE or DELETE, nor access to profiles or timetables.
