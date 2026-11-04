import { useEffect, useState } from 'react';

import { INK, MONO, type Ink, type Scheme } from '@jot/core/theme/ink';

export type SchemeChoice = Scheme | 'system';

const KEY = 'jot.scheme';
const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

/** Every ink becomes a CSS variable, so stylesheets never hold a colour of their own. */
function cssFor(ink: Ink): string {
  return Object.entries(ink).map(([k, v]) => `--${kebab(k)}:${v};`).join('');
}

export function installTheme() {
  const style = document.createElement('style');
  style.textContent = `
    :root{--mono:${MONO.family};--h1:${MONO.h[0]}em;--h2:${MONO.h[1]}em;--h3:${MONO.h[2]}em;--h4:${MONO.h[3]}em;${cssFor(INK.light)}color-scheme:light}
    :root[data-scheme="dark"]{${cssFor(INK.dark)}color-scheme:dark}
  `;
  document.head.prepend(style);
  apply(readChoice());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(readChoice()));
}

function readChoice(): SchemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : 'system';
  } catch {
    return 'system';
  }
}

function resolve(choice: SchemeChoice): Scheme {
  if (choice !== 'system') return choice;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(choice: SchemeChoice) {
  const scheme = resolve(choice);
  document.documentElement.dataset.scheme = scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', INK[scheme].bg);
  window.dispatchEvent(new CustomEvent('jot-scheme'));
}

/** The scheme in force and a setter that remembers the choice for this browser. */
export function useScheme() {
  const [choice, setChoice] = useState<SchemeChoice>(readChoice);
  const [scheme, setScheme] = useState<Scheme>(() => resolve(readChoice()));
  useEffect(() => {
    const sync = () => setScheme(document.documentElement.dataset.scheme === 'dark' ? 'dark' : 'light');
    window.addEventListener('jot-scheme', sync);
    return () => window.removeEventListener('jot-scheme', sync);
  }, []);
  return {
    choice,
    scheme,
    choose(next: SchemeChoice) {
      try {
        if (next === 'system') localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, next);
      } catch { /* Private windows keep the choice for this visit only. */ }
      setChoice(next);
      apply(next);
    },
  };
}
