import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { c } from '@jot/core/theme/tokens';

/** The gate in the root layout decides where to go; this is the pause. */
export default function Index() {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
});
