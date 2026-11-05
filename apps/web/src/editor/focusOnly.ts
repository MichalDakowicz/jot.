import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

import { sectionAt, sectionRanges, setSectionIds } from './sections';

type Focus = { id: string | null; from: number; to: number } | null;

/** Shows one note alone (its id), or every note again (null). */
export const setFocusOnly = StateEffect.define<string | null>();

function rangeOf(state: EditorState, id: string | null): Focus {
  const r = sectionRanges(state).find((s) => s.id === id);
  return r ? { id, from: r.from, to: r.to } : null;
}

/**
 * The note on show, as a stretch of the document moved with every edit, so a
 * new "# " typed inside it stays in view. A copy from elsewhere replaces the
 * whole text, so the stretch is found again by the note's id.
 */
const focusField = StateField.define<Focus>({
  create: () => null,
  update(focus, tr) {
    for (const e of tr.effects) if (e.is(setFocusOnly)) return e.value === null ? null : rangeOf(tr.state, e.value);
    if (!focus || !tr.docChanged) return focus;
    if (tr.effects.some((e) => e.is(setSectionIds))) return rangeOf(tr.state, focus.id) ?? null;
    return { id: focus.id, from: tr.changes.mapPos(focus.from, -1), to: tr.changes.mapPos(focus.to, 1) };
  },
});

export function isFocusOnly(state: EditorState): boolean {
  return !!state.field(focusField, false);
}

/** The part of the document that is on show: all of it, or the focused note alone. */
export function shownRange(state: EditorState): { from: number; to: number } {
  return state.field(focusField, false) ?? { from: 0, to: state.doc.length };
}

const hidden = Decoration.replace({ block: true });

function hide(state: EditorState): DecorationSet {
  const focus = state.field(focusField);
  if (!focus) return Decoration.none;
  const len = state.doc.length;
  // Whole lines only: the notes above end on the line before the heading, the ones below start on a heading.
  return Decoration.set([
    ...(focus.from > 0 ? [hidden.range(0, focus.from - 1)] : []),
    ...(focus.to < len ? [hidden.range(focus.to, len)] : []),
  ]);
}

const hiddenField = StateField.define<DecorationSet>({
  create: hide,
  update: (deco, tr) => (tr.docChanged || tr.startState.field(focusField) !== tr.state.field(focusField) ? hide(tr.state) : deco),
  provide: (f) => [EditorView.decorations.from(f), EditorView.atomicRanges.of((view) => view.state.field(f))],
});

/** Typing and deleting never reach into the hidden notes, nor take the line breaks that fence them off. */
const guardHidden = EditorState.changeFilter.of((tr) => {
  const focus = tr.startState.field(focusField);
  if (!focus || !(tr.isUserEvent('input') || tr.isUserEvent('delete'))) return true;
  const len = tr.startState.doc.length;
  return [...(focus.from > 0 ? [0, focus.from] : []), ...(focus.to < len ? [focus.to - 1, len] : [])];
});

/** Keeps a caret inside the note on show. */
const stayInFocus = EditorView.updateListener.of((u) => {
  const focus = u.state.field(focusField);
  if (!focus || !(u.selectionSet || u.docChanged || u.startState.field(focusField) !== focus)) return;
  const head = u.state.selection.main.head;
  const last = focus.to < u.state.doc.length ? focus.to - 1 : focus.to;
  if (head < focus.from || head > last) u.view.dispatch({ selection: { anchor: Math.min(focus.from + 2, last) } });
});

/** Shows every note, or the one in focus alone — the others gone from the page, headings and all. */
export const focusOnly: Extension = [focusField, hiddenField, guardHidden, stayInFocus];

/** Shows only the note with this id; with focus-only off, does nothing. */
export function refocus(view: EditorView, id: string) {
  if (isFocusOnly(view.state)) view.dispatch({ effects: setFocusOnly.of(id) });
}

/** Turns focus-only on for the note under the caret, or off again. */
export function toggleFocusOnly(view: EditorView) {
  const on = !isFocusOnly(view.state);
  view.dispatch({ effects: setFocusOnly.of(on ? sectionAt(view.state, view.state.selection.main.head) : null) });
}
