import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { useStore } from '@jot/core/store';

import { Explorer } from './Explorer';
import { Icon } from './Icon';
import { addMenuItems, MOD } from './menu';

type Status = { left?: React.ReactNode; right?: React.ReactNode };

const StatusContext = createContext<(s: Status) => void>(() => {});
const DrawerContext = createContext<() => void>(() => {});

/** A page puts its own facts in the status bar for as long as it is shown. */
export function useStatus(status: Status, deps: unknown[]) {
  const set = useContext(StatusContext);
  useEffect(() => {
    set(status);
    return () => set({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const RAIL_KEY = 'jot.explorer';

function readHidden(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === 'hidden';
  } catch {
    return false;
  }
}

/** Explorer · main, with the status bar under both, the way an editor sits. */
export function Shell({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>({});
  const [drawer, setDrawer] = useState(false);
  const [hidden, setHidden] = useState(readHidden);
  const { error, dismissError, loading } = useStore();
  const { pathname } = useLocation();
  useEffect(() => setDrawer(false), [pathname]);

  // Wide, the explorer folds away and stays that way; narrow, it is a drawer that opens over the page.
  const toggle = useCallback(() => {
    if (matchMedia('(max-width: 899px)').matches) {
      setDrawer((d) => !d);
      return;
    }
    setHidden((h) => {
      try {
        if (h) localStorage.removeItem(RAIL_KEY);
        else localStorage.setItem(RAIL_KEY, 'hidden');
      } catch { /* A private window forgets it next visit. */ }
      return !h;
    });
  }, []);

  // Ctrl/⌘-B, as in a code editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <StatusContext.Provider value={setStatus}>
      <DrawerContext.Provider value={toggle}>
        <div className={'shell' + (drawer ? ' drawer' : '') + (hidden ? ' rail-hidden' : '')}
          onContextMenu={(e) => addMenuItems(e, [{ label: 'Toggle explorer', keys: `${MOD}B`, run: toggle }])}>
          <Explorer />
          <div className="scrim" onClick={() => setDrawer(false)} />
          <div className="main">{children}</div>
          <footer className="statusbar">
            {error ? (
              <button className="status-error" onClick={dismissError}>{error} · dismiss</button>
            ) : (
              <span className={loading ? '' : 'ok'}>{loading ? 'syncing…' : '● synced'}</span>
            )}
            {status.left}
            <span className="right">{status.right}</span>
          </footer>
        </div>
      </DrawerContext.Provider>
    </StatusContext.Provider>
  );
}

/** Path on the left the way an editor shows the open file, page actions on the right. */
export function TopBar({ crumbs, actions }: { crumbs: React.ReactNode; actions?: React.ReactNode }) {
  const toggle = useContext(DrawerContext);
  return (
    <header className="topbar">
      <button className="icon-button menu-button" onClick={toggle} aria-label="Show or hide the explorer" title="Explorer (Ctrl+B)">
        <Icon name="menu" />
      </button>
      <nav className="crumbs">{crumbs}</nav>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  );
}
