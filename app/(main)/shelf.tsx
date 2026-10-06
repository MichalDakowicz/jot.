import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Blob } from '../../components/Blob';
import { Icon } from '../../components/Icon';
import { Pill, Screen, Title } from '../../components/ui';
import { useStore } from '../../lib/store';
import { c, f, shadow, TINTS, tintOf } from '../../theme/tokens';

export default function Shelf() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { notebooks, notes, createNotebook } = useStore();
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);
  /** A new notebook starts on the next colour along, not always the first. */
  const [draft, setDraft] = useState({ name: '', code: '', prof: '', tint: 0 });

  const cardWidth = (width - 40 - 13) / 2;

  async function save() {
    if (!draft.name.trim()) return;
    setFailed(false);
    const nb = await createNotebook({
      name: draft.name.trim(),
      code: draft.code.trim() || 'NEW',
      prof: draft.prof.trim(),
      tint: draft.tint,
    });
    // A refused save keeps the dialog, and what was typed into it, on screen.
    if (!nb) {
      setFailed(true);
      return;
    }
    setAdding(false);
    setDraft({ name: '', code: '', prof: '', tint: notebooks.length % TINTS.length });
    if (nb) router.push(`/notebook/${nb.id}`);
  }

  return (
    <>
      <Screen gap={20}>
        <Title>Notebooks</Title>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill
            label="Link map"
            tone="accent2"
            onPress={() => router.push('/graph')}
            icon={<Icon name="graph" size={14} color={c.g800} />}
          />
          <Pill label="All tags" onPress={() => router.replace('/tags')} />
        </View>

        <View style={styles.grid}>
          {notebooks.map((nb) => {
            const tone = tintOf(nb.tint);
            const count = notes.filter((n) => n.notebook_id === nb.id).length;
            return (
              <Pressable
                key={nb.id}
                onPress={() => router.push(`/notebook/${nb.id}`)}
                style={({ pressed }) => [
                  styles.card,
                  { width: cardWidth, backgroundColor: tone.soft },
                  pressed && shadow.md,
                ]}
              >
                <Blob size={104} color={tone.tint} opacity={0.55} style={styles.cardBlob} />
                <Text style={[styles.code, { color: tone.dark }]}>{nb.code}</Text>
                <View style={{ gap: 5 }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {nb.name}
                  </Text>
                  <Text style={styles.count}>
                    {count} {count === 1 ? 'note' : 'notes'}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              // Open on the next colour along, so a shelf of notebooks is not
              // all one hue unless that is what was chosen.
              setDraft((d) => ({ ...d, tint: notebooks.length % TINTS.length }));
              setFailed(false);
              setAdding(true);
            }}
            style={({ pressed }) => [styles.addCard, { width: cardWidth }, pressed && { backgroundColor: c.n200 }]}
          >
            <Icon name="plus" size={22} color={c.n600} />
            <Text style={styles.addText}>New notebook</Text>
          </Pressable>
        </View>
      </Screen>

      <Modal visible={adding} transparent animationType="fade" onRequestClose={() => setAdding(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAdding(false)} />
        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>A new notebook</Text>
            <TextInput
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              placeholder="Subject, e.g. Cell Biology"
              placeholderTextColor={c.n500}
              style={styles.input}
              selectionColor={c.accent}
            />
            <TextInput
              value={draft.code}
              onChangeText={(code) => setDraft({ ...draft, code })}
              placeholder="Course code, e.g. BIO-150"
              placeholderTextColor={c.n500}
              style={styles.input}
              selectionColor={c.accent}
            />
            <TextInput
              value={draft.prof}
              onChangeText={(prof) => setDraft({ ...draft, prof })}
              placeholder="Who teaches it"
              placeholderTextColor={c.n500}
              style={styles.input}
              selectionColor={c.accent}
            />
            <View style={styles.tints}>
              {TINTS.map((t, i) => (
                <Pressable key={i} onPress={() => setDraft({ ...draft, tint: i })}>
                  <Blob
                    size={draft.tint === i ? 38 : 30}
                    color={t.tint}
                    opacity={draft.tint === i ? 1 : 0.6}
                  />
                </Pressable>
              ))}
            </View>
            {failed ? <Text style={styles.failed}>That notebook did not save. Try again in a moment.</Text> : null}
            <Pressable onPress={save} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: c.a600 }]}>
              <Text style={styles.ctaText}>Create notebook</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  card: {
    height: 156,
    borderRadius: 30,
    padding: 17,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardBlob: { position: 'absolute', right: -26, top: -22 },
  code: { fontFamily: f.b800, fontSize: 10.5, letterSpacing: 1 },
  name: { fontFamily: f.head, fontSize: 17.5, lineHeight: 22, color: c.text },
  count: { fontFamily: f.b600, fontSize: 12, color: c.n600 },
  addCard: {
    height: 156,
    borderRadius: 30,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: c.n300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addText: { fontFamily: f.b700, fontSize: 13, color: c.n600 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(46,43,37,0.34)' },
  dialogWrap: { flex: 1, justifyContent: 'center', padding: 22 },
  dialog: { backgroundColor: c.paper, borderRadius: 32, padding: 22, gap: 11, ...shadow.lg },
  dialogTitle: { fontFamily: f.head, fontSize: 22, color: c.text, marginBottom: 2 },
  input: {
    backgroundColor: c.n100,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    fontFamily: f.b500,
    fontSize: 14.5,
    color: c.text,
  },
  tints: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  failed: { fontFamily: f.b600, fontSize: 13, color: c.a800, backgroundColor: c.a200, borderRadius: 16, padding: 12 },
  cta: { backgroundColor: c.accent, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  ctaText: { fontFamily: f.b700, fontSize: 15, color: c.paper },
});
