import { describe, expect, it } from 'vitest';
import { publicShareUrl } from '../sharing';

describe('public share URLs', () => {
  it('uses web origin and public routes for both content types', () => {
    expect(publicShareUrl('https://notes.example/path/', 'note', 'abc'))
      .toBe('https://notes.example/share/note/abc');
    expect(publicShareUrl('https://notes.example', 'notebook', 'abc'))
      .toBe('https://notes.example/share/notebook/abc');
  });
  it('supports local development and encodes path segments', () => {
    expect(publicShareUrl('http://localhost:8081', 'note', 'a/b'))
      .toBe('http://localhost:8081/share/note/a%2Fb');
  });
  it('rejects app schemes and invalid website configuration', () => {
    expect(() => publicShareUrl('jot://app', 'note', 'abc')).toThrow();
    expect(() => publicShareUrl('', 'note', 'abc')).toThrow();
  });
});
