import { EditorState, Facet, MapMode, RangeSet, RangeValue, StateEffect, StateField, type Extension } from '@codemirror/state';

import { headingLines } from '@jot/core/notebookDoc';

/** The note a "# " heading opens, pinned to the start of its line and moved with every edit. */
class NoteMark extends RangeValue {
  constructor(readonly id: string) {
    super();
  }
  // The mark sticks to the heading after it: cut that heading away and the note goes with it,
  // while text cut or typed in front of it leaves it with the heading.
  mapMode = MapMode.TrackAfter;
  startSide = 1;
  endSide = 1;
  eq(other: NoteMark) {
    return other.id === this.id;
  }
}

type Sections = {
  marks: RangeSet<NoteMark>;
  /** Notes whose heading went away, by title: typing it back, or undoing, brings back the same note. */
  buried: { id: string; title: string }[];
};

/** Puts known note ids on the document's headings, in order — for a copy that arrived from elsewhere. */
export const setSectionIds = StateEffect.define<string[]>();

const initialIds = Facet.define<string[], string[]>({ combine: (values) => values[0] ?? [] });

/** A heading's title: its line without the "# ". */
function titleOf(state: EditorState, from: number): string {
  return state.doc.lineAt(from).text.replace(/^# ?/, '');
}

function startsOf(state: EditorState): number[] {
  return headingLines(state.doc.toString().split('\n')).map((n) => state.doc.line(n + 1).from);
}

function marksFor(state: EditorState, ids: string[]): RangeSet<NoteMark> {
  return RangeSet.of(startsOf(state).flatMap((from, k) => (ids[k] ? [new NoteMark(ids[k]).range(from)] : [])));
}

/** The ids on a document and each one's title, as they stand. */
function titledIds(state: EditorState, marks: RangeSet<NoteMark>): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  marks.between(0, state.doc.length, (from, _to, mark) => {
    out.push({ id: mark.id, title: titleOf(state, from) });
  });
  return out;
}

/**
 * Every heading ends up with exactly one note; a heading that lost its mark
 * gets its old one back, or a new one. `before` is the ids and titles as they
 * were ahead of this edit, so a note the edit took away is remembered under
 * the title it had, not whatever its line turned into.
 */
function settle(state: EditorState, value: Sections, before: { id: string; title: string }[] = []): Sections {
  const starts = startsOf(state);
  const onStart = new Set(starts);
  const at = new Map<number, string>();
  const loose: string[] = [];
  value.marks.between(0, state.doc.length, (from, _to, mark) => {
    if (onStart.has(from) && !at.has(from)) at.set(from, mark.id);
    else loose.push(mark.id);
  });
  const placed = new Set(at.values());
  const titles = new Map(before.map((b) => [b.id, b.title]));
  const buried = value.buried.filter((b) => !placed.has(b.id));
  for (const id of [...before.map((b) => b.id), ...loose]) {
    if (!placed.has(id) && !buried.some((b) => b.id === id)) buried.push({ id, title: titles.get(id) ?? '' });
  }

  const used = new Set<string>();
  const ranges = starts.map((from) => {
    let id = at.get(from);
    if (!id || used.has(id)) {
      const title = titleOf(state, from);
      const k = buried.findIndex((b) => b.title === title && !used.has(b.id));
      id = k !== -1 ? buried.splice(k, 1)[0].id : crypto.randomUUID();
    }
    used.add(id);
    return new NoteMark(id).range(from);
  });
  return { marks: RangeSet.of(ranges), buried: buried.filter((b) => !used.has(b.id)).slice(-50) };
}

const sectionsField = StateField.define<Sections>({
  create: (state) => settle(state, { marks: marksFor(state, state.facet(initialIds)), buried: [] }),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setSectionIds)) return settle(tr.state, { marks: marksFor(tr.state, e.value), buried: value.buried });
    }
    if (!tr.docChanged) return value;
    return settle(tr.state, { marks: value.marks.map(tr.changes), buried: value.buried }, titledIds(tr.startState, value.marks));
  },
});

/** Tracks which note each "# " heading of a notebook document belongs to. */
export function notebookSections(ids: string[]): Extension {
  return [initialIds.of(ids), sectionsField];
}

/** The note ids of the document's headings, top to bottom. */
export function sectionIdsOf(state: EditorState): string[] {
  const field = state.field(sectionsField, false);
  const ids: string[] = [];
  field?.marks.between(0, state.doc.length, (_f, _t, mark) => {
    ids.push(mark.id);
  });
  return ids;
}

/** Where each note's section runs: from its heading to the next heading, or the end. */
export function sectionRanges(state: EditorState): { id: string; from: number; to: number }[] {
  const ids = sectionIdsOf(state);
  const starts = startsOf(state);
  return starts.map((from, k) => ({ id: ids[k], from, to: k + 1 < starts.length ? starts[k + 1] : state.doc.length }));
}

/** The note whose section holds `pos`. */
export function sectionAt(state: EditorState, pos: number): string | null {
  let found: string | null = null;
  for (const r of sectionRanges(state)) if (r.from <= pos) found = r.id;
  return found;
}
