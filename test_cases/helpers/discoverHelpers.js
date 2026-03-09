/**
 * discoverHelpers.js
 *
 * Pure-logic helpers extracted from the Tender Firebase app's source files.
 * These mirror the exact logic used in:
 *   - src/utils/helpers.js       (parseIngredients, escapeHtml, capitalizeFirst, getCuisineClass)
 *   - src/pages/discover.js      (filterAndRender filtering logic)
 *   - src/components/addRecipeModal.js  (DIETARY_OPTIONS, CUISINE_OPTIONS, validateNewRecipe)
 *
 * No Firebase imports here — these are pure functions that can run in
 * Node/Vitest without a browser or network connection.
 */

// ─────────────────────────────────────────────────────────────
// Helpers mirrored from src/utils/helpers.js
// ─────────────────────────────────────────────────────────────

/**
 * Escape HTML to prevent XSS — mirrors escapeHtml() in src/utils/helpers.js
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Capitalise first letter — mirrors capitalizeFirst() in src/utils/helpers.js
 * @param {string} str
 * @returns {string}
 */
export function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Parse ingredients — mirrors parseIngredients() in src/utils/helpers.js
 * Handles both array storage (Firestore) and newline-separated strings.
 * @param {string|string[]} raw
 * @returns {string[]}
 */
export function parseIngredients(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split('\n').map(s => s.trim()).filter(Boolean);
}

/**
 * Returns the CSS class for a cuisine gradient.
 * Mirrors getCuisineClass() in src/utils/helpers.js
 * @param {string} cuisine
 * @returns {string}
 */
export function getCuisineClass(cuisine) {
  const map = [
    'italian','mexican','japanese','chinese','indian',
    'thai','french','mediterranean','american','korean','greek','vietnamese',
  ];
  const c = (cuisine || '').toLowerCase();
  return map.includes(c) ? `cuisine-${c}` : 'cuisine-default';
}

// ─────────────────────────────────────────────────────────────
// Filter logic mirrored from src/pages/discover.js → filterAndRender()
// ─────────────────────────────────────────────────────────────

/**
 * Filter recipes by search text (name, description, ingredients).
 * Mirrors the matchSearch logic inside filterAndRender() in discover.js.
 * Search is client-side and case-insensitive (FR-33).
 * @param {Object[]} recipes
 * @param {string} text
 * @returns {Object[]}
 */
export function filterBySearch(recipes, text) {
  if (!text || text.trim() === '') return recipes;
  const lower = text.toLowerCase().trim();
  return recipes.filter(r => {
    const ingredients = parseIngredients(r.ingredients);
    return (
      (r.name && r.name.toLowerCase().includes(lower)) ||
      ((r.description || '').toLowerCase().includes(lower)) ||
      ingredients.some(i => i.toLowerCase().includes(lower))
    );
  });
}

/**
 * Filter recipes by cuisine type.
 * Mirrors the matchCuisine logic inside filterAndRender() in discover.js.
 * Empty/falsy cuisine returns all recipes (FR-34).
 * @param {Object[]} recipes
 * @param {string} cuisine
 * @returns {Object[]}
 */
export function filterByCuisine(recipes, cuisine) {
  if (!cuisine) return recipes;
  return recipes.filter(r => r.cuisine === cuisine);
}

/**
 * Filter recipes by difficulty level.
 * Mirrors the matchDiff logic inside filterAndRender() in discover.js.
 * The new website uses lowercase difficulty values: 'easy', 'medium', 'hard'.
 * Empty/falsy difficulty returns all recipes (FR-35).
 * @param {Object[]} recipes
 * @param {string} difficulty  'easy' | 'medium' | 'hard'
 * @returns {Object[]}
 */
export function filterByDifficulty(recipes, difficulty) {
  if (!difficulty) return recipes;
  return recipes.filter(r => r.difficulty === difficulty);
}

/**
 * Filter recipes by dietary tags (AND logic).
 * A recipe passes only if it includes ALL of the requested tags.
 * Tags are stored as an array on the recipe's `dietary` field (FR-36).
 * @param {Object[]} recipes
 * @param {string[]} tags
 * @returns {Object[]}
 */
export function filterByDietary(recipes, tags) {
  if (!tags || tags.length === 0) return recipes;
  return recipes.filter(r => {
    const recipeTags = Array.isArray(r.dietary)
      ? r.dietary.map(t => t.toLowerCase())
      : [];
    return tags.every(t => recipeTags.includes(t.toLowerCase()));
  });
}

/**
 * Apply all active filters at once — mirrors the full filterAndRender() pipeline.
 * @param {Object[]} recipes
 * @param {{ search?: string, cuisine?: string, difficulty?: string, dietary?: string[] }} filters
 * @returns {Object[]}
 */
export function applyAllFilters(recipes, { search = '', cuisine = '', difficulty = '', dietary = [] } = {}) {
  let result = recipes;
  result = filterBySearch(result, search);
  result = filterByCuisine(result, cuisine);
  result = filterByDifficulty(result, difficulty);
  result = filterByDietary(result, dietary);
  return result;
}

// ─────────────────────────────────────────────────────────────
// Constants mirrored from src/components/addRecipeModal.js
// ─────────────────────────────────────────────────────────────

/** Dietary options as defined in addRecipeModal.js (FR-36 / FR-40) */
export const DIETARY_OPTIONS = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free',
  'nut-free', 'halal', 'kosher', 'low-carb', 'keto', 'shellfish-free',
];

/** Cuisine options as defined in addRecipeModal.js (FR-34 / FR-40) */
export const CUISINE_OPTIONS = [
  'american', 'british', 'chinese', 'french', 'greek',
  'indian', 'italian', 'japanese', 'korean', 'lebanese',
  'mexican', 'middle eastern', 'thai', 'vietnamese', 'other',
];

/** Difficulty options as defined in addRecipeModal.js (FR-35 / FR-40) */
export const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'];

/** Required fields for a recipe card display (FR-32) */
export const REQUIRED_CARD_FIELDS = [
  'name', 'description', 'cookTime', 'servings', 'cuisine', 'difficulty',
];

/** Required fields for the recipe detail modal (FR-37) */
export const REQUIRED_DETAIL_FIELDS = [
  'name', 'description', 'cookTime', 'servings', 'cuisine', 'difficulty',
  'ingredients', 'instructions',
];

// ─────────────────────────────────────────────────────────────
// Validation mirrored from src/components/addRecipeModal.js → submit handler
// ─────────────────────────────────────────────────────────────

/**
 * Validates a new recipe payload before it is saved to Firestore (FR-40).
 * Mirrors the submit-handler validation in addRecipeModal.js.
 * Only `name` is required on the form; all other fields are optional.
 * @param {{ name?: string, [key: string]: any }} recipe
 * @returns {string[]} Array of error field names; empty = valid
 */
export function validateNewRecipe(recipe) {
  const errors = [];
  if (!recipe.name || recipe.name.trim() === '') errors.push('name');
  return errors;
}

/**
 * Validates that a recipe object contains all fields needed to render
 * the detail modal (FR-37).
 * @param {Object} recipe
 * @returns {string[]} Array of missing field names
 */
export function validateRecipeDetailFields(recipe) {
  return REQUIRED_DETAIL_FIELDS.filter(field => {
    const val = recipe[field];
    if (val === undefined || val === null) return true;
    if (typeof val === 'string' && val.trim() === '') return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  });
}

// ─────────────────────────────────────────────────────────────
// Like / unlike state helpers (mirrors logic in discover.js / recipeModal.js)
// ─────────────────────────────────────────────────────────────

/**
 * Returns true if the recipe is in the liked set.
 * @param {Set<string>} likedIds
 * @param {string} recipeId
 * @returns {boolean}
 */
export function isLiked(likedIds, recipeId) {
  return likedIds.has(recipeId);
}

/**
 * Returns a new Set with the recipe added (like action).
 * @param {Set<string>} likedIds
 * @param {string} recipeId
 * @returns {Set<string>}
 */
export function addLike(likedIds, recipeId) {
  const next = new Set(likedIds);
  next.add(recipeId);
  return next;
}

/**
 * Returns a new Set with the recipe removed (unlike action).
 * @param {Set<string>} likedIds
 * @param {string} recipeId
 * @returns {Set<string>}
 */
export function removeLike(likedIds, recipeId) {
  const next = new Set(likedIds);
  next.delete(recipeId);
  return next;
}
