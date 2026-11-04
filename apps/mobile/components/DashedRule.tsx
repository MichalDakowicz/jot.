import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { c } from '@jot/core/theme/tokens';

/**
 * A full-width dashed line. Android only dashes a border drawn on every side,
 * so a dashed box is drawn and all but its top edge clipped away.
 */
export function DashedRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.clip, style]}>
      <View style={styles.box} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { height: 1, overflow: 'hidden', alignSelf: 'stretch' },
  box: { height: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: c.n500, borderRadius: 1 },
});
