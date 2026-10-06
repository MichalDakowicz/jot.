import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../../components/Icon';
import { Markdown } from '../../../components/Markdown';
import { NoteMeta } from '../../../components/NoteMeta';
import { PaperDots } from '../../../components/PaperDots';
import { BackLink, Empty, Kicker, Screen } from '../../../components/ui';
import { confirmDestructive } from '../../../lib/confirm';
import { useFittedDisplaySize } from '../../../lib/fit';
import { useIsWide } from '../../../lib/layout';
import { useStore } from '../../../lib/store';
import { c, f, tintOf } from '../../../theme/tokens';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const wide = useIsWide();
  const { noteById, notebookById, mentionables, linksOf, backlinksOf, deleteNote } = useStore();

  const note = noteById(id);
  const title = useFittedDisplaySize(note?.title ?? '', 27, 17);

  if (!note) {
    return (
      <Screen>
        <BackLink label="Today" onPress={() => router.replace('/today')} />
        <Empty text="That note is gone." />
      </Screen>
    );
  }

  const nb = notebookById(note.notebook_id);
  const related = [
    ...linksOf(note).map((n) => ({ note: n, kind: 'Mentioned here', arrow: '→' })),
    ...backlinksOf(note)
      .filter((n) => !note.body.includes('@' + n.title))
      .map((n) => ({ note: n, kind: 'Links back', arrow: '←' })),
  ];

  function confirmDelete() {
    confirmDestructive({
      title: 'Delete this note?',
      message: 'This cannot be undone.',
      onConfirm: async () => {
        await deleteNote(note!.id);
        router.replace(nb ? `/notebook/${nb.id}` : '/today');
      },
    });
  }

  return (
    <Screen gap={14}>
      <PaperDots />

      <View style={styles.headRow}>
        <BackLink
          label={nb?.name ?? 'Back'}
          onPress={() => (nb ? router.replace(`/notebook/${nb.id}`) : router.replace('/today'))}
        />
        {wide ? (
          <>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => router.push(`/editor/${note.id}`)}
              style={({ pressed }) => [styles.editPill, pressed && { backgroundColor: c.n300 }]}
            >
              <Icon name="pen" size={15} color={c.n800} />
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      <Text
        onLayout={title.onLayout}
        style={[styles.title, { fontSize: title.fontSize, lineHeight: title.fontSize * 1.22 }]}
      >
        {note.title}
      </Text>

      <NoteMeta note={note} notebook={nb} />

      <Markdown
        source={note.body}
        mentions={mentionables}
        onMention={(noteId) => router.push(`/note/${noteId}`)}
      />

      {related.length ? (
        <View style={styles.linked}>
          <Kicker color={c.g700}>Linked notes</Kicker>
          {related.map(({ note: r, kind, arrow }) => {
            const tone = tintOf(notebookById(r.notebook_id)?.tint ?? 0);
            return (
              <Pressable
                key={`${kind}-${r.id}`}
                onPress={() => router.push(`/note/${r.id}`)}
                style={({ pressed }) => [styles.link, pressed && { backgroundColor: '#ffffff' }]}
              >
                <Text style={styles.arrow}>{arrow}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.linkTitle} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={styles.linkMeta}>
                    {kind} · {notebookById(r.notebook_id)?.name ?? 'Notebook'}
                  </Text>
                </View>
                <View style={[styles.dot, { backgroundColor: tone.tint }]} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable onPress={confirmDelete} style={styles.delete}>
        <Text style={styles.deleteText}>Delete this note</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 34 },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.n200,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  editText: { fontFamily: f.b700, fontSize: 13, color: c.n800 },
  title: { fontFamily: f.head, color: c.text },
  linked: {
    backgroundColor: c.g100,
    borderRadius: 28,
    padding: 18,
    gap: 10,
    marginTop: 6,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.paper,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  arrow: { fontFamily: f.b800, fontSize: 15, color: c.g600 },
  linkTitle: { fontFamily: f.b700, fontSize: 14, color: c.text },
  linkMeta: { fontFamily: f.b600, fontSize: 11.5, color: c.n500 },
  dot: { width: 9, height: 9, borderRadius: 99 },
  delete: { alignSelf: 'flex-start', paddingVertical: 10 },
  deleteText: { fontFamily: f.b600, fontSize: 12.5, color: c.n500 },
});
