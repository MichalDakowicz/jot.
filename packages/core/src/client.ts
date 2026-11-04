import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase clients the shared store and auth talk to. Each app builds its
 * own (session storage differs between a phone and a browser) and hands them
 * over once, before the first render.
 */
export let supabase: SupabaseClient;
/** Public pages must exercise anonymous RLS even when the owner is signed in. */
export let publicSupabase: SupabaseClient;
export let supabaseConfigured = false;

type Resume = (callback: () => void) => () => void;
let resume: Resume = () => () => {};

export function configureClient(options: {
  client: SupabaseClient;
  publicClient: SupabaseClient;
  configured: boolean;
  /** Calls back when the app comes back to the foreground; returns an unsubscribe. */
  onForeground: Resume;
}) {
  supabase = options.client;
  publicSupabase = options.publicClient;
  supabaseConfigured = options.configured;
  resume = options.onForeground;
}

export const onForeground: Resume = (callback) => resume(callback);
