import { useRef } from 'react';

import {
  mdOf,
  mentionRuns,
  pasteRuns,
  runsOf,
  splitRuns,
  toggleRuns,
  typeInto,
  marksIn,
} from '../lib/field';
import type { Marks, Pending, Run } from '../lib/rich';

/**
 * The rich text of one block, held as runs for as long as the block is open.
 *
 * Runs are the state, not markdown: a half-typed "Use **Django*" is ambiguous
 * markdown — it parses back as an italic run — so re-deriving on every
 * keystroke would rot the annotations as they are being made. Markdown is
 * produced on the way out, and read back in only when the editor changes the
 * block from the outside (a marker converting it, a mention landing, the bar).
 *
 * Shared by both platform fields; nothing in here touches the DOM or RN.
 */
export function useLiveBlock(md: string, mentions: string[], emit: (md: string) => void) {
  const runs = useRef<Run[]>([]);
  const mine = useRef<string | null>(null);
  const pending = useRef<Pending>(null);

  // Anything not written by this block is adopted as the new truth.
  if (mine.current !== md) {
    runs.current = runsOf(md, mentions);
    mine.current = md;
    pending.current = null;
  }

  function push(next: Run[]) {
    runs.current = next;
    const out = mdOf(next);
    mine.current = out;
    emit(out);
    return out;
  }

  return {
    get runs() {
      return runs.current;
    },
    get plain() {
      return runs.current.map((r) => r.text).join('');
    },

    /**
     * The field's text changed; returns where the caret should sit. `caret` is
     * the field's own caret in `nextPlain`, when it has one to give.
     */
    type(nextPlain: string, caret?: number): { plain: string; caret: number } {
      const typed = typeInto(runs.current, nextPlain, pending.current, caret);
      pending.current = typed.pending;
      push(typed.runs);
      return { plain: typed.plain, caret: typed.caret };
    },

    /**
     * A paste landing in this block. Read as markdown rather than typed in, so
     * every pair it carries is annotated and not just the one at the caret.
     */
    paste(start: number, end: number, text: string): { plain: string; caret: number } {
      pending.current = null;
      const put = pasteRuns(runs.current, start, end, text, mentions);
      push(put.runs);
      return { plain: put.plain, caret: put.caret };
    },

    /**
     * Return pressed, or a paste landing across blocks: the block's two halves,
     * as markdown. A selection passes its far end too, and what it held goes.
     */
    split(caret: number, end = caret) {
      return splitRuns(runs.current, caret, end);
    },

    toggle(start: number, end: number, kind: keyof Marks, value: true | string = true) {
      pending.current = null;
      push(toggleRuns(runs.current, start, end, kind, value));
    },

    mention(start: number, end: number, title: string): number {
      pending.current = null;
      const put = mentionRuns(runs.current, start, end, title);
      push(put.runs);
      return put.caret;
    },

    marks(start: number, end: number): Marks {
      return marksIn(runs.current, start, end);
    },

    /** The caret moved, so a pair that just closed is no longer "just closed". */
    moved(at: number) {
      if (pending.current && pending.current.at !== at) pending.current = null;
    },
  };
}
