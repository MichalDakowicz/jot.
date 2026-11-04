import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@jot/core/client';
import { tokensFromRedirect } from '@jot/core/oauth';

/**
 * Google sign-in in the system browser sheet. Supabase sends the browser back
 * to jot://auth/callback with the session in the fragment, and the session is
 * set from that. Resolves false when the sheet is closed without signing in.
 */
export async function signInWithGoogle(start: (redirectTo: string, skip: boolean) => Promise<string | null>): Promise<boolean> {
  const redirectTo = Linking.createURL('auth/callback');
  const url = await start(redirectTo, true);
  if (!url) throw new Error('Google sign-in is not available right now.');
  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (result.type !== 'success') return false;
  const returned = tokensFromRedirect(result.url);
  if (!returned) throw new Error('Google did not send a session back. Try again.');
  if (!returned.ok) throw new Error(returned.error);
  const { error } = await supabase.auth.setSession({ access_token: returned.access_token, refresh_token: returned.refresh_token });
  if (error) throw error;
  return true;
}
