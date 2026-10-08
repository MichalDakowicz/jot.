/**
 * Words and characters of some text, the way a writer counts them.
 *
 * The text comes from the editor with a newline between blocks. That newline is
 * where one block ends, not a character anyone typed, so it separates words but
 * is not counted. Characters are code points, so a letter outside the basic
 * plane or an emoji is one, not two.
 */
export function countOf(text: string): { words: number; chars: number } {
  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = [...text.replace(/\n/g, '')].length;
  return { words, chars };
}

/** "1 word", "2 words": the count with its noun. */
export function plural(n: number, one: string, many = one + 's'): string {
  return `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
}
