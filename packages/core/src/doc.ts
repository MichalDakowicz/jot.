/**
 * The block model behind the editor.
 *
 * Notes are stored as markdown, but while a note is open it is a list of
 * blocks: a heading knows it is a heading, and its "## " lives in the block's
 * kind rather than in the text being typed. That is what lets the marker
 * disappear the moment it is typed and the line take its real shape, without
 * any of the caret arithmetic that comes from hiding characters inside a field.
 */

export type BlockKind =
  | 'table'
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'quote'
  | 'bullet'
  | 'number'
  | 'alpha'
  | 'todo'
  | 'rule'
  | 'fence';

export type Block = {
  kind: BlockKind;
  /** Block content with no marker: "Why" for "## Why". Code for a fence. */
  text: string;
  /** Checkbox state, on 'todo' only. */
  done?: boolean;
  /** Fence language, on 'fence' only. */
  lang?: string;
  /** Table cells, on 'table' only; the first row is the header. */
  rows?: string[][];
  /** Nesting level of a list block, two spaces of markdown each. */
  depth?: number;
  /**
   * What a counted item starts its run at, 1 being "1." and "a.".
   *
   * Only the item that heads a run carries one, and only when it was written
   * with a marker of its own: a list started at "b." or at "3." stays there,
   * and a run picked up again after a paragraph carries on from where the last
   * one left off. The items after the head are counted from it, so inserting
   * one shifts the rest.
   */
  start?: number;
};

/** Kinds that can be nested inside one another. */
export const LISTS: BlockKind[] = ['bullet', 'number', 'alpha', 'todo'];

/** List kinds whose marker is counted, so each level counts from its own start. */
export const COUNTED: BlockKind[] = ['number', 'alpha'];

/**
 * The letter for a lettered item: a, b, ... z, aa, ab. Spreadsheet lettering,
 * so a list longer than the alphabet carries on instead of starting over.
 */
export function letterOf(n: number): string {
  let out = '';
  let left = Math.max(1, n);
  while (left > 0) {
    out = String.fromCharCode(97 + ((left - 1) % 26)) + out;
    left = Math.floor((left - 1) / 26);
  }
  return out;
}

/** The place in the alphabet a lettered marker names: a is 1, aa is 27. */
export function letterIndex(letters: string): number {
  let out = 0;
  for (const ch of letters.toLowerCase()) {
    out = out * 26 + (ch.charCodeAt(0) - 96);
  }
  return Math.max(1, out);
}

/**
 * The marker each block draws, "" for anything not counted.
 *
 * The count lives here rather than in the serializer so the letters on screen
 * and the letters in the markdown are worked out exactly once, the same way.
 */
export function countedMarkers(blocks: Block[]): string[] {
  /** Where each level has counted to, undefined for a level not counting. */
  const counters: (number | undefined)[] = [];
  /** What each level is counting, so numbers and letters never share a count. */
  const kinds: (BlockKind | undefined)[] = [];

  return blocks.map((b) => {
    const depth = Math.max(0, Math.min(MAX_DEPTH, b.depth ?? 0));

    // A block that is no kind of list ends every count; a list only ends the
    // counts deeper than itself.
    if (!LISTS.includes(b.kind)) {
      counters.length = 0;
      kinds.length = 0;
      return '';
    }
    counters.length = Math.min(counters.length, depth + 1);
    kinds.length = Math.min(kinds.length, depth + 1);

    const carries = kinds[depth] === b.kind && counters[depth] !== undefined;
    kinds[depth] = b.kind;
    if (!COUNTED.includes(b.kind)) {
      counters[depth] = undefined;
      return '';
    }

    const at = carries ? (counters[depth] as number) + 1 : Math.max(1, b.start ?? 1);
    counters[depth] = at;
    return (b.kind === 'alpha' ? letterOf(at) : String(at)) + '.';
  });
}

/** As deep as a list may go; past this the indents stop reading as structure. */
export const MAX_DEPTH = 5;

/** Two spaces per level, which is what a nested list looks like in markdown. */
const INDENT = '  ';

/** How deep a line's leading whitespace puts it. A tab counts as one level. */
function depthOf(space: string): number {
  const columns = space.replace(/\t/g, INDENT).length;
  return Math.min(MAX_DEPTH, Math.floor(columns / INDENT.length));
}

/** A pipe row: "| a | b |". */
const ROW = /^\s*\|.*\|\s*$/;
/** A cell of the rule under a table's header: "---", ":-:", "--:". */
const RULE_CELL = /^:?-+:?$/;

/** A pipe inside a cell is written with a backslash, as in markdown. */
const ESC = String.fromCharCode(92);

/** Split a pipe row into cells, honouring an escaped pipe inside one. */
function cellsOf(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|\s*$/, '');
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === ESC && inner[i + 1] === '|') {
      cell += '|';
      i += 1;
      continue;
    }
    if (inner[i] === '|') {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += inner[i];
  }
  cells.push(cell.trim());
  return cells;
}

/**
 * Is this the rule under a table's header?
 *
 * Every cell has to be dashes. Testing the whole line for "spaces, pipes and
 * dashes" instead would swallow a row of empty cells, "|   |   |", and the
 * table would end at its header.
 */
function isRule(line: string): boolean {
  if (!ROW.test(line)) return false;
  const cells = cellsOf(line);
  return cells.length > 0 && cells.every((cell) => RULE_CELL.test(cell));
}

function rowOf(cells: string[]): string {
  const body = cells.map((cell) => (cell || ' ').split('|').join(ESC + '|')).join(' | ');
  return '| ' + body + ' |';
}
/** Every row padded to the widest, so the markdown is a rectangle. */
export function evenRows(rows: string[][]): string[][] {
  const width = Math.max(1, ...rows.map((r) => r.length));
  return rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
}

/** Kinds that carry their marker onto the next block when Return is pressed. */
export const CARRIES: BlockKind[] = ['bullet', 'number', 'alpha', 'todo', 'quote'];

export function parseDoc(body: string): Block[] {
  const lines = body.split('\n');
  const out: Block[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const fence = /^```(.*)$/.exec(line);

    if (fence) {
      const code: string[] = [];
      let j = i + 1;
      while (j < lines.length && !/^```/.test(lines[j] ?? '')) {
        code.push(lines[j] ?? '');
        j += 1;
      }
      out.push({ kind: 'fence', lang: fence[1].trim(), text: code.join('\n') });
      i = j;
      continue;
    }

    // A table is a pipe row with the header rule under it.
    if (ROW.test(line) && isRule(lines[i + 1] ?? '')) {
      const rows: string[][] = [cellsOf(line)];
      let j = i + 2;
      while (j < lines.length && ROW.test(lines[j] ?? '') && !isRule(lines[j] ?? '')) {
        rows.push(cellsOf(lines[j] ?? ''));
        j += 1;
      }
      out.push({ kind: 'table', text: '', rows: evenRows(rows) });
      i = j - 1;
      continue;
    }

    let m: RegExpExecArray | null;
    /**
     * The marker a counted item was written with, kept when this item heads a
     * run: a list that starts at "b." is not quietly moved back to "a.".
     */
    const startsAt = (kind: BlockKind, depth: number, at: number) => {
      const above = out[out.length - 1];
      const heads = !above || above.kind !== kind || (above.depth ?? 0) !== depth;
      return heads ? at : undefined;
    };

    // A lettered marker. One letter is a list on its own; two only carry a
    // list past "z", so "cf. see below" stays the sentence it is.
    const letters = /^([ \t]*)([a-z]{1,2})\. (.*)$/.exec(line);
    const lettered =
      letters &&
      (letters[2].length === 1 ||
        (out[out.length - 1]?.kind === 'alpha' &&
          (out[out.length - 1]?.depth ?? 0) === depthOf(letters[1])));

    if ((m = /^#### (.*)$/.exec(line))) out.push({ kind: 'h4', text: m[1] });
    else if ((m = /^### (.*)$/.exec(line))) out.push({ kind: 'h3', text: m[1] });
    else if ((m = /^## (.*)$/.exec(line))) out.push({ kind: 'h2', text: m[1] });
    else if ((m = /^# (.*)$/.exec(line))) out.push({ kind: 'h1', text: m[1] });
    else if ((m = /^> (.*)$/.exec(line))) out.push({ kind: 'quote', text: m[1] });
    else if ((m = /^([ \t]*)- \[([ xX])\] (.*)$/.exec(line)))
      out.push({
        kind: 'todo',
        text: m[3],
        done: m[2].toLowerCase() === 'x',
        depth: depthOf(m[1]),
      });
    else if ((m = /^([ \t]*)[-*] (.*)$/.exec(line)))
      out.push({ kind: 'bullet', text: m[2], depth: depthOf(m[1]) });
    else if ((m = /^([ \t]*)(\d+)\. (.*)$/.exec(line))) {
      const depth = depthOf(m[1]);
      out.push({
        kind: 'number',
        text: m[3],
        depth,
        start: startsAt('number', depth, Number.parseInt(m[2], 10)),
      });
    }
    // Markdown has no shape for a lettered item, so this is our own dialect:
    // read back the same way it is written out.
    else if (letters && lettered) {
      const depth = depthOf(letters[1]);
      out.push({
        kind: 'alpha',
        text: letters[3],
        depth,
        start: startsAt('alpha', depth, letterIndex(letters[2])),
      });
    }
    else if (/^(---|\*\*\*)$/.test(line)) out.push({ kind: 'rule', text: '' });
    else out.push({ kind: 'p', text: line });
  }

  return out.length ? out : [{ kind: 'p', text: '' }];
}

export function serializeDoc(blocks: Block[]): string {
  const lines: string[] = [];
  const markers = countedMarkers(blocks);

  blocks.forEach((b, i) => {
    const depth = Math.max(0, Math.min(MAX_DEPTH, b.depth ?? 0));
    const pad = LISTS.includes(b.kind) ? INDENT.repeat(depth) : '';

    switch (b.kind) {
      case 'h1':
        lines.push('# ' + b.text);
        break;
      case 'h2':
        lines.push('## ' + b.text);
        break;
      case 'h3':
        lines.push('### ' + b.text);
        break;
      case 'h4':
        lines.push('#### ' + b.text);
        break;
      case 'quote':
        lines.push('> ' + b.text);
        break;
      case 'bullet':
        lines.push(pad + '- ' + b.text);
        break;
      case 'number':
      case 'alpha':
        lines.push(`${pad}${markers[i]} ${b.text}`);
        break;
      case 'todo':
        lines.push(`${pad}- [${b.done ? 'x' : ' '}] ${b.text}`);
        break;
      case 'rule':
        lines.push('---');
        break;
      case 'table': {
        const rows = evenRows(b.rows?.length ? b.rows : [['', '']]);
        lines.push(rowOf(rows[0]));
        lines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');
        rows.slice(1).forEach((r) => lines.push(rowOf(r)));
        break;
      }
      case 'fence':
        lines.push('```' + (b.lang ?? ''), ...(b.text.length ? b.text.split('\n') : ['']), '```');
        break;
      default:
        lines.push(b.text);
    }
  });

  return lines.join('\n');
}

/**
 * A marker typed at the head of a block, and what the block becomes. Returns
 * null when the text is not a conversion, so the keystroke is left alone.
 */
export function convertMarker(text: string): Block | null {
  let m: RegExpExecArray | null;

  if ((m = /^#### (.*)$/.exec(text))) return { kind: 'h4', text: m[1] };
  if ((m = /^### (.*)$/.exec(text))) return { kind: 'h3', text: m[1] };
  if ((m = /^## (.*)$/.exec(text))) return { kind: 'h2', text: m[1] };
  if ((m = /^# (.*)$/.exec(text))) return { kind: 'h1', text: m[1] };
  if ((m = /^> (.*)$/.exec(text))) return { kind: 'quote', text: m[1] };
  if ((m = /^(?:- )?\[([ xX])?\] (.*)$/.exec(text)))
    return { kind: 'todo', text: m[2], done: (m[1] ?? '').toLowerCase() === 'x' };
  if ((m = /^[-*] (.*)$/.exec(text))) return { kind: 'bullet', text: m[1] };
  // A counted marker starts its list where it says: "3. " at 3, "c. " at c.
  if ((m = /^(\d+)\. (.*)$/.exec(text)))
    return { kind: 'number', text: m[2], start: Number.parseInt(m[1], 10) };
  if ((m = /^([a-z])\. (.*)$/.exec(text)))
    return { kind: 'alpha', text: m[2], start: letterIndex(m[1]) };
  if (/^(---|\*\*\*)$/.test(text)) return { kind: 'rule', text: '' };
  if ((m = /^```(.*)$/.exec(text))) return { kind: 'fence', text: '', lang: m[1].trim() };
  // "||" is a two-column table, "|||" a three-column one, and so on.
  if ((m = /^(\|{2,})$/.exec(text))) {
    const width = m[1].length;
    return {
      kind: 'table',
      text: '',
      rows: [Array(width).fill(''), Array(width).fill('')],
    };
  }

  return null;
}

/**
 * How deep a block may sit, given the one above it.
 *
 * A list item can only be one level deeper than the item it hangs under, and
 * the first item of a list cannot be indented at all — there is nothing above
 * for it to belong to.
 */
export function depthAllowed(blocks: Block[], i: number, want: number): number {
  if (want <= 0) return 0;
  const above = blocks[i - 1];
  if (!above || !LISTS.includes(above.kind)) return 0;
  return Math.max(0, Math.min(want, MAX_DEPTH, (above.depth ?? 0) + 1));
}

/** The kind a block made by Return under `block` should have. */
export function nextKind(block: Block): BlockKind {
  return CARRIES.includes(block.kind) ? block.kind : 'p';
}

/** A block with nothing in it that is not a plain paragraph, i.e. one Return from leaving. */
export function isEmptyMarked(block: Block): boolean {
  return block.kind !== 'p' && block.kind !== 'rule' && !block.text.trim();
}
