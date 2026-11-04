import React from 'react';
import { Link } from 'react-router';

import { embedOf, type Embed } from '@jot/core/embed';
import { parseBlocks, type Block, type Inline, type Mentionable } from '@jot/core/markdown';

type Props = {
  source: string;
  mentions?: Mentionable[];
  /** Where a mention goes; a share page only links notes it can show. */
  mentionHref?: (noteId: string) => string | null;
};

function Inlines({ kids, href }: { kids: Inline[]; href?: Props['mentionHref'] }) {
  return (
    <>
      {kids.map((k, i) => {
        switch (k.t) {
          case 'text': return <React.Fragment key={i}>{k.v}</React.Fragment>;
          case 'bold': return <strong key={i}><Inlines kids={k.kids} href={href} /></strong>;
          case 'em': return <em key={i}><Inlines kids={k.kids} href={href} /></em>;
          case 'mark': return <mark key={i}><Inlines kids={k.kids} href={href} /></mark>;
          case 'strike': return <s key={i}><Inlines kids={k.kids} href={href} /></s>;
          case 'code': return <code key={i}>{k.v}</code>;
          case 'link': return <a key={i} href={k.href} target="_blank" rel="noopener noreferrer"><Inlines kids={k.kids} href={href} /></a>;
          case 'mention': {
            const to = href?.(k.id);
            return to ? <Link key={i} className="mention" to={to}>{k.v}</Link> : <span key={i} className="mention">{k.v}</span>;
          }
        }
      })}
    </>
  );
}

function EmbedView({ embed }: { embed: Embed }) {
  if (embed.kind === 'image') {
    return <figure className="embed"><img src={embed.src} alt={embed.alt} loading="lazy" />{embed.alt ? <figcaption>{embed.alt}</figcaption> : null}</figure>;
  }
  if (embed.kind === 'video') {
    return <div className="embed"><iframe src={embed.src} title="Video" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" /></div>;
  }
  return (
    <a className="embed embed-link" href={embed.href} target="_blank" rel="noopener noreferrer">
      <strong>{embed.host}</strong> <span>{embed.path || '/'}</span>
    </a>
  );
}

function BlockView({ block, href }: { block: Block; href?: Props['mentionHref'] }) {
  switch (block.t) {
    case 'h1': return <h1><Inlines kids={block.kids} href={href} /></h1>;
    case 'h2': return <h2><Inlines kids={block.kids} href={href} /></h2>;
    case 'h3': return <h3><Inlines kids={block.kids} href={href} /></h3>;
    case 'h4': return <h4><Inlines kids={block.kids} href={href} /></h4>;
    case 'p': return <p><Inlines kids={block.kids} href={href} /></p>;
    case 'quote': return <blockquote><Inlines kids={block.kids} href={href} /></blockquote>;
    case 'fence': return <pre><code>{block.v}</code></pre>;
    case 'rule': return <hr />;
    case 'space': return null;
    case 'table':
      return (
        <div className="table-wrap">
          <table>
            <thead><tr>{block.rows[0]?.map((c, i) => <th key={i}><Inlines kids={c} href={href} /></th>)}</tr></thead>
            <tbody>{block.rows.slice(1).map((r, ri) => <tr key={ri}>{r.map((c, i) => <td key={i}><Inlines kids={c} href={href} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'list':
      return (
        <ul className="list">
          {block.items.map((item, i) => (
            <li key={i} className={item.kind} style={{ marginLeft: item.depth * 22 }}>
              <span className="marker">{item.kind === 'todo' ? (item.done ? '☑' : '☐') : item.kind === 'bullet' ? '•' : item.marker}</span>
              <span className={item.done ? 'done' : undefined}><Inlines kids={item.kids} href={href} /></span>
            </li>
          ))}
        </ul>
      );
  }
}

/** A note set for reading: no marks, no gutter, embeds drawn in place of their line. */
export function Markdown({ source, mentions = [], mentionHref }: Props) {
  const parts: ({ embed: Embed } | { lines: string[] })[] = [];
  let fenced = false;
  for (const line of source.split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const embed = fenced ? null : embedOf(line);
    const last = parts[parts.length - 1];
    if (embed) parts.push({ embed });
    else if (last && 'lines' in last) last.lines.push(line);
    else parts.push({ lines: [line] });
  }
  return (
    <div className="prose">
      {parts.map((part, i) => 'embed' in part
        ? <EmbedView key={i} embed={part.embed} />
        : parseBlocks(part.lines, mentions).map((b, j) => <BlockView key={`${i}-${j}`} block={b} href={mentionHref} />))}
    </div>
  );
}
