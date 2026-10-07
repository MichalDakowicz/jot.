import { Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Keyboard, View } from 'react-native';

import { DesktopChrome } from '../../components/DesktopChrome';
import { ErrorBanner } from '../../components/ErrorBanner';
import { NavIslands, type NavKey } from '../../components/NavIslands';
import { ProfileSheet } from '../../components/ProfileSheet';
import { initialsOf, useAuth } from '../../lib/auth';
import { useIsWide } from '../../lib/layout';
import { useStore } from '../../lib/store';
import { c } from '../../theme/tokens';

export default function MainLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ id?: string }>();
  const wide = useIsWide();
  const { profile, user, avatarUrl } = useAuth();
  const { notebooks, notes, createNote, flushSaves } = useStore();
  const [sheet, setSheet] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const segment = pathname.split('/')[1] ?? '';
  const routeId = typeof params.id === 'string' ? params.id : pathname.split('/')[2];

  const active: NavKey | null =
    segment === 'today'
      ? 'today'
      : segment === 'shelf' || segment === 'notebook'
        ? 'shelf'
        : segment === 'search'
          ? 'search'
          : segment === 'tags'
            ? 'tags'
            : null;

  const action = segment === 'note' ? 'pen' : segment === 'editor' ? 'check' : 'plus';
  const actionLabel =
    action === 'pen' ? 'Edit this note' : action === 'check' ? 'Done editing' : 'New note';

  async function onAction() {
    if (action === 'pen' && routeId) {
      router.push(`/editor/${routeId}`);
      return;
    }
    if (action === 'check') {
      Keyboard.dismiss();
      await flushSaves();
      if (routeId) router.replace(`/note/${routeId}`);
      else router.back();
      return;
    }
    // New note: into the notebook you are looking at, else the first one.
    const target =
      (segment === 'notebook' && routeId) ||
      notes.find((n) => n.id === routeId)?.notebook_id ||
      notebooks[0]?.id;
    if (!target) {
      router.push('/shelf');
      return;
    }
    const made = await createNote(target);
    if (made) router.push(`/editor/${made.id}`);
  }

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: wide ? 'none' : 'fade',
        contentStyle: { backgroundColor: c.bg },
      }}
    />
  );

  const sheetNode = (
    <ProfileSheet
      visible={sheet}
      onClose={() => setSheet(false)}
      onGoGraph={() => router.replace('/graph')}
      onGoTags={() => router.replace('/tags')}
    />
  );

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.bg }}>
        <DesktopChrome onProfile={() => setSheet(true)} />
        <View style={{ flex: 1, minWidth: 0 }}>{stack}</View>
        <ErrorBanner />
        {sheetNode}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {stack}
      <ErrorBanner />

      {keyboardUp ? null : (
        <NavIslands
          active={active}
          action={action}
          actionLabel={actionLabel}
          onAction={onAction}
          onGo={(key) => router.replace(`/${key}`)}
          onProfile={() => setSheet(true)}
          initials={initialsOf(profile?.full_name || user?.email || '')}
          avatarUrl={avatarUrl}
        />
      )}

      {sheetNode}
    </View>
  );
}
