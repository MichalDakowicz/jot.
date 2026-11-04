import React from 'react';
import { useNavigate, useParams } from 'react-router';

import { useStore } from '@jot/core/store';

import { ClassTimes } from '../components/ClassTimes';
import { Icon } from '../components/Icon';
import { NoteList } from '../components/NoteList';
import { NotebookDot } from '../components/NotebookDot';
import { PublicLink } from '../components/PublicLink';
import { TopBar } from '../components/Shell';

export function NotebookPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notebookById, notesOf, cardOf, createNote, deleteNotebook } = useStore();
  const nb = notebookById(id);

  if (!nb) {
    return (
      <>
        <TopBar crumbs={<span className="here">not found</span>} />
        <div className="page"><p className="muted">This notebook is not here.</p></div>
      </>
    );
  }
  const notes = notesOf(nb.id);

  return (
    <>
      <TopBar
        crumbs={<><NotebookDot tint={nb.tint} /> <span className="here">{nb.name}/</span></>}
        actions={<>
          <PublicLink kind="notebook" id={nb.id} published={!!nb.is_public} />
          <button className="chip" onClick={async () => {
            const note = await createNote(nb.id);
            if (note) navigate(`/note/${note.id}`);
          }}><Icon name="plus" size={14} /> note</button>
        </>}
      />
      <div className="content">
        <div className="page">
          <h1 className="page-title">{nb.name}</h1>
          <p className="muted">{[nb.code, nb.prof].filter(Boolean).join(' · ') || ' '}</p>
          <section className="section">
            <h2 className="label">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</h2>
            <NoteList cards={notes.map(cardOf)} showNotebook={false} />
          </section>
          <ClassTimes notebookId={nb.id} />
          <section className="section danger-zone">
            <button className="button danger" onClick={async () => {
              if (!window.confirm(`Delete “${nb.name}” and its ${notes.length} notes? This cannot be undone.`)) return;
              await deleteNotebook(nb.id);
              navigate('/shelf', { replace: true });
            }}>Delete this notebook</button>
          </section>
        </div>
      </div>
    </>
  );
}
