import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Blob } from './Blob';
import { c, f, shadow } from '@jot/core/theme/tokens';

/**
 * Logo 2a from the canvas — the wordmark with a blob full stop, and the app
 * mark as a "J" in the corner of a tile — recoloured: terracotta tile,
 * cream J, sage stop.
 */
export const LOGO = {
  tile: c.accent,
  letter: c.paper,
  stop: c.g300,
  word: c.n900,
  wordStop: c.accent,
} as const;

/** The square app mark: J in the bottom-left corner of a rounded tile. */
export function LogoMark({
  size = 88,
  style,
  elevated = true,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.34,
          backgroundColor: LOGO.tile,
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingLeft: size * 0.18,
          paddingBottom: size * 0.2,
          gap: size * 0.05,
        },
        elevated && shadow.md,
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: f.head,
          fontSize: size * 0.455,
          lineHeight: size * 0.42,
          color: LOGO.letter,
        }}
      >
        J
      </Text>
      <Blob size={size * 0.125} color={LOGO.stop} style={{ marginBottom: size * 0.055 }} />
    </View>
  );
}

/** The wordmark: Jot plus its blob full stop. */
export function LogoWord({
  size = 42,
  color = LOGO.word,
  stopColor = LOGO.wordStop,
  style,
}: {
  size?: number;
  color?: string;
  stopColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wordRow, { gap: size * 0.2 }, style]}>
      <Text
        style={{
          fontFamily: f.head,
          fontSize: size,
          lineHeight: size * 1.06,
          letterSpacing: -size * 0.015,
          color,
        }}
      >
        Jot
      </Text>
      <Blob size={size * 0.33} color={stopColor} style={{ marginBottom: size * 0.13 }} />
    </View>
  );
}

/** Mark and wordmark side by side, as the canvas shows the lockup. */
export function LogoLockup({
  markSize = 64,
  wordSize = 24,
  color = LOGO.word,
  stopColor = LOGO.wordStop,
}: {
  markSize?: number;
  wordSize?: number;
  color?: string;
  stopColor?: string;
}) {
  return (
    <View style={[styles.lockup, { gap: markSize * 0.22 }]}>
      <LogoMark size={markSize} />
      <LogoWord size={wordSize} color={color} stopColor={stopColor} style={{ paddingBottom: 4 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wordRow: { flexDirection: 'row', alignItems: 'flex-end' },
  lockup: { flexDirection: 'row', alignItems: 'flex-end' },
});
