import type { EditorView } from '@codemirror/view';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { countOf, plural } from '@jot/core/count';
import { useStore } from '@jot/core/store';
import { relative } from '@jot/core/time';

import { Icon } from '../components/Icon';
import { NotebookDot } from '../components/NotebookDot';
import { PublicLink } from '../components/PublicLink';
import { TopBar, useStatus } from '../components/Shell';
import { TagRow } from '../components/TagRow';
import { Editor } from '../editor/Editor';
import { Minimap } from '../editor/Minimap';

/** A note opens straight into its source: title, tags, body, and the map beside it. */
export function NotePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { noteById, notebookById, notebooks, mentionables, linksOf, backlinksOf, updateNote, flushSaves, deleteNote } = useStore();
  const note = noteById(id);
  const nb = notebookById(note?.notebook_id);
  const [view, setView] = useState<EditorView | null>(null);
  const [tick, setTick] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  // Leaving the note sends whatever is still waiting on the debounce.
  useEffect(() => () => void flushSaves(), [id, flushSaves]);

  const onView = useCallback((v: EditorView) => {
    setView(v);
    setTick((t) => t + 1);
  }, []);

  const caret = view ? view.state.doc.lineAt(view.state.selection.main.head) : null;
  const { words, chars } = countOf(note?.body ?? '');
  useStatus({
    left: note ? <span className="wide-only">{relative(note.updated_at)}</span> : null,
    right: note ? (
      <>
        {caret ? <span>Ln {caret.number}, Col {view!.state.selection.main.head - caret.from + 1}</span> : null}
        <span>{words} {plural(words, 'word')}</span>
        <span className="wide-only">{chars} {plural(chars, 'char')}</span>
        <span className="wide-only">markdown</span>
      </>
    ) : null,
  }, [note?.updated_at, words, chars, tick]);

  if (!note) {
    return (
      <>
        <TopBar crumbs={<span className="here">not found</span>} />
        <div className="page"><p className="muted">This note is not here. It may have been deleted on another device.</p></div>
      </>
    );
  }

  const links = linksOf(note);
  const backlinks = backlinksOf(note);

  return (
    <>
      <TopBar
        crumbs={<>
          {nb ? <Link to={`/notebook/${nb.id}`}>{nb.name}</Link> : null}
          <span className="sep">/</span>
          <span className="here">{(note.title || 'untitled').toLowerCase().replace(/\s+/g, '-')}.md</span>
        </>}
        actions={<>
          <PublicLink kind="note" id={note.id} published={!!note.is_public} inherited={!!nb?.is_public} />
          <button className="icon-button" aria-label="Delete this note" onClick={async () => {
            if (!window.confirm(`Delete “${note.title || 'Untitled'}”? This cannot be undone.`)) return;
            const back = nb ? `/notebook/${nb.id}` : '/today';
            await deleteNote(note.id);
            navigate(back, { replace: true });
          }}><Icon name="trash" /></button>
        </>}
      />
      <div className="content" ref={scroller}>
        <div className="note-layout">
          <div className="note-column">
            <div className="note-head">
              <input className="note-title" value={note.title} placeholder="Untitled" aria-label="Title"
                onChange={(e) => updateNote(note.id, { title: e.target.value })} />
              <div className="note-meta">
                <label className="notebook-pick">
                  {nb ? <NotebookDot tint={nb.tint} /> : null}
                  <select value={note.notebook_id} aria-label="Notebook"
                    onChange={(e) => updateNote(note.id, { notebook_id: e.target.value })}>
                    {notebooks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
                <TagRow tags={note.tags ?? []} onChange={(tags) => updateNote(note.id, { tags })} />
              </div>
            </div>
            <Editor key={note.id} value={note.body} autoFocus={!note.body}
              onChange={(body) => updateNote(note.id, { body })}
              mentions={mentionables.filter((m) => m.id !== note.id)}
              onMention={(target) => navigate(`/note/${target}`)}
              onView={onView} />
            {links.length || backlinks.length ? (
              <section className="references">
                {links.length ? <><h2>links to</h2><ul>{links.map((n) => <li key={n.id}><Link to={`/note/${n.id}`}>@{n.title}</Link></li>)}</ul></> : null}
                {backlinks.length ? <><h2>linked from</h2><ul>{backlinks.map((n) => <li key={n.id}><Link to={`/note/${n.id}`}>@{n.title}</Link></li>)}</ul></> : null}
              </section>
            ) : null}
          </div>
          <Minimap view={view} tick={tick} scroller={scroller.current} />
        </div>
      </div>
    </>
  );
}
