import { autocompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
import { EditorSelection, type Extension } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';

import { mentionsField } from './livemd';

/** Wraps the selection in `mark`, or unwraps it when it is already wrapped. */
export function toggleWrap(view: EditorView, mark: string): boolean {
  view.dispatch(view.state.changeByRange((range) => {
    const { from, to } = range;
    const doc = view.state.doc;
    const wrapped = doc.sliceString(from - mark.length, from) === mark && doc.sliceString(to, to + mark.length) === mark;
    if (wrapped) {
      return {
        changes: [{ from: from - mark.length, to: from }, { from: to, to: to + mark.length }],
        range: EditorSelection.range(from - mark.length, to - mark.length),
      };
    }
    return {
      changes: [{ from, insert: mark }, { from: to, insert: mark }],
      range: EditorSelection.range(from + mark.length, to + mark.length),
    };
  }));
  return true;
}

export const formatKeys: Extension = keymap.of([
  // Ctrl/⌘-B belongs to the sidebar, as in a code editor; bold takes Shift with it.
  { key: 'Mod-Shift-b', run: (v) => toggleWrap(v, '**') },
  { key: 'Mod-i', run: (v) => toggleWrap(v, '*') },
  { key: 'Mod-e', run: (v) => toggleWrap(v, '`') },
  { key: 'Mod-Shift-h', run: (v) => toggleWrap(v, '==') },
  { key: 'Mod-Shift-x', run: (v) => toggleWrap(v, '~~') },
]);

/** Starts of a line that a "/" at the beginning of an empty line can insert. */
const SLASH: { label: string; detail: string; insert: string }[] = [
  { label: 'h1', detail: 'heading', insert: '# ' },
  { label: 'h2', detail: 'heading', insert: '## ' },
  { label: 'h3', detail: 'heading', insert: '### ' },
  { label: 'list', detail: 'bullets', insert: '- ' },
  { label: 'numbered', detail: 'list', insert: '1. ' },
  { label: 'todo', detail: 'checkbox', insert: '- [ ] ' },
  { label: 'quote', detail: 'block', insert: '> ' },
  { label: 'code', detail: 'fence', insert: '```\n\n```' },
  { label: 'table', detail: '2 × 2', insert: '| a | b |\n| --- | --- |\n|   |   |' },
  { label: 'rule', detail: 'divider', insert: '---\n' },
  { label: 'image', detail: 'embed', insert: '![](https://)' },
  { label: 'highlight', detail: '==mark==', insert: '====' },
];

function slash(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const m = before.match(/^\s*\/(\w*)$/);
  if (!m) return null;
  const from = line.from + before.indexOf('/');
  return {
    from,
    filter: true,
    options: SLASH.map<Completion>((s) => ({
      label: '/' + s.label,
      detail: s.detail,
      apply(view, _c, start, end) {
        const caret = s.insert === '```\n\n```' ? start + 4 : s.insert === '====' ? start + 2 : start + s.insert.length;
        view.dispatch({ changes: { from: start, to: end, insert: s.insert }, selection: { anchor: caret } });
      },
    })),
  };
}

function mention(context: CompletionContext) {
  const word = context.matchBefore(/@[^\s@]*(?: [^\s@]+){0,3}/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const titles = context.state.field(mentionsField);
  return {
    from: word.from,
    filter: true,
    options: titles.filter((t) => t.title).map<Completion>((t) => ({ label: '@' + t.title, type: 'text', detail: 'note' })),
  };
}

export const completions: Extension = autocompletion({ override: [slash, mention], icons: false });
