import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '@jot/core/auth';
import { useStore } from '@jot/core/store';
import { greeting, spelled, todayLabel } from '@jot/core/time';

import { NoteList } from '../components/NoteList';
import { NotebookDot } from '../components/NotebookDot';
import { TopBar } from '../components/Shell';

export function TodayPage() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { notes, notebooks, loading, cardOf, todaysClasses, seedDemoContent, createNotebook } = useStore();
  const [seeding, setSeeding] = useState(false);
  const classes = todaysClasses();
  const firstName = (profile?.full_name || user?.email?.split('@')[0] || 'there').split(' ')[0];

  return (
    <>
      <TopBar crumbs={<span className="here">today</span>} />
      <div className="content">
        <div className="page">
          {loading && !notes.length && !notebooks.length ? (
            <p className="muted" aria-busy="true">loading…</p>
          ) : !notebooks.length ? (
            <>
              <h1 className="page-title">Hello, {firstName}</h1>
              <p className="muted">Nothing filed yet. Start from a full term, or from nothing.</p>
              <div className="stack">
                <button className="button primary" disabled={seeding} onClick={async () => {
                  setSeeding(true);
                  await seedDemoContent();
                  setSeeding(false);
                }}>{seeding ? 'filling…' : 'Fill five notebooks with a sample term'}</button>
                <button className="button" onClick={async () => {
                  const nb = await createNotebook({ name: 'First notebook', code: 'NEW-101', prof: '', tint: 0 });
                  if (nb) navigate(`/notebook/${nb.id}`);
                }}>Start with one empty notebook</button>
              </div>
            </>
          ) : (
            <>
              <h1 className="page-title">{greeting()} {firstName}</h1>
              <p className="muted">
                {todayLabel()} · {classes.length ? `${spelled(classes.length)} ${classes.length === 1 ? 'class' : 'classes'}` : 'no classes'}
              </p>
              {classes.length ? (
                <section className="section">
                  <h2 className="label">timetable</h2>
                  <ul className="rows">
                    {classes.map((s) => (
                      <li key={s.id}>
                        <Link className="row-link" to={s.notebook ? `/notebook/${s.notebook.id}` : '/shelf'}>
                          <span className="time">{s.starts_at.slice(0, 5)}</span>
                          {s.notebook ? <NotebookDot tint={s.notebook.tint} /> : null}
                          <span className="grow">{s.notebook?.name ?? 'Class'}</span>
                          <span className="muted">{s.room}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section className="section">
                <h2 className="label">picked up recently</h2>
                <NoteList cards={notes.slice(0, 6).map(cardOf)} />
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
