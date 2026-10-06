import * as Linking from 'expo-linking';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { parseBlocks, type Block, type Inline, type Mentionable } from '../lib/markdown';
import { c, f } from '../theme/tokens';

type Handlers = {
  onMention?: (noteId: string) => void;
};

type Props = Handlers & {
  source: string;
  mentions?: Mentionable[];
  /** Slightly tighter leading for single lines inside the editor. */
  compact?: boolean;
  /** Set the paragraph style, so an editor block can be drawn as its own kind. */
  textStyle?: StyleProp<TextStyle>;
};

function renderInline(nodes: Inline[], h: Handlers, keyBase: string): React.ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyBase}-${i}`;
    switch (node.t) {
      case 'text':
        return <Text key={key}>{node.v}</Text>;
      case 'bold':
        return (
          <Text key={key} style={styles.bold}>
            {renderInline(node.kids, h, key)}
          </Text>
        );
      case 'em':
        return (
          <Text key={key} style={styles.em}>
            {renderInline(node.kids, h, key)}
          </Text>
        );
      case 'mark':
        return (
          <Text key={key} style={styles.mark}>
            {renderInline(node.kids, h, key)}
          </Text>
        );
      case 'strike':
        return (
          <Text key={key} style={styles.strike}>
            {renderInline(node.kids, h, key)}
          </Text>
        );
      case 'code':
        return (
          <Text key={key} style={styles.code}>
            {' ' + node.v + ' '}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={key}
            style={styles.link}
            onPress={() => void Linking.openURL(node.href).catch(() => undefined)}
          >
            {renderInline(node.kids, h, key)}
          </Text>
        );
      case 'mention':
        return (
          <Text
            key={key}
            style={styles.mention}
            onPress={h.onMention ? () => h.onMention!(node.id) : undefined}
          >
            {' ' + node.v + ' '}
          </Text>
        );
      default:
        return null;
    }
  });
}

function renderBlock(
  block: Block,
  h: Handlers,
  key: string,
  compact: boolean,
  textStyle?: StyleProp<TextStyle>,
): React.ReactNode {
  switch (block.t) {
    case 'h1':
      return (
        <Text key={key} style={styles.h1}>
          {renderInline(block.kids, h, key)}
        </Text>
      );
    case 'h2':
      return (
        <Text key={key} style={styles.h2}>
          {renderInline(block.kids, h, key)}
        </Text>
      );
    case 'h3':
      return (
        <Text key={key} style={styles.h3}>
          {renderInline(block.kids, h, key)}
        </Text>
      );
    case 'h4':
      return (
        <Text key={key} style={styles.h4}>
          {renderInline(block.kids, h, key)}
        </Text>
      );
    case 'quote':
      return (
        <View key={key} style={styles.quote}>
          <Text style={styles.quoteText}>{renderInline(block.kids, h, key)}</Text>
        </View>
      );
    case 'fence':
      return (
        <View key={key} style={styles.fence}>
          <Text style={styles.fenceText}>{block.v}</Text>
        </View>
      );
    case 'table':
      return (
        <ScrollView key={key} horizontal showsHorizontalScrollIndicator={false} style={styles.tableWrap}>
          <View style={styles.table}>
            {block.rows.map((row, r) => (
              <View key={r} style={[styles.tr, r === 0 && styles.trHead]}>
                {row.map((cell, ci) => (
                  <View key={ci} style={styles.td}>
                    <Text style={r === 0 ? styles.th : styles.tdText}>
                      {renderInline(cell, h, `${key}-${r}-${ci}`)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    case 'rule':
      return <View key={key} style={styles.rule} />;
    case 'space':
      return <View key={key} style={{ height: compact ? 4 : 9 }} />;
    case 'list':
      return (
        <View key={key} style={styles.list}>
          {block.items.map((item, i) => (
            <View
              key={`${key}-i${i}`}
              style={[styles.listRow, item.depth > 0 && { marginLeft: item.depth * 18 }]}
            >
              {item.kind === 'todo' ? (
                <View style={[styles.box, item.done && styles.boxOn]}>
                  {item.done ? <Text style={styles.boxTick}>✓</Text> : null}
                </View>
              ) : (
                <Text style={item.kind === 'bullet' ? styles.bullet : styles.number}>{item.marker}</Text>
              )}
              <Text style={[styles.p, styles.listText, item.done && styles.done]}>
                {renderInline(item.kids, h, `${key}-i${i}`)}
              </Text>
            </View>
          ))}
        </View>
      );
    case 'p':
    default:
      return (
        <Text key={key} style={[styles.p, compact && styles.pCompact, textStyle]}>
          {renderInline(block.kids, h, key)}
        </Text>
      );
  }
}

export function Markdown({
  source,
  mentions = [],
  onMention,
  compact = false,
  textStyle,
}: Props) {
  const blocks = useMemo(() => parseBlocks(source.split('\n'), mentions), [source, mentions]);
  const handlers = { onMention };
  return <View>{blocks.map((b, i) => renderBlock(b, handlers, 'b' + i, compact, textStyle))}</View>;
}

const styles = StyleSheet.create({
  h1: {
    fontFamily: f.head,
    fontSize: 23,
    lineHeight: 29,
    color: c.text,
    marginTop: 18,
    marginBottom: 8,
  },
  h2: {
    fontFamily: f.head,
    fontSize: 19,
    lineHeight: 26,
    color: c.text,
    marginTop: 18,
    marginBottom: 8,
  },
  h3: {
    fontFamily: f.b800,
    fontSize: 14.5,
    lineHeight: 20,
    color: c.text,
    marginTop: 16,
    marginBottom: 6,
  },
  h4: {
    fontFamily: f.b800,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.3,
    color: c.n700,
    marginTop: 14,
    marginBottom: 5,
  },
  p: {
    fontFamily: f.b400,
    fontSize: 15,
    lineHeight: 25,
    color: c.n800,
    marginBottom: 11,
  },
  pCompact: { marginBottom: 0, lineHeight: 24 },
  bold: { fontFamily: f.b800 },
  em: { fontStyle: 'italic' },
  mark: { backgroundColor: c.a200, color: c.a900 },
  strike: { textDecorationLine: 'line-through' as const },
  code: {
    fontFamily: f.mono,
    fontSize: 13,
    backgroundColor: c.a100,
    color: c.a800,
    borderRadius: 9,
  },
  link: { fontFamily: f.b600, color: c.a700, textDecorationLine: 'underline' },
  mention: {
    fontFamily: f.b600,
    color: c.g800,
    backgroundColor: c.g200,
    borderRadius: 999,
  },
  quote: {
    backgroundColor: c.g100,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginVertical: 14,
  },
  quoteText: { fontFamily: f.b400, fontSize: 14.5, lineHeight: 23, color: c.g800 },
  fence: {
    backgroundColor: c.n200,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  fenceText: { fontFamily: f.mono, fontSize: 12.5, lineHeight: 19, color: c.n800 },
  tableWrap: { marginVertical: 12 },
  table: {},
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: c.n300 },
  trHead: { backgroundColor: c.n100 },
  td: {
    width: 148,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderColor: c.n300,
  },
  th: { fontFamily: f.b800, fontSize: 12.5, lineHeight: 20, color: c.n800 },
  tdText: { fontFamily: f.b400, fontSize: 13.5, lineHeight: 21, color: c.n800 },
  rule: {
    borderTopWidth: 3,
    borderStyle: 'dotted',
    borderColor: c.n400,
    marginVertical: 18,
  },
  list: { marginBottom: 12, gap: 6 },
  listRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  listText: { flex: 1, marginBottom: 0 },
  bullet: { fontFamily: f.b800, color: c.accent, fontSize: 15, lineHeight: 25 },
  number: { fontFamily: f.b800, color: c.a700, fontSize: 15, lineHeight: 25 },
  box: {
    width: 19,
    height: 19,
    marginTop: 3,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: c.g500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: c.g500 },
  boxTick: { color: c.paper, fontSize: 11, fontFamily: f.b800, lineHeight: 13 },
  done: { color: c.n500, textDecorationLine: 'line-through' },
});
