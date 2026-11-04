import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Empty, Kicker, NoteRow, Screen, TagChip, Title } from '../../components/ui';
import { useStore } from '@jot/core/store';

export default function Tags() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tag?: string }>();
  const { tagCounts, notesWithTag, cardOf } = useStore();

  const initial = typeof params.tag === 'string' ? params.tag : tagCounts[0]?.name ?? '';
  const [active, setActive] = useState(initial);
  const tag = active || initial;
  const tagged = tag ? notesWithTag(tag) : [];

  return (
    <Screen gap={20}>
      <Title>Tags</Title>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tagCounts.map((t) => (
          <TagChip
            key={t.name}
            tag={t.name}
            count={t.count}
            active={t.name === tag}
            size={12 + Math.min(t.count, 4) * 1.6}
            onPress={() => setActive(t.name)}
          />
        ))}
      </View>

      <View style={{ gap: 11 }}>
        <Kicker>{tag ? `Tagged #${tag}` : 'No tags yet'}</Kicker>
        {tagged.length ? (
          tagged.map((n) => (
            <NoteRow key={n.id} card={cardOf(n)} onPress={() => router.push(`/note/${n.id}`)} />
          ))
        ) : (
          <Empty text="Type #something in a note and it shows up here." />
        )}
      </View>
    </Screen>
  );
}
