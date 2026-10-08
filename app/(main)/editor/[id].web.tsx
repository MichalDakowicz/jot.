import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoteMeta } from '../../../components/NoteMeta';
import { TiptapEditor } from '../../../components/TiptapEditor';
import { Empty, Screen } from '../../../components/ui';
import { useFittedDisplaySize } from '../../../lib/fit';
import { useIsWide } from '../../../lib/layout';
import { useStore } from '../../../lib/store';
import { c, f } from '../../../theme/tokens';

/**
 * The note editor on the web: Tiptap. Phones keep the native blocks in
 * [id].tsx — they mostly read, and change a line now and then — while a
 * browser is where notes are written, so it gets the full editor.
 *
 * What is stored does not change: the body is still the same markdown, read
 * into the editor on open and written back as it is edited (lib/tiptapDoc.ts).
 */
export default function WebEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const { noteById, notebookById, notebooks, notes, updateNote, flushSaves } = useStore();

  const note = noteById(id);
  const title = useFittedDisplaySize(note?.title ?? '', 27, 17);

  const linkable = useMemo(
    () =>
      notes
        .filter((n) => n.id !== id)
        .map((n) => ({ id: n.id, title: n.title, nbName: notebooks.find((b) => b.id === n.notebook_id)?.name ?? 'Notebook' })),
    [notes, notebooks, id],
  );

  if (!note) {
    return (
      <Screen>
        <Empty text="That note is gone." />
      </Screen>
    );
  }

  const noteId = note.id;

  async function done() {
    await flushSaves();
    router.replace(`/note/${noteId}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: 14,
          // So a short note still fills the screen and the count sits at its foot.
          flexGrow: 1,
          // The same measure as the note it turns into, so nothing shifts
          // sideways between reading and writing.
          paddingHorizontal: wide ? 52 : 20,
          maxWidth: wide ? 780 : undefined,
          width: '100%',
          alignSelf: 'center',
          gap: 10,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.editingPill}>
            <Text style={styles.editingText}>Editing</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={done} style={({ pressed }) => [styles.done, pressed && { backgroundColor: c.a600 }]}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <View onLayout={title.onLayout}>
          <TextInput
            value={note.title}
            onChangeText={(next) => updateNote(noteId, { title: next.replace(/[\r\n]+/g, ' ') })}
            placeholder="Title"
            placeholderTextColor={c.n400}
            selectionColor={c.accent}
            multiline
            submitBehavior="blurAndSubmit"
            style={[styles.title, { fontSize: title.fontSize, lineHeight: title.fontSize * 1.26 }]}
          />
        </View>

        <NoteMeta
          note={note}
          notebook={notebookById(note.notebook_id)}
          notebooks={notebooks}
          onMove={(notebookId) => updateNote(noteId, { notebook_id: notebookId })}
          onTags={(tags) => updateNote(noteId, { tags })}
        />

        {/* Keyed by note so moving to another note starts a fresh editor
            rather than carrying the last one's undo history over. */}
        <TiptapEditor
          key={noteId}
          markdown={note.body}
          notes={linkable}
          onChange={(body) => updateNote(noteId, { body })}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editingPill: { backgroundColor: c.a100, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  editingText: {
    fontFamily: f.b800,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: c.a700,
  },
  done: { backgroundColor: c.accent, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18 },
  doneText: { fontFamily: f.b700, fontSize: 13, color: c.paper },
  title: { fontFamily: f.head, color: c.text, paddingVertical: 2 },
});
