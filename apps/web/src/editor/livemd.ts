import { syntaxTree } from '@codemirror/language';
import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';

import type { Mentionable } from '@jot/core/markdown';

/**
 * Markdown that sets itself without hiding itself: a heading line is set as a
 * heading and its "#" stays, muted, in front; bold is bold between faint
 * stars. What you typed is always what is stored.
 */

const line = (cls: string) => Decoration.line({ class: cls });
const mark = (cls: string) => Decoration.mark({ class: cls });

const SYNTAX = mark('md-syntax');
const LINES: Record<string, Decoration> = {
  ATXHeading1: line('md-h1'),
  ATXHeading2: line('md-h2'),
  ATXHeading3: line('md-h3'),
  ATXHeading4: line('md-h4'),
  ATXHeading5: line('md-h4'),
  ATXHeading6: line('md-h4'),
  Blockquote: line('md-quote'),
  FencedCode: line('md-fence'),
  HorizontalRule: line('md-rule'),
  Table: line('md-table'),
};
const SPANS: Record<string, Decoration> = {
  StrongEmphasis: mark('md-strong'),
  Emphasis: mark('md-em'),
  InlineCode: mark('md-code'),
  Strikethrough: mark('md-strike'),
  Link: mark('md-link'),
  URL: mark('md-url'),
  TaskMarker: mark('md-task'),
  ListMark: mark('md-list'),
};
const MARKS = new Set(['HeaderMark', 'EmphasisMark', 'CodeMark', 'LinkMark', 'QuoteMark', 'StrikethroughMark', 'CodeInfo', 'TableDelimiter']);

/** The note titles an @ can point at, kept beside the document. */
export const setMentions = StateEffect.define<Mentionable[]>();
export const mentionsField = StateField.define<Mentionable[]>({
  create: () => [],
  update: (value, tr) => tr.effects.reduce((v, e) => (e.is(setMentions) ? e.value : v), value),
});

const HIGHLIGHT = /==(?=\S)(.+?\S)==/g;

function build(view: EditorView): DecorationSet {
  const found: { from: number; to: number; deco: Decoration }[] = [];
  const doc = view.state.doc;
  // Longest first, so "@Cell biology" wins over "@Cell".
  const titles = [...view.state.field(mentionsField)].filter((m) => m.title).sort((a, b) => b.title.length - a.title.length);

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from, to,
      enter(node) {
        const lineDeco = LINES[node.name];
        if (lineDeco) {
          for (let pos = node.from; pos <= node.to;) {
            const l = doc.lineAt(pos);
            found.push({ from: l.from, to: l.from, deco: lineDeco });
            pos = l.to + 1;
          }
        }
        if (SPANS[node.name] && node.to > node.from) found.push({ from: node.from, to: node.to, deco: SPANS[node.name] });
        if (MARKS.has(node.name) && node.to > node.from) {
          // The space after "#" belongs with the mark, so the heading text starts clean.
          const end = node.name === 'HeaderMark' && doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to;
          found.push({ from: node.from, to: end, deco: SYNTAX });
        }
      },
    });

    const text = doc.sliceString(from, to);
    for (const m of text.matchAll(HIGHLIGHT)) {
      const start = from + m.index!;
      found.push({ from: start, to: start + 2, deco: SYNTAX });
      found.push({ from: start + 2, to: start + m[0].length - 2, deco: mark('md-mark') });
      found.push({ from: start + m[0].length - 2, to: start + m[0].length, deco: SYNTAX });
    }

    for (let i = text.indexOf('@'); i !== -1; i = text.indexOf('@', i + 1)) {
      const hit = titles.find((t) => text.startsWith(t.title, i + 1));
      if (!hit) continue;
      const start = from + i;
      found.push({
        from: start, to: start + hit.title.length + 1,
        deco: Decoration.mark({ class: 'md-mention', attributes: { 'data-note': hit.id, title: `${hit.title} · Ctrl/⌘-click to open` } }),
      });
      i += hit.title.length;
    }
  }

  return Decoration.set(found.map((f) => f.deco.range(f.from, f.to)), true);
}

const decorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      const mentionsChanged = u.transactions.some((tr) => tr.effects.some((e) => e.is(setMentions)));
      if (u.docChanged || u.viewportChanged || mentionsChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
        this.decorations = build(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/** Ctrl/⌘-click opens a mention; a click on "[ ]" ticks the box. */
function clicks(onMention: (id: string) => void): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const target = event.target as HTMLElement;
      const mention = target.closest<HTMLElement>('.md-mention');
      if (mention && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onMention(mention.dataset.note!);
        return true;
      }
      if (target.closest('.md-task')) {
        const pos = view.posAtDOM(target);
        const box = view.state.doc.sliceString(pos, pos + 3);
        if (/^\[[ xX]\]$/.test(box)) {
          event.preventDefault();
          view.dispatch({ changes: { from: pos + 1, to: pos + 2, insert: box[1] === ' ' ? 'x' : ' ' } });
          return true;
        }
      }
      return false;
    },
  });
}

export function liveMarkdown(onMention: (id: string) => void): Extension {
  return [mentionsField, decorations, clicks(onMention)];
}
