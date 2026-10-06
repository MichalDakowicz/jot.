import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveField, type LiveFieldHandle } from '../../../components/LiveField';
import { MarkBar } from '../../../components/MarkBar';
import { MentionPicker, type MentionHit } from '../../../components/MentionPicker';
import { NoteMeta } from '../../../components/NoteMeta';
import { SlashMenu, type CaretSpot } from '../../../components/SlashMenu';
import { Empty, Screen } from '../../../components/ui';
import {
  convertMarker,
  COUNTED,
  countedMarkers,
  depthAllowed,
  evenRows,
  isEmptyMarked,
  LISTS,
  nextKind,
  parseDoc,
  serializeDoc,
  type Block,
  type BlockKind,
} from '../../../lib/doc';
import { dropMarker, plainFor } from '../../../lib/field';
import { stepPick } from '../../../lib/menu';
import { pasteInto } from '../../../lib/paste';
import { useFittedDisplaySize } from '../../../lib/fit';
import { useIsWide } from '../../../lib/layout';
import type { Marks } from '../../../lib/rich';
import { useStore } from '../../../lib/store';
import {
  caretAfterChange,
  codeIndent,
  codeTab,
  slashHits,
  slashQuery,
  type SlashItem,
} from '../../../lib/typing';
import { c, f, SELECTION, shadow, tintOf } from '../../../theme/tokens';

type Range = { start: number; end: number };

/**
 * Which block a DOM node sits in, read off the data-block each field carries.
 * Web only; on native there is no node to trace.
 */
function blockOf(node: unknown): number | null {
  if (Platform.OS !== 'web' || !node) return null;
  const start = node as { nodeType?: number; parentElement?: unknown };
  const el = (start.nodeType === 1 ? start : start.parentElement) as
    | { closest?: (q: string) => { getAttribute: (a: string) => string | null } | null }
    | null
    | undefined;
  const host = el?.closest?.('[data-block]');
  const id = host?.getAttribute('data-block');
  const at = id === null || id === undefined ? NaN : Number.parseInt(id, 10);
  return Number.isFinite(at) ? at : null;
}
/**
 * Marks a row as a block on web, the way each field marks itself, so a drag
 * over a divider, a code block, or the gutter a list marker sits in can be
 * traced back to the block it crossed.
 */
function blockData(i: number): { dataSet?: { block: string } } {
  return Platform.OS === 'web' ? { dataSet: { block: String(i) } } : {};
}

/** An @ being typed: where it sits, what follows it, and which field it is in. */
type Mention = { start: number; end: number; q: string; key: string };

export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const { noteById, notebookById, notebooks, notes, mentionables, updateNote, flushSaves } = useStore();

  const note = noteById(id);
  const blocks = useMemo(() => parseDoc(note?.body ?? ''), [note?.body]);
  /** "3." or "c." per block, worked out by the same walk the markdown uses. */
  const markers = useMemo(() => countedMarkers(blocks), [blocks]);
  const mentionTitles = useMemo(() => mentionables.map((m) => m.title), [mentionables]);
  const title = useFittedDisplaySize(note?.title ?? '', 27, 17);

  const [focus, setFocus] = useState<number | null>(0);
  /** Caret the editor is asking for, in plain-text offsets. */
  const [forced, setForced] = useState<Range | null>({ start: 0, end: 0 });
  const [ranged, setRanged] = useState(false);
  const [active, setActive] = useState<Marks>({});
  /** Which cell of a table block holds the caret. */
  const [cell, setCell] = useState<{ r: number; c: number } | null>(null);
  /** Where a caret crossing in from above or below wants to land: its column. */
  const [aim, setAim] = useState<{ x: number; dir: -1 | 1 } | null>(null);
  const [mention, setMention] = useState<Mention | null>(null);
  const [slash, setSlash] = useState<string | null>(null);
  /** Which row of the block menu Return would take. */
  const [pick, setPick] = useState(0);
  /** Which note of the @ picker Return would link. */
  const [mentionPick, setMentionPick] = useState(0);
  /**
   * A menu Escape closed, by what opened it — the "/" of block 3, or the @ at
   * offset 12 of it — so it stays shut while that is still being typed, and
   * comes back once it is gone and typed again.
   */
  const hush = useRef<string | null>(null);
  /** Where the caret is on screen, so the menu can sit beside it. */
  const [spot, setSpot] = useState<CaretSpot | null>(null);
  /**
   * Whole blocks held by a selection that reaches past one block. A browser
   * cannot stretch one text selection across separate editable elements, so
   * past a block's edge the selection becomes block-shaped, as it does in
   * Notion.
   */
  const [span, setSpan] = useState<{ from: number; to: number } | null>(null);
  const [keyboard, setKeyboard] = useState(0);
  const sel = useRef<Range>({ start: 0, end: 0 });
  /** The markdown a field last handed back, and for which block. */
  const reported = useRef<{ i: number; md: string } | null>(null);
  const field = useRef<LiveFieldHandle | null>(null);
  const spanRef = useRef<{ from: number; to: number } | null>(null);
  const dropRef = useRef<(() => void) | null>(null);
  const copyRef = useRef<(() => void) | null>(null);
  /** Escape with a menu open: closes it, and says whether it did. */
  const escRef = useRef<(() => boolean) | null>(null);
  /** Whether the focused field already holds all of its own text. */
  const wholeBlockRef = useRef<(() => boolean) | null>(null);
  const blockCount = useRef(1);
  spanRef.current = span;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // With blocks held, the keyboard acts on them rather than on any one field.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const shortcut = (e.metaKey || e.ctrlKey) && !e.altKey;

      if (e.key === 'Escape' && escRef.current?.()) {
        e.preventDefault();
        return;
      }

      // Select all: a browser can only ever reach the end of the block it is
      // in, so the first press takes the block and the next takes the note.
      if (shortcut && e.key.toLowerCase() === 'a') {
        if (!spanRef.current && !wholeBlockRef.current?.()) return;
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        setSpan({ from: 0, to: blockCount.current - 1 });
        return;
      }

      if (!spanRef.current) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        dropRef.current?.();
      } else if (e.key === 'Escape') {
        setSpan(null);
      } else if (shortcut && e.key.toLowerCase() === 'c') {
        copyRef.current?.();
      } else if (shortcut && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        copyRef.current?.();
        dropRef.current?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /**
   * A drag that leaves one block. A browser cannot stretch one text selection
   * across separate editable elements, so past a block's edge the selection
   * becomes block-shaped, as it does in Notion.
   *
   * The drag is followed by the pointer rather than by `selectionchange`.
   * Dropping the ragged text selection is what leaves the block highlight as
   * the only one on screen — but it also ends the browser's own drag, so the
   * selection cannot be the thing that says how far the drag has reached: read
   * that way, a drag over five blocks stops after two.
   */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let from: number | null = null;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      from = blockOf(e.target);
      // A press on the bar the held blocks put up is not a press on a block.
      if (from !== null) setSpan(null);
    };

    const onMove = (e: PointerEvent) => {
      if (from === null || e.buttons === 0) return;
      const to = blockOf(document.elementFromPoint(e.clientX, e.clientY));
      if (to === null) return;
      // Inside the block it started in the browser's own text selection is the
      // right one — until the drag has left once, which killed it for good.
      if (to === from && !spanRef.current) return;
      window.getSelection()?.removeAllRanges();
      setSpan({ from, to });
    };

    const onUp = () => {
      from = null;
    };

    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, []);

  if (!note) {
    return (
      <Screen>
        <Empty text="That note is gone." />
      </Screen>
    );
  }

  const noteId = note.id;

  function save(next: Block[]) {
    updateNote(noteId, {
      body: serializeDoc(next.length ? next : [{ kind: 'p', text: '' }]),
    });
  }

  /** Move the caret into a block without touching the note. */
  function focusBlock(i: number, caret?: number) {
    const to = caret ?? Number.MAX_SAFE_INTEGER;
    setFocus(i);
    setAim(null);
    sel.current = { start: to, end: to };
    setForced({ start: to, end: to });
    setRanged(false);
    setSlash(null);
    setMention(null);
  }

  function write(next: Block[], at?: number, caret?: number) {
    save(next);
    if (at === undefined) return;
    focusBlock(at, caret);
  }

  function replace(i: number, patch: Partial<Block>, caret?: number) {
    const next = [...blocks];
    next[i] = { ...next[i], ...patch };
    write(next, i, caret);
  }

  /** A divider has no field of its own, so tapping one lands after it. */
  function focusAfterRule(i: number) {
    if (blocks[i + 1]) {
      focusBlock(i + 1, 0);
      return;
    }
    const next = [...blocks, { kind: 'p' as BlockKind, text: '' }];
    write(next, next.length - 1, 0);
  }

  const cellsOf = (b: Block) => evenRows(b.rows?.length ? b.rows : [['', '']]);

  function focusCell(i: number, r: number, c: number, caret = 0) {
    setCell({ r, c });
    setFocus(i);
    sel.current = { start: caret, end: caret };
    setForced({ start: caret, end: caret });
    setRanged(false);
    setSlash(null);
    setMention(null);
  }

  function writeCell(i: number, r: number, c: number, md: string) {
    const rows = cellsOf(blocks[i]).map((row) => [...row]);
    rows[r][c] = md;
    const next = [...blocks];
    next[i] = { ...next[i], rows };
    save(next);
    setForced(null);
  }

  function shapeTable(i: number, rows: string[][], r: number, c: number, caret = 0) {
    const next = [...blocks];
    next[i] = { ...next[i], rows: evenRows(rows) };
    save(next);
    focusCell(i, r, c, caret);
  }

  /**
   * Tab walks the cells in reading order; from the last one it adds a row, so a
   * table can be filled without ever reaching for the mouse.
   */
  function cellTab(i: number, r: number, c: number, back: boolean): boolean {
    const rows = cellsOf(blocks[i]);
    const width = rows[0].length;
    const at = r * width + c + (back ? -1 : 1);

    if (at < 0) {
      focusBlock(Math.max(0, i - 1));
      return true;
    }
    if (at >= rows.length * width) {
      shapeTable(i, [...rows.map((row) => [...row]), rows[0].map(() => '')], rows.length, 0);
      return true;
    }
    const target = { r: Math.floor(at / width), c: at % width };
    focusCell(i, target.r, target.c, (rows[target.r][target.c] ?? '').length);
    return true;
  }

  /** Up and down step between rows, staying in the column. */
  function cellArrow(i: number, r: number, c: number, dir: -1 | 1) {
    const rows = cellsOf(blocks[i]);
    const next = r + dir;
    if (next < 0 || next >= rows.length) {
      // Leaving the table at the top or the bottom, the way any block is left.
      crossTo(i, dir);
      return;
    }
    focusCell(i, next, c, (rows[next][c] ?? '').length);
  }

  /** Left off the head of a cell or right off its end: the next cell in reading order. */
  function cellStep(i: number, r: number, c: number, dir: -1 | 1) {
    const rows = cellsOf(blocks[i]);
    const width = rows[0].length;
    const at = r * width + c + dir;
    if (at < 0 || at >= rows.length * width) {
      crossTo(i, dir, { sideways: true });
      return;
    }
    const to = { r: Math.floor(at / width), c: at % width };
    focusCell(i, to.r, to.c, dir < 0 ? plainFor(rows[to.r][to.c] ?? '', mentionTitles).length : 0);
  }

  /** The whole table goes, and a paragraph takes its place. */
  function dropTable(i: number) {
    setCell(null);
    replace(i, { kind: 'p', text: '', rows: undefined }, 0);
  }

  /** Return in a cell steps down the column, adding a row at the bottom. */
  function cellDown(i: number, r: number, c: number) {
    const rows = cellsOf(blocks[i]);
    if (r + 1 < rows.length) {
      focusCell(i, r + 1, c);
      return;
    }
    shapeTable(i, [...rows.map((row) => [...row]), rows[0].map(() => '')], r + 1, c);
  }

  /**
   * Tab nests a list item under the one above it, Shift+Tab lifts it back out.
   * The rules live in the model: an item can only be one level deeper than the
   * item it hangs under, and the first item of a list has nothing to hang under.
   *
   */
  function nest(i: number, back: boolean) {
    const block = blocks[i];
    if (!LISTS.includes(block.kind)) return;

    const at = block.depth ?? 0;
    const want = back ? at - 1 : at + 1;
    const depth = depthAllowed(blocks, i, want);
    if (depth === at) return;

    const next = [...blocks];
    next[i] = { ...block, depth };

    // The items nested under this one travel with it.
    for (let j = i + 1; j < next.length; j += 1) {
      const child = next[j];
      if (!LISTS.includes(child.kind) || (child.depth ?? 0) <= at) break;
      next[j] = { ...child, depth: Math.max(0, (child.depth ?? 0) + (depth - at)) };
    }

    save(next);
    setForced({ start: sel.current.start, end: sel.current.end });
  }

  /**
   * Off the edge of a block: the caret carries on in the next one. Up and down
   * bring the caret's column (`x`) to land under; left and right (`sideways`)
   * land at the near end, and into a table from below that is its last cell.
   */
  function crossTo(i: number, dir: -1 | 1, how: { x?: number; sideways?: boolean } = {}) {
    const to = i + dir;
    const target = blocks[to];
    if (!target) return;
    setSpan(null);
    if (target.kind === 'table') {
      const rows = cellsOf(target);
      const c = how.sideways && dir < 0 ? rows[0].length - 1 : 0;
      setCell({ r: dir < 0 ? rows.length - 1 : 0, c });
    } else {
      setCell(null);
    }
    if (target.kind === 'rule') {
      // Nothing to type in, so carry straight on.
      crossTo(to, dir, how);
      return;
    }
    focusBlock(to, dir < 0 ? undefined : 0);
    if (how.x !== undefined && target.kind !== 'table') setAim({ x: how.x, dir });
  }

  /** Shift with up or down: grow the block selection. */
  function growSpan(i: number, dir: -1 | 1) {
    const now = span ?? { from: i, to: i };
    const to = Math.max(0, Math.min(blocks.length - 1, now.to + dir));
    setSpan({ from: now.from, to });
    setRanged(false);
    setSlash(null);
    setMention(null);
  }

  const spanBounds = span
    ? { lo: Math.min(span.from, span.to), hi: Math.max(span.from, span.to) }
    : null;

  function dropSpan() {
    if (!spanBounds) return;
    const next = blocks.filter((_, at) => at < spanBounds.lo || at > spanBounds.hi);
    setSpan(null);
    setCell(null);
    write(next.length ? next : [{ kind: 'p', text: '' }], Math.max(0, spanBounds.lo - 1));
  }

  function copySpan() {
    if (!spanBounds) return;
    const md = serializeDoc(blocks.slice(spanBounds.lo, spanBounds.hi + 1));
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      void navigator.clipboard?.writeText(md).catch(() => undefined);
    }
  }

  /** The field saved new markdown for its block. */
  function onBlockChange(md: string, i: number) {
    reported.current = { i, md };
    const next = [...blocks];
    next[i] = { ...next[i], text: md };
    save(next);
    setForced(null);
    // Typing is about one block, so blocks held from before are let go rather
    // than left highlighted around a line that is being written.
    if (span) setSpan(null);
  }

  /**
   * The field reports its plain text after every keystroke: block markers are
   * matched against that, and so are the two pickers.
   */
  function onContext(plain: string, caret: number, i: number) {
    const block = blocks[i];

    // A marker typed at the head of the block: the block takes that shape and
    // the marker leaves the text, the way Notion does it.
    const converted = convertMarker(plain);
    if (converted) {
      const cut = plain.length - converted.text.length;

      if (converted.kind === 'rule') {
        const next = [...blocks];
        next[i] = { kind: 'rule', text: '' };
        if (!next[i + 1] || next[i + 1].kind === 'rule') {
          next.splice(i + 1, 0, { kind: 'p', text: '' });
        }
        write(next, i + 1, 0);
        return;
      }

      // The field reports its text and then this, in one handler, so `blocks`
      // has not caught up yet: what it holds is the block from before the key.
      const md = reported.current?.i === i ? reported.current.md : block.text;
      replace(
        i,
        {
          kind: converted.kind,
          text: converted.kind === 'fence' ? '' : dropMarker(md, cut, mentionTitles),
          done: converted.kind === 'todo' ? converted.done : undefined,
          lang: converted.kind === 'fence' ? (converted.lang ?? '') : undefined,
          // A list that becomes another kind of list stays where it sits.
          depth: LISTS.includes(converted.kind) ? (block.depth ?? 0) : undefined,
          // "b. " starts the list at b, and any other shape drops the count.
          start: COUNTED.includes(converted.kind) ? converted.start : undefined,
          rows: converted.rows,
        },
        Math.max(0, caret - cut),
      );
      return;
    }

    const typed = slashQuery(plain);
    const found = typed === null ? mentionAt(plain, caret, String(i)) : null;
    if (hush.current !== (typed !== null ? `/${i}` : found?.key)) hush.current = null;

    const q = hush.current === `/${i}` ? null : typed;
    if (q !== slash) setPick(0);
    setSlash(q);
    showMention(found);
  }

  /** A cell is plain rich text: no block markers, but @ still links a note. */
  function onCellContext(plain: string, caret: number, where: string) {
    setSlash(null);
    const found = mentionAt(plain, caret, where);
    if (hush.current !== found?.key) hush.current = null;
    showMention(found);
  }

  /** The @ being typed just behind the caret in the field `where`, if any. */
  function mentionAt(plain: string, caret: number, where: string): Mention | null {
    const m = /@([A-Za-z0-9'’: -]{0,30})$/.exec(plain.slice(0, caret));
    if (!m || / {2}$/.test(m[1])) return null;
    return { start: m.index, end: caret, q: m[1].trim(), key: `@${where}:${m.index}` };
  }

  /** Open the @ picker on `next`, unless Escape closed that one. */
  function showMention(next: Mention | null) {
    const shown = next && hush.current !== next.key ? next : null;
    if (shown?.key !== mention?.key || shown?.q !== mention?.q) setMentionPick(0);
    setMention(shown);
  }

  /** Return with the @ picker open links the highlighted note. */
  function takeMention(): boolean {
    if (!mention || !hits.length) return false;
    pickMention(hits[Math.min(mentionPick, hits.length - 1)].id);
    return true;
  }

  /** Return splits the block, and a list or quote carries onto the new one. */
  function onEnter(head: string, tail: string, i: number) {
    const block = blocks[i];

    if (takeMention()) return;

    // With the block menu open, Return takes the highlighted row instead.
    if (slash !== null) {
      const hits = slashHits(slash);
      const item = hits[Math.min(pick, hits.length - 1)];
      if (item) {
        pickSlash(item);
        return;
      }
    }

    if (isEmptyMarked({ ...block, text: head }) && !tail.trim()) {
      replace(i, { kind: 'p', text: tail, done: undefined }, 0);
      return;
    }

    const kind = nextKind(block);
    const next = [...blocks];
    next[i] = { ...block, text: head };
    next.splice(i + 1, 0, {
      kind,
      text: tail,
      // A new item stays at the level of the one it came from.
      ...(LISTS.includes(kind) ? { depth: block.depth ?? 0 } : {}),
      ...(kind === 'todo' ? { done: false } : {}),
    });
    write(next, i + 1, 0);
  }

  /**
   * More than one line pasted into a block: the text is read back as markdown,
   * which is what a copied span is written out as, and lands as blocks between
   * the two halves of the block the caret was in.
   */
  function onPasteText(head: string, text: string, tail: string, i: number) {
    // With blocks held, the paste takes their place: what was in them is what
    // the selection was standing for.
    if (spanBounds) {
      const cleared = [...blocks];
      cleared.splice(spanBounds.lo, spanBounds.hi - spanBounds.lo + 1, { kind: 'p', text: '' });
      const over = pasteInto(cleared, spanBounds.lo, '', text, '', mentionTitles);
      setSpan(null);
      write(over.blocks, over.at, over.caret);
      return;
    }

    const put = pasteInto(blocks, i, head, text, tail, mentionTitles);
    write(put.blocks, put.at, put.caret);
  }

  /**
   * Backspace at the head of a shaped block drops the shape first, and only
   * merges upwards once the block is a plain paragraph.
   */
  function onBackspaceAtStart(i: number) {
    const block = blocks[i];

    // A nested item comes out one level at a time before it loses its shape.
    if (LISTS.includes(block.kind) && (block.depth ?? 0) > 0) {
      nest(i, true);
      return;
    }

    if (block.kind !== 'p') {
      replace(i, { kind: 'p', done: undefined, lang: undefined, start: undefined }, 0);
      return;
    }
    if (i === 0) return;

    const prev = blocks[i - 1];
    const next = [...blocks];
    if (prev.kind === 'rule' || prev.kind === 'fence') {
      next.splice(i - 1, 1);
      write(next, i - 1, 0);
      return;
    }
    next.splice(i - 1, 2, { ...prev, text: prev.text + block.text });
    write(next, i - 1);
  }

  /**
   * Delete at the end of a block brings the one below up into it, the caret
   * staying at the join. A divider below just goes; a table or a code block is
   * left alone, unless this block is empty, and then it is this block that goes.
   */
  function onDeleteAtEnd(i: number) {
    const block = blocks[i];
    const below = blocks[i + 1];
    if (!below) return;
    const join = plainFor(block.text, mentionTitles).length;
    const next = [...blocks];

    if (below.kind === 'rule') {
      next.splice(i + 1, 1);
      write(next, i, join);
      return;
    }
    if (!join && block.kind === 'p') {
      next.splice(i, 1);
      setCell(below.kind === 'table' ? { r: 0, c: 0 } : null);
      write(next, i, 0);
      return;
    }
    if (below.kind === 'table' || below.kind === 'fence') return;

    next.splice(i, 2, { ...block, text: block.text + below.text });
    write(next, i, join);
  }

  /** Code is typed as-is: no annotations, no markers, Return stays a newline. */
  function onChangeCode(text: string, i: number) {
    const block = blocks[i];
    const at = caretAfterChange(block.text, text);
    if (text.length === block.text.length + 1 && text[at - 1] === '\n') {
      const indent = codeIndent(text, at - 1);
      if (indent) {
        replace(i, { text: text.slice(0, at) + indent + text.slice(at) }, at + indent.length);
        return;
      }
    }
    const next = [...blocks];
    next[i] = { ...block, text };
    save(next);
    setForced(null);
    sel.current = { start: at, end: at };
  }

  function onCodeKey(e: NativeSyntheticEvent<TextInputKeyPressEventData>, i: number) {
    const key = e.nativeEvent.key;
    if (key === 'Tab') {
      // On web the browser would walk the focus out of the note instead.
      e.preventDefault?.();
      const { start, end } = sel.current;
      // Shift lives on the DOM event behind the web field; a phone has none.
      const back = !!(e.nativeEvent as { shiftKey?: boolean }).shiftKey;
      const tabbed = codeTab(blocks[i].text, start, end, back);
      if (tabbed.text !== blocks[i].text) replace(i, { text: tabbed.text }, tabbed.caret);
      return;
    }
    if (key === 'Backspace' && sel.current.start === 0 && sel.current.end === 0 && !blocks[i].text) {
      const next = [...blocks];
      next.splice(i, 1);
      write(next, Math.max(0, i - 1));
    }
  }

  function applyMark(kind: keyof Marks) {
    if (focus === null) return;
    if (kind === 'link') {
      // No dialog to ask for a target, so the selected text is the target.
      const plain = plainFor(blocks[focus].text, mentionTitles);
      const selected = plain.slice(sel.current.start, sel.current.end).trim();
      field.current?.toggleMark('link', /^https?:\/\//.test(selected) ? selected : 'https://');
      return;
    }
    field.current?.toggleMark(kind);
  }

  function pickSlash(item: SlashItem) {
    if (focus === null) return;
    setPick(0);
    const kind = SLASH_KIND[item.key];
    if (!kind) return;

    if (kind === 'rule') {
      const next = [...blocks];
      next[focus] = { kind: 'rule', text: '' };
      next.splice(focus + 1, 0, { kind: 'p', text: '' });
      write(next, focus + 1, 0);
      return;
    }

    if (kind === 'table') {
      const next = [...blocks];
      next[focus] = { kind: 'table', text: '', rows: [['', ''], ['', '']] };
      save(next);
      setSlash(null);
      focusCell(focus, 0, 0);
      return;
    }
    replace(
      focus,
      {
        kind,
        text: '',
        done: kind === 'todo' ? false : undefined,
        lang: kind === 'fence' ? '' : undefined,
        start: undefined,
      },
      0,
    );
  }

  function pickMention(pickedId: string) {
    const m = mention;
    const picked = notes.find((n) => n.id === pickedId);
    if (!m || focus === null || !picked) return;
    field.current?.replaceMention(m.start, m.end, picked.title);
    setMention(null);
  }

  const hits: MentionHit[] = mention
    ? notes
        .filter((n) => n.id !== noteId && n.title.toLowerCase().includes(mention.q.toLowerCase()))
        .slice(0, 4)
        .map((n) => ({
          id: n.id,
          title: n.title,
          nbName: notebookById(n.notebook_id)?.name ?? 'Notebook',
          tint: tintOf(notebookById(n.notebook_id)?.tint ?? 0).tint,
        }))
    : [];

  async function done() {
    Keyboard.dismiss();
    setFocus(null);
    await flushSaves();
    router.replace(`/note/${noteId}`);
  }

  dropRef.current = dropSpan;
  copyRef.current = copySpan;
  escRef.current = () => {
    if (slash !== null && focus !== null) {
      hush.current = `/${focus}`;
      setSlash(null);
      return true;
    }
    if (mention) {
      hush.current = mention.key;
      setMention(null);
      return true;
    }
    return false;
  };
  blockCount.current = blocks.length;
  // An empty block counts as held: there is nothing in it left to take.
  wholeBlockRef.current = () => {
    if (focus === null || !blocks[focus]) return false;
    const len = plainFor(blocks[focus].text, mentionTitles).length;
    return len === 0 || (sel.current.start === 0 && sel.current.end === len);
  };

  const panelBottom = keyboard ? keyboard + 12 : insets.bottom + 96;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: (keyboard || insets.bottom + 130) + 60,
          // The same measure as the note it turns into, so nothing shifts
          // sideways between reading and writing.
          paddingHorizontal: wide ? 52 : 20,
          maxWidth: wide ? 780 : undefined,
          width: '100%',
          alignSelf: 'center',
          gap: 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.editingPill}>
            <Text style={styles.editingText}>Editing</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={done} style={({ pressed }) => [styles.done, pressed && { backgroundColor: c.a600 }]}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        {/* The width is taken from this wrapper, not from the field: a
            TextInput that is already being re-measured as its own font changes
            reports its layout too late to size the next keystroke.
            Multiline so a title that has wound down to the floor wraps here the
            same way it does on the note, instead of scrolling out of sight.
            Return leaves the field rather than filing a newline in the title. */}
        <View onLayout={title.onLayout}>
          <TextInput
            value={note.title}
            onChangeText={(next) => updateNote(noteId, { title: next.replace(/[\r\n]+/g, ' ') })}
            placeholder="Title"
            placeholderTextColor={c.n400}
            selectionColor={c.accent}
            multiline
            submitBehavior="blurAndSubmit"
            style={[styles.title, { fontSize: title.fontSize, lineHeight: title.fontSize * 1.26 }]}
          />
        </View>

        <NoteMeta
          note={note}
          notebook={notebookById(note.notebook_id)}
          notebooks={notebooks}
          onMove={(notebookId) => updateNote(noteId, { notebook_id: notebookId })}
          onTags={(tags) => updateNote(noteId, { tags })}
        />

        <View style={{ gap: 3 }}>
          {blocks.map((block, i) => {
            const held = !!spanBounds && i >= spanBounds.lo && i <= spanBounds.hi;

            if (block.kind === 'rule') {
              return (
                <Pressable
                  key={i}
                  onPress={() => focusAfterRule(i)}
                  style={[styles.ruleRow, held && styles.held]}
                  {...blockData(i)}
                >
                  <View style={styles.rule} />
                </Pressable>
              );
            }

            if (block.kind === 'table') {
              const rows = cellsOf(block);
              const width = rows[0].length;
              const here = (r: number, ci: number) =>
                focus === i && cell?.r === r && cell?.c === ci;

              return (
                <View key={i} style={[styles.tableBlock, held && styles.held]} {...blockData(i)}>
                  <View style={styles.tableRowWrap}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View>
                        {rows.map((row, r) => (
                          <View key={r} style={styles.tr}>
                            {row.map((text, ci) => (
                              <View
                                key={ci}
                                style={[
                                  styles.td,
                                  ci < width - 1 && styles.tdDivider,
                                  r === 0 && styles.tdHead,
                                  here(r, ci) && styles.tdOn,
                                ]}
                              >
                                <LiveField
                                  ref={here(r, ci) ? field : null}
                                  text={text}
                                  mentions={mentionTitles}
                                  selection={here(r, ci) ? forced : null}
                                  autoFocus={here(r, ci)}
                                  placeholder={r === 0 ? 'Column' : ''}
                                  style={[styles.cellText, r === 0 && styles.cellHead]}
                                  onFocus={() => focusCell(i, r, ci, sel.current.start)}
                                  onChangeText={(md) => writeCell(i, r, ci, md)}
                                  // No block markers inside a cell: "## " there is
                                  // text, not a heading. @ still links a note.
                                  onContext={(plain, caret) =>
                                    onCellContext(plain, caret, `${i}.${r}.${ci}`)
                                  }
                                  onSelection={(range, marks) => {
                                    if (!here(r, ci)) setCell({ r, c: ci });
                                    if (focus !== i) setFocus(i);
                                    sel.current = range;
                                    setRanged(range.end > range.start);
                                    setActive(marks);
                                  }}
                                  onEnter={() => {
                                    if (!takeMention()) cellDown(i, r, ci);
                                  }}
                                  blockId={String(i)}
                                  onTab={(back) => cellTab(i, r, ci, back)}
                                  onArrow={(dir) => {
                                    if (mention && hits.length) {
                                      setMentionPick((p) => stepPick(p, dir, hits.length));
                                    } else {
                                      cellArrow(i, r, ci, dir);
                                    }
                                  }}
                                  onStep={(dir) => cellStep(i, r, ci, dir)}
                                  onBackspaceAtStart={() => {
                                    // Backspace at the head of the first cell drops
                                    // an empty table; elsewhere it steps back a cell.
                                    const empty = rows.every((row2) =>
                                      row2.every((cellText) => !cellText.trim()),
                                    );
                                    if (r === 0 && ci === 0) {
                                      if (empty) dropTable(i);
                                      return;
                                    }
                                    cellTab(i, r, ci, true);
                                  }}
                                />
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    </ScrollView>

                    {/* The handles sit on the edges they add to, the way a
                        spreadsheet puts them. */}
                    <Pressable
                      onPress={() =>
                        shapeTable(i, rows.map((row) => [...row, '']), cell?.r ?? 0, width)
                      }
                      style={({ pressed }) => [styles.edgeCol, pressed && styles.edgeOn]}
                      accessibilityLabel="Add a column"
                    >
                      <Text style={styles.edgeText}>+</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() =>
                      shapeTable(
                        i,
                        [...rows.map((row) => [...row]), rows[0].map(() => '')],
                        rows.length,
                        cell?.c ?? 0,
                      )
                    }
                    style={({ pressed }) => [styles.edgeRow, pressed && styles.edgeOn]}
                    accessibilityLabel="Add a row"
                  >
                    <Text style={styles.edgeText}>+</Text>
                  </Pressable>

                  {focus === i ? (
                    <View style={styles.tableBar}>
                      <TableButton
                        label="Delete row"
                        disabled={rows.length < 2}
                        onPress={() => {
                          const r = Math.min(cell?.r ?? rows.length - 1, rows.length - 1);
                          const kept = rows.filter((_, at) => at !== r).map((row) => [...row]);
                          shapeTable(i, kept, Math.max(0, r - 1), cell?.c ?? 0);
                        }}
                      />
                      <TableButton
                        label="Delete column"
                        disabled={width < 2}
                        onPress={() => {
                          const col = Math.min(cell?.c ?? width - 1, width - 1);
                          const kept = rows.map((row) => row.filter((_, at) => at !== col));
                          shapeTable(i, kept, cell?.r ?? 0, Math.max(0, col - 1));
                        }}
                      />
                      <TableButton label="Delete table" tone="accent" onPress={() => dropTable(i)} />
                    </View>
                  ) : null}
                </View>
              );
            }

            if (block.kind === 'fence') {
              return (
                <View key={i} style={[styles.fenceRow, held && styles.held]} {...blockData(i)}>
                  <TextInput
                    value={block.lang}
                    onChangeText={(lang) => replace(i, { lang })}
                    placeholder="language"
                    placeholderTextColor={c.n500}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.lang}
                  />
                  <TextInput
                    value={block.text}
                    autoFocus={focus === i}
                    multiline
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect={false}
                    selection={focus === i ? (forced ?? undefined) : undefined}
                    onFocus={() => setFocus(i)}
                    onChangeText={(t) => onChangeCode(t, i)}
                    onSelectionChange={(e) => {
                      sel.current = e.nativeEvent.selection;
                      if (forced) setForced(null);
                    }}
                    onKeyPress={(e) => onCodeKey(e, i)}
                    placeholder="Code, untouched by markdown"
                    placeholderTextColor={c.n500}
                    selectionColor={c.accent}
                    style={styles.code}
                  />
                </View>
              );
            }

            return (
              <View
                key={i}
                style={[
                  styles.row,
                  block.kind === 'quote' && styles.quoteRow,
                  held && styles.held,
                  !!block.depth && { marginLeft: block.depth * 20 },
                ]}
                {...blockData(i)}
              >
                <Prefix
                  block={block}
                  marker={markers[i]}
                  onToggle={() => replace(i, { done: !block.done }, sel.current.start)}
                />
                <LiveField
                  ref={focus === i ? field : null}
                  text={block.text}
                  mentions={mentionTitles}
                  selection={focus === i ? forced : null}
                  autoFocus={focus === i}
                  placeholder={PLACEHOLDER[block.kind]}
                  style={[styles.fieldText, FIELD[block.kind]]}
                  onFocus={() => setFocus(i)}
                  onChangeText={(md) => onBlockChange(md, i)}
                  onContext={(plain, caret) => onContext(plain, caret, i)}
                  onSelection={(range, marks) => {
                    if (focus !== i) setFocus(i);
                    sel.current = range;
                    setRanged(range.end > range.start);
                    setActive(marks);
                  }}
                  onEnter={(head, tail) => onEnter(head, tail, i)}
                  onPasteText={(head, text, tail) => onPasteText(head, text, tail, i)}
                  onBackspaceAtStart={() => onBackspaceAtStart(i)}
                  onCaretSpot={setSpot}
                  blockId={String(i)}
                  onTab={(back) => {
                    if (!LISTS.includes(block.kind)) return false;
                    nest(i, back);
                    return true;
                  }}
                  onCross={(dir, x) => crossTo(i, dir, { x })}
                  onStep={(dir) => crossTo(i, dir, { sideways: true })}
                  onDeleteAtEnd={() => onDeleteAtEnd(i)}
                  aim={focus === i ? aim : null}
                  onSelectAcross={(dir) => growSpan(i, dir)}
                  // Arrows only belong to the editor while a menu is open, and
                  // walk all of it; otherwise they are the caret's own.
                  onArrow={
                    slash !== null
                      ? (dir) => setPick((p) => stepPick(p, dir, slashHits(slash).length))
                      : mention && hits.length
                        ? (dir) => setMentionPick((p) => stepPick(p, dir, hits.length))
                        : undefined
                  }
                />
              </View>
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            const next = [...blocks, { kind: 'p' as BlockKind, text: '' }];
            write(next, next.length - 1, 0);
          }}
          style={styles.addBlock}
        >
          <Text style={styles.addBlockText}>+ block</Text>
        </Pressable>

        <Text style={styles.hint}>
          Formatting happens as you type and the markers are eaten:{' '}
          <Text style={{ fontFamily: f.b800 }}>**bold**</Text>,{' '}
          <Text style={{ fontFamily: f.b800 }}>*italic*</Text>,{' '}
          <Text style={{ fontFamily: f.b800 }}>`code`</Text>,{' '}
          <Text style={{ fontFamily: f.b800 }}>~struck~</Text>,{' '}
          <Text style={{ fontFamily: f.b800 }}>-&gt;</Text> and{' '}
          <Text style={{ fontFamily: f.b800 }}>--&gt;</Text> for arrows, short and long, the same
          backwards and both ways,{' '}
          <Text style={{ fontFamily: f.b800 }}>==marked==</Text>. At the head of a block,{' '}
          <Text style={{ fontFamily: f.b800 }}>##</Text> makes a heading (down to{' '}
          <Text style={{ fontFamily: f.b800 }}>####</Text>),{' '}
          <Text style={{ fontFamily: f.b800 }}>-</Text> a bullet,{' '}
          <Text style={{ fontFamily: f.b800 }}>1.</Text> a numbered list,{' '}
          <Text style={{ fontFamily: f.b800 }}>a.</Text> a lettered one — either starts where its
          marker says, so <Text style={{ fontFamily: f.b800 }}>c.</Text> or{' '}
          <Text style={{ fontFamily: f.b800 }}>4.</Text> picks a list back up after something in
          between —{' '}
          <Text style={{ fontFamily: f.b800 }}>[]</Text> a checkbox.{' '}
          <Text style={{ fontFamily: f.b800 }}>/</Text> picks a block and{' '}
          <Text style={{ fontFamily: f.b800 }}>||</Text> starts a table (one pipe per column),{' '}
          <Text style={{ fontFamily: f.b800 }}>@</Text> links a note. In a table, Tab walks the
          cells and adds a row at the end, the arrows step between rows, and Backspace in an empty
          one throws the table away. Tab nests a list item under the one above it and Shift+Tab
          lifts it back out; anywhere else — a paragraph, a heading, a code block — it puts a
          tab in the text, and it never walks the focus out of the note. Backspace at the head of a block clears its shape. The arrows
          walk the lines and carry on into the next block; hold Shift with them to take whole
          blocks, and a drag past a block's edge takes them the same way.{' '}
          <Text style={{ fontFamily: f.b800 }}>Ctrl+A</Text> takes the block, and again takes the
          note. Held blocks can be copied, cut, deleted, or pasted over.
        </Text>
      </ScrollView>

      {spanBounds ? (
        <View style={[styles.spanBar, { bottom: panelBottom }]}>
          <Text style={styles.spanCount}>
            {spanBounds.hi - spanBounds.lo + 1}
            {spanBounds.hi === spanBounds.lo ? ' block' : ' blocks'}
          </Text>
          <Pressable
            onPress={copySpan}
            style={({ pressed }) => [styles.spanChip, pressed && { backgroundColor: c.n300 }]}
          >
            <Text style={styles.spanChipText}>Copy</Text>
          </Pressable>
          <Pressable
            onPress={dropSpan}
            style={({ pressed }) => [
              styles.spanChip,
              { backgroundColor: c.a100 },
              pressed && { backgroundColor: c.a200 },
            ]}
          >
            <Text style={[styles.spanChipText, { color: c.a700 }]}>Delete</Text>
          </Pressable>
          <Pressable
            onPress={() => setSpan(null)}
            style={({ pressed }) => [styles.spanChip, pressed && { backgroundColor: c.n300 }]}
          >
            <Text style={styles.spanChipText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      {slash !== null ? (
        <SlashMenu
          hits={slashHits(slash)}
          onPick={pickSlash}
          bottom={panelBottom}
          at={spot}
          active={pick}
          onHover={setPick}
        />
      ) : ranged ? (
        <MarkBar onMark={applyMark} bottom={panelBottom} active={active} />
      ) : (
        <MentionPicker
          hits={hits}
          onPick={pickMention}
          bottom={panelBottom}
          active={Math.min(mentionPick, hits.length - 1)}
          onHover={setMentionPick}
        />
      )}
    </View>
  );
}

function TableButton({
  label,
  onPress,
  disabled,
  tone = 'quiet',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'quiet' | 'accent';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tableChip,
        tone === 'accent' && { backgroundColor: c.a100 },
        pressed && { backgroundColor: tone === 'accent' ? c.a200 : c.n300 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.tableChipText, tone === 'accent' && { color: c.a700 }]}>{label}</Text>
    </Pressable>
  );
}

/** Bullet, number, letter or checkbox drawn beside the block, not inside it. */
function Prefix({
  block,
  marker,
  onToggle,
}: {
  block: Block;
  /** The counted marker for a numbered or lettered item, "3." or "c.". */
  marker: string;
  onToggle: () => void;
}) {
  if (block.kind === 'bullet') return <Text style={styles.bullet}>•</Text>;
  if (COUNTED.includes(block.kind)) return <Text style={styles.number}>{marker}</Text>;
  if (block.kind === 'todo') {
    return (
      <Pressable onPress={onToggle} hitSlop={8} style={[styles.box, block.done && styles.boxOn]}>
        {block.done ? <Text style={styles.tick}>✓</Text> : null}
      </Pressable>
    );
  }
  return null;
}

const SLASH_KIND: Record<string, BlockKind | undefined> = {
  table: 'table',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  bullet: 'bullet',
  number: 'number',
  alpha: 'alpha',
  todo: 'todo',
  quote: 'quote',
  code: 'fence',
  rule: 'rule',
};

const PLACEHOLDER: Partial<Record<BlockKind, string>> = {
  p: 'Write, / for a block, @ to link a note',
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  h4: 'Heading',
  quote: 'Quote',
  bullet: 'List item',
  number: 'List item',
  alpha: 'List item',
  todo: 'To do',
};

/** Each block kind is set the same whether or not it holds the caret. */
const FIELD: Partial<Record<BlockKind, object>> = {
  h1: { fontFamily: f.head, fontSize: 23, lineHeight: 31, color: c.text },
  h2: { fontFamily: f.head, fontSize: 19, lineHeight: 27, color: c.text },
  h3: { fontFamily: f.b800, fontSize: 15.5, lineHeight: 24, color: c.text },
  h4: { fontFamily: f.b800, fontSize: 13.5, lineHeight: 22, letterSpacing: 0.3, color: c.n700 },
  quote: { fontFamily: f.b400, fontSize: 14.5, lineHeight: 23, color: c.g800 },
};

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editingPill: { backgroundColor: c.a100, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  editingText: {
    fontFamily: f.b800,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: c.a700,
  },
  done: { backgroundColor: c.accent, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18 },
  doneText: { fontFamily: f.b700, fontSize: 13, color: c.paper },
  title: { fontFamily: f.head, color: c.text, paddingVertical: 2 },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  quoteRow: {
    backgroundColor: c.g100,
    borderLeftWidth: 3,
    borderLeftColor: c.g400,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  fieldText: { fontFamily: f.b400, fontSize: 15, lineHeight: 25, color: c.n900 },

  tableBlock: { marginVertical: 4 },
  tableRowWrap: { flexDirection: 'row', alignItems: 'stretch' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: c.n300 },
  td: { width: 148, paddingVertical: 7, paddingHorizontal: 10, justifyContent: 'center' },
  tdDivider: { borderRightWidth: 1, borderColor: c.n300 },
  tdHead: { backgroundColor: c.n100 },
  tdOn: { backgroundColor: c.a100 },
  cellText: { fontFamily: f.b400, fontSize: 13.5, lineHeight: 21, color: c.n900 },
  cellHead: { fontFamily: f.b800, fontSize: 12.5, color: c.n800 },
  edgeCol: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderColor: c.n300,
  },
  edgeRow: { height: 22, alignItems: 'center', justifyContent: 'center' },
  edgeOn: { backgroundColor: c.a100 },
  edgeText: { fontFamily: f.b700, fontSize: 14, color: c.n500 },
  tableBar: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  tableChip: {
    backgroundColor: c.n200,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  tableChipText: { fontFamily: f.b700, fontSize: 11.5, color: c.n700 },

  fenceRow: { backgroundColor: c.n200, borderRadius: 18, paddingVertical: 11, paddingHorizontal: 14, gap: 6 },
  lang: { fontFamily: f.b700, fontSize: 11.5, color: c.n700, padding: 0 },
  code: {
    fontFamily: f.mono,
    fontSize: 13,
    lineHeight: 21,
    color: c.n900,
    padding: 0,
    minHeight: 42,
    textAlignVertical: 'top',
  },

  bullet: { fontFamily: f.b700, fontSize: 15, lineHeight: 25, color: c.a600, width: 12 },
  number: { fontFamily: f.b700, fontSize: 14, lineHeight: 25, color: c.a600, minWidth: 18 },
  box: {
    width: 17,
    height: 17,
    marginTop: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: c.n400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: c.g500, borderColor: c.g600 },
  tick: { fontFamily: f.b800, fontSize: 11, lineHeight: 14, color: c.paper },

  // The same wash the browser paints over selected text, so taking a line and
  // taking five read as one thing.
  held: { backgroundColor: SELECTION.bg, borderRadius: 10 },
  spanBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.paper,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    zIndex: 9,
    ...shadow.lg,
  },
  spanCount: { flex: 1, fontFamily: f.b700, fontSize: 12.5, color: c.n700 },
  spanChip: { backgroundColor: c.n200, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  spanChipText: { fontFamily: f.b700, fontSize: 12.5, color: c.n800 },

  ruleRow: { paddingVertical: 10 },
  rule: { height: 1, backgroundColor: c.n300 },

  addBlock: { alignSelf: 'flex-start', paddingVertical: 8 },
  addBlockText: { fontFamily: f.b700, fontSize: 12.5, color: c.n500 },
  hint: { fontFamily: f.b400, fontSize: 12, lineHeight: 19, color: c.n500, marginTop: 8 },
});
