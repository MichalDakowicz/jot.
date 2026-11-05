import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Annotation, EditorState, type Extension, type StateEffect } from '@codemirror/state';
import {
  drawSelection, EditorView, highlightActiveLineGutter, keymap, lineNumbers,
} from '@codemirror/view';
import React, { useEffect, useRef } from 'react';

import type { Mentionable } from '@jot/core/markdown';

import { caretLine } from './caretLine';
import { completions, formatKeys } from './commands';
import { editorMenu } from './editorMenu';
import { embeds } from './embeds';
import { compactFind } from './findPanel';
import { focusOnly } from './focusOnly';
import { editorShortcuts } from './shortcuts';
import { liveMarkdown, setMentions } from './livemd';
import { alignedTables } from './tables';
import { noteHeadings } from './title';

/** Marks a document swapped in from elsewhere, so it is not reported back as an edit. */
const incoming = Annotation.define<boolean>();

type Props = {
  value: string;
  /** The whole document, with the state it came from for anything tracked beside the text. */
  onChange: (doc: string, state: EditorState) => void;
  /** Added once, when the editor is made. */
  extensions?: Extension[];
  /** Sent along with a copy that arrived from elsewhere, so tracked state can be put back on it. */
  incomingEffects?: () => StateEffect<unknown>[];
  /** Where the caret starts, when it should not start at the top. */
  startAt?: number;
  mentions: Mentionable[];
  onMention: (noteId: string) => void;
  /** Every update that moves the caret, the text or the scroll position. */
  onView?: (view: EditorView) => void;
  autoFocus?: boolean;
};

/** A markdown source document, every note opening with its "# " title, with a line-number gutter. */
export function Editor({ value, onChange, mentions, onMention, onView, autoFocus, extensions = [], incomingEffects, startAt }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, onMention, onView, incomingEffects });
  latest.current = { onChange, onMention, onView, incomingEffects };
  /**
   * Documents this editor reported and has not seen come back yet. Typing
   * outruns rendering, so the page can hand back an older keystroke's copy
   * after a newer one was typed; any of these is our own echo, not news.
   */
  const emitted = useRef<string[]>([value]);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          caretLine,
          drawSelection(),
          history(),
          closeBrackets(),
          highlightSelectionMatches(),
          compactFind,
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage }),
          liveMarkdown((id) => latest.current.onMention(id)),
          noteHeadings,
          ...extensions,
          embeds,
          alignedTables,
          focusOnly,
          editorMenu,
          editorShortcuts,
          completions,
          formatKeys,
          keymap.of([indentWithTab, ...closeBracketsKeymap, ...completionKeymap, ...searchKeymap, ...historyKeymap, ...defaultKeymap]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((tr) => tr.annotation(incoming))) {
              const doc = u.state.doc.toString();
              emitted.current = [...emitted.current.slice(-49), doc];
              latest.current.onChange(doc, u.state);
            }
            if (u.docChanged || u.selectionSet || u.viewportChanged || u.geometryChanged) latest.current.onView?.(u.view);
          }),
          EditorView.domEventHandlers({ scroll: (_e, v) => latest.current.onView?.(v) }),
        ],
      }),
    });
    view.current = v;
    if (startAt !== undefined) {
      const at = Math.min(startAt, v.state.doc.length);
      v.dispatch({ selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: at === v.state.doc.length ? 'end' : 'start', yMargin: 64 }) });
    }
    if (autoFocus) v.focus();
    latest.current.onView?.(v);
    return () => v.destroy();
    // The view is made once per document; the page remounts it with a key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: setMentions.of(mentions) });
  }, [mentions]);

  // A newer copy from another device; our own echo is skipped so the caret never jumps.
  useEffect(() => {
    const v = view.current;
    if (!v || value === v.state.doc.toString()) return;
    const echo = emitted.current.indexOf(value);
    if (echo !== -1) {
      emitted.current = emitted.current.slice(echo);
      return;
    }
    emitted.current = [value];
    const head = Math.min(v.state.selection.main.head, value.length);
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: value },
      selection: { anchor: head },
      effects: latest.current.incomingEffects?.() ?? [],
      annotations: incoming.of(true),
    });
  }, [value]);

  return <div className="editor" ref={host} />;
}
