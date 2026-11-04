/**
 * Lines that show as something richer than text: an image, a video, or a
 * card for a link pasted on a line of its own. The markdown stays the source;
 * the editor draws the embed under the line and a share page draws it instead.
 */
export type Embed =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'video'; id: string; src: string }
  | { kind: 'link'; href: string; host: string; path: string };

const IMAGE = /^!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)$/;
const URL_LINE = /^<?(https?:\/\/[^\s<>]+)>?$/;
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return url.pathname.slice(1) || null;
  if (host !== 'youtube.com') return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/);
  return m ? m[1] : null;
}

/** What a whole line embeds, or null for a line that is just text. */
export function embedOf(line: string): Embed | null {
  const text = line.trim();
  const image = text.match(IMAGE);
  if (image && /^https?:\/\//.test(image[2])) return { kind: 'image', alt: image[1], src: image[2] };

  const bare = text.match(URL_LINE);
  if (!bare) return null;
  let url: URL;
  try {
    url = new URL(bare[1]);
  } catch {
    return null;
  }
  const id = youtubeId(url);
  if (id && /^[\w-]{6,}$/.test(id)) return { kind: 'video', id, src: `https://www.youtube-nocookie.com/embed/${id}` };
  if (IMAGE_FILE.test(url.pathname)) return { kind: 'image', alt: '', src: url.href };
  const path = (url.pathname + url.search).replace(/\/$/, '');
  return { kind: 'link', href: url.href, host: url.hostname.replace(/^www\./, ''), path };
}
