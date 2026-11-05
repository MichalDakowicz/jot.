import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { menuFor, type MenuItem } from './menu';

type Open = { x: number; y: number; items: MenuItem[] };

/**
 * The app's own right-click menu, in place of the browser's. What it holds
 * comes from the spot clicked and the elements around it (see addMenuItems).
 * Shift with the right-click, or a long press, still opens the browser's menu.
 */
export function ContextMenu() {
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      // A long press on a touch screen keeps the phone's own selection menu.
      if (e.shiftKey || (e as PointerEvent).pointerType === 'touch') return;
      const items = menuFor(e);
      if (!items.length) return;
      e.preventDefault();
      setActive(-1);
      setOpen({ x: e.clientX, y: e.clientY, items });
    };
    document.addEventListener('contextmenu', onMenu);
    return () => document.removeEventListener('contextmenu', onMenu);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  // Focus stays where it was, so the menu's keys are read from the window while it is up.
  useEffect(() => {
    if (!open) return;
    const usable = open.items.flatMap((it, i) => (it !== 'sep' && !it.disabled ? [i] : []));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const k = usable.indexOf(active);
        const next = k === -1 ? (e.key === 'ArrowDown' ? 0 : usable.length - 1) : k + (e.key === 'ArrowDown' ? 1 : -1);
        setActive(usable[(next + usable.length) % usable.length] ?? -1);
      } else if (e.key === 'Enter' && active !== -1) pick(open.items[active]);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, active]);

  // Kept inside the window: flipped up or left when it would run off an edge.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !open) return;
    const { width, height } = el.getBoundingClientRect();
    el.style.left = `${Math.max(4, open.x + width > innerWidth - 4 ? open.x - width : open.x)}px`;
    el.style.top = `${Math.max(4, open.y + height > innerHeight - 4 ? open.y - height : open.y)}px`;
  }, [open]);

  function pick(item: MenuItem) {
    if (item === 'sep' || item.disabled) return;
    setOpen(null);
    item.run();
  }

  if (!open) return null;
  return (
    <div className="context-menu" ref={box} role="menu"
      // Keeps focus, and the selection, where it was, so cut and copy act on it.
      onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}
      style={{ left: open.x, top: open.y }}>
      {open.items.map((it, i) => (it === 'sep' ? <div key={i} className="context-sep" role="separator" /> : (
        <button key={i} role="menuitem" className={'context-item' + (i === active ? ' on' : '')} disabled={it.disabled}
          onMouseEnter={() => setActive(i)} onClick={() => pick(it)}>
          <span>{it.label}</span>
          {it.keys ? <span className="context-keys">{it.keys}</span> : null}
        </button>
      )))}
    </div>
  );
}
