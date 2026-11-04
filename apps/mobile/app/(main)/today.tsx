import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Kicker, NoteRow, Screen } from '../../components/ui';
import { useAuth } from '@jot/core/auth';
import { useStore } from '@jot/core/store';
import { greeting, spelled, todayLabel } from '@jot/core/time';
import { c, f, shadow, tintOf } from '@jot/core/theme/tokens';

export default function Today() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { notes, notebooks, loading, cardOf, todaysClasses, seedDemoContent, createNotebook } = useStore();
  const [seeding, setSeeding] = useState(false);

  const classes = todaysClasses();
  const recent = notes.slice(0, 4);
  const firstName = (profile?.full_name || user?.email?.split('@')[0] || 'there').split(' ')[0];

  if (loading && !notes.length && !notebooks.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (!notebooks.length) {
    return (
      <Screen>
        <Text style={styles.hello}>
          Hello,{'\n'}
          {firstName}
        </Text>
        <Text style={styles.sub}>Nothing filed yet. Start from a full term, or from nothing.</Text>
        <Pressable
          disabled={seeding}
          onPress={async () => {
            setSeeding(true);
            await seedDemoContent();
            setSeeding(false);
          }}
          style={({ pressed }) => [styles.primary, pressed && { backgroundColor: c.a600 }]}
        >
          {seeding ? (
            <ActivityIndicator color={c.paper} />
          ) : (
            <Text style={styles.primaryText}>Fill five notebooks with a sample term</Text>
          )}
        </Pressable>
        <Pressable
          onPress={async () => {
            const nb = await createNotebook({ name: 'First notebook', code: 'NEW-101', prof: '', tint: 0 });
            if (nb) router.push(`/notebook/${nb.id}`);
          }}
          style={({ pressed }) => [styles.secondary, pressed && { backgroundColor: c.n300 }]}
        >
          <Text style={styles.secondaryText}>Start with one empty notebook</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={styles.hello}>
          {greeting()}
          {'\n'}
          {firstName}
        </Text>
        <Text style={styles.sub}>
          {todayLabel()} ·{' '}
          {classes.length ? `${spelled(classes.length)} ${classes.length === 1 ? 'class' : 'classes'}` : 'no classes'}
        </Text>
      </View>

      {classes.length ? (
        <View style={{ gap: 9 }}>
          {classes.map((s) => {
            const tone = tintOf(s.notebook?.tint ?? 0);
            return (
              <Pressable
                key={s.id}
                onPress={() => s.notebook && router.push(`/notebook/${s.notebook.id}`)}
                style={[styles.class, { backgroundColor: tone.soft }]}
              >
                <Text style={[styles.classTime, { color: tone.dark }]}>
                  {s.starts_at.slice(0, 5).replace(/^0/, '')}
                </Text>
                <View style={[styles.dot, { backgroundColor: tone.tint }]} />
                <Text style={styles.className} numberOfLines={1}>
                  {s.notebook?.name ?? 'Class'}
                </Text>
                <Text style={styles.classRoom}>{s.room}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 11 }}>
        <Kicker>Picked up recently</Kicker>
        {recent.map((n) => (
          <NoteRow key={n.id} card={cardOf(n)} onPress={() => router.push(`/note/${n.id}`)} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  hello: { fontFamily: f.head, fontSize: 31, lineHeight: 36, color: c.text },
  sub: { fontFamily: f.b500, fontSize: 13.5, color: c.n600 },
  class: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 22,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  classTime: { fontFamily: f.b800, fontSize: 13, width: 42 },
  dot: { width: 9, height: 9, borderRadius: 99 },
  className: { flex: 1, fontFamily: f.b700, fontSize: 14, color: c.text },
  classRoom: { fontFamily: f.b600, fontSize: 12, color: c.n600 },
  primary: {
    backgroundColor: c.accent,
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    ...shadow.md,
  },
  primaryText: { fontFamily: f.b700, fontSize: 15, color: c.paper },
  secondary: { backgroundColor: c.n200, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  secondaryText: { fontFamily: f.b700, fontSize: 14, color: c.n800 },
});
