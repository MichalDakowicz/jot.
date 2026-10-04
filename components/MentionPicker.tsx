import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { c, f, shadow } from '../theme/tokens';

export type MentionHit = { id: string; title: string; nbName: string; tint: string };

/**
 * The notes an @ can link. The highlighted row is the one Return takes, and
 * the arrows walk it, the way they walk the slash list.
 */
export function MentionPicker({
  hits,
  onPick,
  bottom,
  active = 0,
  onHover,
}: {
  hits: MentionHit[];
  onPick: (id: string) => void;
  bottom: number;
  /** Which row Return would take. */
  active?: number;
  /** The pointer is over a row: it becomes the one Return takes. */
  onHover?: (index: number) => void;
}) {
  if (!hits.length) return null;
  return (
    <View style={[styles.panel, { bottom }]}>
      <Text style={styles.label}>Link a note</Text>
      {hits.map((h, i) => (
        <Pressable
          key={h.id}
          onPress={() => onPick(h.id)}
          onHoverIn={() => onHover?.(i)}
          style={({ pressed }) => [
            styles.row,
            i === active && styles.rowOn,
            pressed && { backgroundColor: c.g200 },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: h.tint }]} />
          <Text style={styles.title} numberOfLines={1}>
            {h.title}
          </Text>
          <Text style={styles.nb} numberOfLines={1}>
            {h.nbName}
          </Text>
          {i === active ? <Text style={styles.enter}>↵</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 18,
    right: 18,
    backgroundColor: c.paper,
    borderRadius: 26,
    padding: 10,
    gap: 2,
    zIndex: 9,
    ...shadow.lg,
  },
  label: {
    fontFamily: f.b800,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: c.n500,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, padding: 12 },
  rowOn: { backgroundColor: c.g100 },
  dot: { width: 9, height: 9, borderRadius: 99 },
  title: { flex: 1, fontFamily: f.b700, fontSize: 14, color: c.text },
  nb: { fontFamily: f.b600, fontSize: 11, color: c.n500, maxWidth: 110 },
  enter: { fontFamily: f.b700, fontSize: 13, color: c.g600, paddingRight: 2 },
});
