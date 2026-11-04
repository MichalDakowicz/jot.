import React from 'react';
import { Link } from 'react-router';

import type { NoteCard } from '@jot/core/types';

/** Notes as file rows: title, a line of the body, where it lives, when. */
export function NoteList({ cards, showNotebook = true }: { cards: NoteCard[]; showNotebook?: boolean }) {
  if (!cards.length) return <p className="muted">no notes</p>;
  return (
    <ul className="rows">
      {cards.map((n) => (
        <li key={n.id}>
          <Link className="row-link note-row" to={`/note/${n.id}`}>
            <span className="note-row-title">{n.title || 'Untitled'}</span>
            <span className="note-row-snippet">{n.snippet}</span>
            <span className="note-row-meta">
              {showNotebook ? <span>{n.nbName}</span> : null}
              {n.tags.map((t) => <span key={t}>#{t}</span>)}
              <span>{n.when}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
