import React, { useRef, useState } from 'react';

import { c } from '../theme/tokens';

type Props = { value: number; min: number; max: number; onChange: (value: number) => void; onCommit: (value: number) => void };

export function ResizeHandle({ value, min, max, onChange, onCommit }: Props) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [active, setActive] = useState(false);
  const clamp = (width: number) => Math.max(min, Math.min(max, width));
  const moved = (x: number) => clamp(drag.current ? drag.current.width + drag.current.x - x : value);

  return (
    <div role="separator" aria-label="Resize contents sidebar" aria-orientation="vertical"
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} tabIndex={0}
      title="Drag to resize. Left and right arrow keys adjust width. Double-click to reset."
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, width: value };
        setActive(true);
      }}
      onPointerMove={(event) => { if (drag.current) onChange(moved(event.clientX)); }}
      onPointerUp={(event) => {
        if (!drag.current) return;
        onCommit(moved(event.clientX));
        drag.current = null;
        setActive(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={() => { if (drag.current) onCommit(value); drag.current = null; setActive(false); }}
      onPointerCancel={() => { if (drag.current) onCommit(value); drag.current = null; setActive(false); }}
      onKeyDown={(event) => {
        const next = event.key === 'ArrowLeft' ? value + (event.shiftKey ? 40 : 16)
          : event.key === 'ArrowRight' ? value - (event.shiftKey ? 40 : 16)
          : event.key === 'Home' ? min : event.key === 'End' ? max : null;
        if (next !== null) { event.preventDefault(); onCommit(clamp(next)); }
      }}
      onDoubleClick={() => onCommit(clamp(440))}
      onMouseEnter={() => setActive(true)} onMouseLeave={() => { if (!drag.current) setActive(false); }}
      style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'col-resize', touchAction: 'none', userSelect: 'none', borderRadius: 8,
        background: active ? c.n200 : 'transparent', outlineOffset: -2 }}>
      <span style={{ width: 4, height: 52, borderRadius: 4, background: active ? c.accent : c.n400 }} />
    </div>
  );
}
