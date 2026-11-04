import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ResizeHandle } from './ResizeHandle';

const WIDTH_KEY = 'jot.contents.width';

/** Keep the reader usable while remembering the preferred outline width. */
export function ContentsPane({ availableWidth, children }: { availableWidth: number; children: React.ReactNode }) {
  const [preferredWidth, setPreferredWidth] = useState(440);
  const changed = useRef(false);
  const min = 300;
  const max = Math.min(720, availableWidth - 496);
  const width = Math.min(max, Math.max(min, preferredWidth));

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(WIDTH_KEY).then((raw) => {
      const saved = Number(raw);
      if (alive && !changed.current && raw && Number.isFinite(saved)) setPreferredWidth(saved);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  function resize(next: number) {
    changed.current = true;
    setPreferredWidth(next);
  }

  return (
    <View style={{ flexDirection: 'row', flexShrink: 0 }}>
      <ResizeHandle value={width} min={min} max={max} onChange={resize}
        onCommit={(next) => { resize(next); void AsyncStorage.setItem(WIDTH_KEY, String(next)).catch(() => undefined); }} />
      <View style={{ width, paddingTop: 16, paddingRight: 20, paddingBottom: 20 }}>
        {children}
      </View>
    </View>
  );
}
