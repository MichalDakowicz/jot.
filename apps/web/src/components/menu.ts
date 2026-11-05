import type React from 'react';

export type MenuItem = { label: string; keys?: string; run: () => void; disabled?: boolean } | 'sep';

/** Ctrl on most keyboards, ⌘ on a Mac. */
export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

const added = new WeakMap<Event, MenuItem[][]>();

/**
 * Puts items in the menu this right-click opens. Called from an
 * onContextMenu handler on the way up, so the innermost element's items
 * come first and the page's own follow.
 */
export function addMenuItems(e: React.MouseEvent | MouseEvent, items: MenuItem[]) {
  const native = 'nativeEvent' in e ? e.nativeEvent : e;
  const groups = added.get(native) ?? [];
  groups.push(items);
  added.set(native, groups);
}

async function pasteInto(el: HTMLElement) {
  const text = await navigator.clipboard.readText().catch(() => null);
  if (text === null) return;
  el.focus();
  document.execCommand('insertText', false, text);
}

/** What any spot offers by itself: editing for a text field, the link under the pointer, a copy of selected text. */
function ownItems(target: Element): MenuItem[] {
  // The note editor brings its own editing items.
  if (target.closest('.cm-editor')) return [];
  const field = target.closest<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  if (field && !field.readOnly && !field.disabled) {
    const picked = field.selectionStart !== field.selectionEnd;
    return [
      { label: 'Cut', keys: `${MOD}X`, disabled: !picked, run: () => document.execCommand('cut') },
      { label: 'Copy', keys: `${MOD}C`, disabled: !picked, run: () => document.execCommand('copy') },
      { label: 'Paste', keys: `${MOD}V`, run: () => void pasteInto(field) },
      { label: 'Select all', keys: `${MOD}A`, run: () => field.select() },
    ];
  }
  const items: MenuItem[] = [];
  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (link) {
    items.push(
      { label: 'Open link in new tab', run: () => window.open(link.href, '_blank', 'noopener') },
      { label: 'Copy link', run: () => void navigator.clipboard.writeText(link.href) },
    );
  }
  const text = window.getSelection()?.toString() ?? '';
  if (text) items.push({ label: 'Copy', keys: `${MOD}C`, run: () => void navigator.clipboard.writeText(text) });
  return items;
}

/** Every item for this right-click, in groups split by rules; nothing to show leaves it empty. */
export function menuFor(e: MouseEvent): MenuItem[] {
  const groups = [ownItems(e.target as Element), ...(added.get(e) ?? [])].filter((g) => g.length);
  return groups.flatMap((g, k) => (k ? ['sep' as const, ...g] : g));
}
