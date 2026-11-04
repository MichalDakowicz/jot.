import { type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

const line = Decoration.line({ class: 'cm-activeLine' });

function build(view: EditorView): DecorationSet {
  const main = view.state.selection.main;
  if (!main.empty) return Decoration.none;
  return Decoration.set([line.range(view.state.doc.lineAt(main.head).from)]);
}

/**
 * The caret's line, a step off the page — only while nothing is selected.
 * The line's wash is painted over the selection layer, so with a selection it
 * would hide exactly the text being picked out.
 */
export const caretLine: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet) this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
