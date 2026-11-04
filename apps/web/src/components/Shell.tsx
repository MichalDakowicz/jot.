import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { useStore } from '@jot/core/store';

import { Explorer } from './Explorer';
import { Icon } from './Icon';

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

/** Explorer · main, with the status bar under both, the way an editor sits. */
export function Shell({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>({});
  const [drawer, setDrawer] = useState(false);
  const { error, dismissError, loading } = useStore();
  const { pathname } = useLocation();
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <StatusContext.Provider value={setStatus}>
      <DrawerContext.Provider value={() => setDrawer((d) => !d)}>
        <div className={'shell' + (drawer ? ' drawer' : '')}>
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
      <button className="icon-button menu-button" onClick={toggle} aria-label="Open the explorer">
        <Icon name="menu" />
      </button>
      <nav className="crumbs">{crumbs}</nav>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  );
}
