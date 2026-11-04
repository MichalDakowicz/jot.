import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { configureClient } from '@jot/core/client';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

configureClient({
  configured: url.length > 0 && anonKey.length > 0,
  client: createClient(url || 'http://localhost', anonKey || 'public-anon-key', {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }),
  publicClient: createClient(url || 'http://localhost', anonKey || 'public-anon-key', {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  }),
  // A phone drops its socket while it sleeps; coming back is the cue to catch up.
  onForeground(callback) {
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && last !== 'active') callback();
      last = next;
    });
    return () => sub.remove();
  },
});

export { publicSupabase, supabase, supabaseConfigured } from '@jot/core/client';
