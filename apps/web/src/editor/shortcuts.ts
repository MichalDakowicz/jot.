import { copyLineDown } from '@codemirror/commands';
import { selectSelectionMatches } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

/** The lines under every caret, each once, as one block of text. */
function caretLines(view: EditorView): string {
  const doc = view.state.doc;
  const seen = new Set<number>();
  const out: string[] = [];
  for (const r of view.state.selection.ranges) {
    const line = doc.lineAt(r.head);
    if (seen.has(line.number)) continue;
    seen.add(line.number);
    out.push(line.text);
  }
  return out.join('\n') + '\n';
}

/**
 * The code-editor keys: Ctrl/⌘-Shift-L puts a caret on every copy of the
 * selection, Ctrl/⌘-D copies the line down, and copying with nothing selected
 * takes the whole line.
 */
export const editorShortcuts: Extension = [
  EditorState.allowMultipleSelections.of(true),
  keymap.of([
    { key: 'Mod-Shift-l', run: selectSelectionMatches, preventDefault: true },
    { key: 'Mod-d', run: copyLineDown, preventDefault: true },
  ]),
  EditorView.domEventHandlers({
    copy(event, view) {
      if (!event.clipboardData || view.state.selection.ranges.some((r) => !r.empty)) return false;
      event.clipboardData.setData('text/plain', caretLines(view));
      event.preventDefault();
      return true;
    },
  }),
];
