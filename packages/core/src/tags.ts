/**
 * A note's tags live in their own row under the title, not in its text, so
 * they can be added, dropped and sorted by without touching what was written.
 */

/** What a typed tag is filed as: lower case, no leading #, words joined by hyphens. */
export function cleanTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/** The tags with `raw` added at the end, unless it is empty or already there. */
export function withTag(tags: string[], raw: string): string[] {
  const t = cleanTag(raw);
  return !t || tags.includes(t) ? tags : [...tags, t];
}

export function withoutTag(tags: string[], tag: string): string[] {
  return tags.filter((t) => t !== tag);
}

/** A note row read before the tags column existed has no tags, not a crash. */
export function tagsOf(note: { tags?: string[] | null }): string[] {
  return note.tags ?? [];
}
