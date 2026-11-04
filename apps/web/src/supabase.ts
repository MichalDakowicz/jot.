import { createClient } from '@supabase/supabase-js';

import { configureClient } from '@jot/core/client';

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

configureClient({
  configured: url.length > 0 && anonKey.length > 0,
  // The OAuth return lands on this origin with the session in the URL.
  client: createClient(url || 'http://localhost', anonKey || 'public-anon-key', {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }),
  publicClient: createClient(url || 'http://localhost', anonKey || 'public-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'jot-public' },
  }),
  // A tab shown again may have slept through Realtime; that is the cue to catch up.
  onForeground(callback) {
    const onVisible = () => {
      if (document.visibilityState === 'visible') callback();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  },
});

export { publicSupabase, supabase, supabaseConfigured } from '@jot/core/client';
