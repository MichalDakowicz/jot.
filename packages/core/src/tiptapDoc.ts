/**
 * Notes are markdown on the server, and Tiptap holds a ProseMirror document.
 * These are the two directions between them.
 *
 * Neither direction does its own parsing: the block model (lib/doc.ts) and the
 * inline runs (lib/rich.ts) already read and write the dialect — lettered
 * lists, ==mark==, tables, @mentions — so this only reshapes what they hand
 * back. That is what keeps a note the web editor never touched byte-for-byte
 * what it was, and what keeps the native editor reading what the web wrote.
 *
 * The one real difference is lists. The block model is flat, each item a block
 * with a depth; ProseMirror nests, an item holding its sublist.
 */

import { evenRows, LISTS, MAX_DEPTH, parseDoc, serializeDoc, type Block, type BlockKind } from './doc';
import { parseRuns, serializeRuns, type Marks, type Run } from './rich';

export type PMMark = { type: string; attrs?: Record<string, unknown> };
export type PMNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
};

// ───────────────────────────────────────────────── inline

const MARK_NAMES: Record<string, keyof Marks> = {
  bold: 'bold',
  italic: 'em',
  highlight: 'mark',
  strike: 'strike',
  code: 'code',
  link: 'link',
  mention: 'mention',
};

function marksToPM(marks: Marks): PMMark[] | undefined {
  const out: PMMark[] = [];
  if (marks.bold) out.push({ type: 'bold' });
  if (marks.em) out.push({ type: 'italic' });
  if (marks.mark) out.push({ type: 'highlight' });
  if (marks.strike) out.push({ type: 'strike' });
  if (marks.code) out.push({ type: 'code' });
  if (marks.link) out.push({ type: 'link', attrs: { href: marks.link } });
  if (marks.mention) out.push({ type: 'mention' });
  return out.length ? out : undefined;
}

function marksFromPM(marks: PMMark[] | undefined): Marks {
  const out: Marks = {};
  (marks ?? []).forEach((m) => {
    const key = MARK_NAMES[m.type];
    if (!key) return;
    if (key === 'link') out.link = String(m.attrs?.href ?? '');
    else out[key] = true;
  });
  return out;
}

/** One block's inline markdown as ProseMirror text nodes. */
export function inlineToPM(md: string, titles: string[]): PMNode[] {
  return parseRuns(md, titles).map((run) => {
    const marks = marksToPM(run.marks);
    return marks ? { type: 'text', text: run.text, marks } : { type: 'text', text: run.text };
  });
}

/** ProseMirror's inline content back to the block's inline markdown. */
export function inlineFromPM(nodes: PMNode[] | undefined): string {
  const runs: Run[] = [];
  (nodes ?? []).forEach((n) => {
    // A hard break has no place in a one-line block; it reads as a space.
    if (n.type === 'hardBreak') runs.push({ text: ' ', marks: {} });
    else if (n.type === 'text' && n.text) runs.push({ text: n.text, marks: marksFromPM(n.marks) });
  });
  return serializeRuns(runs);
}

/** The text of a block-level node's first line, whatever it is wrapped in. */
function textOf(node: PMNode): string {
  const paras = (node.content ?? []).filter((k) => k.type === 'paragraph');
  return paras.map((p) => inlineFromPM(p.content)).join(' ');
}

// ───────────────────────────────────────────────── blocks -> ProseMirror

const paragraph = (md: string, titles: string[]): PMNode => {
  const content = inlineToPM(md, titles);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
};

const LIST_NODE: Partial<Record<BlockKind, { list: string; item: string }>> = {
  bullet: { list: 'bulletList', item: 'listItem' },
  number: { list: 'orderedList', item: 'listItem' },
  alpha: { list: 'orderedList', item: 'listItem' },
  todo: { list: 'taskList', item: 'taskItem' },
};

type OpenList = { depth: number; kind: BlockKind; node: PMNode };

function newList(b: Block): PMNode {
  const spec = LIST_NODE[b.kind] as { list: string; item: string };
  const node: PMNode = { type: spec.list, content: [] };
  if (b.kind === 'number' || b.kind === 'alpha') {
    node.attrs = { type: b.kind === 'alpha' ? 'a' : '1', start: b.start ?? 1 };
  }
  return node;
}

/** A note's markdown as the document Tiptap opens. */
export function docToPM(body: string, titles: string[] = []): PMNode {
  const blocks = parseDoc(body);
  const out: PMNode[] = [];
  /** The lists open at the end of `out`, outermost first. */
  let open: OpenList[] = [];

  blocks.forEach((b) => {
    if (!LISTS.includes(b.kind)) {
      open = [];
      const last = out[out.length - 1];
      // Quote lines that follow one another are one quote.
      if (b.kind === 'quote' && last?.type === 'blockquote') (last.content as PMNode[]).push(paragraph(b.text, titles));
      else out.push(blockToPM(b, titles));
      return;
    }

    // A list cannot start deeper than one level past the one above it.
    const want = Math.min(Math.max(0, b.depth ?? 0), MAX_DEPTH, open.length ? open[open.length - 1].depth + 1 : 0);
    while (open.length && open[open.length - 1].depth > want) open.pop();

    let top = open[open.length - 1];
    // Another kind of list at the same level is a list of its own.
    if (top && top.depth === want && top.kind !== b.kind) {
      open.pop();
      top = open[open.length - 1];
    }

    if (!top || top.depth < want) {
      const node = newList(b);
      if (top) {
        const items = top.node.content as PMNode[];
        const host = items[items.length - 1];
        (host.content as PMNode[]).push(node);
      } else {
        out.push(node);
      }
      top = { depth: want, kind: b.kind, node };
      open.push(top);
    }

    const spec = LIST_NODE[b.kind] as { list: string; item: string };
    const item: PMNode = { type: spec.item, content: [paragraph(b.text, titles)] };
    if (b.kind === 'todo') item.attrs = { checked: !!b.done };
    (top.node.content as PMNode[]).push(item);
  });

  // Something to type into after a table, a code block or a rule that ends the
  // note. It is the editor's, not the note's: pmToBlocks drops it again.
  if (!out.length || out[out.length - 1].type !== 'paragraph') out.push({ type: 'paragraph' });

  return { type: 'doc', content: out };
}

function blockToPM(b: Block, titles: string[]): PMNode {
  switch (b.kind) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
      return {
        type: 'heading',
        attrs: { level: Number(b.kind[1]) },
        content: inlineToPM(b.text, titles),
      };
    case 'quote':
      return { type: 'blockquote', content: [paragraph(b.text, titles)] };
    case 'rule':
      return { type: 'horizontalRule' };
    case 'fence':
      return {
        type: 'codeBlock',
        attrs: { language: b.lang || null },
        content: b.text ? [{ type: 'text', text: b.text }] : undefined,
      };
    case 'table': {
      const rows = evenRows(b.rows?.length ? b.rows : [['', '']]);
      return {
        type: 'table',
        content: rows.map((row, r) => ({
          type: 'tableRow',
          content: row.map((cell) => ({
            type: r === 0 ? 'tableHeader' : 'tableCell',
            content: [paragraph(cell, titles)],
          })),
        })),
      };
    }
    default:
      return paragraph(b.text, titles);
  }
}

// ───────────────────────────────────────────────── ProseMirror -> blocks

function listKind(node: PMNode): BlockKind {
  if (node.type === 'taskList') return 'todo';
  if (node.type === 'orderedList') return node.attrs?.type === 'a' ? 'alpha' : 'number';
  return 'bullet';
}

function listToBlocks(list: PMNode, depth: number, out: Block[]) {
  const kind = listKind(list);
  const at = Number(list.attrs?.start ?? 1);
  let first = true;

  (list.content ?? []).forEach((item) => {
    const block: Block = { kind, text: textOf(item), depth: Math.min(depth, MAX_DEPTH) };
    if (kind === 'todo') block.done = !!item.attrs?.checked;
    if (first && (kind === 'number' || kind === 'alpha') && at !== 1) block.start = at;
    first = false;
    out.push(block);
    (item.content ?? []).forEach((kid) => {
      if (kid.type === 'bulletList' || kid.type === 'orderedList' || kid.type === 'taskList') {
        listToBlocks(kid, depth + 1, out);
      }
    });
  });
}

/** The blocks a Tiptap document holds. */
export function pmToBlocks(doc: PMNode): Block[] {
  const out: Block[] = [];

  (doc.content ?? []).forEach((node) => {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(4, Math.max(1, Number(node.attrs?.level ?? 1)));
        out.push({ kind: `h${level}` as BlockKind, text: inlineFromPM(node.content) });
        break;
      }
      case 'blockquote':
        (node.content ?? []).forEach((p) => out.push({ kind: 'quote', text: textOf({ type: 'x', content: [p] }) }));
        break;
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        listToBlocks(node, 0, out);
        break;
      case 'horizontalRule':
        out.push({ kind: 'rule', text: '' });
        break;
      case 'codeBlock':
        out.push({
          kind: 'fence',
          lang: String(node.attrs?.language ?? ''),
          text: (node.content ?? []).map((t) => t.text ?? '').join(''),
        });
        break;
      case 'table': {
        const rows = (node.content ?? []).map((row) => (row.content ?? []).map((cell) => textOf(cell)));
        out.push({ kind: 'table', text: '', rows: evenRows(rows.length ? rows : [['', '']]) });
        break;
      }
      default:
        out.push({ kind: 'p', text: inlineFromPM(node.content) });
    }
  });

  // The empty paragraph docToPM left to type into after a block that ends the note.
  const last = out[out.length - 1];
  if (out.length > 1 && last.kind === 'p' && !last.text && out[out.length - 2].kind !== 'p') out.pop();

  return out.length ? out : [{ kind: 'p', text: '' }];
}

/** A Tiptap document back to the markdown the note is stored as. */
export function pmToDoc(doc: PMNode): string {
  return serializeDoc(pmToBlocks(doc));
}
