import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Blob } from '../../../components/Blob';
import { PublicShare } from '../../../components/PublicShare';
import { BackLink, Empty, Kicker, NoteRow, Screen } from '../../../components/ui';
import { confirmDestructive } from '../../../lib/confirm';
import { useStore } from '../../../lib/store';
import { c, f, tintOf } from '../../../theme/tokens';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Accepts "9", "9:5" and "09:00", gives back "09:00:00", or null when it is not a time. */
function parseTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

export default function NotebookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { notebookById, notesOf, cardOf, deleteNotebook, classesOf, addClasses, deleteClass } =
    useStore();

  const nb = notebookById(id);
  const own = notesOf(id ?? '');
  const sessions = classesOf(id ?? '');
  const tone = tintOf(nb?.tint ?? 0);

  const [adding, setAdding] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState('');
  const [room, setRoom] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  async function addTime() {
    const starts_at = parseTime(time);
    if (!starts_at) {
      setProblem('A time like 9:00 or 14:30.');
      return;
    }
    if (!days.length) {
      setProblem('Pick at least one day.');
      return;
    }
    setProblem(null);
    await addClasses({ notebookId: id!, weekdays: days, starts_at, room: room.trim() });
    setDays([]);
    setTime('');
    setRoom('');
    setAdding(false);
  }

  if (!nb) {
    return (
      <Screen>
        <BackLink label="Notebooks" onPress={() => router.replace('/shelf')} />
        <Empty text="That notebook is gone." />
      </Screen>
    );
  }

  function confirmDelete() {
    confirmDestructive({
      title: `Delete ${nb!.name}?`,
      message: `Its ${own.length} ${own.length === 1 ? 'note goes' : 'notes go'} with it. This cannot be undone.`,
      onConfirm: async () => {
        await deleteNotebook(nb!.id);
        router.replace('/shelf');
      },
    });
  }

  return (
    <Screen gap={18}>
      <BackLink label="Notebooks" onPress={() => router.replace('/shelf')} />

      <View style={styles.head}>
        <Blob size={52} color={tone.tint} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{nb.name}</Text>
          <Text style={styles.meta}>
            {[nb.code, nb.prof, `${own.length} ${own.length === 1 ? 'note' : 'notes'}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>

      <View style={{ gap: 11 }}>
        <PublicShare key={nb.id} kind="notebook" id={nb.id} published={!!nb.is_public} />
        {own.length ? (
          own.map((n) => (
            <NoteRow
              key={n.id}
              card={cardOf(n)}
              onPress={() => router.push(`/note/${n.id}`)}
              showNotebook={false}
              showTags
            />
          ))
        ) : (
          <Empty text="No notes in here yet. The round button starts one." />
        )}
      </View>

      <View style={{ gap: 9 }}>
        <Kicker>Timetable</Kicker>
        {sessions.length ? (
          sessions.map((s) => (
            <View key={s.id} style={[styles.slot, { backgroundColor: tone.soft }]}>
              <Text style={[styles.slotDay, { color: tone.dark }]}>{DAYS[s.weekday]}</Text>
              <Text style={styles.slotTime}>{s.starts_at.slice(0, 5)}</Text>
              <Text style={styles.slotRoom} numberOfLines={1}>
                {s.room}
              </Text>
              <Pressable
                onPress={() => deleteClass(s.id)}
                accessibilityLabel={`Remove ${DAYS[s.weekday]} ${s.starts_at.slice(0, 5)}`}
                hitSlop={8}
              >
                <Text style={styles.slotRemove}>Remove</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Empty text="No class times yet. Add one and it shows up on Today." />
        )}

        {adding ? (
          <View style={styles.form}>
            <View style={styles.dayRow}>
              {DAYS.map((label, i) => {
                const on = days.includes(i);
                return (
                  <Pressable
                    key={label}
                    onPress={() =>
                      setDays((prev) => (on ? prev.filter((d) => d !== i) : [...prev, i]))
                    }
                    style={[styles.day, on && { backgroundColor: tone.tint }]}
                  >
                    <Text style={[styles.dayText, on && { color: c.paper }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.fieldRow}>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="09:00"
                placeholderTextColor={c.n500}
                style={[styles.field, { width: 88 }]}
              />
              <TextInput
                value={room}
                onChangeText={setRoom}
                placeholder="Room"
                placeholderTextColor={c.n500}
                style={[styles.field, { flex: 1 }]}
              />
            </View>
            {problem ? <Text style={styles.problem}>{problem}</Text> : null}
            <View style={styles.fieldRow}>
              <Pressable onPress={addTime} style={[styles.add, { backgroundColor: c.accent }]}>
                <Text style={[styles.addText, { color: c.paper }]}>Add this time</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAdding(false);
                  setProblem(null);
                }}
                style={styles.add}
              >
                <Text style={styles.addText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setAdding(true)} style={styles.addSlot}>
            <Text style={styles.addSlotText}>Add a class time</Text>
          </Pressable>
        )}
      </View>

      <Pressable onPress={confirmDelete} style={styles.delete}>
        <Text style={styles.deleteText}>Delete this notebook</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  name: { fontFamily: f.head, fontSize: 25, lineHeight: 30, color: c.text },
  meta: { fontFamily: f.b600, fontSize: 12.5, color: c.n600 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  slotDay: { fontFamily: f.b800, fontSize: 12.5, width: 34 },
  slotTime: { fontFamily: f.b700, fontSize: 13.5, color: c.text, width: 46 },
  slotRoom: { flex: 1, fontFamily: f.b600, fontSize: 12, color: c.n600 },
  slotRemove: { fontFamily: f.b600, fontSize: 11.5, color: c.n600 },
  form: { gap: 9, backgroundColor: c.n200, borderRadius: 22, padding: 13 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { backgroundColor: c.paper, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  dayText: { fontFamily: f.b700, fontSize: 12, color: c.n800 },
  fieldRow: { flexDirection: 'row', gap: 8 },
  field: {
    backgroundColor: c.paper,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontFamily: f.b600,
    fontSize: 13.5,
    color: c.text,
  },
  problem: { fontFamily: f.b500, fontSize: 12, color: c.n600 },
  add: { backgroundColor: c.paper, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 },
  addText: { fontFamily: f.b700, fontSize: 13, color: c.n800 },
  addSlot: {
    alignSelf: 'flex-start',
    backgroundColor: c.n200,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 17,
  },
  addSlotText: { fontFamily: f.b700, fontSize: 13, color: c.n800 },
  delete: { alignSelf: 'flex-start', paddingVertical: 10 },
  deleteText: { fontFamily: f.b600, fontSize: 12.5, color: c.n500 },
});
