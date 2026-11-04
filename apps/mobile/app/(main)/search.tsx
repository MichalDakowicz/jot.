import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '../../components/Icon';
import { Empty, Kicker, NoteRow, Screen, TagChip, Title } from '../../components/ui';
import { useStore } from '@jot/core/store';
import { c, f, shadow } from '@jot/core/theme/tokens';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { search, cardOf, tagCounts } = useStore();
  const [q, setQ] = useState(typeof params.q === 'string' ? params.q : '');

  const results = search(q);

  return (
    <Screen gap={18}>
      <Title>Search</Title>

      <View style={styles.box}>
        <Icon name="search" size={18} color={c.n500} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Titles, text, #tags"
          placeholderTextColor={c.n500}
          selectionColor={c.accent}
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      <View style={styles.tags}>
        {tagCounts.map((t) => (
          <TagChip key={t.name} tag={t.name} onPress={() => setQ('#' + t.name)} />
        ))}
      </View>

      <View style={{ gap: 11 }}>
        <Kicker>
          {q.trim()
            ? `${results.length} ${results.length === 1 ? 'note' : 'notes'}`
            : 'Everything, newest first'}
        </Kicker>
        {results.length ? (
          results.map((n) => (
            <NoteRow key={n.id} card={cardOf(n)} onPress={() => router.push(`/note/${n.id}`)} />
          ))
        ) : (
          <Empty text="Nothing matches that yet." />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.n100,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 18,
    ...shadow.sm,
  },
  input: { flex: 1, fontFamily: f.b500, fontSize: 15, color: c.text, padding: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
});
