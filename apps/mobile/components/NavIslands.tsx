import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Blob } from './Blob';
import { Icon, type IconName } from './Icon';
import { c, f, NAV_OFF, NAV_ON, shadow } from '@jot/core/theme/tokens';

export type NavKey = 'today' | 'shelf' | 'search' | 'tags';

const DESTINATIONS: { key: NavKey; icon: IconName; label: string }[] = [
  { key: 'today', icon: 'calendar', label: 'Today' },
  { key: 'shelf', icon: 'book', label: 'Books' },
  { key: 'search', icon: 'search', label: 'Find' },
  { key: 'tags', icon: 'tag', label: 'Tags' },
];

type Props = {
  active: NavKey | null;
  action: 'plus' | 'pen' | 'check';
  actionLabel: string;
  onAction: () => void;
  onGo: (key: NavKey) => void;
  onProfile: () => void;
  initials: string;
  avatarUrl?: string | null;
  showLabels?: boolean;
};

export function NavIslands({
  active,
  action,
  actionLabel,
  onAction,
  onGo,
  onProfile,
  initials,
  avatarUrl,
  showLabels = false,
}: Props) {
  const insets = useSafeAreaInsets();

  const tap = (fn: () => void) => () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    fn();
  };

  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', c.bg]}
        style={[styles.fade, { height: 112 + insets.bottom }]}
      />
      <View style={[styles.row, { bottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityLabel={actionLabel}
          onPress={tap(onAction)}
          style={({ pressed }) => [styles.action, pressed && { backgroundColor: c.a600 }]}
        >
          <Icon
            name={action}
            size={action === 'pen' ? 21 : action === 'check' ? 23 : 24}
            color={c.paper}
            strokeWidth={2.9}
          />
        </Pressable>

        <View style={styles.island}>
          {DESTINATIONS.map((d) => {
            const on = active === d.key;
            const tone = on ? NAV_ON : NAV_OFF;
            return (
              <Pressable
                key={d.key}
                accessibilityLabel={d.label}
                onPress={tap(() => onGo(d.key))}
                style={[styles.dest, { backgroundColor: tone.bg }]}
              >
                <Icon name={d.icon} size={19} color={tone.fg} />
                {showLabels ? (
                  <Text style={[styles.destLabel, { color: tone.fg }]}>{d.label}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable accessibilityLabel="Profile" onPress={tap(onProfile)} style={styles.profile}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Blob size={48} color={c.a300}>
              <Text style={styles.initials}>{initials}</Text>
            </Blob>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  action: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: c.paper,
    borderRadius: 999,
    padding: 5,
    ...shadow.md,
  },
  dest: {
    minWidth: 46,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 6,
  },
  destLabel: { fontFamily: f.b800, fontSize: 8.5 },
  profile: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: c.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    ...shadow.md,
  },
  avatarImage: { width: 48, height: 48, borderRadius: 999 },
  initials: { fontFamily: f.head, fontSize: 14, color: c.a900 },
});
