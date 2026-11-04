import React, { useEffect, useRef, useState } from 'react';

import { initialsOf, useAuth } from '@jot/core/auth';
import { useStore } from '@jot/core/store';

import { TopBar } from '../components/Shell';
import { supabase } from '../supabase';
import { useScheme, type SchemeChoice } from '../theme';

/** Picture, name and year, theme, notebook export, sign out. */
export function ProfilePage() {
  const { user, profile, avatarUrl, saveProfile, signOut } = useAuth();
  const { notebooks, exportNotebook } = useStore();
  const { choice, choose } = useScheme();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [year, setYear] = useState(profile?.year_label ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile?.full_name ?? '');
    setYear(profile?.year_label ?? '');
  }, [profile?.full_name, profile?.year_label]);

  async function upload(picked: File | undefined) {
    if (!picked || !user) return;
    setMessage(null);
    const path = `${user.id}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('avatars').upload(path, picked, { contentType: picked.type || 'image/jpeg', upsert: true });
    if (error) return setMessage(error.message);
    await saveProfile({ avatar_path: path });
    setMessage('Picture updated.');
  }

  async function runExport(notebookId: string) {
    const nb = notebooks.find((b) => b.id === notebookId);
    const { markdown } = await exportNotebook(notebookId);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
    a.download = `${(nb?.name ?? 'notebook').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <TopBar crumbs={<span className="here">profile</span>} />
      <div className="content">
        <div className="page">
          <div className="profile-head">
            <button className="avatar" onClick={() => file.current?.click()} aria-label="Change picture">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initialsOf(profile?.full_name || user?.email || '?')}</span>}
            </button>
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
            <div>
              <h1 className="page-title">{profile?.full_name || 'Your profile'}</h1>
              <p className="muted">{user?.email}</p>
            </div>
          </div>
          {message ? <p className="hint">{message}</p> : null}

          <form className="section form" onSubmit={async (e) => {
            e.preventDefault();
            await saveProfile({ full_name: name.trim(), year_label: year.trim() });
            setMessage('Saved.');
          }}>
            <h2 className="label">you</h2>
            <div className="field-row">
              <input className="field" value={name} placeholder="Name" aria-label="Name" onChange={(e) => setName(e.target.value)} />
              <input className="field" value={year} placeholder="Year, e.g. Year 2" aria-label="Year" onChange={(e) => setYear(e.target.value)} />
              <button className="button">Save</button>
            </div>
          </form>

          <section className="section">
            <h2 className="label">theme</h2>
            <div className="day-picks">
              {(['system', 'dark', 'light'] as SchemeChoice[]).map((s) => (
                <button key={s} className={'chip' + (choice === s ? ' on' : '')} aria-pressed={choice === s} onClick={() => choose(s)}>{s}</button>
              ))}
            </div>
          </section>

          <section className="section">
            <h2 className="label">export a notebook as markdown</h2>
            <ul className="rows">
              {notebooks.map((b) => (
                <li key={b.id}><button className="row-link" onClick={() => runExport(b.id)}><span className="grow">{b.name}</span><span className="muted">.md ↓</span></button></li>
              ))}
            </ul>
          </section>

          <section className="section">
            <button className="button" onClick={() => signOut()}>Sign out</button>
          </section>
        </div>
      </div>
    </>
  );
}
