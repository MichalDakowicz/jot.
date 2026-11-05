import { StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';

import { shownRange } from './focusOnly';

/** Under the last note, a faint "# new note": a note starts with a "# " line, and clicking here starts one. */
class NewNoteHint extends WidgetType {
  eq() {
    return true;
  }
  toDOM(view: EditorView) {
    const hint = document.createElement('div');
    hint.className = 'new-note-hint';
    hint.innerHTML = '<span class="md-syntax">#</span> new note';
    hint.title = 'A line that starts with "# " starts a new note';
    hint.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const doc = view.state.doc;
      const blank = doc.line(doc.lines).text.trim() === '';
      const insert = blank ? '# ' : (doc.length ? '\n' : '') + '# ';
      view.dispatch({ changes: { from: doc.length, insert }, selection: { anchor: doc.length + insert.length }, scrollIntoView: true });
      view.focus();
    });
    return hint;
  }
  ignoreEvent() {
    return true;
  }
}

function hint(state: EditorState): DecorationSet {
  const doc = state.doc;
  // Not while the end is hidden behind one note on show, nor under a heading still waiting for its title.
  if (shownRange(state).to < doc.length || /^#\s*$/.test(doc.line(doc.lines).text)) return Decoration.none;
  return Decoration.set([Decoration.widget({ widget: new NewNoteHint(), block: true, side: 1 }).range(doc.length)]);
}

export const newNoteHint: Extension = StateField.define<DecorationSet>({
  create: hint,
  update: (deco, tr) => (tr.docChanged || tr.effects.length ? hint(tr.state) : deco),
  provide: (f) => EditorView.decorations.from(f),
});
