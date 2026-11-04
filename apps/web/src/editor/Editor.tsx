import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Annotation, EditorState } from '@codemirror/state';
import {
  drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers,
} from '@codemirror/view';
import React, { useEffect, useRef } from 'react';

import type { Mentionable } from '@jot/core/markdown';

import { completions, formatKeys } from './commands';
import { embeds } from './embeds';
import { liveMarkdown, setMentions } from './livemd';
import { titleLine } from './title';

/** Marks a document swapped in from elsewhere, so it is not reported back as an edit. */
const incoming = Annotation.define<boolean>();

type Props = {
  value: string;
  /** The whole document, title line included. */
  onChange: (doc: string) => void;
  mentions: Mentionable[];
  onMention: (noteId: string) => void;
  /** Every update that moves the caret, the text or the scroll position. */
  onView?: (view: EditorView) => void;
  autoFocus?: boolean;
};

/** The note as one markdown source document, title first, with a line-number gutter. */
export function Editor({ value, onChange, mentions, onMention, onView, autoFocus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, onMention, onView });
  latest.current = { onChange, onMention, onView };
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
          highlightActiveLine(),
          drawSelection(),
          history(),
          closeBrackets(),
          highlightSelectionMatches(),
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage }),
          liveMarkdown((id) => latest.current.onMention(id)),
          titleLine,
          embeds,
          completions,
          formatKeys,
          keymap.of([indentWithTab, ...closeBracketsKeymap, ...completionKeymap, ...searchKeymap, ...historyKeymap, ...defaultKeymap]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((tr) => tr.annotation(incoming))) {
              const doc = u.state.doc.toString();
              emitted.current = [...emitted.current.slice(-49), doc];
              latest.current.onChange(doc);
            }
            if (u.docChanged || u.selectionSet || u.viewportChanged || u.geometryChanged) latest.current.onView?.(u.view);
          }),
          EditorView.domEventHandlers({ scroll: (_e, v) => latest.current.onView?.(v) }),
        ],
      }),
    });
    view.current = v;
    // A new note starts with the caret in its title.
    if (autoFocus) {
      v.focus();
      v.dispatch({ selection: { anchor: v.state.doc.line(1).to } });
    }
    latest.current.onView?.(v);
    return () => v.destroy();
    // The view is made once per note; the page remounts it with a key.
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
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, selection: { anchor: head }, annotations: incoming.of(true) });
  }, [value]);

  return <div className="editor" ref={host} />;
}
