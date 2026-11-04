import React from 'react';
import { useSearchParams } from 'react-router';

import { useStore } from '@jot/core/store';

import { NoteList } from '../components/NoteList';
import { TopBar } from '../components/Shell';

/** Free text, or #tag, across every note. */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const { search, cardOf } = useStore();
  const hits = q.trim() ? search(q) : [];

  return (
    <>
      <TopBar crumbs={<span className="here">search</span>} />
      <div className="content">
        <div className="page">
          <input className="field search-field" autoFocus value={q} placeholder="search notes, or #tag"
            aria-label="Search" onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} />
          {q.trim() ? (
            <section className="section">
              <h2 className="label">{hits.length} {hits.length === 1 ? 'result' : 'results'}</h2>
              <NoteList cards={hits.map(cardOf)} />
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
