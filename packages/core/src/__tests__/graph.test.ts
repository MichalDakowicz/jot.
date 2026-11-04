import { describe, expect, it } from 'vitest';

import { layoutGraph, parseClassTime, shortLabel } from '../graph';
import { inkTint, INK, mix } from '../theme/ink';
import type { Note, Notebook } from '../types';

const book = (id: string, tint: number): Notebook => ({
  id, user_id: 'u', name: id, code: '', prof: '', tint, position: 0, created_at: '',
});
const note = (id: string, notebook_id: string, title: string, body = ''): Note => ({
  id, user_id: 'u', notebook_id, title, body, tags: [], created_at: '', updated_at: '',
});

describe('layoutGraph', () => {
  it('draws one edge per mentioned pair, whichever side mentions', () => {
    const { nodes, edges } = layoutGraph(300, [book('a', 0), book('b', 1)], [
      note('1', 'a', 'Cells', 'see @Mitosis'),
      note('2', 'b', 'Mitosis', 'back to @Cells'),
      note('3', 'b', 'Alone'),
    ]);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(1);
    expect(nodes.find((n) => n.id === '1')?.degree).toBe(1);
    expect(nodes.find((n) => n.id === '3')?.degree).toBe(0);
  });

  it('shortens long titles at the first clause', () => {
    expect(shortLabel('Photosynthesis: light reactions')).toBe('Photosynthesis');
    expect(shortLabel('A very long title about something')).toBe('A very');
  });
});

describe('parseClassTime', () => {
  it('pads hours and minutes', () => {
    expect(parseClassTime('9')).toBe('09:00:00');
    expect(parseClassTime(' 14:5 ')).toBe('14:05:00');
  });
  it('rejects what is not a time', () => {
    expect(parseClassTime('25')).toBeNull();
    expect(parseClassTime('9:60')).toBeNull();
    expect(parseClassTime('nine')).toBeNull();
  });
});

describe('ink', () => {
  it('mixes channel by channel', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#123456', '#abcdef', 0)).toBe('#123456');
  });
  it('lifts tints on the dark page only', () => {
    expect(inkTint('#8c491a', 'light')).toBe('#8c491a');
    expect(inkTint('#8c491a', 'dark')).toBe(mix('#8c491a', INK.dark.text, 0.35));
  });
  it('keeps the same keys in both schemes', () => {
    expect(Object.keys(INK.dark).sort()).toEqual(Object.keys(INK.light).sort());
  });
});
