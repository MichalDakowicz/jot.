import { EditorView } from '@codemirror/view';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { countOf, plural } from '@jot/core/count';
import { useStore } from '@jot/core/store';

import { Icon } from '../components/Icon';
import { NoteBar } from '../components/NoteBar';
import { NotebookDot } from '../components/NotebookDot';
import { NotebookSettings } from '../components/NotebookSettings';
import { TopBar, useStatus } from '../components/Shell';
import { Minimap } from '../editor/Minimap';
import { NotebookEditor } from '../editor/NotebookEditor';
import { isOnlyNewest, shownRange, toggleOnlyNewest } from '../editor/newest';
import { sectionAt, sectionRanges } from '../editor/sections';

/** A notebook is one file: its notes are the "# " sections in it. */
export function NotebookPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { notebookById, notesOf, noteById } = useStore();
  const nb = notebookById(id);
  const notes = nb ? notesOf(nb.id) : [];
  const [view, setView] = useState<EditorView | null>(null);
  const [tick, setTick] = useState(0);
  const [settings, setSettings] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const wanted = params.get('note');

  const onView = useCallback((v: EditorView) => {
    setView(v);
    setTick((t) => t + 1);
  }, []);

  // A link to one note, followed while the notebook is already open, moves the caret there.
  useEffect(() => {
    if (!view || !wanted) return;
    const range = sectionRanges(view.state).find((r) => r.id === wanted);
    if (range) view.dispatch({ selection: { anchor: range.from + 2 }, effects: EditorView.scrollIntoView(range.from, { y: 'start', yMargin: 64 }) });
    setParams({}, { replace: true });
  }, [view, wanted, setParams]);

  const current = view ? noteById(sectionAt(view.state, view.state.selection.main.head) ?? undefined) : undefined;
  const caret = view ? view.state.doc.lineAt(view.state.selection.main.head) : null;
  // Counts cover what is on show: the newest note alone while only it is shown.
  const shown = view ? shownRange(view.state) : { from: 0, to: 0 };
  const { words, chars } = countOf(view ? view.state.doc.sliceString(shown.from, shown.to) : '');
  const selected = view ? view.state.selection.ranges.filter((r) => !r.empty).map((r) => view.state.doc.sliceString(r.from, r.to)) : [];
  const picked = countOf(selected.join('\n'));
  const folded = view ? isOnlyNewest(view.state) : false;
  useStatus({
    left: (
      <>
        <span className="wide-only">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
        {notes.length > 1 ? (
          <button className={'status-button' + (folded ? ' on' : '')} aria-pressed={folded}
            onClick={() => view && toggleOnlyNewest(view)}>{folded ? 'show all notes' : 'newest only'}</button>
        ) : null}
      </>
    ),
    right: caret ? (
      <>
        <span>Ln {caret.number}, Col {view!.state.selection.main.head - caret.from + 1}</span>
        <span>{selected.length ? `${picked.words.toLocaleString('en')} of ` : ''}{plural(words, 'word')}</span>
        <span className="wide-only">{selected.length ? `${picked.chars.toLocaleString('en')} of ` : ''}{plural(chars, 'char')}</span>
        <span className="wide-only">markdown</span>
      </>
    ) : null,
  }, [notes.length, words, chars, picked.words, picked.chars, selected.length, folded, tick]);

  if (!nb) {
    return (
      <>
        <TopBar crumbs={<span className="here">not found</span>} />
        <div className="page"><p className="muted">This notebook is not here.</p></div>
      </>
    );
  }

  function addNote() {
    if (!view) return;
    const end = view.state.doc.length;
    view.dispatch({ changes: { from: end, insert: '\n# ' }, selection: { anchor: end + 3 }, scrollIntoView: true });
    view.focus();
  }

  function removeCurrent() {
    if (!view || !current) return;
    const range = sectionRanges(view.state).find((r) => r.id === current.id);
    if (!range) return;
    // A section takes its line break with it, from whichever side has one.
    const from = range.to === view.state.doc.length && range.from > 0 ? range.from - 1 : range.from;
    view.dispatch({ changes: { from, to: range.to } });
  }

  return (
    <>
      <TopBar
        crumbs={<>
          <NotebookDot tint={nb.tint} />
          <span className="here">{nb.name.toLowerCase().replace(/\s+/g, '-')}.md</span>
          {current ? <><span className="sep">›</span><span className="crumb-note">{current.title || 'Untitled'}</span></> : null}
        </>}
        actions={<>
          <button className="chip" onClick={addNote}><Icon name="plus" size={14} /> note</button>
          <button className={'chip' + (settings ? ' on' : '')} aria-pressed={settings} onClick={() => setSettings((s) => !s)}>notebook</button>
        </>}
      />
      {current ? <NoteBar note={current} notebookPublic={!!nb.is_public} onRemove={removeCurrent} /> : null}
      <div className="content" ref={scroller}>
        <div className="note-layout">
          <div className="note-column">
            {settings ? <NotebookSettings notebook={nb} noteCount={notes.length} /> : (
              <p className="notebook-head muted">{[nb.code, nb.prof].filter(Boolean).join(' · ')}</p>
            )}
            <NotebookEditor notebookId={nb.id} notes={notes} startNote={wanted}
              onMention={(target) => navigate(`/note/${target}`)} onView={onView} />
          </div>
          <Minimap view={view} tick={tick} scroller={scroller.current} fromLine={view ? view.state.doc.lineAt(shown.from).number : 1} />
        </div>
      </div>
    </>
  );
}
