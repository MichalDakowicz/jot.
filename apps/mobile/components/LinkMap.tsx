import React, { useMemo } from 'react';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import type { Note, Notebook } from '@jot/core/types';
import { c, tintOf } from '@jot/core/theme/tokens';

type Props = {
  size: number;
  notebooks: Notebook[];
  notes: Note[];
  onPick: (noteId: string) => void;
};

type Node = {
  id: string;
  x: number;
  y: number;
  hex: string;
  title: string;
  above: boolean;
  degree: number;
};

function shortLabel(title: string): string {
  let label = title.split(/[:,]/)[0];
  if (label.length > 15) {
    const words = label.split(' ');
    label = words[0].length > 14 ? words[0] : words.slice(0, 2).join(' ');
  }
  if (label.length > 16) label = label.slice(0, 15) + '…';
  return label;
}

/** One cluster per notebook laid out on a ring; every @mention is an edge. */
export function LinkMap({ size, notebooks, notes, onPick }: Props) {
  const { nodes, edges } = useMemo(() => {
    const books = notebooks.length ? notebooks : [];
    const placed: Record<string, Node> = {};

    books.forEach((b, bi) => {
      const angle = (bi / books.length) * Math.PI * 2 - Math.PI / 2;
      const hx = size / 2 + Math.cos(angle) * size * 0.27;
      const hy = size / 2 + Math.sin(angle) * size * 0.27;
      const kids = notes.filter((n) => n.notebook_id === b.id);
      kids.forEach((n, ki) => {
        const spread = angle + (ki - (kids.length - 1) / 2) * 0.8;
        const r = kids.length > 1 ? size * 0.165 : 0;
        placed[n.id] = {
          id: n.id,
          x: hx + Math.cos(spread) * r,
          y: hy + Math.sin(spread) * r,
          hex: tintOf(b.tint).hex,
          title: n.title,
          above: ki % 2 === 1,
          degree: 0,
        };
      });
    });

    const lines: { key: string; d: string }[] = [];
    notes.forEach((n) => {
      notes.forEach((o) => {
        if (o.id === n.id || !n.body.includes('@' + o.title)) return;
        const a = placed[n.id];
        const b = placed[o.id];
        if (!a || !b) return;
        const key = [n.id, o.id].sort().join('-');
        if (lines.some((e) => e.key === key)) return;
        a.degree += 1;
        b.degree += 1;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const cx = mx + (size / 2 - mx) * 0.42;
        const cy = my + (size / 2 - my) * 0.42;
        lines.push({ key, d: `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}` });
      });
    });

    return { nodes: Object.values(placed), edges: lines };
  }, [notebooks, notes, size]);

  const pad = 46;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`${-pad} ${-pad / 2} ${size + pad * 2} ${size + pad}`}
    >
      {edges.map((e) => (
        <Path key={e.key} d={e.d} fill="none" stroke={c.n400} strokeWidth={2.4} strokeLinecap="round" />
      ))}
      {nodes.map((n) => {
        const r = 9 + n.degree * 3.2;
        const ly = n.above ? n.y - r - 9 : n.y + r + 15;
        const label = shortLabel(n.title);
        return (
          <G key={n.id} onPress={() => onPick(n.id)}>
            <Circle cx={n.x} cy={n.y} r={r + 5} fill={n.hex} opacity={0.16} />
            <Circle cx={n.x} cy={n.y} r={r} fill={n.hex} />
            <SvgText
              x={n.x}
              y={ly}
              textAnchor="middle"
              fontSize={11}
              fontWeight="700"
              stroke={c.n100}
              strokeWidth={3.4}
              strokeLinejoin="round"
              fill={c.n100}
            >
              {label}
            </SvgText>
            <SvgText x={n.x} y={ly} textAnchor="middle" fontSize={11} fontWeight="700" fill={c.n700}>
              {label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
