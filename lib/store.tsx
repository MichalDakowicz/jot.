import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './auth';
import { utf8ToBytes } from './bytes';
import { applyChange, takesNote, upsertRows, type Change } from './live';
import { plainText, type Mentionable } from './markdown';
import { SEED_CLASSES, SEED_NOTEBOOKS, SEED_NOTES } from './seed';
import { supabase, supabaseConfigured } from './supabase';
import { tagsOf } from './tags';
import { relative } from './time';
import { tintOf } from '../theme/tokens';
import type { ClassSession, Note, NoteCard, Notebook } from './types';

const SAVE_DEBOUNCE_MS = 700;

type TagCount = { name: string; count: number };

/** What a note edit can change; the editor saves these as they are made. */
export type NotePatch = { title?: string; body?: string; tags?: string[]; notebook_id?: string };

type StoreValue = {
  loading: boolean;
  error: string | null;
  notebooks: Notebook[];
  notes: Note[];
  classes: ClassSession[];
  mentionables: Mentionable[];
  tagCounts: TagCount[];

  refresh: () => Promise<void>;
  noteById: (id: string | undefined) => Note | undefined;
  notebookById: (id: string | undefined) => Notebook | undefined;
  notesOf: (notebookId: string) => Note[];
  cardOf: (note: Note) => NoteCard;
  linksOf: (note: Note) => Note[];
  backlinksOf: (note: Note) => Note[];
  notesWithTag: (tag: string) => Note[];
  search: (query: string, notebookId?: string | null) => Note[];
  todaysClasses: () => (ClassSession & { notebook: Notebook | undefined })[];
  classesOf: (notebookId: string) => ClassSession[];

  createNote: (notebookId: string) => Promise<Note | null>;
  updateNote: (id: string, patch: NotePatch) => void;
  flushSaves: () => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  createNotebook: (input: { name: string; code: string; prof: string; tint: number }) => Promise<Notebook | null>;
  addClasses: (input: {
    notebookId: string;
    weekdays: number[];
    starts_at: string;
    room: string;
  }) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  exportNotebook: (notebookId: string) => Promise<{ markdown: string; url: string | null }>;
  seedDemoContent: () => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

const byUpdatedDesc = (a: Note, b: Note) =>
  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

const byPosition = (a: Notebook, b: Notebook) => a.position - b.position;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, NotePatch>>({});
  /** Saves on their way to the server, per note. */
  const saving = useRef<Record<string, number>>({});
  /** The server's `updated_at` from this device's last save of each note. */
  const savedAt = useRef<Record<string, string>>({});

  /** A note with an edit from here that the server has not answered yet. */
  const busy = useCallback((id: string) => !!pending.current[id] || !!saving.current[id], []);

  /**
   * Everything, fresh from the server. Quietly when catching up after the app
   * was away: no loading state, and a note still being written here keeps the
   * writing rather than the server's older copy of it.
   */
  const load = useCallback(
    async (quiet: boolean) => {
      if (!uid || !supabaseConfigured) return;
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      const [nb, nt, cs] = await Promise.all([
        supabase.from('notebooks').select('*').order('position', { ascending: true }),
        supabase.from('notes').select('*').order('updated_at', { ascending: false }),
        supabase.from('class_sessions').select('*').order('starts_at', { ascending: true }),
      ]);
      const firstError = nb.error ?? nt.error ?? cs.error;
      if (firstError) setError(firstError.message);
      // A list that did not come back is left as it was, not emptied.
      if (nb.data) setNotebooks(nb.data as Notebook[]);
      if (nt.data) {
        const fresh = nt.data as Note[];
        setNotes((prev) => fresh.map((n) => (busy(n.id) ? (prev.find((p) => p.id === n.id) ?? n) : n)));
      }
      if (cs.data) setClasses(cs.data as ClassSession[]);
      if (!quiet) setLoading(false);
    },
    [uid, busy],
  );

  const refresh = useCallback(() => load(false), [load]);

  useEffect(() => {
    if (!uid) {
      setNotebooks([]);
      setNotes([]);
      setClasses([]);
      return;
    }
    refresh();
  }, [uid, refresh]);

  // Changes made anywhere else — the website, another phone — land here as
  // they happen, so what is on screen is never older than what was saved.
  useEffect(() => {
    if (!uid || !supabaseConfigured) return;
    let dropped = false;
    const channel = supabase
      .channel(`jot:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notebooks' }, (payload) => {
        const change = payload as unknown as Change<Notebook>;
        setNotebooks((prev) => applyChange(prev, change, byPosition));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        const change = payload as unknown as Change<Note>;
        if (change.eventType === 'DELETE') {
          const id = change.old.id;
          if (id) {
            if (timers.current[id]) clearTimeout(timers.current[id]);
            delete timers.current[id];
            delete pending.current[id];
          }
        } else {
          const id = change.new.id ?? '';
          if (!takesNote(change.new, { busy: busy(id), savedAt: savedAt.current[id] })) return;
        }
        setNotes((prev) => applyChange(prev, change, byUpdatedDesc));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_sessions' }, (payload) => {
        const change = payload as unknown as Change<ClassSession>;
        setClasses((prev) => applyChange(prev, change));
      })
      .subscribe((status) => {
        // The socket came back after losing its place: anything sent while it
        // was gone was missed, so read it all again.
        if (status === 'SUBSCRIBED') {
          if (dropped) void load(true);
          dropped = false;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          dropped = true;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, busy, load]);

  // Back from the background, or a browser tab shown again: a phone drops its
  // socket while it sleeps, so catch up on whatever happened meanwhile.
  useEffect(() => {
    if (!uid) return;
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && last !== 'active') void load(true);
      last = next;
    });
    return () => sub.remove();
  }, [uid, load]);

  /** Push a queued note change; keeps the local copy authoritative. */
  const pushSave = useCallback(async (id: string) => {
    const patch = pending.current[id];
    delete pending.current[id];
    delete timers.current[id];
    if (!patch) return;
    saving.current[id] = (saving.current[id] ?? 0) + 1;
    const { data, error: saveError } = await supabase
      .from('notes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('updated_at');
    saving.current[id] -= 1;
    if (!saving.current[id]) delete saving.current[id];
    if (saveError) setError(saveError.message);
    // The server stamps the row itself; that stamp is how this save's own echo
    // is told apart from a change made somewhere else.
    const stamp = (data as { updated_at: string }[] | null)?.[0]?.updated_at;
    if (stamp) savedAt.current[id] = stamp;
  }, []);

  const updateNote = useCallback(
    (id: string, patch: NotePatch) => {
      const stamp = new Date().toISOString();
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: stamp } : n)));
      pending.current[id] = { ...(pending.current[id] ?? {}), ...patch };
      if (timers.current[id]) clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => pushSave(id), SAVE_DEBOUNCE_MS);
    },
    [pushSave],
  );

  const flushSaves = useCallback(async () => {
    const ids = Object.keys(pending.current);
    ids.forEach((id) => {
      if (timers.current[id]) clearTimeout(timers.current[id]);
    });
    await Promise.all(ids.map((id) => pushSave(id)));
  }, [pushSave]);

  useEffect(() => () => void flushSaves(), [flushSaves]);

  const nbOf = useCallback(
    (id: string | undefined) => notebooks.find((b) => b.id === id),
    [notebooks],
  );

  const mentionables = useMemo<Mentionable[]>(
    () => notes.map((n) => ({ id: n.id, title: n.title })),
    [notes],
  );

  const tagCounts = useMemo<TagCount[]>(() => {
    const counts: Record<string, number> = {};
    notes.forEach((n) => tagsOf(n).forEach((t) => (counts[t] = (counts[t] ?? 0) + 1)));
    return Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
      .map((name) => ({ name, count: counts[name] }));
  }, [notes]);

  const cardOf = useCallback(
    (note: Note): NoteCard => {
      const nb = nbOf(note.notebook_id);
      const tone = tintOf(nb?.tint ?? 0);
      return {
        id: note.id,
        title: note.title,
        when: relative(note.updated_at),
        snippet: plainText(note.body).slice(0, 116),
        tags: tagsOf(note).slice(0, 3),
        nbId: note.notebook_id,
        nbName: nb?.name ?? 'Notebook',
        tint: tone.tint,
        soft: tone.soft,
        dark: tone.dark,
      };
    },
    [nbOf],
  );

  const linksOf = useCallback(
    (note: Note) => notes.filter((o) => o.id !== note.id && note.body.includes('@' + o.title)),
    [notes],
  );

  const backlinksOf = useCallback(
    (note: Note) => notes.filter((o) => o.id !== note.id && o.body.includes('@' + note.title)),
    [notes],
  );

  const value = useMemo<StoreValue>(
    () => ({
      loading,
      error,
      notebooks,
      notes,
      classes,
      mentionables,
      tagCounts,
      refresh,

      noteById: (id) => notes.find((n) => n.id === id),
      notebookById: nbOf,
      notesOf: (notebookId) => notes.filter((n) => n.notebook_id === notebookId).sort(byUpdatedDesc),
      cardOf,
      linksOf,
      backlinksOf,

      notesWithTag: (tag) => notes.filter((n) => tagsOf(n).includes(tag.toLowerCase())).sort(byUpdatedDesc),

      search: (query, notebookId) => {
        const pool = notebookId ? notes.filter((n) => n.notebook_id === notebookId) : notes;
        const q = query.trim().toLowerCase();
        if (!q) return pool.slice().sort(byUpdatedDesc);
        if (q.startsWith('#')) {
          const want = q.slice(1);
          return pool.filter((n) => tagsOf(n).some((t) => t.startsWith(want))).sort(byUpdatedDesc);
        }
        return pool
          .filter((n) => [n.title, n.body, ...tagsOf(n)].join(' ').toLowerCase().includes(q))
          .sort(byUpdatedDesc);
      },

      todaysClasses: () => {
        const weekday = new Date().getDay();
        return classes
          .filter((s) => s.weekday === weekday)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .map((s) => ({ ...s, notebook: nbOf(s.notebook_id) }));
      },

      classesOf: (notebookId) =>
        classes
          .filter((s) => s.notebook_id === notebookId)
          .sort((a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at)),

      /** One row per weekday, so a class that meets three times is three sessions. */
      async addClasses({ notebookId, weekdays, starts_at, room }) {
        if (!uid || !weekdays.length) return;
        const rows = weekdays.map((weekday) => ({
          user_id: uid,
          notebook_id: notebookId,
          weekday,
          starts_at,
          room,
        }));
        const { data, error: insertError } = await supabase.from('class_sessions').insert(rows).select();
        if (insertError) {
          setError(insertError.message);
          return;
        }
        setClasses((prev) => upsertRows(prev, (data as ClassSession[]) ?? []));
      },

      async deleteClass(id) {
        setClasses((prev) => prev.filter((s) => s.id !== id));
        const { error: delError } = await supabase.from('class_sessions').delete().eq('id', id);
        if (delError) setError(delError.message);
      },

      async createNote(notebookId) {
        if (!uid) return null;
        const count = notes.filter((n) => n.notebook_id === notebookId).length;
        const row = {
          user_id: uid,
          notebook_id: notebookId,
          title: 'Untitled note',
          body: `Lecture ${count + 1}\n\n`,
        };
        const { data, error: insertError } = await supabase.from('notes').insert(row).select().single();
        if (insertError) {
          setError(insertError.message);
          return null;
        }
        const note = data as Note;
        setNotes((prev) => upsertRows(prev, [note]));
        return note;
      },

      updateNote,
      flushSaves,

      async deleteNote(id) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        delete pending.current[id];
        if (timers.current[id]) clearTimeout(timers.current[id]);
        const { error: delError } = await supabase.from('notes').delete().eq('id', id);
        if (delError) setError(delError.message);
      },

      async createNotebook(input) {
        if (!uid) return null;
        const row = { ...input, user_id: uid, position: notebooks.length };
        const { data, error: insertError } = await supabase
          .from('notebooks')
          .insert(row)
          .select()
          .single();
        if (insertError) {
          setError(insertError.message);
          return null;
        }
        const nb = data as Notebook;
        setNotebooks((prev) => upsertRows(prev, [nb], byPosition));
        return nb;
      },

      async deleteNotebook(id) {
        setNotebooks((prev) => prev.filter((b) => b.id !== id));
        setNotes((prev) => prev.filter((n) => n.notebook_id !== id));
        setClasses((prev) => prev.filter((s) => s.notebook_id !== id));
        const { error: delError } = await supabase.from('notebooks').delete().eq('id', id);
        if (delError) setError(delError.message);
      },

      async exportNotebook(notebookId) {
        const nb = nbOf(notebookId);
        const own = notes.filter((n) => n.notebook_id === notebookId).sort(byUpdatedDesc);
        const markdown = [
          `# ${nb?.name ?? 'Notebook'}`,
          `${nb?.code ?? ''} · ${nb?.prof ?? ''} · ${own.length} notes`,
          '',
          ...own.map((n) =>
            [
              `---`,
              ``,
              `## ${n.title}`,
              `*edited ${relative(n.updated_at)}*`,
              ...(tagsOf(n).length ? [tagsOf(n).map((t) => '#' + t).join(' ')] : []),
              ``,
              n.body,
              ``,
            ].join('\n'),
          ),
        ].join('\n');

        if (!uid) return { markdown, url: null };
        const path = `${uid}/${(nb?.code ?? 'notebook').toLowerCase()}-${Date.now()}.md`;
        const { error: upError } = await supabase.storage
          .from('exports')
          .upload(path, utf8ToBytes(markdown), { contentType: 'text/markdown', upsert: true });
        if (upError) {
          setError(upError.message);
          return { markdown, url: null };
        }
        const { data } = await supabase.storage.from('exports').createSignedUrl(path, 60 * 60 * 24 * 7);
        return { markdown, url: data?.signedUrl ?? null };
      },

      async seedDemoContent() {
        if (!uid) return;
        const nbRows = SEED_NOTEBOOKS.map((b, i) => ({
          user_id: uid,
          name: b.name,
          code: b.code,
          prof: b.prof,
          tint: b.tint,
          position: i,
        }));
        const { data: madeNb, error: nbError } = await supabase.from('notebooks').insert(nbRows).select();
        if (nbError || !madeNb) {
          setError(nbError?.message ?? 'Could not create notebooks');
          return;
        }
        const idByKey: Record<string, string> = {};
        SEED_NOTEBOOKS.forEach((b, i) => {
          idByKey[b.key] = (madeNb as Notebook[])[i].id;
        });

        const now = Date.now();
        const noteRows = SEED_NOTES.map((n) => ({
          user_id: uid,
          notebook_id: idByKey[n.nb],
          title: n.title,
          body: n.body,
          tags: n.tags,
          created_at: new Date(now - n.agoHours * 3_600_000).toISOString(),
          updated_at: new Date(now - n.agoHours * 3_600_000).toISOString(),
        }));
        const classRows = SEED_CLASSES.flatMap((s) =>
          s.weekdays.map((weekday) => ({
            user_id: uid,
            notebook_id: idByKey[s.nb],
            weekday,
            starts_at: s.starts_at,
            room: s.room,
          })),
        );

        const [noteRes, classRes] = await Promise.all([
          supabase.from('notes').insert(noteRows).select(),
          supabase.from('class_sessions').insert(classRows).select(),
        ]);
        if (noteRes.error) setError(noteRes.error.message);
        if (classRes.error) setError(classRes.error.message);

        setNotebooks(madeNb as Notebook[]);
        setNotes(((noteRes.data as Note[]) ?? []).slice().sort(byUpdatedDesc));
        setClasses((classRes.data as ClassSession[]) ?? []);
      },
    }),
    [
      loading,
      error,
      notebooks,
      notes,
      classes,
      mentionables,
      tagCounts,
      refresh,
      nbOf,
      cardOf,
      linksOf,
      backlinksOf,
      updateNote,
      flushSaves,
      uid,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}
