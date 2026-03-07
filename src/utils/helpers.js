/** Escape HTML to prevent XSS. */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Capitalise first letter. */
export function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** CSS class name for a cuisine gradient. */
export function getCuisineClass(cuisine) {
  const map = [
    'italian','mexican','japanese','chinese','indian',
    'thai','french','mediterranean','american','korean','greek','vietnamese',
  ];
  const c = (cuisine || '').toLowerCase();
  return map.includes(c) ? `cuisine-${c}` : 'cuisine-default';
}

/** Parse ingredients — stored as newline-separated string or array. */
export function parseIngredients(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split('\n').map(s => s.trim()).filter(Boolean);
}
