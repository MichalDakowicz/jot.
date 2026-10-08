import { Extension, InputRule, Mark, mergeAttributes, wrappingInputRule } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { OrderedList, TaskItem, TaskList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { PluginKey } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import Suggestion from '@tiptap/suggestion';
import type { Editor } from '@tiptap/core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { countOf, plural } from '../lib/count';
import { letterIndex } from '../lib/doc';
import { docToPM, pmToDoc, type PMNode } from '../lib/tiptapDoc';
import { c, f } from '../theme/tokens';
import type { TiptapEditorProps } from './TiptapEditor';

/* ───────────────────────────────────────────── extensions of our own */

/** A link to another note. It is derived from the text on load, so the mark carries nothing. */
const Mention = Mark.create({
  name: 'mention',
  inclusive: false,
  parseHTML: () => [{ tag: 'span[data-mention]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-mention': '', class: 'mention' }), 0],
});

/**
 * The dialect writes "a." and "b." as a list, which an <ol> gets from its type.
 * Typing "a. " at the head of a line starts one, the way "1. " starts a numbered list.
 */
const LetteredList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: '1',
        parseHTML: (el: HTMLElement) => el.getAttribute('type') || '1',
        renderHTML: (attrs: Record<string, unknown>) => (attrs.type && attrs.type !== '1' ? { type: String(attrs.type) } : {}),
      },
    };
  },
  addInputRules() {
    return [
      ...(this.parent?.() ?? []),
      wrappingInputRule({
        find: /^([a-z])\.\s$/,
        type: this.type,
        getAttributes: (m) => ({ type: 'a', start: letterIndex(m[1]) }),
      }),
    ];
  },
});

/**
 * Tab never leaves the editor. Lists nest and tables step cells on their own;
 * this is what is left, and it matches the phone: a tab in plain text (Shift
 * takes one back out), two spaces in code, and nothing at all where there is
 * nothing to nest, rather than the browser moving focus to the next control.
 */
const TabKey = Extension.create({
  name: 'tabKey',
  // After the list and table handlers, which return true when they act.
  priority: 10,
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive('codeBlock')) {
          editor.commands.insertContent({ type: 'text', text: '  ' });
        } else if (!editor.isActive('listItem') && !editor.isActive('taskItem') && !editor.isActive('table')) {
          editor.commands.insertContent({ type: 'text', text: '\t' });
        }
        return true;
      },
      'Shift-Tab': ({ editor }) => {
        const { $from } = editor.state.selection;
        if (!$from.parent.isTextblock) return true;
        const text = $from.parent.textContent;
        const base = $from.start();
        if (editor.isActive('codeBlock')) {
          // The line pulled two spaces back.
          const head = text.lastIndexOf('\n', Math.max(0, $from.parentOffset - 1)) + 1;
          const space = /^ {1,2}/.exec(text.slice(head))?.[0] ?? '';
          if (space) editor.commands.deleteRange({ from: base + head, to: base + head + space.length });
          return true;
        }
        // Two spaces come out as readily as a tab: pasted text is indented that way.
        const cut = /(\t| {1,2})$/.exec(text.slice(0, $from.parentOffset))?.[0];
        if (cut) editor.commands.deleteRange({ from: $from.pos - cut.length, to: $from.pos });
        return true;
      },
    };
  },
});

/**
 * "- [ ] " is how a to-do is written in markdown, and "- " has already made a
 * bullet by the time the box is typed. Turn that top-level bullet into the to-do.
 */
const TodoShortcut = Extension.create({
  name: 'todoShortcut',
  addInputRules() {
    return [
      new InputRule({
        find: /^\[( |x)?\]\s$/,
        handler: ({ state, range, match, chain }) => {
          const $from = state.doc.resolve(range.from);
          const inBullet = $from.depth === 3 && $from.node(-1).type.name === 'listItem' && $from.node(-2).type.name === 'bulletList';
          if (!inBullet) return null;
          const done = match[1] === 'x';
          chain().deleteRange(range).liftListItem('listItem').toggleTaskList().updateAttributes('taskItem', { checked: done }).run();
          return undefined;
        },
      }),
    ];
  },
});

type MenuItem = { key: string; label: string; hint: string; glyph: string; words: string; run: (editor: Editor) => void };

const BLOCKS: MenuItem[] = [
  { key: 'p', label: 'Text', hint: 'Plain paragraph', glyph: 'Aa', words: 'text paragraph plain', run: (e) => e.chain().focus().setParagraph().run() },
  { key: 'h1', label: 'Heading 1', hint: 'Big section title', glyph: 'H1', words: 'heading title h1', run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { key: 'h2', label: 'Heading 2', hint: 'Section title', glyph: 'H2', words: 'heading h2', run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { key: 'h3', label: 'Heading 3', hint: 'Small title', glyph: 'H3', words: 'heading h3', run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { key: 'h4', label: 'Heading 4', hint: 'Smallest title', glyph: 'H4', words: 'heading h4', run: (e) => e.chain().focus().setHeading({ level: 4 }).run() },
  { key: 'bullet', label: 'Bulleted list', hint: 'A list of points', glyph: '•', words: 'bullet list unordered', run: (e) => e.chain().focus().toggleBulletList().run() },
  {
    key: 'number',
    label: 'Numbered list',
    hint: '1. 2. 3.',
    glyph: '1.',
    words: 'number ordered list',
    run: (e) => e.chain().focus().toggleOrderedList().updateAttributes('orderedList', { type: '1' }).run(),
  },
  {
    key: 'alpha',
    label: 'Lettered list',
    hint: 'a. b. c.',
    glyph: 'a.',
    words: 'letter alpha lettered list',
    run: (e) => e.chain().focus().toggleOrderedList().updateAttributes('orderedList', { type: 'a' }).run(),
  },
  { key: 'todo', label: 'To-do list', hint: 'Track tasks', glyph: '☐', words: 'todo task checkbox check', run: (e) => e.chain().focus().toggleTaskList().run() },
  { key: 'quote', label: 'Quote', hint: 'Set a passage apart', glyph: '❝', words: 'quote blockquote', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { key: 'code', label: 'Code', hint: 'A fenced block', glyph: '</>', words: 'code fence snippet', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { key: 'rule', label: 'Divider', hint: 'A line across', glyph: '—', words: 'divider rule line hr', run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    key: 'table',
    label: 'Table',
    hint: 'Rows and columns',
    glyph: '▦',
    words: 'table grid',
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(),
  },
];

/* ───────────────────────────────────────────── the floating menus */

type Rect = { left: number; top: number; bottom: number };
type Menu = {
  kind: 'slash' | 'mention';
  items: { key: string; label: string; hint: string; glyph: string }[];
  index: number;
  rect: Rect | null;
  pick: (at: number) => void;
};

/** What a Suggestion hands over while it is open. */
type SuggestionProps = {
  items: unknown[];
  command: (item: unknown) => void;
  clientRect?: (() => DOMRect | null) | null;
};

const rectOf = (props: SuggestionProps): Rect | null => {
  const r = props.clientRect?.();
  return r ? { left: r.left, top: r.top, bottom: r.bottom } : null;
};

/* ───────────────────────────────────────────── the editor */

export function TiptapEditor({ markdown, notes, onChange }: TiptapEditorProps) {
  const titles = useMemo(() => notes.map((n) => n.title), [notes]);
  const live = useRef({ notes, titles, onChange });
  live.current = { notes, titles, onChange };
  /** The markdown last handed out, so a save coming back is not read as an edit from elsewhere. */
  const sent = useRef(markdown);
  const editorRef = useRef<Editor | null>(null);

  const [menu, setMenu] = useState<Menu | null>(null);
  const menuRef = useRef<Menu | null>(null);
  const show = (next: Menu | null) => {
    menuRef.current = next;
    setMenu(next);
  };

  const [bar, setBar] = useState<{ left: number; top: number } | null>(null);

  const extensions = useMemo(() => {
    /** One Suggestion per trigger: "/" for blocks, "@" for a note. */
    const suggest = (
      name: string,
      char: string,
      items: (query: string) => { key: string; label: string; hint: string; glyph: string; item: unknown }[],
      apply: (editor: Editor, range: { from: number; to: number }, item: unknown) => void,
      spaces: boolean,
    ) =>
      Extension.create({
        name,
        addProseMirrorPlugins() {
          return [
            Suggestion({
              editor: this.editor,
              char,
              allowSpaces: spaces,
              pluginKey: new PluginKey(name),
              items: ({ query }) => items(query) as unknown[],
              command: ({ editor, range, props }) => apply(editor, range, props),
              render: () => {
                let current: SuggestionProps | null = null;
                const open = (props: SuggestionProps, keepAt: boolean) => {
                  current = props;
                  const rows = props.items as { key: string; label: string; hint: string; glyph: string; item: unknown }[];
                  if (!rows.length) {
                    show(null);
                    return;
                  }
                  const index = keepAt ? Math.min(menuRef.current?.index ?? 0, rows.length - 1) : 0;
                  show({
                    kind: name === 'slash' ? 'slash' : 'mention',
                    items: rows,
                    index,
                    rect: rectOf(props),
                    pick: (at) => current?.command(rows[at].item),
                  });
                };
                return {
                  onStart: (props: SuggestionProps) => open(props, false),
                  onUpdate: (props: SuggestionProps) => open(props, true),
                  onKeyDown: ({ event }: { event: KeyboardEvent }) => {
                    const m = menuRef.current;
                    if (!m || m.kind !== (name === 'slash' ? 'slash' : 'mention') || !m.items.length) return false;
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      const step = event.key === 'ArrowDown' ? 1 : -1;
                      show({ ...m, index: (m.index + step + m.items.length) % m.items.length });
                      return true;
                    }
                    if (event.key === 'Enter' || event.key === 'Tab') {
                      m.pick(m.index);
                      return true;
                    }
                    if (event.key === 'Escape') {
                      show(null);
                      return true;
                    }
                    return false;
                  },
                  onExit: () => show(null),
                };
              },
            }),
          ];
        },
      });

    return [
      StarterKit.configure({
        // The dialect has no underline, and a line is one line: no soft breaks.
        underline: false,
        hardBreak: false,
        trailingNode: false,
        orderedList: false,
        link: { openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      LetteredList,
      TabKey,
      TodoShortcut,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Mention,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : 'Write, or press / for blocks and @ to link a note'),
      }),
      suggest(
        'slash',
        '/',
        (q) =>
          BLOCKS.filter((b) => !q || b.label.toLowerCase().includes(q.toLowerCase()) || b.words.includes(q.toLowerCase())).map((b) => ({
            key: b.key,
            label: b.label,
            hint: b.hint,
            glyph: b.glyph,
            item: b,
          })),
        (editor, range, item) => {
          editor.chain().focus().deleteRange(range).run();
          (item as MenuItem).run(editor);
        },
        false,
      ),
      suggest(
        'mention-menu',
        '@',
        (q) =>
          live.current.notes
            .filter((n) => n.title.toLowerCase().includes(q.toLowerCase()))
            .slice(0, 6)
            .map((n) => ({ key: n.id, label: n.title, hint: n.nbName, glyph: '@', item: n })),
        (editor, range, item) => {
          const note = item as { title: string };
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: 'text', text: '@' + note.title, marks: [{ type: 'mention' }] },
              { type: 'text', text: ' ' },
            ])
            .run();
        },
        true,
      ),
    ];
  }, []);

  const editor = useEditor({
    extensions,
    content: docToPM(markdown, titles) as never,
    autofocus: 'end',
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'jot-pm', spellcheck: 'true' },
      // Markdown pasted as plain text lands as the blocks it describes, the
      // way it does on the phone. Anything with HTML on it is left to Tiptap.
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (event.clipboardData?.getData('text/html') || !/(^|\n)(#{1,4} |[-*] |\d+\. |> |```|\|)|\*\*|==|~~/.test(text)) {
          return false;
        }
        const doc = docToPM(text, live.current.titles);
        editorRef.current?.chain().focus().insertContent(doc.content as never).run();
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = pmToDoc(ed.getJSON() as PMNode);
      sent.current = md;
      live.current.onChange(md);
    },
    onSelectionUpdate: ({ editor: ed }) => placeBar(ed),
  });
  editorRef.current = editor;

  function placeBar(ed: Editor) {
    const { from, to, empty } = ed.state.selection;
    if (empty || !ed.isFocused || ed.isActive('codeBlock')) {
      setBar(null);
      return;
    }
    const a = ed.view.coordsAtPos(from);
    const b = ed.view.coordsAtPos(to);
    setBar({ left: (a.left + b.right) / 2, top: Math.min(a.top, b.top) });
  }

  // The note changed somewhere else — another device, the other editor — and it
  // is not this editor's own last save coming back.
  useEffect(() => {
    if (!editor || markdown === sent.current) return;
    sent.current = markdown;
    editor.commands.setContent(docToPM(markdown, live.current.titles) as never, { emitUpdate: false });
  }, [editor, markdown]);

  // A selection bar placed in the viewport stays put while the page scrolls.
  useEffect(() => {
    const hide = () => setBar(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, []);

  if (!editor) return null;

  const inTable = editor.isActive('table');

  // The count follows the selection: what is highlighted when something is,
  // the whole note otherwise.
  const { from, to, empty } = editor.state.selection;
  const doc = editor.state.doc;
  const counted = countOf(empty ? doc.textBetween(0, doc.content.size, '\n', '\n') : doc.textBetween(from, to, '\n', '\n'));

  return (
    <div
      className="jot-pm-wrap"
      // The editor fills the screen, so the blank space under the text is part
      // of it: a click there puts the caret at the end, as on a page.
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.jot-pm, .jot-bar, .jot-menu, .jot-tablebar, .jot-count')) {
          editor.commands.focus('end');
        }
      }}
    >
      <style>{CSS}</style>

      {inTable ? (
        <div className="jot-tablebar">
          <Btn label="Row below" onPress={() => editor.chain().focus().addRowAfter().run()} />
          <Btn label="Column right" onPress={() => editor.chain().focus().addColumnAfter().run()} />
          <Btn label="Delete row" onPress={() => editor.chain().focus().deleteRow().run()} />
          <Btn label="Delete column" onPress={() => editor.chain().focus().deleteColumn().run()} />
          <Btn label="Delete table" tone="danger" onPress={() => editor.chain().focus().deleteTable().run()} />
        </div>
      ) : null}

      <EditorContent editor={editor} />

      <div className="jot-count" data-selected={!empty} role="status">
        {empty ? null : <span className="jot-count-tag">Selected</span>}
        <span>{plural(counted.words, 'word')}</span>
        <span className="jot-count-dot">·</span>
        <span>{plural(counted.chars, 'character')}</span>
      </div>

      {bar ? (
        <OnBody>
          <div className="jot-bar" style={{ left: bar.left, top: bar.top }} onMouseDown={(e) => e.preventDefault()}>
            <Tool label="B" title="Bold" on={editor.isActive('bold')} onPress={() => editor.chain().focus().toggleBold().run()} strong />
            <Tool label="I" title="Italic" on={editor.isActive('italic')} onPress={() => editor.chain().focus().toggleItalic().run()} italic />
            <Tool label="S" title="Strikethrough" on={editor.isActive('strike')} onPress={() => editor.chain().focus().toggleStrike().run()} struck />
            <Tool label="==" title="Highlight" on={editor.isActive('highlight')} onPress={() => editor.chain().focus().toggleHighlight().run()} />
            <Tool label="</>" title="Code" on={editor.isActive('code')} onPress={() => editor.chain().focus().toggleCode().run()} />
            <Tool
              label="Link"
              title="Link"
              on={editor.isActive('link')}
              onPress={() => {
                if (editor.isActive('link')) {
                  editor.chain().focus().unsetLink().run();
                  return;
                }
                const href = window.prompt('Link to', 'https://');
                if (href) editor.chain().focus().setLink({ href }).run();
              }}
            />
          </div>
        </OnBody>
      ) : null}

      {menu ? (
        <OnBody>
          <Popup menu={menu} onHover={(at) => show({ ...menu, index: at })} />
        </OnBody>
      ) : null}
    </div>
  );
}

/* ───────────────────────────────────────────── small parts */

/**
 * The menus are placed from viewport coordinates with position: fixed, which
 * only means the viewport when no ancestor is transformed or clipping. The app's
 * panes are both, so a menu left in place lands a pane's width off and cut short.
 * On the body it is placed where the caret really is.
 */
function OnBody({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

function Popup({ menu, onHover }: { menu: Menu; onHover: (at: number) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rect = menu.rect;

  // Keep the row Return would take in view.
  useEffect(() => {
    ref.current?.querySelector('[data-on="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [menu.index]);

  if (!rect) return null;
  const below = window.innerHeight - rect.bottom > 280;
  const left = Math.min(rect.left, window.innerWidth - 300);
  const place = below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 };

  return (
    <div ref={ref} className="jot-menu" style={{ left, ...place }} onMouseDown={(e) => e.preventDefault()}>
      {menu.items.map((item, i) => (
        <div
          key={item.key}
          className="jot-menu-row"
          data-on={i === menu.index}
          onMouseEnter={() => onHover(i)}
          onClick={() => menu.pick(i)}
        >
          <span className="jot-menu-glyph">{item.glyph}</span>
          <span className="jot-menu-text">
            <span className="jot-menu-label">{item.label}</span>
            <span className="jot-menu-hint">{item.hint}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Tool(props: {
  label: string;
  title: string;
  on: boolean;
  onPress: () => void;
  strong?: boolean;
  italic?: boolean;
  struck?: boolean;
}) {
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      data-on={props.on}
      onClick={props.onPress}
      style={{
        fontWeight: props.strong ? 800 : 600,
        fontStyle: props.italic ? 'italic' : 'normal',
        textDecoration: props.struck ? 'line-through' : 'none',
      }}
    >
      {props.label}
    </button>
  );
}

function Btn({ label, onPress, tone }: { label: string; onPress: () => void; tone?: 'danger' }) {
  return (
    <button type="button" data-tone={tone} onMouseDown={(e) => e.preventDefault()} onClick={onPress}>
      {label}
    </button>
  );
}

/* ───────────────────────────────────────────── look */

const CSS = `
.jot-pm-wrap { position: relative; display: flex; flex-direction: column; flex: 1 0 auto; }
.jot-pm { tab-size: 4; outline: none; min-height: 120px; font-family: ${f.b400}, sans-serif; font-size: 15px; line-height: 25px; color: ${c.n800}; padding-bottom: 8px; caret-color: ${c.accent}; }
.jot-pm ::selection { background: ${c.a200}; }
.jot-pm p { margin: 0 0 4px; }
.jot-pm p.is-empty::before, .jot-pm h1.is-empty::before, .jot-pm h2.is-empty::before, .jot-pm h3.is-empty::before, .jot-pm h4.is-empty::before {
  content: attr(data-placeholder); color: ${c.n400}; float: left; height: 0; pointer-events: none;
}
.jot-pm h1, .jot-pm h2, .jot-pm h3, .jot-pm h4 { font-family: ${f.head}, serif; color: ${c.text}; margin: 14px 0 4px; font-weight: normal; }
.jot-pm h1 { font-size: 23px; line-height: 29px; }
.jot-pm h2 { font-size: 19px; line-height: 26px; }
.jot-pm h3 { font-size: 14.5px; line-height: 20px; font-family: ${f.b800}, sans-serif; }
.jot-pm h4 { font-size: 13px; line-height: 19px; font-family: ${f.b800}, sans-serif; color: ${c.n700}; }
.jot-pm strong { font-family: ${f.b700}, sans-serif; font-weight: 700; color: ${c.text}; }
.jot-pm mark { background: ${c.a200}; color: ${c.a900}; border-radius: 4px; padding: 0 2px; }
.jot-pm a { color: ${c.a700}; font-family: ${f.b600}, sans-serif; text-decoration: underline; cursor: pointer; }
.jot-pm .mention { color: ${c.a700}; background: ${c.a100}; border-radius: 6px; padding: 0 3px; font-family: ${f.b600}, sans-serif; }
.jot-pm code { font-family: ${f.mono}, monospace; font-size: 13px; color: ${c.a800}; background: ${c.a100}; border-radius: 5px; padding: 1px 5px; }
.jot-pm pre { background: ${c.n200}; border-radius: 14px; padding: 12px 16px; margin: 8px 0; overflow-x: auto; }
.jot-pm pre code { background: none; padding: 0; color: ${c.n800}; font-size: 12.5px; line-height: 19px; }
.jot-pm blockquote { margin: 8px 0; padding: 8px 16px; background: ${c.g100}; border-left: 4px solid ${c.g400}; border-radius: 4px 14px 14px 4px; color: ${c.g800}; }
.jot-pm blockquote p { margin: 0; line-height: 23px; }
.jot-pm hr { border: none; border-top: 2px solid ${c.n300}; margin: 16px 0; }
.jot-pm ul, .jot-pm ol { margin: 2px 0 4px; padding-left: 24px; }
.jot-pm li { padding-left: 2px; }
.jot-pm li > p { margin: 0; }
.jot-pm ul > li::marker { color: ${c.accent}; font-size: 1.15em; }
.jot-pm ol > li::marker { color: ${c.a700}; font-family: ${f.b800}, sans-serif; }
.jot-pm ul[data-type="taskList"] { list-style: none; padding-left: 4px; }
.jot-pm ul[data-type="taskList"] ul[data-type="taskList"] { padding-left: 24px; }
.jot-pm ul[data-type="taskList"] > li { display: flex; gap: 9px; align-items: flex-start; }
.jot-pm ul[data-type="taskList"] > li > label { flex: none; margin-top: 4px; user-select: none; }
.jot-pm ul[data-type="taskList"] > li > div { flex: 1; min-width: 0; }
.jot-pm ul[data-type="taskList"] > li input { width: 16px; height: 16px; accent-color: ${c.accent}; cursor: pointer; margin: 0; }
.jot-pm li[data-checked="true"] > div { color: ${c.n500}; text-decoration: line-through; }
.jot-pm table { border-collapse: separate; border-spacing: 0; margin: 10px 0; width: 100%; table-layout: fixed; border: 1px solid ${c.n300}; border-radius: 14px; overflow: hidden; }
.jot-pm th, .jot-pm td { border-right: 1px solid ${c.n300}; border-bottom: 1px solid ${c.n300}; padding: 7px 10px; vertical-align: top; position: relative; font-size: 13.5px; line-height: 21px; }
.jot-pm th:last-child, .jot-pm td:last-child { border-right: none; }
.jot-pm tr:last-child td, .jot-pm tr:last-child th { border-bottom: none; }
.jot-pm th { background: ${c.n200}; font-family: ${f.b800}, sans-serif; font-weight: 800; text-align: left; font-size: 12.5px; }
.jot-pm td p, .jot-pm th p { margin: 0; }
.jot-pm .selectedCell::after { content: ''; position: absolute; inset: 0; background: ${c.a200}; opacity: 0.45; pointer-events: none; }
.jot-pm .ProseMirror-gapcursor { display: none; pointer-events: none; position: absolute; }
.jot-pm .ProseMirror-gapcursor::after { content: ''; display: block; position: absolute; top: -2px; width: 20px; border-top: 1px solid ${c.accent}; animation: jot-blink 1.1s steps(2, start) infinite; }
.jot-pm.ProseMirror-focused .ProseMirror-gapcursor { display: block; }
@keyframes jot-blink { to { visibility: hidden; } }

.jot-count { position: sticky; bottom: 14px; z-index: 5; width: fit-content; margin: auto 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: ${c.paper}; border: 1px solid ${c.n200}; box-shadow: 0 2px 8px rgba(46,43,37,0.08); font-family: ${f.b600}, sans-serif; font-size: 12px; color: ${c.n600}; pointer-events: none; user-select: none; }
.jot-count[data-selected="true"] { background: ${c.a100}; border-color: ${c.a200}; color: ${c.a800}; }
.jot-count-tag { font-family: ${f.b800}, sans-serif; font-size: 10.5px; letter-spacing: 0.8px; text-transform: uppercase; color: ${c.a700}; }
.jot-count-dot { color: ${c.n400}; }

.jot-bar { position: fixed; z-index: 60; transform: translate(-50%, calc(-100% - 8px)); display: flex; gap: 2px; padding: 4px; background: ${c.n900}; border-radius: 12px; box-shadow: 0 8px 24px rgba(46,43,37,0.28); }
.jot-bar button { border: none; background: none; color: ${c.n100}; font-family: ${f.b700}, sans-serif; font-size: 13px; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; cursor: pointer; }
.jot-bar button:hover { background: ${c.n700}; }
.jot-bar button[data-on="true"] { background: ${c.accent}; color: ${c.paper}; }

.jot-menu { position: fixed; z-index: 60; width: 280px; max-height: 280px; overflow-y: auto; background: ${c.paper}; border-radius: 18px; padding: 6px; box-shadow: 0 12px 32px rgba(46,43,37,0.22); border: 1px solid ${c.n200}; }
.jot-menu-row { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border-radius: 12px; cursor: pointer; }
.jot-menu-row[data-on="true"] { background: ${c.a100}; }
.jot-menu-glyph { flex: none; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: ${c.n200}; color: ${c.n700}; font-family: ${f.b800}, sans-serif; font-size: 12.5px; }
.jot-menu-row[data-on="true"] .jot-menu-glyph { background: ${c.a200}; color: ${c.a800}; }
.jot-menu-text { display: flex; flex-direction: column; min-width: 0; }
.jot-menu-label { font-family: ${f.b700}, sans-serif; font-size: 13.5px; color: ${c.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jot-menu-hint { font-family: ${f.b500}, sans-serif; font-size: 11.5px; color: ${c.n600}; }

.jot-tablebar { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 6px; }
.jot-tablebar button { border: none; cursor: pointer; background: ${c.n200}; color: ${c.n800}; font-family: ${f.b700}, sans-serif; font-size: 12px; padding: 6px 12px; border-radius: 999px; }
.jot-tablebar button:hover { background: ${c.n300}; }
.jot-tablebar button[data-tone="danger"] { background: ${c.a200}; color: ${c.a800}; }
`;
