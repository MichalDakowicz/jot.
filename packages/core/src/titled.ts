/**
 * A note edited as one document: its title is the first line, set as the
 * note's only h1, and its body follows. Stored apart as before — `title` and
 * `body` — so lists, links and search keep reading them the way they did.
 */
export const TITLE_MARK = '# ';

export function titledDoc(title: string, body: string): string {
  return TITLE_MARK + title.replace(/\n/g, ' ') + '\n' + body;
}

/**
 * The inverse of `titledDoc`, exactly: the title is kept as typed, trailing
 * space and all, or the editor would be handed back a different document
 * mid-word and the caret would jump.
 */
export function splitTitled(doc: string): { title: string; body: string } {
  const nl = doc.indexOf('\n');
  const first = nl === -1 ? doc : doc.slice(0, nl);
  return {
    title: first.startsWith(TITLE_MARK) ? first.slice(TITLE_MARK.length) : first.replace(/^#?\s?/, ''),
    body: nl === -1 ? '' : doc.slice(nl + 1),
  };
}

/** A line below the title typed as "# x" becomes "## x": one h1 per note. */
export function demoteH1(line: string): string | null {
  return /^#\s/.test(line) ? '#' + line : null;
}
