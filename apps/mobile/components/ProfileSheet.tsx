import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Blob } from './Blob';
import { initialsOf, useAuth } from '@jot/core/auth';
import { base64ToBytes } from '@jot/core/bytes';
import { useIsWide } from '../lib/layout';
import { useStore } from '@jot/core/store';
import { supabase } from '../lib/supabase';
import { c, f, shadow } from '@jot/core/theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onGoGraph: () => void;
  onGoTags: () => void;
};

export function ProfileSheet({ visible, onClose, onGoGraph, onGoTags }: Props) {
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const { profile, avatarUrl, user, saveProfile, signOut } = useAuth();
  const { notebooks, notes, exportNotebook } = useStore();
  const [busy, setBusy] = useState<null | 'avatar' | 'export'>(null);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const name = profile?.full_name || user?.email?.split('@')[0] || 'You';

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setMessage('Photo access is off, so the picture cannot change.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (res.canceled || !res.assets[0]?.base64 || !user) return;

    setBusy('avatar');
    setMessage(null);
    const path = `${user.id}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, base64ToBytes(res.assets[0].base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });
    if (error) {
      setMessage(error.message);
    } else {
      await saveProfile({ avatar_path: path });
      setMessage('Picture updated.');
    }
    setBusy(null);
  }

  async function runExport(notebookId: string) {
    setBusy('export');
    setPicking(false);
    const { markdown, url } = await exportNotebook(notebookId);
    setBusy(null);
    try {
      await Share.share({
        title: 'Notebook export',
        message: url ? `${url}\n\n${markdown.slice(0, 400)}…` : markdown,
      });
    } catch {
      // No share sheet in this browser; the signed link is enough.
      if (url && typeof window !== 'undefined') window.open(url, '_blank');
      else setMessage('Export saved to your Supabase storage.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        {/* Fills the whole screen behind the card, so the tap-out area reads as
            one even scrim instead of a grey band above a narrow card. */}
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 26 },
            wide && styles.sheetWide,
          ]}
        >
          <View style={styles.grabber} />

          <View style={styles.head}>
            <Pressable onPress={pickAvatar} accessibilityLabel="Change profile picture">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <Blob size={50} color={c.a300}>
                  <Text style={styles.initials}>{initialsOf(name)}</Text>
                </Blob>
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.meta}>
                {profile?.year_label || 'Student'} · {notebooks.length} notebooks · {notes.length} notes
              </Text>
            </View>
            {busy === 'avatar' ? <ActivityIndicator color={c.accent} /> : null}
          </View>

          <View style={{ gap: 7 }}>
            <SheetButton
              label="Open the link map"
              onPress={() => {
                onClose();
                onGoGraph();
              }}
            />
            <SheetButton
              label="Browse every tag"
              onPress={() => {
                onClose();
                onGoTags();
              }}
            />
            <SheetButton
              label={busy === 'export' ? 'Exporting…' : 'Export a notebook'}
              onPress={() => setPicking((p) => !p)}
            />
            {picking ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker}>
                {notebooks.map((nb) => (
                  <Pressable key={nb.id} onPress={() => runExport(nb.id)} style={styles.pickChip}>
                    <Text style={styles.pickChipText}>{nb.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <SheetButton label="Change profile picture" onPress={pickAvatar} />
            <SheetButton
              label="Sign out"
              tone="accent"
              onPress={async () => {
                onClose();
                await signOut();
              }}
            />
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

function SheetButton({
  label,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'accent';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'accent' && { backgroundColor: c.a100 },
        pressed && { backgroundColor: tone === 'accent' ? c.a200 : c.n300 },
      ]}
    >
      <Text style={[styles.buttonText, tone === 'accent' && { color: c.a700 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(46,43,37,0.34)',
  },
  sheet: {
    backgroundColor: c.paper,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 22,
    paddingTop: 16,
    gap: 16,
    ...shadow.lg,
  },
  sheetWide: {
    maxWidth: 460,
    alignSelf: 'center',
    marginBottom: 40,
    borderRadius: 34,
  },
  grabber: { width: 52, height: 5, borderRadius: 999, backgroundColor: c.n300, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 50, height: 50, borderRadius: 999 },
  initials: { fontFamily: f.head, fontSize: 17, color: c.a900 },
  name: { fontFamily: f.b800, fontSize: 16, color: c.text },
  meta: { fontFamily: f.b600, fontSize: 12.5, color: c.n600 },
  button: {
    backgroundColor: c.n200,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  buttonText: { fontFamily: f.b700, fontSize: 14, color: c.text },
  picker: { gap: 7, paddingVertical: 2 },
  pickChip: { backgroundColor: c.g200, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  pickChipText: { fontFamily: f.b700, fontSize: 12.5, color: c.g800 },
  message: { fontFamily: f.b500, fontSize: 12.5, color: c.n600 },
});
