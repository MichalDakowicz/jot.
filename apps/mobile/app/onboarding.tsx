import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Blob } from '../components/Blob';
import { LogoWord } from '../components/Logo';
import { useOnboarding } from '../lib/onboarding';
import { ONBOARDING } from '@jot/core/seed';
import { c, f, shadow } from '@jot/core/theme/tokens';

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { markSeen } = useOnboarding();
  const [step, setStep] = useState(0);
  const card = ONBOARDING[step];

  async function finish() {
    await markSeen();
    router.replace('/sign-in');
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 30 }]}>
      <Blob size={250} color={c.a200} style={styles.blobRight} />
      <Blob size={180} color={c.g200} opacity={0.85} style={styles.blobLeft} />

      <View style={styles.head}>
        <LogoWord size={22} color={c.a900} stopColor={c.accent} />
        <Pressable onPress={finish} hitSlop={10}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.step}>{card.step}</Text>
        <Text style={styles.title}>{card.title}</Text>
        <Text style={styles.blurb}>{card.body}</Text>
      </View>

      <View style={{ gap: 20 }}>
        <View style={styles.dots}>
          {ONBOARDING.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step ? { width: 34, backgroundColor: c.accent } : { backgroundColor: c.a300 },
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={() => (step >= ONBOARDING.length - 1 ? finish() : setStep(step + 1))}
          style={({ pressed }) => [styles.cta, pressed && { backgroundColor: c.a600 }]}
        >
          <Text style={styles.ctaText}>{card.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: c.a100,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  blobRight: { position: 'absolute', right: -70, top: 120 },
  blobLeft: { position: 'absolute', left: -60, bottom: 190 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { fontFamily: f.b700, fontSize: 13, color: c.a700 },
  body: { gap: 16 },
  step: {
    fontFamily: f.b800,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: c.a700,
  },
  title: { fontFamily: f.head, fontSize: 40, lineHeight: 45, color: c.a900 },
  blurb: { fontFamily: f.b400, fontSize: 15.5, lineHeight: 25, color: c.a800, maxWidth: 300 },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  cta: {
    backgroundColor: c.accent,
    borderRadius: 999,
    paddingVertical: 19,
    alignItems: 'center',
    ...shadow.md,
  },
  ctaText: { fontFamily: f.b700, fontSize: 16, color: c.paper },
});
