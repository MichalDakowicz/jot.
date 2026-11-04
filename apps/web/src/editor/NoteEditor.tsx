import type { EditorView } from '@codemirror/view';
import React from 'react';

import type { Mentionable } from '@jot/core/markdown';
import { useStore } from '@jot/core/store';
import type { Note } from '@jot/core/types';

import { Editor } from './Editor';
import { useTitledDoc } from './useTitledDoc';

/** A note in the editor: its title as the first line, its body below. */
export function NoteEditor({ note, mentions, onMention, onView }: {
  note: Note;
  mentions: Mentionable[];
  onMention: (noteId: string) => void;
  onView: (view: EditorView) => void;
}) {
  const { updateNote } = useStore();
  const { value, onChange } = useTitledDoc(note, updateNote);
  return (
    <Editor key={note.id} value={value} onChange={onChange} autoFocus={!note.title && !note.body}
      mentions={mentions} onMention={onMention} onView={onView} />
  );
}
