import { useCallback, useRef } from 'react';

import type { NotePatch } from '@jot/core/store';
import { splitTitled, titledDoc } from '@jot/core/titled';
import type { Note } from '@jot/core/types';

/**
 * The note as one editor document, title line first.
 *
 * Title and body are stored apart, and joining them back cannot tell "# Cells"
 * from "# Cells\n" — both are that title with an empty body. So while the
 * store still holds what the editor last sent, the editor gets its own text
 * back unchanged, and only a change made elsewhere is rebuilt from the row.
 */
export function useTitledDoc(note: Note, update: (id: string, patch: NotePatch) => void) {
  const last = useRef<{ id: string; doc: string } | null>(null);
  const mine = last.current?.id === note.id ? last.current.doc : null;
  const parts = mine === null ? null : splitTitled(mine);
  const value = parts && parts.title === note.title && parts.body === note.body ? mine! : titledDoc(note.title, note.body);

  const onChange = useCallback((doc: string) => {
    const before = splitTitled(last.current?.id === note.id ? last.current.doc : titledDoc(note.title, note.body));
    const { title, body } = splitTitled(doc);
    last.current = { id: note.id, doc };
    const patch: NotePatch = {
      ...(title !== before.title ? { title } : {}),
      ...(body !== before.body ? { body } : {}),
    };
    if (Object.keys(patch).length) update(note.id, patch);
  }, [note.id, note.title, note.body, update]);

  return { value, onChange };
}
