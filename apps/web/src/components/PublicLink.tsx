import React, { useEffect, useRef, useState } from 'react';

import { useAuth } from '@jot/core/auth';
import { publicShareUrl, type ShareKind } from '@jot/core/sharing';
import { useStore } from '@jot/core/store';

import { supabase } from '../supabase';
import { Icon } from './Icon';

/** Publish, copy or withdraw the read-only link for a note or a notebook. */
export function PublicLink({ kind, id, published, inherited = false }: {
  kind: ShareKind; id: string; published: boolean; inherited?: boolean;
}) {
  const { user } = useAuth();
  const { refresh } = useStore();
  const [enabled, setEnabled] = useState(published);
  const [message, setMessage] = useState<string | null>(null);
  const locked = useRef(false);
  useEffect(() => setEnabled(published), [published, id]);
  const url = publicShareUrl(window.location.origin, kind, id);

  async function toggle() {
    if (!user || locked.current) return;
    locked.current = true;
    setMessage(null);
    try {
      const { data, error } = await supabase.from(kind === 'note' ? 'notes' : 'notebooks')
        .update({ is_public: !enabled }).eq('id', id).eq('user_id', user.id)
        .select('is_public').single();
      if (error) throw error;
      setEnabled(data.is_public);
      await refresh();
    } catch {
      setMessage('could not change sharing — is the public sharing SQL installed?');
    } finally {
      locked.current = false;
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('link copied');
    } catch {
      setMessage(url);
    }
  }

  const live = enabled || inherited;
  return (
    <span className="public-link">
      {live ? (
        <>
          <a className="icon-button on" href={url} target="_blank" rel="noreferrer"
            title={inherited && !enabled ? 'Public through its notebook — open the public page' : 'Public — open the public page'}
            aria-label="Open the public page"><Icon name="eye" /></a>
          <button className="icon-button" onClick={copy} title="Copy the public link" aria-label="Copy the public link"><Icon name="link" /></button>
        </>
      ) : null}
      {inherited && !enabled ? null : enabled ? (
        <button className="icon-button" onClick={toggle} title="Unpublish" aria-label="Unpublish"><Icon name="close" /></button>
      ) : (
        <button className="icon-button" onClick={toggle} title="Publish a read-only link" aria-label="Publish a read-only link"><Icon name="eye" /></button>
      )}
      {message ? <span className="hint">{message}</span> : null}
    </span>
  );
}
