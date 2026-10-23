import { Lernhilfe } from '../types';

const ORDER_STORAGE_PREFIX = 'lernhilfen_worksheet_order_v1_';

/**
 * Returns saved array of Lernhilfe IDs for a worksheet group, or empty array.
 */
export function getSavedWorksheetOrder(groupName: string): string[] {
  if (!groupName) return [];
  try {
    const raw = localStorage.getItem(`${ORDER_STORAGE_PREFIX}${groupName.trim()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to read worksheet order:', e);
  }
  return [];
}

/**
 * Saves custom order of Lernhilfe IDs for a worksheet group.
 */
export function saveWorksheetOrder(groupName: string, orderedIds: string[]): void {
  if (!groupName) return;
  try {
    localStorage.setItem(
      `${ORDER_STORAGE_PREFIX}${groupName.trim()}`,
      JSON.stringify(orderedIds)
    );
    // Broadcast event so any open view/portal updates
    window.dispatchEvent(
      new CustomEvent('worksheet-order-updated', {
        detail: { groupName: groupName.trim(), orderedIds },
      })
    );
  } catch (e) {
    console.warn('Failed to save worksheet order:', e);
  }
}

/**
 * Natural sort comparison for task titles (e.g. "Aufgabe 1", "Aufgabe 2", "Aufgabe 10")
 */
export function naturalTitleCompare(a: Lernhilfe, b: Lernhilfe): number {
  return a.title.localeCompare(b.title, 'de', {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Sorts items belonging to a worksheet according to teacher-defined order,
 * with fallback to natural title ordering.
 */
export function sortWorksheetItems(groupName: string, items: Lernhilfe[]): Lernhilfe[] {
  if (!items || items.length <= 1) return items;

  const savedIds = getSavedWorksheetOrder(groupName);

  if (savedIds.length > 0) {
    const idIndexMap = new Map<string, number>();
    savedIds.forEach((id, idx) => idIndexMap.set(id, idx));

    return [...items].sort((a, b) => {
      const idxA = idIndexMap.has(a.id) ? idIndexMap.get(a.id)! : 999999;
      const idxB = idIndexMap.has(b.id) ? idIndexMap.get(b.id)! : 999999;

      if (idxA !== idxB) {
        return idxA - idxB;
      }
      return naturalTitleCompare(a, b);
    });
  }

  // Fallback: natural title order
  return [...items].sort(naturalTitleCompare);
}

/**
 * Move item up in the order array
 */
export function moveItemInOrder(orderedIds: string[], targetId: string, direction: 'up' | 'down'): string[] {
  const index = orderedIds.indexOf(targetId);
  if (index === -1) return orderedIds;

  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= orderedIds.length) return orderedIds;

  const copy = [...orderedIds];
  const [removed] = copy.splice(index, 1);
  copy.splice(newIndex, 0, removed);
  return copy;
}
