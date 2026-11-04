import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { LOGO_COLORS, LOGO_PATHS } from '@jot/core/theme/logo';
import { c, f } from '@jot/core/theme/tokens';

/** The square app mark: a monospace "j" and its cursor on the slate tile. */
export function LogoMark({ size = 88, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect width={64} height={64} rx={LOGO_PATHS.tile.radius} fill={LOGO_COLORS.tile} />
        <Path d={LOGO_PATHS.dot} fill={LOGO_COLORS.letter} />
        <Path d={LOGO_PATHS.stem} fill={LOGO_COLORS.letter} />
        <Path d={LOGO_PATHS.caret} fill={LOGO_COLORS.caret} />
      </Svg>
    </View>
  );
}

/** The wordmark: "jot" with its full stop in the accent. */
export function LogoWord({
  size = 42,
  color = c.text,
  stopColor = c.accent,
  style,
}: {
  size?: number;
  color?: string;
  stopColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wordRow, style]}>
      <Text style={{ fontFamily: f.head, fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.02, color }}>
        jot<Text style={{ color: stopColor }}>.</Text>
      </Text>
    </View>
  );
}

/** Mark and wordmark side by side. */
export function LogoLockup({ markSize = 64, wordSize = 24, color, stopColor }: {
  markSize?: number;
  wordSize?: number;
  color?: string;
  stopColor?: string;
}) {
  return (
    <View style={[styles.lockup, { gap: markSize * 0.22 }]}>
      <LogoMark size={markSize} />
      <LogoWord size={wordSize} color={color} stopColor={stopColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  wordRow: { flexDirection: 'row', alignItems: 'flex-end' },
  lockup: { flexDirection: 'row', alignItems: 'center' },
});
