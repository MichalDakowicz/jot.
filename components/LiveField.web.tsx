import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import { StyleSheet, type TextStyle } from 'react-native';

import { offsetNearX, putCaret, readRange } from '../lib/caret';
import { barRange } from '../lib/field';
import type { Marks, Run } from '../lib/rich';
import { tabText } from '../lib/typing';
import { c, f } from '../theme/tokens';
import type { LiveFieldHandle, LiveFieldProps } from './LiveField';
import { useLiveBlock } from './useLiveBlock';

/**
 * The web half of the live field.
 *
 * react-native-web renders TextInput as a textarea, which cannot style parts of
 * its own contents, so a block is a contenteditable: the runs are drawn from the
 * rich text on every keystroke and the caret is put back by offset. Offsets are
 * plain-text offsets, and since delimiters are consumed rather than shown, what
 * is on screen is exactly the plain text those offsets count.
 *
 * The markup is written with innerHTML rather than as React children on
 * purpose. A browser edits inside a contenteditable itself — splitting text
 * nodes, dropping in <br>, merging elements — and React would then try to
 * reconcile children it no longer created, which fails with "Failed to execute
 * 'removeChild' on 'Node'". One opaque subtree keeps the DOM ours to rewrite.
 */
export const LiveField = forwardRef<LiveFieldHandle, LiveFieldProps>(function LiveField(
  {
    text,
    mentions,
    selection,
    autoFocus,
    placeholder,
    style,
    onChangeText,
    onContext,
    onSelection,
    onEnter,
    onBackspaceAtStart,
    onFocus,
    onTab,
    onArrow,
    onCaretSpot,
    onCross,
    onStep,
    onDeleteAtEnd,
    aim,
    onSelectAcross,
    onPasteText,
    blockId,
  },
  ref,
) {
  const block = useLiveBlock(text, mentions, onChangeText);
  const host = useRef<HTMLDivElement | null>(null);
  /** Where the caret belongs once the runs have been redrawn. */
  const want = useRef<number | null>(null);
  /** Where that selection ends, when it is a selection and not a caret. */
  const wantEnd = useRef<number | null>(null);
  /** The last selection seen inside this block, for a bar press that moves it. */
  const kept = useRef<{ start: number; end: number } | null>(null);
  /** The markup this component last wrote, so it writes only on a real change. */
  const written = useRef<string | null>(null);
  /** The caret request already honoured, so each one is honoured once. */
  const consumed = useRef<LiveFieldProps['selection']>(null);

  const plain = block.plain;
  const html = htmlOf(block.runs);

  const readSelection = useCallback(() => {
    const root = host.current;
    return root ? readRange(root) : null;
  }, []);

  /**
   * Where the caret is drawn, so a menu can open beside it. A collapsed range
   * measures as a zero-width rect, which is all that is needed; at a boundary
   * it can measure as nothing at all, and then the line's own box will do.
   */
  const reportSpot = useCallback(() => {
    if (!onCaretSpot) return;
    const root = host.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0 || !root.contains(sel.getRangeAt(0).startContainer)) {
      onCaretSpot(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect =
      typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
    const line = rect && rect.height ? rect : root.getBoundingClientRect();
    onCaretSpot({ x: line.left, y: line.top, height: line.height });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCaretSpot]);

  const place = useCallback((start: number, end: number) => {
    const root = host.current;
    if (root) putCaret(root, start, end);
  }, []);

  useImperativeHandle(ref, () => ({
    toggleMark(kind, value) {
      // Pressing the bar can move the selection out of the block, and the
      // focus with it: the selection last seen in here is the one meant, and
      // it comes back afterwards so a second mark can go on the same words.
      const range = barRange(readSelection(), kept.current, plain.length);
      want.current = range.start;
      wantEnd.current = range.end;
      const root = host.current;
      if (root && root.ownerDocument.activeElement !== root) root.focus({ preventScroll: true });
      block.toggle(range.start, range.end, kind, value ?? true);
    },
    replaceMention(start, end, title) {
      want.current = block.mention(start, end, title);
    },
  }));

  /**
   * Draw the runs, and put the caret back afterwards.
   *
   * This is the only thing that writes into the element. React must not: it
   * rewrites `dangerouslySetInnerHTML` on every render, even when the markup is
   * identical, and replacing the child nodes destroys the browser's selection —
   * which is why the caret used to snap back to the start of the block on any
   * re-render, such as the one every selection change causes.
   *
   * A write happens when the markup we hold differs from the markup we wrote,
   * or when the browser has edited the text under us.
   */
  useLayoutEffect(() => {
    const root = host.current;
    if (!root) return;

    const focused = root.ownerDocument.activeElement === root;
    if (written.current !== html || root.textContent !== plain) {
      // Hold the caret across a rewrite no keystroke asked for.
      const before = focused ? readRange(root) : null;
      root.innerHTML = html;
      written.current = html;
      if (focused && want.current === null && before) want.current = before.start;
    }

    // A caret the editor asked for beats whatever the browser is doing, but is
    // honoured once: a later render must not yank the caret back to it.
    const asked = selection && consumed.current !== selection ? selection : null;
    consumed.current = selection ?? null;

    if (!focused) return;
    const at = want.current ?? asked?.start ?? null;
    if (at === null) return;
    const end = wantEnd.current ?? asked?.end ?? at;
    want.current = null;
    wantEnd.current = null;
    place(Math.min(at, plain.length), Math.min(end, plain.length));
    reportSpot();
  });

  useEffect(() => {
    const onSelectionChange = () => {
      const root = host.current;
      if (!root || root.ownerDocument.activeElement !== root) return;
      const range = readSelection();
      if (!range) return;
      kept.current = range;
      block.moved(range.start);
      onSelection(range, block.marks(range.start, range.end));
      reportSpot();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readSelection, onSelection, reportSpot]);

  // Becoming the focused block: take focus and place the caret in the same
  // pass. Waiting for a later render would leave it wherever the browser put it.
  useEffect(() => {
    if (!autoFocus) return;
    const root = host.current;
    if (!root) return;
    if (root.ownerDocument.activeElement !== root) root.focus();
    // Crossing in from above or below keeps the column the caret had there.
    const aimed = aim ? offsetNearX(root, aim.x, aim.dir) : null;
    if (aimed !== null) {
      want.current = null;
      place(aimed, aimed);
      return;
    }
    const at = Math.min(want.current ?? selection?.start ?? plain.length, plain.length);
    want.current = null;
    place(at, Math.min(selection?.end ?? at, plain.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  function handleInput() {
    const root = host.current;
    if (!root) return;
    // A contenteditable hands back U+00A0 for a space it thinks is trailing.
    const next = (root.textContent ?? '').replace(NBSP, ' ');
    // The browser has already put the caret after what went in.
    const typed = block.type(next, readRange(root)?.start);
    want.current = typed.caret;
    onContext(typed.plain, typed.caret);
  }

  /**
   * Is the caret on the block's first or last visual line? Compared by the
   * caret's own rect against the block's box, so a wrapped paragraph is walked
   * line by line before the caret leaves it.
   */
  function onEdgeLine(dir: -1 | 1): boolean {
    const root = host.current;
    const rect = caretRect();
    if (!root || !rect) return true;
    const box = root.getBoundingClientRect();
    const slack = rect.height * 0.6;
    return dir < 0 ? rect.top - box.top < slack : box.bottom - rect.bottom < slack;
  }

  /** The caret as drawn, or null where it measures as nothing. */
  function caretRect(): DOMRect | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const r = sel.getRangeAt(0);
    const rect = typeof r.getBoundingClientRect === 'function' ? r.getBoundingClientRect() : null;
    return rect && rect.height ? rect : null;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const range = readSelection();

    if (e.key === 'Enter') {
      e.preventDefault();
      const split = block.split(range?.start ?? plain.length);
      onEnter(split.head, split.tail);
      return;
    }

    // Tab belongs to the editor, never to the browser: letting the default
    // through walks the focus out of the note, which loses the caret. It nests
    // a list item or steps a table cell where there is one to step to, and
    // anywhere else it is a tab in the text.
    if (e.key === 'Tab') {
      e.preventDefault();
      if (onTab?.(e.shiftKey)) return;
      const at = range ?? { start: plain.length, end: plain.length };
      const put = tabText(plain, at.start, at.end, e.shiftKey);
      if (!put) return;
      const typed = block.type(put.text, put.caret);
      want.current = typed.caret;
      onContext(typed.plain, typed.caret);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const dir = e.key === 'ArrowDown' ? 1 : -1;

      // A menu's highlight, or a table's rows, come first.
      if (onArrow) {
        e.preventDefault();
        onArrow(dir);
        return;
      }
      // Shift grows a selection over whole blocks: a browser cannot stretch one
      // text selection across separate editable elements.
      if (e.shiftKey && onSelectAcross && onEdgeLine(dir)) {
        e.preventDefault();
        onSelectAcross(dir);
        return;
      }
      // Otherwise the caret walks the lines, and steps out at the edge, taking
      // its column with it.
      if (!e.shiftKey && onCross && onEdgeLine(dir)) {
        e.preventDefault();
        onCross(dir, caretRect()?.left);
        return;
      }
    }

    // Left off the head of the block, or right off its end, carries on into the
    // next one rather than stopping dead. Word and line jumps too: at an edge
    // there is nothing left in this block for them to jump over.
    const caretOnly = !!range && range.start === range.end;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && onStep && caretOnly) {
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (dir < 0 ? range.start === 0 : range.start === plain.length) {
        e.preventDefault();
        onStep(dir);
        return;
      }
    }

    if (e.key === 'Backspace' && range && range.start === 0 && range.end === 0) {
      e.preventDefault();
      onBackspaceAtStart();
      return;
    }

    if (e.key === 'Delete' && onDeleteAtEnd && caretOnly && range.start === plain.length) {
      e.preventDefault();
      onDeleteAtEnd();
      return;
    }

    // The keyboard shortcuts Notion offers alongside the markdown ones.
    const kind = (e.ctrlKey || e.metaKey) && !e.altKey ? KEYS[e.key.toLowerCase()] : undefined;
    if (kind && range) {
      e.preventDefault();
      want.current = range.start;
      wantEnd.current = range.end;
      block.toggle(range.start, range.end, kind);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    // Keep the block plain: styled HTML has nowhere to go in a markdown note.
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(NBSP, ' ');
    const range = readSelection() ?? { start: plain.length, end: plain.length };

    // More than one line is more than one block, and only the editor makes
    // blocks: hand it the two halves of this one with the text to go between.
    if (onPasteText && NEWLINES.test(text)) {
      const split = block.split(range.start, range.end);
      onPasteText(split.head, text, split.tail);
      return;
    }

    const pasted = block.paste(range.start, range.end, text.replace(SPACES, ' '));
    want.current = pasted.caret;
    onContext(pasted.plain, pasted.caret);
  }

  const css = { ...FIELD_CSS, ...cssOf(StyleSheet.flatten(style) ?? {}) };

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {!plain ? <div style={{ ...css, ...PLACEHOLDER_CSS }}>{placeholder}</div> : null}
      <div
        ref={host}
        data-block={blockId}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={onFocus}
        style={css}
      />
    </div>
  );
});

const KEYS: Record<string, keyof Marks | undefined> = {
  b: 'bold',
  i: 'em',
  e: 'code',
  u: 'strike',
};

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** The runs as markup. Note text is never trusted as HTML. */
export function htmlOf(runs: Run[]): string {
  return runs
    .map((run) => {
      const body = run.text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
      const attr = attrOf(run.marks);
      return attr ? `<span style="${attr}">${body}</span>` : `<span>${body}</span>`;
    })
    .join('');
}

/** Annotations as a style attribute. */
function attrOf(marks: Marks): string {
  const out: string[] = [];
  if (marks.bold) out.push(`font-family:${f.b800}`, 'font-weight:800');
  if (marks.em) out.push('font-style:italic');
  if (marks.strike) out.push('text-decoration:line-through');
  if (marks.mark) out.push(`background-color:${c.a200}`, `color:${c.a900}`);
  if (marks.code) out.push(`font-family:${f.mono}`, 'font-size:13.5px', `color:${c.a800}`);
  if (marks.mention) out.push(`font-family:${f.b600}`, `color:${c.g800}`);
  if (marks.link) out.push(`font-family:${f.b600}`, `color:${c.a700}`, 'text-decoration:underline');
  return out.join(';');
}

const NBSP = new RegExp(String.fromCharCode(160), 'g');
/** Not global: a global regexp carries its own cursor between `test` calls. */
const NEWLINES = new RegExp('[\r\n]+');
const SPACES = new RegExp('[\r\n]+', 'g');

/** React Native text styles the parent passes, in the terms a div understands. */
function cssOf(style: TextStyle): React.CSSProperties {
  const out: React.CSSProperties = {};
  if (style.fontFamily) out.fontFamily = style.fontFamily;
  if (typeof style.fontSize === 'number') out.fontSize = style.fontSize;
  if (typeof style.lineHeight === 'number') out.lineHeight = `${style.lineHeight}px`;
  if (style.color) out.color = style.color as string;
  if (style.fontStyle) out.fontStyle = style.fontStyle;
  if (style.fontWeight) out.fontWeight = style.fontWeight as React.CSSProperties['fontWeight'];
  if (typeof style.letterSpacing === 'number') out.letterSpacing = style.letterSpacing;
  return out;
}

const FIELD_CSS: React.CSSProperties = {
  fontFamily: f.b400,
  fontSize: 15,
  lineHeight: '25px',
  color: c.n900,
  outline: 'none',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  tabSize: 4,
  minHeight: 25,
  caretColor: c.accent,
};

const PLACEHOLDER_CSS: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  color: c.n400,
  pointerEvents: 'none',
};
