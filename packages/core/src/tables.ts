/**
 * Markdown tables laid out as text: every column padded to its widest cell,
 * the rule under the header drawn in dashes to the same width, so the source
 * reads as an even grid in a monospace face. The layout is a list of edits to
 * show over each row; the source itself is never rewritten.
 */

const ROW = /^\s*\|.*\S/;
const RULE = /^\s*\|(\s*:?-+:?\s*(\||$))+\s*$/;

/** Whether `line` is a row of a pipe table: it opens with "|"; the closing one may be left off. */
export function isTableRow(line: string): boolean {
  return ROW.test(line);
}

/** One cell of a row: where it runs between its pipes, and where its text sits inside that. */
type Cell = { from: number; to: number; textFrom: number; textTo: number; closed: boolean };

function cellsOf(line: string): { lead: number; cells: Cell[]; tail: number } {
  const lead = line.indexOf('|');
  const cells: Cell[] = [];
  let from = lead + 1;
  for (let i = from; i <= line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') {
      i++;
      continue;
    }
    if (i < line.length && line[i] !== '|') continue;
    const raw = line.slice(from, i);
    const textFrom = from + (raw.length - raw.trimStart().length);
    const textTo = Math.max(textFrom, from + raw.trimEnd().length);
    cells.push({ from, to: i, textFrom, textTo, closed: i < line.length });
    from = i + 1;
  }
  // After the closing pipe there is nothing but space, which is not a cell.
  const last = cells[cells.length - 1];
  let tail = line.length;
  if (cells.length > 1 && last.textFrom === last.textTo && !last.closed) {
    cells.pop();
    tail = last.from;
  }
  return { lead, cells, tail };
}

const widthOf = (text: string) => [...text].length;

/** How wide each column is and how it aligns, or null when the lines are not a table with a header rule. */
export function tableColumns(lines: string[]): { widths: number[]; align: string[] } | null {
  if (lines.length < 2 || !lines.every(isTableRow) || !RULE.test(lines[1])) return null;
  const rows = lines.map((line) => cellsOf(line).cells.map((c) => line.slice(c.textFrom, c.textTo)));
  const columns = Math.max(...rows.map((r) => r.length));
  const align = Array.from({ length: columns }, (_, c) => {
    const m = rows[1][c] ?? '';
    return m.startsWith(':') && m.endsWith(':') ? 'center' : m.endsWith(':') ? 'right' : m.startsWith(':') ? 'left' : '';
  });
  const widths = Array.from({ length: columns }, (_, c) =>
    Math.max(3, ...rows.filter((_, r) => r !== 1).map((r) => widthOf(r[c] ?? ''))));
  return { widths, align };
}

/** A stretch of a row shown as other text: `from === to` puts text in, otherwise it stands in for the source. */
export type RowEdit = { from: number; to: number; text: string };

function ruleCell(width: number, how: string): string {
  const dashes = '-'.repeat(width - (how === 'center' ? 2 : how ? 1 : 0));
  return how === 'center' ? ':' + dashes + ':' : how === 'left' ? ':' + dashes : how === 'right' ? dashes + ':' : dashes;
}

/**
 * What to show over one row so it reads as `| a   | b |` in even columns:
 * one space inside each pipe, cells padded to their column, the rule in
 * dashes, missing cells and a missing closing pipe filled in. The text of a
 * cell is never covered, so it can be edited in place while the grid holds.
 */
export function layoutRow(line: string, widths: number[], align: string[], rule: boolean): RowEdit[] {
  const { lead, cells, tail } = cellsOf(line);
  const edits: RowEdit[] = [];
  const show = (from: number, to: number, text: string) => {
    if (line.slice(from, to) !== text) edits.push({ from, to, text });
  };
  show(0, lead, '');
  widths.forEach((width, c) => {
    const how = align[c] ?? '';
    const cell = cells[c];
    if (!cell) {
      show(tail, tail, ' ' + (rule ? ruleCell(width, how) : ' '.repeat(width)) + ' |');
      return;
    }
    const text = line.slice(cell.textFrom, cell.textTo);
    if (rule || !text) {
      show(cell.from, cell.to, ' ' + (rule ? ruleCell(width, how) : ' '.repeat(width)) + ' ');
    } else {
      const gap = width - widthOf(text);
      const before = how === 'right' ? gap : how === 'center' ? Math.floor(gap / 2) : 0;
      show(cell.from, cell.textFrom, ' ' + ' '.repeat(before));
      show(cell.textTo, cell.to, ' '.repeat(gap - before) + ' ');
    }
    if (!cell.closed) show(cell.to, cell.to, '|');
  });
  show(tail, line.length, '');
  return edits;
}
