/**
 * Sorting utilities for products/assets.
 */

export const comparators = {
  byPriceDesc: (a, b) => Number(b.price) - Number(a.price),
  byPriceAsc: (a, b) => Number(a.price) - Number(b.price),
  byUpdatedAtDesc: (a, b) => new Date(b.sourceUpdatedAt || 0) - new Date(a.sourceUpdatedAt || 0),
  byUpdatedAtAsc: (a, b) => new Date(a.sourceUpdatedAt || 0) - new Date(b.sourceUpdatedAt || 0),
  byName: (a, b) => (a.name || '').localeCompare(b.name || ''),
};

/**
 * Group items by a key and sort within each group.
 * @param {object[]} items
 * @param {string} groupKey - Property to group by
 * @param {Function} sortFn - Comparator function
 * @returns {Map<string, object[]>}
 */
export function groupAndSort(items, groupKey, sortFn = comparators.byPriceDesc) {
  const groups = new Map();

  for (const item of items) {
    const key = item[groupKey] || 'Unknown';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  for (const [key, list] of groups) {
    groups.set(key, list.sort(sortFn));
  }

  return groups;
}
