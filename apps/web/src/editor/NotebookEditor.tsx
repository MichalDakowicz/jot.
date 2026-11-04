import type { EditorView } from '@codemirror/view';
import React, { useMemo } from 'react';

import { notebookDocOf } from '@jot/core/notebookDoc';
import { useStore } from '@jot/core/store';
import type { Note } from '@jot/core/types';

import { Editor } from './Editor';
import { notebookSections, setSectionIds } from './sections';
import { useNotebookDoc } from './useNotebookDoc';

/** A notebook in the editor: every note a "# " section, written back to its own row as it is edited. */
export function NotebookEditor({ notebookId, notes, startNote, onMention, onView }: {
  notebookId: string;
  notes: Note[];
  /** The note to open at, for a link to one note. */
  startNote: string | null;
  onMention: (noteId: string) => void;
  onView: (view: EditorView) => void;
}) {
  const { mentionables, createNote, updateNote, deleteNote } = useStore();
  const { value, ids, onChange } = useNotebookDoc(notebookId, notes, { createNote, updateNote, deleteNote });
  // Made once per notebook: later ids arrive with copies from elsewhere.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const extensions = useMemo(() => [notebookSections(ids)], [notebookId]);
  const startAt = useMemo(() => {
    const k = startNote ? notes.findIndex((n) => n.id === startNote) : -1;
    return k > 0 ? notebookDocOf(notes.slice(0, k)).length + 1 : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId]);

  return (
    <Editor key={notebookId} value={value} onChange={onChange} extensions={extensions}
      incomingEffects={() => [setSectionIds.of(ids)]} startAt={startAt} autoFocus={!notes.length}
      mentions={mentionables} onMention={onMention} onView={onView} />
  );
}
