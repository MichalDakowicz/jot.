import { parseBlocks, type Inline } from './markdown';

export type OutlineHeading = { blockIndex: number; level: number; title: string };

function inlineText(nodes: Inline[]): string {
  return nodes.map((node) => 'kids' in node ? inlineText(node.kids) : node.v).join('');
}

/** Match the rendered markdown, including formatting and fenced code rules. */
export function outlineOf(body: string): OutlineHeading[] {
  return parseBlocks(body.split('\n')).flatMap((block, blockIndex) =>
    (block.t === 'h1' || block.t === 'h2' || block.t === 'h3' || block.t === 'h4')
      ? [{ blockIndex, level: Number(block.t.slice(1)), title: inlineText(block.kids) }]
      : [],
  );
}
