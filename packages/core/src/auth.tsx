import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase, supabaseConfigured } from './client';
import type { Profile } from './types';

type AuthValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  avatarUrl: string | null;
  ready: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  /**
   * Starts Google sign-in and returns the provider URL. A browser follows it
   * itself; a phone passes `skipBrowserRedirect` and opens it in an auth session.
   */
  signInWithGoogle: (redirectTo: string, skipBrowserRedirect?: boolean) => Promise<string | null>;
  signOut: () => Promise<void>;
  saveProfile: (patch: Partial<Pick<Profile, 'full_name' | 'year_label' | 'avatar_path'>>) => Promise<void>;
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(!supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async (userId: string, email: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, year_label, avatar_path')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setProfile(data as Profile);
      return data as Profile;
    }

    // The signup trigger normally creates this row; insert a fallback so the
    // app still works on projects where the trigger has not been applied.
    const fallback: Profile = {
      id: userId,
      full_name: email.split('@')[0],
      year_label: 'First year',
      avatar_path: null,
    };
    await supabase.from('profiles').upsert(fallback);
    setProfile(fallback);
    return fallback;
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      setAvatarUrl(null);
      return;
    }
    loadProfile(uid, session!.user.email ?? '');
  }, [session?.user?.id, loadProfile]);

  useEffect(() => {
    const path = profile?.avatar_path;
    if (!path) {
      setAvatarUrl(null);
      return;
    }
    let alive = true;
    supabase.storage
      .from('avatars')
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (alive) setAvatarUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [profile?.avatar_path]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      avatarUrl,
      ready,
      configured: supabaseConfigured,

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      },

      async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },

      async signInWithGoogle(redirectTo, skipBrowserRedirect = false) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect },
        });
        if (error) throw error;
        return data.url;
      },

      async signOut() {
        await supabase.auth.signOut();
      },

      async saveProfile(patch) {
        const uid = session?.user?.id;
        if (!uid) return;
        const next = { ...(profile ?? { id: uid, full_name: '', year_label: '', avatar_path: null }), ...patch, id: uid };
        setProfile(next as Profile);
        const { error } = await supabase.from('profiles').upsert(next);
        if (error) throw error;
      },

      async reloadProfile() {
        const uid = session?.user?.id;
        if (uid) await loadProfile(uid, session?.user.email ?? '');
      },
    }),
    [session, profile, avatarUrl, ready, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
