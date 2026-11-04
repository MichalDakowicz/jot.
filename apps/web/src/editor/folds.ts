import { codeFolding, foldEffect, foldedRanges, unfoldEffect } from '@codemirror/language';
import { type StateEffect } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';

import { sectionRanges } from './sections';

/** Folded notes keep their heading; the rest shows as a faint "…" that opens the note on a click. */
export const noteFolding = codeFolding({
  placeholderDOM(_view, onclick) {
    const span = document.createElement('span');
    span.className = 'md-folded';
    span.textContent = '…';
    span.title = 'Show this note';
    span.onclick = onclick;
    return span;
  },
});

/** The body of every note but the last, as fold ranges: from the end of its heading to the end of its text. */
function bodies(view: EditorView) {
  const doc = view.state.doc;
  return sectionRanges(view.state).slice(0, -1).flatMap((r) => {
    const from = doc.lineAt(r.from).to;
    const to = r.to > from && doc.sliceString(r.to - 1, r.to) === '\n' ? r.to - 1 : r.to;
    return to > from ? [{ from, to }] : [];
  });
}

/** Whether every note but the newest is folded away. */
export function onlyNewest(view: EditorView): boolean {
  const folded = foldedRanges(view.state);
  const want = bodies(view);
  if (!want.length) return false;
  return want.every((r) => {
    let hit = false;
    folded.between(r.from, r.to, (from, to) => {
      if (from === r.from && to === r.to) hit = true;
    });
    return hit;
  });
}

/** Folds every note but the newest, or opens them all again. */
export function toggleOnlyNewest(view: EditorView) {
  const effects: StateEffect<unknown>[] = [];
  if (onlyNewest(view)) {
    foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
      effects.push(unfoldEffect.of({ from, to }));
    });
  } else {
    for (const r of bodies(view)) effects.push(foldEffect.of(r));
  }
  view.dispatch({ effects });
}
