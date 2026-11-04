import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from './Icon';
import { outlineOf } from '@jot/core/outline';
import { c, f } from '@jot/core/theme/tokens';

type ReadingNote = { id: string; title: string; body: string; subtitle?: string };

/** A compact index that stays above the reading pane while the page scrolls. */
export function ReadingNavigation({ notes, currentId, onNote, onSection, fillHeight = false }: {
  notes: ReadingNote[];
  fillHeight?: boolean;
  currentId?: string;
  onNote: (id: string) => void;
  onSection: (noteId: string, blockIndex: number) => void;
}) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => notes.map((note) => ({ note, headings: outlineOf(note.body) })), [notes]);
  const q = query.trim().toLocaleLowerCase();
  const visible = groups.map(({ note, headings }) => ({ note,
    headings: `${note.title} ${note.subtitle ?? ''}`.toLocaleLowerCase().includes(q)
      ? headings : headings.filter((heading) => heading.title.toLocaleLowerCase().includes(q)),
  })).filter(({ note, headings }) => headings.length || `${note.title} ${note.subtitle ?? ''}`.toLocaleLowerCase().includes(q));

  return (
    <View style={[styles.root, fillHeight && { flex: 1 }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Contents</Text>
        <Text style={styles.meta}>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</Text>
      </View>
      <View style={styles.searchField}>
        <View accessible={false} pointerEvents="none"><Icon name="search" size={18} color={c.n700} strokeWidth={2} /></View>
        <TextInput accessibilityLabel="Find notes or headings"
            placeholder="Find notes or headings…" placeholderTextColor={c.n600}
            value={query} onChangeText={setQuery} style={styles.search} autoCorrect={false}
            onKeyPress={(event) => { if (event.nativeEvent.key === 'Escape') setQuery(''); }} />
      </View>
          <ScrollView {...(Platform.OS === 'web' ? { dataSet: { jotScrollbar: 'contents' } } : {})}
            style={fillHeight ? { flex: 1 } : { maxHeight: 240 }} keyboardShouldPersistTaps="handled">
            {visible.map(({ note, headings }) => (
              <View key={note.id} style={styles.group}>
              <Pressable key={note.id} accessibilityRole="button" accessibilityState={{ selected: note.id === currentId }}
                onPress={() => onNote(note.id)}
                style={[styles.row, note.id === currentId && { backgroundColor: c.a100 }]}>
                <Text style={styles.noteTitle}>{note.title || 'Untitled note'}</Text>
                {note.subtitle ? <Text style={styles.meta}>{note.subtitle}</Text> : null}
              </Pressable>
            {headings.map((heading) => (
              <Pressable key={heading.blockIndex} accessibilityRole="button"
                accessibilityLabel={`Jump to ${heading.title}`}
                onPress={() => onSection(note.id, heading.blockIndex)}
                style={[styles.row, { paddingLeft: 22 + (heading.level - 1) * 14 }]}>
                <Text style={{ fontFamily: heading.level <= 2 ? f.b600 : f.b400,
                  fontSize: [0, 17, 15, 13.5, 12.5][heading.level],
                  lineHeight: [0, 23, 21, 20, 19][heading.level], color: heading.level <= 2 ? c.n800 : c.n700 }}>
                  {heading.title}
                </Text>
              </Pressable>
            ))}
              </View>
            ))}
            {!visible.length ? (
              <Text style={styles.empty}>{q ? 'No matching notes or headings.' : 'No notes yet.'}</Text>
            ) : null}
          </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', backgroundColor: c.surface, borderWidth: 1, borderColor: c.n300, borderRadius: 20, padding: 12, gap: 10, minHeight: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  heading: { fontFamily: f.b800, fontSize: 16, color: c.text },
  searchField: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.bg, paddingLeft: 12, borderRadius: 12 },
  search: { flex: 1, minWidth: 0, fontFamily: f.b500, fontSize: 14, color: c.text, paddingVertical: 12, paddingRight: 12, borderRadius: 12 },
  row: { minHeight: 44, justifyContent: 'center', gap: 3, borderRadius: 12, padding: 12 },
  group: { paddingBottom: 12, marginBottom: 10, borderBottomWidth: 1, borderColor: c.n300 },
  noteTitle: { fontFamily: f.b800, fontSize: 19, lineHeight: 25, color: c.text },
  meta: { fontFamily: f.b400, fontSize: 12, color: c.n700 },
  empty: { padding: 12, fontFamily: f.b400, fontSize: 13, lineHeight: 20, color: c.n700 },
});
