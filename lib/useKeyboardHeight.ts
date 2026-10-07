import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { keyboardHeight } from './keyboard';

/**
 * How much of the screen the on-screen keyboard covers, 0 when it is down.
 *
 * Edge-to-edge Android never resizes the window for the keyboard, so a modal
 * or a scroll body has to make room for it itself or the field being typed
 * into sits underneath.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(keyboardHeight(e.endCoordinates)));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
