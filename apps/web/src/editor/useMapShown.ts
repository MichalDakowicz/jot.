import { useCallback, useState } from 'react';

const KEY = 'jot.minimap';

function readShown(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'hidden';
  } catch {
    return true;
  }
}

/** Whether the note map is beside the editor; turned off, it stays off on this device. */
export function useMapShown(): [boolean, (shown: boolean) => void] {
  const [shown, setShown] = useState(readShown);
  const set = useCallback((on: boolean) => {
    try {
      if (on) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, 'hidden');
    } catch { /* A private window forgets it next visit. */ }
    setShown(on);
  }, []);
  return [shown, set];
}
