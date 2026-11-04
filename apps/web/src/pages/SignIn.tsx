import React, { useState } from 'react';

import { useAuth } from '@jot/core/auth';

import { LogoMark } from '../components/Logo';

/** Google, or email and password; one form for both signing in and signing up. */
export function SignIn() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'in') await signIn(email, password);
      else {
        const { needsConfirmation } = await signUp(email, password, name);
        if (needsConfirmation) setMessage('Check your inbox for the confirmation link, then sign in.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMessage(null);
    try {
      const next = new URLSearchParams(location.search).get('next');
      await signInWithGoogle(location.origin + (next?.startsWith('/') ? next : '/today'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Google sign-in is not available right now.');
    }
  }

  return (
    <div className="solo">
      <header className="solo-head"><span className="brand"><LogoMark size={26} /></span></header>
      <main className="solo-body narrow">
        <h1 className="solo-title">{mode === 'in' ? 'Sign in' : 'Make an account'}</h1>
        <p className="muted">class notes, linked</p>
        <button className="button google" onClick={google}>Continue with Google</button>
        <div className="or"><span>or</span></div>
        <form className="form" onSubmit={submit}>
          {mode === 'up' ? <input className="field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" autoComplete="name" /> : null}
          <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" autoComplete="email" required />
          <input className="field" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6} />
          {message ? <p className="hint">{message}</p> : null}
          <button className="button primary" disabled={busy}>{busy ? '…' : mode === 'in' ? 'Sign in' : 'Sign up'}</button>
        </form>
        <button className="link-button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'New here? Make an account' : 'Have an account? Sign in'}
        </button>
      </main>
    </div>
  );
}
