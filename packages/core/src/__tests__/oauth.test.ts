import { describe, expect, it } from 'vitest';

import { tokensFromRedirect } from '../oauth';

describe('tokensFromRedirect', () => {
  it('reads tokens from the fragment', () => {
    expect(tokensFromRedirect('jot://auth/callback#access_token=a.b.c&refresh_token=r1&token_type=bearer')).toEqual({
      ok: true, access_token: 'a.b.c', refresh_token: 'r1',
    });
  });

  it('reports an error from either half', () => {
    expect(tokensFromRedirect('jot://auth/callback?error=access_denied&error_description=User+cancelled')).toEqual({
      ok: false, error: 'User cancelled',
    });
    expect(tokensFromRedirect('jot://auth/callback#error=server_error')).toEqual({ ok: false, error: 'server_error' });
  });

  it('returns null for a return with neither', () => {
    expect(tokensFromRedirect('jot://auth/callback')).toBeNull();
    expect(tokensFromRedirect('jot://auth/callback#access_token=only')).toBeNull();
  });
});
