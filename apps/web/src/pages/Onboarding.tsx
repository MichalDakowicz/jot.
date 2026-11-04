import React, { useState } from 'react';
import { useNavigate } from 'react-router';

import { ONBOARDING } from '@jot/core/seed';

import { LogoMark, Wordmark } from '../components/Logo';

const KEY = 'marginalia.onboarded';

export function onboardingSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch { /* A private window sees the cards again next visit. */ }
}

// On the web the marks never hide: they stay, faint, beside what they set.
const CARDS = ONBOARDING.map((card, i) => i === 1
  ? { ...card, body: 'Headings, lists, checkboxes and quotes take their shape as you type, with their marks kept faint beside them.' }
  : card);

export function Onboarding() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const card = CARDS[i];
  const done = () => {
    markSeen();
    navigate('/sign-in' + location.search, { replace: true });
  };

  return (
    <div className="solo">
      <header className="solo-head">
        <span className="brand"><LogoMark size={22} /><Wordmark /></span>
        <button className="link-button" onClick={done}>skip</button>
      </header>
      <main className="solo-body">
        <p className="label">{card.step}</p>
        <h1 className="solo-title">{card.title}</h1>
        <p className="muted solo-text">{card.body}</p>
        <div className="steps" aria-hidden="true">
          {CARDS.map((_, k) => <span key={k} className={'step' + (k === i ? ' on' : '')} />)}
        </div>
        <button className="button primary" onClick={() => (i < CARDS.length - 1 ? setI(i + 1) : done())}>{card.cta}</button>
      </main>
    </div>
  );
}
