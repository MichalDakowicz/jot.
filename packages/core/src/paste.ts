/**
 * Text pasted into a block, as blocks.
 *
 * More than one line is more than one block, and only the note knows how to
 * make one — so a field hands over the two halves of the line the caret was
 * on and the text that goes between them, and this works out the rest.
 *
 * The text is read back with the note's own parser. That is what the clipboard
 * carries when a span is copied out of a note, so a heading copied from one
 * note is a heading again in the next, and markdown pasted from anywhere else
 * takes the shape it describes.
 */
import { LISTS, nextKind, parseDoc, type Block, type BlockKind } from './doc';
import { plainFor } from './field';

/** Blocks with no plain text of their own, so nothing can be joined onto them. */
const OPAQUE: BlockKind[] = ['rule', 'table', 'fence'];

const CRLF = new RegExp('\r\n?', 'g');

export type Pasted = {
  blocks: Block[];
  /** The block the caret lands in: the end of what was pasted. */
  at: number;
  caret: number;
};

/**
 * A blank line is the spacing markdown puts between paragraphs, not a block of
 * its own: pasting a page of prose should not leave an empty line under every
 * line of it.
 */
function blanksOut(put: Block[]): Block[] {
  const kept = put.filter((b) => b.kind !== 'p' || !!b.text.trim());
  return kept.length ? kept : [{ kind: 'p', text: '' }];
}

/**
 * Plain lines take the shape of the block the paste landed in, the way Return
 * carries a list item onto the next line.
 */
function carried(put: Block[], block: Block): Block[] {
  const kind = nextKind(block);
  if (kind === 'p') return put;
  return put.map((b) =>
    b.kind === 'p'
      ? {
          ...b,
          kind,
          ...(LISTS.includes(kind) ? { depth: block.depth ?? 0 } : {}),
          ...(kind === 'todo' ? { done: false } : {}),
        }
      : b,
  );
}

export function pasteInto(
  blocks: Block[],
  i: number,
  head: string,
  text: string,
  tail: string,
  mentions: string[],
): Pasted {
  const block = blocks[i];
  const put = blanksOut(parseDoc(text.replace(CRLF, '\n')));
  const first = put[0];

  // The first line carries on the line the caret sits on. A line that brings a
  // shape of its own only takes the block over when there is nothing in front
  // of it; otherwise it becomes the block after.
  const made: Block[] =
    first.kind === 'p'
      ? [{ ...block, text: head + first.text }, ...carried(put.slice(1), block)]
      : head
        ? [{ ...block, text: head }, ...carried(put, block)]
        : carried(put, block);

  // What was after the caret follows what was pasted, and the caret sits
  // between the two. A block that holds no text of its own gets a paragraph.
  let last = made.length - 1;
  let caret = plainFor(made[last].text, mentions).length;
  if (OPAQUE.includes(made[last].kind)) {
    made.push({ kind: 'p', text: tail });
    last += 1;
    caret = 0;
  } else if (tail) {
    made[last] = { ...made[last], text: made[last].text + tail };
  }

  const next = [...blocks];
  next.splice(i, 1, ...made);
  return { blocks: next, at: i + last, caret };
}
