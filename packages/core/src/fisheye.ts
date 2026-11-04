/**
 * Row heights for a magnifier over a list of equal rows.
 *
 * `focus` is the pointer in row units of the unmagnified list (or null when
 * nothing is hovered). Rows within `radius` grow toward `max` on a cosine
 * falloff; `at` is where the focus point ends up after growth, so the caller
 * can shift the list and keep the row under the pointer under the pointer.
 */
export function fisheye(count: number, base: number, max: number, radius: number, focus: number | null) {
  const heights = new Array<number>(count).fill(base);
  if (focus === null || count === 0) return { heights, at: 0 };
  const f = Math.min(Math.max(focus, 0), count);
  for (let i = Math.max(0, Math.floor(f - radius)); i < Math.min(count, Math.ceil(f + radius)); i++) {
    const d = Math.abs(i + 0.5 - f) / radius;
    if (d < 1) heights[i] = base + (max - base) * Math.cos((d * Math.PI) / 2) ** 2;
  }
  const whole = Math.min(Math.floor(f), count - 1);
  let at = 0;
  for (let i = 0; i < whole; i++) at += heights[i];
  at += (f - whole) * heights[whole];
  return { heights, at };
}
