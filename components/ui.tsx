import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { useIsWide } from '../lib/layout';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';
import type { NoteCard } from '../lib/types';
import { c, f, shadow } from '../theme/tokens';

/** Scroll body sized so the floating nav islands never cover content. */
export function Screen({
  children,
  style,
  gap = 22,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  // Shrinks the viewport itself, so a field being typed into scrolls above the keyboard.
  const keyboard = useKeyboardHeight();
  return (
    <ScrollView
      style={[styles.screen, keyboard ? { marginBottom: keyboard } : null]}
      contentContainerStyle={[
        {
          paddingTop: wide ? 26 : insets.top + 14,
          paddingBottom: wide ? 44 : insets.bottom + 130,
          // Gutters wide enough to read against on a desktop, and the column
          // centred in the pane instead of hanging off its left edge.
          paddingHorizontal: wide ? 52 : 20,
          maxWidth: wide ? 780 : undefined,
          width: '100%',
          alignSelf: 'center',
          gap,
        },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Kicker({ children, color = c.n600 }: { children: React.ReactNode; color?: string }) {
  return <Text style={[styles.kicker, { color }]}>{children}</Text>;
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  // The desktop rail keeps every destination one click away, so the phone's
  // back affordance would only be noise there.
  if (useIsWide()) return null;
  return (
    <Pressable onPress={onPress} style={styles.back} hitSlop={8}>
      <Icon name="chevronLeft" size={16} color={c.n600} />
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

export function TagChip({
  tag,
  count,
  active = false,
  size = 12,
  onPress,
}: {
  tag: string;
  count?: number;
  active?: boolean;
  size?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tagChip, active && { backgroundColor: c.accent }]}
      disabled={!onPress}
    >
      <Text style={[styles.tagChipText, { fontSize: size }, active && { color: c.paper }]}>
        #{tag}
      </Text>
      {count !== undefined ? (
        <Text style={[styles.tagChipCount, active && { color: c.paper }]}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

export function Pill({
  label,
  onPress,
  tone = 'neutral',
  icon,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'neutral' | 'accent2' | 'accent';
  icon?: React.ReactNode;
}) {
  const bg = tone === 'accent2' ? c.g200 : tone === 'accent' ? c.accent : c.n200;
  const fg = tone === 'accent2' ? c.g800 : tone === 'accent' ? c.paper : c.n800;
  return (
    <Pressable onPress={onPress} style={[styles.pill, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** The note card used on Today, in a notebook, in search and under a tag. */
export function NoteRow({
  card,
  onPress,
  showNotebook = true,
  showTags = false,
}: {
  card: NoteCard;
  onPress: () => void;
  showNotebook?: boolean;
  showTags?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardHead}>
        {showNotebook ? (
          <>
            <View style={[styles.dot, { backgroundColor: card.tint }]} />
            <Text style={[styles.cardNb, { color: card.dark }]} numberOfLines={1}>
              {card.nbName}
            </Text>
            <View style={{ flex: 1 }} />
          </>
        ) : (
          <Text style={styles.cardTitleInline} numberOfLines={2}>
            {card.title}
          </Text>
        )}
        <Text style={styles.cardWhen}>{card.when}</Text>
      </View>
      {showNotebook ? (
        <Text style={styles.cardTitle} numberOfLines={2}>
          {card.title}
        </Text>
      ) : null}
      {card.snippet ? (
        <Text style={styles.cardSnippet} numberOfLines={2}>
          {card.snippet}
        </Text>
      ) : null}
      {showTags && card.tags.length ? (
        <View style={styles.cardTags}>
          {card.tags.map((t) => (
            <View key={t} style={styles.miniTag}>
              <Text style={styles.miniTagText}>#{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  title: { fontFamily: f.head, fontSize: 31, lineHeight: 36, color: c.text },
  kicker: {
    fontFamily: f.b800,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { fontFamily: f.b700, fontSize: 13, color: c.n600 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.a100,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  tagChipText: { fontFamily: f.b700, color: c.a700 },
  tagChipCount: { fontFamily: f.b800, fontSize: 11, color: c.a700, opacity: 0.6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  pillText: { fontFamily: f.b700, fontSize: 12.5 },
  card: {
    backgroundColor: c.n100,
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 7,
    ...shadow.sm,
  },
  cardPressed: { backgroundColor: c.paper },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 99 },
  cardNb: {
    fontFamily: f.b800,
    fontSize: 10.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  cardWhen: { fontFamily: f.b600, fontSize: 11.5, color: c.n500 },
  cardTitle: { fontFamily: f.b700, fontSize: 16.5, lineHeight: 21, color: c.text },
  cardTitleInline: { fontFamily: f.b700, fontSize: 16.5, lineHeight: 21, color: c.text, flex: 1 },
  cardSnippet: { fontFamily: f.b400, fontSize: 13, lineHeight: 19.5, color: c.n600 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  miniTag: { backgroundColor: c.a100, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  miniTagText: { fontFamily: f.b700, fontSize: 11, color: c.a700 },
  empty: {
    backgroundColor: c.n100,
    borderRadius: 26,
    padding: 22,
    ...shadow.sm,
  },
  emptyText: { fontFamily: f.b500, fontSize: 13.5, lineHeight: 20, color: c.n600 },
});
