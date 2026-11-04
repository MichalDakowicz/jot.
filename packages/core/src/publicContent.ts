import { publicSupabase, supabaseConfigured } from './client';
import type { ShareKind } from './sharing';

export type PublicNote = { id: string; title: string; body: string; tags: string[]; updated_at: string };
export type PublicNotebook = { id: string; name: string; code: string; prof: string };

export type PublicContent = {
  notebook?: PublicNotebook;
  notes: PublicNote[];
  /** For a note inside a published notebook: its public siblings, to read on from. */
  siblings?: PublicNote[];
};

const UNAVAILABLE = 'This link is unavailable. It may be private or deleted.';
const COLUMNS = 'id, title, body, tags, updated_at';

/**
 * What a share link shows, read anonymously even when the owner is signed in,
 * so a withdrawn link fails for them the same way it fails for everyone.
 */
export async function loadPublic(kind: string | undefined, id: string | undefined): Promise<PublicContent> {
  if (!supabaseConfigured) throw new Error('Public sharing is not configured on this website.');
  if ((kind !== 'note' && kind !== 'notebook') || !/^[0-9a-f-]{36}$/i.test(id ?? '')) throw new Error(UNAVAILABLE);
  const share = kind as ShareKind;

  if (share === 'note') {
    const { data, error } = await publicSupabase.from('notes').select(`${COLUMNS}, notebook_id`).eq('id', id!).maybeSingle();
    if (error) throw new Error('Could not load this note. Try again.');
    if (!data) throw new Error(UNAVAILABLE);
    const result: PublicContent = { notes: [data] };
    // A standalone note never exposes private siblings; a published notebook lets readers move between its notes.
    const { data: notebook } = await publicSupabase.from('notebooks')
      .select('id, name, code, prof, user_id').eq('id', data.notebook_id).eq('is_public', true).maybeSingle();
    if (notebook) {
      const { data: siblings } = await publicSupabase.from('notes').select(COLUMNS)
        .eq('notebook_id', notebook.id).eq('user_id', notebook.user_id).order('updated_at', { ascending: false });
      result.notebook = notebook;
      if (siblings) result.siblings = siblings;
    }
    return result;
  }

  const { data: notebook, error } = await publicSupabase.from('notebooks')
    .select('id, name, code, prof, user_id').eq('id', id!).maybeSingle();
  if (error) throw new Error('Could not load this notebook. Try again.');
  if (!notebook) throw new Error(UNAVAILABLE);
  const { data: notes, error: notesError } = await publicSupabase.from('notes').select(COLUMNS)
    .eq('notebook_id', id!).eq('user_id', notebook.user_id).order('updated_at', { ascending: false });
  if (notesError) throw new Error('Could not load the notes. Try again.');
  return { notebook, notes: notes ?? [] };
}
