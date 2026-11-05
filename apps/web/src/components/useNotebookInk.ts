import { inkTint } from '@jot/core/theme/ink';
import { tintOf } from '@jot/core/theme/tokens';

import { useScheme } from '../theme';

/** A notebook's colour, lifted on the dark page so the deep tints still read. */
export function useNotebookInk(tint: number): string {
  const { scheme } = useScheme();
  return inkTint(tintOf(tint).hex, scheme);
}
