import { StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';

import { embedOf, type Embed } from '@jot/core/embed';

/** Draws what a line embeds right under it; the line itself stays editable source. */
class EmbedWidget extends WidgetType {
  constructor(readonly embed: Embed) {
    super();
  }

  eq(other: EmbedWidget) {
    return JSON.stringify(other.embed) === JSON.stringify(this.embed);
  }

  toDOM() {
    const box = document.createElement('div');
    box.className = `md-embed md-embed-${this.embed.kind}`;
    box.contentEditable = 'false';
    const e = this.embed;
    if (e.kind === 'image') {
      const img = document.createElement('img');
      img.src = e.src;
      img.alt = e.alt;
      img.loading = 'lazy';
      box.append(img);
      if (e.alt) {
        const cap = document.createElement('span');
        cap.className = 'md-embed-caption';
        cap.textContent = e.alt;
        box.append(cap);
      }
    } else if (e.kind === 'video') {
      const frame = document.createElement('iframe');
      frame.src = e.src;
      frame.title = 'Video';
      frame.loading = 'lazy';
      frame.allow = 'encrypted-media; picture-in-picture; fullscreen';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      box.append(frame);
    } else {
      const a = document.createElement('a');
      a.href = e.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const host = document.createElement('span');
      host.className = 'md-embed-host';
      host.textContent = e.host;
      const path = document.createElement('span');
      path.className = 'md-embed-path';
      path.textContent = e.path || '/';
      a.append(host, path);
      box.append(a);
    }
    return box;
  }

  ignoreEvent() {
    return true;
  }
}

function build(state: EditorState): DecorationSet {
  const ranges = [];
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (!line.text.includes('http')) continue;
    const embed = embedOf(line.text);
    if (embed) ranges.push(Decoration.widget({ widget: new EmbedWidget(embed), block: true, side: 1 }).range(line.to));
  }
  return Decoration.set(ranges);
}

export const embeds: Extension = StateField.define<DecorationSet>({
  create: build,
  update: (value, tr) => (tr.docChanged ? build(tr.state) : value),
  provide: (field) => EditorView.decorations.from(field),
});
