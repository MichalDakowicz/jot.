import React from 'react';
import { Navigate } from 'react-router';

import { supabaseConfigured } from '../supabase';

const STEPS = [
  'Copy apps/web/.env.example to apps/web/.env.',
  'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the project URL and its anon key.',
  'Run supabase/schema.sql, then supabase/public-sharing.sql, in the SQL editor.',
  'Restart npm run web so Vite reads the new values.',
];

export function SetupPage() {
  if (supabaseConfigured) return <Navigate to="/" replace />;
  return (
    <div className="solo">
      <main className="solo-body">
        <p className="label">jot. · setup</p>
        <h1 className="solo-title">Point the app at your Supabase project</h1>
        <p className="muted">Sign-in, notes and files all live in Supabase; the app needs two values before it can start.</p>
        <ol className="setup-steps">{STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="muted">README.md has the same list, plus the SQL it refers to.</p>
      </main>
    </div>
  );
}
