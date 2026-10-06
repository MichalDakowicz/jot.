/**
 * What a live field asks of the rich-text model, in one place, so the web and
 * native fields differ only in how they draw and where the caret comes from.
 *
 * Everything here works on runs, not markdown, and every offset is an offset
 * into the plain text — what the writer sees. Markdown is produced only when
 * the block is handed back to the note.
 *
 * Runs have to be the state that is kept between keystrokes. Markdown cannot
 * be: half-typed delimiters are ambiguous, so "Use **Django*" parses back as an
 * italic run and the annotations rot as the writer types.
 */
import {
  applyPlainEdit,
  marksBefore,
  parseRuns,
  plainOf,
  serializeRuns,
  shortcutAt,
  sliceRuns,
  spliceRuns,
  toggleMarkRange,
  type Marks,
  type Pending,
  type Run,
} from './rich';
import { typography } from './typing';

export type Typed = { runs: Run[]; plain: string; caret: number; pending: Pending };

export function runsOf(md: string, mentions: string[]): Run[] {
  return parseRuns(md, mentions);
}

export function mdOf(runs: Run[]): string {
  return serializeRuns(runs);
}

export function plainFor(md: string, mentions: string[]): string {
  return plainOf(parseRuns(md, mentions));
}

/**
 * The field's plain text changed. Reannotate what stayed, polish the typing,
 * then give the live shortcut a chance to close a pair at the caret.
 *
 * `at` is where the field's caret sits in `nextPlain`, when it knows: it is
 * what says where a letter typed in front of its twin went.
 */
export function typeInto(runs: Run[], nextPlain: string, pending: Pending, at?: number): Typed {
  const before = plainOf(runs);
  let edit = applyPlainEdit(runs, nextPlain, pending ?? undefined, at);

  // Arrow, dash, ellipsis and quote polish, on text that just grew — but not
  // inside code, where "->" is an operator and has to stay as typed.
  if (nextPlain.length > before.length && !marksBefore(edit.runs, edit.caret).code) {
    const polished = typography(nextPlain, edit.caret);
    if (polished.text !== nextPlain) {
      edit = applyPlainEdit(runs, polished.text, pending ?? undefined, polished.caret);
    }
  }

  const shot = shortcutAt(edit.runs, edit.caret);
  const out = shot ? shot.runs : edit.runs;
  const caret = shot ? shot.caret : edit.caret;

  return {
    runs: out,
    plain: plainOf(out),
    caret,
    pending: shot ? { at: caret, deny: [shot.closed] } : null,
  };
}

/**
 * A paste landing inside one block, read with the note's own parser.
 *
 * Pasted text cannot go through the typing path: the live shortcut closes the
 * one pair sitting at the caret and nothing else, so "**bold *italic* bold**"
 * arrived bold with its inner stars still showing. Parsing it reads the nest
 * all the way down.
 */
export function pasteRuns(
  runs: Run[],
  start: number,
  end: number,
  text: string,
  mentions: string[],
): { runs: Run[]; plain: string; caret: number } {
  // What was replaced hands over its annotation; otherwise the caret's own.
  const marks = end > start ? marksBefore(runs, start + 1) : marksBefore(runs, start);
  // A mention stops being one as soon as something lands in it.
  delete marks.mention;
  // Code is literal, so markdown pasted inside it stays as it was written.
  const put: Run[] = marks.code ? [{ text, marks }] : parseRuns(text, mentions, marks);
  const next = spliceRuns(runs, start, end, put);
  return { runs: next, plain: plainOf(next), caret: start + plainOf(put).length };
}

/**
 * Return in the middle of a block: the two halves, as markdown. A selection
 * passes its far end too, and what it held goes — a paste lands in its place.
 */
export function splitRuns(runs: Run[], caret: number, end = caret): { head: string; tail: string } {
  const plain = plainOf(runs);
  return {
    head: serializeRuns(sliceRuns(runs, 0, caret)),
    tail: serializeRuns(sliceRuns(runs, Math.max(caret, end), plain.length)),
  };
}

export type Span = { start: number; end: number };

/**
 * The stretch the selection bar acts on. A press on the bar can take the live
 * selection out of the block, so the last one seen inside it stands in; with
 * neither, it is the end of the block, where a toggle does nothing.
 */
export function barRange(live: Span | null, kept: Span | null, length: number): Span {
  const got = live && live.end !== live.start ? live : (kept ?? live);
  if (!got) return { start: length, end: length };
  const clamp = (n: number) => Math.max(0, Math.min(n, length));
  return { start: clamp(Math.min(got.start, got.end)), end: clamp(Math.max(got.start, got.end)) };
}

/** The selection bar, and Ctrl+B and friends. */
export function toggleRuns(
  runs: Run[],
  start: number,
  end: number,
  kind: keyof Marks,
  value: true | string = true,
): Run[] {
  return toggleMarkRange(runs, start, end, kind, value);
}

/** Replace a stretch of plain text, keeping the annotations around it. */
export function replaceRuns(
  runs: Run[],
  start: number,
  end: number,
  text: string,
  marks: Marks = {},
): { runs: Run[]; caret: number } {
  const insert: Run[] = text ? [{ text, marks }] : [];
  return { runs: spliceRuns(runs, start, end, insert), caret: start + text.length };
}

/**
 * A block marker typed at the head of `md`, taken back out: the first `cut`
 * characters of its plain text go, and the annotations on the rest stay.
 *
 * `md` has to be the block as typed, marker and all. The block from before the
 * key that finished the marker is one character short of it, so cutting the
 * marker's length out of that takes the first letter of the text with it.
 */
export function dropMarker(md: string, cut: number, mentions: string[]): string {
  return mdOf(replaceRuns(runsOf(md, mentions), 0, cut, '').runs);
}

/** A picked note goes in as a mention run, with a plain space after it. */
export function mentionRuns(
  runs: Run[],
  start: number,
  end: number,
  title: string,
): { runs: Run[]; caret: number } {
  const insert: Run[] = [
    { text: '@' + title, marks: { mention: true } },
    { text: ' ', marks: {} },
  ];
  return { runs: spliceRuns(runs, start, end, insert), caret: start + title.length + 2 };
}

/** Marks under the caret, so the bar can show what is already on. */
export function marksAt(runs: Run[], at: number): Marks {
  return marksBefore(runs, at);
}

/** Marks carried by a whole selection, for the same reason. */
export function marksIn(runs: Run[], start: number, end: number): Marks {
  if (end <= start) return marksBefore(runs, start);
  const inside = sliceRuns(runs, start, end);
  const all: Marks = { ...inside[0]?.marks };
  inside.forEach((r) => {
    (Object.keys(all) as (keyof Marks)[]).forEach((k) => {
      if (!r.marks[k]) delete all[k];
    });
  });
  return all;
}
