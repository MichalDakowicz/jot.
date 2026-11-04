import {
  closeSearchPanel, findNext, findPrevious, getSearchQuery, replaceAll, replaceNext, search, SearchQuery, selectMatches,
  setSearchQuery,
} from '@codemirror/search';
import type { EditorState, Extension } from '@codemirror/state';
import type { EditorView, Panel, ViewUpdate } from '@codemirror/view';

const ICONS = {
  chevron: 'M6 4l4 4-4 4',
  up: 'M8 13V3M4 7l4-4 4 4',
  down: 'M8 3v10M4 9l4 4 4-4',
  all: 'M3 4h10M3 8h10M3 12h10',
  close: 'M4 4l8 8M12 4l-8 8',
  replace: 'M3 5h7a3 3 0 0 1 0 6H6M8 9l-2 2 2 2',
  replaceAll: 'M3 4h6M3 7h6M11 6v6M8 10l3 3 3-3',
} as const;

function icon(name: keyof typeof ICONS): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name]);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.4');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function button(label: string, content: SVGSVGElement | string, onClick: () => void, className = 'find-icon'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(content);
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', onClick);
  return b;
}

/** "3 of 12", counted up to a thousand so a one-letter search stays quick. */
function countOf(state: EditorState, query: SearchQuery): string {
  if (!query.search) return '';
  if (!query.valid) return 'Invalid';
  const head = state.selection.main;
  const cursor = query.getCursor(state);
  let total = 0;
  let current = 0;
  for (let next = cursor.next(); !next.done && total < 1000; next = cursor.next()) {
    total++;
    if (next.value.from === head.from && next.value.to === head.to) current = total;
  }
  if (!total) return 'No results';
  const of = total >= 1000 ? '999+' : String(total);
  return current ? `${current} of ${of}` : `${of} found`;
}

/**
 * Find as a code editor has it: one compact row at the top right of the
 * text — the field, three toggles, the count, previous/next, select all,
 * close — with replace folded under a chevron. It floats over the text, so
 * it stays in reach however far the notebook is scrolled.
 */
function createFindPanel(view: EditorView): Panel {
  const dom = document.createElement('div');
  dom.className = 'find';

  let query = getSearchQuery(view.state);
  const field = (name: string, placeholder: string, value: string) => {
    const input = document.createElement('input');
    input.className = 'find-field';
    input.name = name;
    input.placeholder = placeholder;
    input.value = value;
    input.setAttribute('aria-label', placeholder);
    input.spellcheck = false;
    return input;
  };
  const find = field('search', 'Find', query.search);
  find.setAttribute('main-field', 'true');
  const replace = field('replace', 'Replace', query.replace);

  const toggle = (label: string, text: string, key: 'caseSensitive' | 'wholeWord' | 'regexp') => {
    const b = button(label, text, () => {
      commit({ [key]: !query[key] });
    }, 'find-toggle');
    return b;
  };
  const caseBtn = toggle('Match case (Alt+C)', 'Aa', 'caseSensitive');
  const wordBtn = toggle('Whole word (Alt+W)', 'ab', 'wholeWord');
  const regexBtn = toggle('Regular expression (Alt+R)', '.*', 'regexp');
  const count = document.createElement('span');
  count.className = 'find-count';

  const replaceRow = document.createElement('div');
  replaceRow.className = 'find-row find-replace';
  replaceRow.hidden = !query.replace;
  const expand = button('Toggle replace', icon('chevron'), () => {
    replaceRow.hidden = !replaceRow.hidden;
    sync();
    if (!replaceRow.hidden) replace.focus();
  }, 'find-icon find-expand');

  function commit(patch: Partial<{ search: string; replace: string; caseSensitive: boolean; wholeWord: boolean; regexp: boolean }>) {
    const next = new SearchQuery({
      search: patch.search ?? find.value,
      replace: patch.replace ?? replace.value,
      caseSensitive: patch.caseSensitive ?? query.caseSensitive,
      wholeWord: patch.wholeWord ?? query.wholeWord,
      regexp: patch.regexp ?? query.regexp,
    });
    if (!next.eq(query)) {
      query = next;
      view.dispatch({ effects: setSearchQuery.of(next) });
    }
    sync();
  }

  function sync() {
    caseBtn.classList.toggle('on', query.caseSensitive);
    wordBtn.classList.toggle('on', query.wholeWord);
    regexBtn.classList.toggle('on', query.regexp);
    for (const b of [caseBtn, wordBtn, regexBtn]) b.setAttribute('aria-pressed', String(b.classList.contains('on')));
    expand.classList.toggle('open', !replaceRow.hidden);
    const text = countOf(view.state, query);
    count.textContent = text;
    count.classList.toggle('none', text === 'No results' || text === 'Invalid');
  }

  find.addEventListener('input', () => commit({ search: find.value }));
  replace.addEventListener('input', () => commit({ replace: replace.value }));
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchPanel(view);
      view.focus();
    } else if (e.key === 'Enter' && e.target === find) {
      e.preventDefault();
      (e.shiftKey ? findPrevious : findNext)(view);
    } else if (e.key === 'Enter' && e.target === replace) {
      e.preventDefault();
      (e.ctrlKey || e.metaKey ? replaceAll : replaceNext)(view);
    } else if (e.altKey && !e.ctrlKey) {
      const k = e.key.toLowerCase();
      if (k === 'c' || k === 'w' || k === 'r') {
        e.preventDefault();
        commit(k === 'c' ? { caseSensitive: !query.caseSensitive } : k === 'w' ? { wholeWord: !query.wholeWord } : { regexp: !query.regexp });
      }
    }
  };
  find.addEventListener('keydown', keys);
  replace.addEventListener('keydown', keys);

  const box = document.createElement('div');
  box.className = 'find-box';
  box.append(find, caseBtn, wordBtn, regexBtn);

  const findRow = document.createElement('div');
  findRow.className = 'find-row';
  findRow.append(
    box,
    count,
    button('Previous match (Shift+Enter)', icon('up'), () => findPrevious(view)),
    button('Next match (Enter)', icon('down'), () => findNext(view)),
    button('Select all matches', icon('all'), () => selectMatches(view)),
    button('Close (Escape)', icon('close'), () => {
      closeSearchPanel(view);
      view.focus();
    }),
  );
  replaceRow.append(
    replace,
    button('Replace (Enter)', icon('replace'), () => replaceNext(view)),
    button('Replace all (Ctrl+Enter)', icon('replaceAll'), () => replaceAll(view)),
  );

  const rows = document.createElement('div');
  rows.className = 'find-rows';
  rows.append(findRow, replaceRow);
  dom.append(expand, rows);
  sync();

  return {
    dom,
    top: true,
    mount() {
      find.select();
    },
    update(u: ViewUpdate) {
      const now = getSearchQuery(u.state);
      if (!now.eq(query)) {
        query = now;
        find.value = now.search;
        replace.value = now.replace;
      }
      if (u.docChanged || u.selectionSet || u.transactions.some((tr) => tr.effects.length)) sync();
    },
  };
}

export const compactFind: Extension = search({ top: true, createPanel: createFindPanel });
