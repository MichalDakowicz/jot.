/**
 * Rules that fire while text is being typed inside a block: quote and dash
 * polish, the inline marks the selection bar applies, and the slash list.
 *
 * Block shape itself lives in ./doc — this file only ever sees the text of one
 * block.
 */

/**
 * Arrow shapes, longest first.
 *
 * The second half of the table is the same shapes half-converted. Typed a
 * character at a time, an arrow is built through the glyphs already on screen:
 * "<-" becomes a left arrow the moment it is typed, so "<-->" arrives as
 * "\u2190-" and then "\u27f5>", never as the four characters written here. Both
 * paths have to be caught — the plain shapes for text that arrives at once.
 *
 * A long arrow is U+27F6 and its kin, which Figtree and the display face do not
 * carry; they come from the system font, as any missing glyph does.
 */
const ARROWS: [string, string][] = [
  ['<-->', '\u27f7'],
  ['<--', '\u27f5'],
  ['<->', '\u2194'],
  ['-->', '\u27f6'],
  ['->', '\u2192'],
  ['<-', '\u2190'],

  ['\u27f5>', '\u27f7'],
  ['\u2190->', '\u27f7'],
  ['\u2190-', '\u27f5'],
  ['\u2190>', '\u2194'],
  ['\u2014>', '\u27f6'],
];

/**
 * Typing polish, applied to the text just entered: arrows, an em dash for two
 * hyphens, an ellipsis for three dots, and quotes that take a side. Only the
 * run ending at the caret is looked at, so older text is never rewritten under
 * the writer.
 */
export function typography(text: string, caret: number): { text: string; caret: number } {
  const head = text.slice(0, caret);
  const tail = text.slice(caret);
  const swap = (cut: number, put: string) => ({
    text: head.slice(0, head.length - cut) + put + tail,
    caret: caret - cut + put.length,
  });

  // Arrows, before the dash rules.
  for (const [shape, glyph] of ARROWS) {
    if (head.endsWith(shape)) return swap(shape.length, glyph);
  }

  if (/(^|[^-])--$/.test(head)) return swap(2, '—');
  if (head.endsWith('...')) return swap(3, '…');

  if (head.endsWith('"')) {
    const before = head[head.length - 2];
    return swap(1, before === undefined || /[\s([{—]/.test(before) ? '“' : '”');
  }
  if (head.endsWith("'")) {
    const before = head[head.length - 2];
    return swap(1, before !== undefined && /[\w)\]}]/.test(before) ? '’' : '‘');
  }

  return { text, caret };
}

export type SlashItem = {
  key: string;
  label: string;
  /** The marker the block is usually made with, shown as a hint. */
  badge: string;
  /** Words the query is matched against, on top of the label. */
  also?: string;
};

export const SLASH_ITEMS: SlashItem[] = [
  { key: 'h1', label: 'Big heading', badge: '#', also: 'title h1' },
  { key: 'h2', label: 'Heading', badge: '##', also: 'h2 section' },
  { key: 'h3', label: 'Small heading', badge: '###', also: 'h3' },
  { key: 'h4', label: 'Smallest heading', badge: '####', also: 'h4 label' },
  { key: 'bullet', label: 'Bullet list', badge: '-', also: 'ul item' },
  { key: 'number', label: 'Numbered list', badge: '1.', also: 'ol ordered' },
  { key: 'alpha', label: 'Lettered list', badge: 'a.', also: 'ol ordered letters abc alpha' },
  { key: 'todo', label: 'Checkbox', badge: '[ ]', also: 'task todo' },
  { key: 'quote', label: 'Quote', badge: '>', also: 'blockquote' },
  { key: 'code', label: 'Code block', badge: '```', also: 'fence' },
  { key: 'table', label: 'Table', badge: '⊞', also: 'grid rows columns' },
  { key: 'rule', label: 'Divider', badge: '—', also: 'hr line break' },
];

/** The slash query when the block holds nothing but a slash command, else null. */
export function slashQuery(text: string): string | null {
  const m = /^\/([a-z0-9 ]*)$/i.exec(text);
  return m ? m[1].trim().toLowerCase() : null;
}

export function slashHits(query: string): SlashItem[] {
  if (!query) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((it) =>
    `${it.label} ${it.key} ${it.also ?? ''}`.toLowerCase().includes(query),
  );
}

/** A tab is a tab: the text carries one, and the field draws it as a tab. */
export const TAB = '\t';

/**
 * Tab inside a block's own text, where there is no list to nest and no cell to
 * step to: a tab goes in at the caret, and Shift takes the one behind it back
 * out. Returns null when there is nothing to take out.
 */
export function tabText(
  plain: string,
  start: number,
  end: number,
  back: boolean,
): { text: string; caret: number } | null {
  if (!back) {
    return { text: plain.slice(0, start) + TAB + plain.slice(end), caret: start + TAB.length };
  }
  // Two spaces come out as readily as a tab: pasted text is indented that way.
  const cut = /(\t| {1,2})$/.exec(plain.slice(0, start))?.[0];
  if (!cut) return null;
  return {
    text: plain.slice(0, start - cut.length) + plain.slice(end),
    caret: start - cut.length,
  };
}

/**
 * Tab inside a code block: two spaces in, or the line pulled two spaces back
 * with Shift. Returns the whole text and where the caret lands.
 */
export function codeTab(
  code: string,
  start: number,
  end: number,
  back: boolean,
): { text: string; caret: number } {
  if (!back) {
    return { text: code.slice(0, start) + '  ' + code.slice(end), caret: start + 2 };
  }
  const head = code.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const space = /^ {1,2}/.exec(code.slice(head))?.[0] ?? '';
  if (!space) return { text: code, caret: start };
  return {
    text: code.slice(0, head) + code.slice(head + space.length),
    caret: Math.max(head, start - space.length),
  };
}

/** Indent carried onto the next line inside a code block. */
export function codeIndent(code: string, caret: number): string {
  const upto = code.slice(0, caret);
  const line = upto.slice(upto.lastIndexOf('\n') + 1);
  const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
  return /[[{(:]$/.test(line.trim()) ? indent + '  ' : indent;
}

/**
 * What one change did, worked out from the two strings: the stretch of the old
 * text that went, and what went in its place.
 *
 * A native field hands back its whole text and never says how it got there, so
 * a paste of five lines and a Return look the same until this is read off them.
 */
export function editOf(prev: string, next: string): { start: number; end: number; put: string } {
  let head = 0;
  while (head < prev.length && head < next.length && prev[head] === next[head]) head += 1;
  let tail = 0;
  while (
    tail < prev.length - head &&
    tail < next.length - head &&
    prev[prev.length - 1 - tail] === next[next.length - 1 - tail]
  ) {
    tail += 1;
  }
  return { start: head, end: prev.length - tail, put: next.slice(head, next.length - tail) };
}

/**
 * Where the caret ends up after a change, worked out from the two strings:
 * `onChangeText` fires before `onSelectionChange`, so the field cannot be
 * asked.
 */
export function caretAfterChange(prev: string, next: string): number {
  let k = 0;
  while (k < prev.length && k < next.length && prev[k] === next[k]) k += 1;
  return k + Math.max(0, next.length - prev.length);
}
