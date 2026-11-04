import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Share, Text, TextInput, View } from 'react-native';

import { useAuth } from '../lib/auth';
import { publicShareUrl, type ShareKind } from '../lib/sharing';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { c, f } from '../theme/tokens';

export function PublicShare({ kind, id, published, inherited = false }: {
  kind: ShareKind; id: string; published: boolean; inherited?: boolean;
}) {
  const { user } = useAuth();
  const { refresh } = useStore();
  const [enabled, setEnabled] = useState(published);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);
  useEffect(() => { setEnabled(published); }, [published, id]);

  let url = '';
  try {
    url = publicShareUrl(
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : process.env.EXPO_PUBLIC_SITE_URL || 'https://jot-notebook.web.app',
      kind, id,
    );
  } catch { /* Report configuration errors before publishing. */ }

  async function toggle() {
    if (!user || locked.current) return;
    if (!url) { setMessage('Set a valid public website URL before sharing.'); return; }
    locked.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.from(kind === 'note' ? 'notes' : 'notebooks')
        .update({ is_public: !enabled }).eq('id', id).eq('user_id', user.id)
        .select('is_public').single();
      if (error) throw error;
      setEnabled(data.is_public);
      await refresh();
    } catch {
      setMessage('Could not change sharing. Try again, or check that the public sharing SQL is installed.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function copy() {
    setMessage(null);
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(url);
        setMessage('Link copied.');
      } else {
        await Share.share({ message: url, ...(Platform.OS === 'ios' ? { url } : {}) });
      }
    } catch { setMessage('Select the link below to copy it.'); }
  }

  return (
    <View style={{ gap: 10, padding: 16, borderRadius: 20, backgroundColor: c.n200 }}>
      <Text style={{ fontFamily: f.b700, color: c.text }}>Public link</Text>
      <Text style={{ fontFamily: f.b500, color: c.n600, lineHeight: 20 }}>
        {inherited
          ? 'This note is public because its notebook is shared. Disable the notebook link to make it private.'
          : kind === 'notebook'
            ? 'Anyone with the link can read every current and future note in this notebook. No sign-in needed.'
            : 'Anyone with the link can read this note. No sign-in needed.'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={toggle} style={{ paddingVertical: 10 }}>
          <Text style={{ fontFamily: f.b700, color: c.accent }}>
            {busy ? 'Saving…' : enabled ? `Disable ${kind} link` : `Enable ${kind} link`}
          </Text>
        </Pressable>
        {(enabled || inherited) && url ? (
          <Pressable accessibilityRole="button" onPress={copy} style={{ paddingVertical: 10 }}>
            <Text style={{ fontFamily: f.b700, color: c.accent }}>{Platform.OS === 'web' ? 'Copy link' : 'Share link'}</Text>
          </Pressable>
        ) : null}
      </View>
      {(enabled || inherited) && url ? (
        <TextInput accessibilityLabel="Public sharing URL" value={url} editable={false} selectTextOnFocus
          style={{ fontFamily: f.b400, color: c.text, padding: 8 }} />
      ) : null}
      {enabled && inherited ? <Text style={{ color: c.n600 }}>The separate note link also keeps this note public.</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={{ color: c.n600 }}>{message}</Text> : null}
    </View>
  );
}
