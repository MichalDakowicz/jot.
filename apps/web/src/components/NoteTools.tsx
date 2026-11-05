import React from 'react';
import { Link } from 'react-router';

import { useStore } from '@jot/core/store';
import type { Note } from '@jot/core/types';

import { Icon } from './Icon';
import { PublicLink } from './PublicLink';
import { TagRow } from './TagRow';

/**
 * The note the caret is in, in the top bar beside its title: its tags, what
 * it links to and what links to it, its own public link, and a way to remove
 * it — the parts of a note that are not its text.
 */
export function NoteTools({ note, notebookPublic, onRemove }: { note: Note; notebookPublic: boolean; onRemove: () => void }) {
  const { updateNote, linksOf, backlinksOf } = useStore();
  const links = linksOf(note);
  const backlinks = backlinksOf(note);
  return (
    <span className="note-tools" aria-label="This note">
      <TagRow tags={note.tags ?? []} onChange={(tags) => updateNote(note.id, { tags })} />
      {links.length || backlinks.length ? (
        <span className="note-tools-links">
          {links.length ? <span title={links.map((n) => n.title).join(', ')}>→ {links.length}</span> : null}
          {backlinks.map((n) => <Link key={n.id} to={`/note/${n.id}`} title="Links here">← {n.title}</Link>)}
        </span>
      ) : null}
      <PublicLink kind="note" id={note.id} published={!!note.is_public} inherited={notebookPublic} />
      <button className="icon-button" aria-label="Delete this note" title="Delete this note" onClick={() => {
        if (window.confirm(`Delete “${note.title || 'Untitled'}”? Undo brings it back for a moment; after that it is gone.`)) onRemove();
      }}><Icon name="trash" /></button>
    </span>
  );
}
