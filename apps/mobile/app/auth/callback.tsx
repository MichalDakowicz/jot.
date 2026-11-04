import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@jot/core/auth';
import { supabase } from '@jot/core/client';
import { tokensFromRedirect } from '@jot/core/oauth';
import { c, f } from '@jot/core/theme/tokens';

/**
 * Where Google sends the phone back. Android hands jot://auth/callback to the
 * app as well as to the sign-in sheet, so this screen can be the one that
 * receives it: it sets the session from the link if the sheet has not
 * already, then moves on to the notes.
 */
export default function AuthCallback() {
  const url = Linking.useURL();
  const router = useRouter();
  const { session } = useAuth();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      router.replace('/today');
      return;
    }
    if (!url) return;
    const returned = tokensFromRedirect(url);
    if (!returned) return;
    if (!returned.ok) {
      setProblem(returned.error);
      return;
    }
    supabase.auth
      .setSession({ access_token: returned.access_token, refresh_token: returned.refresh_token })
      .then(({ error }) => error && setProblem(error.message));
  }, [url, session, router]);

  useEffect(() => {
    if (!problem) return;
    const back = setTimeout(() => router.replace('/sign-in'), 2500);
    return () => clearTimeout(back);
  }, [problem, router]);

  return (
    <View style={styles.screen}>
      {problem ? <Text style={styles.text}>{problem}</Text> : <ActivityIndicator color={c.accent} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, padding: 30 },
  text: { fontFamily: f.b500, fontSize: 14, lineHeight: 22, color: c.text, textAlign: 'center' },
});
