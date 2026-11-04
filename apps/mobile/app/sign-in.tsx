import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Blob } from '../components/Blob';
import { LogoLockup } from '../components/Logo';
import { useAuth } from '@jot/core/auth';
import { c, f, shadow } from '@jot/core/theme/tokens';

type Mode = 'in' | 'up';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError('An email and a password of at least six characters, please.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password, name || email.split('@')[0]);
        if (needsConfirmation) {
          setNotice('Check your inbox to confirm the address, then sign in.');
          setMode('in');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 30,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 30,
          justifyContent: 'space-between',
          gap: 28,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Blob size={220} color={c.a200} style={styles.blobRight} />
        <Blob size={160} color={c.g200} opacity={0.85} style={styles.blobLeft} />

        <View style={{ gap: 14 }}>
          <LogoLockup markSize={58} wordSize={26} />
          <Text style={styles.brandText}>class notes, linked</Text>
          <Text style={styles.title}>
            {mode === 'in' ? 'Open your notebooks' : 'Start your notebooks'}
          </Text>
          <Text style={styles.blurb}>
            {mode === 'in'
              ? 'Notes, links and tags sync through Supabase, so they follow you between phone and desktop.'
              : 'One account, every subject. We will fill the first five notebooks so you can see how it reads.'}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {mode === 'up' ? (
            <Field
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="Marta Kowalska"
              autoCapitalize="words"
            />
          ) : null}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@university.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least six characters"
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={busy}
            style={({ pressed }) => [styles.cta, (pressed || busy) && { backgroundColor: c.a600 }]}
          >
            {busy ? (
              <ActivityIndicator color={c.paper} />
            ) : (
              <Text style={styles.ctaText}>{mode === 'in' ? 'Sign in' : 'Create account'}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')} hitSlop={8}>
            <Text style={styles.switch}>
              {mode === 'in' ? 'No account yet? Make one' : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={c.n500}
        style={styles.input}
        selectionColor={c.accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.a100 },
  blobRight: { position: 'absolute', right: -80, top: 90 },
  blobLeft: { position: 'absolute', left: -70, bottom: 120 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: {
    fontFamily: f.b800,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: c.a800,
  },
  title: { fontFamily: f.head, fontSize: 34, lineHeight: 40, color: c.a900 },
  blurb: { fontFamily: f.b400, fontSize: 15, lineHeight: 24, color: c.a800, maxWidth: 320 },
  label: { fontFamily: f.b700, fontSize: 12, color: c.a800, paddingLeft: 4 },
  input: {
    backgroundColor: c.paper,
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 18,
    fontFamily: f.b500,
    fontSize: 15,
    color: c.text,
    ...shadow.sm,
  },
  cta: {
    backgroundColor: c.accent,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
    ...shadow.md,
  },
  ctaText: { fontFamily: f.b700, fontSize: 16, color: c.paper },
  switch: { fontFamily: f.b600, fontSize: 13.5, color: c.a700, textAlign: 'center', paddingVertical: 6 },
  error: { fontFamily: f.b600, fontSize: 13, color: c.a800, backgroundColor: c.a200, borderRadius: 16, padding: 12 },
  notice: { fontFamily: f.b600, fontSize: 13, color: c.g800, backgroundColor: c.g200, borderRadius: 16, padding: 12 },
});
