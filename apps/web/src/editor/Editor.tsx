import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import {
  drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder,
} from '@codemirror/view';
import React, { useEffect, useRef } from 'react';

import type { Mentionable } from '@jot/core/markdown';

import { completions, formatKeys } from './commands';
import { embeds } from './embeds';
import { liveMarkdown, setMentions } from './livemd';

type Props = {
  value: string;
  onChange: (body: string) => void;
  mentions: Mentionable[];
  onMention: (noteId: string) => void;
  /** Every update that moves the caret, the text or the scroll position. */
  onView?: (view: EditorView) => void;
  autoFocus?: boolean;
};

/** The note body as a markdown source editor with a line-number gutter. */
export function Editor({ value, onChange, mentions, onMention, onView, autoFocus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, onMention, onView });
  latest.current = { onChange, onMention, onView };
  /** The body this editor last reported, to tell our own echo from a change made elsewhere. */
  const emitted = useRef(value);

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
          embeds,
          completions,
          placeholder('Start writing. # for a heading, @ to link a note, / for more.'),
          formatKeys,
          keymap.of([indentWithTab, ...closeBracketsKeymap, ...completionKeymap, ...searchKeymap, ...historyKeymap, ...defaultKeymap]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              emitted.current = u.state.doc.toString();
              latest.current.onChange(emitted.current);
            }
            if (u.docChanged || u.selectionSet || u.viewportChanged || u.geometryChanged) latest.current.onView?.(u.view);
          }),
          EditorView.domEventHandlers({ scroll: (_e, v) => latest.current.onView?.(v) }),
        ],
      }),
    });
    view.current = v;
    if (autoFocus) v.focus();
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
    if (!v || value === emitted.current || value === v.state.doc.toString()) return;
    emitted.current = value;
    const head = Math.min(v.state.selection.main.head, value.length);
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, selection: { anchor: head } });
  }, [value]);

  return <div className="editor" ref={host} />;
}
