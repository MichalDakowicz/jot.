/** The part of a keyboard frame that is on screen; a hidden one reports a negative or empty frame. */
export function keyboardHeight(frame: { height: number } | undefined): number {
  const h = frame?.height ?? 0;
  return h > 0 ? h : 0;
}
