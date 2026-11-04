/**
 * The tokens an OAuth return carries back to a phone. Supabase answers the
 * implicit flow in the fragment and an error in either half, so both are read.
 */
export type Returned =
  | { ok: true; access_token: string; refresh_token: string }
  | { ok: false; error: string };

export function tokensFromRedirect(url: string): Returned | null {
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  const params = new URLSearchParams();
  if (query !== -1) new URLSearchParams(url.slice(query + 1, hash === -1 ? undefined : hash)).forEach((v, k) => params.set(k, v));
  if (hash !== -1) new URLSearchParams(url.slice(hash + 1)).forEach((v, k) => params.set(k, v));

  const error = params.get('error_description') ?? params.get('error');
  if (error) return { ok: false, error };
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) return { ok: true, access_token, refresh_token };
  return null;
}
