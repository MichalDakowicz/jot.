import React from 'react';
import { useSearchParams } from 'react-router';

import { useStore } from '@jot/core/store';

import { NoteList } from '../components/NoteList';
import { TopBar } from '../components/Shell';

/** Every tag weighted by use, and the notes under the one picked. */
export function TagsPage() {
  const [params, setParams] = useSearchParams();
  const picked = params.get('tag');
  const { tagCounts, notesWithTag, cardOf } = useStore();
  const most = Math.max(1, ...tagCounts.map((t) => t.count));

  return (
    <>
      <TopBar crumbs={<><span>tags</span>{picked ? <><span className="sep">/</span><span className="here">#{picked}</span></> : null}</>} />
      <div className="content">
        <div className="page">
          <h1 className="page-title">Tags</h1>
          {tagCounts.length ? (
            <div className="tag-cloud">
              {tagCounts.map((t) => (
                <button key={t.name} className={'tag-cloud-item' + (picked === t.name ? ' on' : '')}
                  style={{ opacity: 0.55 + 0.45 * (t.count / most) }}
                  onClick={() => setParams(picked === t.name ? {} : { tag: t.name })}>
                  #{t.name}<span className="count">{t.count}</span>
                </button>
              ))}
            </div>
          ) : <p className="muted">No tags yet. Add them in the row under a note's title.</p>}
          {picked ? (
            <section className="section">
              <h2 className="label">#{picked}</h2>
              <NoteList cards={notesWithTag(picked).map(cardOf)} />
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
