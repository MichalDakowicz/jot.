import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Blob } from './Blob';
import { Icon } from './Icon';
import { tagsOf, withTag, withoutTag } from '../lib/tags';
import { relative } from '../lib/time';
import type { Note, Notebook } from '../lib/types';
import { c, f, shadow, tintOf } from '../theme/tokens';

type Props = {
  note: Note;
  notebook: Notebook | undefined;
  /** With these three the row can be changed, which is what the editor wants. */
  notebooks?: Notebook[];
  onMove?: (notebookId: string) => void;
  onTags?: (tags: string[]) => void;
};

/**
 * The row under a note's title: its notebook, when it was edited, its tags.
 *
 * On the note it reads, and leads off to the notebook or to the tag. In the
 * editor the notebook can be swapped and tags added and taken off — tags live
 * here rather than in the text, so they can be sorted by without touching it.
 */
export function NoteMeta({ note, notebook, notebooks, onMove, onTags }: Props) {
  const router = useRouter();
  const editable = !!onTags;
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const tags = tagsOf(note);
  const tone = tintOf(notebook?.tint ?? 0);

  function save(next: string[]) {
    if (next !== tags) onTags?.(next);
  }

  /** A comma files what came before it, so "exam, lab" is two tags. */
  function type(text: string) {
    const parts = text.split(',');
    if (parts.length > 1) save(parts.slice(0, -1).reduce(withTag, tags));
    setDraft(parts[parts.length - 1]);
  }

  function file(keepOpen: boolean) {
    save(withTag(tags, draft));
    setDraft('');
    if (!keepOpen) setAdding(false);
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          if (editable) setPicking(true);
          else if (notebook) router.push(`/notebook/${notebook.id}`);
        }}
        accessibilityLabel={editable ? 'Move to another notebook' : undefined}
        style={({ pressed }) => [styles.chip, { backgroundColor: tone.soft }, pressed && styles.pressed]}
      >
        <Blob size={10} color={tone.tint} />
        <Text style={[styles.chipText, { color: tone.dark }]} numberOfLines={1}>
          {notebook?.name ?? 'Notebook'}
        </Text>
      </Pressable>

      <Text style={styles.edited}>Edited {relative(note.updated_at)}</Text>

      {tags.map((t) => (
        <Pressable
          key={t}
          onPress={() =>
            editable ? save(withoutTag(tags, t)) : router.push({ pathname: '/tags', params: { tag: t } })
          }
          accessibilityLabel={editable ? `Take off #${t}` : undefined}
          style={({ pressed }) => [styles.chip, styles.tag, pressed && styles.pressed]}
        >
          <Text style={[styles.chipText, { color: c.a700 }]}>#{t}</Text>
          {editable ? <Text style={styles.drop}>×</Text> : null}
        </Pressable>
      ))}

      {editable && adding ? (
        <TextInput
          autoFocus
          value={draft}
          onChangeText={type}
          onSubmitEditing={() => file(true)}
          onBlur={() => file(false)}
          submitBehavior="submit"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="tag"
          placeholderTextColor={c.n400}
          selectionColor={c.accent}
          style={[styles.chip, styles.tag, styles.input]}
        />
      ) : null}
      {editable && !adding ? (
        <Pressable
          onPress={() => setAdding(true)}
          style={({ pressed }) => [styles.chip, styles.add, pressed && styles.pressed]}
        >
          <Text style={[styles.chipText, { color: c.n600 }]}>+ tag</Text>
        </Pressable>
      ) : null}

      {editable ? (
        <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
          <Pressable style={styles.backdrop} onPress={() => setPicking(false)} />
          <View style={styles.dialogWrap} pointerEvents="box-none">
            <View style={styles.dialog}>
              <Text style={styles.dialogTitle}>Move to</Text>
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 4 }}>
                {(notebooks ?? []).map((nb) => {
                  const t = tintOf(nb.tint);
                  const here = nb.id === notebook?.id;
                  return (
                    <Pressable
                      key={nb.id}
                      onPress={() => {
                        setPicking(false);
                        if (!here) onMove?.(nb.id);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        here && { backgroundColor: t.soft },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Blob size={22} color={t.tint} />
                      <Text style={styles.optionText} numberOfLines={1}>
                        {nb.name}
                      </Text>
                      {here ? <Icon name="check" size={16} color={t.dark} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    maxWidth: '100%',
  },
  chipText: { fontFamily: f.b700, fontSize: 11.5 },
  pressed: { opacity: 0.7 },
  edited: { fontFamily: f.b600, fontSize: 11.5, color: c.n500, marginHorizontal: 2 },
  tag: { backgroundColor: c.a100 },
  drop: { fontFamily: f.b700, fontSize: 13, lineHeight: 14, color: c.a700, opacity: 0.6 },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.n300, paddingVertical: 3.5 },
  input: {
    minWidth: 72,
    fontFamily: f.b700,
    fontSize: 11.5,
    color: c.a700,
    paddingVertical: 5,
  },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(46,43,37,0.34)' },
  dialogWrap: { flex: 1, justifyContent: 'center', padding: 22 },
  dialog: { backgroundColor: c.paper, borderRadius: 32, padding: 22, gap: 11, ...shadow.lg },
  dialogTitle: { fontFamily: f.head, fontSize: 22, color: c.text, marginBottom: 2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionText: { flex: 1, fontFamily: f.b700, fontSize: 14.5, color: c.text },
});
