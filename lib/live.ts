/**
 * Rows changed somewhere else — the website, another phone — arriving here
 * while the app is open, and folded into the lists the store holds.
 *
 * Nothing in here talks to Supabase; the store hands each change over as it
 * comes, so the rules about what to take and what to leave can be tested.
 */

type Row = { id: string };

export type Change<T extends Row> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  /** The row as it is now; empty on a delete. */
  new: Partial<T>;
  /**
   * The row as it was. On a delete this is only its id: deletes are not
   * checked against row level security, so nothing more is asked for.
   */
  old: Partial<T>;
};

/**
 * Rows put into a list by id: one already there is replaced, a new one joins.
 * Our own insert comes back as a change too, sometimes before the insert has
 * answered, so adding by id is what keeps a row from showing up twice.
 */
export function upsertRows<T extends Row>(list: T[], rows: T[], order?: (a: T, b: T) => number): T[] {
  if (!rows.length) return list;
  const incoming = new Map(rows.map((r) => [r.id, r]));
  const kept = list.map((r) => incoming.get(r.id) ?? r);
  const known = new Set(list.map((r) => r.id));
  const added = rows.filter((r) => !known.has(r.id));
  const next = [...added, ...kept];
  return order ? next.sort(order) : next;
}

/**
 * One change applied to a list. The list comes back as the same array when
 * nothing in it moved, so a change that only repeats what is here already
 * does not redraw anything.
 */
export function applyChange<T extends Row>(list: T[], change: Change<T>, order?: (a: T, b: T) => number): T[] {
  if (change.eventType === 'DELETE') {
    const id = change.old.id;
    return list.some((r) => r.id === id) ? list.filter((r) => r.id !== id) : list;
  }

  const row = change.new as T;
  if (!row.id) return list;
  const here = list.find((r) => r.id === row.id);
  if (here && sameRow(here, row)) return list;
  return upsertRows(list, [row], order);
}

function sameRow(a: object, b: object): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

/**
 * A Postgres timestamp as milliseconds, microseconds kept as the fraction.
 *
 * The REST API and Realtime both send `timestamptz` as text, and two saves a
 * few milliseconds apart have to compare the right way round; `Date.parse`
 * drops the microseconds and is not sure of the "+00" form on every engine.
 */
export function stampOf(text: string): number {
  const m =
    /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d):(\d\d)(?:\.(\d+))?(Z|([+-])(\d\d)(?::?(\d\d))?)?$/.exec(text);
  if (!m) return Date.parse(text);
  const [, y, mo, d, h, mi, s, frac = '', zone, sign, oh = '0', om = '0'] = m;
  const whole = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const part = frac ? Number('0.' + frac) * 1000 : 0;
  const offset = zone && zone !== 'Z' ? (sign === '-' ? -1 : 1) * (+oh * 60 + +om) * 60_000 : 0;
  return whole + part - offset;
}

/**
 * Whether a note change from elsewhere should land on the note held here.
 *
 * Not while this device has an edit of its own still waiting or on its way:
 * that edit is newer than anything the server can be sending. And not when it
 * is no newer than this device's own last save, because then it is that save
 * coming back, or an older one arriving late.
 */
export function takesNote(
  incoming: { updated_at?: string },
  { busy, savedAt }: { busy: boolean; savedAt?: string },
): boolean {
  if (busy) return false;
  if (!savedAt || !incoming.updated_at) return true;
  return stampOf(incoming.updated_at) > stampOf(savedAt);
}

/**
 * The edits to send next after a save failed: what failed, under anything
 * typed since. Without this the failed fields are gone for good, because the
 * queue is emptied before the request goes out and a later edit only carries
 * its own fields.
 */
export function requeued<T extends object>(failed: T, queued: T | undefined): T {
  return { ...failed, ...queued };
}
