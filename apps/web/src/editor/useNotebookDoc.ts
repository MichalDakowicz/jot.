import type { EditorState } from '@codemirror/state';
import { useCallback, useEffect, useRef, useState } from 'react';

import { notebookDocOf, sectionsOf } from '@jot/core/notebookDoc';
import type { NoteInit, NotePatch } from '@jot/core/store';
import type { Note } from '@jot/core/types';

import { sectionIdsOf } from './sections';

/** How long a note whose heading went away waits before it is deleted; an undo inside it costs nothing. */
const DELETE_GRACE_MS = 1500;

/**
 * While typing, and this long after, the editor's text is the truth: the store
 * can lag a keystroke behind, and handing that back would undo the typing. A
 * change from another device lands once the editor has been quiet this long.
 */
const QUIET_MS = 3000;

type Store = {
  createNote: (notebookId: string, init?: NoteInit) => Promise<Note | null>;
  updateNote: (id: string, patch: NotePatch) => void;
  deleteNote: (id: string) => Promise<void>;
};

/**
 * A notebook's notes as one document, and every edit to it written back to
 * the notes: a changed section updates its note, a new "# " creates one, a
 * section that is gone deletes its note once the grace period passes.
 *
 * While the editor's own work is in flight, or the store already holds what
 * the editor last sent, the editor keeps its exact text; only a change made
 * elsewhere is rebuilt from the rows.
 */
export function useNotebookDoc(notebookId: string, notes: Note[], store: Store) {
  const latest = useRef({ notes, store });
  latest.current = { notes, store };
  const last = useRef<{ notebookId: string; doc: string; state: EditorState } | null>(null);
  const creating = useRef(new Set<string>());
  /** Notes this editor made; the rows can reach the store a render after the insert answers. */
  const made = useRef(new Set<string>());
  const lastEdit = useRef(0);
  const [, wake] = useState(0);
  const deleting = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const sync = useCallback((doc: string, state: EditorState) => {
    last.current = { notebookId, doc, state };
    lastEdit.current = Date.now();
    const { notes: rows, store: s } = latest.current;
    const byId = new Map(rows.map((n) => [n.id, n]));
    const ids = sectionIdsOf(state);
    const { sections } = sectionsOf(doc);
    // Every heading carries its note. If that ever fails, write nothing rather than guess:
    // a missing id would read as a deleted note.
    if (ids.length !== sections.length) return;

    sections.forEach((section, position) => {
      const id = ids[position];
      if (!id) return;
      const pending = deleting.current.get(id);
      if (pending) {
        clearTimeout(pending);
        deleting.current.delete(id);
      }
      const note = byId.get(id);
      if (!note && made.current.has(id)) {
        // Made, but not in this render's rows yet: write the section as it stands.
        s.updateNote(id, { title: section.title, body: section.body, position });
      } else if (note) {
        const patch: NotePatch = {
          ...(note.title !== section.title ? { title: section.title } : {}),
          ...(note.body !== section.body ? { body: section.body } : {}),
          ...(note.position !== position ? { position } : {}),
        };
        if (Object.keys(patch).length) s.updateNote(id, patch);
      } else if (!creating.current.has(id)) {
        creating.current.add(id);
        void s.createNote(notebookId, { id, title: section.title, body: section.body, position }).then((row) => {
          creating.current.delete(id);
          if (row) made.current.add(id);
          // Typing went on while the row was made; send what the document holds now.
          if (last.current?.notebookId === notebookId) sync(last.current.doc, last.current.state);
        });
      }
    });

    const kept = new Set(ids);
    for (const note of rows) {
      if (kept.has(note.id) || deleting.current.has(note.id)) continue;
      deleting.current.set(note.id, setTimeout(() => {
        deleting.current.delete(note.id);
        void latest.current.store.deleteNote(note.id);
      }, DELETE_GRACE_MS));
    }
  }, [notebookId]);

  // Once the editor goes quiet, render again so a change from elsewhere can land.
  useEffect(() => {
    const left = QUIET_MS - (Date.now() - lastEdit.current);
    if (left <= 0) return;
    const timer = setTimeout(() => wake((n) => n + 1), left + 10);
    return () => clearTimeout(timer);
  });

  // Leaving the notebook carries out the deletions still waiting.
  useEffect(() => () => {
    for (const [id, timer] of deleting.current) {
      clearTimeout(timer);
      void latest.current.store.deleteNote(id);
    }
    deleting.current.clear();
  }, [notebookId]);

  const mine = last.current?.notebookId === notebookId ? last.current : null;
  // An empty notebook still opens on a heading, so the first keystroke starts its first note.
  let value = notes.length ? notebookDocOf(notes) : '# ';
  if (mine) {
    const inFlight = creating.current.size > 0 || deleting.current.size > 0 || Date.now() - lastEdit.current < QUIET_MS;
    const ids = sectionIdsOf(mine.state);
    const { sections } = sectionsOf(mine.doc);
    const same = sections.length === notes.length && sections.every((sec, k) =>
      ids[k] === notes[k].id && sec.title === notes[k].title && sec.body === notes[k].body);
    if (inFlight || same) value = mine.doc;
  }

  return { value, ids: notes.map((n) => n.id), onChange: sync };
}
