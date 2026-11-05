import type { EditorView } from '@codemirror/view';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { fisheye } from '@jot/core/fisheye';

import { addMenuItems } from '../components/menu';
import { seekLine } from './seek';

type Props = {
  view: EditorView | null;
  /** Bumped by the page on every editor update, so the map follows text, caret and scroll. */
  tick: number;
  scroller: HTMLElement | null;
  /** The lines on show (1-based, inclusive); the others are hidden from the page and from the map. */
  fromLine?: number;
  toLine?: number;
  onHide: () => void;
};

const MAX = 22;
/**
 * Every line ten pixels tall, whatever the notebook's length, so the map
 * holds a stretch of about fifty lines and slides along the notebook with the
 * page — a seeker, not a thumbnail of the whole file.
 */
const BASE = 10;
const RADIUS = 6;

/**
 * The note as a code minimap: one faint bar per line, headings a step
 * stronger. Under the pointer the lines swell into real, readable text, the
 * nearer the larger, so the map reads as a magnifier sliding down the note.
 */
export function Minimap({ view, tick, scroller, fromLine = 1, toLine, onHide }: Props) {
  const pane = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [pointer, setPointer] = useState<number | null>(null);
  const [scroll, setScroll] = useState({ top: 0, span: 1 });

  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!scroller) return;
    const read = () => setScroll({
      top: scroller.scrollTop / Math.max(1, scroller.scrollHeight),
      span: scroller.clientHeight / Math.max(1, scroller.scrollHeight),
    });
    read();
    scroller.addEventListener('scroll', read, { passive: true });
    return () => scroller.removeEventListener('scroll', read);
  }, [scroller, tick]);

  const lines = useMemo(() => {
    if (!view) return [];
    const doc = view.state.doc;
    const last = Math.min(toLine ?? doc.lines, doc.lines);
    return Array.from({ length: Math.max(0, last - fromLine + 1) }, (_, i) => {
      const text = doc.line(fromLine + i).text;
      const h = text.match(/^(#{1,4})\s/);
      return { text, level: h ? h[1].length : 0 };
    });
    // The doc object changes identity on every edit; tick tracks that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tick, fromLine, toLine]);
  const caretLine = view ? view.state.doc.lineAt(view.state.selection.main.head).number - fromLine : -1;

  const base = BASE;
  const total = base * lines.length;
  // A long note is taller than the pane: the map slides with the page, like an editor's.
  const slide = total > height ? scroll.top / Math.max(0.0001, 1 - scroll.span) * (total - height) : 0;
  const layout = fisheye(lines.length, base, MAX, RADIUS, pointer === null ? null : (pointer + slide) / base);
  const shift = pointer === null ? -slide : pointer - layout.at;

  function jump(index: number) {
    if (!view) return;
    seekLine(view, scroller, view.state.doc.line(fromLine + index).from);
  }

  return (
    <div className="minimap" ref={pane} aria-label="Note map"
      onMouseMove={(e) => setPointer(e.clientY - e.currentTarget.getBoundingClientRect().top)}
      onMouseLeave={() => setPointer(null)}
      onContextMenu={(e) => addMenuItems(e, [{ label: 'Hide map', run: onHide }])}>
      <div className="minimap-panel">
        {pointer === null && total ? (
          <div className="minimap-view" style={{ top: scroll.top * total - slide, height: Math.max(12, scroll.span * total) }} />
        ) : null}
        <div className="minimap-lines" style={{ transform: `translateY(${shift}px)` }}>
          {lines.map((l, i) => {
            const h = layout.heights[i];
            const near = (h - base) / (MAX - base);
            return (
              <button key={i} className={'minimap-line' + (l.level ? ` level-${l.level}` : '') + (i === caretLine ? ' caret' : '')}
                style={{ height: h, fontSize: Math.max(1, h * 0.7) }} onClick={() => jump(i)} tabIndex={-1}>
                {/* Real text at every size; lines away from the pointer stay faint so the near ones stand out. */}
                <span className="minimap-text" style={{ opacity: 0.45 + 0.55 * near }}>{l.text || ' '}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
