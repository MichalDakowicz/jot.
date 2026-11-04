import React from 'react';

export type TiptapNote = { id: string; title: string; nbName: string };

export type TiptapEditorProps = {
  /** The note's markdown. The editor owns the text from here; it is read again only when it changes elsewhere. */
  markdown: string;
  /** Titles of the notes an @ can link, so a typed @Title opens as a mention. */
  notes: TiptapNote[];
  onChange: (markdown: string) => void;
};

/**
 * The web editor. Phones keep the native blocks in app/(main)/editor/[id].tsx,
 * so this half is never rendered; the real one is TiptapEditor.web.tsx.
 */
export function TiptapEditor(_props: TiptapEditorProps) {
  return null;
}
