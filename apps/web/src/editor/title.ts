import { ChangeSet, EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';

import { headingLines } from '@jot/core/notebookDoc';

const MARK = '# ';

/** A caret never stands inside the opening "# ", where typing would split the mark. */
function pastMark(head: number) {
  return head < MARK.length ? MARK.length : head;
}

/**
 * A notebook document opens with a note: whatever an edit does, its first
 * line keeps its "# ", so no text sits above the first note.
 */
const keepFirstHeading = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) {
    const main = tr.selection?.main;
    if (!main || !main.empty || main.head >= MARK.length) return tr;
    return [tr, { selection: EditorSelection.cursor(pastMark(main.head)), sequential: true }];
  }
  const first = tr.newDoc.line(1).text;
  if (first.startsWith(MARK)) return tr;
  const fix = first.startsWith('#') ? { from: 1, insert: ' ' } : first.startsWith(' ') ? { from: 0, insert: '#' } : { from: 0, insert: MARK };
  // The caret follows the mark put in, rather than staying in front of it.
  const set = ChangeSet.of([fix], tr.newDoc.length);
  const main = tr.newSelection.main;
  const selection = main.empty
    ? EditorSelection.cursor(pastMark(set.mapPos(main.head, 1)))
    : EditorSelection.range(set.mapPos(main.anchor, 1), set.mapPos(main.head, 1));
  return [tr, { changes: fix, selection, sequential: true }];
});

class Untitled extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'md-untitled';
    span.textContent = 'Untitled';
    return span;
  }
}

/** "Untitled" in a note heading with no title yet, the way a field shows its placeholder. */
const untitled = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView) {
      const doc = view.state.doc;
      const empty = headingLines(doc.toString().split('\n'))
        .map((n) => doc.line(n + 1))
        .filter((line) => line.text.trim() === '#');
      return Decoration.set(empty.map((line) => Decoration.widget({ widget: new Untitled(), side: 1 }).range(line.to)));
    }
  },
  { decorations: (v) => v.decorations },
);

export const noteHeadings: Extension = [keepFirstHeading, untitled];
