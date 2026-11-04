import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';

import { useStore } from '@jot/core/store';

import { useScheme } from '../theme';
import { Icon, type IconName } from './Icon';
import { LogoMark, Wordmark } from './Logo';
import { NotebookDot } from './NotebookDot';

const PLACES: { to: string; label: string; icon: IconName }[] = [
  { to: '/today', label: 'today', icon: 'today' },
  { to: '/search', label: 'search', icon: 'search' },
  { to: '/tags', label: 'tags', icon: 'tag' },
  { to: '/graph', label: 'link map', icon: 'graph' },
];

/** The file tree: notebooks are folders, notes are files, places sit above them. */
export function Explorer() {
  const { notebooks, notesOf, noteById, createNote } = useStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { scheme, choose } = useScheme();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // The notebook of whatever is on screen stays unfolded.
  const current = pathname.match(/^\/(note|notebook)\/([^/]+)/);
  const currentBook = current ? (current[1] === 'note' ? noteById(current[2])?.notebook_id : current[2]) : undefined;
  useEffect(() => {
    if (currentBook) setOpen((o) => (o[currentBook] ? o : { ...o, [currentBook]: true }));
  }, [currentBook]);

  return (
    <aside className="explorer" aria-label="Explorer">
      <Link to="/today" className="explorer-head">
        <LogoMark size={22} />
        <Wordmark />
        <span className="path">~/notes</span>
      </Link>
      <div className="tree">
        {PLACES.map((p) => (
          <NavLink key={p.to} to={p.to} className={({ isActive }) => 'row' + (isActive ? ' on' : '')}>
            <Icon name={p.icon} /> <span className="name">{p.label}</span>
          </NavLink>
        ))}

        <div className="tree-label tree-label-row">
          <span>notebooks</span>
          <Link to="/shelf" className="tree-action" aria-label="All notebooks">all</Link>
        </div>
        {notebooks.map((nb) => {
          const kids = notesOf(nb.id);
          const unfolded = !!open[nb.id];
          return (
            <div key={nb.id}>
              <div className={'row' + (pathname === `/notebook/${nb.id}` ? ' on' : '')}>
                <button className="fold" aria-label={unfolded ? `Fold ${nb.name}` : `Unfold ${nb.name}`}
                  aria-expanded={unfolded} onClick={() => setOpen((o) => ({ ...o, [nb.id]: !unfolded }))}>
                  <Icon name="chevron" size={12} className={unfolded ? 'turned' : ''} />
                </button>
                <NotebookDot tint={nb.tint} />
                <Link className="name" to={`/notebook/${nb.id}`}>{nb.name}</Link>
                <span className="count">{kids.length}</span>
              </div>
              {unfolded ? (
                <>
                  {kids.map((n) => (
                    <NavLink key={n.id} to={`/note/${n.id}`} className={({ isActive }) => 'row nested' + (isActive ? ' on' : '')}>
                      <Icon name="file" size={14} /> <span className="name">{n.title || 'Untitled'}</span>
                    </NavLink>
                  ))}
                  <button className="row nested faint" onClick={async () => {
                    const note = await createNote(nb.id);
                    if (note) navigate(`/note/${note.id}`);
                  }}>
                    <Icon name="plus" size={14} /> <span className="name">new note</span>
                  </button>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="explorer-foot">
        <NavLink to="/profile" className={({ isActive }) => 'row' + (isActive ? ' on' : '')}>
          <Icon name="user" /> <span className="name">profile</span>
        </NavLink>
        <button className="row" onClick={() => choose(scheme === 'dark' ? 'light' : 'dark')}>
          <Icon name={scheme === 'dark' ? 'sun' : 'moon'} /> <span className="name">theme: {scheme}</span>
        </button>
      </div>
    </aside>
  );
}
