/**
 * A notebook as one document: every note is a section that opens with its
 * title as an h1, "# Title", and runs to the next one. Notes stay rows of
 * their own — tags, links and share pages keep working per note — and the
 * document is only how they are read and written together.
 */
export type Section = {
  title: string;
  body: string;
  /** Zero-based line of the section's "# " heading. */
  line: number;
};

const HEADING = /^# /;
const FENCE = /^\s*```/;

/** The line numbers (zero-based) that open a note: "# " outside a code fence. */
export function headingLines(lines: string[]): number[] {
  const out: number[] = [];
  let fenced = false;
  lines.forEach((line, i) => {
    if (FENCE.test(line)) fenced = !fenced;
    else if (!fenced && HEADING.test(line)) out.push(i);
  });
  return out;
}

/** The document's notes, in order. Text above the first heading belongs to no note. */
export function sectionsOf(doc: string): { lead: string; sections: Section[] } {
  const lines = doc.split('\n');
  const starts = headingLines(lines);
  const lead = lines.slice(0, starts.length ? starts[0] : lines.length).join('\n');
  const sections = starts.map((start, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    return { title: lines[start].slice(2), body: lines.slice(start + 1, end).join('\n'), line: start };
  });
  return { lead, sections };
}

/** The notes joined into the document they make. */
export function notebookDocOf(notes: { title: string; body: string }[]): string {
  return notes.map((n) => '# ' + n.title.replace(/\n/g, ' ') + (n.body ? '\n' + n.body : '')).join('\n');
}
