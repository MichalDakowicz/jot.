import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COUNTED, type Block } from '@jot/core/doc';
import { c, f } from '@jot/core/theme/tokens';

const HEADING = { h1: 1, h2: 2, h3: 3, h4: 4 } as const;

/**
 * What sits in front of a block: its line number in the gutter, then its
 * markdown mark. A heading keeps its "#"s and a quote its ">", muted, the way
 * the web editor shows them; bullets, numbers and boxes are drawn as before.
 */
export function BlockPrefix({ block, line, marker, onToggle }: {
  block: Block;
  /** One-based, counted in blocks. */
  line: number;
  /** The counted marker for a numbered or lettered item, "3." or "c.". */
  marker: string;
  onToggle: () => void;
}) {
  const level = HEADING[block.kind as keyof typeof HEADING];
  return (
    <>
      <Text style={[styles.gutter, level ? styles[`gutterH${level}`] : null]}>{line}</Text>
      {level ? <Text style={[styles.mark, styles[`h${level}`]]}>{'#'.repeat(level)}</Text> : null}
      {block.kind === 'quote' ? <Text style={styles.mark}>{'>'}</Text> : null}
      {block.kind === 'bullet' ? <Text style={styles.bullet}>-</Text> : null}
      {COUNTED.includes(block.kind) ? <Text style={styles.number}>{marker}</Text> : null}
      {block.kind === 'todo' ? (
        <Pressable onPress={onToggle} hitSlop={8} style={[styles.box, block.done && styles.boxOn]}>
          {block.done ? <Text style={styles.tick}>✓</Text> : null}
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Line heights match the field beside each kind, so the number sits on its first line.
  gutter: { fontFamily: f.mono, fontSize: 10, lineHeight: 25, color: c.n400, width: 16, textAlign: 'right' },
  gutterH1: { lineHeight: 31 },
  gutterH2: { lineHeight: 27 },
  gutterH3: { lineHeight: 24 },
  gutterH4: { lineHeight: 22 },
  mark: { fontFamily: f.b400, fontSize: 14.5, lineHeight: 23, color: c.n400 },
  h1: { fontSize: 23, lineHeight: 31 },
  h2: { fontSize: 19, lineHeight: 27 },
  h3: { fontSize: 15.5, lineHeight: 24 },
  h4: { fontSize: 13.5, lineHeight: 22 },
  bullet: { fontFamily: f.b700, fontSize: 15, lineHeight: 25, color: c.a600, width: 12 },
  number: { fontFamily: f.b700, fontSize: 14, lineHeight: 25, color: c.a600, minWidth: 18 },
  box: {
    width: 17,
    height: 17,
    marginTop: 4,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.n400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: c.a500, borderColor: c.a500 },
  tick: { fontFamily: f.b800, fontSize: 11, lineHeight: 14, color: c.bg },
});
