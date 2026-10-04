/**
 * Rich text for a block: runs of text carrying annotations, the way Notion
 * holds it, rather than markdown characters sitting in the field.
 *
 *   "Use **Django** now"  ->  [{text:'Use '},{text:'Django',marks:{bold}},{text:' now'}]
 *
 * Markdown stays the storage format — notes on the server are still markdown —
 * so every edit is: parse to runs, work on the runs, serialize back. Offsets
 * used by the editor are offsets into the *plain* text, which is what the
 * writer sees and what the caret moves through; the delimiters are not there.
 */

import { pairCloser } from './markdown';

export type Marks = {
  bold?: true;
  em?: true;
  code?: true;
  mark?: true;
  strike?: true;
  /** Link target; the run's text is the label. */
  link?: string;
  /** Derived from the text itself, not from delimiters. */
  tag?: true;
  mention?: true;
};

export type Run = { text: string; marks: Marks };

/**
 * Annotations the next keystroke at `at` must not inherit, set when a shortcut
 * closes a pair there. Any move of the caret drops it.
 */
export type Pending = { at: number; deny: (keyof Marks)[] } | null;

/** Delimiter pairs, longest first so ** wins over *. */
const PAIRS: { d: string; k: keyof Marks }[] = [
  { d: '**', k: 'bold' },
  { d: '~~', k: 'strike' },
  { d: '==', k: 'mark' },
  { d: '*', k: 'em' },
  { d: '~', k: 'strike' },
];

const sameMarks = (a: Marks, b: Marks) =>
  a.bold === b.bold &&
  a.em === b.em &&
  a.code === b.code &&
  a.mark === b.mark &&
  a.strike === b.strike &&
  a.link === b.link &&
  a.tag === b.tag &&
  a.mention === b.mention;

function add(out: Run[], text: string, marks: Marks) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && sameMarks(last.marks, marks)) last.text += text;
  else out.push({ text, marks: { ...marks } });
}

/** Markdown for one block into runs, consuming every delimiter it understands. */
export function parseRuns(md: string, mentions: string[] = [], marks: Marks = {}): Run[] {
  const titles = mentions.slice().sort((a, b) => b.length - a.length);
  const out: Run[] = [];
  let i = 0;
  let plain = '';

  const flush = () => {
    add(out, plain, marks);
    plain = '';
  };

  while (i < md.length) {
    const rest = md.slice(i);

    if (md[i] === '@') {
      const hit = titles.find((t) => rest.startsWith('@' + t));
      if (hit) {
        flush();
        add(out, '@' + hit, { ...marks, mention: true });
        i += hit.length + 1;
        continue;
      }
    }

    if (md[i] === '#' && (i === 0 || /\s/.test(md[i - 1]))) {
      const m = /^#[a-z0-9-]+/i.exec(rest);
      if (m) {
        flush();
        add(out, m[0], { ...marks, tag: true });
        i += m[0].length;
        continue;
      }
    }

    if (md[i] === '[') {
      const m = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(rest);
      if (m) {
        flush();
        parseRuns(m[1], mentions, { ...marks, link: m[2] }).forEach((r) => add(out, r.text, r.marks));
        i += m[0].length;
        continue;
      }
    }

    // Inline code takes its contents literally, so no recursion inside it.
    if (md[i] === '`') {
      const end = md.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        add(out, md.slice(i + 1, end), { ...marks, code: true });
        i = end + 1;
        continue;
      }
    }

    // "***x***" is bold around italic, taken whole here so its closing run of
    // three does not have to be shared out between the two pairs.
    if (rest.startsWith('***')) {
      const end = md.indexOf('***', i + 3);
      if (end > i + 3) {
        flush();
        parseRuns(md.slice(i + 3, end), mentions, { ...marks, bold: true, em: true }).forEach((r) =>
          add(out, r.text, r.marks),
        );
        i = end + 3;
        continue;
      }
    }

    const pair = PAIRS.find(({ d }) => rest.startsWith(d) && pairCloser(md, i, d) > 0);
    if (pair) {
      const end = pairCloser(md, i, pair.d);
      flush();
      parseRuns(md.slice(i + pair.d.length, end), mentions, { ...marks, [pair.k]: true }).forEach((r) =>
        add(out, r.text, r.marks),
      );
      i = end + pair.d.length;
      continue;
    }

    plain += md[i];
    i += 1;
  }

  flush();
  return out;
}

/** What the writer sees, and what the caret offsets count. */
export function plainOf(runs: Run[]): string {
  return runs.map((r) => r.text).join('');
}

/** The marks written as a delimiter pair, in a fixed order to break ties. */
const NEST: (keyof Marks)[] = ['link', 'bold', 'strike', 'mark', 'em'];

function wrapped(kind: keyof Marks, text: string, marks: Marks): string {
  if (kind === 'link') return `[${text}](${marks.link})`;
  if (kind === 'bold') return `**${text}**`;
  if (kind === 'strike') return `~~${text}~~`;
  if (kind === 'mark') return `==${text}==`;
  return `*${text}*`;
}

/**
 * Runs back to markdown, for the note on the server.
 *
 * A mark a stretch of runs share is written once around the whole stretch —
 * "**bold *em* bold**" — so the mark reaching furthest is the one that goes
 * outside. Wrapping each run on its own instead closed and reopened the bold
 * around every italic inside it, and what came out read back with its stars
 * showing, which is why pasted emphasis lost its nesting on the next keystroke.
 */
export function serializeRuns(runs: Run[]): string {
  return written(
    merge(runs).filter((r) => !!r.text),
    [],
  );
}

function written(runs: Run[], open: (keyof Marks)[]): string {
  let out = '';
  let i = 0;

  while (i < runs.length) {
    const { text, marks } = runs[i];
    const left = NEST.filter((k) => !!marks[k] && !open.includes(k));

    // Nothing left to open: code is literal, and plain text is itself.
    if (!left.length) {
      out += marks.code ? '`' + text + '`' : text;
      i += 1;
      continue;
    }

    let outer = left[0];
    let span = 0;
    left.forEach((k) => {
      let j = i;
      while (j < runs.length && runs[j].marks[k] === marks[k]) j += 1;
      if (j - i > span) {
        span = j - i;
        outer = k;
      }
    });

    out += wrapped(outer, written(runs.slice(i, i + span), [...open, outer]), marks);
    i += span;
  }

  return out;
}

function merge(runs: Run[]): Run[] {
  const out: Run[] = [];
  runs.forEach((r) => add(out, r.text, r.marks));
  return out;
}

/** The runs between two plain-text offsets. */
export function sliceRuns(runs: Run[], start: number, end: number): Run[] {
  const out: Run[] = [];
  let at = 0;
  runs.forEach((r) => {
    const from = Math.max(start, at);
    const to = Math.min(end, at + r.text.length);
    if (to > from) add(out, r.text.slice(from - at, to - at), r.marks);
    at += r.text.length;
  });
  return out;
}

/** Marks carried by the character before `at`, which is what typing inherits. */
export function marksBefore(runs: Run[], at: number): Marks {
  if (at <= 0) return {};
  let seen = 0;
  for (const r of runs) {
    if (at <= seen + r.text.length) return { ...r.marks };
    seen += r.text.length;
  }
  const last = runs[runs.length - 1];
  return last ? { ...last.marks } : {};
}

/** Replace a plain-text range with runs of their own. */
export function spliceRuns(runs: Run[], start: number, end: number, insert: Run[]): Run[] {
  const plain = plainOf(runs);
  const out = [
    ...sliceRuns(runs, 0, start),
    ...insert,
    ...sliceRuns(runs, end, plain.length),
  ];
  return merge(out);
}

/** Turn a mark on across a range, or off again when the whole range has it. */
export function toggleMarkRange(
  runs: Run[],
  start: number,
  end: number,
  kind: keyof Marks,
  value: true | string = true,
): Run[] {
  if (end <= start) return runs;
  const inside = sliceRuns(runs, start, end);
  const already = inside.every((r) => !!r.marks[kind]);

  const marked = inside.map((r) => {
    const marks: Marks = { ...r.marks };
    if (already) delete marks[kind];
    else if (kind === 'code') {
      // Code is literal, so it displaces the other annotations.
      return { text: r.text, marks: { code: true as const } };
    } else {
      (marks as Record<string, unknown>)[kind] = value;
    }
    return { text: r.text, marks };
  });

  return spliceRuns(runs, start, end, marked);
}

/**
 * Rebuild the runs after the field's plain text changed, keeping annotations on
 * the text that stayed. Typed text inherits the marks to its left, the way an
 * editor is expected to behave.
 *
 * `caret` is where the caret sits in `next` once the change is in, when the
 * field knows. The two strings alone cannot say where a letter went in front of
 * its twin: "apples" to "aapples" reads as an "a" after the first one, which put
 * the caret one past where it was typed and the next key behind the twin —
 * "an" typed there came out as "aan". With the caret, the change ends where the
 * caret is. A caret that does not fit the two strings is ignored.
 */
export function applyPlainEdit(
  runs: Run[],
  next: string,
  pending?: Pending,
  caret?: number,
): { runs: Run[]; caret: number } {
  const prev = plainOf(runs);
  if (prev === next) return { runs, caret: prev.length };

  const fits =
    caret !== undefined &&
    caret >= 0 &&
    caret <= next.length &&
    next.length - caret <= prev.length &&
    prev.endsWith(next.slice(caret));

  let tail = 0;
  let headLimit = Math.min(prev.length, next.length);
  if (fits) {
    tail = next.length - caret;
    headLimit = Math.min(caret, prev.length - tail);
  }

  let head = 0;
  while (head < headLimit && prev[head] === next[head]) head += 1;

  if (!fits) {
    while (
      tail < prev.length - head &&
      tail < next.length - head &&
      prev[prev.length - 1 - tail] === next[next.length - 1 - tail]
    ) {
      tail += 1;
    }
  }

  const inserted = next.slice(head, next.length - tail);
  const removed = prev.slice(head, prev.length - tail);
  // Replaced text takes the annotation of what it replaced; inserted text takes
  // the annotation to its left. Without the first case a swap like "..." into a
  // single ellipsis picks up the marks of the run before it.
  const marks = removed ? marksBefore(runs, head + 1) : marksBefore(runs, head);
  // A mention or tag stops being one as soon as it is typed into.
  delete marks.mention;
  delete marks.tag;
  // Typing straight on from a pair that just closed is outside it again: the
  // closing delimiter is how a writer says "that's enough bold".
  if (pending && pending.at === head) pending.deny.forEach((k) => delete marks[k]);

  const insert: Run[] = inserted ? [{ text: inserted, marks }] : [];
  return {
    runs: spliceRuns(runs, head, prev.length - tail, insert),
    caret: head + inserted.length,
  };
}

/**
 * Notion's live shortcut: the moment a closing delimiter is typed, both
 * delimiters go and the text between them takes the annotation. Returns null
 * when nothing closed at the caret.
 *
 * The caret must sit right after the closing delimiter, the run between the
 * pair must be non-empty, and text already inside a code run is left alone,
 * since code is literal.
 */
export function shortcutAt(
  runs: Run[],
  caret: number,
): { runs: Run[]; caret: number; closed: keyof Marks } | null {
  const plain = plainOf(runs);
  const head = plain.slice(0, caret);

  for (const { d, k } of [...PAIRS, { d: '`', k: 'code' as keyof Marks }]) {
    if (!head.endsWith(d)) continue;

    const openEnd = caret - d.length;
    const open = head.lastIndexOf(d, openEnd - 1);
    if (open < 0 || open + d.length >= openEnd) continue;

    // A one-character delimiter whose opener is part of a longer run belongs to
    // that longer pair: typing the first closing star of "**bold**" must not
    // italicise. The rule fires when the second one lands.
    if (d.length === 1 && head[open - 1] === d) continue;

    // Both ends hug their text, so "2 * 3 * 4" stays arithmetic.
    if (d !== '`' && (/\s/.test(head[open + d.length] ?? ' ') || /\s/.test(head[openEnd - 1] ?? ' '))) {
      continue;
    }

    // "***x***" closes as bold first; the leftover pair closes on the next pass.
    const inside = sliceRuns(runs, open + d.length, openEnd);
    if (inside.some((r) => r.marks.code)) continue;
    if (marksBefore(runs, open + 1).code) continue;

    const marked =
      k === 'code'
        ? inside.map((r) => ({ text: r.text, marks: { code: true as const } }))
        : inside.map((r) => ({ text: r.text, marks: { ...r.marks, [k]: true as const } }));

    // Drop the closing delimiter, then the opening one.
    let next = spliceRuns(runs, openEnd, caret, []);
    next = spliceRuns(next, open, openEnd, marked);

    return { runs: next, caret: caret - 2 * d.length, closed: k };
  }

  return null;
}
