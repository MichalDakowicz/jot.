import React, { useMemo } from 'react';
import { useNavigate } from 'react-router';

import { layoutGraph } from '@jot/core/graph';
import { inkTint } from '@jot/core/theme/ink';
import { tintOf } from '@jot/core/theme/tokens';
import { useStore } from '@jot/core/store';

import { TopBar } from '../components/Shell';
import { useScheme } from '../theme';

const SIZE = 640;

/** One cluster per notebook, an edge for every @mention between notes. */
export function GraphPage() {
  const navigate = useNavigate();
  const { scheme } = useScheme();
  const { notebooks, notes } = useStore();
  const { nodes, edges } = useMemo(() => layoutGraph(SIZE, notebooks, notes), [notebooks, notes]);

  return (
    <>
      <TopBar crumbs={<span className="here">link map</span>} />
      <div className="content">
        <div className="page graph-page">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="graph" role="img" aria-label="Link map of every note">
            {edges.map((e) => <path key={e.key} d={e.d} className="graph-edge" />)}
            {nodes.map((n) => (
              <g key={n.id} className="graph-node" onClick={() => navigate(`/note/${n.id}`)} role="link" aria-label={n.title}>
                <circle cx={n.x} cy={n.y} r={4 + Math.min(n.degree, 5)} style={{ fill: inkTint(tintOf(n.tint).hex, scheme) }} />
                <text x={n.x} y={n.above ? n.y - 12 : n.y + 20} textAnchor="middle">{n.label}</text>
              </g>
            ))}
          </svg>
          <ul className="graph-legend">
            {notebooks.map((b) => (
              <li key={b.id}><span className="dot" style={{ background: inkTint(tintOf(b.tint).hex, scheme) }} /> {b.name}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
