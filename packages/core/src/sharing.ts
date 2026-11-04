export type ShareKind = 'note' | 'notebook';

/** Use the current web origin, or the configured HTTPS website on native. */
export function publicShareUrl(origin: string, kind: ShareKind, id: string): string {
  const base = new URL(origin);
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new Error('Public sharing needs an HTTP or HTTPS website URL.');
  }
  return `${base.origin}/share/${kind}/${encodeURIComponent(id)}`;
}
