import { selectAll } from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { addMenuItems, MOD, type MenuItem } from '../components/menu';
import { toggleWrap } from './commands';

function itemsFor(view: EditorView): MenuItem[] {
  // The editor's own copy and cut run, so copying with nothing selected still takes the line.
  const run = (command: 'copy' | 'cut') => () => {
    view.focus();
    document.execCommand(command);
  };
  const paste = async () => {
    const text = await navigator.clipboard.readText().catch(() => null);
    if (text) view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.paste', scrollIntoView: true });
    view.focus();
  };
  const wrap = (mark: string) => () => {
    toggleWrap(view, mark);
    view.focus();
  };
  return [
    { label: 'Cut', keys: `${MOD}X`, run: run('cut') },
    { label: 'Copy', keys: `${MOD}C`, run: run('copy') },
    { label: 'Paste', keys: `${MOD}V`, run: () => void paste() },
    { label: 'Select all', keys: `${MOD}A`, run: () => selectAll(view) },
    'sep',
    { label: 'Bold', keys: `${MOD}Shift+B`, run: wrap('**') },
    { label: 'Italic', keys: `${MOD}I`, run: wrap('*') },
    { label: 'Code', keys: `${MOD}E`, run: wrap('`') },
    'sep',
    { label: 'Find', keys: `${MOD}F`, run: () => openSearchPanel(view) },
  ];
}

/** Editing items for the app's right-click menu, acting on this editor. */
export const editorMenu: Extension = EditorView.domEventHandlers({
  contextmenu(e, view) {
    addMenuItems(e, itemsFor(view));
    return false;
  },
});
