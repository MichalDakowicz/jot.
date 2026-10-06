/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import schema from '../../supabase/schema.sql?raw';
import { TINTS } from '../../theme/tokens';

describe('notebooks.tint', () => {
  it('lets the database store every colour the app offers', () => {
    const bounds = [...schema.matchAll(/tint between (\d+) and (\d+)/g)];
    expect(bounds.length).toBeGreaterThan(0);
    bounds.forEach(([, low, high]) => {
      expect(Number(low)).toBe(0);
      expect(Number(high)).toBe(TINTS.length - 1);
    });
  });

  it('widens the check on a database made before the newer colours', () => {
    expect(schema).toMatch(/drop constraint if exists notebooks_tint_check/);
  });
});
