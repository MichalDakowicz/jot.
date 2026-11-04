import { describe, expect, it } from 'vitest';

import { embedOf } from '../embed';

describe('embedOf', () => {
  it('takes markdown images with a web address', () => {
    expect(embedOf('![cell](https://x.org/cell.png)')).toEqual({ kind: 'image', alt: 'cell', src: 'https://x.org/cell.png' });
    expect(embedOf('![t](https://x.org/a.png "title")')?.kind).toBe('image');
    expect(embedOf('![local](cell.png)')).toBeNull();
  });

  it('turns YouTube links into a privacy-enhanced player', () => {
    expect(embedOf('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'video', id: 'dQw4w9WgXcQ', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    });
    expect(embedOf('https://youtu.be/dQw4w9WgXcQ')?.kind).toBe('video');
    expect(embedOf('https://youtube.com/shorts/abcdefgh')?.kind).toBe('video');
  });

  it('shows a bare image address as the image', () => {
    expect(embedOf('https://x.org/photo.JPG?w=2')?.kind).toBe('image');
  });

  it('cards any other link alone on its line', () => {
    expect(embedOf('  <https://www.example.com/docs/>  ')).toEqual({
      kind: 'link', href: 'https://www.example.com/docs/', host: 'example.com', path: '/docs',
    });
  });

  it('leaves text with a link inside it alone', () => {
    expect(embedOf('see https://example.com')).toBeNull();
    expect(embedOf('just words')).toBeNull();
  });
});
