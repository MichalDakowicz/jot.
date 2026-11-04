import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { loadPublic, type PublicContent } from '@jot/core/publicContent';
import { relative } from '@jot/core/time';

import { LogoMark, Wordmark } from '../components/Logo';
import { Markdown } from '../components/Markdown';

/**
 * A published note or notebook, set for reading only: no gutter, no marks,
 * no map. A notebook reads as one long page with its notes in order.
 */
export function SharePage() {
  const { kind, id } = useParams();
  const [content, setContent] = useState<PublicContent | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setContent(null);
    setProblem(null);
    loadPublic(kind, id)
      .then((c) => alive && setContent(c))
      .catch((e: unknown) => alive && setProblem(e instanceof Error ? e.message : 'Could not load this link.'));
    return () => { alive = false; };
  }, [kind, id, attempt]);

  useEffect(() => {
    const title = kind === 'notebook' ? content?.notebook?.name : content?.notes[0]?.title;
    document.title = title ? `${title} · Jot.` : 'Jot.';
  }, [content, kind]);

  const notes = content?.notes ?? [];
  const mentions = (content?.siblings ?? notes).map((n) => ({ id: n.id, title: n.title }));
  const readable = new Set(mentions.map((m) => m.id));
  const href = (noteId: string) => (readable.has(noteId) ? (kind === 'notebook' ? `#${noteId}` : `/share/note/${noteId}`) : null);

  return (
    <div className="share">
      <header className="share-head">
        <a href="/" className="share-brand"><LogoMark size={20} /><Wordmark /></a>
        <span className="muted">read-only</span>
      </header>
      <main className="share-body">
        {problem ? (
          <div className="share-problem">
            <p>{problem}</p>
            <button className="chip" onClick={() => setAttempt((a) => a + 1)}>try again</button>
          </div>
        ) : !content ? (
          <p className="muted" aria-busy="true">loading…</p>
        ) : (
          <>
            {kind === 'notebook' && content.notebook ? (
              <div className="share-notebook">
                <h1>{content.notebook.name}</h1>
                <p className="muted">{[content.notebook.code, content.notebook.prof].filter(Boolean).join(' · ')}</p>
                {notes.length > 1 ? (
                  <nav className="share-toc" aria-label="Notes">
                    {notes.map((n) => <a key={n.id} href={`#${n.id}`}>{n.title || 'Untitled'}</a>)}
                  </nav>
                ) : null}
              </div>
            ) : content.notebook ? (
              <p className="muted share-from">from <Link to={`/share/notebook/${content.notebook.id}`}>{content.notebook.name}</Link></p>
            ) : null}
            {notes.map((n) => (
              <article key={n.id} id={n.id} className="share-note">
                <h1 className="share-title">{n.title || 'Untitled'}</h1>
                <p className="muted share-meta">
                  {relative(n.updated_at)}{n.tags?.length ? ' · ' + n.tags.map((t) => '#' + t).join(' ') : ''}
                </p>
                <Markdown source={n.body} mentions={mentions} mentionHref={href} />
              </article>
            ))}
            {kind === 'note' && content.siblings && content.siblings.length > 1 ? (
              <nav className="share-more" aria-label="More from this notebook">
                <h2>more in {content.notebook?.name}</h2>
                {content.siblings.filter((s) => s.id !== id).map((s) => <Link key={s.id} to={`/share/note/${s.id}`}>{s.title || 'Untitled'}</Link>)}
              </nav>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
