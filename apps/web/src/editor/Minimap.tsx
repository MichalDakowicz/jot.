import { EditorView } from '@codemirror/view';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { fisheye } from '@jot/core/fisheye';

type Props = {
  view: EditorView | null;
  /** Bumped by the page on every editor update, so the map follows text, caret and scroll. */
  tick: number;
  scroller: HTMLElement | null;
};

const MAX = 18;
const RADIUS = 7;

/**
 * The note as a code minimap: one faint bar per line, headings a step
 * stronger. Under the pointer the lines swell into real, readable text, the
 * nearer the larger, so the map reads as a magnifier sliding down the note.
 */
export function Minimap({ view, tick, scroller }: Props) {
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
    return Array.from({ length: doc.lines }, (_, i) => {
      const text = doc.line(i + 1).text;
      const h = text.match(/^(#{1,4})\s/);
      return { text, level: h ? h[1].length : 0 };
    });
    // The doc object changes identity on every edit; tick tracks that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tick]);
  const caretLine = view ? view.state.doc.lineAt(view.state.selection.main.head).number - 1 : -1;

  const base = Math.max(2, Math.min(5, height / Math.max(1, lines.length)));
  const total = base * lines.length;
  // A long note is taller than the pane: the map slides with the page, like an editor's.
  const slide = total > height ? scroll.top / Math.max(0.0001, 1 - scroll.span) * (total - height) : 0;
  const layout = fisheye(lines.length, base, MAX, RADIUS, pointer === null ? null : (pointer + slide) / base);
  const shift = pointer === null ? -slide : pointer - layout.at;

  function jump(index: number) {
    if (!view) return;
    const line = view.state.doc.line(index + 1);
    view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 48 }) });
    view.focus();
  }

  return (
    <div className="minimap" ref={pane} aria-label="Note map"
      onMouseMove={(e) => setPointer(e.clientY - e.currentTarget.getBoundingClientRect().top)}
      onMouseLeave={() => setPointer(null)}>
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
                {near > 0.25 ? (
                  <span className="minimap-text" style={{ opacity: Math.min(1, near * 1.4) }}>{l.text || ' '}</span>
                ) : (
                  <span className="minimap-bar" style={{ width: `${Math.min(100, l.text.length * 1.4)}%` }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
