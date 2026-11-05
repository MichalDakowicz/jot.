import { EditorView } from '@codemirror/view';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { countOf, plural } from '@jot/core/count';
import { useStore } from '@jot/core/store';

import { addMenuItems, type MenuItem } from '../components/menu';
import { NotebookSettings } from '../components/NotebookSettings';
import { NoteTools } from '../components/NoteTools';
import { TopBar, useStatus } from '../components/Shell';
import { useNotebookInk } from '../components/useNotebookInk';
import { isFocusOnly, refocus, shownRange, toggleFocusOnly } from '../editor/focusOnly';
import { Minimap } from '../editor/Minimap';
import { NotebookEditor } from '../editor/NotebookEditor';
import { sectionAt, sectionRanges } from '../editor/sections';
import { useMapShown } from '../editor/useMapShown';

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
  const [mapShown, setMapShown] = useMapShown();
  const ink = useNotebookInk(nb?.tint ?? 0);
  const scroller = useRef<HTMLDivElement>(null);
  const wanted = params.get('note');

  const onView = useCallback((v: EditorView) => {
    setView(v);
    setTick((t) => t + 1);
  }, []);

  // A link to one note, followed while the notebook is already open, moves the caret there,
  // and while one note is shown alone, that note becomes the one on show.
  useEffect(() => {
    if (!view || !wanted) return;
    const range = sectionRanges(view.state).find((r) => r.id === wanted);
    if (range) refocus(view, range.id);
    if (range) view.dispatch({ selection: { anchor: range.from + 2 }, effects: EditorView.scrollIntoView(range.from, { y: 'start', yMargin: 64 }) });
    setParams({}, { replace: true });
  }, [view, wanted, setParams]);

  const caretNote = view ? sectionAt(view.state, view.state.selection.main.head) : null;
  const current = noteById(caretNote ?? undefined);
  const caret = view ? view.state.doc.lineAt(view.state.selection.main.head) : null;
  // Counts cover what is on show: the focused note alone while only it is shown.
  const shown = view ? shownRange(view.state) : { from: 0, to: 0 };
  const lines = view ? {
    from: view.state.doc.lineAt(shown.from).number,
    to: shown.to < view.state.doc.length ? view.state.doc.lineAt(shown.to).number - 1 : view.state.doc.lines,
  } : { from: 1, to: 1 };
  const { words, chars } = countOf(view ? view.state.doc.sliceString(shown.from, shown.to) : '');
  const selected = view ? view.state.selection.ranges.filter((r) => !r.empty).map((r) => view.state.doc.sliceString(r.from, r.to)) : [];
  const picked = countOf(selected.join('\n'));
  const folded = view ? isFocusOnly(view.state) : false;
  const toggleFolded = () => view && toggleFocusOnly(view);
  useStatus({
    left: (
      <>
        <span className="wide-only">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
        {notes.length > 1 ? (
          <button className={'status-button' + (folded ? ' on' : '')} aria-pressed={folded}
            onClick={toggleFolded}>{folded ? 'show all notes' : 'this note only'}</button>
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
  }, [notes.length, words, chars, picked.words, picked.chars, selected.length, folded, caretNote, tick]);

  if (!nb) {
    return (
      <>
        <TopBar crumbs={<span className="here">not found</span>} />
        <div className="page"><p className="muted">This notebook is not here.</p></div>
      </>
    );
  }

  const pageItems: MenuItem[] = [
    ...(notes.length > 1 && (folded || caretNote) ? [{ label: folded ? 'Show all notes' : 'Show this note only', run: toggleFolded }] : []),
    ...(mapShown ? [] : [{ label: 'Show map', run: () => setMapShown(true) }]),
  ];

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
          <span className="here" style={{ color: ink }}>{nb.name.toLowerCase().replace(/\s+/g, '-')}.md</span>
          {current ? <><span className="sep">›</span><span className="crumb-note">{current.title || 'Untitled'}</span></> : null}
        </>}
        actions={<>
          {current ? <NoteTools note={current} notebookPublic={!!nb.is_public} onRemove={removeCurrent} /> : null}
          <button className={'chip' + (settings ? ' on' : '')} aria-pressed={settings} onClick={() => setSettings((s) => !s)}>notebook</button>
        </>}
      />
      <div className="content" ref={scroller} onContextMenu={(e) => addMenuItems(e, pageItems)}>
        <div className={'note-layout' + (mapShown ? '' : ' no-map')}>
          <div className="note-column">
            {settings ? <NotebookSettings notebook={nb} noteCount={notes.length} /> : (
              <p className="notebook-head muted">{[nb.code, nb.prof].filter(Boolean).join(' · ')}</p>
            )}
            <NotebookEditor notebookId={nb.id} notes={notes} startNote={wanted}
              onMention={(target) => navigate(`/note/${target}`)} onView={onView} />
          </div>
          {mapShown ? (
            <Minimap view={view} tick={tick} scroller={scroller.current} fromLine={lines.from} toLine={lines.to} onHide={() => setMapShown(false)} />
          ) : null}
        </div>
      </div>
    </>
  );
}
