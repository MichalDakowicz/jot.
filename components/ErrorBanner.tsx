import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../lib/store';
import { c, f } from '../theme/tokens';

/** A failed write, said out loud: the store keeps the message, this shows it. */
export function ErrorBanner() {
  const { error, dismissError } = useStore();
  const insets = useSafeAreaInsets();
  if (!error) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${error}. Tap to dismiss.`}
        onPress={dismissError}
        style={styles.bar}
      >
        <Text style={styles.text}>{error}</Text>
        <Text style={styles.close}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 50 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 560,
    backgroundColor: c.a200,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: { flexShrink: 1, fontFamily: f.b600, fontSize: 13, color: c.a800 },
  close: { fontFamily: f.b600, fontSize: 12, color: c.a700 },
});
