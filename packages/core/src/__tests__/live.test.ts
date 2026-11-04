import { describe, expect, it } from 'vitest';

import { applyChange, requeued, stampOf, takesNote, upsertRows } from '../live';

type Row = { id: string; text: string; at: number };

const a: Row = { id: 'a', text: 'one', at: 1 };
const b: Row = { id: 'b', text: 'two', at: 2 };
const byAt = (x: Row, y: Row) => x.at - y.at;

describe('upsertRows', () => {
  it('replaces a row it already has instead of adding it twice', () => {
    expect(upsertRows([a, b], [{ ...a, text: 'uno' }])).toEqual([{ ...a, text: 'uno' }, b]);
  });

  it('puts a new row in front, or where the order says', () => {
    const c = { id: 'c', text: 'three', at: 0 };
    expect(upsertRows([a, b], [c]).map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(upsertRows([b, a], [c], byAt).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('applyChange', () => {
  it('adds an insert from elsewhere', () => {
    const c = { id: 'c', text: 'three', at: 3 };
    expect(applyChange([a, b], { eventType: 'INSERT', new: c, old: {} }, byAt)).toEqual([a, b, c]);
  });

  it('takes an update', () => {
    const next = applyChange([a, b], { eventType: 'UPDATE', new: { ...b, text: 'deux' }, old: {} });
    expect(next).toEqual([a, { ...b, text: 'deux' }]);
  });

  it('drops a delete, by id alone', () => {
    expect(applyChange([a, b], { eventType: 'DELETE', new: {}, old: { id: 'a' } })).toEqual([b]);
  });

  it('hands back the same list when nothing moved', () => {
    const list = [a, b];
    expect(applyChange(list, { eventType: 'UPDATE', new: { ...a }, old: {} })).toBe(list);
    expect(applyChange(list, { eventType: 'DELETE', new: {}, old: { id: 'someone-elses' } })).toBe(list);
  });
});

describe('stampOf', () => {
  it('reads the forms Postgres sends', () => {
    const base = Date.UTC(2026, 9, 4, 16, 5, 21);
    expect(stampOf('2026-10-04T16:05:21+00:00')).toBe(base);
    expect(stampOf('2026-10-04 16:05:21+00')).toBe(base);
    expect(stampOf('2026-10-04T16:05:21Z')).toBe(base);
    expect(stampOf('2026-10-04T18:05:21+02:00')).toBe(base);
  });

  it('keeps the microseconds apart', () => {
    expect(stampOf('2026-10-04T16:05:21.123457+00:00')).toBeGreaterThan(stampOf('2026-10-04T16:05:21.123456+00:00'));
  });
});

describe('takesNote', () => {
  const saved = '2026-10-04T16:05:21.500000+00:00';

  it('leaves a note alone while it is being written here', () => {
    expect(takesNote({ updated_at: '2026-10-04T17:00:00+00:00' }, { busy: true, savedAt: saved })).toBe(false);
  });

  it('skips this device’s own save coming back, and older ones', () => {
    expect(takesNote({ updated_at: saved }, { busy: false, savedAt: saved })).toBe(false);
    expect(takesNote({ updated_at: '2026-10-04T16:05:20+00:00' }, { busy: false, savedAt: saved })).toBe(false);
  });

  it('takes a newer change from elsewhere', () => {
    expect(takesNote({ updated_at: '2026-10-04T16:05:22+00:00' }, { busy: false, savedAt: saved })).toBe(true);
    expect(takesNote({ updated_at: saved }, { busy: false })).toBe(true);
  });
});

describe('requeued', () => {
  it('puts a failed save back so its fields are sent again', () => {
    expect(requeued({ title: 'Week 3' }, undefined)).toEqual({ title: 'Week 3' });
  });

  it('keeps what was typed since over the failed copy of the same field', () => {
    expect(requeued({ title: 'old', tags: ['a'] }, { title: 'new' })).toEqual({ title: 'new', tags: ['a'] });
  });
});
