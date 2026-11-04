import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Marks } from '@jot/core/rich';
import { c, f, shadow } from '@jot/core/theme/tokens';

const BUTTONS: { kind: keyof Marks; label: string; style?: object }[] = [
  { kind: 'bold', label: 'B', style: { fontFamily: f.b800 } },
  { kind: 'em', label: 'I', style: { fontStyle: 'italic' } },
  { kind: 'strike', label: 'S', style: { textDecorationLine: 'line-through' } },
  { kind: 'mark', label: 'Mark', style: { backgroundColor: c.a200, color: c.a900 } },
  { kind: 'code', label: 'Code', style: { fontFamily: f.mono, fontSize: 12.5 } },
  { kind: 'link', label: 'Link', style: { textDecorationLine: 'underline' } },
];

/**
 * Shown while a run of text is selected. A floating bar rather than a bubble
 * pinned to the selection: React Native gives no caret coordinates, and a bar
 * above the keyboard stays reachable with one thumb.
 */
export function MarkBar({
  onMark,
  bottom,
  active,
}: {
  onMark: (kind: keyof Marks) => void;
  bottom: number;
  /** Annotations the selection already carries, so the bar can show them on. */
  active?: Marks;
}) {
  return (
    <View style={[styles.bar, { bottom }]}>
      {BUTTONS.map((b) => {
        const on = !!active?.[b.kind];
        return (
          <Pressable
            key={b.kind}
            onPress={() => onMark(b.kind)}
            style={({ pressed }) => [
              styles.button,
              on && styles.buttonOn,
              pressed && { backgroundColor: c.a200 },
            ]}
          >
            <Text style={[styles.buttonText, b.style, on && { color: c.a800 }]}>{b.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: c.paper,
    borderRadius: 999,
    padding: 7,
    zIndex: 9,
    ...shadow.lg,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 6,
  },
  buttonOn: { backgroundColor: c.a100 },
  buttonText: { fontFamily: f.b700, fontSize: 13.5, color: c.n800, borderRadius: 6 },
});
