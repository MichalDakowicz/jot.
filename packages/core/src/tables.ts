/**
 * Markdown tables laid out as text: every column padded to its widest cell,
 * the rule under the header drawn in dashes to the same width, so the source
 * reads as an even grid in a monospace face and stays a valid table.
 */

const ROW = /^\s*\|.*\|\s*$/;
const RULE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;

/** Whether `line` is a row of a pipe table: it opens and closes with "|". */
export function isTableRow(line: string): boolean {
  return ROW.test(line);
}

function cellsOf(line: string): string[] {
  const inner = line.trim().slice(1, -1);
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '\\' && inner[i + 1] === '|') {
      cell += '\\|';
      i++;
    } else if (ch === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/** The table's rows padded into even columns, or null when the lines are not a table with a header rule. */
export function alignTable(lines: string[]): string[] | null {
  if (lines.length < 2 || !lines.every(isTableRow) || !RULE.test(lines[1])) return null;
  const rows = lines.map(cellsOf);
  const columns = Math.max(...rows.map((r) => r.length));
  const align = rows[1].map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''));
  const widths = Array.from({ length: columns }, (_, c) =>
    Math.max(3, ...rows.filter((_, r) => r !== 1).map((r) => [...(r[c] ?? '')].length)));

  const pad = (text: string, width: number, how: string) => {
    const gap = width - [...text].length;
    if (how === 'right') return ' '.repeat(gap) + text;
    if (how === 'center') return ' '.repeat(Math.floor(gap / 2)) + text + ' '.repeat(Math.ceil(gap / 2));
    return text + ' '.repeat(gap);
  };

  return rows.map((r, k) => {
    const cells = widths.map((w, c) => {
      if (k !== 1) return pad(r[c] ?? '', w, align[c] ?? '');
      const how = align[c] ?? '';
      const dashes = '-'.repeat(w - (how === 'center' ? 2 : how ? 1 : 0));
      return how === 'center' ? ':' + dashes + ':' : how === 'left' ? ':' + dashes : how === 'right' ? dashes + ':' : dashes;
    });
    return '| ' + cells.join(' | ') + ' |';
  });
}
