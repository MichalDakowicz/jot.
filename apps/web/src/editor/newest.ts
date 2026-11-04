import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

import { sectionRanges } from './sections';

export const setOnlyNewest = StateEffect.define<boolean>();

const onlyNewestField = StateField.define<boolean>({
  create: () => false,
  update: (on, tr) => tr.effects.reduce((v, e) => (e.is(setOnlyNewest) ? e.value : v), on),
});

/** Where the newest note starts; everything before it is hidden while only the newest is shown. */
export function newestFrom(state: EditorState): number {
  const ranges = sectionRanges(state);
  return ranges.length ? ranges[ranges.length - 1].from : 0;
}

export function isOnlyNewest(state: EditorState): boolean {
  return state.field(onlyNewestField, false) ?? false;
}

/** The part of the document that is on show: all of it, or the newest note alone. */
export function shownRange(state: EditorState): { from: number; to: number } {
  return { from: isOnlyNewest(state) ? newestFrom(state) : 0, to: state.doc.length };
}

const hidden = Decoration.replace({ block: true });

function hide(state: EditorState): DecorationSet {
  const from = newestFrom(state);
  if (!isOnlyNewest(state) || from === 0) return Decoration.none;
  // Whole lines only: from the top to the end of the line before the newest heading.
  return Decoration.set([hidden.range(0, from - 1)]);
}

const hiddenField = StateField.define<DecorationSet>({
  create: hide,
  update: (deco, tr) => (tr.docChanged || tr.effects.some((e) => e.is(setOnlyNewest)) ? hide(tr.state) : deco),
  provide: (f) => [EditorView.decorations.from(f), EditorView.atomicRanges.of((view) => view.state.field(f))],
});

/** Keeps a caret out of the notes that are hidden. */
const stayInNewest = EditorView.updateListener.of((u) => {
  if (!isOnlyNewest(u.state) || !(u.selectionSet || u.docChanged)) return;
  const from = newestFrom(u.state);
  const head = u.state.selection.main.head;
  if (from > 0 && head < from) u.view.dispatch({ selection: { anchor: from + 2 } });
});

/** Shows every note, or only the newest — the older ones gone from the page, headings and all. */
export const onlyNewest: Extension = [onlyNewestField, hiddenField, stayInNewest];

export function toggleOnlyNewest(view: EditorView) {
  const on = !isOnlyNewest(view.state);
  const from = newestFrom(view.state);
  view.dispatch({
    effects: setOnlyNewest.of(on),
    ...(on && view.state.selection.main.head < from ? { selection: { anchor: Math.min(from + 2, view.state.doc.length) } } : {}),
  });
}
