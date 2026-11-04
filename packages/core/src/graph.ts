import type { Note, Notebook } from './types';

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  /** Index into the tint table. */
  tint: number;
  title: string;
  label: string;
  /** Alternate labels sit above their dot so neighbours do not collide. */
  above: boolean;
  degree: number;
};

export type GraphEdge = { key: string; d: string };

/** A title cut to what fits beside a dot on the map. */
export function shortLabel(title: string): string {
  let label = title.split(/[:,]/)[0];
  if (label.length > 15) {
    const words = label.split(' ');
    label = words[0].length > 14 ? words[0] : words.slice(0, 2).join(' ');
  }
  if (label.length > 16) label = label.slice(0, 15) + '…';
  return label;
}

/** One cluster per notebook laid out on a ring; every @mention is an edge. */
export function layoutGraph(size: number, notebooks: Notebook[], notes: Note[]) {
  const placed: Record<string, GraphNode> = {};

  notebooks.forEach((b, bi) => {
    const angle = (bi / notebooks.length) * Math.PI * 2 - Math.PI / 2;
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
        tint: b.tint,
        title: n.title,
        label: shortLabel(n.title),
        above: ki % 2 === 1,
        degree: 0,
      };
    });
  });

  const edges: GraphEdge[] = [];
  notes.forEach((n) => {
    notes.forEach((o) => {
      if (o.id === n.id || !n.body.includes('@' + o.title)) return;
      const a = placed[n.id];
      const b = placed[o.id];
      if (!a || !b) return;
      const key = [n.id, o.id].sort().join('-');
      if (edges.some((e) => e.key === key)) return;
      a.degree += 1;
      b.degree += 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const cx = mx + (size / 2 - mx) * 0.42;
      const cy = my + (size / 2 - my) * 0.42;
      edges.push({ key, d: `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}` });
    });
  });

  return { nodes: Object.values(placed), edges };
}

/** "9", "9:5", "09:30" → "09:30:00"; anything else is not a time. */
export function parseClassTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}
