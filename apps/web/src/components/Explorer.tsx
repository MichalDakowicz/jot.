import React from 'react';
import { Link, NavLink, useLocation } from 'react-router';

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

/** The file tree: each notebook is a file, and the open one lists its notes as an outline. */
export function Explorer() {
  const { notebooks, notesOf, noteById } = useStore();
  const { pathname } = useLocation();
  const { scheme, choose } = useScheme();

  const current = pathname.match(/^\/(note|notebook)\/([^/]+)/);
  const openBook = current ? (current[1] === 'note' ? noteById(current[2])?.notebook_id : current[2]) : undefined;

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
          <Link to="/shelf" className="tree-action" aria-label="All notebooks and a new one">+ new</Link>
        </div>
        {notebooks.map((nb) => {
          const kids = notesOf(nb.id);
          const open = nb.id === openBook;
          return (
            <div key={nb.id}>
              <Link to={`/notebook/${nb.id}`} className={'row' + (open ? ' on' : '')}>
                <NotebookDot tint={nb.tint} />
                <span className="name">{nb.name}<span className="ext">.md</span></span>
                <span className="count">{kids.length}</span>
              </Link>
              {open ? kids.map((n) => (
                <Link key={n.id} to={`/notebook/${nb.id}?note=${n.id}`} className="row nested outline">
                  <span className="outline-mark">#</span> <span className="name">{n.title || 'Untitled'}</span>
                </Link>
              )) : null}
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
