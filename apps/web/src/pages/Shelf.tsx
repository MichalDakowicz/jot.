import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useStore } from '@jot/core/store';
import { TINTS } from '@jot/core/theme/tokens';

import { NotebookDot } from '../components/NotebookDot';
import { TopBar } from '../components/Shell';

/** Every notebook, and the form for a new one. */
export function ShelfPage() {
  const navigate = useNavigate();
  const { notebooks, notesOf, createNotebook } = useStore();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [prof, setProf] = useState('');
  const [tint, setTint] = useState(notebooks.length % TINTS.length);
  const [failed, setFailed] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setFailed(false);
    const nb = await createNotebook({ name: name.trim(), code: code.trim(), prof: prof.trim(), tint });
    if (!nb) return setFailed(true);
    navigate(`/notebook/${nb.id}`);
  }

  return (
    <>
      <TopBar crumbs={<span className="here">notebooks</span>} />
      <div className="content">
        <div className="page">
          <h1 className="page-title">Notebooks</h1>
          <ul className="rows">
            {notebooks.map((nb) => (
              <li key={nb.id}>
                <Link className="row-link" to={`/notebook/${nb.id}`}>
                  <NotebookDot tint={nb.tint} size={9} />
                  <span className="grow">{nb.name}</span>
                  <span className="muted">{[nb.code, nb.prof].filter(Boolean).join(' · ')}</span>
                  <span className="count">{notesOf(nb.id).length}</span>
                </Link>
              </li>
            ))}
          </ul>

          <form className="section form" onSubmit={create}>
            <h2 className="label">new notebook</h2>
            <input className="field" placeholder="Name, e.g. Organic chemistry" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
            <div className="field-row">
              <input className="field" placeholder="Course code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Course code" />
              <input className="field" placeholder="Teacher" value={prof} onChange={(e) => setProf(e.target.value)} aria-label="Teacher" />
            </div>
            <div className="swatches" role="radiogroup" aria-label="Colour">
              {TINTS.map((_, i) => (
                <button type="button" key={i} role="radio" aria-checked={tint === i} aria-label={`Colour ${i + 1}`}
                  className={'swatch' + (tint === i ? ' on' : '')} onClick={() => setTint(i)}>
                  <NotebookDot tint={i} size={12} />
                </button>
              ))}
            </div>
            {failed ? <p className="error">That notebook did not save. Try again in a moment.</p> : null}
            <button className="button primary" disabled={!name.trim()}>Create notebook</button>
          </form>
        </div>
      </div>
    </>
  );
}
