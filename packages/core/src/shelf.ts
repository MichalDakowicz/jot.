/** The notebook an address is about, if it is a notebook's own page. */
export function notebookInPath(pathname: string): string | null {
  const [, segment, id] = pathname.split('/');
  return segment === 'notebook' && id ? id : null;
}

/**
 * Which notebook the desktop list opens on after a reload.
 *
 * The address wins: a reload on /notebook/<id> is that notebook, whatever was
 * picked last. Anywhere else the last pick comes back, so reloading a note does
 * not throw the list back to everything.
 */
export function openingNotebook(pathname: string, remembered: string | null): string | null {
  return notebookInPath(pathname) ?? (remembered || null);
}

/**
 * A pick that still names a notebook. Until the notebooks have loaded there is
 * nothing to check against, so the pick stands; once they have, a notebook
 * deleted since is dropped — a filter on it is an empty list with no reason
 * given.
 */
export function stillThere(picked: string | null, known: string[]): string | null {
  if (!picked || known.length === 0) return picked;
  return known.includes(picked) ? picked : null;
}
