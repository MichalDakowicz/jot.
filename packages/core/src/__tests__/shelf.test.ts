import { describe, expect, it } from 'vitest';

import { notebookInPath, openingNotebook, stillThere } from '../shelf';

describe('notebookInPath', () => {
  it('reads the id off a notebook page', () => {
    expect(notebookInPath('/notebook/nb-1')).toBe('nb-1');
  });

  it('is nothing anywhere else', () => {
    expect(notebookInPath('/note/n-1')).toBeNull();
    expect(notebookInPath('/shelf')).toBeNull();
    expect(notebookInPath('/notebook')).toBeNull();
    expect(notebookInPath('/')).toBeNull();
  });
});

describe('openingNotebook', () => {
  it('brings the last pick back on a reload away from a notebook page', () => {
    expect(openingNotebook('/note/n-1', 'nb-2')).toBe('nb-2');
    expect(openingNotebook('/today', 'nb-2')).toBe('nb-2');
  });

  it('lets the address win over the last pick', () => {
    expect(openingNotebook('/notebook/nb-1', 'nb-2')).toBe('nb-1');
  });

  it('opens on everything when nothing was picked', () => {
    expect(openingNotebook('/note/n-1', null)).toBeNull();
    expect(openingNotebook('/note/n-1', '')).toBeNull();
  });
});

describe('stillThere', () => {
  it('keeps a pick that names a notebook', () => {
    expect(stillThere('nb-1', ['nb-1', 'nb-2'])).toBe('nb-1');
  });

  it('drops a notebook deleted since', () => {
    expect(stillThere('nb-9', ['nb-1', 'nb-2'])).toBeNull();
  });

  it('trusts the pick while the notebooks are still loading', () => {
    expect(stillThere('nb-9', [])).toBe('nb-9');
  });
});
