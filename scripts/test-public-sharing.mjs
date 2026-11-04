// Run against an isolated PostgreSQL engine; never touches a remote project.
// PGlite is supplied by the existing firebase-tools dependency.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const notebook = '10000000-0000-4000-8000-000000000001';
const privateNotebook = '10000000-0000-4000-8000-000000000002';
const note = '20000000-0000-4000-8000-000000000001';
const sibling = '20000000-0000-4000-8000-000000000002';
const privateNote = '20000000-0000-4000-8000-000000000003';
async function as(role, uid = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.exec(`set role ${role}`);
}
async function ids(table) {
  return (await db.query(`select id from public.${table} order by id`)).rows.map((row) => row.id);
}
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid, bucket_id text, name text);
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
  `);
  const schema = (await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'))
    .replace('create extension if not exists "pgcrypto";', '');
  await db.exec(schema);
  const sharing = await readFile(new URL('../supabase/public-sharing.sql', import.meta.url), 'utf8');
  await db.exec(sharing);
  await db.exec(sharing); // Rerunning the upgrade must preserve publication state.
  await db.exec(`
    grant select, insert, update, delete on public.notebooks, public.notes,
      public.profiles, public.class_sessions to authenticated;
    grant select on public.profiles, public.class_sessions to anon;
    insert into auth.users(id, email) values ('${owner}', 'owner@example.com'), ('${other}', 'other@example.com');
    insert into public.notebooks(id, user_id, name) values
      ('${notebook}', '${owner}', 'Shared later'), ('${privateNotebook}', '${owner}', 'Private');
    insert into public.notes(id, user_id, notebook_id, title) values
      ('${note}', '${owner}', '${notebook}', 'First'),
      ('${sibling}', '${owner}', '${notebook}', 'Sibling'),
      ('${privateNote}', '${owner}', '${privateNotebook}', 'Private');
    insert into public.class_sessions(user_id, notebook_id, weekday, starts_at)
      values ('${owner}', '${notebook}', 1, '09:00');
  `);
  await as('anon');
  assert.deepEqual(await ids('notes'), []);
  assert.deepEqual(await ids('notebooks'), []);

  await as('authenticated', owner);
  await db.exec(`update public.notes set is_public = true where id = '${note}'`);
  await as('anon');
  assert.deepEqual(await ids('notes'), [note]);
  assert.deepEqual(await ids('notebooks'), []);

  await as('authenticated', owner);
  await db.exec(`update public.notebooks set is_public = true where id = '${notebook}'`);
  await as('anon');
  assert.deepEqual(await ids('notes'), [note, sibling]);
  assert.deepEqual(await ids('notebooks'), [notebook]);
  assert.deepEqual(await ids('profiles'), []);
  assert.deepEqual(await ids('class_sessions'), []);
  await assert.rejects(db.exec(`update public.notes set title = 'Hacked' where id = '${note}'`));

  await as('authenticated', other);
  assert.deepEqual(await ids('notes'), [note, sibling]);
  assert.equal((await db.query(`update public.notes set title = 'Hacked' where id = '${note}' returning id`)).rows.length, 0);
  assert.equal((await db.query(`delete from public.notebooks where id = '${notebook}' returning id`)).rows.length, 0);
  await assert.rejects(db.exec(`insert into public.notes(user_id, notebook_id) values ('${owner}', '${notebook}')`));
  // An inconsistent foreign row must never inherit another owner's publication.
  await db.exec(`insert into public.notes(user_id, notebook_id, title) values ('${other}', '${notebook}', 'Foreign')`);
  await as('anon');
  assert.deepEqual(await ids('notes'), [note, sibling]);

  await as('authenticated', owner);
  await db.exec(`insert into public.notes(user_id, notebook_id, title) values ('${owner}', '${notebook}', 'Future')`);
  await as('anon');
  assert.equal((await ids('notes')).length, 3);
  await as('authenticated', owner);
  await db.exec(`update public.notes set notebook_id = '${privateNotebook}' where id = '${sibling}'`);
  await as('anon');
  assert.equal((await ids('notes')).includes(sibling), false);

  await as('authenticated', owner);
  await db.exec(`update public.notebooks set is_public = false where id = '${notebook}'`);
  await as('anon');
  assert.deepEqual(await ids('notes'), [note]); // Independent note publication survives.
  assert.deepEqual(await ids('notebooks'), []);
  await as('authenticated', owner);
  await db.exec(`update public.notes set is_public = false where id = '${note}'`);
  await as('anon');
  assert.deepEqual(await ids('notes'), []);

  await as('authenticated', owner);
  await db.exec(`update public.notes set is_public = true where id = '${note}'; delete from public.notebooks where id = '${notebook}'`);
  await as('anon');
  assert.deepEqual(await ids('notes'), []);
  console.log('Public sharing SQL passed: private defaults, standalone and notebook access, future notes, owner isolation, read-only visitors, moves, revocation, deletion, idempotent upgrade.');
} finally {
  await db.close();
}
