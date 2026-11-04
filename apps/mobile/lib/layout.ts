import { useWindowDimensions } from 'react-native';

/** The width where the three islands unroll into the desktop rail. */
export const WIDE_AT = 900;

export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_AT;
}
