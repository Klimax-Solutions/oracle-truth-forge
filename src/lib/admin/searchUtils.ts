/**
 * Normalize text for accent-insensitive, case-insensitive search.
 */
export const normalizeSearchText = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

/**
 * Check if any of the given fields match the search query.
 * Returns true if searchQuery is empty.
 */
export const matchesSearch = (
  searchQuery: string,
  ...fields: (string | null | undefined)[]
): boolean => {
  if (!searchQuery.trim()) return true;
  const q = normalizeSearchText(searchQuery);
  return fields.some(f => normalizeSearchText(f).includes(q));
};
