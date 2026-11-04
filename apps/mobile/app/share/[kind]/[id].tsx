import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Markdown } from '../../../components/Markdown';
import { ReadingNavigation } from '../../../components/ReadingNavigation';
import { Empty, Kicker, Screen, Title } from '../../../components/ui';
import { publicSupabase, supabaseConfigured } from '../../../lib/supabase';
import { relative } from '@jot/core/time';
import { c, f } from '@jot/core/theme/tokens';

type SharedNote = { id: string; title: string; body: string; tags: string[]; updated_at: string };
type SharedNotebook = { id: string; name: string; code: string; prof: string; user_id: string };
type Content = { notebook?: SharedNotebook; notes: SharedNote[]; navigationNotes?: SharedNote[] };

export default function PublicPage() {
  const { kind, id, section } = useLocalSearchParams<{ kind: string; id: string; section?: string }>();
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const noteY = useRef<Record<string, number>>({});
  const markdownY = useRef<Record<string, number>>({});
  const headingY = useRef<Record<string, number>>({});
  const requestedSection = section !== undefined && /^\d+$/.test(section) ? Number(section) : null;
  function jumpToRequestedSection() {
    if (kind !== 'note' || requestedSection === null) return;
    const heading = headingY.current[`${id}-${requestedSection}`];
    if (heading !== undefined && noteY.current[id] !== undefined && markdownY.current[id] !== undefined) {
      scroll.current?.scrollTo({ y: Math.max(0, noteY.current[id] + markdownY.current[id] + heading - 12), animated: true });
    }
  }
  useEffect(jumpToRequestedSection, [kind, id, section]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setContent(null);
    setProblem(null);
    async function load() {
      try {
        if (!supabaseConfigured) throw new Error('Public sharing is not configured on this website.');
        if ((kind !== 'note' && kind !== 'notebook') || !/^[0-9a-f-]{36}$/i.test(id ?? '')) {
          throw new Error('This link is unavailable. It may be private or deleted.');
        }
        const columns = 'id, title, body, tags, updated_at';
        let result: Content;
        if (kind === 'note') {
          const { data, error } = await publicSupabase.from('notes').select(`${columns}, notebook_id`).eq('id', id).maybeSingle();
          if (error) throw new Error('Could not load this note. Try again.');
          if (!data) throw new Error('This link is unavailable. It may be private or deleted.');
          result = { notes: [data] };
          // A standalone note never exposes private siblings. A published
          // notebook allows readers to switch between its public notes.
          const { data: notebook } = await publicSupabase.from('notebooks')
            .select('id, user_id').eq('id', data.notebook_id).eq('is_public', true).maybeSingle();
          if (notebook) {
            const { data: siblings } = await publicSupabase.from('notes').select(columns)
              .eq('notebook_id', notebook.id).eq('user_id', notebook.user_id).order('updated_at', { ascending: false });
            if (siblings) result.navigationNotes = siblings;
          }
        } else {
          const { data: notebook, error } = await publicSupabase.from('notebooks')
            .select('id, name, code, prof, user_id').eq('id', id).maybeSingle();
          if (error) throw new Error('Could not load this notebook. Try again.');
          if (!notebook) throw new Error('This link is unavailable. It may be private or deleted.');
          const { data: notes, error: notesError } = await publicSupabase.from('notes').select(columns)
            .eq('notebook_id', id).eq('user_id', notebook.user_id).order('updated_at', { ascending: false });
          if (notesError) throw new Error('Could not load the notes. Try again.');
          result = { notebook, notes: notes ?? [] };
        }
        if (alive) setContent(result);
      } catch (error) {
        if (alive) setProblem(error instanceof Error ? error.message : 'Could not load this link.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [kind, id, attempt]);

  return (
    <Screen gap={20} scrollRef={scroll} toolbar={!loading && content ? (sidebar) => (
      <ReadingNavigation key={`${kind}-${id}`} fillHeight={sidebar} notes={content.navigationNotes ?? content.notes}
        currentId={kind === 'note' ? id : undefined}
        onNote={(noteId) => kind === 'note' && noteId !== id
          ? router.push(`/share/note/${noteId}`)
          : scroll.current?.scrollTo({ y: Math.max(0, (noteY.current[noteId] ?? 0) - 12), animated: true })}
        onSection={(noteId, blockIndex) => kind === 'note' && noteId !== id
          ? router.push(`/share/note/${noteId}?section=${blockIndex}`)
          : scroll.current?.scrollTo({
          y: Math.max(0, (noteY.current[noteId] ?? 0) + (markdownY.current[noteId] ?? 0) + (headingY.current[`${noteId}-${blockIndex}`] ?? 0) - 12), animated: true,
        })} />
    ) : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Kicker>Jot. · Public {kind === 'notebook' ? 'notebook' : 'note'} · Read only</Kicker>
        <Pressable accessibilityRole="link" onPress={() => router.push('/')} style={{ padding: 10 }}>
          <Text style={{ fontFamily: f.b700, color: c.accent }}>Open Jot</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading shared content" color={c.accent} /> : null}
      {problem ? <>
        <Empty text={problem} />
        <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}>
          <Text style={{ fontFamily: f.b700, color: c.accent, paddingVertical: 12 }}>Try again</Text>
        </Pressable>
      </> : null}
      {!loading && content ? <>
        {content.notebook ? <>
          <Title>{content.notebook.name}</Title>
          <Text style={{ color: c.n600 }}>{[content.notebook.code, content.notebook.prof,
            `${content.notes.length} ${content.notes.length === 1 ? 'note' : 'notes'}`].filter(Boolean).join(' · ')}</Text>
          {!content.notes.length ? <Empty text="No notes in this notebook yet." /> : null}
        </> : null}
        {content.notes.map((note) => (
          <View key={note.id} style={{ gap: 14, paddingVertical: 16 }}
            onLayout={(event) => { noteY.current[note.id] = event.nativeEvent.layout.y; jumpToRequestedSection(); }}>
            {content.notebook ? (
              <Pressable accessibilityRole="link" onPress={() => router.push(`/share/note/${note.id}`)}>
                <Title>{note.title}</Title>
              </Pressable>
            ) : <Title>{note.title}</Title>}
            <Text style={{ fontFamily: f.b500, color: c.n600 }}>
              {[`Edited ${relative(note.updated_at)}`, ...(note.tags ?? []).map((tag) => `#${tag}`)].join(' · ')}
            </Text>
            <Markdown source={note.body} mentions={content.notes}
              onLayout={(y) => { markdownY.current[note.id] = y; jumpToRequestedSection(); }}
              onHeadingLayout={(blockIndex, y) => { headingY.current[`${note.id}-${blockIndex}`] = y; jumpToRequestedSection(); }}
              onMention={(noteId) => router.push(`/share/note/${noteId}`)} />
          </View>
        ))}
      </> : null}
    </Screen>
  );
}
