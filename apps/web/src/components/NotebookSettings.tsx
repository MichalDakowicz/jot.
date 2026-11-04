import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { useStore } from '@jot/core/store';
import { TINTS } from '@jot/core/theme/tokens';
import type { Notebook } from '@jot/core/types';

import { ClassTimes } from './ClassTimes';
import { NotebookDot } from './NotebookDot';
import { PublicLink } from './PublicLink';

/** Everything about a notebook that is not its notes: name, course code, teacher, colour, times, sharing. */
export function NotebookSettings({ notebook, noteCount }: { notebook: Notebook; noteCount: number }) {
  const navigate = useNavigate();
  const { updateNotebook, deleteNotebook } = useStore();
  const [name, setName] = useState(notebook.name);
  const [code, setCode] = useState(notebook.code);
  const [prof, setProf] = useState(notebook.prof);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(notebook.name);
    setCode(notebook.code);
    setProf(notebook.prof);
  }, [notebook.id, notebook.name, notebook.code, notebook.prof]);

  const changed = name.trim() !== notebook.name || code.trim() !== notebook.code || prof.trim() !== notebook.prof;

  return (
    <section className="notebook-settings" aria-label="Notebook settings">
      <form className="form" onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await updateNotebook(notebook.id, { name: name.trim(), code: code.trim(), prof: prof.trim() });
        setSaved(true);
      }}>
        <h2 className="label">notebook</h2>
        <input className="field" value={name} placeholder="Name" aria-label="Name" onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        <div className="field-row">
          <input className="field" value={code} placeholder="Course code" aria-label="Course code" onChange={(e) => { setCode(e.target.value); setSaved(false); }} />
          <input className="field" value={prof} placeholder="Teacher" aria-label="Teacher" onChange={(e) => { setProf(e.target.value); setSaved(false); }} />
        </div>
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {TINTS.map((_, i) => (
            <button type="button" key={i} role="radio" aria-checked={notebook.tint === i} aria-label={`Colour ${i + 1}`}
              className={'swatch' + (notebook.tint === i ? ' on' : '')} onClick={() => updateNotebook(notebook.id, { tint: i })}>
              <NotebookDot tint={i} size={12} />
            </button>
          ))}
        </div>
        <div className="field-row">
          <button className="button primary" disabled={!changed || !name.trim()}>Save</button>
          {saved && !changed ? <span className="hint">saved</span> : null}
        </div>
      </form>

      <section className="section">
        <h2 className="label">public link</h2>
        <PublicLink kind="notebook" id={notebook.id} published={!!notebook.is_public} />
      </section>

      <ClassTimes notebookId={notebook.id} />

      <section className="section">
        <button className="button danger" onClick={async () => {
          if (!window.confirm(`Delete “${notebook.name}” and its ${noteCount} notes? This cannot be undone.`)) return;
          await deleteNotebook(notebook.id);
          navigate('/shelf', { replace: true });
        }}>Delete this notebook</button>
      </section>
    </section>
  );
}
