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

/**
 * Apply a subtle 3-D mouse-tracking tilt to cards inside a container.
 * @param {Element} container  - parent element to query within
 * @param {string}  selector   - CSS selector for the tiltable cards
 */
export function applyCardTilt(container, selector) {
  if (!container) return;
  container.querySelectorAll(selector).forEach(card => {
    card.addEventListener('mousemove', function (e) {
      const r  = this.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
      const dy = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
      this.style.transition = 'transform 0.06s linear';
      this.style.transform  = `perspective(500px) rotateX(${-dy * 5}deg) rotateY(${dx * 5}deg) translateY(-3px)`;
    });
    card.addEventListener('mouseleave', function () {
      this.style.transition = 'transform 0.3s ease';
      this.style.transform  = '';
    });
  });
}
