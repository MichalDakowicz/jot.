import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextInputKeyPressEventData,
  type TextStyle,
} from 'react-native';

import { barRange } from '../lib/field';
import { editOf, tabText } from '../lib/typing';
import { useLiveBlock } from './useLiveBlock';
import type { Marks } from '../lib/rich';
import { c, f } from '../theme/tokens';

export type Range = { start: number; end: number };

/** What the editor can ask of the focused field. */
export type LiveFieldHandle = {
  toggleMark: (kind: keyof Marks, value?: true | string) => void;
  replaceMention: (start: number, end: number, title: string) => void;
};

export type LiveFieldProps = {
  /** The block as markdown; the field shows it as annotated text. */
  text: string;
  mentions: string[];
  /** Caret the editor wants, in plain-text offsets. */
  selection: Range | null;
  autoFocus?: boolean;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  onChangeText: (md: string) => void;
  /** Plain text and caret, for the block markers and the two pickers. */
  onContext: (plain: string, caret: number) => void;
  onSelection: (range: Range, marks: Marks) => void;
  /** Return: the block split in two, already markdown. */
  onEnter: (head: string, tail: string) => void;
  /**
   * More than one line pasted in: the block either side of the caret, already
   * markdown, and the pasted text between them. A field that leaves this out
   * gets the paste on one line, which is what a table cell wants.
   */
  onPasteText?: (head: string, text: string, tail: string) => void;
  onBackspaceAtStart: () => void;
  onFocus: () => void;
  /**
   * Tab: nest a list item, or step to the next table cell. Returns whether the
   * key was taken — a block with nothing to nest or step to leaves it, and the
   * field puts a tab in the text instead.
   */
  onTab?: (back: boolean) => boolean;
  /** Up and down: step between table rows, or move a menu's highlight. */
  onArrow?: (dir: -1 | 1) => void;
  /**
   * Where the caret is on screen, for a menu that follows it. React Native has
   * no caret geometry, so the native field reports the foot of the block it is
   * in and a menu opens under that line.
   */
  onCaretSpot?: (spot: { x: number; y: number; height: number } | null) => void;
  /**
   * Up or down pressed on the first or last line of the block: the caret is
   * leaving, so the editor moves it to the block above or below. `x` is where
   * the caret was drawn, when it could be measured, so the column carries over.
   */
  onCross?: (dir: -1 | 1, x?: number) => void;
  /** Left off the head of the block, or right off its end. */
  onStep?: (dir: -1 | 1) => void;
  /** Delete at the end of the block: the one below comes up into it. */
  onDeleteAtEnd?: () => void;
  /**
   * The caret arriving from the block above (`dir` 1) or below (-1): it lands
   * on the near line as close under `x` as that line reaches. Web only.
   */
  aim?: { x: number; dir: -1 | 1 } | null;
  /** Shift with up or down: the selection is growing past this block. */
  onSelectAcross?: (dir: -1 | 1) => void;
  /** Marks this field's element, so a selection can be traced back to a block. */
  blockId?: string;
};

/**
 * One block, edited as rich text: markdown delimiters are consumed and the text
 * carries the annotation, so `**bold**` goes bold the moment the pair closes
 * and the asterisks are gone.
 *
 * The runs are drawn with `Text` children, the only way React Native styles
 * parts of an editable field. Android rejects `value` together with children
 * ("Cannot specify both value and children"), so the field is uncontrolled and
 * a remount is what puts outside changes on screen.
 *
 * The web build uses LiveField.web.tsx, where a textarea cannot do this at all.
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
    onPasteText,
    onBackspaceAtStart,
    onFocus,
    onTab,
    onCaretSpot,
  },
  ref,
) {
  const block = useLiveBlock(text, mentions, onChangeText);
  const shown = useRef(block.plain);
  const caret = useRef(0);
  /** The far end of the selection, which a keystroke replaces along with it. */
  const caretEnd = useRef(0);
  const [generation, setGeneration] = useState(0);
  const box = useRef<TextInput | null>(null);
  /**
   * The caret has to be handed back to the field after every keystroke.
   * Restyling the runs replaces the field's spannable text, and Android puts the
   * caret at offset 0 when that happens unless it is told otherwise — which is
   * what "the cursor is locked at the start" looks like.
   */
  const [held, setHeld] = useState<Range | null>({ start: 0, end: 0 });

  // Text that did not come from this field needs a fresh mount to show up.
  useEffect(() => {
    if (block.plain === shown.current) return;
    shown.current = block.plain;
    setGeneration((g) => g + 1);
  }, [block.plain]);

  // A caret the editor asks for takes over from the one being held.
  useEffect(() => {
    if (selection) setHeld(selection);
  }, [selection]);

  useImperativeHandle(ref, () => ({
    toggleMark(kind, value) {
      // The whole selection, not the caret at its head: from one offset to the
      // same one is nothing, and the bar did nothing.
      const range = barRange({ start: caret.current, end: caretEnd.current }, null, block.plain.length);
      block.toggle(range.start, range.end, kind, value ?? true);
    },
    replaceMention(start, end, title) {
      caret.current = block.mention(start, end, title);
      caretEnd.current = caret.current;
      setHeld({ start: caret.current, end: caret.current });
    },
  }));

  function handleChange(next: string) {
    const nl = next.indexOf('\n');
    if (nl >= 0) {
      // A field hands back its whole text and never says how it got there, so
      // what arrived has to be read off it: one newline is Return, and a run of
      // lines is a paste the editor turns into blocks of its own.
      const edit = editOf(shown.current, next);
      if (onPasteText && edit.put.includes('\n') && edit.put !== '\n') {
        const split = block.split(edit.start, edit.end);
        onPasteText(split.head, edit.put, split.tail);
        return;
      }

      const split = block.split(nl);
      shown.current = next.slice(0, nl) + next.slice(nl + 1);
      onEnter(split.head, split.tail);
      return;
    }

    // A run of characters carrying markup arrived at once, which is a paste and
    // not typing: it is read whole, since the live shortcut only closes the one
    // pair at the caret. Anything else stays on the typing path, where the
    // arrow and quote polish lives.
    const edit = editOf(shown.current, next);
    if (edit.put.length > 1 && MARKUP.test(edit.put)) {
      const pasted = block.paste(edit.start, edit.end, edit.put);
      shown.current = pasted.plain;
      caret.current = pasted.caret;
      caretEnd.current = pasted.caret;
      setHeld({ start: pasted.caret, end: pasted.caret });
      onContext(pasted.plain, pasted.caret);
      report();
      return;
    }

    // `onChangeText` comes before `onSelectionChange`, so the caret held is the
    // one from before the key: whatever was selected went, and the change ends
    // that far past the selection's far end.
    const typed = block.type(next, caretEnd.current + next.length - shown.current.length);
    shown.current = typed.plain;
    caret.current = typed.caret;
    caretEnd.current = typed.caret;
    setHeld({ start: typed.caret, end: typed.caret });
    onContext(typed.plain, typed.caret);
    report();
  }

  /** The foot of this block, in window coordinates. */
  function report() {
    if (!onCaretSpot) return;
    box.current?.measureInWindow((x, y, _w, h) => onCaretSpot({ x, y: y + h - 4, height: 4 }));
  }

  function handleKey(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    const key = e.nativeEvent.key;
    // Only a hardware keyboard sends Tab; soft keyboards have none to send.
    if (key === 'Tab') {
      if (onTab?.(false)) return;
      const put = tabText(block.plain, caret.current, caret.current, false);
      if (!put) return;
      const typed = block.type(put.text, put.caret);
      shown.current = typed.plain;
      caret.current = typed.caret;
      caretEnd.current = typed.caret;
      setHeld({ start: typed.caret, end: typed.caret });
      onContext(typed.plain, typed.caret);
      return;
    }
    if (key === 'Backspace' && caret.current === 0) onBackspaceAtStart();
  }

  return (
    <TextInput
      ref={box}
      key={generation}
      multiline
      autoFocus={autoFocus}
      spellCheck={false}
      selection={selection ?? held ?? undefined}
      onChangeText={handleChange}
      onSelectionChange={(e) => {
        const now = e.nativeEvent.selection;
        block.moved(now.start);
        caret.current = now.start;
        caretEnd.current = now.end;
        setHeld(now);
        onSelection(now, block.marks(now.start, now.end));
      }}
      onKeyPress={handleKey}
      onFocus={() => {
        onFocus();
        report();
      }}
      placeholder={placeholder}
      placeholderTextColor={c.n400}
      // Accent, not the selection wash: this colours the caret and the handles
      // as well, and the wash is far too light to find a caret in.
      selectionColor={c.accent}
      style={[styles.field, style]}
    >
      {block.runs.map((run, i) => (
        <Text key={i} style={styleOf(run.marks)}>
          {run.text}
        </Text>
      ))}
    </TextInput>
  );
});

/** Delimiters a paste can carry, so plain text keeps the typing path. */
const MARKUP = new RegExp('[*~=`\[]');

/** Annotations as text styles. */
export function styleOf(marks: Marks): TextStyle[] {
  const out: TextStyle[] = [];
  if (marks.bold) out.push({ fontFamily: f.b800 });
  if (marks.em) out.push({ fontStyle: 'italic' });
  if (marks.strike) out.push({ textDecorationLine: 'line-through' });
  if (marks.mark) out.push({ backgroundColor: c.a200, color: c.a900 });
  if (marks.code) out.push({ fontFamily: f.mono, fontSize: 13.5, color: c.a800 });
  if (marks.mention) out.push({ fontFamily: f.b600, color: c.g800 });
  if (marks.link) out.push({ fontFamily: f.b600, color: c.a700, textDecorationLine: 'underline' });
  return out;
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    fontFamily: f.b400,
    fontSize: 15,
    lineHeight: 25,
    color: c.n900,
    padding: 0,
    textAlignVertical: 'top',
  },
});
