/**
 * Markdown pipe tables read as grids: each row's pipes and cells, and the
 * column tracks every row of a table shares, so the source itself is laid
 * out in even columns and edited in place. The source is never rewritten.
 */

const ROW = /^\s*\|.*\S/;
const RULE = /^\s*\|(\s*:?-+:?\s*(\||$))+\s*$/;

/** Whether `line` is a row of a pipe table: it opens with "|"; the closing one may be left off. */
export function isTableRow(line: string): boolean {
  return ROW.test(line);
}

/** A stretch of a row: a pipe or a cell, and the grid column (1-based) it sits in. */
export type RowPart = { from: number; to: number; kind: 'pipe' | 'cell'; column: number };

/**
 * A row cut into its pipes and cells, end to end, so every character belongs
 * to one: space before the first pipe and after the last goes with that pipe,
 * an escaped pipe stays inside its cell.
 */
export function rowParts(line: string): RowPart[] {
  const parts: RowPart[] = [];
  const lead = line.indexOf('|');
  let cell = 0;
  let from = lead + 1;
  parts.push({ from: 0, to: from, kind: 'pipe', column: 1 });
  for (let i = from; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') {
      i++;
      continue;
    }
    if (line[i] !== '|') continue;
    parts.push({ from, to: i, kind: 'cell', column: 2 * cell + 2 });
    parts.push({ from: i, to: i + 1, kind: 'pipe', column: 2 * cell + 3 });
    cell++;
    from = i + 1;
  }
  if (line.slice(from).trim()) parts.push({ from, to: line.length, kind: 'cell', column: 2 * cell + 2 });
  else parts[parts.length - 1].to = line.length;
  return parts.filter((p) => p.to > p.from);
}

/**
 * The grid every row of a table shares: a narrow track for each pipe, and per
 * column its widest cell's width, so no cell wraps; a table wider than the
 * line scrolls sideways instead. Null when the lines are not a table with a
 * header rule.
 */
export function tableTracks(lines: string[]): string[] | null {
  if (lines.length < 2 || !lines.every(isTableRow) || !RULE.test(lines[1])) return null;
  const rows = lines.map((line) => {
    const cells: string[] = [];
    for (const p of rowParts(line)) if (p.kind === 'cell') cells[(p.column - 2) / 2] = line.slice(p.from, p.to).trim();
    return Array.from(cells, (c) => c ?? '');
  });
  const columns = Math.max(...rows.map((r) => r.length));
  const tracks = ['1ch'];
  for (let c = 0; c < columns; c++) {
    const width = Math.max(3, ...rows.filter((_, r) => r !== 1).map((r) => [...(r[c] ?? '')].length));
    tracks.push(`${width + 3}ch`, '1ch');
  }
  return tracks;
}
