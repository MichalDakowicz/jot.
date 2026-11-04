import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { c, f } from '@jot/core/theme/tokens';

const STEPS = [
  'Create a project at supabase.com, then open Project Settings → API.',
  'Copy .env.example to .env in the project root.',
  'Paste the Project URL into EXPO_PUBLIC_SUPABASE_URL and the anon key into EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  'Run supabase/schema.sql in the SQL editor. It creates the tables, the row-level security policies and the two storage buckets.',
  'Restart the dev server with npx expo start -c so the new env vars are picked up.',
];

export default function Setup() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 26, paddingTop: insets.top + 30, gap: 18 }}
    >
      <Text style={styles.kicker}>Jot. · setup</Text>
      <Text style={styles.title}>Point the app at your Supabase project</Text>
      <Text style={styles.body}>
        Login, notes and file storage all live in Supabase, so the app needs two environment
        variables before it can start.
      </Text>
      <View style={{ gap: 12 }}>
        {STEPS.map((s, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>README.md has the same list, plus the SQL it refers to.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.a100 },
  kicker: {
    fontFamily: f.b800,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: c.a700,
  },
  title: { fontFamily: f.head, fontSize: 32, lineHeight: 38, color: c.a900 },
  body: { fontFamily: f.b400, fontSize: 15, lineHeight: 24, color: c.a800 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { fontFamily: f.b800, fontSize: 14, color: c.accent, width: 16, lineHeight: 22 },
  stepText: { flex: 1, fontFamily: f.b500, fontSize: 14.5, lineHeight: 22, color: c.a800 },
  note: { fontFamily: f.b500, fontSize: 13, color: c.a700, marginTop: 6 },
});
