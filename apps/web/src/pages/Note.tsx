import React from 'react';
import { Navigate, useParams } from 'react-router';

import { useStore } from '@jot/core/store';

import { TopBar } from '../components/Shell';

/**
 * A link to one note. Notes live inside their notebook's document, so the
 * link opens the notebook at that note; `/note/<id>` stays shareable.
 */
export function NotePage() {
  const { id } = useParams();
  const { noteById, loading } = useStore();
  const note = noteById(id);
  if (note) return <Navigate to={`/notebook/${note.notebook_id}?note=${note.id}`} replace />;
  return (
    <>
      <TopBar crumbs={<span className="here">{loading ? 'opening…' : 'not found'}</span>} />
      {loading ? null : <div className="page"><p className="muted">This note is not here. It may have been deleted on another device.</p></div>}
    </>
  );
}
