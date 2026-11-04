import React, { useState } from 'react';
import { Link } from 'react-router';

import { withTag, withoutTag } from '@jot/core/tags';

/** The tags under a note's title: type and press space, comma or Enter; click × to drop one. */
export function TagRow({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function commit(raw: string) {
    const parts = raw.split(/[\s,]+/).filter(Boolean);
    if (parts.length) onChange(parts.reduce(withTag, tags));
    setDraft('');
  }

  return (
    <span className="tag-row">
      {tags.map((t) => (
        <span key={t} className="tag">
          <Link to={`/tags?tag=${encodeURIComponent(t)}`}>#{t}</Link>
          <button aria-label={`Remove ${t}`} onClick={() => onChange(withoutTag(tags, t))}>×</button>
        </span>
      ))}
      <input
        className="tag-input"
        value={draft}
        placeholder={tags.length ? '+tag' : '+ add a tag'}
        aria-label="Add a tag"
        onChange={(e) => {
          const v = e.target.value;
          if (/[\s,]$/.test(v)) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(draft);
          if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => draft && commit(draft)}
      />
    </span>
  );
}
