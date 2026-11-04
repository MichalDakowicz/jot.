import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Blob } from '../../components/Blob';
import { LinkMap } from '../../components/LinkMap';
import { Empty, Screen, Title } from '../../components/ui';
import { useStore } from '@jot/core/store';
import { c, f, shadow, tintOf } from '@jot/core/theme/tokens';

export default function Graph() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { notebooks, notes } = useStore();

  const size = Math.min(width - 52, 360);

  return (
    <Screen gap={16}>
      <Title>Link map</Title>
      <Text style={styles.blurb}>
        Every <Text style={{ fontFamily: f.b800 }}>@</Text> mention is an edge. Tap a note to open it.
      </Text>

      {notes.length ? (
        <View style={styles.frame}>
          <LinkMap
            size={size}
            notebooks={notebooks}
            notes={notes}
            onPick={(id) => router.push(`/note/${id}`)}
          />
        </View>
      ) : (
        <Empty text="Write two notes and link them with @ to see the map fill in." />
      )}

      <View style={styles.legend}>
        {notebooks.map((nb) => (
          <View key={nb.id} style={styles.legendItem}>
            <Blob size={9} color={tintOf(nb.tint).tint} />
            <Text style={styles.legendText}>{nb.name}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  blurb: { fontFamily: f.b400, fontSize: 13, lineHeight: 21, color: c.n600 },
  frame: {
    borderRadius: 34,
    backgroundColor: c.n100,
    padding: 6,
    alignItems: 'center',
    overflow: 'hidden',
    ...shadow.sm,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: c.n200,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  legendText: { fontFamily: f.b700, fontSize: 11.5, color: c.n700 },
});
