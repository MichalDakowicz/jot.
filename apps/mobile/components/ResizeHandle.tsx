import React, { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';

import { c } from '@jot/core/theme/tokens';

type Props = { value: number; min: number; max: number; onChange: (value: number) => void; onCommit: (value: number) => void };

export function ResizeHandle(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const start = useRef(props.value);
  const clamp = (value: number) => Math.max(latest.current.min, Math.min(latest.current.max, value));
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = latest.current.value; },
    onPanResponderMove: (_, gesture) => latest.current.onChange(clamp(start.current - gesture.dx)),
    onPanResponderRelease: (_, gesture) => latest.current.onCommit(clamp(start.current - gesture.dx)),
    onPanResponderTerminate: () => latest.current.onCommit(latest.current.value),
  }), []);

  return <View {...responder.panHandlers} accessibilityRole="adjustable" accessibilityLabel="Resize contents sidebar"
    accessibilityValue={{ min: props.min, max: props.max, now: props.value }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={(event) => props.onCommit(clamp(props.value + (event.nativeEvent.actionName === 'increment' ? 16 : -16)))}
    style={{ width: 16, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 4, height: 52, borderRadius: 4, backgroundColor: c.n400 }} />
  </View>;
}
